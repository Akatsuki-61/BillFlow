import { describe, expect, it } from "vitest";
import { loadWidgetPreferences, WIDGET_STORAGE_KEYS } from "../widgets/widgetStorage";
import {
  DEFAULT_ANALYTICS_WIDGET_IDS,
  DEFAULT_DASHBOARD_WIDGET_IDS,
} from "../widgets/widgetDefinitions";

function storedPreferences(entries: Record<string, string> = {}) {
  const values = new Map(Object.entries(entries));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
  };
}

describe("Widget preference upgrades", () => {
  it("preserves main's v2 layout, hidden analytics widgets and sizes after upgrading and restarting", () => {
    const storage = storedPreferences({
      billflow_dashboard_widgets_v2: '["sprint-tasks","net-profit"]',
      billflow_analytics_widgets_v2: '["paid-ratio"]',
      billflow_widget_sizes_v2: '{"net-profit":"compact"}',
    });
    const upgraded = loadWidgetPreferences(storage);
    expect(upgraded).toEqual({
      dashboardWidgets: ["sprint-tasks", "net-profit"],
      analyticsWidgets: ["paid-ratio"],
      widgetSizes: { "net-profit": "compact" },
    });

    // The provider persists these values to v4 after loading them.
    storage.values.set(WIDGET_STORAGE_KEYS.dashboard, JSON.stringify(upgraded.dashboardWidgets));
    storage.values.set(WIDGET_STORAGE_KEYS.analytics, JSON.stringify(upgraded.analyticsWidgets));
    storage.values.set(WIDGET_STORAGE_KEYS.sizes, JSON.stringify(upgraded.widgetSizes));
    storage.values.set("billflow_dashboard_widgets_v2", "[]");
    expect(loadWidgetPreferences(storage)).toEqual(upgraded);
  });

  it("loads v3 preferences before v2 without inserting unselected widgets", () => {
    const storage = storedPreferences({
      billflow_dashboard_widgets_v2: '["total-revenue"]',
      billflow_dashboard_widgets_v3: '["net-profit"]',
      billflow_analytics_widgets_v3: '["sprint-tasks"]',
      billflow_widget_sizes_v3: '{"sprint-tasks":"compact"}',
    });
    expect(loadWidgetPreferences(storage)).toEqual({
      dashboardWidgets: ["net-profit"],
      analyticsWidgets: ["sprint-tasks"],
      widgetSizes: { "sprint-tasks": "compact" },
    });
  });

  it("respects intentionally empty v4 preferences instead of restoring old selections", () => {
    const storage = storedPreferences({
      billflow_dashboard_widgets_v2: '["net-profit"]',
      billflow_dashboard_widgets_v4: "[]",
      billflow_analytics_widgets_v3: '["paid-ratio"]',
      billflow_analytics_widgets_v4: "[]",
      billflow_widget_sizes_v2: '{"net-profit":"compact"}',
      billflow_widget_sizes_v4: "{}",
    });
    expect(loadWidgetPreferences(storage)).toEqual({
      dashboardWidgets: [], analyticsWidgets: [], widgetSizes: {},
    });
  });

  it("recovers malformed preferences independently from valid older values", () => {
    const storage = storedPreferences({
      billflow_dashboard_widgets_v4: "{broken",
      billflow_dashboard_widgets_v3: '[42]',
      billflow_dashboard_widgets_v2: '["net-profit"]',
      billflow_analytics_widgets_v4: '["paid-ratio"]',
      billflow_widget_sizes_v4: '{"net-profit":"invalid"}',
      billflow_widget_sizes_v2: '{"net-profit":"normal"}',
    });
    expect(loadWidgetPreferences(storage)).toEqual({
      dashboardWidgets: ["net-profit"],
      analyticsWidgets: ["paid-ratio"],
      widgetSizes: { "net-profit": "normal" },
    });
  });

  it("uses the reworked defaults for a new installation or unavailable storage", () => {
    const defaults = {
      dashboardWidgets: DEFAULT_DASHBOARD_WIDGET_IDS,
      analyticsWidgets: DEFAULT_ANALYTICS_WIDGET_IDS,
      widgetSizes: {},
    };
    expect(loadWidgetPreferences(storedPreferences())).toEqual(defaults);
    expect(loadWidgetPreferences({ getItem: () => { throw new Error("Unavailable"); } })).toEqual(defaults);
  });
});
