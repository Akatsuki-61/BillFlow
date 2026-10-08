export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";
export type AccentPreference =
  | "purple"
  | "blue"
  | "emerald"
  | "rose"
  | "amber"
  | "indigo";

export const THEME_STORAGE_KEY = "billflow_theme";
export const ACCENT_STORAGE_KEY = "billflow_accent";
export const DEFAULT_ACCENT: AccentPreference = "purple";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function isAccentPreference(value: unknown): value is AccentPreference {
  return (
    value === "purple" ||
    value === "blue" ||
    value === "emerald" ||
    value === "rose" ||
    value === "amber" ||
    value === "indigo"
  );
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  return preference === "system" ? (systemDark ? "dark" : "light") : preference;
}

// Runs before first paint, including in the statically exported Electron renderer.
export const themeBootstrap = `(()=>{let p="system";try{const saved=window.billflow?.theme?.initialPreference??localStorage.getItem("${THEME_STORAGE_KEY}");if(saved==="light"||saved==="dark"||saved==="system")p=saved}catch{}const t=p==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p;document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;try{const a=localStorage.getItem("${ACCENT_STORAGE_KEY}");document.documentElement.dataset.accent=(a==="purple"||a==="blue"||a==="emerald"||a==="rose"||a==="amber"||a==="indigo")?a:"purple"}catch{document.documentElement.dataset.accent="purple"}})()`;
