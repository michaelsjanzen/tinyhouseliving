import { getConfig } from "../../../src/lib/config";
import { sanitizeThemeName } from "../../../src/lib/theme-registry";
import { getDesignConfig } from "../../../src/lib/design-config";
import { SOCIAL_PLATFORM_MAP } from "../../../src/lib/social-platforms";
import { cookies } from "next/headers";
import Link from "next/link";

export default async function Footer() {
  const config = await getConfig();
  const themeId = sanitizeThemeName(config.appearance.activeTheme);

  const cookieStore = await cookies();
  const isPreview = cookieStore.get("__pugmill_design_preview")?.value === "1";
  const designConfig = await getDesignConfig(themeId, isPreview ? "draft" : "published");

  const socialLinks = (config.site.socialLinks ?? []) as { platform: string; url: string }[];
  const footerNav = (config.appearance.footerNavigation ?? []) as { label: string; path: string }[];

  const footerLayout = designConfig.footerLayout ?? "simple";
  const socialInFooter = designConfig.socialInFooter !== "false";
  const showPoweredBy = designConfig.footerShowPoweredBy !== "false" && config.site.showPoweredBy !== false;
  const customCopyright = designConfig.footerCopyright?.trim() || null;

  const year = new Date().getFullYear();
  const copyrightText = customCopyright ?? `© ${year} ${config.site.name}.`;
  const visibleSocial = socialInFooter ? socialLinks : [];

  const socialEl = visibleSocial.length > 0 ? (
    <div className="flex items-center gap-4">
      {visibleSocial.map((item, i) => {
        const platform = SOCIAL_PLATFORM_MAP.get(item.platform);
        return (
          <Link
            key={i}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={platform?.label ?? item.platform}
            className="text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition"
          >
            {platform?.icon ?? <span className="text-xs capitalize">{item.platform}</span>}
          </Link>
        );
      })}
    </div>
  ) : null;

  const poweredByEl = showPoweredBy ? (
    <> · <a href="https://pugmillcms.com" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-foreground)] transition-colors">Made with Pugmill</a></>
  ) : null;

  // ── Minimal ──────────────────────────────────────────────────────────────────
  if (footerLayout === "minimal") {
    return (
      <footer className="border-t border-[var(--color-border)] mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-sm text-[var(--color-muted)] text-center">
            {copyrightText}{poweredByEl}
          </p>
        </div>
      </footer>
    );
  }

  // ── Centered ─────────────────────────────────────────────────────────────────
  if (footerLayout === "centered") {
    return (
      <footer className="border-t border-[var(--color-border)] mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col items-center gap-4 text-center">
          {footerNav.length > 0 && (
            <nav className="flex flex-wrap justify-center gap-x-5 gap-y-1">
              {footerNav.map(item => (
                <Link
                  key={item.path}
                  href={item.path}
                  className="text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
          {socialEl}
          <p className="text-sm text-[var(--color-muted)]">
            {copyrightText}{poweredByEl}
          </p>
        </div>
      </footer>
    );
  }

  // ── Columns ──────────────────────────────────────────────────────────────────
  if (footerLayout === "columns") {
    return (
      <footer className="border-t border-[var(--color-border)] mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[var(--color-foreground)]">{config.site.name}</p>
              <p className="text-sm text-[var(--color-muted)]">
                {copyrightText}{poweredByEl}
              </p>
            </div>
            <div className="flex flex-col sm:items-end gap-3">
              {footerNav.length > 0 && (
                <nav className="flex flex-wrap gap-x-5 gap-y-1">
                  {footerNav.map(item => (
                    <Link
                      key={item.path}
                      href={item.path}
                      className="text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors"
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
              )}
              {socialEl}
            </div>
          </div>
        </div>
      </footer>
    );
  }

  // ── Simple (default) ─────────────────────────────────────────────────────────
  return (
    <footer className="border-t border-[var(--color-border)] mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {footerNav.length > 0 && (
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {footerNav.map(item => (
              <Link
                key={item.path}
                href={item.path}
                className="text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-[var(--color-muted)]">
            {copyrightText}{poweredByEl}
          </p>
          {socialEl}
        </div>
      </div>
    </footer>
  );
}
