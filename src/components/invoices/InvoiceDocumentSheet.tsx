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
} from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Workspace";
import { formatCents, formatDateDisplay } from "@/lib/format";
import type { InvoiceWithClient } from "@/types/billing";
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

export default function InvoiceDocumentSheet({
  invoice,
  onClose,
  onOpenPdf,
  onRecordPayment,
}: InvoiceDocumentSheetProps) {
  const { settings } = useSettings();
  const { clients } = useClients();
  const { saveInvoicePdfAs } = useInvoices();

  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const shareDropdownRef = useRef<HTMLDivElement>(null);

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

  // Close share dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        shareDropdownRef.current &&
        !shareDropdownRef.current.contains(e.target as Node)
      ) {
        setIsShareOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleSavePdfAs = async () => {
    setIsSavingPdf(true);
    setSavedNotice(null);
    try {
      if (window.billflow?.invoices?.savePdfAs) {
        const result = await window.billflow.invoices.savePdfAs(invoice.id);
        if (result.success && result.filePath) {
          const fileName = result.filePath.split(/[\\/]/).pop() || "invoice.pdf";
          setSavedNotice(`Saved: ${fileName}`);
          setTimeout(() => setSavedNotice(null), 4500);
          return;
        }
      } else if (saveInvoicePdfAs) {
        const result = await saveInvoicePdfAs(invoice.id);
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

  const handleShareWhatsApp = () => {
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
    setIsShareOpen(false);
  };

  const handleShareEmail = () => {
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
    setIsShareOpen(false);
  };

  return (
    <Dialog onClose={onClose} width={880}>
      {/* 1. DIALOG HEADER (App-native header from 1st clone version) */}
      <div className="app-dialog-header">
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
      </div>

      {/* 2. DIALOG BODY (Scrollable container hosting the authentic invoice document) */}
      <div className="app-dialog-body flex justify-center py-4 bg-surface-neutral-50 dark:bg-black/20 rounded-xl overflow-y-auto">
        {/* Nunito Rounded Corner Font Import */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
              .invoice-sheet-font {
                font-family: 'Nunito', 'Plus Jakarta Sans', ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif;
              }
            `,
          }}
        />

        {/* INVOICE SHEET (Authentic Portrait A4 Document Sheet with Rounded Font) */}
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
              {/* 1. Slate Shadow Tab behind ribbons */}
              <path
                d="M 180 0 L 275 0 L 187 150 L 92 150 Z"
                fill="#6B7685"
                fillOpacity="0.35"
              />
              {/* 2. Dark Slate Stripe */}
              <path d="M 0 0 L 55 0 L 0 94 Z" fill="#38414D" />
              {/* 3. Dark Teal Stripe */}
              <path d="M 55 0 L 115 0 L 0 196 L 0 94 Z" fill="#006758" />
              {/* 4. Vibrant Bright Teal Stripe */}
              <path d="M 115 0 L 180 0 L 0 306 L 0 196 Z" fill="#00A887" />
              {/* 5. Horizontal Banner Slate Accent Tab */}
              <path d="M 0 68 L 360 68 L 312 150 L 0 150 Z" fill="#5A6577" />
              {/* 6. Horizontal Banner Charcoal Trapezoid */}
              <path d="M 0 68 L 330 68 L 282 150 L 0 150 Z" fill="#222831" />
            </svg>
          </div>

          {/* Brand Identity inside the Horizontal Charcoal Banner (With Official BillFlow Logo) */}
          <div className="absolute top-[68px] left-0 h-[82px] flex items-center pl-7 sm:pl-9 pr-6 z-10 max-w-[320px]">
            <div className="flex items-center gap-3">
              {/* BillFlow App Logo */}
              <div className="relative w-8 h-8 flex-shrink-0 flex items-center justify-center">
                <img
                  src="/brand/logo-white.png"
                  alt="BillFlow"
                  className="w-7 h-7 object-contain drop-shadow-sm"
                />
              </div>

              {/* Business Name and Subtitle in rounded typography */}
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

          {/* BOTTOM-RIGHT GEOMETRIC ACCENT (SVG from template) */}
          <div className="absolute bottom-0 right-0 w-[200px] h-[180px] pointer-events-none z-0">
            <svg
              viewBox="0 0 200 180"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full"
            >
              {/* 1. Slate Stripe */}
              <path d="M 55 180 L 160 0 L 178 0 L 73 180 Z" fill="#5A6577" />
              {/* 2. Dark Teal Stripe */}
              <path
                d="M 73 180 L 178 0 L 200 0 L 200 36 L 105 180 Z"
                fill="#006758"
              />
              {/* 3. Vibrant Bright Teal Corner Polygon */}
              <path
                d="M 105 180 L 200 36 L 200 180 Z"
                fill="#00A887"
              />
            </svg>
          </div>

          {/* MAIN DOCUMENT BODY */}
          <div className="relative z-10 px-8 sm:px-11 pt-8 pb-12">
            {/* 1. Header Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start pb-6">
              {/* Left Column Spacer & Contact Information under banner */}
              <div className="pt-[160px]">
                <div className="text-[11.5px] text-[#718096] space-y-0.5 pl-1 font-medium leading-relaxed">
                  {settings?.email && <p>{settings.email}</p>}
                  {settings?.phone && <p>{settings.phone}</p>}
                  {settings?.taxId && <p>Tax / Reg: {settings.taxId}</p>}
                </div>
              </div>

              {/* Right: INVOICE Heading and Metadata */}
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

            {/* 2. Items Table (Clean white header, rounded teal font, thin line) */}
            <div className="mt-6 mb-8">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#00A887] text-[#00A887] text-[12px] uppercase tracking-wider font-extrabold">
                    <th className="py-2.5 px-3 w-12 font-extrabold">SL.</th>
                    <th className="py-2.5 px-3 font-extrabold">Item Description</th>
                    <th className="py-2.5 px-3 text-right w-28 font-extrabold">Price</th>
                    <th className="py-2.5 px-3 text-center w-16 font-extrabold">Qty.</th>
                    <th className="py-2.5 px-3 text-right w-32 font-extrabold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-xs">
                  {invoice.items && invoice.items.length > 0 ? (
                    invoice.items.map((it, idx) => (
                      <tr key={it.id || idx} className="hover:bg-slate-50/50">
                        <td className="py-3.5 px-3 text-[#718096] font-semibold">
                          {idx + 1}
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-[#1f262e]">
                          {it.description}
                        </td>
                        <td className="py-3.5 px-3 text-right text-[#4A5568] tabular-nums font-medium">
                          {formatCents(it.unitPriceCents, invoice.currency)}
                        </td>
                        <td className="py-3.5 px-3 text-center text-[#4A5568] tabular-nums font-medium">
                          {it.quantity}
                        </td>
                        <td className="py-3.5 px-3 text-right font-extrabold text-[#1f262e] tabular-nums">
                          {formatCents(
                            it.quantity * it.unitPriceCents,
                            invoice.currency,
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="py-3.5 px-3 text-[#718096] font-semibold">1</td>
                      <td className="py-3.5 px-3 font-semibold text-[#1f262e]">
                        {invoice.title || "Professional Services"}
                      </td>
                      <td className="py-3.5 px-3 text-right text-[#4A5568] tabular-nums font-medium">
                        {formatCents(invoice.amountCents, invoice.currency)}
                      </td>
                      <td className="py-3.5 px-3 text-center text-[#4A5568] font-medium">1</td>
                      <td className="py-3.5 px-3 text-right font-extrabold text-[#1f262e] tabular-nums">
                        {formatCents(invoice.amountCents, invoice.currency)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 3. Three-Column Section (Invoice to: | Payment Info: | Totals) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 pb-8 border-b border-[#E2E8F0]">
              {/* Col 1: Invoice to */}
              <div className="space-y-1.5">
                <h3 className="text-xs font-extrabold text-[#00A887] uppercase tracking-wider">
                  Invoice to:
                </h3>
                <p className="text-sm font-extrabold text-[#1f262e]">
                  {invoice.clientName}
                </p>
                {invoice.clientEmail && (
                  <p className="text-xs text-[#718096] font-medium">{invoice.clientEmail}</p>
                )}
                {client?.phone && (
                  <p className="text-xs text-[#718096] font-medium">
                    {client.phone}
                  </p>
                )}
                {delivery.hasLink && (
                  <div className="pt-1.5">
                    <button
                      type="button"
                      onClick={(e) => openExternalLink(delivery.formattedUrl, e)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#00A887] hover:underline"
                    >
                      <span>{delivery.label}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Col 2: Payment Info */}
              <div className="space-y-1.5">
                <h3 className="text-xs font-extrabold text-[#00A887] uppercase tracking-wider">
                  Payment Info:
                </h3>
                {settings?.paymentDetails ? (
                  <div className="text-xs text-[#4A5568] whitespace-pre-line leading-relaxed font-medium">
                    {settings.paymentDetails}
                  </div>
                ) : (
                  <p className="text-xs text-[#718096] italic font-medium">
                    Bank transfer details provided upon request.
                  </p>
                )}
              </div>

              {/* Col 3: Totals & Balance */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-[#718096] font-medium">
                  <span>Sub Total:</span>
                  <span className="font-bold text-[#1f262e] tabular-nums">
                    {formatCents(subtotalCents, invoice.currency)}
                  </span>
                </div>

                {invoice.discountCents ? (
                  <div className="flex justify-between text-xs text-rose-600 font-medium">
                    <span>Discount:</span>
                    <span className="font-bold tabular-nums">
                      -{formatCents(invoice.discountCents, invoice.currency)}
                    </span>
                  </div>
                ) : null}

                {invoice.taxCents ? (
                  <div className="flex justify-between text-xs text-[#718096] font-medium">
                    <span>Tax:</span>
                    <span className="font-bold text-[#1f262e] tabular-nums">
                      {formatCents(invoice.taxCents, invoice.currency)}
                    </span>
                  </div>
                ) : null}

                <div className="pt-2 border-t-2 border-[#00A887] flex justify-between items-baseline">
                  <span className="text-sm font-black text-[#00A887] uppercase tracking-wider">
                    Total:
                  </span>
                  <span className="text-xl font-black text-[#00A887] tabular-nums">
                    {formatCents(invoice.amountCents, invoice.currency)}
                  </span>
                </div>

                {invoice.advanceCents ? (
                  <div className="flex justify-between text-xs text-[#4A5568] pt-1 font-medium">
                    <span className="font-bold">Required Advance:</span>
                    <span className="font-extrabold tabular-nums">
                      {formatCents(invoice.advanceCents, invoice.currency)}
                    </span>
                  </div>
                ) : null}

                {paidCents > 0 && (
                  <div className="flex justify-between text-xs text-emerald-600 font-medium">
                    <span>Amount Paid:</span>
                    <span className="font-extrabold tabular-nums">
                      {formatCents(paidCents, invoice.currency)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-xs font-black text-[#1f262e] pt-1">
                  <span>Balance Due:</span>
                  <span className="tabular-nums font-black">
                    {formatCents(balanceDueCents, invoice.currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Footer Section (Terms & Conditions - NO SIGNATURE) */}
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
      </div>

      {/* 3. DIALOG FOOTER (App-native footer with BillFlow standard Buttons from 1st clone version) */}
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
          onClick={onClose}
        >
          Close
        </Button>

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
            title="Share invoice via WhatsApp or Email"
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
                  <div className="text-[10px] text-content-neutral-400 font-normal">Pre-filled message</div>
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
                  <div className="text-[10px] text-content-neutral-400 font-normal">Open mail app draft</div>
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
