"use client";

import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";
import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Receipt,
  ArrowDown,
  MoreHorizontal,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  X,
  Building,
  AlertCircle,
} from "lucide-react";
import { useInvoices, useClients } from "@/lib/data/DataProvider";
import { formatCents, formatDateDisplay, parseAmountToCents, getCurrencySymbol } from "@/lib/format";
import type { InvoiceWithClient, InvoiceStatus, Currency } from "@/types/billing";

type FilterTab = "All Invoices" | "Drafts" | "Overdue" | "Paid";

function InvoicesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    invoices: allInvoices,
    isLoading: invoicesLoading,
    createInvoice,
    updateInvoice,
    setInvoiceStatus,
    deleteInvoice,
    getNextInvoiceCode,
  } = useInvoices();

  const { clients, isLoading: clientsLoading } = useClients();

  const [activeTab, setActiveTab] = useState<FilterTab>("All Invoices");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [highlightedInvoiceId, setHighlightedInvoiceId] = useState<string | null>(null);

  // Add Invoice Modal state
  const [showAddInvoiceModal, setShowAddInvoiceModal] = useState<boolean>(false);
  const [newCode, setNewCode] = useState("");
  const [newClientId, setNewClientId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCurrency, setNewCurrency] = useState<Currency>("LKR");
  const [newDueDate, setNewDueDate] = useState("");
  const [newStatus, setNewStatus] = useState<InvoiceStatus>("UNPAID");
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  // Edit Invoice Modal state
  const [editingInvoice, setEditingInvoice] = useState<InvoiceWithClient | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editClientId, setEditClientId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCurrency, setEditCurrency] = useState<Currency>("LKR");
  const [editDueDate, setEditDueDate] = useState("");
  const [editStatus, setEditStatus] = useState<InvoiceStatus>("UNPAID");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Delete Confirm Modal state
  const [deletingInvoice, setDeletingInvoice] = useState<InvoiceWithClient | null>(null);

  // Toast feedback state
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3600);
  };

  // Check URL search parameters
  const clientFilterParam = searchParams.get("client");
  const isNewParam = searchParams.get("new");
  const invoiceHighlightParam = searchParams.get("invoice");

  useEffect(() => {
    if (invoiceHighlightParam) {
      setHighlightedInvoiceId(invoiceHighlightParam);
      const timer = setTimeout(() => {
        setHighlightedInvoiceId(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [invoiceHighlightParam]);

  useEffect(() => {
    if (isNewParam === "1") {
      setShowAddInvoiceModal(true);
      if (clientFilterParam) {
        setNewClientId(clientFilterParam);
        const match = clients.find((c) => c.id === clientFilterParam);
        if (match) setNewCurrency(match.currency);
      }
    }
  }, [isNewParam, clientFilterParam, clients]);

  // When opening Add Invoice modal, prefill the next code
  const handleOpenAddModal = async () => {
    try {
      const code = await getNextInvoiceCode();
      setNewCode(code);
    } catch {
      setNewCode(`INV-${new Date().getFullYear()}-001`);
    }

    if (clientFilterParam) {
      setNewClientId(clientFilterParam);
      const match = clients.find((c) => c.id === clientFilterParam);
      if (match) setNewCurrency(match.currency);
    } else if (clients.length > 0 && !newClientId) {
      setNewClientId(clients[0].id);
      setNewCurrency(clients[0].currency);
    }

    setShowAddInvoiceModal(true);
  };

  // Filter invoices according to selected client and tabs
  const filteredInvoices = allInvoices.filter((inv) => {
    if (clientFilterParam && inv.clientId !== clientFilterParam) {
      return false;
    }
    if (activeTab === "Drafts") return inv.status === "DRAFT";
    if (activeTab === "Overdue") return inv.status === "OVERDUE";
    if (activeTab === "Paid") return inv.status === "PAID";
    return true;
  });

  const activeClientFilterObj = clientFilterParam
    ? clients.find((c) => c.id === clientFilterParam)
    : null;

  // Compute live totals for metric cards
  const primaryCurrency = clients[0]?.currency || "LKR";

  const totalOutstandingCents = allInvoices.reduce((sum, inv) => {
    if (inv.status !== "DRAFT") {
      return sum + Math.max(0, inv.amountCents - inv.paidCents);
    }
    return sum;
  }, 0);

  const totalOverdueCents = allInvoices.reduce((sum, inv) => {
    if (inv.status === "OVERDUE") {
      return sum + Math.max(0, inv.amountCents - inv.paidCents);
    }
    return sum;
  }, 0);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredInvoices.map((inv) => inv.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const isAllSelected =
    filteredInvoices.length > 0 &&
    filteredInvoices.every((inv) => selectedIds.includes(inv.id));

  // Quick Change Status
  const handleChangeStatus = async (id: string, nextStatus: InvoiceStatus) => {
    try {
      await setInvoiceStatus(id, nextStatus);
      setOpenMenuId(null);
      showToast(`Invoice status updated to ${nextStatus}.`);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String(err.message) : "Failed to update status";
      showToast(msg, "error");
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (inv: InvoiceWithClient) => {
    setEditingInvoice(inv);
    setEditCode(inv.code);
    setEditClientId(inv.clientId);
    setEditTitle(inv.title || "");
    setEditAmount(((inv.amountCents || 0) / 100).toFixed(2));
    setEditCurrency(inv.currency);
    setEditDueDate(inv.dueDate || "");
    setEditStatus(inv.status);
    setOpenMenuId(null);
  };

  // Save Edit Changes
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;

    setIsSubmittingEdit(true);
    try {
      const amountCents = parseAmountToCents(editAmount);
      await updateInvoice(editingInvoice.id, {
        code: editCode.trim(),
        clientId: editClientId,
        title: editTitle.trim() || undefined,
        amountCents,
        currency: editCurrency,
        dueDate: editDueDate || null,
        status: editStatus,
      });

      setEditingInvoice(null);
      showToast("Invoice updated successfully!");
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String(err.message) : "Failed to save invoice";
      showToast(msg, "error");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Execute Delete
  const confirmDelete = async () => {
    if (!deletingInvoice) return;
    try {
      await deleteInvoice(deletingInvoice.id);
      setSelectedIds((prev) => prev.filter((id) => id !== deletingInvoice.id));
      showToast(`Invoice ${deletingInvoice.code} deleted.`);
      setDeletingInvoice(null);
      setOpenMenuId(null);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String(err.message) : "Failed to delete invoice";
      showToast(msg, "error");
    }
  };

  // Add Invoice Form Submit
  const handleAddInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientId) {
      showToast("Please select a client", "error");
      return;
    }

    setIsSubmittingNew(true);
    try {
      const amountCents = parseAmountToCents(newAmount);
      const today = new Date().toISOString().split("T")[0];

      const created = await createInvoice({
        code: newCode.trim() || undefined,
        clientId: newClientId,
        title: newTitle.trim() || undefined,
        amountCents,
        currency: newCurrency,
        issueDate: today,
        dueDate: newDueDate || null,
        status: newStatus,
      });

      setShowAddInvoiceModal(false);
      setNewTitle("");
      setNewAmount("");
      setNewDueDate("");
      setNewStatus("UNPAID");
      showToast(`Invoice ${created.code} created!`);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String(err.message) : "Failed to create invoice";
      showToast(msg, "error");
    } finally {
      setIsSubmittingNew(false);
    }
  };

  return (
    <div className="motion-page w-full max-w-[1280px] mx-auto px-8 py-8 md:px-12 md:py-10 font-sans">
      {/* Toast Notification */}
      <MotionPresence>
        {notification && (
          <MotionSurface
            kind="toast"
            className={`fixed top-6 right-6 z-50 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium border ${
              notification.type === "error"
                ? "bg-rose-950 border-rose-800 text-rose-100"
                : "bg-neutral-900 border-neutral-700 text-white"
            }`}
          >
            {notification.type === "error" ? (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
        <div>
          <h1 className="font-serif-heading text-4xl md:text-[46px] font-normal tracking-tight text-neutral-900 leading-tight">
            Invoices
          </h1>
          <p className="text-neutral-500 text-sm md:text-[15px] mt-1.5 font-normal">
            Manage, issue, and track your client billing operations.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-neutral-200/90 hover:border-neutral-300 rounded-xl text-neutral-800 text-[13px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:bg-neutral-50 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-neutral-700" strokeWidth={2.2} />
            <span>New Invoice</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards & Filters Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-8">
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 flex-1">
          {/* Total Outstanding Card */}
          <div className="relative overflow-hidden w-full sm:w-[260px] bg-white rounded-2xl border border-neutral-200/80 px-5 py-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div
              className="absolute -top-6 -right-6 w-32 h-32 rounded-full pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0.02) 60%, transparent 75%)",
              }}
            />
            <span className="block text-[11px] font-bold tracking-wider text-neutral-500 uppercase mb-2">
              Total Outstanding
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl md:text-[28px] font-bold text-neutral-900 tracking-tight leading-none">
                {formatCents(totalOutstandingCents, primaryCurrency)}
              </span>
            </div>
          </div>

          {/* Overdue Card */}
          <div className="relative overflow-hidden w-full sm:w-[260px] bg-white rounded-2xl border border-neutral-200/80 px-5 py-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div
              className="absolute -top-6 -right-6 w-32 h-32 rounded-full pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle, rgba(239, 68, 68, 0.12) 0%, rgba(239, 68, 68, 0.02) 60%, transparent 75%)",
              }}
            />
            <span className="block text-[11px] font-bold tracking-wider text-neutral-500 uppercase mb-2">
              Overdue
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl md:text-[28px] font-bold text-[#DC2626] tracking-tight leading-none font-mono">
                {formatCents(totalOverdueCents, primaryCurrency)}
              </span>
            </div>
          </div>
        </div>

        {/* Filters and Active Client Chip */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
          {activeClientFilterObj && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#f3efff] border border-[#e5dcfc] text-[#7c3aed] text-xs font-semibold rounded-xl">
              <span>Client: {activeClientFilterObj.name}</span>
              <button
                type="button"
                onClick={() => router.push("/invoices")}
                className="p-0.5 hover:bg-[#e5dcfc] rounded-full transition-colors cursor-pointer"
                title="Clear filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Tab Filters */}
          <div className="bg-[#EDEDF0]/70 p-1 rounded-2xl flex items-center gap-1 border border-neutral-200/50">
            {(["All Invoices", "Drafts", "Overdue", "Paid"] as FilterTab[]).map(
              (tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer ${
                      isActive
                        ? "bg-white text-neutral-900 font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-neutral-200/60"
                        : "text-neutral-500 hover:text-neutral-800 hover:bg-neutral-200/40"
                    }`}
                  >
                    {tab}
                  </button>
                );
              }
            )}
          </div>
        </div>
      </div>

      {/* Invoices Table Container */}
      <div className="bg-white rounded-3xl border border-neutral-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.02)] overflow-visible min-h-[360px]">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-100 text-[11px] font-bold tracking-wider text-neutral-500 uppercase">
                <th className="py-4 pl-6 pr-3 w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-neutral-300 text-purple-600 focus:ring-purple-500/20 cursor-pointer accent-neutral-900"
                    aria-label="Select all invoices"
                  />
                </th>
                <th className="py-4 px-4 font-bold">Invoice / Client</th>
                <th className="py-4 px-4 font-bold">Amount</th>
                <th className="py-4 px-4 font-bold">Due Date</th>
                <th className="py-4 px-4 font-bold">Status</th>
                <th className="py-4 pr-6 pl-4 text-right w-12">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100/80">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-center">
                      <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-400 mb-3">
                        <Receipt className="w-6 h-6" />
                      </div>
                      <h3 className="text-base font-semibold text-neutral-900 tracking-tight">
                        {allInvoices.length === 0 ? "No invoices yet" : "No invoices found"}
                      </h3>
                      <p className="text-sm text-neutral-500 mt-1 font-normal">
                        {allInvoices.length === 0
                          ? "Create your first invoice to track client billings, payments, and cashflow."
                          : "No invoices matched the selected filter."}
                      </p>
                      {allInvoices.length === 0 && (
                        <button
                          onClick={handleOpenAddModal}
                          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>New Invoice</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const isSelected = selectedIds.includes(inv.id);
                  const isMenuOpen = openMenuId === inv.id;
                  const isHighlighted = highlightedInvoiceId === inv.id;

                  return (
                    <tr
                      key={inv.id}
                      className={`group hover:bg-[#FAFAFB] transition-colors relative ${
                        isHighlighted ? "bg-purple-100/60" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-4.5 pl-6 pr-3 w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(inv.id)}
                          className="w-4 h-4 rounded border-neutral-300 text-purple-600 focus:ring-purple-500/20 cursor-pointer accent-neutral-900"
                          aria-label={`Select invoice ${inv.code}`}
                        />
                      </td>

                      {/* Invoice Code & Client */}
                      <td className="py-4.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-neutral-900 leading-tight font-semibold font-mono">
                            {inv.code}
                          </span>
                          {inv.status === "OVERDUE" && (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5">
                          <button
                            type="button"
                            onClick={() => router.push(`/clients?client=${inv.clientId}`)}
                            className="text-xs text-neutral-500 hover:text-[#7c3aed] hover:underline font-normal text-left cursor-pointer"
                          >
                            {inv.clientName}
                          </button>
                          {inv.title && (
                            <span className="text-[11px] text-neutral-400 block truncate max-w-xs">
                              {inv.title}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-4.5 px-4">
                        <div className="text-sm font-semibold text-neutral-900 leading-tight">
                          {formatCents(inv.amountCents, inv.currency)}
                        </div>
                        <div className="text-[11px] font-medium text-neutral-400 mt-1 uppercase">
                          {inv.currency}
                        </div>
                      </td>

                      {/* Due Date */}
                      <td className="py-4.5 px-4">
                        <div
                          className={`text-sm leading-tight ${
                            inv.status === "OVERDUE"
                              ? "font-semibold text-[#DC2626]"
                              : inv.status === "DRAFT"
                              ? "text-neutral-500 italic font-normal"
                              : "text-neutral-800 font-medium"
                          }`}
                        >
                          {formatDateDisplay(inv.dueDate)}
                        </div>
                      </td>

                      {/* Status Dropdown/Pill */}
                      <td className="py-4.5 px-4">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                            inv.status === "PAID"
                              ? "bg-emerald-100 text-emerald-800"
                              : inv.status === "OVERDUE"
                              ? "bg-rose-100 text-rose-800 font-bold"
                              : inv.status === "DRAFT"
                              ? "bg-neutral-100 text-neutral-600"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>

                      {/* Actions Menu */}
                      <td className="py-4.5 pr-6 pl-4 text-right relative">
                        <button
                          type="button"
                          onClick={() => setOpenMenuId(isMenuOpen ? null : inv.id)}
                          className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
                          aria-label="Actions"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {isMenuOpen && (
                          <div className="absolute right-6 top-10 z-40 bg-white rounded-xl shadow-xl border border-neutral-200 py-1.5 w-44 text-xs font-medium text-neutral-700 text-left">
                            <button
                              onClick={() => handleOpenEdit(inv)}
                              className="w-full px-3.5 py-2 hover:bg-neutral-50 flex items-center gap-2 cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5 text-neutral-400" />
                              <span>Edit Invoice</span>
                            </button>

                            <div className="my-1 border-t border-neutral-100" />
                            <div className="px-3 py-1 text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                              Change Status
                            </div>
                            {(["UNPAID", "PAID", "OVERDUE", "DRAFT"] as InvoiceStatus[]).map((s) => (
                              <button
                                key={s}
                                onClick={() => handleChangeStatus(inv.id, s)}
                                className={`w-full px-3.5 py-1.5 hover:bg-neutral-50 flex items-center justify-between cursor-pointer ${
                                  inv.status === s ? "font-bold text-[#7c3aed]" : ""
                                }`}
                              >
                                <span>{s}</span>
                                {inv.status === s && <CheckCircle2 className="w-3 h-3 text-[#7c3aed]" />}
                              </button>
                            ))}

                            <div className="my-1 border-t border-neutral-100" />
                            <button
                              onClick={() => {
                                setDeletingInvoice(inv);
                                setOpenMenuId(null);
                              }}
                              className="w-full px-3.5 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              <span>Delete Invoice</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Invoice Modal */}
      <MotionPresence>
        {showAddInvoiceModal && (
          <MotionSurface
            kind="dialog"
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <MotionSurface
              kind="panel"
              className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-neutral-200 overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#f3efff] text-[#7c3aed] flex items-center justify-center">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">
                      Create New Invoice
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Record a billable invoice against an existing client.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddInvoiceModal(false)}
                  className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {clients.length === 0 ? (
                <div className="p-6 text-center space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                    <Building className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-neutral-900">
                    No Clients Found
                  </h4>
                  <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                    Invoices must be associated with an existing client. Please add a client before creating an invoice.
                  </p>
                  <div className="pt-2">
                    <Link
                      href="/clients"
                      onClick={() => setShowAddInvoiceModal(false)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-semibold hover:bg-neutral-800 transition-colors"
                    >
                      <span>Go to Clients</span>
                      <span>→</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleAddInvoiceSubmit} className="p-6 space-y-4 text-xs font-medium text-neutral-700">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                        Invoice Code *
                      </label>
                      <input
                        type="text"
                        required
                        value={newCode}
                        onChange={(e) => setNewCode(e.target.value)}
                        placeholder="INV-2026-001"
                        className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                        Target Client *
                      </label>
                      <select
                        required
                        value={newClientId}
                        onChange={(e) => {
                          const cid = e.target.value;
                          setNewClientId(cid);
                          const chosen = clients.find((c) => c.id === cid);
                          if (chosen) setNewCurrency(chosen.currency);
                        }}
                        className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40 cursor-pointer"
                      >
                        <option value="">Select a client...</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.currency})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                      Deliverable Description / Title
                    </label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g. Phase 1 Architecture & Implementation"
                      className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                        Amount *
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={newAmount}
                        onChange={(e) => setNewAmount(e.target.value)}
                        placeholder="12500.00"
                        className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                        Currency
                      </label>
                      <select
                        value={newCurrency}
                        onChange={(e) => setNewCurrency(e.target.value as Currency)}
                        className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40 cursor-pointer"
                      >
                        <option value="LKR">LKR (Rs.)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="CAD">CAD (CA$)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={newDueDate}
                        onChange={(e) => setNewDueDate(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40 cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                        Status
                      </label>
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value as InvoiceStatus)}
                        className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40 cursor-pointer"
                      >
                        <option value="UNPAID">UNPAID (Pending)</option>
                        <option value="PAID">PAID</option>
                        <option value="OVERDUE">OVERDUE</option>
                        <option value="DRAFT">DRAFT</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
                    <button
                      type="button"
                      onClick={() => setShowAddInvoiceModal(false)}
                      className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingNew}
                      className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      {isSubmittingNew ? "Saving..." : "Create Invoice"}
                    </button>
                  </div>
                </form>
              )}
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Edit Invoice Modal */}
      <MotionPresence>
        {editingInvoice && (
          <MotionSurface
            kind="dialog"
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <MotionSurface
              kind="panel"
              className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-neutral-200 overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#f3efff] text-[#7c3aed] flex items-center justify-center">
                    <Pencil className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">
                      Edit Invoice
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Modify details for {editingInvoice.code}.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingInvoice(null)}
                  className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="p-6 space-y-4 text-xs font-medium text-neutral-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                      Invoice Code
                    </label>
                    <input
                      type="text"
                      required
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                      Client
                    </label>
                    <select
                      required
                      value={editClientId}
                      onChange={(e) => setEditClientId(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40 cursor-pointer"
                    >
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                    Deliverable Title
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                      Amount
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                      Currency
                    </label>
                    <select
                      value={editCurrency}
                      onChange={(e) => setEditCurrency(e.target.value as Currency)}
                      className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40 cursor-pointer"
                    >
                      <option value="LKR">LKR (Rs.)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="CAD">CAD (CA$)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                      Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as InvoiceStatus)}
                      className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40 cursor-pointer"
                    >
                      <option value="UNPAID">UNPAID</option>
                      <option value="OVERDUE">OVERDUE</option>
                      <option value="PAID">PAID</option>
                      <option value="DRAFT">DRAFT</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => setEditingInvoice(null)}
                    className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingEdit}
                    className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    {isSubmittingEdit ? "Updating..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Delete Confirmation Modal */}
      <MotionPresence>
        {deletingInvoice && (
          <MotionSurface
            kind="dialog"
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <MotionSurface
              kind="panel"
              className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-neutral-200 p-6 text-center"
            >
              <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3.5">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-neutral-900">
                Delete Invoice?
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                Are you sure you want to delete invoice <strong className="text-neutral-900">{deletingInvoice.code}</strong> for {deletingInvoice.clientName}? This action cannot be undone.
              </p>
              <div className="flex justify-center gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setDeletingInvoice(null)}
                  className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-[1280px] mx-auto px-8 py-8 animate-pulse space-y-6">
          <div className="h-10 w-48 bg-neutral-200 rounded-xl" />
          <div className="h-40 bg-neutral-200 rounded-2xl" />
          <div className="h-96 bg-neutral-200 rounded-3xl" />
        </div>
      }
    >
      <InvoicesContent />
    </Suspense>
  );
}
