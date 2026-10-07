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
  Receipt,
  Trash2,
} from "lucide-react";
import { useExpenses, useData } from "@/lib/data/DataProvider";
import type { ExpenseItem } from "@/types/expenses";
import type { Currency } from "@/types/billing";
import { formatCents, formatDateDisplay, getCurrencySymbol } from "@/lib/format";

export default function ExpensesPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All Categories");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const {
    expenses,
    allExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
    attachExpenseReceipt,
  } = useExpenses({ category: selectedCategory });

  const { workflow, activeCurrency } = useData();

  const [formData, setFormData] = useState({
    merchant: "",
    description: "",
    category: "SOFTWARE",
    amount: "",
    currency: activeCurrency || ("LKR" as Currency),
    date: new Date().toISOString().slice(0, 10),
    deductible: true,
    receiptAttached: false,
  });

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const toggleDeductible = async (item: ExpenseItem) => {
    try {
      await updateExpense(item.id, { deductible: !item.deductible });
      showToast(`Updated tax deductible status for ${item.merchant}`);
    } catch (err) {
      console.error(err);
      showToast("Failed to update expense");
    }
  };

  const handleDeleteExpense = async (id: string, merchant: string) => {
    if (confirm(`Are you sure you want to delete expense for ${merchant}?`)) {
      try {
        await deleteExpense(id);
        showToast(`Expense for ${merchant} deleted.`);
      } catch (err) {
        console.error(err);
        showToast("Failed to delete expense.");
      }
    }
  };

  // Stat calculations
  const totalExpensesCents = useMemo(() => {
    return allExpenses.reduce((sum, item) => sum + (item.amountCents || 0), 0);
  }, [allExpenses]);

  const deductibleCents = useMemo(() => {
    return allExpenses
      .filter((e) => e.deductible)
      .reduce((sum, item) => sum + (item.amountCents || 0), 0);
  }, [allExpenses]);

  const deductiblePercentage =
    totalExpensesCents > 0
      ? Math.round((deductibleCents / totalExpensesCents) * 100)
      : 0;

  const applyPreset = (preset: {
    merchant: string;
    description: string;
    category: string;
    amount: string;
    currency?: Currency;
  }) => {
    setFormData((prev) => ({
      ...prev,
      merchant: preset.merchant,
      description: preset.description,
      category: preset.category,
      amount: preset.amount,
      currency: preset.currency || activeCurrency || "LKR",
      deductible: true,
    }));
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.merchant.trim() || !formData.amount) return;

    const parsedAmount = parseFloat(formData.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    const amountCents = Math.round(parsedAmount * 100);

    try {
      const created = await createExpense({
        merchant: formData.merchant.trim(),
        description: formData.description.trim() || "General operational expense",
        category: formData.category,
        amountCents,
        currency: (formData.currency as Currency) || activeCurrency || "LKR",
        incurredAt: formData.date,
        deductible: formData.deductible,
      });

      if (formData.receiptAttached && created?.id) {
        const requestId = crypto.randomUUID();
        try {
          await attachExpenseReceipt(created.id, requestId);
        } catch (attErr) {
          console.error("Receipt attach cancelled or failed:", attErr);
        }
      }

      setIsLogModalOpen(false);
      setFormData({
        merchant: "",
        description: "",
        category: "SOFTWARE",
        amount: "",
        currency: activeCurrency || "LKR",
        date: new Date().toISOString().slice(0, 10),
        deductible: true,
        receiptAttached: false,
      });
      showToast(
        `Logged expense of ${formatCents(amountCents, formData.currency)} for ${created.merchant}!`,
      );
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Failed to save expense");
    }
  };

  const handleAttachReceiptToRow = async (item: ExpenseItem) => {
    if (item.attachments && item.attachments.length > 0) {
      try {
        await workflow.attachments.open(item.attachments[0].id);
      } catch (err) {
        console.error(err);
        showToast(err instanceof Error ? err.message : "Could not open receipt file");
      }
    } else {
      try {
        const requestId = crypto.randomUUID();
        const attached = await attachExpenseReceipt(item.id, requestId);
        if (attached) {
          showToast(`Attached receipt ${attached.originalName}`);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleExportPdf = () => {
    window.print();
  };

  const getCategoryIcon = (category: string) => {
    const cat = category.toUpperCase();
    if (cat.includes("TRAVEL")) return <Plane className="w-4.5 h-4.5" />;
    if (cat.includes("MEALS") || cat.includes("FOOD")) return <Utensils className="w-4.5 h-4.5" />;
    if (cat.includes("OFFICE") || cat.includes("HARDWARE")) return <Package className="w-4.5 h-4.5" />;
    if (cat.includes("AI")) return <Sparkles className="w-4.5 h-4.5 text-accent" />;
    if (cat.includes("HOSTING") || cat.includes("SERVER")) return <Server className="w-4.5 h-4.5" />;
    if (cat.includes("SOFTWARE") || cat.includes("DEV")) return <Code2 className="w-4.5 h-4.5" />;
    return <DollarSign className="w-4.5 h-4.5" />;
  };

  const itemsPerPage = 8;
  const paginatedExpenses = useMemo(() => {
    return expenses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [expenses, currentPage]);

  return (
    <div className="workspace-page motion-page">
      {/* Toast Notification */}
      <MotionPresence>
        {notification && (
          <MotionSurface
            kind="toast"
            className="fixed top-14 right-6 z-50 bg-surface-neutral-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium border border-line-neutral-700"
          >
            <CheckCircle2 className="w-5 h-5 text-content-emerald-400 shrink-0" />
            <span>{notification}</span>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Page Header */}
      <PageHeader
        title="Expenses"
        description="Manage and track your business expenditures in the SQLite ledger."
      >

        <div className="flex items-center gap-3">
          <span
            className="analytics-currency-badge"
            title="System currency configured in Settings"
          >
            Currency: {activeCurrency} ({getCurrencySymbol(activeCurrency).trim()})
          </span>

          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="ui-field appearance-none border border-line-neutral-200/90 px-4 pr-9 font-semibold text-content-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-line-neutral-300 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              <option value="All Categories">All Categories</option>
              <option value="SOFTWARE">SOFTWARE</option>
              <option value="AI INFRASTRUCTURE">AI INFRASTRUCTURE</option>
              <option value="HOSTING">HOSTING</option>
              <option value="TRAVEL">TRAVEL</option>
              <option value="MEALS">MEALS</option>
              <option value="OFFICE">OFFICE</option>
              <option value="HARDWARE">HARDWARE</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-content-neutral-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200" />
          </div>

          <Button variant="secondary" onClick={handleExportPdf}>
            <div className="w-4 h-4 flex items-center justify-center">
              <Download
                className="w-4 h-4 transition-transform duration-200 ease-out group-hover:scale-105 group-hover:translate-y-0.5"
                strokeWidth={2.2}
              />
            </div>
            <span>Export Report</span>
          </Button>
        </div>
        <Button variant="primary" onClick={() => setIsLogModalOpen(true)}>
          <Plus />
          Log Expense
        </Button>
      </PageHeader>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Total Expenses"
          value={formatCents(totalExpensesCents, activeCurrency)}
          footer="logged business expenses"
        />
        <MetricCard
          label="Deductible"
          value={formatCents(deductibleCents, activeCurrency)}
          footer={`${deductiblePercentage}% of total expenses`}
        />
        <MetricCard
          label="Logged Expenses"
          value={allExpenses.length}
          footer="entries in SQLite ledger"
        />
      </div>

      {/* Expenses Table */}
      <div className="ui-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line-neutral-200/60 bg-surface-bright">
                <th className="w-16 py-3.5 px-6"></th>
                <th className="py-3.5 px-4 text-[11px] font-semibold text-content-neutral-400 uppercase tracking-widest">
                  DATE
                </th>
                <th className="py-3.5 px-4 text-[11px] font-semibold text-content-neutral-400 uppercase tracking-widest">
                  MERCHANT / DESCRIPTION
                </th>
                <th className="py-3.5 px-4 text-[11px] font-semibold text-content-neutral-400 uppercase tracking-widest">
                  CATEGORY
                </th>
                <th className="py-3.5 px-4 text-[11px] font-semibold text-content-neutral-400 uppercase tracking-widest">
                  AMOUNT
                </th>
                <th className="py-3.5 px-4 text-[11px] font-semibold text-content-neutral-400 uppercase tracking-widest text-center">
                  DEDUCTIBLE
                </th>
                <th className="py-3.5 px-6 text-[11px] font-semibold text-content-neutral-400 uppercase tracking-widest text-center">
                  RECEIPT
                </th>
                <th className="w-12 py-3.5 px-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-neutral-100 text-xs">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-0 text-center">
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
                paginatedExpenses.map((item) => {
                  const hasReceipt = Boolean(item.attachments && item.attachments.length > 0);
                  const receiptName = hasReceipt ? item.attachments![0].originalName : null;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-surface-neutral-50/70 transition-colors group"
                    >
                      {/* Icon */}
                      <td className="py-4 px-6">
                        <div className="w-10 h-10 rounded-xl bg-surface-neutral-100/90 border border-line-neutral-200/60 flex items-center justify-center text-content-neutral-600 transition-all duration-300 group-hover:bg-accent-faint group-hover:border-border-accent group-hover:text-accent">
                          {getCategoryIcon(item.category)}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-4 px-4 text-content-neutral-600 font-medium whitespace-nowrap">
                        {formatDateDisplay(item.incurredAt)}
                      </td>

                      {/* Merchant & Description */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-content-neutral-900 text-sm">
                          {item.merchant}
                        </div>
                        <div className="text-content-neutral-400 text-xs mt-0.5 max-w-md truncate font-normal">
                          {item.description || "Operational expense"}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider text-content-neutral-600 bg-surface-neutral-100 border border-line-neutral-200 uppercase">
                          {item.category}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="font-bold text-sm text-content-neutral-900 font-mono">
                          {formatCents(item.amountCents, item.currency)}
                        </span>
                      </td>

                      {/* Deductible Switch */}
                      <td className="py-4 px-4 text-center">
                        <Switch
                          checked={item.deductible}
                          onChange={() => toggleDeductible(item)}
                          label={`Deductible expense from ${item.merchant}`}
                        />
                      </td>

                      {/* Receipt */}
                      <td className="py-4 px-6 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleAttachReceiptToRow(item)}
                          title={hasReceipt ? `View ${receiptName}` : "Attach Receipt file"}
                        >
                          <Paperclip className={`w-4.5 h-4.5 ${hasReceipt ? "text-accent" : "text-content-neutral-400"}`} />
                        </Button>
                      </td>

                      {/* Delete */}
                      <td className="py-4 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteExpense(item.id, item.merchant)}
                          title="Delete expense"
                        >
                          <Trash2 className="w-4 h-4 text-content-neutral-400 hover:text-red-600 transition-colors" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer & Pagination */}
        <div className="py-4 px-6 border-t border-line-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-content-neutral-400">
          <div>
            Showing{" "}
            {expenses.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, expenses.length)} of{" "}
            {expenses.length} entries
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              aria-label="Previous page"
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {Array.from(
              { length: Math.max(1, Math.ceil(expenses.length / itemsPerPage)) },
              (_, i) => i + 1,
            ).map((pageNumber) => (
              <button
                key={pageNumber}
                onClick={() => setCurrentPage(pageNumber)}
                className={`w-7 h-7 rounded flex items-center justify-center text-xs font-semibold transition-all cursor-pointer ${
                  currentPage === pageNumber
                    ? "bg-accent-deep-solid text-white shadow-xs"
                    : "text-content-neutral-600 hover:bg-surface-neutral-100"
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
                    Math.max(1, Math.ceil(expenses.length / itemsPerPage)),
                    p + 1,
                  ),
                )
              }
              disabled={
                currentPage >=
                Math.max(1, Math.ceil(expenses.length / itemsPerPage))
              }
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Log Expense Modal */}
      <MotionPresence>
        {isLogModalOpen && (
          <MotionSurface
            kind="dialog"
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <MotionSurface
              onDismiss={() => setIsLogModalOpen(false)}
              kind="panel"
              className="bg-surface rounded-2xl w-full max-w-lg shadow-2xl border border-line-neutral-200 overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-line-neutral-100 flex items-center justify-between bg-surface-neutral-50/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-content-neutral-900">
                      Log Business Expense
                    </h3>
                    <p className="text-xs text-content-neutral-400">
                      SQLite Ledger Expense Entry
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

              {/* Presets */}
              <div className="px-6 pt-4">
                <label className="block text-[11px] font-semibold text-content-neutral-400 uppercase tracking-wider mb-2">
                  1-Click OPEX Presets
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
                        currency: "USD",
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
                        currency: "USD",
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
                        currency: "USD",
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
                        currency: "USD",
                      })
                    }
                  >
                    ▲ Vercel Pro ($20.00)
                  </Button>
                </div>
              </div>

              <form
                onSubmit={handleCreateExpense}
                className="p-6 space-y-4 text-xs font-medium text-content-neutral-700"
              >
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block mb-1.5 text-content-neutral-700 font-semibold">
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
                      className="ui-field w-full px-3.5 border border-line-neutral-200 focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  </div>

                  <div>
                    <label className="block mb-1.5 text-content-neutral-700 font-semibold">
                      Amount *
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={formData.currency}
                        onChange={(e) =>
                          setFormData({ ...formData, currency: e.target.value as Currency })
                        }
                        className="ui-field h-10 w-28 shrink-0 pl-3 pr-8 border border-line-neutral-200 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-accent/40"
                      >
                        <option value="LKR">LKR</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                        <option value="CAD">CAD</option>
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="0.00"
                        value={formData.amount}
                        onChange={(e) =>
                          setFormData({ ...formData, amount: e.target.value })
                        }
                        className="ui-field h-10 flex-1 px-3.5 border border-line-neutral-200 focus:outline-none focus:ring-2 focus:ring-accent/40 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 text-content-neutral-700 font-semibold">
                    Expense Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Monthly developer tools subscription"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="ui-field w-full px-3.5 border border-line-neutral-200 focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block mb-1.5 text-content-neutral-700 font-semibold">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          category: e.target.value,
                        })
                      }
                      className="ui-field w-full px-3 border border-line-neutral-200 focus:outline-none focus:ring-2 focus:ring-accent/40"
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
                    <label className="block mb-1.5 text-content-neutral-700 font-semibold">
                      Expense Date
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) =>
                        setFormData({ ...formData, date: e.target.value })
                      }
                      className="ui-field w-full px-3 border border-line-neutral-200 focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-surface-neutral-50 rounded-xl border border-line-neutral-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-content-neutral-800 block text-xs">
                        Tax Deductible
                      </span>
                      <span className="text-content-neutral-400 text-[11px] font-normal">
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
                      className="w-4 h-4 text-accent rounded-sm focus:ring-accent"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-line-neutral-200/60">
                    <div>
                      <span className="font-semibold text-content-neutral-800 block text-xs">
                        Attach Receipt
                      </span>
                      <span className="text-content-neutral-400 text-[11px] font-normal">
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
                      className="w-4 h-4 text-accent rounded-sm focus:ring-accent"
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-line-neutral-100">
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
    </div>
  );
}
