"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

function browserPlatform(): string | null {
  if (typeof window === "undefined") return null;
  if (window.billflow?.platform) return window.billflow.platform;
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  return nav.userAgentData?.platform || navigator.platform || null;
}

export function isMacPlatform(platform?: string | null): boolean {
  if (!platform) return true;
  return /mac|darwin/i.test(platform);
}

export function useIsMac(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => isMacPlatform(browserPlatform()),
    () => true,
  );
}

export function formatShortcut(shortcut: string, isMac: boolean): string {
  const normalized = shortcut
    .replace(/\bCmd\/Ctrl\s*\+\s*/gi, isMac ? "⌘" : "Ctrl+")
    .replace(/\bCmd\s*\+\s*/gi, isMac ? "⌘" : "Ctrl+")
    .replace(/\bAlt\s*\+\s*/gi, isMac ? "⌥" : "Alt+");
  return isMac ? normalized : normalized;
}

export function formatShortcutText(text: string, isMac: boolean): string {
  if (isMac) {
    return text
      .replace(/\bCmd\/Ctrl\+([^\s,.)]+)/gi, "⌘$1")
      .replace(/\bCmd\+([^\s,.)]+)/gi, "⌘$1")
      .replace(/\bAlt\+([^\s,.)]+)/gi, "⌥$1");
  }
  return text
    .replace(/\bCmd\/Ctrl\+([^\s,.)]+)/gi, "Ctrl+$1")
    .replace(/\bCmd\+([^\s,.)]+)/gi, "Ctrl+$1");
}
