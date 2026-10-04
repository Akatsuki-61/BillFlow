"use client";

import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";

import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUserPlus,
  faReceipt,
  faDownload,
  faSliders,
  faCode,
  faFileLines,
  faCircleCheck,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

// Data model for sub-contractor vendors
interface VendorItem {
  id: string;
  name: string;
  service: string;
  currentBalance: number;
  status: "PENDING" | "PAID";
  iconType: "design" | "devops" | "legal";
}

// Initial vendor dataset matching Figma Design 2.0 wireframe
const initialVendors: VendorItem[] = [
  {
    id: "v-1",
    name: "Studio ArchiType",
    service: "UI/UX Design Services",
    currentBalance: 8500.0,
    status: "PENDING",
    iconType: "design",
  },
  {
    id: "v-2",
    name: "DevOps Nexus",
    service: "Infrastructure Engineering",
    currentBalance: 0.0,
    status: "PAID",
    iconType: "devops",
  },
  {
    id: "v-3",
    name: "ClearCopy Legal",
    service: "Contract Review",
    currentBalance: 3200.0,
    status: "PENDING",
    iconType: "legal",
  },
];

export default function OutsourcingView() {
  // Main vendor directory state
  const [vendors, setVendors] = useState<VendorItem[]>(initialVendors);

  // Modal dialog states
  const [selectedVendor, setSelectedVendor] = useState<VendorItem | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  // Form input states
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Show auto-dismissing toast feedback
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Toggle vendor payment status between PENDING and PAID
  const handleToggleStatus = (id: string) => {
    setVendors(
      vendors.map((v) =>
        v.id === id
          ? {
              ...v,
              status: v.status === "PENDING" ? "PAID" : "PENDING",
              currentBalance: v.status === "PENDING" ? 0 : 4500,
            }
          : v
      )
    );
    showToast("Status updated");
  };

  // Submit handler for adding a new client
  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName) return;
    showToast(`Client "${clientName}" added`);
    setClientName("");
    setClientEmail("");
    setIsClientModalOpen(false);
  };

  // Submit handler for logging a business expense
  const handleLogExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseTitle || !expenseAmount) return;
    showToast(`Expense "${expenseTitle}" logged`);
    setExpenseTitle("");
    setExpenseAmount("");
    setIsExpenseModalOpen(false);
  };

  // Render Font Awesome vector icon based on vendor category
  const renderVendorIcon = (type: VendorItem["iconType"]) => {
    switch (type) {
      case "design":
        return <FontAwesomeIcon icon={faSliders} className="text-[#4b5563] text-[13px]" />;
      case "devops":
        return <FontAwesomeIcon icon={faCode} className="text-[#4b5563] text-[13px]" />;
      case "legal":
        return <FontAwesomeIcon icon={faFileLines} className="text-[#4b5563] text-[13px]" />;
    }
  };

  return (
    <div className="motion-page w-full min-h-screen bg-[#faf9f5] text-[#111827] px-6 sm:px-10 lg:px-12 py-10">
      {/* Toast Feedback Notification */}
      <MotionPresence>
        {toastMessage && (
          <MotionSurface kind="toast" className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 bg-[#18181b] text-white rounded-xl shadow-lg text-[12px] font-medium">
            <FontAwesomeIcon icon={faCircleCheck} className="text-[#34d399] text-[13px]" />
            <span>{toastMessage}</span>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Top Header: Title, subtitle, and primary action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          {/* Newspaper serif heading matching wireframe */}
          <h1 className="font-newspaper text-[38px] sm:text-[42px] font-normal tracking-[-0.02em] text-[#111827] leading-none">
            Outsourcing
          </h1>
          <p className="text-[13px] text-[#6b7280] mt-2 font-normal">
            Welcome back, here&apos;s your financial overview.
          </p>
        </div>

        {/* Action buttons: Add Client & Log Expense */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsClientModalOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#faf9f5] hover:bg-[#eaeae5] border border-[#dcdcd7] rounded-lg text-[11.5px] font-medium text-[#374151] transition-all cursor-pointer shadow-2xs"
          >
            <FontAwesomeIcon icon={faUserPlus} className="text-[11px] text-[#374151]" />
            <span>Add Client</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpenseModalOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#faf9f5] hover:bg-[#eaeae5] border border-[#dcdcd7] rounded-lg text-[11.5px] font-medium text-[#374151] transition-all cursor-pointer shadow-2xs"
          >
            <FontAwesomeIcon icon={faReceipt} className="text-[11px] text-[#374151]" />
            <span>Log Expense</span>
          </button>
        </div>
      </div>

      {/* 3 KPI Summary Cards matching wireframe palette (#eaeae5, #d6eddb, #e2e0e4) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-7">
        {/* KPI 1: Total Outstanding Payables */}
        <div className="bg-[#eaeae5] rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between h-[126px] shadow-xs">
          <div className="z-10">
            <span className="text-[10px] font-semibold text-[#6b7280] tracking-[0.06em] uppercase block">
              TOTAL OUTSTANDING PAYABLES
            </span>
            <div className="font-newspaper text-[32px] sm:text-[36px] font-normal text-[#111827] tracking-tight mt-2 leading-none">
              $42,850.00
            </div>
          </div>
          <div className="absolute -top-8 -right-8 w-40 h-40 bg-[#deded8]/50 rounded-full pointer-events-none" />
        </div>

        {/* KPI 2: Active Vendors (with pastel mint green crescent #d6eddb) */}
        <div className="bg-[#eaeae5] rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between h-[126px] shadow-xs">
          <div className="z-10">
            <span className="text-[10px] font-semibold text-[#6b7280] tracking-[0.06em] uppercase block">
              ACTIVE VENDORS
            </span>
            <div className="font-newspaper text-[32px] sm:text-[36px] font-normal text-[#111827] tracking-tight mt-2 leading-none">
              14
            </div>
          </div>
          <div className="absolute -top-8 -right-8 w-40 h-40 bg-[#d6eddb] rounded-full pointer-events-none" />
        </div>

        {/* KPI 3: Next Payout Run (with pastel lavender crescent #e2e0e4) */}
        <div className="bg-[#eaeae5] rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between h-[126px] shadow-xs">
          <div className="z-10">
            <span className="text-[10px] font-semibold text-[#6b7280] tracking-[0.06em] uppercase block">
              NEXT PAYOUT RUN
            </span>
            <div className="font-newspaper text-[32px] sm:text-[36px] font-normal text-[#111827] tracking-tight mt-2 leading-none">
              Oct 15
            </div>
          </div>
          <div className="absolute -top-8 -right-8 w-40 h-40 bg-[#e2e0e4] rounded-full pointer-events-none" />
        </div>
      </div>

      {/* Main Vendor Directory Card */}
      <div className="bg-[#eaeae5] rounded-2xl overflow-hidden mt-7 shadow-xs">
        {/* Section title header */}
        <div className="px-6 py-4">
          <h2 className="text-[15px] font-bold text-[#111827] tracking-tight">
            Vendor Directory
          </h2>
        </div>

        {/* Vendor list rows container */}
        <div className="bg-[#faf9f5] rounded-b-2xl divide-y divide-[#eaeae5]">
          {vendors.map((vendor) => (
            <div
              key={vendor.id}
              className="px-6 py-4.5 flex items-center justify-between hover:bg-[#f4f4f0] transition-colors"
            >
              {/* Left: Vendor category icon and credentials */}
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#eaeae5] flex items-center justify-center shrink-0">
                  {renderVendorIcon(vendor.iconType)}
                </div>
                <div>
                  <h3 className="font-bold text-[13.5px] text-[#111827] leading-tight">
                    {vendor.name}
                  </h3>
                  <p className="text-[11.5px] text-[#8e8e93] mt-0.5 font-normal">
                    {vendor.service}
                  </p>
                </div>
              </div>

              {/* Right: Current balance, status pill, and action button */}
              <div className="flex items-center gap-5 sm:gap-6">
                {/* Balance display */}
                <div className="text-right">
                  <span className="text-[9.5px] text-[#8e8e93] font-normal block leading-tight">
                    Current Balance
                  </span>
                  <span className="text-[13.5px] font-bold text-[#111827] mt-0.5 block leading-tight">
                    ${vendor.currentBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Status toggle pill (PENDING / PAID) */}
                <button
                  type="button"
                  onClick={() => handleToggleStatus(vendor.id)}
                  title="Click to toggle status"
                  className={`px-2.5 py-0.5 rounded-full text-[9.5px] font-bold tracking-[0.06em] cursor-pointer uppercase transition-colors ${
                    vendor.status === "PAID"
                      ? "text-[#15803d] bg-[#d6eddb] hover:bg-[#c4e5cb]"
                      : "text-[#4b5563] bg-[#eaeae5] hover:bg-[#deded8]"
                  }`}
                >
                  {vendor.status}
                </button>

                {/* Action button: Purple solid button or neutral outlined button */}
                {vendor.status === "PENDING" ? (
                  <button
                    type="button"
                    onClick={() => setSelectedVendor(vendor)}
                    title="Download Statement"
                    className="w-8 h-8 rounded-lg bg-[#7133f5] hover:bg-[#5e1eed] active:bg-[#4c1d95] text-white flex items-center justify-center transition-colors shadow-2xs cursor-pointer shrink-0"
                  >
                    <FontAwesomeIcon icon={faDownload} className="text-[11px]" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedVendor(vendor)}
                    title="View Settlement Receipt"
                    className="w-8 h-8 rounded-lg border border-[#d1d5db] text-[#8e8e93] hover:text-[#111827] hover:bg-[#eaeae5] flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  >
                    <FontAwesomeIcon icon={faDownload} className="text-[11px]" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Dialog: View Statement Voucher */}
      <MotionPresence>
        {selectedVendor && (
          <MotionSurface kind="dialog" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <MotionSurface kind="panel" className="bg-[#faf9f5] rounded-2xl shadow-xl border border-[#dcdcd7] w-full max-w-md overflow-hidden">
              <div className="px-6 py-4 border-b border-[#eaeae5] flex items-center justify-between">
                <h3 className="font-bold text-[13px] text-[#111827]">
                  Vendor Statement Voucher
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedVendor(null)}
                  className="text-[#8e8e93] hover:text-[#111827] p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <FontAwesomeIcon icon={faXmark} className="text-sm" />
                </button>
              </div>
              <div className="p-6 space-y-4 text-[12px] text-[#4b5563]">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-[14px] text-[#111827]">{selectedVendor.name}</div>
                    <div className="text-[#8e8e93] text-[11px]">{selectedVendor.service}</div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      selectedVendor.status === "PAID"
                        ? "text-[#15803d] bg-[#d6eddb]"
                        : "text-[#4b5563] bg-[#eaeae5]"
                    }`}
                  >
                    {selectedVendor.status}
                  </span>
                </div>

                <div className="p-3 bg-[#eaeae5] rounded-xl space-y-1.5 border border-[#dcdcd7]">
                  <div className="flex justify-between">
                    <span className="text-[#6b7280]">Current Balance:</span>
                    <span className="font-bold text-[#111827]">
                      ${selectedVendor.currentBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6b7280]">Scheduled Payout:</span>
                    <span className="font-medium text-[#111827]">Oct 15, 2026</span>
                  </div>
                </div>
              </div>
              <div className="px-6 py-3.5 bg-[#f4f4f0] border-t border-[#eaeae5] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedVendor(null)}
                  className="px-3.5 py-1.5 text-[11.5px] font-medium text-[#4b5563] hover:text-[#111827] cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                    setSelectedVendor(null);
                  }}
                  className="px-4 py-1.5 bg-[#7133f5] hover:bg-[#5e1eed] text-white rounded-lg text-[11.5px] font-semibold cursor-pointer shadow-2xs"
                >
                  Download PDF
                </button>
              </div>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Modal Dialog: Add New Client */}
      <MotionPresence>
        {isClientModalOpen && (
          <MotionSurface kind="dialog" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <MotionSurface kind="panel" className="bg-[#faf9f5] rounded-2xl shadow-xl border border-[#dcdcd7] w-full max-w-md overflow-hidden">
              <div className="px-6 py-4 border-b border-[#eaeae5] flex items-center justify-between">
                <h3 className="font-bold text-[13px] text-[#111827]">Add New Client</h3>
                <button
                  type="button"
                  onClick={() => setIsClientModalOpen(false)}
                  className="text-[#8e8e93] hover:text-[#111827] p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <FontAwesomeIcon icon={faXmark} className="text-sm" />
                </button>
              </div>
              <form onSubmit={handleAddClient} className="p-6 space-y-3.5">
                <div>
                  <label className="block text-[11.5px] font-medium text-[#374151] mb-1">
                    Client Business Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Fintech Labs Inc."
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full text-[12px] px-3 py-2 bg-white border border-[#dcdcd7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7133f5]"
                  />
                </div>
                <div>
                  <label className="block text-[11.5px] font-medium text-[#374151] mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="alex@fintechlabs.com"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="w-full text-[12px] px-3 py-2 bg-white border border-[#dcdcd7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7133f5]"
                  />
                </div>
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsClientModalOpen(false)}
                    className="px-3.5 py-1.5 text-[11.5px] text-[#4b5563] hover:text-[#111827] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#7133f5] hover:bg-[#5e1eed] text-white rounded-lg text-[11.5px] font-semibold cursor-pointer shadow-2xs"
                  >
                    Save Client
                  </button>
                </div>
              </form>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Modal Dialog: Log Business Expense */}
      <MotionPresence>
        {isExpenseModalOpen && (
          <MotionSurface kind="dialog" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <MotionSurface kind="panel" className="bg-[#faf9f5] rounded-2xl shadow-xl border border-[#dcdcd7] w-full max-w-md overflow-hidden">
              <div className="px-6 py-4 border-b border-[#eaeae5] flex items-center justify-between">
                <h3 className="font-bold text-[13px] text-[#111827]">Log Business Expense</h3>
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="text-[#8e8e93] hover:text-[#111827] p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <FontAwesomeIcon icon={faXmark} className="text-sm" />
                </button>
              </div>
              <form onSubmit={handleLogExpense} className="p-6 space-y-3.5">
                <div>
                  <label className="block text-[11.5px] font-medium text-[#374151] mb-1">
                    Expense Description
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Adobe Creative Cloud, Cloud Server"
                    value={expenseTitle}
                    onChange={(e) => setExpenseTitle(e.target.value)}
                    className="w-full text-[12px] px-3 py-2 bg-white border border-[#dcdcd7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7133f5]"
                  />
                </div>
                <div>
                  <label className="block text-[11.5px] font-medium text-[#374151] mb-1">
                    Amount ($ USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="54.99"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full text-[12px] px-3 py-2 bg-white border border-[#dcdcd7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7133f5]"
                  />
                </div>
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsExpenseModalOpen(false)}
                    className="px-3.5 py-1.5 text-[11.5px] text-[#4b5563] hover:text-[#111827] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#7133f5] hover:bg-[#5e1eed] text-white rounded-lg text-[11.5px] font-semibold cursor-pointer shadow-2xs"
                  >
                    Log Expense
                  </button>
                </div>
              </form>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>
    </div>
  );
}
