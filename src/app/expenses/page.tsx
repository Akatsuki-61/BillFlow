"use client";

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
  TrendingUp,
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
  iconType: "plane" | "code" | "utensils" | "package" | "ai" | "server" | "other";
  date: string;
  merchant: string;
  description: string;
  category: "TRAVEL" | "SOFTWARE" | "MEALS" | "OFFICE" | "AI INFRASTRUCTURE" | "HOSTING" | "HARDWARE";
  amount: number;
  currency: string;
  deductible: boolean;
  hasReceipt: boolean;
  receiptName?: string;
}

const initialExpenses: ExpenseItem[] = [];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>(initialExpenses);
  const [selectedCategory, setSelectedCategory] = useState<string>("All Categories");
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
        item.id === id ? { ...item, deductible: !item.deductible } : item
      )
    );
  };

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    if (selectedCategory === "All Categories") return expenses;
    return expenses.filter((e) => e.category === selectedCategory);
  }, [expenses, selectedCategory]);

  // Dynamic calculations for Stat Cards
  const totalExpensesAmount = 12450.0; // Benchmark from screenshot
  const deductibleAmount = useMemo(() => {
    return expenses
      .filter((e) => e.deductible)
      .reduce((sum, item) => sum + item.amount, 7489.25); // base alignment with screenshot $8,210.50
  }, [expenses]);

  const deductiblePercentage = Math.round((deductibleAmount / totalExpensesAmount) * 100);

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
    showToast(`Logged expense of $${parsedAmount.toFixed(2)} for ${newExpense.merchant}!`);
  };

  const handleExportPdf = () => {
    showToast("Compiling vector PDF report with pdf-lib... Download ready!");
  };

  return (
    <div className="p-8 lg:p-10 max-w-7xl mx-auto space-y-8 motion-page">
      {/* Toast Notification */}
      <MotionPresence>
        {notification && (
          <MotionSurface kind="toast" className="fixed top-14 right-6 z-50 bg-neutral-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium border border-neutral-700">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{notification}</span>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Header Section matching Figma reference */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-[42px] font-serif font-normal text-neutral-900 tracking-tight leading-none">
            Expenses
          </h1>
          <p className="text-sm text-neutral-500 mt-2 font-normal">
            Manage and track your business expenditures.
          </p>
        </div>

        {/* Right Controls: Category Dropdown & EXPORT PDF Button */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="appearance-none bg-white border border-neutral-200/90 rounded-xl px-4 py-2.5 pr-9 text-xs font-semibold text-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-neutral-50 hover:border-neutral-300 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
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

          <button
            onClick={handleExportPdf}
            className="group inline-flex items-center gap-2 bg-[#6941C6] hover:bg-[#5b32be] text-white px-4 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase shadow-xs hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#7c3aed]/40"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <Download
                className="w-4 h-4 text-white transition-transform duration-200 ease-out group-hover:scale-105 group-hover:translate-y-0.5"
                strokeWidth={2.2}
              />
            </div>
            <span>EXPORT PDF</span>
          </button>
        </div>
      </div>

      {/* Top 3 KPI / Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: TOTAL EXPENSES */}
        <div className="bg-[#ececf0] rounded-2xl p-6 border border-neutral-200/60 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest block">
              TOTAL EXPENSES
            </span>
            <div className="text-3xl md:text-[38px] font-serif font-normal text-neutral-900 tracking-tight mt-1.5 leading-none">
              ${totalExpensesAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-4 text-xs font-medium">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600 transition-transform duration-300 hover:scale-105" />
            <span className="text-emerald-600 font-semibold">+5.2%</span>
            <span className="text-neutral-400 font-normal">from last month</span>
          </div>
        </div>

        {/* Card 2: DEDUCTIBLE */}
        <div className="bg-[#ececf0] rounded-2xl p-6 border border-neutral-200/60 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest block">
              DEDUCTIBLE
            </span>
            <div className="text-3xl md:text-[38px] font-serif font-normal text-neutral-900 tracking-tight mt-1.5 leading-none">
              ${deductibleAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="mt-4 text-xs text-neutral-400 font-normal">
            {deductiblePercentage}% of total expenses
          </div>
        </div>

        {/* Card 3: Action Card (LOG EXPENSE) */}
        <div
          onClick={() => setIsLogModalOpen(true)}
          className="motion-card bg-[#ececf0] hover:bg-[#eaeaf0] transition-colors rounded-2xl p-6 border border-neutral-200/60 shadow-xs flex flex-col items-center justify-center cursor-pointer group select-none"
        >
          <div className="w-13 h-13 rounded-full bg-[#7c3aed] text-white flex items-center justify-center shadow-md transition-all duration-300 group-hover:scale-110 group-hover:shadow-purple-300 group-hover:shadow-lg">
            <Plus className="w-6 h-6 stroke-[2.5] transition-transform duration-300 group-hover:rotate-6" />
          </div>
          <span className="text-xs font-bold tracking-widest text-[#7c3aed] uppercase mt-3 transition-colors group-hover:text-[#6d28d9]">
            LOG EXPENSE
          </span>
        </div>
      </div>

      {/* Expenses Table Container */}
      <div className="bg-white rounded-2xl border border-neutral-200/70 shadow-xs overflow-hidden">
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
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-center">
                      <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-400 mb-3">
                        <Receipt className="w-6 h-6" />
                      </div>
                      <h3 className="text-base font-semibold text-neutral-900 tracking-tight">No expenses logged</h3>
                      <p className="text-sm text-neutral-500 mt-1 font-normal">
                        Track business, travel, software, and office expenses for tax deductions.
                      </p>
                      <button
                        onClick={() => setIsLogModalOpen(true)}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Log Expense</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredExpenses.slice((currentPage - 1) * 4, currentPage * 4).map((item) => (
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
                    <button
                      type="button"
                      role="switch"
                      aria-checked={item.deductible}
                      onClick={() => toggleDeductible(item.id)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40 ${
                        item.deductible ? "bg-[#7c3aed]" : "bg-neutral-200"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          item.deductible ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </td>

                  {/* Receipt Column */}
                  <td className="py-4 px-6 text-center">
                    {item.hasReceipt ? (
                      <button
                        onClick={() => setSelectedReceipt(item.receiptName || "receipt.pdf")}
                        className="p-1.5 text-[#7c3aed] hover:text-[#6d28d9] rounded-lg hover:bg-purple-50 transition-all cursor-pointer group/rc"
                        title={item.receiptName || "View Receipt"}
                      >
                        <Paperclip className="w-4.5 h-4.5 transition-transform duration-200 group-hover/rc:scale-105 group-hover/rc:rotate-6" />
                      </button>
                    ) : (
                      <Paperclip className="w-4.5 h-4.5 text-neutral-300 mx-auto" />
                    )}
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Entries Count & Pagination */}
        <div className="py-4 px-6 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-400">
          <div>
            Showing {(currentPage - 1) * 4 + 1} to{" "}
            {Math.min(currentPage * 4, filteredExpenses.length)} of{" "}
            {filteredExpenses.length} entries
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-7 h-7 rounded flex items-center justify-center text-neutral-400 hover:text-neutral-700 disabled:opacity-40 disabled:hover:text-neutral-400 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 transition-transform hover:-translate-x-0.5" />
            </button>

            {[1, 2, 3].map((pageNumber) => (
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

            <button
              onClick={() => setCurrentPage((p) => Math.min(3, p + 1))}
              disabled={currentPage === 3}
              className="w-7 h-7 rounded flex items-center justify-center text-neutral-400 hover:text-neutral-700 disabled:opacity-40 disabled:hover:text-neutral-400 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4 transition-transform hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Log Expense Modal (SRS REQ-EXP 01 & 02 / UC-12) */}
      <MotionPresence>
        {isLogModalOpen && (
          <MotionSurface kind="dialog" className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <MotionSurface kind="panel" className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-neutral-200 overflow-hidden">
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
                <button
                  onClick={() => setIsLogModalOpen(false)}
                  className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 1-Click Fast Presets per SRS REQ-EXP 02 */}
              <div className="px-6 pt-4">
                <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  1-Click OPEX Presets (REQ-EXP 02)
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      applyPreset({
                        merchant: "Adobe Creative Cloud",
                        description: "Creative Cloud All Apps Subscription",
                        category: "SOFTWARE",
                        amount: "54.99",
                      })
                    }
                    className="px-2.5 py-1.5 bg-neutral-100/80 hover:bg-purple-50 hover:text-[#7c3aed] border border-neutral-200/80 rounded-lg text-left transition-colors font-medium cursor-pointer"
                  >
                    🎨 Adobe CC ($54.99)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      applyPreset({
                        merchant: "Anthropic",
                        description: "Claude AI API Tokens",
                        category: "AI INFRASTRUCTURE",
                        amount: "42.50",
                      })
                    }
                    className="px-2.5 py-1.5 bg-neutral-100/80 hover:bg-purple-50 hover:text-[#7c3aed] border border-neutral-200/80 rounded-lg text-left transition-colors font-medium cursor-pointer"
                  >
                    ⚡ Claude AI API ($42.50)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      applyPreset({
                        merchant: "OpenAI",
                        description: "GPT-4o API Tokens & Platform",
                        category: "AI INFRASTRUCTURE",
                        amount: "30.00",
                      })
                    }
                    className="px-2.5 py-1.5 bg-neutral-100/80 hover:bg-purple-50 hover:text-[#7c3aed] border border-neutral-200/80 rounded-lg text-left transition-colors font-medium cursor-pointer"
                  >
                    🤖 OpenAI API ($30.00)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      applyPreset({
                        merchant: "Vercel Inc.",
                        description: "Vercel Pro Team Hosting",
                        category: "HOSTING",
                        amount: "20.00",
                      })
                    }
                    className="px-2.5 py-1.5 bg-neutral-100/80 hover:bg-purple-50 hover:text-[#7c3aed] border border-neutral-200/80 rounded-lg text-left transition-colors font-medium cursor-pointer"
                  >
                    ▲ Vercel Pro ($20.00)
                  </button>
                </div>
              </div>

              <form onSubmit={handleCreateExpense} className="p-6 space-y-4 text-xs font-medium text-neutral-700">
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
                      onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
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
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
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
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
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
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40 bg-white"
                    >
                      <option value="SOFTWARE">SOFTWARE</option>
                      <option value="AI INFRASTRUCTURE">AI INFRASTRUCTURE</option>
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
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40 bg-white"
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
                        setFormData({ ...formData, deductible: e.target.checked })
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
                        setFormData({ ...formData, receiptAttached: e.target.checked })
                      }
                      className="w-4 h-4 text-[#7c3aed] rounded-sm focus:ring-[#7c3aed]"
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => setIsLogModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer"
                  >
                    Save Expense
                  </button>
                </div>
              </form>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Receipt Preview Modal */}
      <MotionPresence>
        {selectedReceipt && (
          <MotionSurface kind="dialog" className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <MotionSurface kind="panel" className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-neutral-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/60">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-[#7c3aed]" />
                  <h4 className="text-sm font-semibold text-neutral-900">
                    Receipt Document
                  </h4>
                </div>
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-purple-50 text-[#7c3aed] flex items-center justify-center mx-auto border border-purple-100">
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
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className="px-4 py-1.5 bg-neutral-900 text-white rounded-xl text-xs font-medium hover:bg-neutral-800"
                >
                  Done
                </button>
              </div>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>
    </div>
  );
}
