"use client";
import { workspaceDraft } from "@/lib/workspace-drafts";
import {
  useReportingData,
  ReportingGuard,
  ReportedMoney,
} from "@/context/ReportingContext";

import Image from "next/image";
import { PayableForm } from "./PayableForm";
import { PhoneField } from "@/components/ui/PhoneField";
import { ImageUpload } from "@/components/ui/ImageUpload";
import {
  openMessageDraft,
  smsDraft,
  whatsAppDraft,
  type WhatsAppTarget,
} from "@/lib/message-drafts";
import { useWorkspaceCommand } from "@/lib/use-workspace-command";
import { remainingPayout } from "@/lib/cashflow-forecast";
import { PayoutLedger } from "./PayoutLedger";
import { Dialog } from "@/components/ui/Dialog";
import { ReviewDeliverableModal } from "./ReviewDeliverableModal";

import { DataBreakdown, MonthlyBars } from "@/components/ui/DataGraphic";
import { recentMonths } from "@/lib/visual-metrics";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Code2,
  Download,
  ExternalLink,
  FileText,
  GitFork,
  Plus,
  Search,
  SlidersHorizontal,
  UserPlus,
  Users,
  FileCheck,
  RotateCcw,
  MessageCircle,
  Copy,
} from "lucide-react";
import { formatWorkOrderPaymentSummary } from "@/lib/payment-summary";

import { Button, PageHeader, EmptyState } from "@/components/ui/Workspace";

import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";
import { m } from "motion/react";
import { SPRING_NAV_GLIDE, SPRING_MENU_POPOVER } from "@/lib/motion";
import {
  useClients,
  useInvoices,
  useVendors,
  useWorkOrders,
  useActiveCurrency,
  useData,
} from "@/lib/data/DataProvider";
import { formatCents } from "@/lib/format";
import {
  resolveDeliveryUrl,
  openExternalLink,
} from "@/lib/deliveryUrl";
import type { VendorItem, WorkOrderItem } from "@/types/outsourcing";
import type { Currency } from "@/types/billing";
import {
  buildContractorWhatsAppMessage,
  createWhatsAppPayloadFromWorkOrder,
} from "@/lib/whatsapp";
import "./outsourcing.css";

export type { VendorItem, WorkOrderItem };

export default function OutsourcingView() {
  const reporting = useReportingData();
  const searchParams = useSearchParams();
  const { clients, createClient } = useClients();
  const { invoices } = useInvoices();
  const { tasks, isElectron, settings, refresh } = useData();
  const { vendors, createVendor, updateVendor, setVendorStatus } = useVendors();
  const {
    workOrders,
    createWorkOrder,
    reviewWorkOrder,
    exportWorkOrderPdf,
    openWorkOrderPdf,
  } = useWorkOrders();
  const { activeCurrency } = useActiveCurrency();

  // Active view tab: Work Orders (payables) vs Reusable Vendor Directory
  const [activeTab, setActiveTab] = useState<"work-orders" | "vendors">(
    "work-orders",
  );

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchivedVendors, setShowArchivedVendors] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "PAID">(
    "ALL",
  );

  // Modal dialog states
  const [selectedWorkOrder, setSelectedWorkOrder] =
    useState<WorkOrderItem | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<VendorItem | null>(null);
  const [payableForm, setPayableForm] = useState<"new" | WorkOrderItem | null>(
    null,
  );
  const [editingVendor, setEditingVendor] = useState<VendorItem | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isWorkOrderModalOpen, setIsWorkOrderModalOpen] = useState(false);

  // Review Contractor Deliverable Dialog states
  const [reviewingWorkOrder, setReviewingWorkOrder] =
    useState<WorkOrderItem | null>(null);
  const [reviewStatus, setReviewStatus] = useState<
    "todo" | "in-progress" | "review" | "done"
  >("todo");
  const [reviewDeliveryUrl, setReviewDeliveryUrl] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewUpdateTask, setReviewUpdateTask] = useState(true);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Add Client Form States with explicit validation
  const [clientName, setClientName] = useState("");
  const clientCategory = "Enterprise";
  const [clientContactPerson, setClientContactPerson] = useState("");
  const clientContactRole = "";
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientCurrency, setClientCurrency] = useState<Currency>(
    activeCurrency || "USD",
  );
  const [clientDriveUrl, setClientDriveUrl] = useState("");
  const [clientFormErrors, setClientFormErrors] = useState<
    Record<string, string>
  >({});
  const [isSubmittingClient, setIsSubmittingClient] = useState(false);

  // Add Reusable Vendor Form States
  const [vendorName, setVendorName] = useState("");
  const [vendorService, setVendorService] = useState("");
  const [vendorIconType, setVendorIconType] =
    useState<VendorItem["iconType"]>("devops");
  const [vendorEmail, setVendorEmail] = useState("");
  const [vendorPhone, setVendorPhone] = useState("");
  const [vendorAddress, setVendorAddress] = useState("");
  const [vendorPhoto, setVendorPhoto] = useState<string | null>(null);
  const [vendorNotes, setVendorNotes] = useState("");
  const [vendorFormErrors, setVendorFormErrors] = useState<
    Record<string, string>
  >({});
  const [isSubmittingVendor, setIsSubmittingVendor] = useState(false);

  // New Work Order Form States
  const [woVendorId, setWoVendorId] = useState("");
  const [isCreatingNewVendorInline, setIsCreatingNewVendorInline] =
    useState(false);
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
  const [woCurrency, setWoCurrency] = useState<Currency>(
    activeCurrency || "LKR",
  );
  const [woDueDate, setWoDueDate] = useState("");
  const [woPayoutDue, setWoPayoutDue] = useState("");
  const [woDeliveryUrl, setWoDeliveryUrl] = useState("");
  const [woNotes, setWoNotes] = useState("");
  const [woFormErrors, setWoFormErrors] = useState<Record<string, string>>({});
  const [isSubmittingWorkOrder, setIsSubmittingWorkOrder] = useState(false);
  const [hasWorkOrderDraft, setHasWorkOrderDraft] = useState(false);

  const isWorkOrderFormDirty = () => {
    return Boolean(
      woScope.trim() ||
      woFee.trim() ||
      woNotes.trim() ||
      woDeliveryUrl.trim() ||
      newVendorInlineName.trim(),
    );
  };

  const saveWorkOrderDraft = async () => {
    if (!isWorkOrderFormDirty()) return;
    const draft = {
      woVendorId,
      isCreatingNewVendorInline,
      newVendorInlineName,
      newVendorInlineService,
      newVendorInlineCategory,
      newVendorInlineEmail,
      newVendorInlinePhone,
      woTaskId,
      woTaskTitle,
      woInvoiceId,
      woInvoiceCode,
      woClientId,
      woClientName,
      woScope,
      woFee,
      woCurrency,
      woDueDate,
      woPayoutDue,
      woDeliveryUrl,
      woNotes,
    };
    try {
      await workspaceDraft("billflow_draft_workorder", JSON.stringify(draft));
      setHasWorkOrderDraft(true);
    } catch {}
  };

  const clearWorkOrderDraft = async () => {
    try {
      await workspaceDraft("billflow_draft_workorder", null);
    } catch {}
    setHasWorkOrderDraft(false);
  };

  const handleRestoreWorkOrderDraft = async () => {
    try {
      const saved = await workspaceDraft("billflow_draft_workorder");
      if (!saved) return;
      const draft = JSON.parse(saved);
      if (draft.woVendorId !== undefined) setWoVendorId(draft.woVendorId);
      if (draft.isCreatingNewVendorInline !== undefined)
        setIsCreatingNewVendorInline(draft.isCreatingNewVendorInline);
      if (draft.newVendorInlineName !== undefined)
        setNewVendorInlineName(draft.newVendorInlineName);
      if (draft.newVendorInlineService !== undefined)
        setNewVendorInlineService(draft.newVendorInlineService);
      if (draft.newVendorInlineCategory !== undefined)
        setNewVendorInlineCategory(draft.newVendorInlineCategory);
      if (draft.newVendorInlineEmail !== undefined)
        setNewVendorInlineEmail(draft.newVendorInlineEmail);
      if (draft.newVendorInlinePhone !== undefined)
        setNewVendorInlinePhone(draft.newVendorInlinePhone);
      if (draft.woTaskId !== undefined) setWoTaskId(draft.woTaskId);
      if (draft.woTaskTitle !== undefined) setWoTaskTitle(draft.woTaskTitle);
      if (draft.woInvoiceId !== undefined) setWoInvoiceId(draft.woInvoiceId);
      if (draft.woInvoiceCode !== undefined)
        setWoInvoiceCode(draft.woInvoiceCode);
      if (draft.woClientId !== undefined) setWoClientId(draft.woClientId);
      if (draft.woClientName !== undefined) setWoClientName(draft.woClientName);
      if (draft.woScope !== undefined) setWoScope(draft.woScope);
      if (draft.woFee !== undefined) setWoFee(draft.woFee);
      if (draft.woCurrency !== undefined) setWoCurrency(draft.woCurrency);
      if (draft.woDueDate !== undefined) setWoDueDate(draft.woDueDate);
      if (draft.woPayoutDue !== undefined) setWoPayoutDue(draft.woPayoutDue);
      if (draft.woDeliveryUrl !== undefined)
        setWoDeliveryUrl(draft.woDeliveryUrl);
      if (draft.woNotes !== undefined) setWoNotes(draft.woNotes);
      showToast("Draft restored");
    } catch {}
  };

  const closeWorkOrderModal = (saveDraft = true) => {
    if (saveDraft) {
      saveWorkOrderDraft();
    }
    setIsWorkOrderModalOpen(false);
  };

  const openWorkOrderModal = async () => {
    try {
      const saved = await workspaceDraft("billflow_draft_workorder");
      setHasWorkOrderDraft(Boolean(saved));
    } catch {
      setHasWorkOrderDraft(false);
    }
    setIsWorkOrderModalOpen(true);
  };

  // Toast notification state
  const [toastNotification, setToastNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Show auto-dismissing toast feedback
  const showToast = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
    setToastNotification({ message, type });
    setTimeout(() => setToastNotification(null), 3500);
  };

  // Handle task redirection deep link / query params from Sprint Board (/tasks)
  const voucherQueryKey = searchParams.toString();
  const [previousVoucherQueryKey, setPreviousVoucherQueryKey] = useState<
    string | null
  >(null);
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
      const paramCurrency =
        (searchParams.get("currency") as Currency) || activeCurrency || "LKR";
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
        setWoFee(Number.isFinite(num) && num > 0 ? String(num) : "");
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
      } else if (vendors.some((vendor) => !vendor.archivedAt)) {
        setWoVendorId(vendors.find((vendor) => !vendor.archivedAt)!.id);
        setIsCreatingNewVendorInline(false);
      } else {
        setWoVendorId("__new__");
        setIsCreatingNewVendorInline(true);
      }

      // Resolve invoice code for display
      const inv = invoices.find((i) => i.id === paramInvoiceId);
      setWoInvoiceCode(inv?.code || "");

      setActiveTab("work-orders");
      setWoFormErrors({});
      setIsWorkOrderModalOpen(true);
    }
  }

  const openNewWorkOrder = () => {
    if (tasks.length > 0 && !woTaskId) {
      const firstTask = tasks[0];
      setWoTaskId(firstTask.id);
      setWoTaskTitle(firstTask.title);
      setWoScope(firstTask.title);
      setWoInvoiceId(firstTask.invoiceId || "");
      setWoInvoiceCode(
        invoices.find((invoice) => invoice.id === firstTask.invoiceId)?.code ||
          "",
      );
      setWoClientId(firstTask.clientId || "");
      setWoClientName(firstTask.clientName || "");
      setWoDeliveryUrl(firstTask.deliveryUrl || "");
      setWoCurrency(
        (firstTask.currency as Currency) || activeCurrency || "LKR",
      );
    }
    if (vendors.some((vendor) => !vendor.archivedAt) && !woVendorId) {
      setWoVendorId(vendors.find((vendor) => !vendor.archivedAt)!.id);
      setIsCreatingNewVendorInline(false);
    } else if (!vendors.some((vendor) => !vendor.archivedAt)) {
      setWoVendorId("__new__");
      setIsCreatingNewVendorInline(true);
    }
    setWoFormErrors({});
    openWorkOrderModal();
  };
  useWorkspaceCommand("create", (target) => {
    if (target === "vendor") {
      setVendorFormErrors({});
      setIsVendorModalOpen(true);
    } else {
      openNewWorkOrder();
    }
    return true;
  });
  useWorkspaceCommand("order", (id) => {
    const order = workOrders.find((record) => record.id === id);
    if (!order) return false;
    setActiveTab("work-orders");
    setSelectedVendor(null);
    setSelectedWorkOrder(order);
    return true;
  });
  useWorkspaceCommand("vendor", (id) => {
    const vendor = vendors.find((record) => record.id === id);
    if (!vendor) return false;
    setActiveTab("vendors");
    setSelectedWorkOrder(null);
    setSelectedVendor(vendor);
    return true;
  });

  const exportVendorStatement = async (id: string) => {
    setIsExportingPdf(true);
    try {
      const result = await window.billflow?.vendors.exportStatement(id);
      if (result?.success) showToast("Vendor statement saved.");
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Could not export the vendor statement.",
        "error",
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Toggle vendor settlement status in local SQLite database
  const handleToggleVendorStatus = async (id: string) => {
    try {
      const current = vendors.find((v) => v.id === id);
      if (!current) return;
      const nextStatus = current.status === "PENDING" ? "PAID" : "PENDING";
      await setVendorStatus(id, nextStatus);
      showToast("Vendor settlement status updated");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to update vendor status";
      showToast(msg, "error");
    }
  };

  // Open review deliverable modal
  const handleOpenReviewModal = (wo: WorkOrderItem) => {
    const resolved = resolveDeliveryUrl(wo, { tasks, invoices, clients });
    setReviewingWorkOrder(wo);
    setReviewStatus(wo.status || "todo");
    setReviewDeliveryUrl(wo.deliveryUrl || resolved.url || "");
    setReviewNotes(wo.notes || "");
    setReviewUpdateTask(Boolean(wo.taskId));
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

  // Export PDF Voucher
  const handleExportWorkOrderPdf = async (workOrderId: string) => {
    try {
      setIsExportingPdf(true);
      const res = await exportWorkOrderPdf(workOrderId);
      if (res?.filePath) {
        showToast("Work Order PDF Voucher generated successfully!");
        await openWorkOrderPdf(workOrderId, false);
      } else {
        if (typeof window !== "undefined") window.print();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to export PDF";
      showToast(msg, "error");
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Send Task to Contractor via WhatsApp
  const handleSendToWhatsApp = async (
    order: WorkOrderItem,
    target: WhatsAppTarget = "web",
  ) => {
    const payload = createWhatsAppPayloadFromWorkOrder(
      order,
      settings?.businessName,
    );
    try {
      await openMessageDraft(
        whatsAppDraft(
          order.vendorPhone,
          buildContractorWhatsAppMessage(payload),
          target,
        ),
      );
      showToast("WhatsApp draft opened.");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not open WhatsApp.",
        "error",
      );
    }
  };
  const handlePayableSms = async (order: WorkOrderItem) => {
    const message = `Hi ${order.vendorName || "there"}, here are the details for payable ${order.id.slice(-8).toUpperCase()}: ${order.scope}. Agreed fee ${formatCents(order.feeCents, order.currency)}. Remaining ${formatCents(remainingPayout(order), order.currency)}.`;
    try {
      await openMessageDraft(smsDraft(order.vendorPhone, message));
      showToast("SMS draft opened.");
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Could not open the SMS draft.",
        "error",
      );
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
      errors.email =
        "Email must contain an '@' sign (e.g. alex@fintechlabs.com)";
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
        billingAddress: vendorAddress.trim() || null,
        photoData: vendorPhoto,
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
      setVendorAddress("");
      setVendorPhoto(null);
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
          balanceCents: 0,
          currentBalance: 0,
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
        invoiceId: woInvoiceId || undefined,
        scope: woScope.trim(),
        feeCents: Math.round(numFee * 100),
        currency: woCurrency,
        dueDate: woDueDate.trim() || undefined,
        payoutDueDate: woPayoutDue || undefined,
        deliveryUrl: woDeliveryUrl.trim() || undefined,
        notes: woNotes.trim() || undefined,
        status: "todo",
      });

      clearWorkOrderDraft();
      closeWorkOrderModal(false);
      showToast("Work order created and linked to task.");

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
      setWoPayoutDue("");
      setWoDeliveryUrl("");
      setWoNotes("");
      setWoFormErrors({});
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to create work order";
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
      if (Boolean(v.archivedAt) !== showArchivedVendors) return false;
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
  }, [vendors, searchQuery, statusFilter, showArchivedVendors]);

  return (
    <div className="workspace-page motion-page outsourcing-page-container">
      {activeTab === "vendors" && (
        <button
          type="button"
          className="ui-button ui-button--secondary mb-3"
          onClick={() => setShowArchivedVendors(!showArchivedVendors)}
        >
          {showArchivedVendors
            ? "Show active vendors"
            : "Show archived vendors"}
        </button>
      )}
      {/* Toast Feedback Notification */}
      <MotionPresence>
        {toastNotification && (
          <MotionSurface
            kind="toast"
            className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-2.5 px-4 py-2.5 text-white rounded-xl shadow-xl text-[12px] font-medium ${
              toastNotification.type === "error"
                ? "bg-rose-900 border border-rose-700"
                : "bg-toast border border-line-neutral-700"
            }`}
          >
            {toastNotification.type === "error" ? (
              <AlertCircle className="text-content-rose-400 text-[14px] shrink-0" />
            ) : (
              <CheckCircle2 className="success-confirm-pulse rounded-full text-success-bright text-[14px] shrink-0" />
            )}
            <span>{toastNotification.message}</span>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Top Header */}
      <PageHeader
        title="Outsourcing"
        description="Your contractors, deliverables and payouts, connected to each client job."
      >
        <div className="outsourcing-header-actions">
          <Button
            variant="secondary"
            onClick={() => {
              setActiveTab("work-orders");
              setPayableForm("new");
            }}
          >
            <Plus className="w-3.5 h-3.5" /> New Payable
          </Button>
          {/* New Work Order button (Primary) */}
          <Button variant="primary" type="button" onClick={openNewWorkOrder}>
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

      {/* =====================================================================
          ZENTRA 3-CARD OUTSOURCING & PAYABLES BENTO HEADER ROW
         ===================================================================== */}
      <ReportingGuard>
        {(() => {
          const orders = reporting.workOrders;
          const committed = orders.reduce(
            (sum, order) => sum + order.feeCents,
            0,
          );
          const paid = orders.reduce(
            (sum, order) => sum + (order.payoutAmountCents ?? 0),
            0,
          );
          const pending = orders.reduce(
            (sum, order) => sum + remainingPayout(order),
            0,
          );
          const done = orders.filter((order) => order.status === "done").length;
          const money = (value: number) => formatCents(value, activeCurrency);
          return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <section className="ui-card p-6 space-y-5">
                <h2>Subcontractor Payables</h2>
                <div>
                  <div className="summary-value">{money(committed)}</div>
                  <p className="summary-caption">
                    Agreed fees across {orders.length} work orders ·{" "}
                    {activeCurrency}
                  </p>
                </div>
                <DataBreakdown
                  label="Contractor fee settlement"
                  total={committed}
                  rows={[
                    {
                      label: "Paid out",
                      value: paid,
                      display: money(paid),
                      tone: "green",
                    },
                    {
                      label: "Still payable",
                      value: pending,
                      display: money(pending),
                      tone: "pink",
                    },
                  ]}
                />
              </section>
              <section className="ui-card p-6 space-y-5">
                <h2>Contractor Delivery</h2>
                <div>
                  <div className="summary-value">
                    {done}/{orders.length}
                  </div>
                  <p className="summary-caption">
                    Completed work orders. Payouts are tracked separately.
                  </p>
                </div>
                <DataBreakdown
                  label="Work order delivery status"
                  total={orders.length}
                  rows={[
                    {
                      label: "In delivery or review",
                      value: orders.length - done,
                      display: `${orders.length - done} orders`,
                    },
                    {
                      label: "Complete",
                      value: done,
                      display: `${done} orders`,
                      tone: "green",
                    },
                  ]}
                />
              </section>
              <section className="ui-card p-6 space-y-5">
                <h2>Scheduled Contractor Fees</h2>
                <p className="summary-caption">
                  Agreed fees by contractor delivery due month
                </p>
                <MonthlyBars
                  label="Fees due · last six months"
                  formatValue={money}
                  points={recentMonths().map((month) => ({
                    ...month,
                    value: orders
                      .filter((order) => order.dueDate?.startsWith(month.key))
                      .reduce((sum, order) => sum + order.feeCents, 0),
                  }))}
                />
              </section>
            </div>
          );
        })()}
      </ReportingGuard>

      {/* Main Directory & Payables Card */}
      <div className="ui-card vendor-directory-card">
        {/* Section Header with Tab Switcher */}
        <div className="vendor-directory-header">
          <div className="space-y-1">
            {/* View Switcher Tabs */}
            <div className="inline-flex items-center gap-1 p-1 bg-surface-neutral-100 rounded-xl border border-line-neutral-200">
              {(
                [
                  {
                    id: "work-orders",
                    label: `Payable Work Orders (${workOrders.length})`,
                  },
                  {
                    id: "vendors",
                    label: `Vendor Directory (${vendors.length})`,
                  },
                ] as const
              ).map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    aria-pressed={isActive}
                    className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors active:scale-[0.97] ${
                      isActive
                        ? "text-content-neutral-900"
                        : "text-content-neutral-600 hover:text-content-neutral-900"
                    }`}
                  >
                    {isActive && (
                      <m.span
                        layoutId="outsourcing-main-tab-pill"
                        transition={SPRING_NAV_GLIDE}
                        className="absolute inset-0 rounded-lg bg-surface shadow-xs"
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="vendor-directory-subtitle">
              {activeTab === "work-orders"
                ? "Track contractor delivery and payments separately."
                : "Reusable profiles for independent contractors, development partners, and design agencies."}
            </p>
          </div>

          {/* Search and status filters */}
          <div className="vendor-controls-group">
            <div className="vendor-search-wrapper">
              <Search className="vendor-search-icon" />
              <input
                type="text"
                placeholder={
                  activeTab === "work-orders"
                    ? "Search work orders..."
                    : "Search vendors..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="vendor-search-input"
              />
            </div>

            <div className="vendor-status-filter">
              {(
                [
                  { id: "ALL", label: "All" },
                  { id: "PENDING", label: "Pending" },
                  { id: "PAID", label: "Paid" },
                ] as const
              ).map((item) => {
                const isActive = statusFilter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setStatusFilter(item.id)}
                    aria-pressed={isActive}
                    className={`vendor-filter-btn relative active:scale-[0.97] ${isActive ? "active !bg-transparent !shadow-none" : ""}`}
                  >
                    {isActive && (
                      <m.span
                        layoutId="outsourcing-status-pill"
                        transition={SPRING_NAV_GLIDE}
                        className="absolute inset-0 rounded-lg bg-surface dark:bg-[#252530] shadow-xs border border-line-neutral-200/80 dark:border-[#353545]"
                      />
                    )}
                    <span className="relative z-10">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="record-list-body">
          {activeTab === "work-orders" ? (
            /* TAB 1: WORK ORDERS */
            filteredWorkOrders.length === 0 ? (
              <EmptyState
                title={
                  workOrders.length === 0
                    ? "No payable work orders recorded"
                    : "No matching work orders found"
                }
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
                        openWorkOrderModal();
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create First Work Order</span>
                    </Button>
                  </div>
                )}
              </EmptyState>
            ) : (
              <div className="record-table-scroll">
                <table className="record-table work-order-table">
                  <caption className="sr-only">
                    Payable work orders, delivery progress and contractor
                    payments
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Work order</th>
                      <th scope="col">Delivery</th>
                      <th scope="col">Due date</th>
                      <th scope="col" className="record-align-right">
                        Contractor fee
                      </th>
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWorkOrders.map((wo) => {
                      const resolved = resolveDeliveryUrl(wo, {
                        tasks,
                        invoices,
                        clients,
                      });
                      return (
                        <tr key={wo.id}>
                          <td className="work-order-scope">
                            <div className="record-identity">
                              <div className="record-avatar">
                                {renderVendorIcon(wo.vendorIconType)}
                              </div>
                              <div className="min-w-0">
                                <p
                                  className="record-title"
                                  title={wo.notes || wo.scope}
                                >
                                  {wo.scope}
                                </p>
                                <p className="record-secondary">
                                  {wo.vendorName}
                                </p>
                                {(wo.invoiceCode || wo.clientName) && (
                                  <p className="record-meta">
                                    {[wo.invoiceCode, wo.clientName]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </p>
                                )}
                                {resolved.hasLink && (
                                  <button
                                    type="button"
                                    className="record-link"
                                    onClick={(e) =>
                                      openExternalLink(resolved.formattedUrl, e)
                                    }
                                    title={`${resolved.label}: ${resolved.url}`}
                                  >
                                    {resolved.label}
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span
                              className="record-status"
                              data-status={wo.status || "todo"}
                            >
                              <span
                                className="record-status-dot"
                                aria-hidden="true"
                              />
                              {wo.status === "in-progress"
                                ? "In progress"
                                : wo.status === "review"
                                  ? "In review"
                                  : wo.status === "done"
                                    ? "Completed"
                                    : "Assigned"}
                            </span>
                          </td>
                          <td className="record-date">
                            {wo.dueDate
                              ? new Date(
                                  `${wo.dueDate}T12:00:00`,
                                ).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "No due date"}
                          </td>
                          <td className="record-align-right">
                            <strong className="record-amount">
                              <ReportedMoney
                                cents={wo.feeCents}
                                currency={wo.currency}
                              />
                            </strong>
                            <button
                              type="button"
                              className="record-settlement"
                              data-paid={wo.payoutStatus === "PAID"}
                              onClick={() => setSelectedWorkOrder(wo)}
                              title="View contractor payments and receipts"
                            >
                              {wo.payoutStatus === "PAID"
                                ? "Paid in full"
                                : "Payment pending"}
                            </button>
                          </td>
                          <td>
                            <div className="record-actions">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleSendToWhatsApp(wo)}
                                title={`Send task to ${wo.vendorName || "contractor"} on WhatsApp`}
                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="secondary"
                                size="small"
                                onClick={() => handleOpenReviewModal(wo)}
                                title={`Review ${wo.scope}`}
                              >
                                Review
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedWorkOrder(wo)}
                                title={`View voucher for ${wo.scope}`}
                              >
                                <FileText className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : /* TAB 2: REUSABLE VENDOR DIRECTORY */
          filteredVendors.length === 0 ? (
            <EmptyState
              title={
                !vendors.some((vendor) => !vendor.archivedAt)
                  ? "No vendor profiles registered"
                  : "No matching vendors found"
              }
              description={
                !vendors.some((vendor) => !vendor.archivedAt)
                  ? "Add reusable profiles for contractors and agencies you collaborate with."
                  : "Try adjusting your search query or status filter."
              }
            >
              {!vendors.some((vendor) => !vendor.archivedAt) && (
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
              const linkedOrders = workOrders.filter(
                (w) => w.vendorId === vendor.id,
              );
              return (
                <div key={vendor.id} className="vendor-list-row">
                  <div className="vendor-info-group">
                    <div className="vendor-avatar-icon">
                      {vendor.photoData ? (
                        <Image
                          unoptimized
                          src={vendor.photoData}
                          alt=""
                          width={36}
                          height={36}
                          className="size-full rounded-[inherit] object-cover"
                        />
                      ) : (
                        renderVendorIcon(vendor.iconType)
                      )}
                    </div>
                    <div>
                      <div className="vendor-name-row">
                        <h3 className="vendor-name-heading">{vendor.name}</h3>
                        <span className="record-count">
                          {linkedOrders.length}{" "}
                          {linkedOrders.length === 1
                            ? "work order"
                            : "work orders"}
                        </span>
                      </div>
                      <p className="vendor-service-desc">{vendor.service}</p>
                      <div className="text-[11px] text-content-neutral-400 mt-1 flex items-center gap-3">
                        {vendor.email && <span>Email: {vendor.email}</span>}
                        {vendor.phone && <span>Phone: {vendor.phone}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="vendor-actions-group">
                    <button
                      type="button"
                      className="ui-button ui-button--secondary"
                      onClick={async () => {
                        try {
                          await window.billflow?.workspace?.archive?.(
                            "vendors",
                            vendor.id,
                            !vendor.archivedAt,
                          );
                          await refresh();
                        } catch (failure) {
                          showToast(
                            failure instanceof Error
                              ? failure.message
                              : "Could not update vendor.",
                            "error",
                          );
                        }
                      }}
                    >
                      {vendor.archivedAt ? "Restore" : "Archive"}
                    </button>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => {
                        setWoVendorId(vendor.id);
                        setIsCreatingNewVendorInline(false);
                        setWoFormErrors({});
                        openWorkOrderModal();
                      }}
                    >
                      <Plus className="w-3 h-3" />
                      <span>Work Order</span>
                    </Button>

                    <button
                      type="button"
                      onClick={() => handleToggleVendorStatus(vendor.id)}
                      title="Click to toggle status"
                      className="record-status"
                      data-status={vendor.status.toLowerCase()}
                    >
                      <span className="record-status-dot" aria-hidden="true" />
                      <span>
                        {vendor.status === "PAID" ? "Paid" : "Pending"}
                      </span>
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
          )}
        </div>
      </div>

      <MotionPresence>
        {payableForm && (
          <PayableForm
            order={payableForm === "new" ? undefined : payableForm}
            onClose={() => setPayableForm(null)}
            onSave={(order) => {
              setPayableForm(null);
              setSelectedWorkOrder(order);
              showToast("Payable saved.");
            }}
          />
        )}
      </MotionPresence>
      <MotionPresence>
        {editingVendor && (
          <Dialog width={520} onClose={() => setEditingVendor(null)}>
            <form
              className="app-dialog-form"
              onSubmit={async (event) => {
                event.preventDefault();
                try {
                  const vendor = await updateVendor(editingVendor.id, {
                    phone: editingVendor.phone || null,
                    billingAddress: editingVendor.billingAddress || null,
                    photoData: editingVendor.photoData ?? null,
                  });
                  setSelectedVendor(vendor);
                  setEditingVendor(null);
                  showToast("Vendor details saved.");
                } catch (error) {
                  showToast(
                    error instanceof Error
                      ? error.message
                      : "Could not update the vendor.",
                    "error",
                  );
                }
              }}
            >
              <div className="app-dialog-header">
                <h3>Edit vendor contact</h3>
              </div>
              <div className="app-dialog-body">
                <div className="app-dialog-section space-y-3 p-5">
                  <PhoneField
                    label="Vendor phone"
                    value={editingVendor.phone || ""}
                    onChange={(phone) =>
                      setEditingVendor({ ...editingVendor, phone })
                    }
                  />
                  <label className="block space-y-1 text-xs">
                    <span>Billing address</span>
                    <textarea
                      className="ui-field w-full"
                      rows={3}
                      maxLength={1000}
                      value={editingVendor.billingAddress || ""}
                      onChange={(event) =>
                        setEditingVendor({
                          ...editingVendor,
                          billingAddress: event.target.value,
                        })
                      }
                    />
                  </label>
                  <ImageUpload
                    label="Vendor photo"
                    value={editingVendor.photoData}
                    onChange={(photoData) =>
                      setEditingVendor({ ...editingVendor, photoData })
                    }
                  />
                </div>
              </div>
              <div className="app-dialog-footer">
                <Button
                  variant="secondary"
                  onClick={() => setEditingVendor(null)}
                >
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Save vendor
                </Button>
              </div>
            </form>
          </Dialog>
        )}
      </MotionPresence>

      {/* Payable or vendor details */}
      <MotionPresence>
        {!payableForm &&
          !editingVendor &&
          (selectedWorkOrder || selectedVendor) && (
            <Dialog
              width={690}
              onClose={() => {
                setSelectedWorkOrder(null);
                setSelectedVendor(null);
              }}
            >
              <div className="app-dialog-header">
                <div className="flex items-center gap-2">
                  <GitFork className="w-4 h-4 text-accent" />
                  <h3 className="outsourcing-modal-title">
                    {selectedWorkOrder
                      ? selectedWorkOrder.taskId
                        ? "Payable Work Order Voucher"
                        : "Vendor Payable"
                      : "Vendor Statement Voucher"}
                  </h3>
                </div>
              </div>
              <div className="app-dialog-body">
                <div className="app-dialog-section outsourcing-modal-body space-y-4 p-6 text-xs">
                  {selectedWorkOrder &&
                    (() => {
                      const order = selectedWorkOrder;
                      const delivery = resolveDeliveryUrl(order, {
                        tasks,
                        invoices,
                        clients,
                      });
                      const workStatus = {
                        todo: "Assigned",
                        "in-progress": "In progress",
                        review: "Under review",
                        done: "Completed",
                      }[order.status];
                      return (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-mono text-content-neutral-500">
                                VND-INV-{order.id.slice(-8).toUpperCase()}
                              </p>
                              <p className="text-base font-semibold text-content-neutral-950">
                                {order.scope}
                              </p>
                              <p className="mt-1 text-content-neutral-600">
                                {order.vendorName}
                              </p>
                            </div>
                            <span
                              className="record-status"
                              data-status={(
                                order.payoutStatus || "PENDING"
                              ).toLowerCase()}
                            >
                              <span
                                className="record-status-dot"
                                aria-hidden="true"
                              />
                              {order.payoutStatus === "PAID"
                                ? "Paid"
                                : "Pending"}
                            </span>
                          </div>

                          {(order.invoiceId ||
                            order.dueDate ||
                            delivery.hasLink) && (
                            <dl className="space-y-2 rounded-xl border border-line-neutral-200 bg-surface-neutral-50 p-3">
                              {order.invoiceId && (
                                <div className="flex justify-between gap-2">
                                  <dt>Parent client invoice</dt>
                                  <dd>
                                    {order.invoiceCode} · {order.clientName}
                                  </dd>
                                </div>
                              )}
                              {order.taskId && (
                                <div className="flex justify-between gap-2">
                                  <dt>Linked deliverable</dt>
                                  <dd>{order.taskTitle}</dd>
                                </div>
                              )}
                              {order.dueDate && (
                                <div className="flex justify-between gap-2">
                                  <dt>Agreed delivery date</dt>
                                  <dd>{order.dueDate}</dd>
                                </div>
                              )}
                              {delivery.hasLink && (
                                <div className="flex justify-between gap-2">
                                  <dt>{delivery.label}</dt>
                                  <dd>
                                    <button
                                      type="button"
                                      className="text-accent underline"
                                      onClick={(event) =>
                                        openExternalLink(
                                          delivery.formattedUrl,
                                          event,
                                        )
                                      }
                                    >
                                      Open URL
                                    </button>
                                  </dd>
                                </div>
                              )}
                            </dl>
                          )}

                          <div className="space-y-2 rounded-xl border border-line-neutral-200 bg-surface-neutral-50 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span>Work status</span>
                              <span
                                className="record-status"
                                data-status={order.status}
                              >
                                <span
                                  className="record-status-dot"
                                  aria-hidden="true"
                                />
                                {workStatus}
                              </span>
                            </div>
                            {order.completedAt && (
                              <p>Completed {order.completedAt.slice(0, 10)}</p>
                            )}
                            {order.notes && (
                              <p className="whitespace-pre-wrap">
                                {order.notes}
                              </p>
                            )}
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={() => {
                                setSelectedWorkOrder(null);
                                handleOpenReviewModal(order);
                              }}
                            >
                              <FileCheck className="w-3.5 h-3.5" />
                              {order.taskId
                                ? "Review & sync deliverable"
                                : "Update work status"}
                            </Button>
                          </div>

                          {order.items?.length ? (
                            <div className="space-y-2 rounded-xl border border-line-neutral-200 p-3">
                              <table className="w-full text-left text-xs">
                                <caption className="mb-2 text-left font-semibold">
                                  Payable items
                                </caption>
                                <thead>
                                  <tr>
                                    <th scope="col">Item</th>
                                    <th scope="col" className="text-right">
                                      Quantity
                                    </th>
                                    <th scope="col" className="text-right">
                                      Unit price
                                    </th>
                                    <th scope="col" className="text-right">
                                      Total
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {order.items.map((item, index) => (
                                    <tr
                                      key={index}
                                      className="border-t border-line-neutral-200"
                                    >
                                      <td className="py-2">
                                        {item.description}
                                      </td>
                                      <td className="text-right">
                                        {item.quantity}
                                      </td>
                                      <td className="text-right tabular-nums">
                                        {formatCents(
                                          item.unitPriceCents,
                                          order.currency,
                                        )}
                                      </td>
                                      <td className="text-right tabular-nums">
                                        {formatCents(
                                          item.unitPriceCents * item.quantity,
                                          order.currency,
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {Boolean(order.discountCents) && (
                                <p className="text-right">
                                  Discount{" "}
                                  {formatCents(
                                    order.discountCents ?? 0,
                                    order.currency,
                                  )}
                                </p>
                              )}
                            </div>
                          ) : null}
                          <div className="flex items-center justify-between rounded-xl border border-line-purple-200 bg-surface-purple-50/50 p-3">
                            <span className="font-medium text-content-purple-900">
                              Agreed fee
                            </span>
                            <span className="font-mono font-semibold text-content-purple-900">
                              {formatCents(order.feeCents, order.currency)}
                            </span>
                          </div>
                          {order.vendorBillingAddress && (
                            <p className="whitespace-pre-line">
                              <strong>Billing address</strong>
                              <br />
                              {order.vendorBillingAddress}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={() => setPayableForm(order)}
                            >
                              Edit payable
                            </Button>
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(
                                    formatWorkOrderPaymentSummary(
                                      order,
                                      settings,
                                    ),
                                  );
                                  showToast("Copied work order summary");
                                } catch {
                                  showToast("Could not copy summary", "error");
                                }
                              }}
                            >
                              <Copy className="w-3.5 h-3.5" />
                              Copy summary
                            </Button>
                            {order.paypalUrl && (
                              <Button
                                variant="secondary"
                                size="small"
                                onClick={() =>
                                  openExternalLink(order.paypalUrl)
                                }
                              >
                                Open PayPal
                              </Button>
                            )}
                            {order.stripeUrl && (
                              <Button
                                variant="secondary"
                                size="small"
                                onClick={() =>
                                  openExternalLink(order.stripeUrl)
                                }
                              >
                                Open Stripe
                              </Button>
                            )}
                          </div>
                          <PayoutLedger
                            key={order.id}
                            order={order}
                            onChange={setSelectedWorkOrder}
                          />
                        </>
                      );
                    })()}

                  {selectedVendor &&
                    (() => {
                      const vendor = selectedVendor;
                      const orders = workOrders.filter(
                        (order) => order.vendorId === vendor.id,
                      );
                      const balances = new Map<string, number>();
                      for (const order of orders)
                        balances.set(
                          order.currency,
                          (balances.get(order.currency) ?? 0) +
                            remainingPayout(order),
                        );
                      return (
                        <>
                          <div className="flex items-center gap-3">
                            {vendor.photoData && (
                              <Image
                                unoptimized
                                src={vendor.photoData}
                                alt=""
                                width={44}
                                height={44}
                                className="size-11 rounded-lg object-cover"
                              />
                            )}
                            <div>
                              <p className="text-base font-semibold text-content-neutral-950">
                                {vendor.name}
                              </p>
                              <p className="text-content-neutral-600">
                                {vendor.service}
                              </p>
                              {vendor.email && (
                                <p className="text-content-neutral-600">
                                  {vendor.email}
                                </p>
                              )}
                            </div>
                          </div>
                          {vendor.billingAddress && (
                            <p className="whitespace-pre-line">
                              <strong>Billing address</strong>
                              <br />
                              {vendor.billingAddress}
                            </p>
                          )}
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => setEditingVendor(vendor)}
                          >
                            Edit vendor contact
                          </Button>
                          <div className="space-y-2 rounded-xl border border-line-neutral-200 bg-surface-neutral-50 p-3">
                            <h4 className="font-semibold">
                              Outstanding payouts by currency
                            </h4>
                            {[...balances]
                              .sort(([a], [b]) => a.localeCompare(b))
                              .map(([currency, balance]) => (
                                <div
                                  key={currency}
                                  className="flex justify-between tabular-nums"
                                >
                                  <span>{currency}</span>
                                  <span>{formatCents(balance, currency)}</span>
                                </div>
                              ))}
                            {!orders.length && <p>No work orders.</p>}
                          </div>
                        </>
                      );
                    })()}
                </div>
              </div>
              <div className="app-dialog-footer flex-wrap">
                {selectedWorkOrder && (
                  <>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() =>
                        void handleSendToWhatsApp(selectedWorkOrder, "desktop")
                      }
                    >
                      WhatsApp Desktop
                    </Button>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() =>
                        void handleSendToWhatsApp(selectedWorkOrder, "web")
                      }
                    >
                      WhatsApp Web
                    </Button>
                    <Button
                      variant="secondary"
                      size="small"
                      disabled={!selectedWorkOrder.vendorPhone}
                      onClick={() => void handlePayableSms(selectedWorkOrder)}
                    >
                      SMS draft
                    </Button>
                    <Button
                      variant="secondary"
                      size="small"
                      disabled={isExportingPdf}
                      onClick={() =>
                        void handleExportWorkOrderPdf(selectedWorkOrder.id)
                      }
                    >
                      Download PDF Voucher
                    </Button>
                  </>
                )}
                {selectedVendor && isElectron && (
                  <Button
                    variant="secondary"
                    size="small"
                    disabled={isExportingPdf}
                    onClick={() =>
                      void exportVendorStatement(selectedVendor.id)
                    }
                  >
                    Export Statement PDF
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => window.print()}
                >
                  Print
                </Button>
                <Button
                  variant="primary"
                  size="small"
                  onClick={() => {
                    setSelectedWorkOrder(null);
                    setSelectedVendor(null);
                  }}
                >
                  Close
                </Button>
              </div>
            </Dialog>
          )}
      </MotionPresence>

      {/* Modal Dialog: Review Contractor Deliverable & Sync to Task */}
      <MotionPresence>
        {reviewingWorkOrder && (
          <ReviewDeliverableModal
            workOrder={reviewingWorkOrder}
            reviewStatus={reviewStatus}
            setReviewStatus={setReviewStatus}
            reviewDeliveryUrl={reviewDeliveryUrl}
            setReviewDeliveryUrl={setReviewDeliveryUrl}
            reviewNotes={reviewNotes}
            setReviewNotes={setReviewNotes}
            reviewUpdateTask={reviewUpdateTask}
            setReviewUpdateTask={setReviewUpdateTask}
            isSubmittingReview={isSubmittingReview}
            onSubmit={handleSaveReview}
            onClose={() => setReviewingWorkOrder(null)}
          />
        )}
      </MotionPresence>

      {/* Modal Dialog: New Work Order (Prefilled from saved IDs or manually configured) */}
      <MotionPresence>
        {isWorkOrderModalOpen && (
          <Dialog onClose={() => closeWorkOrderModal()} width={620}>
            <div className="app-dialog-header">
              <div className="flex items-center gap-2">
                <GitFork className="w-4 h-4 text-accent" />
                <h3 className="outsourcing-modal-title">New work order</h3>
              </div>
              <div className="flex items-center gap-2">
                {hasWorkOrderDraft && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="small"
                    onClick={handleRestoreWorkOrderDraft}
                    className="text-xs gap-1.5 font-medium border-accent/40 text-accent hover:bg-accent/10"
                    title="Restore previously typed work order draft"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </Button>
                )}
              </div>
            </div>
            <form onSubmit={handleCreateWorkOrder} className="app-dialog-form">
              <div className="app-dialog-body">
                {/* Linked Task & Invoice Banner if prefilled */}
                {woTaskId && (
                  <div className="p-3 rounded-xl bg-surface-purple-50/50 border border-line-purple-200 flex items-start gap-2.5">
                    <GitFork className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    <div className="text-xs space-y-0.5">
                      <div className="font-semibold text-content-neutral-900">
                        Linked Task: {woTaskTitle || "Sprint Deliverable"}
                      </div>
                      <div className="text-content-neutral-600">
                        Invoice:{" "}
                        <span className="font-mono font-medium">
                          {woInvoiceCode || woInvoiceId}
                        </span>
                        {woClientName && <span> · Client: {woClientName}</span>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Subcontractor / Vendor Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[12px] font-semibold text-text-secondary">
                      Assigned Subcontractor{" "}
                      <span className="text-content-rose-500 font-bold">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setIsCreatingNewVendorInline(!isCreatingNewVendorInline)
                      }
                      className="text-[11px] text-accent hover:underline font-semibold"
                    >
                      {isCreatingNewVendorInline
                        ? "Select Existing Vendor"
                        : "+ Add New Vendor"}
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
                      {vendors
                        .filter((v) => !v.archivedAt)
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} ({v.service})
                          </option>
                        ))}
                      <option value="__new__">
                        + Register New Subcontractor...
                      </option>
                    </select>
                  ) : (
                    <m.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        transition: SPRING_MENU_POPOVER,
                      }}
                      className="p-3.5 rounded-xl bg-surface-neutral-50 border border-line-neutral-200 space-y-3"
                    >
                      <div>
                        <label className="block text-[11px] font-semibold text-content-neutral-700 mb-1">
                          Contractor / Agency Name{" "}
                          <span className="text-content-rose-500 font-bold">
                            *
                          </span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Alex WebCraft Labs"
                          value={newVendorInlineName}
                          onChange={(e) =>
                            setNewVendorInlineName(e.target.value)
                          }
                          className="ui-field w-full text-xs px-3 py-1.5 rounded-lg border border-line-neutral-300"
                        />
                        {woFormErrors.newVendorName && (
                          <p className="text-content-rose-600 text-[10.5px] mt-0.5">
                            {woFormErrors.newVendorName}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-content-neutral-700 mb-1">
                            Primary Specialty{" "}
                            <span className="text-content-rose-500 font-bold">
                              *
                            </span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Frontend Development"
                            value={newVendorInlineService}
                            onChange={(e) =>
                              setNewVendorInlineService(e.target.value)
                            }
                            className="ui-field w-full text-xs px-3 py-1.5 rounded-lg border border-line-neutral-300"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-content-neutral-700 mb-1">
                            Category
                          </label>
                          <select
                            value={newVendorInlineCategory}
                            onChange={(e) =>
                              setNewVendorInlineCategory(
                                e.target.value as VendorItem["iconType"],
                              )
                            }
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
                          <label className="block text-[11px] font-medium text-content-neutral-600 mb-1">
                            Email
                          </label>
                          <input
                            type="email"
                            placeholder="alex@webcraft.io"
                            value={newVendorInlineEmail}
                            onChange={(e) =>
                              setNewVendorInlineEmail(e.target.value)
                            }
                            className="ui-field w-full text-xs px-3 py-1.5 rounded-lg border border-line-neutral-300"
                          />
                        </div>
                        <PhoneField
                          label="Vendor phone"
                          value={newVendorInlinePhone}
                          onChange={setNewVendorInlinePhone}
                        />
                      </div>
                    </m.div>
                  )}
                  {woFormErrors.vendor && (
                    <p className="text-content-rose-600 text-[11px] mt-1 font-medium">
                      {woFormErrors.vendor}
                    </p>
                  )}
                </div>

                {woFormErrors.task && (
                  <p role="alert" className="text-content-rose-600 text-sm">
                    {woFormErrors.task}
                  </p>
                )}
                {woTaskId && !woInvoiceId && (
                  <p className="text-sm text-text-secondary">
                    This task has not been invoiced. Contractor costs will be
                    tracked now and linked when you invoice the completed task.
                  </p>
                )}
                {/* If opened manually, allow selecting Task */}
                {!searchParams.get("taskId") && tasks.length > 0 && (
                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                      Sprint Deliverable Task{" "}
                      <span className="text-content-rose-500 font-bold">*</span>
                    </label>
                    <select
                      value={woTaskId}
                      onChange={(e) => {
                        const t = tasks.find(
                          (item) => item.id === e.target.value,
                        );
                        if (t) {
                          setWoTaskId(t.id);
                          setWoTaskTitle(t.title);
                          setWoScope(t.title);
                          setWoInvoiceId(t.invoiceId || "");
                          setWoClientId(t.clientId || "");
                          setWoClientName(t.clientName || "");
                          setWoDeliveryUrl(t.deliveryUrl || "");
                          setWoCurrency(
                            (t.currency as Currency) || activeCurrency || "LKR",
                          );
                          const inv = invoices.find(
                            (i) => i.id === t.invoiceId,
                          );
                          setWoInvoiceCode(inv?.code || "");
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
                    Deliverable Scope & Task Description{" "}
                    <span className="text-content-rose-500 font-bold">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={woScope}
                    onChange={(e) => setWoScope(e.target.value)}
                    placeholder="e.g. Build responsive homepage and services showcase"
                    className="ui-field w-full text-[13px] p-3 border border-border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-focus"
                  />
                  {woFormErrors.scope && (
                    <p className="text-content-rose-600 text-[11px] mt-1">
                      {woFormErrors.scope}
                    </p>
                  )}
                </div>

                {/* Agreed Fee & Explicit Currency */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                      Agreed Contractor Fee{" "}
                      <span className="text-content-rose-500 font-bold">*</span>
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
                      <p className="text-content-rose-600 text-[11px] mt-1">
                        {woFormErrors.fee}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                      Payable Currency{" "}
                      <span className="text-content-rose-500 font-bold">*</span>
                    </label>
                    <select
                      value={woCurrency}
                      onChange={(e) =>
                        setWoCurrency(e.target.value as Currency)
                      }
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
                    <label
                      htmlFor="wo-due-date"
                      className="block text-[12px] font-semibold text-text-secondary mb-1"
                    >
                      Milestone Due Date
                    </label>
                    <input
                      id="wo-due-date"
                      type="date"
                      value={
                        /^\d{4}-\d{2}-\d{2}/.test(woDueDate)
                          ? woDueDate.slice(0, 10)
                          : ""
                      }
                      onChange={(e) => setWoDueDate(e.target.value)}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        if (e.clientX === 0 || e.clientX < rect.right - 28) {
                          try {
                            e.currentTarget.showPicker?.();
                          } catch {}
                        }
                      }}
                      className="ui-field w-full text-[12.5px] px-3 py-2 border border-border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-focus cursor-pointer"
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

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-text-secondary">
                    Scheduled payout date
                  </span>
                  <input
                    type="date"
                    className="ui-field w-full"
                    value={woPayoutDue}
                    onChange={(event) => setWoPayoutDue(event.target.value)}
                  />
                </label>

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
              </div>
              <div className="app-dialog-footer">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => closeWorkOrderModal()}
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
          </Dialog>
        )}
      </MotionPresence>

      {/* Modal Dialog: Add Reusable Vendor Profile */}
      <MotionPresence>
        {isVendorModalOpen && (
          <Dialog onClose={() => setIsVendorModalOpen(false)} width={620}>
            <div className="app-dialog-header">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-accent" />
                <h3 className="outsourcing-modal-title">
                  Add Reusable Vendor Profile
                </h3>
              </div>
            </div>
            <form onSubmit={handleAddVendor} className="app-dialog-form">
              <div className="app-dialog-body">
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                    Vendor / Contractor Name{" "}
                    <span className="text-content-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PixelCraft Studio"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    className="ui-field w-full text-[13px] px-3.5 py-2.5 rounded-xl border border-border-muted focus:outline-none focus:ring-2 focus:ring-focus"
                  />
                  {vendorFormErrors.name && (
                    <p className="text-content-rose-600 text-[11px] mt-1">
                      {vendorFormErrors.name}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                      Primary Service / Specialty{" "}
                      <span className="text-content-rose-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. UI/UX Design & Branding"
                      value={vendorService}
                      onChange={(e) => setVendorService(e.target.value)}
                      className="ui-field w-full text-[12.5px] px-3 py-2 border border-border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-focus"
                    />
                    {vendorFormErrors.service && (
                      <p className="text-content-rose-600 text-[11px] mt-1">
                        {vendorFormErrors.service}
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

                  <PhoneField
                    label="Vendor phone"
                    value={vendorPhone}
                    onChange={setVendorPhone}
                  />
                  <label className="block space-y-1 text-xs">
                    <span>Billing address</span>
                    <textarea
                      className="ui-field w-full"
                      rows={2}
                      maxLength={1000}
                      value={vendorAddress}
                      onChange={(event) => setVendorAddress(event.target.value)}
                    />
                  </label>
                  <ImageUpload
                    label="Vendor photo"
                    value={vendorPhoto}
                    onChange={setVendorPhoto}
                  />
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
              </div>
              <div className="app-dialog-footer">
                <Button
                  variant="secondary"
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
          </Dialog>
        )}
      </MotionPresence>

      {/* Modal Dialog: Add Client */}
      <MotionPresence>
        {isClientModalOpen && (
          <Dialog onClose={() => setIsClientModalOpen(false)} width={620}>
            <div className="app-dialog-header">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-accent" />
                <h3 className="outsourcing-modal-title">Add Client Profile</h3>
              </div>
            </div>
            <form onSubmit={handleAddClient} className="app-dialog-form">
              <div className="app-dialog-body">
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                    Client Organization Name{" "}
                    <span className="text-content-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Global Solutions"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="ui-field w-full text-[13px] px-3.5 py-2.5 rounded-xl border border-border-muted focus:outline-none focus:ring-2 focus:ring-focus"
                  />
                  {clientFormErrors.name && (
                    <p className="text-content-rose-600 text-[11px] mt-1">
                      {clientFormErrors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                    Email Address{" "}
                    <span className="text-content-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="alex@fintechlabs.com"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="ui-field w-full text-[13px] px-3.5 py-2.5 rounded-xl border border-border-muted focus:outline-none focus:ring-2 focus:ring-focus"
                  />
                  {clientFormErrors.email && (
                    <p className="text-content-rose-600 text-[11px] mt-1">
                      {clientFormErrors.email}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                      Billing Currency
                    </label>
                    <select
                      value={clientCurrency}
                      onChange={(e) =>
                        setClientCurrency(e.target.value as Currency)
                      }
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
              </div>
              <div className="app-dialog-footer">
                <Button
                  variant="secondary"
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
                  {isSubmittingClient ? "Saving..." : "Save Client"}
                </Button>
              </div>
            </form>
          </Dialog>
        )}
      </MotionPresence>
    </div>
  );
}
