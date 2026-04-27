"use client";

import { useState, useRef, useEffect } from "react";
import type { HeroSection } from "@/types/homepage-sections";
import type { UploadedMediaItem } from "@/components/admin/MediaDropZone";
import { uploadMedia } from "@/lib/actions/media";

interface MediaItem { id: number; url: string; fileName: string; }

interface Props {
  section: HeroSection;
  onChange: (s: HeroSection) => void;
  allMedia: MediaItem[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "").padEnd(6, "0");
  return [0, 2, 4].map(i => parseInt(clean.slice(i, i + 2), 16)).join(" ");
}

function overlayBg(s: HeroSection): string {
  const rgb = hexToRgb(s.overlayColor || "#000000");
  const opacity = s.overlayOpacity / 100;
  const solid = `rgb(${rgb} / ${opacity})`;
  const clear = `rgb(${rgb} / 0)`;
  return {
    flat: solid,
    "gradient-up": `linear-gradient(to top, ${solid}, ${solid} 25%, ${clear})`,
    "gradient-down": `linear-gradient(to bottom, ${solid}, ${solid} 25%, ${clear})`,
  }[s.overlayStyle] ?? solid;
}

const heightClass: Record<string, string> = {
  short: "min-h-[30vh]",
  medium: "min-h-[45vh]",
  tall: "min-h-[60vh]",
  full: "min-h-[80vh]",
};

const justifyClass: Record<string, string> = {
  top: "justify-start",
  center: "justify-center",
  bottom: "justify-end",
};

// ─── Contenteditable hook ──────────────────────────────────────────────────────

function useEditable(value: string, onCommit: (v: string) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current && ref.current && ref.current.textContent !== value) {
      ref.current.textContent = value;
    }
  });

  return {
    ref,
    contentEditable: true as const,
    suppressContentEditableWarning: true,
    onFocus: () => { focused.current = true; },
    onBlur: (e: React.FocusEvent<HTMLDivElement>) => {
      focused.current = false;
      const text = e.currentTarget.textContent ?? "";
      if (text !== value) onCommit(text);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
      if (e.key === "Escape") {
        if (ref.current) ref.current.textContent = value;
        e.currentTarget.blur();
      }
    },
  };
}

// ─── Dark upload zone ──────────────────────────────────────────────────────────

function DarkUploadZone({ onUploaded }: { onUploaded: (items: UploadedMediaItem[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (!arr.length) return;
    setUploading(true);
    setError(null);
    const uploaded: UploadedMediaItem[] = [];
    try {
      for (const file of arr) {
        const fd = new FormData();
        fd.append("file", file);
        const result = await uploadMedia(fd);
        if ("error" in result && result.error) { setError(result.error); }
        else if (result.id && result.url) { uploaded.push({ id: result.id, url: result.url, fileName: file.name }); }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
    setUploading(false);
    if (uploaded.length) onUploaded(uploaded);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed cursor-pointer transition-colors text-sm select-none ${
          dragging ? "border-white/60 bg-white/10 text-white" : "border-white/20 text-white/50 hover:border-white/40 hover:text-white/70"
        } ${uploading ? "pointer-events-none opacity-60" : ""}`}
      >
        {uploading ? "Uploading…" : dragging ? "Drop to upload" : "Drop or click to upload"}
      </div>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); }} />
    </div>
  );
}

// ─── Eye toggle ────────────────────────────────────────────────────────────────

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}

// ─── CTA popover ───────────────────────────────────────────────────────────────

function CtaPopover({
  text, url, style, onText, onUrl, onStyle, onRemove, onClose,
}: {
  text: string; url: string; style: "filled" | "outline";
  onText: (v: string) => void; onUrl: (v: string) => void;
  onStyle: (v: "filled" | "outline") => void;
  onRemove: () => void; onClose: () => void;
}) {
  const isExternal = /^https?:\/\//i.test(url);
  return (
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 bg-white rounded-xl shadow-xl border border-zinc-200 p-3 w-64">
      <div className="space-y-2">
        <input
          value={text} onChange={e => onText(e.target.value)}
          placeholder="Button label"
          className="w-full border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
        />
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs select-none">
            {url === "" ? "" : isExternal ? "↗" : "→"}
          </span>
          <input
            value={url} onChange={e => onUrl(e.target.value)}
            placeholder="/page or https://…"
            className="w-full border border-zinc-200 rounded-lg pl-7 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
        </div>
        <p className="text-xs text-zinc-500">
          {isExternal ? "Opens in a new tab" : url ? "Links to a page on this site" : "Enter a path like /about or a full URL"}
        </p>
        <div className="flex gap-1">
          {(["filled", "outline"] as const).map(s => (
            <button key={s} type="button" onClick={() => onStyle(s)}
              className={`flex-1 py-1.5 text-xs rounded-lg capitalize font-medium transition-colors ${
                style === s ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <button type="button" onClick={onRemove}
          className="w-full text-xs text-red-500 hover:text-red-700 py-1 transition-colors"
        >
          Remove button
        </button>
      </div>
      <button type="button" onClick={onClose}
        className="absolute top-2 right-2 text-zinc-400 hover:text-zinc-700 text-lg leading-none"
        aria-label="Close"
      >×</button>
    </div>
  );
}

// ─── Control panel ─────────────────────────────────────────────────────────────

function ControlPanel({
  section, update, onOpenLibrary,
}: {
  section: HeroSection;
  update: (p: Partial<HeroSection>) => void;
  onOpenLibrary: () => void;
}) {
  return (
    <div className="w-48 shrink-0 space-y-5 self-start">

      {/* Image */}
      <div>
        <p className="text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Image</p>
        <div className="space-y-1.5">
          <button type="button" onClick={onOpenLibrary}
            className="w-full py-1.5 text-xs rounded-lg font-medium bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
          >
            {section.imageUrl ? "Change image" : "Add image"}
          </button>
          {section.imageUrl && (
            <button type="button" onClick={() => update({ imageUrl: "" })}
              className="w-full py-1.5 text-xs rounded-lg font-medium text-red-500 hover:bg-red-50 transition-colors"
            >
              Remove image
            </button>
          )}
        </div>
      </div>

      {/* Height */}
      <div>
        <p className="text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Height</p>
        <div className="grid grid-cols-4 gap-1">
          {([["short","S"],["medium","M"],["tall","T"],["full","F"]] as const).map(([h, label]) => (
            <button key={h} type="button" onClick={() => update({ height: h })}
              className={`py-1.5 text-xs rounded-lg font-medium transition-colors ${
                section.height === h ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Overlay */}
      <div>
        <p className="text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Overlay</p>
        <div className="flex items-center gap-2 mb-2">
          <input type="color" value={section.overlayColor}
            onChange={e => update({ overlayColor: e.target.value })}
            className="h-7 w-7 rounded cursor-pointer border border-zinc-200 p-0.5 shrink-0"
            title="Overlay color"
          />
          <input type="range" min={0} max={90} step={10}
            value={section.overlayOpacity}
            onChange={e => update({ overlayOpacity: Number(e.target.value) })}
            className="flex-1 accent-zinc-900"
          />
          <span className="text-xs text-zinc-400 w-8 text-right shrink-0">{section.overlayOpacity}%</span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {([
            ["gradient-up", "↑ Fade"],
            ["gradient-down", "↓ Fade"],
            ["flat", "Flat"],
          ] as const).map(([val, label]) => (
            <button key={val} type="button" onClick={() => update({ overlayStyle: val })}
              className={`py-1.5 text-xs rounded-lg font-medium transition-colors ${
                section.overlayStyle === val ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Position */}
      <div>
        <p className="text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">Content position</p>
        <div className="grid grid-cols-3 gap-1 mb-1.5">
          {(["top", "center", "bottom"] as const).map(p => (
            <button key={p} type="button" onClick={() => update({ contentPosition: p })}
              className={`py-1.5 text-xs rounded-lg capitalize font-medium transition-colors ${
                section.contentPosition === p ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1">
          {(["left", "center"] as const).map(a => (
            <button key={a} type="button" onClick={() => update({ contentAlign: a })}
              className={`py-1.5 text-xs rounded-lg capitalize font-medium transition-colors ${
                section.contentAlign === a ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {a === "left" ? "⟵ Left" : "⊕ Center"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────

export default function SectionHeroCanvas({ section, onChange, allMedia }: Props) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [activePopover, setActivePopover] = useState<"cta1" | "cta2" | null>(null);
  const [localMedia, setLocalMedia] = useState<MediaItem[]>(allMedia);

  function update(partial: Partial<HeroSection>) {
    onChange({ ...section, ...partial });
    if (!("cta1Text" in partial || "cta1Url" in partial || "cta1Style" in partial ||
          "cta2Text" in partial || "cta2Url" in partial || "cta2Style" in partial)) {
      setActivePopover(null);
    }
  }

  function handleUploaded(items: UploadedMediaItem[]) {
    const mapped = items.map(i => ({ id: i.id, url: i.url, fileName: i.fileName }));
    setLocalMedia(prev => [...mapped, ...prev]);
    update({ imageUrl: mapped[0].url });
    setLibraryOpen(false);
  }

  const headlineEditProps = useEditable(section.headline, v => update({ headline: v }));
  const subheadlineEditProps = useEditable(section.subheadline, v => update({ subheadline: v }));

  const canvasJustify = justifyClass[section.contentPosition] ?? "justify-end";
  const canvasHeight = heightClass[section.height] ?? "min-h-[45vh]";
  const alignClasses = section.contentAlign === "center" ? "items-center text-center" : "items-start text-left";
  const ctaAlign = section.contentAlign === "center" ? "justify-center" : "";

  const ctaBtnClass = (style: "filled" | "outline") =>
    style === "outline"
      ? "px-5 py-2.5 rounded-lg border-2 border-white text-white text-sm font-semibold hover:bg-white/15 transition-colors"
      : "px-5 py-2.5 rounded-lg bg-white text-zinc-900 text-sm font-semibold hover:bg-white/90 transition-colors";

  return (
    <div className="flex gap-4">
      {/* Canvas */}
      <div className="flex-1 min-w-0">
        <div
          className={`relative flex flex-col ${canvasJustify} ${canvasHeight} rounded-xl overflow-hidden`}
          style={section.imageUrl
            ? { backgroundImage: `url(${section.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { backgroundColor: "var(--color-accent, #2563eb)" }
          }
        >
          {/* Overlay */}
          {section.imageUrl && (
            <div className="absolute inset-0 pointer-events-none" style={{ background: overlayBg(section) }} />
          )}

          {/* Library panel */}
          {libraryOpen && (
            <div className="absolute inset-0 z-20 bg-zinc-950/95 flex flex-col rounded-xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                <span className="text-sm font-medium text-white">Choose background image</span>
                <button type="button" onClick={() => setLibraryOpen(false)}
                  className="text-white/50 hover:text-white text-xl leading-none"
                >×</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <DarkUploadZone onUploaded={handleUploaded} />
                {localMedia.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {localMedia.map(item => (
                      <button
                        key={item.id} type="button"
                        onClick={() => { update({ imageUrl: item.url }); setLibraryOpen(false); }}
                        className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-colors ${
                          section.imageUrl === item.url ? "border-white" : "border-transparent hover:border-white/60"
                        }`}
                        title={item.fileName}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.url} alt={item.fileName} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/40 text-sm text-center py-4">No images yet — drop one above.</p>
                )}
              </div>
            </div>
          )}

          {/* Content block */}
          {!libraryOpen && (
            <div className={`relative z-10 w-full px-8 py-10 flex flex-col gap-4 ${alignClasses}`}>

              {/* Headline */}
              <div className="group/headline relative flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => update({ showHeadline: !section.showHeadline })}
                  className="shrink-0 p-1 rounded text-white/40 hover:text-white/80 transition-colors opacity-0 group-hover/headline:opacity-100"
                  title={section.showHeadline ? "Hide headline" : "Show headline"}
                >
                  <EyeIcon open={section.showHeadline} />
                </button>
                {section.showHeadline ? (
                  <div
                    {...headlineEditProps}
                    className="text-3xl sm:text-4xl font-bold text-white leading-tight outline-none cursor-text rounded px-1 -mx-1 hover:bg-white/10 focus:bg-white/10 transition-colors min-w-[4ch]"
                  />
                ) : (
                  <div
                    onClick={() => update({ showHeadline: true })}
                    className="text-3xl sm:text-4xl font-bold text-white/25 italic cursor-pointer px-1 rounded hover:bg-white/10 transition-colors"
                  >
                    {section.headline || "Headline"}
                  </div>
                )}
              </div>

              {/* Subheadline */}
              <div className="group/sub relative flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => update({ showSubheadline: !section.showSubheadline })}
                  className="shrink-0 p-1 rounded text-white/40 hover:text-white/80 transition-colors opacity-0 group-hover/sub:opacity-100"
                  title={section.showSubheadline ? "Hide subheadline" : "Show subheadline"}
                >
                  <EyeIcon open={section.showSubheadline} />
                </button>
                {section.showSubheadline ? (
                  <div
                    {...subheadlineEditProps}
                    className="text-base sm:text-lg text-white/80 outline-none cursor-text rounded px-1 -mx-1 hover:bg-white/10 focus:bg-white/10 transition-colors min-w-[4ch] max-w-xl"
                  />
                ) : (
                  <div
                    onClick={() => update({ showSubheadline: true })}
                    className="text-base sm:text-lg text-white/25 italic cursor-pointer px-1 rounded hover:bg-white/10 transition-colors"
                  >
                    {section.subheadline || "Subheadline"}
                  </div>
                )}
              </div>

              {/* CTA buttons */}
              <div className={`flex flex-wrap gap-3 pt-1 ${ctaAlign}`}>
                {section.cta1Enabled ? (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setActivePopover(activePopover === "cta1" ? null : "cta1")}
                      className={`${ctaBtnClass(section.cta1Style)} ring-2 ${activePopover === "cta1" ? "ring-white" : "ring-transparent hover:ring-white/50"} transition-all`}
                    >
                      {section.cta1Text || "Button 1"}
                    </button>
                    {activePopover === "cta1" && (
                      <CtaPopover
                        text={section.cta1Text} url={section.cta1Url} style={section.cta1Style}
                        onText={v => update({ cta1Text: v })}
                        onUrl={v => update({ cta1Url: v })}
                        onStyle={v => update({ cta1Style: v })}
                        onRemove={() => { update({ cta1Enabled: false }); setActivePopover(null); }}
                        onClose={() => setActivePopover(null)}
                      />
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => update({ cta1Enabled: true })}
                    className="px-4 py-2 rounded-lg border-2 border-dashed border-white/30 text-white/40 text-sm hover:border-white/60 hover:text-white/60 transition-colors"
                  >
                    + Add button
                  </button>
                )}

                {section.cta1Enabled && (
                  section.cta2Enabled ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setActivePopover(activePopover === "cta2" ? null : "cta2")}
                        className={`${ctaBtnClass(section.cta2Style)} ring-2 ${activePopover === "cta2" ? "ring-white" : "ring-transparent hover:ring-white/50"} transition-all`}
                      >
                        {section.cta2Text || "Button 2"}
                      </button>
                      {activePopover === "cta2" && (
                        <CtaPopover
                          text={section.cta2Text} url={section.cta2Url} style={section.cta2Style}
                          onText={v => update({ cta2Text: v })}
                          onUrl={v => update({ cta2Url: v })}
                          onStyle={v => update({ cta2Style: v })}
                          onRemove={() => { update({ cta2Enabled: false }); setActivePopover(null); }}
                          onClose={() => setActivePopover(null)}
                        />
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => update({ cta2Enabled: true })}
                      className="px-4 py-2 rounded-lg border-2 border-dashed border-white/30 text-white/40 text-sm hover:border-white/60 hover:text-white/60 transition-colors"
                    >
                      + Add button
                    </button>
                  )
                )}
              </div>
            </div>
          )}
        </div>
        {!section.imageUrl && (
          <p className="mt-2 text-xs text-zinc-400">
            Background color is set by the <strong className="text-zinc-500">Accent</strong> color in{" "}
            <a href="/admin/design/colors" className="underline hover:text-zinc-600">Design › Colors</a>.
          </p>
        )}
      </div>

      {/* Control panel */}
      <ControlPanel section={section} update={update} onOpenLibrary={() => setLibraryOpen(true)} />
    </div>
  );
}
