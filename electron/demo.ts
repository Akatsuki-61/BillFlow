/**
 * BillFlow Demo Mode Controller (Electron Main Process)
 *
 * Financial integrity guarantee:
 * Automatic business sample seeding is strictly DISABLED outside an explicit demo mode.
 * The production desktop shell and standard development runs always start with a clean slate
 * containing zero synthetic clients, invoices, vendors, or tasks.
 */

export function isDemoMode(): boolean {
  return (
    process.env.BILLFLOW_DEMO_MODE === "1" ||
    process.env.DEMO_MODE === "1" ||
    process.argv.includes("--demo")
  );
}
