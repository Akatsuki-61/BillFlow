"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { m, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  DollarSign,
  FileText,
  Layers,
  Receipt,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useReportingData } from "@/context/ReportingContext";
import { useData } from "@/lib/data/DataProvider";
import { formatCents } from "@/lib/format";
import {
  computeClientMargin,
  computeInvoiceMargin,
  type ClientMarginSummary,
  type ProjectMarginSummary,
} from "@/lib/project-margin";
import { EASE_ENTER, EASE_EXIT } from "@/lib/motion";
import type { ClientWithStats, InvoiceWithClient } from "@/types/billing";

interface ProjectMarginDrawerProps {
  mode: "invoice" | "client";
  invoice?: InvoiceWithClient | null;
  client?: ClientWithStats | null;
  onSelectInvoice?: (invoice: InvoiceWithClient) => void;
  onClose: () => void;
}

function formatHours(hours: number): string {
  if (hours <= 0) return "0.0h";
  return `${hours.toFixed(1)}h`;
}

export function ProjectMarginDrawer({
  mode,
  invoice,
  client,
  onSelectInvoice,
  onClose,
}: ProjectMarginDrawerProps) {
  const reducedMotion = useReducedMotion();
  const reporting = useReportingData();
  const { invoices, workOrders, expenses, tasks } = useData();
  const [basis, setBasis] = useState<"accrual" | "cash">("accrual");

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const targetCurrency = reporting.currency;

  const marginData: ProjectMarginSummary | ClientMarginSummary | null = useMemo(() => {
    if (mode === "invoice" && invoice) {
      return computeInvoiceMargin({
        invoice,
        workOrders,
        expenses,
        tasks,
        rates: reporting.rates,
        targetCurrency,
      });
    }
    if (mode === "client" && client) {
      return computeClientMargin({
        client,
        invoices,
        workOrders,
        expenses,
        tasks,
        rates: reporting.rates,
        targetCurrency,
      });
    }
    return null;
  }, [
    mode,
    invoice,
    client,
    workOrders,
    expenses,
    tasks,
    invoices,
    reporting.rates,
    targetCurrency,
  ]);

  if (typeof document === "undefined" || !marginData) return null;

  const isCash = basis === "cash";
  const revenueCents = isCash
    ? marginData.collectedRevenueCents
    : marginData.billedRevenueCents;
  const vendorCostCents = isCash
    ? marginData.paidWorkOrderCents
    : marginData.committedWorkOrderCents;
  const expenseCostCents = marginData.directExpenseCents;
  const netMarginCents = isCash
    ? marginData.cashNetMarginCents
    : marginData.accrualNetMarginCents;
  const marginPercent = isCash
    ? marginData.cashMarginPercent
    : marginData.accrualMarginPercent;
  const effectiveHourlyRate = isCash
    ? marginData.effectiveHourlyRateCashCents
    : marginData.effectiveHourlyRateAccrualCents;

  const totalCostCents = vendorCostCents + expenseCostCents;
  const barDenominator = Math.max(1, revenueCents, totalCostCents);
  const vendorSharePct = Math.min(100, (vendorCostCents / barDenominator) * 100);
  const expenseSharePct = Math.min(
    100 - vendorSharePct,
    (expenseCostCents / barDenominator) * 100,
  );
  const marginSharePct =
    netMarginCents > 0
      ? Math.max(0, Math.min(100 - vendorSharePct - expenseSharePct, (netMarginCents / barDenominator) * 100))
      : 0;

  const clientMargin =
    mode === "client" ? (marginData as ClientMarginSummary) : null;

  const money = (cents: number) => formatCents(cents, targetCurrency);
  const titleText =
    mode === "invoice"
      ? `${invoice?.code || "Invoice"} Margin (P&L)`
      : `${client?.name || "Client"} Margin (P&L)`;
  const subtitleText =
    mode === "invoice"
      ? `${invoice?.clientName || ""} · ${invoice?.status.replace("_", " ") || ""}`
      : `${clientMargin?.invoiceCount || 0} issued invoices · Reporting in ${targetCurrency}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={titleText}
    >
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: reducedMotion ? 0 : 0.18, ease: EASE_ENTER } }}
        exit={{ opacity: 0, transition: { duration: reducedMotion ? 0 : 0.15, ease: EASE_EXIT } }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />

      <m.aside
        initial={reducedMotion ? { opacity: 1 } : { x: 48, opacity: 0 }}
        animate={{
          x: 0,
          opacity: 1,
          transition: { duration: reducedMotion ? 0 : 0.24, ease: EASE_ENTER },
        }}
        exit={
          reducedMotion
            ? { opacity: 0 }
            : { x: 40, opacity: 0, transition: { duration: 0.18, ease: EASE_EXIT } }
        }
        className="relative z-10 h-full w-full max-w-[600px] bg-surface border-l border-line-neutral-200 shadow-[0_2.8px_2.2px_rgba(0,0,0,0.034),0_6.7px_5.3px_rgba(0,0,0,0.048),0_12.5px_10px_rgba(0,0,0,0.06),0_22.3px_17.9px_rgba(0,0,0,0.072),0_41.8px_33.4px_rgba(0,0,0,0.086),0_100px_80px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden"
      >
        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-line-neutral-200/80 flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Project Profit &amp; Loss</span>
            </div>
            <h2 className="text-lg font-bold text-content-neutral-900 truncate mt-1">
              {titleText}
            </h2>
            <p className="text-xs text-content-neutral-500 mt-0.5 truncate">
              {subtitleText}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close margin drawer"
            className="p-2 rounded-lg text-content-neutral-500 hover:text-content-neutral-900 hover:bg-surface-neutral-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Accrual / Cash Basis Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl p-1 bg-surface-neutral-100 border border-line-neutral-200/80">
              <button
                type="button"
                onClick={() => setBasis("accrual")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  basis === "accrual"
                    ? "bg-surface text-content-neutral-900 shadow-xs"
                    : "text-content-neutral-500 hover:text-content-neutral-800"
                }`}
              >
                Accrual (Billed vs Committed)
              </button>
              <button
                type="button"
                onClick={() => setBasis("cash")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  basis === "cash"
                    ? "bg-surface text-content-neutral-900 shadow-xs"
                    : "text-content-neutral-500 hover:text-content-neutral-800"
                }`}
              >
                Cash (Collected vs Paid)
              </button>
            </div>
            <span className="text-xs text-content-neutral-500 font-medium">
              Base currency: <strong className="text-content-neutral-800">{targetCurrency}</strong>
            </span>
          </div>

          {marginData.missingCurrencies.length > 0 && (
            <div className="p-3.5 rounded-xl bg-surface-amber-50 border border-line-amber-200 text-xs text-content-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-content-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold">Exchange rates missing for {marginData.missingCurrencies.join(", ")}</p>
                <p className="mt-0.5 text-content-amber-800">
                  Foreign-currency records without cached conversion rates are omitted from totals until rates are updated in Settings.
                </p>
              </div>
            </div>
          )}

          {/* Hero KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl border border-line-neutral-200 bg-surface-neutral-50/50">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-content-neutral-500">
                <DollarSign className="w-3.5 h-3.5 text-accent" />
                <span>Net Margin</span>
              </div>
              <div
                className={`text-xl font-bold mt-1.5 tabular-nums ${
                  netMarginCents < 0
                    ? "text-content-rose-600"
                    : "text-content-emerald-700"
                }`}
              >
                {money(netMarginCents)}
              </div>
              <p className="text-[11px] text-content-neutral-500 mt-1">
                Rev {money(revenueCents)} minus Costs {money(totalCostCents)}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-line-neutral-200 bg-surface-neutral-50/50">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-content-neutral-500">
                <TrendingUp className="w-3.5 h-3.5 text-accent" />
                <span>Profit Margin %</span>
              </div>
              <div className="text-xl font-bold text-content-neutral-900 mt-1.5 tabular-nums">
                {marginPercent === null ? "--" : `${marginPercent.toFixed(1)}%`}
              </div>
              <p className="text-[11px] text-content-neutral-500 mt-1">
                {isCash ? "On collected cash" : "On gross billed amount"}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-line-neutral-200 bg-surface-neutral-50/50">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-content-neutral-500">
                <Clock className="w-3.5 h-3.5 text-accent" />
                <span>Effective Rate</span>
              </div>
              <div className="text-xl font-bold text-content-neutral-900 mt-1.5 tabular-nums">
                {effectiveHourlyRate === null
                  ? "--"
                  : `${money(effectiveHourlyRate)}/hr`}
              </div>
              <p className="text-[11px] text-content-neutral-500 mt-1">
                {marginData.totalHours > 0
                  ? `${formatHours(marginData.totalHours)} active across ${marginData.tasks.length} task${marginData.tasks.length === 1 ? "" : "s"}`
                  : "Move linked tasks to In Progress to track hours"}
              </p>
            </div>
          </div>

          {/* Cost & Profit Share Bar */}
          <div className="p-4 rounded-xl border border-line-neutral-200 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-content-neutral-800">
              <span>Revenue Allocation Breakdown</span>
              <span className="tabular-nums">{money(revenueCents)}</span>
            </div>
            <div className="h-3 w-full rounded-full bg-surface-neutral-100 overflow-hidden flex">
              {vendorSharePct > 0 && (
                <div
                  className="bg-amber-500 h-full transition-all"
                  style={{ width: `${vendorSharePct}%` }}
                  title={`Outsourced Work Orders: ${money(vendorCostCents)}`}
                />
              )}
              {expenseSharePct > 0 && (
                <div
                  className="bg-rose-500 h-full transition-all"
                  style={{ width: `${expenseSharePct}%` }}
                  title={`Direct OPEX: ${money(expenseCostCents)}`}
                />
              )}
              {marginSharePct > 0 && (
                <div
                  className="bg-emerald-500 h-full transition-all"
                  style={{ width: `${marginSharePct}%` }}
                  title={`Net Margin: ${money(netMarginCents)}`}
                />
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px] text-content-neutral-600">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span className="truncate">
                  Vendors: <strong>{money(vendorCostCents)}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                <span className="truncate">
                  OPEX: <strong>{money(expenseCostCents)}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="truncate">
                  Net: <strong>{money(netMarginCents)}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Client Mode: Per-Invoice Breakdown */}
          {clientMargin && clientMargin.invoiceBreakdown.length > 0 && (
            <section className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-content-neutral-600">
                <FileText className="w-3.5 h-3.5 text-accent" />
                <span>Per-Invoice Margin Breakdown</span>
              </div>
              <div className="border border-line-neutral-200 rounded-xl divide-y divide-line-neutral-200/70 overflow-hidden">
                {clientMargin.invoiceBreakdown.map(({ invoice: rowInv, margin }) => {
                  const rowNet = isCash
                    ? margin.cashNetMarginCents
                    : margin.accrualNetMarginCents;
                  const rowPct = isCash
                    ? margin.cashMarginPercent
                    : margin.accrualMarginPercent;
                  return (
                    <div
                      key={rowInv.id}
                      className="px-4 py-3 flex items-center justify-between gap-3 bg-surface hover:bg-surface-neutral-50/70 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-content-neutral-900">
                            {rowInv.code}
                          </span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-surface-neutral-100 text-content-neutral-600 font-medium">
                            {rowInv.status.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-[11px] text-content-neutral-500 mt-0.5 truncate">
                          {rowInv.title || rowInv.issueDate}
                          {margin.totalHours > 0 ? ` · ${formatHours(margin.totalHours)}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div
                            className={`text-xs font-bold tabular-nums ${
                              rowNet < 0 ? "text-content-rose-600" : "text-content-emerald-700"
                            }`}
                          >
                            {money(rowNet)}
                          </div>
                          <div className="text-[11px] text-content-neutral-500 tabular-nums">
                            {rowPct === null ? "--" : `${rowPct.toFixed(1)}% margin`}
                          </div>
                        </div>
                        {onSelectInvoice && (
                          <button
                            type="button"
                            onClick={() => onSelectInvoice(rowInv)}
                            className="p-1.5 rounded-lg text-content-neutral-500 hover:text-accent hover:bg-accent-faint transition-colors cursor-pointer"
                            title={`Inspect ${rowInv.code} margin`}
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Outsourced Work Orders */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-content-neutral-600">
                <Users className="w-3.5 h-3.5 text-amber-500" />
                <span>Linked Vendor Work Orders ({marginData.workOrders.length})</span>
              </div>
              <span className="text-xs font-semibold text-content-neutral-800 tabular-nums">
                {money(vendorCostCents)}
              </span>
            </div>
            {marginData.workOrders.length === 0 ? (
              <p className="text-xs text-content-neutral-500 p-3.5 rounded-xl border border-dashed border-line-neutral-200">
                No outsourced contractor work orders linked.
              </p>
            ) : (
              <div className="border border-line-neutral-200 rounded-xl divide-y divide-line-neutral-200/70">
                {marginData.workOrders.map((wo) => (
                  <div
                    key={wo.id}
                    className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-content-neutral-900 truncate">
                        {wo.label}
                      </p>
                      <p className="text-[11px] text-content-neutral-500 truncate">
                        {wo.sublabel} · {wo.status}
                      </p>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <div className="font-semibold text-content-neutral-900">
                        {formatCents(
                          isCash ? wo.paidOriginalCents ?? 0 : wo.originalCents,
                          wo.originalCurrency,
                        )}
                      </div>
                      {wo.originalCurrency !== targetCurrency && (
                        <div className="text-[10px] text-content-neutral-400">
                          {isCash
                            ? wo.paidConvertedCents !== null &&
                              wo.paidConvertedCents !== undefined
                              ? money(wo.paidConvertedCents)
                              : "Rate needed"
                            : wo.convertedCents !== null
                              ? money(wo.convertedCents)
                              : "Rate needed"}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Direct Linked OPEX */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-content-neutral-600">
                <Receipt className="w-3.5 h-3.5 text-rose-500" />
                <span>Direct Linked OPEX ({marginData.expenses.length})</span>
              </div>
              <span className="text-xs font-semibold text-content-neutral-800 tabular-nums">
                {money(expenseCostCents)}
              </span>
            </div>
            {marginData.expenses.length === 0 ? (
              <p className="text-xs text-content-neutral-500 p-3.5 rounded-xl border border-dashed border-line-neutral-200">
                No direct expenses assigned. Link an expense from the Expenses ledger to allocate project OPEX.
              </p>
            ) : (
              <div className="border border-line-neutral-200 rounded-xl divide-y divide-line-neutral-200/70">
                {marginData.expenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-content-neutral-900 truncate">
                        {exp.label}
                      </p>
                      <p className="text-[11px] text-content-neutral-500 truncate">
                        {exp.sublabel}
                      </p>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <div className="font-semibold text-content-neutral-900">
                        {formatCents(exp.originalCents, exp.originalCurrency)}
                      </div>
                      {exp.originalCurrency !== targetCurrency && (
                        <div className="text-[10px] text-content-neutral-400">
                          {exp.convertedCents !== null
                            ? money(exp.convertedCents)
                            : "Rate needed"}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Linked Task Time */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-content-neutral-600">
                <Layers className="w-3.5 h-3.5 text-accent" />
                <span>Tracked Deliverable Time ({marginData.tasks.length})</span>
              </div>
              <span className="text-xs font-semibold text-content-neutral-800 tabular-nums">
                {formatHours(marginData.totalHours)}
              </span>
            </div>
            {marginData.tasks.length === 0 ? (
              <p className="text-xs text-content-neutral-500 p-3.5 rounded-xl border border-dashed border-line-neutral-200">
                No Kanban deliverables linked yet.
              </p>
            ) : (
              <div className="border border-line-neutral-200 rounded-xl divide-y divide-line-neutral-200/70">
                {marginData.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-content-neutral-900 truncate">
                        {task.title}
                      </p>
                      <p className="text-[11px] text-content-neutral-500 capitalize">
                        {task.status.replace("-", " ")}
                      </p>
                    </div>
                    <span className="font-semibold text-content-neutral-800 tabular-nums shrink-0">
                      {formatHours(task.hours)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </m.aside>
    </div>,
    document.body,
  );
}
