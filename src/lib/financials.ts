import type { InvoiceWithClient } from "../types/billing";
import type { WorkOrderItem } from "../types/outsourcing";
import type { ExpenseItem } from "../types/expenses";
import type { TaskItem } from "../types/tasks";
import type { AnalyticsSummaryPayload } from "../types/analytics";

export function financialDateInPeriod(
  value: string | null | undefined,
  period = "all",
  now = new Date(),
): boolean {
  if (!value || !Number.isFinite(Date.parse(value))) return false;
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (["all", "all-time"].includes(period)) return true;
  if (/^\d{4}-\d{2}$/.test(period)) return value.slice(0, 7) === period;
  if (date.getFullYear() !== now.getFullYear()) return false;
  if (period === "year") return true;
  if (period === "month") return date.getMonth() === now.getMonth();
  if (period === "quarter")
    return Math.floor(date.getMonth() / 3) === Math.floor(now.getMonth() / 3);
  return false;
}
export function calculateFinancials(input: {
  invoices: InvoiceWithClient[];
  workOrders: WorkOrderItem[];
  expenses: ExpenseItem[];
  tasks?: TaskItem[];
  clientCount?: number;
  vendorCount?: number;
  period?: string;
  currency: string;
  accountingMethod?: "cash" | "accrual";
  now?: Date;
}): AnalyticsSummaryPayload {
  const {
    invoices,
    workOrders,
    expenses,
    tasks = [],
    period = "all",
    currency,
    accountingMethod = "accrual",
    now = new Date(),
  } = input;
  const matchesCurrency = (value: string) => value === currency;
  const issued = invoices.filter(
    (i) => i.status !== "DRAFT" && matchesCurrency(i.currency),
  );
  const cohort = issued.filter((i) =>
    financialDateInPeriod(i.issueDate, period, now),
  );
  const totalRevenueCents = cohort.reduce((sum, i) => sum + i.amountCents, 0);
  const paidCents = issued
    .flatMap((i) => i.payments || [])
    .filter(
      (p) =>
        matchesCurrency(p.currency) &&
        financialDateInPeriod(p.receivedAt, period, now),
    )
    .reduce((sum, p) => sum + p.amountCents, 0);
  const pendingReceivablesCents = cohort.reduce(
    (sum, i) => sum + Math.max(0, i.amountCents - i.paidCents),
    0,
  );
  const matchingOrders = workOrders.filter((w) => matchesCurrency(w.currency));
  const committedCostCents = matchingOrders
    .filter((w) => cohort.some((i) => i.id === w.invoiceId))
    .reduce((sum, w) => sum + w.feeCents, 0);
  const paidCostCents = matchingOrders
    .filter(
      (w) =>
        w.payoutStatus === "PAID" &&
        financialDateInPeriod(w.paidAt, period, now),
    )
    .reduce((sum, w) => sum + (w.payoutAmountCents || 0), 0);
  const generalExpensesCents = expenses
    .filter(
      (e) =>
        matchesCurrency(e.currency) &&
        financialDateInPeriod(e.incurredAt, period, now),
    )
    .reduce((sum, e) => sum + e.amountCents, 0);
  const totalOperatingCostsCents = paidCostCents + generalExpensesCents;
  const accrualProfitCents = totalRevenueCents - totalOperatingCostsCents;
  const cashProfitCents = paidCents - totalOperatingCostsCents;
  const netProfitCents =
    accountingMethod === "cash" ? cashProfitCents : accrualProfitCents;
  const base = accountingMethod === "cash" ? paidCents : totalRevenueCents;
  const outstanding = cohort.filter((i) => i.paidCents < i.amountCents);
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const overdue = outstanding.filter(
    (i) => i.status === "OVERDUE" || Boolean(i.dueDate && i.dueDate < today),
  );
  const topClients = new Map<string, number>();
  for (const i of cohort)
    topClients.set(
      i.clientName,
      (topClients.get(i.clientName) || 0) + i.amountCents,
    );
  const top = [...topClients].sort((a, b) => b[1] - a[1])[0];
  const monthlyTrends = Array.from({ length: 6 }, (_, index) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1),
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const revenueCents =
      accountingMethod === "cash"
        ? issued
            .flatMap((i) => i.payments || [])
            .filter(
              (p) =>
                p.currency === currency && p.receivedAt.slice(0, 7) === key,
            )
            .reduce((s, p) => s + p.amountCents, 0)
        : issued
            .filter((i) => i.issueDate.slice(0, 7) === key)
            .reduce((s, i) => s + i.amountCents, 0);
    const expensesCents =
      expenses
        .filter(
          (e) => e.currency === currency && e.incurredAt.slice(0, 7) === key,
        )
        .reduce((s, e) => s + e.amountCents, 0) +
      matchingOrders
        .filter(
          (w) => w.payoutStatus === "PAID" && w.paidAt?.slice(0, 7) === key,
        )
        .reduce((s, w) => s + (w.payoutAmountCents || 0), 0);
    return {
      key,
      label: d.toLocaleString("en", { month: "short" }),
      revenueCents,
      expensesCents,
      profitCents: revenueCents - expensesCents,
      marginPct: revenueCents
        ? Math.round(((revenueCents - expensesCents) / revenueCents) * 100)
        : 0,
    };
  });
  const hours =
    tasks
      .filter((t) => !t.currency || t.currency === currency)
      .reduce((sum, t) => sum + (t.activeMilliseconds || 0), 0) / 3600000;
  const burn = monthlyTrends.reduce((sum, m) => sum + m.expensesCents, 0) / 6;
  return {
    totalRevenueCents,
    billedAmountCents: totalRevenueCents,
    paidCents,
    collectedCents: paidCents,
    pendingReceivablesCents,
    outstandingCents: pendingReceivablesCents,
    totalOutsourcedCents: paidCostCents,
    committedCostCents,
    paidCostCents,
    generalExpensesCents,
    totalOperatingCostsCents,
    accrualProfitCents,
    cashProfitCents,
    netProfitCents,
    marginPct: base ? Math.round((netProfitCents / base) * 100) : 0,
    isLoss: netProfitCents < 0,
    unpaidCount: outstanding.length,
    overdueCents: overdue.reduce(
      (sum, i) => sum + Math.max(0, i.amountCents - i.paidCents),
      0,
    ),
    overdueCount: overdue.length,
    paidRatioPct: totalRevenueCents
      ? Math.round(
          (cohort.reduce((sum, i) => sum + i.paidCents, 0) /
            totalRevenueCents) *
            100,
        )
      : 0,
    avgInvoiceCents: cohort.length
      ? Math.round(totalRevenueCents / cohort.length)
      : 0,
    activeClientsCount: input.clientCount || 0,
    vendorsCount: input.vendorCount || 0,
    topClientName: top?.[0] || "—",
    topClientPct:
      top && totalRevenueCents
        ? Math.round((top[1] / totalRevenueCents) * 100)
        : 0,
    effectiveHourlyRate: hours ? Math.round(netProfitCents / 100 / hours) : 0,
    cashflowRunwayMonths: burn
      ? Math.max(0, Math.min(36, Math.floor(paidCents / burn)))
      : 0,
    monthlyTrends,
    currency,
    period,
    accountingMethod,
  };
}
