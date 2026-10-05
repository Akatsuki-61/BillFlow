"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { isThemePreference, resolveTheme, THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme";

const ThemeContext = createContext<{
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  ready: boolean;
} | null>(null);

let sessionPreference: ThemePreference | null = null;

function getPreference(): ThemePreference {
  if (sessionPreference) return sessionPreference;
  try {
    const saved = window.billflow?.theme?.initialPreference ?? localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(saved)) return saved;
  } catch { /* System preference still works when storage is blocked. */ }
  return "system";
}

function subscribe(callback: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      sessionPreference = isThemePreference(event.newValue) ? event.newValue : "system";
      callback();
    }
  };
  window.addEventListener("billflow:theme", callback);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener("billflow:theme", callback);
    window.removeEventListener("storage", storage);
  };
}

function setPreference(value: ThemePreference) {
  if (!isThemePreference(value)) return;
  sessionPreference = value;
  try { localStorage.setItem(THEME_STORAGE_KEY, value); } catch { /* Keep the current session usable. */ }
  window.dispatchEvent(new Event("billflow:theme"));
}

const serverSnapshot = () => null;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // The null server snapshot keeps the selector consistent during hydration.
  const saved = useSyncExternalStore(subscribe, getPreference, serverSnapshot);
  const preference = saved ?? "system";

  useEffect(() => {
    if (saved === null) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const theme = resolveTheme(preference, media.matches);
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    };
    apply();
    void window.billflow?.theme?.setPreference(preference).catch(console.error);
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preference, saved]);

  return <ThemeContext.Provider value={{ preference, setPreference, ready: saved !== null }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
