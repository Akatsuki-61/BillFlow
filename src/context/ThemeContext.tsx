"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import {
  isThemePreference,
  isAccentPreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT,
  type ThemePreference,
  type AccentPreference,
} from "@/lib/theme";

const ThemeContext = createContext<{
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  accent: AccentPreference;
  setAccent: (accent: AccentPreference) => void;
  ready: boolean;
} | null>(null);

let sessionPreference: ThemePreference | null = null;
let sessionAccent: AccentPreference | null = null;

function getPreference(): ThemePreference {
  if (sessionPreference) return sessionPreference;
  try {
    const saved = window.billflow?.theme?.initialPreference ?? localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(saved)) return saved;
  } catch { /* System preference still works when storage is blocked. */ }
  return "system";
}

function getAccent(): AccentPreference {
  if (sessionAccent) return sessionAccent;
  try {
    const saved = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (isAccentPreference(saved)) return saved;
  } catch { /* Default accent remains usable. */ }
  return DEFAULT_ACCENT;
}

function subscribe(callback: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      sessionPreference = isThemePreference(event.newValue) ? event.newValue : "system";
      callback();
    }
    if (event.key === ACCENT_STORAGE_KEY || event.key === null) {
      sessionAccent = isAccentPreference(event.newValue) ? event.newValue : DEFAULT_ACCENT;
      callback();
    }
  };
  window.addEventListener("billflow:theme", callback);
  window.addEventListener("billflow:accent", callback);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener("billflow:theme", callback);
    window.removeEventListener("billflow:accent", callback);
    window.removeEventListener("storage", storage);
  };
}

function setPreference(value: ThemePreference) {
  if (!isThemePreference(value)) return;
  sessionPreference = value;
  try { localStorage.setItem(THEME_STORAGE_KEY, value); } catch { /* Keep the current session usable. */ }
  window.dispatchEvent(new Event("billflow:theme"));
}

function setAccent(value: AccentPreference) {
  if (!isAccentPreference(value)) return;
  sessionAccent = value;
  try { localStorage.setItem(ACCENT_STORAGE_KEY, value); } catch { /* Keep current session usable. */ }
  document.documentElement.dataset.accent = value;
  window.dispatchEvent(new Event("billflow:accent"));
}

const serverSnapshot = () => null;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // The null server snapshot keeps the selector consistent during hydration.
  const saved = useSyncExternalStore(subscribe, getPreference, serverSnapshot);
  const preference = saved ?? "system";
  const savedAccent = useSyncExternalStore(subscribe, getAccent, () => DEFAULT_ACCENT);
  const accent = savedAccent ?? DEFAULT_ACCENT;

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

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  return (
    <ThemeContext.Provider
      value={{
        preference,
        setPreference,
        accent,
        setAccent,
        ready: saved !== null,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
