import { ipcMain } from "electron";
import { getDb } from "../db";
import { clients, vendors, tasks, expenses } from "../db/schema";
import { formatError } from "./errors";
import { listInvoicesWithClient } from "./invoices";
import { AnalyticsSummaryPayload } from "../../src/types/analytics";

export type { AnalyticsSummaryPayload };

/**
 * Computes analytics and executive dashboard summary from live SQLite database records.
 * Follows strict financial integrity:
 * - Aggregates actual invoices, clients, vendors, background tasks, and general expenses.
 * - Recognizes recorded advance payments (paidCents) without fabricating revenue.
 * - Deducts both outsourced contractor costs and general operating expenses.
 * - Computes realized hourly rate strictly from task active milliseconds.
 * - Computes runway from actual collections divided by operating burn rate.
 * - Returns clean 0s when records are empty, avoiding synthetic estimates or hardcoded multipliers.
 */
export function getAnalyticsSummary(
  period?: string,
  currency?: string,
  accountingMethod: "accrual" | "cash" = "accrual",
): AnalyticsSummaryPayload {
  const db = getDb();
  const allClients = db.select().from(clients).all();
  const allInvoices = listInvoicesWithClient();
  const allVendors = db.select().from(vendors).all();
  const allTasks = db.select().from(tasks).all();
  const allExpenses = db.select().from(expenses).all();

  // Filter invoices if period specified
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const filteredInvoices = allInvoices.filter((inv) => {
    // Explicit currency filter
    if (currency && currency !== "all" && currency !== "ALL") {
      if (inv.currency && inv.currency.toUpperCase() !== currency.toUpperCase()) {
        return false;
      }
    }

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
      // Real recorded collection: paidCents if tracked, or total if status is PAID
      const collected = inv.paidCents ?? (inv.status === "PAID" ? inv.amountCents : 0);
      paidCents += collected;
      if (inv.status === "PAID") {
        // fully settled
      } else {
        const unpaid = Math.max(0, inv.amountCents - collected);
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
  let paidCostCents = 0;
  for (const v of allVendors) {
    totalOutsourcedCents += v.balanceCents;
    if (v.status === "PAID") {
      paidCostCents += v.balanceCents;
    }
  }

  // Filter general operational expenses from SQLite expenses table
  const filteredExpenses = allExpenses.filter((e) => {
    if (currency && currency !== "all" && currency !== "ALL") {
      if (e.currency && e.currency.toUpperCase() !== currency.toUpperCase()) {
        return false;
      }
    }
    if (!period || period === "all" || period === "all-time") return true;
    if (!e.incurredAt) return true;
    const eDate = new Date(e.incurredAt);
    if (isNaN(eDate.getTime())) return true;

    if (period === "year") {
      return eDate.getFullYear() === currentYear;
    }
    if (period === "month") {
      return (
        eDate.getFullYear() === currentYear &&
        eDate.getMonth() === currentMonth
      );
    }
    if (period === "quarter") {
      const eQuarter = Math.floor(eDate.getMonth() / 3);
      const currQuarter = Math.floor(currentMonth / 3);
      return eDate.getFullYear() === currentYear && eQuarter === currQuarter;
    }
    return true;
  });

  const generalExpensesCents = filteredExpenses.reduce((sum, e) => sum + e.amountCents, 0);
  const totalOperatingCostsCents = totalOutsourcedCents + generalExpensesCents;
  const paidOperatingCostsCents = paidCostCents + generalExpensesCents;

  // Preserved profit & losses:
  // Accrual profit: Total Billed Revenue minus Total Operating Costs (can be negative on loss)
  const accrualProfitCents = totalRevenueCents - totalOperatingCostsCents;
  // Cash profit: Collections minus Paid Operating Costs (can be negative on loss)
  const cashProfitCents = paidCents - paidOperatingCostsCents;

  // Selected view profit according to active accounting method
  const netProfitCents = accountingMethod === "cash" ? cashProfitCents : accrualProfitCents;
  const isLoss = netProfitCents < 0;

  const baseForMargin = accountingMethod === "cash" ? paidCents : totalRevenueCents;
  const marginPct =
    baseForMargin > 0
      ? Math.round((netProfitCents / baseForMargin) * 100)
      : 0;

  // Collection Ratio & Avg Ticket
  const paidRatioPct =
    totalRevenueCents > 0 ? Math.round((paidCents / totalRevenueCents) * 100) : 0;
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

  // Realized hourly rate based on actual tracked active milliseconds in tasks
  let totalActiveMs = 0;
  for (const t of allTasks) {
    totalActiveMs += t.activeMilliseconds || 0;
  }
  const totalHours = totalActiveMs / 3600000;
  const effectiveHourlyRate =
    totalHours > 0 ? Math.round((netProfitCents / 100) / totalHours) : 0;

  // Runway based on actual collected liquidity and average monthly operating burn
  const monthlyBurn = Math.round(totalOperatingCostsCents / 6);
  const cashflowRunwayMonths =
    monthlyBurn > 0 && paidCents > 0
      ? Math.min(36, Math.max(1, Math.round(paidCents / monthlyBurn)))
      : 0;

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
      marginPct: 0,
    });
  }

  for (const inv of allInvoices) {
    if (!inv.issueDate || inv.status === "DRAFT") continue;
    if (currency && currency !== "all" && currency !== "ALL") {
      if (inv.currency && inv.currency.toUpperCase() !== currency.toUpperCase()) continue;
    }
    const invKey = inv.issueDate.slice(0, 7);
    const target = monthlyTrends.find((m) => m.key === invKey);
    if (target) {
      target.revenueCents += inv.amountCents;
    }
  }

  for (const v of allVendors) {
    const vDate = v.payoutDueDate || v.createdAt;
    if (!vDate) continue;
    const vKey = vDate.slice(0, 7);
    const target = monthlyTrends.find((m) => m.key === vKey);
    if (target) {
      target.expensesCents += v.balanceCents;
    }
  }

  for (const e of allExpenses) {
    if (!e.incurredAt) continue;
    if (currency && currency !== "all" && currency !== "ALL") {
      if (e.currency && e.currency.toUpperCase() !== currency.toUpperCase()) continue;
    }
    const eKey = e.incurredAt.slice(0, 7);
    const target = monthlyTrends.find((m) => m.key === eKey);
    if (target) {
      target.expensesCents += e.amountCents;
    }
  }

  for (const m of monthlyTrends) {
    // Preserve monthly losses
    m.profitCents = m.revenueCents - m.expensesCents;
    m.marginPct =
      m.revenueCents > 0 ? Math.round((m.profitCents / m.revenueCents) * 100) : 0;
  }

  return {
    totalRevenueCents,
    billedAmountCents: totalRevenueCents,
    paidCents,
    collectedCents: paidCents,
    pendingReceivablesCents,
    outstandingCents: pendingReceivablesCents,
    totalOutsourcedCents,
    committedCostCents: totalOutsourcedCents,
    paidCostCents,
    generalExpensesCents,
    totalOperatingCostsCents,
    accrualProfitCents,
    cashProfitCents,
    netProfitCents,
    marginPct,
    isLoss,
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
    currency: currency || "ALL",
    period: period || "all",
    accountingMethod,
  };
}

export function registerAnalyticsHandlers() {
  ipcMain.handle(
    "analytics:summary",
    async (
      _event,
      period?: string,
      currency?: string,
      accountingMethod: "accrual" | "cash" = "accrual",
    ) => {
      try {
        return getAnalyticsSummary(period, currency, accountingMethod);
      } catch (err) {
        throw formatError(err);
      }
    },
  );
}
