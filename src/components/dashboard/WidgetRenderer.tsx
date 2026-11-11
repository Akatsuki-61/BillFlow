"use client";

import React, { useState, useMemo, useId } from "react";
import Link from "next/link";
import { MonthlyBars, DataDots } from "@/components/ui/DataGraphic";
import {
  issuedInPeriod,
  isPastDue,
  sharePercent,
  taskProgress,
  recentMonths,
  localDateKey,
  SHORT_MONTHS,
} from "@/lib/visual-metrics";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  X,
  Lightbulb,
} from "lucide-react";
import {
  useData,
  useInvoices,
  useClients,
  useVendors,
  useActiveCurrency,
} from "@/lib/data/DataProvider";
import {
  formatCents,
  formatDateDisplay,
  getCurrencySymbol,
} from "@/lib/format";
import { DashboardPeriod } from "@/types/dashboard";
import { WidgetDisplaySize } from "@/types/widgets";
import { useWidgetContext } from "@/context/WidgetContext";
import "../analytics/analytics.css";
import { LatencyPercentilesChart } from "./charts/LatencyPercentilesChart";
import { PortfolioComparisonChart } from "./charts/PortfolioComparisonChart";
import { GrowthBenchmarkChart } from "./charts/GrowthBenchmarkChart";
import { AudienceGrowthChart } from "./charts/AudienceGrowthChart";
import { ServiceTrendsLineChart } from "./charts/ServiceTrendsLineChart";
import { ItemizedVolumeBarChart } from "./charts/ItemizedVolumeBarChart";

let sharedTransparentDragCanvas: HTMLCanvasElement | null = null;
function getTransparentDragCanvas(): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  if (!sharedTransparentDragCanvas) {
    sharedTransparentDragCanvas = document.createElement("canvas");
    sharedTransparentDragCanvas.width = 1;
    sharedTransparentDragCanvas.height = 1;
  }
  return sharedTransparentDragCanvas;
}

interface WidgetRendererProps {
  widgetId: string;
  source: "dashboard" | "analytics";
  period?: DashboardPeriod;
  displaySize?: WidgetDisplaySize;
  isDraggable?: boolean;
  isEditing?: boolean;
  onToggleSize?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onRemove?: () => void;
  onContextMenu?: (e: React.MouseEvent, widgetId: string) => void;
  onNavigateToInvoice?: (id: string) => void;
}

export function WidgetRenderer({
  widgetId,
  source,
  period = "quarter",
  displaySize = "normal",
  isDraggable = false,
  isEditing = false,
  onToggleSize,
  onMoveLeft,
  onMoveRight,
  onRemove,
  onContextMenu,
  onNavigateToInvoice,
}: WidgetRendererProps) {
  const router = useRouter();
  const pipelineId = useId();
  const { invoices } = useInvoices();
  const { clients } = useClients();
  const { vendors } = useVendors();
  const { activeCurrency } = useActiveCurrency();
  const { tasks, expenses, workOrders } = useData();
  const { draggedWidgetId, startWidgetDrag, endWidgetDrag } = useWidgetContext();
  const isBeingDragged = draggedWidgetId === widgetId;

  const [hoveredFunnelIdx, setHoveredFunnelIdx] = useState<number | null>(null);

  const activeTasks = useMemo(() => {
    return tasks.filter((t) => t.status !== "done");
  }, [tasks]);

  const filteredInvoices = useMemo(
    () => issuedInPeriod(invoices, activeCurrency, period),
    [invoices, activeCurrency, period],
  );

  // Costs use job work orders in the same invoice cohort and currency.
  const totalOutsourcedCents = useMemo(
    () =>
      workOrders
        .filter(
          (order) =>
            order.currency === activeCurrency &&
            filteredInvoices.some((inv) => inv.id === order.invoiceId),
        )
        .reduce((sum, order) => sum + order.feeCents, 0),
    [workOrders, activeCurrency, filteredInvoices],
  );

  const outsourcedCostsStr = useMemo(() => {
    return formatCents(totalOutsourcedCents, activeCurrency);
  }, [totalOutsourcedCents, activeCurrency]);

  // Aggregate metrics from live invoices
  const {
    totalRevenueCents,
    paidCount,
    paidCents,
    paidFullCents,
    advanceCentsCollected,
    advancePaidCount,
    pendingCents,
    pendingCount,
    paidRatioPct,
    avgInvoiceStr,
  } = useMemo(() => {
    if (filteredInvoices.length === 0) {
      return {
        totalRevenueCents: 0,
        paidCount: 0,
        paidCents: 0,
        paidFullCents: 0,
        advanceCentsCollected: 0,
        advancePaidCount: 0,
        pendingCents: 0,
        pendingCount: 0,
        paidRatioPct: 0,
        avgInvoiceCents: 0,
        avgInvoiceStr: formatCents(0, activeCurrency),
      };
    }

    let total = 0;
    let paid = 0;
    let paidAmt = 0;
    let paidFull = 0;
    let advAmt = 0;
    let advCount = 0;
    let pendingAmt = 0;
    let pendingCnt = 0;

    filteredInvoices.forEach((inv) => {
      total += inv.amountCents;
      const collected =
        inv.paidCents ?? (inv.status === "PAID" ? inv.amountCents : 0);
      paidAmt += collected;
      if (inv.status === "PAID") {
        paid += 1;
        paidFull += inv.amountCents;
      } else {
        pendingCnt += 1;
        if (inv.status === "ADVANCE_PAID" || collected > 0) {
          advCount += 1;
          advAmt += collected;
        }
        pendingAmt += Math.max(0, inv.amountCents - collected);
      }
    });

    const ratio = total > 0 ? Math.round((paidAmt / total) * 100) : 0;
    const avg =
      filteredInvoices.length > 0
        ? Math.round(total / filteredInvoices.length)
        : 0;

    return {
      totalRevenueCents: total,
      paidCount: paid,
      paidCents: paidAmt,
      paidFullCents: paidFull,
      advanceCentsCollected: advAmt,
      advancePaidCount: advCount,
      pendingCents: pendingAmt,
      pendingCount: pendingCnt,
      paidRatioPct: ratio,
      avgInvoiceCents: avg,
      avgInvoiceStr: formatCents(avg, activeCurrency),
    };
  }, [filteredInvoices, activeCurrency]);

  const totalRevenueStr = useMemo(() => {
    return formatCents(totalRevenueCents, activeCurrency);
  }, [totalRevenueCents, activeCurrency]);

  const pendingReceivablesStr = useMemo(() => {
    return formatCents(pendingCents, activeCurrency);
  }, [pendingCents, activeCurrency]);

  // Filter general operational expenses
  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return expenses.filter((e) => {
      if (
        activeCurrency &&
        e.currency &&
        e.currency.toUpperCase() !== activeCurrency.toUpperCase()
      ) {
        return false;
      }
      if (!period || period === "all") return true;
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
  }, [expenses, period, activeCurrency]);

  const generalExpensesCents = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + (e.amountCents || 0), 0);
  }, [filteredExpenses]);

  const opexCents = useMemo(() => {
    return totalOutsourcedCents + generalExpensesCents;
  }, [totalOutsourcedCents, generalExpensesCents]);

  const opexStr = useMemo(() => {
    return formatCents(opexCents, activeCurrency);
  }, [opexCents, activeCurrency]);

  const opexRatioPct = useMemo(() => {
    if (totalRevenueCents <= 0) return 0;
    return Math.round((opexCents / totalRevenueCents) * 100);
  }, [opexCents, totalRevenueCents]);

  const netProfitCents = useMemo(() => {
    return totalRevenueCents - opexCents;
  }, [totalRevenueCents, opexCents]);

  const isLoss = netProfitCents < 0;

  const netProfitStr = useMemo(() => {
    return formatCents(netProfitCents, activeCurrency);
  }, [netProfitCents, activeCurrency]);

  const marginPct = useMemo(() => {
    if (totalRevenueCents <= 0) return 0;
    return Math.round((netProfitCents / totalRevenueCents) * 100);
  }, [totalRevenueCents, netProfitCents]);

  const totalClientsCount = clients.length;
  const activeClientsCount = useMemo(() => {
    return clients.filter(
      (c) => c.invoicesCount > 0 || c.outstandingBalanceCents > 0,
    ).length;
  }, [clients]);

  const topClient = useMemo(() => {
    const totals = new Map<
      string,
      { name: string; totalBilledCents: number }
    >();
    filteredInvoices.forEach((invoice) => {
      const key = invoice.clientId || `invoice:${invoice.id}`;
      const current = totals.get(key) || {
        name: invoice.clientName,
        totalBilledCents: 0,
      };
      current.totalBilledCents += invoice.amountCents;
      totals.set(key, current);
    });
    return [...totals.values()].sort(
      (a, b) => b.totalBilledCents - a.totalBilledCents,
    )[0];
  }, [filteredInvoices]);
  const topClientPct = sharePercent(
    topClient?.totalBilledCents ?? 0,
    totalRevenueCents,
  );

  const { effectiveHourlyRate, totalTrackedHours } = useMemo(() => {
    const totalActiveMs = tasks.reduce(
      (sum, t) => sum + (t.activeMilliseconds || 0),
      0,
    );
    const hours = totalActiveMs / 3600000;
    if (hours <= 0) {
      return { effectiveHourlyRate: 0, totalTrackedHours: 0 };
    }
    const rate = Math.round(netProfitCents / 100 / hours);
    return { effectiveHourlyRate: rate, totalTrackedHours: hours };
  }, [tasks, netProfitCents]);

  const overdueInvoices = useMemo(
    () => filteredInvoices.filter((invoice) => isPastDue(invoice)),
    [filteredInvoices],
  );

  const overdueTotalStr = useMemo(() => {
    const cents = overdueInvoices.reduce(
      (acc, inv) => acc + Math.max(0, inv.amountCents - (inv.paidCents ?? 0)),
      0,
    );
    return formatCents(cents, activeCurrency);
  }, [overdueInvoices, activeCurrency]);

  const displayInvoices = useMemo(
    () => filteredInvoices.slice(0, displaySize === "compact" ? 2 : 4),
    [filteredInvoices, displaySize],
  );

  // 6-month historical/projected monthly points for charts
  const monthlyStats = useMemo(() => {
    const months: Array<{
      key: string;
      label: string;
      revenueCents: number;
      expensesCents: number;
      profitCents: number;
      marginPct: number;
    }> = [];

    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = SHORT_MONTHS[d.getMonth()];
      months.push({
        key,
        label,
        revenueCents: 0,
        expensesCents: 0,
        profitCents: 0,
        marginPct: 0,
      });
    }

    invoices.forEach((inv) => {
      if (
        !inv.issueDate ||
        inv.status === "DRAFT" ||
        inv.currency !== activeCurrency
      )
        return;
      const invKey = inv.issueDate.slice(0, 7);
      const target = months.find((m) => m.key === invKey);
      if (target) {
        target.revenueCents += inv.amountCents;
      }
    });

    workOrders
      .filter((order) => order.currency === activeCurrency)
      .forEach((order) => {
        const sourceInvoice = invoices.find(
          (invoice) => invoice.id === order.invoiceId,
        );
        const target = months.find(
          (month) => month.key === sourceInvoice?.issueDate.slice(0, 7),
        );
        if (target) target.expensesCents += order.feeCents;
      });
    expenses
      .filter((expense) => expense.currency === activeCurrency)
      .forEach((expense) => {
        const target = months.find(
          (month) => month.key === expense.incurredAt?.slice(0, 7),
        );
        if (target) target.expensesCents += expense.amountCents;
      });

    months.forEach((m) => {
      m.profitCents = m.revenueCents - m.expensesCents;
      m.marginPct =
        m.revenueCents > 0
          ? Math.round((m.profitCents / m.revenueCents) * 100)
          : 0;
    });

    return months;
  }, [invoices, expenses, workOrders, activeCurrency]);

  // Task stage counts for Sprint Tasks visual breakdown
  const taskCounts = useMemo(() => {
    const todo = tasks.filter((t) => t.status === "todo").length;
    const inProgress = tasks.filter((t) => t.status === "in-progress").length;
    const review = tasks.filter((t) => t.status === "review").length;
    const done = tasks.filter((t) => t.status === "done").length;
    const total = tasks.length;
    const donePct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { todo, inProgress, review, done, total, donePct };
  }, [tasks]);

  // Independent measures on one zero-based scale; no simulated conversion stages.
  const pipelineStages = useMemo(() => {
    const values = [
      totalRevenueCents,
      paidCents,
      pendingCents,
      opexCents,
      netProfitCents,
    ];
    const scale = Math.max(...values.map(Math.abs), 1);
    return [
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
  }, [
    totalRevenueCents,
    paidCents,
    pendingCents,
    opexCents,
    netProfitCents,
    filteredInvoices.length,
    activeCurrency,
  ]);

  const isCompact = displaySize === "compact";

  // Helper to render a Zentra Metric Card with a Dot-Matrix + Striped Bar
  const renderZentraMetric = ({
    title,
    value,
    badgeText,
    subtitle,
    barPct,
    stripeTone = "blue",
    href = "/analytics",
    actionLabel,
  }: {
    title: string;
    value: React.ReactNode;
    badgeText: string;
    subtitle: string;
    barPct?: number;
    stripeTone?: "blue" | "green" | "pink" | "amber";
    href?: string;
    actionLabel?: string;
  }) => {
    const stripeClass =
      stripeTone === "green"
        ? "zentra-stripe-green"
        : stripeTone === "pink"
          ? "zentra-stripe-pink"
          : stripeTone === "amber"
            ? "zentra-stripe-amber"
            : "zentra-stripe-blue";

    const dotActiveColor =
      stripeTone === "green"
        ? "bg-[#16a34a]"
        : stripeTone === "pink"
          ? "bg-[#ec4899]"
          : stripeTone === "amber"
            ? "bg-[#f59e0b]"
            : "bg-accent-solid";

    return (
      <div
        role="link"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" && event.target === event.currentTarget)
            router.push(href);
        }}
        onClick={() => router.push(href)}
        className={`ui-card cursor-pointer flex flex-col justify-between ${
          isCompact ? "p-4 min-h-[155px]" : "p-6 min-h-[195px]"
        }`}
      >
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[17px] font-medium tracking-[-0.02em] text-content-neutral-950 truncate">
              {title}
            </h3>
          </div>

          <div className="my-3 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div
                className={`${
                  isCompact ? "text-[26px]" : "text-[36px]"
                } font-medium tracking-[-0.04em] text-content-neutral-950 leading-none tabular-nums truncate`}
              >
                {value}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="zentra-pill-badge !py-0.5 !px-2.5 !text-[11.5px]">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${dotActiveColor}`}
                  />
                  {badgeText}
                </span>
              </div>
            </div>
          </div>

          {barPct !== undefined && (
            <div className="pt-2.5 border-t border-line-neutral-100 space-y-2">
              <div className="flex items-center justify-between text-[12px] text-content-neutral-500">
                <span className="truncate">{subtitle}</span>
                <span className="font-semibold tabular-nums text-content-neutral-800">
                  {Math.round(barPct)}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-surface-neutral-100 p-[1.5px] overflow-hidden">
                <div
                  className={`h-full rounded-full ${stripeClass} transition-all duration-500`}
                  style={{ width: `${Math.round(barPct)}%` }}
                />
              </div>
            </div>
          )}
          {barPct === undefined && <p className="summary-caption">{subtitle}</p>}
        </div>

        <div className="mt-3.5 pt-3 border-t border-line-neutral-100 flex items-center justify-between text-[12.5px] text-content-neutral-500">
          <span className="truncate text-[12px]">{subtitle}</span>
          <Link
            href={href}
            onClick={(e) => e.stopPropagation()}
            className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1 shrink-0"
          >
            <span>{actionLabel || `Open ${title}`}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  };

  const [activeInsightIndex, setActiveInsightIndex] = useState(0);

  const insightSlides = useMemo(() => {
    let totalBilledCents = 0;
    let collectedCents = 0;

    filteredInvoices.forEach((inv) => {
      totalBilledCents += inv.amountCents;
      const collected =
        inv.paidCents ?? (inv.status === "PAID" ? inv.amountCents : 0);
      collectedCents += collected;
    });

    const contractorCents = workOrders
      .filter(
        (order) =>
          order.currency === activeCurrency &&
          filteredInvoices.some((inv) => inv.id === order.invoiceId),
      )
      .reduce((sum, order) => sum + order.feeCents, 0);

    const generalExpCents = (expenses || [])
      .filter(
        (expense) =>
          expense.currency === activeCurrency &&
          (period === "all" ||
            (period === "year"
              ? expense.incurredAt.slice(0, 4) ===
                String(new Date().getFullYear())
              : period === "month"
                ? expense.incurredAt.slice(0, 7) === localDateKey().slice(0, 7)
                : new Date(expense.incurredAt).getFullYear() ===
                    new Date().getFullYear() &&
                  Math.floor(new Date(expense.incurredAt).getMonth() / 3) ===
                    Math.floor(new Date().getMonth() / 3))),
      )
      .reduce((sum, e) => sum + (e.amountCents || 0), 0);

    const billedProfitCents =
      totalBilledCents - contractorCents - generalExpCents;

    const collectionRatePct =
      totalBilledCents > 0
        ? Math.round((collectedCents / totalBilledCents) * 100)
        : 0;

    const completedTasksCount = tasks.filter((t) => t.status === "done").length;
    const activeClientsCount = clients.filter(
      (c) => c.invoicesCount > 0 || c.outstandingBalanceCents > 0,
    ).length;

    return [
      {
        metric: `${collectionRatePct}%`,
        title:
          "Advance payment collection keeps project cashflow positive from day one",
        description:
          "Recording the 50% advance deposit before generating sprint deliverables connects billing directly to execution.",
        actionLabel: "Open Invoices",
        actionHref: "/invoices",
      },
      {
        metric: `${completedTasksCount}/${tasks.length}`,
        title: `${completedTasksCount} of ${tasks.length} linked deliverables completed on the sprint board`,
        description:
          "Invoice line items convert into trackable Kanban deliverables with independent subcontractor outsourcing.",
        actionLabel: "Open Sprint Board",
        actionHref: "/tasks",
      },
      {
        metric: `${activeClientsCount}`,
        title: `${activeClientsCount} active client accounts with connected delivery repositories`,
        description:
          "Saved delivery links keep source repositories, staging URLs, and consulting docs attached to every job.",
        actionLabel: "Open Clients",
        actionHref: "/clients",
      },
      {
        metric: formatCents(billedProfitCents, activeCurrency),
        title:
          "Billed profit after agreed contractor fees and operating expenses",
        description:
          "Issued invoice totals less agreed work order fees and recorded expenses. This includes unpaid invoices and contractor fees awaiting payout.",
        actionLabel: "Open Expenses",
        actionHref: "/expenses",
      },
    ];
  }, [
    filteredInvoices,
    workOrders,
    expenses,
    tasks,
    clients,
    activeCurrency,
    period,
  ]);

  // Render individual widget based on ID
  const renderContent = () => {
    switch (widgetId) {
      // 0. Workspace Insights — Atmospheric Spotlight Hero Card
      case "workspace-insights": {
        const currentInsight =
          insightSlides[activeInsightIndex % insightSlides.length];
        const isCompact = displaySize === "compact";

        return (
          <div
            onClick={() =>
              setActiveInsightIndex((prev) => (prev + 1) % insightSlides.length)
            }
            className={`dashboard-insight zentra-insights-card rounded-[24px] shadow-sm cursor-pointer select-none relative overflow-hidden transition-all h-full ${
              isCompact
                ? "p-5 flex flex-col justify-between gap-4 min-h-[170px]"
                : "p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 min-h-[160px]"
            }`}
          >
            {/* Decorative Glass Geometric Prism SVG (right) */}
            <svg
              className="absolute -top-6 -right-4 w-56 h-56 text-white/25 pointer-events-none"
              viewBox="0 0 200 200"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M70 10 L190 50 L150 185 L35 130 Z"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="rgba(255,255,255,0.06)"
              />
              <path
                d="M70 10 L125 95 L190 50"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path
                d="M125 95 L150 185"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path
                d="M35 130 L125 95"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="flex flex-col gap-2 shrink-0">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/25 text-white text-[12.5px] font-medium w-fit">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-200" />
                  <span>Workspace Insights</span>
                </span>
                <div
                  className={`${
                    isCompact ? "text-[30px]" : "text-[40px] xl:text-[46px]"
                  } font-medium tracking-[-0.04em] leading-none tabular-nums text-white`}
                >
                  {currentInsight.metric}
                </div>
              </div>

              <div className="sm:border-l sm:border-white/25 sm:pl-5 max-w-xl">
                <h3
                  className={`${
                    isCompact ? "text-[14.5px]" : "text-[16.5px]"
                  } font-semibold text-white leading-snug`}
                >
                  {currentInsight.title}
                </h3>
                <p
                  className={`${
                    isCompact ? "text-[12px] line-clamp-2" : "text-[13px]"
                  } text-white/85 mt-1 leading-relaxed`}
                >
                  {currentInsight.description}
                </p>
              </div>
            </div>

            {/* Right: Quick Action Pill + 4-Segment Progress Indicator */}
            <div
              className="relative z-10 flex flex-col sm:items-end justify-between gap-4 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => router.push(currentInsight.actionHref)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-[#111115] text-[12.5px] font-semibold shadow-sm hover:bg-white/90 transition-all cursor-pointer w-fit"
              >
                <span>{currentInsight.actionLabel}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-2 w-40">
                {insightSlides.map((_, idx) => {
                  const isCurrent =
                    idx === activeInsightIndex % insightSlides.length;
                  return (
                    <button
                      key={idx}
                      type="button"
                      aria-label={`Insight ${idx + 1}`}
                      onClick={() => setActiveInsightIndex(idx)}
                      className={`h-1.5 flex-1 rounded-full transition-all cursor-pointer ${
                        isCurrent ? "bg-white" : "bg-white/30 hover:bg-white/50"
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        );
      }

      // 1. Total Revenue — Zentra Pattern B (Big Metric + Trend Pill + 3 Diagonal-Striped Breakdown Bars)
      case "total-revenue": {
        const settledPct = sharePercent(paidFullCents, totalRevenueCents);
        const advancePct = sharePercent(
          advanceCentsCollected,
          totalRevenueCents,
        );
        const pendingPct = sharePercent(pendingCents, totalRevenueCents);

        return (
          <div className="ui-card p-6 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                  Gross Volume & Revenue
                </h3>
              </div>

              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <span className="text-[40px] sm:text-[44px] font-medium tracking-[-0.04em] text-content-neutral-950 leading-none tabular-nums">
                  {totalRevenueStr}
                </span>
                <span className="zentra-pill-badge">
                  <span>{paidRatioPct}% collected</span>
                </span>
              </div>
            </div>

            <div className="my-4 border-t border-line-neutral-200/80" />

            <div className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between text-[13px] mb-1.5">
                  <span className="text-content-neutral-500 font-medium">
                    Settled Invoices ({paidCount})
                  </span>
                  <span className="font-semibold text-content-neutral-950 tabular-nums">
                    {formatCents(paidFullCents, activeCurrency)}
                  </span>
                </div>
                <div className="w-full h-[10px] rounded-full bg-surface-neutral-100 p-[1.5px] overflow-hidden">
                  <div
                    className="h-full rounded-full zentra-stripe-green transition-all duration-500"
                    style={{ width: `${settledPct}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[13px] mb-1.5">
                  <span className="text-content-neutral-500 font-medium">
                    Advance Deposits ({advancePaidCount})
                  </span>
                  <span className="font-semibold text-content-neutral-950 tabular-nums">
                    {formatCents(advanceCentsCollected, activeCurrency)}
                  </span>
                </div>
                <div className="w-full h-[10px] rounded-full bg-surface-neutral-100 p-[1.5px] overflow-hidden">
                  <div
                    className="h-full rounded-full zentra-stripe-blue transition-all duration-500"
                    style={{ width: `${advancePct}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[13px] mb-1.5">
                  <span className="text-content-neutral-500 font-medium">
                    Pending Balance ({pendingCount})
                  </span>
                  <span className="font-semibold text-content-neutral-950 tabular-nums">
                    {pendingReceivablesStr}
                  </span>
                </div>
                <div className="w-full h-[10px] rounded-full bg-surface-neutral-100 p-[1.5px] overflow-hidden">
                  <div
                    className="h-full rounded-full zentra-stripe-pink transition-all duration-500"
                    style={{ width: `${pendingPct}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-line-neutral-100 flex items-center justify-between text-[12.5px] text-content-neutral-500">
              <span>{paidRatioPct}% collected</span>
              <Link
                href="/invoices"
                className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Open Invoices</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );
      }

      // 2. Net Profit & Margin — Zentra Pattern C (Stepped Pink Pinstripe Area Chart + Peak Pill)
      case "net-profit": {
        return (
          <div className="ui-card p-6 flex flex-col justify-between h-full gap-5">
            <div>
              <h3>{isLoss ? "Net Loss & Margin" : "Net Profit & Margin"}</h3>
              <div className="summary-value mt-3">{netProfitStr}</div>
              <p className="summary-caption">
                {marginPct}% margin · billed less {opexStr} costs
              </p>
            </div>
            <MonthlyBars
              label="Monthly profit · signed amounts"
              points={monthlyStats.map((month) => ({
                ...month,
                value: month.profitCents,
              }))}
              formatValue={(value) => formatCents(value, activeCurrency)}
            />
            <div className="mt-3.5 pt-3 border-t border-line-neutral-100 flex items-center justify-between text-[12.5px] text-content-neutral-500">
              <span>{marginPct}% net margin</span>
              <Link
                href="/analytics"
                className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Open Analytics</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );
      }

      // 3. Pending Receivables — Zentra Pattern D (Big Metric + Green Dot-Matrix Histogram)
      case "pending-receivables": {
        return (
          <div className="ui-card receivables-card p-6 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                  Pending Receivables
                </h3>
              </div>

              <div className="mt-4 flex items-end justify-between gap-4">
                <div>
                  <div className="text-[38px] font-medium tracking-[-0.04em] text-content-neutral-950 leading-none tabular-nums">
                    {pendingReceivablesStr}
                  </div>
                  <div className="mt-2 text-[12.5px] text-content-neutral-500">
                    {pendingCount}{" "}
                    {pendingCount === 1
                      ? "invoice awaiting payment"
                      : "invoices awaiting payment"}
                  </div>
                </div>

                <div className="text-right shrink-0 hidden sm:block">
                  <div className="text-[11.5px] text-content-neutral-400">
                    paid ratio
                  </div>
                  <div className="text-[18px] font-medium tracking-tight text-content-neutral-950 tabular-nums mt-0.5">
                    {paidRatioPct}%
                  </div>
                </div>
              </div>

              <DataDots
                label="Open invoices by issue month"
                noun="invoices"
                tone="green"
                points={recentMonths().map((month) => ({
                  ...month,
                  value: filteredInvoices.filter(
                    (invoice) =>
                      invoice.currency === activeCurrency &&
                      invoice.status !== "DRAFT" &&
                      invoice.amountCents > invoice.paidCents &&
                      invoice.issueDate.startsWith(month.key),
                  ).length,
                }))}
              />
            </div>

            <div className="mt-3.5 pt-3 border-t border-line-neutral-100 flex items-center justify-between text-[12.5px] text-content-neutral-500">
              <span>
                {pendingCount}{" "}
                {pendingCount === 1 ? "invoice awaiting" : "invoices awaiting"}
              </span>
              <Link
                href="/invoices"
                className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Open Invoices</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );
      }

      // 4. Total Clients — Zentra Pattern D (Big Metric + Blue Dot-Matrix Histogram)
      case "active-clients": {
        const activeRatio =
          totalClientsCount > 0
            ? Math.round((activeClientsCount / totalClientsCount) * 100)
            : 0;

        return (
          <div className="ui-card p-6 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                  Customers & Clients
                </h3>
              </div>

              <div className="mt-4 flex items-end justify-between gap-4">
                <div>
                  <div className="text-[40px] font-medium tracking-[-0.04em] text-content-neutral-950 leading-none tabular-nums">
                    {totalClientsCount.toLocaleString()}
                  </div>
                  <div className="mt-2 text-[12.5px] text-content-neutral-500">
                    {activeClientsCount} active accounts
                  </div>
                </div>

                <div className="text-right shrink-0 hidden sm:block">
                  <div className="text-[11.5px] text-content-neutral-400">
                    active share
                  </div>
                  <div className="text-[18px] font-medium tracking-tight text-content-neutral-950 tabular-nums mt-0.5">
                    {activeRatio}%
                  </div>
                </div>
              </div>

              <DataDots
                label="New clients by month"
                noun="clients"
                points={recentMonths().map((month) => ({
                  ...month,
                  value: clients.filter((client) =>
                    client.createdAt.startsWith(month.key),
                  ).length,
                }))}
              />
            </div>

            <div className="mt-3.5 pt-3 border-t border-line-neutral-100 flex items-center justify-between text-[12.5px] text-content-neutral-500">
              <span>{activeClientsCount} active accounts</span>
              <Link
                href="/clients"
                className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Open Clients</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );
      }

      // 5. Outsourced Costs
      case "outsourced-costs":
        return renderZentraMetric({
          title: "Subcontractor Payables",
          value:
            vendors.length > 0
              ? outsourcedCostsStr
              : formatCents(0, activeCurrency),
          badgeText: `${vendors.length} vendors`,
          subtitle: "Contractor share of gross revenue",
          barPct:
            totalRevenueCents > 0
              ? Math.round((totalOutsourcedCents / totalRevenueCents) * 100)
              : 0,
          stripeTone: "blue",
          href: "/outsourcing",
          actionLabel: "Open Outsourcing",
        });

      // 6. Operating Expenses
      case "operating-expenses":
        return renderZentraMetric({
          title: "Operating Expenses",
          value: opexStr,
          badgeText: `${opexRatioPct}% overhead`,
          subtitle: "Costs as a share of billed revenue",
          barPct: opexRatioPct,
          stripeTone: "pink",
          href: "/expenses",
          actionLabel: "Open Expenses",
        });

      // 7. Paid Ratio
      case "paid-ratio":
        return renderZentraMetric({
          title: "Collection Rate",
          value: totalRevenueCents > 0 ? `${paidRatioPct}%` : "0%",
          badgeText: `${paidCount} of ${filteredInvoices.length} settled`,
          subtitle: "Realized collection efficiency",
          barPct: paidRatioPct,
          stripeTone: "green",
          href: "/invoices",
          actionLabel: "Open Invoices",
        });

      // 8. Average Invoice Value
      case "average-invoice-value":
        return renderZentraMetric({
          title: "Average Contract Value",
          value:
            filteredInvoices.length > 0
              ? avgInvoiceStr
              : formatCents(0, activeCurrency),
          badgeText: `${filteredInvoices.length} invoices`,
          subtitle: "Mean contract ticket size",
          stripeTone: "blue",
          href: "/invoices",
          actionLabel: "Open Invoices",
        });

      // 9. Overdue Receivables
      case "overdue-receivables":
        return renderZentraMetric({
          title: "Overdue Receivables",
          value: overdueTotalStr,
          badgeText: `${overdueInvoices.length} overdue`,
          subtitle: "Share of issued invoices overdue",
          barPct:
            filteredInvoices.length > 0
              ? Math.round(
                  (overdueInvoices.length / filteredInvoices.length) * 100,
                )
              : 0,
          stripeTone: "pink",
          href: "/invoices",
          actionLabel: "Open Invoices",
        });

      // 10. Cashflow Runway
      case "cashflow-runway":
        return renderZentraMetric({
          title: "Cashflow Runway",
          value: "Not tracked",
          badgeText: "Cash balance unavailable",
          subtitle:
            "Runway needs a cash reserve balance, which BillFlow does not record.",
          stripeTone: "green",
          href: "/analytics",
          actionLabel: "Open Analytics",
        });

      // 11. Top Client Concentration
      case "client-concentration":
        return renderZentraMetric({
          title: "Client Concentration",
          value: totalRevenueCents > 0 ? `${topClientPct}%` : "0%",
          badgeText: topClient?.name || "Portfolio",
          subtitle: "Share of revenue from top client",
          barPct: topClientPct,
          stripeTone: "blue",
          href: "/clients",
          actionLabel: "Open Clients",
        });

      // 12. Realized Hourly Yield
      case "effective-hourly-rate":
        return renderZentraMetric({
          title: "Profit per Tracked Hour",
          value:
            totalTrackedHours > 0
              ? `${getCurrencySymbol(activeCurrency)}${effectiveHourlyRate}/hr`
              : `${getCurrencySymbol(activeCurrency)}0/hr`,
          badgeText:
            totalTrackedHours > 0
              ? `${Math.round(totalTrackedHours * 10) / 10} hrs tracked`
              : "Track sprint hours",
          subtitle: "Billed profit divided by recorded active hours",
          stripeTone: "green",
          href: "/tasks",
          actionLabel: "Open Sprint Board",
        });

      // 13. Revenue vs Expenses Paired Bar Chart (Zentra Royal Blue & Pink Hatched Bars)
      case "revenue-expenses-chart": {
        const rawMax = Math.max(
          0,
          ...monthlyStats.map((m) => Math.max(m.revenueCents, m.expensesCents)),
        );
        const maxChartVal = rawMax;
        const topLabel = formatCents(maxChartVal, activeCurrency);
        const midLabel = formatCents(
          Math.round(maxChartVal / 2),
          activeCurrency,
        );

        return (
          <div className="ui-card p-6 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                  Revenue vs Expenses
                </h3>
                {!isCompact && (
                  <p className="text-[12.5px] text-content-neutral-500 mt-0.5">
                    Six months: billed revenue and linked fees by invoice month;
                    expenses by incurred date
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="zentra-pill-badge !py-1 !px-2.5 !text-[11.5px]">
                  <span className="w-2 h-2 rounded-full bg-accent-solid" />
                  <span>Revenue</span>
                </span>
                <span className="zentra-pill-badge !py-1 !px-2.5 !text-[11.5px]">
                  <span className="w-2 h-2 rounded-full bg-[#ec4899]" />
                  <span>Expenses</span>
                </span>
              </div>
            </div>

            <div className="my-4">
              <svg
                viewBox="0 0 540 170"
                className="w-full h-[175px] overflow-visible"
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  <linearGradient id="revBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--theme-accent)" />
                    <stop
                      offset="100%"
                      stopColor="var(--theme-accent-deep-solid)"
                    />
                  </linearGradient>
                  <linearGradient id="expBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f472b6" />
                    <stop offset="100%" stopColor="#db2777" />
                  </linearGradient>
                </defs>

                <line
                  x1="45"
                  y1="28"
                  x2="525"
                  y2="28"
                  className="analytics-grid-line"
                />
                <line
                  x1="45"
                  y1="80"
                  x2="525"
                  y2="80"
                  className="analytics-grid-line"
                />
                <line
                  x1="45"
                  y1="135"
                  x2="525"
                  y2="135"
                  className="analytics-grid-line"
                />

                <text
                  x="38"
                  y="32"
                  textAnchor="end"
                  className="analytics-axis-text"
                >
                  {topLabel}
                </text>
                <text
                  x="38"
                  y="84"
                  textAnchor="end"
                  className="analytics-axis-text"
                >
                  {midLabel}
                </text>
                <text
                  x="38"
                  y="138"
                  textAnchor="end"
                  className="analytics-axis-text"
                >
                  {getCurrencySymbol(activeCurrency)}0
                </text>

                {monthlyStats.map((m, i) => {
                  const cx = 82 + i * 78;
                  const revHeight =
                    maxChartVal > 0 && m.revenueCents > 0
                      ? (m.revenueCents / maxChartVal) * 102
                      : 0;
                  const expHeight =
                    maxChartVal > 0 && m.expensesCents > 0
                      ? (m.expensesCents / maxChartVal) * 102
                      : 0;
                  const revY = 135 - revHeight;
                  const expY = 135 - expHeight;
                  const isCurrent = i === 5;

                  return (
                    <g key={m.key}>
                      <rect
                        x={cx - 19}
                        y="22"
                        width="38"
                        height="113"
                        rx="11"
                        className="analytics-capsule-bg"
                      />
                      <rect
                        x={cx - 13}
                        y={revY}
                        width="11"
                        height={revHeight}
                        rx="5.5"
                        fill="url(#revBarGrad)"
                      >
                        <title>{`${m.label} Revenue: ${formatCents(m.revenueCents, activeCurrency)}`}</title>
                      </rect>
                      <rect
                        x={cx + 2}
                        y={expY}
                        width="11"
                        height={expHeight}
                        rx="5.5"
                        fill="url(#expBarGrad)"
                      >
                        <title>{`${m.label} Expenses: ${formatCents(m.expensesCents, activeCurrency)}`}</title>
                      </rect>
                      <text
                        x={cx}
                        y="154"
                        className={`analytics-month-text ${isCurrent ? "active" : ""}`}
                      >
                        {m.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="pt-3 border-t border-line-neutral-100 flex items-center justify-between text-[12.5px] text-content-neutral-500">
              <div className="flex items-center gap-4">
                <span>
                  Gross:{" "}
                  <strong className="text-content-neutral-950 font-semibold tabular-nums">
                    {totalRevenueStr}
                  </strong>
                </span>
                <span>
                  Outsourced:{" "}
                  <strong className="text-content-neutral-950 font-semibold tabular-nums">
                    {outsourcedCostsStr}
                  </strong>
                </span>
              </div>
              <Link
                href="/analytics"
                className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Open Analytics</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );
      }

      // 14. Billing pipeline follows the Overview period.
      case "profit-trajectory-chart": {
        return (
          <div className="ui-card p-6 flex flex-col justify-between h-full">
            {/* Top Card Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                  Payments & Billing Pipeline
                </h3>
              </div>
            </div>

            {/* 5-Stage Zentra Striped Funnel Chart */}
            <div className="relative mt-5 grid grid-cols-12 gap-0 min-h-[220px]">
              {/* Left Y-Axis Scale */}
              <div className="col-span-1 hidden sm:flex flex-col justify-between pt-14 pb-2 pr-2 text-[11px] font-medium text-content-neutral-400 select-none">
                {[1, 2 / 3, 1 / 3, 0].map((factor) => (
                  <span key={factor}>
                    {getCurrencySymbol(activeCurrency)}
                    {new Intl.NumberFormat("en", {
                      notation: "compact",
                      maximumFractionDigits: 1,
                    }).format(
                      (Math.max(
                        ...pipelineStages.map((stage) => Math.abs(stage.value)),
                      ) /
                        100) *
                        factor,
                    )}
                  </span>
                ))}
              </div>

              {/* 5 Stage Columns */}
              <div className="col-span-12 sm:col-span-11 grid grid-cols-5 relative">
                {pipelineStages.map((stage, idx) => {
                  const isSelected = hoveredFunnelIdx === idx;

                  return (
                    <div
                      key={stage.label}
                      role="button"
                      tabIndex={0}
                      aria-label={`${stage.label}: ${stage.valueStr}. ${stage.sub}`}
                      aria-describedby={
                        isSelected ? `${pipelineId}-${idx}` : undefined
                      }
                      onMouseEnter={() => setHoveredFunnelIdx(idx)}
                      onMouseLeave={() => setHoveredFunnelIdx(null)}
                      onFocus={() => setHoveredFunnelIdx(idx)}
                      onBlur={() => setHoveredFunnelIdx(null)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(stage.href);
                        }
                        if (event.key === "Escape") setHoveredFunnelIdx(null);
                      }}
                      onClick={() => router.push(stage.href)}
                      className={`relative flex flex-col justify-between border-l border-line-neutral-200/80 px-2.5 sm:px-3.5 pt-1 pb-0 cursor-pointer transition-colors ${
                        isSelected
                          ? "pipeline-stage-active"
                          : "hover:bg-black/[0.01]"
                      }`}
                    >
                      <div className="z-10">
                        <div
                          className={`text-[11.5px] font-medium truncate ${
                            isSelected
                              ? "text-content-neutral-950"
                              : "text-content-neutral-400"
                          }`}
                        >
                          {stage.label}
                        </div>
                        <div
                          className={`mt-1 text-[17px] sm:text-[21px] font-medium tracking-[-0.03em] tabular-nums truncate ${
                            isSelected
                              ? "text-content-neutral-950"
                              : "text-content-neutral-400"
                          }`}
                        >
                          {stage.valueStr}
                        </div>
                      </div>

                      {/* Floating Pill Tooltip on Active Stage */}
                      {isSelected && (
                        <div
                          id={`${pipelineId}-${idx}`}
                          role="tooltip"
                          className={`pipeline-tooltip ${idx === 0 ? "pipeline-tooltip--first" : idx === pipelineStages.length - 1 ? "pipeline-tooltip--last" : ""}`}
                        >
                          <div className="zentra-pill-badge !py-1.5 !px-3.5 shadow-md">
                            <strong className="font-semibold text-content-neutral-950">
                              {stage.valueStr}
                            </strong>
                            <span className="text-content-neutral-400">|</span>
                            <span className="text-content-neutral-500">
                              {stage.sub}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Stage Bar + Connector */}
                      <div className="relative w-full h-[145px] flex items-end mt-4">
                        <div
                          className="relative w-full transition-all duration-300"
                          style={{ height: `${stage.heightPct}%` }}
                        >
                          <div
                            className={`w-full h-full rounded-t-[4px] ${
                              stage.value < 0
                                ? "zentra-stripe-pink"
                                : isSelected
                                  ? "pipeline-bar-active"
                                  : "zentra-stripe-blue opacity-90"
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-line-neutral-100 flex items-center justify-between text-[12.5px] text-content-neutral-500">
              <span className="summary-caption">
                Bar heights compare absolute amounts. Net profit uses billed
                revenue.
              </span>
              <Link
                href="/invoices"
                className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1 shrink-0"
              >
                <span>Open Invoices</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );
      }

      // 15. On-Time Collection Rate Gauge — Zentra Visual Gauge + Striped Breakdown
      case "collection-rate-gauge": {
        const radius = 40;
        const circumference = 2 * Math.PI * radius;
        const hasInvoices = filteredInvoices.length > 0;
        const strokeDashoffset = hasInvoices
          ? circumference * (1 - paidRatioPct / 100)
          : circumference;

        return (
          <div className="ui-card p-6 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                Collection Efficiency
              </h3>
            </div>

            <div className="my-4 flex items-center gap-5">
              <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                <svg
                  className="w-full h-full transform -rotate-90"
                  viewBox="0 0 100 100"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    stroke="var(--ui-subtle)"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  {paidRatioPct > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      stroke="#16a34a"
                      strokeWidth="10"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[22px] font-medium tracking-[-0.03em] text-content-neutral-950 tabular-nums">
                    {hasInvoices ? `${paidRatioPct}%` : "0%"}
                  </span>
                </div>
              </div>

              <div className="flex-1 space-y-2.5 min-w-0">
                <div>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="text-content-neutral-500">Settled</span>
                    <span className="font-semibold text-content-neutral-900 tabular-nums">
                      {paidCount}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface-neutral-100 overflow-hidden">
                    <div
                      className="h-full rounded-full zentra-stripe-green"
                      style={{
                        width: `${sharePercent(paidCount, filteredInvoices.length)}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="text-content-neutral-500">Pending</span>
                    <span className="font-semibold text-content-neutral-900 tabular-nums">
                      {pendingCount}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface-neutral-100 overflow-hidden">
                    <div
                      className="h-full rounded-full zentra-stripe-blue"
                      style={{
                        width: `${sharePercent(pendingCount, filteredInvoices.length)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2.5 border-t border-line-neutral-100 flex items-center justify-between text-[12px] text-content-neutral-500">
              <span>{overdueInvoices.length} overdue invoices</span>
              <Link
                href="/invoices"
                className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Open Invoices</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );
      }

      // 16. Billing Alerts — Poppy Stepped Pinstripe Urgency + Visual Alert Capsules
      case "billing-alerts":
        return (
          <div className="ui-card p-6 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                    Billing Alerts
                  </h3>
                  <span className="zentra-pill-badge !py-0.5 !px-2.5 !text-[11px]">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        overdueInvoices.length > 0
                          ? "bg-[#ec4899]"
                          : "bg-[#16a34a]"
                      }`}
                    />
                    {overdueInvoices.length} overdue
                  </span>
                </div>
              </div>

              {/* Visual Overdue Amount & Striped Urgency Bar */}
              <div className="mt-3 p-3.5 rounded-[16px] bg-surface-neutral-50 border border-line-neutral-200/70">
                <div className="flex items-baseline justify-between">
                  <span className="text-[12px] text-content-neutral-500">
                    Total Past Due
                  </span>
                  <span className="text-[22px] font-medium tracking-[-0.03em] text-content-neutral-950 tabular-nums">
                    {overdueTotalStr}
                  </span>
                </div>
                <div className="mt-2 w-full h-2 rounded-full bg-surface-neutral-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      overdueInvoices.length > 0
                        ? "zentra-stripe-pink"
                        : "zentra-stripe-green"
                    }`}
                    style={{
                      width:
                        overdueInvoices.length > 0
                          ? `${Math.min(100, overdueInvoices.length * 25 + 20)}%`
                          : "100%",
                    }}
                  />
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {overdueInvoices.length === 0 ? (
                  <div className="py-5 text-center text-[12.5px] text-content-neutral-500">
                    All client accounts are on schedule.
                  </div>
                ) : (
                  overdueInvoices.slice(0, isCompact ? 2 : 3).map((inv) => (
                    <div
                      key={inv.id}
                      onClick={() =>
                        onNavigateToInvoice
                          ? onNavigateToInvoice(inv.id)
                          : router.push(
                              `/invoices?invoice=${encodeURIComponent(inv.id)}`,
                            )
                      }
                      className="flex items-center justify-between p-2.5 rounded-[14px] bg-surface hover:bg-surface-neutral-50 transition-colors cursor-pointer border border-line-neutral-200/80"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-[13px] font-medium text-content-neutral-950 truncate">
                          {inv.clientName || "Client Account"}
                        </div>
                        <div className="text-[11px] text-[#ec4899] font-medium">
                          {inv.code} · Due {formatDateDisplay(inv.dueDate)}
                        </div>
                      </div>
                      <span className="text-[13px] font-semibold tabular-nums text-content-neutral-950 shrink-0">
                        {formatCents(inv.amountCents, inv.currency)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-line-neutral-100 flex items-center justify-between text-[12px] text-content-neutral-500">
              <Link
                href="/invoices?view=overdue-summary"
                className="text-rose-600 dark:text-rose-400 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Aging Breakdown</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/invoices"
                className="text-content-neutral-900 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Open Invoices</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );

      // 17. Recent Client Invoices — Poppy Visual Collection Bar + Inline Striped Progress Capsules
      case "recent-invoices":
        return (
          <div className="ui-card p-6 flex flex-col justify-between h-full">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                    Recent Invoices
                  </h3>
                  <span className="zentra-pill-badge !py-0.5 !px-2.5 !text-[11.5px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
                    {paidRatioPct}% collected
                  </span>
                </div>
              </div>

              {/* Visual Collection Split Strip */}
              <div className="mt-4 p-3.5 rounded-[18px] bg-surface-neutral-50 border border-line-neutral-200/70">
                <div className="flex items-center justify-between text-[12px] mb-2">
                  <span className="text-content-neutral-500 font-medium">
                    Collected{" "}
                    <strong className="text-content-neutral-950 font-semibold tabular-nums">
                      {formatCents(paidCents, activeCurrency)}
                    </strong>
                  </span>
                  <span className="text-content-neutral-500 font-medium">
                    Balance{" "}
                    <strong className="text-content-neutral-950 font-semibold tabular-nums">
                      {pendingReceivablesStr}
                    </strong>
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-surface-neutral-200/70 p-[1.5px] flex gap-1 overflow-hidden">
                  <div
                    className="h-full rounded-full zentra-stripe-green transition-all duration-500"
                    style={{ width: `${paidRatioPct}%` }}
                  />
                  <div
                    className="h-full rounded-full zentra-stripe-blue transition-all duration-500"
                    style={{
                      width: `${sharePercent(pendingCents, totalRevenueCents)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Visual Invoice Capsules */}
              <div className="mt-3.5 space-y-2">
                {displayInvoices.length === 0 ? (
                  <div className="py-8 text-center text-[13px] text-content-neutral-400">
                    No invoices generated yet.
                  </div>
                ) : (
                  displayInvoices.map((inv) => {
                    const invPaid =
                      inv.paidCents ??
                      (inv.status === "PAID" ? inv.amountCents : 0);
                    const invPct =
                      inv.amountCents > 0
                        ? Math.min(
                            100,
                            Math.round((invPaid / inv.amountCents) * 100),
                          )
                        : 0;
                    const barClass =
                      inv.status === "PAID"
                        ? "zentra-stripe-green"
                        : inv.status === "ADVANCE_PAID"
                          ? "zentra-stripe-blue"
                          : "zentra-stripe-pink";

                    return (
                      <div
                        key={inv.id}
                        onClick={() =>
                          onNavigateToInvoice
                            ? onNavigateToInvoice(inv.id)
                            : router.push(
                                `/invoices?invoice=${encodeURIComponent(inv.id)}`,
                              )
                        }
                        className="p-3 rounded-[16px] bg-surface hover:bg-surface-neutral-50 transition-all cursor-pointer border border-line-neutral-200/80 shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-8 h-8 rounded-[10px] bg-surface-neutral-100 border border-line-neutral-200 flex items-center justify-center text-[11px] font-semibold text-content-neutral-800 shrink-0">
                              {(inv.clientName || "C")
                                .slice(0, 2)
                                .toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <div className="text-[13.5px] font-medium text-content-neutral-950 truncate">
                                {inv.clientName}
                              </div>
                              <div className="text-[11px] text-content-neutral-400 font-mono">
                                {inv.code} · {invPct}% paid
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-[14px] font-semibold tabular-nums text-content-neutral-950">
                              {formatCents(inv.amountCents, inv.currency)}
                            </div>
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                inv.status === "PAID"
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                  : inv.status === "ADVANCE_PAID"
                                    ? "bg-accent-faint0/10 text-accent dark:text-accent"
                                    : inv.status === "OVERDUE"
                                      ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                                      : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                              }`}
                            >
                              {inv.status.replace("_", " ")}
                            </span>
                          </div>
                        </div>

                        {/* Inline Diagonal-Striped Payment Progress Bar */}
                        <div className="mt-2.5 w-full h-1.5 rounded-full bg-surface-neutral-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barClass} transition-all duration-300`}
                            style={{ width: `${invPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="mt-3.5 pt-3 border-t border-line-neutral-100 flex items-center justify-between text-[12.5px] text-content-neutral-500">
              <span>{filteredInvoices.length} total invoices in period</span>
              <Link
                href="/invoices"
                className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Open Invoices</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );

      // 18. Active Sprint Tasks — Poppy Zentra Visual Sprint Velocity Matrix + Striped Deliverable Capsules
      case "sprint-tasks": {
        const sprintColumns = [
          {
            label: "To do",
            count: taskCounts.todo,
            stripe: "zentra-stripe-amber",
            pct: sharePercent(taskCounts.todo, taskCounts.total),
          },
          {
            label: "In progress",
            count: taskCounts.inProgress,
            stripe: "zentra-stripe-blue",
            pct: sharePercent(taskCounts.inProgress, taskCounts.total),
          },
          {
            label: "Review",
            count: taskCounts.review,
            stripe: "zentra-stripe-pink",
            pct: sharePercent(taskCounts.review, taskCounts.total),
          },
          {
            label: "Done",
            count: taskCounts.done,
            stripe: "zentra-stripe-green",
            pct: sharePercent(taskCounts.done, taskCounts.total),
          },
        ];

        return (
          <div className="ui-card p-6 flex flex-col justify-between h-full">
            <div>
              {/* Top Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                    Sprint Tasks & Velocity
                  </h3>
                  <span className="zentra-pill-badge !py-0.5 !px-2.5 !text-[11.5px]">
                    <span>{taskCounts.donePct}% completed</span>
                  </span>
                </div>
              </div>

              {/* Poppy 4-Stage Diagonal-Striped Sprint Matrix */}
              <div className="mt-4 grid grid-cols-4 gap-2 p-3 rounded-[18px] bg-surface-neutral-50 border border-line-neutral-200/70">
                {sprintColumns.map((col) => (
                  <div
                    key={col.label}
                    onClick={() => router.push("/tasks")}
                    className="flex flex-col justify-between cursor-pointer group/col"
                  >
                    <div>
                      <div className="text-[11px] font-medium text-content-neutral-400 truncate">
                        {col.label}
                      </div>
                      <div className="text-[20px] font-medium tracking-[-0.03em] text-content-neutral-950 tabular-nums leading-tight mt-0.5">
                        {col.count}
                      </div>
                    </div>
                    <div className="mt-2.5 w-full h-2.5 rounded-full bg-surface-neutral-200/70 p-[1.5px] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${col.stripe} transition-all duration-500`}
                        style={{ width: `${col.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Active Deliverable Capsules with Progress Bars */}
              <div className="mt-3.5 space-y-2">
                {tasks.length === 0 ? (
                  <div
                    onClick={() => router.push("/tasks")}
                    className="p-4 rounded-[16px] bg-surface border border-line-neutral-200/80 flex items-center justify-between cursor-pointer hover:bg-surface-neutral-50"
                  >
                    <div>
                      <div className="text-[13.5px] font-medium text-content-neutral-950">
                        Launch your first sprint deliverable
                      </div>
                      <div className="text-[12px] text-content-neutral-500 mt-0.5">
                        Tasks auto-generate when an invoice reaches Advance Paid
                      </div>
                    </div>
                    <span className="zentra-circle-btn zentra-circle-btn--sm">
                      <ArrowUpRight className="w-4 h-4" />
                    </span>
                  </div>
                ) : (
                  (activeTasks.length > 0 ? activeTasks : tasks)
                    .slice(0, isCompact ? 2 : 3)
                    .map((t) => {
                      const progressPct = taskProgress(t);
                      const barClass =
                        t.status === "done"
                          ? "zentra-stripe-green"
                          : t.status === "review"
                            ? "zentra-stripe-pink"
                            : t.status === "in-progress"
                              ? "zentra-stripe-blue"
                              : "zentra-stripe-blue-soft";

                      return (
                        <div
                          key={t.id}
                          onClick={() => router.push("/tasks")}
                          className="p-3 rounded-[16px] bg-surface hover:bg-surface-neutral-50 transition-all cursor-pointer border border-line-neutral-200/80 shadow-2xs"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    t.priority === "urgent"
                                      ? "bg-[#ec4899]"
                                      : t.priority === "high"
                                        ? "bg-[#f59e0b]"
                                        : "bg-accent-solid"
                                  }`}
                                />
                                <span className="text-[13.5px] font-medium text-content-neutral-950 truncate">
                                  {t.title}
                                </span>
                              </div>
                              <div className="mt-0.5 pl-4 text-[11.5px] text-content-neutral-400 truncate">
                                {t.clientName ||
                                  t.category ||
                                  "Sprint Deliverable"}
                                {t.invoiceCode ? ` · ${t.invoiceCode}` : ""}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="zentra-pill-badge !py-0.5 !px-2 !text-[10.5px]">
                                {t.status.replace("-", " ")}
                              </span>
                            </div>
                          </div>

                          <div className="mt-2.5 flex items-center gap-2.5">
                            <div className="flex-1 h-1.5 rounded-full bg-surface-neutral-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${barClass} transition-all duration-300`}
                                style={{ width: `${progressPct ?? 0}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-semibold tabular-nums text-content-neutral-600">
                              {progressPct === null
                                ? "No checklist"
                                : `${progressPct}%`}
                            </span>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            <div className="mt-3.5 pt-3 border-t border-line-neutral-100 flex items-center justify-between text-[12.5px] text-content-neutral-500">
              <span>
                {activeTasks.length} active · {taskCounts.done} completed
              </span>
              <Link
                href="/tasks"
                className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Open Sprint Board</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );
      }

      // 19. Active Time Percentiles Chart
      case "latency-percentiles-chart":
        return (
          <div className="ui-card p-6 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                  Active Time Percentiles
                </h3>
                {!isCompact && (
                  <p className="text-[12.5px] text-content-neutral-500 mt-0.5">
                    Recorded active time of completed tasks, grouped by
                    completion month
                  </p>
                )}
              </div>
            </div>
            <LatencyPercentilesChart />
            <div className="mt-4 pt-3 border-t border-line-neutral-100 flex items-center justify-between text-[12.5px] text-content-neutral-500">
              <span>Completed tasks active hours</span>
              <Link
                href="/tasks"
                className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Open Sprint Board</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );

      // 20. Service Line-Item Mix Chart
      case "portfolio-comparison-chart":
        return (
          <div className="ui-card p-6 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                  Service Line-Item Mix
                </h3>
                {!isCompact && (
                  <p className="text-[12.5px] text-content-neutral-500 mt-0.5">
                    Gross service values, grouped from item descriptions
                  </p>
                )}
              </div>
            </div>
            <PortfolioComparisonChart />
            <div className="mt-4 pt-3 border-t border-line-neutral-100 flex items-center justify-between text-[12.5px] text-content-neutral-500">
              <span>Itemized service catalog breakdown</span>
              <Link
                href="/catalog"
                className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Open Catalog</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );

      // 21. Weekly Completed Work Chart
      case "growth-benchmark-chart":
        return (
          <div className="ui-card p-6 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                  Weekly Completed Work
                </h3>
                {!isCompact && (
                  <p className="text-[12.5px] text-content-neutral-500 mt-0.5">
                    Completed tasks by completion date over the last eight weeks
                  </p>
                )}
              </div>
            </div>
            <GrowthBenchmarkChart />
            <div className="mt-4 pt-3 border-t border-line-neutral-100 flex items-center justify-between text-[12.5px] text-content-neutral-500">
              <span>8-week sprint velocity benchmark</span>
              <Link
                href="/analytics"
                className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Open Analytics</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );

      // 22. Collections & Net Cashflow Chart
      case "audience-growth-chart":
        return (
          <div className="ui-card p-6 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                  Collections & Net Cashflow
                </h3>
                {!isCompact && (
                  <p className="text-[12.5px] text-content-neutral-500 mt-0.5">
                    Recorded payments, contractor payouts and expenses
                  </p>
                )}
              </div>
            </div>
            <AudienceGrowthChart />
            <div className="mt-4 pt-3 border-t border-line-neutral-100 flex items-center justify-between text-[12.5px] text-content-neutral-500">
              <span>Net cashflow & collections ledger</span>
              <Link
                href="/analytics"
                className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Open Analytics</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );

      // 23. Service Delivery Trends Line Chart
      case "service-trends-line-chart":
        return (
          <div className="ui-card p-6 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                  Service Delivery Trends
                </h3>
                {!isCompact && (
                  <p className="text-[12.5px] text-content-neutral-500 mt-0.5">
                    Completed tasks by month and inferred service group
                  </p>
                )}
              </div>
            </div>
            <ServiceTrendsLineChart />
            <div className="mt-4 pt-3 border-t border-line-neutral-100 flex items-center justify-between text-[12.5px] text-content-neutral-500">
              <span>Monthly service category delivery</span>
              <Link
                href="/analytics"
                className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Open Analytics</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );

      // 24. Contract Deliverables Volume Bar Chart
      case "itemized-volume-bar-chart":
        return (
          <div className="ui-card p-6 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-[18px] font-medium tracking-[-0.02em] text-content-neutral-950">
                  Contract Deliverables Volume
                </h3>
                {!isCompact && (
                  <p className="text-[12.5px] text-content-neutral-500 mt-0.5">
                    Issued invoice items by month and inferred service group
                  </p>
                )}
              </div>
            </div>
            <ItemizedVolumeBarChart />
            <div className="mt-4 pt-3 border-t border-line-neutral-100 flex items-center justify-between text-[12.5px] text-content-neutral-500">
              <span>Service volume by description category</span>
              <Link
                href="/catalog"
                className="text-content-neutral-950 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Open Catalog</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      draggable={isDraggable}
      onDragStart={(e) => {
        if (!isDraggable) return;
        e.dataTransfer.clearData();
        e.dataTransfer.setData("text/plain", widgetId);
        e.dataTransfer.effectAllowed = "copyMove";
        const emptyCanvas = getTransparentDragCanvas();
        if (emptyCanvas) {
          e.dataTransfer.setDragImage(emptyCanvas, 0, 0);
        }
        startWidgetDrag({
          widgetId,
          source,
          element: e.currentTarget,
          clientX: e.clientX,
          clientY: e.clientY,
        });
      }}
      onDragEnd={() => {
        endWidgetDrag();
      }}
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.preventDefault();
          onContextMenu(e, widgetId);
        }
      }}
      className={`group relative h-full transition-all duration-200 ${
        isDraggable
          ? "cursor-grab active:cursor-grabbing hover:-translate-y-0.5"
          : ""
      } ${
        isBeingDragged
          ? "opacity-35 scale-[0.985] ring-2 ring-dashed ring-accent/65 rounded-[24px]"
          : ""
      } ${
        isEditing
          ? "ring-2 ring-dashed ring-accent/50 rounded-[24px] bg-accent-faint0/[0.03] p-0.5"
          : ""
      }`}
    >
      {isDraggable && !isEditing && (
        <div
          aria-hidden="true"
          className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center px-3 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
        >
          <div className="w-9 h-1 rounded-full bg-content-neutral-400/45 dark:bg-white/25" />
        </div>
      )}
      {source === "dashboard" && isEditing && (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-1 p-1 bg-surface/95 rounded-full border border-line-neutral-200 shadow-md backdrop-blur-xs select-none">
          {isEditing && onMoveLeft && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoveLeft();
              }}
              title="Move Left / Earlier"
              className="p-1.5 text-content-neutral-500 hover:text-content-neutral-900 rounded-full hover:bg-surface-neutral-100 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}

          {isEditing && onMoveRight && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoveRight();
              }}
              title="Move Right / Later"
              className="p-1.5 text-content-neutral-500 hover:text-content-neutral-900 rounded-full hover:bg-surface-neutral-100 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          {onToggleSize && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSize();
              }}
              title={isCompact ? "Expand to Standard" : "Shrink to Compact"}
              className="p-1.5 text-accent hover:bg-accent-faint rounded-full transition-colors cursor-pointer"
            >
              {isCompact ? (
                <Maximize2 className="w-3.5 h-3.5" />
              ) : (
                <Minimize2 className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              title="Remove from Dashboard"
              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {isDraggable && source === "analytics" && !isEditing && (
        <div className="absolute top-3.5 right-3.5 z-20 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1.5 rounded-full bg-surface/90 shadow-xs border border-line-neutral-200 pointer-events-none">
          <GripVertical className="w-3.5 h-3.5 text-content-neutral-500" />
        </div>
      )}

      {renderContent()}
    </div>
  );
}
