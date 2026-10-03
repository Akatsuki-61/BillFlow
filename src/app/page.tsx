"use client";

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
  DashboardInvoiceSummary,
  DashboardTaskSummary,
} from "@/types/dashboard";

// Sample monthly business growth dataset
const growthDataset: MonthlyGrowthPoint[] = [
  { month: "May", revenue: 28500, profit: 19800, expenses: 8700, margin: 69.5 },
  { month: "Jun", revenue: 34200, profit: 24600, expenses: 9600, margin: 71.9 },
  { month: "Jul", revenue: 31800, profit: 22100, expenses: 9700, margin: 69.5 },
  { month: "Aug", revenue: 41500, profit: 30200, expenses: 11300, margin: 72.8 },
  { month: "Sep", revenue: 46800, profit: 34900, expenses: 11900, margin: 74.6 },
  { month: "Oct", revenue: 52400, profit: 39800, expenses: 12600, margin: 76.0 },
];

// Initial customizable metric tiles definition
const initialTiles: MetricTile[] = [
  {
    id: "total-revenue",
    label: "Total Revenue",
    description: "Gross billings recognized across all active client contracts",
    visible: true,
    category: "financial",
    values: {
      month: "$52,400.00",
      quarter: "$140,700.00",
      year: "$385,200.00",
      all: "$512,850.00",
    },
    growthRates: {
      month: { rate: "+12.0%", isPositive: true, label: "vs last month" },
      quarter: { rate: "+18.4%", isPositive: true, label: "vs prior quarter" },
      year: { rate: "+34.2%", isPositive: true, label: "YoY growth" },
      all: { rate: "+45.0%", isPositive: true, label: "lifetime" },
    },
    accentColor: "text-neutral-900",
    pillBg: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  },
  {
    id: "net-profit",
    label: "Net Profit & Margin",
    description: "Net earnings after contractor payouts, software and expenses",
    visible: true,
    category: "financial",
    values: {
      month: "$39,800.00",
      quarter: "$105,400.00",
      year: "$286,100.00",
      all: "$378,500.00",
    },
    growthRates: {
      month: { rate: "+14.1%", isPositive: true, label: "76.0% margin" },
      quarter: { rate: "+22.1%", isPositive: true, label: "74.9% margin" },
      year: { rate: "+28.6%", isPositive: true, label: "74.3% margin" },
      all: { rate: "+31.2%", isPositive: true, label: "73.8% margin" },
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
      month: "$14,200.00",
      quarter: "$42,850.00",
      year: "$42,850.00",
      all: "$42,850.00",
    },
    growthRates: {
      month: { rate: "4 unpaid", isPositive: false, label: "invoices pending" },
      quarter: { rate: "6 unpaid", isPositive: false, label: "invoices pending" },
      year: { rate: "6 unpaid", isPositive: false, label: "invoices pending" },
      all: { rate: "6 unpaid", isPositive: false, label: "invoices pending" },
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
      month: "14",
      quarter: "14",
      year: "22",
      all: "31",
    },
    growthRates: {
      month: { rate: "+2 new", isPositive: true, label: "onboarded this month" },
      quarter: { rate: "+5 new", isPositive: true, label: "onboarded in Q3" },
      year: { rate: "+12 new", isPositive: true, label: "this year" },
      all: { rate: "100%", isPositive: true, label: "retention rate" },
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
      month: "$4,500.00",
      quarter: "$11,700.00",
      year: "$32,800.00",
      all: "$48,200.00",
    },
    growthRates: {
      month: { rate: "3 vendors", isPositive: true, label: "active contractors" },
      quarter: { rate: "3 vendors", isPositive: true, label: "active contractors" },
      year: { rate: "+8.4%", isPositive: true, label: "budget efficiency" },
      all: { rate: "12%", isPositive: true, label: "of total revenue" },
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
      month: "$3,650.00",
      quarter: "$8,940.00",
      year: "$24,500.00",
      all: "$35,900.00",
    },
    growthRates: {
      month: { rate: "-4.2%", isPositive: true, label: "spend reduction" },
      quarter: { rate: "100%", isPositive: true, label: "tax deductible" },
      year: { rate: "-6.1%", isPositive: true, label: "operational savings" },
      all: { rate: "8.5%", isPositive: true, label: "overhead ratio" },
    },
    accentColor: "text-neutral-900",
    pillBg: "bg-neutral-100 text-neutral-700 border-neutral-200/60",
  },
];

// Sample latest invoices for dashboard summary
const recentInvoices: DashboardInvoiceSummary[] = [
  { id: "inv-1", code: "INV-2023-089", client: "Globex Corporation", amount: "$12,450.00", status: "PENDING", dueDate: "Oct 15, 2026" },
  { id: "inv-2", code: "INV-2023-084", client: "Nexus Tech", amount: "$5,700.00", status: "PAID", dueDate: "Oct 02, 2026" },
  { id: "inv-3", code: "INV-2023-075", client: "Vanguard Media", amount: "$2,000.00", status: "PENDING", dueDate: "Oct 10, 2026" },
  { id: "inv-4", code: "INV-2023-066", client: "Apex Architecture", amount: "$14,500.00", status: "PAID", dueDate: "Sep 28, 2026" },
];

// Sample active deliverables from Kanban
const activeTasks: DashboardTaskSummary[] = [
  { id: "task-101", title: "Configure AWS ECS Fargate Cluster & CI/CD Pipeline", priority: "high", assignee: "Nipun Y.", dueDate: "Oct 05", isOutsourced: true },
  { id: "task-102", title: "Client Contract Terms & IP Assignment Review", priority: "urgent", assignee: "Lahiru K.", dueDate: "Oct 04", isOutsourced: true },
  { id: "task-104", title: "Build Multi-Currency Invoice Generator & PDF Export", priority: "high", assignee: "Sandika M.", dueDate: "Oct 06", isOutsourced: false },
  { id: "task-103", title: "Design System & Figma Component Audit", priority: "medium", assignee: "Binuka M.", dueDate: "Oct 03", isOutsourced: false },
];

export default function DashboardPage() {
  const router = useRouter();

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
        tile.id === id ? { ...tile, visible: !tile.visible } : tile
      )
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

  // Visible tiles list
  const visibleTiles = useMemo(() => tiles.filter((t) => t.visible), [tiles]);

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
    <div className="p-8 lg:p-10 max-w-7xl mx-auto space-y-8 animate-fadeIn select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-neutral-900 text-white text-sm font-medium rounded-xl shadow-[0_12px_24px_-6px_rgba(0,0,0,0.25)] border border-neutral-800 transition-all duration-300 animate-in fade-in slide-in-from-bottom-3">
          <div className="w-2 h-2 rounded-full bg-[#7c3aed] animate-ping" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-neutral-400 hover:text-white ml-2 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Section matching Clients & Tasks page alignment */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-[42px] font-serif font-normal text-neutral-900 tracking-tight leading-none">
            Dashboard
          </h1>
          <p className="text-sm text-neutral-500 mt-2 font-normal">
            Welcome back. Here is your business health, profit growth, and operations summary.
          </p>
        </div>

        {/* Right Corner Controls: Period Switcher & Customize Tiles */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Period Segmented Switcher */}
          <div className="flex items-center p-1 bg-neutral-200/70 rounded-xl text-neutral-600 text-xs font-medium">
            {(["month", "quarter", "year", "all"] as DashboardPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg transition-all capitalize cursor-pointer ${
                  period === p
                    ? "bg-white text-neutral-900 shadow-xs font-semibold"
                    : "hover:text-neutral-900"
                }`}
              >
                {p === "all" ? "All" : p}
              </button>
            ))}
          </div>

          {/* Customize Tiles Button */}
          <button
            onClick={() => setIsCustomizeModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-neutral-200/90 rounded-xl text-xs font-medium text-neutral-700 shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.04)] hover:bg-neutral-50 hover:text-neutral-950 transition-all cursor-pointer"
            title="Choose which tiles to show or hide"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#7c3aed]" />
            <span>Customize Tiles</span>
          </button>

          {/* Create Invoice Primary Action */}
          <button
            onClick={() => router.push("/invoices")}
            className="group inline-flex items-center gap-1.5 px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-xl text-xs font-medium shadow-[0px_2px_4px_rgba(124,58,237,0.25)] hover:shadow-[0px_4px_8px_rgba(124,58,237,0.35)] transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 transition-transform duration-200 group-hover:rotate-90" />
            <span>New Invoice</span>
          </button>
        </div>
      </div>

      {/* Customizable Metric Analytics Tiles */}
      <div>
        <div className="flex items-center justify-between mb-3 text-xs text-neutral-500 font-medium">
          <span>Key Business Metrics ({periodLabelMap[period]})</span>
          <span className="text-[11px] text-neutral-400">
            Showing {visibleTiles.length} of {tiles.length} tiles · Click &ldquo;Customize Tiles&rdquo; to edit
          </span>
        </div>

        {visibleTiles.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-neutral-300">
            <EyeOff className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-neutral-800">All analytics tiles are currently hidden</p>
            <p className="text-xs text-neutral-500 mt-1">Re-enable them to monitor your business KPIs.</p>
            <button
              onClick={handleShowAll}
              className="mt-3 px-4 py-1.5 bg-[#7c3aed] text-white text-xs font-medium rounded-lg hover:bg-[#6d28d9] transition-all cursor-pointer"
            >
              Show All Tiles
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleTiles.map((tile) => {
              const value = tile.values[period];
              const growth = tile.growthRates[period];

              return (
                <div
                  key={tile.id}
                  className="group relative bg-[#ececf0] hover:bg-[#eaeaf0] transition-all duration-200 rounded-2xl p-5 border border-neutral-200/70 shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.04)] flex flex-col justify-between min-h-[142px]"
                >
                  {/* Top Row: Label & Quick Hide Action */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                      {tile.label}
                    </span>

                    <button
                      onClick={() => handleToggleTile(tile.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-neutral-700 transition-opacity cursor-pointer rounded-md hover:bg-neutral-200/60"
                      title="Hide this tile"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Middle: Big Figure */}
                  <div className="my-2">
                    <div className={`font-serif text-3xl md:text-[34px] font-normal tracking-tight leading-none ${tile.accentColor}`}>
                      {value}
                    </div>
                  </div>

                  {/* Bottom: Growth Indicator & Subtitle */}
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-neutral-200/60">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${tile.pillBg}`}>
                      {growth.isPositive && <TrendingUp className="w-3 h-3" />}
                      <span>{growth.rate}</span>
                    </span>
                    <span className="text-[11px] text-neutral-500 font-normal truncate max-w-[140px]">
                      {growth.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Business Growth & Profit Trajectory Section */}
      <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.04)] space-y-6">
        {/* Chart Header & Trajectory Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-serif font-semibold text-neutral-900 tracking-tight">
                Business & Profit Growth Trajectory
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                +76% Margin
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Month-over-month revenue intake vs net retained profits (May – Oct 2026).
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

            <div className="p-1 bg-neutral-100 rounded-lg text-xs font-medium text-neutral-600 flex items-center">
              <button
                onClick={() => setChartMetric("profit")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  chartMetric === "profit" ? "bg-white text-neutral-900 font-semibold shadow-xs" : "hover:text-neutral-900"
                }`}
              >
                Volume ($)
              </button>
              <button
                onClick={() => setChartMetric("margin")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  chartMetric === "margin" ? "bg-white text-neutral-900 font-semibold shadow-xs" : "hover:text-neutral-900"
                }`}
              >
                Margin (%)
              </button>
            </div>
          </div>
        </div>

        {/* Growth Bar Chart Visualization */}
        <div className="pt-2">
          {chartMetric === "profit" ? (
            <div className="grid grid-cols-6 gap-3 sm:gap-6 items-end h-56 pt-6 pb-2">
              {growthDataset.map((point) => {
                const revenueHeight = Math.round((point.revenue / maxRevenue) * 100);
                const profitHeight = Math.round((point.profit / maxRevenue) * 100);

                return (
                  <div key={point.month} className="flex flex-col items-center h-full justify-end group cursor-pointer">
                    {/* Hover Value Popover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 mb-2 px-2 py-1 bg-neutral-900 text-white rounded text-[10px] font-mono whitespace-nowrap pointer-events-none shadow-md">
                      ${point.revenue.toLocaleString()} / ${point.profit.toLocaleString()}
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
                  <div key={point.month} className="flex flex-col items-center h-full justify-end group cursor-pointer">
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
        <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.04)] flex flex-col justify-between">
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
              {recentInvoices.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => router.push("/invoices")}
                  className="flex items-center justify-between p-3 rounded-xl bg-neutral-50/70 hover:bg-neutral-100/70 transition-colors cursor-pointer border border-neutral-100"
                >
                  <div>
                    <div className="text-xs font-semibold text-neutral-900">{inv.client}</div>
                    <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                      {inv.code} · Due {inv.dueDate}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-serif text-sm font-semibold text-neutral-900">
                      {inv.amount}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        inv.status === "PAID"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                          : inv.status === "PENDING"
                          ? "bg-amber-50 text-amber-800 border border-amber-200/60"
                          : "bg-rose-50 text-rose-700 border border-rose-200/60"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3.5 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
            <span>Outstanding Balance: $14,450.00</span>
            <Link href="/clients" className="text-neutral-700 hover:text-neutral-900 font-medium">
              Manage Clients →
            </Link>
          </div>
        </div>

        {/* Right Column: Active Sprint Deliverables & Outsourcing */}
        <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.04)] flex flex-col justify-between">
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
              {activeTasks.map((t) => (
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
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3.5 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
            <span>4 items in current sprint</span>
            <Link href="/outsourcing" className="text-neutral-700 hover:text-neutral-900 font-medium">
              Vendor Payouts →
            </Link>
          </div>
        </div>
      </div>

      {/* CUSTOMIZE METRICS MODAL */}
      {isCustomizeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-[0_24px_48px_-12px_rgba(0,0,0,0.25)] border border-neutral-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-serif font-semibold text-neutral-900">
                  Customize Dashboard Analytics
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Select which financial and operational metric tiles appear on your executive dashboard.
                </p>
              </div>
              <button
                onClick={() => setIsCustomizeModalOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tile Toggle List */}
            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto divide-y divide-neutral-100">
              {tiles.map((tile) => (
                <div
                  key={tile.id}
                  onClick={() => handleToggleTile(tile.id)}
                  className="pt-3 first:pt-0 flex items-center justify-between gap-4 cursor-pointer group"
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

                  {/* Toggle Switch */}
                  <div
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      tile.visible ? "bg-[#7c3aed]" : "bg-neutral-200"
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        tile.visible ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetTiles}
                className="inline-flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-900 font-medium cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Default</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleShowAll}
                  className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  Show All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomizeModalOpen(false);
                    showToast("Dashboard preferences updated");
                  }}
                  className="px-4 py-1.5 rounded-lg bg-[#7c3aed] text-white text-xs font-semibold hover:bg-[#6d28d9] transition-all cursor-pointer shadow-2xs"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
