import type { InputHTMLAttributes } from "react";

type Props = {
  label: string;
  helper?: string;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>;

export function TextInput({ label, helper, error, id, className = "", ...rest }: Props) {
  const inputId = id ?? rest.name ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-3">
      <label
        htmlFor={inputId}
        className="font-label text-[0.75rem] uppercase tracking-[0.05em] text-on-surface-variant font-medium"
      >
        {label}
      </label>
      <input
        {...rest}
        id={inputId}
        className={`w-full px-0 py-3 bg-transparent border-0 border-b-2 border-outline-variant/30 rounded-none outline-none focus:border-primary focus:outline-none focus:ring-0 transition-colors duration-300 text-on-surface font-medium placeholder:text-outline-variant/60 ${className}`}
      />
      {helper && !error && <p className="text-xs text-on-surface-variant/70 italic">{helper}</p>}
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
