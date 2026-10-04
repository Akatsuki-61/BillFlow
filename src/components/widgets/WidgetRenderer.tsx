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
  TrendingDown,
  Calendar,
} from "lucide-react";
import { MetricCard, Button } from "@/components/ui/Workspace";
import {
  useDashboardSummary,
  useInvoices,
  useClients,
} from "@/lib/data/DataProvider";
import { formatCents, formatDateDisplay } from "@/lib/format";
import { DashboardPeriod, MonthlyGrowthPoint } from "@/types/dashboard";
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
  isDraggable?: boolean;
  onContextMenu?: (e: React.MouseEvent, widgetId: string) => void;
  onNavigateToInvoice?: (id: string) => void;
}

export function WidgetRenderer({
  widgetId,
  source,
  period = "quarter",
  isDraggable = false,
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

  // Max for growth chart
  const maxRevenue = Math.max(1, ...growthDataset.map((d) => d.revenue));

  // Render individual widget based on ID
  const renderContent = () => {
    switch (widgetId) {
      // 1. Total Revenue
      case "total-revenue":
        return (
          <MetricCard
            label="Total Revenue"
            value={totalRevenueStr}
            footer={
              <>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-neutral-100 text-neutral-700 border-neutral-200/60">
                  <TrendingUp className="w-3 h-3 text-[#7c3aed]" />
                  {totalRevenueStr !== "$0.00" ? "Active" : "0%"}
                </span>
                <span>billed to date</span>
              </>
            }
          />
        );

      // 2. Net Profit
      case "net-profit":
        return (
          <MetricCard
            label="Net Profit & Margin"
            value={totalRevenueStr}
            tone="accent"
            footer={
              <>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-purple-50 text-purple-700 border-purple-200/60">
                  <TrendingUp className="w-3 h-3" />
                  Healthy
                </span>
                <span>net retained earnings</span>
              </>
            }
          />
        );

      // 3. Pending Receivables
      case "pending-receivables":
        return (
          <MetricCard
            label="Pending Receivables"
            value={pendingReceivablesStr}
            tone="warning"
            footer={
              <>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-amber-50 text-amber-800 border-amber-200/60">
                  {unpaidCount} pending
                </span>
                <span>
                  {unpaidCount === 1
                    ? "invoice awaiting payment"
                    : "invoices awaiting payment"}
                </span>
              </>
            }
          />
        );

      // 4. Active Clients
      case "active-clients":
        return (
          <MetricCard
            label="Active Client Accounts"
            value={String(activeClientsCount)}
            footer={
              <>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-blue-50 text-blue-700 border-blue-200/60">
                  <Briefcase className="w-3 h-3" />
                  {activeClientsCount} active
                </span>
                <span>client accounts & retainers</span>
              </>
            }
          />
        );

      // 5. Outsourced Costs
      case "outsourced-costs":
        return (
          <MetricCard
            label="Subcontractor Outsource Costs"
            value="$0.00"
            footer={
              <>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-purple-50 text-purple-700 border-purple-200/60">
                  <GitFork className="w-3 h-3" />
                  0 vendors
                </span>
                <span>active external contractors</span>
              </>
            }
          />
        );

      // 6. Operating Expenses
      case "operating-expenses":
        return (
          <MetricCard
            label="Operating Expenses"
            value="$0.00"
            footer={
              <>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-neutral-100 text-neutral-700 border-neutral-200/60">
                  0%
                </span>
                <span>software & cloud overhead</span>
              </>
            }
          />
        );

      // 7. Paid Ratio
      case "paid-ratio":
        return (
          <MetricCard
            label="Invoice Paid Ratio"
            value={`${paidRatioPct}%`}
            tone="accent"
            footer={
              <>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200/60">
                  <ShieldCheck className="w-3 h-3" />
                  {paidCount} of {invoices.length} paid
                </span>
                <span>on-time collection rate</span>
              </>
            }
          />
        );

      // 8. Average Invoice Value
      case "average-invoice-value":
        return (
          <MetricCard
            label="Average Invoice Size"
            value={avgInvoiceStr}
            footer={
              <>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-neutral-100 text-neutral-700 border-neutral-200/60">
                  <DollarSign className="w-3 h-3" />
                  Average
                </span>
                <span>ticket size per contract</span>
              </>
            }
          />
        );

      // 9. Overdue Receivables
      case "overdue-receivables":
        return (
          <MetricCard
            label="Overdue Invoices"
            value={overdueTotalStr}
            tone={overdueInvoices.length > 0 ? "warning" : "default"}
            footer={
              <>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                    overdueInvoices.length > 0
                      ? "bg-rose-50 text-rose-700 border-rose-200/60"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  {overdueInvoices.length} overdue
                </span>
                <span>past payment due date</span>
              </>
            }
          />
        );

      // 10. Cashflow Runway
      case "cashflow-runway":
        return (
          <MetricCard
            label="Cashflow Runway Cushion"
            value="12+ mo"
            footer={
              <>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200/60">
                  Stable
                </span>
                <span>operating cushion</span>
              </>
            }
          />
        );

      // 11. Top Client Concentration
      case "client-concentration":
        return (
          <MetricCard
            label="Top Client Concentration"
            value="28%"
            footer={
              <>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-blue-50 text-blue-700 border-blue-200/60">
                  <PieChart className="w-3 h-3" />
                  Balanced
                </span>
                <span>diversified revenue base</span>
              </>
            }
          />
        );

      // 12. Realized Hourly Yield
      case "effective-hourly-rate":
        return (
          <MetricCard
            label="Realized Hourly Yield"
            value="$145/hr"
            tone="accent"
            footer={
              <>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-purple-50 text-purple-700 border-purple-200/60">
                  <TrendingUp className="w-3 h-3" />
                  Target Met
                </span>
                <span>effective sprint return</span>
              </>
            }
          />
        );

      // 13. Revenue vs Expenses Paired Bar Chart
      case "revenue-expenses-chart":
        return (
          <div className="ui-card p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">
                  Revenue vs Expenses
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Monthly cashflow and expense analytics comparison.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-medium">
                <span className="flex items-center gap-1.5 text-neutral-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#7c3aed]" />
                  <span>Revenue</span>
                </span>
                <span className="flex items-center gap-1.5 text-neutral-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-neutral-300" />
                  <span>Expenses</span>
                </span>
              </div>
            </div>

            <div className="py-8 text-center text-xs text-neutral-400 border border-dashed border-neutral-200/80 rounded-xl my-4 bg-neutral-50/50">
              Monthly cashflow and cost distributions will plot here as you
              record transactions.
            </div>

            <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
              <span>Gross Intake: {totalRevenueStr}</span>
              <span className="text-[#7c3aed] font-medium">Balanced Cashflow</span>
            </div>
          </div>
        );

      // 14. Profit & Growth Trajectory Chart
      case "profit-trajectory-chart":
        return (
          <div className="ui-card p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-100">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">
                  Business & Profit Growth Trajectory
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Month-over-month revenue intake and net retained profits.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-4 text-xs font-medium">
                  <span className="flex items-center gap-1.5 text-neutral-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#7c3aed]" />
                    <span>Gross Revenue</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-neutral-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                    <span>Net Profit</span>
                  </span>
                </div>

                <div className="flex rounded-lg border border-neutral-200 p-0.5 bg-neutral-50 text-xs">
                  <button
                    type="button"
                    onClick={() => setChartMetric("profit")}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      chartMetric === "profit"
                        ? "bg-white text-neutral-900 shadow-xs"
                        : "text-neutral-500 hover:text-neutral-900"
                    }`}
                  >
                    Volume ($)
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMetric("margin")}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      chartMetric === "margin"
                        ? "bg-white text-neutral-900 shadow-xs"
                        : "text-neutral-500 hover:text-neutral-900"
                    }`}
                  >
                    Margin (%)
                  </button>
                </div>
              </div>
            </div>

            <div className="h-44 flex flex-col items-center justify-center text-center p-6 border border-dashed border-neutral-200/80 rounded-xl bg-neutral-50/50">
              <span className="text-xs font-semibold text-neutral-800">
                No revenue history yet
              </span>
              <span className="text-xs text-neutral-400 mt-1 max-w-sm">
                Monthly performance trends and profit margins will plot here as
                you bill clients.
              </span>
            </div>
          </div>
        );

      // 15. On-Time Collection Rate Gauge
      case "collection-rate-gauge":
        return (
          <div className="ui-card p-6 flex flex-col justify-between">
            <div className="flex justify-between items-center pb-3 mb-2 border-b border-neutral-100">
              <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">
                Collection Rate Gauge
              </h3>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                {paidRatioPct}% On-Time
              </span>
            </div>

            <div className="flex flex-col items-center justify-center py-4">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg
                  className="w-full h-full transform -rotate-90"
                  viewBox="0 0 100 100"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#e5e5e5"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#7c3aed"
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
                  <span className="font-serif text-2xl font-semibold text-neutral-900 leading-none">
                    {paidRatioPct}%
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-neutral-400 font-semibold mt-1">
                    Efficiency
                  </span>
                </div>
              </div>
            </div>

            <div className="text-center text-xs text-neutral-500 pt-2 border-t border-neutral-100">
              {paidCount} invoices collected successfully
            </div>
          </div>
        );

      // 16. Billing Alerts List
      case "billing-alerts":
        return (
          <div className="ui-card p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <TriangleAlert className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">
                    Billing Alerts
                  </h3>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    overdueInvoices.length > 0
                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                      : "bg-neutral-100 text-neutral-600 border border-neutral-200"
                  }`}
                >
                  {overdueInvoices.length} Action Req
                </span>
              </div>

              <div className="space-y-2.5">
                {overdueInvoices.length === 0 ? (
                  <div className="py-8 text-center text-xs text-neutral-400">
                    No overdue client accounts or pending billing alerts.
                  </div>
                ) : (
                  overdueInvoices.slice(0, 3).map((inv) => (
                    <div
                      key={inv.id}
                      onClick={() =>
                        onNavigateToInvoice
                          ? onNavigateToInvoice(inv.id)
                          : router.push(
                              `/invoices?invoice=${encodeURIComponent(inv.id)}`,
                            )
                      }
                      className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 hover:bg-neutral-100/80 transition-colors cursor-pointer border border-neutral-100"
                    >
                      <div>
                        <div className="text-xs font-semibold text-neutral-900">
                          {inv.clientName || "Client Account"}
                        </div>
                        <div className="text-[11px] text-rose-600 font-medium mt-0.5">
                          Due {formatDateDisplay(inv.dueDate)}
                        </div>
                      </div>
                      <div className="font-serif text-xs font-semibold text-neutral-900">
                        {formatCents(inv.amountCents, inv.currency)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
              <span>Overdue: {overdueTotalStr}</span>
              <Link
                href="/invoices"
                className="text-[#7c3aed] font-medium hover:underline"
              >
                View Invoices →
              </Link>
            </div>
          </div>
        );

      // 17. Recent Invoices
      case "recent-invoices":
        return (
          <div className="ui-card p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#7c3aed]" />
                  <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">
                    Recent Invoices & Cashflow
                  </h3>
                </div>
                <Link
                  href="/invoices"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#7c3aed] hover:underline"
                >
                  <span>View all</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="space-y-3">
                {recentInvoicesList.length === 0 ? (
                  <div className="py-10 text-center text-xs text-neutral-400">
                    No invoices generated yet.
                  </div>
                ) : (
                  recentInvoicesList.map((inv) => (
                    <div
                      key={inv.id}
                      onClick={() =>
                        onNavigateToInvoice
                          ? onNavigateToInvoice(inv.id)
                          : router.push(
                              `/invoices?invoice=${encodeURIComponent(inv.id)}`,
                            )
                      }
                      className="flex items-center justify-between p-3 rounded-xl bg-neutral-50/70 hover:bg-neutral-100/70 transition-colors cursor-pointer border border-neutral-100"
                    >
                      <div>
                        <div className="text-xs font-semibold text-neutral-900">
                          {inv.clientName}
                        </div>
                        <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                          {inv.code} · Due {formatDateDisplay(inv.dueDate)}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-serif text-sm font-semibold text-neutral-900">
                          {formatCents(inv.amountCents, inv.currency)}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            inv.status === "PAID"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                              : inv.status === "UNPAID"
                                ? "bg-amber-50 text-amber-800 border border-amber-200/60"
                                : inv.status === "DRAFT"
                                  ? "bg-neutral-100 text-neutral-600 border border-neutral-200"
                                  : "bg-rose-50 text-rose-700 border border-rose-200/60"
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

            <div className="mt-4 pt-3.5 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
              <span>Outstanding Balance: {pendingReceivablesStr}</span>
              <Link
                href="/clients"
                className="text-neutral-700 hover:text-neutral-900 font-medium"
              >
                Manage Clients →
              </Link>
            </div>
          </div>
        );

      // 18. Active Sprint Tasks
      case "sprint-tasks":
        return (
          <div className="ui-card p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <Kanban className="w-4 h-4 text-[#7c3aed]" />
                  <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">
                    Active Sprint Deliverables
                  </h3>
                </div>
                <Link
                  href="/tasks"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#7c3aed] hover:underline"
                >
                  <span>Kanban Board</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="space-y-3">
                {activeTasks.length === 0 ? (
                  <div className="py-10 text-center text-xs text-neutral-400">
                    No active sprint deliverables yet.
                  </div>
                ) : (
                  activeTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => router.push("/tasks")}
                      className="flex items-center justify-between p-3 rounded-xl bg-neutral-50/70 hover:bg-neutral-100/70 transition-colors cursor-pointer border border-neutral-100"
                    >
                      <div className="max-w-[240px] sm:max-w-xs">
                        <div className="text-xs font-semibold text-neutral-900 truncate">
                          {t.title}
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5 flex items-center gap-2">
                          <span>Owner: {t.assignee}</span>
                          <span>·</span>
                          <span>Due {t.dueDate}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {t.isOutsourced && (
                          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#ede9fe] text-[#7c3aed]">
                            <GitFork className="w-2.5 h-2.5" />
                            <span>Outsourced</span>
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${
                            t.priority === "urgent"
                              ? "bg-rose-100 text-rose-800"
                              : t.priority === "high"
                                ? "bg-orange-100 text-orange-800"
                                : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {t.priority}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 pt-3.5 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
              <span>{activeTasks.length} items in current sprint</span>
              <Link
                href="/outsourcing"
                className="text-neutral-700 hover:text-neutral-900 font-medium"
              >
                Vendor Payouts →
              </Link>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const meta = WIDGET_CATALOG.find((w) => w.id === widgetId);

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
      className={`group relative transition-all duration-200 ${
        isDraggable ? "cursor-grab active:cursor-grabbing hover:-translate-y-0.5" : ""
      }`}
    >
      {/* Subtle Drag Handle Indicator on Hover in Analytics */}
      {isDraggable && source === "analytics" && (
        <div className="absolute top-2.5 right-2.5 z-20 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1 rounded-md bg-white/80 shadow-xs border border-neutral-200/60 pointer-events-none">
          <GripVertical className="w-3.5 h-3.5 text-neutral-500" />
        </div>
      )}

      {renderContent()}
    </div>
  );
}
