import { InvoicePdfPayload } from "./types";
import { escapeHtml, formatMoney } from "./helpers";

export function buildInvoiceHtmlNoirCrimson(data: InvoicePdfPayload): string {
  const subtotalCents =
    data.items && data.items.length > 0
      ? data.items.reduce((sum, it) => sum + it.quantity * it.unitPriceCents, 0)
      : data.amountCents;
  const paidCents = data.paidCents || 0;
  const balanceDueCents = Math.max(0, data.amountCents - paidCents);

  const businessName = escapeHtml(data.business?.businessName || "CHETHAKA LAKSHITHA");
  const professionalTitle = escapeHtml(data.business?.professionalTitle || "FULL-STACK & SYSTEMS CONSULTING");
  const clientName = escapeHtml(data.client?.name || "Client Name");
  const clientEmail = escapeHtml(data.client?.email || "client@example.com");
  const clientPhone = data.client?.phone ? escapeHtml(data.client.phone) : "";

  const itemsRows = (
    data.items && data.items.length > 0
      ? data.items
      : [
          {
            description: "Professional Services & Development Sprint",
            quantity: 1,
            unitPriceCents: data.amountCents,
          },
        ]
  )
    .map((it, idx) => {
      const isPill = idx % 2 === 1;
      const rowClass = isPill ? "row-pill" : "row-transparent";
      const lineTotal = it.quantity * it.unitPriceCents;

      return `
        <div class="table-row ${rowClass}">
          <div class="col-num">${String(idx + 1).padStart(2, "0")}</div>
          <div class="col-desc">
            <div class="desc-main">${escapeHtml(it.description)}</div>
            <div class="desc-sub">Deliverable milestone &amp; software sprint scope</div>
          </div>
          <div class="col-price">${formatMoney(it.unitPriceCents, data.currency)}</div>
          <div class="col-qty">${it.quantity}</div>
          <div class="col-total">${formatMoney(lineTotal, data.currency)}</div>
        </div>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 portrait; margin: 0; }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      background: #111215;
      width: 794px;
      height: 1123px;
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      color: #FFFFFF;
      position: relative;
      overflow: hidden;
      -webkit-font-smoothing: antialiased;
      display: flex;
      flex-direction: column;
    }

    /* TOP BRAND & INVOICE HEADER */
    .top-header {
      padding-top: 36px;
      padding-bottom: 8px;
      text-align: center;
    }
    .brand-cluster {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      text-align: left;
    }
    .circle-grid {
      display: grid;
      grid-template-columns: repeat(2, 7px);
      gap: 3px;
      padding: 1px;
    }
    .circle-dot {
      width: 7px;
      height: 7px;
      border: 1.5px solid #FFFFFF;
      border-radius: 50%;
    }
    .brand-name {
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 0.12em;
      color: #FFFFFF;
      text-transform: uppercase;
      line-height: 1.1;
    }
    .brand-title {
      font-size: 9.5px;
      font-weight: 700;
      letter-spacing: 0.22em;
      color: #A1A1AA;
      text-transform: uppercase;
      margin-top: 2px;
      line-height: 1.1;
    }
    .invoice-title {
      font-size: 42px;
      font-weight: 900;
      letter-spacing: 0.28em;
      color: #FFFFFF;
      text-transform: uppercase;
      margin: 14px 0 0 0;
      line-height: 1;
    }

    /* METADATA ROW WITH CHEVRONS */
    .meta-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 50px 18px 50px;
    }
    .chevrons-svg {
      flex-shrink: 0;
    }
    .client-block {
      flex: 1;
      padding: 0 16px;
      text-align: left;
    }
    .client-to {
      font-size: 12px;
      font-weight: 700;
      color: #D9383A;
    }
    .client-name {
      font-size: 14px;
      font-weight: 900;
      color: #FFFFFF;
    }
    .client-details {
      font-size: 11px;
      color: #A1A1AA;
      margin-top: 4px;
      line-height: 1.35;
    }
    .meta-divider {
      width: 1.5px;
      height: 60px;
      background: rgba(217, 56, 58, 0.4);
      margin: 0 8px;
      flex-shrink: 0;
    }
    .invoice-block {
      flex: 1;
      padding: 0 16px;
      text-align: left;
    }
    .meta-line {
      display: flex;
      align-items: center;
      font-size: 12px;
      margin-bottom: 4px;
    }
    .meta-label {
      width: 95px;
      font-weight: 700;
      color: #D9383A;
    }
    .meta-val {
      font-weight: 800;
      color: #FFFFFF;
    }

    /* TABLE SECTION */
    .table-container {
      padding: 0 50px;
      flex: 1;
    }
    .table-head {
      border: 1.5px solid #D9383A;
      border-radius: 9999px;
      height: 38px;
      display: flex;
      align-items: center;
      padding: 0 18px;
      font-size: 11px;
      font-weight: 700;
      color: #D4D4D8;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }
    .table-row {
      display: flex;
      align-items: center;
      height: 40px;
      padding: 0 18px;
      border-radius: 9999px;
      margin-bottom: 4px;
      font-size: 12px;
    }
    .row-pill {
      background: #D9383A;
      color: #FFFFFF;
      font-weight: 700;
    }
    .row-transparent {
      background: transparent;
      color: #FFFFFF;
      font-weight: 500;
    }
    .col-num {
      width: 9%;
      text-align: left;
      font-weight: 800;
    }
    .row-transparent .col-num {
      color: #A1A1AA;
    }
    .col-desc {
      width: 48%;
      text-align: left;
      padding-right: 12px;
    }
    .desc-main {
      font-weight: 800;
      line-height: 1.15;
    }
    .desc-sub {
      font-size: 9.5px;
      margin-top: 1px;
      line-height: 1.1;
    }
    .row-pill .desc-sub {
      color: rgba(255, 255, 255, 0.85);
    }
    .row-transparent .desc-sub {
      color: #A1A1AA;
    }
    .col-price {
      width: 17%;
      text-align: right;
      font-weight: 600;
    }
    .col-qty {
      width: 9%;
      text-align: center;
      font-weight: 600;
    }
    .col-total {
      width: 17%;
      text-align: right;
      font-weight: 900;
    }
    .pill-badge {
      background: #D9383A;
      color: #FFFFFF;
      padding: 3px 14px;
      border-radius: 9999px;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.1em;
    }

    /* PAYMENT METHOD & TOTALS SECTION */
    .summary-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-top: 24px;
      padding: 0 50px;
    }
    .payment-side {
      width: 46%;
      text-align: left;
    }
    .payment-title {
      font-size: 12.5px;
      font-weight: 800;
      color: #D9383A;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }
    .payment-info {
      font-size: 11px;
      color: #A1A1AA;
      line-height: 1.6;
    }
    .payment-info strong {
      color: #FFFFFF;
      font-weight: 700;
    }
    .delivery-pill {
      display: inline-block;
      margin-top: 8px;
      padding: 4px 14px;
      border-radius: 9999px;
      background: rgba(217, 56, 58, 0.18);
      border: 1px solid rgba(217, 56, 58, 0.5);
      color: #D9383A;
      font-size: 10px;
      font-weight: 800;
      text-decoration: none;
    }
    .summary-divider {
      width: 1.5px;
      height: 100px;
      background: rgba(217, 56, 58, 0.4);
      margin: 0 16px;
      flex-shrink: 0;
    }
    .totals-side {
      width: 46%;
      text-align: right;
    }
    .calc-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #A1A1AA;
      margin-bottom: 5px;
    }
    .calc-val {
      font-weight: 700;
      color: #FFFFFF;
    }
    .calc-green {
      color: #34D399;
      font-weight: 700;
    }
    .calc-amber {
      color: #FBBF24;
      font-weight: 700;
    }
    .calc-rose {
      color: #FB7185;
      font-weight: 700;
    }
    .grand-total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(217, 56, 58, 0.35);
    }
    .grand-total-label {
      font-size: 14px;
      font-weight: 900;
      color: #D9383A;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .grand-total-val {
      font-size: 26px;
      font-weight: 900;
      color: #D9383A;
    }

    /* CENTERED SIGNATURE */
    .signature-section {
      text-align: center;
      margin: 18px 0 12px 0;
    }
    .sig-name {
      font-size: 14px;
      font-weight: 800;
      color: #FFFFFF;
      margin-top: 4px;
    }
    .sig-title {
      font-size: 10px;
      font-weight: 600;
      color: #A1A1AA;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      margin-top: 2px;
    }

    /* TERMS & CONDITIONS CONTAINER */
    .terms-container {
      padding: 0 50px;
      margin-bottom: 20px;
    }
    .terms-box {
      border: 1.5px solid #D9383A;
      border-radius: 28px;
      padding: 14px 28px;
      text-align: center;
    }
    .terms-title {
      font-size: 12px;
      font-weight: 800;
      color: #D9383A;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 4px;
    }
    .terms-text {
      font-size: 10px;
      color: #A1A1AA;
      line-height: 1.5;
      margin: 0;
    }

    /* BOTTOM FULL-WIDTH SOLID FOOTER */
    .footer-bar {
      margin-top: auto;
      background: #D9383A;
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: space-around;
      padding: 0 32px;
      color: #FFFFFF;
      font-size: 10.5px;
      font-weight: 600;
      flex-shrink: 0;
    }
    .footer-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .footer-svg {
      width: 14px;
      height: 14px;
      fill: none;
      stroke: #FFFFFF;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  </style>
</head>
<body>

  <!-- 1. TOP BRAND & INVOICE HEADER -->
  <div class="top-header">
    <div class="brand-cluster">
      <div class="circle-grid">
        <div class="circle-dot"></div>
        <div class="circle-dot"></div>
        <div class="circle-dot"></div>
        <div class="circle-dot"></div>
      </div>
      <div>
        <div class="brand-name">${businessName}</div>
        <div class="brand-title">${professionalTitle}</div>
      </div>
    </div>
    <div class="invoice-title">INVOICE</div>
  </div>

  <!-- 2. METADATA ROW WITH CHEVRONS -->
  <div class="meta-row">
    <!-- Left Chevrons (>>>>) -->
    <svg class="chevrons-svg" width="68" height="28" viewBox="0 0 68 28" fill="none">
      <path d="M4 2L16 14L4 26" stroke="#D9383A" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M20 2L32 14L20 26" stroke="#D9383A" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M36 2L48 14L36 26" stroke="#D9383A" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M52 2L64 14L52 26" stroke="#D9383A" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>

    <!-- Client Block -->
    <div class="client-block">
      <div>
        <span class="client-to">To. </span>
        <span class="client-name">${clientName}</span>
      </div>
      <div class="client-details">
        ${clientPhone ? `<div>${clientPhone}</div>` : ""}
        <div>${clientEmail}</div>
        <div>Client Account</div>
      </div>
    </div>

    <!-- Divider -->
    <div class="meta-divider"></div>

    <!-- Invoice Block -->
    <div class="invoice-block">
      <div class="meta-line">
        <span class="meta-label">Invoice No.:</span>
        <span class="meta-val">${escapeHtml(data.code)}</span>
      </div>
      <div class="meta-line">
        <span class="meta-label">Date:</span>
        <span class="meta-val">${escapeHtml(data.issueDate)}</span>
      </div>
      <div class="meta-line">
        <span class="meta-label">Due Date:</span>
        <span class="meta-val">${escapeHtml(data.dueDate || "On Receipt")}</span>
      </div>
    </div>

    <!-- Right Chevrons (<<<<) -->
    <svg class="chevrons-svg" width="68" height="28" viewBox="0 0 68 28" fill="none">
      <path d="M64 2L52 14L64 26" stroke="#D9383A" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M48 2L36 14L48 26" stroke="#D9383A" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M32 2L20 14L32 26" stroke="#D9383A" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M16 2L4 14L16 26" stroke="#D9383A" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>

  <!-- 3. TABLE SECTION -->
  <div class="table-container">
    <div class="table-head">
      <div class="col-num" style="color: #D9383A;">NO.</div>
      <div class="col-desc">ITEM DESCRIPTION</div>
      <div class="col-price">PRICE</div>
      <div class="col-qty">QTY</div>
      <div class="col-total" style="display: flex; justify-content: flex-end;">
        <span class="pill-badge">TOTAL</span>
      </div>
    </div>

    ${itemsRows}

    <!-- 4. SUMMARY CALCULATION -->
    <div class="summary-section">
      <!-- Left: Delivery Link if present -->
      <div>
        ${
          data.deliveryUrl
            ? `<div><a class="delivery-pill" href="${escapeHtml(data.deliveryUrl)}">&#x2197; Open Delivery Location</a></div>`
            : ""
        }
      </div>

      <!-- Right: Financial Breakdown -->
      <div class="totals-side">
        <div class="calc-row">
          <span>Sub-Total:</span>
          <span class="calc-val">${formatMoney(subtotalCents, data.currency)}</span>
        </div>

        ${
          data.discountCents
            ? `<div class="calc-row calc-green">
                <span>Discount:</span>
                <span>-${formatMoney(data.discountCents, data.currency)}</span>
              </div>`
            : ""
        }

        ${
          data.taxCents
            ? `<div class="calc-row">
                <span>Tax Vat:</span>
                <span class="calc-val">${formatMoney(data.taxCents, data.currency)}</span>
              </div>`
            : ""
        }

        ${
          data.advanceCents
            ? `<div class="calc-row calc-amber">
                <span>Required Advance:</span>
                <span>${formatMoney(data.advanceCents, data.currency)}</span>
              </div>`
            : ""
        }

        ${
          paidCents > 0
            ? `<div class="calc-row calc-green">
                <span>Paid Amount:</span>
                <span>${formatMoney(paidCents, data.currency)}</span>
              </div>`
            : ""
        }

        ${
          paidCents > 0 && balanceDueCents > 0
            ? `<div class="calc-row calc-rose">
                <span>Balance Due:</span>
                <span>${formatMoney(balanceDueCents, data.currency)}</span>
              </div>`
            : ""
        }

        <div class="grand-total-row">
          <span class="grand-total-label">Total:</span>
          <span class="grand-total-val">${formatMoney(data.amountCents, data.currency)}</span>
        </div>
      </div>
    </div>

    <!-- 5. TERMS & CONDITION CONTAINER -->
    <div class="terms-container" style="margin-top: 36px; margin-bottom: 24px;">
      <div class="terms-box">
        <div class="terms-title">Terms &amp; Condition.</div>
        <p class="terms-text">
          ${
            data.notes
              ? escapeHtml(data.notes)
              : "Payment is due within agreed milestone terms. Late payments may be subject to a 5% monthly fee. All intellectual property and source code rights transfer to the client upon receipt of final settlement. Thank you for your partnership."
          }
        </p>
      </div>
    </div>
  </div>

  <!-- 7. BOTTOM FULL-WIDTH SOLID FOOTER -->
  <div class="footer-bar">
    <div class="footer-item">
      <svg class="footer-svg" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      <span>${escapeHtml(data.business?.phone || "+94 77 123 4567")}</span>
    </div>
    <div class="footer-item">
      <svg class="footer-svg" viewBox="0 0 24 24"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
      <span>${escapeHtml(data.business?.email || "contact@chethaka.dev")}</span>
    </div>
    <div class="footer-item">
      <svg class="footer-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
      <span>${escapeHtml(data.business?.website || "www.chethaka.dev")}</span>
    </div>
    <div class="footer-item">
      <svg class="footer-svg" viewBox="0 0 24 24"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
      <span>${escapeHtml(data.business?.address || "Colombo, Sri Lanka")}</span>
    </div>
  </div>

</body>
</html>`;
}
