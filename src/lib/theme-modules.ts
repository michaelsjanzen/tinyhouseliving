// PUGMILL_THEME_MODULES: Static Theme Module Registry
// ============================================================
// This file provides STATIC imports for all installed theme components.
// It must be kept in sync with theme-registry.ts.
//
// WHY THIS FILE EXISTS:
// Turbopack (Next.js dev compiler) cannot statically analyze dynamic imports
// with template literals (e.g. `import(\`../../themes/${id}/Layout\`)`).
// When such imports are used, Turbopack treats the entire themes/ directory
// as a "context module" and triggers [Fast Refresh] rebuilding on every
// server render — causing an infinite page-reload loop in dev mode.
//
// This registry solves the problem by using static imports that Turbopack
// can analyze at build time, then selects the correct module at runtime.
//
// WHEN ADDING A NEW THEME:
// STEP 1 — Add static imports for all theme module exports below.
// STEP 2 — Add a new entry to THEME_MODULES.
// STEP 3 — Also update theme-registry.ts (THEME_ALLOWLIST + ALL_THEMES).
//
// DO NOT use dynamic import() with template literals — this defeats the
// purpose of this file and will re-introduce the Fast Refresh loop.
// ============================================================

import type React from "react";
import type { DesignTokenDef, ColorPreset } from "@/types/design";
import type { HeaderLayoutDef, HeaderModifiers, FooterLayoutDef } from "@/types/theme";
import type { HomepageSection } from "@/types/homepage-sections";

// ─── Default theme ─────────────────────────────────────────────────────────────

import DefaultLayout from "../../themes/default/Layout";
import DefaultHomeView from "../../themes/default/views/HomeView";
import DefaultPostView from "../../themes/default/views/PostView";
import DefaultPageView from "../../themes/default/views/PageView";
import DefaultSections from "../../themes/default/views/Sections";
import {
  DESIGN_DEFAULTS as DefaultDesignDefaults,
  DESIGN_TOKEN_DEFS as DefaultDesignTokenDefs,
  SANS_FONTS as DefaultSansFonts,
  SERIF_FONTS as DefaultSerifFonts,
  MONO_FONTS as DefaultMonoFonts,
  COLOR_PRESETS as DefaultColorPresets,
  HEADER_LAYOUTS as DefaultHeaderLayouts,
  HEADER_MODIFIERS as DefaultHeaderModifiers,
  FOOTER_LAYOUTS as DefaultFooterLayouts,
  buildCssString as defaultBuildCssString,
  buildGoogleFontsUrl as defaultBuildGoogleFontsUrl,
} from "../../themes/default/design";

// ─── Editorial theme ───────────────────────────────────────────────────────────

import EditorialLayout from "../../themes/editorial/Layout";
import EditorialHomeView from "../../themes/editorial/views/HomeView";
import EditorialPostView from "../../themes/editorial/views/PostView";
import EditorialPageView from "../../themes/editorial/views/PageView";
import EditorialSections from "../../themes/editorial/views/Sections";
import {
  DESIGN_DEFAULTS as EditorialDesignDefaults,
  DESIGN_TOKEN_DEFS as EditorialDesignTokenDefs,
  SANS_FONTS as EditorialSansFonts,
  SERIF_FONTS as EditorialSerifFonts,
  MONO_FONTS as EditorialMonoFonts,
  COLOR_PRESETS as EditorialColorPresets,
  HEADER_LAYOUTS as EditorialHeaderLayouts,
  HEADER_MODIFIERS as EditorialHeaderModifiers,
  FOOTER_LAYOUTS as EditorialFooterLayouts,
  buildCssString as editorialBuildCssString,
  buildGoogleFontsUrl as editorialBuildGoogleFontsUrl,
} from "../../themes/editorial/design";

// ─── Mono theme ────────────────────────────────────────────────────────────────

import MonoLayout from "../../themes/mono/Layout";
import MonoHomeView from "../../themes/mono/views/HomeView";
import MonoPostView from "../../themes/mono/views/PostView";
import MonoPageView from "../../themes/mono/views/PageView";
import MonoSections from "../../themes/mono/views/Sections";
import {
  DESIGN_DEFAULTS as MonoDesignDefaults,
  DESIGN_TOKEN_DEFS as MonoDesignTokenDefs,
  SANS_FONTS as MonoSansFonts,
  SERIF_FONTS as MonoSerifFonts,
  MONO_FONTS as MonoMonoFonts,
  COLOR_PRESETS as MonoColorPresets,
  HEADER_LAYOUTS as MonoHeaderLayouts,
  HEADER_MODIFIERS as MonoHeaderModifiers,
  FOOTER_LAYOUTS as MonoFooterLayouts,
  buildCssString as monoBuildCssString,
  buildGoogleFontsUrl as monoBuildGoogleFontsUrl,
} from "../../themes/mono/design";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ThemeDesignModule {
  DESIGN_DEFAULTS: Record<string, string>;
  DESIGN_TOKEN_DEFS: DesignTokenDef[];
  SANS_FONTS: string[];
  SERIF_FONTS: string[];
  MONO_FONTS: string[];
  COLOR_PRESETS?: ColorPreset[];
  HEADER_LAYOUTS?: HeaderLayoutDef[];
  HEADER_MODIFIERS?: HeaderModifiers;
  FOOTER_LAYOUTS?: FooterLayoutDef[];
  buildCssString: (config: Record<string, string>, defs: DesignTokenDef[]) => string;
  buildGoogleFontsUrl: (config: Record<string, string>) => string | null;
}

export interface ThemeModuleSet {
  Layout: React.ComponentType<{ children: React.ReactNode }>;
  HomeView: React.ComponentType<any>;
  PostView: React.ComponentType<any>;
  PageView: React.ComponentType<any>;
  /** Section renderer entry point. Each theme ships its own implementation. */
  Sections: React.ComponentType<{ sections: HomepageSection[]; page: number }>;
  design: ThemeDesignModule;
}

// ─── Registry ──────────────────────────────────────────────────────────────────

const THEME_MODULES: Record<string, ThemeModuleSet> = {
  default: {
    Layout: DefaultLayout,
    HomeView: DefaultHomeView,
    PostView: DefaultPostView,
    PageView: DefaultPageView,
    Sections: DefaultSections,
    design: {
      DESIGN_DEFAULTS: DefaultDesignDefaults,
      DESIGN_TOKEN_DEFS: DefaultDesignTokenDefs,
      SANS_FONTS: DefaultSansFonts,
      SERIF_FONTS: DefaultSerifFonts,
      MONO_FONTS: DefaultMonoFonts,
      COLOR_PRESETS: DefaultColorPresets,
      HEADER_LAYOUTS: DefaultHeaderLayouts,
      HEADER_MODIFIERS: DefaultHeaderModifiers,
      FOOTER_LAYOUTS: DefaultFooterLayouts,
      buildCssString: defaultBuildCssString,
      buildGoogleFontsUrl: defaultBuildGoogleFontsUrl,
    },
  },
  editorial: {
    Layout: EditorialLayout,
    HomeView: EditorialHomeView,
    PostView: EditorialPostView,
    PageView: EditorialPageView,
    Sections: EditorialSections,
    design: {
      DESIGN_DEFAULTS: EditorialDesignDefaults,
      DESIGN_TOKEN_DEFS: EditorialDesignTokenDefs,
      SANS_FONTS: EditorialSansFonts,
      SERIF_FONTS: EditorialSerifFonts,
      MONO_FONTS: EditorialMonoFonts,
      COLOR_PRESETS: EditorialColorPresets,
      HEADER_LAYOUTS: EditorialHeaderLayouts,
      HEADER_MODIFIERS: EditorialHeaderModifiers,
      FOOTER_LAYOUTS: EditorialFooterLayouts,
      buildCssString: editorialBuildCssString,
      buildGoogleFontsUrl: editorialBuildGoogleFontsUrl,
    },
  },
  mono: {
    Layout: MonoLayout,
    HomeView: MonoHomeView,
    PostView: MonoPostView,
    PageView: MonoPageView,
    Sections: MonoSections,
    design: {
      DESIGN_DEFAULTS: MonoDesignDefaults,
      DESIGN_TOKEN_DEFS: MonoDesignTokenDefs,
      SANS_FONTS: MonoSansFonts,
      SERIF_FONTS: MonoSerifFonts,
      MONO_FONTS: MonoMonoFonts,
      COLOR_PRESETS: MonoColorPresets,
      HEADER_LAYOUTS: MonoHeaderLayouts,
      HEADER_MODIFIERS: MonoHeaderModifiers,
      FOOTER_LAYOUTS: MonoFooterLayouts,
      buildCssString: monoBuildCssString,
      buildGoogleFontsUrl: monoBuildGoogleFontsUrl,
    },
  },
};

const DEFAULT_MODULES = THEME_MODULES.default;

// ─── Validation ────────────────────────────────────────────────────────────────

const REQUIRED_MODULE_KEYS: (keyof ThemeModuleSet)[] = [
  "Layout", "HomeView", "PostView", "PageView", "Sections", "design",
];
const REQUIRED_DESIGN_KEYS: (keyof ThemeDesignModule)[] = [
  "DESIGN_DEFAULTS", "DESIGN_TOKEN_DEFS", "SANS_FONTS", "SERIF_FONTS",
  "MONO_FONTS", "buildCssString", "buildGoogleFontsUrl",
];

/**
 * Validate that every allowlisted theme has a complete module registry entry.
 * Returns a list of error strings. An empty array means all themes are valid.
 * Called from validateSystem() on cold start.
 */
export function validateThemeModules(allowlist: readonly string[]): string[] {
  const errors: string[] = [];

  for (const themeId of allowlist) {
    const modules = THEME_MODULES[themeId];
    if (!modules) {
      errors.push(
        `Theme "${themeId}" is in THEME_ALLOWLIST but has no entry in THEME_MODULES ` +
        `(src/lib/theme-modules.ts).`
      );
      continue;
    }
    for (const key of REQUIRED_MODULE_KEYS) {
      if (modules[key] == null) {
        errors.push(`Theme "${themeId}" is missing required module: ${key}.`);
      }
    }
    if (modules.design) {
      for (const key of REQUIRED_DESIGN_KEYS) {
        if (modules.design[key] == null) {
          errors.push(`Theme "${themeId}" design module is missing required export: ${key}.`);
        }
      }
    }
  }

  return errors;
}

// ─── Accessors ─────────────────────────────────────────────────────────────────

export function getThemeLayout(themeId: string): ThemeModuleSet["Layout"] {
  return THEME_MODULES[themeId]?.Layout ?? DEFAULT_MODULES.Layout;
}

export function getThemeHomeView(themeId: string): ThemeModuleSet["HomeView"] {
  return THEME_MODULES[themeId]?.HomeView ?? DEFAULT_MODULES.HomeView;
}

export function getThemePostView(themeId: string): ThemeModuleSet["PostView"] {
  return THEME_MODULES[themeId]?.PostView ?? DEFAULT_MODULES.PostView;
}

export function getThemePageView(themeId: string): ThemeModuleSet["PageView"] {
  return THEME_MODULES[themeId]?.PageView ?? DEFAULT_MODULES.PageView;
}

/**
 * Returns the active theme's section renderer component.
 * Used by src/app/(site)/page.tsx to render the homepage section stack
 * through the correct theme's visual language.
 */
export function getThemeSections(themeId: string): ThemeModuleSet["Sections"] {
  return THEME_MODULES[themeId]?.Sections ?? DEFAULT_MODULES.Sections;
}

export function getThemeDesign(themeId: string): ThemeDesignModule {
  return THEME_MODULES[themeId]?.design ?? DEFAULT_MODULES.design;
}
