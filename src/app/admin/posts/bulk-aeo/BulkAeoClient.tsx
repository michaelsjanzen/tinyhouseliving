"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { bulkSaveAeo } from "@/lib/actions/posts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PostItem {
  id: number;
  title: string;
  type: "post" | "page";
  hasAeo: boolean;
}

interface AeoResult {
  summary?: string;
  qa?: { q: string; a: string }[];
  entities?: { type: string; name: string; description?: string; sameAs?: string }[];
  keywords?: string[];
}

type ContentFilter = "all" | "posts" | "pages";
type RunState = "idle" | "running" | "paused" | "done" | "cancelled";
type Delay = 1500 | 3000 | 6000;
type BatchSize = 25 | 50 | 100 | 0; // 0 = all

interface Counters {
  success: number;
  failed: number;
  skipped: number;
}

function parseJson<T>(raw: string): T {
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(stripped) as T;
}

// ── Helper components ─────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`flex flex-col items-center px-4 py-3 rounded-lg border ${color}`}>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      <span className="text-xs mt-0.5 opacity-70">{label}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BulkAeoClient({
  posts,
  aiEnabled,
}: {
  posts: PostItem[];
  aiEnabled: boolean;
}) {
  // ── Filter / options state ──────────────────────────────────────────────────
  const [contentFilter, setContentFilter] = useState<ContentFilter>("all");
  const [skipComplete, setSkipComplete]   = useState(true);
  const [delay, setDelay]                 = useState<Delay>(3000);
  const [batchSize, setBatchSize]         = useState<BatchSize>(50);

  // ── Run state ───────────────────────────────────────────────────────────────
  const [runState, setRunState]       = useState<RunState>("idle");
  const [progress, setProgress]       = useState(0);      // index into current batch
  const [batchTotal, setBatchTotal]   = useState(0);
  const [counters, setCounters]       = useState<Counters>({ success: 0, failed: 0, skipped: 0 });
  const [lastTitle, setLastTitle]     = useState<string | null>(null);
  const [lastStatus, setLastStatus]   = useState<"ok" | "failed" | "skipped" | null>(null);
  const [ratePerHour, setRatePerHour] = useState<number | null>(null);
  const [hasAeoMap, setHasAeoMap]     = useState<Record<number, boolean>>(
    () => Object.fromEntries(posts.map(p => [p.id, p.hasAeo]))
  );

  // Refs for loop control (avoid stale closure issues)
  const cancelRef = useRef(false);
  const pauseRef  = useRef(false);
  const startTime = useRef<number>(0);

  // ── Computed queue ──────────────────────────────────────────────────────────
  const filteredPosts = useMemo(() => {
    return posts.filter(p => {
      if (contentFilter === "posts" && p.type !== "post") return false;
      if (contentFilter === "pages" && p.type !== "page") return false;
      if (skipComplete && hasAeoMap[p.id]) return false;
      return true;
    });
  }, [posts, contentFilter, skipComplete, hasAeoMap]);

  const totalPosts    = posts.filter(p =>
    contentFilter === "all" ? true : p.type === (contentFilter === "posts" ? "post" : "page")
  ).length;
  const completeCount = posts.filter(p =>
    (contentFilter === "all" ? true : p.type === (contentFilter === "posts" ? "post" : "page")) && hasAeoMap[p.id]
  ).length;
  const missingCount  = totalPosts - completeCount;

  const batchQueue = useMemo(() => {
    return batchSize === 0 ? filteredPosts : filteredPosts.slice(0, batchSize);
  }, [filteredPosts, batchSize]);

  // ── Beforeunload guard ──────────────────────────────────────────────────────
  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (runState === "running" || runState === "paused") {
      window.addEventListener("beforeunload", handleBeforeUnload);
    } else {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    }
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [runState, handleBeforeUnload]);

  // ── Loop runner ─────────────────────────────────────────────────────────────
  async function runLoop(queue: PostItem[], fromIndex = 0) {
    for (let i = fromIndex; i < queue.length; i++) {
      // Check cancel
      if (cancelRef.current) {
        setRunState("cancelled");
        return;
      }

      // Check pause — spin-wait via recursive rescheduling
      if (pauseRef.current) {
        setRunState("paused");
        // Wait until unpaused
        await new Promise<void>(resolve => {
          const check = setInterval(() => {
            if (!pauseRef.current) { clearInterval(check); resolve(); }
          }, 300);
        });
        setRunState("running");
      }

      const post = queue[i];
      setProgress(i + 1);
      setLastTitle(post.title);
      setLastStatus(null);

      try {
        const res = await fetch("/api/ai/bulk-aeo", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ postId: post.id }),
        });
        const data = (await res.json()) as { result?: string; error?: string };

        if (!res.ok || !data.result) {
          throw new Error(data.error ?? "AI request failed");
        }

        const aeo = parseJson<AeoResult>(data.result);

        // Validate — must have at least a summary
        if (!aeo.summary?.trim()) throw new Error("Empty summary in AI response");

        const saveResult = await bulkSaveAeo(post.id, aeo as Record<string, unknown>);
        if (!saveResult.ok) throw new Error(saveResult.error ?? "Save failed");

        // Mark as complete in local state so skip-complete reflects updated data
        setHasAeoMap(prev => ({ ...prev, [post.id]: true }));
        setCounters(prev => ({ ...prev, success: prev.success + 1 }));
        setLastStatus("ok");
      } catch {
        setCounters(prev => ({ ...prev, failed: prev.failed + 1 }));
        setLastStatus("failed");
      }

      // Update rate estimate
      const elapsed = (Date.now() - startTime.current) / 1000 / 60 / 60; // hours
      if (elapsed > 0) {
        setRatePerHour(Math.round((i + 1) / elapsed));
      }

      // Delay before next post (skip on last item)
      if (i < queue.length - 1 && !cancelRef.current) {
        await new Promise(r => setTimeout(r, delay));
      }
    }

    setRunState("done");
  }

  function handleStart() {
    if (!aiEnabled || batchQueue.length === 0) return;
    cancelRef.current = false;
    pauseRef.current  = false;
    startTime.current = Date.now();
    setBatchTotal(batchQueue.length);
    setProgress(0);
    setCounters({ success: 0, failed: 0, skipped: 0 });
    setLastTitle(null);
    setLastStatus(null);
    setRatePerHour(null);
    setRunState("running");
    void runLoop(batchQueue);
  }

  function handlePause() {
    if (runState === "running") {
      pauseRef.current = true;
      // runState updated inside runLoop
    } else if (runState === "paused") {
      pauseRef.current = false;
      setRunState("running");
    }
  }

  function handleCancel() {
    cancelRef.current = true;
    pauseRef.current  = false;
  }

  function handleReset() {
    setRunState("idle");
    setProgress(0);
    setBatchTotal(0);
    setCounters({ success: 0, failed: 0, skipped: 0 });
    setLastTitle(null);
    setLastStatus(null);
    setRatePerHour(null);
  }

  // ── Derived display ─────────────────────────────────────────────────────────
  const isRunning   = runState === "running";
  const isPaused    = runState === "paused";
  const isActive    = isRunning || isPaused;
  const isDone      = runState === "done" || runState === "cancelled";
  const pct         = batchTotal > 0 ? Math.round((progress / batchTotal) * 100) : 0;
  const queueSize   = batchQueue.length;
  const btnLabel    = batchSize === 0 || batchSize >= filteredPosts.length
    ? `Generate AEO for All ${queueSize} ${queueSize === 1 ? "Post" : "Posts"}`
    : `Generate AEO for Next ${queueSize} ${queueSize === 1 ? "Post" : "Posts"}`;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Bulk AEO</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Generate AEO metadata — summaries, Q&amp;A pairs, entities, and keywords — for all your
          published content in one run. Your page must stay open while the job runs.
        </p>
      </div>

      {!aiEnabled && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-4 text-sm text-amber-800">
          AI is not configured. Add an API key in{" "}
          <a href="/admin/settings/ai" className="underline hover:text-amber-900">Settings &rsaquo; AI Provider</a>{" "}
          to use Bulk AEO.
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <StatPill label="Total published" value={totalPosts}    color="border-zinc-200 text-zinc-700" />
        <StatPill label="AEO complete"    value={completeCount} color="border-green-200 text-green-700" />
        <StatPill label="Missing AEO"     value={missingCount}  color={missingCount > 0 ? "border-amber-200 text-amber-700" : "border-zinc-200 text-zinc-400"} />
      </div>

      {/* Options card */}
      <div className={`bg-white border border-zinc-200 rounded-lg p-6 space-y-5 ${isActive ? "pointer-events-none opacity-50" : ""}`}>
        <h2 className="text-sm font-semibold text-zinc-900">Options</h2>

        {/* Content type */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Content</label>
          <div className="flex gap-2">
            {(["all", "posts", "pages"] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setContentFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  contentFilter === f
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
                }`}
              >
                {f === "all" ? "Posts & Pages" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Skip complete */}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div
            onClick={() => setSkipComplete(v => !v)}
            className={`relative w-9 h-5 rounded-full transition-colors ${skipComplete ? "bg-violet-600" : "bg-zinc-300"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${skipComplete ? "translate-x-4" : ""}`} />
          </div>
          <span className="text-sm text-zinc-700">Skip posts that already have AEO data</span>
        </label>

        {/* Delay */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Request delay</label>
            <select
              value={delay}
              onChange={e => setDelay(Number(e.target.value) as Delay)}
              className="w-full border border-zinc-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
            >
              <option value={1500}>Fast — 1.5 s between posts</option>
              <option value={3000}>Normal — 3 s between posts</option>
              <option value={6000}>Careful — 6 s between posts</option>
            </select>
          </div>

          {/* Batch size */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Batch size</label>
            <select
              value={batchSize}
              onChange={e => setBatchSize(Number(e.target.value) as BatchSize)}
              className="w-full border border-zinc-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
            >
              <option value={25}>25 posts</option>
              <option value={50}>50 posts</option>
              <option value={100}>100 posts</option>
              <option value={0}>All</option>
            </select>
          </div>
        </div>
      </div>

      {/* Start button */}
      {!isActive && !isDone && (
        <button
          type="button"
          onClick={handleStart}
          disabled={!aiEnabled || queueSize === 0}
          className={`w-full py-3 rounded-lg text-sm font-semibold transition-colors ${
            aiEnabled && queueSize > 0
              ? "bg-violet-600 hover:bg-violet-700 text-white"
              : "bg-zinc-100 text-zinc-400 cursor-not-allowed"
          }`}
        >
          {queueSize === 0 ? "Nothing to generate — all posts have AEO data" : btnLabel}
        </button>
      )}

      {/* Progress panel */}
      {(isActive || isDone) && (
        <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-5">

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>
                {isDone
                  ? runState === "cancelled" ? "Cancelled" : "Done"
                  : isPaused ? "Paused" : "Running…"}
              </span>
              <span className="tabular-nums">{progress} / {batchTotal}</span>
            </div>
            <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isDone && runState !== "cancelled" ? "bg-green-500" :
                  runState === "cancelled" ? "bg-zinc-400" :
                  "bg-violet-500"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Rate */}
          {ratePerHour !== null && (
            <p className="text-xs text-zinc-400">≈ {ratePerHour.toLocaleString()} AI calls/hr</p>
          )}

          {/* Last processed */}
          {lastTitle && (
            <div className={`flex items-center gap-2 text-sm ${
              lastStatus === "ok"     ? "text-green-600" :
              lastStatus === "failed" ? "text-red-500"   : "text-zinc-500"
            }`}>
              {lastStatus === "ok"     && <span>✓</span>}
              {lastStatus === "failed" && <span>✗</span>}
              {lastStatus === null     && (
                <svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              <span className="truncate">{lastTitle}</span>
            </div>
          )}

          {/* Counters */}
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div className="rounded-lg bg-green-50 border border-green-100 py-2">
              <p className="text-lg font-semibold text-green-700 tabular-nums">{counters.success}</p>
              <p className="text-xs text-green-500">Generated</p>
            </div>
            <div className="rounded-lg bg-red-50 border border-red-100 py-2">
              <p className="text-lg font-semibold text-red-600 tabular-nums">{counters.failed}</p>
              <p className="text-xs text-red-400">Failed</p>
            </div>
            <div className="rounded-lg bg-zinc-50 border border-zinc-100 py-2">
              <p className="text-lg font-semibold text-zinc-500 tabular-nums">{counters.skipped}</p>
              <p className="text-xs text-zinc-400">Skipped</p>
            </div>
          </div>

          {/* Controls */}
          {isActive && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handlePause}
                className="flex-1 py-2 rounded-lg border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                {isPaused ? "Resume" : "Pause"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 py-2 rounded-lg border border-red-200 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Done message + restart option */}
          {isDone && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-600">
                {runState === "cancelled"
                  ? `Cancelled after ${progress} posts — ${counters.success} generated, ${counters.failed} failed.`
                  : `Done. ${counters.success} generated, ${counters.failed} failed.`}
                {counters.failed > 0 && " Failed posts were skipped — run again to retry them."}
              </p>
              <button
                type="button"
                onClick={handleReset}
                className="w-full py-2 rounded-lg border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                Start new run
              </button>
            </div>
          )}
        </div>
      )}

      {/* Post list preview */}
      {!isActive && !isDone && queueSize > 0 && (
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              Queue preview — {queueSize} {queueSize === 1 ? "post" : "posts"}
            </span>
            {filteredPosts.length > queueSize && (
              <span className="text-xs text-zinc-400">{filteredPosts.length - queueSize} more after this batch</span>
            )}
          </div>
          <ul className="divide-y divide-zinc-50 max-h-72 overflow-y-auto">
            {batchQueue.slice(0, 50).map(p => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.type === "page" ? "bg-blue-400" : "bg-violet-400"}`} />
                <span className="text-sm text-zinc-700 truncate flex-1">{p.title}</span>
                <span className="text-xs text-zinc-400 shrink-0">{p.type}</span>
                {hasAeoMap[p.id] && (
                  <span className="text-xs text-green-600 shrink-0">✓ has AEO</span>
                )}
              </li>
            ))}
            {batchQueue.length > 50 && (
              <li className="px-4 py-2.5 text-xs text-zinc-400">
                + {batchQueue.length - 50} more not shown
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
