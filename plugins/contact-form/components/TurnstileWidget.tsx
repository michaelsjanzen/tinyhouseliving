"use client";

import { useEffect, useRef, useState } from "react";

// Cloudflare Turnstile global, injected by their script.
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id?: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * Renders a Cloudflare Turnstile widget explicitly via the JS API and stores the
 * resulting token in a React-controlled hidden input ("cf-turnstile-response"),
 * so it reliably submits with the server-action form.
 *
 * The implicit auto-render (a bare <div class="cf-turnstile">) does NOT work
 * reliably under React/Next — the script's one-shot DOM scan races hydration and
 * its injected hidden input gets clobbered on re-render. Explicit render + a
 * React-owned token field avoids both problems.
 */
export default function TurnstileWidget({ siteKey }: { siteKey: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState("");

  useEffect(() => {
    if (!siteKey) return;
    let widgetId: string | undefined;
    let cancelled = false;

    function renderWidget() {
      if (cancelled || !window.turnstile || !containerRef.current) return;
      if (containerRef.current.childElementCount > 0) return; // guard double-render
      widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (t: string) => setToken(t),
        "expired-callback": () => setToken(""),
        "error-callback": () => setToken(""),
      });
    }

    if (window.turnstile) {
      renderWidget();
    } else {
      let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
      if (!script) {
        script = document.createElement("script");
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", renderWidget);
    }

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch {
          /* widget already gone */
        }
      }
    };
  }, [siteKey]);

  return (
    <div>
      <div ref={containerRef} />
      <input type="hidden" name="cf-turnstile-response" value={token} readOnly />
    </div>
  );
}
