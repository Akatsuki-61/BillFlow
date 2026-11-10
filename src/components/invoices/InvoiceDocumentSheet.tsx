"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Printer,
  CreditCard,
  ExternalLink,
  Download,
  Share2,
  Mail,
  MessageSquare,
  Check,
  ChevronDown,
  LayoutTemplate,
} from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Workspace";
import { formatCents, formatDateDisplay } from "@/lib/format";
import type { InvoiceWithClient, InvoiceTemplateId } from "@/types/billing";
import { useSettings, useClients, useInvoices } from "@/lib/data/DataProvider";
import { resolveDeliveryUrl, openExternalLink } from "@/lib/deliveryUrl";
import {
  generateInvoiceWhatsAppLink,
  generateInvoiceEmailLink,
} from "@/lib/whatsapp";

interface InvoiceDocumentSheetProps {
  invoice: InvoiceWithClient;
  onClose: () => void;
  onOpenPdf?: () => void;
  onRecordPayment?: () => void;
}

const TEMPLATES: Array<{
  id: InvoiceTemplateId;
  name: string;
  badge: string;
  color: string;
  description: string;
}> = [
  {
    id: "geometric-teal",
    name: "Geometric Teal",
    badge: "Template 1",
    color: "#00A887",
    description: "Modern teal ribbons & dark slate header",
  },
  {
    id: "executive-wave",
    name: "Executive Wave",
    badge: "Template 2",
    color: "#EAA828",
    description: "Charcoal wave header & golden amber accents",
  },
];

export default function InvoiceDocumentSheet({
  invoice,
  onClose,
  onOpenPdf,
  onRecordPayment,
}: InvoiceDocumentSheetProps) {
  const { settings } = useSettings();
  const { clients } = useClients();
  const { saveInvoicePdfAs } = useInvoices();

  const [selectedTemplate, setSelectedTemplate] = useState<InvoiceTemplateId>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("billflow_invoice_template");
      if (stored === "geometric-teal" || stored === "executive-wave") {
        return stored;
      }
    }
    return settings?.defaultInvoiceTemplate || "geometric-teal";
  });

  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const shareDropdownRef = useRef<HTMLDivElement>(null);
  const templateDropdownRef = useRef<HTMLDivElement>(null);

  const handleSelectTemplate = (templateId: InvoiceTemplateId) => {
    setSelectedTemplate(templateId);
    if (typeof window !== "undefined") {
      localStorage.setItem("billflow_invoice_template", templateId);
    }
  };

  const businessName =
    settings?.businessName || "CHETHAKA LAKSHITHA";
  const professionalTitle =
    settings?.professionalTitle || "SOFTWARE FREELANCING & CONSULTING";

  const subtotalCents =
    invoice.items && invoice.items.length > 0
      ? invoice.items.reduce(
          (sum, it) => sum + it.quantity * it.unitPriceCents,
          0,
        )
      : invoice.amountCents;

  const paidCents =
    invoice.payments && invoice.payments.length > 0
      ? invoice.payments.reduce((sum, p) => sum + p.amountCents, 0)
      : invoice.paidCents || 0;

  const balanceDueCents = Math.max(0, invoice.amountCents - paidCents);

  const delivery = resolveDeliveryUrl(invoice, { clients });
  const client = clients.find((c) => c.id === invoice.clientId);

  const displayItems =
    invoice.items && invoice.items.length > 0
      ? invoice.items
      : [
          {
            description: "Professional Services & Development Sprint",
            quantity: 1,
            unitPriceCents: invoice.amountCents,
          },
        ];

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        shareDropdownRef.current &&
        !shareDropdownRef.current.contains(e.target as Node)
      ) {
        setIsShareOpen(false);
      }
      if (
        templateDropdownRef.current &&
        !templateDropdownRef.current.contains(e.target as Node)
      ) {
        setIsTemplateDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isTemplateDropdownOpen) {
          e.preventDefault();
          setIsTemplateDropdownOpen(false);
          return;
        }
        if (isShareOpen) {
          e.preventDefault();
          setIsShareOpen(false);
          return;
        }
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isTemplateDropdownOpen, isShareOpen]);

  const handlePrint = () => {
    window.print();
  };

  const handleSavePdfAs = async () => {
    setIsSavingPdf(true);
    setSavedNotice(null);
    try {
      if (window.billflow?.invoices?.savePdfAs) {
        const result = await window.billflow.invoices.savePdfAs(invoice.id, selectedTemplate);
        if (result.success && result.filePath) {
          const fileName = result.filePath.split(/[\\/]/).pop() || "invoice.pdf";
          setSavedNotice(`Saved: ${fileName}`);
          setTimeout(() => setSavedNotice(null), 4500);
          return;
        }
      } else if (saveInvoicePdfAs) {
        const result = await saveInvoicePdfAs(invoice.id, selectedTemplate);
        if (result.success && result.filePath) {
          const fileName = result.filePath.split(/[\\/]/).pop() || "invoice.pdf";
          setSavedNotice(`Saved: ${fileName}`);
          setTimeout(() => setSavedNotice(null), 4500);
          return;
        }
      }

      if (onOpenPdf) {
        onOpenPdf();
      } else {
        window.print();
      }
    } catch (err) {
      console.error("Failed to save PDF:", err);
    } finally {
      setIsSavingPdf(false);
    }
  };

  const handleShareWhatsApp = async () => {
    setIsShareOpen(false);
    setSavedNotice("Preparing invoice PDF...");

    let pdfExported = false;
    try {
      if (
        window.billflow?.invoices?.exportPdf &&
        invoice.id !== "sample-preview" &&
        invoice.id !== "draft-preview"
      ) {
        await window.billflow.invoices.exportPdf(invoice.id, selectedTemplate);
        if (window.billflow?.files?.openInvoicePdf) {
          await window.billflow.files.openInvoicePdf(invoice.id, true);
          pdfExported = true;
        }
      }
    } catch (err) {
      console.warn("Could not auto-reveal exported PDF:", err);
    }

    const link = generateInvoiceWhatsAppLink({
      clientName: invoice.clientName,
      clientPhone: client?.phone,
      invoiceCode: invoice.code,
      totalFormatted: formatCents(invoice.amountCents, invoice.currency),
      advanceFormatted: invoice.advanceCents
        ? formatCents(invoice.advanceCents, invoice.currency)
        : null,
      balanceFormatted: formatCents(balanceDueCents, invoice.currency),
      dueDate: invoice.dueDate ? formatDateDisplay(invoice.dueDate) : null,
      deliveryUrl: delivery.hasLink ? delivery.formattedUrl : null,
      paymentDetails: settings?.paymentDetails,
      businessName,
    });
    openExternalLink(link);
    setSavedNotice(
      pdfExported
        ? "Invoice PDF ready in Explorer to attach in WhatsApp!"
        : "WhatsApp opened with invoice message!"
    );
    setTimeout(() => setSavedNotice(null), 5000);
  };

  const handleShareEmail = async () => {
    setIsShareOpen(false);
    setSavedNotice("Preparing invoice PDF...");

    let pdfExported = false;
    try {
      if (
        window.billflow?.invoices?.exportPdf &&
        invoice.id !== "sample-preview" &&
        invoice.id !== "draft-preview"
      ) {
        await window.billflow.invoices.exportPdf(invoice.id, selectedTemplate);
        if (window.billflow?.files?.openInvoicePdf) {
          await window.billflow.files.openInvoicePdf(invoice.id, true);
          pdfExported = true;
        }
      }
    } catch (err) {
      console.warn("Could not auto-reveal exported PDF:", err);
    }

    const link = generateInvoiceEmailLink({
      clientEmail: invoice.clientEmail,
      clientName: invoice.clientName,
      invoiceCode: invoice.code,
      totalFormatted: formatCents(invoice.amountCents, invoice.currency),
      advanceFormatted: invoice.advanceCents
        ? formatCents(invoice.advanceCents, invoice.currency)
        : null,
      balanceFormatted: formatCents(balanceDueCents, invoice.currency),
      dueDate: invoice.dueDate ? formatDateDisplay(invoice.dueDate) : null,
      deliveryUrl: delivery.hasLink ? delivery.formattedUrl : null,
      paymentDetails: settings?.paymentDetails,
      businessName,
    });
    window.open(link);
    setSavedNotice(
      pdfExported
        ? "Invoice PDF ready in Explorer to attach to your email!"
        : "Email draft opened with invoice message!"
    );
    setTimeout(() => setSavedNotice(null), 5000);
  };

  return (
    <Dialog onClose={onClose} width={880}>
      {/* 1. DIALOG HEADER WITH TEMPLATE PICKER */}
      <div className="app-dialog-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3>Invoice Preview</h3>
          <p className="flex items-center gap-2 mt-1 text-xs">
            <span className="font-bold text-accent">{invoice.code}</span>
            <span className="text-content-neutral-300 dark:text-neutral-600">•</span>
            <span className="font-medium text-content-neutral-600 dark:text-neutral-300">
              {invoice.clientName}
            </span>
            <span className="text-content-neutral-300 dark:text-neutral-600">•</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent/10 text-accent border border-accent/20">
              {invoice.status.replace("_", " ")}
            </span>
          </p>
        </div>

        {/* Template Dropdown Picker */}
        <div className="relative mr-10" ref={templateDropdownRef}>
          <button
            type="button"
            onClick={() => setIsTemplateDropdownOpen(!isTemplateDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-neutral-100 hover:bg-surface-neutral-200 dark:bg-white/5 dark:hover:bg-white/10 border border-line-neutral-200 dark:border-white/10 text-xs font-semibold text-content-neutral-800 dark:text-neutral-200 transition-colors cursor-pointer shadow-sm select-none"
            aria-expanded={isTemplateDropdownOpen}
            aria-haspopup="listbox"
            title="Choose invoice design template"
          >
            <LayoutTemplate className="w-3.5 h-3.5 text-accent opacity-90" />
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
              style={{
                backgroundColor:
                  selectedTemplate === "executive-wave" ? "#EAA828" : "#00A887",
              }}
            />
            <span className="font-bold">
              {selectedTemplate === "executive-wave"
                ? "Executive Wave"
                : "Geometric Teal"}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-content-neutral-400 transition-transform duration-200 ${
                isTemplateDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Dropdown Popover */}
          {isTemplateDropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-64 rounded-xl bg-surface border border-line-neutral-200 dark:border-white/10 shadow-2xl p-1.5 z-[150] text-content-neutral-900 dark:text-white animate-in fade-in-50 zoom-in-95">
              <div className="px-2.5 py-1 text-[10px] font-bold text-content-neutral-400 uppercase tracking-wider">
                Invoice Template
              </div>
              {TEMPLATES.map((tmpl) => {
                const isSelected = selectedTemplate === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => {
                      handleSelectTemplate(tmpl.id);
                      setIsTemplateDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-accent/10 text-accent font-bold"
                        : "hover:bg-surface-neutral-50 dark:hover:bg-white/10 text-content-neutral-800 dark:text-neutral-200 font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: tmpl.color }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate flex items-center gap-1.5">
                          <span>{tmpl.name}</span>
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-content-neutral-500 dark:text-neutral-400">
                            {tmpl.badge}
                          </span>
                        </div>
                        <div className="text-[10px] text-content-neutral-400 font-normal truncate mt-0.5">
                          {tmpl.description}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-accent shrink-0 ml-1" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2. DIALOG BODY (Hosting Document Sheet) */}
      <div className="app-dialog-body flex justify-center py-4 bg-surface-neutral-50 dark:bg-black/20 rounded-xl overflow-y-auto">
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
              .invoice-sheet-font {
                font-family: 'Nunito', 'Plus Jakarta Sans', ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif;
              }
            `,
          }}
        />

        {selectedTemplate === "geometric-teal" ? (
          /* TEMPLATE 1: GEOMETRIC TEAL */
          <div
            id="invoice-document-sheet"
            className="invoice-sheet-font w-full max-w-[720px] bg-white text-[#1f262e] rounded-sm shadow-xl min-h-[1020px] relative overflow-hidden select-text border border-black/5"
          >
            {/* TOP-LEFT GEOMETRIC ARTWORK */}
            <div className="absolute top-0 left-0 w-[420px] h-[340px] pointer-events-none z-0">
              <svg
                viewBox="0 0 420 340"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full"
              >
                <path
                  d="M 180 0 L 275 0 L 187 150 L 92 150 Z"
                  fill="#6B7685"
                  fillOpacity="0.35"
                />
                <path d="M 0 0 L 55 0 L 0 94 Z" fill="#38414D" />
                <path d="M 55 0 L 115 0 L 0 196 L 0 94 Z" fill="#006758" />
                <path d="M 115 0 L 180 0 L 0 306 L 0 196 Z" fill="#00A887" />
                <path d="M 0 68 L 360 68 L 312 150 L 0 150 Z" fill="#5A6577" />
                <path d="M 0 68 L 330 68 L 282 150 L 0 150 Z" fill="#222831" />
              </svg>
            </div>

            {/* Brand Banner */}
            <div className="absolute top-[68px] left-0 h-[82px] flex items-center pl-7 sm:pl-9 pr-6 z-10 max-w-[320px]">
              <div className="flex items-center gap-3">
                <div className="relative w-8 h-8 flex-shrink-0 flex items-center justify-center">
                  <img
                    src="/brand/logo-white.png"
                    alt="BillFlow"
                    className="w-7 h-7 object-contain drop-shadow-sm"
                  />
                </div>
                <div className="min-w-0">
                  <h1 className="text-[15px] sm:text-[16px] font-extrabold tracking-wide text-white uppercase truncate drop-shadow-sm leading-tight">
                    {businessName}
                  </h1>
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-300 uppercase tracking-wider truncate mt-0.5">
                    {professionalTitle}
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom-Right Geometric Accent */}
            <div className="absolute bottom-0 right-0 w-[200px] h-[180px] pointer-events-none z-0">
              <svg
                viewBox="0 0 200 180"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full"
              >
                <path d="M 55 180 L 160 0 L 178 0 L 73 180 Z" fill="#5A6577" />
                <path
                  d="M 73 180 L 178 0 L 200 0 L 200 36 L 105 180 Z"
                  fill="#006758"
                />
                <path d="M 105 180 L 200 36 L 200 180 Z" fill="#00A887" />
              </svg>
            </div>

            {/* Main Document Body */}
            <div className="relative z-10 px-8 sm:px-11 pt-8 pb-12">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start pb-6">
                <div className="pt-[160px]">
                  <div className="text-[11.5px] text-[#718096] space-y-0.5 pl-1 font-medium leading-relaxed">
                    {settings?.email && <p>{settings.email}</p>}
                    {settings?.phone && <p>{settings.phone}</p>}
                    {settings?.taxId && <p>Tax / Reg: {settings.taxId}</p>}
                  </div>
                </div>

                <div className="sm:text-right pt-6">
                  <div className="text-[38px] sm:text-[42px] font-black tracking-wide text-[#00A887] uppercase leading-none">
                    INVOICE
                  </div>
                  <div className="mt-4 space-y-1.5 text-xs">
                    <div className="flex sm:justify-end gap-4">
                      <span className="font-bold text-[#718096]">Invoice#:</span>
                      <span className="font-extrabold text-[#1f262e] tabular-nums min-w-[90px] sm:text-right">
                        {invoice.code}
                      </span>
                    </div>
                    <div className="flex sm:justify-end gap-4">
                      <span className="font-bold text-[#718096]">Date:</span>
                      <span className="font-semibold text-[#1f262e] min-w-[90px] sm:text-right">
                        {formatDateDisplay(invoice.issueDate)}
                      </span>
                    </div>
                    {invoice.dueDate && (
                      <div className="flex sm:justify-end gap-4">
                        <span className="font-bold text-[#718096]">Due Date:</span>
                        <span className="font-semibold text-[#1f262e] min-w-[90px] sm:text-right">
                          {formatDateDisplay(invoice.dueDate)}
                        </span>
                      </div>
                    )}
                    <div className="pt-1.5 flex sm:justify-end">
                      <span className="inline-flex items-center px-3 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase border border-[#00A887]/40 bg-[#00A887]/10 text-[#00A887]">
                        {invoice.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="mt-4 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-[#00A887] text-[11px] font-extrabold uppercase tracking-wider text-[#00A887]">
                      <th className="pb-3 pl-2 w-12 font-black">SL.</th>
                      <th className="pb-3 pr-4 font-black">Item Description</th>
                      <th className="pb-3 text-right pr-4 w-28 font-black">Price</th>
                      <th className="pb-3 text-center pr-4 w-16 font-black">Qty.</th>
                      <th className="pb-3 text-right pr-2 w-28 font-black">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] text-xs">
                    {displayItems.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-4 pl-2 font-bold text-[#718096] tabular-nums align-top">
                          {index + 1}
                        </td>
                        <td className="py-4 pr-4 align-top">
                          <p className="font-bold text-[#1f262e] leading-snug">
                            {item.description}
                          </p>
                        </td>
                        <td className="py-4 text-right pr-4 font-semibold text-[#1f262e] tabular-nums align-top">
                          {formatCents(item.unitPriceCents, invoice.currency)}
                        </td>
                        <td className="py-4 text-center pr-4 font-semibold text-[#718096] tabular-nums align-top">
                          {item.quantity}
                        </td>
                        <td className="py-4 text-right pr-2 font-black text-[#1f262e] tabular-nums align-top">
                          {formatCents(item.quantity * item.unitPriceCents, invoice.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary and Payment Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-8 items-start border-t border-[#E2E8F0] mt-4">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#00A887] mb-2">
                      Invoice to:
                    </h3>
                    <div className="text-xs text-[#1f262e] space-y-1 font-medium">
                      <p className="font-bold text-sm text-[#1f262e]">
                        {invoice.clientName}
                      </p>
                      {client?.contactPerson && (
                        <p className="text-[#718096]">Attn: {client.contactPerson}</p>
                      )}
                      {client?.phone && <p className="text-[#718096]">{client.phone}</p>}
                      {invoice.clientEmail && <p className="text-[#718096]">{invoice.clientEmail}</p>}
                    </div>

                    {delivery.hasLink && (
                      <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                        <span className="font-bold text-[#00A887] block mb-1">
                          Delivery Location
                        </span>
                        <button
                          type="button"
                          onClick={() => openExternalLink(delivery.formattedUrl)}
                          className="text-slate-800 hover:text-[#00A887] font-semibold flex items-center gap-1.5 transition-colors group text-left break-all"
                        >
                          <span className="underline decoration-slate-300 group-hover:decoration-[#00A887]">
                            {delivery.label}
                          </span>
                          <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 text-[#00A887]" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold text-[#00A887] mb-1.5">
                      Payment Info:
                    </h3>
                    <p className="text-xs text-[#718096] leading-relaxed font-medium whitespace-pre-line">
                      {settings?.paymentDetails ||
                        "Bank transfer details provided upon request."}
                    </p>
                  </div>
                </div>

                <div className="sm:text-right space-y-2 text-xs">
                  <div className="flex sm:justify-end gap-8 text-[#718096] font-semibold">
                    <span>Sub Total:</span>
                    <span className="font-bold text-[#1f262e] tabular-nums min-w-[90px]">
                      {formatCents(subtotalCents, invoice.currency)}
                    </span>
                  </div>

                  {invoice.discountCents ? (
                    <div className="flex sm:justify-end gap-8 text-rose-600 font-semibold">
                      <span>Discount:</span>
                      <span className="font-bold tabular-nums min-w-[90px]">
                        -{formatCents(invoice.discountCents, invoice.currency)}
                      </span>
                    </div>
                  ) : null}

                  {invoice.taxCents ? (
                    <div className="flex sm:justify-end gap-8 text-[#718096] font-semibold">
                      <span>Tax / VAT:</span>
                      <span className="font-bold text-[#1f262e] tabular-nums min-w-[90px]">
                        {formatCents(invoice.taxCents, invoice.currency)}
                      </span>
                    </div>
                  ) : null}

                  <div className="border-t-2 border-[#00A887] pt-2 my-1" />

                  <div className="flex sm:justify-end items-baseline gap-6">
                    <span className="text-base font-black text-[#00A887] uppercase tracking-wide">
                      Total:
                    </span>
                    <span className="text-2xl font-black text-[#00A887] tabular-nums min-w-[120px]">
                      {formatCents(invoice.amountCents, invoice.currency)}
                    </span>
                  </div>

                  {invoice.advanceCents ? (
                    <div className="flex sm:justify-end gap-8 text-slate-700 font-bold pt-2">
                      <span>Required Advance:</span>
                      <span className="tabular-nums min-w-[90px]">
                        {formatCents(invoice.advanceCents, invoice.currency)}
                      </span>
                    </div>
                  ) : null}

                  {paidCents > 0 ? (
                    <div className="flex sm:justify-end gap-8 text-emerald-600 font-bold">
                      <span>Amount Paid:</span>
                      <span className="tabular-nums min-w-[90px]">
                        {formatCents(paidCents, invoice.currency)}
                      </span>
                    </div>
                  ) : null}

                  <div className="flex sm:justify-end gap-8 text-[#1f262e] font-black pt-1">
                    <span>Balance Due:</span>
                    <span className="tabular-nums min-w-[90px]">
                      {formatCents(balanceDueCents, invoice.currency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer Terms */}
              <div className="pt-6">
                <div className="space-y-1 max-w-md">
                  <h4 className="text-xs font-extrabold text-[#00A887]">
                    Terms & Conditions
                  </h4>
                  <p className="text-[11px] text-[#718096] leading-relaxed font-medium">
                    {invoice.notes ||
                      "Payment is due within agreed terms. Development milestones proceed upon receipt of the advance."}
                  </p>
                  <div className="w-64 border-b border-[#E2E8F0] my-2" />
                  <p className="text-xs font-extrabold text-[#1f262e]">
                    Thank you for your business!
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* TEMPLATE 2: EXECUTIVE WAVE (Design matching media_1794338948279_15dab72f.jpg) */
          <div
            id="invoice-document-sheet"
            className="w-full max-w-[720px] bg-white text-[#1F242D] rounded-sm shadow-xl min-h-[1020px] relative overflow-hidden select-text border border-black/5 flex flex-col font-sans"
          >
            {/* Full-width Multi-Layered Wave Artwork (Flows continuously without container cutoff, compact header) */}
            <div className="absolute top-0 left-0 w-full h-[135px] pointer-events-none z-0">
              <svg
                viewBox="0 0 720 135"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full"
                preserveAspectRatio="none"
              >
                {/* 1. Deep Charcoal Header Base */}
                <path
                  d="M 0 0 L 720 0 L 720 68 C 666 61, 600 54, 519 55 C 427 56, 335 70, 239 80 C 183 86, 122 92, 61 94 C 30 95, 0 94, 0 93 Z"
                  fill="#23262B"
                />

                {/* 2. Top-Right Dark Slate Accent Curve */}
                <path
                  d="M 548 0 C 608 18, 672 31, 720 38 L 720 0 Z"
                  fill="#383D46"
                />

                {/* 3. Medium Charcoal Grey Ribbon */}
                <path
                  d="M 239 80 C 335 70, 427 56, 519 55 C 600 54, 666 61, 720 68 L 720 93 C 662 82, 590 71, 509 71 C 417 71, 335 76, 254 80 Z"
                  fill="#8B8F96"
                />

                {/* 4. Light Silvery Grey Ribbon */}
                <path
                  d="M 264 79 C 346 75, 427 71, 509 71 C 590 71, 662 82, 720 93 L 720 126 C 666 114, 590 96, 509 86 C 427 77, 356 77, 285 79 Z"
                  fill="#CCD0D7"
                />

                {/* 5. Soft Edge Accent Ribbon */}
                <path
                  d="M 335 76 C 417 77, 498 84, 570 97 C 631 108, 677 118, 720 126 L 720 129 C 677 121, 631 111, 570 99 C 498 86, 417 77, 335 77 Z"
                  fill="#E4E6EA"
                />
              </svg>
            </div>

            {/* Header Content */}
            <div className="relative z-10 flex justify-between items-start px-8 pt-5 text-white min-h-[135px]">
              {/* Brand Logo & Name */}
              <div className="flex items-center gap-3">
                <div className="relative w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg bg-amber-500/15 border border-amber-400/30">
                  <img
                    src="/brand/logo-white.png"
                    alt="Logo"
                    className="w-6 h-6 object-contain"
                  />
                </div>
                <div>
                  <h1 className="text-[16px] font-black tracking-wide uppercase leading-tight text-white">
                    {businessName}
                  </h1>
                  <p className="text-[9.5px] font-bold tracking-widest text-[#EAA828] uppercase mt-0.5">
                    {professionalTitle}
                  </p>
                </div>
              </div>

              {/* Contact Info (3 Columns with Golden Labels) */}
              <div className="flex gap-6 text-right">
                {settings?.phone && (
                  <div className="text-left">
                    <span className="block text-[9px] font-extrabold text-[#EAA828] uppercase tracking-wider">
                      Phone:
                    </span>
                    <span className="block text-[10px] font-semibold text-neutral-200 mt-0.5">
                      {settings.phone}
                    </span>
                  </div>
                )}
                {(settings?.email || settings?.website) && (
                  <div className="text-left">
                    <span className="block text-[9px] font-extrabold text-[#EAA828] uppercase tracking-wider">
                      Web:
                    </span>
                    <span className="block text-[10px] font-semibold text-neutral-200 mt-0.5 max-w-[150px] truncate">
                      {settings?.email || settings?.website}
                    </span>
                  </div>
                )}
                {settings?.address && (
                  <div className="text-left">
                    <span className="block text-[9px] font-extrabold text-[#EAA828] uppercase tracking-wider">
                      Area:
                    </span>
                    <span className="block text-[10px] font-semibold text-neutral-200 mt-0.5 max-w-[130px] truncate">
                      {settings.address}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. BODY CONTENT */}
            <div className="relative z-10 px-8 pt-3 pb-8 flex-1 flex flex-col">
              {/* Client & Invoice Hero Meta */}
              <div className="flex justify-between items-start mb-6">
                {/* To: Client */}
                <div className="max-w-[320px]">
                  <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    To:
                  </span>
                  <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                    {invoice.clientName}
                  </h2>
                  {client?.contactPerson && (
                    <p className="text-xs text-slate-600 mt-1">Attn: {client.contactPerson}</p>
                  )}
                  {client?.phone && (
                    <p className="text-xs text-slate-600 mt-0.5">Phone: {client.phone}</p>
                  )}
                  {invoice.clientEmail && (
                    <p className="text-xs text-slate-600 mt-0.5">{invoice.clientEmail}</p>
                  )}
                  {delivery.hasLink && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                      <span className="font-bold text-slate-500">Delivery:</span>
                      <button
                        type="button"
                        onClick={() => openExternalLink(delivery.formattedUrl)}
                        className="text-amber-600 hover:underline flex items-center gap-1 truncate max-w-[200px]"
                      >
                        <span className="truncate">{delivery.label}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Right: INVOICE Title & Metadata */}
                <div className="text-right">
                  <div className="text-[34px] font-black tracking-[3px] text-slate-900 uppercase leading-none mb-3">
                    INVOICE
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-end gap-3">
                      <span className="text-slate-500 font-semibold">Invoice No :</span>
                      <span className="font-extrabold text-slate-900 tabular-nums min-w-[80px] text-right">
                        {invoice.code}
                      </span>
                    </div>
                    <div className="flex justify-end gap-3">
                      <span className="text-slate-500 font-semibold">Date :</span>
                      <span className="font-semibold text-slate-900 min-w-[80px] text-right">
                        {formatDateDisplay(invoice.issueDate)}
                      </span>
                    </div>
                    {invoice.dueDate && (
                      <div className="flex justify-end gap-3">
                        <span className="text-slate-500 font-semibold">Due Date :</span>
                        <span className="font-semibold text-slate-900 min-w-[80px] text-right">
                          {formatDateDisplay(invoice.dueDate)}
                        </span>
                      </div>
                    )}
                    <div className="pt-1.5 flex justify-end">
                      <span className="inline-flex items-center px-3 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase border border-amber-400 bg-amber-50 text-amber-800">
                        {invoice.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Line Items Table (Split Header: Amber & Dark Charcoal) */}
              <div className="w-full mb-6 rounded overflow-hidden">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="text-xs font-extrabold uppercase tracking-wider text-white">
                      <th className="py-2.5 px-3 bg-[#EAA828] text-slate-950 w-10 text-center">
                        SL.
                      </th>
                      <th className="py-2.5 px-4 bg-[#EAA828] text-slate-950">
                        Item Description
                      </th>
                      <th className="py-2.5 px-4 bg-[#20232A] text-right w-28">
                        Price
                      </th>
                      <th className="py-2.5 px-3 bg-[#20232A] text-center w-16">
                        Qty
                      </th>
                      <th className="py-2.5 px-4 bg-[#20232A] text-right w-28">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {displayItems.map((item, index) => (
                      <tr
                        key={index}
                        className={index % 2 === 1 ? "bg-[#F1F3F7]" : "bg-white"}
                      >
                        <td className="py-3 px-3 text-center text-xs font-bold text-slate-400 tabular-nums">
                          {index + 1}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-xs font-bold text-slate-900">
                            {item.description}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Deliverable milestone &amp; software sprint scope
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-xs font-semibold text-slate-700 tabular-nums">
                          {formatCents(item.unitPriceCents, invoice.currency)}
                        </td>
                        <td className="py-3 px-3 text-center text-xs font-semibold text-slate-700 tabular-nums">
                          {item.quantity}
                        </td>
                        <td className="py-3 px-4 text-right text-xs font-extrabold text-slate-900 tabular-nums">
                          {formatCents(item.quantity * item.unitPriceCents, invoice.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary & Payment Grid */}
              <div className="grid grid-cols-2 gap-8 items-start mb-6 pt-2">
                {/* Left: Payment Info */}
                <div>
                  <h4 className="text-xs font-black tracking-wider text-slate-900 uppercase mb-2">
                    Payment Info
                  </h4>
                  <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50 p-3 rounded-lg border border-slate-100">
                    {settings?.paymentDetails ||
                      "Payment via Bank Transfer / Wire Transfer\nDetails provided upon invoice issue."}
                  </div>
                </div>

                {/* Right: Totals with Golden Amber Banner */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600 py-0.5">
                    <span className="font-semibold">Sub Total:</span>
                    <span className="font-bold text-slate-900 tabular-nums">
                      {formatCents(subtotalCents, invoice.currency)}
                    </span>
                  </div>

                  {invoice.discountCents ? (
                    <div className="flex justify-between text-rose-600 py-0.5">
                      <span className="font-semibold">Discount:</span>
                      <span className="font-bold tabular-nums">
                        -{formatCents(invoice.discountCents, invoice.currency)}
                      </span>
                    </div>
                  ) : null}

                  {invoice.taxCents ? (
                    <div className="flex justify-between text-slate-600 py-0.5">
                      <span className="font-semibold">Tax / VAT:</span>
                      <span className="font-bold text-slate-900 tabular-nums">
                        {formatCents(invoice.taxCents, invoice.currency)}
                      </span>
                    </div>
                  ) : null}

                  {/* Grand Total Solid Amber Bar */}
                  <div className="mt-2 bg-[#EAA828] text-slate-950 px-4 py-2.5 rounded-sm flex justify-between items-center font-black">
                    <span className="text-xs uppercase tracking-wider">Grand Total</span>
                    <span className="text-base tabular-nums">
                      {formatCents(invoice.amountCents, invoice.currency)}
                    </span>
                  </div>

                  {invoice.advanceCents ? (
                    <div className="flex justify-between text-slate-700 pt-2 py-0.5">
                      <span className="font-bold">Required Advance:</span>
                      <span className="font-extrabold text-slate-900 tabular-nums">
                        {formatCents(invoice.advanceCents, invoice.currency)}
                      </span>
                    </div>
                  ) : null}

                  {paidCents > 0 ? (
                    <div className="flex justify-between text-emerald-600 py-0.5">
                      <span className="font-bold">Amount Paid:</span>
                      <span className="font-extrabold tabular-nums">
                        {formatCents(paidCents, invoice.currency)}
                      </span>
                    </div>
                  ) : null}

                  <div className="flex justify-between text-slate-900 pt-1 border-t border-slate-200 py-0.5 font-black">
                    <span>Balance Due:</span>
                    <span className="text-sm tabular-nums">
                      {formatCents(balanceDueCents, invoice.currency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-auto pt-4 border-t border-slate-200 flex justify-between items-end">
                <div className="max-w-[420px]">
                  <h5 className="text-xs font-black text-slate-900 mb-1">
                    Thank you for your business!
                  </h5>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    <strong className="text-slate-700">TERMS: </strong>
                    {invoice.notes ||
                      "Payment due within specified due date. All software deliverables and intellectual property transfer upon final settlement."}
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-sm font-black text-slate-900">
                    {businessName}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                    {professionalTitle}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. DIALOG FOOTER */}
      <div className="app-dialog-footer">
        <div className="mr-auto flex items-center gap-2">
          {savedNotice && (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold animate-fadeIn">
              <Check className="w-4 h-4" />
              <span>{savedNotice}</span>
            </span>
          )}
        </div>

        <Button
          variant="secondary"
          type="button"
          onClick={handlePrint}
          title="Print this invoice document"
        >
          <Printer className="w-4 h-4" />
          <span>Print</span>
        </Button>

        {/* Share Button & Dropdown */}
        <div className="relative" ref={shareDropdownRef}>
          <Button
            variant="secondary"
            type="button"
            onClick={() => setIsShareOpen(!isShareOpen)}
            title="Share invoice PDF via WhatsApp or Email"
          >
            <Share2 className="w-4 h-4 text-sky-500" />
            <span>Share</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-70" />
          </Button>

          {isShareOpen && (
            <div className="absolute right-0 bottom-full mb-2 w-56 rounded-xl bg-surface border border-line-neutral-200 dark:border-white/10 shadow-2xl p-1.5 z-[150] text-content-neutral-900 dark:text-white animate-in fade-in-50 zoom-in-95">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-neutral-50 dark:hover:bg-white/10 text-left transition-colors cursor-pointer text-xs font-semibold"
              >
                <div className="w-6 h-6 rounded-md bg-[#25D366]/15 text-[#25D366] flex items-center justify-center shrink-0">
                  <MessageSquare className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-bold">WhatsApp</div>
                  <div className="text-[10px] text-content-neutral-400 font-normal">
                    Share invoice PDF & brief
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleShareEmail}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-neutral-50 dark:hover:bg-white/10 text-left transition-colors cursor-pointer text-xs font-semibold mt-1"
              >
                <div className="w-6 h-6 rounded-md bg-sky-500/15 text-sky-500 flex items-center justify-center shrink-0">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-bold">Email</div>
                  <div className="text-[10px] text-content-neutral-400 font-normal">
                    Draft email with PDF attached
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>

        {onRecordPayment && invoice.status !== "PAID" && (
          <Button
            variant="secondary"
            type="button"
            onClick={onRecordPayment}
          >
            <CreditCard className="w-4 h-4 text-emerald-500" />
            <span>Record Payment</span>
          </Button>
        )}

        <Button
          variant="primary"
          type="button"
          onClick={handleSavePdfAs}
          disabled={isSavingPdf}
          title="Choose folder location and save invoice as PDF"
        >
          <Download className="w-4 h-4" />
          <span>{isSavingPdf ? "Saving PDF..." : "Save as PDF"}</span>
        </Button>
      </div>
    </Dialog>
  );
}
