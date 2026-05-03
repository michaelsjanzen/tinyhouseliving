import type { Metadata } from "next";

export const metadata: Metadata = { title: "Plugins" };

import { getConfig } from "@/lib/config";
import { getAllPlugins } from "@/lib/plugin-registry";
import PluginCard from "./PluginCard";

export default async function PluginsPage() {
  const config = await getConfig();
  const plugins = getAllPlugins(
    config.modules.activePlugins,
    config.modules.pluginSettings ?? {}
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Plugins</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Toggle plugins on or off and configure their settings. To fully remove a plugin, purge its data here then delete the plugin directory and its import from plugin-registry.ts.
        </p>
      </div>

      {plugins.length === 0 ? (
        <p className="text-zinc-500">No plugins registered.</p>
      ) : (
        <div className="space-y-3">
          {plugins.map(plugin => (
            <PluginCard key={plugin.id} {...plugin} />
          ))}
        </div>
      )}
    </div>
  );
}
