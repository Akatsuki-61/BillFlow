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
} from "lucide-react";
import { MetricCard } from "@/components/ui/Workspace";
import {
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

// Smooth Bezier Curve Path Generator for Financial Charts
function getSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

// Sample active sprint tasks
const activeTasks = [
  {
    id: "task-1",
    title: "Client Portal Auth & Stripe Invoicing",
    priority: "urgent" as const,
    assignee: "Alex Carter",
    dueDate: "Tomorrow",
    isOutsourced: false,
  },
  {
    id: "task-2",
    title: "Quarterly Financial Audit & Tax Filing",
    priority: "high" as const,
    assignee: "Apex Accounting",
    dueDate: "Oct 15",
    isOutsourced: true,
  },
  {
    id: "task-3",
    title: "Enterprise Contract Onboarding Docs",
    priority: "medium" as const,
    assignee: "Morgan S.",
    dueDate: "Oct 22",
    isOutsourced: false,
  },
];

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

  // Aggregate metrics from live invoices
  const {
    totalRevenueCents,
    paidCount,
    paidCents,
    pendingCents,
    pendingCount,
    paidRatioPct,
    avgInvoiceCents,
    avgInvoiceStr,
  } = useMemo(() => {
    if (filteredInvoices.length === 0) {
      return {
        totalRevenueCents: 0,
        paidCount: 0,
        paidCents: 0,
        pendingCents: 0,
        pendingCount: 0,
        paidRatioPct: 100,
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
      if (inv.status === "PAID") {
        paid += 1;
        paidAmt += inv.amountCents;
      } else {
        pendingCnt += 1;
        pendingAmt += inv.amountCents - (inv.paidCents || 0);
      }
    });

    const ratio = total > 0 ? Math.round((paidAmt / total) * 100) : 100;
    const avg = Math.round(total / filteredInvoices.length);

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

  // Net Profit & Margins
  const netProfitCents = useMemo(() => {
    return Math.max(0, totalRevenueCents - totalOutsourcedCents);
  }, [totalRevenueCents, totalOutsourcedCents]);

  const netProfitStr = useMemo(() => {
    return formatCents(netProfitCents, activeCurrency);
  }, [netProfitCents, activeCurrency]);

  const marginPct = useMemo(() => {
    if (totalRevenueCents <= 0) return 100;
    const net = Math.max(0, totalRevenueCents - totalOutsourcedCents);
    return Math.round((net / totalRevenueCents) * 100);
  }, [totalRevenueCents, totalOutsourcedCents]);

  // Operating Expenses (Outsourced costs + 5% software overhead)
  const opexCents = useMemo(() => {
    return totalOutsourcedCents + Math.round(totalRevenueCents * 0.05);
  }, [totalOutsourcedCents, totalRevenueCents]);

  const opexStr = useMemo(() => {
    return formatCents(opexCents, activeCurrency);
  }, [opexCents, activeCurrency]);

  const opexRatioPct = useMemo(() => {
    if (totalRevenueCents <= 0) return 5;
    return Math.min(100, Math.round((opexCents / totalRevenueCents) * 100));
  }, [opexCents, totalRevenueCents]);

  // Active Clients count
  const activeClientsCount = dashboard?.activeClients ?? clients.length;

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

  // Realized Hourly Yield
  const effectiveHourlyRate = useMemo(() => {
    if (avgInvoiceCents <= 0) return 145;
    return Math.max(65, Math.round(avgInvoiceCents / 1600));
  }, [avgInvoiceCents]);

  // Cashflow Runway
  const runwayMonths = useMemo(() => {
    const monthlyBurn = Math.max(100000, Math.round(totalOutsourcedCents / 3));
    const availableLiquidity = paidCents + Math.round(pendingCents * 0.75);
    if (monthlyBurn <= 0 || availableLiquidity <= 0) return 12;
    return Math.min(
      24,
      Math.max(1, Math.round(availableLiquidity / monthlyBurn)),
    );
  }, [totalOutsourcedCents, paidCents, pendingCents]);

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
        marginPct: 100,
      });
    }

    invoices.forEach((inv) => {
      if (!inv.issueDate) return;
      const invKey = inv.issueDate.slice(0, 7);
      const target = months.find((m) => m.key === invKey);
      if (target) {
        target.revenueCents += inv.amountCents;
      }
    });

    const hasInvoices = invoices.length > 0;
    const avgMonthlyOutsourced = hasInvoices
      ? Math.round(totalOutsourcedCents / 6)
      : 0;

    months.forEach((m) => {
      m.expensesCents = m.revenueCents > 0
        ? avgMonthlyOutsourced + Math.round(m.revenueCents * 0.05)
        : 0;
      m.profitCents = Math.max(0, m.revenueCents - m.expensesCents);
      m.marginPct =
        m.revenueCents > 0
          ? Math.round((m.profitCents / m.revenueCents) * 100)
          : 100;
    });

    return months;
  }, [invoices, totalOutsourcedCents]);

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
              ? "border-line-purple-200/80 bg-surface-purple-50/20"
              : tone === "warning"
                ? "border-line-amber-200/80 bg-surface-amber-50/20"
                : ""
          }`}
        >
          <div>
            <span className="text-[11px] font-medium text-content-neutral-500 block truncate">
              {label}
            </span>
            <div className="font-serif text-xl sm:text-2xl font-semibold text-content-neutral-900 mt-1.5 tracking-tight truncate">
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

      // 2. Net Profit
      case "net-profit":
        return renderMetric(
          "Net Profit & Margin",
          netProfitStr,
          <>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-surface-purple-50 text-content-purple-700 border-line-purple-200/60">
              <TrendingUp className="w-3 h-3" />
              {marginPct}% margin
            </span>
            <span>net retained earnings</span>
          </>,
          "accent",
          `${marginPct}% margin`,
        );

      // 3. Pending Receivables
      case "pending-receivables":
        return renderMetric(
          "Pending Receivables",
          pendingReceivablesStr,
          <>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-surface-amber-50 text-content-amber-800 border-line-amber-200/60">
              {pendingCount} pending
            </span>
            <span>
              {pendingCount === 1
                ? "invoice awaiting payment"
                : "invoices awaiting payment"}
            </span>
          </>,
          "warning",
          `${pendingCount} pending`,
        );

      // 4. Active Clients
      case "active-clients":
        return renderMetric(
          "Active Client Accounts",
          String(activeClientsCount),
          <>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-surface-blue-50 text-content-blue-700 border-line-blue-200/60">
              <Briefcase className="w-3 h-3" />
              {activeClientsCount} active
            </span>
            <span>client accounts & retainers</span>
          </>,
          "default",
          `${activeClientsCount} accounts`,
        );

      // 5. Outsourced Costs
      case "outsourced-costs":
        return renderMetric(
          "Subcontractor Costs",
          outsourcedCostsStr,
          <>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-surface-purple-50 text-content-purple-700 border-line-purple-200/60">
              <GitFork className="w-3 h-3" />
              {vendors.length} vendors
            </span>
            <span>active external contractors</span>
          </>,
          "default",
          `${vendors.length} contractors`,
        );

      // 6. Operating Expenses
      case "operating-expenses":
        return renderMetric(
          "Operating Expenses",
          opexStr,
          <>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-surface-neutral-100 text-content-neutral-700 border-line-neutral-200/60">
              {opexRatioPct}%
            </span>
            <span>software & contractor overhead</span>
          </>,
          "default",
          "Software & tools",
        );

      // 7. Paid Ratio
      case "paid-ratio":
        return renderMetric(
          "Invoice Paid Ratio",
          `${paidRatioPct}%`,
          <>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-surface-emerald-50 text-content-emerald-700 border-line-emerald-200/60">
              <ShieldCheck className="w-3 h-3" />
              {paidCount} of {filteredInvoices.length} paid
            </span>
            <span>on-time collection rate</span>
          </>,
          "accent",
          `${paidRatioPct}% on-time`,
        );

      // 8. Average Invoice Value
      case "average-invoice-value":
        return renderMetric(
          "Average Invoice Size",
          avgInvoiceStr,
          <>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-surface-neutral-100 text-content-neutral-700 border-line-neutral-200/60">
              <DollarSign className="w-3 h-3" />
              Average
            </span>
            <span>ticket size per contract</span>
          </>,
          "default",
          "Average contract",
        );

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
      case "cashflow-runway":
        return renderMetric(
          "Cashflow Runway",
          `${runwayMonths}+ mo`,
          <>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-surface-emerald-50 text-content-emerald-700 border-line-emerald-200/60">
              Stable
            </span>
            <span>operating cushion</span>
          </>,
          "default",
          "Stable cushion",
        );

      // 11. Top Client Concentration
      case "client-concentration":
        return renderMetric(
          "Client Concentration",
          `${topClientPct}%`,
          <>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-surface-blue-50 text-content-blue-700 border-line-blue-200/60 truncate max-w-[120px]">
              <PieChart className="w-3 h-3 shrink-0" />
              <span className="truncate">{topClient ? topClient.name : "Diversified"}</span>
            </span>
            <span>revenue concentration</span>
          </>,
          "default",
          `Top client ${topClientPct}%`,
        );

      // 12. Realized Hourly Yield
      case "effective-hourly-rate":
        return renderMetric(
          "Realized Hourly Yield",
          `${getCurrencySymbol(activeCurrency)}${effectiveHourlyRate}/hr`,
          <>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-surface-purple-50 text-content-purple-700 border-line-purple-200/60">
              <TrendingUp className="w-3 h-3" />
              Target Met
            </span>
            <span>effective sprint return</span>
          </>,
          "accent",
          "Sprint return",
        );

      // 13. Revenue vs Expenses Paired Bar Chart
      case "revenue-expenses-chart": {
        const rawMax = Math.max(
          0,
          ...monthlyStats.map((m) => Math.max(m.revenueCents, m.expensesCents)),
        );
        const maxChartVal = rawMax > 0 ? rawMax : 500000; // Reference ceiling
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
                      6-month cashflow velocity and contractor payouts
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
                preserveAspectRatio="none"
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
                    rawMax > 0 && m.revenueCents > 0
                      ? Math.max(8, Math.round((m.revenueCents / maxChartVal) * 102))
                      : 4;
                  const expHeight =
                    rawMax > 0 && m.expensesCents > 0
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
        const rawMax = Math.max(0, ...monthlyStats.map((m) => m.profitCents));
        const maxTrajectoryVal =
          chartMetric === "profit" ? (rawMax > 0 ? rawMax : 500000) : 100;

        const topLabel =
          chartMetric === "profit" ? formatCents(maxTrajectoryVal, activeCurrency) : "100%";
        const midLabel =
          chartMetric === "profit"
            ? formatCents(Math.round(maxTrajectoryVal / 2), activeCurrency)
            : "50%";

        // Calculate smooth trajectory points
        const points = monthlyStats.map((m, i) => {
          const x = 82 + i * 78;
          const val = chartMetric === "profit" ? m.profitCents : m.marginPct;
          const pct = maxTrajectoryVal > 0 && val > 0 ? val / maxTrajectoryVal : 0;
          const y =
            chartMetric === "margin"
              ? 135 - Math.round(pct * 105)
              : rawMax > 0 && m.profitCents > 0
                ? 135 - Math.round(pct * 105)
                : 135;
          return {
            x,
            y,
            val,
            label: m.label,
            marginPct: m.marginPct,
            profitCents: m.profitCents,
          };
        });

        const lineD = getSmoothPath(points);
        const areaD =
          points.length > 0
            ? `${lineD} L ${points[points.length - 1].x} 135 L ${points[0].x} 135 Z`
            : "";

        const latestPoint = points[points.length - 1];
        const latestValStr =
          chartMetric === "profit"
            ? formatCents(latestPoint?.profitCents || 0, activeCurrency)
            : `${latestPoint?.marginPct || 100}% Margin`;

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

            <div className="analytics-creative-canvas-area">
              <svg
                viewBox="0 0 540 170"
                className="analytics-creative-svg"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="creativeSplineArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.0" />
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
                  {chartMetric === "profit" ? `${getCurrencySymbol(activeCurrency)}0` : "0%"}
                </text>

                {/* Shaded Spline Area */}
                {areaD && (
                  <path d={areaD} fill="url(#creativeSplineArea)" />
                )}

                {/* Smooth Spline Curve */}
                {lineD && (
                  <path d={lineD} className="analytics-spline-path" />
                )}

                {/* Spline Nodes */}
                {points.map((p, idx) => {
                  const isCurrent = idx === points.length - 1;
                  return (
                    <g key={idx}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isCurrent ? 5.5 : 4}
                        className="analytics-node-dot"
                      >
                        <title>
                          {chartMetric === "profit"
                            ? `${p.label} Profit: ${formatCents(p.profitCents, activeCurrency)}`
                            : `${p.label} Margin: ${p.marginPct}%`}
                        </title>
                      </circle>

                      {/* Month Text */}
                      <text
                        x={p.x}
                        y="154"
                        className={`analytics-month-text ${isCurrent ? "active" : ""}`}
                      >
                        {p.label.toUpperCase()}
                      </text>
                    </g>
                  );
                })}

                {/* Floating Tooltip Pill for Current / Active Month */}
                {latestPoint && (
                  <g transform={`translate(${latestPoint.x}, ${Math.max(16, latestPoint.y - 28)})`}>
                    <rect
                      x="-38"
                      y="0"
                      width="76"
                      height="20"
                      rx="6"
                      className="analytics-floating-tag-bg"
                    />
                    <polygon
                      points="-4,20 4,20 0,24"
                      fill="#18181b"
                    />
                    <text
                      x="0"
                      y="13"
                      className="analytics-floating-tag-text"
                    >
                      {latestValStr}
                    </text>
                  </g>
                )}
              </svg>
            </div>

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
        const strokeDashoffset = circumference * (1 - paidRatioPct / 100);

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
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-surface-emerald-50 text-content-emerald-700 border border-line-emerald-200/60">
                {paidRatioPct}% Collected
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
                    {paidRatioPct}%
                  </span>
                </div>
              </div>
            </div>

            <div className="analytics-gauge-legend">
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
                {overdueInvoices.length === 0 ? (
                  <div className="py-6 text-center text-xs text-content-neutral-400">
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
                {activeTasks.length === 0 ? (
                  <div className="py-6 text-center text-xs text-content-neutral-400">
                    No active deliverables.
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
                          {t.assignee} · {t.dueDate}
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
              <span>{activeTasks.length} in sprint</span>
              <Link
                href="/outsourcing"
                className="text-content-neutral-700 hover:text-content-neutral-900 font-medium text-[11px]"
              >
                Payouts →
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
      {/* Edit Mode Quick Actions Toolbar */}
      {isEditing && (
        <div className="absolute top-2 right-2 z-30 flex items-center gap-1 p-1 bg-surface/95 rounded-xl border border-line-neutral-200/90 shadow-md backdrop-blur-xs select-none">
          {onMoveLeft && (
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

          {onMoveRight && (
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
