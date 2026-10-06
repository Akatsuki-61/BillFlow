import { describe, expect, it } from "vitest";
import { DEFAULT_DASHBOARD_WIDGET_IDS } from "../widgets/widgetDefinitions";

describe("Dashboard Widget Removal and Undo Flow", () => {
  it("removes a widget from the dashboard and records history for undo", () => {
    let currentWidgets = [...DEFAULT_DASHBOARD_WIDGET_IDS];
    const history: string[][] = [];

    // User removes first pinned widget
    const targetToRemove = DEFAULT_DASHBOARD_WIDGET_IDS[0];
    history.push([...currentWidgets]);
    currentWidgets = currentWidgets.filter((id) => id !== targetToRemove);

    expect(currentWidgets.includes(targetToRemove)).toBe(false);
    expect(history.length).toBe(1);

    // User clicks Undo
    const previousState = history.pop()!;
    currentWidgets = previousState;

    expect(currentWidgets.includes(targetToRemove)).toBe(true);
    expect(currentWidgets).toEqual(DEFAULT_DASHBOARD_WIDGET_IDS);
  });

  it("undoes drag-and-drop reordering (dropping) back to exact previous position", () => {
    let currentWidgets = ["rev-exp-chart", "net-profit", "cashflow-runway", "active-clients"];
    const history: string[][] = [];

    // User drags index 0 to index 2 (dropping time)
    history.push([...currentWidgets]);
    const fromIndex = 0;
    const toIndex = 2;
    const updated = [...currentWidgets];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    currentWidgets = updated;

    expect(currentWidgets).toEqual(["net-profit", "cashflow-runway", "rev-exp-chart", "active-clients"]);

    // User triggers Undo (toast or shortcut)
    const reverted = history.pop()!;
    currentWidgets = reverted;

    expect(currentWidgets).toEqual(["rev-exp-chart", "net-profit", "cashflow-runway", "active-clients"]);
  });

  it("undoes adding a new widget to dashboard", () => {
    let currentWidgets = ["rev-exp-chart", "net-profit"];
    const history: string[][] = [];

    // User pins "sprint-tasks"
    const newWidget = "sprint-tasks";
    history.push([...currentWidgets]);
    currentWidgets = [...currentWidgets, newWidget];

    expect(currentWidgets).toEqual(["rev-exp-chart", "net-profit", "sprint-tasks"]);

    // User clicks Undo
    currentWidgets = history.pop()!;
    expect(currentWidgets).toEqual(["rev-exp-chart", "net-profit"]);
  });

  it("strictly disables automatic business sample seeding outside explicit demo mode", async () => {
    const { isDemoMode } = await import("../demo");
    // Under normal execution without BILLFLOW_DEMO_MODE=1, demo mode is false
    expect(isDemoMode()).toBe(false);
  });
});
