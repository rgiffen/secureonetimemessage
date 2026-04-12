import type { ReactNode } from "react";

type Tone = "info" | "warning" | "error";

const toneClasses: Record<Tone, { bg: string; iconColor: string; titleColor: string; bodyColor: string; icon: string }> = {
  info: { bg: "bg-blue-50", iconColor: "text-blue-600", titleColor: "text-blue-900", bodyColor: "text-blue-700", icon: "info" },
  warning: {
    bg: "bg-amber-50",
    iconColor: "text-amber-600",
    titleColor: "text-amber-900",
    bodyColor: "text-amber-800",
    icon: "warning",
  },
  error: { bg: "bg-red-50", iconColor: "text-red-600", titleColor: "text-red-900", bodyColor: "text-red-700", icon: "gpp_maybe" },
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
