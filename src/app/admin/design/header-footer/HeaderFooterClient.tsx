"use client";

import { useTransition, useState, useCallback, useRef } from "react";
import type { HeaderLayoutDef, HeaderModifiers, FooterLayoutDef } from "@/types/theme";

interface Props {
  tab: "header" | "footer";
  headerLayouts: HeaderLayoutDef[];
  headerModifiers: HeaderModifiers | null;
  footerLayouts: FooterLayoutDef[];
  savedConfig: Record<string, string>;
  saveAction: (partial: Record<string, string>) => Promise<void>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function LayoutTiles({
  layouts,
  value,
  onChange,
}: {
  layouts: { id: string; label: string; description?: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {layouts.map(l => (
        <button
          key={l.id}
          type="button"
          onClick={() => onChange(l.id)}
          className={`text-left p-3 rounded-xl border-2 transition-colors ${
            value === l.id
              ? "border-zinc-900 bg-zinc-50"
              : "border-zinc-200 bg-white hover:border-zinc-300"
          }`}
        >
          <span className="block text-sm font-medium text-zinc-800">{l.label}</span>
          {l.description && (
            <span className="block text-xs text-zinc-400 mt-0.5">{l.description}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function PillGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
            value === o.value
              ? "bg-zinc-900 text-white"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <span className="text-sm font-medium text-zinc-700">{label}</span>
        {hint && <p className="text-xs text-zinc-400 mt-0.5">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
          checked ? "bg-zinc-900" : "bg-zinc-200"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-zinc-700">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <span className="text-sm font-medium text-zinc-700">{label}</span>
        {hint && <p className="text-xs text-zinc-400 mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function HeaderFooterClient({
  tab,
  headerLayouts,
  headerModifiers,
  footerLayouts,
  savedConfig,
  saveAction,
}: Props) {
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Local state — mirrors design config keys
  const [headerLayout, setHeaderLayout] = useState(savedConfig.headerLayout ?? headerLayouts[0]?.id ?? "standard");
  const [headerSticky, setHeaderSticky] = useState(savedConfig.headerSticky !== "false");
  const [headerBackground, setHeaderBackground] = useState(savedConfig.headerBackground ?? "glass");
  const [headerCompact, setHeaderCompact] = useState(savedConfig.headerCompact === "true");
  const [socialInHeader, setSocialInHeader] = useState(savedConfig.socialInHeader === "true");
  const [footerLayout, setFooterLayout] = useState(savedConfig.footerLayout ?? footerLayouts[0]?.id ?? "simple");
  const [socialInFooter, setSocialInFooter] = useState(savedConfig.socialInFooter !== "false");
  const [footerShowPoweredBy, setFooterShowPoweredBy] = useState(savedConfig.footerShowPoweredBy !== "false");
  const [footerCopyright, setFooterCopyright] = useState(savedConfig.footerCopyright ?? "");

  const persist = useCallback((patch: Record<string, string>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaving(true);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        await saveAction(patch);
        setSaving(false);
      });
    }, 600);
  }, [saveAction]);

  function update<K extends string>(key: K, value: string, setter: (v: any) => void, parsed: any) {
    setter(parsed);
    persist({ [key]: value });
  }

  const bgOptions = (headerModifiers?.supportsBackgroundStyles ?? ["solid", "glass"]).map(v => ({
    value: v,
    label: v === "glass" ? "Glass" : v === "solid" ? "Solid" : "Transparent on hero",
  }));

  return (
    <div className="space-y-5">
      {/* Saving indicator */}
      <div className="flex justify-end h-5">
        {saving && <span className="text-xs text-zinc-400">Saving…</span>}
      </div>

      {tab === "header" && (
        <>
          {headerLayouts.length > 0 && (
            <Section title="Layout">
              <LayoutTiles
                layouts={headerLayouts}
                value={headerLayout}
                onChange={v => update("headerLayout", v, setHeaderLayout, v)}
              />
            </Section>
          )}

          <Section title="Options">
            {headerModifiers?.supportsBackgroundStyles && headerModifiers.supportsBackgroundStyles.length > 1 && (
              <Row label="Background" hint="How the header background is rendered.">
                <PillGroup
                  options={bgOptions}
                  value={headerBackground}
                  onChange={v => update("headerBackground", v, setHeaderBackground, v)}
                />
              </Row>
            )}

            {headerModifiers?.supportsSticky && (
              <Toggle
                label="Sticky header"
                hint="Pin the header to the top of the screen when scrolling."
                checked={headerSticky}
                onChange={v => update("headerSticky", String(v), setHeaderSticky, v)}
              />
            )}

            {headerModifiers?.supportsCompactHeight && (
              <Toggle
                label="Compact height"
                hint="Reduce header padding for a tighter look."
                checked={headerCompact}
                onChange={v => update("headerCompact", String(v), setHeaderCompact, v)}
              />
            )}

            <Toggle
              label="Show social icons in header"
              hint="Display social profile icons next to the navigation links."
              checked={socialInHeader}
              onChange={v => update("socialInHeader", String(v), setSocialInHeader, v)}
            />
          </Section>
        </>
      )}

      {tab === "footer" && (
        <>
          {footerLayouts.length > 0 && (
            <Section title="Layout">
              <LayoutTiles
                layouts={footerLayouts}
                value={footerLayout}
                onChange={v => update("footerLayout", v, setFooterLayout, v)}
              />
            </Section>
          )}

          <Section title="Options">
            <Toggle
              label="Show social icons in footer"
              checked={socialInFooter}
              onChange={v => update("socialInFooter", String(v), setSocialInFooter, v)}
            />

            <Toggle
              label='Show "Made with Pugmill" credit'
              checked={footerShowPoweredBy}
              onChange={v => update("footerShowPoweredBy", String(v), setFooterShowPoweredBy, v)}
            />

            <div className="space-y-1 pt-1">
              <label className="block text-sm font-medium text-zinc-700">Custom copyright text</label>
              <p className="text-xs text-zinc-400">
                Overrides the default "© {new Date().getFullYear()} Site Name". Leave blank to use the default.
              </p>
              <input
                type="text"
                value={footerCopyright}
                onChange={e => {
                  setFooterCopyright(e.target.value);
                  persist({ footerCopyright: e.target.value });
                }}
                placeholder={`© ${new Date().getFullYear()} Your Site Name`}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
