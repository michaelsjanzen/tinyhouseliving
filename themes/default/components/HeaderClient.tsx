"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { SOCIAL_PLATFORM_MAP } from "../../../src/lib/social-platforms";

interface NavItem { label: string; path: string }
interface SocialItem { platform: string; url: string }
type HeaderIdentity = "logo-only" | "name-only" | "logo-and-name";

interface Props {
  siteName: string;
  logoUrl: string | null;
  headerIdentity: HeaderIdentity;
  navItems: NavItem[];
  socialLinks: SocialItem[];
  headerLayout: string;
  headerSticky: boolean;
  headerBackground: string;
  headerCompact: boolean;
  socialInHeader: boolean;
}

function isActive(itemPath: string, pathname: string): boolean {
  if (itemPath === "/") return pathname === "/";
  return pathname === itemPath || pathname.startsWith(itemPath + "/");
}

function SocialIcons({ links, className = "" }: { links: SocialItem[]; className?: string }) {
  if (!links.length) return null;
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {links.map((item, i) => {
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
  );
}

function HamburgerButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-2 rounded-md text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface)] transition"
      aria-label={open ? "Close menu" : "Open menu"}
    >
      {open ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      )}
    </button>
  );
}

function MobileDropdown({ navItems, socialLinks, socialInHeader, onClose }: {
  navItems: NavItem[];
  socialLinks: SocialItem[];
  socialInHeader: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-background)]/95 backdrop-blur-md">
      <nav className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
        {navItems.map(item => (
          <Link
            key={item.path}
            href={item.path}
            onClick={onClose}
            className={`px-3 py-2.5 rounded-md text-sm transition ${
              isActive(item.path, pathname)
                ? "bg-[var(--color-surface)] text-[var(--color-foreground)] font-medium"
                : "text-[var(--color-foreground)] hover:bg-[var(--color-surface)]"
            }`}
          >
            {item.label}
          </Link>
        ))}
        {socialInHeader && socialLinks.length > 0 && (
          <div className="px-3 pt-3 pb-1">
            <SocialIcons links={socialLinks} />
          </div>
        )}
      </nav>
    </div>
  );
}

function LogoBlock({ logoUrl, siteName, headerIdentity }: {
  logoUrl: string | null;
  siteName: string;
  headerIdentity: HeaderIdentity;
}) {
  const showLogo = logoUrl && headerIdentity !== "name-only";
  const showName = headerIdentity === "name-only" || headerIdentity === "logo-and-name" || !logoUrl;
  return (
    <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition shrink-0">
      {showLogo && (
        <Image src={logoUrl!} alt={siteName} height={32} width={200} className="h-8 w-auto object-contain" />
      )}
      {showName && (
        <span className="text-lg font-bold tracking-tight text-[var(--color-foreground)]">{siteName}</span>
      )}
    </Link>
  );
}

export default function HeaderClient({
  siteName, logoUrl, headerIdentity, navItems, socialLinks,
  headerLayout, headerSticky, headerBackground, headerCompact, socialInHeader,
}: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const height = headerCompact ? "h-12" : "h-16";

  const bgClass = headerBackground === "solid"
    ? "bg-[var(--color-background)] border-b border-[var(--color-border)]"
    : "backdrop-blur-md bg-[var(--color-background)]/80 border-b border-[var(--color-border)]";

  const stickyClass = headerSticky ? "sticky top-0 z-50" : "relative z-40";

  // ── Centered layout ─────────────────────────────────────────────────────────
  if (headerLayout === "centered") {
    return (
      <header className={`${stickyClass} ${bgClass}`}>
        {/* Top row: logo centered, hamburger right on mobile */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`flex items-center justify-center ${height} relative`}>
            <LogoBlock logoUrl={logoUrl} siteName={siteName} headerIdentity={headerIdentity} />
            <div className="absolute right-0 md:hidden">
              <HamburgerButton open={open} onClick={() => setOpen(v => !v)} />
            </div>
          </div>
          {/* Nav row below logo — desktop only */}
          {navItems.length > 0 && (
            <nav className="hidden md:flex items-center justify-center gap-6 pb-3">
              {navItems.map(item => (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`text-sm transition ${
                    isActive(item.path, pathname)
                      ? "text-[var(--color-foreground)] font-medium"
                      : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              {socialInHeader && <SocialIcons links={socialLinks} className="ml-2" />}
            </nav>
          )}
        </div>
        {open && (
          <MobileDropdown
            navItems={navItems}
            socialLinks={socialLinks}
            socialInHeader={socialInHeader}
            onClose={() => setOpen(false)}
          />
        )}
      </header>
    );
  }

  // ── Minimal layout ──────────────────────────────────────────────────────────
  if (headerLayout === "minimal") {
    return (
      <header className={`${stickyClass} ${bgClass}`}>
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${height} flex items-center justify-between`}>
          <LogoBlock logoUrl={logoUrl} siteName={siteName} headerIdentity={headerIdentity} />
          <HamburgerButton open={open} onClick={() => setOpen(v => !v)} />
        </div>
        {open && (
          <MobileDropdown
            navItems={navItems}
            socialLinks={socialLinks}
            socialInHeader={socialInHeader}
            onClose={() => setOpen(false)}
          />
        )}
      </header>
    );
  }

  // ── Standard layout (default, split, cta all use this base) ─────────────────
  return (
    <header className={`${stickyClass} ${bgClass}`}>
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${height} flex items-center justify-between`}>
        <LogoBlock logoUrl={logoUrl} siteName={siteName} headerIdentity={headerIdentity} />

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map(item => (
            <Link
              key={item.path}
              href={item.path}
              className={`text-sm transition ${
                isActive(item.path, pathname)
                  ? "text-[var(--color-foreground)] font-medium"
                  : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {item.label}
            </Link>
          ))}
          {socialInHeader && <SocialIcons links={socialLinks} className="ml-2" />}
        </nav>

        {/* Mobile hamburger */}
        <div className="md:hidden">
          <HamburgerButton open={open} onClick={() => setOpen(v => !v)} />
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <MobileDropdown
          navItems={navItems}
          socialLinks={socialLinks}
          socialInHeader={socialInHeader}
          onClose={() => setOpen(false)}
        />
      )}
    </header>
  );
}
