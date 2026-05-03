/**
 * Shared post query helpers used by the homepage, category archives,
 * and tag archives. Centralises the bulk-fetch / no-N+1 pattern so
 * each route doesn't duplicate it.
 */

import { db } from "@/lib/db";
import { posts, postCategories, postTags, categories, tags, media } from "@/lib/db/schema";
import { and, eq, inArray, desc, count, sql } from "drizzle-orm";
import type { PostSummary } from "@/types";

export const PAGE_SIZE = 10;

interface FetchOptions {
  page?: number;
  /** Filter to posts belonging to this category slug */
  categorySlug?: string;
  /** Filter to posts belonging to this tag slug */
  tagSlug?: string;
  /** Exclude this post id (used to remove the featured post from the feed) */
  excludeId?: number;
  /** When true, omit any post with featured=true. Used by the homepage
   *  PostFeedRenderer so that featured posts only appear in the dedicated
   *  Featured Post section and don't duplicate into the regular feed.
   *  Category, tag, and /blog listings should leave this false so users
   *  browsing a filtered view still see the featured post. */
  excludeFeatured?: boolean;
  /** Override the default page size. 0 or undefined = use PAGE_SIZE. */
  limit?: number;
}

export interface PostPage {
  posts: PostSummary[];
  page: number;
  totalPages: number;
  totalCount: number;
}

/**
 * Fetch a paginated page of published posts with categories, tags,
 * and featured images pre-joined (no N+1 queries).
 *
 * Supports optional filtering by category or tag slug.
 */
export async function fetchPostPage({
  page = 1,
  categorySlug,
  tagSlug,
  excludeId,
  excludeFeatured = false,
  limit,
}: FetchOptions = {}): Promise<PostPage> {
  const pageSize = (limit && limit > 0) ? limit : PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  // Build the base where clause
  const baseWhere = and(
    eq(posts.published, true),
    eq(posts.type, "post"),
  );

  // Shared optional clauses applied across every branch below.
  const idExclusion       = excludeId ? sql`${posts.id} != ${excludeId}` : undefined;
  const featuredExclusion = excludeFeatured ? eq(posts.featured, false) : undefined;

  // ── Category-filtered query ────────────────────────────────────────────────
  if (categorySlug) {
    const cat = await db.query.categories.findFirst({
      where: eq(categories.slug, categorySlug),
    });
    if (!cat) return { posts: [], page, totalPages: 0, totalCount: 0 };

    const catFilter = and(
      baseWhere,
      inArray(
        posts.id,
        db.select({ id: postCategories.postId })
          .from(postCategories)
          .where(eq(postCategories.categoryId, cat.id)),
      ),
      idExclusion,
      featuredExclusion,
    );

    const [rows, countRows] = await Promise.all([
      db.select().from(posts).where(catFilter).orderBy(desc(posts.publishedAt)).limit(pageSize).offset(offset),
      db.select({ n: count() }).from(posts).where(catFilter),
    ]);

    return buildPage(rows, countRows[0]?.n ?? 0, page, pageSize);
  }

  // ── Tag-filtered query ─────────────────────────────────────────────────────
  if (tagSlug) {
    const tag = await db.query.tags.findFirst({
      where: eq(tags.slug, tagSlug),
    });
    if (!tag) return { posts: [], page, totalPages: 0, totalCount: 0 };

    const tagFilter = and(
      baseWhere,
      inArray(
        posts.id,
        db.select({ id: postTags.postId })
          .from(postTags)
          .where(eq(postTags.tagId, tag.id)),
      ),
      idExclusion,
      featuredExclusion,
    );

    const [rows, countRows] = await Promise.all([
      db.select().from(posts).where(tagFilter).orderBy(desc(posts.publishedAt)).limit(pageSize).offset(offset),
      db.select({ n: count() }).from(posts).where(tagFilter),
    ]);

    return buildPage(rows, countRows[0]?.n ?? 0, page, pageSize);
  }

  // ── Unfiltered (homepage) ──────────────────────────────────────────────────
  const where = and(
    baseWhere,
    idExclusion,
    featuredExclusion,
  );

  const [rows, countRows] = await Promise.all([
    db.select().from(posts).where(where).orderBy(desc(posts.publishedAt)).limit(pageSize).offset(offset),
    db.select({ n: count() }).from(posts).where(where),
  ]);

  return buildPage(rows, countRows[0]?.n ?? 0, page, pageSize);
}

/**
 * Fetch the single featured post (published, type=post, featured=true).
 * Returns null if none is marked featured.
 */
export async function fetchFeaturedPost(): Promise<PostSummary | null> {
  const rows = await db
    .select()
    .from(posts)
    .where(and(eq(posts.published, true), eq(posts.type, "post"), eq(posts.featured, true)))
    .orderBy(desc(posts.publishedAt))
    .limit(1);

  if (rows.length === 0) return null;

  const [enriched] = await enrichPosts(rows);
  return enriched ?? null;
}

// ─── Internal helpers (private) ───────────────────────────────────────────────

async function buildPage(
  rows: (typeof posts.$inferSelect)[],
  totalCount: number,
  page: number,
  pageSize: number = PAGE_SIZE,
): Promise<PostPage> {
  const enriched = await enrichPosts(rows);
  return {
    posts: enriched,
    page,
    totalPages: Math.ceil(totalCount / pageSize),
    totalCount,
  };
}

/**
 * Fetch a single published post by ID, enriched with categories, tags, and image.
 * Returns null if not found or not published.
 */
export async function fetchPostById(id: number): Promise<PostSummary | null> {
  const rows = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, id), eq(posts.published, true), eq(posts.type, "post")))
    .limit(1);

  if (rows.length === 0) return null;
  const [enriched] = await enrichPosts(rows);
  return enriched ?? null;
}

async function enrichPosts(rows: (typeof posts.$inferSelect)[]): Promise<PostSummary[]> {
  if (rows.length === 0) return [];

  const postIds = rows.map(p => p.id);
  const mediaIds = rows.map(p => p.featuredImage).filter((id): id is number => id !== null);

  const [postCatRows, postTagRows, mediaRows] = await Promise.all([
    db.select({ postId: postCategories.postId, name: categories.name, slug: categories.slug })
      .from(postCategories)
      .innerJoin(categories, eq(categories.id, postCategories.categoryId))
      .where(inArray(postCategories.postId, postIds)),
    db.select({ postId: postTags.postId, name: tags.name, slug: tags.slug })
      .from(postTags)
      .innerJoin(tags, eq(tags.id, postTags.tagId))
      .where(inArray(postTags.postId, postIds)),
    mediaIds.length
      ? db.select({ id: media.id, url: media.url }).from(media).where(inArray(media.id, mediaIds))
      : [],
  ]);

  const catsByPost = new Map<number, { name: string; slug: string }[]>();
  const tagsByPost = new Map<number, { name: string; slug: string }[]>();
  const mediaById = new Map<number, string>(mediaRows.map(m => [m.id, m.url] as [number, string]));

  for (const row of postCatRows) {
    const list = catsByPost.get(row.postId) ?? [];
    list.push({ name: row.name, slug: row.slug });
    catsByPost.set(row.postId, list);
  }
  for (const row of postTagRows) {
    const list = tagsByPost.get(row.postId) ?? [];
    list.push({ name: row.name, slug: row.slug });
    tagsByPost.set(row.postId, list);
  }

  return rows.map(p => ({
    id: p.id,
    type: p.type,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt ?? "",
    publishedAt: p.publishedAt,
    featuredImageUrl: p.featuredImage != null ? (mediaById.get(p.featuredImage) ?? null) : null,
    categories: catsByPost.get(p.id) ?? [],
    tags: tagsByPost.get(p.id) ?? [],
  }));
}
