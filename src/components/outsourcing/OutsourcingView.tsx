"use client";

import React, { useState, useMemo, useEffect } from "react";
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
  UserPlus,
  Users,
  X,
  Check,
  Briefcase,
  Calendar,
  Layers,
  Sparkles,
  CheckCheck,
  Clock,
  Paperclip,
  FileCheck,
} from "lucide-react";

import {
  Button,
  PageHeader,
  MetricCard,
  EmptyState,
} from "@/components/ui/Workspace";

import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";
import {
  useClients,
  useInvoices,
  useVendors,
  useWorkOrders,
  useActiveCurrency,
  useData,
} from "@/lib/data/DataProvider";
import { formatCents, formatCurrencyAmount } from "@/lib/format";
import { resolveDeliveryUrl, openExternalLink } from "@/lib/deliveryUrl";
import type {
  VendorItem,
  WorkOrderItem,
} from "@/types/outsourcing";
import type { Currency } from "@/types/billing";
import type { AttachmentItem } from "@/types/workflow";
import "./outsourcing.css";

export type { VendorItem, WorkOrderItem };

export default function OutsourcingView() {
  const searchParams = useSearchParams();
  const { clients, createClient } = useClients();
  const { invoices } = useInvoices();
  const { tasks, workflow } = useData();
  const { vendors, createVendor, setVendorStatus } = useVendors();
  const {
    workOrders,
    createWorkOrder,
    updateWorkOrder,
    reviewWorkOrder,
    recordWorkOrderPayout,
    removeWorkOrderPayout,
    setWorkOrderPayoutStatus,
    deleteWorkOrder,
  } = useWorkOrders();
  const { activeCurrency } = useActiveCurrency();

  // Active view tab: Work Orders (payables) vs Reusable Vendor Directory
  const [activeTab, setActiveTab] = useState<"work-orders" | "vendors">("work-orders");

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "PAID">("ALL");

  // Modal dialog states
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrderItem | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<VendorItem | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isWorkOrderModalOpen, setIsWorkOrderModalOpen] = useState(false);

  // Review Contractor Deliverable Dialog states
  const [reviewingWorkOrder, setReviewingWorkOrder] = useState<WorkOrderItem | null>(null);
  const [reviewStatus, setReviewStatus] = useState<"todo" | "in-progress" | "review" | "done">("todo");
  const [reviewDeliveryUrl, setReviewDeliveryUrl] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewUpdateTask, setReviewUpdateTask] = useState(true);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Payout receipts in Statement Voucher modal
  const [payoutAttachments, setPayoutAttachments] = useState<AttachmentItem[]>([]);
  const [isLoadingPayoutAttachments, setIsLoadingPayoutAttachments] = useState(false);
  const [isAttachingReceipt, setIsAttachingReceipt] = useState(false);

  // Add Client Form States with explicit validation
  const [clientName, setClientName] = useState("");
  const [clientCategory, setClientCategory] = useState("Enterprise");
  const [clientContactPerson, setClientContactPerson] = useState("");
  const [clientContactRole, setClientContactRole] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientCurrency, setClientCurrency] = useState<Currency>(activeCurrency || "USD");
  const [clientDriveUrl, setClientDriveUrl] = useState("");
  const [clientFormErrors, setClientFormErrors] = useState<Record<string, string>>({});
  const [isSubmittingClient, setIsSubmittingClient] = useState(false);

  // Add Reusable Vendor Form States
  const [vendorName, setVendorName] = useState("");
  const [vendorService, setVendorService] = useState("");
  const [vendorIconType, setVendorIconType] = useState<VendorItem["iconType"]>("devops");
  const [vendorEmail, setVendorEmail] = useState("");
  const [vendorPhone, setVendorPhone] = useState("");
  const [vendorNotes, setVendorNotes] = useState("");
  const [vendorFormErrors, setVendorFormErrors] = useState<Record<string, string>>({});
  const [isSubmittingVendor, setIsSubmittingVendor] = useState(false);

  // New Work Order Form States
  const [woVendorId, setWoVendorId] = useState("");
  const [isCreatingNewVendorInline, setIsCreatingNewVendorInline] = useState(false);
  const [newVendorInlineName, setNewVendorInlineName] = useState("");
  const [newVendorInlineService, setNewVendorInlineService] = useState("");
  const [newVendorInlineCategory, setNewVendorInlineCategory] =
    useState<VendorItem["iconType"]>("development");
  const [newVendorInlineEmail, setNewVendorInlineEmail] = useState("");
  const [newVendorInlinePhone, setNewVendorInlinePhone] = useState("");

  const [woTaskId, setWoTaskId] = useState("");
  const [woTaskTitle, setWoTaskTitle] = useState("");
  const [woInvoiceId, setWoInvoiceId] = useState("");
  const [woInvoiceCode, setWoInvoiceCode] = useState("");
  const [woClientId, setWoClientId] = useState("");
  const [woClientName, setWoClientName] = useState("");
  const [woScope, setWoScope] = useState("");
  const [woFee, setWoFee] = useState("");
  const [woCurrency, setWoCurrency] = useState<Currency>(activeCurrency || "LKR");
  const [woDueDate, setWoDueDate] = useState("");
  const [woDeliveryUrl, setWoDeliveryUrl] = useState("");
  const [woNotes, setWoNotes] = useState("");
  const [woFormErrors, setWoFormErrors] = useState<Record<string, string>>({});
  const [isSubmittingWorkOrder, setIsSubmittingWorkOrder] = useState(false);

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

  // Handle task redirection deep link / query params from Sprint Board (/tasks)
  const voucherQueryKey = searchParams.toString();
  const [previousVoucherQueryKey, setPreviousVoucherQueryKey] = useState<string | null>(null);
  if (previousVoucherQueryKey !== voucherQueryKey) {
    setPreviousVoucherQueryKey(voucherQueryKey);
    const action = searchParams.get("action");
    if (action === "create-voucher") {
      const paramTaskId = searchParams.get("taskId") || "";
      const paramTaskTitle = searchParams.get("taskTitle") || "";
      const paramScope = searchParams.get("scope") || "";
      const paramInvoiceId = searchParams.get("invoiceId") || "";
      const paramClientId = searchParams.get("clientId") || "";
      const paramClientName = searchParams.get("clientName") || "";
      const paramDeliveryUrl = searchParams.get("deliveryUrl") || "";
      const paramCurrency = (searchParams.get("currency") as Currency) || activeCurrency || "LKR";
      const paramVendor = searchParams.get("vendor") || "";
      const paramBudget = searchParams.get("budget") || "";

      setWoTaskId(paramTaskId);
      setWoTaskTitle(paramTaskTitle);
      setWoScope(paramScope || paramTaskTitle);
      setWoInvoiceId(paramInvoiceId);
      setWoClientId(paramClientId);
      setWoClientName(paramClientName);
      setWoDeliveryUrl(paramDeliveryUrl);
      setWoCurrency(paramCurrency);

      if (paramBudget) {
        const num = parseFloat(paramBudget);
        if (!isNaN(num) && num > 0) {
          // If in cents (> 1000 and integer)
          setWoFee(num > 1000 && Number.isInteger(num) ? String(num / 100) : String(num));
        } else {
          setWoFee("");
        }
      } else {
        setWoFee("");
      }

      // Check if vendor matches existing reusable profile
      if (paramVendor) {
        const matched = vendors.find(
          (v) => v.name.toLowerCase() === paramVendor.trim().toLowerCase(),
        );
        if (matched) {
          setWoVendorId(matched.id);
          setIsCreatingNewVendorInline(false);
        } else {
          setWoVendorId("__new__");
          setIsCreatingNewVendorInline(true);
          setNewVendorInlineName(paramVendor);
          setNewVendorInlineService(paramTaskTitle || "Outsourced Development");
        }
      } else if (vendors.length > 0) {
        setWoVendorId(vendors[0].id);
        setIsCreatingNewVendorInline(false);
      } else {
        setWoVendorId("__new__");
        setIsCreatingNewVendorInline(true);
      }

      // Resolve invoice code for display
      const inv = invoices.find((i) => i.id === paramInvoiceId);
      if (inv) setWoInvoiceCode(inv.code);

      setActiveTab("work-orders");
      setWoFormErrors({});
      setIsWorkOrderModalOpen(true);
    }
  }

  // Toggle vendor settlement status in local SQLite database
  const handleToggleVendorStatus = async (id: string) => {
    try {
      const current = vendors.find((v) => v.id === id);
      if (!current) return;
      const nextStatus = current.status === "PENDING" ? "PAID" : "PENDING";
      await setVendorStatus(id, nextStatus);
      showToast("Vendor settlement status updated");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update vendor status";
      showToast(msg, "error");
    }
  };

  // Load attachments when inspecting a settled work order payout
  useEffect(() => {
    if (!selectedWorkOrder?.payoutId || !workflow) {
      return;
    }
    let active = true;
    queueMicrotask(() => {
      if (active) setIsLoadingPayoutAttachments(true);
    });
    workflow.attachments
      .list({ type: "payout", id: selectedWorkOrder.payoutId })
      .then((list) => {
        if (active) setPayoutAttachments(list);
      })
      .catch(() => {
        if (active) setPayoutAttachments([]);
      })
      .finally(() => {
        if (active) setIsLoadingPayoutAttachments(false);
      });
    return () => {
      active = false;
      setPayoutAttachments([]);
    };
  }, [selectedWorkOrder?.payoutId, workflow]);

  // Open review deliverable modal
  const handleOpenReviewModal = (wo: WorkOrderItem) => {
    const resolved = resolveDeliveryUrl(wo, { tasks, invoices, clients });
    setReviewingWorkOrder(wo);
    setReviewStatus(wo.status || "todo");
    setReviewDeliveryUrl(wo.deliveryUrl || resolved.url || "");
    setReviewNotes(wo.notes || "");
    setReviewUpdateTask(true);
  };

  // Submit handler for contractor work review and delivery
  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingWorkOrder) return;
    setIsSubmittingReview(true);
    try {
      const updated = await reviewWorkOrder({
        workOrderId: reviewingWorkOrder.id,
        status: reviewStatus,
        deliveryUrl: reviewDeliveryUrl.trim() || undefined,
        notes: reviewNotes.trim() || undefined,
        updateTask: reviewUpdateTask,
      });
      if (selectedWorkOrder?.id === updated.id) {
        setSelectedWorkOrder(updated);
      }
      showToast(
        reviewStatus === "done" && reviewUpdateTask
          ? "Deliverable accepted, work order completed, and original task updated."
          : "Contractor deliverable review saved.",
      );
      setReviewingWorkOrder(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save review";
      showToast(msg, "error");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Record payout for work order
  const handleRecordPayout = async (workOrderId: string) => {
    try {
      const updated = await recordWorkOrderPayout({ workOrderId });
      if (selectedWorkOrder?.id === workOrderId) {
        setSelectedWorkOrder(updated);
      }
      showToast("Contractor payout settled and recorded in ledger.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record payout";
      showToast(msg, "error");
    }
  };

  // Remove payout for work order
  const handleRemovePayout = async (workOrderId: string) => {
    try {
      const updated = await removeWorkOrderPayout(workOrderId);
      if (selectedWorkOrder?.id === workOrderId) {
        setSelectedWorkOrder(updated);
      }
      setPayoutAttachments([]);
      showToast("Payout reverted to pending settlement.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove payout";
      showToast(msg, "error");
    }
  };

  // Attach receipt slip to payout
  const handleAttachReceipt = async (payoutId: string) => {
    if (!workflow) return;
    try {
      setIsAttachingReceipt(true);
      const requestId = `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const result = await workflow.attachments.select({ type: "payout", id: payoutId }, requestId);
      if (result) {
        const updated = await workflow.attachments.list({ type: "payout", id: payoutId });
        setPayoutAttachments(updated);
        showToast("Receipt slip attached to contractor payout.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to attach receipt";
      showToast(msg, "error");
    } finally {
      setIsAttachingReceipt(false);
    }
  };

  // Open attachment file
  const handleOpenAttachment = async (attId: string) => {
    if (!workflow) return;
    try {
      await workflow.attachments.open(attId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to open receipt";
      showToast(msg, "error");
    }
  };

  // Toggle work order payout status
  const handleToggleWorkOrderPayout = async (id: string, currentStatus: "PENDING" | "PAID") => {
    try {
      if (currentStatus === "PENDING") {
        await handleRecordPayout(id);
      } else {
        await handleRemovePayout(id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update payout status";
      showToast(msg, "error");
    }
  };

  // Submit handler for adding a new client
  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientFormErrors({});
    const errors: Record<string, string> = {};

    if (!clientName.trim()) {
      errors.name = "Client name cannot be blank or contain only spaces";
    }
    if (!clientEmail.trim()) {
      errors.email = "Email cannot be blank or contain only spaces";
    } else if (!clientEmail.includes("@")) {
      errors.email = "Email must contain an '@' sign (e.g. alex@fintechlabs.com)";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim())) {
      errors.email = "Please enter a valid email address with a domain";
    }

    if (Object.keys(errors).length > 0) {
      setClientFormErrors(errors);
      showToast("Please fix the validation errors before saving.", "error");
      return;
    }

    setIsSubmittingClient(true);
    try {
      await createClient({
        name: clientName.trim(),
        category: clientCategory,
        contactPerson: clientContactPerson.trim() || clientName.trim(),
        contactRole: clientContactRole.trim() || undefined,
        email: clientEmail.trim(),
        phone: clientPhone.trim() || undefined,
        currency: clientCurrency,
        driveUrl: clientDriveUrl.trim() || undefined,
      });

      showToast("Saved client profile");
      setClientName("");
      setClientEmail("");
      setClientPhone("");
      setClientDriveUrl("");
      setClientFormErrors({});
      setIsClientModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save client";
      showToast(msg, "error");
    } finally {
      setIsSubmittingClient(false);
    }
  };

  // Submit handler for adding a reusable vendor profile
  const handleAddVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setVendorFormErrors({});
    const errors: Record<string, string> = {};

    if (!vendorName.trim()) {
      errors.name = "Vendor name cannot be blank or contain only spaces";
    }
    if (!vendorService.trim()) {
      errors.service = "Primary service/specialty cannot be blank";
    }
    if (vendorEmail.trim() && !vendorEmail.includes("@")) {
      errors.email = "Email must contain an '@' sign (e.g. vendor@company.com)";
    }

    if (Object.keys(errors).length > 0) {
      setVendorFormErrors(errors);
      showToast("Please fix the form errors.", "error");
      return;
    }

    setIsSubmittingVendor(true);
    try {
      await createVendor({
        name: vendorName.trim(),
        service: vendorService.trim(),
        iconType: vendorIconType,
        email: vendorEmail.trim() || undefined,
        phone: vendorPhone.trim() || undefined,
        notes: vendorNotes.trim() || undefined,
        balanceCents: 0,
        currentBalance: 0,
        status: "PENDING",
      });

      showToast("Saved reusable vendor profile");
      setVendorName("");
      setVendorService("");
      setVendorEmail("");
      setVendorPhone("");
      setVendorNotes("");
      setVendorFormErrors({});
      setIsVendorModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save vendor";
      showToast(msg, "error");
    } finally {
      setIsSubmittingVendor(false);
    }
  };

  // Submit handler for creating a per-job Work Order
  const handleCreateWorkOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setWoFormErrors({});
    const errors: Record<string, string> = {};

    let targetVendorId = woVendorId;

    if (isCreatingNewVendorInline || targetVendorId === "__new__") {
      if (!newVendorInlineName.trim()) {
        errors.newVendorName = "Contractor name is required";
      }
      if (!newVendorInlineService.trim()) {
        errors.newVendorService = "Service description is required";
      }
      if (newVendorInlineEmail.trim() && !newVendorInlineEmail.includes("@")) {
        errors.newVendorEmail = "Valid email with '@' sign is required";
      }
    } else if (!targetVendorId) {
      errors.vendor = "Please select a subcontractor or create a new profile";
    }

    if (!woTaskId) {
      errors.task = "Source task is required to link this work order";
    }
    if (!woInvoiceId) {
      errors.invoice = "Parent invoice is required to link this work order";
    }
    if (!woScope.trim()) {
      errors.scope = "Scope description cannot be blank";
    }

    const numFee = parseFloat(woFee);
    if (isNaN(numFee) || numFee < 0) {
      errors.fee = "Please enter a valid non-negative contractor fee";
    }

    if (Object.keys(errors).length > 0) {
      setWoFormErrors(errors);
      showToast("Please fix the validation errors before saving.", "error");
      return;
    }

    setIsSubmittingWorkOrder(true);
    try {
      // 1. Create vendor profile if created inline
      if (isCreatingNewVendorInline || targetVendorId === "__new__") {
        const createdV = await createVendor({
          name: newVendorInlineName.trim(),
          service: newVendorInlineService.trim(),
          iconType: newVendorInlineCategory,
          email: newVendorInlineEmail.trim() || undefined,
          phone: newVendorInlinePhone.trim() || undefined,
          balanceCents: Math.round(numFee * 100),
          currentBalance: numFee,
          status: "PENDING",
          linkedClientId: woClientId || undefined,
          linkedClientName: woClientName || undefined,
        });
        targetVendorId = createdV.id;
      }

      // 2. Create persistent work order in SQLite
      await createWorkOrder({
        vendorId: targetVendorId,
        taskId: woTaskId,
        invoiceId: woInvoiceId,
        scope: woScope.trim(),
        feeCents: Math.round(numFee * 100),
        currency: woCurrency,
        dueDate: woDueDate.trim() || undefined,
        deliveryUrl: woDeliveryUrl.trim() || undefined,
        notes: woNotes.trim() || undefined,
        status: "todo",
      });

      showToast("Work order created and linked to task.");
      setIsWorkOrderModalOpen(false);

      // Reset work order form states
      setWoVendorId("");
      setIsCreatingNewVendorInline(false);
      setNewVendorInlineName("");
      setNewVendorInlineService("");
      setNewVendorInlineEmail("");
      setNewVendorInlinePhone("");
      setWoTaskId("");
      setWoTaskTitle("");
      setWoInvoiceId("");
      setWoInvoiceCode("");
      setWoScope("");
      setWoFee("");
      setWoDueDate("");
      setWoDeliveryUrl("");
      setWoNotes("");
      setWoFormErrors({});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create work order";
      showToast(msg, "error");
    } finally {
      setIsSubmittingWorkOrder(false);
    }
  };

  // Render vector icon based on vendor category
  const renderVendorIcon = (type?: VendorItem["iconType"]) => {
    switch (type) {
      case "design":
        return <SlidersHorizontal className="text-text-body text-[13px]" />;
      case "devops":
        return <Code2 className="text-text-body text-[13px]" />;
      case "legal":
        return <FileText className="text-text-body text-[13px]" />;
      case "development":
      default:
        return <Code2 className="text-text-body text-[13px]" />;
    }
  };

  // Filter work orders
  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter((wo) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        wo.scope.toLowerCase().includes(q) ||
        (wo.vendorName && wo.vendorName.toLowerCase().includes(q)) ||
        (wo.taskTitle && wo.taskTitle.toLowerCase().includes(q)) ||
        (wo.clientName && wo.clientName.toLowerCase().includes(q)) ||
        (wo.invoiceCode && wo.invoiceCode.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === "ALL" ? true : wo.payoutStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [workOrders, searchQuery, statusFilter]);

  // Filter vendors
  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        v.name.toLowerCase().includes(q) ||
        v.service.toLowerCase().includes(q) ||
        (v.linkedClientName && v.linkedClientName.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === "ALL" ? true : v.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [vendors, searchQuery, statusFilter]);

  // Aggregate dynamic metrics from work orders (or legacy vendors fallback)
  const { totalCommittedCents, outstandingPayablesCents, settledPayoutsCents } = useMemo(() => {
    if (workOrders.length > 0) {
      let committed = 0;
      let pending = 0;
      let settled = 0;
      for (const wo of workOrders) {
        committed += wo.feeCents;
        if (wo.payoutStatus === "PAID") {
          settled += wo.feeCents;
        } else {
          pending += wo.feeCents;
        }
      }
      return {
        totalCommittedCents: committed,
        outstandingPayablesCents: pending,
        settledPayoutsCents: settled,
      };
    }

    // Fallback to vendors if no work orders yet
    let pending = 0;
    let settled = 0;
    for (const v of vendors) {
      const cents = (Number(v.currentBalance) || 0) * 100;
      if (v.status === "PAID") settled += cents;
      else pending += cents;
    }
    return {
      totalCommittedCents: pending + settled,
      outstandingPayablesCents: pending,
      settledPayoutsCents: settled,
    };
  }, [workOrders, vendors]);

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

      {/* Top Header */}
      <PageHeader
        title="Outsourcing"
        description="Separate reusable vendor profiles from per-job payable work orders linked to sprint tasks and client invoices."
      >
        <div className="outsourcing-header-actions">
          {/* New Work Order button (Primary) */}
          <Button
            variant="primary"
            type="button"
            onClick={() => {
              if (tasks.length > 0 && !woTaskId) {
                const firstTask = tasks[0];
                setWoTaskId(firstTask.id);
                setWoTaskTitle(firstTask.title);
                setWoScope(firstTask.title);
                setWoInvoiceId(firstTask.invoiceId || (invoices[0]?.id || ""));
                setWoClientId(firstTask.clientId || "");
                setWoClientName(firstTask.clientName || "");
                setWoDeliveryUrl(firstTask.deliveryUrl || "");
                setWoCurrency((firstTask.currency as Currency) || activeCurrency || "LKR");
              }
              if (vendors.length > 0 && !woVendorId) {
                setWoVendorId(vendors[0].id);
                setIsCreatingNewVendorInline(false);
              } else if (vendors.length === 0) {
                setWoVendorId("__new__");
                setIsCreatingNewVendorInline(true);
              }
              setWoFormErrors({});
              setIsWorkOrderModalOpen(true);
            }}
          >
            <Plus className="text-[12px]" />
            <span>New Work Order</span>
          </Button>

          {/* Add Vendor Profile button */}
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              setVendorFormErrors({});
              setIsVendorModalOpen(true);
            }}
          >
            <UserPlus className="outsourcing-action-icon" />
            <span>Add Vendor</span>
          </Button>

          {/* Link Client button */}
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
        </div>
      </PageHeader>

      {/* Metric Cards Row */}
      <div className="outsourcing-metrics-grid">
        <MetricCard
          label="Outstanding Payables"
          value={formatCents(outstandingPayablesCents, activeCurrency)}
          footer={`${workOrders.filter((w) => w.payoutStatus === "PENDING").length} work orders awaiting settlement`}
        />
        <MetricCard
          label="Settled Payouts"
          value={formatCents(settledPayoutsCents, activeCurrency)}
          footer={`${workOrders.filter((w) => w.payoutStatus === "PAID").length} payouts settled to date`}
        />
        <MetricCard
          label="Payable Work Orders"
          value={workOrders.length}
          footer="linked job work orders"
        />
        <MetricCard
          label="Subcontractor Profiles"
          value={vendors.length}
          footer="reusable vendor profiles"
        />
      </div>

      {/* Main Directory & Payables Card */}
      <div className="ui-card vendor-directory-card">
        {/* Section Header with Tab Switcher */}
        <div className="vendor-directory-header">
          <div className="space-y-1">
            {/* View Switcher Tabs */}
            <div className="inline-flex items-center gap-1 p-1 bg-surface-neutral-100 rounded-xl border border-line-neutral-200">
              <button
                type="button"
                onClick={() => setActiveTab("work-orders")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "work-orders"
                    ? "bg-surface text-content-neutral-900 shadow-xs"
                    : "text-content-neutral-600 hover:text-content-neutral-900"
                }`}
              >
                Payable Work Orders ({workOrders.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("vendors")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "vendors"
                    ? "bg-surface text-content-neutral-900 shadow-xs"
                    : "text-content-neutral-600 hover:text-content-neutral-900"
                }`}
              >
                Vendor Directory ({vendors.length})
              </button>
            </div>
            <p className="vendor-directory-subtitle">
              {activeTab === "work-orders"
                ? "Per-job payable vouchers linked to sprint tasks, client invoices, and agreed subcontractor fees."
                : "Reusable profiles for independent contractors, development partners, and design agencies."}
            </p>
          </div>

          {/* Search and status filters */}
          <div className="vendor-controls-group">
            <div className="vendor-search-wrapper">
              <Search className="vendor-search-icon" />
              <input
                type="text"
                placeholder={activeTab === "work-orders" ? "Search work orders..." : "Search vendors..."}
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

        {/* Content Area */}
        <div className="bg-surface divide-y divide-line-neutral-100">
          {activeTab === "work-orders" ? (
            /* TAB 1: WORK ORDERS */
            filteredWorkOrders.length === 0 ? (
              <EmptyState
                title={workOrders.length === 0 ? "No payable work orders recorded" : "No matching work orders found"}
                description={
                  workOrders.length === 0
                    ? "Outsource deliverables from sprint tasks or create a work order linking a subcontractor to a client invoice."
                    : "Try adjusting your search query or status filter."
                }
              >
                {workOrders.length === 0 && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <Button
                      variant="primary"
                      onClick={() => {
                        setWoFormErrors({});
                        setIsWorkOrderModalOpen(true);
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create First Work Order</span>
                    </Button>
                  </div>
                )}
              </EmptyState>
            ) : (
              filteredWorkOrders.map((wo) => (
                <div key={wo.id} className="vendor-list-row">
                  {/* Left: Info & Linkages */}
                  <div className="vendor-info-group">
                    <div className="vendor-avatar-icon">
                      {renderVendorIcon(wo.vendorIconType)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="vendor-name-heading text-sm font-semibold text-content-neutral-900">
                          {wo.scope}
                        </h3>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-surface-purple-50 text-content-purple-700 border border-line-purple-200/60">
                          <Users className="w-3 h-3" />
                          <span>{wo.vendorName}</span>
                        </span>
                        {wo.invoiceCode && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-surface-neutral-100 text-content-neutral-700 border border-line-neutral-200">
                            <Receipt className="w-3 h-3 text-content-neutral-500" />
                            <span>{wo.invoiceCode}</span>
                            {wo.clientName && <span>· {wo.clientName}</span>}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11.5px] text-content-neutral-500 flex-wrap">
                        {wo.taskTitle && (
                          <span className="flex items-center gap-1">
                            <GitFork className="w-3 h-3 text-accent" />
                            <span>Task: {wo.taskTitle}</span>
                          </span>
                        )}
                        {wo.dueDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-content-neutral-400" />
                            <span>Due: {wo.dueDate}</span>
                          </span>
                        )}
                        {(() => {
                          const resolved = resolveDeliveryUrl(wo, { tasks, invoices, clients });
                          if (!resolved.hasLink) return null;
                          return (
                            <button
                              type="button"
                              onClick={(e) => openExternalLink(resolved.formattedUrl, e)}
                              className="inline-flex items-center gap-1 text-accent hover:underline font-medium text-xs bg-transparent border-0 p-0 cursor-pointer"
                              title={`${resolved.label}: ${resolved.url}`}
                            >
                              <Link2 className="w-3 h-3" />
                              <span>{resolved.label}</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                            </button>
                          );
                        })()}
                        {wo.notes && (
                          <span className="text-content-neutral-600 truncate max-w-xs" title={wo.notes}>
                            Note: {wo.notes}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Fee, Work Status & Review, Settlement Payout Status, and Voucher Action */}
                  <div className="vendor-actions-group">
                    <div className="vendor-balance-box">
                      <span className="vendor-balance-label">Agreed Fee</span>
                      <span className="vendor-balance-amount font-mono">
                        {formatCents(wo.feeCents, wo.currency)}
                      </span>
                    </div>

                    {/* 1. Contractor Work Status Pill & Review Action */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenReviewModal(wo)}
                        title="Click to review contractor deliverable and update status"
                        className={`wo-status-pill status-${wo.status || "todo"} cursor-pointer hover:opacity-85`}
                      >
                        {wo.status === "done" && <CheckCheck className="w-2.5 h-2.5" />}
                        {wo.status === "review" && <Clock className="w-2.5 h-2.5" />}
                        <span>
                          {wo.status === "todo"
                            ? "Assigned"
                            : wo.status === "in-progress"
                              ? "In Progress"
                              : wo.status === "review"
                                ? "Under Review"
                                : "Completed"}
                        </span>
                      </button>

                      <Button
                        variant="secondary"
                        size="small"
                        type="button"
                        onClick={() => handleOpenReviewModal(wo)}
                        title="Review deliverable URL, notes, and sync to task"
                        className="text-xs h-7 px-2"
                      >
                        <FileCheck className="w-3 h-3 mr-1" />
                        <span>Review</span>
                      </Button>
                    </div>

                    {/* 2. Settlement Payout Status (Tracked Separately) */}
                    <button
                      type="button"
                      onClick={() => setSelectedWorkOrder(wo)}
                      title="View payout voucher and attached receipts"
                      className={`vendor-status-pill status-${(wo.payoutStatus || "PENDING").toLowerCase()}`}
                    >
                      {wo.payoutStatus === "PAID" && <Check className="w-2.5 h-2.5" />}
                      <span>{wo.payoutStatus === "PAID" ? "Payout Paid" : "Payout Pending"}</span>
                    </button>

                    {/* Statement Voucher Button */}
                    <Button
                      variant={wo.payoutStatus === "PENDING" ? "primary" : "secondary"}
                      size="icon"
                      type="button"
                      onClick={() => setSelectedWorkOrder(wo)}
                      title="View Work Order Statement Voucher & Receipts"
                      className="shrink-0"
                    >
                      <Download className="text-[11px]" />
                    </Button>
                  </div>
                </div>
              ))
            )
          ) : (
            /* TAB 2: REUSABLE VENDOR DIRECTORY */
            filteredVendors.length === 0 ? (
              <EmptyState
                title={vendors.length === 0 ? "No vendor profiles registered" : "No matching vendors found"}
                description={
                  vendors.length === 0
                    ? "Add reusable profiles for contractors and agencies you collaborate with."
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
              filteredVendors.map((vendor) => {
                const linkedOrders = workOrders.filter((w) => w.vendorId === vendor.id);
                return (
                  <div key={vendor.id} className="vendor-list-row">
                    <div className="vendor-info-group">
                      <div className="vendor-avatar-icon">
                        {renderVendorIcon(vendor.iconType)}
                      </div>
                      <div>
                        <div className="vendor-name-row">
                          <h3 className="vendor-name-heading">
                            {vendor.name}
                          </h3>
                          <span className="text-[11px] font-semibold text-content-neutral-500 px-2 py-0.5 rounded bg-surface-neutral-100 border border-line-neutral-200">
                            {linkedOrders.length} {linkedOrders.length === 1 ? "work order" : "work orders"}
                          </span>
                        </div>
                        <p className="vendor-service-desc">
                          {vendor.service}
                        </p>
                        <div className="text-[11px] text-content-neutral-400 mt-1 flex items-center gap-3">
                          {vendor.email && <span>Email: {vendor.email}</span>}
                          {vendor.phone && <span>Phone: {vendor.phone}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="vendor-actions-group">
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => {
                          setWoVendorId(vendor.id);
                          setIsCreatingNewVendorInline(false);
                          setWoFormErrors({});
                          setIsWorkOrderModalOpen(true);
                        }}
                      >
                        <Plus className="w-3 h-3" />
                        <span>Work Order</span>
                      </Button>

                      <button
                        type="button"
                        onClick={() => handleToggleVendorStatus(vendor.id)}
                        title="Click to toggle status"
                        className={`vendor-status-pill status-${vendor.status.toLowerCase()}`}
                      >
                        {vendor.status === "PAID" && <Check className="w-2.5 h-2.5" />}
                        <span>{vendor.status}</span>
                      </button>

                      <Button
                        variant="secondary"
                        size="icon"
                        type="button"
                        onClick={() => setSelectedVendor(vendor)}
                        title="View Vendor Statement"
                        className="shrink-0"
                      >
                        <Download className="text-[11px]" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>
      </div>

      {/* Modal Dialog: View Statement Voucher (Work Order or Vendor) */}
      <MotionPresence>
        {(selectedWorkOrder || selectedVendor) && (
          <MotionSurface kind="dialog" className="outsourcing-modal-overlay">
            <MotionSurface
              onDismiss={() => {
                setSelectedWorkOrder(null);
                setSelectedVendor(null);
              }}
              kind="panel"
              className="outsourcing-modal-panel voucher-panel"
            >
              <div className="outsourcing-modal-header">
                <div className="flex items-center gap-2">
                  <GitFork className="w-4 h-4 text-accent" />
                  <h3 className="outsourcing-modal-title">
                    {selectedWorkOrder ? "Payable Work Order Voucher" : "Vendor Statement Voucher"}
                  </h3>
                </div>
                <Button
                  aria-label="Close"
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => {
                    setSelectedWorkOrder(null);
                    setSelectedVendor(null);
                  }}
                >
                  <X className="text-sm" />
                </Button>
              </div>

              <div className="outsourcing-modal-body text-[12px] text-text-body p-6 space-y-4">
                {selectedWorkOrder ? (
                  <>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-[11px] font-mono text-content-neutral-400">
                          VOUCHER #{selectedWorkOrder.id.slice(-8).toUpperCase()}
                        </div>
                        <div className="font-bold text-[16px] text-text-primary mt-0.5">
                          {selectedWorkOrder.scope}
                        </div>
                        <div className="text-content-neutral-600 text-[12px] mt-1 flex items-center gap-1.5 font-medium">
                          <span>Subcontractor:</span>
                          <span className="text-content-neutral-900 font-semibold">
                            {selectedWorkOrder.vendorName}
                          </span>
                        </div>
                      </div>
                      <span className={`vendor-status-pill status-${(selectedWorkOrder.payoutStatus || "PENDING").toLowerCase()}`}>
                        {selectedWorkOrder.payoutStatus || "PENDING"}
                      </span>
                    </div>

                    <div className="voucher-client-box p-3 rounded-xl bg-surface-neutral-50 border border-line-neutral-200 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-content-neutral-500">Parent Client Invoice</span>
                        <span className="font-mono font-semibold text-content-neutral-900">
                          {selectedWorkOrder.invoiceCode} ({selectedWorkOrder.clientName})
                        </span>
                      </div>
                      {selectedWorkOrder.taskTitle && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-content-neutral-500">Linked Deliverable Task</span>
                          <span className="font-medium text-content-neutral-900">
                            {selectedWorkOrder.taskTitle}
                          </span>
                        </div>
                      )}
                      {selectedWorkOrder.dueDate && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-content-neutral-500">Agreed Delivery Date</span>
                          <span className="font-medium text-content-neutral-900">
                            {selectedWorkOrder.dueDate}
                          </span>
                        </div>
                      )}
                      {(() => {
                        const resolved = resolveDeliveryUrl(selectedWorkOrder, { tasks, invoices, clients });
                        if (!resolved.hasLink) return null;
                        return (
                          <div className="flex justify-between items-center text-xs pt-1 border-t border-line-neutral-200">
                            <span className="text-content-neutral-500">{resolved.label}</span>
                            <button
                              type="button"
                              onClick={(e) => openExternalLink(resolved.formattedUrl, e)}
                              className="text-accent hover:underline inline-flex items-center gap-1 font-medium bg-transparent border-0 p-0 cursor-pointer"
                              title={resolved.url}
                            >
                              <span>Open URL</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Contractor Work Status & Deliverable Details */}
                    <div className="p-3 rounded-xl bg-surface-neutral-50 border border-line-neutral-200 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-content-neutral-500">Contractor Work Status</span>
                        <span className={`wo-status-pill status-${selectedWorkOrder.status || "todo"}`}>
                          {selectedWorkOrder.status === "done" && <CheckCheck className="w-2.5 h-2.5" />}
                          {selectedWorkOrder.status === "review" && <Clock className="w-2.5 h-2.5" />}
                          <span>
                            {selectedWorkOrder.status === "todo"
                              ? "Assigned"
                              : selectedWorkOrder.status === "in-progress"
                                ? "In Progress"
                                : selectedWorkOrder.status === "review"
                                  ? "Under Review"
                                  : "Completed"}
                          </span>
                        </span>
                      </div>
                      {selectedWorkOrder.completedAt && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-content-neutral-500">Completed On</span>
                          <span className="font-mono text-content-neutral-800">
                            {new Date(selectedWorkOrder.completedAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {selectedWorkOrder.notes && (
                        <div className="text-xs pt-1 border-t border-line-neutral-200">
                          <span className="text-content-neutral-500 block mb-0.5 font-medium">Deliverable Notes:</span>
                          <p className="text-content-neutral-700 bg-surface-neutral-100/70 p-2 rounded-md font-mono text-[11px] whitespace-pre-wrap">
                            {selectedWorkOrder.notes}
                          </p>
                        </div>
                      )}
                      <div className="pt-1 flex justify-end">
                        <Button
                          variant="secondary"
                          size="small"
                          type="button"
                          onClick={() => {
                            const wo = selectedWorkOrder;
                            setSelectedWorkOrder(null);
                            handleOpenReviewModal(wo);
                          }}
                          className="text-xs h-7"
                        >
                          <FileCheck className="w-3 h-3 mr-1" />
                          <span>Review & Sync Deliverable</span>
                        </Button>
                      </div>
                    </div>

                    {/* Agreed Contractor Fee */}
                    <div className="p-3 rounded-xl bg-surface-purple-50/50 border border-line-purple-200 flex justify-between items-center">
                      <span className="text-xs font-semibold text-content-purple-900">Agreed Contractor Fee</span>
                      <span className="font-mono text-base font-bold text-content-purple-900">
                        {formatCents(selectedWorkOrder.feeCents, selectedWorkOrder.currency)}
                      </span>
                    </div>

                    {/* Settlement Payout & Receipts Ledger (Tracked Separately) */}
                    <div className="p-3.5 rounded-xl bg-surface-neutral-50 border border-line-neutral-200 space-y-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-xs font-semibold text-content-neutral-900 block">
                            Settlement Payout & Receipts
                          </span>
                          <span className="text-[11px] text-content-neutral-500">
                            Tracked independently from contractor work completion.
                          </span>
                        </div>
                        <span className={`vendor-status-pill status-${(selectedWorkOrder.payoutStatus || "PENDING").toLowerCase()}`}>
                          {selectedWorkOrder.payoutStatus === "PAID" && <Check className="w-2.5 h-2.5" />}
                          <span>{selectedWorkOrder.payoutStatus || "PENDING"}</span>
                        </span>
                      </div>

                      {selectedWorkOrder.payoutStatus === "PAID" ? (
                        <div className="space-y-2.5 pt-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-content-neutral-500">Paid Date</span>
                            <span className="font-mono text-content-neutral-900">
                              {selectedWorkOrder.paidAt
                                ? new Date(selectedWorkOrder.paidAt).toLocaleDateString()
                                : "Recorded"}
                            </span>
                          </div>

                          {/* Receipts Section */}
                          <div className="space-y-1.5 pt-1 border-t border-line-neutral-200">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-medium text-content-neutral-600 flex items-center gap-1">
                                <Paperclip className="w-3 h-3 text-content-neutral-400" />
                                <span>Attached Receipt Slips</span>
                              </span>
                              {selectedWorkOrder.payoutId && (
                                <Button
                                  variant="secondary"
                                  size="small"
                                  type="button"
                                  disabled={isAttachingReceipt}
                                  onClick={() => handleAttachReceipt(selectedWorkOrder.payoutId!)}
                                  className="text-xs h-6 px-2"
                                >
                                  {isAttachingReceipt ? "Attaching..." : "+ Attach Receipt"}
                                </Button>
                              )}
                            </div>

                            {isLoadingPayoutAttachments ? (
                              <p className="text-[11px] text-content-neutral-400 italic">Loading receipts...</p>
                            ) : payoutAttachments.length === 0 ? (
                              <p className="text-[11px] text-content-neutral-400 italic">No receipt slip attached yet.</p>
                            ) : (
                              <div className="payout-receipt-list">
                                {payoutAttachments.map((att) => (
                                  <div key={att.id} className="payout-receipt-item">
                                    <div className="flex items-center gap-2 truncate">
                                      <FileText className="w-3.5 h-3.5 text-accent shrink-0" />
                                      <span className="font-medium truncate text-content-neutral-800">{att.originalName}</span>
                                    </div>
                                    <Button
                                      variant="secondary"
                                      size="small"
                                      type="button"
                                      onClick={() => handleOpenAttachment(att.id)}
                                      className="text-[11px] h-6 px-2 shrink-0 ml-2"
                                    >
                                      View Slip
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="pt-2 flex justify-end">
                            <Button
                              variant="ghost"
                              size="small"
                              type="button"
                              onClick={() => handleRemovePayout(selectedWorkOrder.id)}
                              className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-7"
                            >
                              Revert to Unpaid
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 pt-1">
                          <p className="text-[11.5px] text-content-neutral-600">
                            Payout has not been recorded for this contractor. Recording a payout settles the ledger entry.
                          </p>
                          <div className="flex justify-end pt-1">
                            <Button
                              variant="primary"
                              size="small"
                              type="button"
                              onClick={() => handleRecordPayout(selectedWorkOrder.id)}
                              className="text-xs h-7"
                            >
                              Record Payout ({formatCents(selectedWorkOrder.feeCents, selectedWorkOrder.currency)})
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : selectedVendor ? (
                  <>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-[16px] text-text-primary">
                          {selectedVendor.name}
                        </div>
                        <div className="text-text-subtle text-[12px] mt-0.5">
                          {selectedVendor.service}
                        </div>
                        {selectedVendor.email && (
                          <div className="text-text-muted text-[11px] mt-1">
                            Email: {selectedVendor.email}
                          </div>
                        )}
                      </div>
                      <span className={`vendor-status-pill status-${selectedVendor.status.toLowerCase()}`}>
                        {selectedVendor.status}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-surface-neutral-50 border border-line-neutral-200 flex justify-between items-center">
                      <span className="text-xs text-content-neutral-500">Current Balance</span>
                      <span className="font-mono text-sm font-bold text-content-neutral-900">
                        {formatCurrencyAmount(selectedVendor.currentBalance, activeCurrency)}
                      </span>
                    </div>
                  </>
                ) : null}

                <div className="pt-3 border-t border-line-neutral-100 flex items-center justify-end gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (typeof window !== "undefined") window.print();
                    }}
                  >
                    Print Voucher
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      setSelectedWorkOrder(null);
                      setSelectedVendor(null);
                    }}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Modal Dialog: Review Contractor Deliverable & Sync to Task */}
      <MotionPresence>
        {reviewingWorkOrder && (
          <MotionSurface kind="dialog" className="outsourcing-modal-overlay">
            <MotionSurface
              onDismiss={() => setReviewingWorkOrder(null)}
              kind="panel"
              className="outsourcing-modal-panel max-w-lg"
            >
              <div className="outsourcing-modal-header">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-accent" />
                  <h3 className="outsourcing-modal-title">
                    Review Contractor Deliverable
                  </h3>
                </div>
                <Button
                  aria-label="Close"
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => setReviewingWorkOrder(null)}
                >
                  <X className="text-sm" />
                </Button>
              </div>

              <form onSubmit={handleSaveReview} className="outsourcing-modal-body">
                <div className="deliverable-review-box">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-content-neutral-500 font-medium">Work Order Scope</span>
                    <span className="font-semibold text-content-neutral-900">{reviewingWorkOrder.scope}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-content-neutral-500 font-medium">Subcontractor</span>
                    <span className="font-medium text-content-neutral-800">{reviewingWorkOrder.vendorName}</span>
                  </div>
                  {reviewingWorkOrder.taskTitle && (
                    <div className="flex justify-between items-center text-xs pt-1 border-t border-line-neutral-200">
                      <span className="text-content-neutral-500 font-medium">Original Task</span>
                      <span className="font-mono text-content-neutral-900">{reviewingWorkOrder.taskTitle}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-xs pt-1 border-t border-line-neutral-200">
                    <span className="text-content-neutral-500 font-medium">Agreed Fee</span>
                    <span className="font-mono font-bold text-content-neutral-900">
                      {formatCents(reviewingWorkOrder.feeCents, reviewingWorkOrder.currency)}
                    </span>
                  </div>
                </div>

                {/* Contractor Progress Status */}
                <div className="outsourcing-form-group">
                  <label className="outsourcing-label">Contractor Work Status</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: "todo", label: "Assigned" },
                      { id: "in-progress", label: "In Progress" },
                      { id: "review", label: "Under Review" },
                      { id: "done", label: "Completed" },
                    ].map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setReviewStatus(s.id as "todo" | "in-progress" | "review" | "done")}
                        className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all text-center ${
                          reviewStatus === s.id
                            ? "bg-accent text-white border-accent shadow-xs"
                            : "bg-surface-neutral-50 border-line-neutral-200 text-content-neutral-700 hover:bg-surface-neutral-100"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Deliverable URL */}
                <div className="outsourcing-form-group">
                  <div className="flex justify-between items-center">
                    <label className="outsourcing-label">Deliverable URL / Repository / Staging</label>
                    {reviewDeliveryUrl && (
                      <a
                        href={reviewDeliveryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent hover:underline inline-flex items-center gap-1"
                      >
                        <span>Open Link</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                  <input
                    type="url"
                    value={reviewDeliveryUrl}
                    onChange={(e) => setReviewDeliveryUrl(e.target.value)}
                    placeholder="https://github.com/org/repo or staging URL"
                    className="outsourcing-input font-mono text-xs"
                  />
                  <p className="text-[11px] text-content-neutral-400">
                    Retained with this work order and accessible to the freelancer and client.
                  </p>
                </div>

                {/* Delivery Notes */}
                <div className="outsourcing-form-group">
                  <label className="outsourcing-label">Handover Notes / Verification Summary</label>
                  <textarea
                    rows={3}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Contractor delivery notes, PR summary, or review verification feedback..."
                    className="outsourcing-textarea text-xs"
                  />
                </div>

                {/* Sync to original task checkbox */}
                <div className="p-3 rounded-xl bg-surface-purple-50/50 border border-line-purple-200/70">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reviewUpdateTask}
                      onChange={(e) => setReviewUpdateTask(e.target.checked)}
                      className="mt-0.5 rounded border-line-purple-300 text-accent focus:ring-accent"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-content-purple-900 block">
                        Update original task in Kanban board after review
                      </span>
                      <span className="text-content-purple-700 text-[11px] mt-0.5 block">
                        Syncs the delivered URL and sets the linked task to {reviewStatus === "done" ? "Done" : "Under Review"} automatically.
                      </span>
                    </div>
                  </label>
                </div>

                <div className="outsourcing-modal-footer">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setReviewingWorkOrder(null)}
                    disabled={isSubmittingReview}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={isSubmittingReview}
                  >
                    {isSubmittingReview ? "Saving..." : reviewStatus === "done" ? "Accept & Complete Work" : "Save Review"}
                  </Button>
                </div>
              </form>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Modal Dialog: New Work Order (Prefilled from saved IDs or manually configured) */}
      <MotionPresence>
        {isWorkOrderModalOpen && (
          <MotionSurface kind="dialog" className="outsourcing-modal-overlay">
            <MotionSurface
              onDismiss={() => setIsWorkOrderModalOpen(false)}
              kind="panel"
              className="outsourcing-modal-panel max-w-lg"
            >
              <div className="outsourcing-modal-header">
                <div className="flex items-center gap-2">
                  <GitFork className="w-4 h-4 text-accent" />
                  <h3 className="outsourcing-modal-title">
                    Create Outsourcing Work Order
                  </h3>
                </div>
                <Button
                  aria-label="Close"
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => setIsWorkOrderModalOpen(false)}
                >
                  <X className="text-sm" />
                </Button>
              </div>

              <form onSubmit={handleCreateWorkOrder} className="p-6 space-y-4">
                {/* Linked Task & Invoice Banner if prefilled */}
                {woTaskId && (
                  <div className="p-3 rounded-xl bg-surface-purple-50/50 border border-line-purple-200 flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    <div className="text-xs space-y-0.5">
                      <div className="font-semibold text-content-neutral-900">
                        Linked Task: {woTaskTitle || "Sprint Deliverable"}
                      </div>
                      <div className="text-content-neutral-600">
                        Invoice: <span className="font-mono font-medium">{woInvoiceCode || woInvoiceId}</span>
                        {woClientName && <span> · Client: {woClientName}</span>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Subcontractor / Vendor Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[12px] font-semibold text-text-secondary">
                      Assigned Subcontractor *
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCreatingNewVendorInline(!isCreatingNewVendorInline)}
                      className="text-[11px] text-accent hover:underline font-semibold"
                    >
                      {isCreatingNewVendorInline ? "Select Existing Vendor" : "+ Add New Vendor"}
                    </button>
                  </div>

                  {!isCreatingNewVendorInline ? (
                    <select
                      value={woVendorId}
                      onChange={(e) => {
                        if (e.target.value === "__new__") {
                          setIsCreatingNewVendorInline(true);
                          setWoVendorId("__new__");
                        } else {
                          setWoVendorId(e.target.value);
                        }
                      }}
                      className="ui-field w-full text-[13px] px-3 py-2 border border-border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-focus"
                    >
                      <option value="">-- Choose Subcontractor --</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.service})
                        </option>
                      ))}
                      <option value="__new__">+ Register New Subcontractor...</option>
                    </select>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-surface-neutral-50 border border-line-neutral-200 space-y-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-content-neutral-700 mb-1">
                          Contractor / Agency Name *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Alex WebCraft Labs"
                          value={newVendorInlineName}
                          onChange={(e) => setNewVendorInlineName(e.target.value)}
                          className="ui-field w-full text-xs px-3 py-1.5 rounded-lg border border-line-neutral-300"
                        />
                        {woFormErrors.newVendorName && (
                          <p className="text-content-rose-600 text-[10.5px] mt-0.5">{woFormErrors.newVendorName}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-content-neutral-700 mb-1">
                            Primary Specialty *
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Frontend Development"
                            value={newVendorInlineService}
                            onChange={(e) => setNewVendorInlineService(e.target.value)}
                            className="ui-field w-full text-xs px-3 py-1.5 rounded-lg border border-line-neutral-300"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-content-neutral-700 mb-1">
                            Category
                          </label>
                          <select
                            value={newVendorInlineCategory}
                            onChange={(e) => setNewVendorInlineCategory(e.target.value as VendorItem["iconType"])}
                            className="ui-field w-full text-xs px-2 py-1.5 rounded-lg border border-line-neutral-300"
                          >
                            <option value="development">Development</option>
                            <option value="design">Design</option>
                            <option value="devops">DevOps</option>
                            <option value="legal">Legal</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-content-neutral-600 mb-1">Email</label>
                          <input
                            type="email"
                            placeholder="alex@webcraft.io"
                            value={newVendorInlineEmail}
                            onChange={(e) => setNewVendorInlineEmail(e.target.value)}
                            className="ui-field w-full text-xs px-3 py-1.5 rounded-lg border border-line-neutral-300"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-content-neutral-600 mb-1">Phone</label>
                          <input
                            type="text"
                            placeholder="+94 77 123 4567"
                            value={newVendorInlinePhone}
                            onChange={(e) => setNewVendorInlinePhone(e.target.value)}
                            className="ui-field w-full text-xs px-3 py-1.5 rounded-lg border border-line-neutral-300"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  {woFormErrors.vendor && (
                    <p className="text-content-rose-600 text-[11px] mt-1 font-medium">{woFormErrors.vendor}</p>
                  )}
                </div>

                {/* If opened manually, allow selecting Task */}
                {!searchParams.get("taskId") && tasks.length > 0 && (
                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                      Sprint Deliverable Task *
                    </label>
                    <select
                      value={woTaskId}
                      onChange={(e) => {
                        const t = tasks.find((item) => item.id === e.target.value);
                        if (t) {
                          setWoTaskId(t.id);
                          setWoTaskTitle(t.title);
                          setWoScope(t.title);
                          setWoInvoiceId(t.invoiceId || "");
                          setWoClientId(t.clientId || "");
                          setWoClientName(t.clientName || "");
                          setWoDeliveryUrl(t.deliveryUrl || "");
                          setWoCurrency((t.currency as Currency) || activeCurrency || "LKR");
                          const inv = invoices.find((i) => i.id === t.invoiceId);
                          if (inv) setWoInvoiceCode(inv.code);
                        }
                      }}
                      className="ui-field w-full text-[13px] px-3 py-2 border border-border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-focus"
                    >
                      <option value="">-- Choose Task to Outsource --</option>
                      {tasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} {t.clientName ? `(${t.clientName})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Scope Description */}
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                    Deliverable Scope & Task Description *
                  </label>
                  <textarea
                    rows={2}
                    value={woScope}
                    onChange={(e) => setWoScope(e.target.value)}
                    placeholder="e.g. Build responsive homepage and services showcase"
                    className="ui-field w-full text-[13px] p-3 border border-border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-focus"
                  />
                  {woFormErrors.scope && (
                    <p className="text-content-rose-600 text-[11px] mt-1">{woFormErrors.scope}</p>
                  )}
                </div>

                {/* Agreed Fee & Explicit Currency */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                      Agreed Contractor Fee *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="30000.00"
                      value={woFee}
                      onChange={(e) => setWoFee(e.target.value)}
                      className="ui-field w-full text-[13px] px-3 py-2 border border-border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-focus font-mono"
                    />
                    {woFormErrors.fee && (
                      <p className="text-content-rose-600 text-[11px] mt-1">{woFormErrors.fee}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                      Payable Currency *
                    </label>
                    <select
                      value={woCurrency}
                      onChange={(e) => setWoCurrency(e.target.value as Currency)}
                      className="ui-field w-full text-[12.5px] px-3 py-2 border border-border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-focus font-semibold"
                    >
                      <option value="LKR">LKR (Rs.)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="CAD">CAD (CA$)</option>
                    </select>
                  </div>
                </div>

                {/* Target Due Date & Delivery URL */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                      Milestone Due Date
                    </label>
                    <input
                      type="text"
                      placeholder="YYYY-MM-DD or Oct 20"
                      value={woDueDate}
                      onChange={(e) => setWoDueDate(e.target.value)}
                      className="ui-field w-full text-[12.5px] px-3 py-2 border border-border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-focus"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                      Delivery Location URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://drive.google.com/... or git"
                      value={woDeliveryUrl}
                      onChange={(e) => setWoDeliveryUrl(e.target.value)}
                      className="ui-field w-full text-[12.5px] px-3 py-2 border border-border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-focus"
                    />
                  </div>
                </div>

                {/* Optional Handover Notes */}
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                    Initial Delivery Notes / Deliverable Specifications
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Specific repository branches, deliverables checklist, or acceptance requirements..."
                    value={woNotes}
                    onChange={(e) => setWoNotes(e.target.value)}
                    className="ui-field w-full text-[12.5px] p-3 border border-border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-focus"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-line-neutral-100">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setIsWorkOrderModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={isSubmittingWorkOrder}
                  >
                    {isSubmittingWorkOrder ? "Creating..." : "Save Work Order"}
                  </Button>
                </div>
              </form>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Modal Dialog: Add Reusable Vendor Profile */}
      <MotionPresence>
        {isVendorModalOpen && (
          <MotionSurface kind="dialog" className="outsourcing-modal-overlay">
            <MotionSurface
              onDismiss={() => setIsVendorModalOpen(false)}
              kind="panel"
              className="outsourcing-modal-panel"
            >
              <div className="outsourcing-modal-header">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-accent" />
                  <h3 className="outsourcing-modal-title">
                    Add Reusable Vendor Profile
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
                    placeholder="e.g. PixelCraft Studio"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    className="ui-field w-full text-[13px] px-3.5 py-2.5 rounded-xl border border-border-muted focus:outline-none focus:ring-2 focus:ring-focus"
                  />
                  {vendorFormErrors.name && (
                    <p className="text-content-rose-600 text-[11px] mt-1">{vendorFormErrors.name}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                      Primary Service / Specialty *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. UI/UX Design & Branding"
                      value={vendorService}
                      onChange={(e) => setVendorService(e.target.value)}
                      className="ui-field w-full text-[12.5px] px-3 py-2 border border-border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-focus"
                    />
                    {vendorFormErrors.service && (
                      <p className="text-content-rose-600 text-[11px] mt-1">{vendorFormErrors.service}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                      Category
                    </label>
                    <select
                      value={vendorIconType}
                      onChange={(e) => setVendorIconType(e.target.value as VendorItem["iconType"])}
                      className="ui-field w-full text-[12.5px] px-3 py-2 border border-border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-focus"
                    >
                      <option value="development">Software Development</option>
                      <option value="design">UI/UX Design</option>
                      <option value="devops">DevOps & Cloud</option>
                      <option value="legal">Legal & Compliance</option>
                    </select>
                  </div>
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
                      Phone Number
                    </label>
                    <input
                      type="text"
                      placeholder="+94 77 123 4567"
                      value={vendorPhone}
                      onChange={(e) => setVendorPhone(e.target.value)}
                      className="ui-field w-full text-[12.5px] px-3 py-2 border border-border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-focus"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                    Notes & Capabilities (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Reliable React Native developer; fast turnaround on responsive styling."
                    value={vendorNotes}
                    onChange={(e) => setVendorNotes(e.target.value)}
                    className="ui-field w-full text-[12.5px] p-3 border border-border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-focus"
                  />
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
                    {isSubmittingVendor ? "Saving..." : "Save Profile"}
                  </Button>
                </div>
              </form>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Modal Dialog: Add Client */}
      <MotionPresence>
        {isClientModalOpen && (
          <MotionSurface kind="dialog" className="outsourcing-modal-overlay">
            <MotionSurface
              onDismiss={() => setIsClientModalOpen(false)}
              kind="panel"
              className="outsourcing-modal-panel"
            >
              <div className="outsourcing-modal-header">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-accent" />
                  <h3 className="outsourcing-modal-title">
                    Add Client Profile
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
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                    Client Organization Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Global Solutions"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="ui-field w-full text-[13px] px-3.5 py-2.5 rounded-xl border border-border-muted focus:outline-none focus:ring-2 focus:ring-focus"
                  />
                  {clientFormErrors.name && (
                    <p className="text-content-rose-600 text-[11px] mt-1">{clientFormErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                    Email Address *
                  </label>
                  <input
                    type="text"
                    placeholder="alex@fintechlabs.com"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="ui-field w-full text-[13px] px-3.5 py-2.5 rounded-xl border border-border-muted focus:outline-none focus:ring-2 focus:ring-focus"
                  />
                  {clientFormErrors.email && (
                    <p className="text-content-rose-600 text-[11px] mt-1">{clientFormErrors.email}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                      Billing Currency
                    </label>
                    <select
                      value={clientCurrency}
                      onChange={(e) => setClientCurrency(e.target.value as Currency)}
                      className="ui-field w-full text-[12.5px] px-3 py-2 border border-border-muted rounded-xl"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="LKR">LKR (Rs.)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="CAD">CAD (CA$)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sarah Jenkins"
                      value={clientContactPerson}
                      onChange={(e) => setClientContactPerson(e.target.value)}
                      className="ui-field w-full text-[12.5px] px-3 py-2 border border-border-muted rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                    Client Resource Link / Drive Folder
                  </label>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/drive/folders/..."
                    value={clientDriveUrl}
                    onChange={(e) => setClientDriveUrl(e.target.value)}
                    className="ui-field w-full text-[12.5px] px-3 py-2 border border-border-muted rounded-xl"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-line-neutral-100">
                  <Button variant="ghost" type="button" onClick={() => setIsClientModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" disabled={isSubmittingClient}>
                    {isSubmittingClient ? "Saving..." : "Save Client"}
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
