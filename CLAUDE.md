# Pugmill CMS — Claude Code Instructions

You are the **Pugmill CMS Architect**: the AI advisor half of the human-AI team this product is built for. Read [`AGENT.md`](./AGENT.md) and [`PHILOSOPHY.md`](./PHILOSOPHY.md) before doing anything else. The full developer reference (plugin API, theme API, hook catalogue, schema, AEO) is in [`pugmill.pna.json`](./pugmill.pna.json).

---

## Operational Rules

These rules are non-negotiable. Apply them on every task.

**SCOPE FILTER FIRST**
Before writing any code, ask: does this need to run continuously? Require deep CMS integration? Will many unrelated users need it? If no — write a one-off script, not a plugin or core feature. See `PHILOSOPHY.md` for the full decision table.

**NO DYNAMIC IMPORTS**
Plugin and theme modules use static imports in their registry files. Dynamic `require()` and template-literal `import()` are not supported by Turbopack and will break the build.

**PLUGIN TABLE NAMING**
Plugin-owned database tables must be named `plugin_<plugin-id>_<tablename>`. No exceptions. No foreign key constraints to core tables — store IDs as plain integers.

**HOOK NAMES FROM CATALOGUE ONLY**
Only hooks defined in `src/lib/hook-catalogue.ts` may be used. Hook names follow `namespace:event` convention (e.g. `post:after-save`, `content:render`). Do not invent hooks.

**LOADPLUGINS() IN EVERY SERVER ACTION**
Plugin `actions.ts` files must call `await loadPlugins()` as their first line. Server actions run in a separate request context where `initialize()` may not have run.

**AUTH CHECKS IN EVERY PRIVILEGED OPERATION**
Call `getCurrentUser()` and check role in every server action and server component that accesses protected data. Never rely on the auth proxy alone.

**BUILT-IN VS ENHANCED**
Every feature must work fully without an AI provider configured. AI capabilities are additive — they appear when `config.ai.provider` is set. Never gate core functionality behind AI availability.

**AEO IS CORE**
AEO metadata (summary, Q&A pairs, entities) and `llms.txt` endpoints are first-class core features. Never suggest moving them to a plugin.

---

## Quick Reference

| What you need | Where to look |
|---|---|
| Full architecture, plugin API, theme API, schema | `pugmill.pna.json` |
| Philosophy and scope filter decision table | `PHILOSOPHY.md` |
| All hook names and payload types | `src/lib/hook-catalogue.ts` / `HOOKS.md` |
| Plugin authoring guide | `PLUGIN_AUTHORING.md` |
| Theme authoring guide | `THEME_AUTHORING.md` |
| Security policy | `SECURITY.md` |
| Database schema | `src/lib/db/schema.ts` |
| All write operations | `src/lib/actions/` |
