import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { Button } from "../components/Button";
import { TextInput } from "../components/TextInput";
import { Banner } from "../components/Banner";
import { Turnstile } from "../components/Turnstile";
import { randomKey, splitKey } from "../crypto/keysplit";
import { encryptAesGcm } from "../crypto/aesgcm";
import { wrapWithPassphrase } from "../crypto/passphrase";
import { bytesToB64, bytesToB64Url } from "../crypto/base64";
import { looksSensitive } from "../sensitiveContent";
import { api } from "../api/client";

const EXPIRY_OPTIONS: { label: string; seconds: number }[] = [
  { label: "1 hour", seconds: 3600 },
  { label: "12 hours", seconds: 12 * 3600 },
  { label: "24 hours", seconds: 24 * 3600 },
  { label: "48 hours", seconds: 48 * 3600 },
  { label: "7 days", seconds: 7 * 24 * 3600 },
];
const MAX_CHARS = 10_000;

export function Compose() {
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [expiry, setExpiry] = useState(EXPIRY_OPTIONS[2]!.seconds);
  const [passphrase, setPassphrase] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const navigate = useNavigate();

  const sensitive = useMemo(() => looksSensitive(message), [message]);
  const submittable = message.length > 0 && email.length > 0 && captchaToken.length > 0 && !submitting;

  async function reallySubmit() {
    setSubmitting(true);
    setError(null);
    try {
      setStatusLine("Encrypting…");
      const plaintext = new TextEncoder().encode(message);
      const k = randomKey();
      const { ciphertext, nonce } = await encryptAesGcm(k, plaintext);
      const { kLink, kServer } = splitKey(k);
      let kServerToSend = kServer;
      if (passphrase.length > 0) {
        setStatusLine("Deriving passphrase key…");
        kServerToSend = await wrapWithPassphrase(kServer, passphrase);
      }
      setStatusLine("Creating link…");
      const { status, data } = await api.createMessage({
        ciphertext: bytesToB64(ciphertext),
        nonce: bytesToB64(nonce),
        kServer: bytesToB64(kServerToSend),
        email: email.trim(),
        expirySeconds: expiry,
        hasPassphrase: passphrase.length > 0,
        captchaToken,
      });
      if (status !== 201 || !("token" in data)) {
        const err = "error" in data ? data.error : "unknown";
        throw new Error(err);
      }
      const base = import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin;
      const link = `${base}/m/${data.token}#${bytesToB64Url(kLink)}`;
      navigate("/created", {
        state: {
          link,
          email: email.trim(),
          expirySeconds: expiry,
          hasPassphrase: passphrase.length > 0,
        },
        replace: true,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      const friendly: Record<string, string> = {
        captcha_failed: "CAPTCHA failed. Please try again.",
        rate_limited: "Too many messages from this address recently. Try again later.",
        disposable_email: "This recipient email domain isn't supported.",
        invalid_request: "Something in your submission was rejected.",
      };
      setError(friendly[msg] ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
      setStatusLine(null);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!submittable) return;
    if (sensitive && passphrase.length === 0) {
      setConfirmOpen(true);
      return;
    }
    await reallySubmit();
  }

  return (
    <Layout>
      <form onSubmit={onSubmit} className="space-y-12">
        <div className="relative bg-surface-container-lowest border border-outline-variant/30 p-1">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_CHARS))}
            placeholder="Paste your secret here…"
            spellCheck={false}
            autoComplete="off"
            className="w-full min-h-[280px] p-6 bg-surface-dim/10 border-none focus:ring-0 focus:outline-none font-label text-sm tracking-tight resize-none text-on-surface"
          />
          <div className="flex justify-end p-3 border-t border-outline-variant/20">
            <span className="font-label text-[0.7rem] uppercase tracking-widest text-outline">
              {message.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          </div>
        </div>

        {sensitive && (
          <Banner tone="warning" title="This looks like highly sensitive data">
            We recommend adding a passphrase below so only someone you share it with separately can view the message.
          </Banner>
        )}

        <div className="space-y-8">
          <TextInput
            label="Recipient's email"
            type="email"
            autoComplete="off"
            placeholder="address@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            helper="They'll need to verify this address before viewing."
          />

          <button
            type="button"
            onClick={() => setShowOptions((s) => !s)}
            className="flex items-center gap-2 group cursor-pointer transition-colors duration-200 hover:text-primary"
          >
            <span className="font-label text-[0.75rem] uppercase tracking-[0.05em] text-on-surface-variant group-hover:text-primary">
              Options
            </span>
            <span className="material-symbols-outlined text-outline group-hover:text-primary transition-transform duration-300">
              {showOptions ? "expand_less" : "expand_more"}
            </span>
          </button>

          {showOptions && (
            <div className="space-y-6 pl-4 border-l-2 border-outline-variant/30">
              <div className="space-y-2">
                <label className="font-label text-[0.75rem] uppercase tracking-[0.05em] text-on-surface-variant">
                  Link expires after
                </label>
                <div className="flex flex-wrap gap-2">
                  {EXPIRY_OPTIONS.map((opt) => {
                    const active = opt.seconds === expiry;
                    return (
                      <button
                        type="button"
                        key={opt.seconds}
                        onClick={() => setExpiry(opt.seconds)}
                        className={`px-3 py-2 text-xs font-medium ${
                          active
                            ? "bg-primary text-on-primary"
                            : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <TextInput
                label="Passphrase (optional)"
                type="password"
                autoComplete="new-password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                helper="Share this with the recipient separately — by phone or a different channel."
              />
            </div>
          )}

          <div>
            <Turnstile onToken={setCaptchaToken} />
          </div>

          {error && <Banner tone="error" title="Couldn't create the link">{error}</Banner>}

          <Button type="submit" disabled={!submittable} loading={submitting}>
            Create Secure Link
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
              lock
            </span>
          </Button>

          {statusLine && (
            <p className="text-xs text-on-surface-variant font-label uppercase tracking-[0.1em] text-center">
              {statusLine}
            </p>
          )}
        </div>

        <div className="mt-16 p-6 bg-surface-container-low border-l-2 border-primary/30">
          <h3 className="font-label text-[0.75rem] uppercase tracking-[0.05em] text-primary mb-2">Security Protocol</h3>
          <p className="text-sm leading-relaxed text-on-surface-variant max-w-[420px]">
            Your message is encrypted in this browser with AES-256 before anything is sent. The server never sees the plaintext or the full decryption key.
          </p>
        </div>
      </form>

      {confirmOpen && (
        <div className="fixed inset-0 bg-on-surface/50 flex items-center justify-center p-4 z-50">
          <div className="bg-surface-container-lowest max-w-md w-full p-8 space-y-6">
            <h2 className="text-xl font-bold">Send without passphrase?</h2>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              This message appears to contain sensitive credentials. A passphrase adds an extra layer of protection by
              requiring the recipient to know something you share through a different channel.
            </p>
            <div className="flex flex-col gap-3">
              <Button
                variant="primary"
                onClick={() => {
                  setConfirmOpen(false);
                  setShowOptions(true);
                }}
              >
                Go back and add one
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  setConfirmOpen(false);
                  await reallySubmit();
                }}
              >
                Send without passphrase
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
