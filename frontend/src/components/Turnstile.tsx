import { useEffect, useRef } from "react";
import { getCurrentTheme } from "../theme";

type TurnstileTheme = "light" | "dark" | "auto";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          theme?: TurnstileTheme;
        }
      ) => string;
      remove: (id: string) => void;
    };
  }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  const existing = document.querySelector(`script[src="${SRC}"]`);
  if (existing) {
    return new Promise((res) => existing.addEventListener("load", () => res(), { once: true }));
  }
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => res();
    s.onerror = () => rej(new Error("turnstile load failed"));
    document.head.appendChild(s);
  });
}

export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  const lastDark = useRef(document.documentElement.classList.contains("dark"));
  const sitekey = import.meta.env.VITE_TURNSTILE_SITEKEY ?? "";

  useEffect(() => {
    let cancelled = false;

    function render() {
      if (cancelled || !ref.current || !window.turnstile) return;
      if (widgetId.current) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          // ignore
        }
        widgetId.current = null;
      }
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey,
        theme: getCurrentTheme(),
        callback: (token) => onToken(token),
      });
    }

    loadScript().then(render).catch(() => {
      // Turnstile blocked; leave widget empty
    });

    // Re-render when the `dark` class on <html> actually flips (ignore
    // unrelated class mutations). The Turnstile API has no live-theme-swap
    // method, so remove+render is the only option. In managed mode (most
    // real widgets) the re-challenge is invisible; in the rare interactive
    // case, the user may need to re-tap the check. We used to preserve
    // already-issued tokens across theme changes but that made the widget
    // silently stop swapping theme after the first auto-pass.
    const observer = new MutationObserver(() => {
      const nowDark = document.documentElement.classList.contains("dark");
      if (nowDark === lastDark.current) return;
      lastDark.current = nowDark;
      if (widgetId.current && window.turnstile) render();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      cancelled = true;
      observer.disconnect();
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          // ignore
        }
      }
    };
  }, [sitekey, onToken]);

  return <div ref={ref} />;
}
