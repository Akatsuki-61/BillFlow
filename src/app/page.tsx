"use client";

import {
  Button,
  PageHeader,
  SegmentedControl,
  MetricCard,
  Switch,
} from "@/components/ui/Workspace";

import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  GitFork,
  SlidersHorizontal,
  EyeOff,
  Plus,
  ArrowUpRight,
  Receipt,
  RotateCcw,
  X,
  Kanban,
} from "lucide-react";
import {
  DashboardPeriod,
  MetricTile,
  MonthlyGrowthPoint,
  DashboardTaskSummary,
} from "@/types/dashboard";
import { useDashboardSummary } from "@/lib/data/DataProvider";
import { formatCents, formatDateDisplay } from "@/lib/format";

// Monthly business growth dataset
const growthDataset: MonthlyGrowthPoint[] = [];

// Initial customizable metric tiles definition (starts blank)
const initialTiles: MetricTile[] = [
  {
    id: "total-revenue",
    label: "Total Revenue",
    description: "Gross billings recognized across all active client contracts",
    visible: true,
    category: "financial",
    values: {
      month: "$0.00",
      quarter: "$0.00",
      year: "$0.00",
      all: "$0.00",
    },
    growthRates: {
      month: { rate: "0%", isPositive: true, label: "no data" },
      quarter: { rate: "0%", isPositive: true, label: "no data" },
      year: { rate: "0%", isPositive: true, label: "no data" },
      all: { rate: "0%", isPositive: true, label: "no data" },
    },
    accentColor: "text-neutral-900",
    pillBg: "bg-neutral-100 text-neutral-700 border-neutral-200/60",
  },
  {
    id: "net-profit",
    label: "Net Profit & Margin",
    description: "Net earnings after contractor payouts, software and expenses",
    visible: true,
    category: "financial",
    values: {
      month: "$0.00",
      quarter: "$0.00",
      year: "$0.00",
      all: "$0.00",
    },
    growthRates: {
      month: { rate: "0%", isPositive: true, label: "no data" },
      quarter: { rate: "0%", isPositive: true, label: "no data" },
      year: { rate: "0%", isPositive: true, label: "no data" },
      all: { rate: "0%", isPositive: true, label: "no data" },
    },
    accentColor: "text-[#7c3aed]",
    pillBg: "bg-purple-50 text-purple-700 border-purple-200/60",
  },
  {
    id: "pending-receivables",
    label: "Pending Receivables",
    description: "Outstanding invoice amounts awaiting client remittance",
    visible: true,
    category: "financial",
    values: {
      month: "$0.00",
      quarter: "$0.00",
      year: "$0.00",
      all: "$0.00",
    },
    growthRates: {
      month: { rate: "0 pending", isPositive: true, label: "no unpaid" },
      quarter: { rate: "0 pending", isPositive: true, label: "no unpaid" },
      year: { rate: "0 pending", isPositive: true, label: "no unpaid" },
      all: { rate: "0 pending", isPositive: true, label: "no unpaid" },
    },
    accentColor: "text-amber-700",
    pillBg: "bg-amber-50 text-amber-800 border-amber-200/60",
  },
  {
    id: "active-clients",
    label: "Active Client Accounts",
    description: "Retainers, enterprise accounts, and project-based clients",
    visible: true,
    category: "clients",
    values: {
      month: "0",
      quarter: "0",
      year: "0",
      all: "0",
    },
    growthRates: {
      month: { rate: "0", isPositive: true, label: "clients" },
      quarter: { rate: "0", isPositive: true, label: "clients" },
      year: { rate: "0", isPositive: true, label: "clients" },
      all: { rate: "0", isPositive: true, label: "clients" },
    },
    accentColor: "text-neutral-900",
    pillBg: "bg-blue-50 text-blue-700 border-blue-200/60",
  },
  {
    id: "outsourced-costs",
    label: "Subcontractor Outsource Costs",
    description: "Allocated balances and payouts to outsourced vendors",
    visible: true,
    category: "operations",
    values: {
      month: "$0.00",
      quarter: "$0.00",
      year: "$0.00",
      all: "$0.00",
    },
    growthRates: {
      month: {
        rate: "0 vendors",
        isPositive: true,
        label: "active contractors",
      },
      quarter: {
        rate: "0 vendors",
        isPositive: true,
        label: "active contractors",
      },
      year: { rate: "0%", isPositive: true, label: "no data" },
      all: { rate: "0%", isPositive: true, label: "no data" },
    },
    accentColor: "text-purple-700",
    pillBg: "bg-purple-50 text-purple-700 border-purple-200/60",
  },
  {
    id: "operating-expenses",
    label: "Operating Expenses",
    description: "Software tools, cloud infrastructure, hardware, and travel",
    visible: true,
    category: "operations",
    values: {
      month: "$0.00",
      quarter: "$0.00",
      year: "$0.00",
      all: "$0.00",
    },
    growthRates: {
      month: { rate: "0%", isPositive: true, label: "no data" },
      quarter: { rate: "0%", isPositive: true, label: "no data" },
      year: { rate: "0%", isPositive: true, label: "no data" },
      all: { rate: "0%", isPositive: true, label: "no data" },
    },
    accentColor: "text-neutral-900",
    pillBg: "bg-neutral-100 text-neutral-700 border-neutral-200/60",
  },
];

// Active deliverables from Kanban
const activeTasks: DashboardTaskSummary[] = [];

export default function DashboardPage() {
  const router = useRouter();
  const { dashboard } = useDashboardSummary();

  // State
  const [period, setPeriod] = useState<DashboardPeriod>("quarter");
  const [chartMetric, setChartMetric] = useState<"profit" | "margin">("profit");
  const [tiles, setTiles] = useState<MetricTile[]>(initialTiles);
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  // Toggle individual tile visibility
  const handleToggleTile = (id: string) => {
    setTiles((prev) =>
      prev.map((tile) =>
        tile.id === id ? { ...tile, visible: !tile.visible } : tile,
      ),
    );
  };

  // Show all tiles
  const handleShowAll = () => {
    setTiles((prev) => prev.map((t) => ({ ...t, visible: true })));
    showToast("All dashboard tiles enabled");
  };

  // Reset to default visibility
  const handleResetTiles = () => {
    setTiles(initialTiles);
    showToast("Dashboard tiles reset to default");
  };

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
  const activeClientsCount = dashboard?.activeClients ?? 0;
  const unpaidCount = dashboard?.unpaidCount ?? 0;
  const recentInvoicesList = dashboard?.recentInvoices ?? [];

  // Visible tiles list computed with live metrics
  const computedTiles = useMemo(() => {
    return tiles.map((tile) => {
      if (tile.id === "total-revenue") {
        return {
          ...tile,
          values: {
            month: totalRevenueStr,
            quarter: totalRevenueStr,
            year: totalRevenueStr,
            all: totalRevenueStr,
          },
          growthRates: {
            month: {
              rate: totalRevenueStr !== "$0.00" ? "Active" : "0%",
              isPositive: true,
              label: "billed to date",
            },
            quarter: {
              rate: totalRevenueStr !== "$0.00" ? "Active" : "0%",
              isPositive: true,
              label: "billed to date",
            },
            year: {
              rate: totalRevenueStr !== "$0.00" ? "Active" : "0%",
              isPositive: true,
              label: "billed to date",
            },
            all: {
              rate: totalRevenueStr !== "$0.00" ? "Active" : "0%",
              isPositive: true,
              label: "billed to date",
            },
          },
        };
      }
      if (tile.id === "net-profit") {
        return {
          ...tile,
          values: {
            month: totalRevenueStr,
            quarter: totalRevenueStr,
            year: totalRevenueStr,
            all: totalRevenueStr,
          },
        };
      }
      if (tile.id === "pending-receivables") {
        return {
          ...tile,
          values: {
            month: pendingReceivablesStr,
            quarter: pendingReceivablesStr,
            year: pendingReceivablesStr,
            all: pendingReceivablesStr,
          },
          growthRates: {
            month: {
              rate: `${unpaidCount} pending`,
              isPositive: unpaidCount === 0,
              label:
                unpaidCount === 1
                  ? "invoice awaiting payment"
                  : "invoices awaiting payment",
            },
            quarter: {
              rate: `${unpaidCount} pending`,
              isPositive: unpaidCount === 0,
              label:
                unpaidCount === 1
                  ? "invoice awaiting payment"
                  : "invoices awaiting payment",
            },
            year: {
              rate: `${unpaidCount} pending`,
              isPositive: unpaidCount === 0,
              label:
                unpaidCount === 1
                  ? "invoice awaiting payment"
                  : "invoices awaiting payment",
            },
            all: {
              rate: `${unpaidCount} pending`,
              isPositive: unpaidCount === 0,
              label:
                unpaidCount === 1
                  ? "invoice awaiting payment"
                  : "invoices awaiting payment",
            },
          },
        };
      }
      if (tile.id === "active-clients") {
        return {
          ...tile,
          values: {
            month: String(activeClientsCount),
            quarter: String(activeClientsCount),
            year: String(activeClientsCount),
            all: String(activeClientsCount),
          },
          growthRates: {
            month: {
              rate: String(activeClientsCount),
              isPositive: true,
              label:
                activeClientsCount === 1 ? "client account" : "client accounts",
            },
            quarter: {
              rate: String(activeClientsCount),
              isPositive: true,
              label:
                activeClientsCount === 1 ? "client account" : "client accounts",
            },
            year: {
              rate: String(activeClientsCount),
              isPositive: true,
              label:
                activeClientsCount === 1 ? "client account" : "client accounts",
            },
            all: {
              rate: String(activeClientsCount),
              isPositive: true,
              label:
                activeClientsCount === 1 ? "client account" : "client accounts",
            },
          },
        };
      }
      return tile;
    });
  }, [
    tiles,
    totalRevenueStr,
    pendingReceivablesStr,
    activeClientsCount,
    unpaidCount,
  ]);

  const visibleTiles = useMemo(
    () => computedTiles.filter((t) => t.visible),
    [computedTiles],
  );

  // Scaled max for growth bar chart
  const maxRevenue = Math.max(...growthDataset.map((d) => d.revenue));

  // Quick period labels
  const periodLabelMap: Record<DashboardPeriod, string> = {
    month: "This Month",
    quarter: "This Quarter",
    year: "Year to Date",
    all: "All Time",
  };

  return (
    <div className="workspace-page motion-page">
      {/* Toast Notification */}
      <MotionPresence>
        {toastMessage && (
          <MotionSurface
            kind="toast"
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-neutral-900 text-white text-sm font-medium rounded-xl shadow-[0_12px_24px_-6px_rgba(0,0,0,0.25)] border border-neutral-800 transition-all"
          >
            <div className="w-2 h-2 rounded-full bg-[#7c3aed] animate-ping" />
            <span>{toastMessage}</span>
            <Button
              aria-label="Close"
              variant="ghost"
              size="icon"
              onClick={() => setToastMessage(null)}
              className="ml-2"
            >
              <X className="w-4 h-4" />
            </Button>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Header Section matching Clients & Tasks page alignment */}
      <PageHeader
        title="Dashboard"
        description="Welcome back. Here is your business health, profit growth, and operations summary."
      >
        {/* Right Corner Controls: Period Switcher & Customize Tiles */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <SegmentedControl
            value={period}
            onChange={setPeriod}
            label="Dashboard period"
            options={(
              ["month", "quarter", "year", "all"] as DashboardPeriod[]
            ).map((value) => ({
              value,
              label:
                value === "all"
                  ? "All"
                  : value[0].toUpperCase() + value.slice(1),
            }))}
          />

          {/* Customize Tiles Button */}
          <Button
            variant="secondary"
            onClick={() => setIsCustomizeModalOpen(true)}

            title="Choose which tiles to show or hide"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#7c3aed]" />
            <span>Customize Tiles</span>
          </Button>

          {/* Create Invoice Primary Action */}
          <Button variant="primary" onClick={() => router.push("/invoices")}>
            <Plus className="w-3.5 h-3.5 transition-transform duration-200 group-hover:rotate-6" />
            <span>New Invoice</span>
          </Button>
        </div>
      </PageHeader>

      {/* Customizable Metric Analytics Tiles */}
      <div>
        <div className="flex items-center justify-between mb-3 text-xs text-neutral-500 font-medium">
          <span>Key Business Metrics ({periodLabelMap[period]})</span>
          <span className="text-[11px] text-neutral-400">
            Showing {visibleTiles.length} of {tiles.length} tiles · Click
            &ldquo;Customize Tiles&rdquo; to edit
          </span>
        </div>

        {visibleTiles.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-neutral-300">
            <EyeOff className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-neutral-800">
              All analytics tiles are currently hidden
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              Re-enable them to monitor your business KPIs.
            </p>
            <Button variant="primary" onClick={handleShowAll} className="mt-3">
              Show All Tiles
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleTiles.map((tile) => {
              const value = tile.values[period];
              const growth = tile.growthRates[period];

              return (
                <MetricCard
                  key={tile.id}
                  label={tile.label}
                  value={value}
                  tone={
                    tile.id === "pending-receivables"
                      ? "warning"
                      : tile.id === "net-profit"
                        ? "accent"
                        : "default"
                  }
                  action={
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleToggleTile(tile.id)}
                      title={`Hide ${tile.label}`}
                    >
                      <EyeOff />
                    </Button>
                  }
                  footer={
                    <>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${tile.pillBg}`}
                      >
                        {growth.isPositive && (
                          <TrendingUp className="w-3 h-3" />
                        )}
                        {growth.rate}
                      </span>
                      <span>{growth.label}</span>
                    </>
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Business Growth & Profit Trajectory Section */}
      <div className="ui-card p-6 space-y-6">
        {/* Chart Header & Trajectory Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-serif font-semibold text-neutral-900 tracking-tight">
                Business & Profit Growth Trajectory
              </h2>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Month-over-month revenue intake and net retained profits.
            </p>
          </div>

          {/* Metric Switcher */}
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

            <SegmentedControl
              value={chartMetric}
              onChange={setChartMetric}
              label="Growth chart metric"
              options={[
                { value: "profit", label: "Volume ($)" },
                { value: "margin", label: "Margin (%)" },
              ]}
            />
          </div>
        </div>

        {/* Growth Bar Chart Visualization */}
        <div className="pt-2">
          {growthDataset.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-center p-6 border border-dashed border-neutral-200/80 rounded-xl bg-neutral-50/50">
              <span className="text-xs font-semibold text-neutral-800">
                No revenue history yet
              </span>
              <span className="text-xs text-neutral-400 mt-1 max-w-sm">
                Monthly performance trends and profit margins will plot here as
                you bill clients.
              </span>
            </div>
          ) : chartMetric === "profit" ? (
            <div className="grid grid-cols-6 gap-3 sm:gap-6 items-end h-56 pt-6 pb-2">
              {growthDataset.map((point) => {
                const revenueHeight = Math.round(
                  (point.revenue / maxRevenue) * 100,
                );
                const profitHeight = Math.round(
                  (point.profit / maxRevenue) * 100,
                );

                return (
                  <div
                    key={point.month}
                    className="flex flex-col items-center h-full justify-end group cursor-pointer"
                  >
                    {/* Hover Value Popover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 mb-2 px-2 py-1 bg-neutral-900 text-white rounded text-[10px] font-mono whitespace-nowrap pointer-events-none shadow-md">
                      ${point.revenue.toLocaleString()} / $
                      {point.profit.toLocaleString()}
                    </div>

                    {/* Dual Column Bars */}
                    <div className="w-full flex items-end justify-center gap-1.5 sm:gap-2 h-44">
                      {/* Revenue Bar */}
                      <div
                        className="w-1/2 max-w-[26px] bg-[#7c3aed]/85 group-hover:bg-[#7c3aed] rounded-t-md transition-all duration-300"
                        style={{ height: `${revenueHeight}%` }}
                        title={`Revenue: $${point.revenue.toLocaleString()}`}
                      />
                      {/* Net Profit Bar */}
                      <div
                        className="w-1/2 max-w-[26px] bg-[#10b981]/85 group-hover:bg-[#10b981] rounded-t-md transition-all duration-300"
                        style={{ height: `${profitHeight}%` }}
                        title={`Net Profit: $${point.profit.toLocaleString()}`}
                      />
                    </div>

                    {/* Month Label */}
                    <div className="mt-3 text-xs font-semibold text-neutral-500 group-hover:text-neutral-900 transition-colors">
                      {point.month}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Profit Margin % Trend */
            <div className="grid grid-cols-6 gap-3 sm:gap-6 items-end h-56 pt-6 pb-2">
              {growthDataset.map((point) => {
                const marginHeight = Math.round((point.margin / 100) * 100);

                return (
                  <div
                    key={point.month}
                    className="flex flex-col items-center h-full justify-end group cursor-pointer"
                  >
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 mb-2 px-2 py-1 bg-neutral-900 text-white rounded text-[10px] font-mono whitespace-nowrap pointer-events-none shadow-md">
                      {point.margin.toFixed(1)}% profit margin
                    </div>

                    <div className="w-full flex items-end justify-center h-44">
                      <div
                        className="w-full max-w-[42px] bg-emerald-500/80 group-hover:bg-emerald-600 rounded-t-md transition-all duration-300 flex items-center justify-center text-[10px] font-bold text-white pb-1"
                        style={{ height: `${marginHeight}%` }}
                      >
                        {point.margin.toFixed(0)}%
                      </div>
                    </div>

                    <div className="mt-3 text-xs font-semibold text-neutral-500 group-hover:text-neutral-900 transition-colors">
                      {point.month}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cross-Module Operations Grid: Recent Invoices & Active Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Recent Client Invoices */}
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
                      router.push(
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

        {/* Right Column: Active Sprint Deliverables & Outsourcing */}
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
      </div>

      {/* CUSTOMIZE METRICS MODAL */}
      <MotionPresence>
        {isCustomizeModalOpen && (
          <MotionSurface
            kind="dialog"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-xs"
          >
            <MotionSurface onDismiss={() => setIsCustomizeModalOpen(false)}
              kind="panel"
              className="bg-white rounded-2xl w-full max-w-lg shadow-[0_24px_48px_-12px_rgba(0,0,0,0.25)] border border-neutral-200 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-serif font-semibold text-neutral-900">
                    Customize Dashboard Analytics
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Select which financial and operational metric tiles appear
                    on your executive dashboard.
                  </p>
                </div>
                <Button
                  aria-label="Close"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsCustomizeModalOpen(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Tile Toggle List */}
              <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto divide-y divide-neutral-100">
                {tiles.map((tile) => (
                  <div
                    key={tile.id}
                    className="pt-3 first:pt-0 flex items-center justify-between gap-4 group"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-neutral-900 group-hover:text-[#7c3aed] transition-colors">
                          {tile.label}
                        </span>
                        <span className="text-[10px] font-medium uppercase px-1.5 py-0.5 bg-neutral-100 text-neutral-600 rounded">
                          {tile.category}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {tile.description}
                      </p>
                    </div>

                    <Switch
                      checked={tile.visible}
                      onChange={() => handleToggleTile(tile.id)}
                      label={`Show ${tile.label}`}
                    />
                  </div>
                ))}
              </div>

              {/* Modal Actions */}
              <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={handleResetTiles}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to Default</span>
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={handleShowAll}
                  >
                    Show All
                  </Button>
                  <Button
                    variant="primary"
                    type="button"
                    onClick={() => {
                      setIsCustomizeModalOpen(false);
                      showToast("Dashboard preferences updated");
                    }}
                  >
                    Done
                  </Button>
                </div>
              </div>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>
    </div>
  );
}
