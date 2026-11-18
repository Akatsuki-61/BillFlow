import { describe, expect, it } from "vitest";
import {
  TOUR_STEPS,
  getQuickStartProgress,
  isTourCompleted,
  markTourCompleted,
  resetTourCompleted,
  isQuickStartDismissed,
  dismissQuickStart,
} from "../onboarding-tour";

function mockStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

describe("Onboarding Tour & Quick-Start Progress", () => {
  it("defines 5 clean, route-backed tour steps targeting existing navigation anchors", () => {
    expect(TOUR_STEPS.length).toBe(5);
    for (const step of TOUR_STEPS) {
      expect(step.id).toBeTruthy();
      expect(step.title.length).toBeGreaterThan(3);
      expect(step.body.length).toBeGreaterThan(10);
      expect(step.route.startsWith("/")).toBe(true);
      expect(step.targetSelector).toMatch(/^\[data-tour=/);
    }
  });

  it("tracks 0/4 through 4/4 quick-start completion cleanly", () => {
    const empty = getQuickStartProgress({
      businessName: "",
      clientsCount: 0,
      catalogCount: 0,
      invoicesCount: 0,
      tasksCount: 0,
    });
    expect(empty.completedCount).toBe(0);
    expect(empty.totalCount).toBe(4);
    expect(empty.isComplete).toBe(false);

    const partial = getQuickStartProgress({
      businessName: "Northwind Engineering",
      clientsCount: 1,
      catalogCount: 0,
      invoicesCount: 0,
      tasksCount: 0,
    });
    expect(partial.completedCount).toBe(2);
    expect(partial.isComplete).toBe(false);
    expect(partial.steps.find((s) => s.id === "profile")?.done).toBe(true);
    expect(partial.steps.find((s) => s.id === "client-or-catalog")?.done).toBe(true);
    expect(partial.steps.find((s) => s.id === "invoice")?.done).toBe(false);

    const done = getQuickStartProgress({
      businessName: "Northwind Engineering",
      clientsCount: 0,
      catalogCount: 3,
      invoicesCount: 1,
      tasksCount: 2,
    });
    expect(done.completedCount).toBe(4);
    expect(done.isComplete).toBe(true);
  });

  it("scopes tour completion and quick-start dismissal per profile", () => {
    const storage = mockStorage();
    expect(isTourCompleted("default", storage)).toBe(false);
    expect(isTourCompleted("ai-profile", storage)).toBe(false);

    markTourCompleted("default", storage);
    expect(isTourCompleted("default", storage)).toBe(true);
    expect(isTourCompleted("ai-profile", storage)).toBe(false);

    resetTourCompleted("default", storage);
    expect(isTourCompleted("default", storage)).toBe(false);

    expect(isQuickStartDismissed("default", storage)).toBe(false);
    dismissQuickStart("default", storage);
    expect(isQuickStartDismissed("default", storage)).toBe(true);
    expect(isQuickStartDismissed("ai-profile", storage)).toBe(false);
  });
});
