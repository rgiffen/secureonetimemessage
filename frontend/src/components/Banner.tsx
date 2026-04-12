import type { ReactNode } from "react";

type Tone = "info" | "warning" | "error";

const toneClasses: Record<Tone, { bg: string; iconColor: string; titleColor: string; bodyColor: string; icon: string }> = {
  info: {
    bg: "bg-banner-info-bg",
    iconColor: "text-banner-info-icon",
    titleColor: "text-banner-info-fg",
    bodyColor: "text-banner-info-body",
    icon: "info",
  },
  warning: {
    bg: "bg-banner-warning-bg",
    iconColor: "text-banner-warning-icon",
    titleColor: "text-banner-warning-fg",
    bodyColor: "text-banner-warning-body",
    icon: "warning",
  },
  error: {
    bg: "bg-banner-error-bg",
    iconColor: "text-banner-error-icon",
    titleColor: "text-banner-error-fg",
    bodyColor: "text-banner-error-body",
    icon: "gpp_maybe",
  },
};

export function Banner({ tone = "info", title, children }: { tone?: Tone; title: string; children?: ReactNode }) {
  const t = toneClasses[tone];
  return (
    <div className={`${t.bg} p-4 flex gap-4 items-start`} role={tone === "error" ? "alert" : "status"}>
      <span className={`material-symbols-outlined ${t.iconColor}`}>{t.icon}</span>
      <div className="min-w-0">
        <p className={`text-sm font-bold ${t.titleColor}`}>{title}</p>
        {children && <p className={`text-sm ${t.bodyColor}`}>{children}</p>}
      </div>
    </div>
  );
}
