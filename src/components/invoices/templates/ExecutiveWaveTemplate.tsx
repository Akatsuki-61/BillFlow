"use client";

import React from "react";
import { ExternalLink } from "lucide-react";
import type { InvoiceTemplateProps } from "./types";

export function ExecutiveWaveTemplate({
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
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-end gap-4">
                <span className="text-slate-500 font-bold">Invoice No.:</span>
                <span className="font-extrabold text-slate-900 tabular-nums min-w-[95px] text-right">
                  {invoice.code}
                </span>
              </div>
              <div className="flex justify-end gap-4">
                <span className="text-slate-500 font-bold">Date:</span>
                <span className="font-semibold text-slate-900 min-w-[95px] text-right">
                  {formatDate(invoice.issueDate)}
                </span>
              </div>
              {invoice.dueDate && (
                <div className="flex justify-end gap-4">
                  <span className="text-slate-500 font-bold">Due Date:</span>
                  <span className="font-semibold text-slate-900 min-w-[95px] text-right">
                    {formatDate(invoice.dueDate)}
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
                  No.
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
                    {formatMoney(item.unitPriceCents, invoice.currency)}
                  </td>
                  <td className="py-3 px-3 text-center text-xs font-semibold text-slate-700 tabular-nums">
                    {item.quantity}
                  </td>
                  <td className="py-3 px-4 text-right text-xs font-extrabold text-slate-900 tabular-nums">
                    {formatMoney(item.quantity * item.unitPriceCents, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Totals */}
        <div className="flex justify-end mb-6 pt-2">
          {/* Right: Totals with Golden Amber Banner */}
          <div className="w-full max-w-xs space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600 py-0.5">
              <span className="font-semibold">Sub Total:</span>
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
                <span className="font-semibold">Tax / VAT:</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {formatMoney(invoice.taxCents, invoice.currency)}
                </span>
              </div>
            ) : null}

            {/* Grand Total Solid Amber Bar */}
            <div className="mt-2 bg-[#EAA828] text-slate-950 px-4 py-2.5 rounded-sm flex justify-between items-center font-black">
              <span className="text-xs uppercase tracking-wider">Grand Total</span>
              <span className="text-base tabular-nums">
                {formatMoney(invoice.amountCents, invoice.currency)}
              </span>
            </div>

            {invoice.advanceCents ? (
              <div className="flex justify-between text-slate-700 pt-2 py-0.5">
                <span className="font-bold">Required Advance:</span>
                <span className="font-extrabold text-slate-900 tabular-nums">
                  {formatMoney(invoice.advanceCents, invoice.currency)}
                </span>
              </div>
            ) : null}

            {paidCents > 0 ? (
              <div className="flex justify-between text-emerald-600 py-0.5">
                <span className="font-bold">Amount Paid:</span>
                <span className="font-extrabold tabular-nums">
                  {formatMoney(paidCents, invoice.currency)}
                </span>
              </div>
            ) : null}

            <div className="flex justify-between text-slate-900 pt-1 border-t border-slate-200 py-0.5 font-black">
              <span>Balance Due:</span>
              <span className="text-sm tabular-nums">
                {formatMoney(balanceDueCents, invoice.currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-4 border-t border-slate-200">
          <div className="max-w-xl">
            <h5 className="text-xs font-black text-slate-900 mb-1">
              Thank you for your business!
            </h5>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              <strong className="text-slate-700">TERMS: </strong>
              {invoice.notes ||
                "Payment due within specified due date. All software deliverables and intellectual property transfer upon final settlement."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExecutiveWaveTemplate;
