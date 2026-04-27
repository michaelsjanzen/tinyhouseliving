import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getAiProvider } from "@/lib/ai";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

// ── Prompt ────────────────────────────────────────────────────────────────────
// One call per post — returns all four AEO fields at once to minimise calls.

const SYSTEM_PROMPT = `You are an AEO (Answer Engine Optimisation) expert. Analyse the given blog post and return a single JSON object with exactly these fields:
- summary: string — 2-3 sentence factual plain-text summary written for AI answer engines. Cover the main topic, key conclusion, and who this is for. No fluff.
- qa: array of { q: string, a: string } — 3-5 FAQ pairs. Each question must be a genuine search query a reader would type. Each answer must be a complete, standalone sentence. Do NOT include questions about the author or the site.
- entities: array of { type: string, name: string, description?: string, sameAs?: string } — named entities explicitly discussed in the post. Types: Person, Organization, Product, Place, Event, SoftwareApplication, CreativeWork. Only include entities explicitly discussed. For sameAs, only include a Wikidata (https://www.wikidata.org/wiki/Q...) or Wikipedia URL when highly confident — omit rather than guess.
- keywords: array of strings — 5-10 specific search terms and key phrases that best describe the content.
Return ONLY valid JSON. No markdown fences, no explanation.`;

// Strip markdown syntax to give the AI cleaner input, then truncate.
const MAX_CONTENT_CHARS = 8_000;

function prepareContent(raw: string): string {
  return raw
    .replace(/!\[.*?\]\(.*?\)/g, "")       // strip images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // strip link markup, keep text
    .replace(/#{1,6}\s+/g, "")              // strip headings hashes
    .replace(/[*_`~]+/g, "")               // strip emphasis/code markers
    .replace(/^\s*[-*+>]\s+/gm, "")        // strip list/blockquote markers
    .replace(/\n{3,}/g, "\n\n")            // collapse excess blank lines
    .trim()
    .slice(0, MAX_CONTENT_CHARS);
}

// ── Route ─────────────────────────────────────────────────────────────────────
// Bulk AEO bypasses the per-user hourly rate limit: each post is one call but
// the client enforces a configurable delay (1.5–6 s) between requests. Auth
// and AI availability are still checked. The external AI provider's own rate
// limits act as the real ceiling for high-volume runs.

const bodySchema = z.object({
  postId: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ai = await getAiProvider();
  if (!ai) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "postId is required" }, { status: 400 });
  }

  const post = await db.query.posts.findFirst({
    where: and(eq(posts.id, parsed.data.postId), eq(posts.published, true)),
    columns: { title: true, content: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found or not published" }, { status: 404 });
  }

  const content = prepareContent(post.content ?? "");
  const userPrompt = `Title: "${post.title}"\n\nContent:\n${content}`;

  try {
    const result = await ai.complete(SYSTEM_PROMPT, userPrompt);
    return NextResponse.json({ result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI request failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
