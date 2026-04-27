// PUGMILL_DESIGN_REGISTRY — Editorial Theme
// ============================================================
// Warm, publication-grade design system. Inspired by long-form journalism:
// Stripe blog, The Atlantic, Substack, Ghost's Casper.
//
// Typographic hierarchy does the structural work — no card chrome, no
// heavy borders. Serif display headings contrast with clean humanist body.
// ============================================================

import type { DesignTokenDef, ColorPreset } from "../../src/types/design";
import type { WidgetAreaDef } from "../../src/types/widget";
import type { HeaderLayoutDef, HeaderModifiers, FooterLayoutDef } from "../../src/types/theme";

// ─── Layout config types ───────────────────────────────────────────────────────
// Identical shape to default — routes import from their active theme's design.ts.

export interface HomeLayoutConfig {
  feedStyle: "list" | "grid";
  listStyle: "compact" | "editorial" | "feature" | "text-only";
  columns: 1 | 2 | 3;
  gap: "sm" | "md" | "lg";
  contentDisplay: "excerpt" | "none";
}

export interface HeroConfig {
  enabled: boolean;
  height: "short" | "medium" | "tall" | "full";
  imageUrl: string;
  overlayColor: string;
  overlayStyle: "flat" | "gradient-up" | "gradient-down";
  overlayOpacity: number;
  showHeadline: boolean;
  headline: string;
  showSubheadline: boolean;
  subheadline: string;
  contentAlign: "left" | "center";
  contentPosition: "top" | "center" | "bottom";
  cta1Enabled: boolean;
  cta1Text: string;
  cta1Url: string;
  cta1Style: "filled" | "outline";
  cta2Enabled: boolean;
  cta2Text: string;
  cta2Url: string;
  cta2Style: "filled" | "outline";
}

export interface ArticleLayoutConfig {
  contentWidth: "narrow" | "medium" | "wide";
  sidebar: "none" | "left" | "right";
}

// ─── Header layout registry ────────────────────────────────────────────────────

export const HEADER_LAYOUTS: HeaderLayoutDef[] = [
  { id: "standard", label: "Standard", description: "Logo left, nav right" },
  { id: "centered", label: "Centered", description: "Logo centered, nav below" },
  { id: "minimal",  label: "Minimal",  description: "Logo only, hamburger always" },
];

export const HEADER_MODIFIERS: HeaderModifiers = {
  supportsSticky: true,
  supportsBackgroundStyles: ["solid", "glass"],
  supportsCompactHeight: false,  // Editorial header always has generous padding
  supportsLogo: true,
};

export const FOOTER_LAYOUTS: FooterLayoutDef[] = [
  { id: "simple",   label: "Simple",   description: "Nav row + copyright left, social right" },
  { id: "centered", label: "Centered", description: "All content centered" },
  { id: "columns",  label: "Columns",  description: "Site info left, nav + social right" },
  { id: "minimal",  label: "Minimal",  description: "Copyright line only" },
];

// ─── Font allowlists ───────────────────────────────────────────────────────────

/** Display serif fonts for headings — the defining characteristic of this theme. */
export const SERIF_FONTS: string[] = [
  "Playfair Display",
  "DM Serif Display",
  "Lora",
  "Merriweather",
  "Source Serif 4",
  "Cormorant Garamond",
];

/** Humanist sans for body text and UI elements. */
export const SANS_FONTS: string[] = [
  "DM Sans",
  "Inter",
  "Source Sans 3",
  "Lato",
  "Nunito Sans",
];

export const MONO_FONTS: string[] = [
  "JetBrains Mono",
  "Fira Code",
  "Source Code Pro",
];

const SYSTEM_FONTS = ["system-ui", "serif", "monospace"];

// ─── Widget areas ──────────────────────────────────────────────────────────────

export const WIDGET_AREAS: WidgetAreaDef[] = [
  { id: "sidebar-post",  label: "Post Sidebar",  configKey: "sidebarPostWidgets",  defaultWidgets: [] },
  { id: "sidebar-page",  label: "Page Sidebar",  configKey: "sidebarPageWidgets",  defaultWidgets: [] },
  { id: "post-footer",   label: "Post Footer",   configKey: "postFooterWidgets",   defaultWidgets: [] },
  { id: "page-footer",   label: "Page Footer",   configKey: "pageFooterWidgets",   defaultWidgets: [] },
];

// ─── Token definitions ─────────────────────────────────────────────────────────

export const DESIGN_TOKEN_DEFS: DesignTokenDef[] = [
  // ── Colors ──
  {
    key: "colorBackground",
    label: "Background",
    description: "Main page background. Warm off-white by default.",
    type: "color",
    group: "colors",
    cssVariable: "--color-background",
    default: "#fafaf8",
    editable: true,
    order: 1,
  },
  {
    key: "colorSurface",
    label: "Surface",
    description: "Panel and subtle-background areas.",
    type: "color",
    group: "colors",
    cssVariable: "--color-surface",
    default: "#f5f0eb",
    editable: true,
    order: 2,
  },
  {
    key: "colorForeground",
    label: "Foreground",
    description: "Primary text. Warm near-black — softer than pure black.",
    type: "color",
    group: "colors",
    cssVariable: "--color-foreground",
    default: "#1c1a17",
    editable: true,
    order: 3,
  },
  {
    key: "colorMuted",
    label: "Muted",
    description: "Secondary text: bylines, dates, captions.",
    type: "color",
    group: "colors",
    cssVariable: "--color-muted",
    default: "#5c564e",
    editable: true,
    order: 4,
  },
  {
    key: "colorBorder",
    label: "Border",
    description: "Dividers and structural lines.",
    type: "color",
    group: "colors",
    cssVariable: "--color-border",
    default: "#e4ddd4",
    editable: true,
    order: 5,
  },
  {
    key: "colorAccent",
    label: "Accent",
    description: "Links and interactive elements. Deep ink blue by default.",
    type: "color",
    group: "colors",
    cssVariable: "--color-accent",
    default: "#1e3a5f",
    editable: true,
    order: 6,
  },
  {
    key: "colorAccentFg",
    label: "Accent foreground",
    description: "Text on accent-colored backgrounds.",
    type: "color",
    group: "colors",
    cssVariable: "--color-accent-fg",
    default: "#ffffff",
    editable: true,
    order: 7,
  },
  {
    key: "colorLink",
    label: "Link",
    description: "Hyperlink color.",
    type: "color",
    group: "colors",
    cssVariable: "--color-link",
    default: "#1e3a5f",
    editable: true,
    order: 8,
  },

  // ── Typography ──
  {
    key: "fontHeading",
    label: "Display / heading font",
    description: "Used for article titles and section headings. Choose a serif for the editorial look.",
    type: "google-font",
    fontList: "serif",
    group: "typography",
    cssVariable: "--font-heading",
    default: "Playfair Display",
    editable: true,
    order: 1,
  },
  {
    key: "fontSans",
    label: "Body font",
    description: "Body text and UI elements.",
    type: "google-font",
    fontList: "sans",
    group: "typography",
    cssVariable: "--font-sans",
    default: "DM Sans",
    editable: true,
    order: 2,
  },
  {
    key: "fontMono",
    label: "Monospace font",
    description: "Code blocks and inline code.",
    type: "google-font",
    fontList: "mono",
    group: "typography",
    cssVariable: "--font-mono",
    default: "JetBrains Mono",
    editable: true,
    order: 3,
  },
  {
    key: "baseFontSize",
    label: "Base font size",
    description: "Body text size. Editorial themes typically use larger type.",
    type: "select",
    group: "typography",
    cssVariable: "--font-size-base",
    options: [
      { value: "1rem",     label: "Normal (16px)" },
      { value: "1.0625rem", label: "Comfortable (17px)" },
      { value: "1.125rem", label: "Large (18px)" },
      { value: "1.25rem",  label: "Extra Large (20px)" },
    ],
    default: "1.125rem",  // Editorial defaults to 18px
    editable: true,
    order: 4,
  },

  // ── Layout — Home ──
  {
    key: "homeFeedStyle",
    label: "Feed style",
    type: "select",
    group: "layout-home",
    options: [
      { value: "list", label: "List" },
      { value: "grid", label: "Grid" },
    ],
    default: "list",
    editable: true,
  },
  {
    key: "homeListStyle",
    label: "List style",
    type: "select",
    group: "layout-home",
    options: [
      { value: "compact",   label: "Compact" },
      { value: "editorial", label: "Editorial" },
      { value: "feature",   label: "Feature" },
      { value: "text-only", label: "Text only" },
    ],
    default: "text-only",  // Editorial defaults to no-thumbnail, typography-first
    editable: true,
  },
  {
    key: "homeColumns",
    label: "Grid columns",
    type: "select",
    group: "layout-home",
    options: [
      { value: "1", label: "1 column" },
      { value: "2", label: "2 columns" },
      { value: "3", label: "3 columns" },
    ],
    default: "1",
    editable: true,
  },
  {
    key: "homeContentDisplay",
    label: "Content",
    type: "select",
    group: "layout-home",
    options: [
      { value: "excerpt", label: "Excerpt" },
      { value: "none",    label: "None" },
    ],
    default: "excerpt",
    editable: true,
  },
  {
    key: "homeGap",
    label: "Gap",
    type: "select",
    group: "layout-home",
    options: [
      { value: "sm", label: "Small" },
      { value: "md", label: "Medium" },
      { value: "lg", label: "Large" },
    ],
    default: "lg",  // Editorial needs breathing room
    editable: true,
  },

  // ── Layout — Blog ──
  {
    key: "blogFeedStyle",    label: "Feed style",    type: "select", group: "layout-blog",
    options: [{ value: "list", label: "List" }, { value: "grid", label: "Grid" }],
    default: "list", editable: true,
  },
  {
    key: "blogListStyle",   label: "List style",    type: "select", group: "layout-blog",
    options: [
      { value: "compact", label: "Compact" }, { value: "editorial", label: "Editorial" },
      { value: "feature", label: "Feature" }, { value: "text-only", label: "Text only" },
    ],
    default: "text-only", editable: true,
  },
  {
    key: "blogColumns",     label: "Grid columns",  type: "select", group: "layout-blog",
    options: [{ value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }],
    default: "1", editable: true,
  },
  {
    key: "blogContentDisplay", label: "Content",    type: "select", group: "layout-blog",
    options: [{ value: "excerpt", label: "Excerpt" }, { value: "none", label: "None" }],
    default: "excerpt", editable: true,
  },
  {
    key: "blogGap",         label: "Gap",           type: "select", group: "layout-blog",
    options: [{ value: "sm", label: "Small" }, { value: "md", label: "Medium" }, { value: "lg", label: "Large" }],
    default: "lg", editable: true,
  },

  // ── Layout — Post ──
  {
    key: "postContentWidth",
    label: "Content width",
    type: "select",
    group: "layout-post",
    options: [
      { value: "narrow", label: "Narrow — optimal reading measure" },
      { value: "medium", label: "Medium" },
      { value: "wide",   label: "Wide" },
    ],
    default: "narrow",  // Narrow is ideal for editorial reading
    editable: true,
    immediatePublish: true,
  },
  {
    key: "postSidebar",
    label: "Sidebar",
    type: "select",
    group: "layout-post",
    options: [
      { value: "none",  label: "None — full-width article" },
      { value: "left",  label: "Left" },
      { value: "right", label: "Right" },
    ],
    default: "none",
    editable: true,
    immediatePublish: true,
  },

  // ── Layout — Page ──
  {
    key: "pageContentWidth",
    label: "Content width",
    type: "select",
    group: "layout-page",
    options: [
      { value: "narrow", label: "Narrow" },
      { value: "medium", label: "Medium" },
      { value: "wide",   label: "Wide" },
    ],
    default: "medium",
    editable: true,
    immediatePublish: true,
  },
  {
    key: "pageSidebar",
    label: "Sidebar",
    type: "select",
    group: "layout-page",
    options: [
      { value: "none",  label: "None" },
      { value: "left",  label: "Left" },
      { value: "right", label: "Right" },
    ],
    default: "none",
    editable: true,
    immediatePublish: true,
  },
];

// ─── Color presets ─────────────────────────────────────────────────────────────

export const COLOR_PRESETS: ColorPreset[] = [
  {
    id: "editorial-warm",
    label: "Warm Ink",
    colors: {
      colorBackground: "#fafaf8",
      colorSurface:    "#f5f0eb",
      colorForeground: "#1c1a17",
      colorMuted:      "#5c564e",
      colorBorder:     "#e4ddd4",
      colorAccent:     "#1e3a5f",
      colorAccentFg:   "#ffffff",
      colorLink:       "#1e3a5f",
    },
  },
  {
    id: "editorial-parchment",
    label: "Parchment",
    colors: {
      colorBackground: "#fdf8f0",
      colorSurface:    "#f7f0e4",
      colorForeground: "#2c2416",
      colorMuted:      "#6b5a42",
      colorBorder:     "#e8d9c0",
      colorAccent:     "#8b3a2a",
      colorAccentFg:   "#ffffff",
      colorLink:       "#8b3a2a",
    },
  },
  {
    id: "editorial-slate",
    label: "Slate & Cream",
    colors: {
      colorBackground: "#f8f8f6",
      colorSurface:    "#f0f0ec",
      colorForeground: "#1a1c1e",
      colorMuted:      "#52565c",
      colorBorder:     "#dcddd8",
      colorAccent:     "#2d6a4f",
      colorAccentFg:   "#ffffff",
      colorLink:       "#2d6a4f",
    },
  },
  {
    id: "editorial-dark",
    label: "Night Edition",
    colors: {
      colorBackground: "#141210",
      colorSurface:    "#1e1c18",
      colorForeground: "#f0ece4",
      colorMuted:      "#9e9688",
      colorBorder:     "#2e2a24",
      colorAccent:     "#c8a96e",
      colorAccentFg:   "#141210",
      colorLink:       "#c8a96e",
    },
  },
];

// ─── Defaults map ──────────────────────────────────────────────────────────────

export const DESIGN_DEFAULTS: Record<string, string> = Object.fromEntries(
  DESIGN_TOKEN_DEFS.map((t) => [t.key, t.default])
);

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds a Google Fonts URL for the editorial theme's three font slots:
 * fontHeading (serif display), fontSans (body), fontMono (code).
 */
export function buildGoogleFontsUrl(config: Record<string, string>): string | null {
  const fontHeading = config.fontHeading ?? DESIGN_DEFAULTS.fontHeading;
  const fontSans    = config.fontSans    ?? DESIGN_DEFAULTS.fontSans;
  const fontMono    = config.fontMono    ?? DESIGN_DEFAULTS.fontMono;

  const families: string[] = [];

  if (SERIF_FONTS.includes(fontHeading) && !SYSTEM_FONTS.includes(fontHeading)) {
    families.push(`family=${encodeURIComponent(fontHeading)}:ital,wght@0,400;0,700;1,400;1,700`);
  }
  if (SANS_FONTS.includes(fontSans) && !SYSTEM_FONTS.includes(fontSans)) {
    families.push(`family=${encodeURIComponent(fontSans)}:wght@400;500;600`);
  }
  if (MONO_FONTS.includes(fontMono) && !SYSTEM_FONTS.includes(fontMono)) {
    families.push(`family=${encodeURIComponent(fontMono)}:wght@400;500`);
  }

  if (families.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
}

/**
 * Builds a :root { … } CSS block from the active design config.
 * Editorial-specific: adds --font-heading output and prose heading override.
 */
export function buildCssString(
  config: Record<string, string>,
  tokenDefs: DesignTokenDef[]
): string {
  const lines: string[] = [];

  for (const def of tokenDefs) {
    if (!def.cssVariable) continue;
    const value = config[def.key] ?? def.default;

    if (def.type === "google-font") {
      const fallback = def.fontList === "mono"
        ? `'Fira Code', monospace`
        : def.fontList === "serif"
        ? `Georgia, 'Times New Roman', serif`
        : `system-ui, -apple-system, sans-serif`;
      lines.push(`  ${def.cssVariable}: '${value}', ${fallback};`);
    } else {
      lines.push(`  ${def.cssVariable}: ${value};`);
    }
  }

  return (
    `:root {\n${lines.join("\n")}\n}\n` +
    // Prose: respect design tokens; headings use the display serif
    `.prose { color: var(--color-foreground); font-size: var(--font-size-base); line-height: 1.8; }\n` +
    `.prose a { color: var(--color-link) !important; }\n` +
    `.prose h1, .prose h2, .prose h3, .prose h4 { font-family: var(--font-heading); color: var(--color-foreground); line-height: 1.25; }\n` +
    // Article headings outside .prose (e.g. PostView/PageView <h1> in <article>)
    `article h1, article h2, article h3, article h4 { font-family: var(--font-heading); }\n` +
    `body { font-family: var(--font-sans); font-size: var(--font-size-base); background-color: var(--color-background); color: var(--color-foreground); }`
  );
}

/** Extract hero config from flat design config keys (for backward compat). */
export function extractHeroConfig(config: Record<string, string>): HeroConfig {
  return {
    enabled: config.heroEnabled === "true",
    height: (config.heroHeight as HeroConfig["height"]) ?? "medium",
    imageUrl: config.heroImageUrl ?? "",
    overlayColor: config.heroOverlayColor ?? "#000000",
    overlayStyle: (config.heroOverlayStyle as HeroConfig["overlayStyle"]) ?? "gradient-up",
    overlayOpacity: Number(config.heroOverlayOpacity ?? "60"),
    showHeadline: config.heroShowHeadline !== "false",
    headline: config.heroHeadline ?? "Welcome",
    showSubheadline: config.heroShowSubheadline !== "false",
    subheadline: config.heroSubheadline ?? "",
    contentAlign: (config.heroContentAlign as "left" | "center") ?? "center",
    contentPosition: (config.heroContentPosition as HeroConfig["contentPosition"]) ?? "bottom",
    cta1Enabled: config.heroCta1Enabled === "true",
    cta1Text: config.heroCta1Text ?? "",
    cta1Url: config.heroCta1Url ?? "/",
    cta1Style: (config.heroCta1Style as "filled" | "outline") ?? "filled",
    cta2Enabled: config.heroCta2Enabled === "true",
    cta2Text: config.heroCta2Text ?? "",
    cta2Url: config.heroCta2Url ?? "",
    cta2Style: (config.heroCta2Style as "filled" | "outline") ?? "outline",
  };
}
