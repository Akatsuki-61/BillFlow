import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import {
  isThemePreference,
  isAccentPreference,
  resolveTheme,
  themeBootstrap,
  THEME_STORAGE_KEY,
  ACCENT_STORAGE_KEY,
  type AccentPreference,
} from "../theme";

function bootstrap(
  saved: unknown,
  systemDark: boolean,
  options: { blocked?: boolean; desktop?: unknown; accent?: unknown } = {},
) {
  const root = { dataset: {} as Record<string, string>, style: { colorScheme: "" } };
  runInNewContext(themeBootstrap, {
    window: options.desktop === undefined ? {} : { billflow: { theme: { initialPreference: options.desktop } } },
    document: { documentElement: root },
    localStorage: {
      getItem: (key: string) => {
        if (options.blocked) throw new Error("Blocked");
        if (key === ACCENT_STORAGE_KEY && options.accent !== undefined) return options.accent;
        if (key === THEME_STORAGE_KEY) return saved;
        return saved;
      },
    },
    matchMedia: () => ({ matches: systemDark }),
  });
  return root;
}

describe("theme startup", () => {
  it.each(["light", "dark"] as const)("preserves explicit %s despite the OS preference", (preference) => {
    for (const osDark of [true, false]) {
      expect(resolveTheme(preference, osDark)).toBe(preference);
      expect(bootstrap(preference, osDark).dataset.theme).toBe(preference);
    }
  });
  it.each([true, false])("follows the OS when systemDark=%s", (osDark) => {
    for (const saved of [null, "system", "invalid"]) {
      const root = bootstrap(saved, osDark);
      expect(root.dataset.theme).toBe(osDark ? "dark" : "light");
      expect(root.style.colorScheme).toBe(root.dataset.theme);
    }
  });
  it("falls back to the OS if storage is blocked", () => {
    expect(bootstrap(null, true, { blocked: true }).dataset.theme).toBe("dark");
  });
  it("uses the persisted desktop preference before first paint", () => {
    expect(bootstrap("light", false, { desktop: "dark", blocked: true }).dataset.theme).toBe("dark");
  });
  it("rejects unrecognized IPC/storage preference values", () => {
    for (const value of [null, undefined, {}, "auto", "", 1]) expect(isThemePreference(value)).toBe(false);
    for (const value of ["light", "dark", "system"]) expect(isThemePreference(value)).toBe(true);
  });
  it("validates accent preference options", () => {
    for (const value of ["purple", "blue", "emerald", "rose", "amber", "indigo"] as AccentPreference[]) {
      expect(isAccentPreference(value)).toBe(true);
    }
    for (const value of [null, undefined, "red", "green", "violet", 123, {}]) {
      expect(isAccentPreference(value)).toBe(false);
    }
  });
  it("bootstraps saved accent or defaults to purple", () => {
    expect(bootstrap("light", false, { accent: "emerald" }).dataset.accent).toBe("emerald");
    expect(bootstrap("light", false, { accent: "blue" }).dataset.accent).toBe("blue");
    expect(bootstrap("light", false, { accent: "unknown" }).dataset.accent).toBe("purple");
    expect(bootstrap("light", false, { blocked: true }).dataset.accent).toBe("purple");
  });
});

