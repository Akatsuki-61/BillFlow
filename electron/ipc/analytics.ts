import { ipcMain } from "electron";
import { getDb } from "../db";
import { clients, vendors } from "../db/schema";
import { formatError } from "./errors";
import { listInvoicesWithClient } from "./invoices";
import { AnalyticsSummaryPayload } from "../../src/types/analytics";

export type { AnalyticsSummaryPayload };

export function getAnalyticsSummary(period?: string): AnalyticsSummaryPayload {
  const db = getDb();
  const allClients = db.select().from(clients).all();
  const allInvoices = listInvoicesWithClient();
  const allVendors = db.select().from(vendors).all();

  // Filter invoices if period specified
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const filteredInvoices = allInvoices.filter((inv) => {
    if (!period || period === "all" || period === "all-time") return true;
    if (!inv.issueDate) return true;
    const invDate = new Date(inv.issueDate);
    if (isNaN(invDate.getTime())) return true;

    if (period === "year") {
      return invDate.getFullYear() === currentYear;
    }
    if (period === "month") {
      return (
        invDate.getFullYear() === currentYear &&
        invDate.getMonth() === currentMonth
      );
    }
    if (period === "quarter") {
      const invQuarter = Math.floor(invDate.getMonth() / 3);
      const currQuarter = Math.floor(currentMonth / 3);
      return invDate.getFullYear() === currentYear && invQuarter === currQuarter;
    }
    return true;
  });

  const activeInvoices = filteredInvoices.length > 0 ? filteredInvoices : allInvoices;

  let totalRevenueCents = 0;
  let paidCents = 0;
  let pendingReceivablesCents = 0;
  let unpaidCount = 0;
  let overdueCents = 0;
  let overdueCount = 0;
  const todayStr = now.toISOString().split("T")[0];

  for (const inv of activeInvoices) {
    if (inv.status !== "DRAFT") {
      totalRevenueCents += inv.amountCents;
      if (inv.status === "PAID") {
        paidCents += inv.amountCents;
      } else {
        const unpaid = Math.max(0, inv.amountCents - (inv.paidCents || 0));
        pendingReceivablesCents += unpaid;
        unpaidCount += 1;
        if (inv.status === "OVERDUE" || (inv.dueDate && inv.dueDate < todayStr)) {
          overdueCents += unpaid;
          overdueCount += 1;
        }
      }
    }
  }

  // Total outsourced subcontractor costs from SQLite vendors table
  let totalOutsourcedCents = 0;
  for (const v of allVendors) {
    totalOutsourcedCents += v.balanceCents;
  }

  // Net Profit & Margins
  const netProfitCents = Math.max(0, totalRevenueCents - totalOutsourcedCents);
  const marginPct =
    totalRevenueCents > 0
      ? Math.round(
          ((totalRevenueCents - Math.min(totalRevenueCents, totalOutsourcedCents)) /
            totalRevenueCents) *
            100,
        )
      : 100;

  // Collection Ratio & Avg Ticket
  const paidRatioPct =
    totalRevenueCents > 0 ? Math.round((paidCents / totalRevenueCents) * 100) : 100;
  const avgInvoiceCents =
    activeInvoices.length > 0
      ? Math.round(totalRevenueCents / activeInvoices.length)
      : 0;

  // Top Client
  let topClientName = "Diversified";
  let topClientMaxBilled = 0;
  const clientBilledMap = new Map<string, number>();

  for (const inv of activeInvoices) {
    if (inv.status !== "DRAFT") {
      const prev = clientBilledMap.get(inv.clientName) || 0;
      clientBilledMap.set(inv.clientName, prev + inv.amountCents);
    }
  }

  for (const [name, billed] of clientBilledMap.entries()) {
    if (billed > topClientMaxBilled) {
      topClientMaxBilled = billed;
      topClientName = name;
    }
  }

  const topClientPct =
    totalRevenueCents > 0
      ? Math.min(100, Math.round((topClientMaxBilled / totalRevenueCents) * 100))
      : 0;

  // Realized hourly rate & Runway
  const effectiveHourlyRate =
    avgInvoiceCents > 0 ? Math.max(65, Math.round(avgInvoiceCents / 1600)) : 145;

  const monthlyBurn = Math.max(100000, Math.round(totalOutsourcedCents / 3));
  const availableLiquidity = paidCents + Math.round(pendingReceivablesCents * 0.75);
  const cashflowRunwayMonths =
    monthlyBurn > 0 && availableLiquidity > 0
      ? Math.min(24, Math.max(1, Math.round(availableLiquidity / monthlyBurn)))
      : 12;

  // 6-Month rolling trend points
  const monthlyTrends: AnalyticsSummaryPayload["monthlyTrends"] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("default", { month: "short" });
    monthlyTrends.push({
      key,
      label,
      revenueCents: 0,
      expensesCents: 0,
      profitCents: 0,
      marginPct: 100,
    });
  }

  for (const inv of allInvoices) {
    if (!inv.issueDate || inv.status === "DRAFT") continue;
    const invKey = inv.issueDate.slice(0, 7);
    const target = monthlyTrends.find((m) => m.key === invKey);
    if (target) {
      target.revenueCents += inv.amountCents;
    }
  }

  const hasInvoices = allInvoices.length > 0;
  const avgMonthlyOutsourced = hasInvoices
    ? Math.round(totalOutsourcedCents / 6)
    : 0;

  for (const m of monthlyTrends) {
    m.expensesCents =
      m.revenueCents > 0 ? avgMonthlyOutsourced + Math.round(m.revenueCents * 0.05) : 0;
    m.profitCents = Math.max(0, m.revenueCents - m.expensesCents);
    m.marginPct =
      m.revenueCents > 0 ? Math.round((m.profitCents / m.revenueCents) * 100) : 100;
  }

  return {
    totalRevenueCents,
    totalOutsourcedCents,
    netProfitCents,
    marginPct,
    pendingReceivablesCents,
    unpaidCount,
    overdueCents,
    overdueCount,
    paidRatioPct,
    avgInvoiceCents,
    activeClientsCount: allClients.length,
    vendorsCount: allVendors.length,
    topClientName,
    topClientPct,
    effectiveHourlyRate,
    cashflowRunwayMonths,
    monthlyTrends,
  };
}

export function registerAnalyticsHandlers() {
  ipcMain.handle("analytics:summary", async (_event, period?: string) => {
    try {
      return getAnalyticsSummary(period);
    } catch (err) {
      throw formatError(err);
    }
  });
}
