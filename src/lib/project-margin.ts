import { convertCents, type ExchangeRates } from "./currency-conversion";
import type { ClientWithStats, Currency, InvoiceWithClient } from "@/types/billing";
import type { ExpenseItem } from "@/types/expenses";
import type { WorkOrderItem } from "@/types/outsourcing";
import type { TaskItem } from "@/types/tasks";

export interface MarginRecordLine {
  id: string;
  label: string;
  sublabel?: string;
  originalCents: number;
  originalCurrency: Currency;
  convertedCents: number | null;
  paidOriginalCents?: number;
  paidConvertedCents?: number | null;
  status?: string;
}

export interface TaskTimeSummary {
  id: string;
  title: string;
  status: TaskItem["status"];
  activeMilliseconds: number;
  hours: number;
}

export interface ProjectMarginSummary {
  currency: Currency;
  missingCurrencies: Currency[];
  billedRevenueCents: number;
  collectedRevenueCents: number;
  committedWorkOrderCents: number;
  paidWorkOrderCents: number;
  directExpenseCents: number;
  accrualNetMarginCents: number;
  cashNetMarginCents: number;
  accrualMarginPercent: number | null;
  cashMarginPercent: number | null;
  totalActiveMilliseconds: number;
  totalHours: number;
  effectiveHourlyRateAccrualCents: number | null;
  effectiveHourlyRateCashCents: number | null;
  workOrders: MarginRecordLine[];
  expenses: MarginRecordLine[];
  tasks: TaskTimeSummary[];
}

export interface ClientInvoiceMarginRow {
  invoice: InvoiceWithClient;
  margin: ProjectMarginSummary;
}

export interface ClientMarginSummary extends ProjectMarginSummary {
  invoiceCount: number;
  invoiceBreakdown: ClientInvoiceMarginRow[];
}

function taskActiveMilliseconds(task: TaskItem, nowMs: number): number {
  const baseMs = Math.max(0, task.activeMilliseconds || 0);
  if (task.status === "in-progress" && task.activeSince) {
    const startedMs = Date.parse(task.activeSince);
    if (Number.isFinite(startedMs) && nowMs > startedMs) {
      return baseMs + (nowMs - startedMs);
    }
  }
  return baseMs;
}

function workOrderPaidCents(workOrder: WorkOrderItem): number {
  if (typeof workOrder.payoutAmountCents === "number") {
    return Math.max(0, workOrder.payoutAmountCents);
  }
  if (Array.isArray(workOrder.payouts) && workOrder.payouts.length > 0) {
    return workOrder.payouts
      .filter((payout) => !payout.voidedAt)
      .reduce((sum, payout) => sum + Math.max(0, payout.amountCents), 0);
  }
  return workOrder.payoutStatus === "PAID" ? Math.max(0, workOrder.feeCents) : 0;
}

function buildMarginSummary({
  invoicesList,
  workOrdersList,
  expensesList,
  tasksList,
  targetCurrency,
  rates,
  nowMs,
}: {
  invoicesList: InvoiceWithClient[];
  workOrdersList: WorkOrderItem[];
  expensesList: ExpenseItem[];
  tasksList: TaskItem[];
  targetCurrency: Currency;
  rates: ExchangeRates | null;
  nowMs: number;
}): ProjectMarginSummary {
  const missing = new Set<Currency>();
  const toTarget = (cents: number, source: Currency): number | null => {
    const converted = convertCents(cents, source, targetCurrency, rates);
    if (converted === null) missing.add(source);
    return converted;
  };

  let billedRevenueCents = 0;
  let collectedRevenueCents = 0;
  for (const inv of invoicesList) {
    const billed = toTarget(inv.amountCents, inv.currency);
    const collected = toTarget(inv.paidCents || 0, inv.currency);
    if (billed !== null) billedRevenueCents += billed;
    if (collected !== null) collectedRevenueCents += collected;
  }

  let committedWorkOrderCents = 0;
  let paidWorkOrderCents = 0;
  const workOrders: MarginRecordLine[] = workOrdersList.map((wo) => {
    const paidOrig = workOrderPaidCents(wo);
    const convertedCommitted = toTarget(wo.feeCents, wo.currency);
    const convertedPaid = toTarget(paidOrig, wo.currency);
    if (convertedCommitted !== null) committedWorkOrderCents += convertedCommitted;
    if (convertedPaid !== null) paidWorkOrderCents += convertedPaid;
    return {
      id: wo.id,
      label: wo.scope,
      sublabel: wo.vendorName || wo.vendorSnapshot?.name || "Contractor",
      originalCents: wo.feeCents,
      originalCurrency: wo.currency,
      convertedCents: convertedCommitted,
      paidOriginalCents: paidOrig,
      paidConvertedCents: convertedPaid,
      status: wo.payoutStatus === "PAID" ? "Paid" : "Pending",
    };
  });

  let directExpenseCents = 0;
  const expenses: MarginRecordLine[] = expensesList.map((exp) => {
    const converted = toTarget(exp.amountCents, exp.currency);
    if (converted !== null) directExpenseCents += converted;
    return {
      id: exp.id,
      label: exp.merchant || exp.description || exp.category,
      sublabel: `${exp.category} · ${exp.incurredAt.slice(0, 10)}`,
      originalCents: exp.amountCents,
      originalCurrency: exp.currency,
      convertedCents: converted,
    };
  });

  const tasks: TaskTimeSummary[] = tasksList.map((task) => {
    const activeMs = taskActiveMilliseconds(task, nowMs);
    return {
      id: task.id,
      title: task.title,
      status: task.status,
      activeMilliseconds: activeMs,
      hours: activeMs / 3_600_000,
    };
  });

  const totalActiveMilliseconds = tasks.reduce(
    (sum, t) => sum + t.activeMilliseconds,
    0,
  );
  const totalHours = totalActiveMilliseconds / 3_600_000;

  const accrualNetMarginCents =
    billedRevenueCents - committedWorkOrderCents - directExpenseCents;
  const cashNetMarginCents =
    collectedRevenueCents - paidWorkOrderCents - directExpenseCents;

  const accrualMarginPercent =
    billedRevenueCents > 0
      ? Math.round((accrualNetMarginCents / billedRevenueCents) * 1000) / 10
      : null;
  const cashMarginPercent =
    collectedRevenueCents > 0
      ? Math.round((cashNetMarginCents / collectedRevenueCents) * 1000) / 10
      : null;

  const effectiveHourlyRateAccrualCents =
    totalHours > 0 ? Math.round(accrualNetMarginCents / totalHours) : null;
  const effectiveHourlyRateCashCents =
    totalHours > 0 ? Math.round(cashNetMarginCents / totalHours) : null;

  return {
    currency: targetCurrency,
    missingCurrencies: [...missing],
    billedRevenueCents,
    collectedRevenueCents,
    committedWorkOrderCents,
    paidWorkOrderCents,
    directExpenseCents,
    accrualNetMarginCents,
    cashNetMarginCents,
    accrualMarginPercent,
    cashMarginPercent,
    totalActiveMilliseconds,
    totalHours,
    effectiveHourlyRateAccrualCents,
    effectiveHourlyRateCashCents,
    workOrders,
    expenses,
    tasks,
  };
}

export function computeInvoiceMargin({
  invoice,
  workOrders,
  expenses,
  tasks,
  rates,
  targetCurrency,
  nowMs = Date.now(),
}: {
  invoice: InvoiceWithClient;
  workOrders: WorkOrderItem[];
  expenses: ExpenseItem[];
  tasks: TaskItem[];
  rates: ExchangeRates | null;
  targetCurrency?: Currency;
  nowMs?: number;
}): ProjectMarginSummary {
  const currency = targetCurrency || invoice.currency;
  const linkedWorkOrders = workOrders.filter((w) => w.invoiceId === invoice.id);
  const linkedExpenses = expenses.filter((e) => e.invoiceId === invoice.id);
  const linkedTasks = tasks.filter((t) => t.invoiceId === invoice.id);

  return buildMarginSummary({
    invoicesList: [invoice],
    workOrdersList: linkedWorkOrders,
    expensesList: linkedExpenses,
    tasksList: linkedTasks,
    targetCurrency: currency,
    rates,
    nowMs,
  });
}

export function computeClientMargin({
  client,
  invoices,
  workOrders,
  expenses,
  tasks,
  rates,
  targetCurrency,
  nowMs = Date.now(),
}: {
  client: ClientWithStats;
  invoices: InvoiceWithClient[];
  workOrders: WorkOrderItem[];
  expenses: ExpenseItem[];
  tasks: TaskItem[];
  rates: ExchangeRates | null;
  targetCurrency?: Currency;
  nowMs?: number;
}): ClientMarginSummary {
  const currency = targetCurrency || client.currency;
  const clientInvoices = invoices.filter(
    (inv) => inv.clientId === client.id && inv.status !== "DRAFT",
  );
  const invoiceIds = new Set(clientInvoices.map((inv) => inv.id));

  const linkedWorkOrders = workOrders.filter(
    (w) =>
      w.clientId === client.id ||
      (w.invoiceId !== null && invoiceIds.has(w.invoiceId)),
  );
  const linkedExpenses = expenses.filter(
    (e) => e.invoiceId !== null && invoiceIds.has(e.invoiceId),
  );
  const linkedTasks = tasks.filter(
    (t) =>
      t.clientId === client.id ||
      (t.invoiceId !== null && t.invoiceId !== undefined && invoiceIds.has(t.invoiceId)),
  );

  const summary = buildMarginSummary({
    invoicesList: clientInvoices,
    workOrdersList: linkedWorkOrders,
    expensesList: linkedExpenses,
    tasksList: linkedTasks,
    targetCurrency: currency,
    rates,
    nowMs,
  });

  const invoiceBreakdown = [...clientInvoices]
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate))
    .map((invoice) => ({
      invoice,
      margin: computeInvoiceMargin({
        invoice,
        workOrders: linkedWorkOrders,
        expenses: linkedExpenses,
        tasks: linkedTasks,
        rates,
        targetCurrency: currency,
        nowMs,
      }),
    }));

  return {
    ...summary,
    invoiceCount: clientInvoices.length,
    invoiceBreakdown,
  };
}
