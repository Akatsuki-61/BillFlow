"use client";

import React, { useState } from "react";
import {
  Plus,
  ArrowDown,
  MoreHorizontal,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  X,
  UserPlus,
  Users,
  Sparkles,
} from "lucide-react";
import { useClients } from "@/lib/data/DataProvider";
import "./invoices.css";

interface Invoice {
  id: string;
  code: string;
  client: string;
  amount: string;
  currency: string;
  dueDate: string;
  dueSubtext?: string;
  isOverdue?: boolean;
  isDueSoon?: boolean;
  status: "OVERDUE" | "UNPAID" | "PAID" | "DRAFT";
  isDraftCode?: boolean;
}

const getCurrencySymbol = (currency: string) => {
  switch (currency.toUpperCase()) {
    case "LKR":
      return "Rs. ";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "USD":
    case "CAD":
    default:
      return "$";
  }
};

const formatAmountWithCurrency = (numStr: string, currency: string) => {
  const parsed = parseFloat(numStr || "0");
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${parsed.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const initialInvoices: Invoice[] = [
  {
    id: "1",
    code: "INV-2023-089",
    client: "Globex Corporation",
    amount: "Rs. 12,450.00",
    currency: "LKR",
    dueDate: "Oct 12, 2023",
    dueSubtext: "14 days late",
    isOverdue: true,
    status: "OVERDUE",
  },
  {
    id: "2",
    code: "INV-2023-090",
    client: "Initech LLC",
    amount: "Rs. 4,200.50",
    currency: "LKR",
    dueDate: "Oct 28, 2023",
    dueSubtext: "in 2 days",
    isDueSoon: true,
    status: "UNPAID",
  },
  {
    id: "3",
    code: "INV-2023-085",
    client: "Stark Industries",
    amount: "Rs. 85,000.00",
    currency: "LKR",
    dueDate: "Oct 15, 2023",
    status: "PAID",
  },
  {
    id: "4",
    code: "Draft",
    client: "Wayne Enterprises",
    amount: "Rs. 1,500.00",
    currency: "LKR",
    dueDate: "Not Set",
    status: "DRAFT",
    isDraftCode: true,
  },
];

type FilterTab = "All Invoices" | "Drafts" | "Overdue" | "Paid";

export default function InvoicesPage() {
  const { clients, createClient } = useClients();

  const [activeTab, setActiveTab] = useState<FilterTab>("All Invoices");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Notifications / Toast
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3600);
  };

  // Add Invoice Modal state
  const [showAddInvoiceModal, setShowAddInvoiceModal] = useState<boolean>(false);
  const [newCode, setNewCode] = useState("INV-2023-091");
  const [newClient, setNewClient] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCurrency, setNewCurrency] = useState("LKR");
  const [newDueDate, setNewDueDate] = useState("");
  const [newStatus, setNewStatus] = useState<"UNPAID" | "OVERDUE" | "PAID" | "DRAFT">("UNPAID");

  // Client Selection / Creation Mode
  const [clientMode, setClientMode] = useState<"select" | "new">("select");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientContact, setNewClientContact] = useState("");
  const [newClientCategory, setNewClientCategory] = useState("Enterprise");

  // Edit Invoice Modal state
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editClient, setEditClient] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCurrency, setEditCurrency] = useState("LKR");
  const [editDueDate, setEditDueDate] = useState("");
  const [editStatus, setEditStatus] = useState<"UNPAID" | "OVERDUE" | "PAID" | "DRAFT">("UNPAID");

  // Delete Confirm Modal state
  const [deletingInvoice, setDeletingInvoice] = useState<Invoice | null>(null);

  const filteredInvoices = invoices.filter((inv) => {
    if (activeTab === "Drafts") return inv.status === "DRAFT";
    if (activeTab === "Overdue") return inv.status === "OVERDUE";
    if (activeTab === "Paid") return inv.status === "PAID";
    return true;
  });

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
  const handleChangeStatus = (
    id: string,
    nextStatus: "OVERDUE" | "UNPAID" | "PAID" | "DRAFT"
  ) => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === id) {
          return {
            ...inv,
            status: nextStatus,
            isOverdue: nextStatus === "OVERDUE",
            dueSubtext:
              nextStatus === "OVERDUE"
                ? "Overdue"
                : nextStatus === "UNPAID"
                ? "Pending"
                : undefined,
          };
        }
        return inv;
      })
    );
    setOpenMenuId(null);
  };

  // Open Edit Modal
  const handleOpenEdit = (inv: Invoice) => {
    setEditingInvoice(inv);
    setEditCode(inv.code);
    setEditClient(inv.client);
    setEditAmount(inv.amount.replace(/[^0-9.]/g, ""));
    setEditCurrency(inv.currency || "LKR");
    setEditDueDate(inv.dueDate);
    setEditStatus(inv.status);
    setOpenMenuId(null);
  };

  // Save Edit Changes
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;

    const formattedAmount = formatAmountWithCurrency(editAmount, editCurrency);

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === editingInvoice.id) {
          return {
            ...inv,
            code: editCode.trim() || inv.code,
            client: editClient.trim() || inv.client,
            amount: formattedAmount,
            currency: editCurrency,
            dueDate: editDueDate || inv.dueDate,
            status: editStatus,
            isOverdue: editStatus === "OVERDUE",
            dueSubtext:
              editStatus === "OVERDUE"
                ? "Overdue"
                : editStatus === "UNPAID"
                ? "Pending"
                : undefined,
          };
        }
        return inv;
      })
    );

    setEditingInvoice(null);
  };

  // Execute Delete
  const confirmDelete = () => {
    if (deletingInvoice) {
      setInvoices((prev) => prev.filter((inv) => inv.id !== deletingInvoice.id));
      setSelectedIds((prev) => prev.filter((id) => id !== deletingInvoice.id));
      setDeletingInvoice(null);
      setOpenMenuId(null);
    }
  };

  // Add Invoice Form Submit
  const handleAddInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalClientName = newClient.trim();

    if (clientMode === "new") {
      if (!newClientName.trim()) {
        alert("Please enter a client name.");
        return;
      }
      const emailToUse =
        newClientEmail.trim() ||
        `billing@${newClientName.trim().toLowerCase().replace(/[^a-z0-9]/g, "") || "client"}.com`;

      try {
        const createdClient = await createClient({
          name: newClientName.trim(),
          category: newClientCategory || "Enterprise",
          contactPerson: newClientContact.trim() || newClientName.trim(),
          email: emailToUse,
          currency: (newCurrency as "USD" | "LKR" | "EUR") || "LKR",
        });
        finalClientName = createdClient.name;
        showToast(
          `Invoice created and "${createdClient.name}" added to Clients page!`,
        );
      } catch (err: unknown) {
        console.error("Failed to create client:", err);
        finalClientName = newClientName.trim();
        showToast(`Invoice created for "${finalClientName}"`);
      }
    } else {
      if (!finalClientName) {
        alert("Please select a client from the list or switch to 'Add New Client'.");
        return;
      }
      showToast(`Invoice created for "${finalClientName}"!`);
    }

    const formattedAmount = formatAmountWithCurrency(newAmount, newCurrency);

    let formattedDate = newDueDate;
    if (newDueDate) {
      try {
        const d = new Date(newDueDate);
        formattedDate = d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      } catch {
        formattedDate = newDueDate;
      }
    } else {
      formattedDate = newStatus === "DRAFT" ? "Not Set" : "Pending";
    }

    const createdInvoice: Invoice = {
      id: Date.now().toString(),
      code: newCode.trim() || `INV-2023-0${invoices.length + 90}`,
      client: finalClientName,
      amount: formattedAmount,
      currency: newCurrency,
      dueDate: formattedDate,
      dueSubtext:
        newStatus === "OVERDUE" ? "Overdue" : newStatus === "UNPAID" ? "Pending" : undefined,
      isOverdue: newStatus === "OVERDUE",
      isDraftCode: newStatus === "DRAFT" && newCode.toLowerCase() === "draft",
      status: newStatus,
    };

    setInvoices([createdInvoice, ...invoices]);
    setShowAddInvoiceModal(false);

    setNewCode(`INV-2023-0${invoices.length + 92}`);
    setNewClient("");
    setSelectedClientId("");
    setNewClientName("");
    setNewClientEmail("");
    setNewClientContact("");
    setNewAmount("");
    setNewDueDate("");
    setNewStatus("UNPAID");
    setClientMode("select");
  };

  return (
    <div className="w-full max-w-[1280px] mx-auto px-8 py-8 md:px-12 md:py-10 font-sans">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-14 right-6 z-50 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium border ${
            notification.type === "error"
              ? "bg-rose-950 border-rose-800 text-rose-100"
              : "bg-neutral-900 border-neutral-700 text-white"
          }`}
        >
          {notification.type === "error" ? (
            <span className="w-2 h-2 rounded-full bg-rose-400" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
        <div>
          <h1 className="font-serif-heading text-4xl md:text-[46px] font-normal tracking-tight text-neutral-900 leading-tight">
            Invoices
          </h1>
          <p className="text-neutral-500 text-sm md:text-[15px] mt-1.5 font-normal">
            Manage and track your billing operations.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowAddInvoiceModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-neutral-200/90 hover:border-neutral-300 rounded-xl text-neutral-800 text-[13px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:bg-neutral-50 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-neutral-700" strokeWidth={2.2} />
            <span>Add New Invoice</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards & Filters Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-8">
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 flex-1">
          {/* Total Outstanding Card */}
          <div className="relative overflow-hidden w-full sm:w-[260px] bg-white rounded-2xl border border-neutral-200/80 px-5 py-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="invoices-outstanding-glow" />
            <span className="block text-[11px] font-bold tracking-wider text-neutral-500 uppercase mb-2">
              Total Outstanding
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl md:text-[28px] font-bold text-neutral-900 tracking-tight leading-none">
                Rs. 124,500
              </span>
              <span className="text-[11px] font-semibold text-neutral-400 uppercase">
                LKR
              </span>
            </div>
          </div>

          {/* Overdue Card */}
          <div className="relative overflow-hidden w-full sm:w-[260px] bg-white rounded-2xl border border-neutral-200/80 px-5 py-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="invoices-overdue-glow" />
            <span className="block text-[11px] font-bold tracking-wider text-neutral-500 uppercase mb-2">
              Overdue
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl md:text-[28px] font-bold text-[#DC2626] tracking-tight leading-none">
                Rs. 18,200
              </span>
              <span className="text-[11px] font-semibold text-neutral-400 uppercase">
                LKR
              </span>
            </div>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="bg-[#EDEDF0]/70 p-1 rounded-2xl flex items-center gap-1 border border-neutral-200/50 self-start lg:self-center">
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
                <th className="py-4 px-4 font-bold">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 uppercase font-bold tracking-wider hover:text-neutral-700 transition-colors"
                  >
                    <span>Invoice / Client</span>
                    <ArrowDown className="w-3.5 h-3.5 text-neutral-500" />
                  </button>
                </th>
                <th className="py-4 px-4 font-bold">Amount</th>
                <th className="py-4 px-4 font-bold">Due Date</th>
                <th className="py-4 px-4 font-bold">Status</th>
                <th className="py-4 pr-6 pl-4 text-right w-12">
                  <button
                    type="button"
                    className="text-neutral-400 hover:text-neutral-600 transition-colors"
                    aria-label="More options"
                  >
                    <MoreHorizontal className="w-4 h-4 inline-block" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100/80">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-sm text-neutral-400"
                  >
                    No invoices found in this category.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv, index) => {
                  const isSelected = selectedIds.includes(inv.id);
                  const isMenuOpen = openMenuId === inv.id;
                  const isNearBottom = index >= filteredInvoices.length - 2 && filteredInvoices.length > 2;

                  return (
                    <tr
                      key={inv.id}
                      className="group hover:bg-[#FAFAFB] transition-colors relative"
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
                          <span
                            className={`text-sm text-neutral-900 leading-tight ${
                              inv.isDraftCode
                                ? "font-normal italic"
                                : "font-semibold"
                            }`}
                          >
                            {inv.code}
                          </span>
                          {inv.isOverdue && (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-neutral-400 mt-1 font-normal">
                          {inv.client}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-4.5 px-4">
                        <div className="text-sm font-semibold text-neutral-900 leading-tight">
                          {inv.amount}
                        </div>
                        <div className="text-[11px] font-medium text-neutral-400 mt-1 uppercase">
                          {inv.currency}
                        </div>
                      </td>

                      {/* Due Date */}
                      <td className="py-4.5 px-4">
                        <div
                          className={`text-sm leading-tight ${
                            inv.isOverdue
                              ? "font-semibold text-[#DC2626]"
                              : inv.status === "DRAFT"
                              ? "text-neutral-500 italic font-normal"
                              : "text-neutral-800 font-medium"
                          }`}
                        >
                          {inv.dueDate}
                        </div>
                        {inv.dueSubtext && (
                          <div
                            className={`text-xs mt-1 ${
                              inv.isOverdue
                                ? "text-red-500 font-medium"
                                : "text-neutral-400 font-normal"
                            }`}
                          >
                            {inv.dueSubtext}
                          </div>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-4.5 px-4">
                        <div className="flex items-center gap-3">
                          {inv.status === "OVERDUE" && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase bg-[#FEE2E2]/70 text-[#DC2626] border border-red-200/50">
                              OVERDUE
                            </span>
                          )}

                          {/* UNPAID with amber / warm orange theme */}
                          {inv.status === "UNPAID" && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase bg-amber-50 text-amber-700 border border-amber-200/80">
                              UNPAID
                            </span>
                          )}

                          {inv.status === "PAID" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase bg-[#DCFCE7]/70 text-emerald-700 border border-emerald-200/60">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>PAID</span>
                            </span>
                          )}

                          {inv.status === "DRAFT" && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase bg-white text-neutral-600 border border-neutral-300">
                              DRAFT
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Row Actions: 3 Dots Menu */}
                      <td className="py-4.5 pr-6 pl-4 text-right relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenuId(isMenuOpen ? null : inv.id)
                          }
                          className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                            isMenuOpen
                              ? "bg-neutral-100 text-neutral-900 shadow-xs"
                              : "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100/70"
                          }`}
                          aria-label={`Options for invoice ${inv.code}`}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {/* Dropdown Menu */}
                        {isMenuOpen && (
                          <>
                            {/* Backdrop to close on click outside */}
                            <div
                              className="fixed inset-0 z-30"
                              onClick={() => setOpenMenuId(null)}
                            />

                            <div
                              className={`absolute right-6 w-52 bg-white rounded-2xl shadow-xl border border-neutral-200/80 py-2 z-40 text-left text-xs animate-in fade-in zoom-in-95 duration-100 ${
                                isNearBottom ? "bottom-full mb-2" : "top-full mt-1"
                              }`}
                            >
                              {/* Edit Action */}
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(inv)}
                                className="w-full px-3.5 py-2 flex items-center gap-2.5 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50 transition-colors font-medium cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5 text-neutral-500" />
                                <span>Edit Invoice</span>
                              </button>

                              {/* Status Subheading */}
                              <div className="my-1 border-t border-neutral-100" />
                              <div className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                Change Status
                              </div>

                              {/* Status Options */}
                              <button
                                type="button"
                                onClick={() => handleChangeStatus(inv.id, "PAID")}
                                className="w-full px-3.5 py-1.5 flex items-center justify-between text-neutral-700 hover:bg-emerald-50/60 hover:text-emerald-800 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                  <span>Mark as Paid</span>
                                </div>
                                {inv.status === "PAID" && (
                                  <span className="text-[10px] text-emerald-600 font-semibold">Active</span>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleChangeStatus(inv.id, "UNPAID")}
                                className="w-full px-3.5 py-1.5 flex items-center justify-between text-neutral-700 hover:bg-amber-50/60 hover:text-amber-800 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                                  <span>Mark as Unpaid</span>
                                </div>
                                {inv.status === "UNPAID" && (
                                  <span className="text-[10px] text-amber-600 font-semibold">Active</span>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleChangeStatus(inv.id, "OVERDUE")}
                                className="w-full px-3.5 py-1.5 flex items-center justify-between text-neutral-700 hover:bg-red-50/60 hover:text-red-800 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-red-500" />
                                  <span>Mark as Overdue</span>
                                </div>
                                {inv.status === "OVERDUE" && (
                                  <span className="text-[10px] text-red-600 font-semibold">Active</span>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleChangeStatus(inv.id, "DRAFT")}
                                className="w-full px-3.5 py-1.5 flex items-center justify-between text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-neutral-400" />
                                  <span>Mark as Draft</span>
                                </div>
                                {inv.status === "DRAFT" && (
                                  <span className="text-[10px] text-neutral-500 font-semibold">Active</span>
                                )}
                              </button>

                              {/* Delete Option */}
                              <div className="my-1 border-t border-neutral-100" />
                              <button
                                type="button"
                                onClick={() => {
                                  setDeletingInvoice(inv);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-3.5 py-2 flex items-center gap-2.5 text-red-600 hover:bg-red-50/80 font-medium transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                <span>Delete Invoice</span>
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer & Pagination */}
        <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
          <div>
            Showing 1-{filteredInvoices.length} of 124 invoices
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded-md text-neutral-400 hover:text-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${
                currentPage === 1
                  ? "bg-[#EDE9FE] text-[#7C3AED]"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              1
            </button>

            <button
              type="button"
              onClick={() => setCurrentPage(2)}
              className={`w-7 h-7 rounded-lg text-xs font-medium flex items-center justify-center transition-all ${
                currentPage === 2
                  ? "bg-[#EDE9FE] text-[#7C3AED] font-semibold"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              2
            </button>

            <button
              type="button"
              onClick={() => setCurrentPage(3)}
              className={`w-7 h-7 rounded-lg text-xs font-medium flex items-center justify-center transition-all ${
                currentPage === 3
                  ? "bg-[#EDE9FE] text-[#7C3AED] font-semibold"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              3
            </button>

            <span className="text-neutral-400 px-1 text-xs">...</span>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => p + 1)}
              className="p-1 rounded-md text-neutral-500 hover:text-neutral-800 transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Edit Invoice Modal */}
      {editingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-neutral-200 shadow-2xl overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">
                  Edit Invoice {editingInvoice.code}
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Update invoice specifications, currency, status, and client details.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingInvoice(null)}
                className="text-neutral-400 hover:text-neutral-600 p-1.5 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                    Invoice Number
                  </label>
                  <input
                    type="text"
                    required
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                    Client Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editClient}
                    onChange={(e) => setEditClient(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                    Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    placeholder="12500.00"
                    className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                    Currency
                  </label>
                  <select
                    value={editCurrency}
                    onChange={(e) => setEditCurrency(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 cursor-pointer"
                  >
                    <option value="LKR">LKR (Rs. Sri Lankan Rupee)</option>
                    <option value="USD">USD ($ US Dollar)</option>
                    <option value="EUR">EUR (€ Euro)</option>
                    <option value="GBP">GBP (£ British Pound)</option>
                    <option value="CAD">CAD ($ Canadian Dollar)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                    Due Date
                  </label>
                  <input
                    type="text"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    placeholder="e.g. Oct 28, 2023"
                    className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) =>
                      setEditStatus(e.target.value as "UNPAID" | "OVERDUE" | "PAID" | "DRAFT")
                    }
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 cursor-pointer"
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
                  className="px-5 py-2 text-sm font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl border border-neutral-200 shadow-2xl overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-neutral-900">
                  Delete Invoice {deletingInvoice.code}?
                </h3>
                <p className="text-xs text-neutral-500">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <p className="text-sm text-neutral-600 mt-2">
              Are you sure you want to permanently delete the invoice for{" "}
              <strong className="text-neutral-900">{deletingInvoice.client}</strong> valued at{" "}
              <strong className="text-neutral-900">{deletingInvoice.amount}</strong>?
            </p>

            <div className="flex justify-end gap-3 pt-5 mt-4 border-t border-neutral-100">
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
                className="px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Delete Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Invoice Modal */}
      {showAddInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-neutral-200 shadow-2xl overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">
                  Add New Invoice
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Enter the invoice details to create a new billing record.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddInvoiceModal(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1.5 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddInvoiceSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                  Invoice Number
                </label>
                <input
                  type="text"
                  required
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="INV-2023-091"
                  className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>

              {/* Client Selection / Creation Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    Client
                  </label>
                  <div className="client-selector-toggle">
                    <button
                      type="button"
                      onClick={() => setClientMode("select")}
                      className={`client-selector-btn ${clientMode === "select" ? "client-selector-btn-active" : ""}`}
                    >
                      <Users className="w-3.5 h-3.5 inline mr-1" />
                      Select from Clients
                    </button>
                    <button
                      type="button"
                      onClick={() => setClientMode("new")}
                      className={`client-selector-btn ${clientMode === "new" ? "client-selector-btn-active" : ""}`}
                    >
                      <UserPlus className="w-3.5 h-3.5 inline mr-1" />
                      Add New Client
                    </button>
                  </div>
                </div>

                {clientMode === "select" ? (
                  <div>
                    <select
                      value={selectedClientId}
                      onChange={(e) => {
                        const cId = e.target.value;
                        setSelectedClientId(cId);
                        const found = clients.find((c) => c.id === cId);
                        if (found) {
                          setNewClient(found.name);
                          if (found.currency) setNewCurrency(found.currency);
                        } else {
                          setNewClient("");
                        }
                      }}
                      className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 cursor-pointer"
                    >
                      <option value="">-- Choose a client from Client Page --</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.category ? `(${c.category})` : ""} {c.email ? `• ${c.email}` : ""}
                        </option>
                      ))}
                    </select>
                    {clients.length === 0 ? (
                      <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                        No clients in directory yet. Switch to &ldquo;Add New Client&rdquo; above.
                      </p>
                    ) : (
                      <p className="text-[11px] text-neutral-400 mt-1">
                        Select an existing client registered on your Clients page.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="client-new-card space-y-3">
                    <div className="client-sync-badge">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span>This new client will automatically update on your Clients page</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                          Client / Company Name *
                        </label>
                        <input
                          type="text"
                          required={clientMode === "new"}
                          value={newClientName}
                          onChange={(e) => {
                            setNewClientName(e.target.value);
                            setNewClient(e.target.value);
                          }}
                          placeholder="e.g. Acme Corporation"
                          className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          required={clientMode === "new"}
                          value={newClientEmail}
                          onChange={(e) => setNewClientEmail(e.target.value)}
                          placeholder="e.g. billing@acme.com"
                          className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                          Contact Person
                        </label>
                        <input
                          type="text"
                          value={newClientContact}
                          onChange={(e) => setNewClientContact(e.target.value)}
                          placeholder="e.g. John Doe (Optional)"
                          className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                          Category
                        </label>
                        <select
                          value={newClientCategory}
                          onChange={(e) => setNewClientCategory(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 cursor-pointer"
                        >
                          <option value="Enterprise">Enterprise</option>
                          <option value="Corporate">Corporate</option>
                          <option value="Small Business">Small Business</option>
                          <option value="Startup">Startup</option>
                          <option value="Retainer">Retainer</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                    Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder="12500.00"
                    className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                    Currency
                  </label>
                  <select
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 cursor-pointer"
                  >
                    <option value="LKR">LKR (Rs. Sri Lankan Rupee)</option>
                    <option value="USD">USD ($ US Dollar)</option>
                    <option value="EUR">EUR (€ Euro)</option>
                    <option value="GBP">GBP (£ British Pound)</option>
                    <option value="CAD">CAD ($ Canadian Dollar)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                    Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) =>
                      setNewStatus(e.target.value as "UNPAID" | "OVERDUE" | "PAID" | "DRAFT")
                    }
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 cursor-pointer"
                  >
                    <option value="UNPAID">UNPAID (Pending)</option>
                    <option value="OVERDUE">OVERDUE</option>
                    <option value="PAID">PAID</option>
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
                  className="px-5 py-2 text-sm font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Create Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
