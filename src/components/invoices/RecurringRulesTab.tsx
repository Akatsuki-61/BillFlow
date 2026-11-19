"use client";

import React, { useMemo, useState } from "react";
import {
  CalendarClock,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Repeat,
  Trash2,
  Zap,
} from "lucide-react";
import { MotionPresence } from "@/components/ui/MotionSurface";
import { Dialog } from "@/components/ui/Dialog";
import { Button, EmptyState } from "@/components/ui/Workspace";
import {
  useCatalog,
  useClients,
  useData,
  useRecurringRules,
  useSettings,
} from "@/lib/data/DataProvider";
import { formatCents, formatDateDisplay, parseAmountToCents } from "@/lib/format";
import { localDateKey } from "@/lib/visual-metrics";
import { useToast } from "@/context/ToastContext";
import type { Currency, InvoiceTemplateId } from "@/types/billing";
import type {
  RecurringAutoStatus,
  RecurringCadence,
  RecurringRuleItem,
} from "@/types/recurring";

interface RecurringTabProps {
  onInvoiceGenerated?: (invoiceCode: string) => void;
}

interface RuleLineDraft {
  id: string;
  catalogId?: string | null;
  description: string;
  quantity: number;
  unitPrice: string;
}

const CADENCE_LABELS: Record<RecurringCadence, string> = {
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export function RecurringRulesTab({ onInvoiceGenerated }: RecurringTabProps) {
  const { showToast } = useToast();
  const { isElectron } = useData();
  const {
    recurringRules,
    createRecurringRule,
    updateRecurringRule,
    toggleRecurringRule,
    deleteRecurringRule,
    runRecurringRuleNow,
    runDueRecurringRules,
    refresh,
  } = useRecurringRules();
  const { clients } = useClients();
  const { catalogItems } = useCatalog();
  const { settings } = useSettings();

  const activeClients = useMemo(
    () => clients.filter((c) => !c.archivedAt),
    [clients],
  );

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringRuleItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [runningDue, setRunningDue] = useState(false);
  const [runningRuleId, setRunningRuleId] = useState<string | null>(null);

  // Form fields
  const [formClientId, setFormClientId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formCadence, setFormCadence] = useState<RecurringCadence>("monthly");
  const [formNextRunDate, setFormNextRunDate] = useState(() => localDateKey());
  const [formDayOfMonth, setFormDayOfMonth] = useState("1");
  const [formCurrency, setFormCurrency] = useState<Currency>(
    settings?.defaultCurrency || "USD",
  );
  const [formDueDays, setFormDueDays] = useState(
    String(settings?.defaultDueDays ?? 14),
  );
  const [formAutoStatus, setFormAutoStatus] =
    useState<RecurringAutoStatus>("DRAFT");
  const [formAutoExportPdf, setFormAutoExportPdf] = useState(true);
  const [formTemplate, setFormTemplate] = useState<InvoiceTemplateId>(
    settings?.defaultInvoiceTemplate || "geometric-teal",
  );
  const [formDiscount, setFormDiscount] = useState("0");
  const [formTaxPercent, setFormTaxPercent] = useState(
    String(settings?.defaultTaxRate ?? 0),
  );
  const [formAdvancePercent, setFormAdvancePercent] = useState("0");
  const [formNotes, setFormNotes] = useState("");
  const [formItems, setFormItems] = useState<RuleLineDraft[]>([
    { id: "rule-line-1", description: "", quantity: 1, unitPrice: "0" },
  ]);

  const openNewRuleModal = () => {
    const today = localDateKey();
    setEditingRule(null);
    setFormClientId(activeClients[0]?.id || "");
    setFormTitle("Monthly Engineering Retainer");
    setFormCadence("monthly");
    setFormNextRunDate(today);
    setFormDayOfMonth(String(Number(today.slice(8, 10)) || 1));
    setFormCurrency(
      activeClients[0]?.currency || settings?.defaultCurrency || "USD",
    );
    setFormDueDays(String(settings?.defaultDueDays ?? 14));
    setFormAutoStatus("DRAFT");
    setFormAutoExportPdf(true);
    setFormTemplate(settings?.defaultInvoiceTemplate || "geometric-teal");
    setFormDiscount("0");
    setFormTaxPercent(String(settings?.defaultTaxRate ?? 0));
    setFormAdvancePercent("0");
    setFormNotes("");
    setFormItems([
      {
        id: crypto.randomUUID(),
        description: "Monthly Software Retainer",
        quantity: 1,
        unitPrice: "0",
      },
    ]);
    setIsFormOpen(true);
  };

  const openEditRuleModal = (rule: RecurringRuleItem) => {
    setEditingRule(rule);
    setFormClientId(rule.clientId);
    setFormTitle(rule.title);
    setFormCadence(rule.cadence);
    setFormNextRunDate(rule.nextRunDate);
    setFormDayOfMonth(
      String(rule.dayOfMonth ?? (Number(rule.nextRunDate.slice(8, 10)) || 1)),
    );
    setFormCurrency(rule.currency);
    setFormDueDays(String(rule.dueDays));
    setFormAutoStatus(rule.autoStatus);
    setFormAutoExportPdf(rule.autoExportPdf);
    setFormTemplate(
      (rule.template as InvoiceTemplateId) ||
        settings?.defaultInvoiceTemplate ||
        "geometric-teal",
    );
    setFormDiscount((rule.discountCents / 100).toFixed(2));
    const taxableBase = Math.max(
      1,
      rule.items.reduce((s, it) => s + it.quantity * it.unitPriceCents, 0) -
        rule.discountCents,
    );
    setFormTaxPercent(
      rule.taxCents > 0
        ? String(Math.round((rule.taxCents / taxableBase) * 1000) / 10)
        : "0",
    );
    setFormAdvancePercent(
      rule.amountCents > 0
        ? String(Math.round((rule.advanceCents / rule.amountCents) * 100))
        : "0",
    );
    setFormNotes(rule.notes || "");
    setFormItems(
      rule.items.map((it, i) => ({
        id: `${rule.id}-${i}`,
        catalogId: it.catalogId,
        description: it.description,
        quantity: it.quantity,
        unitPrice: (it.unitPriceCents / 100).toFixed(2),
      })),
    );
    setIsFormOpen(true);
  };

  const subtotalCents = formItems.reduce(
    (sum, item) =>
      sum +
      Math.max(1, item.quantity || 1) *
        Math.max(0, parseAmountToCents(item.unitPrice)),
    0,
  );
  const discountCents = Math.min(
    subtotalCents,
    Math.max(0, parseAmountToCents(formDiscount)),
  );
  const taxRate = Math.max(0, Number.parseFloat(formTaxPercent) || 0);
  const taxCents = Math.round(((subtotalCents - discountCents) * taxRate) / 100);
  const totalCents = subtotalCents - discountCents + taxCents;
  const advancePct = Math.max(
    0,
    Math.min(100, Number.parseFloat(formAdvancePercent) || 0),
  );
  const advanceCents = Math.round((totalCents * advancePct) / 100);

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClientId) {
      showToast("Select a client for this retainer schedule.", "error");
      return;
    }
    const cleanItems = formItems
      .filter((it) => it.description.trim())
      .map((it) => ({
        description: it.description.trim(),
        quantity: Math.max(1, Math.round(it.quantity || 1)),
        unitPriceCents: Math.max(0, parseAmountToCents(it.unitPrice)),
        catalogId: it.catalogId || null,
      }));
    if (cleanItems.length === 0) {
      showToast("Add at least one retainer line item.", "error");
      return;
    }

    const monthlyType = ["monthly", "quarterly", "yearly"].includes(formCadence);
    const parsedDay = monthlyType
      ? Math.max(1, Math.min(31, Number.parseInt(formDayOfMonth, 10) || 1))
      : null;

    setIsSaving(true);
    try {
      const payload = {
        clientId: formClientId,
        title: formTitle.trim(),
        cadence: formCadence,
        dayOfMonth: parsedDay,
        currency: formCurrency,
        items: cleanItems,
        discountCents,
        taxCents,
        advanceCents,
        amountCents: totalCents,
        dueDays: Math.max(0, Math.min(365, Number.parseInt(formDueDays, 10) || 14)),
        autoStatus: formAutoStatus,
        autoExportPdf: formAutoExportPdf,
        template: formTemplate,
        nextRunDate: formNextRunDate,
        notes: formNotes.trim() || null,
      };
      if (editingRule) {
        await updateRecurringRule(editingRule.id, payload);
        showToast("Updated recurring retainer rule.");
      } else {
        await createRecurringRule(payload);
        showToast("Scheduled recurring retainer rule.");
      }
      await refresh(["recurringRules"]);
      setIsFormOpen(false);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not save recurring rule.",
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunRuleNow = async (rule: RecurringRuleItem) => {
    setRunningRuleId(rule.id);
    try {
      const outcome = await runRecurringRuleNow(rule.id);
      await refresh(["recurringRules", "invoices", "clients", "dashboard"]);
      showToast(`Generated ${outcome.invoice.code} from "${rule.title}".`);
      onInvoiceGenerated?.(outcome.invoice.code);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not generate invoice.",
        "error",
      );
    } finally {
      setRunningRuleId(null);
    }
  };

  const handleRunAllDue = async () => {
    setRunningDue(true);
    try {
      const res = await runDueRecurringRules();
      await refresh(["recurringRules", "invoices", "clients", "dashboard"]);
      if (res.generated.length > 0) {
        showToast(
          `Generated ${res.generated.length} due retainer invoice${res.generated.length === 1 ? "" : "s"}.`,
        );
      } else {
        showToast("No recurring retainers are due today.", "info");
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not run due rules.",
        "error",
      );
    } finally {
      setRunningDue(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="ui-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-content-neutral-900">
            Recurring Retainers &amp; Scheduled Billing
          </h2>
          <p className="text-xs text-content-neutral-500 mt-0.5">
            Local scheduler creates due retainer invoices automatically, exports PDFs, and notifies you on desktop without cloud servers.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!isElectron || runningDue}
            onClick={() => void handleRunAllDue()}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${runningDue ? "animate-spin" : ""}`} />
            <span>{runningDue ? "Checking..." : "Run Due Retainers"}</span>
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!isElectron}
            onClick={openNewRuleModal}
          >
            <Plus className="w-4 h-4" />
            <span>New Retainer Schedule</span>
          </Button>
        </div>
      </div>

      {/* Rules List */}
      <div className="ui-card overflow-hidden">
        {recurringRules.length === 0 ? (
          <div className="p-10">
            <EmptyState
              icon={<Repeat className="w-6 h-6 text-accent" />}
              title="No recurring retainers scheduled"
              description="Automate monthly retainers or maintenance contracts. BillFlow generates drafts or invoices locally on schedule."
            >
              <Button
                type="button"
                variant="primary"
                disabled={!isElectron}
                onClick={openNewRuleModal}
              >
                <Plus className="w-4 h-4" />
                <span>Add Recurring Rule</span>
              </Button>
            </EmptyState>
          </div>
        ) : (
          <div className="divide-y divide-line-neutral-200/70">
            {recurringRules.map((rule) => (
              <div
                key={rule.id}
                className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-surface-neutral-50/50 transition-colors"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-content-neutral-900">
                      {rule.title}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-accent-faint text-accent-deep-solid dark:text-accent border border-border-accent">
                      {CADENCE_LABELS[rule.cadence]}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                        rule.isActive
                          ? "bg-surface-emerald-50 text-content-emerald-700 border-line-emerald-200"
                          : "bg-surface-neutral-100 text-content-neutral-500 border-line-neutral-200"
                      }`}
                    >
                      {rule.isActive ? "Active" : "Paused"}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-neutral-100 text-content-neutral-600">
                      Creates {rule.autoStatus}
                    </span>
                    {rule.autoExportPdf && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-neutral-100 text-content-neutral-600">
                        Auto-PDF
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-content-neutral-500">
                    <span className="font-semibold text-content-neutral-800">
                      {rule.clientName}
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="w-3.5 h-3.5 text-content-neutral-400" />
                      Next run: {formatDateDisplay(rule.nextRunDate)}
                    </span>
                    {rule.lastInvoiceCode && (
                      <>
                        <span>·</span>
                        <span>
                          Last generated:{" "}
                          <strong className="text-content-neutral-800">
                            {rule.lastInvoiceCode}
                          </strong>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right mr-2">
                    <div className="text-sm font-bold text-content-neutral-900 tabular-nums">
                      {formatCents(rule.amountCents, rule.currency)}
                    </div>
                    <div className="text-[11px] text-content-neutral-400">
                      Net {rule.dueDays} days
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="small"
                    variant="secondary"
                    disabled={runningRuleId === rule.id}
                    onClick={() => void handleRunRuleNow(rule)}
                    title="Generate invoice now and advance schedule"
                  >
                    <Zap className="w-3.5 h-3.5 text-accent" />
                    <span>
                      {runningRuleId === rule.id ? "Running..." : "Generate Now"}
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      await toggleRecurringRule(rule.id, !rule.isActive);
                      await refresh(["recurringRules"]);
                      showToast(
                        rule.isActive
                          ? `Paused "${rule.title}"`
                          : `Resumed "${rule.title}"`,
                      );
                    }}
                    title={rule.isActive ? "Pause rule" : "Resume rule"}
                  >
                    {rule.isActive ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 text-content-emerald-600" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditRuleModal(rule)}
                    title="Edit rule"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      await deleteRecurringRule(rule.id);
                      await refresh(["recurringRules"]);
                      showToast(`Deleted "${rule.title}"`);
                    }}
                    title="Delete rule"
                  >
                    <Trash2 className="w-4 h-4 text-content-rose-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Rule Dialog */}
      <MotionPresence>
        {isFormOpen && (
          <Dialog onClose={() => setIsFormOpen(false)} width={760}>
            <div className="app-dialog-header">
              <div>
                <h3 className="text-base font-semibold text-content-neutral-900">
                  {editingRule ? "Edit Retainer Schedule" : "New Recurring Retainer"}
                </h3>
                <p className="text-xs text-content-neutral-500">
                  Automatically bills your retainer on the selected cadence.
                </p>
              </div>
            </div>
            <form onSubmit={handleSaveRule} className="app-dialog-form">
              <div className="app-dialog-body space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      Retainer Title *
                    </span>
                    <input
                      type="text"
                      required
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="e.g. Monthly DevOps & SRE Retainer"
                      className="ui-field w-full px-3"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-content-neutral-700">
                      Cadence
                    </span>
                    <select
                      value={formCadence}
                      onChange={(e) =>
                        setFormCadence(e.target.value as RecurringCadence)
                      }
                      className="ui-field w-full px-3 text-xs"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Bi-weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-content-neutral-700">
                      Next Run Date *
                    </span>
                    <input
                      type="date"
                      required
                      value={formNextRunDate}
                      onChange={(e) => setFormNextRunDate(e.target.value)}
                      className="ui-field w-full px-3 text-xs"
                    />
                  </label>
                  {["monthly", "quarterly", "yearly"].includes(formCadence) && (
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-content-neutral-700">
                        Billing Day (1-31)
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={formDayOfMonth}
                        onChange={(e) => setFormDayOfMonth(e.target.value)}
                        className="ui-field w-full px-3 text-xs"
                      />
                    </label>
                  )}
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-content-neutral-700">
                      Due Within (Days)
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      value={formDueDays}
                      onChange={(e) => setFormDueDays(e.target.value)}
                      className="ui-field w-full px-3 text-xs"
                    />
                  </label>
                </div>

                {/* Line Items */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-content-neutral-700">
                      Retainer Line Items *
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
                          placeholder={`Retainer item #${idx + 1}`}
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

                {/* Options */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                      Auto Status
                    </span>
                    <select
                      value={formAutoStatus}
                      onChange={(e) =>
                        setFormAutoStatus(e.target.value as RecurringAutoStatus)
                      }
                      className="ui-field w-full px-3 text-xs"
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="UNPAID">Unpaid (Issued)</option>
                    </select>
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
                      className="ui-field w-full px-3 text-xs"
                    >
                      <option value="geometric-teal">Geometric Teal</option>
                      <option value="executive-wave">Executive Wave</option>
                      <option value="scarlet-modern">Scarlet Modern</option>
                      <option value="apex-orange">Apex Orange</option>
                      <option value="noir-crimson">Noir Crimson</option>
                    </select>
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
                </div>

                <label className="flex items-center gap-2 text-xs text-content-neutral-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formAutoExportPdf}
                    onChange={(e) => setFormAutoExportPdf(e.target.checked)}
                    className="rounded border-line-neutral-300 text-accent"
                  />
                  <span>
                    Automatically export invoice PDF to the configured export folder on run
                  </span>
                </label>

                <div className="p-3.5 rounded-xl bg-surface-neutral-50 border border-line-neutral-200 flex items-center justify-between text-xs">
                  <span className="text-content-neutral-600 font-medium">
                    Scheduled Invoice Total ({CADENCE_LABELS[formCadence]})
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
                    : editingRule
                      ? "Save Rule"
                      : "Create Schedule"}
                </Button>
              </div>
            </form>
          </Dialog>
        )}
      </MotionPresence>
    </div>
  );
}
