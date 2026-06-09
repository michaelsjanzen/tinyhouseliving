#!/usr/bin/env node
/**
 * Post-import repair for the WordPress migration (one-off, idempotent).
 *
 * Fixes four defects left by import-wordpress.ts on this site's WXR:
 *   1. post_categories collapsed onto one category (importer read wp:cat_id;
 *      WXR 1.2 uses wp:term_id) — rebuilt here from the WXR by nicename/slug.
 *   2. 11 media files never imported: 9 duplicate-basename Blob collisions
 *      (re-uploaded under a unique "<wpId>-<basename>" name) and 2 office docs
 *      whose MIME type overflows media.file_type varchar(50) (truncated).
 *   3. Content URLs still pointing at michaeljanzen.com: resized variants
 *      (-WxH stripped → original's Blob URL), exact attachment URLs, and
 *      internal post/page links (→ relative /post/<slug> or /<slug>).
 *   4. featured_image gaps caused by #2 (re-resolved from _thumbnail_id).
 *
 * Usage:
 *   npx tsx scripts/repair-import.ts --file export.xml --env .env.import.local [--dry-run]
 */

import fs from "fs";
import path from "path";
import { parseArgs } from "util";
import { config as loadEnv } from "dotenv";

const { values: args } = parseArgs({
  options: {
    file: { type: "string" },
    env: { type: "string", default: ".env.local" },
    "dry-run": { type: "boolean", default: false },
  },
});

if (!args.file) {
  console.error("Usage: npx tsx scripts/repair-import.ts --file export.xml [--env .env.import.local] [--dry-run]");
  process.exit(1);
}

const DRY = args["dry-run"] ?? false;
loadEnv({ path: path.resolve(process.cwd(), args.env!) });

import { XMLParser } from "fast-xml-parser";
import { Pool } from "pg";
import { getStorage } from "../src/lib/storage";

const rawConn = process.env.DATABASE_URL ?? "";
const isLocalDb = rawConn.includes("localhost") || rawConn.includes("127.0.0.1");
const pool = new Pool({
  connectionString: rawConn.replace(/([?&])sslmode=[^&]*/g, "$1").replace(/[?&]$/, ""),
  ssl: isLocalDb ? undefined : { rejectUnauthorized: false },
});

type WxrItem = Record<string, any>;

function parseWxr(file: string) {
  const xml = fs.readFileSync(file, "utf-8");
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (name) => ["item", "wp:category", "wp:tag", "wp:postmeta", "category"].includes(name),
  });
  const channel = parser.parse(xml)?.rss?.channel;
  if (!channel) throw new Error("Invalid WXR");
  return {
    items: (channel.item ?? []) as WxrItem[],
    wxrCategories: (channel["wp:category"] ?? []) as WxrItem[],
  };
}

const asArr = (v: any) => (Array.isArray(v) ? v : v ? [v] : []);

async function main() {
  console.log(`\nImport repair${DRY ? " (DRY RUN)" : ""}\n`);
  const { items } = parseWxr(path.resolve(args.file!));

  const wpPosts = items.filter((i) => i["wp:post_type"] === "post" || i["wp:post_type"] === "page");
  const wpAttachments = items.filter((i) => i["wp:post_type"] === "attachment");

  const adminRes = await pool.query("SELECT id FROM admin_users LIMIT 1");
  const adminId: string = adminRes.rows[0].id;

  // DB lookups
  const catRows = (await pool.query("SELECT id, slug FROM categories")).rows;
  const catBySlug = new Map<string, number>(catRows.map((r: any) => [r.slug, r.id]));
  const postRows = (await pool.query("SELECT id, slug, type FROM posts")).rows;
  const postBySlug = new Map<string, { id: number; type: string }>(
    postRows.map((r: any) => [r.slug, { id: r.id, type: r.type }])
  );
  const mediaRows = (await pool.query("SELECT id, file_name, url FROM media")).rows;
  const mediaByFileName = new Map<string, { id: number; url: string }[]>();
  for (const m of mediaRows) {
    const list = mediaByFileName.get(m.file_name) ?? [];
    list.push({ id: m.id, url: m.url });
    mediaByFileName.set(m.file_name, list);
  }

  // ── A. Re-import the 11 missing media ──────────────────────────────────────
  console.log("[A] Missing media (collisions + oversize MIME)...");
  // attachment wpId → { id, url } for everything resolvable (existing or new)
  const mediaByWpId = new Map<number, { id: number; url: string }>();
  const urlMap = new Map<string, string>(); // original WP URL → blob URL
  let reuploaded = 0;

  for (const att of wpAttachments) {
    const wpId = Number(att["wp:post_id"]);
    const url = String(att["wp:attachment_url"] ?? "");
    if (!url) continue;
    const base = path.basename(new URL(url).pathname);
    const existing = mediaByFileName.get(base);

    if (existing && existing.length === 1 && !urlMap.has(url)) {
      // imported on the first pass
      mediaByWpId.set(wpId, existing[0]);
      urlMap.set(url, existing[0].url);
      continue;
    }
    // Missing (collision or failed insert): re-fetch and upload under a unique name
    const uniqueName = `${wpId}-${base}`;
    const already = mediaByFileName.get(uniqueName);
    if (already?.length) {
      // repair already ran once — reuse
      mediaByWpId.set(wpId, already[0]);
      urlMap.set(url, already[0].url);
      continue;
    }
    if (DRY) {
      console.log(`  would re-upload: ${base} → uploads/${uniqueName}`);
      continue;
    }
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const mime = (res.headers.get("content-type") ?? "application/octet-stream").slice(0, 50);
      const buf = Buffer.from(await res.arrayBuffer());
      const storage = getStorage();
      const up = await storage.upload(buf, uniqueName, mime);
      const ins = await pool.query(
        `INSERT INTO media (file_name, file_type, file_size, url, storage_key, uploader_id)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, url`,
        [uniqueName, mime, buf.byteLength, up.url, up.storageKey, adminId]
      );
      mediaByWpId.set(wpId, ins.rows[0]);
      urlMap.set(url, ins.rows[0].url);
      console.log(`  re-uploaded: ${base} → ${uniqueName}`);
      reuploaded++;
    } catch (e) {
      console.warn(`  ! still failing: ${url}: ${(e as Error).message}`);
    }
  }
  console.log(`  re-uploaded ${reuploaded}; total attachment URLs resolvable: ${urlMap.size}/${wpAttachments.length}`);

  // ── B. Rebuild post_categories from the WXR ────────────────────────────────
  console.log("\n[B] Rebuilding post_categories...");
  let catLinks = 0;
  const catOps: [number, number][] = [];
  for (const item of wpPosts) {
    const slug = String(item["wp:post_name"]);
    const post = postBySlug.get(slug);
    if (!post) continue;
    for (const c of asArr(item.category)) {
      if (c["@_domain"] !== "category") continue;
      const catId = catBySlug.get(String(c["@_nicename"]));
      if (catId) catOps.push([post.id, catId]);
    }
  }
  if (!DRY) {
    await pool.query("DELETE FROM post_categories");
    for (const [postId, catId] of catOps) {
      await pool.query(
        "INSERT INTO post_categories (post_id, category_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        [postId, catId]
      );
      catLinks++;
    }
  }
  console.log(DRY ? `  would create ${catOps.length} links` : `  created ${catLinks} links (old rows wiped)`);

  // ── C. Rewrite content URLs ─────────────────────────────────────────────────
  console.log("\n[C] Rewriting content URLs...");
  const contentRows = (await pool.query("SELECT id, slug, content FROM posts")).rows;
  let postsTouched = 0, variantHits = 0, exactHits = 0, internalHits = 0, orphanHits = 0;
  const unresolved = new Set<string>();

  // Orphan variants: images whose full-size original was never a WP attachment
  // (gallery/page art). Fetch the variant file itself once and Blob it.
  const orphanCache = new Map<string, string | null>();
  async function uploadOrphanVariant(fullUrl: string): Promise<string | null> {
    if (orphanCache.has(fullUrl)) return orphanCache.get(fullUrl)!;
    if (DRY) { orphanCache.set(fullUrl, null); return null; }
    try {
      const res = await fetch(fullUrl, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const mime = (res.headers.get("content-type") ?? "application/octet-stream").slice(0, 50);
      const buf = Buffer.from(await res.arrayBuffer());
      const name = path.basename(new URL(fullUrl).pathname);
      const storage = getStorage();
      const up = await storage.upload(buf, name, mime);
      await pool.query(
        `INSERT INTO media (file_name, file_type, file_size, url, storage_key, uploader_id)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [name, mime, buf.byteLength, up.url, up.storageKey, adminId]
      );
      console.log(`  orphan variant uploaded: ${name}`);
      orphanCache.set(fullUrl, up.url);
      return up.url;
    } catch (e) {
      console.warn(`  ! orphan variant failed: ${fullUrl}: ${(e as Error).message}`);
      orphanCache.set(fullUrl, null);
      return null;
    }
  }

  // Internal links whose URL slug doesn't exactly match an imported slug
  // (WP truncates post_name). Conservative: rewrite only when exactly one
  // imported slug (≥10 chars) is a prefix of the URL slug.
  function resolveSlug(slug: string): { slug: string; type: string } | null {
    const exact = postBySlug.get(slug);
    if (exact) return { slug, type: exact.type };
    const prefixes = [...postBySlug.keys()].filter((s) => s.length >= 10 && slug.startsWith(s));
    if (prefixes.length === 1) {
      const p = postBySlug.get(prefixes[0])!;
      return { slug: prefixes[0], type: p.type };
    }
    return null;
  }

  for (const row of contentRows) {
    let c: string = row.content;
    const before = c;

    // exact attachment URLs (covers the 11 repaired + any stragglers)
    for (const [orig, blob] of urlMap) {
      if (c.includes(orig)) { c = c.split(orig).join(blob); exactHits++; }
    }

    // resized variants: .../name-640x480.ext → original URL → blob
    const variantRe = /https?:\/\/michaeljanzen\.com\/wp-content\/uploads\/([^\s)"'<>\]]+)-\d+x\d+\.(png|jpe?g|gif|webp)/gi;
    const variantMatches = [...c.matchAll(variantRe)];
    for (const m of variantMatches) {
      const [full, p1, ext] = m;
      const origUrl = `https://michaeljanzen.com/wp-content/uploads/${p1}.${ext}`;
      let blob = urlMap.get(origUrl) ?? null;
      if (!blob) blob = await uploadOrphanVariant(full);
      if (blob) {
        c = c.split(full).join(blob);
        if (urlMap.get(origUrl)) variantHits++; else orphanHits++;
      } else {
        unresolved.add(full);
      }
    }

    // internal links: https://michaeljanzen.com/<slug>/ → /post/<slug> or /<slug>
    c = c.replace(
      /https?:\/\/michaeljanzen\.com\/([a-z0-9-]+)\/?(?=[\s)"'<>\]]|$)/gi,
      (full, slug) => {
        const hit = resolveSlug(slug);
        if (!hit) { unresolved.add(full); return full; }
        internalHits++;
        return hit.type === "post" ? `/post/${hit.slug}` : `/${hit.slug}`;
      }
    );

    if (c !== before) {
      postsTouched++;
      if (!DRY) await pool.query("UPDATE posts SET content=$1 WHERE id=$2", [c, row.id]);
    }
  }
  console.log(`  posts updated: ${postsTouched} (exact: ${exactHits}, variants: ${variantHits}, orphan variants: ${orphanHits}, internal links: ${internalHits})`);
  if (unresolved.size) {
    console.log(`  unresolved URLs left as-is (${unresolved.size}):`);
    [...unresolved].slice(0, 20).forEach((u) => console.log(`    - ${u}`));
  }

  // ── D. Featured-image gaps ──────────────────────────────────────────────────
  console.log("\n[D] Featured-image gaps...");
  let featFixed = 0;
  for (const item of wpPosts) {
    const slug = String(item["wp:post_name"]);
    const post = postBySlug.get(slug);
    if (!post) continue;
    const metas = asArr(item["wp:postmeta"]);
    const thumb = metas.find((m: any) => m["wp:meta_key"] === "_thumbnail_id");
    if (!thumb) continue;
    const m = mediaByWpId.get(Number(thumb["wp:meta_value"]));
    if (!m) continue;
    if (!DRY) {
      const r = await pool.query(
        "UPDATE posts SET featured_image=$1 WHERE id=$2 AND featured_image IS NULL",
        [m.id, post.id]
      );
      featFixed += r.rowCount ?? 0;
    }
  }
  console.log(`  filled: ${featFixed}`);

  console.log("\nRepair complete.");
  await pool.end();
}

main().catch((e) => {
  console.error("\nRepair failed:", e);
  pool.end();
  process.exit(1);
});
