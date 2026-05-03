# Contributing to Pugmill CMS

This document covers the local development setup, codebase conventions, and contribution process.

For AI-assisted development (Claude Code, Cursor, Windsurf, etc.), pointing the agent at [`AGENT.md`](./AGENT.md) and [`PHILOSOPHY.md`](./PHILOSOPHY.md) before starting is recommended. Those documents are written for AI-assisted workflows.

---

## Before Starting

Reading [`PHILOSOPHY.md`](./PHILOSOPHY.md) answers the most common question contributors ask: should I add this feature? It defines what belongs in core, what belongs in a plugin, and what should be a one-off script. Contributions that don't clear the scope filter will not be merged, so reading it first avoids wasted effort.

---

## Development Setup

### Prerequisites

- **Node.js 22+**
- **PostgreSQL 16** running locally (or a remote connection string)
- **Git**

### First-time setup

```bash
# 1. Fork and clone
git clone https://github.com/pugmillcms/pugmill.git
cd pugmill

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Fill in DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL
# See REQUIREMENTS.md for the full variable reference

# 4. Push the schema to your database
npm run db:push

# 5. Create the admin account
npm run setup

# 6. Start the dev server
npm run dev
```

The admin dashboard is at [http://localhost:5000/admin](http://localhost:5000/admin).

### Useful commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Production build |
| `npm test` | Run the test suite (Vitest) |
| `npm run db:push` | Push schema changes to the database (fresh installs) |
| `npm run db:migrate` | Run migration scripts (existing installs after schema updates) |
| `npm run db:studio` | Open Drizzle Studio -- visual database browser |
| `npm run env:check` | Validate that all required env vars are set |

---

## Project Structure

```
pugmill/
├── src/
│   ├── app/
│   │   ├── (site)/          # Public-facing routes (blog, posts, pages)
│   │   ├── admin/           # Admin dashboard
│   │   └── api/             # Public REST API (read-only)
│   ├── lib/
│   │   ├── db/              # Drizzle schema and database client
│   │   ├── actions/         # Next.js Server Actions (all write operations)
│   │   ├── storage/         # Storage abstraction (local + S3)
│   │   ├── hook-catalogue.ts  # Single source of truth for all hooks
│   │   ├── hooks/           # HookManager implementation
│   │   ├── auth.ts          # NextAuth configuration (full, server-only)
│   │   ├── auth.config.ts   # NextAuth edge-compatible subset (used by src/proxy.ts)
│   │   └── config.ts        # DB-backed site config with cache
│   └── types/               # TypeScript module augmentation
├── plugins/                 # Optional, activatable features
│   ├── comments/
│   ├── contact-form/
│   └── cookie-consent/
├── themes/                  # Visual themes
│   ├── default/             # Built-in theme -- never remove
│   └── _template/           # Copy this to start a new theme
└── scripts/                 # Setup and migration scripts
```

---

## How to Contribute

### Bug fixes

1. Opening an issue describing the bug and how to reproduce it
2. Forking, branching (`fix/short-description`), fixing, and testing
3. Opening a pull request referencing the issue

### New features

1. Opening an issue first and describing the feature
2. Waiting for a maintainer to confirm it clears the scope filter (see `PHILOSOPHY.md`)
3. Forking, branching (`feature/short-description`), implementing, and testing
4. Opening a pull request

Opening a pull request for a large feature without prior discussion is discouraged. The scope filter means many reasonable-sounding features intentionally do not belong in core or as a plugin. Opening the issue first avoids wasted effort.

### New plugins

Plugins are the right place for optional, persistent features that many users need. The complete guide is in [`PLUGIN_AUTHORING.md`](./PLUGIN_AUTHORING.md) -- it covers file structure, the installation contract, hooks, settings, database tables, admin pages, and conventions.

The short version:
1. Copying the structure from an existing plugin (e.g. `plugins/comments/`)
2. Registering it in `src/lib/plugin-registry.ts`
3. Activating it via the admin UI and testing
4. Submitting a pull request

### New themes

The complete guide is in [`THEME_AUTHORING.md`](./THEME_AUTHORING.md). Starting from `/themes/_template/` is recommended -- it contains the correct file structure and required exports.

---

## Code Standards

### TypeScript

- Strict mode is enabled. `any` is avoided unless genuinely unavoidable; a comment explaining why is expected.
- Module augmentation is used for NextAuth types -- see `src/types/next-auth.d.ts`.
- Drizzle v0.38 requires `as typeof table.$inferInsert` on `.values()` calls for strict insert type inference.

### React / Next.js

- Server Components are the default. `"use client"` is added only when interactivity is required.
- All write operations go through Server Actions in `src/lib/actions/` -- no write REST endpoints.
- Plugin actions must call `await loadPlugins()` at the top of every exported function. Server actions run in a separate request context where `initialize()` may not have run.

### Database

- All schema changes go in `src/lib/db/schema.ts`.
- Fresh installs use `npm run db:push`. Existing installs use migration scripts in `/scripts/`.
- Plugin tables must be named `plugin_<plugin-id>_<tablename>` -- no exceptions.
- No foreign key constraints from plugin tables to core tables -- IDs stored as plain integers.

### Hooks

- All hooks must be defined in `src/lib/hook-catalogue.ts` before use.
- Plugins may only use hooks listed in the catalog.
- Hook names follow the `namespace:event` convention (e.g. `post:after-save`).
- The complete hook reference is in [`HOOKS.md`](./HOOKS.md).

### Security

- Secrets come from environment variables only.
- All user input is validated with Zod before processing.
- Admin routes require auth checks via `getCurrentUser()` -- the auth proxy alone is not sufficient.
- The full security policy is in [`SECURITY.md`](./SECURITY.md).

### Style

- Tailwind CSS only. No CSS modules, no styled-components, no inline style objects except for CSS custom properties (design token values).
- Matching the visual patterns already established in `src/app/admin/` is expected.

---

## Testing

Pugmill uses [Vitest](https://vitest.dev/). Running the full suite:

```bash
npm test
```

All pull requests must pass the full test suite. Changes that introduce new behavior require new tests. Bug fixes require a regression test.

---

## Pull Request Checklist

Before opening a PR:

- [ ] Tests pass (`npm test`)
- [ ] No TypeScript errors (`npm run build` with no type errors)
- [ ] New hooks are registered in `src/lib/hook-catalogue.ts` and `HOOKS.md`
- [ ] New env vars are added to `.env.example` with a description comment
- [ ] New plugin tables follow the `plugin_<id>_<name>` naming rule
- [ ] No secrets, `.env.local`, or generated files committed
- [ ] PR description explains what changed and why

---

## Questions

Opening a [GitHub Discussion](https://github.com/pugmillcms/pugmill/discussions) is the right place for questions about architecture, design decisions, or whether a feature belongs in the project.

Opening a [GitHub Issue](https://github.com/pugmillcms/pugmill/issues) is the right place for bug reports and concrete feature proposals.
