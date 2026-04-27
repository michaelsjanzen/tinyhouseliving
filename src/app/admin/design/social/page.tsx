import type { Metadata } from "next";

export const metadata: Metadata = { title: "Social Links" };

import { getConfig, updateConfig } from "@/lib/config";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PageShell, SaveButton } from "../../settings/_components";
import SocialEditor from "@/components/admin/SocialEditor";

export default async function SocialLinksPage({ searchParams }: { searchParams: Promise<{ toast?: string }> }) {
  const [config, sp] = await Promise.all([getConfig(), searchParams]);
  const saved = sp.toast === "saved";

  async function saveSocial(formData: FormData) {
    "use server";
    const current = await getConfig();
    let socialLinks = current.site.socialLinks;
    try {
      const raw = formData.get("socialLinks") as string | null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          Array.isArray(parsed) &&
          parsed.every(item => typeof item?.platform === "string" && typeof item?.url === "string")
        ) {
          socialLinks = parsed.filter(item => item.url.trim() !== "");
        }
      }
    } catch { /* keep existing */ }

    await updateConfig({
      ...current,
      site: { ...current.site, socialLinks },
    });
    revalidatePath("/admin/design/social");
    redirect("/admin/design/social?toast=saved");
  }

  return (
    <PageShell
      title="Social Links"
      description="Add links to your social profiles. Drag to reorder. Icons are shown automatically based on the platform."
      saved={saved}
    >
      <div className="bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3 text-sm text-zinc-600">
        Control where social icons appear (header, footer, or both) in{" "}
        <a href="/admin/design/header-footer" className="underline hover:text-zinc-900">Design › Header &amp; Footer</a>.
      </div>

      <form action={saveSocial}>
        <section className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
          <SocialEditor initialItems={config.site.socialLinks as { platform: string; url: string }[]} />
          <SaveButton />
        </section>
      </form>
    </PageShell>
  );
}
