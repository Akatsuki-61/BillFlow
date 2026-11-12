import { ipcMain } from "../security";
import { getDb } from "../db";
import { clients, invoices } from "../db/schema";
import { formatError } from "./errors";
import { desc } from "drizzle-orm";
import type { InvoiceWithClient } from "../../src/types/billing";
import { DashboardSummary } from "../../src/types/billing";

export function getDashboardSummary(): DashboardSummary {
  const db = getDb();
  const allClients = db.select().from(clients).all();
  const allInvoices = db
    .select()
    .from(invoices)
    .orderBy(desc(invoices.issueDate), desc(invoices.createdAt))
    .all();

  const totalBilledByCurrency: Record<string, number> = {};
  const outstandingByCurrency: Record<string, number> = {};
  let unpaidCount = 0;

  for (const inv of allInvoices) {
    const cur = inv.currency || "USD";
    if (inv.status !== "DRAFT") {
      totalBilledByCurrency[cur] =
        (totalBilledByCurrency[cur] || 0) + inv.amountCents;
      const unpaidPortion = Math.max(0, inv.amountCents - inv.paidCents);
      if (unpaidPortion > 0) {
        outstandingByCurrency[cur] =
          (outstandingByCurrency[cur] || 0) + unpaidPortion;
        unpaidCount += 1;
      }
    }
  }

  const clientMap = new Map(allClients.map((client) => [client.id, client]));
  const recentInvoices = allInvoices.slice(0, 5).map((invoice) => {
    let snapshot: { name?: string; email?: string } = {};
    try {
      snapshot = JSON.parse(invoice.clientSnapshot || "{}");
    } catch {}
    const client = invoice.clientId
      ? clientMap.get(invoice.clientId)
      : undefined;
    return {
      ...invoice,
      currency: invoice.currency as InvoiceWithClient["currency"],
      status: invoice.status as InvoiceWithClient["status"],
      clientName: snapshot.name || client?.name || "Invoice client",
      clientEmail: snapshot.email || client?.email,
    };
  });

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
