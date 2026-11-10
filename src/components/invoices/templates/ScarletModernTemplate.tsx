"use client";

import React from "react";
import { ExternalLink, Phone, Mail, MapPin } from "lucide-react";
import type { InvoiceTemplateProps } from "./types";

export function ScarletModernTemplate({
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

  const balanceDueCents = Math.max(0, invoice.amountCents - paidCents);

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
      {/* 1. TOP SPLIT GEOMETRIC HEADER */}
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
            {/* Left Dark Slate Polygon */}
            <polygon points="0,0 295,0 380,125 0,125" fill="#1E2229" />
            {/* Right Vibrant Crimson Red Polygon */}
            <polygon points="295,0 720,0 720,125 380,125" fill="#E5252A" />
          </svg>
        </div>

        {/* Content Over Header */}
        <div className="relative z-10 flex justify-between items-center h-full px-8 text-white">
          {/* Left: Brand Identity */}
          <div className="flex items-center gap-3.5 max-w-[280px]">
            <div className="w-10 h-10 rounded-lg bg-[#E5252A] flex items-center justify-center p-2 shadow-sm flex-shrink-0">
              <img
                src="/brand/logo-white.png"
                alt="Logo"
                className="w-6 h-6 object-contain"
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-[17px] font-black uppercase tracking-wider leading-tight text-white truncate">
                {businessName}
              </h1>
              <p className="text-[9.5px] font-bold text-neutral-300 uppercase tracking-widest truncate mt-0.5">
                {professionalTitle}
              </p>
            </div>
          </div>

          {/* Right: INVOICE Title & Metadata */}
          <div className="text-right">
            <div className="text-[32px] font-black tracking-[2px] text-white uppercase leading-none mb-2">
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
      <div className="relative z-10 px-8 pt-7 pb-4 flex-1 flex flex-col">
        {/* Client & Payment Method Two-Column Header */}
        <div className="grid grid-cols-2 gap-8 items-start mb-6">
          {/* Left: INVOICE TO */}
          <div>
            <div className="text-[11px] font-black text-[#E5252A] uppercase tracking-wider mb-1">
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
              <p className="text-xs text-slate-600 mt-0.5">Phone: {client.phone}</p>
            )}
            {invoice.clientEmail && (
              <p className="text-xs text-slate-600 mt-0.5">{invoice.clientEmail}</p>
            )}
            {delivery.hasLink && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                <span className="font-bold text-[#E5252A]">Delivery:</span>
                <button
                  type="button"
                  onClick={() => openExternalLink(delivery.formattedUrl)}
                  className="text-slate-800 hover:text-[#E5252A] hover:underline flex items-center gap-1 truncate max-w-[200px]"
                >
                  <span className="truncate">{delivery.label}</span>
                  <ExternalLink className="w-3 h-3 shrink-0 text-[#E5252A]" />
                </button>
              </div>
            )}
          </div>

          {/* Right: Payment Method */}
          <div className="text-right sm:text-left sm:pl-8">
            <div className="text-[11px] font-black text-[#E5252A] uppercase tracking-wider mb-1.5">
              Payment Method
            </div>
            <div className="text-xs space-y-1 text-slate-600 font-medium">
              <div className="flex sm:justify-start gap-2">
                <span className="font-bold text-slate-800 min-w-[95px]">Account No:</span>
                <span className="tabular-nums">
                  {settings?.taxId || "1234 5678 910"}
                </span>
              </div>
              <div className="flex sm:justify-start gap-2">
                <span className="font-bold text-slate-800 min-w-[95px]">Account Name:</span>
                <span className="truncate">{businessName}</span>
              </div>
              <div className="flex sm:justify-start gap-2">
                <span className="font-bold text-slate-800 min-w-[95px]">Branch / Info:</span>
                <span className="truncate">
                  {settings?.paymentDetails || "Bank transfer details upon request"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. LINE ITEMS TABLE (Split Header: Crimson & Slate, Dotted Row Dividers) */}
        <div className="w-full mb-6">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="text-xs font-extrabold uppercase tracking-wider text-white">
                <th className="py-2.5 px-3 bg-[#E5252A] text-white w-10 text-center">
                  No.
                </th>
                <th className="py-2.5 px-4 bg-[#E5252A] text-white">
                  Product Description
                </th>
                <th className="py-2.5 px-4 bg-[#1E2229] text-right w-28 text-white">
                  Price
                </th>
                <th className="py-2.5 px-3 bg-[#1E2229] text-center w-16 text-white">
                  QTY.
                </th>
                <th className="py-2.5 px-4 bg-[#1E2229] text-right w-28 text-white">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item, index) => (
                <tr
                  key={index}
                  className="border-b border-dotted border-slate-300 hover:bg-slate-50/50 transition-colors"
                >
                  <td className="py-3.5 px-3 text-center text-xs font-bold text-slate-400 tabular-nums align-top">
                    {index + 1}
                  </td>
                  <td className="py-3.5 px-4 align-top">
                    <div className="text-xs font-bold text-slate-900">
                      {item.description}
                    </div>
                    <div className="text-[10.5px] text-slate-500 mt-0.5">
                      Deliverable milestone &amp; software sprint scope
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right text-xs font-semibold text-slate-700 tabular-nums align-top">
                    {formatMoney(item.unitPriceCents, invoice.currency)}
                  </td>
                  <td className="py-3.5 px-3 text-center text-xs font-semibold text-slate-700 tabular-nums align-top">
                    {item.quantity}
                  </td>
                  <td className="py-3.5 px-4 text-right text-xs font-bold text-slate-900 tabular-nums align-top">
                    {formatMoney(item.quantity * item.unitPriceCents, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 4. TOTALS & SUMMARY */}
        <div className="grid grid-cols-2 gap-8 items-start mb-6 pt-2">
          {/* Left: Big Total Due */}
          <div>
            <div className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              {balanceDueCents > 0 ? "Total Due" : "Amount Settled"}
            </div>
            <div className="text-[28px] font-black text-[#E5252A] tabular-nums mt-1 leading-none tracking-tight">
              {formatMoney(balanceDueCents > 0 ? balanceDueCents : invoice.amountCents, invoice.currency)} {invoice.currency}
            </div>
            {invoice.advanceCents ? (
              <div className="mt-2 text-xs text-slate-600 font-semibold">
                Required Advance: <span className="font-bold text-slate-900">{formatMoney(invoice.advanceCents, invoice.currency)}</span>
              </div>
            ) : null}
            {paidCents > 0 ? (
              <div className="text-xs text-emerald-600 font-semibold mt-0.5">
                Paid to date: <span className="font-bold">{formatMoney(paidCents, invoice.currency)}</span>
              </div>
            ) : null}
          </div>

          {/* Right: Subtotal & Tax Breakdown */}
          <div className="space-y-1.5 text-xs">
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
          </div>
        </div>

        {/* Solid Crimson Grand Total Bar */}
        <div className="w-full bg-[#E5252A] text-white px-5 py-2.5 rounded-sm flex justify-between items-center mb-6 shadow-sm">
          <span className="text-sm font-black uppercase tracking-wider text-white">
            Total:
          </span>
          <span className="text-lg font-black text-white tabular-nums tracking-wide">
            {formatMoney(invoice.amountCents, invoice.currency)}
          </span>
        </div>

        {/* 5. TERMS & CONDITIONS & SIGNATURE */}
        <div className="mt-auto grid grid-cols-2 gap-8 items-end pb-3">
          {/* Left: Terms */}
          <div>
            <div className="text-xs font-black text-[#E5252A] uppercase tracking-wider mb-1">
              Terms &amp; Conditions:
            </div>
            <p className="text-[10px] text-slate-600 leading-relaxed font-medium">
              {invoice.notes ||
                "Payment is due within agreed terms. All deliverable milestones, intellectual property, and documentation transfer upon final settlement."}
            </p>
          </div>

          {/* Right: Signature Box */}
          <div className="text-right">
            <div className="w-48 border-b border-slate-300 ml-auto mb-1.5" />
            <div className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
              Your Name &amp; Signature
            </div>
            <div className="text-sm font-black text-slate-900 mt-0.5">
              {businessName}
            </div>
          </div>
        </div>
      </div>

      {/* 6. BOTTOM SPLIT GEOMETRIC FOOTER */}
      <div className="relative w-full h-[40px] overflow-hidden select-none">
        <div className="absolute inset-0 pointer-events-none z-0">
          <svg
            viewBox="0 0 720 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
            preserveAspectRatio="none"
          >
            {/* Left Crimson Polygon */}
            <polygon points="0,0 470,0 520,40 0,40" fill="#E5252A" />
            {/* Right Dark Slate Polygon */}
            <polygon points="470,0 720,0 720,40 520,40" fill="#1E2229" />
          </svg>
        </div>

        <div className="relative z-10 flex items-center justify-between h-full px-8 text-white text-[11px] font-semibold">
          {/* Contact Icons Inside Crimson Bar */}
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

          {/* Right Accent Details */}
          <div className="text-neutral-300 text-[10px] font-bold tracking-wider uppercase">
            BillFlow
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScarletModernTemplate;
