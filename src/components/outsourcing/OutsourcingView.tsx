"use client";

import {
  CheckCircle2,
  Code2,
  Download,
  FileText,
  Receipt,
  SlidersHorizontal,
  UserPlus,
  X,
} from "lucide-react";

import {
  Button,
  PageHeader,
  MetricCard,
  EmptyState,
} from "@/components/ui/Workspace";

import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";

import React, { useState } from "react";

// Data model for sub-contractor vendors
interface VendorItem {
  id: string;
  name: string;
  service: string;
  currentBalance: number;
  status: "PENDING" | "PAID";
  iconType: "design" | "devops" | "legal";
}

// Initial vendor dataset starts blank
const initialVendors: VendorItem[] = [];

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
          : v,
      ),
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
        return <SlidersHorizontal className="text-[#4b5563] text-[13px]" />;
      case "devops":
        return <Code2 className="text-[#4b5563] text-[13px]" />;
      case "legal":
        return <FileText className="text-[#4b5563] text-[13px]" />;
    }
  };

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

      {/* Top Header: Title, subtitle, and primary action buttons */}
      <PageHeader
        title="Outsourcing"
        description="Manage your subcontractors, vendor balances, and payouts."
      >
        {/* Action buttons: Add Client & Log Expense */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            type="button"
            onClick={() => setIsClientModalOpen(true)}
          >
            <UserPlus className="text-[11px] text-[#374151]" />
            <span>Add Client</span>
          </Button>

          <Button
            variant="secondary"
            type="button"
            onClick={() => setIsExpenseModalOpen(true)}
          >
            <Receipt className="text-[11px] text-[#374151]" />
            <span>Log Expense</span>
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Outstanding Payables"
          value={`$${vendors.reduce((sum, vendor) => sum + vendor.currentBalance, 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          footer="awaiting settlement"
        />
        <MetricCard
          label="Active Vendors"
          value={vendors.length}
          footer="in the vendor directory"
        />
        <MetricCard
          label="Next Payout Run"
          value="—"
          footer="no payout scheduled"
        />
      </div>

      {/* Main Vendor Directory Card */}
      <div className="ui-card overflow-hidden mt-7">
        {/* Section title header */}
        <div className="px-6 py-4">
          <h2 className="text-[15px] font-bold text-[#111827] tracking-tight">
            Vendor Directory
          </h2>
        </div>

        {/* Vendor list rows container */}
        <div className="bg-white divide-y divide-neutral-100">
          {vendors.length === 0 ? (
            <EmptyState
              title="No vendors yet"
              description="Your subcontractors and vendor balances will appear here."
            />
          ) : (
            vendors.map((vendor) => (
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
                      $
                      {vendor.currentBalance.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
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
                    <Button
                      variant="primary"
                      size="icon"
                      type="button"
                      onClick={() => setSelectedVendor(vendor)}
                      title="Download Statement"
                      className="shrink-0"
                    >
                      <Download className="text-[11px]" />
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="icon"
                      type="button"
                      onClick={() => setSelectedVendor(vendor)}
                      title="View Settlement Receipt"
                      className="shrink-0"
                    >
                      <Download className="text-[11px]" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Dialog: View Statement Voucher */}
      <MotionPresence>
        {selectedVendor && (
          <MotionSurface
            kind="dialog"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
          >
            <MotionSurface onDismiss={() => setSelectedVendor(null)}
              kind="panel"
              className="bg-[#faf9f5] rounded-2xl shadow-xl border border-[#dcdcd7] w-full max-w-md overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-[#eaeae5] flex items-center justify-between">
                <h3 className="font-bold text-[13px] text-[#111827]">
                  Vendor Statement Voucher
                </h3>
                <Button
                  aria-label="Close"
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => setSelectedVendor(null)}
                >
                  <X className="text-sm" />
                </Button>
              </div>
              <div className="p-6 space-y-4 text-[12px] text-[#4b5563]">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-[14px] text-[#111827]">
                      {selectedVendor.name}
                    </div>
                    <div className="text-[#8e8e93] text-[11px]">
                      {selectedVendor.service}
                    </div>
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
                      $
                      {selectedVendor.currentBalance.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6b7280]">Scheduled Payout:</span>
                    <span className="font-medium text-[#111827]">
                      Oct 15, 2026
                    </span>
                  </div>
                </div>
              </div>
              <div className="px-6 py-3.5 bg-[#f4f4f0] border-t border-[#eaeae5] flex justify-end gap-2">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setSelectedVendor(null)}
                >
                  Close
                </Button>
                <Button
                  variant="primary"
                  type="button"
                  onClick={() => {
                    window.print();
                    setSelectedVendor(null);
                  }}
                >
                  Download PDF
                </Button>
              </div>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Modal Dialog: Add New Client */}
      <MotionPresence>
        {isClientModalOpen && (
          <MotionSurface
            kind="dialog"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
          >
            <MotionSurface onDismiss={() => setIsClientModalOpen(false)}
              kind="panel"
              className="bg-[#faf9f5] rounded-2xl shadow-xl border border-[#dcdcd7] w-full max-w-md overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-[#eaeae5] flex items-center justify-between">
                <h3 className="font-bold text-[13px] text-[#111827]">
                  Add New Client
                </h3>
                <Button
                  aria-label="Close"
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => setIsClientModalOpen(false)}
                >
                  <X className="text-sm" />
                </Button>
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
                    className="ui-field w-full text-[12px] px-3 border border-[#dcdcd7] focus:outline-none focus:ring-2 focus:ring-[#7133f5]"
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
                    className="ui-field w-full text-[12px] px-3 border border-[#dcdcd7] focus:outline-none focus:ring-2 focus:ring-[#7133f5]"
                  />
                </div>
                <div className="pt-2 flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setIsClientModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit">
                    Save Client
                  </Button>
                </div>
              </form>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Modal Dialog: Log Business Expense */}
      <MotionPresence>
        {isExpenseModalOpen && (
          <MotionSurface
            kind="dialog"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
          >
            <MotionSurface onDismiss={() => setIsExpenseModalOpen(false)}
              kind="panel"
              className="bg-[#faf9f5] rounded-2xl shadow-xl border border-[#dcdcd7] w-full max-w-md overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-[#eaeae5] flex items-center justify-between">
                <h3 className="font-bold text-[13px] text-[#111827]">
                  Log Business Expense
                </h3>
                <Button
                  aria-label="Close"
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                >
                  <X className="text-sm" />
                </Button>
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
                    className="ui-field w-full text-[12px] px-3 border border-[#dcdcd7] focus:outline-none focus:ring-2 focus:ring-[#7133f5]"
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
                    className="ui-field w-full text-[12px] px-3 border border-[#dcdcd7] focus:outline-none focus:ring-2 focus:ring-[#7133f5]"
                  />
                </div>
                <div className="pt-2 flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setIsExpenseModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit">
                    Log Expense
                  </Button>
                </div>
              </form>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>
    </div>
  );
}
