"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Clock,
  Download,
  FileSpreadsheet,
  Mail,
  MessageCircle,
  ExternalLink,
  ChevronRight,
  Copy,
  Check,
  Table2,
  Users,
  FileText,
} from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Workspace";
import type { InvoiceWithClient } from "@/types/billing";
import { formatCents } from "@/lib/format";
import {
  isPastDue,
  localDateKey,
  remainingBalance,
} from "@/lib/visual-metrics";
import {
  calculateDaysOverdue,
  getAgingBucket,
  generateOverdueSummaryCsv,
  generateProfessionalOverdueTemplateCsv,
  generateOverdueTsvForClipboard,
  consolidateOverdueByClient,
  centsToDecimalString,
  downloadCsvFile,
} from "@/lib/csv-export";
import {
  generateWhatsAppReminderLink,
  buildOverduePaymentReminderMessage,
} from "@/lib/whatsapp";
import { openExternalLink } from "@/lib/deliveryUrl";

interface OverdueSummaryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: InvoiceWithClient[];
  primaryCurrency: string;
  freelancerName?: string;
  paymentInstructions?: string | null;
  onFilterToOverdue?: () => void;
  onInspectInvoice?: (inv: InvoiceWithClient) => void;
  showToast: (message: string, type?: "success" | "error") => void;
}

type SummaryViewTab = "ledger" | "clients" | "template";
type CsvTemplateMode = "executive" | "flat";

export function OverdueSummaryDialog({
  isOpen,
  onClose,
  invoices,
  primaryCurrency,
  freelancerName = "Chethaka",
  paymentInstructions,
  onFilterToOverdue,
  onInspectInvoice,
  showToast,
}: OverdueSummaryDialogProps) {
  const [selectedBucket, setSelectedBucket] = useState<string>("All");
  const [activeViewTab, setActiveViewTab] = useState<SummaryViewTab>("ledger");
  const [csvTemplateMode, setCsvTemplateMode] =
    useState<CsvTemplateMode>("executive");
  const [copiedType, setCopiedType] = useState<"tsv" | "csv" | null>(null);

  const todayStr = useMemo(() => localDateKey(), []);

  // Filter only overdue invoices with a remaining balance
  const overdueList = useMemo(() => {
    return invoices
      .filter((inv) => isPastDue(inv, todayStr))
      .map((inv) => {
        const days = calculateDaysOverdue(inv.dueDate);
        const bucket = getAgingBucket(days);
        const balance = remainingBalance(inv);
        const paidCents = inv.paidCents ?? 0;
        const paidPct =
          inv.amountCents > 0
            ? Math.min(100, Math.round((paidCents / inv.amountCents) * 100))
            : 0;
        return {
          ...inv,
          daysOverdue: days,
          agingBucket: bucket,
          overdueBalanceCents: balance,
          paidPct,
        };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [invoices, todayStr]);

  // Client-wise consolidated overdue rows
  const clientConsolidatedRows = useMemo(() => {
    return consolidateOverdueByClient(invoices);
  }, [invoices]);

  // Aggregate stats
  const totalOverdueCents = useMemo(() => {
    return overdueList.reduce((sum, inv) => sum + inv.overdueBalanceCents, 0);
  }, [overdueList]);

  const maxDaysOverdue = useMemo(() => {
    if (overdueList.length === 0) return 0;
    return Math.max(...overdueList.map((i) => i.daysOverdue));
  }, [overdueList]);

  const affectedClients = useMemo(() => {
    const set = new Set<string>();
    overdueList.forEach((inv) => set.add(inv.clientName));
    return Array.from(set);
  }, [overdueList]);

  // Aging distribution buckets
  const agingStats = useMemo(() => {
    const buckets = [
      {
        id: "1-15 Days",
        label: "1 – 15 Days",
        priority: "Grace / Courteous",
        bg: "bg-amber-500",
      },
      {
        id: "16-30 Days",
        label: "16 – 30 Days",
        priority: "Follow-up Needed",
        bg: "bg-orange-500",
      },
      {
        id: "31-60 Days",
        label: "31 – 60 Days",
        priority: "Urgent Collection",
        bg: "bg-pink-500",
      },
      {
        id: "60+ Days",
        label: "60+ Days",
        priority: "Critical Delinquency",
        bg: "bg-red-600",
      },
    ];

    return buckets.map((b) => {
      const matching = overdueList.filter((i) => i.agingBucket === b.id);
      const sumCents = matching.reduce((s, i) => s + i.overdueBalanceCents, 0);
      const count = matching.length;
      const share =
        totalOverdueCents > 0 ? (sumCents / totalOverdueCents) * 100 : 0;
      return {
        ...b,
        count,
        sumCents,
        share: Math.round(share * 10) / 10,
      };
    });
  }, [overdueList, totalOverdueCents]);

  // Filtered list by chosen aging bucket
  const displayedInvoices = useMemo(() => {
    if (selectedBucket === "All") return overdueList;
    return overdueList.filter((i) => i.agingBucket === selectedBucket);
  }, [overdueList, selectedBucket]);

  // Displayed totals for the footer row
  const displayedTotals = useMemo(() => {
    const billed = displayedInvoices.reduce((s, i) => s + i.amountCents, 0);
    const paid = displayedInvoices.reduce((s, i) => s + (i.paidCents ?? 0), 0);
    const overdue = displayedInvoices.reduce(
      (s, i) => s + i.overdueBalanceCents,
      0,
    );
    const paidPct = billed > 0 ? Math.round((paid / billed) * 100) : 0;
    return { billed, paid, overdue, paidPct };
  }, [displayedInvoices]);

  // Live CSV preview text
  const previewCsvText = useMemo(() => {
    if (csvTemplateMode === "executive") {
      return generateProfessionalOverdueTemplateCsv(overdueList, {
        businessName: freelancerName,
        primaryCurrency,
      });
    }
    return generateOverdueSummaryCsv(overdueList);
  }, [overdueList, csvTemplateMode, freelancerName, primaryCurrency]);

  // CSV Export Handlers
  const handleExportCsv = (mode: CsvTemplateMode = csvTemplateMode) => {
    try {
      const csv =
        mode === "executive"
          ? generateProfessionalOverdueTemplateCsv(overdueList, {
              businessName: freelancerName,
              primaryCurrency,
            })
          : generateOverdueSummaryCsv(overdueList);
      const suffix = mode === "executive" ? "executive-statement" : "register";
      const filename = `overdue-invoices-${suffix}-${todayStr}.csv`;
      downloadCsvFile(filename, csv);
      showToast(
        `Exported ${overdueList.length} overdue invoices (${mode === "executive" ? "Executive Template" : "Standard CSV"})!`,
      );
    } catch {
      showToast("Failed to generate CSV export file", "error");
    }
  };

  // Copy for Excel / Google Sheets (TSV) or Raw CSV
  const handleCopyClipboard = async (type: "tsv" | "csv") => {
    try {
      const text =
        type === "tsv"
          ? generateOverdueTsvForClipboard(displayedInvoices)
          : previewCsvText;
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2200);
      showToast(
        type === "tsv"
          ? "Copied table! Paste (Cmd+V) directly into Excel, Google Sheets, or Notion."
          : "Raw CSV template copied to clipboard!",
      );
    } catch {
      showToast("Could not copy to clipboard", "error");
    }
  };

  // WhatsApp Reminder Handler
  const handleWhatsAppReminder = (inv: {
    clientName: string;
    clientPhone?: string | null;
    code: string;
    overdueBalanceCents: number;
    currency: string;
    dueDate?: string | null;
    daysOverdue: number;
    deliveryUrl?: string | null;
  }) => {
    const link = generateWhatsAppReminderLink({
      clientName: inv.clientName,
      clientPhone: inv.clientPhone,
      invoiceCode: inv.code,
      amountDueFormatted: formatCents(inv.overdueBalanceCents, inv.currency),
      dueDate: inv.dueDate,
      daysOverdue: inv.daysOverdue,
      freelancerName,
      deliveryUrl: inv.deliveryUrl,
      paymentInstructions,
    });
    openExternalLink(link);
    showToast(`Opening WhatsApp payment reminder for ${inv.clientName}...`);
  };

  // Email Reminder Handler
  const handleEmailReminder = (inv: {
    clientName: string;
    clientEmail?: string | null;
    clientPhone?: string | null;
    code: string;
    overdueBalanceCents: number;
    currency: string;
    dueDate?: string | null;
    daysOverdue: number;
    deliveryUrl?: string | null;
  }) => {
    if (!inv.clientEmail) {
      showToast("No email address saved on this client profile", "error");
      return;
    }
    const subject = encodeURIComponent(
      `Payment Reminder: Invoice ${inv.code} (${inv.daysOverdue} days past due)`,
    );
    const body = encodeURIComponent(
      buildOverduePaymentReminderMessage({
        clientName: inv.clientName,
        clientPhone: inv.clientPhone,
        invoiceCode: inv.code,
        amountDueFormatted: formatCents(inv.overdueBalanceCents, inv.currency),
        dueDate: inv.dueDate,
        daysOverdue: inv.daysOverdue,
        freelancerName,
        deliveryUrl: inv.deliveryUrl,
        paymentInstructions,
      }),
    );
    const mailto = `mailto:${inv.clientEmail}?subject=${subject}&body=${body}`;
    if (typeof window !== "undefined") {
      window.location.href = mailto;
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog onClose={onClose} width={960}>
      <div className="p-6 sm:p-7 space-y-5 max-h-[88vh] overflow-y-auto">
        {/* Header Section */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line-neutral-200/80 pb-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-[20px] font-newspaper font-bold text-content-neutral-950 tracking-[-0.02em]">
                  Overdue Invoices Summary & Statement Template
                </h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                  {overdueList.length} past due
                </span>
              </div>
              <p className="text-[12.5px] text-content-neutral-500 mt-0.5">
                Executive accounts receivable aging table, client consolidation,
                and Excel/CSV template export.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="small"
              type="button"
              onClick={() => handleCopyClipboard("tsv")}
              disabled={overdueList.length === 0}
              title="Copy formatted table to paste directly into Excel, Google Sheets, or Notion"
            >
              {copiedType === "tsv" ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>
                {copiedType === "tsv" ? "Copied Table!" : "Copy for Excel"}
              </span>
            </Button>

            <Button
              variant="secondary"
              size="small"
              type="button"
              onClick={() => handleExportCsv("executive")}
              disabled={overdueList.length === 0}
              className="!border-emerald-600/30 !bg-emerald-50 dark:!bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:!bg-emerald-100"
              title="Download structured Executive Accounting Statement CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Executive CSV</span>
            </Button>
          </div>
        </div>

        {/* 4 Top KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-surface-neutral-50 border border-line-neutral-200/80 space-y-1">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-content-neutral-400">
              Total Overdue Balance
            </span>
            <div className="text-[20px] font-bold tabular-nums text-rose-600 dark:text-rose-400 font-newspaper">
              {formatCents(totalOverdueCents, primaryCurrency)}
            </div>
            <p className="text-[11px] text-content-neutral-500">
              Net past-due receivable
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-surface-neutral-50 border border-line-neutral-200/80 space-y-1">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-content-neutral-400">
              Overdue Invoices
            </span>
            <div className="text-[20px] font-bold tabular-nums text-content-neutral-950 font-newspaper">
              {overdueList.length}
            </div>
            <p className="text-[11px] text-content-neutral-500">
              Awaiting settlement
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-surface-neutral-50 border border-line-neutral-200/80 space-y-1">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-content-neutral-400">
              Delinquent Clients
            </span>
            <div className="text-[20px] font-bold tabular-nums text-content-neutral-950 font-newspaper">
              {affectedClients.length}
            </div>
            <p className="text-[11px] text-content-neutral-500">
              Distinct client accounts
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-surface-neutral-50 border border-line-neutral-200/80 space-y-1">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-content-neutral-400">
              Max Delinquency
            </span>
            <div className="text-[20px] font-bold tabular-nums text-content-neutral-950 font-newspaper">
              {maxDaysOverdue}{" "}
              <span className="text-xs font-normal text-content-neutral-500">
                days
              </span>
            </div>
            <p className="text-[11px] text-content-neutral-500">
              Longest elapsed due date
            </p>
          </div>
        </div>

        {/* Aging Breakdown Matrix Bar */}
        <div className="p-4 rounded-2xl bg-surface border border-line-neutral-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent" />
              <h3 className="text-[13.5px] font-semibold text-content-neutral-950">
                Accounts Receivable Aging Matrix
              </h3>
            </div>
            <span className="text-[11.5px] text-content-neutral-500">
              {selectedBucket === "All"
                ? "Showing all aging tiers (click a tier to filter)"
                : `Filtered by: ${selectedBucket}`}
            </span>
          </div>

          {/* Visual Distribution Bar */}
          <div className="w-full h-2.5 rounded-full bg-surface-neutral-100 overflow-hidden flex">
            {totalOverdueCents > 0 ? (
              agingStats.map((stat) =>
                stat.share > 0 ? (
                  <div
                    key={stat.id}
                    className={`${stat.bg} h-full transition-all duration-300`}
                    style={{ width: `${stat.share}%` }}
                    title={`${stat.label}: ${stat.share}% (${formatCents(stat.sumCents, primaryCurrency)})`}
                  />
                ) : null,
              )
            ) : (
              <div className="w-full h-full bg-emerald-500" />
            )}
          </div>

          {/* Aging Bucket Filter Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {agingStats.map((stat) => {
              const isSelected = selectedBucket === stat.id;
              return (
                <button
                  key={stat.id}
                  type="button"
                  onClick={() =>
                    setSelectedBucket(isSelected ? "All" : stat.id)
                  }
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? "border-accent bg-accent/5 ring-1 ring-accent"
                      : "border-line-neutral-200 hover:border-line-neutral-300 bg-surface-neutral-50"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-medium text-content-neutral-500">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${stat.bg}`} />
                      {stat.label}
                    </span>
                    <span className="tabular-nums font-semibold px-1.5 py-0.2 rounded bg-surface border border-line-neutral-200/80 text-[10px]">
                      {stat.count}
                    </span>
                  </div>
                  <div className="mt-1 text-[13px] font-bold text-content-neutral-950 tabular-nums">
                    {formatCents(stat.sumCents, primaryCurrency)}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-content-neutral-400 mt-0.5">
                    <span>{stat.priority}</span>
                    <span className="tabular-nums font-medium">
                      {stat.share}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Professional Template View Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="inline-flex p-1 rounded-xl bg-surface-neutral-100 border border-line-neutral-200/80 gap-1">
            <button
              type="button"
              onClick={() => setActiveViewTab("ledger")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeViewTab === "ledger"
                  ? "bg-surface text-content-neutral-950 shadow-xs border border-line-neutral-200/70"
                  : "text-content-neutral-500 hover:text-content-neutral-800"
              }`}
            >
              <Table2 className="w-3.5 h-3.5 text-accent" />
              <span>Executive Aging Ledger ({displayedInvoices.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveViewTab("clients")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeViewTab === "clients"
                  ? "bg-surface text-content-neutral-950 shadow-xs border border-line-neutral-200/70"
                  : "text-content-neutral-500 hover:text-content-neutral-800"
              }`}
            >
              <Users className="w-3.5 h-3.5 text-accent" />
              <span>
                Client Consolidation ({clientConsolidatedRows.length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveViewTab("template")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeViewTab === "template"
                  ? "bg-surface text-content-neutral-950 shadow-xs border border-line-neutral-200/70"
                  : "text-content-neutral-500 hover:text-content-neutral-800"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Spreadsheet / CSV Template</span>
            </button>
          </div>

          {selectedBucket !== "All" && activeViewTab === "ledger" && (
            <button
              type="button"
              onClick={() => setSelectedBucket("All")}
              className="text-[12px] text-accent hover:underline font-medium cursor-pointer"
            >
              Reset tier filter ({selectedBucket})
            </button>
          )}
        </div>

        {/* TAB 1: EXECUTIVE AGING LEDGER TABLE */}
        {activeViewTab === "ledger" && (
          <div className="overflow-x-auto rounded-2xl border border-line-neutral-200 bg-surface shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-neutral-50 border-b border-line-neutral-200 text-content-neutral-500 uppercase tracking-wider text-[10.5px] font-semibold">
                  <th className="py-3 px-3 w-10 text-center border-r border-line-neutral-200/60">
                    #
                  </th>
                  <th className="py-3 px-3.5">Invoice & Dates</th>
                  <th className="py-3 px-3.5">Client Account</th>
                  <th className="py-3 px-3">Aging Tier</th>
                  <th className="py-3 px-3 text-right">Contract Billed</th>
                  <th className="py-3 px-3 text-right">Collected</th>
                  <th className="py-3 px-3.5 text-right">
                    Overdue Balance Due
                  </th>
                  <th className="py-3 px-3 text-center">Dispatch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-neutral-100">
                {displayedInvoices.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-10 text-center text-content-neutral-400"
                    >
                      {overdueList.length === 0
                        ? "All client accounts are on schedule with zero past-due balances."
                        : `No overdue invoices in the ${selectedBucket} aging tier.`}
                    </td>
                  </tr>
                ) : (
                  displayedInvoices.map((inv, idx) => {
                    const urgencyBadge =
                      inv.daysOverdue > 60
                        ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-900"
                        : inv.daysOverdue > 30
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-900"
                          : inv.daysOverdue > 15
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 border-orange-200 dark:border-orange-900"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-900";

                    return (
                      <tr
                        key={inv.id}
                        className="hover:bg-surface-neutral-50/70 transition-colors"
                      >
                        <td className="py-3 px-3 text-center font-mono text-[11px] text-content-neutral-400 border-r border-line-neutral-100 tabular-nums">
                          {String(idx + 1).padStart(2, "0")}
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="font-mono font-semibold text-accent text-[12.5px]">
                            {inv.code}
                          </div>
                          <div className="text-[11px] text-content-neutral-500 tabular-nums mt-0.5">
                            Due:{" "}
                            <strong className="text-content-neutral-700">
                              {inv.dueDate || "N/A"}
                            </strong>
                          </div>
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="font-semibold text-content-neutral-950 text-[13px]">
                            {inv.clientName}
                          </div>
                          <div className="text-[11px] text-content-neutral-500 truncate max-w-[180px]">
                            {inv.clientContactPerson ||
                              inv.clientEmail ||
                              inv.clientPhone ||
                              "Standard Account"}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${urgencyBadge}`}
                          >
                            {inv.daysOverdue}d · {inv.agingBucket}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right text-content-neutral-600 tabular-nums font-medium">
                          {formatCents(inv.amountCents, inv.currency)}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums">
                          <div className="text-content-neutral-700 font-medium">
                            {formatCents(inv.paidCents ?? 0, inv.currency)}
                          </div>
                          <div className="flex items-center justify-end gap-1.5 mt-0.5">
                            <div className="w-12 h-1.5 rounded-full bg-surface-neutral-200 overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${inv.paidPct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-content-neutral-400">
                              {inv.paidPct}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-right font-bold text-rose-600 dark:text-rose-400 tabular-nums text-[13px]">
                          {formatCents(inv.overdueBalanceCents, inv.currency)}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              type="button"
                              onClick={() => handleWhatsAppReminder(inv)}
                              title={`Send WhatsApp reminder to ${inv.clientName}`}
                              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 w-7 h-7"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </Button>

                            {inv.clientEmail && (
                              <Button
                                variant="ghost"
                                size="icon"
                                type="button"
                                onClick={() => handleEmailReminder(inv)}
                                title={`Send Email reminder to ${inv.clientEmail}`}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 w-7 h-7"
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </Button>
                            )}

                            {onInspectInvoice && (
                              <Button
                                variant="ghost"
                                size="icon"
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onInspectInvoice(inv);
                                }}
                                title="Inspect invoice details"
                                className="text-content-neutral-500 hover:text-content-neutral-800 w-7 h-7"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {displayedInvoices.length > 0 && (
                <tfoot>
                  <tr className="bg-surface-neutral-50 border-t-2 border-line-neutral-200 font-semibold text-content-neutral-950">
                    <td className="py-3 px-3 text-center font-mono text-[10px] text-content-neutral-500 border-r border-line-neutral-200/60">
                      SUM
                    </td>
                    <td colSpan={2} className="py-3 px-3.5 text-[12px]">
                      GRAND TOTAL ({displayedInvoices.length}{" "}
                      {displayedInvoices.length === 1 ? "Invoice" : "Invoices"})
                    </td>
                    <td className="py-3 px-3 text-[11px] text-content-neutral-500">
                      Max {maxDaysOverdue}d overdue
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-[12.5px]">
                      {formatCents(displayedTotals.billed, primaryCurrency)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-[12.5px] text-emerald-700 dark:text-emerald-400">
                      {formatCents(displayedTotals.paid, primaryCurrency)}{" "}
                      <span className="text-[10.5px] font-normal text-content-neutral-500">
                        ({displayedTotals.paidPct}%)
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-right tabular-nums text-[13.5px] font-bold text-rose-600 dark:text-rose-400">
                      {formatCents(displayedTotals.overdue, primaryCurrency)}
                    </td>
                    <td className="py-3 px-3" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* TAB 2: CLIENT-WISE CONSOLIDATION TABLE */}
        {activeViewTab === "clients" && (
          <div className="overflow-x-auto rounded-2xl border border-line-neutral-200 bg-surface shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-neutral-50 border-b border-line-neutral-200 text-content-neutral-500 uppercase tracking-wider text-[10.5px] font-semibold">
                  <th className="py-3 px-3 w-10 text-center border-r border-line-neutral-200/60">
                    #
                  </th>
                  <th className="py-3 px-4">Client Account & Contact</th>
                  <th className="py-3 px-3">Overdue Invoices</th>
                  <th className="py-3 px-3">Oldest Due / Delay</th>
                  <th className="py-3 px-3 text-right">Total Billed</th>
                  <th className="py-3 px-3 text-right">Total Paid</th>
                  <th className="py-3 px-4 text-right">
                    Consolidated Overdue
                  </th>
                  <th className="py-3 px-3 text-center">Remind Client</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-neutral-100">
                {clientConsolidatedRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-10 text-center text-content-neutral-400"
                    >
                      No client accounts have overdue balances.
                    </td>
                  </tr>
                ) : (
                  clientConsolidatedRows.map((row, idx) => (
                    <tr
                      key={`${row.clientName}-${idx}`}
                      className="hover:bg-surface-neutral-50/70 transition-colors"
                    >
                      <td className="py-3 px-3 text-center font-mono text-[11px] text-content-neutral-400 border-r border-line-neutral-100 tabular-nums">
                        {String(idx + 1).padStart(2, "0")}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-content-neutral-950 text-[13px]">
                          {row.clientName}
                        </div>
                        <div className="text-[11px] text-content-neutral-500">
                          {row.contactPerson || row.email || row.phone || "—"}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {row.invoiceCodes.map((code) => (
                            <span
                              key={code}
                              className="px-2 py-0.5 rounded bg-surface-neutral-100 border border-line-neutral-200 font-mono text-[10.5px] font-medium text-content-neutral-800"
                            >
                              {code}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-content-neutral-700 font-medium tabular-nums">
                          {row.oldestDueDate || "N/A"}
                        </div>
                        <div className="text-[10.5px] text-rose-600 font-semibold">
                          Up to {row.maxDaysOverdue} days overdue
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-content-neutral-600">
                        {formatCents(row.totalBilledCents, row.currency)}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatCents(row.totalPaidCents, row.currency)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-bold text-rose-600 dark:text-rose-400 text-[13px]">
                        {formatCents(row.totalOverdueCents, row.currency)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            onClick={() =>
                              handleWhatsAppReminder({
                                clientName: row.clientName,
                                clientPhone: row.phone,
                                code: row.invoiceCodes.join(", "),
                                overdueBalanceCents: row.totalOverdueCents,
                                currency: row.currency,
                                dueDate: row.oldestDueDate,
                                daysOverdue: row.maxDaysOverdue,
                              })
                            }
                            title={`Send consolidated WhatsApp reminder to ${row.clientName}`}
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 w-7 h-7"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </Button>
                          {row.email && (
                            <Button
                              variant="ghost"
                              size="icon"
                              type="button"
                              onClick={() =>
                                handleEmailReminder({
                                  clientName: row.clientName,
                                  clientEmail: row.email,
                                  clientPhone: row.phone,
                                  code: row.invoiceCodes.join(", "),
                                  overdueBalanceCents: row.totalOverdueCents,
                                  currency: row.currency,
                                  dueDate: row.oldestDueDate,
                                  daysOverdue: row.maxDaysOverdue,
                                })
                              }
                              title={`Send consolidated Email reminder to ${row.email}`}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 w-7 h-7"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: SPREADSHEET & CSV TEMPLATE PREVIEW */}
        {activeViewTab === "template" && (
          <div className="space-y-4">
            {/* Template Mode Controls */}
            <div className="p-4 rounded-2xl bg-surface-neutral-50 border border-line-neutral-200/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-content-neutral-700">
                  CSV Template Format:
                </span>
                <div className="inline-flex p-0.5 rounded-lg bg-surface border border-line-neutral-200">
                  <button
                    type="button"
                    onClick={() => setCsvTemplateMode("executive")}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      csvTemplateMode === "executive"
                        ? "bg-accent text-white"
                        : "text-content-neutral-600 hover:text-content-neutral-900"
                    }`}
                  >
                    Executive Multi-Block Statement
                  </button>
                  <button
                    type="button"
                    onClick={() => setCsvTemplateMode("flat")}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      csvTemplateMode === "flat"
                        ? "bg-accent text-white"
                        : "text-content-neutral-600 hover:text-content-neutral-900"
                    }`}
                  >
                    Standard Flat Register
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="small"
                  type="button"
                  onClick={() => handleCopyClipboard("csv")}
                >
                  {copiedType === "csv" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {copiedType === "csv" ? "Copied CSV!" : "Copy Raw CSV"}
                  </span>
                </Button>
                <Button
                  variant="primary"
                  size="small"
                  type="button"
                  onClick={() => handleExportCsv(csvTemplateMode)}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    Download{" "}
                    {csvTemplateMode === "executive"
                      ? "Executive Template (.csv)"
                      : "Standard CSV (.csv)"}
                  </span>
                </Button>
              </div>
            </div>

            {/* Visual Excel / Spreadsheet Grid Template Table */}
            <div className="rounded-2xl border border-line-neutral-200 overflow-hidden bg-surface">
              <div className="bg-emerald-950/90 text-white px-4 py-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-mono">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>
                    overdue-invoices-
                    {csvTemplateMode === "executive"
                      ? "executive-statement"
                      : "register"}
                    -{todayStr}.csv
                  </span>
                </div>
                <span className="text-[11px] text-emerald-300">
                  RFC 4180 UTF-8 Spreadsheet Preview
                </span>
              </div>

              <div className="overflow-x-auto max-h-[260px]">
                <table className="w-full text-left text-[11px] font-mono border-collapse">
                  <thead>
                    <tr className="bg-surface-neutral-100 border-b border-line-neutral-300 text-content-neutral-500 text-center font-sans font-bold text-[10px]">
                      <th className="py-1.5 px-2 border-r border-line-neutral-300 w-8 bg-surface-neutral-200/60">
                        Row
                      </th>
                      {["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].map(
                        (col) => (
                          <th
                            key={col}
                            className="py-1.5 px-3 border-r border-line-neutral-200"
                          >
                            {col}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-neutral-200/70">
                    {/* Header Row */}
                    <tr className="bg-emerald-50/70 dark:bg-emerald-950/30 font-sans font-bold text-content-neutral-900">
                      <td className="py-1.5 px-2 text-center bg-surface-neutral-100 border-r border-line-neutral-300 font-mono text-[10px] text-content-neutral-500">
                        1
                      </td>
                      <td className="py-1.5 px-3 border-r border-line-neutral-200">
                        Invoice Number
                      </td>
                      <td className="py-1.5 px-3 border-r border-line-neutral-200">
                        Client Name
                      </td>
                      <td className="py-1.5 px-3 border-r border-line-neutral-200">
                        Contact Person
                      </td>
                      <td className="py-1.5 px-3 border-r border-line-neutral-200">
                        Due Date
                      </td>
                      <td className="py-1.5 px-3 border-r border-line-neutral-200">
                        Days Overdue
                      </td>
                      <td className="py-1.5 px-3 border-r border-line-neutral-200">
                        Aging Bucket
                      </td>
                      <td className="py-1.5 px-3 border-r border-line-neutral-200">
                        Currency
                      </td>
                      <td className="py-1.5 px-3 border-r border-line-neutral-200 text-right">
                        Billed Amount
                      </td>
                      <td className="py-1.5 px-3 border-r border-line-neutral-200 text-right">
                        Paid Amount
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        Overdue Balance Due
                      </td>
                    </tr>

                    {/* Data Rows */}
                    {overdueList.map((inv, idx) => (
                      <tr key={inv.id} className="hover:bg-surface-neutral-50">
                        <td className="py-1.5 px-2 text-center bg-surface-neutral-100 border-r border-line-neutral-300 text-[10px] text-content-neutral-500">
                          {idx + 2}
                        </td>
                        <td className="py-1.5 px-3 border-r border-line-neutral-200 font-semibold text-accent">
                          {inv.code}
                        </td>
                        <td className="py-1.5 px-3 border-r border-line-neutral-200 font-sans">
                          {inv.clientName}
                        </td>
                        <td className="py-1.5 px-3 border-r border-line-neutral-200 font-sans text-content-neutral-500">
                          {inv.clientContactPerson || "-"}
                        </td>
                        <td className="py-1.5 px-3 border-r border-line-neutral-200">
                          {inv.dueDate || "-"}
                        </td>
                        <td className="py-1.5 px-3 border-r border-line-neutral-200 text-center font-bold text-rose-600">
                          {inv.daysOverdue}
                        </td>
                        <td className="py-1.5 px-3 border-r border-line-neutral-200 font-sans">
                          {inv.agingBucket}
                        </td>
                        <td className="py-1.5 px-3 border-r border-line-neutral-200">
                          {inv.currency}
                        </td>
                        <td className="py-1.5 px-3 border-r border-line-neutral-200 text-right">
                          {centsToDecimalString(inv.amountCents)}
                        </td>
                        <td className="py-1.5 px-3 border-r border-line-neutral-200 text-right">
                          {centsToDecimalString(inv.paidCents ?? 0)}
                        </td>
                        <td className="py-1.5 px-3 text-right font-bold text-rose-600">
                          {centsToDecimalString(inv.overdueBalanceCents)}
                        </td>
                      </tr>
                    ))}

                    {/* Summary Footer Row in Grid */}
                    <tr className="bg-amber-50/70 dark:bg-amber-950/30 font-bold text-content-neutral-950">
                      <td className="py-1.5 px-2 text-center bg-surface-neutral-100 border-r border-line-neutral-300 text-[10px] text-content-neutral-500">
                        {overdueList.length + 2}
                      </td>
                      <td className="py-1.5 px-3 border-r border-line-neutral-200">
                        TOTAL OVERDUE SUMMARY
                      </td>
                      <td className="py-1.5 px-3 border-r border-line-neutral-200 font-sans">
                        {overdueList.length} past-due invoices
                      </td>
                      <td className="py-1.5 px-3 border-r border-line-neutral-200">
                        {affectedClients.length} clients
                      </td>
                      <td className="py-1.5 px-3 border-r border-line-neutral-200" />
                      <td className="py-1.5 px-3 border-r border-line-neutral-200 text-center">
                        Max {maxDaysOverdue}d
                      </td>
                      <td className="py-1.5 px-3 border-r border-line-neutral-200" />
                      <td className="py-1.5 px-3 border-r border-line-neutral-200">
                        {primaryCurrency}
                      </td>
                      <td className="py-1.5 px-3 border-r border-line-neutral-200 text-right">
                        {centsToDecimalString(displayedTotals.billed)}
                      </td>
                      <td className="py-1.5 px-3 border-r border-line-neutral-200 text-right">
                        {centsToDecimalString(displayedTotals.paid)}
                      </td>
                      <td className="py-1.5 px-3 text-right text-rose-600">
                        {centsToDecimalString(displayedTotals.overdue)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Raw CSV Output Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-content-neutral-500">
                <span className="font-semibold flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Raw RFC 4180 CSV Output Preview
                </span>
                <span>UTF-8 Encoded · Ready for Excel / Google Sheets</span>
              </div>
              <pre className="p-3.5 rounded-xl bg-neutral-950 text-neutral-200 font-mono text-[11px] overflow-x-auto max-h-[150px] leading-relaxed border border-line-neutral-800">
                {previewCsvText}
              </pre>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-4 border-t border-line-neutral-200/80 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[12px] text-content-neutral-500">
            {overdueList.length > 0 ? (
              <span>
                Grand Total Overdue:{" "}
                <strong className="text-content-neutral-950 font-semibold tabular-nums">
                  {formatCents(totalOverdueCents, primaryCurrency)}
                </strong>{" "}
                across {affectedClients.length}{" "}
                {affectedClients.length === 1 ? "client" : "clients"}
              </span>
            ) : (
              <span>No outstanding past-due balance</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="small"
              type="button"
              onClick={() => handleExportCsv("flat")}
              disabled={overdueList.length === 0}
              title="Download standard flat CSV table"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Standard CSV</span>
            </Button>

            <Button
              variant="secondary"
              size="small"
              type="button"
              onClick={() => handleExportCsv("executive")}
              disabled={overdueList.length === 0}
              className="!border-emerald-600/30 !bg-emerald-50 dark:!bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
              title="Download multi-section Executive Statement Template CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Executive Statement CSV</span>
            </Button>

            {onFilterToOverdue && (
              <Button
                variant="secondary"
                size="small"
                type="button"
                onClick={() => {
                  onClose();
                  onFilterToOverdue();
                }}
              >
                <span>Filter Register</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            )}

            <Button
              variant="primary"
              size="small"
              type="button"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
