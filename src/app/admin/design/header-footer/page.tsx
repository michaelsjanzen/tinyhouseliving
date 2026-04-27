import type { Metadata } from "next";
export const metadata: Metadata = { title: "Header & Footer — Design" };
export const dynamic = "force-dynamic";

import Link from "next/link";
import { DraftBanner, PublishActions } from "../DraftControls";
import { DesignSaveProvider } from "../DesignSaveContext";
import { loadDesignData } from "../_loadDesignData";
import { savePartialDesignDraft } from "@/lib/actions/design";
import HeaderFooterClient from "./HeaderFooterClient";

export default async function HeaderFooterPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ draftConfig, hasDraft, HEADER_LAYOUTS, HEADER_MODIFIERS, FOOTER_LAYOUTS }, sp] =
    await Promise.all([loadDesignData(), searchParams]);

  const tab = sp.tab === "footer" ? "footer" : "header";

  return (
    <DesignSaveProvider>
      <div
        className={`-mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 pt-4 sm:pt-6 pb-8 space-y-6 transition-colors duration-500 ${
          hasDraft ? "bg-amber-50" : "bg-zinc-50"
        }`}
      >
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Header &amp; Footer</h2>
            <p className="text-sm text-zinc-500 mt-1">
              Layout and display options for the site header and footer.
            </p>
          </div>
          <PublishActions hasDraft={hasDraft} />
        </div>

        <DraftBanner hasDraft={hasDraft} />

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-200">
          {(["header", "footer"] as const).map(t => (
            <Link
              key={t}
              href={`/admin/design/header-footer${t === "footer" ? "?tab=footer" : ""}`}
              className={`px-4 py-2 text-sm font-medium capitalize rounded-t-lg transition-colors ${
                tab === t
                  ? "bg-white border border-b-white border-zinc-200 text-zinc-900 -mb-px"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {t}
            </Link>
          ))}
        </div>

        {/* Tab content */}
        <HeaderFooterClient
          tab={tab}
          headerLayouts={HEADER_LAYOUTS}
          headerModifiers={HEADER_MODIFIERS}
          footerLayouts={FOOTER_LAYOUTS}
          savedConfig={draftConfig}
          saveAction={savePartialDesignDraft}
        />

        <div className="flex justify-start">
          <PublishActions hasDraft={hasDraft} />
        </div>
      </div>
    </DesignSaveProvider>
  );
}
