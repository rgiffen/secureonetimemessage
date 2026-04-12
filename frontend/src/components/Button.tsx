import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

type Props = {
  variant?: Variant;
  loading?: boolean;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant = "primary", loading, children, disabled, className = "", ...rest }: Props) {
  const base =
    "py-4 px-6 text-sm font-semibold tracking-tight transition-all active:scale-[0.98] duration-200 flex items-center justify-center gap-2 disabled:cursor-not-allowed";
  const variants: Record<Variant, string> = {
    primary: "bg-primary hover:bg-primary-dim text-on-primary disabled:bg-surface-dim disabled:text-outline",
    secondary:
      "ghost-border text-primary hover:bg-primary-container disabled:text-outline disabled:bg-transparent",
    ghost: "text-primary hover:bg-surface-container-low disabled:text-outline",
  };
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {loading ? (
        <>
          <span className="material-symbols-outlined animate-spin text-[1.2rem]">sync</span>
          <span>Working…</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
