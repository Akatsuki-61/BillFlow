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
  FileText,
  ExternalLink,
  CreditCard,
  FolderOpen,
  Paperclip,
  UserPlus,
} from "lucide-react";
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
  Currency,
} from "@/types/billing";
import type { AttachmentItem } from "@/types/workflow";

type FilterTab = "All Invoices" | "Advance Paid" | "Drafts" | "Overdue" | "Paid";

interface LineItemDraft {
  id: string;
  catalogId?: string;
  description: string;
  quantity: number;
  unitPrice: string;
}

function InvoicesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

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
  } = useInvoices();

  const { clients } = useClients();
  const { catalogItems } = useCatalog();
  const { settings } = useSettings();
  const { workflow, activeCurrency } = useData();

  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [clientCategory, setClientCategory] = useState("Enterprise");
  const [saveAsPermanentClient, setSaveAsPermanentClient] = useState(true);
  const requestId = useRef<string | null>(null);

  const [activeTab, setActiveTab] = useState<FilterTab>("All Invoices");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [expiredInvoiceHighlight, setExpiredInvoiceHighlight] = useState<
    string | null
  >(null);

  // Add Invoice Modal state
  const [showAddInvoiceModal, setShowAddInvoiceModal] = useState<boolean>(false);
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
  const [newNotes, setNewNotes] = useState("");
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  // Edit Invoice Modal state
  const [editingInvoice, setEditingInvoice] = useState<InvoiceWithClient | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editClientId, setEditClientId] = useState("");
  const [editCurrency, setEditCurrency] = useState<Currency>("LKR");
  const [editDueDate, setEditDueDate] = useState("");
  const [editStatus, setEditStatus] = useState<InvoiceStatus>("UNPAID");
  const [editDeliveryUrl, setEditDeliveryUrl] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editLineItems, setEditLineItems] = useState<LineItemDraft[]>([]);
  const [editDiscount, setEditDiscount] = useState("");
  const [editTaxRate, setEditTaxRate] = useState("");
  const [editRequireAdvance, setEditRequireAdvance] = useState(true);
  const [editAdvancePercent, setEditAdvancePercent] = useState(50);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Delete Confirm Modal state
  const [deletingInvoice, setDeletingInvoice] = useState<InvoiceWithClient | null>(null);

  // Record Payment Modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<InvoiceWithClient | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [attachSlipDirectly, setAttachSlipDirectly] = useState(true);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Payment Inspection Modal state
  const [inspectingInvoice, setInspectingInvoice] = useState<InvoiceWithClient | null>(null);
  const [paymentAttachments, setPaymentAttachments] = useState<Record<string, AttachmentItem[]>>({});
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
      if (linkedClient) {
        setNewCurrency(linkedClient.currency);
        if (linkedClient.driveUrl) setNewDeliveryUrl(linkedClient.driveUrl);
      }
    }
  }

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
          const list = await workflow.attachments.list({ type: "payment", id: p.id });
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
    setClientMode(clients.length ? "existing" : "new");
    setNewCurrency(settings?.defaultCurrency || activeCurrency || "USD");
    const due = new Date();
    due.setDate(due.getDate() + (settings?.defaultDueDays ?? 14));
    setNewDueDate(due.toISOString().slice(0, 10));
    setNewLineItems([{ id: "1", description: "", quantity: 1, unitPrice: "" }]);
    setNewDiscount("");
    setNewTaxRate("");
    setRequireAdvance(true);
    setAdvancePercent(50);
    setSaveAsPermanentClient(true);
    setNewDeliveryUrl("");
    setNewNotes("");

    try {
      const code = await getNextInvoiceCode();
      setNewCode(code);
    } catch {
      setNewCode(`INV-${new Date().getFullYear()}-001`);
    }

    if (clientFilterParam) {
      setNewClientId(clientFilterParam);
      const match = clients.find((c) => c.id === clientFilterParam);
      if (match) {
        setNewCurrency(match.currency);
        if (match.driveUrl) setNewDeliveryUrl(match.driveUrl);
      }
    } else if (clients.length > 0 && !newClientId) {
      setNewClientId(clients[0].id);
      setNewCurrency(clients[0].currency);
      if (clients[0].driveUrl) setNewDeliveryUrl(clients[0].driveUrl);
    }

    setShowAddInvoiceModal(true);
  };

  // Filter invoices according to selected client and tabs
  const filteredInvoices = allInvoices.filter((inv) => {
    if (clientFilterParam && inv.clientId !== clientFilterParam) {
      return false;
    }
    if (activeTab === "Advance Paid") return inv.status === "ADVANCE_PAID";
    if (activeTab === "Drafts") return inv.status === "DRAFT";
    if (activeTab === "Overdue") return inv.status === "OVERDUE";
    if (activeTab === "Paid") return inv.status === "PAID";
    return true;
  });

  const activeClientFilterObj = clientFilterParam
    ? clients.find((c) => c.id === clientFilterParam)
    : null;

  // Compute live totals for metric cards
  const primaryCurrency = activeCurrency || settings?.defaultCurrency || clients[0]?.currency || "USD";

  const totalOutstandingCents = allInvoices.reduce((sum, inv) => {
    if (inv.status !== "DRAFT") {
      return sum + Math.max(0, inv.amountCents - (inv.paidCents || 0));
    }
    return sum;
  }, 0);

  const totalOverdueCents = allInvoices.reduce((sum, inv) => {
    if (inv.status === "OVERDUE") {
      return sum + Math.max(0, inv.amountCents - (inv.paidCents || 0));
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

  const handlePromoteClient = async (inv: InvoiceWithClient) => {
    try {
      await promoteClient(inv.id);
      setOpenMenuId(null);
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
    setEditingInvoice(inv);
    setEditCode(inv.code);
    setEditClientId(inv.clientId || "");
    setEditCurrency(inv.currency);
    setEditDueDate(inv.dueDate || "");
    setEditStatus(inv.status);
    setEditDeliveryUrl(inv.deliveryUrl || "");
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

    setEditDiscount(inv.discountCents ? (inv.discountCents / 100).toFixed(2) : "");
    const baseBeforeTax = Math.max(0, (inv.amountCents || 0) - (inv.taxCents || 0));
    setEditTaxRate(
      inv.taxCents && baseBeforeTax > 0
        ? ((inv.taxCents / baseBeforeTax) * 100).toFixed(1)
        : ""
    );
    if (inv.advanceCents && inv.advanceCents > 0) {
      setEditRequireAdvance(true);
      const pct = inv.amountCents > 0 ? Math.round((inv.advanceCents / inv.amountCents) * 100) : 50;
      setEditAdvancePercent(pct);
    } else {
      setEditRequireAdvance(false);
      setEditAdvancePercent(50);
    }

    setOpenMenuId(null);
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

  const handleUpdateEditLineItem = (id: string, updates: Partial<LineItemDraft>) => {
    setEditLineItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...updates } : it)),
    );
  };

  const handleEditCatalogSelect = (catalogId: string) => {
    const item = catalogItems.find((ci) => ci.id === catalogId);
    if (!item) return;
    setEditLineItems((prev) => {
      if (prev.length === 1 && !prev[0].description && !prev[0].unitPrice) {
        return [
          {
            id: prev[0].id,
            catalogId: item.id,
            description: item.title,
            quantity: 1,
            unitPrice: item.price,
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
          unitPrice: item.price,
        },
      ];
    });
    if (item.currency) {
      setEditCurrency(item.currency);
    }
  };

  // Math for Edit Invoice Modal
  const editItemsSubtotal = editLineItems.reduce((sum, it) => {
    const q = it.quantity > 0 ? it.quantity : 1;
    const p = parseFloat(it.unitPrice) || 0;
    return sum + q * p;
  }, 0);
  const editDiscountVal = parseFloat(editDiscount) || 0;
  const editTaxableSubtotal = Math.max(0, editItemsSubtotal - editDiscountVal);
  const editTaxVal = editTaxableSubtotal * ((parseFloat(editTaxRate) || 0) / 100);
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

      const finalAmountCents = parseAmountToCents(editCalculatedTotal.toFixed(2));
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

  // Line Items Handlers for Add Invoice
  const handleAddLineItem = () => {
    setNewLineItems((prev) => [
      ...prev,
      { id: String(Date.now()), description: "", quantity: 1, unitPrice: "" },
    ]);
  };

  const handleRemoveLineItem = (id: string) => {
    setNewLineItems((prev) =>
      prev.length > 1 ? prev.filter((it) => it.id !== id) : prev,
    );
  };

  const handleUpdateLineItem = (id: string, updates: Partial<LineItemDraft>) => {
    setNewLineItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...updates } : it)),
    );
  };

  const handleCatalogSelect = (catalogId: string) => {
    const item = catalogItems.find((ci) => ci.id === catalogId);
    if (!item) return;
    setNewLineItems((prev) => {
      if (prev.length === 1 && !prev[0].description && !prev[0].unitPrice) {
        return [
          {
            id: prev[0].id,
            catalogId: item.id,
            description: item.title,
            quantity: 1,
            unitPrice: item.price,
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
          unitPrice: item.price,
        },
      ];
    });
    if (item.currency) {
      setNewCurrency(item.currency);
    }
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
      const today = new Date().toISOString().split("T")[0];
      const itemsPayload = validItems.map((it) => ({
        catalogId: it.catalogId || undefined,
        description: it.description.trim(),
        quantity: it.quantity > 0 ? it.quantity : 1,
        unitPriceCents: parseAmountToCents(it.unitPrice || "0"),
      }));

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
                category: clientCategory,
                driveUrl: newDeliveryUrl.trim() || undefined,
              },
              saveAsPermanentClient,
            }
          : { clientId: newClientId }),
        code: newCode.trim() || undefined,
        title: validItems[0]?.description || undefined,
        items: itemsPayload,
        amountCents: finalAmountCents,
        discountCents,
        taxCents,
        advanceCents,
        deliveryUrl: newDeliveryUrl.trim() || undefined,
        notes: newNotes.trim() || undefined,
        currency: newCurrency,
        issueDate: today,
        dueDate: newDueDate || null,
        status: newStatus,
      });

      setShowAddInvoiceModal(false);
      requestId.current = null;
      setNewLineItems([{ id: "1", description: "", quantity: 1, unitPrice: "" }]);
      setNewDiscount("");
      setNewTaxRate("");
      setNewDeliveryUrl("");
      setNewNotes("");
      setNewDueDate("");
      setNewStatus("UNPAID");
      showToast(`Invoice ${created.code} created and PDF exported.`);
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
  const handleOpenPayment = (inv: InvoiceWithClient) => {
    setPaymentInvoice(inv);
    const today = new Date().toISOString().split("T")[0];
    setPaymentDate(today);

    const paid = inv.paidCents || 0;
    const advance = inv.advanceCents || 0;
    if (advance > 0 && paid < advance) {
      setPaymentAmount(((advance - paid) / 100).toFixed(2));
    } else {
      setPaymentAmount((Math.max(0, inv.amountCents - paid) / 100).toFixed(2));
    }
    setPaymentReference(`SLIP-${Date.now().toString().slice(-4)}`);
    setAttachSlipDirectly(true);
    setShowPaymentModal(true);
    setOpenMenuId(null);
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

      showToast(
        `Recorded payment of ${formatCents(amountCents, paymentInvoice.currency)} for ${paymentInvoice.code}.`,
      );
      setShowPaymentModal(false);

      if (attachSlipDirectly && workflow) {
        try {
          const slip = await workflow.attachments.select(
            { type: "payment", id: res.payment.id },
            crypto.randomUUID(),
          );
          if (slip) {
            showToast(`Payment slip "${slip.originalName}" attached.`);
          }
        } catch {
          // File dialog cancelled or failed
        }
      }
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
      const msg = err instanceof Error ? err.message : "Could not open invoice PDF";
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
    setOpenMenuId(null);
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
        description="Manage itemized billing, advance deposits, vector PDF exports, and payments."
      >
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
            footer="awaiting collection"
          />
          <MetricCard
            label="Overdue"
            value={formatCents(totalOverdueCents, primaryCurrency)}
            tone="warning"
            footer="past payment due date"
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
              [
                "All Invoices",
                "Advance Paid",
                "Drafts",
                "Overdue",
                "Paid",
              ] as FilterTab[]
            ).map((value) => ({ value, label: value }))}
          />
        </div>
      </div>

      {/* Main Table Card */}
      <div className="ui-card overflow-hidden mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line-neutral-200/80 bg-surface-neutral-50/50 text-[11px] font-bold uppercase tracking-wider text-content-neutral-500">
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
                <th className="py-4 px-4 font-bold">Services & Deliverables</th>
                <th className="py-4 px-4 font-bold">Amount & Balance</th>
                <th className="py-4 px-4 font-bold">Due Date</th>
                <th className="py-4 px-4 font-bold">Status</th>
                <th className="py-4 pr-6 pl-4 text-right w-36">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-neutral-100/80">
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
                  const balanceDueCents = Math.max(
                    0,
                    inv.amountCents - (inv.paidCents || 0),
                  );

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
                        <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                          {inv.clientId ? (
                            <Button
                              variant="ghost"
                              type="button"
                              onClick={() =>
                                router.push(`/clients?client=${inv.clientId}`)
                              }
                              className="p-0 h-auto font-medium text-left"
                            >
                              {inv.clientName}
                            </Button>
                          ) : (
                            <>
                              <span className="font-medium text-content-neutral-900 text-sm">
                                {inv.clientName}
                              </span>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-neutral-100 text-content-neutral-600 border border-line-neutral-200">
                                Temporary Client
                              </span>
                            </>
                          )}
                        </div>
                        {(() => {
                          const resolved = resolveDeliveryUrl(inv, { clients });
                          if (!resolved.hasLink) return null;
                          return (
                            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-accent">
                              <ExternalLink className="w-3 h-3 shrink-0" />
                              <button
                                type="button"
                                onClick={(e) => openExternalLink(resolved.formattedUrl, e)}
                                className="hover:underline truncate max-w-[180px] text-left text-accent font-medium bg-transparent border-0 p-0 cursor-pointer"
                                title={`${resolved.label}: ${resolved.url}`}
                              >
                                {resolved.label}
                              </button>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Services & Deliverables */}
                      <td className="py-4.5 px-4 max-w-xs">
                        {inv.items && inv.items.length > 0 ? (
                          <div className="space-y-1">
                            {inv.items.slice(0, 2).map((item, idx) => (
                              <div
                                key={item.id || idx}
                                className="text-xs text-content-neutral-800 truncate"
                                title={item.description}
                              >
                                • {item.description}
                                {item.quantity > 1 ? ` (×${item.quantity})` : ""}
                              </div>
                            ))}
                            {inv.items.length > 2 && (
                              <div className="text-[11px] text-content-neutral-400 italic">
                                +{inv.items.length - 2} more deliverable(s)
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-content-neutral-500 truncate block">
                            {inv.title || "Custom software freelancing work"}
                          </span>
                        )}
                      </td>

                      {/* Amount & Balance */}
                      <td className="py-4.5 px-4">
                        <div className="text-sm font-semibold text-content-neutral-900 leading-tight">
                          {formatCents(inv.amountCents, inv.currency)}
                        </div>
                        <div className="text-[11px] text-content-neutral-500 mt-0.5 flex flex-col gap-0.5">
                          {inv.advanceCents ? (
                            <span>
                              Advance: {formatCents(inv.advanceCents, inv.currency)}
                            </span>
                          ) : null}
                          {inv.paidCents > 0 ? (
                            <span className="text-content-emerald-700 font-medium">
                              Paid: {formatCents(inv.paidCents, inv.currency)}
                            </span>
                          ) : null}
                          {balanceDueCents > 0 && inv.paidCents > 0 ? (
                            <span className="text-content-amber-700">
                              Bal: {formatCents(balanceDueCents, inv.currency)}
                            </span>
                          ) : null}
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
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            inv.status === "PAID"
                              ? "bg-surface-emerald-100 text-content-emerald-800 border border-border-emerald-300"
                              : inv.status === "ADVANCE_PAID"
                                ? "bg-surface-amber-100 text-content-amber-800 border border-border-amber-300"
                                : inv.status === "OVERDUE"
                                  ? "bg-surface-rose-100 text-content-rose-800 border border-border-rose-300 font-bold"
                                  : inv.status === "DRAFT"
                                    ? "bg-surface-neutral-100 text-content-neutral-600 border border-line-neutral-200"
                                    : "bg-surface-blue-100 text-content-blue-800 border border-border-blue-300"
                          }`}
                        >
                          {inv.status === "ADVANCE_PAID"
                            ? "Advance Paid"
                            : inv.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4.5 pr-6 pl-4 text-right relative">
                        <div className="flex items-center justify-end gap-1.5">
                          {inv.status !== "PAID" && inv.status !== "DRAFT" && (
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={() => handleOpenPayment(inv)}
                              title="Record advance or remaining payment"
                              className="text-xs"
                            >
                              <CreditCard className="w-3.5 h-3.5 text-accent" />
                              <span>Pay</span>
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            onClick={() => handleOpenPdf(inv)}
                            title="Open Invoice PDF"
                          >
                            <FileText className="w-4 h-4 text-content-neutral-600" />
                          </Button>

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
                        </div>

                        {isMenuOpen && (
                          <div className="absolute right-6 top-10 z-40 bg-surface rounded-xl shadow-xl border border-line-neutral-200 py-1.5 w-48 text-xs font-medium text-content-neutral-700 text-left">
                            <button
                              type="button"
                              onClick={() => handleOpenPdf(inv)}
                              className="w-full px-3.5 py-1.5 hover:bg-surface-neutral-50 flex items-center gap-2 cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5 text-content-neutral-500" />
                              <span>Open PDF</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRevealPdf(inv)}
                              className="w-full px-3.5 py-1.5 hover:bg-surface-neutral-50 flex items-center gap-2 cursor-pointer"
                            >
                              <FolderOpen className="w-3.5 h-3.5 text-content-neutral-500" />
                              <span>Reveal PDF in folder</span>
                            </button>

                            {inv.payments && inv.payments.length > 0 && (
                              <button
                                type="button"
                                onClick={() => handleOpenInspector(inv)}
                                className="w-full px-3.5 py-1.5 hover:bg-surface-neutral-50 flex items-center gap-2 cursor-pointer"
                              >
                                <Paperclip className="w-3.5 h-3.5 text-content-neutral-500" />
                                <span>Payments & Receipts ({inv.payments.length})</span>
                              </button>
                            )}

                            <div className="my-1 border-t border-line-neutral-100" />

                            {!inv.clientId && (
                              <button
                                type="button"
                                onClick={() => handlePromoteClient(inv)}
                                className="w-full px-3.5 py-1.5 hover:bg-surface-neutral-50 flex items-center gap-2 cursor-pointer text-accent font-semibold"
                              >
                                <UserPlus className="w-3.5 h-3.5 text-accent" />
                                <span>Save as Permanent Client</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenEdit(inv)}
                              className="w-full px-3.5 py-1.5 hover:bg-surface-neutral-50 flex items-center gap-2 cursor-pointer"
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
                                "UNPAID",
                                "ADVANCE_PAID",
                                "PAID",
                                "OVERDUE",
                                "DRAFT",
                              ] as InvoiceStatus[]
                            ).map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => handleChangeStatus(inv.id, s)}
                                className={`w-full px-3.5 py-1.5 hover:bg-surface-neutral-50 flex items-center justify-between cursor-pointer ${
                                  inv.status === s ? "font-bold text-accent" : ""
                                }`}
                              >
                                <span>{s === "ADVANCE_PAID" ? "ADVANCE PAID" : s}</span>
                                {inv.status === s && (
                                  <CheckCircle2 className="w-3 h-3 text-accent" />
                                )}
                              </button>
                            ))}

                            <div className="my-1 border-t border-line-neutral-100" />
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingInvoice(inv);
                                setOpenMenuId(null);
                              }}
                              className="w-full px-3.5 py-1.5 hover:bg-surface-rose-50 text-content-rose-600 flex items-center gap-2 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-content-rose-500" />
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

      {/* Add Invoice Modal with Itemized Services, Advance & PDF Export */}
      <MotionPresence>
        {showAddInvoiceModal && (
          <MotionSurface
            kind="dialog"
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          >
            <MotionSurface
              onDismiss={() => setShowAddInvoiceModal(false)}
              kind="panel"
              className="bg-surface rounded-2xl w-full max-w-2xl shadow-2xl border border-line-neutral-200 overflow-hidden my-8"
            >
              <div className="px-6 py-5 border-b border-line-neutral-100 flex items-center justify-between bg-surface-neutral-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-accent-faint text-accent flex items-center justify-center">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-content-neutral-900">
                      Create New Invoice & Export PDF
                    </h3>
                    <p className="text-xs text-content-neutral-400">
                      Add itemized services, require a 50% advance, and generate an A4 vector PDF.
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
                className="p-6 space-y-5 text-xs font-medium text-content-neutral-700 max-h-[80vh] overflow-y-auto"
              >
                {/* Client Selection */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500">
                    Client Selection
                  </label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={clientMode === "existing" ? "primary" : "secondary"}
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
                      <span>Client name *</span>
                      <input
                        aria-label="New client name"
                        className="ui-field w-full"
                        required
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="e.g. Acme Studio"
                      />
                    </label>
                    <label className="space-y-1">
                      <span>Email *</span>
                      <input
                        aria-label="New client email"
                        className="ui-field w-full"
                        type="email"
                        required
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        placeholder="client@acme.com"
                      />
                    </label>
                    <label className="space-y-1">
                      <span>Contact person</span>
                      <input
                        aria-label="New client contact"
                        className="ui-field w-full"
                        value={clientContact}
                        onChange={(e) => setClientContact(e.target.value)}
                        placeholder="John Doe"
                      />
                    </label>
                    <label className="space-y-1">
                      <span>Category</span>
                      <select
                        aria-label="New client category"
                        className="ui-field w-full"
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
                        onChange={(e) => setSaveAsPermanentClient(e.target.checked)}
                        className="w-4 h-4 rounded border-line-neutral-300 text-accent focus:ring-accent/20 cursor-pointer accent-neutral-900"
                      />
                      <span>Save to permanent clients directory (uncheck for temporary one-off client)</span>
                    </label>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                        Target Client *
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
                            if (chosen.driveUrl) setNewDeliveryUrl(chosen.driveUrl);
                          }
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
                  </div>
                )}

                {/* Currency & Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                      Currency
                    </label>
                    <select
                      value={newCurrency}
                      onChange={(e) => setNewCurrency(e.target.value as Currency)}
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
                        Itemized Services & Deliverables *
                      </h4>
                      <p className="text-[11px] text-content-neutral-400">
                        Each item will become a tracked task upon advance payment.
                      </p>
                    </div>

                    {catalogItems.length > 0 && (
                      <div className="w-56">
                        <select
                          className="ui-field w-full text-xs"
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
                            className="ui-field flex-1"
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
                              className="ui-field w-full text-center"
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
                              className="ui-field w-full"
                            />
                          </div>

                          <div className="w-24 text-right font-semibold text-content-neutral-800 text-xs">
                            {formatCents(Math.round(lineTotal * 100), newCurrency)}
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
                    Delivery Location URL (Google Drive, GitHub repo, or Staging URL)
                  </label>
                  <input
                    type="url"
                    value={newDeliveryUrl}
                    onChange={(e) => setNewDeliveryUrl(e.target.value)}
                    placeholder="https://drive.google.com/drive/folders/... or https://github.com/..."
                    className="ui-field w-full font-mono text-xs"
                  />
                  <p className="text-[11px] text-content-neutral-400">
                    Links directly to client deliverables, PDF invoice, and tasks board.
                  </p>
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
                        className="ui-field w-full"
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
                        className="ui-field w-full"
                      />
                    </label>
                  </div>

                  <div className="pt-2 border-t border-line-neutral-200/60 space-y-1.5 text-xs">
                    <div className="flex justify-between text-content-neutral-600">
                      <span>Services Subtotal:</span>
                      <span>
                        {formatCents(Math.round(itemsSubtotal * 100), newCurrency)}
                      </span>
                    </div>

                    {discountVal > 0 && (
                      <div className="flex justify-between text-content-emerald-700 font-medium">
                        <span>Discount:</span>
                        <span>
                          -{formatCents(Math.round(discountVal * 100), newCurrency)}
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
                        {formatCents(Math.round(calculatedTotal * 100), newCurrency)}
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
                        className="w-4 h-4 rounded border-line-neutral-300 text-accent accent-neutral-900"
                      />
                      <span>Require 50% advance deposit before starting work</span>
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
                    className="ui-field w-full text-xs"
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-line-neutral-100">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setShowAddInvoiceModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" disabled={isSubmittingNew}>
                    {isSubmittingNew ? "Exporting PDF..." : "Create Invoice & Export PDF"}
                  </Button>
                </div>
              </form>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Record Payment Modal */}
      <MotionPresence>
        {showPaymentModal && paymentInvoice && (
          <MotionSurface
            kind="dialog"
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <MotionSurface
              onDismiss={() => setShowPaymentModal(false)}
              kind="panel"
              className="bg-surface rounded-2xl w-full max-w-md shadow-2xl border border-line-neutral-200 overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-line-neutral-100 flex items-center justify-between bg-surface-neutral-50/50">
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
                <Button
                  aria-label="Close"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPaymentModal(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <form
                onSubmit={handlePaymentSubmit}
                className="p-6 space-y-4 text-xs font-medium text-content-neutral-700"
              >
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
                    (paymentInvoice.paidCents || 0) < paymentInvoice.advanceCents && (
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
                    Amount Received ({paymentInvoice.currency}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="ui-field w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500">
                      Payment Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="ui-field w-full"
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
                      className="ui-field w-full"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={attachSlipDirectly}
                    onChange={(e) => setAttachSlipDirectly(e.target.checked)}
                    className="w-4 h-4 rounded border-line-neutral-300 text-accent accent-neutral-900"
                  />
                  <span>Attach payment slip / receipt file after recording</span>
                </label>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-line-neutral-100">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
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
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Payment Inspection & Receipts Modal */}
      <MotionPresence>
        {inspectingInvoice && (
          <MotionSurface
            kind="dialog"
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <MotionSurface
              onDismiss={() => setInspectingInvoice(null)}
              kind="panel"
              className="bg-surface rounded-2xl w-full max-w-lg shadow-2xl border border-line-neutral-200 overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-line-neutral-100 flex items-center justify-between bg-surface-neutral-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-surface-purple-100 text-content-purple-700 flex items-center justify-center">
                    <Paperclip className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-content-neutral-900">
                      Payments & Attached Receipts
                    </h3>
                    <p className="text-xs text-content-neutral-400">
                      {inspectingInvoice.code} · {inspectingInvoice.clientName}
                    </p>
                  </div>
                </div>
                <Button
                  aria-label="Close"
                  variant="ghost"
                  size="icon"
                  onClick={() => setInspectingInvoice(null)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {isLoadingAttachments ? (
                  <p className="text-xs text-content-neutral-500">Loading payment receipts...</p>
                ) : (!inspectingInvoice.payments || inspectingInvoice.payments.length === 0) ? (
                  <p className="text-xs text-content-neutral-500">
                    No payments have been recorded for this invoice yet.
                  </p>
                ) : (
                  inspectingInvoice.payments.map((payment, idx) => {
                    const slips = paymentAttachments[payment.id] || [];

                    return (
                      <div
                        key={payment.id || idx}
                        className="p-3.5 rounded-xl border border-line-neutral-200 bg-surface-neutral-50/60 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-content-neutral-900 text-sm">
                            {formatCents(payment.amountCents, payment.currency)}
                          </span>
                          <span className="text-[11px] text-content-neutral-500">
                            {formatDateDisplay(payment.receivedAt)}
                          </span>
                        </div>

                        {payment.reference && (
                          <div className="text-[11px] text-content-neutral-600 font-mono">
                            Ref: {payment.reference}
                          </div>
                        )}

                        {/* Attached slips */}
                        <div className="pt-2 border-t border-line-neutral-200/60">
                          {slips.length > 0 ? (
                            <div className="space-y-1.5">
                              {slips.map((att) => (
                                <div
                                  key={att.id}
                                  className="flex items-center justify-between p-2 rounded-lg bg-surface border border-line-neutral-200 text-xs"
                                >
                                  <div className="flex items-center gap-1.5 truncate">
                                    <Paperclip className="w-3.5 h-3.5 text-accent" />
                                    <span className="truncate">{att.originalName}</span>
                                    <span className="text-[10px] text-content-neutral-400">
                                      ({Math.round(att.sizeBytes / 1024)} KB)
                                    </span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="small"
                                    onClick={() => workflow?.attachments.open(att.id)}
                                  >
                                    View Slip
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-content-neutral-400 italic">
                                No payment slip attached.
                              </span>
                              <Button
                                variant="secondary"
                                size="small"
                                onClick={() => handleAttachReceiptToPayment(payment.id)}
                              >
                                Attach Slip
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="px-6 py-4 border-t border-line-neutral-100 flex justify-end">
                <Button
                  variant="primary"
                  type="button"
                  onClick={() => setInspectingInvoice(null)}
                >
                  Done
                </Button>
              </div>
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
              className="bg-surface rounded-2xl w-full max-w-2xl shadow-2xl border border-line-neutral-200 overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="px-6 py-5 border-b border-line-neutral-100 flex items-center justify-between bg-surface-neutral-50/50 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-accent-faint text-accent flex items-center justify-center">
                    <Pencil className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-content-neutral-900">
                      Edit Invoice
                    </h3>
                    <p className="text-xs text-content-neutral-400">
                      Modify itemized deliverables, pricing, and terms for {editingInvoice.code}.
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
                className="p-6 space-y-4 text-xs font-medium text-content-neutral-700 overflow-y-auto"
              >
                {/* Invoice Code & Client & Currency */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                      Invoice Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value)}
                      className="ui-field w-full font-mono"
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
                          if (chosen.driveUrl) setEditDeliveryUrl(chosen.driveUrl);
                        }
                      }}
                      className="ui-field w-full cursor-pointer"
                    >
                      <option value="">(Temporary / Unlinked Client)</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.currency})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                      Currency
                    </label>
                    <select
                      value={editCurrency}
                      onChange={(e) => setEditCurrency(e.target.value as Currency)}
                      className="ui-field w-full cursor-pointer"
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
                      className="ui-field w-full cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 mb-1.5">
                      Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as InvoiceStatus)}
                      className="ui-field w-full cursor-pointer"
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
                        Itemized Services & Deliverables *
                      </h4>
                      <p className="text-[11px] text-content-neutral-400">
                        Modify line items, quantities, or prices.
                      </p>
                    </div>

                    {catalogItems.length > 0 && (
                      <div className="w-52">
                        <select
                          className="ui-field w-full text-xs"
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
                            className="ui-field flex-1"
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
                              className="ui-field w-full text-center"
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
                              className="ui-field w-full"
                            />
                          </div>

                          <div className="w-24 text-right font-semibold text-content-neutral-800 text-xs">
                            {formatCents(Math.round(lineTotal * 100), editCurrency)}
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
                    Delivery Location URL (Google Drive, GitHub repo, or Staging URL)
                  </label>
                  <input
                    type="url"
                    value={editDeliveryUrl}
                    onChange={(e) => setEditDeliveryUrl(e.target.value)}
                    placeholder="https://drive.google.com/drive/folders/... or https://github.com/..."
                    className="ui-field w-full font-mono text-xs"
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
                        className="ui-field w-full"
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
                        className="ui-field w-full"
                      />
                    </label>
                  </div>

                  <div className="pt-2 border-t border-line-neutral-200/60 space-y-1.5 text-xs">
                    <div className="flex justify-between text-content-neutral-600">
                      <span>Services Subtotal:</span>
                      <span>
                        {formatCents(Math.round(editItemsSubtotal * 100), editCurrency)}
                      </span>
                    </div>

                    {editDiscountVal > 0 && (
                      <div className="flex justify-between text-content-emerald-700 font-medium">
                        <span>Discount:</span>
                        <span>
                          -{formatCents(Math.round(editDiscountVal * 100), editCurrency)}
                        </span>
                      </div>
                    )}

                    {editTaxVal > 0 && (
                      <div className="flex justify-between text-content-neutral-600">
                        <span>Tax:</span>
                        <span>
                          +{formatCents(Math.round(editTaxVal * 100), editCurrency)}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between text-content-neutral-900 font-bold text-sm pt-1 border-t border-line-neutral-200">
                      <span>Final Invoice Total:</span>
                      <span>
                        {formatCents(Math.round(editCalculatedTotal * 100), editCurrency)}
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
                          onChange={(e) => setEditRequireAdvance(e.target.checked)}
                          className="w-4 h-4 rounded border-line-neutral-300 text-accent focus:ring-accent/20 cursor-pointer accent-neutral-900"
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
                                Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 50))
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
                              editCurrency
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
                              editCurrency
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
                    className="ui-field w-full text-xs"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-line-neutral-100 shrink-0">
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
