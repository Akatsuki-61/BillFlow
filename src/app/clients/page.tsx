"use client";

import { Button, PageHeader, EmptyState } from "@/components/ui/Workspace";

import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";
import React, { useState, Suspense } from "react";
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
  Edit3,
} from "lucide-react";
import { useClients, useInvoices, useData } from "@/lib/data/DataProvider";
import {
  formatCents,
  formatDateDisplay,
  parseAmountToCents,
  getCurrencySymbol,
} from "@/lib/format";
import { openExternalLink } from "@/lib/deliveryUrl";
import type { ClientWithStats, Currency } from "@/types/billing";

function ClientsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clients, isLoading, createClient, updateClient, deleteClient } = useClients();
  const { createInvoice, invoices: allInvoices } = useInvoices();
  const { activeCurrency, settings } = useData();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const targetClientId = searchParams.get("client");
  const [previousTargetClientId, setPreviousTargetClientId] = useState(targetClientId);
  const [historyClientId, setHistoryClientId] = useState<string | null | undefined>();
  if (previousTargetClientId !== targetClientId) {
    setPreviousTargetClientId(targetClientId);
    setHistoryClientId(undefined);
  }
  const selectedClientForHistory = clients.find(
    (client) => client.id === (historyClientId === undefined ? targetClientId : historyClientId),
  ) ?? null;
  const setSelectedClientForHistory = (client: ClientWithStats | null) => {
    setHistoryClientId(client?.id ?? null);
  };
  const [selectedClientForBill, setSelectedClientForBill] =
    useState<ClientWithStats | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Notifications / Toasts
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Add Client Form State
  const [formData, setFormData] = useState({
    name: "",
    category: "Enterprise",
    contactPerson: "",
    contactRole: "",
    email: "",
    phone: "",
    currency: (settings?.defaultCurrency || activeCurrency || "USD") as Currency,
    driveUrl: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmittingClient, setIsSubmittingClient] = useState(false);

  // Edit Client Form State
  const [editingClient, setEditingClient] = useState<ClientWithStats | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    category: "Enterprise",
    contactPerson: "",
    contactRole: "",
    email: "",
    phone: "",
    currency: (settings?.defaultCurrency || activeCurrency || "USD") as Currency,
    driveUrl: "",
  });
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Quick Bill Form State
  const [quickBillTitle, setQuickBillTitle] = useState(
    "Professional Services & Development Sprint",
  );
  const [quickBillAmount, setQuickBillAmount] = useState("1500");
  const [isSubmittingQuickBill, setIsSubmittingQuickBill] = useState(false);

  const showToast = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
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
        currency: (settings?.defaultCurrency || activeCurrency || "USD") as Currency,
        driveUrl: "",
      });
      showToast(`Client "${created.name}" added successfully!`);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Failed to add client";
      showToast(msg, "error");
    } finally {
      setIsSubmittingClient(false);
    }
  };

  const handleOpenEditModal = (client: ClientWithStats) => {
    setEditFormErrors({});
    setEditFormData({
      name: client.name,
      category: client.category,
      contactPerson: client.contactPerson || "",
      contactRole: client.contactRole || "",
      email: client.email,
      phone: client.phone || "",
      currency: client.currency,
      driveUrl: client.driveUrl || "",
    });
    setEditingClient(client);
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    setEditFormErrors({});

    const errors: Record<string, string> = {};
    if (!editFormData.name.trim()) errors.name = "Client name is required";
    if (!editFormData.email.trim()) {
      errors.email = "Email is required";
    } else if (!editFormData.email.includes("@")) {
      errors.email = "Please enter a valid email address";
    }

    if (Object.keys(errors).length > 0) {
      setEditFormErrors(errors);
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const updated = await updateClient(editingClient.id, {
        name: editFormData.name.trim(),
        category: editFormData.category,
        contactPerson: editFormData.contactPerson.trim() || editFormData.name.trim(),
        contactRole: editFormData.contactRole.trim() || null,
        email: editFormData.email.trim(),
        phone: editFormData.phone.trim() || null,
        currency: editFormData.currency,
        driveUrl: editFormData.driveUrl.trim() || null,
      });

      setEditingClient(null);
      showToast(`Client "${updated.name}" updated successfully!`);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Failed to update client";
      showToast(msg, "error");
    } finally {
      setIsSubmittingEdit(false);
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
      const msg =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Failed to remove client";
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
      showToast(
        `Quick Bill ${created.code} generated for ${selectedClientForBill.name}!`,
      );
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Failed to create invoice";
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

      {/* Header Section */}
      <PageHeader
        title="Clients"
        description="Manage your client relationships, contracts, and ledger balance."
      >
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={() => {
              setFormErrors({});
              setIsAddModalOpen(true);
            }}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <UserPlus
                className="w-4 h-4 text-content-neutral-700 transition-transform duration-200 ease-out group-hover:scale-105 group-hover:-translate-y-px group-hover:text-accent"
                strokeWidth={2}
              />
            </div>
            <span>Add Client</span>
          </Button>
        </div>
      </PageHeader>

      {/* Client Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          // Skeleton loading cards
          Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-surface-secondary rounded-2xl p-5 border border-line-neutral-200/60 animate-pulse h-64"
            />
          ))
        ) : clients.length === 0 ? (
          // Clean Empty State
          <div className="ui-card col-span-full">
            <EmptyState
              title="No clients yet"
              description="Add your first client to start organizing business relationships, tracking billings, and issuing invoices."
              icon={<User />}
            >
              <Button
                variant="primary"
                onClick={() => {
                  setFormErrors({});
                  setIsAddModalOpen(true);
                }}
                className="mt-5"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Client</span>
              </Button>
            </EmptyState>
          </div>
        ) : (
          clients.map((client) => {
            const letter = client.name.trim().charAt(0).toUpperCase();

            return (
              <div
                key={client.id}
                className="ui-card motion-card relative transition-colors p-5 flex flex-col justify-between group"
              >
                {/* Top Bar: Avatar, Title, Category, Menu */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      {/* Initials Avatar */}
                      <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center shadow-xs border border-line-neutral-100 shrink-0 transition-transform duration-300 group-hover:scale-105">
                        <span className="text-base font-bold text-accent">
                          {letter}
                        </span>
                      </div>

                      <div>
                        <h2 className="text-[17px] font-semibold text-content-neutral-900 tracking-tight leading-snug">
                          {client.name}
                        </h2>
                        <div className="flex items-center gap-1.5 text-xs text-content-neutral-500 font-normal mt-0.5">
                          <FolderClosed className="w-3.5 h-3.5 text-content-neutral-400 shrink-0" />
                          <span>{client.category}</span>
                        </div>
                      </div>
                    </div>

                    {/* 3-dots Context Menu Button */}
                    <div className="relative">
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={() =>
                          setActiveMenuId(
                            activeMenuId === client.id ? null : client.id,
                          )
                        }

                        aria-label="Options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>

                      {/* Dropdown Menu */}
                      {activeMenuId === client.id && (
                        <div className="absolute right-0 top-8 z-30 bg-surface rounded-xl shadow-lg border border-line-neutral-200 py-1.5 w-44 text-xs font-medium text-content-neutral-700">
                          <Button
                            variant="menu"
                            onClick={() => {
                              handleOpenEditModal(client);
                              setActiveMenuId(null);
                            }}
                            className="w-full"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-content-neutral-400" />
                            <span>Edit Profile</span>
                          </Button>
                          <Button
                            variant="menu"
                            onClick={() => {
                              setSelectedClientForHistory(client);
                              setActiveMenuId(null);
                            }}
                            className="w-full"
                          >
                            <Receipt className="w-3.5 h-3.5 text-content-neutral-400" />
                            <span>View Ledger</span>
                          </Button>
                          <Button
                            variant="menu"
                            onClick={() => {
                              router.push(
                                `/invoices?new=1&client=${client.id}`,
                              );
                              setActiveMenuId(null);
                            }}
                            className="w-full"
                          >
                            <Plus className="w-3.5 h-3.5 text-content-neutral-400" />
                            <span>New Invoice</span>
                          </Button>
                          {client.driveUrl && (
                            <Button
                              variant="menu"
                              onClick={(e) => {
                                openExternalLink(client.driveUrl, e);
                                setActiveMenuId(null);
                              }}
                              className="w-full text-left"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-content-neutral-400" />
                              <span>Open Drive Folder</span>
                            </Button>
                          )}
                          <div className="my-1 border-t border-line-neutral-100" />
                          <Button
                            variant="danger"
                            onClick={() =>
                              handleDeleteClient(client.id, client.name)
                            }
                            className="w-full"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-content-red-400" />
                            <span>Delete Client</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financial Metrics Strip */}
                  <div className="mt-5 pt-4 border-t border-line-neutral-200/70 grid grid-cols-3 gap-2 text-left">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-content-neutral-400 block leading-tight">
                        TOTAL BILLED
                      </span>
                      <span className="text-[15px] font-bold text-content-neutral-900 mt-1 block leading-tight">
                        {formatCents(client.totalBilledCents, client.currency)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-content-neutral-400 block leading-tight">
                        TOTAL PAID
                      </span>
                      <span className="text-[15px] font-bold text-content-emerald-700 mt-1 block leading-tight">
                        {formatCents(client.totalPaidCents, client.currency)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-content-neutral-400 block leading-tight">
                        OUTSTANDING
                      </span>
                      <span
                        className={`text-[15px] font-bold mt-1 block leading-tight ${
                          client.outstandingBalanceCents > 0
                            ? "text-content-rose-600 font-mono"
                            : "text-content-neutral-500"
                        }`}
                      >
                        {formatCents(
                          client.outstandingBalanceCents,
                          client.currency,
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Contact Info Row */}
                  <div className="mt-4 pt-3.5 border-t border-line-neutral-200/50 space-y-1.5 text-xs text-content-neutral-600 font-normal">
                    <div className="flex items-center gap-2 truncate">
                      <User className="w-3.5 h-3.5 text-content-neutral-400 shrink-0" />
                      <span className="truncate">
                        {client.contactPerson}
                        {client.contactRole ? ` (${client.contactRole})` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 text-content-neutral-400 shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                    {client.phone && (
                      <div className="flex items-center gap-2 truncate">
                        <Phone className="w-3.5 h-3.5 text-content-neutral-400 shrink-0" />
                        <span className="truncate">{client.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="mt-5 pt-3.5 border-t border-line-neutral-200/70 flex items-center justify-between">
                  <span className="text-xs text-content-neutral-500 font-medium">
                    {client.invoicesCount}{" "}
                    {client.invoicesCount === 1 ? "invoice" : "invoices"}
                  </span>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setSelectedClientForHistory(client)}
                    >
                      Ledger
                    </Button>

                    <Button
                      variant="primary"
                      onClick={() => {
                        setSelectedClientForBill(client);
                        setQuickBillAmount("1500");
                      }}
                    >
                      <Zap className="w-3.5 h-3.5 fill-white" />
                      <span>Quick Bill</span>
                    </Button>
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
            <MotionSurface onDismiss={() => setIsAddModalOpen(false)}
              kind="panel"
              className="bg-surface rounded-2xl w-full max-w-lg shadow-2xl border border-line-neutral-200 overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-line-neutral-100 flex items-center justify-between bg-surface-neutral-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-accent-faint text-accent flex items-center justify-center">
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-content-neutral-900">
                      Add New Client
                    </h3>
                    <p className="text-xs text-content-neutral-400">
                      Create a new client profile in your local directory.
                    </p>
                  </div>
                </div>
                <Button
                  aria-label="Close"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <form
                onSubmit={handleAddClient}
                className="p-6 space-y-4 text-xs font-medium text-content-neutral-700"
              >
                <div>
                  <label className="block mb-1.5 text-content-neutral-700 font-semibold">
                    Client / Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g. Apex Architecture Ltd"
                    className={`ui-field w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 ${
                      formErrors.name
                        ? "border-line-rose-400 bg-surface-rose-50/20"
                        : "border-line-neutral-200"
                    }`}
                  />
                  {formErrors.name && (
                    <span className="text-content-rose-600 text-[11px] mt-1 block">
                      {formErrors.name}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block mb-1.5 text-content-neutral-700 font-semibold">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      className="ui-field w-full px-3 border border-line-neutral-200 focus:outline-none focus:ring-2 focus:ring-accent/40"
                    >
                      <option value="Enterprise">Enterprise</option>
                      <option value="Startup">Startup</option>
                      <option value="Agency">Agency</option>
                      <option value="Small Business">Small Business</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1.5 text-content-neutral-700 font-semibold">
                      Billing Currency *
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          currency: e.target.value as Currency,
                        })
                      }
                      className="ui-field w-full px-3 border border-line-neutral-200 focus:outline-none focus:ring-2 focus:ring-accent/40"
                    >
                      <option value="USD">USD ($ - US Dollar)</option>
                      <option value="EUR">EUR (€ - Euro)</option>
                      <option value="LKR">LKR (Rs. - Sri Lanka Rupee)</option>
                      <option value="GBP">GBP (£ - British Pound)</option>
                      <option value="CAD">CAD (CA$ - Canadian Dollar)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block mb-1.5 text-content-neutral-700 font-semibold">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      value={formData.contactPerson}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contactPerson: e.target.value,
                        })
                      }
                      placeholder="e.g. Sarah Jenkins"
                      className="ui-field w-full px-3 border border-line-neutral-200 focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  </div>

                  <div>
                    <label className="block mb-1.5 text-content-neutral-700 font-semibold">
                      Contact Role
                    </label>
                    <input
                      type="text"
                      value={formData.contactRole}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contactRole: e.target.value,
                        })
                      }
                      placeholder="e.g. Director / CEO"
                      className="ui-field w-full px-3 border border-line-neutral-200 focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block mb-1.5 text-content-neutral-700 font-semibold">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      placeholder="sarah@apexarch.com"
                      className={`ui-field w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 ${
                        formErrors.email
                          ? "border-line-rose-400 bg-surface-rose-50/20"
                          : "border-line-neutral-200"
                      }`}
                    />
                    {formErrors.email && (
                      <span className="text-content-rose-600 text-[11px] mt-1 block">
                        {formErrors.email}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block mb-1.5 text-content-neutral-700 font-semibold">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      placeholder="+1 (555) 284-9102"
                      className="ui-field w-full px-3 border border-line-neutral-200 focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 text-content-neutral-700 font-semibold">
                    Google Drive Folder Link
                  </label>
                  <input
                    type="url"
                    value={formData.driveUrl}
                    onChange={(e) =>
                      setFormData({ ...formData, driveUrl: e.target.value })
                    }
                    placeholder="https://drive.google.com/drive/folders/..."
                    className="ui-field w-full px-3 border border-line-neutral-200 focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-line-neutral-100">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={isSubmittingClient}
                  >
                    {isSubmittingClient ? "Saving..." : "Save Client"}
                  </Button>
                </div>
              </form>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Edit Client Modal */}
      <MotionPresence>
        {editingClient && (
          <MotionSurface
            kind="dialog"
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <MotionSurface onDismiss={() => setEditingClient(null)}
              kind="panel"
              className="bg-surface rounded-2xl w-full max-w-lg shadow-2xl border border-line-neutral-200 overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-line-neutral-100 flex items-center justify-between bg-surface-neutral-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-accent-faint text-accent flex items-center justify-center">
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-content-neutral-900">
                      Edit Client Profile
                    </h3>
                    <p className="text-xs text-content-neutral-400">
                      Update relationship details and default delivery location
                    </p>
                  </div>
                </div>
                <Button
                  aria-label="Close"
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditingClient(null)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <form onSubmit={handleUpdateClient} className="p-6 space-y-4 text-xs font-medium text-content-neutral-700">
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block mb-1.5 text-content-neutral-700 font-semibold">
                      Client Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      placeholder="e.g. Apex Architecture Ltd"
                      className={`ui-field w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 ${
                        editFormErrors.name
                          ? "border-line-rose-400 bg-surface-rose-50/20"
                          : "border-line-neutral-200"
                      }`}
                    />
                    {editFormErrors.name && (
                      <span className="text-content-rose-600 text-[11px] mt-1 block">
                        {editFormErrors.name}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block mb-1.5 text-content-neutral-700 font-semibold">
                      Category
                    </label>
                    <select
                      value={editFormData.category}
                      onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                      className="ui-field w-full px-3 border border-line-neutral-200 focus:outline-none focus:ring-2 focus:ring-accent/40"
                    >
                      <option value="Enterprise">Enterprise</option>
                      <option value="Startup">Startup</option>
                      <option value="Agency">Agency</option>
                      <option value="SMB">SMB</option>
                      <option value="Individual">Individual</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block mb-1.5 text-content-neutral-700 font-semibold">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      value={editFormData.contactPerson}
                      onChange={(e) => setEditFormData({ ...editFormData, contactPerson: e.target.value })}
                      placeholder="e.g. Sarah Jenkins"
                      className="ui-field w-full px-3 border border-line-neutral-200 focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  </div>

                  <div>
                    <label className="block mb-1.5 text-content-neutral-700 font-semibold">
                      Contact Role
                    </label>
                    <input
                      type="text"
                      value={editFormData.contactRole}
                      onChange={(e) => setEditFormData({ ...editFormData, contactRole: e.target.value })}
                      placeholder="e.g. Director / CEO"
                      className="ui-field w-full px-3 border border-line-neutral-200 focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block mb-1.5 text-content-neutral-700 font-semibold">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={editFormData.email}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      placeholder="sarah@apexarch.com"
                      className={`ui-field w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 ${
                        editFormErrors.email
                          ? "border-line-rose-400 bg-surface-rose-50/20"
                          : "border-line-neutral-200"
                      }`}
                    />
                    {editFormErrors.email && (
                      <span className="text-content-rose-600 text-[11px] mt-1 block">
                        {editFormErrors.email}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block mb-1.5 text-content-neutral-700 font-semibold">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                      placeholder="+1 (555) 284-9102"
                      className="ui-field w-full px-3 border border-line-neutral-200 focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 text-content-neutral-700 font-semibold">
                    Default Delivery Location / Drive Folder Link
                  </label>
                  <input
                    type="url"
                    value={editFormData.driveUrl}
                    onChange={(e) => setEditFormData({ ...editFormData, driveUrl: e.target.value })}
                    placeholder="https://drive.google.com/drive/folders/..."
                    className="ui-field w-full px-3 border border-line-neutral-200 focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                  <p className="text-[11px] text-content-neutral-400 mt-1">
                    Updates default delivery location for future invoices. Existing invoices preserve their historical delivery link and issued snapshot.
                  </p>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-line-neutral-100">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setEditingClient(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={isSubmittingEdit}
                  >
                    {isSubmittingEdit ? "Saving..." : "Update Client Profile"}
                  </Button>
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
            <MotionSurface onDismiss={() => setSelectedClientForHistory(null)}
              kind="panel"
              className="bg-surface rounded-2xl w-full max-w-2xl shadow-2xl border border-line-neutral-200 overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-line-neutral-100 flex items-center justify-between bg-surface-neutral-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface border border-line-neutral-200 flex items-center justify-center font-bold text-accent">
                    {selectedClientForHistory.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-content-neutral-900">
                      {selectedClientForHistory.name}
                    </h3>
                    <p className="text-xs text-content-neutral-400">
                      Client Ledger & Transaction History
                    </p>
                  </div>
                </div>
                <Button
                  aria-label="Close"
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedClientForHistory(null)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="p-6 space-y-5">
                {/* 3 Metric Cards */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-surface-neutral-50 rounded-xl border border-line-neutral-100">
                    <span className="text-[10px] text-content-neutral-400 font-bold uppercase tracking-wider block">
                      TOTAL BILLED
                    </span>
                    <span className="text-base font-bold text-content-neutral-900 mt-1 block">
                      {formatCents(
                        selectedClientForHistory.totalBilledCents,
                        selectedClientForHistory.currency,
                      )}
                    </span>
                  </div>
                  <div className="p-3 bg-surface-emerald-50/50 rounded-xl border border-line-emerald-100">
                    <span className="text-[10px] text-content-emerald-600 font-bold uppercase tracking-wider block">
                      TOTAL PAID
                    </span>
                    <span className="text-base font-bold text-content-emerald-700 mt-1 block">
                      {formatCents(
                        selectedClientForHistory.totalPaidCents,
                        selectedClientForHistory.currency,
                      )}
                    </span>
                  </div>
                  <div className="p-3 bg-surface-rose-50/50 rounded-xl border border-line-rose-100">
                    <span className="text-[10px] text-content-rose-600 font-bold uppercase tracking-wider block">
                      OUTSTANDING
                    </span>
                    <span className="text-base font-bold text-content-rose-700 mt-1 block font-mono">
                      {formatCents(
                        selectedClientForHistory.outstandingBalanceCents,
                        selectedClientForHistory.currency,
                      )}
                    </span>
                  </div>
                </div>

                {/* Contact Information & Drive */}
                <div className="text-xs text-content-neutral-600 space-y-1 bg-surface-neutral-50/50 p-3.5 rounded-xl border border-line-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div>
                      <strong>Contact:</strong>{" "}
                      {selectedClientForHistory.contactPerson}
                      {selectedClientForHistory.contactRole
                        ? ` · ${selectedClientForHistory.contactRole}`
                        : ""}
                    </div>
                    <div>
                      <strong>Email:</strong> {selectedClientForHistory.email}
                    </div>
                  </div>
                  {selectedClientForHistory.driveUrl && (
                    <button
                      type="button"
                      onClick={(e) => openExternalLink(selectedClientForHistory.driveUrl, e)}
                      className="inline-flex items-center gap-1.5 text-xs text-accent font-semibold hover:underline bg-transparent border-0 p-0 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Drive Folder</span>
                    </button>
                  )}
                </div>

                {/* Invoices List Table */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <h4 className="text-xs font-semibold text-content-neutral-900 uppercase tracking-wider">
                      Invoices & Payment Records
                    </h4>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          router.push(
                            `/invoices?new=1&client=${selectedClientForHistory.id}`,
                          );
                        }}
                      >
                        <Plus className="w-3 h-3" />
                        <span>New Invoice</span>
                      </Button>
                      <span className="text-content-neutral-300">·</span>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          router.push(
                            `/invoices?client=${selectedClientForHistory.id}`,
                          );
                        }}
                      >
                        <span>View all</span>
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="border border-line-neutral-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-neutral-50 border-b border-line-neutral-200 text-content-neutral-600 sticky top-0">
                        <tr>
                          <th className="py-2.5 px-4 font-semibold">
                            Invoice Code
                          </th>
                          <th className="py-2.5 px-4 font-semibold">
                            Issue Date
                          </th>
                          <th className="py-2.5 px-4 font-semibold">Amount</th>
                          <th className="py-2.5 px-4 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line-neutral-100">
                        {clientLedgerInvoices.length > 0 ? (
                          clientLedgerInvoices.map((inv) => (
                            <tr
                              key={inv.id}
                              onClick={() =>
                                router.push(`/invoices?invoice=${inv.id}`)
                              }
                              className="hover:bg-surface-purple-50/40 transition-colors cursor-pointer"
                            >
                              <td className="py-3 px-4 font-mono font-medium text-content-neutral-900">
                                {inv.code}
                              </td>
                              <td className="py-3 px-4 text-content-neutral-500">
                                {formatDateDisplay(inv.issueDate)}
                              </td>
                              <td className="py-3 px-4 font-semibold text-content-neutral-900">
                                {formatCents(inv.amountCents, inv.currency)}
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                    inv.status === "PAID"
                                      ? "bg-surface-emerald-100 text-content-emerald-700"
                                      : inv.status === "OVERDUE"
                                        ? "bg-surface-rose-100 text-content-rose-700"
                                        : inv.status === "DRAFT"
                                          ? "bg-surface-neutral-100 text-content-neutral-600"
                                          : "bg-surface-blue-100 text-content-blue-700"
                                  }`}
                                >
                                  {inv.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={4}
                              className="py-6 text-center text-content-neutral-400"
                            >
                              No invoices generated for this client yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-surface-neutral-50 border-t border-line-neutral-100 flex justify-end">
                <Button
                  variant="primary"
                  onClick={() => setSelectedClientForHistory(null)}
                >
                  Close Ledger
                </Button>
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
            <MotionSurface onDismiss={() => setSelectedClientForBill(null)}
              kind="panel"
              className="bg-surface rounded-2xl w-full max-w-lg shadow-2xl border border-line-neutral-200 overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-line-neutral-100 flex items-center justify-between bg-surface-neutral-50/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center">
                    <Zap className="w-4 h-4 fill-accent" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-content-neutral-900">
                      Instant Quick Bill
                    </h3>
                    <p className="text-xs text-content-neutral-400">
                      Issuing to: {selectedClientForBill.name}
                    </p>
                  </div>
                </div>
                <Button
                  aria-label="Close"
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedClientForBill(null)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="p-6 space-y-4 text-xs font-medium text-content-neutral-700">
                <div>
                  <label className="block mb-1.5 text-content-neutral-700 font-semibold">
                    Service Deliverable Title
                  </label>
                  <input
                    type="text"
                    value={quickBillTitle}
                    onChange={(e) => setQuickBillTitle(e.target.value)}
                    className="ui-field w-full px-3 border border-line-neutral-200 focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block mb-1.5 text-content-neutral-700 font-semibold">
                      Amount ({selectedClientForBill.currency})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={quickBillAmount}
                      onChange={(e) => setQuickBillAmount(e.target.value)}
                      className="ui-field w-full px-3 border border-line-neutral-200 focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  </div>

                  <div>
                    <label className="block mb-1.5 text-content-neutral-700 font-semibold">
                      Payment Terms
                    </label>
                    <input
                      type="text"
                      readOnly
                      value="Net 7 Days (Default)"
                      className="ui-field w-full px-3 border border-line-neutral-200 text-content-neutral-600"
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-surface-purple-50/60 rounded-xl border border-line-purple-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="deposit"
                      defaultChecked
                      className="w-4 h-4 text-accent rounded-sm focus:ring-accent"
                    />
                    <label
                      htmlFor="deposit"
                      className="text-xs font-medium text-content-neutral-700"
                    >
                      Require 50% Upfront Deposit
                    </label>
                  </div>
                  <span className="text-xs font-semibold text-accent">
                    Deposit: {getCurrencySymbol(selectedClientForBill.currency)}
                    {((parseFloat(quickBillAmount) || 0) * 0.5).toFixed(2)}
                  </span>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-line-neutral-100">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setSelectedClientForBill(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    type="button"
                    disabled={isSubmittingQuickBill}
                    onClick={handleQuickBillSubmit}
                  >
                    {isSubmittingQuickBill
                      ? "Creating..."
                      : "Generate & Save Invoice"}
                  </Button>
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
        <div className="workspace-page motion-page">
          <div className="h-10 w-48 bg-surface-neutral-200 rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="h-64 bg-surface-neutral-200 rounded-2xl" />
            <div className="h-64 bg-surface-neutral-200 rounded-2xl" />
            <div className="h-64 bg-surface-neutral-200 rounded-2xl" />
          </div>
        </div>
      }
    >
      <ClientsContent />
    </Suspense>
  );
}
