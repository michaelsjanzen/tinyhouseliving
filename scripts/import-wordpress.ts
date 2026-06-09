#!/usr/bin/env node
/**
 * Pugmill WordPress Importer
 *
 * Imports posts, pages, categories, tags, and media from a WordPress WXR export
 * directly into a Pugmill CMS database.
 *
 * Usage:
 *   npx tsx scripts/import-wordpress.ts --file export.xml [--env .env.local] [--dry-run]
 *
 * Additional dependencies required (install in your Pugmill project):
 *   npm install fast-xml-parser turndown @types/turndown
 *
 * Options:
 *   --file      Path to the WXR export file (required)
 *   --env       Path to your env file (default: .env.local)
 *   --dry-run   Parse and log what would be imported without writing to the DB
 */

import fs from "fs";
import path from "path";
import { parseArgs } from "util";
import { config as loadEnv } from "dotenv";

// ─── CLI args ─────────────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    file:    { type: "string" },
    env:     { type: "string", default: ".env.local" },
    "dry-run": { type: "boolean", default: false },
  },
});

if (!args.file) {
  console.error("Usage: npx tsx scripts/import-wordpress.ts --file export.xml [--env .env.local] [--dry-run]");
  process.exit(1);
}

const DRY_RUN = args["dry-run"] ?? false;
const ENV_PATH = path.resolve(process.cwd(), args.env!);
const WXR_PATH = path.resolve(process.cwd(), args.file!);

// Load env before importing anything that reads process.env
loadEnv({ path: ENV_PATH });

// ─── Imports that depend on env ────────────────────────────────────────────────

import { XMLParser } from "fast-xml-parser";
import TurndownService from "turndown";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { getStorage } from "../src/lib/storage";

// Inline minimal schema references so the script works without importing
// the full Next.js module graph.
import {
  posts,
  categories,
  tags,
  media,
} from "../src/lib/db/schema";

// Junction tables aren't always exported from schema.ts, so we use raw SQL
// for those inserts.

// ─── Database ─────────────────────────────────────────────────────────────────

// Supabase (and most managed Postgres) require SSL. pg treats sslmode=require as
// verify-full, which rejects Supabase's self-signed cert, so we strip sslmode and
// pass our own ssl option (mirrors src/lib/db/index.ts). Local Postgres gets no SSL.
const rawConn = process.env.DATABASE_URL ?? "";
const isLocalDb = rawConn.includes("localhost") || rawConn.includes("127.0.0.1");
const pool = new Pool({
  connectionString: rawConn.replace(/([?&])sslmode=[^&]*/g, "$1").replace(/[?&]$/, ""),
  ssl: isLocalDb ? undefined : { rejectUnauthorized: false },
});
const db = drizzle(pool);

// ─── Markdown converter ───────────────────────────────────────────────────────

const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });

// Strip Gutenberg block comments
td.addRule("gutenberg-comments", {
  filter: (node) => node.nodeType === 8, // Comment node
  replacement: () => "",
});

function htmlToMarkdown(html: string): string {
  if (!html) return "";
  // Strip Gutenberg block comment strings before parsing
  const cleaned = html
    .replace(/<!-- wp:[^>]*-->/g, "")
    .replace(/<!-- \/wp:[^>]* -->/g, "")
    .trim();
  return td.turndown(cleaned);
}

// ─── Slug helpers ─────────────────────────────────────────────────────────────

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uniqueSlug(base: string, existingSlugs: Set<string>): Promise<string> {
  let slug = base;
  let i = 2;
  while (existingSlugs.has(slug)) {
    slug = `${base}-${i++}`;
  }
  existingSlugs.add(slug);
  return slug;
}

// ─── WXR types ────────────────────────────────────────────────────────────────

interface WxrCategory {
  "wp:cat_id": number;
  "wp:cat_name": string;
  "wp:category_nicename": string;
  "wp:category_description"?: string;
}

interface WxrTag {
  "wp:term_id": number;
  "wp:tag_name": string;
  "wp:tag_slug": string;
}

interface WxrPostMeta {
  "wp:meta_key": string;
  "wp:meta_value": string | number;
}

interface WxrItem {
  title: string;
  link: string;
  "content:encoded": string;
  "excerpt:encoded"?: string;
  "wp:post_id": number;
  "wp:post_date": string;
  "wp:post_name": string;
  "wp:status": string;
  "wp:post_type": string;
  "wp:post_parent": number;
  "wp:attachment_url"?: string;
  "dc:creator"?: string;
  category?: Array<{ "@_domain": string; "@_nicename": string; "#text": string }> | { "@_domain": string; "@_nicename": string; "#text": string };
  "wp:postmeta"?: WxrPostMeta[] | WxrPostMeta;
}

// ─── Parse WXR ────────────────────────────────────────────────────────────────

function parseWxr(filePath: string) {
  const xml = fs.readFileSync(filePath, "utf-8");

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    // NOTE: do NOT set cdataPropName here. WXR wraps post_type, status, cat_name,
    // content:encoded, etc. in CDATA; with cdataPropName those parse as objects
    // ({ "#text": ... }), so string comparisons like post_type === "post" silently
    // fail (yielding 0 posts) and names import as "[object Object]". Default
    // handling parses CDATA as plain strings, which is what the rest of this script expects.
    isArray: (name) =>
      ["item", "wp:category", "wp:tag", "wp:postmeta", "category"].includes(name),
  });

  const result = parser.parse(xml);
  const channel = result?.rss?.channel;

  if (!channel) throw new Error("Invalid WXR file: no <channel> found.");

  const wxrCategories: WxrCategory[] = channel["wp:category"] ?? [];
  const wxrTags: WxrTag[] = channel["wp:tag"] ?? [];
  const items: WxrItem[] = channel["item"] ?? [];

  return { wxrCategories, wxrTags, items };
}

// ─── Media download + upload ──────────────────────────────────────────────────

async function downloadAndUpload(
  url: string,
  adminUserId: string
): Promise<{ id: number; url: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const urlPath = new URL(url).pathname;
    const fileName = path.basename(urlPath) || "attachment";
    const buffer = Buffer.from(await res.arrayBuffer());

    const storage = getStorage();
    const { url: storedUrl, storageKey } = await storage.upload(buffer, fileName, contentType);

    const [row] = await db
      .insert(media)
      .values({
        fileName,
        fileType: contentType,
        fileSize: buffer.byteLength,
        url: storedUrl,
        storageKey,
        uploaderId: adminUserId,
      } as typeof media.$inferInsert)
      .returning({ id: media.id, url: media.url });

    return row;
  } catch (err) {
    console.warn(`  [media] Could not download ${url}: ${(err as Error).message}`);
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nPugmill WordPress Importer${DRY_RUN ? " (DRY RUN)" : ""}`);
  console.log(`File: ${WXR_PATH}\n`);

  if (!fs.existsSync(WXR_PATH)) {
    console.error(`File not found: ${WXR_PATH}`);
    process.exit(1);
  }

  // Get the admin user to attribute imports to
  const adminResult = await pool.query("SELECT id FROM admin_users LIMIT 1");
  if (adminResult.rows.length === 0) {
    console.error("No admin user found. Run npm run setup first.");
    process.exit(1);
  }
  const adminUserId: string = adminResult.rows[0].id;

  // Parse
  console.log("Parsing WXR...");
  const { wxrCategories, wxrTags, items } = parseWxr(WXR_PATH);

  const wpPosts    = items.filter((i) => i["wp:post_type"] === "post");
  const wpPages    = items.filter((i) => i["wp:post_type"] === "page");
  const wpMedia    = items.filter((i) => i["wp:post_type"] === "attachment");
  const published  = [...wpPosts, ...wpPages].filter((i) => i["wp:status"] === "publish");
  const drafts     = [...wpPosts, ...wpPages].filter((i) => i["wp:status"] === "draft");

  console.log(`  ${wxrCategories.length} categories`);
  console.log(`  ${wxrTags.length} tags`);
  console.log(`  ${wpPosts.length} posts (${wpPosts.filter(i => i["wp:status"] === "publish").length} published, ${wpPosts.filter(i => i["wp:status"] === "draft").length} drafts)`);
  console.log(`  ${wpPages.length} pages (${wpPages.filter(i => i["wp:status"] === "publish").length} published, ${wpPages.filter(i => i["wp:status"] === "draft").length} drafts)`);
  console.log(`  ${wpMedia.length} media attachments`);

  if (DRY_RUN) {
    console.log("\nDry run complete. No data written.");
    await pool.end();
    return;
  }

  // ── 1. Categories ───────────────────────────────────────────────────────────
  console.log("\n[1/5] Importing categories...");
  const categoryMap = new Map<number, number>(); // wpId → pugmillId
  const existingCatSlugs = new Set(
    (await db.select({ slug: categories.slug }).from(categories)).map((r) => r.slug)
  );

  for (const cat of wxrCategories) {
    const name = String(cat["wp:cat_name"]);
    const baseSlug = String(cat["wp:category_nicename"]) || slugify(name);
    const slug = await uniqueSlug(baseSlug, existingCatSlugs);

    const [existing] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.name, name))
      .limit(1);

    if (existing) {
      categoryMap.set(Number(cat["wp:cat_id"]), existing.id);
      console.log(`  skip (exists): ${name}`);
    } else {
      const [row] = await db
        .insert(categories)
        .values({
          name,
          slug,
          description: String(cat["wp:category_description"] ?? ""),
        } as typeof categories.$inferInsert)
        .returning({ id: categories.id });
      categoryMap.set(Number(cat["wp:cat_id"]), row.id);
      console.log(`  created: ${name} (${slug})`);
    }
  }

  // ── 2. Tags ─────────────────────────────────────────────────────────────────
  console.log("\n[2/5] Importing tags...");
  const tagMap = new Map<number, number>(); // wpId → pugmillId
  const existingTagSlugs = new Set(
    (await db.select({ slug: tags.slug }).from(tags)).map((r) => r.slug)
  );

  for (const tag of wxrTags) {
    const name = String(tag["wp:tag_name"]);
    const baseSlug = String(tag["wp:tag_slug"]) || slugify(name);
    const slug = await uniqueSlug(baseSlug, existingTagSlugs);

    const [existing] = await db
      .select({ id: tags.id })
      .from(tags)
      .where(eq(tags.name, name))
      .limit(1);

    if (existing) {
      tagMap.set(Number(tag["wp:term_id"]), existing.id);
      console.log(`  skip (exists): ${name}`);
    } else {
      const [row] = await db
        .insert(tags)
        .values({ name, slug } as typeof tags.$inferInsert)
        .returning({ id: tags.id });
      tagMap.set(Number(tag["wp:term_id"]), row.id);
      console.log(`  created: ${name} (${slug})`);
    }
  }

  // ── 3. Media ─────────────────────────────────────────────────────────────────
  console.log("\n[3/5] Downloading media...");
  const mediaMap = new Map<number, number>(); // wpPostId → pugmillMediaId
  const mediaUrlMap = new Map<string, string>(); // original URL → new URL (for content rewriting)

  for (const attachment of wpMedia) {
    const wpId = Number(attachment["wp:post_id"]);
    const url = attachment["wp:attachment_url"];
    if (!url) continue;

    process.stdout.write(`  ${path.basename(url)}... `);
    const result = await downloadAndUpload(String(url), adminUserId);
    if (result) {
      mediaMap.set(wpId, result.id);
      mediaUrlMap.set(String(url), result.url);
      console.log("ok");
    } else {
      console.log("failed (skipped)");
    }
  }

  // ── 4. Posts and pages ───────────────────────────────────────────────────────
  console.log("\n[4/5] Importing posts and pages...");

  const allItems = [...wpPosts, ...wpPages];
  const existingPostSlugs = new Set(
    (await db.select({ slug: posts.slug }).from(posts)).map((r) => r.slug)
  );

  const skipped: string[] = [];
  const warnings: string[] = [];
  let imported = 0;

  for (const item of allItems) {
    const wpSlug = String(item["wp:post_name"]) || slugify(String(item.title));
    const title = String(item.title);
    const type = item["wp:post_type"] === "page" ? "page" : "post";
    const isPublished = item["wp:status"] === "publish";
    const publishedAt = item["wp:post_date"]
      ? new Date(String(item["wp:post_date"]))
      : null;

    // Skip if slug already exists
    if (existingPostSlugs.has(wpSlug)) {
      skipped.push(`${type}: "${title}" (slug "${wpSlug}" already exists)`);
      continue;
    }

    const slug = await uniqueSlug(wpSlug, existingPostSlugs);

    // Convert content
    const rawHtml = String(item["content:encoded"] ?? "");
    let content = htmlToMarkdown(rawHtml);

    // Rewrite media URLs in content
    for (const [originalUrl, newUrl] of mediaUrlMap) {
      content = content.replaceAll(originalUrl, newUrl);
    }

    const excerpt = item["excerpt:encoded"]
      ? htmlToMarkdown(String(item["excerpt:encoded"]))
      : undefined;

    // Resolve featured image
    const metas = Array.isArray(item["wp:postmeta"])
      ? item["wp:postmeta"]
      : item["wp:postmeta"]
      ? [item["wp:postmeta"]]
      : [];

    const thumbnailMeta = metas.find((m) => m["wp:meta_key"] === "_thumbnail_id");
    const featuredImageId = thumbnailMeta
      ? mediaMap.get(Number(thumbnailMeta["wp:meta_value"])) ?? null
      : null;

    // Insert post
    const [newPost] = await db
      .insert(posts)
      .values({
        type,
        title,
        slug,
        content,
        excerpt: excerpt ?? null,
        published: isPublished,
        publishedAt: isPublished ? (publishedAt ?? new Date()) : null,
        featuredImage: featuredImageId,
        authorId: adminUserId,
      } as typeof posts.$inferInsert)
      .returning({ id: posts.id });

    // Wire up categories
    const itemCategories = Array.isArray(item.category)
      ? item.category
      : item.category
      ? [item.category]
      : [];

    for (const cat of itemCategories) {
      if (cat["@_domain"] !== "category") continue;
      // Look up by nicename
      const wpCat = wxrCategories.find(
        (c) => String(c["wp:category_nicename"]) === cat["@_nicename"]
      );
      if (!wpCat) continue;
      const pugmillCatId = categoryMap.get(Number(wpCat["wp:cat_id"]));
      if (!pugmillCatId) continue;
      await pool.query(
        "INSERT INTO post_categories (post_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [newPost.id, pugmillCatId]
      );
    }

    // Wire up tags
    for (const cat of itemCategories) {
      if (cat["@_domain"] !== "post_tag") continue;
      const wpTag = wxrTags.find(
        (t) => String(t["wp:tag_slug"]) === cat["@_nicename"]
      );
      if (!wpTag) continue;
      const pugmillTagId = tagMap.get(Number(wpTag["wp:term_id"]));
      if (!pugmillTagId) continue;
      await pool.query(
        "INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [newPost.id, pugmillTagId]
      );
    }

    if (!isPublished && item["wp:status"] !== "draft") {
      warnings.push(`"${title}" has status "${item["wp:status"]}" -- imported as draft`);
    }

    console.log(`  [${type}] ${isPublished ? "published" : "draft "}: ${title}`);
    imported++;
  }

  // ── 5. Summary ──────────────────────────────────────────────────────────────
  console.log("\n[5/5] Done.\n");
  console.log("─────────────────────────────────────");
  console.log(`  Categories imported : ${categoryMap.size}`);
  console.log(`  Tags imported       : ${tagMap.size}`);
  console.log(`  Media imported      : ${mediaMap.size} / ${wpMedia.length}`);
  console.log(`  Posts/pages imported: ${imported}`);
  console.log(`  Skipped (duplicate) : ${skipped.length}`);
  console.log("─────────────────────────────────────");

  if (skipped.length > 0) {
    console.log("\nSkipped (slug already exists):");
    skipped.forEach((s) => console.log(`  - ${s}`));
  }

  if (warnings.length > 0) {
    console.log("\nWarnings:");
    warnings.forEach((w) => console.log(`  ! ${w}`));
  }

  if (mediaMap.size < wpMedia.length) {
    console.log(
      `\n  ${wpMedia.length - mediaMap.size} media file(s) could not be downloaded.`
    );
    console.log("  Check that the original WordPress site is still accessible,");
    console.log("  or update the content manually for any missing images.");
  }

  console.log("\nImport complete.");
  await pool.end();
}

main().catch((err) => {
  console.error("\nImport failed:", err);
  pool.end();
  process.exit(1);
});
