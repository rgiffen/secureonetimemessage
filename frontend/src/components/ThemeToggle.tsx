import { useEffect, useState } from "react";
import { getCurrentTheme, toggleTheme, type Theme } from "../theme";

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    setThemeState(getCurrentTheme());
  }, []);

  function onClick() {
    toggleTheme();
    setThemeState(getCurrentTheme());
  }

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="w-9 h-9 flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors rounded-full"
    >
      <span className="material-symbols-outlined text-[1.2rem]">
        {isDark ? "light_mode" : "dark_mode"}
      </span>
    </button>
  );
}
