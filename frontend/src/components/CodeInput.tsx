import { useEffect, useRef, useState } from "react";

type Props = {
  length?: number;
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  errorShake?: number; // increment to trigger shake animation
  disabled?: boolean;
};

export function CodeInput({ length = 6, value, onChange, onComplete, errorShake = 0, disabled }: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (errorShake > 0) {
      setShake(true);
      const t = setTimeout(() => setShake(false), 400);
      return () => clearTimeout(t);
    }
  }, [errorShake]);

  function updateAt(idx: number, ch: string) {
    const next = value.split("");
    next[idx] = ch;
    for (let i = 0; i < length; i++) if (next[i] === undefined) next[i] = "";
    const s = next.slice(0, length).join("");
    onChange(s);
    if (s.replace(/\D/g, "").length === length && onComplete) {
      onComplete(s);
    }
  }

  return (
    <div className={`flex gap-2 ${shake ? "animate-shake" : ""}`}>
      {Array.from({ length }).map((_, i) => {
        const char = value[i] ?? "";
        return (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            aria-label={`Digit ${i + 1} of ${length}`}
            inputMode="numeric"
            pattern="\d*"
            maxLength={1}
            value={char}
            disabled={disabled}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, "").slice(-1);
              if (!raw) {
                updateAt(i, "");
                return;
              }
              updateAt(i, raw);
              if (i < length - 1) refs.current[i + 1]?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !char && i > 0) {
                refs.current[i - 1]?.focus();
              }
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
              if (text.length > 0) {
                e.preventDefault();
                onChange(text.padEnd(length, "").slice(0, length));
                const focusIdx = Math.min(text.length, length - 1);
                refs.current[focusIdx]?.focus();
                if (text.length === length && onComplete) onComplete(text);
              }
            }}
            className="w-12 h-14 text-center text-xl font-bold bg-surface-container-highest border-0 border-b-2 border-primary focus:ring-0 focus:outline-none disabled:opacity-50"
          />
        );
      })}
    </div>
  );
}
