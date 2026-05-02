/**
 * Unit tests for the bot-analytics plugin.
 *
 * Tests the two pure-logic layers:
 *  1. detectBot  — UA string → canonical bot name  (src/lib/bot-detection.ts)
 *  2. classifyPath — URL path → resource type      (src/lib/bot-detection.ts)
 *
 * No database connection required.
 */
import { describe, it, expect } from "vitest";
import { detectBot, classifyPath, BOT_PATTERNS, BOT_CONFIG } from "../src/lib/bot-detection";

// ── BOT_CONFIG / BOT_PATTERNS alignment ──────────────────────────────────────

describe("BOT_CONFIG — display config completeness", () => {
  const canonicals = [...new Set(BOT_PATTERNS.map(p => p.canonical))];

  it("every canonical name from BOT_PATTERNS has a BOT_CONFIG entry", () => {
    const missing = canonicals.filter(name => !BOT_CONFIG[name]);
    expect(missing, `Missing BOT_CONFIG entries for: ${missing.join(", ")}`).toHaveLength(0);
  });

  it("every BOT_CONFIG entry has a label, color, and type", () => {
    for (const [name, info] of Object.entries(BOT_CONFIG)) {
      expect(info.label, `${name}: missing label`).toBeTruthy();
      expect(info.color, `${name}: missing color`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(["answer", "training", "search"], `${name}: invalid type`).toContain(info.type);
    }
  });

  it("AI bots (answer + training) appear before search bots in BOT_PATTERNS", () => {
    const indices = Object.entries(BOT_CONFIG).map(([name]) => {
      const idx = BOT_PATTERNS.findIndex(p => p.canonical === name);
      return { name, idx, type: BOT_CONFIG[name].type };
    }).filter(e => e.idx !== -1);

    const aiIdxs     = indices.filter(e => e.type === "answer" || e.type === "training").map(e => e.idx);
    const searchIdxs = indices.filter(e => e.type === "search").map(e => e.idx);
    if (aiIdxs.length === 0 || searchIdxs.length === 0) return; // trivially satisfied
    expect(Math.max(...aiIdxs)).toBeLessThan(Math.min(...searchIdxs));
  });
});

// ── detectBot tests ───────────────────────────────────────────────────────────

describe("detectBot — AI crawlers", () => {
  // OpenAI — split into individual canonical names
  it("GPTBot → GPTBot", () => {
    expect(detectBot("Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)")).toBe("GPTBot");
  });

  it("ChatGPT-User → ChatGPT-User", () => {
    expect(detectBot("Mozilla/5.0 AppleWebKit/537.36 (compatible; ChatGPT-User/1.0)")).toBe("ChatGPT-User");
  });

  it("OAI-SearchBot → OAI-SearchBot", () => {
    expect(detectBot("OAI-SearchBot/1.0 (+https://openai.com/searchbot)")).toBe("OAI-SearchBot");
  });

  // Anthropic — split into individual canonical names
  it("ClaudeBot → ClaudeBot", () => {
    expect(detectBot("Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)")).toBe("ClaudeBot");
  });

  it("anthropic-ai → anthropic-ai", () => {
    expect(detectBot("anthropic-ai/1.0 (+https://www.anthropic.com)")).toBe("anthropic-ai");
  });

  // Perplexity — split into individual canonical names
  it("PerplexityBot → PerplexityBot", () => {
    expect(detectBot("Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/bot)")).toBe("PerplexityBot");
  });

  it("Google-Extended → Gemini (not Googlebot)", () => {
    expect(detectBot("Mozilla/5.0 (compatible; Google-Extended)")).toBe("Gemini");
  });

  it("Amazonbot → Amazonbot", () => {
    expect(detectBot("Mozilla/5.0 (compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)")).toBe("Amazonbot");
  });

  it("meta-externalagent → Meta", () => {
    expect(detectBot("meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)")).toBe("Meta");
  });

  it("cohere-ai → Cohere", () => {
    expect(detectBot("cohere-ai/1.0")).toBe("Cohere");
  });

  it("CCBot → CCBot", () => {
    expect(detectBot("CCBot/2.0 (https://commoncrawl.org/faq/)")).toBe("CCBot");
  });
});

describe("detectBot — search spiders", () => {
  it("Googlebot → Googlebot", () => {
    expect(detectBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe("Googlebot");
  });

  it("bingbot → Bingbot", () => {
    expect(detectBot("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)")).toBe("Bingbot");
  });

  it("DuckDuckBot → DuckDuckBot", () => {
    expect(detectBot("DuckDuckBot/1.0; (+http://duckduckgo.com/duckduckbot.html)")).toBe("DuckDuckBot");
  });

  it("Bytespider → Bytespider", () => {
    expect(detectBot("Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; https://zhanzhang.toutiao.com/)")).toBe("Bytespider");
  });

  it("Applebot → Applebot", () => {
    expect(detectBot("Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)")).toBe("Applebot");
  });
});

describe("detectBot — ordering: AI bots win over search bots", () => {
  it("Google-Extended matches Gemini before Googlebot", () => {
    expect(detectBot("Mozilla/5.0 (compatible; Google-Extended)")).toBe("Gemini");
    expect(detectBot("Mozilla/5.0 (compatible; Google-Extended)")).not.toBe("Googlebot");
  });
});

describe("detectBot — non-bots return null", () => {
  it("regular browser UA → null", () => {
    expect(detectBot("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")).toBeNull();
  });

  it("empty string → null", () => {
    expect(detectBot("")).toBeNull();
  });

  it("curl → null", () => {
    expect(detectBot("curl/7.88.1")).toBeNull();
  });
});

// ── classifyPath tests ────────────────────────────────────────────────────────

describe("classifyPath — AEO endpoints", () => {
  it("/llms.txt → llms.txt", () => {
    expect(classifyPath("/llms.txt")).toBe("llms.txt");
  });

  it("/llms-full.txt → llms-full.txt (checked before llms.txt)", () => {
    expect(classifyPath("/llms-full.txt")).toBe("llms-full.txt");
  });

  it("/post/[slug]/llm.txt → Post Markdown", () => {
    expect(classifyPath("/post/my-article/llm.txt")).toBe("Post Markdown");
  });

  it("llm= query param (WPPugmill convention) → HTML Page, not Post Markdown", () => {
    // Pugmill uses a clean URL, not a query param — this must not be misclassified
    expect(classifyPath("/post/my-article?llm=1")).toBe("HTML Page");
  });

  it("/[slug]/llms.txt → llms.txt", () => {
    expect(classifyPath("/docs/llms.txt")).toBe("llms.txt");
  });
});

describe("classifyPath — discovery resources", () => {
  it("/sitemap.xml → Sitemap", () => {
    expect(classifyPath("/sitemap.xml")).toBe("Sitemap");
  });

  it("/sitemap-0.xml → Sitemap", () => {
    expect(classifyPath("/sitemap-0.xml")).toBe("Sitemap");
  });

  it("/robots.txt → Robots.txt", () => {
    expect(classifyPath("/robots.txt")).toBe("Robots.txt");
  });
});

describe("classifyPath — HTML page crawls", () => {
  it("regular post path → HTML Page", () => {
    expect(classifyPath("/post/hello-world")).toBe("HTML Page");
  });

  it("root path → HTML Page", () => {
    expect(classifyPath("/")).toBe("HTML Page");
  });

  it("page path → HTML Page", () => {
    expect(classifyPath("/about")).toBe("HTML Page");
  });
});

describe("classifyPath — ordering: llms-full.txt before llms.txt", () => {
  it("/llms-full.txt is not misclassified as llms.txt", () => {
    expect(classifyPath("/llms-full.txt")).toBe("llms-full.txt");
    expect(classifyPath("/llms-full.txt")).not.toBe("llms.txt");
  });
});
