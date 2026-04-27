/**
 * Design config reader.
 * Uses React's cache() for per-request deduplication — multiple calls with the
 * same arguments within one render pass share a single DB fetch, but the cache
 * is discarded at the end of the request so stale data can never bleed across
 * page renders or server actions.
 */
import { cache } from "react";
import { db } from "@/lib/db";
import { themeDesignConfigs } from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { getThemeDesign } from "./theme-modules";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadThemeDefaults(themeId: string): Record<string, string> {
  return getThemeDesign(themeId).DESIGN_DEFAULTS;
}

/**
 * Returns the active theme's design token definitions and font allowlists
 * needed to render the Design admin UI.
 * Falls back to the default theme if the themeId is not registered.
 */
export function loadThemeDesignDefs(themeId: string): {
  DESIGN_TOKEN_DEFS: import("@/types/design").DesignTokenDef[];
  DESIGN_DEFAULTS: Record<string, string>;
  SANS_FONTS: string[];
  MONO_FONTS: string[];
  COLOR_PRESETS: import("@/types/design").ColorPreset[];
  HEADER_LAYOUTS: import("@/types/theme").HeaderLayoutDef[];
  HEADER_MODIFIERS: import("@/types/theme").HeaderModifiers | null;
  FOOTER_LAYOUTS: import("@/types/theme").FooterLayoutDef[];
} {
  const design = getThemeDesign(themeId);
  return {
    DESIGN_TOKEN_DEFS: design.DESIGN_TOKEN_DEFS,
    DESIGN_DEFAULTS: design.DESIGN_DEFAULTS,
    SANS_FONTS: design.SANS_FONTS,
    MONO_FONTS: design.MONO_FONTS,
    COLOR_PRESETS: design.COLOR_PRESETS ?? [],
    HEADER_LAYOUTS: design.HEADER_LAYOUTS ?? [],
    HEADER_MODIFIERS: design.HEADER_MODIFIERS ?? null,
    FOOTER_LAYOUTS: design.FOOTER_LAYOUTS ?? [],
  };
}

async function fetchRow(
  themeId: string,
  status: "published" | "draft"
): Promise<Record<string, string> | null> {
  try {
    const rows = await db
      .select()
      .from(themeDesignConfigs)
      .where(and(eq(themeDesignConfigs.themeId, themeId), eq(themeDesignConfigs.status, status)))
      .orderBy(desc(themeDesignConfigs.createdAt))
      .limit(1);

    if (rows.length === 0) return null;
    return rows[0].config as Record<string, string>;
  } catch (err) {
    console.error("[design-config] fetchRow failed:", err);
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the merged design config for a theme+mode.
 *
 * For `published` mode: theme defaults → published overrides (if any).
 * For `draft` mode:     theme defaults → published overrides → draft overrides (if any).
 *
 * Wrapped in React's cache() so repeated calls within the same server render
 * (e.g. ThemeLayout + HomePage both calling this) only hit the DB once.
 * The cache is request-scoped and never persists between requests.
 */
export const getDesignConfig = cache(async (
  themeId: string,
  mode: "published" | "draft" = "published"
): Promise<Record<string, string>> => {
  const defaults = loadThemeDefaults(themeId);

  const publishedOverrides = await fetchRow(themeId, "published");
  const merged: Record<string, string> = { ...defaults, ...(publishedOverrides ?? {}) };

  if (mode === "draft") {
    const draftOverrides = await fetchRow(themeId, "draft");
    if (draftOverrides) {
      Object.assign(merged, draftOverrides);
    }
  }

  return merged;
});

/**
 * No-op kept for call-site compatibility.
 * React's cache() is request-scoped and expires automatically — there is
 * nothing to invalidate between requests.
 */
export function invalidateDesignCache(_themeId: string): void {
  // intentional no-op
}

/**
 * Returns true if a draft config row exists for this themeId.
 */
export async function hasDraftConfig(themeId: string): Promise<boolean> {
  try {
    const rows = await db
      .select({ id: themeDesignConfigs.id })
      .from(themeDesignConfigs)
      .where(and(eq(themeDesignConfigs.themeId, themeId), eq(themeDesignConfigs.status, "draft")))
      .limit(1);
    return rows.length > 0;
  } catch (err) {
    console.error("[design-config] hasDraftConfig failed:", err);
    return false;
  }
}
