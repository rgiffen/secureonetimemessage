import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#f9f9f9",
        "on-background": "#2d3435",
        "on-surface": "#2d3435",
        "on-surface-variant": "#5a6061",
        surface: "#f9f9f9",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f2f4f4",
        "surface-container": "#ebeeef",
        "surface-container-high": "#e4e9ea",
        "surface-container-highest": "#dde4e5",
        "surface-dim": "#d3dbdd",
        primary: "#455f88",
        "primary-dim": "#39537c",
        "primary-container": "#d6e3ff",
        "on-primary": "#f6f7ff",
        "on-primary-container": "#38527b",
        secondary: "#5d5f65",
        "secondary-container": "#e1e2e9",
        tertiary: "#5d5d78",
        "tertiary-dim": "#51516c",
        outline: "#757c7d",
        "outline-variant": "#adb3b4",
        error: "#9f403d",
        "error-container": "#fe8983",
        "on-error": "#fff7f6",
        "on-error-container": "#752121",
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
