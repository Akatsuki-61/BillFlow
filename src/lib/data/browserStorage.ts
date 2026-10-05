import type { AppSettings } from "@/types/settings";
import type { VendorItem } from "@/types/outsourcing";

export function readBrowserPreferences(
  settings: AppSettings,
  vendors: VendorItem[],
  storage: Pick<Storage, "getItem">,
) {
  const storedSettings = storage.getItem("billflow_memory_settings");
  if (storedSettings) {
    try {
      settings = { ...settings, ...JSON.parse(storedSettings) };
    } catch {
      // Keep the current preferences when stored JSON is corrupt.
    }
  }
  const storedVendors = storage.getItem("billflow_outsourcing_vendors");
  if (storedVendors) {
    try {
      const parsed: unknown = JSON.parse(storedVendors);
      if (Array.isArray(parsed)) vendors = parsed;
    } catch {
      // Keep the current directory when stored JSON is corrupt.
    }
  }
  return { settings, vendors };
}
