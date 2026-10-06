/**
 * BillFlow Demo Mode Controller (Renderer & Client)
 *
 * Financial integrity guarantee:
 * Automatic business sample seeding is strictly DISABLED outside an explicit demo mode.
 * The application operates on real records only. When real records do not exist,
 * metrics and deliverables are clearly marked as unavailable rather than fabricated.
 */

export function isDemoMode(): boolean {
  if (typeof process !== "undefined" && (process.env?.BILLFLOW_DEMO_MODE === "1" || process.env?.DEMO_MODE === "1")) {
    return true;
  }
  if (typeof window !== "undefined") {
    try {
      const search = window.location?.search;
      if (search && (new URLSearchParams(search).get("demo") === "true" || new URLSearchParams(search).get("demo") === "1")) {
        return true;
      }
      if (window.localStorage?.getItem("billflow_demo_mode") === "true") {
        return true;
      }
    } catch {
      // In restricted sandbox or test environments
    }
  }
  return false;
}
