import { describe, expect, it } from "vitest";
import { readBrowserPreferences } from "../data/browserStorage";
import type { AppSettings } from "@/types/settings";
import type { VendorItem } from "@/types/outsourcing";

const defaults = { defaultCurrency: "USD" } as AppSettings;
const vendor: VendorItem = {
  id: "vendor-test", name: "Test Vendor", service: "Design",
  currentBalance: 125, status: "PENDING", iconType: "design",
};

function browserStorage() {
  const entries = new Map<string, string>();
  return { entries, getItem: (key: string) => entries.get(key) ?? null };
}

describe("browser data snapshots", () => {
  it("clears cached vendors when the persisted directory becomes empty", () => {
    const storage = browserStorage();
    storage.entries.set("billflow_outsourcing_vendors", JSON.stringify([vendor]));
    const saved = readBrowserPreferences(defaults, [], storage);
    expect(saved.vendors).toEqual([vendor]);

    storage.entries.set("billflow_outsourcing_vendors", "[]");
    expect(readBrowserPreferences(saved.settings, saved.vendors, storage).vendors).toEqual([]);
  });

  it("keeps loading usable when saved JSON is corrupt", () => {
    const storage = browserStorage();
    storage.entries.set("billflow_memory_settings", "{invalid-json");
    storage.entries.set("billflow_outsourcing_vendors", "{invalid-json");
    const saved = readBrowserPreferences(defaults, [vendor], storage);
    expect(saved.vendors).toEqual([vendor]);
    expect(saved.settings).toEqual(defaults);
  });
});
