// PUGMILL_DESIGN_REGISTRY — Mono Theme
// ============================================================
// Stripped-back developer design system. Inspired by terminal UIs,
// Warp, Linear dark mode, and serious developer blogs.
//
// Rules: monospace throughout, near-black background, one vivid accent.
// No rounded corners. No shadows. No card chrome.
// Every element earns its place.
// ============================================================

import type { DesignTokenDef, ColorPreset } from "../../src/types/design";
import type { WidgetAreaDef } from "../../src/types/widget";
import type { HeaderLayoutDef, HeaderModifiers, FooterLayoutDef } from "../../src/types/theme";

// ─── Layout config types ───────────────────────────────────────────────────────

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
  { id: "minimal",  label: "Minimal",  description: "Logo only, hamburger always" },
];

export const HEADER_MODIFIERS: HeaderModifiers = {
  supportsSticky: true,
  supportsBackgroundStyles: ["solid"],  // Mono has no glass/blur effect
  supportsCompactHeight: true,
  supportsLogo: false,  // Mono renders the site name as text only
};

export const FOOTER_LAYOUTS: FooterLayoutDef[] = [
  { id: "simple",   label: "Simple",   description: "Nav row + copyright left, social right" },
  { id: "minimal",  label: "Minimal",  description: "Copyright line only" },
];

// ─── Font allowlists ───────────────────────────────────────────────────────────

/** Mono theme uses no display serif fonts. */
export const SERIF_FONTS: string[] = [];

/** Mono theme body font is actually monospace — listed here for the admin dropdown. */
export const SANS_FONTS: string[] = [
  "JetBrains Mono",
  "Fira Code",
  "IBM Plex Mono",
  "Source Code Pro",
  "Geist Mono",
];

export const MONO_FONTS: string[] = [
  "JetBrains Mono",
  "Fira Code",
  "IBM Plex Mono",
  "Source Code Pro",
  "Geist Mono",
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
    description: "Near-black canvas.",
    type: "color",
    group: "colors",
    cssVariable: "--color-background",
    default: "#0d0d0d",
    editable: true,
    order: 1,
  },
  {
    key: "colorSurface",
    label: "Surface",
    description: "Slightly elevated panels — code blocks, aside content.",
    type: "color",
    group: "colors",
    cssVariable: "--color-surface",
    default: "#161616",
    editable: true,
    order: 2,
  },
  {
    key: "colorForeground",
    label: "Foreground",
    description: "Primary text. Warm off-white — less harsh than pure white.",
    type: "color",
    group: "colors",
    cssVariable: "--color-foreground",
    default: "#e8e6e1",
    editable: true,
    order: 3,
  },
  {
    key: "colorMuted",
    label: "Muted",
    description: "Secondary text: dates, metadata, comments.",
    type: "color",
    group: "colors",
    cssVariable: "--color-muted",
    default: "#888480",
    editable: true,
    order: 4,
  },
  {
    key: "colorBorder",
    label: "Border",
    description: "Structural lines — subtle against the dark background.",
    type: "color",
    group: "colors",
    cssVariable: "--color-border",
    default: "#252320",
    editable: true,
    order: 5,
  },
  {
    key: "colorAccent",
    label: "Accent",
    description: "The single vivid color that defines the personality. Amber by default.",
    type: "color",
    group: "colors",
    cssVariable: "--color-accent",
    default: "#f59e0b",
    editable: true,
    order: 6,
  },
  {
    key: "colorAccentFg",
    label: "Accent foreground",
    description: "Text on accent backgrounds.",
    type: "color",
    group: "colors",
    cssVariable: "--color-accent-fg",
    default: "#0d0d0d",
    editable: true,
    order: 7,
  },
  {
    key: "colorLink",
    label: "Link",
    description: "Hyperlink color. Matches accent by default.",
    type: "color",
    group: "colors",
    cssVariable: "--color-link",
    default: "#f59e0b",
    editable: true,
    order: 8,
  },

  // ── Typography ──
  {
    key: "fontSans",
    label: "Primary font",
    description: "All text — body, headings, UI. Mono theme uses monospace throughout.",
    type: "google-font",
    fontList: "sans",  // Mono SANS_FONTS list contains monospace fonts
    group: "typography",
    cssVariable: "--font-sans",
    default: "JetBrains Mono",
    editable: true,
    order: 1,
  },
  {
    key: "fontMono",
    label: "Code font",
    description: "Code blocks — same as primary by default.",
    type: "google-font",
    fontList: "mono",
    group: "typography",
    cssVariable: "--font-mono",
    default: "JetBrains Mono",
    editable: true,
    order: 2,
  },
  {
    key: "baseFontSize",
    label: "Base font size",
    description: "Monospace reads smaller — 15px is the comfortable default.",
    type: "select",
    group: "typography",
    cssVariable: "--font-size-base",
    options: [
      { value: "0.875rem", label: "Compact (14px)" },
      { value: "0.9375rem", label: "Normal (15px)" },
      { value: "1rem",     label: "Large (16px)" },
      { value: "1.0625rem", label: "Extra Large (17px)" },
    ],
    default: "0.9375rem",
    editable: true,
    order: 3,
  },

  // ── Layout — Home ──
  {
    key: "homeFeedStyle",    label: "Feed style",    type: "select", group: "layout-home",
    options: [{ value: "list", label: "List" }, { value: "grid", label: "Grid" }],
    default: "list", editable: true,
  },
  {
    key: "homeListStyle",    label: "List style",    type: "select", group: "layout-home",
    options: [
      { value: "compact",   label: "Compact" },
      { value: "editorial", label: "Editorial" },
      { value: "feature",   label: "Feature" },
      { value: "text-only", label: "Text only" },
    ],
    default: "text-only",  // Mono is text-first
    editable: true,
  },
  {
    key: "homeColumns",      label: "Grid columns",  type: "select", group: "layout-home",
    options: [{ value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }],
    default: "1", editable: true,
  },
  {
    key: "homeContentDisplay", label: "Content",     type: "select", group: "layout-home",
    options: [{ value: "excerpt", label: "Excerpt" }, { value: "none", label: "None" }],
    default: "none",  // Mono is title-first
    editable: true,
  },
  {
    key: "homeGap",          label: "Gap",           type: "select", group: "layout-home",
    options: [{ value: "sm", label: "Small" }, { value: "md", label: "Medium" }, { value: "lg", label: "Large" }],
    default: "sm", editable: true,
  },

  // ── Layout — Blog ──
  {
    key: "blogFeedStyle",    label: "Feed style",    type: "select", group: "layout-blog",
    options: [{ value: "list", label: "List" }, { value: "grid", label: "Grid" }],
    default: "list", editable: true,
  },
  {
    key: "blogListStyle",    label: "List style",    type: "select", group: "layout-blog",
    options: [
      { value: "compact", label: "Compact" }, { value: "editorial", label: "Editorial" },
      { value: "feature", label: "Feature" }, { value: "text-only", label: "Text only" },
    ],
    default: "text-only", editable: true,
  },
  {
    key: "blogColumns",      label: "Grid columns",  type: "select", group: "layout-blog",
    options: [{ value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }],
    default: "1", editable: true,
  },
  {
    key: "blogContentDisplay", label: "Content",     type: "select", group: "layout-blog",
    options: [{ value: "excerpt", label: "Excerpt" }, { value: "none", label: "None" }],
    default: "none", editable: true,
  },
  {
    key: "blogGap",          label: "Gap",           type: "select", group: "layout-blog",
    options: [{ value: "sm", label: "Small" }, { value: "md", label: "Medium" }, { value: "lg", label: "Large" }],
    default: "sm", editable: true,
  },

  // ── Layout — Post ──
  {
    key: "postContentWidth", label: "Content width", type: "select", group: "layout-post",
    options: [
      { value: "narrow", label: "Narrow — tight reading column" },
      { value: "medium", label: "Medium" },
      { value: "wide",   label: "Wide — code-heavy posts" },
    ],
    default: "medium",
    editable: true,
    immediatePublish: true,
  },
  {
    key: "postSidebar",      label: "Sidebar",       type: "select", group: "layout-post",
    options: [
      { value: "none",  label: "None" },
      { value: "left",  label: "Left" },
      { value: "right", label: "Right" },
    ],
    default: "none",
    editable: true,
    immediatePublish: true,
  },

  // ── Layout — Page ──
  {
    key: "pageContentWidth", label: "Content width", type: "select", group: "layout-page",
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
    key: "pageSidebar",      label: "Sidebar",       type: "select", group: "layout-page",
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
    id: "mono-amber",
    label: "Amber",
    colors: {
      colorBackground: "#0d0d0d",
      colorSurface:    "#161616",
      colorForeground: "#e8e6e1",
      colorMuted:      "#888480",
      colorBorder:     "#252320",
      colorAccent:     "#f59e0b",
      colorAccentFg:   "#0d0d0d",
      colorLink:       "#f59e0b",
    },
  },
  {
    id: "mono-green",
    label: "Green",
    colors: {
      colorBackground: "#0a0d0a",
      colorSurface:    "#121512",
      colorForeground: "#e2ede2",
      colorMuted:      "#7a8a7a",
      colorBorder:     "#1e261e",
      colorAccent:     "#22c55e",
      colorAccentFg:   "#0a0d0a",
      colorLink:       "#22c55e",
    },
  },
  {
    id: "mono-cyan",
    label: "Cyan",
    colors: {
      colorBackground: "#090d0f",
      colorSurface:    "#111619",
      colorForeground: "#dceef5",
      colorMuted:      "#6a8a96",
      colorBorder:     "#1a2428",
      colorAccent:     "#06b6d4",
      colorAccentFg:   "#090d0f",
      colorLink:       "#06b6d4",
    },
  },
  {
    id: "mono-light",
    label: "Light (inverted)",
    colors: {
      colorBackground: "#f8f8f6",
      colorSurface:    "#eeeeec",
      colorForeground: "#1a1a18",
      colorMuted:      "#666662",
      colorBorder:     "#d8d8d4",
      colorAccent:     "#d97706",
      colorAccentFg:   "#ffffff",
      colorLink:       "#d97706",
    },
  },
];

// ─── Defaults map ──────────────────────────────────────────────────────────────

export const DESIGN_DEFAULTS: Record<string, string> = Object.fromEntries(
  DESIGN_TOKEN_DEFS.map((t) => [t.key, t.default])
);

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Mono uses the same font for both fontSans and fontMono slots.
 * Both are listed in the MONO_FONTS allowlist.
 */
export function buildGoogleFontsUrl(config: Record<string, string>): string | null {
  const fontSans = config.fontSans ?? DESIGN_DEFAULTS.fontSans;
  const fontMono = config.fontMono ?? DESIGN_DEFAULTS.fontMono;

  const families: string[] = [];
  const added = new Set<string>();

  for (const font of [fontSans, fontMono]) {
    if (added.has(font)) continue;
    added.add(font);
    if ((SANS_FONTS.includes(font) || MONO_FONTS.includes(font)) && !SYSTEM_FONTS.includes(font)) {
      families.push(`family=${encodeURIComponent(font)}:wght@400;500;700`);
    }
  }

  if (families.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
}

/**
 * Mono-specific CSS: no rounded corners in prose, code blocks use the same
 * font as body, and the accent color drives all interactive states.
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
      lines.push(`  ${def.cssVariable}: '${value}', monospace;`);
    } else {
      lines.push(`  ${def.cssVariable}: ${value};`);
    }
  }

  return (
    `:root {\n${lines.join("\n")}\n}\n` +
    `.prose { color: var(--color-foreground); font-size: var(--font-size-base); font-family: var(--font-sans); line-height: 1.65; }\n` +
    `.prose a { color: var(--color-link) !important; text-decoration: underline; }\n` +
    `.prose h1, .prose h2, .prose h3, .prose h4 { color: var(--color-foreground); font-family: var(--font-sans); letter-spacing: -0.01em; }\n` +
    `.prose code, .prose pre { font-family: var(--font-mono); }\n` +
    `.prose pre { background-color: var(--color-surface) !important; border: 1px solid var(--color-border); border-radius: 0; }\n` +
    `body { font-family: var(--font-sans); font-size: var(--font-size-base); background-color: var(--color-background); color: var(--color-foreground); }`
  );
}

/** Extract hero config from flat keys (for backward compat). */
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
