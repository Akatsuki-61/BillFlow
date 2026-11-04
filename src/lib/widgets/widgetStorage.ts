import type { WidgetDisplaySize } from "@/types/widgets";
import {
  DEFAULT_ANALYTICS_WIDGET_IDS,
  DEFAULT_DASHBOARD_WIDGET_IDS,
} from "./widgetDefinitions";

export const WIDGET_STORAGE_KEYS = {
  dashboard: "billflow_dashboard_widgets_v4",
  analytics: "billflow_analytics_widgets_v4",
  sizes: "billflow_widget_sizes_v4",
} as const;

export function getScopedWidgetStorageKeys(profileId?: string) {
  if (!profileId || profileId === "default") return WIDGET_STORAGE_KEYS;
  return {
    dashboard: `${WIDGET_STORAGE_KEYS.dashboard}_${profileId}`,
    analytics: `${WIDGET_STORAGE_KEYS.analytics}_${profileId}`,
    sizes: `${WIDGET_STORAGE_KEYS.sizes}_${profileId}`,
  };
}

type PreferenceStorage = Pick<Storage, "getItem">;

function readPreference<T>(
  storage: PreferenceStorage,
  key: string,
  isValid: (value: unknown) => value is T,
  fallback: T,
): T {
  // Current preferences win; otherwise recover the latest valid older version.
  for (const version of [4, 3, 2]) {
    try {
      const candidateKey = key.includes("_v4")
        ? key.replace("_v4", `_v${version}`)
        : key;
      const stored = storage.getItem(candidateKey);
      if (stored === null) continue;
      const parsed: unknown = JSON.parse(stored);
      if (isValid(parsed)) return parsed;
    } catch {
      // One malformed preference must not discard the other saved settings.
    }
  }
  return fallback;
}

function isWidgetList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((id) => typeof id === "string");
}

function isWidgetSizes(value: unknown): value is Record<string, WidgetDisplaySize> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((size) => size === "compact" || size === "normal")
  );
}

export function loadWidgetPreferences(storage: PreferenceStorage, profileId?: string) {
  const keys = getScopedWidgetStorageKeys(profileId);
  return {
    dashboardWidgets: readPreference(
      storage, keys.dashboard, isWidgetList,
      [...DEFAULT_DASHBOARD_WIDGET_IDS],
    ),
    analyticsWidgets: readPreference(
      storage, keys.analytics, isWidgetList,
      [...DEFAULT_ANALYTICS_WIDGET_IDS],
    ),
    widgetSizes: readPreference(
      storage, keys.sizes, isWidgetSizes, {},
    ),
  };
}
