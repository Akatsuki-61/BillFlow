export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "billflow_theme";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  return preference === "system" ? (systemDark ? "dark" : "light") : preference;
}

// Runs before first paint, including in the statically exported Electron renderer.
export const themeBootstrap = `(()=>{let p="system";try{const saved=window.billflow?.theme?.initialPreference??localStorage.getItem("${THEME_STORAGE_KEY}");if(saved==="light"||saved==="dark"||saved==="system")p=saved}catch{}const t=p==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p;document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t})()`;
