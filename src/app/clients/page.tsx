"use client";

import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";
import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  UserPlus,
  MoreVertical,
  User,
  Mail,
  Phone,
  Zap,
  FolderClosed,
  ExternalLink,
  X,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Building,
  Plus,
  ArrowRight,
  Receipt,
} from "lucide-react";
import { useClients, useInvoices } from "@/lib/data/DataProvider";
import { formatCents, formatDateDisplay, parseAmountToCents, getCurrencySymbol } from "@/lib/format";
import type { ClientWithStats } from "@/types/billing";

function ClientsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clients, isLoading, createClient, deleteClient } = useClients();
  const { createInvoice, invoices: allInvoices } = useInvoices();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedClientForHistory, setSelectedClientForHistory] = useState<ClientWithStats | null>(null);
  const [selectedClientForBill, setSelectedClientForBill] = useState<ClientWithStats | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Notifications / Toasts
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Add Client Form State
  const [formData, setFormData] = useState({
    name: "",
    category: "Enterprise",
    contactPerson: "",
    contactRole: "",
    email: "",
    phone: "",
    currency: "USD" as "USD" | "LKR" | "EUR",
    driveUrl: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmittingClient, setIsSubmittingClient] = useState(false);

  // Quick Bill Form State
  const [quickBillTitle, setQuickBillTitle] = useState("Professional Services & Development Sprint");
  const [quickBillAmount, setQuickBillAmount] = useState("1500");
  const [isSubmittingQuickBill, setIsSubmittingQuickBill] = useState(false);

  // Handle URL param ?client=<id> to deep link to client ledger
  useEffect(() => {
    const targetClientId = searchParams.get("client");
    if (targetClientId && clients.length > 0) {
      const match = clients.find((c) => c.id === targetClientId);
      if (match) {
        setSelectedClientForHistory(match);
      }
    }
  }, [searchParams, clients]);

  // Keep selectedClientForHistory synced with live clients data
  useEffect(() => {
    if (selectedClientForHistory) {
      const updated = clients.find((c) => c.id === selectedClientForHistory.id);
      if (updated) setSelectedClientForHistory(updated);
    }
  }, [clients, selectedClientForHistory]);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3600);
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = "Client name is required";
    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!formData.email.includes("@")) {
      errors.email = "Please enter a valid email address";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmittingClient(true);
    try {
      const created = await createClient({
        name: formData.name.trim(),
        category: formData.category,
        contactPerson: formData.contactPerson.trim() || formData.name.trim(),
        contactRole: formData.contactRole.trim() || undefined,
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        currency: formData.currency,
        driveUrl: formData.driveUrl.trim() || undefined,
      });

      setIsAddModalOpen(false);
      setFormData({
        name: "",
        category: "Enterprise",
        contactPerson: "",
        contactRole: "",
        email: "",
        phone: "",
        currency: "USD",
        driveUrl: "",
      });
      showToast(`Client "${created.name}" added successfully!`);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String(err.message) : "Failed to add client";
      showToast(msg, "error");
    } finally {
      setIsSubmittingClient(false);
    }
  };

  const handleDeleteClient = async (id: string, name: string) => {
    try {
      await deleteClient(id);
      setActiveMenuId(null);
      if (selectedClientForHistory?.id === id) {
        setSelectedClientForHistory(null);
      }
      showToast(`Client "${name}" removed from directory.`);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String(err.message) : "Failed to remove client";
      showToast(msg, "error");
    }
  };

  const handleQuickBillSubmit = async () => {
    if (!selectedClientForBill) return;
    setIsSubmittingQuickBill(true);

    try {
      const amountCents = parseAmountToCents(quickBillAmount);
      const today = new Date();
      const issueDate = today.toISOString().split("T")[0];
      const dueDateObj = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      const dueDate = dueDateObj.toISOString().split("T")[0];

      const created = await createInvoice({
        clientId: selectedClientForBill.id,
        title: quickBillTitle.trim() || "Quick Bill Deliverable",
        amountCents,
        currency: selectedClientForBill.currency,
        issueDate,
        dueDate,
        status: "UNPAID",
      });

      setSelectedClientForBill(null);
      showToast(`Quick Bill ${created.code} generated for ${selectedClientForBill.name}!`);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String(err.message) : "Failed to create invoice";
      showToast(msg, "error");
    } finally {
      setIsSubmittingQuickBill(false);
    }
  };

  // Find invoices specifically for selected client history
  const clientLedgerInvoices = selectedClientForHistory
    ? allInvoices.filter((i) => i.clientId === selectedClientForHistory.id)
    : [];

  return (
    <div className="p-8 lg:p-10 max-w-7xl mx-auto space-y-8 motion-page">
      {/* Toast Notification */}
      <MotionPresence>
        {notification && (
          <MotionSurface
            kind="toast"
            className={`fixed top-14 right-6 z-50 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium border ${
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

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-[42px] font-serif font-normal text-neutral-900 tracking-tight leading-none">
            Clients
          </h1>
          <p className="text-sm text-neutral-500 mt-2 font-normal">
            Manage your client relationships, contracts, and ledger balance.
          </p>
        </div>

        <button
          onClick={() => {
            setFormErrors({});
            setIsAddModalOpen(true);
          }}
          className="group inline-flex items-center gap-2.5 px-4 py-2.5 bg-white border border-neutral-200/90 rounded-xl text-sm font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-neutral-50 hover:border-neutral-300 hover:shadow-sm transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#7c3aed]/40"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <UserPlus
              className="w-4 h-4 text-neutral-700 transition-transform duration-200 ease-out group-hover:scale-105 group-hover:-translate-y-px group-hover:text-[#7c3aed]"
              strokeWidth={2}
            />
          </div>
          <span>Add Client</span>
        </button>
      </div>

      {/* Client Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          // Skeleton loading cards
          Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-[#ececf0] rounded-2xl p-5 border border-neutral-200/60 animate-pulse h-64"
            />
          ))
        ) : clients.length === 0 ? (
          // Clean Empty State
          <div className="col-span-full bg-white rounded-2xl border border-neutral-200/80 p-12 text-center flex flex-col items-center justify-center shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-400 mb-3.5">
              <User className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-neutral-900 tracking-tight">No clients yet</h3>
            <p className="text-sm text-neutral-500 mt-1 max-w-sm font-normal">
              Add your first client to start organizing business relationships, tracking billings, and issuing invoices.
            </p>
            <button
              onClick={() => {
                setFormErrors({});
                setIsAddModalOpen(true);
              }}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Client</span>
            </button>
          </div>
        ) : (
          clients.map((client) => {
            const letter = client.name.trim().charAt(0).toUpperCase();

            return (
              <div
                key={client.id}
                className="motion-card relative bg-[#ececf0] hover:bg-[#eaeaf0] transition-colors rounded-2xl p-5 border border-neutral-200/60 shadow-xs flex flex-col justify-between group"
              >
                {/* Top Bar: Avatar, Title, Category, Menu */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      {/* Initials Avatar */}
                      <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-xs border border-neutral-100 shrink-0 transition-transform duration-300 group-hover:scale-105">
                        <span className="text-base font-bold text-[#7c3aed]">
                          {letter}
                        </span>
                      </div>

                      <div>
                        <h2 className="text-[17px] font-semibold text-neutral-900 tracking-tight leading-snug">
                          {client.name}
                        </h2>
                        <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-normal mt-0.5">
                          <FolderClosed className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span>{client.category}</span>
                        </div>
                      </div>
                    </div>

                    {/* 3-dots Context Menu Button */}
                    <div className="relative">
                      <button
                        onClick={() =>
                          setActiveMenuId(activeMenuId === client.id ? null : client.id)
                        }
                        className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-white/60 transition-colors cursor-pointer"
                        aria-label="Options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Dropdown Menu */}
                      {activeMenuId === client.id && (
                        <div className="absolute right-0 top-8 z-30 bg-white rounded-xl shadow-lg border border-neutral-200 py-1.5 w-44 text-xs font-medium text-neutral-700">
                          <button
                            onClick={() => {
                              setSelectedClientForHistory(client);
                              setActiveMenuId(null);
                            }}
                            className="w-full px-3.5 py-2 text-left hover:bg-neutral-50 flex items-center gap-2 cursor-pointer"
                          >
                            <Receipt className="w-3.5 h-3.5 text-neutral-400" />
                            <span>View Ledger</span>
                          </button>
                          <button
                            onClick={() => {
                              router.push(`/invoices?new=1&client=${client.id}`);
                              setActiveMenuId(null);
                            }}
                            className="w-full px-3.5 py-2 text-left hover:bg-neutral-50 flex items-center gap-2 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 text-neutral-400" />
                            <span>New Invoice</span>
                          </button>
                          {client.driveUrl && (
                            <a
                              href={client.driveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full px-3.5 py-2 text-left hover:bg-neutral-50 flex items-center gap-2 text-neutral-700"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
                              <span>Open Drive Folder</span>
                            </a>
                          )}
                          <div className="my-1 border-t border-neutral-100" />
                          <button
                            onClick={() => handleDeleteClient(client.id, client.name)}
                            className="w-full px-3.5 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            <span>Delete Client</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financial Metrics Strip */}
                  <div className="mt-5 pt-4 border-t border-neutral-200/70 grid grid-cols-3 gap-2 text-left">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block leading-tight">
                        TOTAL BILLED
                      </span>
                      <span className="text-[15px] font-bold text-neutral-900 mt-1 block leading-tight">
                        {formatCents(client.totalBilledCents, client.currency)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block leading-tight">
                        TOTAL PAID
                      </span>
                      <span className="text-[15px] font-bold text-emerald-700 mt-1 block leading-tight">
                        {formatCents(client.totalPaidCents, client.currency)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block leading-tight">
                        OUTSTANDING
                      </span>
                      <span
                        className={`text-[15px] font-bold mt-1 block leading-tight ${
                          client.outstandingBalanceCents > 0
                            ? "text-rose-600 font-mono"
                            : "text-neutral-500"
                        }`}
                      >
                        {formatCents(client.outstandingBalanceCents, client.currency)}
                      </span>
                    </div>
                  </div>

                  {/* Contact Info Row */}
                  <div className="mt-4 pt-3.5 border-t border-neutral-200/50 space-y-1.5 text-xs text-neutral-600 font-normal">
                    <div className="flex items-center gap-2 truncate">
                      <User className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span className="truncate">
                        {client.contactPerson}
                        {client.contactRole ? ` (${client.contactRole})` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                    {client.phone && (
                      <div className="flex items-center gap-2 truncate">
                        <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="truncate">{client.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="mt-5 pt-3.5 border-t border-neutral-200/70 flex items-center justify-between">
                  <span className="text-xs text-neutral-500 font-medium">
                    {client.invoicesCount} {client.invoicesCount === 1 ? "invoice" : "invoices"}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedClientForHistory(client)}
                      className="px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg shadow-xs hover:bg-neutral-50 transition-colors cursor-pointer"
                    >
                      Ledger
                    </button>

                    <button
                      onClick={() => {
                        setSelectedClientForBill(client);
                        setQuickBillAmount("1500");
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#7c3aed] text-white rounded-lg text-xs font-semibold hover:bg-[#6d28d9] transition-colors shadow-xs cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 fill-white" />
                      <span>Quick Bill</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Client Modal */}
      <MotionPresence>
        {isAddModalOpen && (
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
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">
                      Add New Client
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Create a new client profile in your local directory.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddClient} className="p-6 space-y-4 text-xs font-medium text-neutral-700">
                <div>
                  <label className="block mb-1.5 text-neutral-700 font-semibold">
                    Client / Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Apex Architecture Ltd"
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40 ${
                      formErrors.name ? "border-rose-400 bg-rose-50/20" : "border-neutral-200"
                    }`}
                  />
                  {formErrors.name && (
                    <span className="text-rose-600 text-[11px] mt-1 block">{formErrors.name}</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block mb-1.5 text-neutral-700 font-semibold">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40 bg-white"
                    >
                      <option value="Enterprise">Enterprise</option>
                      <option value="Startup">Startup</option>
                      <option value="Agency">Agency</option>
                      <option value="Small Business">Small Business</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1.5 text-neutral-700 font-semibold">
                      Billing Currency *
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          currency: e.target.value as "USD" | "LKR" | "EUR",
                        })
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40 bg-white"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="LKR">LKR (Rs.)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block mb-1.5 text-neutral-700 font-semibold">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      value={formData.contactPerson}
                      onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                      placeholder="e.g. Sarah Jenkins"
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
                    />
                  </div>

                  <div>
                    <label className="block mb-1.5 text-neutral-700 font-semibold">
                      Contact Role
                    </label>
                    <input
                      type="text"
                      value={formData.contactRole}
                      onChange={(e) => setFormData({ ...formData, contactRole: e.target.value })}
                      placeholder="e.g. Director / CEO"
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block mb-1.5 text-neutral-700 font-semibold">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="sarah@apexarch.com"
                      className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40 ${
                        formErrors.email ? "border-rose-400 bg-rose-50/20" : "border-neutral-200"
                      }`}
                    />
                    {formErrors.email && (
                      <span className="text-rose-600 text-[11px] mt-1 block">{formErrors.email}</span>
                    )}
                  </div>

                  <div>
                    <label className="block mb-1.5 text-neutral-700 font-semibold">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+1 (555) 284-9102"
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 text-neutral-700 font-semibold">
                    Google Drive Folder Link
                  </label>
                  <input
                    type="url"
                    value={formData.driveUrl}
                    onChange={(e) => setFormData({ ...formData, driveUrl: e.target.value })}
                    placeholder="https://drive.google.com/drive/folders/..."
                    className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingClient}
                    className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    {isSubmittingClient ? "Saving..." : "Save Client"}
                  </button>
                </div>
              </form>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Client Ledger / Invoices Modal */}
      <MotionPresence>
        {selectedClientForHistory && (
          <MotionSurface
            kind="dialog"
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <MotionSurface
              kind="panel"
              className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-neutral-200 overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white border border-neutral-200 flex items-center justify-center font-bold text-[#7c3aed]">
                    {selectedClientForHistory.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">
                      {selectedClientForHistory.name}
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Client Ledger & Transaction History
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedClientForHistory(null)}
                  className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* 3 Metric Cards */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block">
                      TOTAL BILLED
                    </span>
                    <span className="text-base font-bold text-neutral-900 mt-1 block">
                      {formatCents(selectedClientForHistory.totalBilledCents, selectedClientForHistory.currency)}
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                    <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider block">
                      TOTAL PAID
                    </span>
                    <span className="text-base font-bold text-emerald-700 mt-1 block">
                      {formatCents(selectedClientForHistory.totalPaidCents, selectedClientForHistory.currency)}
                    </span>
                  </div>
                  <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100">
                    <span className="text-[10px] text-rose-600 font-bold uppercase tracking-wider block">
                      OUTSTANDING
                    </span>
                    <span className="text-base font-bold text-rose-700 mt-1 block font-mono">
                      {formatCents(selectedClientForHistory.outstandingBalanceCents, selectedClientForHistory.currency)}
                    </span>
                  </div>
                </div>

                {/* Contact Information & Drive */}
                <div className="text-xs text-neutral-600 space-y-1 bg-neutral-50/50 p-3.5 rounded-xl border border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div>
                      <strong>Contact:</strong> {selectedClientForHistory.contactPerson}
                      {selectedClientForHistory.contactRole ? ` · ${selectedClientForHistory.contactRole}` : ""}
                    </div>
                    <div>
                      <strong>Email:</strong> {selectedClientForHistory.email}
                    </div>
                  </div>
                  {selectedClientForHistory.driveUrl && (
                    <a
                      href={selectedClientForHistory.driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-[#7c3aed] font-semibold hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Drive Folder</span>
                    </a>
                  )}
                </div>

                {/* Invoices List Table */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <h4 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
                      Invoices & Payment Records
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          router.push(`/invoices?new=1&client=${selectedClientForHistory.id}`);
                        }}
                        className="text-xs text-[#7c3aed] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>New Invoice</span>
                      </button>
                      <span className="text-neutral-300">·</span>
                      <button
                        onClick={() => {
                          router.push(`/invoices?client=${selectedClientForHistory.id}`);
                        }}
                        className="text-xs text-neutral-600 hover:underline font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <span>View all</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="border border-neutral-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 sticky top-0">
                        <tr>
                          <th className="py-2.5 px-4 font-semibold">Invoice Code</th>
                          <th className="py-2.5 px-4 font-semibold">Issue Date</th>
                          <th className="py-2.5 px-4 font-semibold">Amount</th>
                          <th className="py-2.5 px-4 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {clientLedgerInvoices.length > 0 ? (
                          clientLedgerInvoices.map((inv) => (
                            <tr
                              key={inv.id}
                              onClick={() => router.push(`/invoices?invoice=${inv.id}`)}
                              className="hover:bg-purple-50/40 transition-colors cursor-pointer"
                            >
                              <td className="py-3 px-4 font-mono font-medium text-neutral-900">
                                {inv.code}
                              </td>
                              <td className="py-3 px-4 text-neutral-500">
                                {formatDateDisplay(inv.issueDate)}
                              </td>
                              <td className="py-3 px-4 font-semibold text-neutral-900">
                                {formatCents(inv.amountCents, inv.currency)}
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                    inv.status === "PAID"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : inv.status === "OVERDUE"
                                      ? "bg-rose-100 text-rose-700"
                                      : inv.status === "DRAFT"
                                      ? "bg-neutral-100 text-neutral-600"
                                      : "bg-blue-100 text-blue-700"
                                  }`}
                                >
                                  {inv.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-neutral-400">
                              No invoices generated for this client yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 flex justify-end">
                <button
                  onClick={() => setSelectedClientForHistory(null)}
                  className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Close Ledger
                </button>
              </div>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Instant Quick Bill Modal */}
      <MotionPresence>
        {selectedClientForBill && (
          <MotionSurface
            kind="dialog"
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <MotionSurface
              kind="panel"
              className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-neutral-200 overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#ede9fe] text-[#7c3aed] flex items-center justify-center">
                    <Zap className="w-4 h-4 fill-[#7c3aed]" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">
                      Instant Quick Bill
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Issuing to: {selectedClientForBill.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedClientForBill(null)}
                  className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs font-medium text-neutral-700">
                <div>
                  <label className="block mb-1.5 text-neutral-700 font-semibold">
                    Service Deliverable Title
                  </label>
                  <input
                    type="text"
                    value={quickBillTitle}
                    onChange={(e) => setQuickBillTitle(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block mb-1.5 text-neutral-700 font-semibold">
                      Amount ({selectedClientForBill.currency})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={quickBillAmount}
                      onChange={(e) => setQuickBillAmount(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/40"
                    />
                  </div>

                  <div>
                    <label className="block mb-1.5 text-neutral-700 font-semibold">
                      Payment Terms
                    </label>
                    <input
                      type="text"
                      readOnly
                      value="Net 7 Days (Default)"
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-100/70 text-sm text-neutral-600"
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-purple-50/60 rounded-xl border border-purple-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="deposit"
                      defaultChecked
                      className="w-4 h-4 text-[#7c3aed] rounded-sm focus:ring-[#7c3aed]"
                    />
                    <label htmlFor="deposit" className="text-xs font-medium text-neutral-700">
                      Require 50% Upfront Deposit
                    </label>
                  </div>
                  <span className="text-xs font-semibold text-[#7c3aed]">
                    Deposit: {getCurrencySymbol(selectedClientForBill.currency)}
                    {((parseFloat(quickBillAmount) || 0) * 0.5).toFixed(2)}
                  </span>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => setSelectedClientForBill(null)}
                    className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSubmittingQuickBill}
                    onClick={handleQuickBillSubmit}
                    className="px-5 py-2.5 bg-[#6941C6] hover:bg-[#5b32be] disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer"
                  >
                    {isSubmittingQuickBill ? "Creating..." : "Generate & Save Invoice"}
                  </button>
                </div>
              </div>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>
    </div>
  );
}

export default function ClientsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 lg:p-10 max-w-7xl mx-auto space-y-8 animate-pulse">
          <div className="h-10 w-48 bg-neutral-200 rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="h-64 bg-neutral-200 rounded-2xl" />
            <div className="h-64 bg-neutral-200 rounded-2xl" />
            <div className="h-64 bg-neutral-200 rounded-2xl" />
          </div>
        </div>
      }
    >
      <ClientsContent />
    </Suspense>
  );
}
