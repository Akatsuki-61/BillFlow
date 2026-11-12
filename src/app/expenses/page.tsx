"use client";

import { Dialog } from "@/components/ui/Dialog";

import { DataBreakdown, MonthlyBars } from "@/components/ui/DataGraphic";
import { recentMonths } from "@/lib/visual-metrics";

import {
  Button,
  PageHeader,
  Switch,
  EmptyState,
} from "@/components/ui/Workspace";

import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";
import { motion } from "motion/react";
import { SPRING_NAV_GLIDE } from "@/lib/motion";

import React, { useState, useMemo } from "react";
import {
  Download,
  Plus,
  Plane,
  Code2,
  Utensils,
  Package,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  DollarSign,
  Cpu,
  Server,
  Search,
  Receipt,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { useExpenses, useData } from "@/lib/data/DataProvider";
import type { ExpenseItem } from "@/types/expenses";
import type { Currency } from "@/types/billing";
import { formatCents, formatDateDisplay } from "@/lib/format";
import { SelectDropdown, SelectOption } from "@/components/ui/SelectDropdown";

function AdobeBrandIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`${className} shrink-0`}
    >
      <path
        d="M14.86 3H22v18l-7.14-18ZM9.14 3H2v18L9.14 3ZM12 9.66 16.57 21h-3.12l-1.38-3.6H8.95L12 9.66Z"
        fill="#EB1000"
      />
    </svg>
  );
}

function AnthropicBrandIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`${className} shrink-0`}
    >
      <path
        d="M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96Zm-7.258 0h3.767L16.906 20.48h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522Zm4.132 10.595L8.453 7.687l-2.248 6.428h4.496Z"
        fill="#D97757"
      />
    </svg>
  );
}

function OpenAIBrandIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`${className} shrink-0`}
    >
      <path
        d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729Zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944Zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464ZM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872Zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667Zm2.0107-3.0231-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66ZM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3975.6813Zm1.0976-2.3654 2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"
        fill="#10A37F"
      />
    </svg>
  );
}

function VercelBrandIcon({
  className = "w-3.5 h-3.5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`${className} shrink-0`}
    >
      <path d="M12 2 24 22.7846H0L12 2Z" fill="currentColor" />
    </svg>
  );
}

const EXPENSE_CATEGORY_OPTIONS: SelectOption[] = [
  { value: "All Categories", label: "All Categories" },
  { value: "SOFTWARE", label: "SOFTWARE" },
  { value: "AI INFRASTRUCTURE", label: "AI INFRASTRUCTURE" },
  { value: "HOSTING", label: "HOSTING" },
  { value: "TRAVEL", label: "TRAVEL" },
  { value: "MEALS", label: "MEALS" },
  { value: "OFFICE", label: "OFFICE" },
  { value: "HARDWARE", label: "HARDWARE" },
];

export default function ExpensesPage() {
  const [selectedCategory, setSelectedCategory] =
    useState<string>("All Categories");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<{
    id: string;
    merchant: string;
  } | null>(null);
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
  const [hasExpenseDraft, setHasExpenseDraft] = useState(false);

  const isExpenseFormDirty = () => {
    return Boolean(
      formData.merchant.trim() ||
      formData.description.trim() ||
      formData.amount.trim(),
    );
  };

  const saveExpenseDraft = () => {
    if (!isExpenseFormDirty()) return;
    try {
      localStorage.setItem("billflow_draft_expense", JSON.stringify(formData));
      setHasExpenseDraft(true);
    } catch {}
  };

  const clearExpenseDraft = () => {
    try {
      localStorage.removeItem("billflow_draft_expense");
    } catch {}
    setHasExpenseDraft(false);
  };

  const handleRestoreExpenseDraft = () => {
    try {
      const saved = localStorage.getItem("billflow_draft_expense");
      if (!saved) return;
      const draft = JSON.parse(saved);
      setFormData((prev) => ({ ...prev, ...draft }));
      showToast("Draft restored");
    } catch {}
  };

  const closeLogExpenseModal = (saveDraft = true) => {
    if (saveDraft) {
      saveExpenseDraft();
    }
    setIsLogModalOpen(false);
  };

  const openLogExpenseModal = () => {
    try {
      const saved = localStorage.getItem("billflow_draft_expense");
      setHasExpenseDraft(Boolean(saved));
    } catch {
      setHasExpenseDraft(false);
    }
    setIsLogModalOpen(true);
  };

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

  const handleConfirmDelete = async () => {
    if (!deletingExpense) return;
    try {
      await deleteExpense(deletingExpense.id);
      showToast(`Expense for ${deletingExpense.merchant} deleted.`);
      setDeletingExpense(null);
    } catch (err) {
      console.error(err);
      showToast("Failed to delete expense.");
    }
  };

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
        description:
          formData.description.trim() || "General operational expense",
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

      clearExpenseDraft();
      closeLogExpenseModal(false);
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
        showToast(
          err instanceof Error ? err.message : "Could not open receipt file",
        );
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

  const getCategoryIcon = (category: string, merchant?: string) => {
    const m = (merchant || "").toLowerCase();
    if (m.includes("adobe")) return <AdobeBrandIcon className="w-4 h-4" />;
    if (m.includes("anthropic") || m.includes("claude"))
      return <AnthropicBrandIcon className="w-4 h-4" />;
    if (m.includes("openai") || m.includes("chatgpt"))
      return <OpenAIBrandIcon className="w-4 h-4" />;
    if (m.includes("vercel"))
      return <VercelBrandIcon className="w-3.5 h-3.5" />;

    const cat = category.toUpperCase();
    if (cat.includes("TRAVEL")) return <Plane className="w-4.5 h-4.5" />;
    if (cat.includes("MEALS") || cat.includes("FOOD"))
      return <Utensils className="w-4.5 h-4.5" />;
    if (cat.includes("OFFICE") || cat.includes("HARDWARE"))
      return <Package className="w-4.5 h-4.5" />;
    if (cat.includes("AI")) return <Cpu className="w-4.5 h-4.5 text-accent" />;
    if (cat.includes("HOSTING") || cat.includes("SERVER"))
      return <Server className="w-4.5 h-4.5" />;
    if (cat.includes("SOFTWARE") || cat.includes("DEV"))
      return <Code2 className="w-4.5 h-4.5" />;
    return <DollarSign className="w-4.5 h-4.5" />;
  };

  const searchedExpenses = useMemo(() => {
    if (!searchQuery.trim()) return expenses;
    const q = searchQuery.toLowerCase().trim();
    return expenses.filter(
      (e) =>
        e.merchant.toLowerCase().includes(q) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        e.category.toLowerCase().includes(q),
    );
  }, [expenses, searchQuery]);

  const itemsPerPage = 8;
  const paginatedExpenses = useMemo(() => {
    return searchedExpenses.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage,
    );
  }, [searchedExpenses, currentPage]);

  return (
    <div className="workspace-page motion-page">
      {/* Toast Notification */}
      <MotionPresence>
        {notification && (
          <MotionSurface
            kind="toast"
            className="fixed top-14 right-6 z-[9999] bg-surface-neutral-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium border border-line-neutral-700"
          >
            <CheckCircle2 className="w-5 h-5 text-content-emerald-400 shrink-0" />
            <span>{notification}</span>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Page Header */}
      <PageHeader
        title="Expenses"
        description="Keep track of software, hosting and day-to-day business costs."
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-content-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search expenses..."
              className="ui-field ui-search-input pl-9 pr-8 text-xs font-medium w-44 sm:w-52 border border-line-neutral-200"
              style={{ paddingLeft: "38px" }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-neutral-400 hover:text-content-neutral-700 p-0.5 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <SelectDropdown
            value={selectedCategory}
            onChange={(val) => {
              setSelectedCategory(val);
              setCurrentPage(1);
            }}
            options={EXPENSE_CATEGORY_OPTIONS}
            buttonClassName="ui-field h-[38px] px-3.5 flex items-center justify-between gap-2 border border-line-neutral-200/90 font-semibold text-content-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-line-neutral-300 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/40 w-44"
            menuClassName="w-48"
          />

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
        <Button variant="primary" onClick={openLogExpenseModal}>
          <Plus />
          Log Expense
        </Button>
      </PageHeader>

      {/* =====================================================================
          ZENTRA 3-CARD EXPENSES BENTO HEADER ROW
         ===================================================================== */}
      {(() => {
        const records = allExpenses.filter(
          (expense) => expense.currency === activeCurrency,
        );
        const total = records.reduce(
          (sum, expense) => sum + expense.amountCents,
          0,
        );
        const deductible = records
          .filter((expense) => expense.deductible)
          .reduce((sum, expense) => sum + expense.amountCents, 0);
        const receipts = records.filter(
          (expense) => expense.attachments?.length,
        ).length;
        const money = (value: number) => formatCents(value, activeCurrency);
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <section className="ui-card p-6 space-y-5">
              <h2>Operating Expenses</h2>
              <div>
                <div className="summary-value">{money(total)}</div>
                <p className="summary-caption">
                  {records.length} expenses · {activeCurrency}
                </p>
              </div>
              <DataBreakdown
                label="Expenses by deductibility"
                total={total}
                rows={[
                  {
                    label: "Marked deductible",
                    value: deductible,
                    display: money(deductible),
                    tone: "green",
                  },
                  {
                    label: "Other expenses",
                    value: total - deductible,
                    display: money(total - deductible),
                  },
                ]}
              />
            </section>
            <section className="ui-card p-6 space-y-5">
              <h2>Supporting Records</h2>
              <div>
                <div className="summary-value">
                  {receipts}/{records.length}
                </div>
                <p className="summary-caption">
                  Expenses with an attached receipt
                </p>
              </div>
              <DataBreakdown
                label="Receipt coverage"
                total={records.length}
                rows={[
                  {
                    label: "With receipts",
                    value: receipts,
                    display: `${receipts} expenses`,
                    tone: "green",
                  },
                  {
                    label: "Without receipts",
                    value: records.length - receipts,
                    display: `${records.length - receipts} expenses`,
                    tone: "pink",
                  },
                ]}
              />
            </section>
            <section className="ui-card p-6 space-y-5">
              <h2>Monthly Spending</h2>
              <p className="summary-caption">
                Recorded by expense date · {activeCurrency}
              </p>
              <MonthlyBars
                label="Expenses · last six months"
                formatValue={money}
                points={recentMonths().map((month) => ({
                  ...month,
                  value: records
                    .filter((expense) =>
                      expense.incurredAt.startsWith(month.key),
                    )
                    .reduce((sum, expense) => sum + expense.amountCents, 0),
                }))}
              />
            </section>
          </div>
        );
      })()}

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
                        onClick={openLogExpenseModal}
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
                  const hasReceipt = Boolean(
                    item.attachments && item.attachments.length > 0,
                  );
                  const receiptName = hasReceipt
                    ? item.attachments![0].originalName
                    : null;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-surface-neutral-50/70 transition-colors group"
                    >
                      {/* Icon */}
                      <td className="py-4 px-6">
                        <div className="w-10 h-10 rounded-xl bg-surface-neutral-100/90 border border-line-neutral-200/60 flex items-center justify-center text-content-neutral-600 transition-all duration-300 group-hover:bg-accent-faint group-hover:border-border-accent group-hover:text-accent">
                          {getCategoryIcon(item.category, item.merchant)}
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
                          title={
                            hasReceipt
                              ? `View ${receiptName}`
                              : "Attach Receipt file"
                          }
                        >
                          <Paperclip
                            className={`w-4.5 h-4.5 ${hasReceipt ? "text-accent" : "text-content-neutral-400"}`}
                          />
                        </Button>
                      </td>

                      {/* Delete */}
                      <td className="py-4 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setDeletingExpense({
                              id: item.id,
                              merchant: item.merchant,
                            })
                          }
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
            {searchedExpenses.length === 0
              ? 0
              : (currentPage - 1) * itemsPerPage + 1}{" "}
            to {Math.min(currentPage * itemsPerPage, searchedExpenses.length)}{" "}
            of {searchedExpenses.length} entries
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
              {
                length: Math.max(1, Math.ceil(expenses.length / itemsPerPage)),
              },
              (_, i) => i + 1,
            ).map((pageNumber) => {
              const isActive = currentPage === pageNumber;
              return (
                <button
                  key={pageNumber}
                  onClick={() => setCurrentPage(pageNumber)}
                  className={`relative w-7 h-7 rounded flex items-center justify-center text-xs font-semibold transition-colors cursor-pointer active:scale-[0.94] ${
                    isActive
                      ? "text-white"
                      : "text-content-neutral-600 hover:bg-surface-neutral-100"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="expenses-page-pill"
                      transition={SPRING_NAV_GLIDE}
                      className="absolute inset-0 rounded bg-accent-deep-solid shadow-xs"
                    />
                  )}
                  <span className="relative z-10">{pageNumber}</span>
                </button>
              );
            })}

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
          <Dialog onClose={() => closeLogExpenseModal()} width={620}>
            <div className="app-dialog-header">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-content-neutral-900">
                    Log Business Expense
                  </h3>
                  <p className="text-xs text-content-neutral-400">
                    Track a business cost and keep its receipt.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasExpenseDraft && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="small"
                    onClick={handleRestoreExpenseDraft}
                    className="text-xs gap-1.5 font-medium border-accent/40 text-accent hover:bg-accent/10"
                    title="Restore previously typed expense draft"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </Button>
                )}
              </div>
            </div>
            <div className="app-dialog-banner">
              {/* Presets */}
              <div>
                <label className="block text-[11px] font-semibold text-content-neutral-400 uppercase tracking-wider mb-2">
                  Quick expense presets
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
                    className="justify-start gap-2.5 px-3"
                  >
                    <AdobeBrandIcon className="w-4 h-4" />
                    <span>Adobe CC ($54.99)</span>
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
                    className="justify-start gap-2.5 px-3"
                  >
                    <AnthropicBrandIcon className="w-4 h-4" />
                    <span>Claude AI API ($42.50)</span>
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
                    className="justify-start gap-2.5 px-3"
                  >
                    <OpenAIBrandIcon className="w-4 h-4" />
                    <span>OpenAI API ($30.00)</span>
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
                    className="justify-start gap-2.5 px-3"
                  >
                    <VercelBrandIcon className="w-3.5 h-3.5" />
                    <span>Vercel Pro ($20.00)</span>
                  </Button>
                </div>
              </div>
            </div>
            <form onSubmit={handleCreateExpense} className="app-dialog-form">
              <div className="app-dialog-body">
                {/* Row 1: Merchant & Category */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block mb-1.5 text-content-neutral-700 font-semibold">
                      Payee / Merchant{" "}
                      <span className="text-content-rose-500 font-bold">*</span>
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
                </div>

                {/* Row 2: Amount & Date */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block mb-1.5 text-content-neutral-700 font-semibold">
                      Amount{" "}
                      <span className="text-content-rose-500 font-bold">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={formData.currency}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            currency: e.target.value as Currency,
                          })
                        }
                        className="ui-field h-10 w-24 shrink-0 pl-2.5 pr-6 border border-line-neutral-200 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-accent/40"
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
                        className="ui-field h-10 w-full flex-1 px-3 border border-line-neutral-200 focus:outline-none focus:ring-2 focus:ring-accent/40 font-mono"
                      />
                    </div>
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

                {/* Row 3: Description */}
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
              </div>
              <div className="app-dialog-footer">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => closeLogExpenseModal()}
                >
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Save Expense
                </Button>
              </div>
            </form>
          </Dialog>
        )}
      </MotionPresence>

      {/* Delete Expense Confirmation Modal */}
      <MotionPresence>
        {deletingExpense && (
          <Dialog onClose={() => setDeletingExpense(null)} width={460} compact>
            <div className="app-dialog-body app-dialog-confirmation">
              <div className="w-12 h-12 rounded-xl bg-surface-rose-50 text-content-rose-600 flex items-center justify-center mx-auto mb-3.5">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-content-neutral-900">
                Delete Expense?
              </h3>
              <p className="text-xs text-content-neutral-500 mt-1">
                Are you sure you want to delete expense for{" "}
                <strong className="text-content-neutral-900">
                  {deletingExpense.merchant}
                </strong>
                ? This action cannot be undone.
              </p>
            </div>
            <div className="app-dialog-footer">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setDeletingExpense(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                type="button"
                onClick={handleConfirmDelete}
              >
                Delete
              </Button>
            </div>
          </Dialog>
        )}
      </MotionPresence>
    </div>
  );
}
