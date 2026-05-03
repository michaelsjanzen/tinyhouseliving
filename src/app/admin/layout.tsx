// All admin routes are authenticated and DB-driven — never prerender statically.
export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/get-current-user";
import { getConfig } from "@/lib/config";
import { getAllPlugins } from "@/lib/plugin-registry";
import { getAllThemes } from "@/lib/theme-registry";
import { getUnreadCountsByPlugin } from "@/lib/notifications";
import { loadPlugins } from "@/lib/plugin-loader";
import AdminShell from "@/components/admin/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  // The auth proxy (src/proxy.ts) handles the redirect for all non-login
  // admin routes. This fallback covers the login page itself (no AdminShell
  // needed) and provides defence-in-depth if the proxy is bypassed.
  if (!user) {
    return <>{children}</>;
  }

  const [config, badges] = await Promise.all([
    getConfig(),
    getUnreadCountsByPlugin().catch(() => ({} as Record<string, number>)),
    loadPlugins(),
  ]);

  const activePlugins = getAllPlugins(
    config.modules.activePlugins,
    config.modules.pluginSettings ?? {}
  ).filter(p => p.isActive);

  const themes = getAllThemes(config.appearance.activeTheme);

  return (
    <AdminShell
      user={{ username: user.name || user.email || "Account", role: user.role }}
      siteName={config.site?.name?.trim() || "Pugmill"}
      plugins={activePlugins.map(p => ({ id: p.id, name: p.name, actionHref: p.actionHref }))}
      themes={themes.map(t => ({ id: t.id, name: t.name, isActive: t.isActive }))}
      badges={badges}
      announcement={config.site.adminAnnouncement || undefined}
    >
      {children}
    </AdminShell>
  );
}
