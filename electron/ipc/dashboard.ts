import { ipcMain } from "electron";
import { getDb } from "../db";
import { clients, invoices } from "../db/schema";
import { formatError } from "./errors";
import { listInvoicesWithClient } from "./invoices";
import { DashboardSummary } from "../../src/types/billing";

export function getDashboardSummary(): DashboardSummary {
  const db = getDb();
  const allClients = db.select().from(clients).all();
  const allInvoices = listInvoicesWithClient();

  const totalBilledByCurrency: Record<string, number> = {};
  const outstandingByCurrency: Record<string, number> = {};
  let unpaidCount = 0;

  for (const inv of allInvoices) {
    const cur = inv.currency || "USD";
    if (inv.status !== "DRAFT") {
      totalBilledByCurrency[cur] = (totalBilledByCurrency[cur] || 0) + inv.amountCents;
      const unpaidPortion = Math.max(0, inv.amountCents - inv.paidCents);
      if (unpaidPortion > 0) {
        outstandingByCurrency[cur] = (outstandingByCurrency[cur] || 0) + unpaidPortion;
        unpaidCount += 1;
      }
    }
  }

  const recentInvoices = allInvoices.slice(0, 5);

  return {
    activeClients: allClients.length,
    unpaidCount,
    totalBilledByCurrency,
    outstandingByCurrency,
    recentInvoices,
  };
}

export function registerDashboardHandlers() {
  ipcMain.handle("dashboard:summary", async () => {
    try {
      return getDashboardSummary();
    } catch (err) {
      throw formatError(err);
    }
  });
}
