"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Building,
  CheckCircle2,
  Code2,
  Download,
  ExternalLink,
  FileText,
  GitFork,
  Link2,
  Plus,
  Receipt,
  Search,
  SlidersHorizontal,
  User,
  UserPlus,
  Users,
  X,
  Calendar,
  Check,
} from "lucide-react";

import {
  Button,
  PageHeader,
  MetricCard,
  EmptyState,
} from "@/components/ui/Workspace";

import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";
import { useClients, useVendors, useActiveCurrency } from "@/lib/data/DataProvider";
import { formatCurrencyAmount, getCurrencySymbol } from "@/lib/format";
import type { Currency } from "@/types/billing";
import type { VendorItem } from "@/types/outsourcing";
import "./outsourcing.css";

export type { VendorItem };

export default function OutsourcingView() {
  const searchParams = useSearchParams();
  const { clients, createClient } = useClients();
  const { vendors, createVendor, setVendorStatus } = useVendors();
  const { activeCurrency } = useActiveCurrency();

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "PAID">("ALL");

  // Modal dialog states
  const [selectedVendor, setSelectedVendor] = useState<VendorItem | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  // Add Client Form States with explicit validation
  const [clientName, setClientName] = useState("");
  const [clientCategory, setClientCategory] = useState("Enterprise");
  const [clientContactPerson, setClientContactPerson] = useState("");
  const [clientContactRole, setClientContactRole] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientCurrency, setClientCurrency] = useState<"USD" | "LKR" | "EUR">("USD");
  const [clientDriveUrl, setClientDriveUrl] = useState("");
  const [clientFormErrors, setClientFormErrors] = useState<Record<string, string>>({});
  const [isSubmittingClient, setIsSubmittingClient] = useState(false);

  // Add Vendor Form States
  const [vendorName, setVendorName] = useState("");
  const [vendorService, setVendorService] = useState("");
  const [vendorBalance, setVendorBalance] = useState("");
  const [vendorIconType, setVendorIconType] = useState<VendorItem["iconType"]>("devops");
  const [vendorEmail, setVendorEmail] = useState("");
  const [vendorLinkedClientId, setVendorLinkedClientId] = useState("");
  const [vendorDueDate, setVendorDueDate] = useState("Oct 20, 2026");
  const [vendorFormErrors, setVendorFormErrors] = useState<Record<string, string>>({});
  const [isSubmittingVendor, setIsSubmittingVendor] = useState(false);

  // Expense Form States
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");

  // Toast notification state
  const [toastNotification, setToastNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Show auto-dismissing toast feedback
  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToastNotification({ message, type });
    setTimeout(() => setToastNotification(null), 3500);
  };

  // Handle task redirection deep link / query params
  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "create-voucher") {
      const taskTitle = searchParams.get("taskTitle");
      const vendorParam = searchParams.get("vendor");
      const budget = searchParams.get("budget");

      if (vendorParam) {
        setVendorName(vendorParam);
      }
      if (taskTitle) {
        setVendorService(`Outsourced Task: ${taskTitle}`);
      }
      if (budget) {
        setVendorBalance(budget);
      }
      setIsVendorModalOpen(true);
    }
  }, [searchParams]);

  // Toggle vendor payment status between PENDING and PAID in local SQLite database
  const handleToggleStatus = async (id: string) => {
    try {
      const current = vendors.find((v) => v.id === id);
      if (!current) return;
      const nextStatus = current.status === "PENDING" ? "PAID" : "PENDING";
      await setVendorStatus(id, nextStatus);
      showToast("Vendor settlement status updated");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Failed to update vendor status";
      showToast(msg, "error");
    }
  };

  // Submit handler for adding a new client and saving to local DB
  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientFormErrors({});

    const errors: Record<string, string> = {};

    // 1. Blank space validation for Client Name
    if (!clientName.trim()) {
      errors.name = "Client name cannot be blank or contain only spaces";
    }

    // 2. Blank space and @ sign validation for Email
    if (!clientEmail.trim()) {
      errors.email = "Email cannot be blank or contain only spaces";
    } else if (!clientEmail.includes("@")) {
      errors.email = "Email must contain an '@' sign (e.g. alex@fintechlabs.com)";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim())) {
      errors.email = "Please enter a valid email address with a domain (e.g. name@domain.com)";
    }

    if (Object.keys(errors).length > 0) {
      setClientFormErrors(errors);
      showToast("Please fix the validation errors before saving.", "error");
      return;
    }

    setIsSubmittingClient(true);
    try {
      // Save client directly into the local SQLite database via IPC/DataProvider
      const created = await createClient({
        name: clientName.trim(),
        category: clientCategory,
        contactPerson: clientContactPerson.trim() || clientName.trim(),
        contactRole: clientContactRole.trim() || undefined,
        email: clientEmail.trim(),
        phone: clientPhone.trim() || undefined,
        currency: clientCurrency,
        driveUrl: clientDriveUrl.trim() || undefined,
      });

      showToast("Saved");

      // Reset form fields
      setClientName("");
      setClientCategory("Enterprise");
      setClientContactPerson("");
      setClientContactRole("");
      setClientEmail("");
      setClientPhone("");
      setClientCurrency("USD");
      setClientDriveUrl("");
      setClientFormErrors({});
      setIsClientModalOpen(false);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Failed to save client";
      showToast(msg, "error");
    } finally {
      setIsSubmittingClient(false);
    }
  };

  // Submit handler for adding a new vendor / outsourced task to local SQLite database
  const handleAddVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setVendorFormErrors({});

    const errors: Record<string, string> = {};
    if (!vendorName.trim()) {
      errors.name = "Vendor name cannot be blank or contain only spaces";
    }
    if (!vendorService.trim()) {
      errors.service = "Service description cannot be blank";
    }

    const numBalance = parseFloat(vendorBalance);
    if (isNaN(numBalance) || numBalance < 0) {
      errors.balance = "Please enter a valid positive balance or amount";
    }

    if (vendorEmail.trim() && !vendorEmail.includes("@")) {
      errors.email = "Email must contain an '@' sign (e.g. vendor@company.com)";
    }

    if (Object.keys(errors).length > 0) {
      setVendorFormErrors(errors);
      showToast("Please fix the vendor form errors.", "error");
      return;
    }

    setIsSubmittingVendor(true);
    try {
      const linkedClient = clients.find((c) => c.id === vendorLinkedClientId);

      await createVendor({
        name: vendorName.trim(),
        service: vendorService.trim(),
        currentBalance: numBalance,
        balanceCents: Math.round(numBalance * 100),
        status: "PENDING",
        iconType: vendorIconType,
        email: vendorEmail.trim() || undefined,
        linkedClientId: linkedClient?.id,
        linkedClientName: linkedClient?.name,
        payoutDueDate: vendorDueDate.trim() || undefined,
      });

      showToast("Saved");

      // Reset vendor modal state
      setVendorName("");
      setVendorService("");
      setVendorBalance("");
      setVendorEmail("");
      setVendorLinkedClientId("");
      setVendorFormErrors({});
      setIsVendorModalOpen(false);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Failed to save vendor";
      showToast(msg, "error");
    } finally {
      setIsSubmittingVendor(false);
    }
  };

  // Submit handler for logging a business expense
  const handleLogExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseTitle.trim() || !expenseAmount.trim()) {
      showToast("Please provide expense title and amount.", "error");
      return;
    }
    showToast(`Expense "${expenseTitle}" logged successfully`);
    setExpenseTitle("");
    setExpenseAmount("");
    setIsExpenseModalOpen(false);
  };

  // Render vector icon based on vendor category
  const renderVendorIcon = (type: VendorItem["iconType"]) => {
    switch (type) {
      case "design":
        return <SlidersHorizontal className="text-text-body text-[13px]" />;
      case "devops":
        return <Code2 className="text-text-body text-[13px]" />;
      case "legal":
        return <FileText className="text-text-body text-[13px]" />;
      case "development":
        return <Code2 className="text-text-body text-[13px]" />;
    }
  };

  // Filter vendors based on status and search query
  const filteredVendors = vendors.filter((v) => {
    const matchesSearch =
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.linkedClientName &&
        v.linkedClientName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === "ALL" ? true : v.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate dynamic metrics
  const outstandingPayables = vendors
    .filter((v) => v.status === "PENDING")
    .reduce((sum, v) => sum + v.currentBalance, 0);

  const settledPayouts = vendors
    .filter((v) => v.status === "PAID")
    .reduce((sum, v) => sum + v.currentBalance, 0);

  return (
    <div className="workspace-page motion-page outsourcing-page-container">
      {/* Toast Feedback Notification */}
      <MotionPresence>
        {toastNotification && (
          <MotionSurface
            kind="toast"
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 text-white rounded-xl shadow-xl text-[12px] font-medium ${
              toastNotification.type === "error"
                ? "bg-rose-900 border border-rose-700"
                : "bg-toast border border-line-neutral-700"
            }`}
          >
            {toastNotification.type === "error" ? (
              <AlertCircle className="text-content-rose-400 text-[14px] shrink-0" />
            ) : (
              <CheckCircle2 className="text-success-bright text-[14px] shrink-0" />
            )}
            <span>{toastNotification.message}</span>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Top Header: Title, subtitle, and primary action buttons */}
      <PageHeader
        title="Outsourcing"
        description="Manage your subcontractors, client-linked deliverables, vendor balances, and payouts."
      >
        <div className="outsourcing-header-actions">
          {/* Active invoice currency indicator */}
          <span
            className="outsourcing-currency-badge"
            title="Viewing currency synced with your invoices"
          >
            Currency: {activeCurrency} ({getCurrencySymbol(activeCurrency).trim()})
          </span>

          {/* Link Client button directly navigating to Clients page */}
          <Link href="/clients">
            <Button
              variant="secondary"
              type="button"
              title="Open Clients Directory"
            >
              <Users className="outsourcing-action-icon" />
              <span>Clients</span>
            </Button>
          </Link>

          {/* Add Client button opening the Add Client Modal with local DB persistence */}
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              setClientFormErrors({});
              setIsClientModalOpen(true);
            }}
          >
            <UserPlus className="outsourcing-action-icon" />
            <span>Add Client</span>
          </Button>

          {/* Add Vendor / Task button */}
          <Button
            variant="primary"
            type="button"
            onClick={() => {
              setVendorFormErrors({});
              setIsVendorModalOpen(true);
            }}
          >
            <Plus className="text-[12px]" />
            <span>Add Vendor</span>
          </Button>

          {/* Log Expense button */}
          <Button
            variant="secondary"
            type="button"
            onClick={() => setIsExpenseModalOpen(true)}
          >
            <Receipt className="outsourcing-action-icon" />
            <span>Log Expense</span>
          </Button>
        </div>
      </PageHeader>

      {/* Metric Cards Row */}
      <div className="outsourcing-metrics-grid">
        <MetricCard
          label="Outstanding Payables"
          value={formatCurrencyAmount(outstandingPayables, activeCurrency)}
          footer={`${vendors.filter((v) => v.status === "PENDING").length} awaiting settlement`}
        />
        <MetricCard
          label="Settled Payouts"
          value={formatCurrencyAmount(settledPayouts, activeCurrency)}
          footer={`${vendors.filter((v) => v.status === "PAID").length} settled to date`}
        />
        <MetricCard
          label="Active Subcontractors"
          value={vendors.length}
          footer="registered vendors"
        />
        <MetricCard
          label="Linked Clients"
          value={clients.length}
          footer="in database"
        />
      </div>

      {/* Main Vendor Directory Card */}
      <div className="ui-card vendor-directory-card">
        {/* Section title & controls header */}
        <div className="vendor-directory-header">
          <div>
            <h2 className="vendor-directory-title">
              Vendor & Subcontractor Directory
            </h2>
            <p className="vendor-directory-subtitle">
              Track vendor deliverables, linked client projects, and settlement vouchers.
            </p>
          </div>

          {/* Search and status filters */}
          <div className="vendor-controls-group">
            <div className="vendor-search-wrapper">
              <Search className="vendor-search-icon" />
              <input
                type="text"
                placeholder="Search vendor or client..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="vendor-search-input"
              />
            </div>

            <div className="vendor-status-filter">
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`vendor-filter-btn ${statusFilter === "ALL" ? "active" : ""}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("PENDING")}
                className={`vendor-filter-btn ${statusFilter === "PENDING" ? "active" : ""}`}
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("PAID")}
                className={`vendor-filter-btn ${statusFilter === "PAID" ? "active" : ""}`}
              >
                Paid
              </button>
            </div>
          </div>
        </div>

        {/* Vendor list rows container */}
        <div className="bg-surface divide-y divide-line-neutral-100">
          {filteredVendors.length === 0 ? (
            <EmptyState
              title={
                vendors.length === 0
                  ? "No vendors yet"
                  : "No matching vendors found"
              }
              description={
                vendors.length === 0
                  ? "Your subcontractors, client-linked deliverables, and vendor balances will appear here."
                  : "Try adjusting your search query or status filter."
              }
            >
              {vendors.length === 0 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button
                    variant="primary"
                    onClick={() => {
                      setVendorFormErrors({});
                      setIsVendorModalOpen(true);
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add First Vendor</span>
                  </Button>
                </div>
              )}
            </EmptyState>
          ) : (
            filteredVendors.map((vendor) => (
              <div
                key={vendor.id}
                className="vendor-list-row"
              >
                {/* Left: Vendor category icon and credentials */}
                <div className="vendor-info-group">
                  <div className="vendor-avatar-icon">
                    {renderVendorIcon(vendor.iconType)}
                  </div>
                  <div>
                    <div className="vendor-name-row">
                      <h3 className="vendor-name-heading">
                        {vendor.name}
                      </h3>
                      {vendor.linkedClientName && (
                        <Link
                          href={
                            vendor.linkedClientId
                              ? `/clients?client=${vendor.linkedClientId}`
                              : "/clients"
                          }
                          className="vendor-client-badge"
                          title="View linked client in Client Directory"
                        >
                          <Building className="w-3 h-3" />
                          <span>{vendor.linkedClientName}</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </Link>
                      )}
                    </div>
                    <p className="vendor-service-desc">
                      {vendor.service}
                    </p>
                  </div>
                </div>

                {/* Right: Current balance, status pill, and action buttons */}
                <div className="vendor-actions-group">
                  {/* Balance display */}
                  <div className="vendor-balance-box">
                    <span className="vendor-balance-label">
                      Current Balance
                    </span>
                    <span className="vendor-balance-amount">
                      {formatCurrencyAmount(vendor.currentBalance, activeCurrency)}
                    </span>
                  </div>

                  {/* Status toggle pill (PENDING / PAID) */}
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(vendor.id)}
                    title="Click to toggle settlement status"
                    className={`vendor-status-pill status-${vendor.status.toLowerCase()}`}
                  >
                    {vendor.status === "PAID" && (
                      <Check className="w-2.5 h-2.5" />
                    )}
                    <span>{vendor.status}</span>
                  </button>

                  {/* Action button: Statement Voucher */}
                  <Button
                    variant={vendor.status === "PENDING" ? "primary" : "secondary"}
                    size="icon"
                    type="button"
                    onClick={() => setSelectedVendor(vendor)}
                    title="View Statement Voucher"
                    className="shrink-0"
                  >
                    <Download className="text-[11px]" />
                  </Button>
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
            className="outsourcing-modal-overlay"
          >
            <MotionSurface
              onDismiss={() => setSelectedVendor(null)}
              kind="panel"
              className="outsourcing-modal-panel voucher-panel"
            >
              <div className="outsourcing-modal-header">
                <div className="flex items-center gap-2">
                  <GitFork className="w-4 h-4 text-accent" />
                  <h3 className="outsourcing-modal-title">
                    Vendor Statement Voucher
                  </h3>
                </div>
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

              <div className="outsourcing-modal-body text-[12px] text-text-body">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-[15px] text-text-primary">
                      {selectedVendor.name}
                    </div>
                    <div className="text-text-subtle text-[11.5px] mt-0.5">
                      {selectedVendor.service}
                    </div>
                    {selectedVendor.email && (
                      <div className="text-text-muted text-[11px] mt-1">
                        Email: {selectedVendor.email}
                      </div>
                    )}
                  </div>
                  <span
                    className={`vendor-status-pill status-${selectedVendor.status.toLowerCase()}`}
                  >
                    {selectedVendor.status}
                  </span>
                </div>

                {selectedVendor.linkedClientName && (
                  <div className="voucher-client-box">
                    <div>
                      <span className="text-[10.5px] text-accent font-medium block">
                        Linked Client Project
                      </span>
                      <span className="font-semibold text-content-neutral-900 text-xs">
                        {selectedVendor.linkedClientName}
                      </span>
                    </div>
                    <Link
                      href={
                        selectedVendor.linkedClientId
                          ? `/clients?client=${selectedVendor.linkedClientId}`
                          : "/clients"
                      }
                      className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
                    >
                      <span>View Client</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                )}

                <div className="voucher-settlement-card">
                  <div className="voucher-settlement-row">
                    <span className="text-text-muted">Current Balance:</span>
                    <span className="font-bold text-text-primary font-mono text-[13px]">
                      {formatCurrencyAmount(selectedVendor.currentBalance, activeCurrency)}
                    </span>
                  </div>
                  <div className="voucher-settlement-row">
                    <span className="text-text-muted">Scheduled Settlement:</span>
                    <span className="font-medium text-text-primary">
                      {selectedVendor.payoutDueDate || "Oct 15, 2026"}
                    </span>
                  </div>
                  <div className="voucher-settlement-row">
                    <span className="text-text-muted">Settlement Method:</span>
                    <span className="font-medium text-text-primary">
                      Wire / Direct ACH
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-6 py-3.5 bg-surface-subtle border-t border-surface-muted flex items-center justify-between gap-2">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    handleToggleStatus(selectedVendor.id);
                    setSelectedVendor((prev) =>
                      prev
                        ? {
                            ...prev,
                            status:
                              prev.status === "PENDING" ? "PAID" : "PENDING",
                          }
                        : null,
                    );
                  }}
                >
                  Mark as {selectedVendor.status === "PENDING" ? "Paid" : "Pending"}
                </Button>

                <div className="flex items-center gap-2">
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
                    <Download className="w-3 h-3" />
                    <span>Download PDF</span>
                  </Button>
                </div>
              </div>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Modal Dialog: Add New Client (Saves to Local DB + Validates Blank Space & @ Sign) */}
      <MotionPresence>
        {isClientModalOpen && (
          <MotionSurface
            kind="dialog"
            className="outsourcing-modal-overlay"
          >
            <MotionSurface
              onDismiss={() => setIsClientModalOpen(false)}
              kind="panel"
              className="outsourcing-modal-panel"
            >
              <div className="outsourcing-modal-header">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-accent" />
                  <h3 className="outsourcing-modal-title">
                    Add New Client
                  </h3>
                </div>
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

              <form onSubmit={handleAddClient} className="p-6 space-y-4">
                {/* Client Name Input */}
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                    Client Business Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Fintech Labs Inc."
                    value={clientName}
                    onChange={(e) => {
                      setClientName(e.target.value);
                      if (clientFormErrors.name) {
                        setClientFormErrors((prev) => {
                          const next = { ...prev };
                          delete next.name;
                          return next;
                        });
                      }
                    }}
                    className={`ui-field w-full text-[13px] px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 ${
                      clientFormErrors.name
                        ? "border-line-rose-400 bg-surface-rose-50/20 focus:ring-rose-400 text-rose-900"
                        : "border-border-muted focus:ring-focus"
                    }`}
                  />
                  {clientFormErrors.name && (
                    <p className="text-content-rose-600 text-[11px] mt-1.5 flex items-center gap-1.5 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{clientFormErrors.name}</span>
                    </p>
                  )}
                </div>

                {/* Email Address Input with explicit @ sign validation */}
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                    Email Address *
                  </label>
                  <input
                    type="text"
                    placeholder="alex@fintechlabs.com"
                    value={clientEmail}
                    onChange={(e) => {
                      setClientEmail(e.target.value);
                      if (clientFormErrors.email) {
                        setClientFormErrors((prev) => {
                          const next = { ...prev };
                          delete next.email;
                          return next;
                        });
                      }
                    }}
                    className={`ui-field w-full text-[13px] px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 ${
                      clientFormErrors.email
                        ? "border-line-rose-400 bg-surface-rose-50/20 focus:ring-rose-400 text-rose-900"
                        : "border-border-muted focus:ring-focus"
                    }`}
                  />
                  {clientFormErrors.email && (
                    <p className="text-content-rose-600 text-[11px] mt-1.5 flex items-center gap-1.5 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{clientFormErrors.email}</span>
                    </p>
                  )}
                </div>

                {/* Category & Currency */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                      Category
                    </label>
                    <select
                      value={clientCategory}
                      onChange={(e) => setClientCategory(e.target.value)}
                      className="ui-field w-full text-[12.5px] px-3 py-2 border border-border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-focus"
                    >
                      <option value="Enterprise">Enterprise</option>
                      <option value="Startup">Startup</option>
                      <option value="Agency">Agency</option>
                      <option value="Small Business">Small Business</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                      Billing Currency
                    </label>
                    <select
                      value={clientCurrency}
                      onChange={(e) =>
                        setClientCurrency(
                          e.target.value as "USD" | "LKR" | "EUR",
                        )
                      }
                      className="ui-field w-full text-[12.5px] px-3 py-2 border border-border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-focus"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="LKR">LKR (Rs.)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="CAD">CAD (CA$)</option>
                    </select>
                  </div>
                </div>

                {/* Contact Person & Phone */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sarah Jenkins"
                      value={clientContactPerson}
                      onChange={(e) => setClientContactPerson(e.target.value)}
                      className="ui-field w-full text-[12.5px] px-3 py-2 border border-border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-focus"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      placeholder="+1 (555) 284-9102"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className="ui-field w-full text-[12.5px] px-3 py-2 border border-border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-focus"
                    />
                  </div>
                </div>

                {/* Client Link / Drive Folder Link Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[12px] font-semibold text-text-secondary flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-accent" />
                      <span>Client Resource Link / Drive Folder</span>
                    </label>
                    <span className="text-[10.5px] text-content-neutral-400">Optional</span>
                  </div>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/drive/folders/... or website"
                    value={clientDriveUrl}
                    onChange={(e) => setClientDriveUrl(e.target.value)}
                    className="ui-field w-full text-[12.5px] px-3 py-2 border border-border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-focus"
                  />
                </div>

                {/* Modal Footer Controls */}
                <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-line-neutral-100">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setIsClientModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={isSubmittingClient}
                  >
                    {isSubmittingClient ? "Saved" : "Save"}
                  </Button>
                </div>
              </form>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Modal Dialog: Add New Subcontractor / Vendor */}
      <MotionPresence>
        {isVendorModalOpen && (
          <MotionSurface
            kind="dialog"
            className="outsourcing-modal-overlay"
          >
            <MotionSurface
              onDismiss={() => setIsVendorModalOpen(false)}
              kind="panel"
              className="outsourcing-modal-panel"
            >
              <div className="outsourcing-modal-header">
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-accent" />
                  <h3 className="outsourcing-modal-title">
                    Add Subcontractor / Outsource Task
                  </h3>
                </div>
                <Button
                  aria-label="Close"
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => setIsVendorModalOpen(false)}
                >
                  <X className="text-sm" />
                </Button>
              </div>

              <form onSubmit={handleAddVendor} className="p-6 space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                    Vendor / Contractor Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CloudScale Architecture Group"
                    value={vendorName}
                    onChange={(e) => {
                      setVendorName(e.target.value);
                      if (vendorFormErrors.name) {
                        setVendorFormErrors((prev) => {
                          const next = { ...prev };
                          delete next.name;
                          return next;
                        });
                      }
                    }}
                    className={`ui-field w-full text-[13px] px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 ${
                      vendorFormErrors.name
                        ? "border-line-rose-400 bg-surface-rose-50/20 focus:ring-rose-400"
                        : "border-border-muted focus:ring-focus"
                    }`}
                  />
                  {vendorFormErrors.name && (
                    <p className="text-content-rose-600 text-[11px] mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{vendorFormErrors.name}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                    Service Scope & Deliverable Description *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Multi-region Cloud Deployments & Security Hardening"
                    value={vendorService}
                    onChange={(e) => {
                      setVendorService(e.target.value);
                      if (vendorFormErrors.service) {
                        setVendorFormErrors((prev) => {
                          const next = { ...prev };
                          delete next.service;
                          return next;
                        });
                      }
                    }}
                    className={`ui-field w-full text-[13px] px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 ${
                      vendorFormErrors.service
                        ? "border-line-rose-400 bg-surface-rose-50/20 focus:ring-rose-400"
                        : "border-border-muted focus:ring-focus"
                    }`}
                  />
                  {vendorFormErrors.service && (
                    <p className="text-content-rose-600 text-[11px] mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{vendorFormErrors.service}</span>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                      Agreed Balance / Payout ({getCurrencySymbol(activeCurrency).trim() || activeCurrency}) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="2500.00"
                      value={vendorBalance}
                      onChange={(e) => {
                        setVendorBalance(e.target.value);
                        if (vendorFormErrors.balance) {
                          setVendorFormErrors((prev) => {
                            const next = { ...prev };
                            delete next.balance;
                            return next;
                          });
                        }
                      }}
                      className={`ui-field w-full text-[13px] px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 ${
                        vendorFormErrors.balance
                          ? "border-line-rose-400 bg-surface-rose-50/20 focus:ring-rose-400"
                          : "border-border-muted focus:ring-focus"
                      }`}
                    />
                    {vendorFormErrors.balance && (
                      <p className="text-content-rose-600 text-[11px] mt-1 font-medium">
                        {vendorFormErrors.balance}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                      Category
                    </label>
                    <select
                      value={vendorIconType}
                      onChange={(e) =>
                        setVendorIconType(
                          e.target.value as VendorItem["iconType"],
                        )
                      }
                      className="ui-field w-full text-[12.5px] px-3 py-2 border border-border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-focus"
                    >
                      <option value="devops">DevOps & Cloud</option>
                      <option value="design">UI/UX Design</option>
                      <option value="legal">Legal & Compliance</option>
                      <option value="development">Software Development</option>
                    </select>
                  </div>
                </div>

                {/* Link to Client Dropdown */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[12px] font-semibold text-text-secondary flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-accent" />
                      <span>Link to Client Project</span>
                    </label>
                    <span className="text-[10.5px] text-content-neutral-400">Optional</span>
                  </div>
                  <select
                    value={vendorLinkedClientId}
                    onChange={(e) => setVendorLinkedClientId(e.target.value)}
                    className="ui-field w-full text-[12.5px] px-3 py-2 border border-border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-focus"
                  >
                    <option value="">No Client Linked (Internal / General)</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                      Contractor Email
                    </label>
                    <input
                      type="email"
                      placeholder="vendor@company.com"
                      value={vendorEmail}
                      onChange={(e) => setVendorEmail(e.target.value)}
                      className="ui-field w-full text-[12.5px] px-3 py-2 border border-border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-focus"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                      Payout Due Date
                    </label>
                    <input
                      type="text"
                      placeholder="Oct 28, 2026"
                      value={vendorDueDate}
                      onChange={(e) => setVendorDueDate(e.target.value)}
                      className="ui-field w-full text-[12.5px] px-3 py-2 border border-border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-focus"
                    />
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-line-neutral-100">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setIsVendorModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={isSubmittingVendor}
                  >
                    {isSubmittingVendor ? "Saved" : "Save"}
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
            className="outsourcing-modal-overlay"
          >
            <MotionSurface
              onDismiss={() => setIsExpenseModalOpen(false)}
              kind="panel"
              className="outsourcing-modal-panel voucher-panel"
            >
              <div className="outsourcing-modal-header">
                <h3 className="outsourcing-modal-title">
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
                  <label className="block text-[11.5px] font-medium text-text-secondary mb-1">
                    Expense Description
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Adobe Creative Cloud, Cloud Server"
                    value={expenseTitle}
                    onChange={(e) => setExpenseTitle(e.target.value)}
                    className="ui-field w-full text-[12px] px-3 border border-border-muted focus:outline-none focus:ring-2 focus:ring-focus"
                  />
                </div>
                <div>
                  <label className="block text-[11.5px] font-medium text-text-secondary mb-1">
                    Amount ({getCurrencySymbol(activeCurrency).trim() || activeCurrency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="54.99"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="ui-field w-full text-[12px] px-3 border border-border-muted focus:outline-none focus:ring-2 focus:ring-focus"
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
