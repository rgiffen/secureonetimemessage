export type Theme = "light" | "dark";

const STORAGE_KEY = "securedrop.theme";

export function getCurrentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // storage blocked; in-memory toggle still applies for this tab
  }
}

export function toggleTheme() {
  setTheme(getCurrentTheme() === "dark" ? "light" : "dark");
}
