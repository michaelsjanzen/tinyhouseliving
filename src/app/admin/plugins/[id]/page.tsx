import type { Metadata } from "next";

export const metadata: Metadata = { title: "Plugins" };

import { notFound } from "next/navigation";
import { getPlugin, getAllPlugins } from "@/lib/plugin-registry";
import { getConfig, updateConfig } from "@/lib/config";
import { markPluginNotificationsRead } from "@/lib/notifications";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PageShell, Field, SaveButton } from "../../settings/_components";
import type { PluginSettings } from "@/lib/plugin-registry";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PluginAdminPage({ params, searchParams }: Props) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const plugin = getPlugin(id);
  if (!plugin) notFound();

  const config = await getConfig();
  const isActive = config.modules.activePlugins.includes(id);
  if (!isActive) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-zinc-900">{plugin.name}</h1>
        <p className="text-sm text-zinc-500">This plugin is not active. Activate it from the Plugins list to configure it.</p>
      </div>
    );
  }

  // Admin is viewing this plugin's management UI — clear its badge
  await markPluginNotificationsRead(id);

  // If the plugin has a custom admin page, render it
  if (plugin.adminPage) {
    const AdminPageComponent = plugin.adminPage;
    return <AdminPageComponent searchParams={sp} />;
  }

  // Otherwise render the generic settings form
  const saved = (sp.toast as string) === "saved";
  const currentSettings: PluginSettings = config.modules.pluginSettings?.[id] ?? {};
  const allPlugins = getAllPlugins(config.modules.activePlugins, config.modules.pluginSettings ?? {});
  const pluginData = allPlugins.find(p => p.id === id)!;
  const defs = pluginData.settingsDefs;

  async function saveSettings(formData: FormData) {
    "use server";
    const current = await getConfig();
    const newSettings: PluginSettings = {};
    for (const def of defs) {
      if (def.type === "boolean") {
        newSettings[def.key] = formData.getAll(def.key).includes("1");
      } else {
        newSettings[def.key] = (formData.get(def.key) as string) ?? String(def.default);
      }
    }
    await updateConfig({
      ...current,
      modules: {
        ...current.modules,
        pluginSettings: {
          ...(current.modules.pluginSettings ?? {}),
          [id]: newSettings,
        },
      },
    });
    revalidatePath(`/admin/plugins/${id}`);
    redirect(`/admin/plugins/${id}?toast=saved`);
  }

  if (defs.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-zinc-900">{plugin.name}</h1>
        <p className="text-sm text-zinc-500">This plugin has no configurable settings.</p>
      </div>
    );
  }

  return (
    <PageShell title={plugin.name} description={plugin.description ?? ""} saved={saved}>
      <form action={saveSettings}>
        <section className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
          {defs.map(def => (
            def.type === "boolean" ? (
              <div key={def.key} className="flex items-start gap-3">
                <input
                  type="hidden" name={def.key} value="0"
                />
                <input
                  type="checkbox"
                  id={def.key}
                  name={def.key}
                  value="1"
                  defaultChecked={currentSettings[def.key] !== false && currentSettings[def.key] !== "false"}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300"
                />
                <label htmlFor={def.key} className="space-y-0.5">
                  <span className="text-sm font-medium text-zinc-900">{def.label}</span>
                  {def.description && <p className="text-xs text-zinc-500">{def.description}</p>}
                </label>
              </div>
            ) : def.type === "select" ? (
              <div key={def.key} className="space-y-1">
                <label htmlFor={def.key} className="block text-sm font-medium text-zinc-700">{def.label}</label>
                <select
                  id={def.key}
                  name={def.key}
                  defaultValue={String(currentSettings[def.key] ?? def.default)}
                  className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white"
                >
                  {def.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                {def.description && <p className="text-xs text-zinc-500">{def.description}</p>}
              </div>
            ) : (
              <Field
                key={def.key}
                name={def.key}
                label={def.label}
                defaultValue={String(currentSettings[def.key] ?? def.default)}
                hint={def.description}
              />
            )
          ))}
          <SaveButton />
        </section>
      </form>
    </PageShell>
  );
}
