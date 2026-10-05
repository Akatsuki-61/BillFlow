"use client";

import {
  Button,
  PageHeader,
  SegmentedControl,
  MetricCard,
  EmptyState,
} from "@/components/ui/Workspace";

import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";
import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Plus,
  Receipt,
  MoreHorizontal,
  CheckCircle2,
  Pencil,
  Trash2,
  X,
  AlertCircle,
} from "lucide-react";
import { useInvoices, useClients, useCatalog, useSettings } from "@/lib/data/DataProvider";
import {
  formatCents,
  formatDateDisplay,
  parseAmountToCents,
} from "@/lib/format";
import type {
  InvoiceWithClient,
  InvoiceStatus,
  Currency,
} from "@/types/billing";

type FilterTab = "All Invoices" | "Drafts" | "Overdue" | "Paid";

function InvoicesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    invoices: allInvoices,
    createInvoice,
    updateInvoice,
    setInvoiceStatus,
    deleteInvoice,
    getNextInvoiceCode,
  } = useInvoices();

  const { clients } = useClients();
  const { catalogItems } = useCatalog();
  const { settings } = useSettings();
  const [catalogItemId, setCatalogItemId] = useState("");
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [clientCategory, setClientCategory] = useState("Enterprise");
  const requestId = useRef<string | null>(null);

  const [activeTab, setActiveTab] = useState<FilterTab>("All Invoices");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [expiredInvoiceHighlight, setExpiredInvoiceHighlight] = useState<
    string | null
  >(null);

  // Add Invoice Modal state
  const [showAddInvoiceModal, setShowAddInvoiceModal] =
    useState<boolean>(false);
  const [newCode, setNewCode] = useState("");
  const [newClientId, setNewClientId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCurrency, setNewCurrency] = useState<Currency>("LKR");
  const [newDueDate, setNewDueDate] = useState("");
  const [newStatus, setNewStatus] = useState<InvoiceStatus>("UNPAID");
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  // Edit Invoice Modal state
  const [editingInvoice, setEditingInvoice] =
    useState<InvoiceWithClient | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editClientId, setEditClientId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCurrency, setEditCurrency] = useState<Currency>("LKR");
  const [editDueDate, setEditDueDate] = useState("");
  const [editStatus, setEditStatus] = useState<InvoiceStatus>("UNPAID");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Delete Confirm Modal state
  const [deletingInvoice, setDeletingInvoice] =
    useState<InvoiceWithClient | null>(null);

  // Toast feedback state
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3600);
  };

  // Check URL search parameters
  const clientFilterParam = searchParams.get("client");
  const isNewParam = searchParams.get("new");
  const invoiceHighlightParam = searchParams.get("invoice");

  const [previousHighlightParam, setPreviousHighlightParam] = useState(invoiceHighlightParam);
  if (previousHighlightParam !== invoiceHighlightParam) {
    setPreviousHighlightParam(invoiceHighlightParam);
    setExpiredInvoiceHighlight(null);
  }
  const highlightedInvoiceId = expiredInvoiceHighlight === invoiceHighlightParam
    ? null : invoiceHighlightParam;
  useEffect(() => {
    if (!invoiceHighlightParam) return;
    const timer = setTimeout(() => setExpiredInvoiceHighlight(invoiceHighlightParam), 2500);
    return () => clearTimeout(timer);
  }, [invoiceHighlightParam]);

  const linkedClient = clients.find((client) => client.id === clientFilterParam);
  const modalQueryKey = JSON.stringify([isNewParam, clientFilterParam, linkedClient?.currency]);
  const [previousModalQueryKey, setPreviousModalQueryKey] = useState<string | null>(null);
  if (previousModalQueryKey !== modalQueryKey) {
    setPreviousModalQueryKey(modalQueryKey);
    if (isNewParam === "1") {
      setShowAddInvoiceModal(true);
      if (clientFilterParam) setNewClientId(clientFilterParam);
      if (linkedClient) setNewCurrency(linkedClient.currency);
    }
  }

  // When opening Add Invoice modal, prefill the next code
  const handleOpenAddModal = async () => {
    requestId.current = null;
    setClientMode(clients.length ? "existing" : "new");
    setNewCurrency(settings?.defaultCurrency || "LKR");
    const due = new Date(); due.setDate(due.getDate() + (settings?.defaultDueDays ?? 14));
    setNewDueDate(due.toISOString().slice(0, 10));
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
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
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
      const msg =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Failed to update status";
      showToast(msg, "error");
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (inv: InvoiceWithClient) => {
    setEditingInvoice(inv);
    setEditCode(inv.code);
    setEditClientId(inv.clientId || "");
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
      const msg =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Failed to save invoice";
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
      const msg =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Failed to delete invoice";
      showToast(msg, "error");
    }
  };

  // Add Invoice Form Submit
  const handleAddInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (clientMode === "existing" && !newClientId) {
      showToast("Please select a client", "error");
      return;
    }

    setIsSubmittingNew(true);
    try {
      const amountCents = parseAmountToCents(newAmount);
      const today = new Date().toISOString().split("T")[0];

      requestId.current ||= crypto.randomUUID();
      const created = await createInvoice({
        requestId: requestId.current,
        catalogItemId: catalogItemId || null,
        ...(clientMode === "new" ? {newClient:{name:clientName,email:clientEmail,currency:newCurrency,contactPerson:clientContact || clientName,category:clientCategory}} : {clientId:newClientId}),
        code: newCode.trim() || undefined,
        title: newTitle.trim() || undefined,
        amountCents,
        currency: newCurrency,
        issueDate: today,
        dueDate: newDueDate || null,
        status: newStatus,
      });

      setShowAddInvoiceModal(false);
      requestId.current = null;
      setCatalogItemId(""); setClientName(""); setClientEmail(""); setClientContact("");
      setNewTitle("");
      setNewAmount("");
      setNewDueDate("");
      setNewStatus("UNPAID");
      showToast(`Invoice ${created.code} created!`);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Failed to create invoice";
      showToast(msg, "error");
    } finally {
      setIsSubmittingNew(false);
    }
  };

  return (
    <div className="workspace-page motion-page">
      {/* Toast Notification */}
      <MotionPresence>
        {notification && (
          <MotionSurface
            kind="toast"
            className={`fixed top-14 right-6 z-50 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium border ${
              notification.type === "error"
                ? "bg-surface-rose-950 border-line-rose-800 text-content-rose-100"
                : "bg-surface-neutral-900 border-line-neutral-700 text-white"
            }`}
          >
            {notification.type === "error" ? (
              <AlertCircle className="w-5 h-5 text-content-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-content-emerald-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Top Header */}
      <PageHeader
        title="Invoices"
        description="Manage, issue, and track your client billing operations."
      >
        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Button variant="primary" type="button" onClick={handleOpenAddModal}>
            <Plus className="w-4 h-4 text-content-neutral-700" strokeWidth={2.2} />
            <span>New Invoice</span>
          </Button>
        </div>
      </PageHeader>

      {/* Metrics Cards & Filters Row */}
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          <MetricCard
            label="Total Outstanding"
            value={formatCents(totalOutstandingCents, primaryCurrency)}
            footer="awaiting payment"
          />
          <MetricCard
            label="Overdue"
            value={formatCents(totalOverdueCents, primaryCurrency)}
            tone="warning"
            footer="past the due date"
          />
        </div>

        {/* Filters and Active Client Chip */}
        <div className="flex flex-wrap items-center gap-2 self-start">
          {activeClientFilterObj && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent-faint border border-border-accent-soft text-accent text-xs font-semibold rounded-xl">
              <span>Client: {activeClientFilterObj.name}</span>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => router.push("/invoices")}

                title="Clear filter"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          <SegmentedControl
            value={activeTab}
            onChange={setActiveTab}
            label="Invoice status"
            options={(
              ["All Invoices", "Drafts", "Overdue", "Paid"] as FilterTab[]
            ).map((value) => ({ value, label: value }))}
          />
        </div>
      </div>

      {/* Invoices Table Container */}
      <div className="ui-card overflow-visible">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line-neutral-100 text-[11px] font-bold tracking-wider text-content-neutral-500 uppercase">
                <th className="py-4 pl-6 pr-3 w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-line-neutral-300 text-content-purple-600 focus:ring-line-purple-500/20 cursor-pointer accent-neutral-900"
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
            <tbody className="divide-y divide-line-neutral-100/80">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-0 text-center">
                    <EmptyState
                      title={
                        allInvoices.length === 0
                          ? "No invoices yet"
                          : "No invoices found"
                      }
                      description={
                        allInvoices.length === 0
                          ? "Create your first invoice to track client billings, payments, and cashflow."
                          : "No invoices matched the selected filter."
                      }
                      icon={<Receipt />}
                    >
                      {allInvoices.length === 0 && (
                        <Button
                          variant="primary"
                          onClick={handleOpenAddModal}
                          className="mt-4"
                        >
                          <Plus className="w-4 h-4" />
                          <span>New Invoice</span>
                        </Button>
                      )}
                    </EmptyState>
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
                      className={`group hover:bg-surface-soft transition-colors relative ${
                        isHighlighted ? "bg-surface-purple-100/60" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-4.5 pl-6 pr-3 w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(inv.id)}
                          className="w-4 h-4 rounded border-line-neutral-300 text-content-purple-600 focus:ring-line-purple-500/20 cursor-pointer accent-neutral-900"
                          aria-label={`Select invoice ${inv.code}`}
                        />
                      </td>

                      {/* Invoice Code & Client */}
                      <td className="py-4.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-content-neutral-900 leading-tight font-semibold font-mono">
                            {inv.code}
                          </span>
                          {inv.status === "OVERDUE" && (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-surface-red-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-surface-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5">
                          <Button
                            variant="ghost"
                            type="button"
                            onClick={() =>
                              router.push(`/clients?client=${inv.clientId}`)
                            }
                          >
                            {inv.clientName}
                          </Button>
                          {inv.title && (
                            <span className="text-[11px] text-content-neutral-400 block truncate max-w-xs">
                              {inv.title}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-4.5 px-4">
                        <div className="text-sm font-semibold text-content-neutral-900 leading-tight">
                          {formatCents(inv.amountCents, inv.currency)}
                        </div>
                        <div className="text-[11px] font-medium text-content-neutral-400 mt-1 uppercase">
                          {inv.currency}
                        </div>
                      </td>

                      {/* Due Date */}
                      <td className="py-4.5 px-4">
                        <div
                          className={`text-sm leading-tight ${
                            inv.status === "OVERDUE"
                              ? "font-semibold text-danger"
                              : inv.status === "DRAFT"
                                ? "text-content-neutral-500 italic font-normal"
                                : "text-content-neutral-800 font-medium"
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
                              ? "bg-surface-emerald-100 text-content-emerald-800"
                              : inv.status === "OVERDUE"
                                ? "bg-surface-rose-100 text-content-rose-800 font-bold"
                                : inv.status === "DRAFT"
                                  ? "bg-surface-neutral-100 text-content-neutral-600"
                                  : "bg-surface-blue-100 text-content-blue-800"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>

                      {/* Actions Menu */}
                      <td className="py-4.5 pr-6 pl-4 text-right relative">
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          onClick={() =>
                            setOpenMenuId(isMenuOpen ? null : inv.id)
                          }

                          aria-label="Actions"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>

                        {isMenuOpen && (
                          <div className="absolute right-6 top-10 z-40 bg-surface rounded-xl shadow-xl border border-line-neutral-200 py-1.5 w-44 text-xs font-medium text-content-neutral-700 text-left">
                            <Button
                              variant="menu"
                              onClick={() => handleOpenEdit(inv)}
                              className="w-full"
                            >
                              <Pencil className="w-3.5 h-3.5 text-content-neutral-400" />
                              <span>Edit Invoice</span>
                            </Button>

                            <div className="my-1 border-t border-line-neutral-100" />
                            <div className="px-3 py-1 text-[10px] uppercase font-bold text-content-neutral-400 tracking-wider">
                              Change Status
                            </div>
                            {(
                              [
                                "UNPAID",
                                "PAID",
                                "OVERDUE",
                                "DRAFT",
                              ] as InvoiceStatus[]
                            ).map((s) => (
                              <button
                                key={s}
                                onClick={() => handleChangeStatus(inv.id, s)}
                                className={`w-full px-3.5 py-1.5 hover:bg-surface-neutral-50 flex items-center justify-between cursor-pointer ${
                                  inv.status === s
                                    ? "font-bold text-accent"
                                    : ""
                                }`}
                              >
                                <span>{s}</span>
                                {inv.status === s && (
                                  <CheckCircle2 className="w-3 h-3 text-accent" />
                                )}
                              </button>
                            ))}

                            <div className="my-1 border-t border-line-neutral-100" />
                            <Button
                              variant="danger"
                              onClick={() => {
                                setDeletingInvoice(inv);
                                setOpenMenuId(null);
                              }}
                              className="w-full"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-content-red-400" />
                              <span>Delete Invoice</span>
                            </Button>
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
              onDismiss={() => setShowAddInvoiceModal(false)}
              kind="panel"
              className="bg-surface rounded-2xl w-full max-w-lg shadow-2xl border border-line-neutral-200 overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-line-neutral-100 flex items-center justify-between bg-surface-neutral-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-accent-faint text-accent flex items-center justify-center">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-content-neutral-900">
                      Create New Invoice
                    </h3>
                    <p className="text-xs text-content-neutral-400">
                      Select a client or save a new client with this invoice.
                    </p>
                  </div>
                </div>
                <Button
                  aria-label="Close"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowAddInvoiceModal(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

                <form
                  onSubmit={handleAddInvoiceSubmit}
                  className="p-6 space-y-4 text-xs font-medium text-content-neutral-700"
                >
                  <div className="flex gap-2">
                    <Button type="button" variant={clientMode === "existing" ? "primary" : "secondary"} onClick={()=>setClientMode("existing")}>Existing client</Button>
                    <Button type="button" variant={clientMode === "new" ? "primary" : "secondary"} onClick={()=>setClientMode("new")}>Add new client</Button>
                  </div>
                  {clientMode === "new" && <div className="grid grid-cols-2 gap-3">
                    <label>Client name<input aria-label="New client name" className="ui-field w-full" required value={clientName} onChange={e=>setClientName(e.target.value)} /></label>
                    <label>Email<input aria-label="New client email" className="ui-field w-full" type="email" required value={clientEmail} onChange={e=>setClientEmail(e.target.value)} /></label>
                    <label>Contact person<input aria-label="New client contact" className="ui-field w-full" value={clientContact} onChange={e=>setClientContact(e.target.value)} /></label>
                    <label>Category<select aria-label="New client category" className="ui-field w-full" value={clientCategory} onChange={e=>setClientCategory(e.target.value)}>{["Enterprise","Corporate","Small Business","Startup","Retainer"].map(value=><option key={value}>{value}</option>)}</select></label>
                    <p className="col-span-2 text-content-neutral-500">The client will also appear in Clients.</p>
                  </div>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                        Invoice Code *
                      </label>
                      <input
                        type="text"
                        required
                        value={newCode}
                        onChange={(e) => setNewCode(e.target.value)}
                        placeholder="INV-2026-001"
                        className="ui-field w-full px-3.5 border border-line-neutral-200 text-content-neutral-900 focus:outline-none focus:ring-2 focus:ring-accent/40 font-mono"
                      />
                    </div>

                    <div hidden={clientMode === "new"}>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                        Target Client *
                      </label>
                      <select
                        required={clientMode === "existing"}
                        value={newClientId}
                        onChange={(e) => {
                          const cid = e.target.value;
                          setNewClientId(cid);
                          const chosen = clients.find((c) => c.id === cid);
                          if (chosen) setNewCurrency(chosen.currency);
                        }}
                        className="ui-field w-full px-3.5 border border-line-neutral-200 text-content-neutral-900 focus:outline-none focus:ring-2 focus:ring-accent/40 cursor-pointer"
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

                  <label className="block">Catalog service
                    <select aria-label="Catalog service" className="ui-field w-full" value={catalogItemId} onChange={e=>{
                      setCatalogItemId(e.target.value);
                      const item=catalogItems.find(row=>row.id===e.target.value);
                      if(item){setNewTitle(item.title);setNewAmount(item.price);setNewCurrency(item.currency);}
                    }}>
                      <option value="">Custom service</option>
                      {catalogItems.map(item=><option key={item.id} value={item.id}>{item.title} · {item.currency} {item.price}</option>)}
                    </select>
                  </label>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                      Deliverable Description / Title
                    </label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g. Phase 1 Architecture & Implementation"
                      className="ui-field w-full px-3.5 border border-line-neutral-200 text-content-neutral-900 focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
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
                        className="ui-field w-full px-3.5 border border-line-neutral-200 text-content-neutral-900 focus:outline-none focus:ring-2 focus:ring-accent/40"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                        Currency
                      </label>
                      <select
                        value={newCurrency}
                        onChange={(e) =>
                          setNewCurrency(e.target.value as Currency)
                        }
                        className="ui-field w-full px-3.5 border border-line-neutral-200 text-content-neutral-900 focus:outline-none focus:ring-2 focus:ring-accent/40 cursor-pointer"
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
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={newDueDate}
                        onChange={(e) => setNewDueDate(e.target.value)}
                        className="ui-field w-full px-3.5 border border-line-neutral-200 text-content-neutral-900 focus:outline-none focus:ring-2 focus:ring-accent/40 cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                        Status
                      </label>
                      <select
                        value={newStatus}
                        onChange={(e) =>
                          setNewStatus(e.target.value as InvoiceStatus)
                        }
                        className="ui-field w-full px-3.5 border border-line-neutral-200 text-content-neutral-900 focus:outline-none focus:ring-2 focus:ring-accent/40 cursor-pointer"
                      >
                        <option value="UNPAID">UNPAID (Pending)</option>
                        <option value="PAID">PAID</option>
                        <option value="OVERDUE">OVERDUE</option>
                        <option value="DRAFT">DRAFT</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-line-neutral-100">
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => setShowAddInvoiceModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      type="submit"
                      disabled={isSubmittingNew}
                    >
                      {isSubmittingNew ? "Saving..." : "Create Invoice"}
                    </Button>
                  </div>
                </form>
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
              onDismiss={() => setEditingInvoice(null)}
              kind="panel"
              className="bg-surface rounded-2xl w-full max-w-lg shadow-2xl border border-line-neutral-200 overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-line-neutral-100 flex items-center justify-between bg-surface-neutral-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-accent-faint text-accent flex items-center justify-center">
                    <Pencil className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-content-neutral-900">
                      Edit Invoice
                    </h3>
                    <p className="text-xs text-content-neutral-400">
                      Modify details for {editingInvoice.code}.
                    </p>
                  </div>
                </div>
                <Button
                  aria-label="Close"
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditingInvoice(null)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <form
                onSubmit={handleEditSubmit}
                className="p-6 space-y-4 text-xs font-medium text-content-neutral-700"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                      Invoice Code
                    </label>
                    <input
                      type="text"
                      required
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value)}
                      className="ui-field w-full px-3.5 border border-line-neutral-200 text-content-neutral-900 focus:outline-none focus:ring-2 focus:ring-accent/40 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                      Client
                    </label>
                    <select
                      required
                      value={editClientId}
                      onChange={(e) => setEditClientId(e.target.value)}
                      className="ui-field w-full px-3.5 border border-line-neutral-200 text-content-neutral-900 focus:outline-none focus:ring-2 focus:ring-accent/40 cursor-pointer"
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
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                    Deliverable Title
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="ui-field w-full px-3.5 border border-line-neutral-200 text-content-neutral-900 focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                      Amount
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="ui-field w-full px-3.5 border border-line-neutral-200 text-content-neutral-900 focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                      Currency
                    </label>
                    <select
                      value={editCurrency}
                      onChange={(e) =>
                        setEditCurrency(e.target.value as Currency)
                      }
                      className="ui-field w-full px-3.5 border border-line-neutral-200 text-content-neutral-900 focus:outline-none focus:ring-2 focus:ring-accent/40 cursor-pointer"
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
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      className="ui-field w-full px-3.5 border border-line-neutral-200 text-content-neutral-900 focus:outline-none focus:ring-2 focus:ring-accent/40 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                      Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) =>
                        setEditStatus(e.target.value as InvoiceStatus)
                      }
                      className="ui-field w-full px-3.5 border border-line-neutral-200 text-content-neutral-900 focus:outline-none focus:ring-2 focus:ring-accent/40 cursor-pointer"
                    >
                      <option value="UNPAID">UNPAID</option>
                      <option value="OVERDUE">OVERDUE</option>
                      <option value="PAID">PAID</option>
                      <option value="DRAFT">DRAFT</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-line-neutral-100">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setEditingInvoice(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={isSubmittingEdit}
                  >
                    {isSubmittingEdit ? "Updating..." : "Save Changes"}
                  </Button>
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
              onDismiss={() => setDeletingInvoice(null)}
              kind="panel"
              className="bg-surface rounded-2xl w-full max-w-sm shadow-2xl border border-line-neutral-200 p-6 text-center"
            >
              <div className="w-12 h-12 rounded-xl bg-surface-rose-50 text-content-rose-600 flex items-center justify-center mx-auto mb-3.5">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-content-neutral-900">
                Delete Invoice?
              </h3>
              <p className="text-xs text-content-neutral-500 mt-1">
                Are you sure you want to delete invoice{" "}
                <strong className="text-content-neutral-900">
                  {deletingInvoice.code}
                </strong>{" "}
                for {deletingInvoice.clientName}? This action cannot be undone.
              </p>
              <div className="flex justify-center gap-3 mt-6">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setDeletingInvoice(null)}
                >
                  Cancel
                </Button>
                <Button variant="danger" type="button" onClick={confirmDelete}>
                  Delete
                </Button>
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
          <div className="h-10 w-48 bg-surface-neutral-200 rounded-xl" />
          <div className="h-40 bg-surface-neutral-200 rounded-2xl" />
          <div className="h-96 bg-surface-neutral-200 rounded-3xl" />
        </div>
      }
    >
      <InvoicesContent />
    </Suspense>
  );
}
