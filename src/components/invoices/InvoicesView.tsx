"use client";
import { WorkspaceActivityPanel } from "@/components/ui/WorkspaceActivityPanel";
import { workspaceDraft } from "@/lib/workspace-drafts";
import {
  useReportingData,
  ReportingGuard,
  ReportedMoney,
} from "@/context/ReportingContext";

import { PhoneField } from "@/components/ui/PhoneField";
import {
  InvoiceStatusBulk,
  InvoiceWorkflowSelect,
  workflowStages,
} from "./InvoiceStatusBulk";

import { InvoiceTrash } from "./InvoiceTrash";
import { buildSampleInvoice } from "./sample-invoice";
import { ImportCompletedTasksModal } from "./ImportCompletedTasksModal";
import { PaymentInspectionModal } from "./PaymentInspectionModal";
import { useWorkspaceCommand } from "@/lib/use-workspace-command";
import { Dialog } from "@/components/ui/Dialog";

import { DataBreakdown, MonthlyBars } from "@/components/ui/DataGraphic";
import { recentMonths, isPastDue, localDateKey } from "@/lib/visual-metrics";
import { buildDuplicateInvoiceDraft } from "@/lib/invoice-duplicate";

import {
  Button,
  PageHeader,
  SegmentedControl,
  EmptyState,
} from "@/components/ui/Workspace";

import {
  MotionPresence,
  MotionSurface,
} from "@/components/ui/MotionSurface";
import { AnimatePresence, m } from "motion/react";
import {
  SPRING_MENU_POPOVER,
  EXIT_MENU_POPOVER,
  POPOVER_INITIAL_SCALE,
  listRowTransition,
} from "@/lib/motion";
import React, { useState, useEffect, useRef } from "react";
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
  FileText,
  ExternalLink,
  CreditCard,
  FolderOpen,
  Paperclip,
  UserPlus,
  Search,
  ChevronDown,
  RotateCcw,
  Upload,
  Eye,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  ListChecks,
  Copy,
  TrendingUp,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useAiCapture } from "@/context/AiCaptureContext";
import { preprocessScreenshotForOcr } from "@/lib/image-preprocess";
import type { AiPaymentSlipScanResult } from "@/types/ai";
import dynamic from "next/dynamic";
import { formatInvoicePaymentSummary } from "@/lib/payment-summary";

const OverdueSummaryDialog = dynamic(
  () =>
    import("./OverdueSummaryDialog").then((m) => m.OverdueSummaryDialog),
  { ssr: false, loading: () => null },
);
import {
  generateInvoicesCsv,
  generateInvoicesExcelWorkbook,
  generateOverdueSummaryCsv,
  generateOverdueExcelWorkbook,
  downloadCsvFile,
  downloadExcelFile,
  type ExportFileFormat,
} from "@/lib/csv-export";
import {
  useInvoices,
  useClients,
  useCatalog,
  useSettings,
  useData,
} from "@/lib/data/DataProvider";
import {
  formatCents,
  formatDateDisplay,
  parseAmountToCents,
} from "@/lib/format";
import { resolveDeliveryUrl, openExternalLink } from "@/lib/deliveryUrl";
import type {
  InvoiceWithClient,
  InvoiceStatus,
  InvoiceWorkflowStage,
  Currency,
} from "@/types/billing";
import type { AttachmentItem } from "@/types/workflow";
import type { TaskItem } from "@/types/tasks";

import "./invoices.css";

const InvoiceDocumentSheet = dynamic(
  () => import("./InvoiceDocumentSheet"),
  { ssr: false, loading: () => null },
);
const QuotesTab = dynamic(
  () => import("./QuotesTab").then((m) => m.QuotesTab),
  { ssr: false, loading: () => null },
);
const RecurringRulesTab = dynamic(
  () => import("./RecurringRulesTab").then((m) => m.RecurringRulesTab),
  { ssr: false, loading: () => null },
);
const ProjectMarginDrawer = dynamic(
  () =>
    import("@/components/analytics/ProjectMarginDrawer").then(
      (m) => m.ProjectMarginDrawer,
    ),
  { ssr: false, loading: () => null },
);

const ACCENT_ICON_CLASS = "text-accent-deep-solid dark:text-accent";

type FilterTab =
  "All Invoices" | "Advance Paid" | "Drafts" | "Overdue" | "Paid";

interface LineItemDraft {
  id: string;
  catalogId?: string;
  sourceTaskId?: string;
  description: string;
  quantity: number;
  unitPrice: string;
}

interface FloatingActionMenuState {
  invoice: InvoiceWithClient;
  top?: number;
  bottom?: number;
  right: number;
}

interface FloatingStatusMenuState {
  invoice: InvoiceWithClient;
  top?: number;
  bottom?: number;
  left: number;
}

export default function InvoicesView() {
  const reporting = useReportingData();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    openDrawer: openSmartCapture,
    pendingInvoiceDraft,
    consumePendingInvoiceDraft,
  } = useAiCapture();

  const {
    invoices: allInvoices,
    createInvoice,
    updateInvoice,
    promoteClient,
    setInvoiceStatus,
    recordPayment,
    openInvoicePdf,
    deleteInvoice,
    getNextInvoiceCode,
    refresh,
  } = useInvoices();

  const { clients } = useClients();
  const { catalogItems } = useCatalog();
  const { settings } = useSettings();
  const {
    tasks,
    workflow,
    activeCurrency,
    getUnbilledCompletedTasks,
    isElectron,
  } = useData();

  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [clientWhatsApp, setClientWhatsApp] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientCategory, setClientCategory] = useState("Enterprise");
  const [saveAsPermanentClient, setSaveAsPermanentClient] = useState(true);
  const requestId = useRef<string | null>(null);

  const [activeTab, setActiveTab] = useState<FilterTab>("All Invoices");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatusIds, setBulkStatusIds] = useState<string[]>([]);
  const [actionMenu, setActionMenu] = useState<FloatingActionMenuState | null>(
    null,
  );
  const [statusMenu, setStatusMenu] = useState<FloatingStatusMenuState | null>(
    null,
  );
  const [expiredInvoiceHighlight, setExpiredInvoiceHighlight] = useState<
    string | null
  >(null);

  // Document Design Preview Sheet Modal
  const [previewInvoice, setPreviewInvoice] =
    useState<InvoiceWithClient | null>(null);
  const [marginDrawerInvoice, setMarginDrawerInvoice] =
    useState<InvoiceWithClient | null>(null);

  const requestedViewParam = searchParams.get("view");
  const resolvedViewMode =
    requestedViewParam === "quotes"
      ? "quotes"
      : requestedViewParam === "recurring"
        ? "recurring"
        : "invoices";
  const [viewMode, setViewMode] = useState<
    "invoices" | "quotes" | "recurring"
  >(resolvedViewMode);
  const [prevRequestedViewParam, setPrevRequestedViewParam] =
    useState(requestedViewParam);
  if (prevRequestedViewParam !== requestedViewParam) {
    setPrevRequestedViewParam(requestedViewParam);
    setViewMode(resolvedViewMode);
  }

  const getSampleInvoice = (): InvoiceWithClient =>
    buildSampleInvoice(settings);

  // Add Invoice Modal state
  const [showAddInvoiceModal, setShowAddInvoiceModal] =
    useState<boolean>(false);
  const [newCode, setNewCode] = useState("");
  const [newClientId, setNewClientId] = useState("");
  const [newCurrency, setNewCurrency] = useState<Currency>(
    settings?.defaultCurrency || activeCurrency || "USD",
  );
  const [newDueDate, setNewDueDate] = useState("");
  const [newStatus, setNewStatus] = useState<InvoiceStatus>("UNPAID");
  const [newLineItems, setNewLineItems] = useState<LineItemDraft[]>([
    { id: "1", description: "", quantity: 1, unitPrice: "" },
  ]);
  const [newDiscount, setNewDiscount] = useState("");
  const [newTaxRate, setNewTaxRate] = useState("");
  const [requireAdvance, setRequireAdvance] = useState(true);
  const [advancePercent, setAdvancePercent] = useState(50);
  const [newDeliveryUrl, setNewDeliveryUrl] = useState("");
  const [newPaymentUrl, setNewPaymentUrl] = useState("");
  const [newWorkflowStage, setNewWorkflowStage] =
    useState<InvoiceWorkflowStage | null>(null);
  const [newNotes, setNewNotes] = useState("");
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);
  const [hasInvoiceDraft, setHasInvoiceDraft] = useState(false);
  const [linkedTaskIds, setLinkedTaskIds] = useState<string[]>([]);

  // Import Completed Tasks Dialog state
  const [showImportTasksModal, setShowImportTasksModal] = useState(false);
  const [importTasksShowAllClients, setImportTasksShowAllClients] =
    useState(false);
  const [selectedImportTaskIds, setSelectedImportTaskIds] = useState<string[]>(
    [],
  );
  const [importTaskFees, setImportTaskFees] = useState<Record<string, string>>(
    {},
  );
  const [importTaskQuantities, setImportTaskQuantities] = useState<
    Record<string, number>
  >({});

  // Edit Invoice Modal state
  const [editingInvoice, setEditingInvoice] =
    useState<InvoiceWithClient | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editClientId, setEditClientId] = useState("");
  const [editCurrency, setEditCurrency] = useState<Currency>("LKR");
  const [editDueDate, setEditDueDate] = useState("");
  const [editStatus, setEditStatus] = useState<InvoiceStatus>("UNPAID");
  const [editDeliveryUrl, setEditDeliveryUrl] = useState("");
  const [editPaymentUrl, setEditPaymentUrl] = useState("");
  const [editWorkflowStage, setEditWorkflowStage] =
    useState<InvoiceWorkflowStage | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editLineItems, setEditLineItems] = useState<LineItemDraft[]>([]);
  const [editDiscount, setEditDiscount] = useState("");
  const [editTaxRate, setEditTaxRate] = useState("");
  const [editRequireAdvance, setEditRequireAdvance] = useState(true);
  const [editAdvancePercent, setEditAdvancePercent] = useState(50);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Delete Confirm Modal state
  const [trashTargets, setTrashTargets] = useState<string[]>([]);
  const [showTrash, setShowTrash] = useState(false);
  const [movingToTrash, setMovingToTrash] = useState(false);
  const [exportingBatch, setExportingBatch] = useState(false);

  // Record Payment Modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentInvoice, setPaymentInvoice] =
    useState<InvoiceWithClient | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [selectedSlip, setSelectedSlip] = useState<{
    path: string;
    name: string;
    size: number;
  } | null>(null);
  const [isDraggingSlip, setIsDraggingSlip] = useState(false);
  const slipFileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isScanningSlip, setIsScanningSlip] = useState(false);
  const [slipScanResult, setSlipScanResult] =
    useState<AiPaymentSlipScanResult | null>(null);
  const [slipScanError, setSlipScanError] = useState<string | null>(null);

  // Payment Inspection Modal state
  const [inspectingInvoice, setInspectingInvoice] =
    useState<InvoiceWithClient | null>(null);
  const [paymentAttachments, setPaymentAttachments] = useState<
    Record<string, AttachmentItem[]>
  >({});
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);

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
    setTimeout(() => setNotification(null), 3800);
  };

  // URL search parameters
  const clientFilterParam = searchParams.get("client");
  const isNewParam = searchParams.get("new");
  const actionParam = searchParams.get("action");
  const importTaskIdsParam = searchParams.get("importTaskIds");
  const previewParam = searchParams.get("preview");
  const invoiceHighlightParam = searchParams.get("invoice");

  const [previousHighlightParam, setPreviousHighlightParam] = useState(
    invoiceHighlightParam,
  );
  if (previousHighlightParam !== invoiceHighlightParam) {
    setPreviousHighlightParam(invoiceHighlightParam);
    setExpiredInvoiceHighlight(null);
  }
  const highlightedInvoiceId =
    expiredInvoiceHighlight === invoiceHighlightParam
      ? null
      : invoiceHighlightParam;
  useEffect(() => {
    if (!invoiceHighlightParam) return;
    const timer = setTimeout(
      () => setExpiredInvoiceHighlight(invoiceHighlightParam),
      2500,
    );
    return () => clearTimeout(timer);
  }, [invoiceHighlightParam]);

  // Overdue Summary Modal & Unified Export Dialog state
  const [showOverdueSummary, setShowOverdueSummary] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  // Check URL search parameters for overdue summary view
  const viewParam = searchParams.get("view");
  const summaryParam = searchParams.get("summary");
  const overdueQueryKey = `${viewParam ?? ""}:${summaryParam ?? ""}`;
  const [prevOverdueQueryKey, setPrevOverdueQueryKey] = useState<string | null>(
    null,
  );
  if (prevOverdueQueryKey !== overdueQueryKey) {
    setPrevOverdueQueryKey(overdueQueryKey);
    if (viewParam === "overdue-summary" || summaryParam === "overdue") {
      setShowOverdueSummary(true);
    }
  }

  // Export Invoices CSV / Excel handler using Convert Engine
  const handleExportInvoicesCsv = (
    type: "current" | "selected" | "overdue" | "all",
    formatOverride: ExportFileFormat = "csv",
  ) => {
    const isExcel = formatOverride === "excel";
    try {
      const todayStr = localDateKey();
      if (type === "selected") {
        const selected = allInvoices.filter((inv) =>
          selectedIds.includes(inv.id),
        );
        if (selected.length === 0) {
          showToast("No invoices selected for export", "error");
          return;
        }
        if (isExcel) {
          const xls = generateInvoicesExcelWorkbook(selected, {
            includeSummaryRow: true,
            sheetName: "Selected Invoices",
          });
          downloadExcelFile(`invoices-selected-${todayStr}.xls`, xls);
          showToast(
            `Converted & exported ${selected.length} selected invoices to Excel (.xls).`,
          );
        } else {
          const csv = generateInvoicesCsv(selected, {
            includeSummaryRow: true,
          });
          downloadCsvFile(`invoices-selected-${todayStr}.csv`, csv);
          showToast(
            `Exported ${selected.length} selected invoices to CSV (.csv).`,
          );
        }
      } else if (type === "overdue") {
        if (isExcel) {
          if (!reporting.ready) {
            showToast(
              "Load exchange rates before exporting a converted summary.",
              "error",
            );
            return;
          }
          const xls = generateOverdueExcelWorkbook(reporting.invoices, {
            includeClientRollup: true,
          });
          downloadExcelFile(`overdue-invoices-summary-${todayStr}.xls`, xls);
          showToast(
            "Converted & exported Overdue Aging Workbook to Excel (.xls).",
          );
        } else {
          const csv = generateOverdueSummaryCsv(allInvoices);
          downloadCsvFile(`overdue-invoices-summary-${todayStr}.csv`, csv);
          showToast("Exported overdue invoices summary to CSV (.csv).");
        }
      } else if (type === "all") {
        if (isExcel) {
          const xls = generateInvoicesExcelWorkbook(allInvoices, {
            includeSummaryRow: true,
            sheetName: "All Invoices",
          });
          downloadExcelFile(`invoices-all-${todayStr}.xls`, xls);
          showToast(
            `Converted & exported all ${allInvoices.length} invoices to Excel (.xls).`,
          );
        } else {
          const csv = generateInvoicesCsv(allInvoices, {
            includeSummaryRow: true,
          });
          downloadCsvFile(`invoices-all-${todayStr}.csv`, csv);
          showToast(
            `Exported all ${allInvoices.length} invoices to CSV (.csv).`,
          );
        }
      } else {
        if (isExcel) {
          const xls = generateInvoicesExcelWorkbook(filteredInvoices, {
            includeSummaryRow: true,
            sheetName: "Filtered Invoices",
          });
          downloadExcelFile(`invoices-filtered-${todayStr}.xls`, xls);
          showToast(
            `Converted & exported ${filteredInvoices.length} invoices to Excel (.xls).`,
          );
        } else {
          const csv = generateInvoicesCsv(filteredInvoices, {
            includeSummaryRow: true,
          });
          downloadCsvFile(`invoices-filtered-${todayStr}.csv`, csv);
          showToast(
            `Exported ${filteredInvoices.length} invoices to CSV (.csv).`,
          );
        }
      }
    } catch {
      showToast(
        `Failed to generate ${isExcel ? "Excel" : "CSV"} export file`,
        "error",
      );
    }
  };

  const isNewActive =
    isNewParam === "1" ||
    isNewParam === "true" ||
    actionParam === "new" ||
    Boolean(importTaskIdsParam);
  const modalQueryKey = JSON.stringify([
    isNewActive,
    searchParams.get("t"),
    clientFilterParam,
    importTaskIdsParam,
  ]);
  const handledNewQueryRef = useRef<string | null>(null);

  // Handle ?invoice=ID&preview=1 to automatically open the InvoiceDocumentSheet preview
  const previewTargetInv =
    invoiceHighlightParam && previewParam === "1"
      ? allInvoices.find((inv) => inv.id === invoiceHighlightParam)
      : undefined;
  const previewQueryKey = previewTargetInv
    ? `${invoiceHighlightParam}:${previewParam}`
    : null;
  const [prevPreviewQueryKey, setPrevPreviewQueryKey] = useState<string | null>(
    null,
  );
  if (
    previewQueryKey &&
    prevPreviewQueryKey !== previewQueryKey &&
    previewTargetInv
  ) {
    setPrevPreviewQueryKey(previewQueryKey);
    setPreviewInvoice(previewTargetInv);
  }

  useWorkspaceCommand("trash", () => {
    if (!isElectron) return false;
    setShowTrash(true);
    return true;
  });
  useWorkspaceCommand("record", (id) => {
    const invoice = allInvoices.find((item) => item.id === id);
    if (!invoice) return false;
    setPreviewInvoice(invoice);
    return true;
  });

  // Helper to resolve default fee for an imported task
  const getTaskDefaultFee = React.useCallback(
    (task: TaskItem): string => {
      if (task.outsourceBudget && task.outsourceBudget > 0) {
        return String(task.outsourceBudget);
      }
      if (task.outsourceBudgetCents && task.outsourceBudgetCents > 0) {
        return (task.outsourceBudgetCents / 100).toFixed(2);
      }
      const matchingCatalog = catalogItems.find(
        (ci) =>
          ci.title.toLowerCase() === task.title.toLowerCase() ||
          ci.category?.toLowerCase() === task.category.toLowerCase(),
      );
      if (matchingCatalog && matchingCatalog.price) {
        const converted = reporting.convert(
          matchingCatalog.priceCents,
          matchingCatalog.currency,
          task.currency,
        );
        return converted === null ? "0.00" : (converted / 100).toFixed(2);
      }
      return "0.00";
    },
    [catalogItems, reporting],
  );

  // Auto-populate New Invoice modal when redirected with ?action=new&importTaskIds=id1,id2...
  const importedFromQueryRef = useRef<string | null>(null);
  useEffect(() => {
    if (!importTaskIdsParam) {
      importedFromQueryRef.current = null;
      return;
    }
    if (tasks.length === 0) return;
    if (importedFromQueryRef.current === importTaskIdsParam) return;

    const requestedIds = importTaskIdsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (requestedIds.length === 0) return;

    const matchedTasks = tasks.filter(
      (t) =>
        requestedIds.includes(t.id) &&
        t.status === "done" &&
        (!t.invoiceId || t.invoiceId.trim() === ""),
    );
    if (matchedTasks.length === 0) return;

    importedFromQueryRef.current = importTaskIdsParam;

    const due = new Date();
    due.setDate(due.getDate() + (settings?.defaultDueDays ?? 14));
    const defaultDueStr = localDateKey(due);

    // Pre-populate client from first task with a clientId or clientName
    const taskWithClient = matchedTasks.find((t) => t.clientId || t.clientName);
    const matchedClient = taskWithClient
      ? clients.find(
          (c) =>
            (taskWithClient.clientId && c.id === taskWithClient.clientId) ||
            (taskWithClient.clientName &&
              c.name.toLowerCase() === taskWithClient.clientName.toLowerCase()),
        )
      : undefined;

    // Pre-populate delivery URL from task if available
    const taskWithDelivery = matchedTasks.find((t) => t.deliveryUrl);

    // Build line items from matched tasks
    const generatedItems: LineItemDraft[] = matchedTasks.map((t) => {
      const completedSubtaskTitles = t.subtasks
        .filter((st) => st.completed)
        .map((st) => st.title.trim())
        .filter(Boolean);
      const detailsSuffix =
        completedSubtaskTitles.length > 0
          ? ` (${completedSubtaskTitles.join(", ")})`
          : "";
      return {
        id: `task-item-${t.id}`,
        sourceTaskId: t.id,
        description: `${t.title}${detailsSuffix}`.slice(0, 300),
        quantity: 1,
        unitPrice: getTaskDefaultFee(t),
      };
    });

    queueMicrotask(() => {
      setNewStatus("UNPAID");
      setNewPaymentUrl("");
      setNewWorkflowStage(null);
      setNewDiscount("");
      setNewTaxRate("");
      setNewDueDate((prev) => prev || defaultDueStr);
      if (matchedClient) {
        setClientMode("existing");
        setNewClientId(matchedClient.id);
        setNewCurrency(taskWithClient?.currency || matchedClient.currency);
        if (matchedClient.driveUrl) {
          setNewDeliveryUrl(matchedClient.driveUrl);
        }
      } else if (taskWithClient?.clientName) {
        setClientMode("new");
        setClientName(taskWithClient.clientName);
      }
      if (taskWithDelivery?.deliveryUrl) {
        setNewDeliveryUrl((prev) => prev || taskWithDelivery.deliveryUrl || "");
      }
      setNewLineItems(generatedItems);
      setLinkedTaskIds(matchedTasks.map((t) => t.id));
      setShowAddInvoiceModal(true);
    });

    void getNextInvoiceCode()
      .then((code) => setNewCode((prev) => prev || code))
      .catch(() =>
        setNewCode((prev) => prev || `INV-${new Date().getFullYear()}-001`),
      );
  }, [
    importTaskIdsParam,
    tasks,
    clients,
    settings?.defaultDueDays,
    getNextInvoiceCode,
    getTaskDefaultFee,
  ]);

  const isInvoiceFormDirty = () => {
    const hasItems = newLineItems.some(
      (it) => it.description.trim() || it.unitPrice.trim(),
    );
    const hasClient =
      clientMode === "new"
        ? Boolean(clientName.trim() || clientEmail.trim())
        : false;
    const hasNotes = Boolean(
      newNotes.trim() ||
      newDiscount.trim() ||
      newDeliveryUrl.trim() ||
      newPaymentUrl.trim() ||
      newWorkflowStage,
    );
    return hasItems || hasClient || hasNotes;
  };

  const saveInvoiceDraft = async () => {
    if (!isInvoiceFormDirty()) return;
    const draft = {
      clientMode,
      newClientId,
      clientName,
      clientEmail,
      clientContact,
      clientWhatsApp,
      clientPhone,
      clientCategory,
      newCurrency,
      newDueDate,
      newLineItems,
      newDiscount,
      newTaxRate,
      requireAdvance,
      advancePercent,
      saveAsPermanentClient,
      newDeliveryUrl,
      newPaymentUrl,
      newWorkflowStage,
      newNotes,
    };
    try {
      await workspaceDraft("billflow_draft_invoice", JSON.stringify(draft));
      setHasInvoiceDraft(true);
    } catch {}
  };

  const clearInvoiceDraft = async () => {
    try {
      await workspaceDraft("billflow_draft_invoice", null);
    } catch {}
    setHasInvoiceDraft(false);
  };

  const handleRestoreInvoiceDraft = async () => {
    try {
      const saved = await workspaceDraft("billflow_draft_invoice");
      if (!saved) return;
      const draft = JSON.parse(saved);
      if (draft.clientMode !== undefined) setClientMode(draft.clientMode);
      if (draft.newClientId !== undefined) setNewClientId(draft.newClientId);
      if (draft.clientName !== undefined) setClientName(draft.clientName);
      if (draft.clientEmail !== undefined) setClientEmail(draft.clientEmail);
      if (draft.clientPhone !== undefined) setClientPhone(draft.clientPhone);
      if (draft.clientWhatsApp !== undefined)
        setClientWhatsApp(draft.clientWhatsApp);
      if (draft.clientContact !== undefined)
        setClientContact(draft.clientContact);
      if (draft.clientCategory !== undefined)
        setClientCategory(draft.clientCategory);
      if (draft.newCurrency !== undefined) setNewCurrency(draft.newCurrency);
      if (draft.newDueDate !== undefined) setNewDueDate(draft.newDueDate);
      if (Array.isArray(draft.newLineItems) && draft.newLineItems.length > 0) {
        setNewLineItems(draft.newLineItems);
      }
      if (draft.newDiscount !== undefined) setNewDiscount(draft.newDiscount);
      if (draft.newTaxRate !== undefined) setNewTaxRate(draft.newTaxRate);
      if (draft.requireAdvance !== undefined)
        setRequireAdvance(draft.requireAdvance);
      if (draft.advancePercent !== undefined)
        setAdvancePercent(draft.advancePercent);
      if (draft.saveAsPermanentClient !== undefined)
        setSaveAsPermanentClient(draft.saveAsPermanentClient);
      if (draft.newPaymentUrl !== undefined)
        setNewPaymentUrl(draft.newPaymentUrl);
      if (draft.newWorkflowStage !== undefined)
        setNewWorkflowStage(draft.newWorkflowStage);
      if (draft.newDeliveryUrl !== undefined)
        setNewDeliveryUrl(draft.newDeliveryUrl);
      if (draft.newNotes !== undefined) setNewNotes(draft.newNotes);
      showToast("Draft restored");
    } catch {}
  };

  const closeAddInvoiceModal = (saveDraft = true) => {
    if (saveDraft) {
      saveInvoiceDraft();
    }
    setNewStatus("UNPAID");
    setShowAddInvoiceModal(false);
    setShowImportTasksModal(false);
    if (
      typeof window !== "undefined" &&
      (window.location.search.includes("new=") ||
        window.location.search.includes("action=new") ||
        window.location.search.includes("importTaskIds="))
    ) {
      const url = new URL(window.location.href);
      url.searchParams.delete("new");
      url.searchParams.delete("action");
      url.searchParams.delete("importTaskIds");
      url.searchParams.delete("t");
      window.history.replaceState(
        null,
        "",
        url.pathname + (url.search ? url.search : ""),
      );
    }
  };

  // Load attachments when inspecting payments
  useEffect(() => {
    if (!inspectingInvoice || !workflow) return;
    let active = true;
    const fetchAttachments = async () => {
      setIsLoadingAttachments(true);
      const map: Record<string, AttachmentItem[]> = {};
      const payments = inspectingInvoice.payments || [];
      for (const p of payments) {
        try {
          const list = await workflow.attachments.list({
            type: "payment",
            id: p.id,
          });
          if (active) map[p.id] = list;
        } catch {
          // ignore error
        }
      }
      if (active) {
        setPaymentAttachments(map);
        setIsLoadingAttachments(false);
      }
    };
    void fetchAttachments();
    return () => {
      active = false;
    };
  }, [inspectingInvoice, workflow]);

  // When opening Add Invoice modal, prefill the next code
  const handleOpenAddModal = async () => {
    requestId.current = null;
    const activeClients = clients.filter((record) => !record.archivedAt);
    setClientMode(clientFilterParam || activeClients.length ? "existing" : "new");
    setClientName("");
    setClientEmail("");
    setClientContact("");
    setClientPhone("");
    setClientWhatsApp("");
    setClientCategory("Enterprise");
    setNewStatus("UNPAID");
    setNewCurrency(settings?.defaultCurrency || activeCurrency || "USD");
    const due = new Date();
    due.setDate(due.getDate() + (settings?.defaultDueDays ?? 14));
    setNewDueDate(localDateKey(due));
    setNewLineItems([{ id: "1", description: "", quantity: 1, unitPrice: "" }]);
    setLinkedTaskIds([]);
    setNewDiscount("");
    setNewTaxRate("");
    setRequireAdvance(true);
    setAdvancePercent(50);
    setSaveAsPermanentClient(true);
    setNewDeliveryUrl("");
    setNewPaymentUrl("");
    setNewWorkflowStage(null);
    setNewNotes("");

    try {
      const code = await getNextInvoiceCode();
      setNewCode(code);
    } catch {
      setNewCode(`INV-${new Date().getFullYear()}-001`);
    }

    if (clientFilterParam) {
      setClientMode("existing");
      setNewClientId(clientFilterParam);
      const match = clients.find((c) => c.id === clientFilterParam);
      if (match) {
        setNewCurrency(match.currency);
        if (match.driveUrl) setNewDeliveryUrl(match.driveUrl);
      }
    } else {
      const currentClient = activeClients.find((record) => record.id === newClientId);
      const targetClient = currentClient ?? activeClients[0];
      if (targetClient) {
        setNewClientId(targetClient.id);
        setNewCurrency(targetClient.currency);
        if (targetClient.driveUrl) setNewDeliveryUrl(targetClient.driveUrl);
      } else {
        setNewClientId("");
      }
    }

    try {
      const saved = await workspaceDraft("billflow_draft_invoice");
      setHasInvoiceDraft(Boolean(saved));
    } catch {
      setHasInvoiceDraft(false);
    }

    setShowAddInvoiceModal(true);
  };

  const handleOpenAddModalRef = useRef(handleOpenAddModal);
  useEffect(() => {
    handleOpenAddModalRef.current = handleOpenAddModal;
  });

  useEffect(() => {
    if (!isNewActive) {
      handledNewQueryRef.current = null;
      return;
    }
    if (importTaskIdsParam) return;
    if (handledNewQueryRef.current === modalQueryKey) return;
    handledNewQueryRef.current = modalQueryKey;
    queueMicrotask(() => {
      void handleOpenAddModalRef.current();
    });
  }, [isNewActive, importTaskIdsParam, modalQueryKey]);

  // Auto-populate and open the default New Invoice modal when handed off from Smart Capture
  useEffect(() => {
    if (!pendingInvoiceDraft) return;
    const draft = consumePendingInvoiceDraft();
    if (!draft) return;

    requestId.current = null;
    const activeClients = clients.filter((record) => !record.archivedAt);
    const matchedClient = draft.matchedClientId
      ? activeClients.find((c) => c.id === draft.matchedClientId)
      : undefined;

    const due = new Date();
    due.setDate(due.getDate() + (settings?.defaultDueDays ?? 14));
    const fallbackDueDate = localDateKey(due);

    const mappedItems: LineItemDraft[] =
      draft.items.length > 0
        ? draft.items.map((item, idx) => ({
            id: `ai-${Date.now()}-${idx}`,
            ...(item.catalogId ? { catalogId: item.catalogId } : {}),
            description: item.description,
            quantity: Math.max(1, item.quantity || 1),
            unitPrice: item.unitPrice ?? "",
          }))
        : [{ id: "1", description: "", quantity: 1, unitPrice: "" }];

    queueMicrotask(() => {
      setNewStatus("UNPAID");
      setLinkedTaskIds([]);
      setNewDiscount("");
      setNewTaxRate("");
      setRequireAdvance(true);
      setAdvancePercent(50);
      setNewPaymentUrl("");
      setNewWorkflowStage(null);
      setHasInvoiceDraft(false);

      if (matchedClient) {
        setClientMode("existing");
        setNewClientId(matchedClient.id);
        setClientName("");
        setClientEmail("");
        setClientContact("");
        setClientPhone("");
        setClientWhatsApp("");
        setNewCurrency(
          draft.currency || matchedClient.currency || settings?.defaultCurrency || activeCurrency || "USD",
        );
        setNewDeliveryUrl(draft.deliveryUrl || matchedClient.driveUrl || "");
      } else if (draft.suggestedClient) {
        setClientMode("new");
        setNewClientId("");
        setClientName(draft.suggestedClient.name || "");
        setClientEmail(draft.suggestedClient.email || "");
        setClientContact(draft.suggestedClient.contactPerson || "");
        setClientPhone(draft.suggestedClient.phone || "");
        setClientWhatsApp(draft.suggestedClient.whatsappPhone || "");
        setClientCategory("Enterprise");
        setSaveAsPermanentClient(true);
        setNewCurrency(
          draft.currency || settings?.defaultCurrency || activeCurrency || "USD",
        );
        setNewDeliveryUrl(draft.deliveryUrl || "");
      } else {
        setClientMode(activeClients.length ? "existing" : "new");
        setNewClientId(activeClients[0]?.id ?? "");
        setClientName("");
        setClientEmail("");
        setClientContact("");
        setClientPhone("");
        setClientWhatsApp("");
        setNewCurrency(
          draft.currency ||
            activeClients[0]?.currency ||
            settings?.defaultCurrency ||
            activeCurrency ||
            "USD",
        );
        setNewDeliveryUrl(
          draft.deliveryUrl || activeClients[0]?.driveUrl || "",
        );
      }

      setNewDueDate(draft.dueDate || fallbackDueDate);
      setNewLineItems(mappedItems);
      setNewNotes(draft.notes || "");
      setShowAddInvoiceModal(true);
      showToast(
        `Auto-filled ${draft.items.length || 1} deliverable${draft.items.length === 1 ? "" : "s"} from Smart Capture. Review pricing and save.`,
      );
    });

    void getNextInvoiceCode()
      .then((code) => setNewCode(code))
      .catch(() => setNewCode(`INV-${new Date().getFullYear()}-001`));
  }, [
    pendingInvoiceDraft,
    consumePendingInvoiceDraft,
    clients,
    settings?.defaultDueDays,
    settings?.defaultCurrency,
    activeCurrency,
    getNextInvoiceCode,
  ]);

  const handleDuplicateInvoice = async (inv: InvoiceWithClient) => {
    requestId.current = null;
    const draft = buildDuplicateInvoiceDraft(
      inv,
      clients,
      settings?.defaultDueDays ?? 14,
    );
    setClientMode(draft.clientMode);
    setNewClientId(draft.clientId);
    setClientName(draft.clientName);
    setClientEmail(draft.clientEmail);
    setClientContact(draft.clientContact);
    setClientPhone(draft.clientPhone);
    setClientWhatsApp(draft.clientWhatsApp);
    setClientCategory(draft.clientCategory);
    setSaveAsPermanentClient(draft.saveAsPermanentClient);
    setNewCurrency(draft.currency);
    setNewDueDate(draft.dueDate);
    setNewStatus(draft.status);
    setNewLineItems(draft.items);
    setLinkedTaskIds([]);
    setNewDiscount(draft.discount);
    setNewTaxRate(draft.taxRate);
    setRequireAdvance(draft.requireAdvance);
    setAdvancePercent(draft.advancePercent);
    setNewDeliveryUrl(draft.deliveryUrl);
    setNewPaymentUrl(draft.paymentUrl);
    setNewWorkflowStage(null);
    setNewNotes(draft.notes);
    setHasInvoiceDraft(false);

    try {
      const code = await getNextInvoiceCode();
      setNewCode(code);
    } catch {
      setNewCode(`INV-${new Date().getFullYear()}-001`);
    }
    setShowAddInvoiceModal(true);
  };

  const handleCopyInvoiceSummary = async (inv: InvoiceWithClient) => {
    try {
      const text = formatInvoicePaymentSummary(inv, settings);
      await navigator.clipboard.writeText(text);
      showToast(`Copied payment summary for ${inv.code}`);
    } catch {
      showToast("Could not copy payment summary", "error");
    }
  };

  // Filter invoices according to selected client, search query and tabs
  const [invoicePage, setInvoicePage] = useState(1);
  const filteredInvoices = allInvoices.filter((inv) => {
    if (clientFilterParam && inv.clientId !== clientFilterParam) {
      return false;
    }
    if (activeTab === "Advance Paid" && inv.status !== "ADVANCE_PAID")
      return false;
    if (activeTab === "Drafts" && inv.status !== "DRAFT") return false;
    if (activeTab === "Overdue" && !isPastDue(inv)) return false;
    if (activeTab === "Paid" && inv.status !== "PAID") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const codeMatch = inv.code.toLowerCase().includes(q);
      const clientMatch = inv.clientName.toLowerCase().includes(q);
      const titleMatch = inv.title?.toLowerCase().includes(q);
      const itemsMatch = inv.items?.some((it) =>
        it.description.toLowerCase().includes(q),
      );
      if (!codeMatch && !clientMatch && !titleMatch && !itemsMatch) {
        return false;
      }
    }

    return true;
  });

  const invoicePageCount = Math.max(1, Math.ceil(filteredInvoices.length / 50));
  const visibleInvoicePage = Math.min(invoicePage, invoicePageCount);
  const visibleInvoices = filteredInvoices.slice(
    (visibleInvoicePage - 1) * 50,
    visibleInvoicePage * 50,
  );

  const activeClientFilterObj = clientFilterParam
    ? clients.find((c) => c.id === clientFilterParam)
    : null;

  // Compute live totals for metric cards
  const primaryCurrency =
    activeCurrency ||
    settings?.defaultCurrency ||
    clients[0]?.currency ||
    "USD";

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

  // Dismiss floating menus on scroll, resize, or Escape
  useEffect(() => {
    const handleCloseMenus = () => {
      setActionMenu(null);
      setStatusMenu(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActionMenu(null);
        setStatusMenu(null);
      }
    };
    window.addEventListener("scroll", handleCloseMenus, true);
    window.addEventListener("resize", handleCloseMenus);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("scroll", handleCloseMenus, true);
      window.removeEventListener("resize", handleCloseMenus);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleToggleActionMenu = (
    e: React.MouseEvent<HTMLButtonElement>,
    inv: InvoiceWithClient,
  ) => {
    e.stopPropagation();
    if (actionMenu?.invoice.id === inv.id) {
      setActionMenu(null);
      return;
    }
    setStatusMenu(null);
    const rect = e.currentTarget.getBoundingClientRect();
    const estimatedHeight =
      415 +
      (isElectron ? 44 : 0) +
      (inv.payments && inv.payments.length > 0 ? 32 : 0) +
      (!inv.clientId ? 32 : 0);
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    if (openUpward) {
      setActionMenu({
        invoice: inv,
        bottom: Math.max(8, window.innerHeight - rect.top + 6),
        right: Math.max(8, window.innerWidth - rect.right),
      });
    } else {
      const maxTop = Math.max(
        8,
        window.innerHeight - Math.min(estimatedHeight, window.innerHeight * 0.85) - 8,
      );
      setActionMenu({
        invoice: inv,
        top: Math.max(8, Math.min(rect.bottom + 6, maxTop)),
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
  };

  const handleToggleStatusMenu = (
    e: React.MouseEvent<HTMLButtonElement>,
    inv: InvoiceWithClient,
  ) => {
    e.stopPropagation();
    if (statusMenu?.invoice.id === inv.id) {
      setStatusMenu(null);
      return;
    }
    setActionMenu(null);
    const rect = e.currentTarget.getBoundingClientRect();
    const estimatedHeight = 240;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward =
      spaceBelow < estimatedHeight && rect.top > estimatedHeight;

    if (openUpward) {
      setStatusMenu({
        invoice: inv,
        bottom: Math.max(8, window.innerHeight - rect.top + 6),
        left: Math.max(8, rect.left),
      });
    } else {
      setStatusMenu({
        invoice: inv,
        top: Math.max(8, rect.bottom + 6),
        left: Math.max(8, rect.left),
      });
    }
  };

  // Quick Change Status
  const handleChangeStatus = async (id: string, nextStatus: InvoiceStatus) => {
    try {
      const inv = allInvoices.find((i) => i.id === id);
      if (!inv) return;

      if (nextStatus === "PAID") {
        setStatusMenu(null);
        setActionMenu(null);
        const needed = inv.amountCents - (inv.paidCents || 0);
        if (needed <= 0) {
          showToast("Invoice is already fully paid.");
          return;
        }
        handleOpenPayment(inv, "full");
        return;
      }

      if (nextStatus === "ADVANCE_PAID") {
        setStatusMenu(null);
        setActionMenu(null);
        const existingAdvance = inv.advanceCents ?? 0;
        const targetAdvance =
          existingAdvance > 0
            ? existingAdvance
            : Math.round(inv.amountCents * 0.5);
        if (existingAdvance <= 0) {
          void updateInvoice(id, { advanceCents: targetAdvance });
        }
        const currentPaid = inv.paidCents || 0;
        if (currentPaid >= targetAdvance && currentPaid > 0) {
          showToast("Advance payment has already been recorded.");
          return;
        }
        handleOpenPayment(inv, "advance");
        return;
      }

      await setInvoiceStatus(id, nextStatus);
      setStatusMenu(null);
      setActionMenu(null);
      showToast(`Invoice status updated to ${nextStatus}.`);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Failed to update status";
      showToast(msg, "error");
    }
  };

  const handlePromoteClient = async (inv: InvoiceWithClient) => {
    try {
      await promoteClient(inv.id);
      setActionMenu(null);
      showToast(`Saved "${inv.clientName}" to permanent clients directory.`);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Failed to save client";
      showToast(msg, "error");
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (inv: InvoiceWithClient) => {
    setActionMenu(null);
    setStatusMenu(null);
    setEditingInvoice(inv);
    setEditCode(inv.code);
    setEditClientId(inv.clientId || "");
    setEditCurrency(inv.currency);
    setEditDueDate(inv.dueDate || "");
    setEditStatus(inv.status);
    setEditDeliveryUrl(inv.deliveryUrl || "");
    setEditPaymentUrl(inv.paymentUrl || "");
    setEditWorkflowStage(inv.workflowStage ?? null);
    setEditNotes(inv.notes || "");

    const items: LineItemDraft[] =
      inv.items && inv.items.length > 0
        ? inv.items.map((it) => ({
            id: it.id || String(Math.random()),
            catalogId: it.catalogId || undefined,
            description: it.description,
            quantity: it.quantity,
            unitPrice: (it.unitPriceCents / 100).toFixed(2),
          }))
        : [
            {
              id: "1",
              description: inv.title || "Custom software freelancing work",
              quantity: 1,
              unitPrice: ((inv.amountCents || 0) / 100).toFixed(2),
            },
          ];
    setEditLineItems(items);

    setEditDiscount(
      inv.discountCents ? (inv.discountCents / 100).toFixed(2) : "",
    );
    const baseBeforeTax = Math.max(
      0,
      (inv.amountCents || 0) - (inv.taxCents || 0),
    );
    setEditTaxRate(
      inv.taxCents && baseBeforeTax > 0
        ? ((inv.taxCents / baseBeforeTax) * 100).toFixed(1)
        : "",
    );
    if (inv.advanceCents && inv.advanceCents > 0) {
      setEditRequireAdvance(true);
      const pct =
        inv.amountCents > 0
          ? Math.round((inv.advanceCents / inv.amountCents) * 100)
          : 50;
      setEditAdvancePercent(pct);
    } else {
      setEditRequireAdvance(false);
      setEditAdvancePercent(50);
    }

    setActionMenu(null);
  };

  const handleAddEditLineItem = () => {
    setEditLineItems((prev) => [
      ...prev,
      { id: String(Date.now()), description: "", quantity: 1, unitPrice: "" },
    ]);
  };

  const handleRemoveEditLineItem = (id: string) => {
    setEditLineItems((prev) =>
      prev.length > 1 ? prev.filter((it) => it.id !== id) : prev,
    );
  };

  const handleUpdateEditLineItem = (
    id: string,
    updates: Partial<LineItemDraft>,
  ) => {
    setEditLineItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...updates } : it)),
    );
  };

  const handleEditCatalogSelect = (catalogId: string) => {
    const item = catalogItems.find((ci) => ci.id === catalogId);
    if (!item) return;
    const convertedPrice = reporting.convert(
      item.priceCents,
      item.currency,
      editCurrency,
    );
    if (convertedPrice === null) {
      showToast(
        "Connect to load exchange rates before adding this catalog item.",
        "error",
      );
      return;
    }
    setEditLineItems((prev) => {
      if (prev.length === 1 && !prev[0].description && !prev[0].unitPrice) {
        return [
          {
            id: prev[0].id,
            catalogId: item.id,
            description: item.title,
            quantity: 1,
            unitPrice: (convertedPrice / 100).toFixed(2),
          },
        ];
      }
      return [
        ...prev,
        {
          id: String(Date.now()),
          catalogId: item.id,
          description: item.title,
          quantity: 1,
          unitPrice: (convertedPrice / 100).toFixed(2),
        },
      ];
    });
  };

  // Math for Edit Invoice Modal
  const editItemsSubtotal = editLineItems.reduce((sum, it) => {
    const q = it.quantity > 0 ? it.quantity : 1;
    const p = parseFloat(it.unitPrice) || 0;
    return sum + q * p;
  }, 0);
  const editDiscountVal = parseFloat(editDiscount) || 0;
  const editTaxableSubtotal = Math.max(0, editItemsSubtotal - editDiscountVal);
  const editTaxVal =
    editTaxableSubtotal * ((parseFloat(editTaxRate) || 0) / 100);
  const editCalculatedTotal = Math.max(0, editTaxableSubtotal + editTaxVal);
  const editAdvanceAmountDue = editRequireAdvance
    ? editCalculatedTotal * (editAdvancePercent / 100)
    : 0;
  const editBalanceAmountDue = editCalculatedTotal - editAdvanceAmountDue;

  // Save Edit Changes
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;

    const validItems = editLineItems.filter((it) => it.description.trim());
    if (validItems.length === 0) {
      showToast("Please specify at least one service deliverable", "error");
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const itemsPayload = validItems.map((it) => ({
        id: it.id && !it.id.includes(".") ? it.id : undefined,
        catalogId: it.catalogId || undefined,
        description: it.description.trim(),
        quantity: it.quantity > 0 ? it.quantity : 1,
        unitPriceCents: parseAmountToCents(it.unitPrice || "0"),
      }));

      const finalAmountCents = parseAmountToCents(
        editCalculatedTotal.toFixed(2),
      );
      const discountCents = parseAmountToCents(editDiscountVal.toFixed(2));
      const taxCents = parseAmountToCents(editTaxVal.toFixed(2));
      const advanceCents = editRequireAdvance
        ? parseAmountToCents(editAdvanceAmountDue.toFixed(2))
        : 0;

      await updateInvoice(editingInvoice.id, {
        code: editCode.trim(),
        clientId: editClientId || undefined,
        title: validItems[0]?.description || undefined,
        items: itemsPayload,
        amountCents: finalAmountCents,
        discountCents,
        taxCents,
        advanceCents,
        currency: editCurrency,
        dueDate: editDueDate || null,
        status: editStatus,
        deliveryUrl: editDeliveryUrl.trim() || null,
        paymentUrl: editPaymentUrl.trim() || null,
        workflowStage: editWorkflowStage,
        notes: editNotes.trim() || null,
      });

      setEditingInvoice(null);
      showToast(`Invoice ${editCode} updated successfully.`);
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

  const confirmDelete = async () => {
    if (!trashTargets.length || movingToTrash) return;
    setMovingToTrash(true);
    try {
      if (isElectron) {
        await window.billflow!.invoices.trash(trashTargets);
        await refresh();
      } else {
        await deleteInvoice(trashTargets[0]);
      }
      setSelectedIds((ids) => ids.filter((id) => !trashTargets.includes(id)));
      showToast(isElectron ? "Moved to Invoice Trash." : "Invoice deleted.");
      setTrashTargets([]);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Could not move the selected invoices to Trash.",
        "error",
      );
    } finally {
      setMovingToTrash(false);
    }
  };

  const exportSelectedPdfs = async () => {
    setExportingBatch(true);
    try {
      const result = await window.billflow!.invoices.exportBatch(selectedIds);
      if (result.success)
        showToast(
          `Exported ${result.filePaths.length} invoice PDFs to the selected folder.`,
        );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Could not export invoice PDFs.",
        "error",
      );
    } finally {
      setExportingBatch(false);
    }
  };

  const prepareShare = async (id: string) => {
    setActionMenu(null);
    try {
      const result = await window.billflow!.invoices.prepareShare(id);
      if (result.success) showToast("PDF saved and share message copied.");
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Could not prepare the invoice for sharing.",
        "error",
      );
    }
  };

  // Line Items Handlers for Add Invoice
  const handleAddLineItem = () => {
    setNewLineItems((prev) => [
      ...prev,
      { id: String(Date.now()), description: "", quantity: 1, unitPrice: "" },
    ]);
  };

  const handleRemoveLineItem = (id: string) => {
    const target = newLineItems.find((it) => it.id === id);
    if (target?.sourceTaskId) {
      setLinkedTaskIds((prev) =>
        prev.filter((taskId) => taskId !== target.sourceTaskId),
      );
    }
    setNewLineItems((prev) =>
      prev.length > 1 ? prev.filter((it) => it.id !== id) : prev,
    );
  };

  const handleUpdateLineItem = (
    id: string,
    updates: Partial<LineItemDraft>,
  ) => {
    setNewLineItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...updates } : it)),
    );
  };

  const handleCatalogSelect = (catalogId: string) => {
    const item = catalogItems.find((ci) => ci.id === catalogId);
    if (!item) return;
    const convertedPrice = reporting.convert(
      item.priceCents,
      item.currency,
      newCurrency,
    );
    if (convertedPrice === null) {
      showToast(
        "Connect to load exchange rates before adding this catalog item.",
        "error",
      );
      return;
    }
    setNewLineItems((prev) => {
      if (prev.length === 1 && !prev[0].description && !prev[0].unitPrice) {
        return [
          {
            id: prev[0].id,
            catalogId: item.id,
            description: item.title,
            quantity: 1,
            unitPrice: (convertedPrice / 100).toFixed(2),
          },
        ];
      }
      return [
        ...prev,
        {
          id: String(Date.now()),
          catalogId: item.id,
          description: item.title,
          quantity: 1,
          unitPrice: (convertedPrice / 100).toFixed(2),
        },
      ];
    });
  };

  // Unbilled completed tasks eligible for import (excluding any already added in the current draft)
  const alreadyDraftedTaskIds = React.useMemo(() => {
    const ids = new Set<string>(linkedTaskIds);
    for (const item of newLineItems) {
      if (item.sourceTaskId) ids.add(item.sourceTaskId);
    }
    return ids;
  }, [linkedTaskIds, newLineItems]);

  const activeDraftClientObj = React.useMemo(() => {
    if (clientMode === "existing" && newClientId) {
      return clients.find((c) => c.id === newClientId) || null;
    }
    return null;
  }, [clientMode, newClientId, clients]);

  const allUnbilledTasks = React.useMemo(() => {
    return getUnbilledCompletedTasks({ includeAllClients: true }).filter(
      (t) => !alreadyDraftedTaskIds.has(t.id),
    );
  }, [getUnbilledCompletedTasks, alreadyDraftedTaskIds]);

  const clientFilteredUnbilledTasks = React.useMemo(() => {
    const targetClientId =
      clientMode === "existing" ? newClientId || null : null;
    const targetClientName =
      clientMode === "existing"
        ? activeDraftClientObj?.name || null
        : clientName.trim() || null;
    return getUnbilledCompletedTasks({
      clientId: targetClientId,
      clientName: targetClientName,
      includeAllClients: false,
    }).filter((t) => !alreadyDraftedTaskIds.has(t.id));
  }, [
    getUnbilledCompletedTasks,
    clientMode,
    newClientId,
    activeDraftClientObj,
    clientName,
    alreadyDraftedTaskIds,
  ]);

  const taskBillingGroup = (task: TaskItem) =>
    `${task.clientId || task.clientName?.trim().toLowerCase() || "unassigned"}:${task.currency || newCurrency}`;
  const selectedAnchor = allUnbilledTasks.find((task) =>
    selectedImportTaskIds.includes(task.id),
  );
  const displayedImportTasks = (
    importTasksShowAllClients ? allUnbilledTasks : clientFilteredUnbilledTasks
  ).filter(
    (task) =>
      !selectedAnchor ||
      taskBillingGroup(task) === taskBillingGroup(selectedAnchor),
  );

  const handleOpenImportTasksModal = () => {
    // Initialize fee and quantity map for all eligible unbilled tasks
    const nextFees: Record<string, string> = { ...importTaskFees };
    const nextQtys: Record<string, number> = { ...importTaskQuantities };
    for (const t of allUnbilledTasks) {
      if (nextFees[t.id] === undefined) {
        nextFees[t.id] = getTaskDefaultFee(t);
      }
      if (nextQtys[t.id] === undefined) {
        nextQtys[t.id] = 1;
      }
    }
    setImportTaskFees(nextFees);
    setImportTaskQuantities(nextQtys);

    // If the currently selected client has no tasks, default to showing all clients so the dialog isn't empty
    const hasClientTasks = clientFilteredUnbilledTasks.length > 0;
    setImportTasksShowAllClients(!hasClientTasks);
    setSelectedImportTaskIds([]);
    setShowImportTasksModal(true);
  };

  const handleToggleImportTask = (task: TaskItem) => {
    if (
      selectedAnchor &&
      taskBillingGroup(task) !== taskBillingGroup(selectedAnchor)
    ) {
      showToast(
        "Select tasks for one client and currency per invoice.",
        "error",
      );
      return;
    }
    setSelectedImportTaskIds((prev) => {
      const isRemoving = prev.includes(task.id);
      const next = isRemoving
        ? prev.filter((id) => id !== task.id)
        : [...prev, task.id];

      // If no client is selected yet (or when selecting a task belonging to a client), pre-fill the client in the invoice form
      if (!isRemoving && (task.clientId || task.clientName)) {
        const matchedClient = clients.find(
          (c) =>
            (task.clientId && c.id === task.clientId) ||
            (task.clientName &&
              c.name.toLowerCase() === task.clientName.toLowerCase()),
        );
        if (matchedClient && (!newClientId || importTasksShowAllClients)) {
          setClientMode("existing");
          setNewClientId(matchedClient.id);
          setNewCurrency(task.currency || matchedClient.currency);
          if (matchedClient.driveUrl && !newDeliveryUrl) {
            setNewDeliveryUrl(matchedClient.driveUrl);
          }
        } else if (
          !matchedClient &&
          task.clientName &&
          clientMode === "new" &&
          !clientName.trim()
        ) {
          setClientName(task.clientName);
        }
      }

      return next;
    });
  };

  const handleSelectAllImportTasks = () => {
    const anchor = selectedAnchor || displayedImportTasks[0];
    const ids = displayedImportTasks
      .filter(
        (task) =>
          !anchor || taskBillingGroup(task) === taskBillingGroup(anchor),
      )
      .map((t) => t.id);
    setSelectedImportTaskIds(ids);
    const firstWithClient = displayedImportTasks.find(
      (t) => ids.includes(t.id) && (t.clientId || t.clientName),
    );
    if (firstWithClient) {
      const matchedClient = clients.find(
        (c) =>
          (firstWithClient.clientId && c.id === firstWithClient.clientId) ||
          (firstWithClient.clientName &&
            c.name.toLowerCase() === firstWithClient.clientName.toLowerCase()),
      );
      if (matchedClient && !newClientId) {
        setClientMode("existing");
        setNewClientId(matchedClient.id);
        setNewCurrency(matchedClient.currency);
      }
    }
  };

  const handleDeselectAllImportTasks = () => {
    setSelectedImportTaskIds([]);
  };

  const handleImportSelectedTasks = () => {
    const selectedTasks = allUnbilledTasks.filter((t) =>
      selectedImportTaskIds.includes(t.id),
    );
    if (
      selectedTasks.some(
        (task) => taskBillingGroup(task) !== taskBillingGroup(selectedTasks[0]),
      )
    ) {
      showToast(
        "Select tasks for one client and currency per invoice.",
        "error",
      );
      return;
    }
    if (selectedTasks.length === 0) {
      showToast("Select at least one completed task to import", "error");
      return;
    }

    const importedLines: LineItemDraft[] = selectedTasks.map((t) => {
      const completedSubtaskTitles = t.subtasks
        .filter((st) => st.completed)
        .map((st) => st.title.trim())
        .filter(Boolean);
      const noteSuffix =
        completedSubtaskTitles.length > 0
          ? ` (${completedSubtaskTitles.join(", ")})`
          : "";
      return {
        id: `task-item-${t.id}`,
        sourceTaskId: t.id,
        description: `${t.title}${noteSuffix}`.slice(0, 300),
        quantity: Math.max(1, importTaskQuantities[t.id] || 1),
        unitPrice: importTaskFees[t.id] ?? getTaskDefaultFee(t),
      };
    });

    setNewLineItems((prev) => {
      if (
        prev.length === 1 &&
        !prev[0].description.trim() &&
        !prev[0].unitPrice.trim()
      ) {
        return importedLines;
      }
      return [...prev, ...importedLines];
    });

    setLinkedTaskIds((prev) =>
      Array.from(new Set([...prev, ...selectedTasks.map((t) => t.id)])),
    );

    const taskWithDelivery = selectedTasks.find((t) => t.deliveryUrl);
    if (taskWithDelivery?.deliveryUrl && !newDeliveryUrl) {
      setNewDeliveryUrl(taskWithDelivery.deliveryUrl);
    }

    setShowImportTasksModal(false);
    setSelectedImportTaskIds([]);
    showToast(
      `Imported ${selectedTasks.length} completed ${selectedTasks.length === 1 ? "task" : "tasks"} into invoice draft.`,
    );
  };

  // Math for Add Invoice Modal
  const itemsSubtotal = newLineItems.reduce((sum, it) => {
    const q = it.quantity > 0 ? it.quantity : 1;
    const p = parseFloat(it.unitPrice) || 0;
    return sum + q * p;
  }, 0);
  const discountVal = parseFloat(newDiscount) || 0;
  const taxableSubtotal = Math.max(0, itemsSubtotal - discountVal);
  const taxVal = taxableSubtotal * ((parseFloat(newTaxRate) || 0) / 100);
  const calculatedTotal = Math.max(0, taxableSubtotal + taxVal);
  const advanceAmountDue = requireAdvance
    ? calculatedTotal * (advancePercent / 100)
    : 0;
  const balanceAmountDue = calculatedTotal - advanceAmountDue;

  // Add Invoice Form Submit
  const handleAddInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (clientMode === "existing" && !newClientId) {
      showToast("Please select a client", "error");
      return;
    }

    const validItems = newLineItems.filter((it) => it.description.trim());
    if (validItems.length === 0) {
      showToast("Please specify at least one service deliverable", "error");
      return;
    }

    setIsSubmittingNew(true);
    try {
      const today = localDateKey(new Date());
      const itemsPayload = validItems.map((it) => ({
        catalogId: it.catalogId || undefined,
        sourceTaskId: it.sourceTaskId || undefined,
        description: it.description.trim(),
        quantity: it.quantity > 0 ? it.quantity : 1,
        unitPriceCents: parseAmountToCents(it.unitPrice || "0"),
      }));
      const allLinkedTaskIds = Array.from(
        new Set([
          ...linkedTaskIds,
          ...(validItems
            .map((it) => it.sourceTaskId)
            .filter(Boolean) as string[]),
        ]),
      );

      const finalAmountCents = parseAmountToCents(calculatedTotal.toFixed(2));
      const discountCents = parseAmountToCents(discountVal.toFixed(2));
      const taxCents = parseAmountToCents(taxVal.toFixed(2));
      const advanceCents = requireAdvance
        ? parseAmountToCents(advanceAmountDue.toFixed(2))
        : 0;

      requestId.current ||= crypto.randomUUID();
      const created = await createInvoice({
        requestId: requestId.current,
        ...(clientMode === "new"
          ? {
              newClient: {
                name: clientName,
                email: clientEmail,
                currency: newCurrency,
                contactPerson: clientContact || clientName,
                phone: clientPhone.trim() || undefined,
                whatsappPhone: clientWhatsApp.trim() || null,
                category: clientCategory,
                driveUrl: newDeliveryUrl.trim() || undefined,
              },
              saveAsPermanentClient,
            }
          : { clientId: newClientId }),
        code: newCode.trim() || undefined,
        title: validItems[0]?.description || undefined,
        items: itemsPayload,
        linkedTaskIds:
          allLinkedTaskIds.length > 0 ? allLinkedTaskIds : undefined,
        amountCents: finalAmountCents,
        discountCents,
        taxCents,
        advanceCents,
        deliveryUrl: newDeliveryUrl.trim() || undefined,
        paymentUrl: newPaymentUrl.trim() || null,
        workflowStage: newWorkflowStage,
        notes: newNotes.trim() || undefined,
        currency: newCurrency,
        issueDate: today,
        dueDate: newDueDate || null,
        status: newStatus,
      });

      clearInvoiceDraft();
      closeAddInvoiceModal(false);
      requestId.current = null;
      setNewLineItems([
        { id: "1", description: "", quantity: 1, unitPrice: "" },
      ]);
      setLinkedTaskIds([]);
      setNewDiscount("");
      setNewTaxRate("");
      setNewDeliveryUrl("");
      setNewPaymentUrl("");
      setNewWorkflowStage(null);
      setClientWhatsApp("");
      setClientPhone("");
      setNewNotes("");
      setNewDueDate("");
      setNewStatus("UNPAID");
      showToast(`Invoice ${created.code} saved. PDF export is queued.`);
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

  // Open Record Payment Modal
  const handleOpenPayment = (
    inv: InvoiceWithClient,
    targetType?: "advance" | "full",
  ) => {
    setPaymentInvoice(inv);
    const today = localDateKey(new Date());
    setPaymentDate(today);

    const paid = inv.paidCents || 0;
    const advance = inv.advanceCents || Math.round(inv.amountCents * 0.5);
    const remaining = Math.max(0, inv.amountCents - paid);

    if (targetType === "advance") {
      const advNeeded = Math.max(0, advance - paid);
      setPaymentAmount((advNeeded / 100).toFixed(2));
    } else if (targetType === "full") {
      setPaymentAmount((remaining / 100).toFixed(2));
    } else {
      if (advance > 0 && paid < advance) {
        setPaymentAmount(((advance - paid) / 100).toFixed(2));
      } else {
        setPaymentAmount((remaining / 100).toFixed(2));
      }
    }

    setPaymentReference(
      `SLIP-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
    );
    setSelectedSlip(null);
    setSlipScanResult(null);
    setSlipScanError(null);
    setIsScanningSlip(false);
    setShowPaymentModal(true);
    setActionMenu(null);
    setStatusMenu(null);
  };

  const runSlipOcrScan = async (options: {
    file?: File | Blob;
    stagedToken?: string;
    fileName?: string;
  }) => {
    const api = window.billflow?.ai?.scanPaymentSlip;
    if (!api || !paymentInvoice) return;
    const isPdf = Boolean(
      options.fileName?.toLowerCase().endsWith(".pdf") ||
        (options.file && options.file.type === "application/pdf"),
    );
    if (isPdf) {
      setSlipScanResult(null);
      setSlipScanError(null);
      return;
    }

    setIsScanningSlip(true);
    setSlipScanError(null);
    try {
      const remainingCents = Math.max(
        0,
        paymentInvoice.amountCents - (paymentInvoice.paidCents || 0),
      );
      const advanceRemainingCents =
        paymentInvoice.advanceCents &&
        (paymentInvoice.paidCents || 0) < paymentInvoice.advanceCents
          ? paymentInvoice.advanceCents - (paymentInvoice.paidCents || 0)
          : 0;

      let imageBase64: string | undefined;
      if (options.file && options.file.type.startsWith("image/")) {
        const processed = await preprocessScreenshotForOcr(options.file, {
          autoInvertDark: true,
        });
        imageBase64 = processed.dataUrl;
      }

      const scanned = await api({
        ...(imageBase64
          ? { imageBase64 }
          : options.stagedToken
            ? { stagedToken: options.stagedToken }
            : {}),
        expectedAmountCents: remainingCents,
        expectedAdvanceCents: advanceRemainingCents,
        expectedCurrency: paymentInvoice.currency,
      });

      setSlipScanResult(scanned);
      if (scanned.amount) setPaymentAmount(scanned.amount);
      if (scanned.paymentDate) setPaymentDate(scanned.paymentDate);
      if (scanned.reference) setPaymentReference(scanned.reference);
      if (scanned.matchLabel) {
        showToast(`Bank slip verified: ${scanned.matchLabel}.`);
      } else if (scanned.amount) {
        showToast("Auto-filled payment details from bank slip.");
      }
    } catch (err) {
      setSlipScanResult(null);
      setSlipScanError(
        err instanceof Error
          ? err.message
          : "Could not read text from this payment slip.",
      );
    } finally {
      setIsScanningSlip(false);
    }
  };

  const handlePickReceipt = async () => {
    if (workflow?.attachments?.chooseFile) {
      try {
        const file = await workflow.attachments.chooseFile();
        if (file) {
          setSelectedSlip(file);
          void runSlipOcrScan({
            stagedToken: file.path,
            fileName: file.name,
          });
          return;
        }
      } catch {
        // Fallback to HTML input
      }
    }
    slipFileInputRef.current?.click();
  };

  const stageBrowserFile = async (file: File) => {
    const maxReceiptBytes = 20 * 1024 * 1024;
    if (file.size <= 0 || file.size > maxReceiptBytes) {
      showToast("Receipt must be a non-empty file smaller than 20 MB.", "error");
      return;
    }
    if (workflow?.attachments?.stageFile) {
      try {
        const staged = await workflow.attachments.stageFile(file);
        if (staged) {
          setSelectedSlip(staged);
          void runSlipOcrScan({ file, fileName: file.name });
        }
        return;
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Could not attach receipt file.",
          "error",
        );
        return;
      }
    }
    if (!workflow?.attachments?.stageDroppedFile) {
      showToast("Receipt staging is unavailable in this environment.", "error");
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const staged = await workflow.attachments.stageDroppedFile(
        file.name,
        bytes,
      );
      if (staged) {
        setSelectedSlip(staged);
        void runSlipOcrScan({ file, fileName: file.name });
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not attach receipt file.",
        "error",
      );
    }
  };

  const stageBrowserFileRef = useRef(stageBrowserFile);
  useEffect(() => {
    stageBrowserFileRef.current = stageBrowserFile;
  });

  // Allow pasting a bank transfer slip screenshot directly inside the Record Payment modal
  useEffect(() => {
    if (!showPaymentModal || !paymentInvoice) return;
    const onPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          if (blob) {
            event.preventDefault();
            const ext = blob.type.split("/")[1] || "png";
            const file = new File([blob], `bank-slip-${Date.now()}.${ext}`, {
              type: blob.type,
            });
            void stageBrowserFileRef.current(file);
            return;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [showPaymentModal, paymentInvoice]);

  const handleSlipInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void stageBrowserFile(file);
  };
  const handleSlipDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingSlip(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) {
      showToast("Drop a PDF, PNG, JPG, or WEBP receipt file.", "error");
      return;
    }
    void stageBrowserFile(file);
  };

  // Submit Payment
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentInvoice) return;

    setIsSubmittingPayment(true);
    try {
      const amountCents = parseAmountToCents(paymentAmount);
      const reqId = crypto.randomUUID();
      const res = await recordPayment({
        invoiceId: paymentInvoice.id,
        amountCents,
        currency: paymentInvoice.currency,
        receivedAt: paymentDate
          ? new Date(paymentDate).toISOString()
          : new Date().toISOString(),
        reference: paymentReference.trim() || undefined,
        requestId: reqId,
      });

      if (selectedSlip && workflow) {
        try {
          const slip = await workflow.attachments.select(
            { type: "payment", id: res.payment.id },
            crypto.randomUUID(),
            selectedSlip.path,
          );
          if (slip) {
            showToast(
              `Recorded payment of ${formatCents(amountCents, paymentInvoice.currency)} with receipt "${slip.originalName}".`,
            );
          } else {
            showToast(
              `Recorded payment of ${formatCents(amountCents, paymentInvoice.currency)} for ${paymentInvoice.code}.`,
            );
          }
        } catch (err: unknown) {
          const msg =
            err instanceof Error
              ? err.message
              : "Payment recorded, but receipt attachment failed.";
          showToast(msg, "error");
        }
      } else {
        showToast(
          `Recorded payment of ${formatCents(amountCents, paymentInvoice.currency)} for ${paymentInvoice.code}.`,
        );
      }

      setShowPaymentModal(false);
      setSelectedSlip(null);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Failed to record payment";
      showToast(msg, "error");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Open PDF
  const handleOpenPdf = async (inv: InvoiceWithClient) => {
    try {
      await openInvoicePdf(inv.id);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Could not open invoice PDF";
      showToast(msg, "error");
    }
  };

  // Reveal PDF in folder
  const handleRevealPdf = async (inv: InvoiceWithClient) => {
    try {
      await openInvoicePdf(inv.id, true);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Could not reveal PDF in folder";
      showToast(msg, "error");
    }
  };

  // Open Payment Inspector
  const handleOpenInspector = (inv: InvoiceWithClient) => {
    setInspectingInvoice(inv);
    setActionMenu(null);
  };

  // Attach receipt to an existing payment
  const handleAttachReceiptToPayment = async (paymentId: string) => {
    if (!workflow) return;
    try {
      const slip = await workflow.attachments.select(
        { type: "payment", id: paymentId },
        crypto.randomUUID(),
      );
      if (slip) {
        showToast(`Receipt "${slip.originalName}" attached.`);
        const list = await workflow.attachments.list({
          type: "payment",
          id: paymentId,
        });
        setPaymentAttachments((prev) => ({ ...prev, [paymentId]: list }));
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to attach receipt";
      showToast(msg, "error");
    }
  };

  return (
    <div className="workspace-page motion-page">
      {/* Toast Notification */}
      <MotionPresence>
        {notification && (
          <MotionSurface
            key={notification.message}
            kind="toast"
            role="status"
            aria-live="polite"
            className={`bf-toast-popup zentra-toast ${
              notification.type === "error" ? "zentra-toast--error" : ""
            } fixed bottom-6 right-6 z-[9999] text-[13px] font-medium max-w-md min-w-[260px]`}
          >
            <span className="zentra-toast-icon" aria-hidden="true">
              {notification.type === "error" ? (
                <AlertCircle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="success-confirm-pulse rounded-full w-4 h-4 shrink-0" />
              )}
            </span>
            <span className="min-w-0 flex-1 leading-snug">{notification.message}</span>
            <span aria-hidden="true" className="zentra-toast-progress" />
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Zentra Top Header */}
      <PageHeader title="Invoices">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowOverdueSummary(true)}
            className="zentra-control-pill hover:!border-accent/50"
            title="Open Overdue Invoices Summary & Professional CSV Template Table"
          >
            <FileSpreadsheet className={`w-3.5 h-3.5 ${ACCENT_ICON_CLASS}`} />
            <span>Overdue Summary & CSV Template</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const target =
                allInvoices.length > 0 ? allInvoices[0] : getSampleInvoice();
              setPreviewInvoice(target);
            }}
            className="zentra-control-pill hover:!border-accent/50"
            title="Preview the geometric EPS invoice design template"
          >
            <Eye className={`w-3.5 h-3.5 ${ACCENT_ICON_CLASS}`} />
            <span>Preview Template</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("Advance Paid")}
            className="zentra-control-pill"
          >
            <CreditCard className="w-3.5 h-3.5 text-accent" />
            <span>Advance Queue</span>
          </button>
          <button
            type="button"
            onClick={openSmartCapture}
            className="zentra-control-pill hover:!border-accent/50"
            title="Paste a screenshot or client message to auto-fill a new invoice"
          >
            <Sparkles className={`w-3.5 h-3.5 ${ACCENT_ICON_CLASS}`} />
            <span>Smart Capture</span>
          </button>
          <Button variant="primary" type="button" onClick={handleOpenAddModal}>
            <Plus className="w-4 h-4" strokeWidth={2.2} />
            <span>New Invoice</span>
          </Button>
        </div>
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label="Billing section switcher"
          value={viewMode}
          onChange={(val) =>
            setViewMode(val as "invoices" | "quotes" | "recurring")
          }
          options={[
            { value: "invoices", label: "Invoices" },
            { value: "quotes", label: "Proposals & Quotes" },
            { value: "recurring", label: "Recurring Retainers" },
          ]}
        />
      </div>

      {/* =====================================================================
          ZENTRA 3-CARD INVOICES BENTO HEADER ROW
         ===================================================================== */}
      <WorkspaceActivityPanel exportsOnly />
      {viewMode === "quotes" ? (
        <QuotesTab onConvertedToInvoice={() => setViewMode("invoices")} />
      ) : viewMode === "recurring" ? (
        <RecurringRulesTab onInvoiceGenerated={() => setViewMode("invoices")} />
      ) : (
        <>
      <ReportingGuard>
        {(() => {
          const issued = reporting.invoices.filter(
            (inv) => inv.status !== "DRAFT",
          );
          const billed = issued.reduce((sum, inv) => sum + inv.amountCents, 0);
          const collected = issued.reduce(
            (sum, inv) => sum + (inv.paidCents ?? 0),
            0,
          );
          const balance = (inv: (typeof issued)[number]) =>
            Math.max(0, inv.amountCents - (inv.paidCents ?? 0));
          const open = issued.filter((inv) => balance(inv) > 0);
          const overdue = open.filter((inv) => isPastDue(inv));
          const outstanding = open.reduce((sum, inv) => sum + balance(inv), 0);
          const pastDue = overdue.reduce((sum, inv) => sum + balance(inv), 0);
          const money = (value: number) => formatCents(value, primaryCurrency);
          return (
            <div className="kpi-strip grid grid-cols-1 lg:grid-cols-12 gap-3">
              <section className="lg:col-span-5 ui-card kpi-strip-card">
                <div className="flex items-center justify-between gap-2">
                  <h2>Billed & Collected</h2>
                  <button
                    type="button"
                    onClick={handleOpenAddModal}
                    className="zentra-circle-btn zentra-circle-btn--sm"
                    aria-label="Create new invoice"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div>
                  <div className="summary-value">{money(billed)}</div>
                  <p className="summary-caption">
                    {issued.length} issued invoice
                    {issued.length === 1 ? "" : "s"} · {primaryCurrency}
                  </p>
                </div>
                <DataBreakdown
                  label="Share of total billed"
                  total={billed}
                  rows={[
                    {
                      label: "Collected",
                      value: collected,
                      display: money(collected),
                      tone: "green",
                    },
                    {
                      label: "Remaining balance",
                      value: outstanding,
                      display: money(outstanding),
                      tone: "blue",
                    },
                  ]}
                />
              </section>
              <section className="lg:col-span-4 ui-card kpi-strip-card">
                <div className="flex items-center justify-between gap-2">
                  <h2>Total Outstanding</h2>
                  <span className="zentra-pill-badge">{open.length} open</span>
                </div>
                <div>
                  <div className="summary-value">{money(outstanding)}</div>
                  <p className="summary-caption">
                    {open.length
                      ? "Balances still to collect"
                      : "All issued invoices are settled"}
                  </p>
                </div>
                <DataBreakdown
                  label="Outstanding balance by due status"
                  total={outstanding}
                  rows={[
                    {
                      label: "Within payment terms",
                      value: outstanding - pastDue,
                      display: money(outstanding - pastDue),
                      tone: "blue",
                    },
                    {
                      label: "Past due",
                      value: pastDue,
                      display: money(pastDue),
                      tone: "pink",
                    },
                  ]}
                />
              </section>
              <section className="lg:col-span-3 ui-card kpi-strip-card">
                <div className="flex items-center justify-between gap-2">
                  <h2>Overdue</h2>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleExportInvoicesCsv("overdue", "csv")}
                      className="zentra-circle-btn zentra-circle-btn--sm text-content-neutral-600 hover:text-content-neutral-900"
                      aria-label="Export overdue invoices to CSV"
                      title="Export Overdue Invoices to CSV (.csv)"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleExportInvoicesCsv("overdue", "excel")
                      }
                      className="zentra-circle-btn zentra-circle-btn--sm hover:!border-accent/50 !text-accent-deep-solid dark:!text-accent"
                      aria-label="Export overdue invoices to Excel"
                      title="Convert & Export Overdue Invoices to Excel (.xls)"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowOverdueSummary(true)}
                      className="zentra-circle-btn zentra-circle-btn--sm text-rose-600 hover:text-rose-700 dark:text-rose-400"
                      aria-label="View Overdue Summary and Aging"
                      title="View Overdue Summary and Aging Breakdown"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div>
                  <div className="summary-value">{money(pastDue)}</div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="summary-caption">
                      {overdue.length} past-due invoice
                      {overdue.length === 1 ? "" : "s"}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowOverdueSummary(true)}
                      className="text-[11px] text-accent hover:underline font-medium cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Breakdown →
                    </button>
                  </div>
                </div>
                <MonthlyBars
                  label={`Unpaid by due month · ${primaryCurrency}`}
                  formatValue={money}
                  points={recentMonths().map((month) => ({
                    ...month,
                    value: overdue
                      .filter((inv) => inv.dueDate?.startsWith(month.key))
                      .reduce((sum, inv) => sum + balance(inv), 0),
                  }))}
                />
              </section>
            </div>
          );
        })()}
      </ReportingGuard>

      {/* Filters, Search and Active Client Chip */}
      <div className="flex flex-wrap items-center justify-between gap-3 w-full pt-1">
        <div className="flex flex-wrap items-center gap-2">
          {activeClientFilterObj && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-accent-faint dark:bg-accent-soft border border-border-accent dark:border-border-accent text-accent dark:text-accent text-xs font-semibold rounded-full">
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
              [
                "All Invoices",
                "Advance Paid",
                "Drafts",
                "Overdue",
                "Paid",
              ] as FilterTab[]
            ).map((value) => ({ value, label: value }))}
          />

          {activeTab === "Overdue" && (
            <Button
              variant="secondary"
              size="small"
              type="button"
              onClick={() => setShowOverdueSummary(true)}
              className="text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900"
              title="Open Overdue Summary & Aging Analysis"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Overdue Summary</span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-content-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search invoices, clients..."
              className="ui-field ui-search-input w-full pl-9 pr-8 text-xs !rounded-full"
              style={{ paddingLeft: "38px" }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-content-neutral-400 hover:text-content-neutral-700 p-0.5"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsExportDialogOpen(true)}
            className="zentra-control-pill hover:!border-accent/50 shrink-0"
            title={
              activeTab === "Overdue"
                ? "Export overdue summary report as CSV or Excel"
                : "Export currently filtered invoices as CSV or Excel"
            }
          >
            <Download className={`w-3.5 h-3.5 ${ACCENT_ICON_CLASS}`} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Invoice register */}
      <div className="ui-card record-list-card">
        <div className="record-list-heading">
          <div className="flex items-center gap-2.5">
            <h3 className="text-[16px] font-medium tracking-[-0.02em] text-content-neutral-950">
              Invoices
            </h3>
            <span className="record-count">
              {filteredInvoices.length}{" "}
              {filteredInvoices.length === 1 ? "record" : "records"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isElectron && (
              <Button
                variant="secondary"
                size="small"
                onClick={() => setShowTrash(true)}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Trash
              </Button>
            )}
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium text-accent">
                  {selectedIds.length} selected
                </span>
                {isElectron && (
                  <>
                    <Button
                      variant="secondary"
                      size="small"
                      disabled={exportingBatch}
                      onClick={() => void exportSelectedPdfs()}
                    >
                      {exportingBatch ? "Exporting PDFs…" : "Export PDFs"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => setBulkStatusIds(selectedIds)}
                    >
                      Change status
                    </Button>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => setTrashTargets(selectedIds)}
                    >
                      Move to Trash
                    </Button>
                  </>
                )}
                <Button
                  variant="secondary"
                  size="small"
                  type="button"
                  onClick={() => handleExportInvoicesCsv("selected", "csv")}
                  title="Export selected invoices to CSV (.csv)"
                >
                  <Download className="w-3.5 h-3.5 text-accent" />
                  <span>Export CSV</span>
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  type="button"
                  onClick={() => handleExportInvoicesCsv("selected", "excel")}
                  title="Convert & export selected invoices to Excel (.xls)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-accent" />
                  <span>Export Excel</span>
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="record-table-scroll">
          {invoicePageCount > 1 && (
            <nav
              aria-label="Invoice pages"
              className="flex items-center justify-between gap-3 p-3 text-sm"
            >
              <button
                type="button"
                className="ui-button ui-button--secondary"
                disabled={visibleInvoicePage === 1}
                onClick={() => setInvoicePage(visibleInvoicePage - 1)}
              >
                Previous
              </button>
              <span>
                Page {visibleInvoicePage} of {invoicePageCount} ·{" "}
                {filteredInvoices.length} invoices
              </span>
              <button
                type="button"
                className="ui-button ui-button--secondary"
                disabled={visibleInvoicePage === invoicePageCount}
                onClick={() => setInvoicePage(visibleInvoicePage + 1)}
              >
                Next
              </button>
            </nav>
          )}
          <table className="record-table invoice-register">
            <caption className="sr-only">
              Invoices, collections and payment status
            </caption>
            <thead>
              <tr>
                <th scope="col" className="record-selection">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    aria-label="Select all invoices"
                  />
                </th>
                <th scope="col">Client / Invoice</th>
                <th scope="col">Work</th>
                <th scope="col">Collection</th>
                <th scope="col">Due date</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-0 text-center">
                    <EmptyState
                      title={
                        allInvoices.length === 0
                          ? "No invoices yet"
                          : "No invoices found"
                      }
                      description={
                        allInvoices.length === 0
                          ? "Create your first invoice to generate itemized PDFs and track payments."
                          : "No invoices matched the selected filter."
                      }
                      icon={<Receipt />}
                    >
                      {allInvoices.length === 0 && (
                        <div className="flex items-center gap-2.5 mt-4">
                          <Button
                            variant="primary"
                            onClick={handleOpenAddModal}
                          >
                            <Plus className="w-4 h-4" />
                            <span>New Invoice</span>
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() =>
                              setPreviewInvoice(getSampleInvoice())
                            }
                          >
                            <Eye className={`w-4 h-4 ${ACCENT_ICON_CLASS}`} />
                            <span>Preview Template Design</span>
                          </Button>
                        </div>
                      )}
                    </EmptyState>
                  </td>
                </tr>
              ) : (
                visibleInvoices.map((inv, idx) => {
                  const isSelected = selectedIds.includes(inv.id);
                  const isHighlighted = highlightedInvoiceId === inv.id;
                  const paidCents =
                    inv.paidCents ??
                    (inv.status === "PAID" ? inv.amountCents : 0);
                  const balanceDueCents = Math.max(
                    0,
                    inv.amountCents - paidCents,
                  );
                  const paidPct =
                    inv.amountCents > 0
                      ? Math.min(
                          100,
                          Math.round((paidCents / inv.amountCents) * 100),
                        )
                      : inv.status === "PAID"
                        ? 100
                        : 0;
                  return (
                    <m.tr
                      key={inv.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={listRowTransition(idx)}
                      data-selected={isSelected || isHighlighted}
                    >
                      <td className="record-selection">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(inv.id)}
                          aria-label={`Select invoice ${inv.code}`}
                        />
                      </td>
                      <td className="invoice-register-client">
                        <div className="record-identity">
                          <div className="record-avatar">
                            <Receipt className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            {inv.clientId ? (
                              <button
                                type="button"
                                className="record-title record-title-link"
                                onClick={() =>
                                  router.push(`/clients?client=${inv.clientId}`)
                                }
                              >
                                {inv.clientName}
                              </button>
                            ) : (
                              <p className="record-title">{inv.clientName}</p>
                            )}
                            <button
                              type="button"
                              onClick={() => setPreviewInvoice(inv)}
                              className="record-meta hover:!text-accent-deep-solid dark:hover:!text-accent hover:underline font-mono cursor-pointer text-left inline-flex items-center gap-1.5"
                              title={`View invoice design ${inv.code}`}
                            >
                              <span>{inv.code}</span>
                              <Eye className={`w-3 h-3 ${ACCENT_ICON_CLASS}`} />
                              {!inv.clientId ? " · Temporary" : ""}
                            </button>
                            {inv.workflowStage && (
                              <p className="record-meta">
                                {workflowStages[inv.workflowStage]}
                              </p>
                            )}
                            {(() => {
                              const resolved = resolveDeliveryUrl(inv, {
                                clients,
                              });
                              return resolved.hasLink ? (
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
                              ) : null;
                            })()}
                          </div>
                        </div>
                      </td>
                      <td className="invoice-register-work">
                        <p
                          className="record-secondary record-scope-text"
                          title={
                            inv.items
                              ?.map((item) => item.description)
                              .join(" · ") ||
                            inv.title ||
                            undefined
                          }
                        >
                          {inv.items?.length
                            ? inv.items[0].description
                            : inv.title || "Freelance services"}
                        </p>
                        <p className="record-meta">
                          {inv.items && inv.items.length > 1
                            ? `+ ${inv.items.length - 1} more ${inv.items.length === 2 ? "deliverable" : "deliverables"}`
                            : inv.items?.[0]?.quantity &&
                                inv.items[0].quantity > 1
                              ? `Quantity ${inv.items[0].quantity}`
                              : "1 deliverable"}
                        </p>
                      </td>
                      <td className="invoice-register-collection">
                        <div className="record-collection-heading">
                          <strong className="record-amount">
                            <ReportedMoney
                              cents={inv.amountCents}
                              currency={inv.currency}
                            />
                          </strong>
                          <span className="record-meta">{paidPct}% paid</span>
                        </div>
                        <div
                          className="record-collection-track"
                          role="progressbar"
                          aria-label={`${inv.code} collected`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={paidPct}
                        >
                          <div style={{ width: `${paidPct}%` }} />
                        </div>
                        <p className="record-meta tabular-nums">
                          {paidCents > 0
                            ? `${formatCents(paidCents, inv.currency)} received`
                            : "No payments recorded"}
                        </p>
                        {balanceDueCents > 0 && paidCents > 0 && (
                          <p className="record-meta tabular-nums">
                            {formatCents(balanceDueCents, inv.currency)}{" "}
                            remaining
                          </p>
                        )}
                      </td>
                      <td className="record-date">
                        {formatDateDisplay(inv.dueDate)}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="record-status"
                          data-status={inv.status.toLowerCase()}
                          onClick={(e) => handleToggleStatusMenu(e, inv)}
                          aria-haspopup="true"
                          aria-expanded={statusMenu?.invoice.id === inv.id}
                          title="Change invoice status"
                        >
                          <span
                            className="record-status-dot"
                            aria-hidden="true"
                          />
                          <span>
                            {inv.status === "ADVANCE_PAID"
                              ? "Advance paid"
                              : inv.status.charAt(0) +
                                inv.status.slice(1).toLowerCase()}
                          </span>
                          <ChevronDown className="w-3 h-3 opacity-50" />
                        </button>
                      </td>
                      <td>
                        <div className="record-actions">
                          {inv.status !== "PAID" && inv.status !== "DRAFT" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenPayment(inv)}
                              title={`Record payment for ${inv.code}`}
                            >
                              <CreditCard className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setActionMenu(null);
                              setStatusMenu(null);
                              setPreviewInvoice(inv);
                            }}
                            title={`View invoice design ${inv.code}`}
                          >
                            <Eye className={`w-4 h-4 ${ACCENT_ICON_CLASS}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setActionMenu(null);
                              setStatusMenu(null);
                              handleOpenPdf(inv);
                            }}
                            title={`Open PDF for ${inv.code}`}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleToggleActionMenu(e, inv)}
                            aria-haspopup="true"
                            aria-expanded={actionMenu?.invoice.id === inv.id}
                            title={`Actions for ${inv.code}`}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </m.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {/* Add Invoice Modal with Itemized Services, Advance & PDF Export */}
      <MotionPresence>
        {showAddInvoiceModal && (
          <Dialog onClose={closeAddInvoiceModal} width={820}>
            <div className="app-dialog-header">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent-faint text-accent flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-content-neutral-900">
                    New invoice
                  </h3>
                  <p className="text-xs text-content-neutral-400">
                    Add services, set an advance, and save the invoice PDF.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasInvoiceDraft && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="small"
                    onClick={handleRestoreInvoiceDraft}
                    className="text-xs gap-1.5 font-medium border-accent/40 text-accent hover:bg-accent/10"
                    title="Restore previously typed invoice draft"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </Button>
                )}
              </div>
            </div>
            <form onSubmit={handleAddInvoiceSubmit} className="app-dialog-form">
              <div className="app-dialog-body">
                {/* Client Selection */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500">
                    Client Selection
                  </label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={
                        clientMode === "existing" ? "primary" : "secondary"
                      }
                      onClick={() => setClientMode("existing")}
                    >
                      Existing client
                    </Button>
                    <Button
                      type="button"
                      variant={clientMode === "new" ? "primary" : "secondary"}
                      onClick={() => setClientMode("new")}
                    >
                      Add new client
                    </Button>
                  </div>
                </div>

                {clientMode === "new" ? (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-surface-neutral-50 rounded-xl border border-line-neutral-200/80">
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-content-neutral-700">
                        Client name{" "}
                        <span className="text-content-rose-500 font-bold">
                          *
                        </span>
                      </span>
                      <input
                        aria-label="New client name"
                        className="ui-field w-full px-3.5"
                        required
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="e.g. Acme Studio"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-content-neutral-700">
                        Email{" "}
                        <span className="text-content-rose-500 font-bold">
                          *
                        </span>
                      </span>
                      <input
                        aria-label="New client email"
                        className="ui-field w-full px-3.5"
                        type="email"
                        required
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        placeholder="client@acme.com"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-content-neutral-700">
                        Contact person
                      </span>
                      <input
                        aria-label="New client contact"
                        className="ui-field w-full px-3.5"
                        value={clientContact}
                        onChange={(e) => setClientContact(e.target.value)}
                        placeholder="John Doe"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-content-neutral-700">
                        Category
                      </span>
                      <select
                        aria-label="New client category"
                        className="ui-field w-full px-3.5"
                        value={clientCategory}
                        onChange={(e) => setClientCategory(e.target.value)}
                      >
                        {[
                          "Enterprise",
                          "Corporate",
                          "Small Business",
                          "Startup",
                          "Retainer",
                        ].map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </label>

                    <label className="col-span-2 flex items-center gap-2 pt-1 text-xs text-content-neutral-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveAsPermanentClient}
                        onChange={(e) =>
                          setSaveAsPermanentClient(e.target.checked)
                        }
                        className="w-4 h-4 rounded border-line-neutral-300 text-purple-600 focus:ring-purple-500/20 cursor-pointer accent-purple-600"
                      />
                      <span>
                        Save to permanent clients directory (uncheck for
                        temporary one-off client)
                      </span>
                    </label>
                    <PhoneField
                      label="Phone number"
                      value={clientPhone}
                      onChange={setClientPhone}
                    />
                    <PhoneField
                      label="WhatsApp number"
                      value={clientWhatsApp}
                      onChange={setClientWhatsApp}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                        Target Client{" "}
                        <span className="text-content-rose-500 font-bold">
                          *
                        </span>
                      </label>
                      <select
                        required
                        value={newClientId}
                        onChange={(e) => {
                          const cid = e.target.value;
                          setNewClientId(cid);
                          const chosen = clients.find((c) => c.id === cid);
                          if (chosen) {
                            setNewCurrency(chosen.currency);
                            if (chosen.driveUrl)
                              setNewDeliveryUrl(chosen.driveUrl);
                          }
                        }}
                        className="ui-field w-full px-3.5 border border-line-neutral-200 text-content-neutral-900 focus:outline-none focus:ring-2 focus:ring-accent/40 cursor-pointer"
                      >
                        <option value="">Select a client...</option>
                        {clients
                          .filter((c) => !c.archivedAt)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.currency})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                        Invoice Code{" "}
                        <span className="text-content-rose-500 font-bold">
                          *
                        </span>
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
                  </div>
                )}

                {/* Currency & Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="new-invoice-currency" className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                      Currency
                    </label>
                    <select
                      id="new-invoice-currency"
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
                </div>

                {/* Itemized Services / Deliverables */}
                <div className="space-y-2.5 pt-2 border-t border-line-neutral-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-content-neutral-700">
                        Itemized Services & Deliverables{" "}
                        <span className="text-content-rose-500 font-bold">
                          *
                        </span>
                      </h4>
                      <p className="text-[11px] text-content-neutral-400">
                        Each item will become a tracked task upon advance
                        payment.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="secondary"
                        size="small"
                        type="button"
                        onClick={handleOpenImportTasksModal}
                        className="text-xs gap-1.5 border-accent/30 text-accent hover:bg-accent/10"
                        title="Import completed unbilled tasks from your Kanban board"
                      >
                        <ListChecks className="w-3.5 h-3.5" />
                        <span>Import Completed Tasks</span>
                        {allUnbilledTasks.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-accent/15 text-accent text-[10px] font-bold tabular-nums">
                            {allUnbilledTasks.length}
                          </span>
                        )}
                      </Button>

                      {catalogItems.length > 0 && (
                        <div className="w-52">
                          <select
                            aria-label="Add service from catalog"
                            className="ui-field w-full px-3.5 text-xs"
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                handleCatalogSelect(e.target.value);
                                e.target.value = "";
                              }
                            }}
                          >
                            <option value="" disabled>
                              + Add from Catalog...
                            </option>
                            {catalogItems.map((ci) => (
                              <option key={ci.id} value={ci.id}>
                                {ci.title} ({ci.currency} {ci.price})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {newLineItems.map((item, index) => {
                      const q = item.quantity > 0 ? item.quantity : 1;
                      const p = parseFloat(item.unitPrice) || 0;
                      const lineTotal = q * p;

                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 p-2.5 rounded-xl border border-line-neutral-200 bg-surface-neutral-50/50"
                        >
                          <span className="text-[11px] font-bold text-content-neutral-400 w-4">
                            {index + 1}.
                          </span>

                          <input
                            type="text"
                            required
                            placeholder="Deliverable description (e.g. Business website development)"
                            value={item.description}
                            onChange={(e) =>
                              handleUpdateLineItem(item.id, {
                                description: e.target.value,
                              })
                            }
                            className="ui-field flex-1 px-3.5"
                          />

                          <div className="w-20">
                            <input
                              type="number"
                              min="1"
                              required
                              placeholder="Qty"
                              value={item.quantity}
                              onChange={(e) =>
                                handleUpdateLineItem(item.id, {
                                  quantity: parseInt(e.target.value, 10) || 1,
                                })
                              }
                              className="ui-field w-full px-2 text-center"
                            />
                          </div>

                          <div className="w-28">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              required
                              placeholder="Unit Price"
                              value={item.unitPrice}
                              onChange={(e) =>
                                handleUpdateLineItem(item.id, {
                                  unitPrice: e.target.value,
                                })
                              }
                              className="ui-field w-full px-3.5"
                            />
                          </div>

                          <div className="w-24 text-right font-semibold text-content-neutral-800 text-xs">
                            {formatCents(
                              Math.round(lineTotal * 100),
                              newCurrency,
                            )}
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            disabled={newLineItems.length <= 1}
                            onClick={() => handleRemoveLineItem(item.id)}
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-content-rose-500" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    variant="secondary"
                    type="button"
                    onClick={handleAddLineItem}
                    className="text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Deliverable</span>
                  </Button>
                </div>

                {/* Delivery Link */}
                <div className="space-y-1.5 pt-2 border-t border-line-neutral-100">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500">
                    Delivery Location URL (Google Drive, GitHub repo, or Staging
                    URL)
                  </label>
                  <input
                    type="url"
                    value={newDeliveryUrl}
                    onChange={(e) => setNewDeliveryUrl(e.target.value)}
                    placeholder={
                      settings?.defaultDeliveryUrl ||
                      "https://drive.google.com/drive/folders/..."
                    }
                    className="ui-field w-full px-3.5 font-mono text-xs"
                  />
                  <p className="text-[11px] text-content-neutral-400">
                    Links directly to client deliverables, PDF invoice, and
                    tasks board.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1 text-xs font-medium">
                    <span>Online payment URL</span>
                    <input
                      type="url"
                      className="ui-field w-full"
                      placeholder="https://"
                      value={newPaymentUrl}
                      onChange={(event) => setNewPaymentUrl(event.target.value)}
                    />
                  </label>
                  <InvoiceWorkflowSelect
                    value={newWorkflowStage}
                    onChange={setNewWorkflowStage}
                  />
                </div>

                {/* Financial Summary & 50% Advance Requirement Box */}
                <div className="p-4 rounded-xl border border-line-neutral-200 bg-surface-neutral-50/80 space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="space-y-1">
                      <span className="text-[11px] uppercase font-bold text-content-neutral-500">
                        Discount ({newCurrency})
                      </span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="e.g. 10000 (First-time client discount)"
                        value={newDiscount}
                        onChange={(e) => setNewDiscount(e.target.value)}
                        className="ui-field w-full px-3.5"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-[11px] uppercase font-bold text-content-neutral-500">
                        Tax Rate (%)
                      </span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0"
                        value={newTaxRate}
                        onChange={(e) => setNewTaxRate(e.target.value)}
                        className="ui-field w-full px-3.5"
                      />
                    </label>
                  </div>

                  <div className="pt-2 border-t border-line-neutral-200/60 space-y-1.5 text-xs">
                    <div className="flex justify-between text-content-neutral-600">
                      <span>Services Subtotal:</span>
                      <span>
                        {formatCents(
                          Math.round(itemsSubtotal * 100),
                          newCurrency,
                        )}
                      </span>
                    </div>

                    {discountVal > 0 && (
                      <div className="flex justify-between text-content-emerald-700 font-medium">
                        <span>Discount:</span>
                        <span>
                          -
                          {formatCents(
                            Math.round(discountVal * 100),
                            newCurrency,
                          )}
                        </span>
                      </div>
                    )}

                    {taxVal > 0 && (
                      <div className="flex justify-between text-content-neutral-600">
                        <span>Tax ({newTaxRate}%):</span>
                        <span>
                          +{formatCents(Math.round(taxVal * 100), newCurrency)}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between text-sm font-bold text-content-neutral-900 pt-1 border-t border-line-neutral-200">
                      <span>Final Invoice Total:</span>
                      <span>
                        {formatCents(
                          Math.round(calculatedTotal * 100),
                          newCurrency,
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Advance Deposit Section */}
                  <div className="pt-3 border-t border-line-neutral-200/80 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-content-neutral-900">
                      <input
                        type="checkbox"
                        checked={requireAdvance}
                        onChange={(e) => setRequireAdvance(e.target.checked)}
                        className="w-4 h-4 rounded border-line-neutral-300 text-purple-600 focus:ring-purple-500/20 cursor-pointer accent-purple-600"
                      />
                      <span>
                        Require 50% advance deposit before starting work
                      </span>
                    </label>

                    {requireAdvance && (
                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-surface-amber-50/60 border border-border-amber-200 text-xs">
                        <div>
                          <span className="text-[11px] text-content-amber-800 block">
                            Advance Due (50%):
                          </span>
                          <span className="font-bold text-content-amber-900 text-sm">
                            {formatCents(
                              Math.round(advanceAmountDue * 100),
                              newCurrency,
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-content-neutral-600 block">
                            Remaining on Delivery:
                          </span>
                          <span className="font-bold text-content-neutral-800 text-sm">
                            {formatCents(
                              Math.round(balanceAmountDue * 100),
                              newCurrency,
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                    Job Notes & Payment Instructions
                  </label>
                  <textarea
                    rows={2}
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="e.g. Please transfer the 50% advance to start website development."
                    className="ui-field w-full px-3.5 py-2.5 text-xs resize-none"
                  />
                </div>

                {/* Actions */}
              </div>
              <div className="app-dialog-footer">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => closeAddInvoiceModal()}
                >
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    const targetClient = clients.find(
                      (c) => c.id === newClientId,
                    );
                    const draftPreview: InvoiceWithClient = {
                      id: "draft-preview",
                      code: newCode || "INV-DRAFT",
                      clientName:
                        targetClient?.name || clientName || "Client Name",
                      clientEmail: targetClient?.email || clientEmail || "",
                      clientId: newClientId || null,
                      currency: newCurrency,
                      status: newStatus,
                      issueDate: new Date().toISOString(),
                      dueDate:
                        newDueDate ||
                        new Date(Date.now() + 14 * 86400000).toISOString(),
                      amountCents: Math.round(calculatedTotal * 100),
                      advanceCents: requireAdvance
                        ? Math.round(advanceAmountDue * 100)
                        : 0,
                      paidCents: 0,
                      taxCents: Math.round(taxVal * 100),
                      discountCents: Math.round(discountVal * 100),
                      notes: newNotes,
                      deliveryUrl:
                        newDeliveryUrl || settings?.defaultDeliveryUrl,
                      paymentUrl: newPaymentUrl || null,
                      workflowStage: newWorkflowStage,
                      items: newLineItems.map((li, idx) => ({
                        id: li.id || `it-${idx}`,
                        invoiceId: "draft-preview",
                        description: li.description || "Service item",
                        quantity: li.quantity || 1,
                        unitPriceCents: parseAmountToCents(li.unitPrice),
                        position: idx,
                      })),
                      payments: [],
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    };
                    setPreviewInvoice(draftPreview);
                  }}
                  className="gap-1.5"
                >
                  <Eye className={`w-3.5 h-3.5 ${ACCENT_ICON_CLASS}`} />
                  <span>Preview Design</span>
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={isSubmittingNew}
                >
                  {isSubmittingNew
                    ? "Exporting PDF..."
                    : "Create Invoice & Export PDF"}
                </Button>
              </div>
            </form>
          </Dialog>
        )}
      </MotionPresence>

      {/* Import Completed Tasks Modal */}
      <MotionPresence>
        {showImportTasksModal && (
          <ImportCompletedTasksModal
            activeDraftClientObj={activeDraftClientObj}
            clientMode={clientMode}
            clientName={clientName}
            newCurrency={newCurrency}
            allUnbilledTasks={allUnbilledTasks}
            clientFilteredUnbilledTasks={clientFilteredUnbilledTasks}
            displayedImportTasks={displayedImportTasks}
            importTasksShowAllClients={importTasksShowAllClients}
            setImportTasksShowAllClients={setImportTasksShowAllClients}
            selectedImportTaskIds={selectedImportTaskIds}
            importTaskFees={importTaskFees}
            setImportTaskFees={setImportTaskFees}
            getTaskDefaultFee={getTaskDefaultFee}
            onToggleTask={handleToggleImportTask}
            onSelectAll={handleSelectAllImportTasks}
            onDeselectAll={handleDeselectAllImportTasks}
            onImportSelected={handleImportSelectedTasks}
            onClose={() => setShowImportTasksModal(false)}
          />
        )}
      </MotionPresence>

      {/* Record Payment Modal */}
      <MotionPresence>
        {showPaymentModal && paymentInvoice && (
          <Dialog
            onClose={() => {
              setShowPaymentModal(false);
              setSelectedSlip(null);
            }}
            width={560}
          >
            <div className="app-dialog-header">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-surface-emerald-100 text-content-emerald-800 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-content-neutral-900">
                    Record Payment
                  </h3>
                  <p className="text-xs text-content-neutral-400">
                    {paymentInvoice.code} · {paymentInvoice.clientName}
                  </p>
                </div>
              </div>
            </div>
            <form onSubmit={handlePaymentSubmit} className="app-dialog-form">
              <div className="app-dialog-body">
                {/* Financial context */}
                <div className="p-3 rounded-xl bg-surface-neutral-50 border border-line-neutral-200/80 space-y-1.5">
                  <div className="flex justify-between text-content-neutral-600">
                    <span>Total Billed:</span>
                    <span>
                      {formatCents(
                        paymentInvoice.amountCents,
                        paymentInvoice.currency,
                      )}
                    </span>
                  </div>
                  {paymentInvoice.advanceCents ? (
                    <div className="flex justify-between text-content-amber-800 font-medium">
                      <span>Required Advance:</span>
                      <span>
                        {formatCents(
                          paymentInvoice.advanceCents,
                          paymentInvoice.currency,
                        )}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex justify-between text-content-emerald-700 font-medium">
                    <span>Already Paid:</span>
                    <span>
                      {formatCents(
                        paymentInvoice.paidCents || 0,
                        paymentInvoice.currency,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-content-neutral-900 font-bold pt-1 border-t border-line-neutral-200">
                    <span>Remaining Balance:</span>
                    <span>
                      {formatCents(
                        Math.max(
                          0,
                          paymentInvoice.amountCents -
                            (paymentInvoice.paidCents || 0),
                        ),
                        paymentInvoice.currency,
                      )}
                    </span>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex gap-2">
                  {paymentInvoice.advanceCents &&
                    (paymentInvoice.paidCents || 0) <
                      paymentInvoice.advanceCents && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="small"
                        onClick={() =>
                          setPaymentAmount(
                            (
                              (paymentInvoice.advanceCents! -
                                (paymentInvoice.paidCents || 0)) /
                              100
                            ).toFixed(2),
                          )
                        }
                      >
                        Fill Advance (
                        {formatCents(
                          paymentInvoice.advanceCents -
                            (paymentInvoice.paidCents || 0),
                          paymentInvoice.currency,
                        )}
                        )
                      </Button>
                    )}

                  <Button
                    type="button"
                    variant="secondary"
                    size="small"
                    onClick={() =>
                      setPaymentAmount(
                        (
                          Math.max(
                            0,
                            paymentInvoice.amountCents -
                              (paymentInvoice.paidCents || 0),
                          ) / 100
                        ).toFixed(2),
                      )
                    }
                  >
                    Fill Full Balance
                  </Button>
                </div>

                {/* Fields */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500">
                    Amount Received ({paymentInvoice.currency}){" "}
                    <span className="text-content-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="ui-field w-full px-3.5"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500">
                      Payment Date{" "}
                      <span className="text-content-rose-500 font-bold">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="ui-field w-full px-3.5 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500">
                      Reference / Slip #
                    </label>
                    <input
                      type="text"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="e.g. SLIP-2026-001"
                      className="ui-field w-full px-3.5"
                    />
                  </div>
                </div>

                {/* Payment Slip / Receipt Upload Zone */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500">
                      Payment Slip / Receipt Proof{" "}
                      <span className="text-content-neutral-400 font-normal lowercase">
                        (optional)
                      </span>
                    </label>
                    {selectedSlip && (
                      <span className="text-[11px] font-medium text-content-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ready to attach
                      </span>
                    )}
                  </div>

                  <input
                    ref={slipFileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    onChange={handleSlipInputChange}
                    className="hidden"
                  />

                  {!selectedSlip ? (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingSlip(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        setIsDraggingSlip(false);
                      }}
                      onDrop={handleSlipDrop}
                      onClick={handlePickReceipt}
                      className={`p-4 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-2 text-center ${
                        isDraggingSlip
                          ? "border-accent bg-accent/5 ring-2 ring-accent/20"
                          : "border-line-neutral-200 hover:border-accent/50 bg-surface-neutral-50/50 hover:bg-surface-neutral-100/50"
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-surface-neutral-100 flex items-center justify-center text-content-neutral-500">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-content-neutral-800">
                          Click, drag &amp; drop, or paste (Cmd/Ctrl+V) payment slip
                        </p>
                        <p className="text-[11px] text-content-neutral-400">
                          Images auto-scan via local OCR to fill amount, date &amp; reference
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 rounded-xl border border-line-neutral-200 bg-surface-neutral-50/70">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <div className="w-8 h-8 rounded-lg bg-surface-purple-100 text-content-purple-700 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-semibold text-content-neutral-900 truncate">
                              {selectedSlip.name}
                            </p>
                            <p className="text-[11px] text-content-neutral-400">
                              {(selectedSlip.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isElectron &&
                            !selectedSlip.name.toLowerCase().endsWith(".pdf") && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="small"
                                disabled={isScanningSlip}
                                onClick={() =>
                                  void runSlipOcrScan({
                                    stagedToken: selectedSlip.path,
                                    fileName: selectedSlip.name,
                                  })
                                }
                                className="text-xs h-7 px-2 text-accent"
                                title="Re-read amount, date, and reference with local OCR"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>Re-scan</span>
                              </Button>
                            )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="small"
                            onClick={handlePickReceipt}
                            className="text-xs h-7 px-2"
                          >
                            Change
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedSlip(null);
                              setSlipScanResult(null);
                              setSlipScanError(null);
                            }}
                            className="w-7 h-7 text-content-neutral-400 hover:text-content-rose-600"
                            aria-label="Remove attached file"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {isScanningSlip && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border-accent bg-accent-faint/40 text-xs text-accent">
                          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                          <span>Reading bank transfer slip with offline OCR…</span>
                        </div>
                      )}

                      {!isScanningSlip && slipScanResult && (
                        <div
                          className={`rounded-xl border px-3 py-2 text-xs space-y-1 ${
                            slipScanResult.mismatch
                              ? "border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200"
                              : "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 font-medium">
                            <span className="flex items-center gap-1.5">
                              {slipScanResult.mismatch ? (
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              )}
                              <span>
                                {slipScanResult.bankName
                                  ? `${slipScanResult.bankName} · `
                                  : ""}
                                {slipScanResult.matchLabel ||
                                  (slipScanResult.mismatch
                                    ? "Amount / currency check warning"
                                    : "Slip scanned & fields updated")}
                              </span>
                            </span>
                            <span className="text-[10.5px] opacity-75 tabular-nums">
                              {(slipScanResult.durationMs / 1000).toFixed(1)}s
                            </span>
                          </div>
                          {slipScanResult.mismatch && (
                            <p className="text-[11.5px]">
                              {slipScanResult.mismatch.message}
                            </p>
                          )}
                          {slipScanResult.warnings.map((w, idx) => (
                            <p key={idx} className="text-[11px] opacity-85">
                              {w}
                            </p>
                          ))}
                        </div>
                      )}

                      {!isScanningSlip && slipScanError && (
                        <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/25 px-3 py-2 text-[11.5px] text-amber-800 dark:text-amber-200 flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{slipScanError}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
              </div>
              <div className="app-dialog-footer">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setSelectedSlip(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={isSubmittingPayment}
                >
                  {isSubmittingPayment ? "Recording..." : "Record Payment"}
                </Button>
              </div>
            </form>
          </Dialog>
        )}
      </MotionPresence>

      {/* Payment Inspection & Receipts Modal */}
      <MotionPresence>
        {inspectingInvoice && (
          <PaymentInspectionModal
            invoice={inspectingInvoice}
            paymentAttachments={paymentAttachments}
            isLoadingAttachments={isLoadingAttachments}
            isElectron={isElectron}
            workflow={workflow}
            onClose={() => setInspectingInvoice(null)}
            onUpdateInvoice={(updated) => setInspectingInvoice(updated)}
            onRefresh={refresh}
            onAttachReceipt={(paymentId) => handleAttachReceiptToPayment(paymentId)}
            onToast={(msg) => showToast(msg)}
          />
        )}
      </MotionPresence>

      {/* Edit Invoice Modal */}
      <MotionPresence>
        {editingInvoice && (
          <Dialog onClose={() => setEditingInvoice(null)} width={820}>
            <div className="app-dialog-header">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent-faint text-accent flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-content-neutral-900">
                    Edit Invoice
                  </h3>
                  <p className="text-xs text-content-neutral-400">
                    Modify itemized deliverables, pricing, and terms for{" "}
                    {editingInvoice.code}.
                  </p>
                </div>
              </div>
            </div>
            <form onSubmit={handleEditSubmit} className="app-dialog-form">
              <div className="app-dialog-body">
                <div className="app-dialog-section p-6 space-y-4 text-xs font-medium text-content-neutral-700 overflow-y-auto flex-1">
                  {/* Invoice Code & Client & Currency */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                        Invoice Code{" "}
                        <span className="text-content-rose-500 font-bold">
                          *
                        </span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editCode}
                        onChange={(e) => setEditCode(e.target.value)}
                        className="ui-field w-full px-3.5 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                        Client
                      </label>
                      <select
                        value={editClientId}
                        onChange={(e) => {
                          const cid = e.target.value;
                          setEditClientId(cid);
                          const chosen = clients.find((c) => c.id === cid);
                          if (chosen) {
                            setEditCurrency(chosen.currency);
                            if (chosen.driveUrl)
                              setEditDeliveryUrl(chosen.driveUrl);
                          }
                        }}
                        className="ui-field w-full px-3.5 cursor-pointer"
                      >
                        <option value="">(Temporary / Unlinked Client)</option>
                        {clients
                          .filter((c) => !c.archivedAt || c.id === editClientId)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.currency})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="edit-invoice-currency" className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                        Currency
                      </label>
                      <select
                        id="edit-invoice-currency"
                        value={editCurrency}
                        onChange={(e) =>
                          setEditCurrency(e.target.value as Currency)
                        }
                        className="ui-field w-full px-3.5 cursor-pointer"
                      >
                        <option value="LKR">LKR (Rs.)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="CAD">CAD (CA$)</option>
                      </select>
                    </div>
                  </div>

                  {/* Due Date & Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                        className="ui-field w-full px-3.5 cursor-pointer"
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
                        className="ui-field w-full px-3.5 cursor-pointer"
                      >
                        <option value="DRAFT">DRAFT</option>
                        <option value="UNPAID">UNPAID</option>
                        <option value="ADVANCE_PAID">ADVANCE_PAID</option>
                        <option value="PAID">PAID</option>
                        <option value="OVERDUE">OVERDUE</option>
                      </select>
                    </div>
                  </div>

                  {/* Itemized Services / Deliverables */}
                  <div className="space-y-2.5 pt-2 border-t border-line-neutral-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-content-neutral-700">
                          Itemized Services & Deliverables{" "}
                          <span className="text-content-rose-500 font-bold">
                            *
                          </span>
                        </h4>
                        <p className="text-[11px] text-content-neutral-400">
                          Modify line items, quantities, or prices.
                        </p>
                      </div>

                      {catalogItems.length > 0 && (
                        <div className="w-52">
                          <select
                            aria-label="Add service from catalog"
                            className="ui-field w-full px-3.5 text-xs"
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                handleEditCatalogSelect(e.target.value);
                                e.target.value = "";
                              }
                            }}
                          >
                            <option value="" disabled>
                              + Add from Catalog...
                            </option>
                            {catalogItems.map((ci) => (
                              <option key={ci.id} value={ci.id}>
                                {ci.title} ({ci.currency} {ci.price})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      {editLineItems.map((item, index) => {
                        const q = item.quantity > 0 ? item.quantity : 1;
                        const p = parseFloat(item.unitPrice) || 0;
                        const lineTotal = q * p;

                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-2 p-2.5 rounded-xl border border-line-neutral-200 bg-surface-neutral-50/50"
                          >
                            <span className="text-[11px] font-bold text-content-neutral-400 w-4">
                              {index + 1}.
                            </span>

                            <input
                              type="text"
                              required
                              placeholder="Deliverable description"
                              value={item.description}
                              onChange={(e) =>
                                handleUpdateEditLineItem(item.id, {
                                  description: e.target.value,
                                })
                              }
                              className="ui-field flex-1 px-3.5"
                            />

                            <div className="w-20">
                              <input
                                type="number"
                                min="1"
                                required
                                placeholder="Qty"
                                value={item.quantity}
                                onChange={(e) =>
                                  handleUpdateEditLineItem(item.id, {
                                    quantity: parseInt(e.target.value, 10) || 1,
                                  })
                                }
                                className="ui-field w-full px-2 text-center"
                              />
                            </div>

                            <div className="w-28">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                required
                                placeholder="Unit Price"
                                value={item.unitPrice}
                                onChange={(e) =>
                                  handleUpdateEditLineItem(item.id, {
                                    unitPrice: e.target.value,
                                  })
                                }
                                className="ui-field w-full px-3.5"
                              />
                            </div>

                            <div className="w-24 text-right font-semibold text-content-neutral-800 text-xs">
                              {formatCents(
                                Math.round(lineTotal * 100),
                                editCurrency,
                              )}
                            </div>

                            <Button
                              variant="ghost"
                              size="icon"
                              type="button"
                              disabled={editLineItems.length <= 1}
                              onClick={() => handleRemoveEditLineItem(item.id)}
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-content-rose-500" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>

                    <Button
                      variant="secondary"
                      type="button"
                      onClick={handleAddEditLineItem}
                      className="text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Another Deliverable</span>
                    </Button>
                  </div>

                  {/* Delivery Link */}
                  <div className="space-y-1.5 pt-2 border-t border-line-neutral-100">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500">
                      Delivery Location URL (Google Drive, GitHub repo, or
                      Staging URL)
                    </label>
                    <input
                      type="url"
                      value={editDeliveryUrl}
                      onChange={(e) => setEditDeliveryUrl(e.target.value)}
                      placeholder={
                        settings?.defaultDeliveryUrl ||
                        "https://drive.google.com/drive/folders/..."
                      }
                      className="ui-field w-full px-3.5 font-mono text-xs"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-1 text-xs font-medium">
                      <span>Online payment URL</span>
                      <input
                        type="url"
                        className="ui-field w-full"
                        placeholder="https://"
                        value={editPaymentUrl}
                        onChange={(event) =>
                          setEditPaymentUrl(event.target.value)
                        }
                      />
                    </label>
                    <InvoiceWorkflowSelect
                      value={editWorkflowStage}
                      onChange={setEditWorkflowStage}
                    />
                  </div>

                  {/* Financial Summary & Advance Requirement Box */}
                  <div className="p-4 rounded-xl border border-line-neutral-200 bg-surface-neutral-50/80 space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="space-y-1">
                        <span className="text-[11px] uppercase font-bold text-content-neutral-500">
                          Discount ({editCurrency})
                        </span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0"
                          value={editDiscount}
                          onChange={(e) => setEditDiscount(e.target.value)}
                          className="ui-field w-full px-3.5"
                        />
                      </label>

                      <label className="space-y-1">
                        <span className="text-[11px] uppercase font-bold text-content-neutral-500">
                          Tax Rate (%)
                        </span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0"
                          value={editTaxRate}
                          onChange={(e) => setEditTaxRate(e.target.value)}
                          className="ui-field w-full px-3.5"
                        />
                      </label>
                    </div>

                    <div className="pt-2 border-t border-line-neutral-200/60 space-y-1.5 text-xs">
                      <div className="flex justify-between text-content-neutral-600">
                        <span>Services Subtotal:</span>
                        <span>
                          {formatCents(
                            Math.round(editItemsSubtotal * 100),
                            editCurrency,
                          )}
                        </span>
                      </div>

                      {editDiscountVal > 0 && (
                        <div className="flex justify-between text-content-emerald-700 font-medium">
                          <span>Discount:</span>
                          <span>
                            -
                            {formatCents(
                              Math.round(editDiscountVal * 100),
                              editCurrency,
                            )}
                          </span>
                        </div>
                      )}

                      {editTaxVal > 0 && (
                        <div className="flex justify-between text-content-neutral-600">
                          <span>Tax:</span>
                          <span>
                            +
                            {formatCents(
                              Math.round(editTaxVal * 100),
                              editCurrency,
                            )}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between text-content-neutral-900 font-bold text-sm pt-1 border-t border-line-neutral-200">
                        <span>Final Invoice Total:</span>
                        <span>
                          {formatCents(
                            Math.round(editCalculatedTotal * 100),
                            editCurrency,
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Advance / Deposit Requirement */}
                    <div className="pt-2 border-t border-line-neutral-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editRequireAdvance}
                            onChange={(e) =>
                              setEditRequireAdvance(e.target.checked)
                            }
                            className="w-4 h-4 rounded border-line-neutral-300 text-purple-600 focus:ring-purple-500/20 cursor-pointer accent-purple-600"
                          />
                          <span className="text-xs font-semibold text-content-neutral-800">
                            Require Upfront Advance / Deposit
                          </span>
                        </label>

                        {editRequireAdvance && (
                          <div className="flex items-center gap-1.5 text-xs text-content-neutral-600">
                            <span>Deposit:</span>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={editAdvancePercent}
                              onChange={(e) =>
                                setEditAdvancePercent(
                                  Math.min(
                                    100,
                                    Math.max(
                                      1,
                                      parseInt(e.target.value, 10) || 50,
                                    ),
                                  ),
                                )
                              }
                              className="ui-field w-14 text-center py-1 px-1.5 text-xs font-semibold"
                            />
                            <span>%</span>
                          </div>
                        )}
                      </div>

                      {editRequireAdvance && (
                        <div className="grid grid-cols-2 gap-2 text-xs bg-surface p-2.5 rounded-lg border border-line-neutral-200">
                          <div>
                            <div className="text-[10px] text-content-neutral-400 uppercase font-bold">
                              Advance Required Now ({editAdvancePercent}%)
                            </div>
                            <div className="font-bold text-accent text-sm">
                              {formatCents(
                                Math.round(editAdvanceAmountDue * 100),
                                editCurrency,
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] text-content-neutral-400 uppercase font-bold">
                              Remaining Balance
                            </div>
                            <div className="font-semibold text-content-neutral-800 text-sm">
                              {formatCents(
                                Math.round(editBalanceAmountDue * 100),
                                editCurrency,
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Job Notes */}
                  <div className="space-y-1.5 pt-2 border-t border-line-neutral-100">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500">
                      Payment Instructions & Job Notes
                    </label>
                    <textarea
                      rows={2}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Bank account details, delivery scope, or client payment terms..."
                      className="ui-field w-full px-3.5 py-2.5 text-xs resize-none"
                    />
                  </div>
                </div>
              </div>
              <div className="app-dialog-footer">
                <Button
                  variant="secondary"
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
          </Dialog>
        )}
      </MotionPresence>

      <MotionPresence>
        {bulkStatusIds.length > 0 && (
          <InvoiceStatusBulk
            ids={bulkStatusIds}
            onClose={() => setBulkStatusIds([])}
            onSaved={async () => {
              await refresh();
              setBulkStatusIds([]);
              setSelectedIds([]);
              showToast("Invoice statuses updated.");
            }}
          />
        )}
      </MotionPresence>

      <MotionPresence>
        {showTrash && (
          <InvoiceTrash
            onClose={() => setShowTrash(false)}
            onRestore={refresh}
          />
        )}
        {trashTargets.length > 0 && (
          <Dialog onClose={() => setTrashTargets([])} width={460} compact>
            <div className="app-dialog-body app-dialog-confirmation">
              <h3 className="text-base font-semibold text-content-neutral-900">
                {isElectron ? "Move invoices to Trash?" : "Delete invoice?"}
              </h3>
              <p className="text-sm text-content-neutral-600 mt-2">
                {isElectron
                  ? `${trashTargets.length} selected. Only invoices without payment history or contractor work orders can move to Trash. Restore them from Trash at any time.`
                  : "This removes the invoice from the browser preview."}
              </p>
            </div>
            <div className="app-dialog-footer">
              <Button
                variant="secondary"
                disabled={movingToTrash}
                onClick={() => setTrashTargets([])}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={movingToTrash}
                onClick={() => void confirmDelete()}
              >
                {isElectron ? "Move to Trash" : "Delete"}
              </Button>
            </div>
          </Dialog>
        )}
      </MotionPresence>

      {/* Overdue Invoices Summary & Collections Modal */}
      {showOverdueSummary && (
        <OverdueSummaryDialog
          isOpen={showOverdueSummary}
          onClose={() => setShowOverdueSummary(false)}
          invoices={allInvoices}
          primaryCurrency={primaryCurrency}
          freelancerName={settings?.businessName || ""}
          paymentInstructions={settings?.paymentDetails}
          onFilterToOverdue={() => setActiveTab("Overdue")}
          onInspectInvoice={(inv) => setInspectingInvoice(inv)}
          showToast={showToast}
        />
      )}

      {/* Floating Backdrop for outside clicks */}
      {(actionMenu || statusMenu) && (
        <div
          className="fixed inset-0 z-40 bg-transparent cursor-default"
          onClick={() => {
            setActionMenu(null);
            setStatusMenu(null);
          }}
          aria-hidden="true"
        />
      )}

      {/* Floating Status Menu */}
      <AnimatePresence initial={false}>
        {statusMenu && (
          <m.div
            key={`status-menu-${statusMenu.invoice.id}`}
            initial={{
              opacity: 0,
              scale: POPOVER_INITIAL_SCALE,
              y: statusMenu.bottom !== undefined ? 6 : -6,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              transition: SPRING_MENU_POPOVER,
            }}
            exit={{
              opacity: 0,
              scale: POPOVER_INITIAL_SCALE,
              y: statusMenu.bottom !== undefined ? 6 : -6,
              transition: EXIT_MENU_POPOVER,
            }}
            style={{
              position: "fixed",
              top:
                statusMenu.top !== undefined
                  ? `${statusMenu.top}px`
                  : undefined,
              bottom:
                statusMenu.bottom !== undefined
                  ? `${statusMenu.bottom}px`
                  : undefined,
              left: `${statusMenu.left}px`,
              transformOrigin:
                statusMenu.bottom !== undefined ? "bottom left" : "top left",
            }}
            className="z-50 bg-surface rounded-xl border border-line-neutral-200 py-1.5 w-60 text-xs font-medium text-content-neutral-700 text-left shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06),_0px_6px_6px_-3px_rgba(0,0,0,0.06),0px_12px_12px_-6px_rgba(0,0,0,0.06),0px_24px_24px_-12px_rgba(0,0,0,0.06)]"
            role="menu"
          >
            <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-content-neutral-400 tracking-wider border-b border-line-neutral-100 mb-1">
              Change Status · {statusMenu.invoice.code}
            </div>
            {[
              {
                value: "UNPAID",
                label: "Unpaid",
                desc: "No payments recorded yet",
                dot: "bg-accent",
              },
              {
                value: "ADVANCE_PAID",
                label: "Advance Paid",
                desc: "Deposit received, ready to track",
                dot: "bg-amber-500",
              },
              {
                value: "PAID",
                label: "Paid",
                desc: "Fully settled invoice",
                dot: "bg-emerald-500",
              },
              {
                value: "OVERDUE",
                label: "Overdue",
                desc: "Past agreed payment date",
                dot: "bg-rose-500",
              },
              {
                value: "DRAFT",
                label: "Draft",
                desc: "Estimate or unfinalized invoice",
                dot: "bg-neutral-400",
              },
            ].map((opt, idx) => {
              const isCurrent = statusMenu.invoice.status === opt.value;
              return (
                <m.button
                  key={opt.value}
                  type="button"
                  role="menuitem"
                  initial={{ opacity: 0, y: -3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={listRowTransition(idx)}
                  onClick={() =>
                    void handleChangeStatus(
                      statusMenu.invoice.id,
                      opt.value as InvoiceStatus,
                    )
                  }
                  className={`w-full px-3 py-2 hover:bg-surface-neutral-50 flex items-center justify-between text-left cursor-pointer transition-colors ${
                    isCurrent
                      ? "bg-surface-neutral-50/80 font-semibold text-accent"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block w-2 h-2 rounded-full shrink-0 ${opt.dot}`}
                    />
                    <div>
                      <div className="text-xs leading-none">{opt.label}</div>
                      <div className="text-[10px] text-content-neutral-400 mt-0.5 leading-tight">
                        {opt.desc}
                      </div>
                    </div>
                  </div>
                  {isCurrent && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0 ml-2" />
                  )}
                </m.button>
              );
            })}
          </m.div>
        )}
      </AnimatePresence>

      {/* Floating Actions Menu */}
      <AnimatePresence initial={false}>
        {actionMenu && (
          <m.div
            key={`action-menu-${actionMenu.invoice.id}`}
            initial={{
              opacity: 0,
              scale: POPOVER_INITIAL_SCALE,
              y: actionMenu.bottom !== undefined ? 6 : -6,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              transition: SPRING_MENU_POPOVER,
            }}
            exit={{
              opacity: 0,
              scale: POPOVER_INITIAL_SCALE,
              y: actionMenu.bottom !== undefined ? 6 : -6,
              transition: EXIT_MENU_POPOVER,
            }}
            style={{
              position: "fixed",
              top:
                actionMenu.top !== undefined
                  ? `${actionMenu.top}px`
                  : undefined,
              bottom:
                actionMenu.bottom !== undefined
                  ? `${actionMenu.bottom}px`
                  : undefined,
              right: `${actionMenu.right}px`,
              transformOrigin:
                actionMenu.bottom !== undefined ? "bottom right" : "top right",
            }}
            className="z-50 bg-surface rounded-xl border border-line-neutral-200 py-1.5 w-52 text-xs font-medium text-content-neutral-700 text-left shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06),_0px_6px_6px_-3px_rgba(0,0,0,0.06),0px_12px_12px_-6px_rgba(0,0,0,0.06),0px_24px_24px_-12px_rgba(0,0,0,0.06)] max-h-[85vh] overflow-y-auto"
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                const inv = actionMenu.invoice;
                setActionMenu(null);
                setPreviewInvoice(inv);
              }}
              className="w-full px-3.5 py-1.5 hover:bg-surface-neutral-50 flex items-center gap-2 cursor-pointer transition-colors text-content-neutral-900 font-semibold"
            >
              <Eye className={`w-3.5 h-3.5 ${ACCENT_ICON_CLASS}`} />
              <span>View Invoice Design</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                const inv = actionMenu.invoice;
                setActionMenu(null);
                setMarginDrawerInvoice(inv);
              }}
              className="w-full px-3.5 py-1.5 hover:bg-surface-neutral-50 flex items-center gap-2 cursor-pointer transition-colors text-content-neutral-900 font-semibold"
            >
              <TrendingUp className={`w-3.5 h-3.5 ${ACCENT_ICON_CLASS}`} />
              <span>Project Margin (P&amp;L)</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                const inv = actionMenu.invoice;
                setActionMenu(null);
                void handleOpenPdf(inv);
              }}
              className="w-full px-3.5 py-1.5 hover:bg-surface-neutral-50 flex items-center gap-2 cursor-pointer transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-content-neutral-500" />
              <span>Open PDF</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                const inv = actionMenu.invoice;
                setActionMenu(null);
                void handleRevealPdf(inv);
              }}
              className="w-full px-3.5 py-1.5 hover:bg-surface-neutral-50 flex items-center gap-2 cursor-pointer transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5 text-content-neutral-500" />
              <span>Reveal PDF in folder</span>
            </button>

            {isElectron && (
              <button
                type="button"
                role="menuitem"
                onClick={() => void prepareShare(actionMenu.invoice.id)}
                className="w-full px-3.5 py-1.5 hover:bg-surface-neutral-50 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-content-neutral-500" />
                <span>Prepare PDF and copy share message</span>
              </button>
            )}

            {actionMenu.invoice.payments &&
              actionMenu.invoice.payments.length > 0 && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    const inv = actionMenu.invoice;
                    setActionMenu(null);
                    handleOpenInspector(inv);
                  }}
                  className="w-full px-3.5 py-1.5 hover:bg-surface-neutral-50 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Paperclip className="w-3.5 h-3.5 text-content-neutral-500" />
                  <span>
                    Payments & Receipts ({actionMenu.invoice.payments.length})
                  </span>
                </button>
              )}

            <div className="my-1 border-t border-line-neutral-100" />

            {!actionMenu.invoice.clientId && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const inv = actionMenu.invoice;
                  setActionMenu(null);
                  void handlePromoteClient(inv);
                }}
                className="w-full px-3.5 py-1.5 hover:bg-surface-neutral-50 flex items-center gap-2 cursor-pointer text-accent font-semibold transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5 text-accent" />
                <span>Save as Permanent Client</span>
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                const inv = actionMenu.invoice;
                setActionMenu(null);
                void handleCopyInvoiceSummary(inv);
              }}
              className="w-full px-3.5 py-1.5 hover:bg-surface-neutral-50 flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-content-neutral-400" />
              <span>Copy Payment Summary</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                const inv = actionMenu.invoice;
                setActionMenu(null);
                void handleDuplicateInvoice(inv);
              }}
              className="w-full px-3.5 py-1.5 hover:bg-surface-neutral-50 flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Receipt className="w-3.5 h-3.5 text-content-neutral-400" />
              <span>Duplicate as Draft</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                const inv = actionMenu.invoice;
                setActionMenu(null);
                handleOpenEdit(inv);
              }}
              className="w-full px-3.5 py-1.5 hover:bg-surface-neutral-50 flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Pencil className="w-3.5 h-3.5 text-content-neutral-400" />
              <span>Edit Details</span>
            </button>

            <div className="my-1 border-t border-line-neutral-100" />
            <div className="px-3 py-1 text-[10px] uppercase font-bold text-content-neutral-400 tracking-wider">
              Change Status
            </div>
            {(
              [
                { value: "UNPAID", label: "UNPAID" },
                { value: "ADVANCE_PAID", label: "ADVANCE PAID" },
                { value: "PAID", label: "PAID" },
                { value: "OVERDUE", label: "OVERDUE" },
                { value: "DRAFT", label: "DRAFT" },
              ] as { value: InvoiceStatus; label: string }[]
            ).map((s) => (
              <button
                key={s.value}
                type="button"
                role="menuitem"
                onClick={() =>
                  void handleChangeStatus(actionMenu.invoice.id, s.value)
                }
                className={`w-full px-3.5 py-1.5 hover:bg-surface-neutral-50 flex items-center justify-between cursor-pointer transition-colors ${
                  actionMenu.invoice.status === s.value
                    ? "font-bold text-accent"
                    : ""
                }`}
              >
                <span>{s.label}</span>
                {actionMenu.invoice.status === s.value && (
                  <CheckCircle2 className="w-3 h-3 text-accent" />
                )}
              </button>
            ))}

            <div className="my-1 border-t border-line-neutral-100" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                const inv = actionMenu.invoice;
                setActionMenu(null);
                setTrashTargets([inv.id]);
              }}
              className="w-full px-3.5 py-1.5 hover:bg-surface-rose-50 text-content-rose-600 flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-content-rose-500" />
              <span>{isElectron ? "Move to Trash" : "Delete Invoice"}</span>
            </button>
          </m.div>
        )}
      </AnimatePresence>

      {/* Visual Invoice Document Sheet Modal (from EPS template) */}
      <MotionPresence>
        {previewInvoice && (
          <InvoiceDocumentSheet
            invoice={previewInvoice}
            onClose={() => setPreviewInvoice(null)}
            onOpenPdf={() => {
              const inv = previewInvoice;
              if (inv.id === "sample-preview" || inv.id === "draft-preview") {
                window.print();
              } else {
                void handleOpenPdf(inv);
              }
            }}
            onRecordPayment={() => {
              const inv = previewInvoice;
              setPreviewInvoice(null);
              if (inv.id !== "sample-preview" && inv.id !== "draft-preview") {
                handleOpenPayment(inv);
              }
            }}
          />
        )}
      </MotionPresence>
      <MotionPresence>
        {isExportDialogOpen && (
          <Dialog
            onClose={() => setIsExportDialogOpen(false)}
            width={420}
            compact
          >
            <div className="app-dialog-header">
              <div>
                <h2 className="text-[17px] font-medium tracking-[-0.02em] text-content-neutral-950">
                  {activeTab === "Overdue"
                    ? "Export Overdue Report"
                    : "Export Invoices"}
                </h2>
                <p className="text-xs text-content-neutral-500 mt-0.5">
                  {activeTab === "Overdue"
                    ? "Choose a format for your overdue aging summary"
                    : `${filteredInvoices.length} ${
                        filteredInvoices.length === 1 ? "invoice" : "invoices"
                      } in current view (${activeTab})`}
                </p>
              </div>
            </div>

            <div className="app-dialog-body space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  handleExportInvoicesCsv(
                    activeTab === "Overdue" ? "overdue" : "current",
                    "csv",
                  );
                  setIsExportDialogOpen(false);
                }}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-[16px] bg-[var(--ui-surface-pure)] border border-[var(--ui-border)] hover:border-border-accent transition-all text-left cursor-pointer"
              >
                <span className="w-10 h-10 rounded-[12px] bg-accent/12 text-accent flex items-center justify-center shrink-0">
                  <Download className="w-4.5 h-4.5" strokeWidth={1.9} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium text-content-neutral-950">
                    Export as CSV (.csv)
                  </div>
                  <div className="text-[12px] text-content-neutral-500">
                    Standard RFC 4180 spreadsheet format for bookkeeping
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleExportInvoicesCsv(
                    activeTab === "Overdue" ? "overdue" : "current",
                    "excel",
                  );
                  setIsExportDialogOpen(false);
                }}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-[16px] bg-[var(--ui-surface-pure)] border border-[var(--ui-border)] hover:border-border-accent transition-all text-left cursor-pointer"
              >
                <span className="w-10 h-10 rounded-[12px] bg-surface-neutral-100 text-content-neutral-800 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-4.5 h-4.5" strokeWidth={1.9} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium text-content-neutral-950">
                    Export as Excel (.xls)
                  </div>
                  <div className="text-[12px] text-content-neutral-500">
                    Formatted Microsoft Excel workbook with summary totals
                  </div>
                </div>
              </button>
            </div>

            <div className="app-dialog-footer">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setIsExportDialogOpen(false)}
              >
                Close
              </Button>
            </div>
          </Dialog>
        )}
      </MotionPresence>
      <MotionPresence>
        {marginDrawerInvoice && (
          <ProjectMarginDrawer
            mode="invoice"
            invoice={marginDrawerInvoice}
            onClose={() => setMarginDrawerInvoice(null)}
          />
        )}
      </MotionPresence>
    </div>
  );
}
