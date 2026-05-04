import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import Link from "next/link";
import Image from "next/image";
import type { ArticleLayoutConfig } from "../design";
import { extractCitations } from "@/lib/aeo";

// SVG elements are excluded because inline SVG has a long history of
// sanitization bypasses via <animate>, <use>, and foreignObject. Posts don't
// need inline SVGs — block images and figures cover all legitimate use cases.
// href/src are restricted to safe schemes to block javascript: URIs.
const SVG_TAGS = new Set([
  "svg", "path", "circle", "ellipse", "line", "rect", "polygon", "polyline",
  "g", "defs", "symbol", "use", "title", "desc", "tspan", "animate",
  "animateTransform", "animateMotion", "set", "mpath", "foreignObject", "switch",
]);

const SANITIZE_SCHEMA = {
  ...defaultSchema,
  tagNames: (defaultSchema.tagNames ?? []).filter(tag => !SVG_TAGS.has(tag)),
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "#", "mailto"],
    src:  ["http", "https"],
  },
};

export interface PostTaxonomy { name: string; slug: string }

export interface AeoMetadata {
  summary?: string;
  questions?: { q: string; a: string }[];
  entities?: { type: string; name: string; description?: string; sameAs?: string }[];
  keywords?: string[];
  schemaType?: "HowTo" | "Product" | "Event" | "LocalBusiness" | "VideoObject" | "Review";
  schemaData?: Record<string, string>;
}

export interface PostViewProps {
  title: string;
  excerpt?: string | null;
  content: string;
  publishedAt: Date | null;
  updatedAt?: Date | null;
  featuredImageUrl?: string | null;
  categories: PostTaxonomy[];
  tags: PostTaxonomy[];
  aeoMetadata: AeoMetadata | null;
  layoutConfig?: ArticleLayoutConfig;
  canonicalUrl?: string;
  siteName?: string;
  /** Rendered widget area for the sidebar slot — replaces the default category/tag sidebar. */
  sidebarContent?: React.ReactNode;
  /** Rendered widget area for the post-footer slot — shown below the article body. */
  footerWidgets?: React.ReactNode;
  /** Plugin slot: rendered inside the article, above the body content. */
  articleHeaderContent?: React.ReactNode;
  /** Plugin slot: rendered inside the article, after the body content and before metadata/tags. */
  articleFooterContent?: React.ReactNode;
}

function formatDate(date: Date | null): string | null {
  if (!date) return null;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

const contentWidthClass: Record<string, string> = {
  narrow: "max-w-2xl mx-auto",
  medium: "max-w-4xl mx-auto",
  wide: "max-w-7xl mx-auto",
};

function safeJson(obj: object): string {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export default function PostView({
  title,
  excerpt,
  content,
  publishedAt,
  updatedAt,
  featuredImageUrl,
  categories,
  tags,
  aeoMetadata,
  layoutConfig,
  canonicalUrl,
  siteName,
  sidebarContent,
  footerWidgets,
  articleHeaderContent,
  articleFooterContent,
}: PostViewProps) {
  const questions = aeoMetadata?.questions?.filter(q => q.q && q.a) ?? [];

  const contentWidth = layoutConfig?.contentWidth ?? "narrow";
  const sidebar = layoutConfig?.sidebar ?? "none";
  const widthClass = contentWidthClass[contentWidth] ?? contentWidthClass.narrow;

  // ── JSON-LD ────────────────────────────────────────────────────────────────

  // Map AI-generated entity types to valid schema.org @type values
  const SCHEMA_TYPE_MAP: Record<string, string> = {
    Person: "Person",
    Organization: "Organization",
    Product: "Product",
    Place: "Place",
    Event: "Event",
    CreativeWork: "CreativeWork",
    SoftwareApplication: "SoftwareApplication",
    // Common AI hallucinations → nearest valid type
    Technology: "Thing",
    Tool: "Thing",
    Concept: "Thing",
  };
  function toSchemaType(raw: string): string {
    return SCHEMA_TYPE_MAP[raw] ?? "Thing";
  }

  const description = excerpt ?? aeoMetadata?.summary;
  const personEntities = aeoMetadata?.entities?.filter(e => e.type === "Person") ?? [];
  const authorNames = new Set(personEntities.map(p => p.name));

  // Exclude entities already listed as author to avoid duplication
  const mentions = (aeoMetadata?.entities ?? [])
    .filter(e => !(e.type === "Person" && authorNames.has(e.name)))
    .map(e => ({
      "@type": toSchemaType(e.type),
      name: e.name,
      ...(e.description ? { description: e.description } : {}),
      ...(e.sameAs ? { sameAs: e.sameAs } : {}),
    }));

  const citations = extractCitations(content);

  const articleSchema = canonicalUrl
    ? safeJson({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: title,
        url: canonicalUrl,
        ...(featuredImageUrl ? { image: featuredImageUrl } : {}),
        ...(publishedAt ? { datePublished: publishedAt.toISOString() } : {}),
        ...(updatedAt ? { dateModified: updatedAt.toISOString() } : {}),
        ...(description ? { description } : {}),
        ...(siteName
          ? { publisher: { "@type": "Organization", name: siteName } }
          : {}),
        author: personEntities.length > 0
          ? personEntities.map(p => ({
              "@type": "Person",
              name: p.name,
              ...(p.description ? { description: p.description } : {}),
              ...(p.sameAs ? { sameAs: p.sameAs } : {}),
            }))
          : (siteName ? [{ "@type": "Organization", name: siteName }] : undefined),
        ...(mentions.length > 0 ? { mentions } : {}),
        ...(citations.length > 0 ? { citation: citations.map(c => ({ "@type": "WebPage", url: c.url, name: c.name })) } : {}),
      })
    : null;

  const faqSchema =
    canonicalUrl && questions.length > 0
      ? safeJson({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: questions.map(q => ({
            "@type": "Question",
            name: q.q,
            acceptedAnswer: { "@type": "Answer", text: q.a },
          })),
        })
      : null;

  // Extended schema type (HowTo, Product, Event, LocalBusiness, VideoObject)
  const extendedSchema = (() => {
    const st = aeoMetadata?.schemaType;
    const sd = aeoMetadata?.schemaData ?? {};
    if (!st || !canonicalUrl) return null;

    if (st === "HowTo") {
      const steps = (sd.steps ?? "").split("\n").map(s => s.trim()).filter(Boolean);
      if (!steps.length) return null;
      return safeJson({
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: sd.name || title,
        ...(sd.description ? { description: sd.description } : {}),
        ...(sd.totalTime ? { totalTime: sd.totalTime } : {}),
        step: steps.map((text, i) => ({ "@type": "HowToStep", position: i + 1, text })),
      });
    }
    if (st === "Product") {
      return safeJson({
        "@context": "https://schema.org",
        "@type": "Product",
        name: sd.name || title,
        ...(sd.description ? { description: sd.description } : {}),
        ...(sd.brand ? { brand: { "@type": "Brand", name: sd.brand } } : {}),
        ...(sd.price ? { offers: { "@type": "Offer", price: sd.price, priceCurrency: sd.priceCurrency || "USD", ...(sd.availability ? { availability: `https://schema.org/${sd.availability}` } : {}) } } : {}),
      });
    }
    if (st === "Event") {
      return safeJson({
        "@context": "https://schema.org",
        "@type": "Event",
        name: sd.name || title,
        ...(sd.startDate ? { startDate: sd.startDate } : {}),
        ...(sd.endDate ? { endDate: sd.endDate } : {}),
        ...(sd.locationName ? { location: { "@type": "Place", name: sd.locationName } } : {}),
        ...(sd.description ? { description: sd.description } : {}),
      });
    }
    if (st === "LocalBusiness") {
      return safeJson({
        "@context": "https://schema.org",
        "@type": sd.businessType || "LocalBusiness",
        name: sd.name || siteName || title,
        ...(sd.address ? { address: sd.address } : {}),
        ...(sd.telephone ? { telephone: sd.telephone } : {}),
        ...(sd.url ? { url: sd.url } : {}),
      });
    }
    if (st === "VideoObject") {
      return safeJson({
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name: sd.name || title,
        ...(sd.description ? { description: sd.description } : {}),
        ...(sd.contentUrl ? { contentUrl: sd.contentUrl } : {}),
        ...(sd.thumbnailUrl ? { thumbnailUrl: sd.thumbnailUrl } : {}),
        ...(sd.uploadDate ? { uploadDate: sd.uploadDate } : {}),
        ...(sd.duration ? { duration: sd.duration } : {}),
      });
    }
    if (st === "Review") {
      if (!sd.itemName) return null;
      return safeJson({
        "@context": "https://schema.org",
        "@type": "Review",
        ...(canonicalUrl ? { url: canonicalUrl } : {}),
        itemReviewed: {
          "@type": sd.itemType || "Thing",
          name: sd.itemName,
          ...(sd.itemAuthor ? { author: { "@type": "Person", name: sd.itemAuthor } } : {}),
        },
        ...(sd.ratingValue ? {
          reviewRating: {
            "@type": "Rating",
            ratingValue: sd.ratingValue,
            bestRating: sd.bestRating || "5",
          },
        } : {}),
        ...(sd.reviewBody ? { reviewBody: sd.reviewBody } : {}),
      });
    }
    return null;
  })();

  const articleBody = (
    <article className="space-y-10">
      {/* JSON-LD */}
      {articleSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: articleSchema }}
        />
      )}
      {extendedSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: extendedSchema }}
        />
      )}
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: faqSchema }}
        />
      )}

      {/* Article header — metadata (category → date → tags) is rendered at the
          bottom of the article so the reader sees title and lede first. */}
      <header className="space-y-4 pb-8 border-b border-[var(--color-border)]">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--color-foreground)] leading-tight">
          {title}
        </h1>

        {(excerpt || aeoMetadata?.summary) && (
          <p className="text-lg text-[var(--color-muted)] leading-relaxed">
            {excerpt || aeoMetadata?.summary}
          </p>
        )}
      </header>

      {/* Hero image */}
      {featuredImageUrl && (
        <div className="relative w-full aspect-[2/1] rounded-xl overflow-hidden border border-[var(--color-border)]">
          <Image
            src={featuredImageUrl}
            alt={title}
            fill
            priority
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 960px"
          />
        </div>
      )}

      {/* articleHeader slot — plugin content above the body */}
      {articleHeaderContent}

      {/* Article body */}
      <div className="prose max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-[var(--color-foreground)] prose-a:text-[var(--color-link)] prose-a:no-underline hover:prose-a:underline prose-code:text-[var(--color-foreground)] prose-code:bg-[var(--color-surface)] prose-code:px-1 prose-code:rounded prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:whitespace-pre-wrap prose-pre:break-words prose-p:text-[var(--color-foreground)] prose-li:text-[var(--color-foreground)]">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, [rehypeSanitize, SANITIZE_SCHEMA], rehypeSlug]}>
          {content}
        </ReactMarkdown>
      </div>

      {/* FAQ accordion — AEO */}
      {questions.length > 0 && (
        <aside className="border border-[var(--color-border)] rounded-xl overflow-hidden">
          <div className="px-6 py-4 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
            <h2 className="text-sm font-semibold text-[var(--color-muted)] uppercase tracking-wide">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {questions.map((item, i) => (
              <details key={item.q} className="group" open={i === 0}>
                <summary className="flex items-center justify-between gap-4 px-6 py-4 cursor-pointer list-none select-none">
                  <span className="text-sm font-medium text-[var(--color-foreground)] group-open:text-[var(--color-accent)] transition-colors">
                    {item.q}
                  </span>
                  <svg
                    className="w-4 h-4 text-[var(--color-muted)] shrink-0 group-open:rotate-180 transition-transform duration-200"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-5 text-sm text-[var(--color-muted)] leading-relaxed">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </aside>
      )}

      {/* articleFooter slot — plugin content after body, before metadata/tags */}
      {articleFooterContent}

      {/* Post footer widgets */}
      {footerWidgets && (
        <div className="border-t border-[var(--color-border)] pt-8">
          {footerWidgets}
        </div>
      )}

      {/* Post metadata — bottom of article, rendered in order:
          1. Categories  2. Date  3. Tags */}
      {(categories.length > 0 || formatDate(publishedAt) || tags.length > 0) && (
        <div className="space-y-3">
          {(categories.length > 0 || formatDate(publishedAt)) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {categories.map(cat => (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--color-surface)] text-[var(--color-accent)] border border-[var(--color-border)] hover:opacity-80 transition"
                >
                  {cat.name}
                </Link>
              ))}
              {formatDate(publishedAt) && (
                <time
                  dateTime={publishedAt?.toISOString()}
                  className="text-xs text-[var(--color-muted)] ml-1"
                >
                  {formatDate(publishedAt)}
                </time>
              )}
            </div>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map(tag => (
                <Link
                  key={tag.slug}
                  href={`/tag/${tag.slug}`}
                  className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-surface)] text-[var(--color-muted)] border border-[var(--color-border)] hover:opacity-80 transition"
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Back link */}
      <footer className="pt-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All posts
        </Link>
      </footer>
    </article>
  );

  // Use passed widget content when provided; fall back to default taxonomy sidebar.
  // The fallback uses <div> (not <aside>) — the outer layout already wraps in <aside>.
  const defaultSidebar = (categories.length > 0 || tags.length > 0) ? (
    <div className="space-y-6">
      {categories.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide mb-2">
            Categories
          </h3>
          <div className="flex flex-col gap-1">
            {categories.map(cat => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className="text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)] px-2 py-1 rounded-md hover:bg-[var(--color-surface)] transition"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </div>
      )}
      {tags.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide mb-2">
            Tags
          </h3>
          <div className="flex flex-wrap gap-1">
            {tags.map(tag => (
              <Link
                key={tag.slug}
                href={`/tag/${tag.slug}`}
                className="text-xs text-[var(--color-muted)] hover:text-[var(--color-foreground)] px-2 py-0.5 rounded-full bg-[var(--color-surface)] hover:opacity-80 transition"
              >
                {tag.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  ) : null;

  const resolvedSidebarContent = sidebarContent ?? defaultSidebar;

  if (sidebar === "none" || !resolvedSidebarContent) {
    return <div className={widthClass}>{articleBody}</div>;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-start">
      {sidebar === "left" && (
        <aside className="w-full lg:w-56 shrink-0 space-y-6 lg:sticky lg:top-24 order-last lg:order-first">{resolvedSidebarContent}</aside>
      )}
      <div className="flex-1 min-w-0 w-full">{articleBody}</div>
      {sidebar === "right" && (
        <aside className="w-full lg:w-56 shrink-0 space-y-6 lg:sticky lg:top-24 order-last">{resolvedSidebarContent}</aside>
      )}
    </div>
  );
}
