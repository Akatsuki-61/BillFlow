"use client";

import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";

import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBuildingColumns,
  faArrowTrendUp,
  faTriangleExclamation,
  faEllipsisVertical,
  faCalendarDays,
  faChevronDown,
  faCircleCheck,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { Timeframe, BillingAlertItem, MonthlyFinancial } from "@/types/analytics";

// Monthly financial dataset starts blank
const monthlyData: MonthlyFinancial[] = [];

// Billing alerts data starts blank
const initialAlerts: BillingAlertItem[] = [];

export default function AnalyticsView() {
  // Selected timeframe filter state: Month, Quarter, or Year
  const [timeframe, setTimeframe] = useState<Timeframe>("Quarter");

  // Selected date quarter state
  const [selectedQuarter, setSelectedQuarter] = useState("Q3 2023");
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
    <div className="motion-page w-full min-h-screen bg-[#faf9f5] text-[#111827] px-6 sm:px-10 lg:px-12 py-10 font-sans">
      {/* Toast Feedback Notification */}
      <MotionPresence>
        {toastMessage && (
          <MotionSurface kind="toast" className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 bg-[#18181b] text-white rounded-xl shadow-lg text-[12px] font-medium">
            <FontAwesomeIcon icon={faCircleCheck} className="text-[#34d399] text-[13px]" />
            <span>{toastMessage}</span>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Top Header: Title, subtitle, timeframe toggle and date range picker */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          {/* Newspaper serif heading matching wireframe */}
          <h1 className="font-newspaper text-[38px] sm:text-[42px] font-normal tracking-[-0.02em] text-[#111827] leading-none">
            Analytics
          </h1>
          <p className="text-[13px] text-[#6b7280] mt-2 font-normal">
            Here&apos;s your overall Analytics .
          </p>
        </div>

        {/* Header Controls: Timeframe segmented toggle and quarter dropdown */}
        <div className="flex items-center gap-3">
          {/* Timeframe pill selector (Month / Quarter / Year) */}
          <div className="bg-[#eaeae5] p-1 rounded-xl flex items-center gap-1 border border-[#deded8]">
            {(["Month", "Quarter", "Year"] as Timeframe[]).map((tab) => {
              const isActive = timeframe === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setTimeframe(tab)}
                  className={`px-3 py-1 rounded-lg text-[11.5px] transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#faf9f5] text-[#111827] font-semibold shadow-xs"
                      : "text-[#6b7280] hover:text-[#111827] font-medium"
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          {/* Date range dropdown button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              aria-expanded={isDropdownOpen}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#faf9f5] hover:bg-[#eaeae5] border border-[#dcdcd7] rounded-lg text-[11.5px] font-medium text-[#374151] transition-all cursor-pointer shadow-2xs"
            >
              <FontAwesomeIcon icon={faCalendarDays} className="text-[11px] text-[#6b7280]" />
              <span>{selectedQuarter}</span>
              <FontAwesomeIcon icon={faChevronDown} className="motion-chevron text-[9px] text-[#9ca3af] ml-0.5" />
            </button>

            {/* Dropdown menu */}
            <MotionPresence>
              {isDropdownOpen && (
                <MotionSurface kind="menu" className="absolute right-0 mt-1.5 w-36 bg-[#faf9f5] border border-[#dcdcd7] rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                  {["Q3 2023", "Q2 2023", "Q1 2023", "Q4 2022"].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        setSelectedQuarter(q);
                        setIsDropdownOpen(false);
                        showToast(`Filtered to ${q}`);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-[11.5px] transition-colors cursor-pointer ${
                        selectedQuarter === q
                          ? "bg-[#eaeae5] text-[#7133f5] font-semibold"
                          : "text-[#374151] hover:bg-[#f4f4f0]"
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </MotionSurface>
              )}
            </MotionPresence>
          </div>
        </div>
      </div>

      {/* Main Analytics Grid matching Figma Design 2.0 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-7">
        {/* Left Section (2 Columns): Net Profit, Paid Ratio & Revenue vs Expenses Chart */}
        <div className="lg:col-span-2 space-y-5">
          {/* Row 1: KPI Cards (Net Profit + Paid Ratio) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Widget 1: Net Profit Card */}
            <div className="bg-[#eaeae5] rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between h-[152px] shadow-xs border border-[#deded8]">
              {/* Card Header & Watermark Icon */}
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-semibold text-[#6b7280] tracking-[0.06em] uppercase block">
                  NET PROFIT
                </span>
                <FontAwesomeIcon
                  icon={faBuildingColumns}
                  className="text-[#c5c5be] text-[26px] pointer-events-none"
                />
              </div>

              {/* Numerical Value in Newsreader & Growth Indicator */}
              <div className="flex items-center gap-2.5 mt-1">
                <div className="font-newspaper text-[32px] sm:text-[36px] font-normal text-[#111827] tracking-tight leading-none">
                  $142,850
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#d6eddb] text-[#15803d] text-[10px] font-bold rounded-full">
                  <FontAwesomeIcon icon={faArrowTrendUp} className="text-[9px]" />
                  <span>12.4%</span>
                </span>
              </div>

              {/* Bottom Context & Details Action */}
              <div className="flex justify-between items-center pt-2">
                <span className="text-[11px] text-[#8e8e93] font-normal">
                  vs previous quarter
                </span>
                <button
                  type="button"
                  onClick={() => setIsDetailsModalOpen(true)}
                  className="text-[11px] text-[#7133f5] font-semibold hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>Details</span>
                  <span>&rarr;</span>
                </button>
              </div>
            </div>

            {/* Widget 2: Paid Ratio Card (Dark Gradient Theme) */}
            <div className="bg-gradient-to-br from-[#0c0d12] via-[#12111d] to-[#1f1733] rounded-2xl p-6 flex flex-col justify-between h-[152px] shadow-xs text-white border border-[#27272a]">
              {/* Card Label */}
              <div>
                <span className="text-[10px] font-semibold text-[#a1a1aa] tracking-[0.06em] uppercase block">
                  PAID RATIO
                </span>
                {/* Ratio Value in Newsreader */}
                <div className="font-newspaper text-[32px] sm:text-[36px] font-normal text-white tracking-tight mt-1 leading-none">
                  94.2%
                </div>
              </div>

              {/* Visual Linear Progress Bar */}
              <div>
                <div className="w-full bg-[#27272a] h-1.5 rounded-full overflow-hidden">
                  <div className="w-[94.2%] h-full bg-gradient-to-r from-[#7133f5] via-[#a855f7] to-[#e2e0e4] rounded-full" />
                </div>
                {/* Metric Summary Footers */}
                <div className="flex justify-between items-center text-[10px] text-[#a1a1aa] font-medium mt-2">
                  <span>$482k Collected</span>
                  <span>$512k Billed</span>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Revenue vs Expenses Chart Card */}
          <div className="bg-[#eaeae5] rounded-2xl p-6 shadow-xs border border-[#deded8]">
            {/* Chart Title and Header Actions */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-newspaper text-[17px] font-normal text-[#111827] tracking-tight">
                Revenue vs Expenses
              </h2>
              <button
                type="button"
                className="text-[#9ca3af] hover:text-[#111827] p-1 rounded-md transition-colors cursor-pointer"
                title="Chart options"
              >
                <FontAwesomeIcon icon={faEllipsisVertical} className="text-[13px]" />
              </button>
            </div>

            {/* Grouped Paired Bar Chart Visualization */}
            <div className="relative pt-2 pb-2">
              {monthlyData.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center p-6 border border-dashed border-[#deded8] rounded-xl bg-white/40">
                  <span className="text-xs font-semibold text-neutral-800">No financial data yet</span>
                  <span className="text-xs text-neutral-400 mt-1 max-w-sm">
                    Monthly cashflow and expense analytics will plot here as transactions are recorded.
                  </span>
                </div>
              ) : (
                <>
                  {/* Y-Axis Horizontal Gridlines & Labels */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pr-2">
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-[9.5px] text-[#9ca3af] font-medium w-8">$2M</span>
                      <div className="flex-1 border-b border-[#deded8] border-dashed" />
                    </div>
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-[9.5px] text-[#9ca3af] font-medium w-8">$1M</span>
                      <div className="flex-1 border-b border-[#deded8] border-dashed" />
                    </div>
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-[9.5px] text-[#9ca3af] font-medium w-8">$0</span>
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
          <div className="bg-[#eaeae5] rounded-2xl p-5 shadow-xs flex flex-col justify-between border border-[#deded8]">
            {/* Header: Title and Action Count Pill */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-[14px] text-[#111827] tracking-tight">
                Billing Alerts
              </h2>
              <span className={`px-2 py-0.5 text-[9px] font-bold tracking-wider rounded-full uppercase ${
                alerts.length > 0
                  ? "bg-[#fee2e2] text-[#ef4444]"
                  : "bg-neutral-200/80 text-neutral-600"
              }`}>
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
                      <FontAwesomeIcon icon={faTriangleExclamation} className="text-[11px]" />
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
                    <button
                      type="button"
                      onClick={() => handleSendReminder(alert.clientName)}
                      className="text-[10.5px] text-[#7133f5] hover:underline font-semibold cursor-pointer block mt-0.5"
                    >
                      Remind
                    </button>
                  </div>
                </div>
              )))}
            </div>

            {/* View All Alerts Action Button */}
            <div className="mt-5 pt-3 border-t border-[#deded8]/80">
              <button
                type="button"
                onClick={() => setIsAlertsModalOpen(true)}
                className="w-full py-2 bg-[#faf9f5] hover:bg-[#deded8] border border-[#dcdcd7] text-[#374151] rounded-xl text-[11.5px] font-medium transition-colors cursor-pointer text-center shadow-2xs"
              >
                View All Alerts
              </button>
            </div>
          </div>

          {/* Card 2: Collection Rate (Circular Donut Indicator) */}
          <div className="bg-[#eaeae5] rounded-2xl p-5 shadow-xs flex flex-col justify-between border border-[#deded8]">
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
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Track circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#dcdcd7"
                    strokeWidth="11"
                    fill="transparent"
                  />
                  {/* Progress stroke (86%) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#7133f5"
                    strokeWidth="11"
                    strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={2 * Math.PI * 40 * (1 - 0.86)}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>

                {/* Center Percentage in Newsreader */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="font-newspaper text-[26px] font-normal text-[#111827] leading-none">
                    86%
                  </span>
                  <span className="text-[8px] uppercase tracking-wider text-[#6b7280] font-semibold mt-1">
                    PAID ON TIME
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
          <MotionSurface kind="dialog" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <MotionSurface kind="panel" className="bg-[#faf9f5] rounded-2xl shadow-xl border border-[#dcdcd7] w-full max-w-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-[#eaeae5] flex items-center justify-between">
                <h3 className="font-bold text-[13px] text-[#111827]">
                  Active Billing Alerts (Overdue Invoices)
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAlertsModalOpen(false)}
                  className="text-[#8e8e93] hover:text-[#111827] p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <FontAwesomeIcon icon={faXmark} className="text-sm" />
                </button>
              </div>
              <div className="p-6 space-y-3">
                {[
                  ...alerts,
                  {
                    id: "alert-3",
                    clientName: "CyberDyne Labs",
                    retainerTitle: "Security Audit Q2",
                    daysOverdue: 21,
                    amount: 5400,
                  },
                ].map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-[#eaeae5] rounded-xl flex items-center justify-between border border-[#deded8]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#fef2f2] text-[#ef4444] flex items-center justify-center shrink-0">
                        <FontAwesomeIcon icon={faTriangleExclamation} className="text-[12px]" />
                      </div>
                      <div>
                        <div className="font-bold text-[13px] text-[#111827]">{item.clientName}</div>
                        <div className="text-[#ef4444] text-[11px] font-medium">
                          {item.daysOverdue} days overdue &bull; {item.retainerTitle}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[13px] text-[#111827]">
                        ${item.amount.toLocaleString("en-US")}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSendReminder(item.clientName)}
                        className="text-[11px] text-[#7133f5] hover:underline font-semibold cursor-pointer"
                      >
                        Send Notice
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-6 py-3.5 bg-[#f4f4f0] border-t border-[#eaeae5] flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsAlertsModalOpen(false)}
                  className="px-4 py-1.5 bg-[#7133f5] hover:bg-[#5e1eed] text-white rounded-lg text-[11.5px] font-semibold cursor-pointer shadow-2xs"
                >
                  Done
                </button>
              </div>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Modal Dialog: Net Profit Details */}
      <MotionPresence>
        {isDetailsModalOpen && (
          <MotionSurface kind="dialog" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <MotionSurface kind="panel" className="bg-[#faf9f5] rounded-2xl shadow-xl border border-[#dcdcd7] w-full max-w-md overflow-hidden">
              <div className="px-6 py-4 border-b border-[#eaeae5] flex items-center justify-between">
                <h3 className="font-bold text-[13px] text-[#111827]">
                  Net Profit Breakdown ({selectedQuarter})
                </h3>
                <button
                  type="button"
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="text-[#8e8e93] hover:text-[#111827] p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <FontAwesomeIcon icon={faXmark} className="text-sm" />
                </button>
              </div>
              <div className="p-6 space-y-4 text-[12px] text-[#4b5563]">
                <div className="p-3 bg-[#eaeae5] rounded-xl space-y-2 border border-[#deded8]">
                  <div className="flex justify-between">
                    <span>Gross Billed Revenue:</span>
                    <span className="font-bold text-[#111827]">$512,000.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Operating & Server OPEX:</span>
                    <span className="font-bold text-[#ef4444]">-$285,150.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Subcontractor Outsourcing:</span>
                    <span className="font-bold text-[#ef4444]">-$84,000.00</span>
                  </div>
                  <div className="pt-2 border-t border-[#deded8] flex justify-between text-[13px]">
                    <span className="font-semibold text-[#111827]">Net Retained Profit:</span>
                    <span className="font-newspaper font-bold text-[#15803d] text-[15px]">
                      $142,850.00
                    </span>
                  </div>
                </div>
              </div>
              <div className="px-6 py-3.5 bg-[#f4f4f0] border-t border-[#eaeae5] flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="px-4 py-1.5 bg-[#7133f5] hover:bg-[#5e1eed] text-white rounded-lg text-[11.5px] font-semibold cursor-pointer shadow-2xs"
                >
                  Close
                </button>
              </div>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>
    </div>
  );
}
