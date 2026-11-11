"use client";

import React from "react";
import { ExternalLink, Phone, Mail, Globe, MapPin } from "lucide-react";
import type { InvoiceTemplateProps } from "./types";

export function NoirCrimsonTemplate({
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
      className="w-full max-w-[720px] bg-[#111215] text-[#FFFFFF] rounded-sm shadow-2xl min-h-[1020px] relative overflow-hidden select-text border border-white/10 flex flex-col font-sans"
    >
      {/* 1. TOP BRAND & INVOICE HEADER */}
      <div className="flex flex-col items-center justify-center pt-8 pb-3 px-8 text-center select-none">
        {/* 4 Circles Icon + Brand Name */}
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 grid grid-cols-2 gap-1 p-0.5 shrink-0">
            <div className="w-2 h-2 rounded-full border-2 border-white" />
            <div className="w-2 h-2 rounded-full border-2 border-white" />
            <div className="w-2 h-2 rounded-full border-2 border-white" />
            <div className="w-2 h-2 rounded-full border-2 border-white" />
          </div>
          <div className="text-left">
            <div className="text-[14px] font-black tracking-widest text-white uppercase leading-tight">
              {businessName}
            </div>
            <div className="text-[9px] font-bold tracking-[0.22em] text-zinc-400 uppercase leading-tight mt-0.5">
              {professionalTitle}
            </div>
          </div>
        </div>

        {/* HUGE INVOICE TITLE */}
        <h1 className="text-[38px] font-black tracking-[0.28em] text-white uppercase text-center mt-4 mb-2 leading-none">
          INVOICE
        </h1>
      </div>

      {/* 2. METADATA ROW WITH CHEVRONS */}
      <div className="flex items-center justify-between px-8 py-3 mb-3">
        {/* Left Chevrons (>>>>) */}
        <svg
          width="64"
          height="28"
          viewBox="0 0 68 28"
          fill="none"
          className="shrink-0"
        >
          <path
            d="M4 2L16 14L4 26"
            stroke="#D9383A"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M20 2L32 14L20 26"
            stroke="#D9383A"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M36 2L48 14L36 26"
            stroke="#D9383A"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M52 2L64 14L52 26"
            stroke="#D9383A"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Client Details */}
        <div className="min-w-0 flex-1 px-4">
          <div className="text-xs">
            <span className="font-bold text-[#D9383A]">To. </span>
            <span className="font-extrabold text-white text-sm">
              {client?.name || invoice.clientName}
            </span>
          </div>
          <div className="text-[11px] text-zinc-400 mt-1 space-y-0.5 leading-tight">
            {client?.phone && <div>{client.phone}</div>}
            <div>{client?.email || invoice.clientEmail || "client@domain.com"}</div>
            <div>{client?.category ? `${client.category} Client` : "Client Account"}</div>
          </div>
        </div>

        {/* Center Vertical Divider */}
        <div className="w-[1.5px] h-16 bg-[#D9383A]/40 shrink-0 mx-2" />

        {/* Invoice Metadata */}
        <div className="min-w-0 flex-1 px-4 text-left">
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#D9383A] w-24">Invoice No.:</span>
              <span className="font-black text-white">{invoice.code}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#D9383A] w-24">Date:</span>
              <span className="font-medium text-white">{formatDate(invoice.issueDate)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#D9383A] w-24">Due Date:</span>
              <span className="font-medium text-white">
                {invoice.dueDate ? formatDate(invoice.dueDate) : "On Receipt"}
              </span>
            </div>
          </div>
        </div>

        {/* Right Chevrons (<<<<) */}
        <svg
          width="64"
          height="28"
          viewBox="0 0 68 28"
          fill="none"
          className="shrink-0"
        >
          <path
            d="M64 2L52 14L64 26"
            stroke="#D9383A"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M48 2L36 14L48 26"
            stroke="#D9383A"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M32 2L20 14L32 26"
            stroke="#D9383A"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M16 2L4 14L16 26"
            stroke="#D9383A"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* 3. TABLE SECTION */}
      <div className="px-8 my-2 flex-1">
        {/* Table Header: Capsule border with solid TOTAL pill */}
        <div className="w-full border border-[#D9383A] rounded-full px-4 py-2 flex items-center justify-between text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-2">
          <div className="w-[10%] text-left text-[#D9383A]">NO.</div>
          <div className="w-[46%] text-left">ITEM DESCRIPTION</div>
          <div className="w-[18%] text-right">PRICE</div>
          <div className="w-[10%] text-center">QTY</div>
          <div className="w-[16%] flex justify-end">
            <span className="bg-[#D9383A] text-white px-3.5 py-0.5 rounded-full font-black text-center text-[10px] tracking-widest shadow-sm">
              TOTAL
            </span>
          </div>
        </div>

        {/* Table Body: Alternating Transparent and Solid Crimson Pill Capsules */}
        <div className="space-y-1">
          {displayItems.map((item, idx) => {
            const isPill = idx % 2 === 1;
            const lineTotal = item.quantity * item.unitPriceCents;

            if (isPill) {
              return (
                <div
                  key={idx}
                  className="w-full flex items-center px-4 py-2.5 rounded-full bg-[#D9383A] text-white text-xs font-semibold shadow-sm transition-all"
                >
                  <div className="w-[10%] text-left font-black">
                    {String(idx + 1).padStart(2, "0")}
                  </div>
                  <div className="w-[46%] text-left pr-2">
                    <div className="font-black leading-tight text-white">{item.description}</div>
                    <div className="text-[10px] text-white/80 leading-tight font-medium mt-0.5">
                      Deliverable milestone &amp; software sprint scope
                    </div>
                  </div>
                  <div className="w-[18%] text-right font-bold text-white">
                    {formatMoney(item.unitPriceCents, invoice.currency)}
                  </div>
                  <div className="w-[10%] text-center font-bold text-white">
                    {item.quantity}
                  </div>
                  <div className="w-[16%] text-right font-black text-white">
                    {formatMoney(lineTotal, invoice.currency)}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={idx}
                className="w-full flex items-center px-4 py-2.5 rounded-full text-white text-xs font-medium transition-all"
              >
                <div className="w-[10%] text-left text-zinc-400 font-bold">
                  {String(idx + 1).padStart(2, "0")}
                </div>
                <div className="w-[46%] text-left pr-2">
                  <div className="font-bold text-white leading-tight">{item.description}</div>
                  <div className="text-[10px] text-zinc-400 leading-tight font-normal mt-0.5">
                    Deliverable milestone &amp; software sprint scope
                  </div>
                </div>
                <div className="w-[18%] text-right text-zinc-200 font-medium">
                  {formatMoney(item.unitPriceCents, invoice.currency)}
                </div>
                <div className="w-[10%] text-center text-zinc-200 font-medium">
                  {item.quantity}
                </div>
                <div className="w-[16%] text-right text-white font-extrabold">
                  {formatMoney(lineTotal, invoice.currency)}
                </div>
              </div>
            );
          })}
        </div>

        {/* 4. SUMMARY CALCULATION */}
        <div className="mt-6 flex justify-between items-start">
          {/* Left: Delivery Link */}
          <div>
            {delivery.hasLink && (
              <button
                type="button"
                onClick={() => openExternalLink(delivery.formattedUrl)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#D9383A]/20 border border-[#D9383A]/50 text-[#D9383A] hover:bg-[#D9383A]/30 text-[10px] font-bold transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Open Delivery Location</span>
              </button>
            )}
          </div>

          {/* Right: Calculations */}
          <div className="w-[46%] text-right space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-zinc-400">
              <span>Sub-Total:</span>
              <span className="font-semibold text-white">
                {formatMoney(subtotalCents, invoice.currency)}
              </span>
            </div>

            {invoice.discountCents ? (
              <div className="flex justify-between items-center text-emerald-400">
                <span>Discount:</span>
                <span className="font-semibold">
                  -{formatMoney(invoice.discountCents, invoice.currency)}
                </span>
              </div>
            ) : null}

            {invoice.taxCents ? (
              <div className="flex justify-between items-center text-zinc-400">
                <span>Tax Vat:</span>
                <span className="font-semibold text-white">
                  {formatMoney(invoice.taxCents, invoice.currency)}
                </span>
              </div>
            ) : null}

            {invoice.advanceCents ? (
              <div className="flex justify-between items-center text-amber-400">
                <span>Required Advance:</span>
                <span className="font-semibold">
                  {formatMoney(invoice.advanceCents, invoice.currency)}
                </span>
              </div>
            ) : null}

            {paidCents > 0 && (
              <div className="flex justify-between items-center text-emerald-400">
                <span>Paid Amount:</span>
                <span className="font-semibold">
                  {formatMoney(paidCents, invoice.currency)}
                </span>
              </div>
            )}

            {paidCents > 0 && balanceDueCents > 0 && (
              <div className="flex justify-between items-center text-rose-400">
                <span>Balance Due:</span>
                <span className="font-semibold">
                  {formatMoney(balanceDueCents, invoice.currency)}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center pt-2.5 border-t border-[#D9383A]/30">
              <span className="text-sm font-black text-[#D9383A] uppercase tracking-wider">
                Total:
              </span>
              <span className="text-2xl font-black text-[#D9383A]">
                {formatMoney(invoice.amountCents, invoice.currency)}
              </span>
            </div>
          </div>
        </div>

        {/* 5. TERMS & CONDITION STADIUM CAPSULE */}
        <div className="my-6">
          <div className="w-full border-[1.5px] border-[#D9383A] rounded-[28px] p-4 text-center">
            <div className="text-xs font-bold text-[#D9383A] uppercase tracking-wider mb-1.5">
              Terms &amp; Condition.
            </div>
            <p className="text-[10px] text-zinc-400 leading-relaxed max-w-xl mx-auto">
              {invoice.notes ||
                "Payment is due within agreed milestone terms. Late payments may be subject to a 5% monthly fee. All intellectual property and source code rights transfer to the client upon receipt of final settlement. Thank you for your partnership."}
            </p>
          </div>
        </div>
      </div>

      {/* 7. BOTTOM FULL-WIDTH SOLID CRIMSON FOOTER */}
      <div className="w-full bg-[#D9383A] h-[38px] mt-auto flex items-center justify-around px-6 text-white text-[10px] font-medium select-none shrink-0">
        <div className="flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 fill-white text-transparent" />
          <span>{settings?.phone || "+94 77 123 4567"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5 text-white" />
          <span>{settings?.email || "contact@chethaka.dev"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-white" />
          <span>{settings?.website || "www.chethaka.dev"}</span>
        </div>
        <div className="flex items-center gap-1.5 truncate max-w-[200px]">
          <MapPin className="w-3.5 h-3.5 text-white shrink-0" />
          <span className="truncate">{settings?.address || "Colombo, Sri Lanka"}</span>
        </div>
      </div>
    </div>
  );
}

export default NoirCrimsonTemplate;
