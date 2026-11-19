"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useReportingData } from "@/context/ReportingContext";
import { useClients, useData } from "@/lib/data/DataProvider";
import { calculateFinancials } from "@/lib/financials";
import { formatCents } from "@/lib/format";
import { isPastDue, issuedInPeriod, sharePercent } from "@/lib/visual-metrics";
import type {
  ClientWithStats,
  Currency,
  InvoiceWithClient,
} from "@/types/billing";
import type { DashboardPeriod } from "@/types/dashboard";
import type { WorkOrderItem } from "@/types/outsourcing";
import type { ExpenseItem } from "@/types/expenses";
import type { TaskItem } from "@/types/tasks";

export interface DashboardPipelineStage {
  label: string;
  href: string;
  value: number;
  sub: string;
  valueStr: string;
  heightPct: number;
}

export interface DashboardMetrics {
  period: DashboardPeriod;
  activeCurrency: Currency;
  activeTasks: TaskItem[];
  filteredInvoices: InvoiceWithClient[];
  financials: ReturnType<typeof calculateFinancials>;
  totalOutsourcedCents: number;
  outsourcedCostsStr: string;
  totalRevenueCents: number;
  paidCount: number;
  paidCents: number;
  paidFullCents: number;
  advanceCentsCollected: number;
  advancePaidCount: number;
  pendingCents: number;
  pendingCount: number;
  paidRatioPct: number;
  avgInvoiceCents: number;
  avgInvoiceStr: string;
  totalRevenueStr: string;
  pendingReceivablesStr: string;
  opexCents: number;
  opexStr: string;
  opexRatioPct: number;
  netProfitCents: number;
  isLoss: boolean;
  netProfitStr: string;
  marginPct: number;
  totalClientsCount: number;
  activeClientsCount: number;
  topClient: { name: string; totalBilledCents: number } | undefined;
  topClientPct: number;
  effectiveHourlyRate: number;
  totalTrackedHours: number;
  overdueInvoices: InvoiceWithClient[];
  overdueTotalStr: string;
  currencyIssuedCount: number;
  monthlyStats: ReturnType<typeof calculateFinancials>["monthlyTrends"];
  taskCounts: {
    todo: number;
    inProgress: number;
    review: number;
    done: number;
    total: number;
    donePct: number;
  };
  pipelineStages: DashboardPipelineStage[];
}

export interface ComputeDashboardMetricsInput {
  invoices: InvoiceWithClient[];
  expenses: ExpenseItem[];
  workOrders: WorkOrderItem[];
  clients: ClientWithStats[];
  tasks: TaskItem[];
  period: DashboardPeriod;
  currency: Currency;
}

/**
 * Computes all widget KPIs, cashflow totals, and pipeline stages for a period in one pass.
 */
export function computeDashboardMetrics({
  invoices,
  expenses,
  workOrders,
  clients,
  tasks,
  period,
  currency: activeCurrency,
}: ComputeDashboardMetricsInput): DashboardMetrics {
  const activeTasks: TaskItem[] = [];
  let todo = 0;
  let inProgress = 0;
  let review = 0;
  let done = 0;
  let totalActiveMs = 0;

  for (const task of tasks) {
    if (task.status !== "done") {
      activeTasks.push(task);
    }
    if (task.status === "todo") todo += 1;
    else if (task.status === "in-progress") inProgress += 1;
    else if (task.status === "review") review += 1;
    else if (task.status === "done") done += 1;
    totalActiveMs += task.activeMilliseconds || 0;
  }

  const totalTasks = tasks.length;
  const taskCounts = {
    todo,
    inProgress,
    review,
    done,
    total: totalTasks,
    donePct: totalTasks > 0 ? Math.round((done / totalTasks) * 100) : 0,
  };

  const filteredInvoices = issuedInPeriod(invoices, activeCurrency, period);
  const financials = calculateFinancials({
    invoices,
    workOrders,
    expenses,
    tasks,
    period,
    currency: activeCurrency,
  });

  const totalOutsourcedCents = financials.paidCostCents;
  const outsourcedCostsStr = formatCents(totalOutsourcedCents, activeCurrency);

  let totalRevenueCents = 0;
  let paidCount = 0;
  let paidCents = 0;
  let paidFullCents = 0;
  let advanceCentsCollected = 0;
  let advancePaidCount = 0;
  let pendingCents = 0;
  let pendingCount = 0;
  let overdueTotalCents = 0;
  let currencyIssuedCount = 0;
  const overdueInvoices: InvoiceWithClient[] = [];
  for (const inv of invoices) {
    if (inv.status === "DRAFT" || inv.currency !== activeCurrency) continue;
    currencyIssuedCount += 1;
    if (isPastDue(inv)) {
      overdueInvoices.push(inv);
      overdueTotalCents += Math.max(0, inv.amountCents - (inv.paidCents ?? 0));
    }
  }

  const clientTotals = new Map<
    string,
    { name: string; totalBilledCents: number }
  >();

  for (const inv of filteredInvoices) {
    totalRevenueCents += inv.amountCents;
    const collected =
      inv.paidCents ?? (inv.status === "PAID" ? inv.amountCents : 0);
    paidCents += collected;

    if (inv.status === "PAID") {
      paidCount += 1;
      paidFullCents += inv.amountCents;
    } else {
      pendingCount += 1;
      if (inv.status === "ADVANCE_PAID" || collected > 0) {
        advancePaidCount += 1;
        advanceCentsCollected += collected;
      }
      pendingCents += Math.max(0, inv.amountCents - collected);
    }

    const clientKey = inv.clientId || `invoice:${inv.id}`;
    const existingClient = clientTotals.get(clientKey);
    if (existingClient) {
      existingClient.totalBilledCents += inv.amountCents;
    } else {
      clientTotals.set(clientKey, {
        name: inv.clientName,
        totalBilledCents: inv.amountCents,
      });
    }
  }

  const paidRatioPct =
    totalRevenueCents > 0
      ? Math.round((paidCents / totalRevenueCents) * 100)
      : 0;
  const avgInvoiceCents =
    filteredInvoices.length > 0
      ? Math.round(totalRevenueCents / filteredInvoices.length)
      : 0;

  const avgInvoiceStr = formatCents(avgInvoiceCents, activeCurrency);
  const totalRevenueStr = formatCents(totalRevenueCents, activeCurrency);
  const pendingReceivablesStr = formatCents(pendingCents, activeCurrency);
  const overdueTotalStr = formatCents(overdueTotalCents, activeCurrency);

  const opexCents = financials.totalOperatingCostsCents;
  const opexStr = formatCents(opexCents, activeCurrency);
  const opexRatioPct =
    totalRevenueCents > 0
      ? Math.round((opexCents / totalRevenueCents) * 100)
      : 0;

  const netProfitCents = financials.netProfitCents;
  const isLoss = netProfitCents < 0;
  const netProfitStr = formatCents(netProfitCents, activeCurrency);
  const marginPct =
    totalRevenueCents > 0
      ? Math.round((netProfitCents / totalRevenueCents) * 100)
      : 0;

  const totalClientsCount = clients.length;
  let activeClientsCount = 0;
  for (const client of clients) {
    if (client.invoicesCount > 0 || client.outstandingBalanceCents > 0) {
      activeClientsCount += 1;
    }
  }

  let topClient: { name: string; totalBilledCents: number } | undefined;
  for (const candidate of clientTotals.values()) {
    if (!topClient || candidate.totalBilledCents > topClient.totalBilledCents) {
      topClient = candidate;
    }
  }
  const topClientPct = sharePercent(
    topClient?.totalBilledCents ?? 0,
    totalRevenueCents,
  );

  const totalTrackedHours = totalActiveMs / 3600000;
  const effectiveHourlyRate =
    totalTrackedHours <= 0
      ? 0
      : Math.round(netProfitCents / 100 / totalTrackedHours);

  const stageValues = [
    totalRevenueCents,
    paidCents,
    pendingCents,
    opexCents,
    netProfitCents,
  ];
  const scale = Math.max(...stageValues.map(Math.abs), 1);
  const pipelineStages = [
    {
      label: "Billed",
      href: "/invoices",
      value: totalRevenueCents,
      sub: `${filteredInvoices.length} issued invoices`,
    },
    {
      label: "Collected",
      href: "/invoices",
      value: paidCents,
      sub: "Recorded payments",
    },
    {
      label: "Outstanding",
      href: "/invoices",
      value: pendingCents,
      sub: "Remaining client balances",
    },
    {
      label: "Costs",
      href: "/expenses",
      value: opexCents,
      sub: "Contractor fees + expenses",
    },
    {
      label: "Net profit",
      href: "/analytics",
      value: netProfitCents,
      sub: "Billed less recorded costs",
    },
  ].map((stage) => ({
    ...stage,
    valueStr: formatCents(stage.value, activeCurrency),
    heightPct: (Math.abs(stage.value) / scale) * 100,
  }));

  return {
    period,
    activeCurrency,
    activeTasks,
    filteredInvoices,
    financials,
    totalOutsourcedCents,
    outsourcedCostsStr,
    totalRevenueCents,
    paidCount,
    paidCents,
    paidFullCents,
    advanceCentsCollected,
    advancePaidCount,
    pendingCents,
    pendingCount,
    paidRatioPct,
    avgInvoiceCents,
    avgInvoiceStr,
    totalRevenueStr,
    pendingReceivablesStr,
    opexCents,
    opexStr,
    opexRatioPct,
    netProfitCents,
    isLoss,
    netProfitStr,
    marginPct,
    totalClientsCount,
    activeClientsCount,
    topClient,
    topClientPct,
    effectiveHourlyRate,
    totalTrackedHours,
    overdueInvoices,
    overdueTotalStr,
    currencyIssuedCount,
    monthlyStats: financials.monthlyTrends,
    taskCounts,
    pipelineStages,
  };
}

const DashboardMetricsContext = createContext<DashboardMetrics | null>(null);

export function DashboardMetricsProvider({
  period,
  children,
}: {
  period: DashboardPeriod;
  children: React.ReactNode;
}) {
  const { invoices, expenses, workOrders, currency } = useReportingData();
  const { clients } = useClients();
  const { tasks } = useData();

  const metrics = useMemo(
    () =>
      computeDashboardMetrics({
        invoices,
        expenses,
        workOrders,
        clients,
        tasks,
        period,
        currency,
      }),
    [invoices, expenses, workOrders, clients, tasks, period, currency],
  );

  return (
    <DashboardMetricsContext.Provider value={metrics}>
      {children}
    </DashboardMetricsContext.Provider>
  );
}

export function useDashboardMetrics(period: DashboardPeriod): DashboardMetrics {
  const ctx = useContext(DashboardMetricsContext);
  const { invoices, expenses, workOrders, currency } = useReportingData();
  const { clients } = useClients();
  const { tasks } = useData();

  const matchesContext = ctx !== null && ctx.period === period;

  const fallback = useMemo(() => {
    if (matchesContext) return null;
    return computeDashboardMetrics({
      invoices,
      expenses,
      workOrders,
      clients,
      tasks,
      period,
      currency,
    });
  }, [
    matchesContext,
    invoices,
    expenses,
    workOrders,
    clients,
    tasks,
    period,
    currency,
  ]);

  return matchesContext ? ctx : (fallback as DashboardMetrics);
}
