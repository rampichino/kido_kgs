// @flow

// Three main themes: light (default, no body class), mid (warm "dune" mid-tone),
// and dark. Persisted under kido_theme. The legacy kido_dark_mode key is kept in
// sync so any older code / first-paint script that reads it still works.

export type Theme = "light" | "mid" | "dark";

const THEME_KEY = "kido_theme";
const LEGACY_DARK_KEY = "kido_dark_mode";
const ORDER: Array<Theme> = ["light", "mid", "dark"];

export function getTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "mid" || v === "dark") {
      return v;
    }
    // Fall back to the legacy boolean key for users upgrading.
    if (localStorage.getItem(LEGACY_DARK_KEY) === "1") {
      return "dark";
    }
  } catch (e) {
    // ignore
  }
  return "light";
}

// Themes that use light-on-dark text (i.e. the chat avatar palette, native
// color-scheme, UI-color dark overrides should behave "dark"). The mid theme is
// a light-leaning warm tone with dark text, so it behaves LIGHT here — only true
// dark mode is darkish.
export function isDarkish(theme?: Theme): boolean {
  const t = theme || getTheme();
  return t === "dark";
}

export function applyTheme(theme: Theme) {
  const body = document.body;
  if (!body) {
    return;
  }
  body.classList.remove("dark-mode", "mid-mode");
  if (theme === "dark") {
    body.classList.add("dark-mode");
  } else if (theme === "mid") {
    body.classList.add("mid-mode");
  }
  if (document.documentElement) {
    document.documentElement.style.setProperty(
      "color-scheme",
      isDarkish(theme) ? "dark" : "light"
    );
  }
  try {
    localStorage.setItem(THEME_KEY, theme);
    localStorage.setItem(LEGACY_DARK_KEY, theme === "dark" ? "1" : "0");
  } catch (e) {
    // ignore
  }
}

export function nextTheme(theme: Theme): Theme {
  const i = ORDER.indexOf(theme);
  return ORDER[(i + 1) % ORDER.length];
}
