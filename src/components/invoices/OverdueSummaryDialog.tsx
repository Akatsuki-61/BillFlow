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
  TrendingDown,
  Building,
} from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Workspace";
import type { InvoiceWithClient } from "@/types/billing";
import { formatCents } from "@/lib/format";
import { isPastDue, localDateKey, remainingBalance } from "@/lib/visual-metrics";
import {
  calculateDaysOverdue,
  getAgingBucket,
  generateOverdueSummaryCsv,
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

  const todayStr = useMemo(() => localDateKey(), []);

  // Filter only overdue invoices with a remaining balance
  const overdueList = useMemo(() => {
    return invoices
      .filter((inv) => isPastDue(inv, todayStr))
      .map((inv) => {
        const days = calculateDaysOverdue(inv.dueDate);
        const bucket = getAgingBucket(days);
        const balance = remainingBalance(inv);
        return {
          ...inv,
          daysOverdue: days,
          agingBucket: bucket,
          overdueBalanceCents: balance,
        };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [invoices, todayStr]);

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
      { id: "1-15 Days", label: "1 – 15 Days", tone: "amber", bg: "bg-amber-500" },
      { id: "16-30 Days", label: "16 – 30 Days", tone: "orange", bg: "bg-orange-500" },
      { id: "31-60 Days", label: "31 – 60 Days", tone: "pink", bg: "bg-pink-500" },
      { id: "60+ Days", label: "60+ Days", tone: "red", bg: "bg-red-600" },
    ];

    return buckets.map((b) => {
      const matching = overdueList.filter((i) => i.agingBucket === b.id);
      const sumCents = matching.reduce((s, i) => s + i.overdueBalanceCents, 0);
      const count = matching.length;
      const share = totalOverdueCents > 0 ? (sumCents / totalOverdueCents) * 100 : 0;
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

  // CSV Export Handler
  const handleExportCsv = () => {
    try {
      const csv = generateOverdueSummaryCsv(overdueList);
      const filename = `overdue-invoices-summary-${todayStr}.csv`;
      downloadCsvFile(filename, csv);
      showToast(
        `Exported ${overdueList.length} overdue invoices to CSV successfully!`,
      );
    } catch {
      showToast("Failed to generate CSV export file", "error");
    }
  };

  // WhatsApp Reminder Handler
  const handleWhatsAppReminder = (inv: (typeof overdueList)[number]) => {
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
  const handleEmailReminder = (inv: (typeof overdueList)[number]) => {
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
    <Dialog onClose={onClose} width={860}>
      <div className="p-6 sm:p-7 space-y-6">
        {/* Header Section */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line-neutral-200/80 pb-5">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-[20px] font-newspaper font-bold text-content-neutral-950 tracking-[-0.02em]">
                  Overdue Invoices Summary
                </h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                  {overdueList.length} past due
                </span>
              </div>
              <p className="text-[12.5px] text-content-neutral-500 mt-0.5">
                Accounts receivable aging, outstanding balances, and direct 1-click reminders.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="small"
              type="button"
              onClick={handleExportCsv}
              disabled={overdueList.length === 0}
              className="!border-emerald-600/30 !bg-emerald-50 dark:!bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:!bg-emerald-100"
              title="Export overdue report to CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </Button>
          </div>
        </div>

        {/* 4 Top KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-surface-neutral-50 border border-line-neutral-200/80 space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-content-neutral-400">
              Total Overdue
            </span>
            <div className="text-[20px] font-bold tabular-nums text-rose-600 dark:text-rose-400 font-newspaper">
              {formatCents(totalOverdueCents, primaryCurrency)}
            </div>
            <p className="text-[11px] text-content-neutral-500">
              Outstanding past-due
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-surface-neutral-50 border border-line-neutral-200/80 space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-content-neutral-400">
              Invoices Overdue
            </span>
            <div className="text-[20px] font-bold tabular-nums text-content-neutral-950 font-newspaper">
              {overdueList.length}
            </div>
            <p className="text-[11px] text-content-neutral-500">
              Awaiting remittance
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-surface-neutral-50 border border-line-neutral-200/80 space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-content-neutral-400">
              Affected Clients
            </span>
            <div className="text-[20px] font-bold tabular-nums text-content-neutral-950 font-newspaper">
              {affectedClients.length}
            </div>
            <p className="text-[11px] text-content-neutral-500">
              Client accounts
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-surface-neutral-50 border border-line-neutral-200/80 space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-content-neutral-400">
              Max Overdue Days
            </span>
            <div className="text-[20px] font-bold tabular-nums text-content-neutral-950 font-newspaper">
              {maxDaysOverdue} <span className="text-xs font-normal text-content-neutral-500">days</span>
            </div>
            <p className="text-[11px] text-content-neutral-500">
              Longest delinquent
            </p>
          </div>
        </div>

        {/* Aging Breakdown Bar & Tiers */}
        <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-line-neutral-200/80 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent" />
              <h3 className="text-[14px] font-semibold text-content-neutral-950">
                Accounts Receivable Aging Breakdown
              </h3>
            </div>
            <span className="text-[12px] text-content-neutral-500">
              Click bucket to filter
            </span>
          </div>

          {/* Visual Distribution Bar */}
          <div className="w-full h-3 rounded-full bg-surface-neutral-100 overflow-hidden flex">
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

          {/* Aging Bucket Filter Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {agingStats.map((stat) => {
              const isSelected = selectedBucket === stat.id;
              return (
                <button
                  key={stat.id}
                  type="button"
                  onClick={() =>
                    setSelectedBucket(isSelected ? "All" : stat.id)
                  }
                  className={`p-3 rounded-xl border text-left transition-all ${
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
                    <span className="tabular-nums font-semibold">
                      {stat.count}
                    </span>
                  </div>
                  <div className="mt-1 text-[13px] font-bold text-content-neutral-950 tabular-nums">
                    {formatCents(stat.sumCents, primaryCurrency)}
                  </div>
                  <div className="text-[10.5px] text-content-neutral-400 mt-0.5">
                    {stat.share}% of past-due
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Overdue Invoices Register Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-content-neutral-950">
              Past Due Invoices ({displayedInvoices.length})
            </h3>
            {selectedBucket !== "All" && (
              <button
                type="button"
                onClick={() => setSelectedBucket("All")}
                className="text-[12px] text-accent hover:underline font-medium"
              >
                Clear bucket filter ({selectedBucket})
              </button>
            )}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-line-neutral-200/80">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-neutral-50 border-b border-line-neutral-200 text-content-neutral-500 uppercase tracking-wider text-[10.5px] font-semibold">
                  <th className="py-3 px-4">Client / Invoice</th>
                  <th className="py-3 px-3">Due Date</th>
                  <th className="py-3 px-3">Overdue</th>
                  <th className="py-3 px-3 text-right">Billed</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Reminders</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-neutral-100">
                {displayedInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-content-neutral-400">
                      {overdueList.length === 0
                        ? "🎉 No overdue invoices! All client balances are on track."
                        : `No invoices in the ${selectedBucket} bucket.`}
                    </td>
                  </tr>
                ) : (
                  displayedInvoices.map((inv) => {
                    const urgencyClass =
                      inv.daysOverdue > 30
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-900"
                        : inv.daysOverdue > 15
                          ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 border-orange-200 dark:border-orange-900"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-900";

                    return (
                      <tr
                        key={inv.id}
                        className="hover:bg-surface-neutral-50/60 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="font-semibold text-content-neutral-950 text-[13px]">
                            {inv.clientName}
                          </div>
                          <div className="text-[11px] text-content-neutral-500 flex items-center gap-1.5">
                            <span className="font-mono text-accent font-medium">
                              {inv.code}
                            </span>
                            {inv.clientContactPerson && (
                              <span>· {inv.clientContactPerson}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-content-neutral-600 tabular-nums">
                          {inv.dueDate || "Not specified"}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${urgencyClass}`}
                          >
                            {inv.daysOverdue} {inv.daysOverdue === 1 ? "day" : "days"}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right text-content-neutral-500 tabular-nums">
                          {formatCents(inv.amountCents, inv.currency)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-rose-600 dark:text-rose-400 tabular-nums text-[13px]">
                          {formatCents(inv.overdueBalanceCents, inv.currency)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* WhatsApp Reminder Shortcut */}
                            <Button
                              variant="ghost"
                              size="icon"
                              type="button"
                              onClick={() => handleWhatsAppReminder(inv)}
                              title={`Send WhatsApp payment reminder to ${inv.clientName}`}
                              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 w-7 h-7"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </Button>

                            {/* Email Reminder Shortcut */}
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

                            {/* View / Inspect Invoice */}
                            {onInspectInvoice && (
                              <Button
                                variant="ghost"
                                size="icon"
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onInspectInvoice(inv);
                                }}
                                title="View invoice details"
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
            </table>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-line-neutral-200/80 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[12px] text-content-neutral-500">
            {overdueList.length > 0 ? (
              <span>
                Total overdue:{" "}
                <strong className="text-content-neutral-900 font-semibold tabular-nums">
                  {formatCents(totalOverdueCents, primaryCurrency)}
                </strong>{" "}
                across {affectedClients.length} {affectedClients.length === 1 ? "client" : "clients"}
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
              onClick={handleExportCsv}
              disabled={overdueList.length === 0}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV</span>
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
                <span>Filter in Register</span>
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
