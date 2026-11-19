import type { CatalogItem, Currency, InvoiceWithClient } from "../../types/billing";
import type { ExpenseItem } from "../../types/expenses";
import type { WorkOrderItem } from "../../types/outsourcing";
import type { TaskItem } from "../../types/tasks";
import type { AnalyticsSummaryPayload } from "../../types/analytics";
import { formatCents } from "../format";
import { calendarDateKey, recentMonths } from "../visual-metrics";

const AI_CONSULTING_PATTERN = /\bai\b|consulting|automation|agent|advisory|audit/i;

function isAiOrConsultingText(text: string): boolean {
  return AI_CONSULTING_PATTERN.test(text);
}

function monthBuckets(count: number, now = new Date(), longMonth = false) {
  return Array.from({ length: count }, (_, idx) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - idx), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en", { month: longMonth ? "long" : "short" });
    return { key, label };
  });
}

export function buildPortfolioComparisonData(
  invoices: InvoiceWithClient[],
  catalogItems: CatalogItem[],
  currency: Currency,
  now = new Date(),
) {
  const catalogCategoryById = new Map(
    catalogItems.map((item) => [item.id, item.category]),
  );
  let totalWebCents = 0;
  let totalAiCents = 0;
  const validInvoices = (invoices || []).filter(
    (inv) => inv.status !== "DRAFT" && inv.currency === currency,
  );

  const months = recentMonths(now).map((m) => ({
    date: m.label,
    key: m.key,
    web: 0,
    ai: 0,
  }));
  const monthMap = new Map(months.map((m) => [m.key, m]));

  for (const inv of validInvoices) {
    const monthKey = inv.issueDate ? calendarDateKey(inv.issueDate).slice(0, 7) : "";
    const bucket = monthMap.get(monthKey);

    if (inv.items && inv.items.length > 0) {
      for (const item of inv.items) {
        const cat = item.catalogId ? catalogCategoryById.get(item.catalogId) : undefined;
        const isAi =
          cat === "Consulting" || isAiOrConsultingText(item.description || "");
        const itemCents = (item.quantity || 1) * (item.unitPriceCents || 0);
        if (isAi) {
          totalAiCents += itemCents;
          if (bucket) bucket.ai += Math.round(itemCents / 100);
        } else {
          totalWebCents += itemCents;
          if (bucket) bucket.web += Math.round(itemCents / 100);
        }
      }
    } else {
      const text = `${inv.title || ""} ${inv.notes || ""} ${inv.clientName || ""}`;
      const isAi = isAiOrConsultingText(text);
      if (isAi) {
        totalAiCents += inv.amountCents;
        if (bucket) bucket.ai += Math.round(inv.amountCents / 100);
      } else {
        totalWebCents += inv.amountCents;
        if (bucket) bucket.web += Math.round(inv.amountCents / 100);
      }
    }
  }

  const totalPortfolioCents = totalWebCents + totalAiCents;
  const webPct =
    totalPortfolioCents > 0
      ? Math.round((totalWebCents / totalPortfolioCents) * 100)
      : 0;
  const aiPct =
    totalPortfolioCents > 0
      ? Math.round((totalAiCents / totalPortfolioCents) * 100)
      : 0;

  return {
    series: [
      {
        key: "web" as const,
        label: "Core services",
        color: "#2563eb",
        pct: webPct,
        formattedTotal: formatCents(totalWebCents, currency),
      },
      {
        key: "ai" as const,
        label: "AI & consulting",
        color: "#10b981",
        pct: aiPct,
        formattedTotal: formatCents(totalAiCents, currency),
      },
    ],
    chartData: months.map(({ date, web, ai }) => ({ date, web, ai })),
    hasInvoices: validInvoices.length > 0,
  };
}

export function buildServiceTrendsData(tasks: TaskItem[], now = new Date()) {
  const months = monthBuckets(6, now, true).map((m) => ({
    month: m.label,
    key: m.key,
    web: 0,
    ai: 0,
  }));
  const monthMap = new Map(months.map((m) => [m.key, m]));
  let count = 0;

  for (const t of tasks || []) {
    if (t.status !== "done") continue;
    const rawDate = t.completedAt || t.updatedAt || t.createdAt;
    if (!rawDate) continue;
    const target = monthMap.get(calendarDateKey(rawDate).slice(0, 7));
    if (!target) continue;

    const isAi =
      t.category === "Client Ops" ||
      isAiOrConsultingText(`${t.title} ${t.description || ""}`);
    if (isAi) {
      target.ai += 1;
    } else {
      target.web += 1;
    }
    count += 1;
  }

  return {
    chartData: months.map(({ month, web, ai }) => ({ month, web, ai })),
    hasData: count > 0,
  };
}

export function buildItemizedVolumeData(
  invoices: InvoiceWithClient[],
  catalogItems: CatalogItem[],
  currency: Currency,
  now = new Date(),
) {
  const catalogCategoryById = new Map(
    catalogItems.map((item) => [item.id, item.category]),
  );
  const months = monthBuckets(6, now, true).map((m) => ({
    month: m.label,
    key: m.key,
    web: 0,
    ai: 0,
  }));
  const monthMap = new Map(months.map((m) => [m.key, m]));
  let count = 0;

  for (const inv of invoices || []) {
    if (inv.status === "DRAFT" || inv.currency !== currency || !inv.issueDate) {
      continue;
    }
    const target = monthMap.get(calendarDateKey(inv.issueDate).slice(0, 7));
    if (!target) continue;

    if (inv.items && inv.items.length > 0) {
      for (const item of inv.items) {
        const qty = Math.max(1, item.quantity || 1);
        const cat = item.catalogId ? catalogCategoryById.get(item.catalogId) : undefined;
        const isAi =
          cat === "Consulting" || isAiOrConsultingText(item.description || "");
        if (isAi) {
          target.ai += qty;
        } else {
          target.web += qty;
        }
        count += qty;
      }
      continue;
    }

    const isAi = isAiOrConsultingText(
      `${inv.title || ""} ${inv.notes || ""} ${inv.clientName || ""}`,
    );
    if (isAi) {
      target.ai += 1;
    } else {
      target.web += 1;
    }
    count += 1;
  }

  return {
    chartData: months.map(({ month, web, ai }) => ({ month, web, ai })),
    hasData: count > 0,
  };
}

function getTaskHours(t: TaskItem, nowMs: number): number {
  const runningMs =
    t.status === "in-progress" && t.activeSince
      ? Math.max(0, nowMs - Date.parse(t.activeSince))
      : 0;
  const totalMs = (t.activeMilliseconds || 0) + runningMs;
  if (totalMs <= 0) return 0;
  return Math.max(0.1, Math.round((totalMs / 3600000) * 100) / 100);
}

function calcPercentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return (
    Math.round(
      (sorted[Math.max(0, Math.min(sorted.length - 1, idx))] || 0) * 100,
    ) / 100
  );
}

export function buildLatencyPercentilesData(tasks: TaskItem[], now = new Date()) {
  const nowMs = now.getTime();
  const completed = (tasks || []).filter((task) => task.status === "done");
  const sourceTasks =
    completed.some((t) => getTaskHours(t, nowMs) > 0)
      ? completed
      : (tasks || []).filter((t) => getTaskHours(t, nowMs) > 0);
  const positiveHours = sourceTasks
    .map((t) => getTaskHours(t, nowMs))
    .filter((h) => h > 0);

  const p99 = calcPercentile(positiveHours, 99);
  const p95 = calcPercentile(positiveHours, 95);
  const p75 = calcPercentile(positiveHours, 75);
  const p50 = calcPercentile(positiveHours, 50);

  const series = [
    { key: "p99", label: "P99 active time", color: "#D41F12", latest: p99 },
    { key: "p95", label: "P95 active time", color: "#F37A00", latest: p95 },
    { key: "p75", label: "P75 active time", color: "#62C9D4", latest: p75 },
    { key: "p50", label: "P50 active time", color: "#007292", latest: p50 },
  ] as const;

  const milestones = monthBuckets(6, now).map(({ key, label }) => {
    const bucketHours = sourceTasks
      .filter((t) => {
        const dateStr = t.completedAt || t.updatedAt || t.createdAt;
        return dateStr && calendarDateKey(dateStr).startsWith(key);
      })
      .map((t) => getTaskHours(t, nowMs))
      .filter((h) => h > 0);

    return {
      milestone: label,
      key,
      p99: calcPercentile(bucketHours, 99),
      p95: calcPercentile(bucketHours, 95),
      p75: calcPercentile(bucketHours, 75),
      p50: calcPercentile(bucketHours, 50),
    };
  });

  return {
    series,
    chartData: milestones,
    hasTrackedHours: positiveHours.length > 0,
  };
}

export function buildGrowthBenchmarkData(tasks: TaskItem[], now = new Date()) {
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  return Array.from({ length: 8 }, (_, index) => {
    const end = new Date(endOfDay);
    end.setDate(end.getDate() - (7 - index) * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    return {
      date: end.toLocaleDateString("en", { month: "short", day: "numeric" }),
      completed: (tasks || []).filter((task) => {
        if (task.status !== "done") return false;
        const ts = task.completedAt || task.updatedAt || task.createdAt;
        if (!ts) return false;
        const parsed = new Date(ts);
        return parsed > start && parsed <= end;
      }).length,
    };
  });
}

export function buildAudienceGrowthData(
  invoices: InvoiceWithClient[],
  expenses: ExpenseItem[],
  workOrders: WorkOrderItem[],
  currency: Currency,
  now = new Date(),
) {
  const months = monthBuckets(7, now).map(({ key, label }) => ({
    month: label,
    key,
    collections: 0,
    expenses: 0,
    profit: 0,
  }));
  const monthMap = new Map(months.map((m) => [m.key, m]));

  for (const invoice of invoices || []) {
    if (invoice.status === "DRAFT" || invoice.currency !== currency) continue;
    for (const payment of invoice.payments || []) {
      if (payment.currency !== currency || payment.correction) continue;
      const target = monthMap.get(calendarDateKey(payment.receivedAt).slice(0, 7));
      if (target) target.collections += payment.amountCents / 100;
    }
  }

  for (const expense of expenses || []) {
    if (expense.currency !== currency) continue;
    const target = monthMap.get(calendarDateKey(expense.incurredAt).slice(0, 7));
    if (target) target.expenses += expense.amountCents / 100;
  }

  for (const order of workOrders || []) {
    if (order.currency !== currency) continue;
    const payouts =
      order.payouts?.filter((payout) => !payout.voidedAt) ??
      (order.paidAt
        ? [{ paidAt: order.paidAt, amountCents: order.payoutAmountCents ?? 0 }]
        : []);
    for (const payout of payouts) {
      const target = monthMap.get(calendarDateKey(payout.paidAt).slice(0, 7));
      if (target) target.expenses += payout.amountCents / 100;
    }
  }

  for (const month of months) {
    month.profit = month.collections - month.expenses;
  }

  const totalCollectedCents = Math.round(
    months.reduce((sum, m) => sum + m.collections, 0) * 100,
  );
  const totalExpenseCents = Math.round(
    months.reduce((sum, m) => sum + m.expenses, 0) * 100,
  );

  return {
    chartData: months.map(({ month, collections, profit }) => ({
      month,
      collections,
      profit,
    })),
    totalCollectedCents,
    totalExpenseCents,
    netProfitCents: totalCollectedCents - totalExpenseCents,
  };
}

export function computeCashflowRunwayCard(
  financials: Pick<
    AnalyticsSummaryPayload,
    "paidCents" | "cashflowRunwayMonths" | "monthlyTrends"
  >,
  currency: Currency,
) {
  const monthlyBurnCents = Math.round(
    financials.monthlyTrends.reduce((sum, m) => sum + m.expensesCents, 0) /
      Math.max(1, financials.monthlyTrends.length),
  );

  if (monthlyBurnCents > 0) {
    const months = financials.cashflowRunwayMonths;
    return {
      value: `${months} mo`,
      badgeText: `${formatCents(monthlyBurnCents, currency)}/mo avg burn`,
      subtitle: "Collected cash reserve vs 6-mo costs",
      barPct: Math.min(100, Math.round((months / 12) * 100)),
    };
  }

  return {
    value: formatCents(financials.paidCents, currency),
    badgeText: "Zero monthly burn",
    subtitle: "Collected cash reserve in period",
    barPct: financials.paidCents > 0 ? 100 : 0,
  };
}
