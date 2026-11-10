"use client";

import React from "react";
import { ExternalLink } from "lucide-react";
import type { InvoiceTemplateProps } from "./types";

export function GeometricTealTemplate({
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
                  {formatDate(invoice.issueDate)}
                </span>
              </div>
              {invoice.dueDate && (
                <div className="flex sm:justify-end gap-4">
                  <span className="font-bold text-[#718096]">Due Date:</span>
                  <span className="font-semibold text-[#1f262e] min-w-[90px] sm:text-right">
                    {formatDate(invoice.dueDate)}
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
                <th className="pb-3 pl-2 w-12 font-black">No.</th>
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
                    {formatMoney(item.unitPriceCents, invoice.currency)}
                  </td>
                  <td className="py-4 text-center pr-4 font-semibold text-[#718096] tabular-nums align-top">
                    {item.quantity}
                  </td>
                  <td className="py-4 text-right pr-2 font-black text-[#1f262e] tabular-nums align-top">
                    {formatMoney(item.quantity * item.unitPriceCents, invoice.currency)}
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
                {formatMoney(subtotalCents, invoice.currency)}
              </span>
            </div>

            {invoice.discountCents ? (
              <div className="flex sm:justify-end gap-8 text-rose-600 font-semibold">
                <span>Discount:</span>
                <span className="font-bold tabular-nums min-w-[90px]">
                  -{formatMoney(invoice.discountCents, invoice.currency)}
                </span>
              </div>
            ) : null}

            {invoice.taxCents ? (
              <div className="flex sm:justify-end gap-8 text-[#718096] font-semibold">
                <span>Tax / VAT:</span>
                <span className="font-bold text-[#1f262e] tabular-nums min-w-[90px]">
                  {formatMoney(invoice.taxCents, invoice.currency)}
                </span>
              </div>
            ) : null}

            <div className="border-t-2 border-[#00A887] pt-2 my-1" />

            <div className="flex sm:justify-end items-baseline gap-6">
              <span className="text-base font-black text-[#00A887] uppercase tracking-wide">
                Total:
              </span>
              <span className="text-2xl font-black text-[#00A887] tabular-nums min-w-[120px]">
                {formatMoney(invoice.amountCents, invoice.currency)}
              </span>
            </div>

            {invoice.advanceCents ? (
              <div className="flex sm:justify-end gap-8 text-slate-700 font-bold pt-2">
                <span>Required Advance:</span>
                <span className="tabular-nums min-w-[90px]">
                  {formatMoney(invoice.advanceCents, invoice.currency)}
                </span>
              </div>
            ) : null}

            {paidCents > 0 ? (
              <div className="flex sm:justify-end gap-8 text-emerald-600 font-bold">
                <span>Amount Paid:</span>
                <span className="tabular-nums min-w-[90px]">
                  {formatMoney(paidCents, invoice.currency)}
                </span>
              </div>
            ) : null}

            <div className="flex sm:justify-end gap-8 text-[#1f262e] font-black pt-1">
              <span>Balance Due:</span>
              <span className="tabular-nums min-w-[90px]">
                {formatMoney(balanceDueCents, invoice.currency)}
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
  );
}

export default GeometricTealTemplate;
