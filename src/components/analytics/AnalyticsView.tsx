"use client";

import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  MoreVertical,
  TriangleAlert,
  X,
} from "lucide-react";

import {
  Button,
  PageHeader,
  SegmentedControl,
  MetricCard,
  EmptyState,
} from "@/components/ui/Workspace";

import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";

import React, { useState } from "react";

import {
  Timeframe,
  BillingAlertItem,
  MonthlyFinancial,
} from "@/types/analytics";

// Monthly financial dataset starts blank
const monthlyData: MonthlyFinancial[] = [];

// Billing alerts data starts blank
const initialAlerts: BillingAlertItem[] = [];

const quarterOptions = Array.from({ length: 4 }, (_, offset) => {
  const date = new Date();
  const quarterIndex =
    date.getFullYear() * 4 + Math.floor(date.getMonth() / 3) - offset;
  return `Q${(quarterIndex % 4) + 1} ${Math.floor(quarterIndex / 4)}`;
});

export default function AnalyticsView() {
  // Selected timeframe filter state: Month, Quarter, or Year
  const [timeframe, setTimeframe] = useState<Timeframe>("Quarter");

  // Selected date quarter state
  const [selectedQuarter, setSelectedQuarter] = useState(quarterOptions[0]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Billing alerts state
  const [alerts] = useState<BillingAlertItem[]>(initialAlerts);

  // Modals state
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Toast notification feedback state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Show auto-dismissing toast feedback
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Dispatch payment reminder to client
  const handleSendReminder = (clientName: string) => {
    showToast(`Payment reminder dispatched to ${clientName}`);
  };

  // Max revenue reference for bar height scaling (2.0M corresponds to 100%)
  const maxScale = 2.0;

  return (
    <div className="workspace-page motion-page">
      {/* Toast Feedback Notification */}
      <MotionPresence>
        {toastMessage && (
          <MotionSurface
            kind="toast"
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 bg-[#18181b] text-white rounded-xl shadow-lg text-[12px] font-medium"
          >
            <CheckCircle2 className="text-[#34d399] text-[13px]" />
            <span>{toastMessage}</span>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Top Header: Title, subtitle, timeframe toggle and date range picker */}
      <PageHeader
        title="Analytics"
        description="Review revenue, expenses, and invoice collection trends."
      >
        {/* Header Controls: Timeframe segmented toggle and quarter dropdown */}
        <div className="flex items-center gap-3">
          <SegmentedControl
            value={timeframe}
            onChange={setTimeframe}
            label="Analytics period"
            options={(["Month", "Quarter", "Year"] as Timeframe[]).map(
              (value) => ({ value, label: value }),
            )}
          />

          {/* Date range dropdown button */}
          <div className="relative">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              aria-expanded={isDropdownOpen}
            >
              <CalendarDays className="text-[11px] text-[#6b7280]" />
              <span>{selectedQuarter}</span>
              <ChevronDown className="motion-chevron text-[9px] text-[#9ca3af] ml-0.5" />
            </Button>

            {/* Dropdown menu */}
            <MotionPresence>
              {isDropdownOpen && (
                <MotionSurface
                  kind="menu"
                  className="absolute right-0 mt-1.5 w-36 bg-[#faf9f5] border border-[#dcdcd7] rounded-xl shadow-lg z-20 py-1 overflow-hidden"
                >
                  {quarterOptions.map((q) => (
                    <Button
                      variant="menu"
                      aria-pressed={selectedQuarter === q}
                      key={q}
                      type="button"
                      onClick={() => {
                        setSelectedQuarter(q);
                        setIsDropdownOpen(false);
                        showToast(`Filtered to ${q}`);
                      }}
                    >
                      {q}
                    </Button>
                  ))}
                </MotionSurface>
              )}
            </MotionPresence>
          </div>
        </div>
      </PageHeader>

      {/* Main Analytics Grid matching Figma Design 2.0 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-7">
        {/* Left Section (2 Columns): Net Profit, Paid Ratio & Revenue vs Expenses Chart */}
        <div className="lg:col-span-2 space-y-5">
          {/* Row 1: KPI Cards (Net Profit + Paid Ratio) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <MetricCard
              label="Net Profit"
              value="—"
              footer={
                <>
                  <span>No financial history yet</span>
                  <Button
                    variant="ghost"
                    size="small"
                    onClick={() => setIsDetailsModalOpen(true)}
                  >
                    Details →
                  </Button>
                </>
              }
            />
            <MetricCard
              label="Paid Ratio"
              value="—"
              tone="accent"
              footer="No billing history yet"
            />
          </div>

          {/* Row 2: Revenue vs Expenses Chart Card */}
          <div className="ui-card p-6">
            {/* Chart Title and Header Actions */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-newspaper text-[17px] font-normal text-[#111827] tracking-tight">
                Revenue vs Expenses
              </h2>
              <Button
                variant="ghost"
                size="icon"
                type="button"

                title="Chart options"
              >
                <MoreVertical className="text-[13px]" />
              </Button>
            </div>

            {/* Grouped Paired Bar Chart Visualization */}
            <div className="relative pt-2 pb-2">
              {monthlyData.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center p-6 border border-dashed border-[#deded8] rounded-xl bg-white/40">
                  <span className="text-xs font-semibold text-neutral-800">
                    No financial data yet
                  </span>
                  <span className="text-xs text-neutral-400 mt-1 max-w-sm">
                    Monthly cashflow and expense analytics will plot here as
                    transactions are recorded.
                  </span>
                </div>
              ) : (
                <>
                  {/* Y-Axis Horizontal Gridlines & Labels */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pr-2">
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-[9.5px] text-[#9ca3af] font-medium w-8">
                        $2M
                      </span>
                      <div className="flex-1 border-b border-[#deded8] border-dashed" />
                    </div>
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-[9.5px] text-[#9ca3af] font-medium w-8">
                        $1M
                      </span>
                      <div className="flex-1 border-b border-[#deded8] border-dashed" />
                    </div>
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-[9.5px] text-[#9ca3af] font-medium w-8">
                        $0
                      </span>
                      <div className="flex-1 border-b border-[#deded8]" />
                    </div>
                  </div>

                  {/* Chart Bars Grid */}
                  <div className="h-44 pl-10 flex items-end justify-between gap-3 sm:gap-6 z-10 relative">
                    {monthlyData.map((d) => {
                      const revHeight = (d.revenue / maxScale) * 100;
                      const expHeight = (d.expenses / maxScale) * 100;

                      return (
                        <div
                          key={d.month}
                          className="flex-1 flex flex-col items-center h-full justify-end group"
                        >
                          {/* Paired Bars (Purple for Revenue, Gray for Expenses) */}
                          <div className="flex items-end gap-1.5 w-full justify-center h-full pb-1">
                            {/* Revenue Bar */}
                            <div
                              style={{ height: `${revHeight}%` }}
                              className="w-3.5 sm:w-4 bg-[#7133f5] rounded-t-md hover:brightness-110 transition-all cursor-pointer relative"
                              title={`${d.month} Revenue: $${d.revenue}M`}
                            />
                            {/* Expenses Bar */}
                            <div
                              style={{ height: `${expHeight}%` }}
                              className="w-3.5 sm:w-4 bg-[#c7c7cf] rounded-t-md hover:brightness-95 transition-all cursor-pointer relative"
                              title={`${d.month} Expenses: $${d.expenses}M`}
                            />
                          </div>
                          {/* X-Axis Month Label */}
                          <span className="text-[9px] font-medium uppercase text-[#9ca3af] mt-2 block">
                            {d.month}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Centered Chart Legend */}
            <div className="flex items-center justify-center gap-6 mt-4 pt-2 border-t border-[#deded8]/60 text-[10.5px] text-[#6b7280] font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#7133f5]" />
                <span>Revenue</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#c7c7cf]" />
                <span>Expenses</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section (1 Column): Billing Alerts & Collection Rate */}
        <div className="lg:col-span-1 space-y-5">
          {/* Card 1: Billing Alerts */}
          <div className="ui-card p-5 flex flex-col justify-between">
            {/* Header: Title and Action Count Pill */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-[14px] text-[#111827] tracking-tight">
                Billing Alerts
              </h2>
              <span
                className={`px-2 py-0.5 text-[9px] font-bold tracking-wider rounded-full uppercase ${
                  alerts.length > 0
                    ? "bg-[#fee2e2] text-[#ef4444]"
                    : "bg-neutral-200/80 text-neutral-600"
                }`}
              >
                {alerts.length} ACTION REQ
              </span>
            </div>

            {/* Overdue Invoices List */}
            <div className="space-y-3 divide-y divide-[#deded8]">
              {alerts.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-400">
                  No overdue invoices or billing alerts.
                </div>
              ) : (
                alerts.map((alert, idx) => (
                  <div
                    key={alert.id}
                    className={`flex items-center justify-between ${idx > 0 ? "pt-3" : ""}`}
                  >
                    {/* Left: Warning icon and invoice details */}
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#fef2f2] text-[#ef4444] flex items-center justify-center shrink-0">
                        <TriangleAlert className="text-[11px]" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[11.5px] text-[#111827] leading-tight">
                          {alert.clientName}
                        </h3>
                        <p className="text-[10px] text-[#ef4444] font-medium mt-0.5">
                          {alert.daysOverdue} days overdue
                        </p>
                      </div>
                    </div>

                    {/* Right: Amount & Quick Remind Action */}
                    <div className="text-right">
                      <span className="font-bold text-[12px] text-[#111827] block leading-tight">
                        ${alert.amount.toLocaleString("en-US")}
                      </span>
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={() => handleSendReminder(alert.clientName)}
                        className="mt-0.5"
                      >
                        Remind
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* View All Alerts Action Button */}
            <div className="mt-5 pt-3 border-t border-[#deded8]/80">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setIsAlertsModalOpen(true)}
                className="w-full"
              >
                View All Alerts
              </Button>
            </div>
          </div>

          {/* Card 2: Collection Rate (Circular Donut Indicator) */}
          <div className="ui-card p-5 flex flex-col justify-between">
            {/* Header */}
            <div className="w-full text-left mb-3">
              <h2 className="font-bold text-[14px] text-[#111827] tracking-tight">
                Collection Rate
              </h2>
            </div>

            {/* Donut Gauge Visualization */}
            <div className="flex flex-col items-center justify-center py-4">
              <div className="relative w-28 h-28 flex items-center justify-center">
                {/* SVG Circular Donut Ring */}
                <svg
                  className="w-full h-full transform -rotate-90"
                  viewBox="0 0 100 100"
                >
                  {/* Track circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#dcdcd7"
                    strokeWidth="11"
                    fill="transparent"
                  />
                  {/* Progress stroke (—) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#7133f5"
                    strokeWidth="11"
                    strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={2 * Math.PI * 40}
                    strokeLinecap="butt"
                    fill="transparent"
                  />
                </svg>

                {/* Center Percentage in Newsreader */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="font-newspaper text-[26px] font-normal text-[#111827] leading-none">
                    —
                  </span>
                  <span className="text-[8px] uppercase tracking-wider text-[#6b7280] font-semibold mt-1">
                    NO HISTORY
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Dialog: All Billing Alerts */}
      <MotionPresence>
        {isAlertsModalOpen && (
          <MotionSurface
            kind="dialog"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
          >
            <MotionSurface onDismiss={() => setIsAlertsModalOpen(false)}
              kind="panel"
              className="bg-[#faf9f5] rounded-2xl shadow-xl border border-[#dcdcd7] w-full max-w-lg overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-[#eaeae5] flex items-center justify-between">
                <h3 className="font-bold text-[13px] text-[#111827]">
                  Active Billing Alerts (Overdue Invoices)
                </h3>
                <Button
                  aria-label="Close"
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => setIsAlertsModalOpen(false)}
                >
                  <X className="text-sm" />
                </Button>
              </div>
              <div className="p-6 space-y-3">
                {alerts.length === 0 && (
                  <EmptyState
                    compact
                    title="No billing alerts"
                    description="Overdue invoices will appear here when action is needed."
                  />
                )}
                {alerts.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-[#eaeae5] rounded-xl flex items-center justify-between border border-[#deded8]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#fef2f2] text-[#ef4444] flex items-center justify-center shrink-0">
                        <TriangleAlert className="text-[12px]" />
                      </div>
                      <div>
                        <div className="font-bold text-[13px] text-[#111827]">
                          {item.clientName}
                        </div>
                        <div className="text-[#ef4444] text-[11px] font-medium">
                          {item.daysOverdue} days overdue &bull;{" "}
                          {item.retainerTitle}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[13px] text-[#111827]">
                        ${item.amount.toLocaleString("en-US")}
                      </div>
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={() => handleSendReminder(item.clientName)}
                      >
                        Send Notice
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-6 py-3.5 bg-[#f4f4f0] border-t border-[#eaeae5] flex justify-end">
                <Button
                  variant="primary"
                  type="button"
                  onClick={() => setIsAlertsModalOpen(false)}
                >
                  Done
                </Button>
              </div>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Modal Dialog: Net Profit Details */}
      <MotionPresence>
        {isDetailsModalOpen && (
          <MotionSurface
            kind="dialog"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
          >
            <MotionSurface onDismiss={() => setIsDetailsModalOpen(false)}
              kind="panel"
              className="bg-[#faf9f5] rounded-2xl shadow-xl border border-[#dcdcd7] w-full max-w-md overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-[#eaeae5] flex items-center justify-between">
                <h3 className="font-bold text-[13px] text-[#111827]">
                  Net Profit Breakdown ({selectedQuarter})
                </h3>
                <Button
                  aria-label="Close"
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => setIsDetailsModalOpen(false)}
                >
                  <X className="text-sm" />
                </Button>
              </div>
              <EmptyState
                compact
                title="No profit history yet"
                description="Revenue and cost summaries will appear here as your financial history grows."
              />
              <div className="px-6 py-3.5 bg-[#f4f4f0] border-t border-[#eaeae5] flex justify-end">
                <Button
                  variant="primary"
                  type="button"
                  onClick={() => setIsDetailsModalOpen(false)}
                >
                  Close
                </Button>
              </div>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>
    </div>
  );
}
