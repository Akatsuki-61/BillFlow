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

  it("removes Workspace Insights from Overview and preserves scoped profile layouts", () => {
    const storage = storedPreferences({
      billflow_dashboard_widgets_v5_studio: '["sprint-tasks","workspace-insights","net-profit"]',
      billflow_analytics_widgets_v3_studio: '["paid-ratio"]',
      billflow_widget_sizes_v5_studio: '{"net-profit":"compact","workspace-insights":"normal"}',
    });
    expect(loadWidgetPreferences(storage, "studio")).toEqual({
      dashboardWidgets: ["sprint-tasks", "net-profit"],
      analyticsWidgets: ["paid-ratio"],
      widgetSizes: { "net-profit": "compact", "workspace-insights": "normal" },
    });
    expect(DEFAULT_DASHBOARD_WIDGET_IDS).not.toContain("workspace-insights");
    expect(DEFAULT_DASHBOARD_WIDGET_IDS).toHaveLength(5);
  });

  it("respects intentionally empty v5 preferences instead of restoring old selections", () => {
    const storage = storedPreferences({
      billflow_dashboard_widgets_v2: '["net-profit"]',
      billflow_dashboard_widgets_v4: '["total-revenue"]',
      billflow_dashboard_widgets_v5: "[]",
      billflow_analytics_widgets_v3: '["paid-ratio"]',
      billflow_analytics_widgets_v5: "[]",
      billflow_widget_sizes_v2: '{"net-profit":"compact"}',
      billflow_widget_sizes_v5: "{}",
    });
    expect(loadWidgetPreferences(storage)).toEqual({
      dashboardWidgets: [], analyticsWidgets: [], widgetSizes: {},
    });
  });

  it("recovers malformed preferences independently from valid older values", () => {
    const storage = storedPreferences({
      billflow_dashboard_widgets_v5: "{broken",
      billflow_dashboard_widgets_v4: "not-json",
      billflow_dashboard_widgets_v3: '[42]',
      billflow_dashboard_widgets_v2: '["net-profit"]',
      billflow_analytics_widgets_v5: '["paid-ratio"]',
      billflow_widget_sizes_v5: '{"net-profit":"invalid"}',
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

  it("upgrades both legacy 8-card default layouts to the 6-card Zentra bento while keeping resized layouts", () => {
    const previousDefaultV3 = [
      "total-revenue", "net-profit", "pending-receivables", "active-clients",
      "profit-trajectory-chart", "revenue-expenses-chart", "sprint-tasks", "recent-invoices",
    ];
    const previousDefaultV4 = [
      "total-revenue", "collected-revenue", "pending-receivables", "net-profit",
      "cash-flow", "collection-rate-gauge", "recent-invoices", "active-clients",
    ];
    const storage = storedPreferences({
      [WIDGET_STORAGE_KEYS.dashboard]: JSON.stringify(previousDefaultV3),
    });
    expect(loadWidgetPreferences(storage).dashboardWidgets).toEqual(DEFAULT_DASHBOARD_WIDGET_IDS);

    const storageV4 = storedPreferences({
      billflow_dashboard_widgets_v4: JSON.stringify(previousDefaultV4),
    });
    expect(loadWidgetPreferences(storageV4).dashboardWidgets).toEqual(DEFAULT_DASHBOARD_WIDGET_IDS);

    storage.values.set(WIDGET_STORAGE_KEYS.sizes, '{"net-profit":"compact"}');
    expect(loadWidgetPreferences(storage).dashboardWidgets).toEqual(previousDefaultV3);
  });
});
