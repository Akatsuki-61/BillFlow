"use client";

import { ExternalLink, Phone, Mail, MapPin } from "lucide-react";
import type { InvoiceTemplateProps } from "./types";

export function ApexOrangeTemplate({
  invoice,
  client,
  settings,
  delivery,
  businessName,
  professionalTitle,
  openExternalLink,
  formatMoney,
  formatDate,
}: InvoiceTemplateProps) {
  const subtotalCents =
    invoice.items && invoice.items.length > 0
      ? invoice.items.reduce(
          (sum, item) => sum + item.quantity * item.unitPriceCents,
          0,
        )
      : invoice.amountCents;

  const paidCents =
    invoice.payments && invoice.payments.length > 0
      ? invoice.payments.reduce((sum, p) => sum + p.amountCents, 0)
      : invoice.paidCents || 0;

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

  return (
    <div
      id="invoice-document-sheet"
      className="w-full max-w-[720px] bg-white text-[#1F242D] rounded-sm shadow-xl min-h-[1020px] relative overflow-hidden select-text border border-black/5 flex flex-col font-sans"
    >
      {/* 1. TOP DIAGONAL APEX HEADER */}
      <div className="relative w-full h-[125px] overflow-hidden select-none">
        {/* Background SVG Polygons */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <svg
            viewBox="0 0 720 125"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
            preserveAspectRatio="none"
          >
            {/* 1. Main Orange Banner (Stops at y=96, pure white underneath) */}
            <polygon points="0,0 280,0 370,96 0,96" fill="#F25C05" />
            {/* 2. Parallel Orange Accent Stripe (Height 110) */}
            <polygon points="310,0 346,0 449,110 413,110" fill="#F25C05" />
            {/* 3. Black Polygon (Height 125, directly flush against Orange Stripe) */}
            <polygon points="346,0 720,0 720,125 463,125" fill="#111315" />
          </svg>
        </div>

        {/* Content Over Header */}
        <div className="relative z-10 flex justify-between items-start h-full px-8 text-white">
          {/* Left: Brand Identity & Full Name inside Orange Banner (height 96px) */}
          <div className="flex items-center gap-3.5 max-w-[340px] h-[96px]">
            <div className="w-9 h-9 rounded-md bg-white/10 flex items-center justify-center p-1.5 shadow-sm shrink-0 border border-white/20">
              <img
                src="/brand/logo-white.png"
                alt="Logo"
                className="w-5 h-5 object-contain"
              />
            </div>
            <div className="min-w-0 pr-4">
              <h1 className="text-[17px] font-black uppercase tracking-wider leading-tight text-white whitespace-nowrap">
                {businessName}
              </h1>
              <p className="text-[9.5px] font-bold text-orange-100 uppercase tracking-widest truncate mt-0.5">
                {professionalTitle}
              </p>
            </div>
          </div>

          {/* Right: INVOICE Title & Metadata inside Black Polygon (height 125px) */}
          <div className="text-right h-[125px] flex flex-col justify-center">
            <div className="text-[30px] font-black tracking-[2.5px] text-white uppercase leading-none mb-2">
              INVOICE
            </div>
            <div className="space-y-1.5 text-xs text-white/90">
              <div className="flex justify-end gap-4">
                <span className="text-white/75 font-bold">Invoice No.:</span>
                <span className="font-extrabold text-white tabular-nums min-w-[95px] text-right">
                  {invoice.code}
                </span>
              </div>
              <div className="flex justify-end gap-4">
                <span className="text-white/75 font-bold">Date:</span>
                <span className="font-semibold text-white min-w-[95px] text-right">
                  {formatDate(invoice.issueDate)}
                </span>
              </div>
              {invoice.dueDate && (
                <div className="flex justify-end gap-4">
                  <span className="text-white/75 font-bold">Due Date:</span>
                  <span className="font-semibold text-white min-w-[95px] text-right">
                    {formatDate(invoice.dueDate)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. BODY CONTENT */}
      <div className="relative z-10 px-8 pt-6 pb-4 flex-1 flex flex-col">
        {/* Client Header */}
        <div className="mb-6">
          {/* Left: INVOICE TO */}
          <div>
            <div className="text-[11px] font-black text-[#F25C05] uppercase tracking-wider mb-1">
              INVOICE TO:
            </div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              {invoice.clientName}
            </h2>
            {client?.contactPerson && (
              <p className="text-xs text-slate-600 mt-0.5 font-medium">
                {client.contactPerson}
                {client.contactRole ? `, ${client.contactRole}` : ""}
              </p>
            )}
            {client?.phone && (
              <p className="text-xs text-slate-600 mt-0.5">
                Phone: {client.phone}
              </p>
            )}
            {invoice.clientEmail && (
              <p className="text-xs text-slate-600 mt-0.5">
                {invoice.clientEmail}
              </p>
            )}
            {delivery.hasLink && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                <span className="font-bold text-[#F25C05]">Delivery:</span>
                <button
                  type="button"
                  onClick={() => openExternalLink(delivery.formattedUrl)}
                  className="text-slate-800 hover:text-[#F25C05] hover:underline flex items-center gap-1 truncate max-w-[200px]"
                >
                  <span className="truncate">{delivery.label}</span>
                  <ExternalLink className="w-3 h-3 shrink-0 text-[#F25C05]" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 3. LINE ITEMS TABLE (Solid Full Orange Bar, Full Grid Borders) */}
        <div className="w-full mb-6">
          <table className="w-full border-collapse border border-slate-200 text-left">
            <thead>
              <tr className="text-xs font-black uppercase tracking-wider text-white bg-[#F25C05]">
                <th className="py-2.5 px-3 border border-orange-600 text-white w-12 text-center">
                  NO.
                </th>
                <th className="py-2.5 px-4 border border-orange-600 text-white">
                  PRODUCT DESCRIPTION
                </th>
                <th className="py-2.5 px-4 border border-orange-600 text-right w-28 text-white">
                  PRICE
                </th>
                <th className="py-2.5 px-3 border border-orange-600 text-center w-16 text-white">
                  QTY.
                </th>
                <th className="py-2.5 px-4 border border-orange-600 text-right w-28 text-white">
                  TOTAL
                </th>
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item, index) => (
                <tr
                  key={index}
                  className="hover:bg-slate-50/60 transition-colors"
                >
                  <td className="py-3 px-3 border border-slate-200 text-center text-xs font-bold text-slate-500 tabular-nums align-top">
                    {String(index + 1).padStart(2, "0")}
                  </td>
                  <td className="py-3 px-4 border border-slate-200 align-top">
                    <div className="text-xs font-bold text-slate-900">
                      {item.description}
                    </div>
                    <div className="text-[10.5px] text-slate-500 mt-0.5">
                      Deliverable milestone &amp; software sprint scope
                    </div>
                  </td>
                  <td className="py-3 px-4 border border-slate-200 text-right text-xs font-semibold text-slate-700 tabular-nums align-top">
                    {formatMoney(item.unitPriceCents, invoice.currency)}
                  </td>
                  <td className="py-3 px-3 border border-slate-200 text-center text-xs font-semibold text-slate-700 tabular-nums align-top">
                    {item.quantity}
                  </td>
                  <td className="py-3 px-4 border border-slate-200 text-right text-xs font-bold text-slate-900 tabular-nums align-top">
                    {formatMoney(
                      item.quantity * item.unitPriceCents,
                      invoice.currency,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 4. TOTALS & SUMMARY */}
        <div className="grid grid-cols-2 gap-8 items-start mb-6">
          {/* Left: Numbered Terms & Conditions */}
          <div>
            <div className="text-xs font-black text-[#F25C05] uppercase tracking-wider mb-1.5">
              Terms &amp; Conditions:
            </div>
            <div className="text-[10.5px] text-slate-600 leading-relaxed font-medium space-y-1">
              <p>
                01. Payment is due within agreed terms. Development proceeds
                upon confirmation of payment.
              </p>
              <p>
                02. All deliverable milestones, intellectual property, and
                documentation transfer upon settlement.
              </p>
              {invoice.notes && <p>03. {invoice.notes}</p>}
            </div>

            {/* Closing Notice */}
            <div className="text-xs font-black text-[#F25C05] mt-4 tracking-wide">
              Thank you for your business with us.
            </div>
          </div>

          {/* Right: Subtotal, Discount, Tax & Solid Orange Total Bar */}
          <div>
            <div className="space-y-1.5 text-xs pb-3">
              <div className="flex justify-between text-slate-600 py-0.5">
                <span className="font-semibold">Subtotal:</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {formatMoney(subtotalCents, invoice.currency)}
                </span>
              </div>

              {invoice.discountCents ? (
                <div className="flex justify-between text-rose-600 py-0.5">
                  <span className="font-semibold">Discount:</span>
                  <span className="font-bold tabular-nums">
                    -{formatMoney(invoice.discountCents, invoice.currency)}
                  </span>
                </div>
              ) : null}

              {invoice.taxCents ? (
                <div className="flex justify-between text-slate-600 py-0.5">
                  <span className="font-semibold">Tax:</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {formatMoney(invoice.taxCents, invoice.currency)}
                  </span>
                </div>
              ) : null}

              {invoice.advanceCents ? (
                <div className="flex justify-between text-slate-700 py-0.5">
                  <span className="font-semibold">Required Advance:</span>
                  <span className="font-bold tabular-nums">
                    {formatMoney(invoice.advanceCents, invoice.currency)}
                  </span>
                </div>
              ) : null}

              {paidCents > 0 ? (
                <div className="flex justify-between text-emerald-600 py-0.5">
                  <span className="font-semibold">Amount Paid:</span>
                  <span className="font-bold tabular-nums">
                    {formatMoney(paidCents, invoice.currency)}
                  </span>
                </div>
              ) : null}
            </div>

            {/* Solid Orange Grand Total Bar */}
            <div className="w-full bg-[#F25C05] text-white px-4 py-2.5 rounded-sm flex justify-between items-center shadow-sm">
              <span className="text-sm font-black uppercase tracking-wider text-white">
                Total:
              </span>
              <span className="text-lg font-black text-white tabular-nums tracking-wide">
                {formatMoney(invoice.amountCents, invoice.currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. BOTTOM GEOMETRIC FOOTER */}
      <div className="relative w-full h-[40px] overflow-hidden select-none mt-auto">
        <div className="absolute inset-0 pointer-events-none z-0">
          <svg
            viewBox="0 0 720 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
            preserveAspectRatio="none"
          >
            {/* Orange Angled Footer on Left */}
            <polygon points="0,0 450,0 495,40 0,40" fill="#F25C05" />
          </svg>
        </div>

        <div className="relative z-10 flex items-center justify-between h-full px-8 text-white text-[11px] font-semibold">
          {/* Contact Icons Inside Orange Bar */}
          <div className="flex items-center gap-6 text-white">
            {settings?.phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 fill-white text-transparent opacity-90" />
                <span>{settings.phone}</span>
              </div>
            )}
            {(settings?.email || settings?.website) && (
              <div className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-white opacity-90" />
                <span>{settings?.email || settings?.website}</span>
              </div>
            )}
            {settings?.address && (
              <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                <MapPin className="w-3.5 h-3.5 text-white opacity-90 flex-shrink-0" />
                <span className="truncate">{settings.address}</span>
              </div>
            )}
          </div>

          {/* Right Text */}
          <div className="text-slate-400 text-[10px] font-bold tracking-wider uppercase">
            BillFlow
          </div>
        </div>
      </div>
    </div>
  );
}

export default ApexOrangeTemplate;
