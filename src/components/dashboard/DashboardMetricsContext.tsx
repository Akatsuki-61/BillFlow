"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useReportingData } from "@/context/ReportingContext";
import { useClients, useTasks } from "@/lib/data/DataProvider";
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
  conversionPct: number;
  dropOffPct: number;
}

export interface DotMatrixBucket {
  key: string;
  label: string;
  count: number;
  dots: number;
  isPeak: boolean;
}

export interface SteppedRetentionPoint {
  key: string;
  monthLabel: string;
  value: number;
  showMonth: boolean;
}

export interface DashboardMetrics {
  period: DashboardPeriod;
  activeCurrency: Currency;
  periodRangeLabel: string;
  previousRangeLabel: string;
  grossDeltaPct: number | null;
  invoicesCountDelta: number;
  clientsCountDelta: number;
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
  steppedRetentionSeries: SteppedRetentionPoint[];
  steppedPeakIndex: number;
  steppedPeakPct: number;
  invoiceDotBuckets: DotMatrixBucket[];
  invoicePeakLabel: string;
  clientDotBuckets: DotMatrixBucket[];
  clientPeakLabel: string;
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
  now?: Date;
}

const shortMonthFmt = new Intl.DateTimeFormat("en-US", { month: "short" });
const monthDayFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
});

function formatRange(start: Date, end: Date): string {
  return `${monthDayFmt.format(start)} – ${monthDayFmt.format(end)}`;
}

export function getPeriodWindowBounds(
  period: DashboardPeriod,
  now = new Date(),
): {
  currentStart: Date;
  currentEnd: Date;
  prevStart: Date;
  prevEnd: Date;
  periodRangeLabel: string;
  previousRangeLabel: string;
} {
  const y = now.getFullYear();
  const m = now.getMonth();

  if (period === "week") {
    const dayOfWeek = (now.getDay() + 6) % 7;
    const currentStart = new Date(y, m, now.getDate() - dayOfWeek, 0, 0, 0, 0);
    const currentEnd = new Date(
      currentStart.getFullYear(),
      currentStart.getMonth(),
      currentStart.getDate() + 6,
      23,
      59,
      59,
      999,
    );
    const prevStart = new Date(
      currentStart.getFullYear(),
      currentStart.getMonth(),
      currentStart.getDate() - 7,
      0,
      0,
      0,
      0,
    );
    const prevEnd = new Date(
      currentStart.getFullYear(),
      currentStart.getMonth(),
      currentStart.getDate() - 1,
      23,
      59,
      59,
      999,
    );
    return {
      currentStart,
      currentEnd,
      prevStart,
      prevEnd,
      periodRangeLabel: formatRange(currentStart, currentEnd),
      previousRangeLabel: formatRange(prevStart, prevEnd),
    };
  }

  if (period === "month") {
    const currentStart = new Date(y, m, 1);
    const currentEnd = new Date(y, m + 1, 0, 23, 59, 59, 999);
    const prevStart = new Date(y, m - 1, 1);
    const prevEnd = new Date(y, m, 0, 23, 59, 59, 999);
    return {
      currentStart,
      currentEnd,
      prevStart,
      prevEnd,
      periodRangeLabel: formatRange(currentStart, currentEnd),
      previousRangeLabel: formatRange(prevStart, prevEnd),
    };
  }

  if (period === "quarter") {
    const qStartMonth = Math.floor(m / 3) * 3;
    const currentStart = new Date(y, qStartMonth, 1);
    const currentEnd = new Date(y, qStartMonth + 3, 0, 23, 59, 59, 999);
    const prevStart = new Date(y, qStartMonth - 3, 1);
    const prevEnd = new Date(y, qStartMonth, 0, 23, 59, 59, 999);
    return {
      currentStart,
      currentEnd,
      prevStart,
      prevEnd,
      periodRangeLabel: formatRange(currentStart, currentEnd),
      previousRangeLabel: formatRange(prevStart, prevEnd),
    };
  }

  if (period === "year") {
    const currentStart = new Date(y, 0, 1);
    const currentEnd = new Date(y, 11, 31, 23, 59, 59, 999);
    const prevStart = new Date(y - 1, 0, 1);
    const prevEnd = new Date(y - 1, 11, 31, 23, 59, 59, 999);
    return {
      currentStart,
      currentEnd,
      prevStart,
      prevEnd,
      periodRangeLabel: `${monthDayFmt.format(currentStart)} – ${monthDayFmt.format(currentEnd)}`,
      previousRangeLabel: `${y - 1} Full Year`,
    };
  }

  const currentStart = new Date(y - 5, 0, 1);
  const currentEnd = new Date(y, m + 1, 0, 23, 59, 59, 999);
  const prevStart = new Date(y - 1, 0, 1);
  const prevEnd = new Date(y - 1, 11, 31, 23, 59, 59, 999);
  return {
    currentStart,
    currentEnd,
    prevStart,
    prevEnd,
    periodRangeLabel: "All Time",
    previousRangeLabel: `${y - 1} Baseline`,
  };
}

function parseIsoDay(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const iso = raw.slice(0, 10);
  const parsed = new Date(`${iso}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Builds a 12-column dot-matrix equalizer across the last 12 chronological buckets (bi-weekly/weekly). */
export function buildDotMatrixBuckets(
  dates: Array<string | null | undefined>,
  now = new Date(),
  bucketDays = 14,
): { buckets: DotMatrixBucket[]; peakLabel: string } {
  const bucketCount = 12;
  const endMs = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  ).getTime();
  const spanMs = bucketDays * 86_400_000;
  const counts = Array.from({ length: bucketCount }, () => 0);
  const labels = Array.from({ length: bucketCount }, (_, idx) => {
    const start = new Date(endMs - (bucketCount - idx) * spanMs + 1);
    return shortMonthFmt.format(start);
  });

  for (const raw of dates) {
    const dt = parseIsoDay(raw);
    if (!dt) continue;
    const diff = endMs - dt.getTime();
    if (diff < 0) continue;
    const offsetFromEnd = Math.floor(diff / spanMs);
    const idx = bucketCount - 1 - offsetFromEnd;
    if (idx >= 0 && idx < bucketCount) {
      counts[idx] += 1;
    }
  }

  const maxCount = Math.max(...counts, 0);
  let peakIdx = bucketCount - 1;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] >= counts[peakIdx]) {
      peakIdx = i;
    }
  }

  const buckets: DotMatrixBucket[] = counts.map((count, idx) => {
    const dots =
      maxCount === 0
        ? 1
        : count === 0
          ? 1
          : Math.max(1, Math.min(5, Math.round((count / maxCount) * 5)));
    const isPeak =
      maxCount > 0 && (idx === peakIdx || (counts[idx] === maxCount && count > 0));
    return {
      key: `b-${idx}`,
      label: labels[idx],
      count,
      dots,
      isPeak,
    };
  });

  const peakLabel = maxCount > 0 ? labels[peakIdx] : labels[bucketCount - 1];
  return { buckets, peakLabel };
}

/** Builds a crisp 24-bin stepped retention/margin trajectory across the 6 monthly trend points. */
export function buildSteppedRetentionSeries(
  monthlyStats: ReturnType<typeof calculateFinancials>["monthlyTrends"],
  fallbackPct: number,
): {
  points: SteppedRetentionPoint[];
  peakIndex: number;
  peakPct: number;
} {
  const binsPerMonth = 4;
  const points: SteppedRetentionPoint[] = [];

  for (let m = 0; m < monthlyStats.length; m++) {
    const curr = monthlyStats[m];
    const prev = monthlyStats[Math.max(0, m - 1)];
    const next = monthlyStats[Math.min(monthlyStats.length - 1, m + 1)];
    const currVal = Math.max(0, Math.min(100, curr.marginPct || 0));
    const prevVal = Math.max(0, Math.min(100, prev.marginPct || 0));
    const nextVal = Math.max(0, Math.min(100, next.marginPct || 0));

    // Sub-divide each month into 4 smooth stepped bars interpolating neighbor trends
    const subValues = [
      Math.round(prevVal * 0.35 + currVal * 0.65),
      currVal,
      Math.round(currVal * 0.85 + nextVal * 0.15),
      Math.round(currVal * 0.65 + nextVal * 0.35),
    ];

    for (let b = 0; b < binsPerMonth; b++) {
      points.push({
        key: `${curr.key}-${b}`,
        monthLabel: curr.label,
        value: subValues[b],
        showMonth: b === 1,
      });
    }
  }

  let peakIndex = 0;
  let peakPct = 0;
  for (let i = 0; i < points.length; i++) {
    if (points[i].value >= peakPct) {
      peakPct = points[i].value;
      peakIndex = i;
    }
  }

  if (peakPct === 0 && fallbackPct > 0 && points.length > 0) {
    peakPct = Math.max(0, Math.min(100, fallbackPct));
    peakIndex = points.length - 1;
  }

  return { points, peakIndex, peakPct };
}

/**
 * Computes all widget KPIs, cashflow totals, period comparisons, dot-matrix buckets,
 * stepped margin series, and pipeline stages for a period in one pass.
 */
export function computeDashboardMetrics({
  invoices,
  expenses,
  workOrders,
  clients,
  tasks,
  period,
  currency: activeCurrency,
  now = new Date(),
}: ComputeDashboardMetricsInput): DashboardMetrics {
  const {
    prevStart,
    prevEnd,
    periodRangeLabel,
    previousRangeLabel,
  } = getPeriodWindowBounds(period, now);

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

  const filteredInvoices = issuedInPeriod(invoices, activeCurrency, period, now);
  const financials = calculateFinancials({
    invoices,
    workOrders,
    expenses,
    tasks,
    period,
    currency: activeCurrency,
    now,
  });

  // Compute immediately preceding period comparisons for delta pills & "vs last period"
  const prevInvoices = invoices.filter((inv) => {
    if (inv.status === "DRAFT" || inv.currency !== activeCurrency) return false;
    const dt = parseIsoDay(inv.issueDate);
    return dt !== null && dt >= prevStart && dt <= prevEnd;
  });
  const prevRevenueCents = prevInvoices.reduce((s, inv) => s + inv.amountCents, 0);

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

  const grossDeltaPct =
    prevRevenueCents > 0
      ? Math.round(((totalRevenueCents - prevRevenueCents) / prevRevenueCents) * 100)
      : totalRevenueCents > 0
        ? 100
        : null;
  const invoicesCountDelta = filteredInvoices.length - prevInvoices.length;

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
  let prevPeriodNewClients = 0;
  let currentPeriodNewClients = 0;
  for (const client of clients) {
    if (client.invoicesCount > 0 || client.outstandingBalanceCents > 0) {
      activeClientsCount += 1;
    }
    const created = parseIsoDay(client.createdAt);
    if (created) {
      if (created >= prevStart && created <= prevEnd) {
        prevPeriodNewClients += 1;
      } else if (created > prevEnd) {
        currentPeriodNewClients += 1;
      }
    }
  }
  const clientsCountDelta = currentPeriodNewClients - prevPeriodNewClients;

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

  // 5-Stage Progressive Billing & Collection Funnel
  const rawStages = [
    {
      label: "Billed Invoices",
      href: "/invoices",
      value: totalRevenueCents,
      sub: `${filteredInvoices.length} issued invoice${filteredInvoices.length === 1 ? "" : "s"}`,
    },
    {
      label: "Collected",
      href: "/invoices",
      value: paidCents,
      sub: `${paidRatioPct}% realized receipts`,
    },
    {
      label: "Net Profit",
      href: "/analytics",
      value: Math.max(0, netProfitCents),
      sub: `${marginPct}% margin after costs`,
    },
    {
      label: "Outstanding",
      href: "/invoices",
      value: pendingCents,
      sub: `${pendingCount} open balance${pendingCount === 1 ? "" : "s"}`,
    },
    {
      label: "Costs & Payouts",
      href: "/expenses",
      value: opexCents,
      sub: `${opexRatioPct}% overhead ratio`,
    },
  ];
  const scale = Math.max(...rawStages.map((s) => Math.abs(s.value)), 1);
  const pipelineStages: DashboardPipelineStage[] = rawStages.map((stage, idx) => {
    const prevValue = idx === 0 ? stage.value : rawStages[idx - 1].value;
    const conversionPct =
      prevValue > 0
        ? Math.min(100, Math.max(0, Math.round((stage.value / prevValue) * 100)))
        : stage.value > 0
          ? 100
          : 0;
    const dropOffPct = idx === 0 ? 0 : Math.max(0, 100 - conversionPct);
    const heightPct =
      stage.value === 0 ? 12 : Math.max(16, Math.round((Math.abs(stage.value) / scale) * 100));
    return {
      ...stage,
      valueStr: formatCents(stage.value, activeCurrency),
      heightPct,
      conversionPct,
      dropOffPct,
    };
  });

  const {
    points: steppedRetentionSeries,
    peakIndex: steppedPeakIndex,
    peakPct: steppedPeakPct,
  } = buildSteppedRetentionSeries(financials.monthlyTrends, Math.max(0, marginPct));

  const issuedDates = invoices
    .filter((i) => i.status !== "DRAFT" && i.currency === activeCurrency)
    .map((i) => i.issueDate);
  const { buckets: invoiceDotBuckets, peakLabel: invoicePeakLabel } =
    buildDotMatrixBuckets(issuedDates, now, 14);

  const clientDates = clients.map((c) => c.createdAt);
  const { buckets: clientDotBuckets, peakLabel: clientPeakLabel } =
    buildDotMatrixBuckets(clientDates, now, 14);

  return {
    period,
    activeCurrency,
    periodRangeLabel,
    previousRangeLabel,
    grossDeltaPct,
    invoicesCountDelta,
    clientsCountDelta,
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
    steppedRetentionSeries,
    steppedPeakIndex,
    steppedPeakPct,
    invoiceDotBuckets,
    invoicePeakLabel,
    clientDotBuckets,
    clientPeakLabel,
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
  const { tasks } = useTasks();

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

export function useDashboardMetrics(period?: DashboardPeriod): DashboardMetrics {
  const ctx = useContext(DashboardMetricsContext);
  if (!ctx) {
    throw new Error(
      "useDashboardMetrics must be used within a DashboardMetricsProvider",
    );
  }
  if (period && ctx.period !== period) {
    throw new Error(
      `useDashboardMetrics period mismatch: expected ${ctx.period}, received ${period}`,
    );
  }
  return ctx;
}
