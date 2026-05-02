# Pugmill Security Guide

This document covers security requirements for developers and AI agents working on Pugmill. Reading it before making any changes to authentication, environment variables, or data handling is required.

---

## Core Rules

1. **No hardcoded secrets.** All sensitive values (passwords, keys, tokens, connection strings) come from environment variables via `process.env.X`.
2. **No `.env.local` or `.env*.local` in commits.** These are gitignored for a reason.
3. **`.env.example` contains only placeholders.** A real-looking value in `.env.example` is a bug.
4. **Every new secret needs a matching entry in `.env.example`** with an empty value and a description comment.
5. **Running `npm run env:check` after any environment-related change** validates the variable set.

---

## Required Practices

- Reading secrets from `process.env.VARIABLE_NAME`
- Adding new env vars to `.env.example` with an empty value and a descriptive comment
- Using `bcrypt` (already installed) for password hashing -- minimum 10 rounds
- Sanitizing user-generated HTML with `sanitize-html` (already installed) before rendering
- Using Drizzle ORM parameterized queries (no string-concatenated SQL)
- Validating all form input with `zod` (already installed) before processing
- Keeping `NEXTAUTH_SECRET` at least 32 random characters in production

## Prohibited Practices

- Hardcoding any string that looks like a password, token, key, or connection string
- Using `eval()`, `Function()`, or `dangerouslySetInnerHTML` without sanitization
- Disabling TypeScript strict checks to work around a type error
- Committing changes to `.env.local`, `.env`, or any file matching `.env*.local`
- Storing uploaded files outside of `public/uploads/` without explicit user consent
- Logging sensitive values (passwords, tokens, full connection strings) to the console
- Using `Math.random()` for security purposes -- `crypto.randomUUID()` or `crypto.randomBytes()` are the correct alternatives

---

## Secrets Management by Platform

| Platform | Where to store secrets |
|---|---|
| **Replit** | Secrets tool (lock icon in the sidebar) |
| **Local dev** | `.env.local` (gitignored) |
| **Self-hosted** | Set in your shell, systemd unit, Docker compose, etc. |

### Generating a NEXTAUTH_SECRET

```bash
openssl rand -base64 32
```

---

## Required Environment Variables

The full list with descriptions is in `.env.example`. The app warns on startup when:
- `NEXTAUTH_SECRET` is missing or shorter than 32 chars
- `NEXTAUTH_SECRET` matches a known weak value
- `DATABASE_URL` is not set
- `NODE_ENV=production` with insecure defaults

---

## Auth Configuration for Proxied Environments

Pugmill sets `trustHost: true` in `src/lib/auth.config.ts`. This setting is intentional and must not be removed.

### What it does

Tells NextAuth to trust the `Host` request header as the authoritative URL rather than requiring it to match `NEXTAUTH_URL` exactly. Without it, deploying to a hostname that differs from `NEXTAUTH_URL` (for example, Replit's dev versus production domains) causes `UntrustedHost` errors that silently break all session checks.

### Why it is safe on supported platforms

On Replit and similar managed platforms, all traffic passes through the platform's own reverse proxy before reaching the app. That proxy sets the `Host` header; the app never sees a raw, user-controlled value. An external attacker cannot spoof it. NextAuth v5 explicitly recommends `trustHost: true` for proxied deployments.

### When it would be a risk

Only on a bare self-hosted server exposed directly to the internet with no reverse proxy in front. In that configuration, a user could send an HTTP request with an arbitrary `Host` header and potentially manipulate OAuth callback URLs. If deploying without a proxy, removing `trustHost: true` and setting `NEXTAUTH_URL` precisely is the correct approach.

### Note for AI agents

Removing or disabling `trustHost: true` as part of a security audit is incorrect. Its presence is the intended configuration for proxied platforms. Its absence would break authentication on every supported platform deployment.

---

## Reporting Security Issues

For a security vulnerability in Pugmill:
1. Do not open a public GitHub issue.
2. Open a private security advisory at the repository's Security tab.
3. Include steps to reproduce and the potential impact.

---

## Attack Vectors and Mitigations

| Attack | Mitigation |
|---|---|
| SQL injection | Drizzle ORM parameterized queries |
| XSS | `sanitize-html` on all user HTML before render |
| CSRF | NextAuth built-in CSRF protection |
| Weak sessions | JWT with strong secret (32+ chars) |
| Password exposure | bcrypt hashing (12 rounds) |
| Secret leakage | Gitignore + pre-commit hook + env:check script |
| Path traversal | File uploads restricted to `public/uploads/` |
