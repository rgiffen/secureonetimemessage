import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { Button } from "../components/Button";
import { TextInput } from "../components/TextInput";
import { CodeInput } from "../components/CodeInput";
import { Banner } from "../components/Banner";
import { api, type VerifyRes } from "../api/client";
import { b64ToBytes, b64UrlToBytes } from "../crypto/base64";
import { combineKey } from "../crypto/keysplit";
import { decryptAesGcm } from "../crypto/aesgcm";
import { unwrapWithPassphrase } from "../crypto/passphrase";

type Phase = "email" | "code" | "passphrase" | "revealed" | "unavailable" | "decrypt_failed";

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 1) return email;
  return `${email[0]}${"●".repeat(Math.min(6, Math.max(1, at - 1)))}${email.slice(at)}`;
}

export function Retrieve() {
  const { token = "" } = useParams();
  const [phase, setPhase] = useState<Phase>("email");
  const [email, setEmail] = useState("");
  const [kLink, setKLink] = useState<Uint8Array | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeShake, setCodeShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [verifyRes, setVerifyRes] = useState<VerifyRes | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [passphraseError, setPassphraseError] = useState<string | null>(null);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [paused, setPaused] = useState(false);
  const [reveals, setReveals] = useState(0);
  const [networkError, setNetworkError] = useState<string | null>(null);

  useEffect(() => {
    // Prefer the value stashed by the inline bootstrap script in index.html,
    // but fall back to reading window.location.hash in case React mounted
    // before the bootstrap ran or the bootstrap was blocked.
    let k = window.__SECUREDROP_K_LINK__;
    if (!k && window.location.hash.length > 1) {
      k = window.location.hash.slice(1);
      try {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      } catch {
        // best-effort
      }
    }
    if (!k) {
      setPhase("unavailable");
      return;
    }
    try {
      setKLink(b64UrlToBytes(k));
    } catch {
      setPhase("unavailable");
    }
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  useEffect(() => {
    if (!revealed || paused || reveals === 0) return;
    if (secondsLeft <= 0) {
      setRevealed(false);
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [revealed, paused, secondsLeft, reveals]);

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email || busy) return;
    setBusy(true);
    setNetworkError(null);
    try {
      await api.requestOtp(token, email.trim());
      setPhase("code");
      setResendCooldown(30);
    } catch {
      setNetworkError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(codeToUse: string) {
    if (busy) return;
    setBusy(true);
    setCodeError(null);
    setNetworkError(null);
    try {
      const { status, data } = await api.verify(token, email.trim(), codeToUse);
      if (status !== 200 || !("ciphertext" in data)) {
        setCodeError("That code is invalid or expired. Please try again.");
        setCode("");
        setCodeShake((n) => n + 1);
        return;
      }
      setVerifyRes(data);
      if (data.hasPassphrase) {
        setPhase("passphrase");
      } else {
        await decrypt(data, null);
      }
    } catch {
      setNetworkError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    if (resendCooldown > 0 || busy) return;
    setBusy(true);
    try {
      await api.requestOtp(token, email.trim());
      setResendCooldown(30);
      setResendNotice("New code sent.");
      setTimeout(() => setResendNotice(null), 3000);
    } catch {
      setNetworkError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function decrypt(res: VerifyRes, pw: string | null) {
    if (!kLink) {
      setPhase("decrypt_failed");
      return;
    }
    try {
      let kServer = b64ToBytes(res.kServer);
      if (res.hasPassphrase) {
        if (pw === null) throw new Error("passphrase required");
        kServer = await unwrapWithPassphrase(kServer, pw);
      }
      const k = combineKey(kLink, kServer);
      const ct = b64ToBytes(res.ciphertext);
      const nonce = b64ToBytes(res.nonce);
      const pt = await decryptAesGcm(k, nonce, ct);
      setPlaintext(new TextDecoder().decode(pt));
      setPhase("revealed");
    } catch {
      if (res.hasPassphrase && pw !== null) {
        setPassphraseError("That passphrase didn't work.");
        setPhase("decrypt_failed");
      } else {
        setPhase("decrypt_failed");
      }
    }
  }

  async function submitPassphrase(e: React.FormEvent) {
    e.preventDefault();
    if (!verifyRes || busy || !passphrase) return;
    setBusy(true);
    setPassphraseError(null);
    await decrypt(verifyRes, passphrase);
    setBusy(false);
  }

  function doReveal() {
    setSecondsLeft(60);
    setPaused(false);
    setReveals((n) => n + 1);
    setRevealed(true);
  }

  async function copyPlain() {
    if (!plaintext) return;
    try {
      await navigator.clipboard.writeText(plaintext);
    } catch {
      // ignore
    }
  }

  // PHASE: UNAVAILABLE (B4)
  if (phase === "unavailable") {
    return (
      <Layout>
        <div className="space-y-6 text-center py-16">
          <h1 className="text-3xl font-bold">This message is no longer available.</h1>
          <p className="text-on-surface-variant">
            It may have already been viewed, or it may have expired.
          </p>
          <p className="text-sm text-on-surface-variant/80">
            If you expected to find a message here, ask the sender to create a new one.
          </p>
          <div>
            <Link className="text-sm text-primary hover:underline" to="/">
              Create your own
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  // PHASE: DECRYPT FAILED (B4a)
  if (phase === "decrypt_failed") {
    return (
      <Layout>
        <div className="space-y-6 py-16">
          <h1 className="text-3xl font-bold">Unable to decrypt this message.</h1>
          <p className="text-on-surface-variant leading-relaxed">
            The passphrase didn't work, and this message can only be viewed once. It has been permanently deleted.
          </p>
          <p className="text-sm text-on-surface-variant/80 leading-relaxed">
            Contact the sender and ask them to resend the message with the correct passphrase. For your security,
            messages are deleted immediately after delivery — even if decryption fails.
          </p>
          <div>
            <Link className="text-sm text-primary hover:underline" to="/">
              Create a new message
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  // PHASE: REVEALED (B5)
  if (phase === "revealed") {
    return (
      <Layout>
        <div className="space-y-8">
          <h1 className="text-3xl font-bold">Your secure message.</h1>

          {!revealed && (
            <div className="flex flex-col items-center gap-4 py-12 bg-surface-container-low">
              <Button onClick={doReveal} disabled={reveals >= 2}>
                <span className="material-symbols-outlined filled">visibility</span>
                {reveals === 0 ? "Reveal Message" : `Reveal again (${2 - reveals} remaining)`}
              </Button>
              {reveals >= 2 && (
                <p className="text-xs text-on-surface-variant">
                  This message has been viewed and deleted.
                </p>
              )}
            </div>
          )}

          {revealed && (
            <div className="bg-surface-container-lowest ghost-border p-6 relative">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2 text-on-surface-variant font-label text-xs">
                  <span className="material-symbols-outlined text-[1rem]">timer</span>
                  <span>Auto-hiding in {secondsLeft}s</span>
                  <button
                    type="button"
                    onClick={() => setPaused((p) => !p)}
                    className="ml-2 underline hover:text-primary"
                  >
                    {paused ? "Resume" : "Pause"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={copyPlain}
                  className="flex items-center gap-1 text-primary hover:bg-primary-container px-2 py-1 text-sm"
                >
                  <span className="material-symbols-outlined text-[1rem]">content_copy</span>
                  Copy
                </button>
              </div>
              <pre className="font-label text-sm leading-relaxed p-4 bg-surface-container-low border-l-2 border-primary whitespace-pre-wrap break-words">
                {plaintext}
              </pre>
            </div>
          )}

          <p className="text-xs text-on-surface-variant">
            This message has been permanently deleted from our servers.
          </p>
        </div>
      </Layout>
    );
  }

  // PHASE: PASSPHRASE (B3)
  if (phase === "passphrase") {
    return (
      <Layout>
        <form onSubmit={submitPassphrase} className="space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">One more step.</h1>
            <p className="text-on-surface-variant">
              This message is protected with a passphrase. The sender should have shared it with you separately.
            </p>
          </div>
          <TextInput
            label="Passphrase"
            type="password"
            autoComplete="off"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            error={passphraseError ?? undefined}
          />
          <Button type="submit" disabled={!passphrase || busy} loading={busy}>
            Decrypt Message
          </Button>
        </form>
      </Layout>
    );
  }

  // PHASE: CODE (B2)
  if (phase === "code") {
    return (
      <Layout>
        <div className="space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Check your email.</h1>
            <p className="text-on-surface-variant">
              We sent a 6-digit code to <span className="font-semibold">{maskEmail(email.trim())}</span>
            </p>
          </div>
          <CodeInput
            value={code}
            onChange={setCode}
            onComplete={submitCode}
            errorShake={codeShake}
            disabled={busy}
          />
          {codeError && <p className="text-sm text-error">{codeError}</p>}
          {resendNotice && <p className="text-sm text-primary">{resendNotice}</p>}
          <div className="flex items-center gap-4">
            <Button type="button" onClick={() => submitCode(code)} disabled={code.length !== 6 || busy} loading={busy}>
              Verify
            </Button>
            <button
              type="button"
              onClick={resendCode}
              disabled={resendCooldown > 0 || busy}
              className="text-sm text-primary hover:underline disabled:text-outline disabled:cursor-not-allowed"
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Didn't receive it? Send a new code."}
            </button>
          </div>
          {networkError && <Banner tone="error" title="Network error">{networkError}</Banner>}
        </div>
      </Layout>
    );
  }

  // PHASE: EMAIL (B1)
  return (
    <Layout>
      <form onSubmit={submitEmail} className="space-y-8">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold">Someone sent you a secure message.</h1>
          <p className="text-on-surface-variant">To view it, verify your email address.</p>
        </div>
        <TextInput
          label="Your email address"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="address@domain.com"
        />
        <Button type="submit" disabled={!email || busy} loading={busy}>
          Send Verification Code
        </Button>
        {networkError && <Banner tone="error" title="Network error">{networkError}</Banner>}
      </form>
    </Layout>
  );
}
