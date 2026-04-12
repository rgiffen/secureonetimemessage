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
  const hasToken = useRef(false);
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
      hasToken.current = false;
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey,
        theme: getCurrentTheme(),
        callback: (token) => {
          hasToken.current = true;
          onToken(token);
        },
      });
    }

    loadScript().then(render).catch(() => {
      // Turnstile blocked; leave widget empty
    });

    // Re-render only when the `dark` class on <html> actually flips AND the
    // widget hasn't already earned a token for the current challenge. If a
    // token was issued, destroying the widget would invalidate it and force
    // the user through the challenge again — a worse tradeoff than a
    // briefly theme-mismatched widget.
    const observer = new MutationObserver(() => {
      const nowDark = document.documentElement.classList.contains("dark");
      if (nowDark === lastDark.current) return;
      lastDark.current = nowDark;
      if (hasToken.current) return;
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
