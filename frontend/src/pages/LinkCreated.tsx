import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { Button } from "../components/Button";

type State = { link: string; email: string; expirySeconds: number; hasPassphrase: boolean };

function formatExpiry(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
  return `${Math.round(seconds / 86400)} days`;
}

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 1) return email;
  return `${email[0]}${"●".repeat(Math.min(6, Math.max(1, at - 1)))}${email.slice(at)}`;
}

export function LinkCreated() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as State | null;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!state) navigate("/", { replace: true });
  }, [state, navigate]);

  if (!state) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(state!.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Secure message", text: "Open to view:", url: state!.link });
      } catch {
        // user cancelled
      }
    } else {
      copy();
    }
  }

  const mailtoBody = encodeURIComponent(
    `I've sent you a secure message. Open this link and verify your email to view it: ${state.link}\n\nDo not forward this link — it's intended only for you.`
  );
  const mailtoSubject = encodeURIComponent("Secure message for you");

  return (
    <Layout>
      <div className="space-y-12">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined filled text-primary">check_circle</span>
            <h1 className="text-3xl font-bold tracking-tight">Your secure link is ready.</h1>
          </div>
          <p className="text-sm text-on-surface-variant">
            Share it with your recipient through any channel you trust.
          </p>
        </div>

        <div className="bg-surface-container-low p-6 space-y-4">
          <label className="font-label text-[0.7rem] uppercase tracking-[0.05em] text-outline">The link</label>
          <div className="flex">
            <input
              readOnly
              value={state.link}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-grow bg-surface-container-highest px-4 py-3 font-label text-sm text-primary border-0 focus:ring-0 focus:outline-none truncate"
            />
            <button
              onClick={copy}
              className="bg-primary text-on-primary px-4 flex items-center justify-center gap-2 hover:bg-primary-dim transition-colors"
            >
              <span className="material-symbols-outlined text-[1.1rem]">{copied ? "check" : "content_copy"}</span>
              <span className="text-sm font-semibold">{copied ? "Copied!" : "Copy"}</span>
            </button>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button variant="secondary" type="button" onClick={share}>
              <span className="material-symbols-outlined text-[1.1rem]">share</span>
              Share…
            </Button>
            <a
              href={`mailto:?subject=${mailtoSubject}&body=${mailtoBody}`}
              className="ghost-border text-primary py-4 px-6 text-sm font-semibold hover:bg-primary-container transition-all active:scale-[0.98] duration-200 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[1.1rem]">mail</span>
              Email it
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-label uppercase tracking-[0.05em] text-on-surface-variant">
          <div>
            <div className="text-outline">Recipient</div>
            <div className="text-on-surface mt-1 normal-case tracking-normal font-body">{maskEmail(state.email)}</div>
          </div>
          <div>
            <div className="text-outline">Expires</div>
            <div className="text-on-surface mt-1 normal-case tracking-normal font-body">in {formatExpiry(state.expirySeconds)}</div>
          </div>
          <div>
            <div className="text-outline">Passphrase</div>
            <div className="text-on-surface mt-1 normal-case tracking-normal font-body">
              {state.hasPassphrase ? "required" : "none"}
            </div>
          </div>
        </div>

        <p className="text-xs text-on-surface-variant">
          This link works once. After it's viewed, the message is permanently deleted.
        </p>

        <div>
          <Link to="/" className="text-sm text-primary hover:underline">
            Send another
          </Link>
        </div>
      </div>
    </Layout>
  );
}
