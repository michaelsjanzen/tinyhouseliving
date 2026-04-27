// Phase 1: Editorial header delegates to the shared HeaderClient.
// TODO Phase 2: Replace with a custom implementation that uses editorial's
// HEADER_LAYOUTS (standard, centered, minimal) and its own visual treatment.

import { getConfig } from "../../../src/lib/config";
import { sanitizeThemeName } from "../../../src/lib/theme-registry";
import { getDesignConfig } from "../../../src/lib/design-config";
import { hooks } from "../../../src/lib/hooks";
import { cookies } from "next/headers";
import HeaderClient from "../../default/components/HeaderClient";

export default async function Header() {
  const config = await getConfig();
  const themeId = sanitizeThemeName(config.appearance.activeTheme);

  const cookieStore = await cookies();
  const isPreview = cookieStore.get("__pugmill_design_preview")?.value === "1";
  const designConfig = await getDesignConfig(themeId, isPreview ? "draft" : "published");

  const rawNav = (config.appearance.navigation as { label: string; path: string }[]) ?? [];
  const navItems = await hooks.applyFilters("nav:items", { input: rawNav });
  const socialLinks = (config.site.socialLinks ?? []) as { platform: string; url: string }[];

  return (
    <HeaderClient
      siteName={config.site.name}
      logoUrl={config.site.logo ?? null}
      headerIdentity={config.site.headerIdentity ?? "logo-only"}
      navItems={navItems}
      socialLinks={socialLinks}
      headerLayout={designConfig.headerLayout ?? "standard"}
      headerSticky={designConfig.headerSticky !== "false"}
      headerBackground={designConfig.headerBackground ?? "glass"}
      headerCompact={designConfig.headerCompact === "true"}
      socialInHeader={designConfig.socialInHeader === "true"}
    />
  );
}
