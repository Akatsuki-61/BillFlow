"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  GitFork,
  ArrowUpRight,
  Receipt,
  Kanban,
  TriangleAlert,
  GripVertical,
  Clock,
  DollarSign,
  Briefcase,
  PieChart,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  X,
  BarChart3,
  Activity,
  Sparkles,
  Target,
} from "lucide-react";
import { MetricCard } from "@/components/ui/Workspace";
import {
  useData,
  useDashboardSummary,
  useInvoices,
  useClients,
  useVendors,
  useActiveCurrency,
} from "@/lib/data/DataProvider";
import { formatCents, formatDateDisplay, getCurrencySymbol } from "@/lib/format";
import { DashboardPeriod } from "@/types/dashboard";
import { WidgetDisplaySize } from "@/types/widgets";
import "../analytics/analytics.css";
import { ProfitTrajectoryPlot } from "./ProfitTrajectoryPlot";
import { LatencyPercentilesChart } from "./charts/LatencyPercentilesChart";
import { PortfolioComparisonChart } from "./charts/PortfolioComparisonChart";
import { GrowthBenchmarkChart } from "./charts/GrowthBenchmarkChart";
import { AudienceGrowthChart } from "./charts/AudienceGrowthChart";
import { ServiceTrendsLineChart } from "./charts/ServiceTrendsLineChart";
import { ItemizedVolumeBarChart } from "./charts/ItemizedVolumeBarChart";

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
  const { dashboard } = useDashboardSummary();
  const { invoices } = useInvoices();
  const { clients } = useClients();
  const { vendors } = useVendors();
  const { activeCurrency } = useActiveCurrency();
  const { tasks, expenses } = useData();

  const activeTasks = useMemo(() => {
    return tasks.filter((t) => t.status !== "done");
  }, [tasks]);

  const [chartMetric, setChartMetric] = useState<"profit" | "margin">("profit");

  // Filter invoices according to selected period
  const filteredInvoices = useMemo(() => {
    if (!period || period === "all") return invoices;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const subset = invoices.filter((inv) => {
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
        return (
          invDate.getFullYear() === currentYear &&
          invQuarter === currQuarter
        );
      }
      return true;
    });

    return subset.length > 0 ? subset : invoices;
  }, [invoices, period]);

  // Total Outsourced Subcontractor Costs (cents)
  const totalOutsourcedCents = useMemo(() => {
    return vendors.reduce(
      (sum, v) => sum + (Number(v.currentBalance) || 0) * 100,
      0,
    );
  }, [vendors]);

  const outsourcedCostsStr = useMemo(() => {
    return formatCents(totalOutsourcedCents, activeCurrency);
  }, [totalOutsourcedCents, activeCurrency]);

  // Aggregate metrics from live invoices with strict financial integrity:
  // - Supports ADVANCE_PAID records where paidCents reflects the recorded deposit.
  // - Treats fully PAID invoices as 100% collected.
  // - Never generates synthetic collections or fabricated revenue.
  const {
    totalRevenueCents,
    paidCount,
    paidCents,
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
    let pendingAmt = 0;
    let pendingCnt = 0;

    filteredInvoices.forEach((inv) => {
      total += inv.amountCents;
      // Real recorded collection: paidCents if tracked, or total if status is PAID
      const collected = inv.paidCents ?? (inv.status === "PAID" ? inv.amountCents : 0);
      paidAmt += collected;
      if (inv.status === "PAID") {
        paid += 1;
      } else {
        pendingCnt += 1;
        // Remaining uncollected amount on unpaid or advance-paid invoice
        pendingAmt += Math.max(0, inv.amountCents - collected);
      }
    });

    const ratio = total > 0 ? Math.round((paidAmt / total) * 100) : 0;
    const avg = filteredInvoices.length > 0 ? Math.round(total / filteredInvoices.length) : 0;

    return {
      totalRevenueCents: total,
      paidCount: paid,
      paidCents: paidAmt,
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

  // Net Profit & Margins:
  // Filter general operational expenses according to selected period and active currency
  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return expenses.filter((e) => {
      if (activeCurrency && e.currency && e.currency.toUpperCase() !== activeCurrency.toUpperCase()) {
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
        return (
          eDate.getFullYear() === currentYear &&
          eQuarter === currQuarter
        );
      }
      return true;
    });
  }, [expenses, period, activeCurrency]);

  const generalExpensesCents = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + (e.amountCents || 0), 0);
  }, [filteredExpenses]);

  // Operating Expenses (Contractor payables + General operational expenses)
  const opexCents = useMemo(() => {
    return totalOutsourcedCents + generalExpensesCents;
  }, [totalOutsourcedCents, generalExpensesCents]);

  const opexStr = useMemo(() => {
    return formatCents(opexCents, activeCurrency);
  }, [opexCents, activeCurrency]);

  const opexRatioPct = useMemo(() => {
    if (totalRevenueCents <= 0) return 0;
    return Math.min(100, Math.round((opexCents / totalRevenueCents) * 100));
  }, [opexCents, totalRevenueCents]);

  // Net Profit & Margins:
  // Preserves business losses when operating costs exceed billed revenue.
  // Never clamps to zero with Math.max, ensuring financial deficits are transparently reported.
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

  // Total & Active Clients count
  const totalClientsCount = clients.length;
  const activeClientsCount = useMemo(() => {
    return clients.filter(
      (c) => c.invoicesCount > 0 || c.outstandingBalanceCents > 0,
    ).length;
  }, [clients]);
  const inactiveClientsCount = Math.max(0, totalClientsCount - activeClientsCount);

  // Top Client Concentration
  const topClient = useMemo(() => {
    if (clients.length === 0) return null;
    return clients.reduce((max, c) => {
      const maxBilled = max?.totalBilledCents || 0;
      return c.totalBilledCents > maxBilled ? c : max;
    }, clients[0]);
  }, [clients]);

  const topClientPct = useMemo(() => {
    if (!topClient || totalRevenueCents <= 0) return 0;
    return Math.min(
      100,
      Math.round((topClient.totalBilledCents / totalRevenueCents) * 100),
    );
  }, [topClient, totalRevenueCents]);

  // Realized Hourly Yield:
  // Derived strictly from actual active time tracked across tasks (tasks.activeMilliseconds).
  // Formula: (Net Profit in Dollars) / (Total Active Tracked Hours).
  // If no time has been tracked, yields 0 instead of assuming an arbitrary baseline.
  const { effectiveHourlyRate, totalTrackedHours } = useMemo(() => {
    const totalActiveMs = tasks.reduce(
      (sum, t) => sum + (t.activeMilliseconds || 0),
      0,
    );
    const hours = totalActiveMs / 3600000;
    if (hours <= 0) {
      return { effectiveHourlyRate: 0, totalTrackedHours: 0 };
    }
    const rate = Math.round((netProfitCents / 100) / hours);
    return { effectiveHourlyRate: rate, totalTrackedHours: hours };
  }, [tasks, netProfitCents]);

  // Cashflow Runway:
  // Derived strictly from actual collected liquidity (paidCents) divided by average monthly burn.
  // Monthly burn is computed from actual outsourced contractor payables (totalOutsourcedCents / 6).
  // Returns 0 months if no actual burn or collected cash exists.
  const runwayMonths = useMemo(() => {
    const monthlyBurn = Math.round(totalOutsourcedCents / 6);
    if (monthlyBurn <= 0 || paidCents <= 0) return 0;
    return Math.min(36, Math.max(1, Math.round(paidCents / monthlyBurn)));
  }, [totalOutsourcedCents, paidCents]);

  // Overdue count and amount
  const overdueInvoices = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return invoices.filter(
      (inv) =>
        inv.status === "OVERDUE" ||
        (inv.status === "UNPAID" && Boolean(inv.dueDate && inv.dueDate < today)),
    );
  }, [invoices]);

  const overdueTotalStr = useMemo(() => {
    const cents = overdueInvoices.reduce(
      (acc, inv) => acc + inv.amountCents,
      0,
    );
    return formatCents(cents, activeCurrency);
  }, [overdueInvoices, activeCurrency]);

  // Display invoices for recent invoices widget
  const displayInvoices = useMemo(() => {
    if (invoices.length > 0) {
      return invoices.slice(0, displaySize === "compact" ? 2 : 4);
    }
    return dashboard?.recentInvoices ?? [];
  }, [invoices, dashboard, displaySize]);

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
      const label = d.toLocaleString("default", { month: "short" });
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
      if (!inv.issueDate || inv.status === "DRAFT") return;
      const invKey = inv.issueDate.slice(0, 7);
      const target = months.find((m) => m.key === invKey);
      if (target) {
        target.revenueCents += inv.amountCents;
      }
    });

    vendors.forEach((v) => {
      const vDate = v.payoutDueDate || v.createdAt;
      if (!vDate) return;
      const vKey = vDate.slice(0, 7);
      const target = months.find((m) => m.key === vKey);
      if (target) {
        target.expensesCents += Math.round(v.currentBalance * 100);
      }
    });

    months.forEach((m) => {
      // Preserve losses in monthly trajectory: allow negative profit and negative margins
      m.profitCents = m.revenueCents - m.expensesCents;
      m.marginPct =
        m.revenueCents > 0
          ? Math.round((m.profitCents / m.revenueCents) * 100)
          : 0;
    });

    return months;
  }, [invoices, vendors]);

  const isCompact = displaySize === "compact";

  // Reusable metric card helper for both standard (rectangle) and compact (square)
  const renderMetric = (
    label: string,
    value: React.ReactNode,
    footer: React.ReactNode,
    tone: "default" | "accent" | "warning" = "default",
    compactTag?: string,
  ) => {
    if (isCompact) {
      return (
        <div
          className={`ui-card p-4 min-h-[140px] h-full flex flex-col justify-between rounded-2xl transition-all ${
            tone === "accent"
              ? "border-border-accent-soft bg-accent-soft/20"
              : tone === "warning"
                ? "border-line-amber-200/80 bg-surface-amber-50/20"
                : ""
          }`}
        >
          <div>
            <span className="text-[11px] font-medium text-content-neutral-500 block truncate">
              {label}
            </span>
            <div className="font-serif text-lg sm:text-xl font-semibold text-content-neutral-900 mt-1.5 tracking-tight truncate">
              {value}
            </div>
          </div>
          <div className="text-[11px] font-semibold text-content-neutral-600 pt-2 border-t border-line-neutral-100 flex items-center justify-between">
            <span className="truncate">{compactTag || "Active"}</span>
            {tone === "accent" && (
              <span className="w-2 h-2 rounded-full bg-accent-solid" />
            )}
            {tone === "warning" && (
              <span className="w-2 h-2 rounded-full bg-surface-amber-500" />
            )}
          </div>
        </div>
      );
    }

    return (
      <MetricCard
        label={label}
        value={value}
        tone={tone}
        footer={footer}
      />
    );
  };

  // Render individual widget based on ID
  const renderContent = () => {
    switch (widgetId) {
      // 1. Total Revenue
      case "total-revenue":
        return renderMetric(
          "Total Revenue",
          totalRevenueStr,
          <>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-surface-neutral-100 text-content-neutral-700 border-line-neutral-200/60">
              <TrendingUp className="w-3 h-3 text-accent" />
              {filteredInvoices.length} invoices
            </span>
            <span>billed to date</span>
          </>,
          "default",
          "Billed to date",
        );

      // 2. Net Profit (or Net Loss if expenses exceed revenue)
      case "net-profit":
        return renderMetric(
          isLoss ? "Net Loss & Margin" : "Net Profit & Margin",
          netProfitStr,
          <>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                isLoss
                  ? "bg-surface-amber-50 text-content-amber-800 border-line-amber-200/60"
                  : "bg-surface-purple-50 text-content-purple-700 border-line-purple-200/60"
              }`}
            >
              <TrendingUp className={`w-3 h-3 ${isLoss ? "rotate-180" : ""}`} />
              {marginPct}% margin
            </span>
            <span>{isLoss ? "net deficit in period" : "net retained earnings"}</span>
          </>,
          isLoss ? "warning" : "accent",
          `${marginPct}% margin`,
        );

      // 3. Pending Receivables
      case "pending-receivables":
        return renderMetric(
          "Pending Receivables",
          pendingReceivablesStr,
          <>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-surface-purple-50 text-content-purple-700 border-line-purple-200/60">
              {pendingCount} pending
            </span>
            <span>
              {pendingCount === 1
                ? "invoice awaiting payment"
                : "invoices awaiting payment"}
            </span>
          </>,
          "accent",
          `${pendingCount} pending`,
        );

      // 4. Clients Overview
      case "active-clients":
        return renderMetric(
          "Total Clients",
          String(totalClientsCount),
          <>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-surface-blue-50 text-content-blue-700 border-line-blue-200/60">
              <Briefcase className="w-3 h-3" />
              {activeClientsCount} active
            </span>
            <span>
              {inactiveClientsCount > 0
                ? `· ${inactiveClientsCount} inactive`
                : "all active"}
            </span>
          </>,
          "default",
          `${activeClientsCount} active / ${totalClientsCount} total`,
        );

      // 5. Outsourced Costs
      case "outsourced-costs": {
        const hasVendors = vendors.length > 0;
        return renderMetric(
          "Subcontractor Costs",
          hasVendors ? outsourcedCostsStr : `${formatCents(0, activeCurrency)}`,
          <>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                hasVendors
                  ? "bg-surface-purple-50 text-content-purple-700 border-line-purple-200/60"
                  : "bg-surface-neutral-100 text-content-neutral-600 border-line-neutral-200"
              }`}
            >
              <GitFork className="w-3 h-3" />
              {hasVendors ? `${vendors.length} vendors` : "0 Recorded"}
            </span>
            <span>{hasVendors ? "active external contractors" : "no subcontractor costs recorded"}</span>
          </>,
          "default",
          hasVendors ? `${vendors.length} contractors` : "No contractor costs",
        );
      }

      // 6. Operating Expenses
      case "operating-expenses": {
        const hasExpenses = opexCents > 0 || totalRevenueCents > 0;
        return renderMetric(
          "Operating Expenses",
          hasExpenses ? opexStr : `${formatCents(0, activeCurrency)}`,
          <>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-surface-neutral-100 text-content-neutral-700 border-line-neutral-200/60">
              {hasExpenses ? `${opexRatioPct}%` : "No Data"}
            </span>
            <span>{hasExpenses ? "software & contractor overhead" : "no overhead or contractor payables"}</span>
          </>,
          "default",
          hasExpenses ? "Software & tools" : "No expenses",
        );
      }

      // 7. Paid Ratio
      case "paid-ratio": {
        const hasInvoices = totalRevenueCents > 0;
        return renderMetric(
          "Invoice Paid Ratio",
          hasInvoices ? `${paidRatioPct}%` : "Unavailable",
          <>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                hasInvoices
                  ? "bg-surface-emerald-50 text-content-emerald-700 border-line-emerald-200/60"
                  : "bg-surface-neutral-100 text-content-neutral-600 border-line-neutral-200"
              }`}
            >
              <ShieldCheck className="w-3 h-3" />
              {hasInvoices ? `${paidCount} of ${filteredInvoices.length} paid` : "No Records"}
            </span>
            <span>{hasInvoices ? "on-time collection rate" : "no billed invoices in period"}</span>
          </>,
          hasInvoices ? "accent" : "default",
          hasInvoices ? `${paidRatioPct}% on-time` : "Unavailable",
        );
      }

      // 8. Average Invoice Value
      case "average-invoice-value": {
        const hasInvoices = filteredInvoices.length > 0;
        return renderMetric(
          "Average Invoice Size",
          hasInvoices ? avgInvoiceStr : "Unavailable",
          <>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-surface-neutral-100 text-content-neutral-700 border-line-neutral-200/60">
              <DollarSign className="w-3 h-3" />
              {hasInvoices ? `${filteredInvoices.length} billed` : "0 Billed"}
            </span>
            <span>{hasInvoices ? "ticket size per contract" : "no invoices in period"}</span>
          </>,
          "default",
          hasInvoices ? "Average contract" : "Unavailable",
        );
      }

      // 9. Overdue Receivables
      case "overdue-receivables":
        return renderMetric(
          "Overdue Invoices",
          overdueTotalStr,
          <>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                overdueInvoices.length > 0
                  ? "bg-surface-rose-50 text-content-rose-700 border-line-rose-200/60"
                  : "bg-surface-emerald-50 text-content-emerald-700 border-line-emerald-200/60"
              }`}
            >
              <Clock className="w-3 h-3" />
              {overdueInvoices.length} overdue
            </span>
            <span>past payment due date</span>
          </>,
          overdueInvoices.length > 0 ? "warning" : "default",
          `${overdueInvoices.length} overdue`,
        );

      // 10. Cashflow Runway
      case "cashflow-runway": {
        const hasReserve = paidCents > 0;
        const hasOutflows = totalOutsourcedCents > 0;
        const isRunwayCalculated = runwayMonths > 0 && hasOutflows && hasReserve;

        let runwayDisplayValue = "Unavailable";
        let runwayTag = "No Data";
        let runwaySubtext = "requires collections & expenses";
        let runwayCompactTag = "Unavailable";

        if (isRunwayCalculated) {
          runwayDisplayValue = `${runwayMonths} mo`;
          runwayTag = runwayMonths >= 6 ? "Stable" : "Tight";
          runwaySubtext = "operating cushion based on cash reserve";
          runwayCompactTag = `${runwayMonths} mo runway`;
        } else if (hasReserve && !hasOutflows) {
          runwayDisplayValue = "Self-Funded";
          runwayTag = "No Outflows";
          runwaySubtext = "no ongoing contractor burn recorded";
          runwayCompactTag = "Self-funded";
        } else if (!hasReserve && hasOutflows) {
          runwayDisplayValue = "0 mo";
          runwayTag = "Deficit";
          runwaySubtext = "outflows recorded without cash collections";
          runwayCompactTag = "0 mo reserve";
        }

        return renderMetric(
          "Cashflow Runway",
          runwayDisplayValue,
          <>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                runwayMonths >= 6 && isRunwayCalculated
                  ? "bg-surface-emerald-50 text-content-emerald-700 border-line-emerald-200/60"
                  : isRunwayCalculated
                    ? "bg-surface-amber-50 text-content-amber-800 border-line-amber-200/60"
                    : hasReserve && !hasOutflows
                      ? "bg-surface-blue-50 text-content-blue-700 border-line-blue-200/60"
                      : "bg-surface-neutral-100 text-content-neutral-600 border-line-neutral-200"
              }`}
            >
              {runwayTag}
            </span>
            <span>{runwaySubtext}</span>
          </>,
          isRunwayCalculated ? "default" : "default",
          runwayCompactTag,
        );
      }

      // 11. Top Client Concentration
      case "client-concentration": {
        const hasRevenue = totalRevenueCents > 0;
        return renderMetric(
          "Client Concentration",
          hasRevenue ? `${topClientPct}%` : "Unavailable",
          <>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-surface-blue-50 text-content-blue-700 border-line-blue-200/60 truncate max-w-[120px]">
              <PieChart className="w-3 h-3 shrink-0" />
              <span className="truncate">{hasRevenue && topClient ? topClient.name : "No Data"}</span>
            </span>
            <span>{hasRevenue ? "revenue concentration" : "no revenue recorded"}</span>
          </>,
          "default",
          hasRevenue ? `Top client ${topClientPct}%` : "No concentration",
        );
      }

      // 12. Realized Hourly Yield
      case "effective-hourly-rate":
        return renderMetric(
          "Realized Hourly Yield",
          totalTrackedHours > 0
            ? `${getCurrencySymbol(activeCurrency)}${effectiveHourlyRate}/hr`
            : "Unavailable",
          <>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                totalTrackedHours > 0
                  ? "bg-surface-purple-50 text-content-purple-700 border-line-purple-200/60"
                  : "bg-surface-neutral-100 text-content-neutral-600 border-line-neutral-200"
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              {totalTrackedHours > 0
                ? effectiveHourlyRate > 0
                  ? "Tracked Rate"
                  : "Break-even"
                : "Time Untracked"}
            </span>
            <span>
              {totalTrackedHours > 0
                ? `based on ${totalTrackedHours < 1 ? "<1 hr" : Math.round(totalTrackedHours) + " hrs"} tracked`
                : "track task hours to compute rate"}
            </span>
          </>,
          totalTrackedHours > 0 ? "accent" : "default",
          totalTrackedHours > 0 ? `${effectiveHourlyRate}/hr tracked` : "Untracked",
        );

      // 13. Revenue vs Expenses Paired Bar Chart
      case "revenue-expenses-chart": {
        const rawMax = Math.max(
          0,
          ...monthlyStats.map((m) => Math.max(m.revenueCents, m.expensesCents)),
        );
        const maxChartVal = rawMax;
        const topLabel = formatCents(maxChartVal, activeCurrency);
        const midLabel = formatCents(Math.round(maxChartVal / 2), activeCurrency);

        return (
          <div className="analytics-creative-chart-card">
            <div className="analytics-creative-header">
              <div className="analytics-creative-title-group">
                <div className="analytics-creative-icon-box">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="analytics-creative-title">
                    Revenue vs Expenses
                  </h3>
                  {!isCompact && (
                    <p className="analytics-creative-subtitle">
                      {rawMax > 0
                        ? "6-month cashflow velocity and contractor payouts"
                        : "No transaction records in this period"}
                    </p>
                  )}
                </div>
              </div>

              <div className="analytics-creative-controls">
                <span className="analytics-legend-pill">
                  <span className="w-2.5 h-2.5 rounded-full bg-accent-solid" />
                  <span>Revenue</span>
                </span>
                <span className="analytics-legend-pill">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#cbd5e1]" />
                  <span>Expenses</span>
                </span>
              </div>
            </div>

            <div className="analytics-creative-canvas-area">
              <svg
                viewBox="0 0 540 170"
                className="analytics-creative-svg"
                preserveAspectRatio="xMidYMid meet"
              >
                <defs>
                  <linearGradient id="revBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9333ea" />
                    <stop offset="100%" stopColor="#7c3aed" />
                  </linearGradient>
                  <linearGradient id="expBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#cbd5e1" />
                    <stop offset="100%" stopColor="#94a3b8" />
                  </linearGradient>
                </defs>

                {/* Y-Axis Guidelines & Scale Labels */}
                <line x1="45" y1="28" x2="525" y2="28" className="analytics-grid-line" />
                <line x1="45" y1="80" x2="525" y2="80" className="analytics-grid-line" />
                <line x1="45" y1="135" x2="525" y2="135" className="analytics-grid-line" />

                <text x="38" y="32" textAnchor="end" className="analytics-axis-text">
                  {topLabel}
                </text>
                <text x="38" y="84" textAnchor="end" className="analytics-axis-text">
                  {midLabel}
                </text>
                <text x="38" y="138" textAnchor="end" className="analytics-axis-text">
                  {getCurrencySymbol(activeCurrency)}0
                </text>

                {/* Monthly Capsule Groups */}
                {monthlyStats.map((m, i) => {
                  const cx = 82 + i * 78;
                  const revHeight =
                    maxChartVal > 0 && m.revenueCents > 0
                      ? Math.max(8, Math.round((m.revenueCents / maxChartVal) * 102))
                      : 4;
                  const expHeight =
                    maxChartVal > 0 && m.expensesCents > 0
                      ? Math.max(8, Math.round((m.expensesCents / maxChartVal) * 102))
                      : 4;
                  const revY = 135 - revHeight;
                  const expY = 135 - expHeight;
                  const isCurrent = i === 5;

                  return (
                    <g key={m.key}>
                      {/* Background Capsule Track */}
                      <rect
                        x={cx - 18}
                        y="22"
                        width="36"
                        height="113"
                        rx="10"
                        className="analytics-capsule-bg"
                      />

                      {/* Revenue Bar */}
                      <rect
                        x={cx - 13}
                        y={revY}
                        width="11"
                        height={revHeight}
                        rx="5"
                        fill="url(#revBarGrad)"
                        className="analytics-bar-rev"
                      >
                        <title>{`${m.label} Revenue: ${formatCents(m.revenueCents, activeCurrency)}`}</title>
                      </rect>

                      {/* Expense Bar */}
                      <rect
                        x={cx + 2}
                        y={expY}
                        width="11"
                        height={expHeight}
                        rx="5"
                        fill="url(#expBarGrad)"
                        className="analytics-bar-exp"
                      >
                        <title>{`${m.label} Expenses: ${formatCents(m.expensesCents, activeCurrency)}`}</title>
                      </rect>

                      {/* Month Label */}
                      <text
                        x={cx}
                        y="154"
                        className={`analytics-month-text ${isCurrent ? "active" : ""}`}
                      >
                        {m.label.toUpperCase()}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="analytics-creative-footer">
              <div className="flex items-center gap-4">
                <span>
                  Gross: <strong className="text-content-neutral-900 font-serif">{totalRevenueStr}</strong>
                </span>
                <span>
                  Outsourced: <strong className="text-content-neutral-900 font-serif">{outsourcedCostsStr}</strong>
                </span>
              </div>
              <span className="analytics-footer-pill text-accent">
                <Sparkles className="w-3.5 h-3.5" />
                {filteredInvoices.length} Active Invoices
              </span>
            </div>
          </div>
        );
      }

      // 14. Profit & Growth Trajectory Chart
      case "profit-trajectory-chart": {
        return (
          <div className="analytics-creative-chart-card">
            <div className="analytics-creative-header">
              <div className="analytics-creative-title-group">
                <div className="analytics-creative-icon-box">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="analytics-creative-title">
                    Profit & Growth Trajectory
                  </h3>
                  {!isCompact && (
                    <p className="analytics-creative-subtitle">
                      Month-over-month retained yield & margin expansion
                    </p>
                  )}
                </div>
              </div>

              <div className="analytics-creative-controls">
                <div className="analytics-pill-toggle">
                  <button
                    type="button"
                    onClick={() => setChartMetric("profit")}
                    className={`analytics-pill-btn ${chartMetric === "profit" ? "active" : ""}`}
                  >
                    Volume ({getCurrencySymbol(activeCurrency).trim() || activeCurrency})
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMetric("margin")}
                    className={`analytics-pill-btn ${chartMetric === "margin" ? "active" : ""}`}
                  >
                    Margin (%)
                  </button>
                </div>
              </div>
            </div>

            <ProfitTrajectoryPlot months={monthlyStats} metric={chartMetric} currency={activeCurrency} />

            <div className="analytics-creative-footer">
              <div className="flex items-center gap-4">
                <span>
                  Current Net: <strong className="text-content-neutral-900 font-serif">{netProfitStr}</strong>
                </span>
                <span>
                  Retained Margin: <strong className="text-content-neutral-900 font-serif">{marginPct}%</strong>
                </span>
              </div>
              <span className="analytics-footer-pill text-content-emerald-700">
                <span className="w-2 h-2 rounded-full bg-surface-emerald-500" />
                {marginPct >= 70 ? "Healthy Retained Capital" : "Capital Growth"}
              </span>
            </div>
          </div>
        );
      }

      // 15. On-Time Collection Rate Gauge
      case "collection-rate-gauge": {
        const radius = 40;
        const circumference = 2 * Math.PI * radius;
        const hasInvoices = filteredInvoices.length > 0;
        const strokeDashoffset = hasInvoices
          ? circumference * (1 - paidRatioPct / 100)
          : circumference;

        return (
          <div
            className={`ui-card flex flex-col justify-between ${
              isCompact ? "p-4 space-y-2" : "p-6"
            }`}
          >
            <div className="flex justify-between items-center pb-2 mb-1 border-b border-line-neutral-100">
              <h3 className="text-sm font-semibold text-content-neutral-900 tracking-tight">
                Collection Gauge
              </h3>
              <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                hasInvoices
                  ? "bg-surface-emerald-50 text-content-emerald-700 border-line-emerald-200/60"
                  : "bg-surface-neutral-100 text-content-neutral-600 border-line-neutral-200"
              }`}>
                {hasInvoices ? `${paidRatioPct}% Collected` : "No Invoices"}
              </span>
            </div>

            <div className="flex flex-col items-center justify-center py-2">
              <div
                className={`relative flex items-center justify-center ${
                  isCompact ? "w-20 h-20" : "w-28 h-28"
                }`}
              >
                <svg
                  className="w-full h-full transform -rotate-90"
                  viewBox="0 0 100 100"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    stroke="var(--ui-border)"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    stroke="var(--ui-accent)"
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span
                    className={`font-serif font-semibold text-content-neutral-900 leading-none ${
                      isCompact ? "text-lg" : "text-2xl"
                    }`}
                  >
                    {hasInvoices ? `${paidRatioPct}%` : "N/A"}
                  </span>
                </div>
              </div>
            </div>

            <div className="analytics-gauge-legend">
              {hasInvoices ? (
                <>
                  <span className="analytics-gauge-badge text-content-emerald-700">
                    <span className="w-2 h-2 rounded-full bg-surface-emerald-500" />
                    {paidCount} Paid
                  </span>
                  <span className="analytics-gauge-badge text-content-amber-700">
                    <span className="w-2 h-2 rounded-full bg-surface-amber-500" />
                    {pendingCount} Unpaid
                  </span>
                  {overdueInvoices.length > 0 && (
                    <span className="analytics-gauge-badge text-content-rose-700">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      {overdueInvoices.length} Overdue
                    </span>
                  )}
                </>
              ) : (
                <span className="text-[11px] text-content-neutral-400 text-center w-full">
                  No billing records available in period
                </span>
              )}
            </div>
          </div>
        );
      }

      // 16. Billing Alerts List
      case "billing-alerts":
        return (
          <div
            className={`ui-card flex flex-col justify-between ${
              isCompact ? "p-4" : "p-6"
            }`}
          >
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-line-neutral-100">
                <div className="flex items-center gap-1.5">
                  <TriangleAlert className="w-4 h-4 text-content-amber-600" />
                  <h3 className="text-sm font-semibold text-content-neutral-900 tracking-tight">
                    Billing Alerts
                  </h3>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase bg-surface-neutral-100 text-content-neutral-600">
                  {overdueInvoices.length}
                </span>
              </div>

              <div className="space-y-2">
                {invoices.length === 0 ? (
                  <div className="py-6 text-center text-xs text-content-neutral-400">
                    No invoices recorded.
                  </div>
                ) : overdueInvoices.length === 0 ? (
                  <div className="py-6 text-center text-xs text-content-neutral-500">
                    No overdue accounts. All settled.
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
                      className="flex items-center justify-between p-2 rounded-xl bg-surface-neutral-50 hover:bg-surface-neutral-100/80 transition-colors cursor-pointer border border-line-neutral-100"
                    >
                      <div>
                        <div className="text-xs font-semibold text-content-neutral-900">
                          {inv.clientName || "Client Account"}
                        </div>
                        <div className="text-[10px] text-content-rose-600 font-medium">
                          Due {formatDateDisplay(inv.dueDate)}
                        </div>
                      </div>
                      <div className="font-serif text-xs font-semibold text-content-neutral-900">
                        {formatCents(inv.amountCents, inv.currency)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-line-neutral-100 flex items-center justify-between text-xs text-content-neutral-500">
              <span>Overdue: {overdueTotalStr}</span>
              <Link
                href="/invoices"
                className="text-accent font-medium hover:underline text-[11px]"
              >
                Invoices →
              </Link>
            </div>
          </div>
        );

      // 17. Recent Invoices
      case "recent-invoices":
        return (
          <div
            className={`ui-card flex flex-col justify-between ${
              isCompact ? "p-4" : "p-6"
            }`}
          >
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-line-neutral-100">
                <div className="flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-accent" />
                  <h3 className="text-sm font-semibold text-content-neutral-900 tracking-tight">
                    Recent Invoices
                  </h3>
                </div>
                <Link
                  href="/invoices"
                  className="inline-flex items-center gap-0.5 text-xs font-semibold text-accent hover:underline"
                >
                  <span>All</span>
                  <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="space-y-2">
                {displayInvoices.length === 0 ? (
                  <div className="py-6 text-center text-xs text-content-neutral-400">
                    No invoices generated yet.
                  </div>
                ) : (
                  displayInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      onClick={() =>
                        onNavigateToInvoice
                          ? onNavigateToInvoice(inv.id)
                          : router.push(
                              `/invoices?invoice=${encodeURIComponent(inv.id)}`,
                            )
                      }
                      className="flex items-center justify-between p-2 rounded-xl bg-surface-neutral-50 hover:bg-surface-neutral-100/70 transition-colors cursor-pointer border border-line-neutral-100"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-semibold text-content-neutral-900 truncate">
                          {inv.clientName}
                        </div>
                        <div className="text-[10px] text-content-neutral-500 font-mono">
                          {inv.code}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-serif text-xs font-semibold text-content-neutral-900">
                          {formatCents(inv.amountCents, inv.currency)}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            inv.status === "PAID"
                              ? "bg-surface-emerald-50 text-content-emerald-700"
                              : inv.status === "OVERDUE"
                                ? "bg-surface-rose-50 text-content-rose-700"
                                : "bg-surface-amber-50 text-content-amber-800"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-line-neutral-100 flex items-center justify-between text-xs text-content-neutral-500">
              <span className="truncate">Balance: {pendingReceivablesStr}</span>
              <Link
                href="/clients"
                className="text-content-neutral-700 hover:text-content-neutral-900 font-medium text-[11px] shrink-0"
              >
                Clients →
              </Link>
            </div>
          </div>
        );

      // 18. Active Sprint Tasks
      case "sprint-tasks":
        return (
          <div
            className={`ui-card flex flex-col justify-between ${
              isCompact ? "p-4" : "p-6"
            }`}
          >
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-line-neutral-100">
                <div className="flex items-center gap-1.5">
                  <Kanban className="w-4 h-4 text-accent" />
                  <h3 className="text-sm font-semibold text-content-neutral-900 tracking-tight">
                    Sprint Tasks
                  </h3>
                </div>
                <Link
                  href="/tasks"
                  className="inline-flex items-center gap-0.5 text-xs font-semibold text-accent hover:underline"
                >
                  <span>Board</span>
                  <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="space-y-2">
                {tasks.length === 0 ? (
                  <div className="py-6 px-3 text-center rounded-xl bg-surface-neutral-50/70 border border-dashed border-line-neutral-200">
                    <Kanban className="w-5 h-5 text-content-neutral-400 mx-auto mb-1.5" />
                    <p className="text-xs font-semibold text-content-neutral-700">
                      No Tasks Recorded
                    </p>
                    <p className="text-[11px] text-content-neutral-500 mt-0.5">
                      Deliverables appear here when created or tracked from an advance-paid invoice.
                    </p>
                  </div>
                ) : activeTasks.length === 0 ? (
                  <div className="py-6 px-3 text-center rounded-xl bg-surface-emerald-50/40 border border-line-emerald-200/60">
                    <p className="text-xs font-semibold text-content-emerald-800">
                      All Deliverables Completed
                    </p>
                    <p className="text-[11px] text-content-emerald-600 mt-0.5">
                      {tasks.length} {tasks.length === 1 ? "task" : "tasks"} settled in done column.
                    </p>
                  </div>
                ) : (
                  activeTasks.slice(0, isCompact ? 2 : 3).map((t) => (
                    <div
                      key={t.id}
                      onClick={() => router.push("/tasks")}
                      className="flex items-center justify-between p-2 rounded-xl bg-surface-neutral-50 hover:bg-surface-neutral-100/70 transition-colors cursor-pointer border border-line-neutral-100"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-semibold text-content-neutral-900 truncate">
                          {t.title}
                        </div>
                        <div className="text-[10px] text-content-neutral-500">
                          {typeof t.assignee === "object" ? t.assignee.name : (t.assignee || "Unassigned")} {t.dueDate ? `· ${t.dueDate}` : ""}
                        </div>
                      </div>

                      <span
                        className={`text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                          t.priority === "urgent"
                            ? "bg-surface-rose-100 text-content-rose-800"
                            : "bg-surface-amber-100 text-content-amber-800"
                        }`}
                      >
                        {t.priority}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-line-neutral-100 flex items-center justify-between text-xs text-content-neutral-500">
              <span>
                {tasks.length === 0
                  ? "Unavailable · 0 tasks"
                  : activeTasks.length === 0
                    ? `${tasks.length} completed`
                    : `${activeTasks.length} in sprint`}
              </span>
              <Link
                href="/tasks"
                className="text-content-neutral-700 hover:text-content-neutral-900 font-medium text-[11px]"
              >
                Board →
              </Link>
            </div>
          </div>
        );

      // 19. Turnaround & Lead Time Percentiles Chart
      case "latency-percentiles-chart":
        return (
          <div className="analytics-creative-chart-card">
            <div className="analytics-creative-header">
              <div className="analytics-creative-title-group">
                <div className="analytics-creative-icon-box">
                  <Clock className="w-4 h-4 text-content-amber-600" />
                </div>
                <div>
                  <h3 className="analytics-creative-title">
                    Turnaround & Lead Time Percentiles
                  </h3>
                  {!isCompact && (
                    <p className="analytics-creative-subtitle">
                      Deliverable turnaround velocity by SLA distribution (P50, P75, P95, P99 in hours)
                    </p>
                  )}
                </div>
              </div>
            </div>
            <LatencyPercentilesChart />
          </div>
        );

      // 20. Service Revenue Yield & Retainers Chart
      case "portfolio-comparison-chart":
        return (
          <div className="analytics-creative-chart-card">
            <div className="analytics-creative-header">
              <div className="analytics-creative-title-group">
                <div className="analytics-creative-icon-box">
                  <TrendingUp className="w-4 h-4 text-content-emerald-600" />
                </div>
                <div>
                  <h3 className="analytics-creative-title">
                    Service Revenue Yield & Retainers
                  </h3>
                  {!isCompact && (
                    <p className="analytics-creative-subtitle">
                      Step-curve comparative yield performance across Web Development and AI Retainers
                    </p>
                  )}
                </div>
              </div>
            </div>
            <PortfolioComparisonChart />
          </div>
        );

      // 21. Billable Capacity Benchmark Chart
      case "growth-benchmark-chart":
        return (
          <div className="analytics-creative-chart-card">
            <div className="analytics-creative-header">
              <div className="analytics-creative-title-group">
                <div className="analytics-creative-icon-box">
                  <Target className="w-4 h-4 text-content-blue-600" />
                </div>
                <div>
                  <h3 className="analytics-creative-title">
                    Billable Capacity Benchmark
                  </h3>
                  {!isCompact && (
                    <p className="analytics-creative-subtitle">
                      Weekly billable milestone velocity tracked against planned target curves
                    </p>
                  )}
                </div>
              </div>
            </div>
            <GrowthBenchmarkChart />
          </div>
        );

      // 22. Delivered Solutions Financial Growth Chart
      case "audience-growth-chart":
        return (
          <div className="analytics-creative-chart-card">
            <div className="analytics-creative-header">
              <div className="analytics-creative-title-group">
                <div className="analytics-creative-icon-box">
                  <DollarSign className="w-4 h-4 text-content-purple-600" />
                </div>
                <div>
                  <h3 className="analytics-creative-title">
                    Delivered Solutions Financial Growth
                  </h3>
                  {!isCompact && (
                    <p className="analytics-creative-subtitle">
                      Monthly realized collections, operating costs, and net profit across client solutions
                    </p>
                  )}
                </div>
              </div>
            </div>
            <AudienceGrowthChart />
          </div>
        );

      // 23. Service Delivery Trends Line Chart
      case "service-trends-line-chart":
        return (
          <div className="analytics-creative-chart-card">
            <div className="analytics-creative-header">
              <div className="analytics-creative-title-group">
                <div className="analytics-creative-icon-box">
                  <Activity className="w-4 h-4 text-content-emerald-600" />
                </div>
                <div>
                  <h3 className="analytics-creative-title">
                    Service Delivery Trends
                  </h3>
                  {!isCompact && (
                    <p className="analytics-creative-subtitle">
                      Monthly web development and AI consulting volume with buffer forecasting
                    </p>
                  )}
                </div>
              </div>
            </div>
            <ServiceTrendsLineChart />
          </div>
        );

      // 24. Contract Deliverables Volume Bar Chart
      case "itemized-volume-bar-chart":
        return (
          <div className="analytics-creative-chart-card">
            <div className="analytics-creative-header">
              <div className="analytics-creative-title-group">
                <div className="analytics-creative-icon-box">
                  <BarChart3 className="w-4 h-4 text-content-blue-600" />
                </div>
                <div>
                  <h3 className="analytics-creative-title">
                    Contract Deliverables Volume
                  </h3>
                  {!isCompact && (
                    <p className="analytics-creative-subtitle">
                      Monthly itemized deliverable distribution with interactive timeline brush
                    </p>
                  )}
                </div>
              </div>
            </div>
            <ItemizedVolumeBarChart />
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
        e.dataTransfer.setData("text/plain", widgetId);
        e.dataTransfer.effectAllowed = "copyMove";
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
        isEditing
          ? "ring-2 ring-dashed ring-line-purple-300 rounded-2xl bg-surface-purple-50/10 p-0.5"
          : ""
      }`}
    >
      {/* Quick Actions Toolbar on Dashboard:
          Displays only when in Customize Layout mode (isEditing) to prevent
          overlapping card headers, links, and 'All' buttons during normal browsing. */}
      {source === "dashboard" && isEditing && (
        <div
          className="absolute top-2 right-2 z-30 flex items-center gap-1 p-1 bg-surface/95 rounded-xl border border-line-neutral-200/90 shadow-md backdrop-blur-xs select-none ring-1 ring-line-purple-300"
        >
          {isEditing && onMoveLeft && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoveLeft();
              }}
              title="Move Left / Earlier"
              className="p-1 text-content-neutral-500 hover:text-content-neutral-900 rounded hover:bg-surface-neutral-100 transition-colors"
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
              className="p-1 text-content-neutral-500 hover:text-content-neutral-900 rounded hover:bg-surface-neutral-100 transition-colors"
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
              title={
                isCompact
                  ? "Expand to Standard (Rectangle / Full)"
                  : "Shrink to Square / Half"
              }
              className="p-1 text-accent hover:bg-surface-purple-50 rounded transition-colors"
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
              className="p-1 text-content-rose-500 hover:text-content-rose-700 hover:bg-surface-rose-50 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Subtle Drag Handle Indicator on Hover in Analytics */}
      {isDraggable && source === "analytics" && !isEditing && (
        <div className="absolute top-2.5 right-2.5 z-20 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1 rounded-md bg-surface/80 shadow-xs border border-line-neutral-200/60 pointer-events-none">
          <GripVertical className="w-3.5 h-3.5 text-content-neutral-500" />
        </div>
      )}

      {renderContent()}
    </div>
  );
}
