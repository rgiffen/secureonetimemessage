import type { Config } from "tailwindcss";

function v(name: string) {
  return `rgb(var(--color-${name}) / <alpha-value>)`;
}

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: v("background"),
        "on-background": v("on-background"),
        "on-surface": v("on-surface"),
        "on-surface-variant": v("on-surface-variant"),
        surface: v("surface"),
        "surface-container-lowest": v("surface-container-lowest"),
        "surface-container-low": v("surface-container-low"),
        "surface-container": v("surface-container"),
        "surface-container-high": v("surface-container-high"),
        "surface-container-highest": v("surface-container-highest"),
        "surface-dim": v("surface-dim"),
        "surface-bright": v("surface-bright"),
        primary: v("primary"),
        "primary-dim": v("primary-dim"),
        "primary-container": v("primary-container"),
        "on-primary": v("on-primary"),
        "on-primary-container": v("on-primary-container"),
        secondary: v("secondary"),
        "secondary-container": v("secondary-container"),
        tertiary: v("tertiary"),
        "tertiary-dim": v("tertiary-dim"),
        outline: v("outline"),
        "outline-variant": v("outline-variant"),
        error: v("error"),
        "error-container": v("error-container"),
        "on-error": v("on-error"),
        "on-error-container": v("on-error-container"),

        "banner-info-bg": v("banner-info-bg"),
        "banner-info-fg": v("banner-info-fg"),
        "banner-info-body": v("banner-info-body"),
        "banner-info-icon": v("banner-info-icon"),
        "banner-warning-bg": v("banner-warning-bg"),
        "banner-warning-fg": v("banner-warning-fg"),
        "banner-warning-body": v("banner-warning-body"),
        "banner-warning-icon": v("banner-warning-icon"),
        "banner-error-bg": v("banner-error-bg"),
        "banner-error-fg": v("banner-error-fg"),
        "banner-error-body": v("banner-error-body"),
        "banner-error-icon": v("banner-error-icon"),
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        full: "0.75rem",
      },
      fontFamily: {
        headline: ["Inter", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        label: ["Space Grotesk", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
