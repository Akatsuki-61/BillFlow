import { describe, expect, it } from "vitest";
import {
  formatShortcut,
  formatShortcutText,
  isMacPlatform,
} from "../platform-shortcuts";

describe("platform-aware shortcut labels", () => {
  it("detects macOS vs Windows/Linux platforms", () => {
    expect(isMacPlatform("darwin")).toBe(true);
    expect(isMacPlatform("MacIntel")).toBe(true);
    expect(isMacPlatform("win32")).toBe(false);
    expect(isMacPlatform("linux")).toBe(false);
    expect(isMacPlatform(null)).toBe(true);
  });

  it("formats standalone shortcuts for macOS and Windows/Linux", () => {
    expect(formatShortcut("Cmd+K", true)).toBe("⌘K");
    expect(formatShortcut("Cmd+K", false)).toBe("Ctrl+K");
    expect(formatShortcut("Cmd/Ctrl + S", true)).toBe("⌘S");
    expect(formatShortcut("Cmd/Ctrl + S", false)).toBe("Ctrl+S");
    expect(formatShortcut("Alt+1", true)).toBe("⌥1");
    expect(formatShortcut("Alt+1", false)).toBe("Alt+1");
  });

  it("formats inline shortcut hints inside instructional prose", () => {
    const copy =
      "Jump anywhere with Cmd+K, press Alt+1..7, or hit Cmd/Ctrl+Z and Cmd+/.";
    expect(formatShortcutText(copy, true)).toBe(
      "Jump anywhere with ⌘K, press ⌥1..7, or hit ⌘Z and ⌘/.",
    );
    expect(formatShortcutText(copy, false)).toBe(
      "Jump anywhere with Ctrl+K, press Alt+1..7, or hit Ctrl+Z and Ctrl+/.",
    );
  });
});
