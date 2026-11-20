import { describe, expect, it } from "vitest";
import {
  getTourStatus,
  saveTourStatus,
  TOUR_STEPS,
} from "../onboarding-tour";

function mockStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe("Workspace tour", () => {
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

  it("saves tour completion and dismissal separately for each profile", () => {
    const storage = mockStorage();
    expect(getTourStatus("default", storage)).toBeNull();
    saveTourStatus("default", "completed", storage);
    saveTourStatus("ai-profile", "dismissed", storage);
    expect(getTourStatus("default", storage)).toBe("completed");
    expect(getTourStatus("ai-profile", storage)).toBe("dismissed");
    expect(getTourStatus("consulting", storage)).toBeNull();
  });

  it("retains completion and dismissal from earlier versions", () => {
    const storage = mockStorage();
    storage.setItem("billflow_tour_completed_v1_default", "1");
    storage.setItem("billflow_quickstart_dismissed_v1_ai-profile", "1");

    expect(getTourStatus("default", storage)).toBe("completed");
    expect(getTourStatus("ai-profile", storage)).toBe("dismissed");

    saveTourStatus("ai-profile", "completed", storage);
    expect(getTourStatus("ai-profile", storage)).toBe("completed");
  });
});
