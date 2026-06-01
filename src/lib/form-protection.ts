import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * form-protection — invisible, stateless anti-bot for public-facing forms.
 *
 * A signed token is issued when a form is rendered and verified on submit.
 * It is a self-contained HMAC (no DB row, no in-memory state), so it works
 * across serverless instances and survives cold starts. The token's embedded
 * issue time doubles as a timing trap: a submission that arrives implausibly
 * fast after the form rendered is almost certainly a bot.
 *
 * What it stops:
 *   - Direct POSTs to the action endpoint that never loaded the form (no token).
 *   - Forged or tampered tokens (HMAC signature fails).
 *   - Tokens minted for a different form (formId mismatch).
 *   - Instant submissions (faster than a human could fill the form).
 *
 * What it does NOT do (by design — keep it dependency-free and stateless):
 *   - Single-use enforcement. A captured token can be replayed until it expires.
 *     The per-IP submission rate limiter (src/lib/rate-limit.ts) caps that abuse.
 *     If you later need strict single-use, add a consumed-nonce store.
 *
 * Pair this with the honeypot field and the IP rate limiter for layered defense.
 * Shared across plugins: contact form today; comments and the AEO network forms
 * can call the same issue/verify pair.
 *
 * Signing key: NEXTAUTH_SECRET (always present — replit-init generates it and it
 * is required for auth anyway). If it is somehow absent, the check degrades to a
 * no-op rather than blocking every legitimate submission.
 */

const DEFAULT_MIN_AGE_MS = 3_000; // submitted faster than this ⇒ bot
const DEFAULT_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours — generous for a stale tab

export type FormTokenFailure =
  | "missing"
  | "malformed"
  | "bad_signature"
  | "wrong_form"
  | "too_fast"
  | "expired";

export type FormTokenResult = { ok: true } | { ok: false; reason: FormTokenFailure };

function signingKey(): string | null {
  return process.env.NEXTAUTH_SECRET || null;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sign(body: string, key: string): string {
  return b64url(createHmac("sha256", key).update(body).digest());
}

/**
 * Issue a signed token for a form. Render the return value in a hidden field
 * (e.g. `<input type="hidden" name="_t" value={token} />`). Returns "" if no
 * signing key is configured — verifyFormToken treats that as "skip the check".
 */
export function issueFormToken(formId: string): string {
  const key = signingKey();
  if (!key) return "";
  const payload = { f: formId, t: Date.now(), n: randomBytes(8).toString("hex") };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  return `${body}.${sign(body, key)}`;
}

/**
 * Verify a token submitted with a form. Returns { ok: true } when valid.
 * On failure, `reason` lets the caller decide how to respond — most failures
 * mean "bot, drop silently", but "expired" usually means a real user left a
 * tab open and should be asked to refresh.
 */
export function verifyFormToken(
  token: string | null | undefined,
  formId: string,
  opts?: { minAgeMs?: number; maxAgeMs?: number }
): FormTokenResult {
  const key = signingKey();
  if (!key) return { ok: true }; // unconfigured ⇒ don't block legitimate submits

  if (!token) return { ok: false, reason: "missing" };

  const dot = token.indexOf(".");
  if (dot <= 0) return { ok: false, reason: "malformed" };
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = sign(body, key);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload: { f?: unknown; t?: unknown };
  try {
    payload = JSON.parse(fromB64url(body).toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (payload.f !== formId) return { ok: false, reason: "wrong_form" };

  const issuedAt = Number(payload.t);
  if (!Number.isFinite(issuedAt)) return { ok: false, reason: "malformed" };

  const age = Date.now() - issuedAt;
  const minAge = opts?.minAgeMs ?? DEFAULT_MIN_AGE_MS;
  const maxAge = opts?.maxAgeMs ?? DEFAULT_MAX_AGE_MS;

  // Negative age (clock skew / forged future timestamp) is treated as malformed.
  if (age < 0) return { ok: false, reason: "malformed" };
  if (age < minAge) return { ok: false, reason: "too_fast" };
  if (age > maxAge) return { ok: false, reason: "expired" };

  return { ok: true };
}
