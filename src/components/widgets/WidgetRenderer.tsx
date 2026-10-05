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
  Layers,
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
} from "lucide-react";
import { MetricCard } from "@/components/ui/Workspace";
import {
  useDashboardSummary,
  useInvoices,
  useClients,
} from "@/lib/data/DataProvider";
import { formatCents, formatDateDisplay } from "@/lib/format";
import { DashboardPeriod, MonthlyGrowthPoint } from "@/types/dashboard";
import { WidgetDisplaySize } from "@/types/widgets";
import { WIDGET_CATALOG } from "@/lib/widgets/widgetDefinitions";

// Synthetic monthly growth trend dataset
const growthDataset: MonthlyGrowthPoint[] = [];

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

  const [chartMetric, setChartMetric] = useState<"profit" | "margin">("profit");

  const formatCurrencyMap = (map?: Record<string, number>): string => {
    if (!map || Object.keys(map).length === 0) return "$0.00";
    const nonZero = Object.entries(map).filter(([, cents]) => cents > 0);
    if (nonZero.length === 0) return "$0.00";
    return nonZero.map(([curr, cents]) => formatCents(cents, curr)).join(" · ");
  };

  const totalRevenueStr = useMemo(
    () => formatCurrencyMap(dashboard?.totalBilledByCurrency),
    [dashboard],
  );
  const pendingReceivablesStr = useMemo(
    () => formatCurrencyMap(dashboard?.outstandingByCurrency),
    [dashboard],
  );

  const activeClientsCount = dashboard?.activeClients ?? clients.length;
  const unpaidCount = dashboard?.unpaidCount ?? 0;
  const recentInvoicesList = dashboard?.recentInvoices ?? [];

  // Live computed metrics across invoices
  const { paidCount, totalInvoicedCents, paidRatioPct, avgInvoiceStr } =
    useMemo(() => {
      if (invoices.length === 0) {
        return {
          paidCount: 0,
          totalInvoicedCents: 0,
          paidRatioPct: 100,
          avgInvoiceStr: "$0.00",
        };
      }
      let paid = 0;
      let totalCents = 0;
      let paidCents = 0;
      invoices.forEach((inv) => {
        totalCents += inv.amountCents;
        if (inv.status === "PAID") {
          paid += 1;
          paidCents += inv.amountCents;
        }
      });
      const ratio =
        totalCents > 0 ? Math.round((paidCents / totalCents) * 100) : 100;
      const avg = totalCents / invoices.length;
      return {
        paidCount: paid,
        totalInvoicedCents: totalCents,
        paidRatioPct: ratio,
        avgInvoiceStr: formatCents(Math.round(avg), "USD"),
      };
    }, [invoices]);

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
    return formatCents(cents, "USD");
  }, [overdueInvoices]);

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
              {totalRevenueStr !== "$0.00" ? "Active" : "0%"}
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
          totalRevenueStr,
          <>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-surface-purple-50 text-content-purple-700 border-line-purple-200/60">
              <TrendingUp className="w-3 h-3" />
              Healthy
            </span>
            <span>net retained earnings</span>
          </>,
          "accent",
          "Retained earnings",
        );

      // 3. Pending Receivables
      case "pending-receivables":
        return renderMetric(
          "Pending Receivables",
          pendingReceivablesStr,
          <>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-surface-amber-50 text-content-amber-800 border-line-amber-200/60">
              {unpaidCount} pending
            </span>
            <span>
              {unpaidCount === 1
                ? "invoice awaiting payment"
                : "invoices awaiting payment"}
            </span>
          </>,
          "warning",
          `${unpaidCount} pending`,
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
          "$0.00",
          <>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-surface-purple-50 text-content-purple-700 border-line-purple-200/60">
              <GitFork className="w-3 h-3" />
              0 vendors
            </span>
            <span>active external contractors</span>
          </>,
          "default",
          "0 contractors",
        );

      // 6. Operating Expenses
      case "operating-expenses":
        return renderMetric(
          "Operating Expenses",
          "$0.00",
          <>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-surface-neutral-100 text-content-neutral-700 border-line-neutral-200/60">
              0%
            </span>
            <span>software & cloud overhead</span>
          </>,
          "default",
          "Software & cloud",
        );

      // 7. Paid Ratio
      case "paid-ratio":
        return renderMetric(
          "Invoice Paid Ratio",
          `${paidRatioPct}%`,
          <>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-surface-emerald-50 text-content-emerald-700 border-line-emerald-200/60">
              <ShieldCheck className="w-3 h-3" />
              {paidCount} of {invoices.length} paid
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
          "12+ mo",
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
          "28%",
          <>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-surface-blue-50 text-content-blue-700 border-line-blue-200/60">
              <PieChart className="w-3 h-3" />
              Balanced
            </span>
            <span>diversified revenue base</span>
          </>,
          "default",
          "Top client 28%",
        );

      // 12. Realized Hourly Yield
      case "effective-hourly-rate":
        return renderMetric(
          "Realized Hourly Yield",
          "$145/hr",
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
      case "revenue-expenses-chart":
        return (
          <div
            className={`ui-card flex flex-col justify-between ${
              isCompact ? "p-4 space-y-3" : "p-6"
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-line-neutral-100">
              <div>
                <h3 className="text-sm font-semibold text-content-neutral-900 tracking-tight">
                  Revenue vs Expenses
                </h3>
                {!isCompact && (
                  <p className="text-xs text-content-neutral-500 mt-0.5">
                    Monthly cashflow and expense comparison.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2.5 text-xs font-medium">
                <span className="flex items-center gap-1 text-content-neutral-700">
                  <span className="w-2 h-2 rounded-full bg-accent-solid" />
                  <span>Rev</span>
                </span>
                <span className="flex items-center gap-1 text-content-neutral-700">
                  <span className="w-2 h-2 rounded-full bg-surface-neutral-300" />
                  <span>Exp</span>
                </span>
              </div>
            </div>

            <div
              className={`text-center text-xs text-content-neutral-400 border border-dashed border-line-neutral-200/80 rounded-xl bg-surface-neutral-50/50 flex items-center justify-center ${
                isCompact ? "h-32 px-3" : "py-8 my-4"
              }`}
            >
              Cashflow analytics plot here as you bill clients.
            </div>

            <div className="pt-2.5 border-t border-line-neutral-100 flex items-center justify-between text-xs text-content-neutral-500">
              <span>Gross: {totalRevenueStr}</span>
              <span className="text-accent font-medium">Cashflow</span>
            </div>
          </div>
        );

      // 14. Profit & Growth Trajectory Chart
      case "profit-trajectory-chart":
        return (
          <div
            className={`ui-card space-y-4 ${
              isCompact ? "p-4" : "p-6 space-y-6"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line-neutral-100">
              <div>
                <h3 className="text-sm font-semibold text-content-neutral-900 tracking-tight">
                  Profit & Growth Trajectory
                </h3>
                {!isCompact && (
                  <p className="text-xs text-content-neutral-500 mt-0.5">
                    Month-over-month revenue intake and net retained profits.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <div className="flex rounded-lg border border-line-neutral-200 p-0.5 bg-surface-neutral-50 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setChartMetric("profit")}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                      chartMetric === "profit"
                        ? "bg-surface text-content-neutral-900 shadow-xs"
                        : "text-content-neutral-500 hover:text-content-neutral-900"
                    }`}
                  >
                    Volume
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMetric("margin")}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                      chartMetric === "margin"
                        ? "bg-surface text-content-neutral-900 shadow-xs"
                        : "text-content-neutral-500 hover:text-content-neutral-900"
                    }`}
                  >
                    Margin
                  </button>
                </div>
              </div>
            </div>

            <div
              className={`flex flex-col items-center justify-center text-center p-4 border border-dashed border-line-neutral-200/80 rounded-xl bg-surface-neutral-50/50 ${
                isCompact ? "h-32" : "h-44"
              }`}
            >
              <span className="text-xs font-semibold text-content-neutral-800">
                No revenue history yet
              </span>
              <span className="text-[11px] text-content-neutral-400 mt-0.5 max-w-sm">
                Monthly trends plot here as you bill clients.
              </span>
            </div>
          </div>
        );

      // 15. On-Time Collection Rate Gauge
      case "collection-rate-gauge":
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
                {paidRatioPct}%
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
                    r="40"
                    stroke="var(--ui-border)"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="var(--ui-accent)"
                    strokeWidth="10"
                    strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={
                      2 * Math.PI * 40 * (1 - paidRatioPct / 100)
                    }
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

            <div className="text-center text-[11px] text-content-neutral-500 pt-1.5 border-t border-line-neutral-100">
              {paidCount} invoices collected
            </div>
          </div>
        );

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
                    No overdue accounts.
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
                {recentInvoicesList.length === 0 ? (
                  <div className="py-6 text-center text-xs text-content-neutral-400">
                    No invoices generated yet.
                  </div>
                ) : (
                  recentInvoicesList.slice(0, isCompact ? 2 : 3).map((inv) => (
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
