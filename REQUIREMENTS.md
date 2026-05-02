# Pugmill -- Product Requirements

**Version:** 0.1.0 Developer Preview
**Status:** Developer preview — early adopters welcome; public APIs may shift before 1.0
**Last updated:** 2026-05-02

---

## 1. Overview

Pugmill is an AI-native, full-stack content management system built on Next.js. It owns its own presentation layer -- themes, design tokens, server-rendered views -- making the frontend first-class rather than outsourced. It targets developers and AI agents who want a rebuildable CMS with structured AI discoverability (AEO) and a commercial open-source business model. A public REST API is included for external consumption, but the integrated frontend is the primary surface.

**Strategic pillars:**

| Pillar | Description |
|---|---|
| Rebuildable | Any AI IDE or developer can reconstruct the site from the codebase alone, without manual intervention |
| AEO-native | Content is structured and exposed in formats AI engines can crawl, cite, and understand |
| API-capable | A public REST API allows external frontends and native apps to consume content independently when needed |
| Extensible | WordPress-style Hook/Filter system and plugin architecture allow feature addition without modifying core |

**Business model:** MIT-licensed open-source core. Proprietary marketplace for themes and plugins planned for v1.0+. Distribution via npm (private registry, license-key auth) with AI agent-assisted installation. Managed hosting planned for v1.0+.

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | ^16 |
| Language | TypeScript | ^5.7 |
| Database | PostgreSQL | 14+ |
| ORM | Drizzle ORM | ^0.38 |
| Auth | NextAuth v5 (beta) | 5.0.0-beta.30 |
| Styling | Tailwind CSS | ^3.4 |
| Editor | Tiptap + tiptap-markdown | ^3 / ^0.9 |
| Markdown renderer | react-markdown + remark-gfm + rehype | ^10 |
| Storage SDK | AWS SDK v3 (`@aws-sdk/client-s3`) | ^3 |
| Validation | Zod | ^3.24 |
| Password hashing | bcryptjs | ^3 |
| HTML sanitization | rehype-sanitize | ^6 |
| Rate limiting | lru-cache | ^11 |
| Deployment target | Vercel, Railway, Render, Replit, self-hosted Node | -- |

---

## 3. Authentication Requirements

### 3.1 Providers
- **Credentials** -- email + password login. Passwords hashed with bcryptjs (12 rounds).
- **GitHub OAuth** -- enabled when `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set.
- **Google OAuth** -- enabled when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.
- OAuth provider buttons render on the login page only when the corresponding env vars are configured.

### 3.2 Session strategy
- JWT sessions (stateless). No DB round-trip on authenticated requests.
- Custom `id` and `role` fields typed via NextAuth module augmentation (`src/types/next-auth.d.ts`).
- Session carries: `id` (UUID string), `name`, `email`, `image`, `role` ("admin" | "editor").

### 3.3 Roles
- **admin** -- full access to all admin routes, user management, settings, plugins, themes.
- **editor** -- can create and edit posts; cannot manage users, change settings, or activate plugins.
- First user created (credentials or OAuth) is automatically assigned `admin`.

### 3.4 Rate limiting
- Login: 5 attempts per email per 15 minutes.
- Login: 20 attempts per IP per 15 minutes.
- Login limiters implemented via in-memory LRU cache (`src/lib/rate-limit.ts`).
- **AI calls:** 50 per user per hour. Enforced server-side via the `ai_usage` DB table (`checkAndIncrementAi()`). Counter resets after 1 hour. Warning tiers in the editor UI: green (0-19), amber (20-29), orange (30-39), red (40-49), blocked at 50.

---

## 4. Content Model

### 4.1 Posts and Pages

The `posts` table stores both blog entries and static pages, differentiated by the `type` column.

| Column | Type | Description |
|---|---|---|
| `id` | integer PK | Auto-incremented |
| `type` | varchar(20) | `"post"` (blog entry) or `"page"` (static page). Default: `"post"` |
| `title` | text | Required |
| `slug` | varchar(255) | Unique. Auto-generated from title if blank |
| `content` | text | Stored as Markdown |
| `excerpt` | text | Optional short description |
| `featuredImage` | integer FK to media | Optional |
| `published` | boolean | Derived from `publishedAt` at save time. True if `publishedAt <= now`. |
| `publishedAt` | timestamp | Scheduled or actual publish date/time. Null = unpublished draft. |
| `parentId` | integer FK to posts | Self-reference for hierarchical pages. Null = top-level |
| `aeoMetadata` | jsonb | Structured AI metadata (see §6) |
| `seoTitle` | text | Per-post SEO title override. When set, replaces the default `<title>` tag |
| `seoMetaDescription` | text | Per-post meta description override |
| `robotsNoindex` | boolean | Adds `noindex` to the robots meta tag for this post |
| `robotsNofollow` | boolean | Adds `nofollow` to the robots meta tag for this post |
| `canonicalUrl` | text | Per-post canonical URL override. When set, replaces the default canonical `<link>` |
| `ogImageUrl` | text | Per-post Open Graph image URL override. When set, overrides the featured image for OG/Twitter cards |
| `authorId` | text FK to admin_users | Links post to its author |
| `createdAt` / `updatedAt` | timestamp | Auto-managed |

### 4.2 Publish scheduling
- The admin form presents a `datetime-local` picker labelled "Publish Date", defaulting to the current date and time.
- If the selected date/time is in the past or present: `published = true`, `publishedAt = selectedDate`.
- If the selected date/time is in the future: `published = false`, `publishedAt = selectedDate` (scheduled).
- The posts listing shows three status badges: **Published** (green), **Scheduled** with date (amber), **Draft** (gray).
- Scheduled posts do not auto-publish; a cron-based mechanism is planned for v0.2.

### 4.3 Hierarchical pages
- Pages can have a parent page, forming a tree of unlimited depth.
- The breadcrumb on the public post view renders the parent title and link.
- The parent selector in the admin post editor is hidden when type is "Post" and visible when type is "Page".
- The per-section `llms.txt` endpoint resolves the hierarchy for AI crawlers.

### 4.4 Taxonomy

**Categories** -- `categories` table (`id`, `name`, `slug`, `description`, `createdAt`)
**Tags** -- `tags` table (`id`, `name`, `slug`, `createdAt`)
**Joins** -- `post_categories` and `post_tags` tables with cascade-delete on post deletion.

Both support full CRUD via admin UI and server actions. Slugs are auto-generated from names. Categories and tags can be created inline from the post editor without navigating away.

### 4.5 Media

The `media` table stores file metadata. Actual binaries are managed by the StorageProvider (see §7).

| Column | Description |
|---|---|
| `fileName` | Sanitized filename with timestamp prefix |
| `fileType` | MIME type (validated on upload) |
| `fileSize` | Bytes |
| `url` | Public URL for the file |
| `storageKey` | Provider-specific key used for deletion |
| `altText` | Optional accessibility text |

**Allowed MIME types:** `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`, `video/mp4`, `video/webm`, `video/ogg`
**Maximum file size:** 50 MB

**Alt text editing:** When a featured image is set in the post editor, an inline alt text input appears below the image preview. Changes save immediately via `updateMediaAltText` server action and update the AEO Health `featured image has alt text` check without a page reload.

---

## 5. Admin Interface Requirements

### 5.1 Navigation

The admin sidebar uses a two-level hierarchical structure. Sub-items appear only when the user is within the relevant section. The sidebar header uses violet branding; active items use violet highlight.

**Top level:**
- Dashboard
- Notifications (sub: All Notifications, active plugin notification pages; badge count on unread)
- Content (sub: Posts & Pages, Categories, Tags, Media)
- Design (sub: Themes, Customize)
- Plugins (sub: All Plugins, one entry per active plugin)
- Settings (sub: Site Identity, Navigation, Social Links, Search & Discovery, Widgets, Users, AI)

**TopBar:** Dark mode toggle (`⌘⇧D` keyboard shortcut), View Site link, username (links to profile), Sign out. Desktop TopBar includes a `⌘K` command palette trigger button.

**Command palette (`⌘K`):** Full-screen modal overlay. Searches all navigation destinations and active plugin pages by label. Keyboard-navigable, `Esc` to close.

Active items and their parent sections are visually highlighted. Sub-items are indented with a left-border indicator.

### 5.2 Posts and Pages

**Listing (`/admin/posts`):**
- Combined view of all posts and pages in a single table.
- **Search:** Debounced text input filtering by title; state lives in the URL (`?q=`), making filtered views bookmarkable.
- **Filter controls:** Type (All / Posts / Pages), Status (All / Published / Scheduled / Draft) -- pill toggles, URL-param driven.
- **Sortable columns:** Title (A-Z / Z-A), Date (newest / oldest). Arrow indicators show active sort direction.
- **Columns:** Title, Type badge (blue = Post, purple = Page), AEO score (3-dot indicator: summary, Q&A, entities), Status badge, Date, Actions (Edit, View, Delete).
- Empty filtered state: "No results. Try adjusting the filters."

**New / Edit form (`/admin/posts/new`, `/admin/posts/[id]/edit`):**
- **Layout** -- Two-column: left column (type selector, title, slug, content editor, images, excerpt); right sidebar (AEO Health, AI usage meter, AEO metadata, SEO, categories, tags, social post). Right sidebar is sticky on desktop.
- **Sticky content header** -- The top of the content card has a lavender (`#f5f0ff`) sticky header that remains visible while scrolling. It contains: Content section label, AI document tools (Ask the AI input, Rewrite button, Tone Check, Reading Level, Generate All), and the editor formatting toolbar (Bold, Italic, Code, H2, H3, Bullet list, Ordered list, Blockquote, Code block, Image insert, Visual/Markdown toggle).
- **Type selector** -- segmented control (Post / Page). Default: Post.
- **Parent Page selector** -- hidden when type is Post; visible when type is Page. Excludes the post being edited.
- Title (required), Slug (auto-generated if blank).
- **Content** -- Tiptap Markdown editor with Visual / Markdown toggle.
- **Images** -- 4-column square thumbnail grid in the left column below the editor. Supports drag-and-drop upload, click-to-insert, drag-into-editor, and "Set featured" per image. Featured image displays above the grid with an inline alt text input (saves via `updateMediaAltText` server action).
- **Excerpt** -- positioned below the images panel in the left column.
- **Categories** -- `TaxonomyPicker`: shows AI suggestions only (no browse list). Existing suggestions shown first (solid blue pill), new suggestions shown as dashed zinc pills that shift blue on hover. Inline creation field.
- **Tags** -- `TaxonomyPicker`: same pattern as categories.
- **AEO Metadata** -- in right sidebar, above SEO. Section shows a green checkmark when summary + Q&A + entity + 5 keywords are all filled.
- **SEO** -- in right sidebar, below AEO. Section shows a green checkmark when both SEO title and meta description are filled.
- **Publish Date** -- `datetime-local` picker, defaults to now. Past/present = publish immediately; future = schedule.
- **Autosave** -- Edit mode only. 10-second debounce after last change. Saves title, slug, content, excerpt, SEO fields, and AEO metadata via `autosavePost` server action (no redirect, no hooks). Status indicator shown in the fixed action bar.
- **Save Draft** -- Stays on the edit page (redirects to `/admin/posts/[id]/edit`). Publish redirects to the post list.
- Submit buttons: "Save Draft" and "Publish" (new) / "Save Draft" and "Save Changes" (edit).

### 5.3 Categories and Tags
- Split-panel layout: create form on the left, list with post counts and edit/delete on the right.
- Edit pages for individual items.

### 5.4 Media Library
- Grid view with image preview (or MIME type label for video).
- Upload form (file input + submit).
- Per-item delete button with confirmation dialog, wired to `deleteMedia` which removes both the DB record and the physical file.

### 5.5 Users (admin-only)
- Accessible via Settings > Users.
- List all admin users with role badges.
- Create user (name, email, password, role).
- Edit user (name, email, role).
- Delete user (cannot delete own account).

### 5.6 Profile (any authenticated user)
- Edit own name and email.
- Change own password (requires current password verification).
- Accessible via "My Profile" in the sidebar footer.

### 5.7 Settings
- **Site Identity** -- site name, description, logo, favicon, header identity mode, "Made with Pugmill" toggle, and optional **Admin Announcement** (free-text message shown as a dismissable violet banner to all logged-in admins; persists per session via `sessionStorage`; leave blank to hide).
- **Navigation** -- manage public nav items.
- **Social Links** -- per-platform URL fields.
- **Search & Discovery** -- SEO defaults (OG image, meta description), AEO site-level summary/FAQs.
- **Widgets** -- assign widgets to registered theme widget areas.
- **Users** -- create, edit, delete admin users.
- **AI** -- configure AI provider credentials.
- All settings backed by `updateConfig()` writing to the `site_config` DB table.

### 5.8 Plugins (admin-only)
- Accessible via Settings > Plugins.
- Each plugin displayed as a card with: name, version badge, active status badge, description.
- **Active/inactive toggle** -- iOS-style switch. Activation takes effect on next page load.
- **Settings button** -- independent expand/collapse control. Opens regardless of active/inactive state.
- When settings are open and the plugin is inactive: amber notice explains settings are saved but inactive.
- Settings fields support three input types: `text`, `boolean` (checkbox), `select` (dropdown).
- "Save Settings" button with inline "Saved" confirmation.
- Plugin state and settings stored in `site_config.modules.activePlugins` and `site_config.modules.pluginSettings`.

### 5.9 Themes (admin-only)
- Accessible via Settings > Themes.
- Each theme displayed as a card with: name, version badge, active status badge, description.
- Active theme shows "Currently active" label (no deactivate button -- a theme is always active).
- Inactive themes show an "Activate" button. Activation takes effect immediately on the public site.
- One theme can be active at a time.

---

## 6. AEO (AI Engine Optimization) Requirements

Pugmill treats AI engine discoverability as a first-class concern.

### 6.1 AEO Metadata schema

Each post/page carries an optional `aeoMetadata` JSONB column with the following shape:

```json
{
  "summary": "A one-paragraph description for AI crawlers.",
  "questions": [
    { "q": "What is Pugmill?", "a": "An AI-native CMS built on Next.js." }
  ],
  "entities": [
    { "type": "Organization", "name": "Pugmill", "description": "Open-source CMS" }
  ],
  "keywords": ["cms", "next.js", "ai-native"]
}
```

Field notes:
- `summary` -- max 1000 characters.
- `questions` -- array of `{ q, a }` pairs. Both fields required for a pair to count toward AEO score.
- `entities` -- named entities explicitly discussed in the post. `description` is optional.
- `keywords` -- up to 30 strings, max 100 chars each. Used by AI social post generator and keyword extraction tool.

Entity types: `Thing`, `Person`, `Organization`, `Product`, `Place`, `Event`, `SoftwareApplication`, `CreativeWork`.

**AEO completeness score (0-3):** Shown as a 3-dot indicator on the posts list. One point each for: summary filled, at least one Q&A pair, at least one entity. Computed by `calcAeoScore()` in `src/lib/aeo.ts`.

**AEO Health panel (editor):** A 0–100 score displayed in the right sidebar of the post editor. Computed by `calcAeoHealth()` in `PostForm.tsx` against 12 criteria worth 5–15 points each: content 400+ words, H2/H3 headings present, no H1 in body, opening paragraph ≤ 80 words, summary written, summary ≥ 80 chars, at least 1 Q&A pair, 3+ Q&A pairs, named entity tagged, 5+ keywords, keywords found in content, featured image has alt text. Failing AI-fixable items (AEO fields, keywords) show a "Fix" button that triggers `handleDraftAeo`. The featured image alt text item shows a "Set" button that scrolls to the inline alt text input.

### 6.2 llms.txt endpoints

| Route | Purpose |
|---|---|
| `GET /llms.txt` | Site-level index of all top-level published posts and pages |
| `GET /llms-full.txt` | Full content of every published post, including inline Q&A from AEO metadata |
| `GET /[slug]/llms.txt` | Per-section index: resolves slug to a published page and lists its direct children |

All llms.txt responses return `Content-Type: text/plain`. Format follows the [llmstxt.org](https://llmstxt.org) specification.

### 6.3 JSON-LD structured data (core)

Every published post page emits JSON-LD in the page body:
- **`Article` schema** -- always present. Includes `headline`, `url`, `datePublished`, `dateModified`, and `description` (from AEO summary if available).
- **`FAQPage` schema** -- emitted additionally when the post has one or more AEO Q&A pairs with both question and answer populated.

### 6.4 REST API exposure
All REST API responses include `aeoMetadata` and `parentId` fields. See §8.

---

## 7. Storage Requirements

All file uploads go through the `StorageProvider` interface (`src/lib/storage/types.ts`).

```typescript
interface StorageProvider {
  upload(buffer: Buffer, fileName: string, mimeType: string): Promise<{ url: string; storageKey: string }>;
  delete(storageKey: string): Promise<void>;
}
```

### 7.1 Providers

| `STORAGE_PROVIDER` | Behavior |
|---|---|
| `local` (default) | Writes to `/public/uploads/`. Suitable for local dev and persistent-volume servers. Not suitable for ephemeral platforms (Vercel). |
| `s3` | Uploads to any S3-compatible store: AWS S3, Cloudflare R2, DigitalOcean Spaces, MinIO. |

### 7.2 S3 environment variables

| Variable | Required | Notes |
|---|---|---|
| `S3_BUCKET` | Yes | Bucket name |
| `S3_REGION` | Yes | `us-east-1`, `auto` (R2), etc. |
| `S3_ACCESS_KEY_ID` | Yes | |
| `S3_SECRET_ACCESS_KEY` | Yes | |
| `S3_ENDPOINT` | No | For R2, DO Spaces, MinIO |
| `S3_PUBLIC_URL` | Recommended | CDN or public base URL for served files |

---

## 8. REST API Requirements

Read-only public API. No authentication required. All endpoints return `{ data, meta? }` JSON with CORS headers (`Access-Control-Allow-Origin: *`).

Published content only. Write operations remain server-actions only.

| Endpoint | Description |
|---|---|
| `GET /api/posts` | Paginated published posts. Query: `?page=1&limit=10&category=slug&tag=slug` |
| `GET /api/posts/[slug]` | Single post with full content, categories, tags, `aeoMetadata`, `parentId` |
| `GET /api/categories` | All categories with published post counts |
| `GET /api/tags` | All tags with published post counts |
| `GET /api/media` | Paginated media library. Query: `?page=1&limit=20` |

**Performance:** `GET /api/posts` uses exactly 3 DB round-trips regardless of page size (COUNT, paginated SELECT, batch JOIN for categories+tags). No N+1 queries.

---

## 9. SEO Requirements

### 9.1 Per-post metadata
`generateMetadata()` exported from `src/app/(site)/post/[slug]/page.tsx` generates:

- `<title>Post Title | Site Name</title>`
- `<meta name="description">` -- excerpt or 160-char plaintext fallback from Markdown content
- `og:title`, `og:description`, `og:url`, `og:type: article`
- `og:image` / `twitter:image` -- from `featuredImage` when set
- `twitter:card` -- `summary_large_image` (with image) or `summary` (without)
- `publishedTime` and `modifiedTime` for article Open Graph
- `alternates.canonical` URL

### 9.2 Sitemap
`GET /sitemap.xml` -- generated by `src/app/sitemap.xml/route.ts` (explicit route handler; not the Next.js metadata convention, which lacks `Request` access).
- Static routes: `/`, `/blog`, `/about`
- All published posts (priority 0.6, `changeFrequency: weekly`)
- All published pages (priority 0.8, `changeFrequency: monthly`)
- Fires `request:bot-visit` action hook on every bot request

### 9.4 Robots.txt
`GET /robots.txt` -- generated by `src/app/robots.txt/route.ts` (explicit route handler).
- Respects `config.seo.blockAiBots` setting (disallows AI crawlers when enabled)
- Fires `request:bot-visit` action hook on every bot request

### 9.3 RSS feed
`GET /feed.xml` -- valid RSS 2.0 with `atom:link` self-reference.
- Latest 20 published posts ordered by creation date
- `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`

---

## 10. Security Requirements

The full security guide is in `SECURITY.md`.

| Control | Implementation |
|---|---|
| Authentication | NextAuth JWT; middleware protects `/admin/*` |
| Password hashing | bcryptjs, 12 rounds |
| Input validation | Zod schemas on all server actions |
| HTML sanitization | rehype-sanitize on Markdown rendering |
| XSS prevention | `dangerouslySetInnerHTML` used only for pre-escaped JSON-LD script tags |
| SQL injection | Drizzle ORM parameterised queries only; no raw string SQL |
| CSRF | Next.js server actions (same-origin + method enforcement) |
| Rate limiting | LRU-cache per email and per IP on login |
| Path traversal | Upload paths validated against allowed directory |
| File upload | MIME type allowlist, extension allowlist, 50 MB cap |
| Security headers | `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` |
| Admin headers | `X-Frame-Options: DENY`, `Cache-Control: no-store` on `/admin/*` |
| Secret scanning | Husky pre-commit hook blocks hardcoded credentials |
| Env validation | `validateEnv()` runs on each request in production; fatal on missing/weak `NEXTAUTH_SECRET` |

---

## 11. Configuration Requirements

CMS configuration is stored in the `site_config` PostgreSQL table as a single JSONB row (`id = 1`).

```typescript
{
  site: {
    name, description, url,
    logo?: string,           // media URL for site logo
    favicon?: string,        // media URL for favicon
    socialLinks?: {          // all optional
      twitter, github, linkedin, facebook, instagram, youtube, tiktok, rss
    },
    seoDefaults?: {
      ogImage?: string,      // fallback OG image URL
      metaDescription?: string,
    },
  },
  appearance: {
    activeTheme: string,
    navigation: [{ label: string, path: string }],
  },
  modules: {
    activePlugins: string[],
    pluginSettings: Record<pluginId, Record<settingKey, string | boolean>>,
  },
  system: { version, headlessMode, maintenanceMode },
}
```

- `getConfig()` -- async, DB-backed, in-memory cached with a **60-second TTL**. Falls back to `pugmill.config.json` (seed file only) or built-in defaults if DB is unavailable.
- `updateConfig(newConfig)` -- validates with Zod, upserts to DB, invalidates cache immediately.
- `pugmill.config.json` -- seed-only. Read once on first boot; not the live config source thereafter.

---

## 12. Plugin System Requirements

### 12.1 Interface

```typescript
interface PluginSettingDef {
  key: string;
  label: string;
  type: "text" | "boolean" | "select";
  default: string | boolean;
  options?: string[];       // for type "select"
  description?: string;
}

interface PugmillPlugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  settingsDefs?: PluginSettingDef[];
  initialize(hooks: HookManager, settings: Record<string, string | boolean>): void | Promise<void>;
  destroy?(): void | Promise<void>;
}
```

### 12.2 Hook system
- **Actions** (`doAction` / `addAction`) -- fire-and-forget side effects.
- **Filters** (`applyFilters` / `addFilter`) -- transform a value through registered handlers.
- Each hook handler is isolated in try/catch; one failing hook does not break others.
- Plugin `initialize()` receives resolved settings (saved values merged with defaults).

### 12.3 Built-in hooks

The canonical hook list is `src/lib/hook-catalogue.ts`. Plugins must only use hooks defined there.

**Actions**

| Hook | Fired when |
|---|---|
| `post:after-save` | Post or page saved to the database |
| `post:before-delete` | Post or page about to be permanently deleted |
| `post:after-publish` | Post transitions from unpublished to published |
| `media:after-upload` | File uploaded and saved to the media table |
| `media:after-delete` | Media item deleted from storage and database |
| `user:after-login` | User successfully authenticates |
| `user:after-logout` | User session destroyed |
| `comment:before-create` *(STRICT)* | Before a comment is written -- throw to reject |
| `comment:after-create` | Comment successfully saved |
| `comment:after-approve` | Comment approval status changed |
| `consent:after-accept` | Visitor accepts cookie consent |
| `consent:after-update` | Visitor updates consent preferences |
| `request:bot-visit` | Known bot visits an AEO endpoint (llms.txt, sitemap, robots.txt). Payload: `{ botName: string; path: string; resourceType: string }` |

**Filters**

| Hook | Transforms |
|---|---|
| `content:render` | Raw Markdown string before theme rendering |
| `content:excerpt` | Plain-text excerpt before display |
| `nav:items` | Global navigation items array |
| `head:meta` | Array of `<meta>` tag descriptors injected into `<head>` |
| `api:post:response` | Serialized post object returned by `GET /api/posts/[slug]` |

### 12.4 SEO and structured data

SEO metadata (Open Graph, Twitter Cards, canonical URLs), JSON-LD structured data (`WebSite`, `Organization`, `Article`, `FAQPage`), and AEO metadata are all handled in core. The `head:meta` filter allows plugins to inject additional `<meta>` tags. Per-post structured data is generated by the post page component and requires post-level context.

### 12.5 Distribution model

Plugin discovery uses a static import registry (`src/lib/plugin-registry.ts`) due to Turbopack's lack of dynamic `require()` support. New plugins must be registered manually or via tooling after install.

**Planned installation flow (v1.0 marketplace):**

1. User purchases plugin at pugmillcms.com and receives a license key
2. License key added to project `.npmrc` (local dev) or hosting platform env vars (deployed builds)
3. `npm install @pugmill-plugins/<name>` -- plugin package's `postinstall` script patches `src/lib/plugin-registry.ts` automatically
4. If plugin requires schema changes: `npm run db:migrate`
5. Add any required env vars to `.env.local`
6. Rebuild and redeploy
7. Admin > Plugins > Enable
8. Admin > Plugin Settings > configure

Each marketplace plugin ships two distribution formats: a code package (npm) and an AI agent rebuild prompt. The rebuild prompt references the plugin's hook contract so an AI agent can scaffold the plugin from scratch in a fresh Pugmill install -- making plugins resilient to framework upgrades.

**Security note:** New plugin code requires a full rebuild before it can execute. A compromised admin account cannot install executable code without access to the build pipeline. This is a structural security advantage over interpreted-runtime plugin models (e.g. WordPress PHP plugins).

---

## 13. Theme Requirements

### 13.1 Architecture -- three layers

| Layer | Who controls it | Where it lives |
|---|---|---|
| **Global settings** | Site owner, applies to any theme | Admin > Settings, `site_config` DB table |
| **Theme settings** | Site owner, within bounds the theme allows | Admin > Design, `theme_design_configs` DB table |
| **Theme code** | Theme author, requires a rebuild to change | `themes/<id>/` source files |

The admin UI exposes colors, fonts, and layout toggles within the surface area the theme author has chosen to expose via design tokens. Structural changes require editing theme source files.

### 13.2 Bundled themes

Three themes ship with core:

| Theme | Personality | Key defaults |
|---|---|---|
| `default` | Clean, modern, Geist-inspired | System sans, blue accent, card chrome |
| `editorial` | Warm publication, long-form journalism | Playfair Display headings, DM Sans body, 18px, ink blue, no card chrome |
| `mono` | Stripped-back terminal/developer | JetBrains Mono throughout, near-black, amber accent, no rounded corners |

Each bundled theme ships with four color presets and a full `design.ts` token vocabulary. Themes serve a dual purpose: production-ready visual options for site owners, and reference implementations for theme authors learning the architecture.

### 13.3 Theme file structure

```
themes/<id>/
  manifest.json          -- identity and marketplace metadata
  design.ts              -- design token contract (required exports)
  Layout.tsx             -- root server component wrapping all public pages
  components/
    Header.tsx           -- server component (fetches config, passes to client)
    HeaderClient.tsx     -- client component (mobile nav, interactivity)
    Footer.tsx           -- server component
  views/
    HomeView.tsx         -- receives PostSummary[] and HomeLayoutConfig
    PostView.tsx         -- receives full post data and ArticleLayoutConfig
    PageView.tsx         -- receives page data, breadcrumbs, ArticleLayoutConfig
    Sections.tsx         -- homepage section renderer (receives HomepageSection[], page)
```

`Sections.tsx` is the homepage section renderer entry point. Core's `page.tsx` calls `getThemeSections(themeId)` and renders `<ThemeSections sections={sections} page={page} />` without knowing which theme is active.

### 13.4 Homepage section builder

The homepage is composed from a stack of typed sections, stored as JSON in the `theme_design_configs` table under the `homepageSections` key. Sections are ordered, individually toggleable, and edited via Admin > Design > Homepage.

**Section types:**

| Type | Description |
|---|---|
| `hero` | Full-bleed image/color banner with headline, subheadline, up to two CTA buttons |
| `post-feed` | Paginated post listing, optionally filtered by category |
| `featured-post` | Single highlighted post with large card treatment |
| `text-block` | Rich-text HTML content block |
| `cta` | Full-width call-to-action banner with three style variants (filled, subtle, outline) |

Each section carries an `id` (UUID), `type`, `enabled` flag, and type-specific config fields. The admin renders a drag-reorderable section stack; changes save as a draft alongside design token changes. Sections are parsed by `parseHomepageSections()` in `src/lib/homepage-sections.ts`, which falls back to legacy flat design keys for backward compatibility.

### 13.5 Design token contract

Every theme exports from `themes/<id>/design.ts`:

```ts
DESIGN_TOKEN_DEFS: DesignTokenDef[]   // all token definitions
DESIGN_DEFAULTS: Record<string,string> // default value for each key
SANS_FONTS: string[]                   // curated sans-serif Google Fonts
SERIF_FONTS: string[]                  // curated serif/display Google Fonts (may be empty)
MONO_FONTS: string[]                   // curated monospace Google Fonts
COLOR_PRESETS?: ColorPreset[]          // optional color palette presets
HEADER_LAYOUTS?: HeaderLayoutDef[]     // optional header layout presets
HEADER_MODIFIERS?: HeaderModifiers     // optional header capability flags
buildGoogleFontsUrl(config): string | null
buildCssString(config, defs): string   // returns :root { ... } CSS block + prose overrides
```

Token types: `"color"` (color picker + hex input), `"google-font"` (select from allowlist with live preview), `"select"` (dropdown).

The `google-font` token type accepts a `fontList` field: `"sans"` | `"serif"` | `"mono"` | `"all"`. The admin font picker renders the appropriate list. Themes that define a `fontList: "serif"` token (e.g. `fontHeading` in the Editorial theme) must also populate `SERIF_FONTS`.

Token groups: `colors`, `typography`, `layout-home`, `layout-post`, `layout-page`, `layout-header` (built-in), plus any custom groups rendered under "Theme Options".

**Color presets:** Themes may export a `COLOR_PRESETS: ColorPreset[]` array. Presets appear as clickable pill buttons above the color token list, each showing three color swatches (background, accent, foreground). Selecting a preset populates all 8 color token fields instantly; the user can then adjust individual values before publishing.

Tokens with `editable: false` inject into CSS but are hidden from the admin UI -- used for tokens structural to the theme's identity.

### 13.6 CSS variable injection

`Layout.tsx` calls `buildCssString()` on every render and injects the result as a `<style>` tag. Standard variables all themes should define:

`--color-background`, `--color-surface`, `--color-foreground`, `--color-muted`, `--color-border`, `--color-accent`, `--color-accent-fg`, `--color-link`, `--font-sans`, `--font-mono`

The Editorial theme additionally defines `--font-heading` for the display serif font. Themes targeting a heading-font distinction should follow the same pattern: declare a `fontHeading` token with `cssVariable: "--font-heading"` and `fontList: "serif"`, then apply `var(--font-heading)` in `buildCssString()` prose overrides and article heading selectors.

Theme components must use these CSS variables -- no hardcoded color values.

### 13.7 Design draft / publish workflow

Design changes follow a draft to publish flow stored in `theme_design_configs`:

| Status | Meaning |
|---|---|
| `draft` | Staged changes, not live. One per theme (enforced by partial unique index). |
| `published` | Live config. One per theme. |
| `archived` | Previous published rows, kept for history. Multiple allowed. |

- **Save draft** -- upserts the draft row. Live site unchanged.
- **Preview** -- sets `__pugmill_design_preview` cookie. Site renders draft values with an amber banner. Available only when a draft exists.
- **Publish** -- atomic transaction: archives current published row, promotes draft to published. Cache invalidated immediately.
- **Discard** -- deletes the draft row. No-op (silent) if no draft exists.

The `theme_design_configs` table has a partial unique index on `(theme_id, status) WHERE status IN ('draft', 'published')` -- enforcing the one-draft / one-published constraint while allowing unlimited archived rows.

### 13.8 Registry and security

- Active theme set via `config.appearance.activeTheme` in the database.
- Theme name validated against `THEME_ALLOWLIST` in `src/lib/theme-registry.ts` before dynamic import -- prevents path traversal attacks.
- New themes must be added to `THEME_ALLOWLIST` and `ALL_THEMES` in the registry file.

### 13.9 Distribution model

Same npm + private registry model as plugins (see §12.5). Themes ship two formats:

1. **npm package** -- `@pugmill-themes/<name>`. postinstall script patches `theme-registry.ts`. Rebuild required.
2. **AI agent rebuild prompt** -- structured prompt enabling an AI agent to scaffold the theme from scratch in any Pugmill install. Makes themes resilient to framework upgrades.

**Installation flow:**
1. Purchase at pugmillcms.com and receive a license key
2. Add key to `.npmrc` (one-time per project)
3. `npm install @pugmill-themes/<name>` -- postinstall patches registry
4. Rebuild and redeploy
5. Admin > Themes > Activate
6. Admin > Design > customize tokens, save draft, preview, publish

---

## 14. Performance Requirements

| Metric | Requirement |
|---|---|
| `/api/posts` query count | Constant 3 round-trips regardless of page size |
| Config cache | In-memory, 60-second TTL. No DB hit on every request |
| DB connection pool | Max 20 connections, 30s idle timeout, 5s connection timeout |
| Media delivery | Served via CDN (S3/R2) in production; local static in dev |
| RSS feed caching | `Cache-Control: public, max-age=3600` |
| Admin routes | `Cache-Control: no-store` -- never cached |

---

## 15. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Yes | Min 32 chars, non-weak. Generate: `openssl rand -base64 32`. Auto-generated by `replit-init.ts` on Replit. |
| `NEXTAUTH_URL` | Yes (prod) | Full public URL of the app, no trailing slash. Auto-detected by `replit-init.ts` on Replit; must be set as a Secret before deploying to Replit production. |
| `AI_ENCRYPTION_KEY` | Recommended | 32-byte hex key for AES-256-GCM encryption of the stored AI provider API key. Generate: `openssl rand -hex 32`. Auto-generated by `replit-init.ts` on Replit. If unset, the API key is stored as plaintext with a server-side warning. |
| `GITHUB_CLIENT_ID` | No | Enables GitHub OAuth |
| `GITHUB_CLIENT_SECRET` | No | Enables GitHub OAuth |
| `GOOGLE_CLIENT_ID` | No | Enables Google OAuth |
| `GOOGLE_CLIENT_SECRET` | No | Enables Google OAuth |
| `STORAGE_PROVIDER` | No | `"local"` (default) or `"s3"` |
| `S3_BUCKET` | If S3 | |
| `S3_REGION` | If S3 | |
| `S3_ACCESS_KEY_ID` | If S3 | |
| `S3_SECRET_ACCESS_KEY` | If S3 | |
| `S3_ENDPOINT` | No | For R2 / DO Spaces / MinIO |
| `S3_PUBLIC_URL` | Recommended if S3 | CDN base URL for public file access |

---

## 16. AI Integration Requirements

Pugmill follows the built-in vs enhanced pattern: every feature works without an AI provider. Connecting one in Admin > Settings > AI adds generation, suggestions, and automation.

### 16.1 AI provider configuration

AI provider credentials are stored encrypted in the `site_config` DB table (`config.ai`). The encryption key is `AI_ENCRYPTION_KEY` (AES-256-GCM). If unset, the key is stored as plaintext with a server-side warning.

Supported providers: Anthropic (`claude-*`), OpenAI (`gpt-4o`, `gpt-4o-mini`), Google Gemini. Configured via Admin > Settings > AI.

### 16.2 AI rate limiter

- **Limit:** 50 AI API calls per user per hour.
- **Storage:** `ai_usage` table -- one row per user (`user_id` PK, `window_start` timestamp, `count` integer). Window resets after 1 hour; the counter is atomically incremented with a raw SQL upsert that resets when the window expires.
- **Enforcement:** `checkAndIncrementAi(userId)` in `src/lib/rate-limit.ts` -- called server-side at the top of every AI API route before the provider call. Returns `{ allowed, count, limit }`.
- **Read-only check:** `getAiUsage(userId)` -- returns current count without incrementing.
- **Client meter:** PostForm shows a color-coded usage bar (green 0-19, amber 20-29, orange 30-39, red 40-49, blocked at 50). Updated from `usage` field returned in every AI response body.

### 16.3 AI tools in the post editor

All tools call `/api/ai/suggest` or `/api/ai/refine`. Both routes enforce the rate limiter and return `{ result, usage }` on success or `{ error, usage }` on failure (including 429 for rate limit exceeded).

| Tool | Route | Description |
|---|---|---|
| Generate All | `/api/ai/suggest` | Sequential agent: fills excerpt, slug, SEO, AEO metadata, keywords, categories, tags, topic focus report, and internal links — one step at a time with per-step progress |
| Intent Classification | `/api/ai/intent` | Classifies a natural language instruction into one of 12 known actions and routes to the appropriate tool |
| Suggest Titles | `/api/ai/suggest?type=titles` | 5 alternative titles |
| Generate Excerpt | `/api/ai/suggest?type=excerpt` | 1-2 sentence excerpt |
| Generate Slug | `/api/ai/suggest?type=slug` | SEO-friendly URL slug from title |
| Generate AEO | `/api/ai/suggest?type=aeo` | Summary, Q&A pairs, entities, and keywords (parallel call) |
| Extract Keywords | `/api/ai/suggest?type=keywords` | 5–15 SEO keywords |
| Suggest Categories | `/api/ai/suggest?type=categories` | 1-3 category suggestions |
| Suggest Tags | `/api/ai/suggest?type=tags` | 3-7 tag suggestions (prefers existing tags) |
| Rewrite | `/api/ai/refine` | Rewrites or enhances the draft based on optional instructions; writes from scratch if no content exists. Author voice always applied. |
| Tone Check | `/api/ai/suggest?type=tone-check` | Passages deviating from author voice guide |
| Topic Focus Report | `/api/ai/suggest?type=topic-report` | Focus score 1-5, note |
| Refine Focus | `/api/ai/suggest?type=refine-focus` | Up to 4 focus issues with quotes and recommendations; shown when topic score < 5 |
| Reading Level | `/api/ai/suggest?type=reading-level` | Grade level + voice fit |
| Meta Title Variants | `/api/ai/suggest?type=meta-title` | 3 SEO meta title options |
| Headline Variants | `/api/ai/suggest?type=headline-variants` | Curiosity + utility headline pair |
| Internal Links | `/api/ai/suggest?type=internal-links` | 3-5 internal link opportunities |
| Content Brief | `/api/ai/suggest?type=brief` | Full content brief with outline, angle, audience |
| Social Post | `/api/ai/suggest?type=social-post` | Platform-specific post draft (LinkedIn/X/Facebook/Substack); uses AEO metadata as primary input |
| Site Summary | `/api/ai/suggest?type=site-summary` | AEO site summary for llms.txt |
| Site FAQs | `/api/ai/suggest?type=site-faqs` | 4-6 site-level FAQ pairs for llms.txt |

### 16.4 Social post generator

Platform buttons appear in the editor's AI Analysis section. Clicking a platform fires immediately and replaces any previous draft for that platform. Each platform has a character limit enforced client-side (counter turns red when over):

| Platform | Limit |
|---|---|
| LinkedIn | 3000 |
| X | 280 |
| Facebook | 500 |
| Substack | 800 |

The API route uses AEO metadata (summary, Q&A, keywords) as primary input when available, falling back to raw content.

### 16.5 Author voice

Each admin user has an `authorVoice` text field (Admin > My Profile). This free-text style guide is injected into the system prompt for tone-sensitive tools (Rewrite, Tone Check, Reading Level, Social Post).

The **Ask the AI** input in the content editor's sticky header accepts free-form natural language instructions. The intent classifier (`/api/ai/intent`) maps the instruction to the appropriate tool: rewrite, excerpt, slug, SEO, AEO, categories, tags, tone check, reading level, topic report, or internal links.

---

## 17. Bot Analytics Requirements

The bot-analytics plugin (enabled by default) tracks AI crawler and search spider visits to AEO endpoints.

### 17.1 Data model

Two plugin-owned tables (named `plugin_bot_analytics_*` per convention):

| Table | Purpose | Retention |
|---|---|---|
| `plugin_bot_analytics_daily` | Composite PK `(bot_name, resource_type, day)` — daily visit counts via upsert | 90 days |
| `plugin_bot_analytics_recent` | Ring buffer of individual visits with `path` and `visited_at` | 7 days + 500-row hard cap |

### 17.2 Bot detection

`src/lib/bot-detection.ts` (shared by core route handlers and the plugin):

- `detectBot(userAgent)` — returns canonical bot name or `null` for non-bots
- `classifyPath(path)` — returns resource type: `llms.txt`, `llms-full.txt`, `Post Markdown`, `Sitemap`, `Robots.txt`, `HTML Page`
- `BOT_CONFIG` — display metadata (label, hex color, type) for 13 bots
- AI bots are checked before search bots in `BOT_PATTERNS` to prevent `Google-Extended` matching `Googlebot`

### 17.3 Admin report

`/admin/bot-analytics` shows:
- Total visits per bot (last 30 days), split into AI Crawlers and Search Spiders
- Content Reach breakdown by resource type (bar chart)
- Recent visits table: bot, resource type, path, time
- AI Insights button (requires AI provider): generates a natural language summary of traffic patterns

### 17.4 Dashboard teaser

Three summary cards on the admin dashboard (below the Getting Started checklist):
- **AI Crawlers** — top 4 AI bots with counts and share %
- **Search Spiders** — top 4 search bots with counts and share %
- **Top Content (7 days)** — top 4 paths by visit count

Each card links to `/admin/bot-analytics`. Empty states are shown when no data exists yet.

---

## 18. First-Run Setup

### Standard (local / Vercel / Railway / Render)

```bash
cp .env.example .env.local      # fill in DATABASE_URL, NEXTAUTH_SECRET at minimum
npm install
npm run db:init                 # creates schema + runs migrations
npm run dev                     # start development server at http://localhost:5000
# then visit /setup to create your admin account
```

For existing deployments after pulling new changes:
```bash
npm run db:migrate              # apply pending migration scripts (idempotent; safe to re-run)
```

### Replit

Add the PostgreSQL module from the Tools sidebar (sets `DATABASE_URL` automatically), then click Run. `replit-init.ts` (triggered by `predev`) handles everything automatically:

1. Generates `NEXTAUTH_SECRET`, `AI_ENCRYPTION_KEY`, and `NEXTAUTH_URL` and writes them to `.env.local`
2. Creates all database tables (`create-schema.ts`)
3. Applies any pending migrations (`run-migrations.ts`) — instant on fresh installs due to pre-marking
4. Seeds the admin account and default content
5. Prints credentials to the console and displays them on the login page
6. Writes `.replit-setup-complete` sentinel so subsequent restarts skip setup

**Before deploying to Replit production:** copy `NEXTAUTH_URL` (set in `.env.local` after first run) into Replit Secrets so it persists in the deployment container.

`npm run setup` (called by `db:init`) is idempotent -- exits cleanly if an admin already exists.

The admin login page is at `/admin/login`.

---

## 19. Known Limitations (v0.2)

| # | Limitation | Planned resolution |
|---|---|---|
| L1 | Plugin and theme registry requires manual static imports (Turbopack limitation) | Registry CLI + dynamic discovery in v0.3 |
| L2 | Post author not displayed in the default theme (`authorId` is stored and linked but not rendered in theme views) | Surface author in default theme in v0.3 |
| L4 | Config cache TTL only; no real-time cross-instance invalidation | Redis pub/sub for v1.0 managed tier |
| L6 | Scheduled posts do not auto-publish (cron endpoint exists at `/api/cron/publish-scheduled` but requires an external trigger on non-Vercel platforms) | Document cron-job.org setup; Replit background worker in v0.3 |
| L7 | No post draft preview (design draft preview is implemented; post-level preview is not) | Deferred to v0.3 |
| L8 | No bulk post operations | Deferred to v0.3 |
| L9 | No Content Security Policy header | Complex due to Tailwind inline styles; v0.3 |
| L10 | AI rate limiter uses `TIMESTAMP WITHOUT TIME ZONE` — comparisons assume consistent server timezone | Migrate to `TIMESTAMPTZ` in v0.3 |
| L11 | Local storage (`STORAGE_PROVIDER=local`) is not suitable for ephemeral deployment containers (Replit Deployments, Vercel) — uploaded media will not persist across deploys | Configure `STORAGE_PROVIDER=s3` before deploying to ephemeral platforms |
