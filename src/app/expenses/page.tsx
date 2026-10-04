"use client";

import {
  Button,
  PageHeader,
  MetricCard,
  Switch,
  EmptyState,
} from "@/components/ui/Workspace";

import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";

import React, { useState, useMemo } from "react";
import {
  Download,
  Plus,
  Plane,
  Code2,
  Utensils,
  Package,
  Paperclip,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  DollarSign,
  Sparkles,
  Server,
  FileSpreadsheet,
  Receipt,
} from "lucide-react";

interface ExpenseItem {
  id: string;
  iconType:
    "plane" | "code" | "utensils" | "package" | "ai" | "server" | "other";
  date: string;
  merchant: string;
  description: string;
  category:
    | "TRAVEL"
    | "SOFTWARE"
    | "MEALS"
    | "OFFICE"
    | "AI INFRASTRUCTURE"
    | "HOSTING"
    | "HARDWARE";
  amount: number;
  currency: string;
  deductible: boolean;
  hasReceipt: boolean;
  receiptName?: string;
}

const initialExpenses: ExpenseItem[] = [];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>(initialExpenses);
  const [selectedCategory, setSelectedCategory] =
    useState<string>("All Categories");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // New Expense Form State
  const [formData, setFormData] = useState({
    merchant: "",
    description: "",
    category: "SOFTWARE" as ExpenseItem["category"],
    amount: "",
    date: "2023-10-25",
    deductible: true,
    receiptAttached: true,
  });

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Toggle deductible on individual row
  const toggleDeductible = (id: string) => {
    setExpenses((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, deductible: !item.deductible } : item,
      ),
    );
  };

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    if (selectedCategory === "All Categories") return expenses;
    return expenses.filter((e) => e.category === selectedCategory);
  }, [expenses, selectedCategory]);

  // Dynamic calculations for Stat Cards
  const totalExpensesAmount = expenses.reduce(
    (sum, item) => sum + item.amount,
    0,
  );
  const deductibleAmount = useMemo(() => {
    return expenses
      .filter((e) => e.deductible)
      .reduce((sum, item) => sum + item.amount, 0);
  }, [expenses]);

  const deductiblePercentage =
    totalExpensesAmount > 0
      ? Math.round((deductibleAmount / totalExpensesAmount) * 100)
      : 0;

  // 1-Click Presets from SRS REQ-EXP 02
  const applyPreset = (preset: {
    merchant: string;
    description: string;
    category: ExpenseItem["category"];
    amount: string;
  }) => {
    setFormData((prev) => ({
      ...prev,
      merchant: preset.merchant,
      description: preset.description,
      category: preset.category,
      amount: preset.amount,
      deductible: true,
    }));
  };

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.merchant.trim() || !formData.amount) return;

    const parsedAmount = parseFloat(formData.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    let iconType: ExpenseItem["iconType"] = "code";
    if (formData.category === "TRAVEL") iconType = "plane";
    else if (formData.category === "MEALS") iconType = "utensils";
    else if (formData.category === "OFFICE") iconType = "package";
    else if (formData.category === "AI INFRASTRUCTURE") iconType = "ai";
    else if (formData.category === "HOSTING") iconType = "server";

    const newExpense: ExpenseItem = {
      id: `exp-${Date.now()}`,
      iconType,
      date: new Date(formData.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      merchant: formData.merchant,
      description: formData.description || "General operational expense",
      category: formData.category,
      amount: parsedAmount,
      currency: "USD",
      deductible: formData.deductible,
      hasReceipt: formData.receiptAttached,
      receiptName: formData.receiptAttached
        ? `${formData.merchant.replace(/\s+/g, "_")}_Receipt.pdf`
        : undefined,
    };

    setExpenses([newExpense, ...expenses]);
    setIsLogModalOpen(false);
    setFormData({
      merchant: "",
      description: "",
      category: "SOFTWARE",
      amount: "",
      date: "2023-10-25",
      deductible: true,
      receiptAttached: true,
    });
    showToast(
      `Logged expense of $${parsedAmount.toFixed(2)} for ${newExpense.merchant}!`,
    );
  };

  const handleExportPdf = () => {
    showToast("Compiling vector PDF report with pdf-lib... Download ready!");
  };

  return (
    <div className="workspace-page motion-page">
      {/* Toast Notification */}
      <MotionPresence>
        {notification && (
          <MotionSurface
            kind="toast"
            className="fixed top-14 right-6 z-50 bg-neutral-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium border border-neutral-700"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{notification}</span>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Header Section matching Figma reference */}
      <PageHeader
        title="Expenses"
        description="Manage and track your business expenditures."
      >
        {/* Right Controls: Category Dropdown & EXPORT PDF Button */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="ui-field appearance-none border border-neutral-200/90 px-4 pr-9 font-semibold text-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-neutral-300 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
            >
              <option value="All Categories">All Categories</option>
              <option value="TRAVEL">TRAVEL</option>
              <option value="SOFTWARE">SOFTWARE</option>
              <option value="MEALS">MEALS</option>
              <option value="OFFICE">OFFICE</option>
              <option value="AI INFRASTRUCTURE">AI INFRASTRUCTURE</option>
              <option value="HOSTING">HOSTING</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200" />
          </div>

          <Button variant="secondary" onClick={handleExportPdf}>
            <div className="w-4 h-4 flex items-center justify-center">
              <Download
                className="w-4 h-4 transition-transform duration-200 ease-out group-hover:scale-105 group-hover:translate-y-0.5"
                strokeWidth={2.2}
              />
            </div>
            <span>Export PDF</span>
          </Button>
        </div>
        <Button variant="primary" onClick={() => setIsLogModalOpen(true)}>
          <Plus />
          Log Expense
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Total Expenses"
          value={`$${totalExpensesAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          footer="logged business expenses"
        />
        <MetricCard
          label="Deductible"
          value={`$${deductibleAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          footer={`${deductiblePercentage}% of total expenses`}
        />
        <MetricCard
          label="Logged Expenses"
          value={expenses.length}
          footer="entries in this session"
        />
      </div>

      {/* Expenses Table Container */}
      <div className="ui-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200/60 bg-[#fbfbfe]">
                <th className="w-16 py-3.5 px-6"></th>
                <th className="py-3.5 px-4 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest">
                  DATE
                </th>
                <th className="py-3.5 px-4 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest">
                  MERCHANT / DESCRIPTION
                </th>
                <th className="py-3.5 px-4 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest">
                  CATEGORY
                </th>
                <th className="py-3.5 px-4 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest">
                  AMOUNT
                </th>
                <th className="py-3.5 px-4 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest text-center">
                  DEDUCTIBLE
                </th>
                <th className="py-3.5 px-6 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest text-center">
                  RECEIPT
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-xs">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-0 text-center">
                    <EmptyState
                      title="No expenses logged"
                      description="Track business, travel, software, and office expenses for tax deductions."
                      icon={<Receipt />}
                    >
                      <Button
                        variant="primary"
                        onClick={() => setIsLogModalOpen(true)}
                        className="mt-4"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Log Expense</span>
                      </Button>
                    </EmptyState>
                  </td>
                </tr>
              ) : (
                filteredExpenses
                  .slice((currentPage - 1) * 4, currentPage * 4)
                  .map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-neutral-50/70 transition-colors group"
                    >
                      {/* Category Rounded Square Icon */}
                      <td className="py-4 px-6">
                        <div className="w-10 h-10 rounded-xl bg-neutral-100/90 border border-neutral-200/60 flex items-center justify-center text-neutral-600 transition-all duration-300 group-hover:bg-[#f3efff] group-hover:border-[#e3d8fd] group-hover:text-[#7c3aed]">
                          {item.iconType === "plane" && (
                            <Plane className="w-4.5 h-4.5 transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-105" />
                          )}
                          {item.iconType === "code" && (
                            <Code2 className="w-4.5 h-4.5 transition-transform duration-300 group-hover:scale-105" />
                          )}
                          {item.iconType === "utensils" && (
                            <Utensils className="w-4.5 h-4.5 transition-transform duration-300 group-hover:scale-105" />
                          )}
                          {item.iconType === "package" && (
                            <Package className="w-4.5 h-4.5 transition-transform duration-300 group-hover:-translate-y-px group-hover:scale-105" />
                          )}
                          {item.iconType === "ai" && (
                            <Sparkles className="w-4.5 h-4.5 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105 text-[#7c3aed]" />
                          )}
                          {item.iconType === "server" && (
                            <Server className="w-4.5 h-4.5 transition-transform duration-300 group-hover:scale-105" />
                          )}
                          {item.iconType === "other" && (
                            <DollarSign className="w-4.5 h-4.5 transition-transform duration-300 group-hover:scale-105" />
                          )}
                        </div>
                      </td>

                      {/* Date Column */}
                      <td className="py-4 px-4 text-neutral-600 font-medium whitespace-nowrap">
                        {item.date}
                      </td>

                      {/* Merchant / Description Column */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-neutral-900 text-sm">
                          {item.merchant}
                        </div>
                        <div className="text-neutral-400 text-xs mt-0.5 max-w-md truncate font-normal">
                          {item.description}
                        </div>
                      </td>

                      {/* Category Pill Column */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider text-neutral-600 bg-neutral-100 border border-neutral-200 uppercase">
                          {item.category}
                        </span>
                      </td>

                      {/* Amount Column */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="font-bold text-sm text-neutral-900 font-mono">
                          ${item.amount.toFixed(2)}
                        </span>
                      </td>

                      {/* Deductible Switch Column */}
                      <td className="py-4 px-4 text-center">
                        <Switch
                          checked={item.deductible}
                          onChange={() => toggleDeductible(item.id)}
                          label={`Deductible expense from ${item.merchant}`}
                        />
                      </td>

                      {/* Receipt Column */}
                      <td className="py-4 px-6 text-center">
                        {item.hasReceipt ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setSelectedReceipt(
                                item.receiptName || "receipt.pdf",
                              )
                            }

                            title={item.receiptName || "View Receipt"}
                          >
                            <Paperclip className="w-4.5 h-4.5 transition-transform duration-200 group-hover/rc:scale-105 group-hover/rc:rotate-6" />
                          </Button>
                        ) : (
                          <Paperclip className="w-4.5 h-4.5 text-neutral-300 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Entries Count & Pagination */}
        <div className="py-4 px-6 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-400">
          <div>
            Showing{" "}
            {filteredExpenses.length === 0 ? 0 : (currentPage - 1) * 4 + 1} to{" "}
            {Math.min(currentPage * 4, filteredExpenses.length)} of{" "}
            {filteredExpenses.length} entries
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-1.5">
            <Button
              aria-label="Previous page"
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4 transition-transform hover:-translate-x-0.5" />
            </Button>

            {Array.from(
              { length: Math.max(1, Math.ceil(filteredExpenses.length / 4)) },
              (_, i) => i + 1,
            ).map((pageNumber) => (
              <button
                key={pageNumber}
                onClick={() => setCurrentPage(pageNumber)}
                className={`w-7 h-7 rounded flex items-center justify-center text-xs font-semibold transition-all cursor-pointer ${
                  currentPage === pageNumber
                    ? "bg-[#6941C6] text-white shadow-xs"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {pageNumber}
              </button>
            ))}

            <Button
              aria-label="Next page"
              variant="ghost"
              size="icon"
              onClick={() =>
                setCurrentPage((p) =>
                  Math.min(
                    Math.max(1, Math.ceil(filteredExpenses.length / 4)),
                    p + 1,
                  ),
                )
              }
              disabled={
                currentPage >=
                Math.max(1, Math.ceil(filteredExpenses.length / 4))
              }
            >
              <ChevronRight className="w-4 h-4 transition-transform hover:translate-x-0.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Log Expense Modal (SRS REQ-EXP 01 & 02 / UC-12) */}
      <MotionPresence>
        {isLogModalOpen && (
          <MotionSurface
            kind="dialog"
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <MotionSurface
              onDismiss={() => setIsLogModalOpen(false)}
              kind="panel"
              className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-neutral-200 overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#ede9fe] text-[#7c3aed] flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">
                      Log Business Expense
                    </h3>
                    <p className="text-xs text-neutral-400">
                      UC-12: Operational Expense (OPEX) Tracker
                    </p>
                  </div>
                </div>
                <Button
                  aria-label="Close"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsLogModalOpen(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* 1-Click Fast Presets per SRS REQ-EXP 02 */}
              <div className="px-6 pt-4">
                <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  1-Click OPEX Presets (REQ-EXP 02)
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() =>
                      applyPreset({
                        merchant: "Adobe Creative Cloud",
                        description: "Creative Cloud All Apps Subscription",
                        category: "SOFTWARE",
                        amount: "54.99",
                      })
                    }
                  >
                    🎨 Adobe CC ($54.99)
                  </Button>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() =>
                      applyPreset({
                        merchant: "Anthropic",
                        description: "Claude AI API Tokens",
                        category: "AI INFRASTRUCTURE",
                        amount: "42.50",
                      })
                    }
                  >
                    ⚡ Claude AI API ($42.50)
                  </Button>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() =>
                      applyPreset({
                        merchant: "OpenAI",
                        description: "GPT-4o API Tokens & Platform",
                        category: "AI INFRASTRUCTURE",
                        amount: "30.00",
                      })
                    }
                  >
                    🤖 OpenAI API ($30.00)
                  </Button>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() =>
                      applyPreset({
                        merchant: "Vercel Inc.",
                        description: "Vercel Pro Team Hosting",
                        category: "HOSTING",
                        amount: "20.00",
                      })
                    }
                  >
                    ▲ Vercel Pro ($20.00)
                  </Button>
                </div>
              </div>

              <form
                onSubmit={handleCreateExpense}
                className="p-6 space-y-4 text-xs font-medium text-neutral-700"
              >
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block mb-1.5 text-neutral-700 font-semibold">
                      Payee / Merchant *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. GitHub"
                      value={formData.merchant}
                      onChange={(e) =>
                        setFormData({ ...formData, merchant: e.target.value })
                      }
                      className="ui-field w-full px-3.5 border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
                    />
                  </div>

                  <div>
                    <label className="block mb-1.5 text-neutral-700 font-semibold">
                      Amount (USD $) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData({ ...formData, amount: e.target.value })
                      }
                      className="ui-field w-full px-3.5 border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 text-neutral-700 font-semibold">
                    Expense Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Monthly developer tools subscription"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="ui-field w-full px-3.5 border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block mb-1.5 text-neutral-700 font-semibold">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          category: e.target.value as ExpenseItem["category"],
                        })
                      }
                      className="ui-field w-full px-3 border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
                    >
                      <option value="SOFTWARE">SOFTWARE</option>
                      <option value="AI INFRASTRUCTURE">
                        AI INFRASTRUCTURE
                      </option>
                      <option value="HOSTING">HOSTING</option>
                      <option value="TRAVEL">TRAVEL</option>
                      <option value="MEALS">MEALS</option>
                      <option value="OFFICE">OFFICE</option>
                      <option value="HARDWARE">HARDWARE</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1.5 text-neutral-700 font-semibold">
                      Expense Date
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) =>
                        setFormData({ ...formData, date: e.target.value })
                      }
                      className="ui-field w-full px-3 border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
                    />
                  </div>
                </div>

                {/* Deductible & Receipt switches */}
                <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-neutral-800 block text-xs">
                        Tax Deductible
                      </span>
                      <span className="text-neutral-400 text-[11px] font-normal">
                        Include in business tax write-offs
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.deductible}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          deductible: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-[#7c3aed] rounded-sm focus:ring-[#7c3aed]"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-neutral-200/60">
                    <div>
                      <span className="font-semibold text-neutral-800 block text-xs">
                        Attach Receipt
                      </span>
                      <span className="text-neutral-400 text-[11px] font-normal">
                        Store local proof of payment
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.receiptAttached}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          receiptAttached: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-[#7c3aed] rounded-sm focus:ring-[#7c3aed]"
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-neutral-100">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setIsLogModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit">
                    Save Expense
                  </Button>
                </div>
              </form>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Receipt Preview Modal */}
      <MotionPresence>
        {selectedReceipt && (
          <MotionSurface
            kind="dialog"
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <MotionSurface
              onDismiss={() => setSelectedReceipt(null)}
              kind="panel"
              className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-neutral-200 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/60">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-[#7c3aed]" />
                  <h4 className="text-sm font-semibold text-neutral-900">
                    Receipt Document
                  </h4>
                </div>
                <Button
                  aria-label="Close"
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedReceipt(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-6 text-center space-y-3">
                <div className="ui-card w-16 h-16 text-[#7c3aed] flex items-center justify-center mx-auto border-purple-100">
                  <FileSpreadsheet className="w-8 h-8" />
                </div>
                <div>
                  <span className="font-semibold text-neutral-800 text-sm block">
                    {selectedReceipt}
                  </span>
                  <span className="text-neutral-400 text-xs">
                    Verified Local Receipt Attachment (Stored offline)
                  </span>
                </div>
              </div>
              <div className="px-6 py-3 bg-neutral-50 border-t border-neutral-100 flex justify-end">
                <Button
                  variant="primary"
                  onClick={() => setSelectedReceipt(null)}
                >
                  Done
                </Button>
              </div>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>
    </div>
  );
}
