"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowRightCircle,
  CheckCircle2,
  Eye,
  FilePlus2,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { MotionPresence } from "@/components/ui/MotionSurface";
import { Dialog } from "@/components/ui/Dialog";
import { Button, EmptyState } from "@/components/ui/Workspace";
import { useCatalog, useClients, useData, useQuotes, useSettings } from "@/lib/data/DataProvider";
import { formatCents, formatDateDisplay, parseAmountToCents } from "@/lib/format";
import { localDateKey } from "@/lib/visual-metrics";
import { useToast } from "@/context/ToastContext";
import type { Currency, InvoiceTemplateId, InvoiceWithClient } from "@/types/billing";
import type { QuoteStatus, QuoteWithClient } from "@/types/quotes";

const InvoiceDocumentSheet = dynamic(() => import("./InvoiceDocumentSheet"), {
  ssr: false,
  loading: () => null,
});

interface QuotesTabProps {
  onConvertedToInvoice?: (invoice: InvoiceWithClient) => void;
}

interface QuoteLineDraft {
  id: string;
  catalogId?: string | null;
  description: string;
  quantity: number;
  unitPrice: string;
}

const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  APPROVED: "Approved",
  DECLINED: "Declined",
  CONVERTED: "Converted",
};

const QUOTE_STATUS_CLASSES: Record<QuoteStatus, string> = {
  DRAFT: "bg-surface-neutral-100 text-content-neutral-700 border-line-neutral-200",
  SENT: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
  APPROVED: "bg-surface-emerald-50 text-content-emerald-700 border-line-emerald-200",
  DECLINED: "bg-surface-rose-50 text-content-rose-600 border-line-rose-200",
  CONVERTED: "bg-accent-faint text-accent-deep-solid border-border-accent dark:text-accent",
};

function defaultValidUntil(issueDate: string): string {
  const target = new Date(`${issueDate}T00:00:00Z`);
  if (Number.isNaN(target.getTime())) return issueDate;
  target.setUTCDate(target.getUTCDate() + 14);
  return target.toISOString().slice(0, 10);
}

function toPreviewInvoice(quote: QuoteWithClient): InvoiceWithClient {
  return {
    id: quote.id,
    code: quote.code,
    clientId: quote.clientId,
    title: quote.title ?? undefined,
    currency: quote.currency,
    discountCents: quote.discountCents,
    taxCents: quote.taxCents,
    advanceCents: quote.advanceCents,
    amountCents: quote.amountCents,
    paidCents: 0,
    issueDate: quote.issueDate,
    dueDate: quote.validUntil ?? null,
    status: "DRAFT",
    deliveryUrl: quote.deliveryUrl ?? null,
    notes: quote.notes ?? null,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
    clientName: quote.clientName,
    clientEmail: quote.clientEmail ?? undefined,
    clientPhone: quote.clientPhone ?? null,
    clientBillingAddress: quote.clientBillingAddress ?? null,
    clientContactPerson: quote.clientContactPerson ?? null,
    clientCategory: quote.clientCategory ?? null,
    items: quote.items.map((item) => ({
      id: item.id,
      invoiceId: quote.id,
      catalogId: item.catalogId ?? null,
      description: item.description,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      position: item.position,
    })),
    payments: [],
  };
}

export function QuotesTab({ onConvertedToInvoice }: QuotesTabProps) {
  const { showToast } = useToast();
  const { isElectron } = useData();
  const {
    quotes,
    getNextQuoteCode,
    createQuote,
    updateQuote,
    setQuoteStatus,
    deleteQuote,
    saveQuotePdfAs,
    openQuotePdf,
    convertQuoteToInvoice,
    refresh,
  } = useQuotes();
  const { clients } = useClients();
  const { catalogItems } = useCatalog();
  const { settings } = useSettings();

  const activeClients = useMemo(
    () => clients.filter((c) => !c.archivedAt),
    [clients],
  );

  const [statusFilter, setStatusFilter] = useState<"ALL" | QuoteStatus>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewQuote, setPreviewQuote] = useState<QuoteWithClient | null>(null);
  const [convertTarget, setConvertTarget] = useState<QuoteWithClient | null>(null);
  const [convertStatus, setConvertStatus] = useState<"UNPAID" | "DRAFT">("UNPAID");
  const [convertDueDate, setConvertDueDate] = useState("");
  const [isConverting, setIsConverting] = useState(false);

  // Create / Edit modal state
  const [editingQuote, setEditingQuote] = useState<QuoteWithClient | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formCode, setFormCode] = useState("");
  const [formClientId, setFormClientId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formCurrency, setFormCurrency] = useState<Currency>(
    settings?.defaultCurrency || "USD",
  );
  const [formIssueDate, setFormIssueDate] = useState(() => localDateKey());
  const [formValidUntil, setFormValidUntil] = useState(() =>
    defaultValidUntil(localDateKey()),
  );
  const [formTemplate, setFormTemplate] = useState<InvoiceTemplateId>(
    settings?.defaultInvoiceTemplate || "geometric-teal",
  );
  const [formDiscount, setFormDiscount] = useState("0");
  const [formTaxPercent, setFormTaxPercent] = useState(
    String(settings?.defaultTaxRate ?? 0),
  );
  const [formAdvancePercent, setFormAdvancePercent] = useState("50");
  const [formDeliveryUrl, setFormDeliveryUrl] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formItems, setFormItems] = useState<QuoteLineDraft[]>([
    { id: "line-1", description: "", quantity: 1, unitPrice: "0" },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  const openNewQuoteModal = async () => {
    const today = localDateKey();
    setEditingQuote(null);
    setFormClientId(activeClients[0]?.id || "");
    setFormTitle("");
    setFormCurrency(
      activeClients[0]?.currency || settings?.defaultCurrency || "USD",
    );
    setFormIssueDate(today);
    setFormValidUntil(defaultValidUntil(today));
    setFormTemplate(settings?.defaultInvoiceTemplate || "geometric-teal");
    setFormDiscount("0");
    setFormTaxPercent(String(settings?.defaultTaxRate ?? 0));
    setFormAdvancePercent("50");
    setFormDeliveryUrl("");
    setFormNotes("");
    setFormItems([{ id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: "0" }]);
    if (isElectron) {
      try {
        setFormCode(await getNextQuoteCode());
      } catch {
        setFormCode("");
      }
    }
    setIsFormOpen(true);
  };

  const openEditQuoteModal = (quote: QuoteWithClient) => {
    if (quote.status === "CONVERTED") return;
    setEditingQuote(quote);
    setFormCode(quote.code);
    setFormClientId(quote.clientId || "");
    setFormTitle(quote.title || "");
    setFormCurrency(quote.currency);
    setFormIssueDate(quote.issueDate);
    setFormValidUntil(quote.validUntil || "");
    setFormTemplate(
      (quote.template as InvoiceTemplateId) ||
        settings?.defaultInvoiceTemplate ||
        "geometric-teal",
    );
    setFormDiscount((quote.discountCents / 100).toFixed(2));
    const taxableBase = Math.max(
      1,
      quote.items.reduce((s, it) => s + it.quantity * it.unitPriceCents, 0) -
        quote.discountCents,
    );
    setFormTaxPercent(
      quote.taxCents > 0
        ? String(Math.round((quote.taxCents / taxableBase) * 1000) / 10)
        : "0",
    );
    setFormAdvancePercent(
      quote.amountCents > 0
        ? String(Math.round((quote.advanceCents / quote.amountCents) * 100))
        : "0",
    );
    setFormDeliveryUrl(quote.deliveryUrl || "");
    setFormNotes(quote.notes || "");
    setFormItems(
      quote.items.length > 0
        ? quote.items.map((it) => ({
            id: it.id,
            catalogId: it.catalogId,
            description: it.description,
            quantity: it.quantity,
            unitPrice: (it.unitPriceCents / 100).toFixed(2),
          }))
        : [{ id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: "0" }],
    );
    setIsFormOpen(true);
  };

  const subtotalCents = formItems.reduce(
    (sum, item) =>
      sum + Math.max(1, item.quantity || 1) * Math.max(0, parseAmountToCents(item.unitPrice)),
    0,
  );
  const discountCents = Math.min(subtotalCents, Math.max(0, parseAmountToCents(formDiscount)));
  const taxRate = Math.max(0, Number.parseFloat(formTaxPercent) || 0);
  const taxCents = Math.round(((subtotalCents - discountCents) * taxRate) / 100);
  const totalCents = subtotalCents - discountCents + taxCents;
  const advancePct = Math.max(0, Math.min(100, Number.parseFloat(formAdvancePercent) || 0));
  const advanceCents = Math.round((totalCents * advancePct) / 100);

  const handleSaveQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClientId && !editingQuote) {
      showToast("Select a client for this proposal.", "error");
      return;
    }
    const cleanItems = formItems
      .filter((item) => item.description.trim())
      .map((item) => ({
        description: item.description.trim(),
        quantity: Math.max(1, Math.round(item.quantity || 1)),
        unitPriceCents: Math.max(0, parseAmountToCents(item.unitPrice)),
        catalogId: item.catalogId || null,
      }));
    if (cleanItems.length === 0) {
      showToast("Add at least one scope line item.", "error");
      return;
    }

    setIsSaving(true);
    try {
      if (editingQuote) {
        await updateQuote(editingQuote.id, {
          clientId: formClientId || undefined,
          code: formCode.trim() || undefined,
          title: formTitle.trim() || undefined,
          items: cleanItems,
          discountCents,
          taxCents,
          advanceCents,
          amountCents: totalCents,
          currency: formCurrency,
          issueDate: formIssueDate,
          validUntil: formValidUntil || null,
          template: formTemplate,
          deliveryUrl: formDeliveryUrl.trim() || null,
          notes: formNotes.trim() || null,
        });
        showToast(`Updated proposal ${formCode || editingQuote.code}`);
      } else {
        const created = await createQuote({
          clientId: formClientId,
          code: formCode.trim() || undefined,
          title: formTitle.trim() || undefined,
          items: cleanItems,
          discountCents,
          taxCents,
          advanceCents,
          amountCents: totalCents,
          currency: formCurrency,
          issueDate: formIssueDate,
          validUntil: formValidUntil || null,
          status: "DRAFT",
          template: formTemplate,
          deliveryUrl: formDeliveryUrl.trim() || null,
          notes: formNotes.trim() || null,
        });
        showToast(`Created proposal ${created.code}`);
      }
      await refresh(["quotes"]);
      setIsFormOpen(false);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not save proposal.",
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (
    quote: QuoteWithClient,
    nextStatus: Exclude<QuoteStatus, "CONVERTED">,
  ) => {
    try {
      await setQuoteStatus(quote.id, nextStatus);
      await refresh(["quotes"]);
      showToast(`${quote.code} marked as ${QUOTE_STATUS_LABELS[nextStatus]}.`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to update proposal status.",
        "error",
      );
    }
  };

  const handleOpenConvertModal = (quote: QuoteWithClient) => {
    const today = localDateKey();
    const due = new Date(`${today}T00:00:00Z`);
    due.setUTCDate(due.getUTCDate() + (settings?.defaultDueDays ?? 14));
    setConvertTarget(quote);
    setConvertStatus("UNPAID");
    setConvertDueDate(due.toISOString().slice(0, 10));
  };

  const handleConfirmConvert = async () => {
    if (!convertTarget) return;
    setIsConverting(true);
    try {
      const result = await convertQuoteToInvoice({
        quoteId: convertTarget.id,
        status: convertStatus,
        dueDate: convertDueDate || null,
      });
      await refresh(["quotes", "invoices", "clients", "dashboard"]);
      setConvertTarget(null);
      showToast(
        `Converted ${result.quote.code} into invoice ${result.invoice.code}.`,
      );
      onConvertedToInvoice?.(result.invoice);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not convert proposal.",
        "error",
      );
    } finally {
      setIsConverting(false);
    }
  };

  const handleDeleteQuote = async (quote: QuoteWithClient) => {
    try {
      await deleteQuote(quote.id);
      await refresh(["quotes"]);
      showToast(`Deleted proposal ${quote.code}`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not delete proposal.",
        "error",
      );
    }
  };

  const filteredQuotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return quotes.filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (!q) return true;
      return (
        item.code.toLowerCase().includes(q) ||
        item.clientName.toLowerCase().includes(q) ||
        (item.title || "").toLowerCase().includes(q)
      );
    });
  }, [quotes, statusFilter, searchQuery]);

  return (
    <div className="space-y-4">
      <div className="ui-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-content-neutral-900">
            Proposals &amp; Scope Estimates
          </h2>
          <p className="text-xs text-content-neutral-500 mt-0.5">
            Send formal Proposal PDFs using any invoice template without affecting Accounts Receivable or Net Profit until converted.
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          disabled={!isElectron}
          onClick={() => void openNewQuoteModal()}
        >
          <Plus className="w-4 h-4" />
          <span>New Proposal</span>
        </Button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(["ALL", "DRAFT", "SENT", "APPROVED", "CONVERTED", "DECLINED"] as const).map(
            (st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  statusFilter === st
                    ? "bg-accent text-white shadow-xs"
                    : "bg-surface-neutral-100 text-content-neutral-600 hover:text-content-neutral-900"
                }`}
              >
                {st === "ALL" ? "All Proposals" : QUOTE_STATUS_LABELS[st]}
              </button>
            ),
          )}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-content-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search quote code or client..."
            className="ui-field w-full pl-9 pr-3 text-xs"
          />
        </div>
      </div>

      {/* Quotes Table */}
      <div className="ui-card overflow-hidden">
        {filteredQuotes.length === 0 ? (
          <div className="p-10">
            <EmptyState
              icon={<FilePlus2 className="w-6 h-6 text-accent" />}
              title="No proposals yet"
              description="Draft a scoped estimate, export it as a Proposal PDF, and convert approved quotes to an invoice in one click."
            >
              <Button
                type="button"
                variant="primary"
                disabled={!isElectron}
                onClick={() => void openNewQuoteModal()}
              >
                <Plus className="w-4 h-4" />
                <span>Create First Proposal</span>
              </Button>
            </EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line-neutral-200/80 text-[11px] font-semibold uppercase tracking-wider text-content-neutral-500">
                  <th className="py-3 px-4">Quote</th>
                  <th className="py-3 px-4">Client &amp; Scope</th>
                  <th className="py-3 px-4">Valid Until</th>
                  <th className="py-3 px-4 text-right">Estimate</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-neutral-200/60 text-xs">
                {filteredQuotes.map((quote) => (
                  <tr
                    key={quote.id}
                    className="hover:bg-surface-neutral-50/60 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-bold text-content-neutral-900 whitespace-nowrap">
                      {quote.code}
                    </td>
                    <td className="py-3.5 px-4 min-w-[200px]">
                      <div className="font-semibold text-content-neutral-900">
                        {quote.clientName}
                      </div>
                      <div className="text-[11px] text-content-neutral-500 truncate max-w-[280px]">
                        {quote.title ||
                          quote.items[0]?.description ||
                          `${quote.items.length} line item${quote.items.length === 1 ? "" : "s"}`}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-content-neutral-600 whitespace-nowrap">
                      {quote.validUntil
                        ? formatDateDisplay(quote.validUntil)
                        : "Open"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-content-neutral-900 tabular-nums whitespace-nowrap">
                      {formatCents(quote.amountCents, quote.currency)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {quote.status === "CONVERTED" ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${QUOTE_STATUS_CLASSES.CONVERTED}`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>
                            Converted
                            {quote.convertedInvoiceCode
                              ? ` · ${quote.convertedInvoiceCode}`
                              : ""}
                          </span>
                        </span>
                      ) : (
                        <select
                          aria-label={`Status for ${quote.code}`}
                          value={quote.status}
                          onChange={(e) =>
                            void handleStatusChange(
                              quote,
                              e.target.value as Exclude<QuoteStatus, "CONVERTED">,
                            )
                          }
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border cursor-pointer outline-none ${QUOTE_STATUS_CLASSES[quote.status]}`}
                        >
                          <option value="DRAFT">Draft</option>
                          <option value="SENT">Sent</option>
                          <option value="APPROVED">Approved</option>
                          <option value="DECLINED">Declined</option>
                        </select>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-end gap-1">
                        {quote.status !== "CONVERTED" && (
                          <Button
                            type="button"
                            size="small"
                            variant="secondary"
                            onClick={() => handleOpenConvertModal(quote)}
                            title={`Convert ${quote.code} into an invoice`}
                          >
                            <ArrowRightCircle className="w-3.5 h-3.5 text-content-emerald-600" />
                            <span>Convert to Invoice</span>
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setPreviewQuote(quote)}
                          title={`Preview ${quote.code}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => void openQuotePdf(quote.id)}
                          title={`Open PDF for ${quote.code}`}
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                        {quote.status !== "CONVERTED" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditQuoteModal(quote)}
                            title={`Edit ${quote.code}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleDeleteQuote(quote)}
                          title={`Delete ${quote.code}`}
                        >
                          <Trash2 className="w-4 h-4 text-content-rose-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Quote Modal */}
      <MotionPresence>
        {isFormOpen && (
          <Dialog onClose={() => setIsFormOpen(false)} width={760}>
            <div className="app-dialog-header">
              <div>
                <h3 className="text-base font-semibold text-content-neutral-900">
                  {editingQuote ? `Edit ${editingQuote.code}` : "New Proposal / Quote"}
                </h3>
                <p className="text-xs text-content-neutral-500">
                  Configure scoped pricing, deposit terms, and PDF template.
                </p>
              </div>
            </div>
            <form onSubmit={handleSaveQuote} className="app-dialog-form">
              <div className="app-dialog-body space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-content-neutral-700">
                      Client *
                    </span>
                    <select
                      required
                      value={formClientId}
                      onChange={(e) => {
                        setFormClientId(e.target.value);
                        const match = activeClients.find(
                          (c) => c.id === e.target.value,
                        );
                        if (match) setFormCurrency(match.currency);
                      }}
                      className="ui-field w-full px-3"
                    >
                      <option value="">Select client...</option>
                      {activeClients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.currency})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-content-neutral-700">
                      Quote Code
                    </span>
                    <input
                      type="text"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                      placeholder="QT-2026-001"
                      className="ui-field w-full px-3 font-mono"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-content-neutral-700">
                      PDF Template
                    </span>
                    <select
                      value={formTemplate}
                      onChange={(e) =>
                        setFormTemplate(e.target.value as InvoiceTemplateId)
                      }
                      className="ui-field w-full px-3"
                    >
                      <option value="geometric-teal">Geometric Teal</option>
                      <option value="executive-wave">Executive Wave</option>
                      <option value="scarlet-modern">Scarlet Modern</option>
                      <option value="apex-orange">Apex Orange</option>
                      <option value="noir-crimson">Noir Crimson</option>
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <label className="sm:col-span-2 space-y-1">
                    <span className="text-xs font-semibold text-content-neutral-700">
                      Project / Proposal Title
                    </span>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="e.g. Q4 Web Platform Architecture"
                      className="ui-field w-full px-3"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-content-neutral-700">
                      Issue Date
                    </span>
                    <input
                      type="date"
                      value={formIssueDate}
                      onChange={(e) => setFormIssueDate(e.target.value)}
                      className="ui-field w-full px-3"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-content-neutral-700">
                      Valid Until
                    </span>
                    <input
                      type="date"
                      value={formValidUntil}
                      onChange={(e) => setFormValidUntil(e.target.value)}
                      className="ui-field w-full px-3"
                    />
                  </label>
                </div>

                {/* Line Items + Catalog Quick Fill */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-content-neutral-700">
                      Scoped Deliverables *
                    </span>
                    {catalogItems.length > 0 && (
                      <select
                        value=""
                        onChange={(e) => {
                          const selected = catalogItems.find(
                            (it) => it.id === e.target.value,
                          );
                          if (!selected) return;
                          setFormItems((prev) => [
                            ...prev.filter((r) => r.description.trim() !== ""),
                            {
                              id: crypto.randomUUID(),
                              catalogId: selected.id,
                              description: selected.title,
                              quantity: 1,
                              unitPrice: (selected.priceCents / 100).toFixed(2),
                            },
                          ]);
                        }}
                        className="ui-field px-2.5 text-xs max-w-[220px]"
                      >
                        <option value="">+ Add from Catalog...</option>
                        {catalogItems.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title} ({formatCents(c.priceCents, c.currency)})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="space-y-2">
                    {formItems.map((item, idx) => (
                      <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                        <input
                          type="text"
                          required
                          value={item.description}
                          onChange={(e) =>
                            setFormItems((prev) =>
                              prev.map((row) =>
                                row.id === item.id
                                  ? { ...row, description: e.target.value }
                                  : row,
                              ),
                            )
                          }
                          placeholder={`Deliverable #${idx + 1}`}
                          className="ui-field col-span-6 px-3 text-xs"
                        />
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            setFormItems((prev) =>
                              prev.map((row) =>
                                row.id === item.id
                                  ? {
                                      ...row,
                                      quantity: Math.max(
                                        1,
                                        Number.parseInt(e.target.value, 10) || 1,
                                      ),
                                    }
                                  : row,
                              ),
                            )
                          }
                          className="ui-field col-span-2 px-2 text-xs text-center"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) =>
                            setFormItems((prev) =>
                              prev.map((row) =>
                                row.id === item.id
                                  ? { ...row, unitPrice: e.target.value }
                                  : row,
                              ),
                            )
                          }
                          className="ui-field col-span-3 px-2.5 text-xs text-right"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setFormItems((prev) =>
                              prev.length > 1
                                ? prev.filter((r) => r.id !== item.id)
                                : prev,
                            )
                          }
                          className="col-span-1 text-content-neutral-400 hover:text-content-rose-600 cursor-pointer flex justify-center"
                          title="Remove line item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="small"
                    onClick={() =>
                      setFormItems((prev) => [
                        ...prev,
                        {
                          id: crypto.randomUUID(),
                          description: "",
                          quantity: 1,
                          unitPrice: "0",
                        },
                      ])
                    }
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Line Item</span>
                  </Button>
                </div>

                {/* Totals Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-content-neutral-700">
                      Currency
                    </span>
                    <select
                      value={formCurrency}
                      onChange={(e) => setFormCurrency(e.target.value as Currency)}
                      className="ui-field w-full px-3 text-xs"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="LKR">LKR</option>
                      <option value="GBP">GBP</option>
                      <option value="CAD">CAD</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-content-neutral-700">
                      Discount
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formDiscount}
                      onChange={(e) => setFormDiscount(e.target.value)}
                      className="ui-field w-full px-3 text-xs"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-content-neutral-700">
                      Tax (%)
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={formTaxPercent}
                      onChange={(e) => setFormTaxPercent(e.target.value)}
                      className="ui-field w-full px-3 text-xs"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-content-neutral-700">
                      Deposit (%)
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formAdvancePercent}
                      onChange={(e) => setFormAdvancePercent(e.target.value)}
                      className="ui-field w-full px-3 text-xs"
                    />
                  </label>
                </div>

                <label className="space-y-1 block">
                  <span className="text-xs font-semibold text-content-neutral-700">
                    Proposal Notes &amp; Scope Terms
                  </span>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Validity, milestone timeline, and deposit instructions..."
                    className="ui-field ui-textarea w-full px-3 text-xs"
                  />
                </label>

                <div className="p-3.5 rounded-xl bg-surface-neutral-50 border border-line-neutral-200 flex items-center justify-between text-xs">
                  <span className="text-content-neutral-600 font-medium">
                    Estimated Total ({formAdvancePercent || 0}% deposit:{" "}
                    {formatCents(advanceCents, formCurrency)})
                  </span>
                  <strong className="text-sm font-bold text-content-neutral-900 tabular-nums">
                    {formatCents(totalCents, formCurrency)}
                  </strong>
                </div>
              </div>

              <div className="app-dialog-footer">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsFormOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isSaving}>
                  {isSaving
                    ? "Saving..."
                    : editingQuote
                      ? "Save Changes"
                      : "Create Proposal"}
                </Button>
              </div>
            </form>
          </Dialog>
        )}
      </MotionPresence>

      {/* Convert to Invoice Dialog */}
      <MotionPresence>
        {convertTarget && (
          <Dialog onClose={() => setConvertTarget(null)} width={460} compact>
            <div className="app-dialog-header">
              <div>
                <h3 className="text-base font-semibold text-content-neutral-900">
                  Convert {convertTarget.code} to Invoice
                </h3>
                <p className="text-xs text-content-neutral-500 mt-0.5">
                  Creates a billable invoice for{" "}
                  <strong>{convertTarget.clientName}</strong> (
                  {formatCents(convertTarget.amountCents, convertTarget.currency)}).
                </p>
              </div>
            </div>
            <div className="app-dialog-body space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-content-neutral-700">
                  Initial Invoice Status
                </span>
                <select
                  value={convertStatus}
                  onChange={(e) =>
                    setConvertStatus(e.target.value as "UNPAID" | "DRAFT")
                  }
                  className="ui-field w-full px-3 text-xs"
                >
                  <option value="UNPAID">Unpaid (Ready to Bill)</option>
                  <option value="DRAFT">Draft</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-content-neutral-700">
                  Invoice Due Date
                </span>
                <input
                  type="date"
                  value={convertDueDate}
                  onChange={(e) => setConvertDueDate(e.target.value)}
                  className="ui-field w-full px-3 text-xs"
                />
              </label>
            </div>
            <div className="app-dialog-footer">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConvertTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={isConverting}
                onClick={() => void handleConfirmConvert()}
              >
                <ArrowRightCircle className="w-4 h-4" />
                <span>{isConverting ? "Converting..." : "Convert Now"}</span>
              </Button>
            </div>
          </Dialog>
        )}
      </MotionPresence>

      {/* Live Proposal Preview Sheet across all 5 templates */}
      <MotionPresence>
        {previewQuote && (
          <InvoiceDocumentSheet
            invoice={toPreviewInvoice(previewQuote)}
            documentKind="quote"
            initialTemplate={
              (previewQuote.template as InvoiceTemplateId) ||
              settings?.defaultInvoiceTemplate ||
              "geometric-teal"
            }
            onSavePdfAs={(templateId) =>
              saveQuotePdfAs(previewQuote.id, templateId)
            }
            onClose={() => setPreviewQuote(null)}
          />
        )}
      </MotionPresence>
    </div>
  );
}
