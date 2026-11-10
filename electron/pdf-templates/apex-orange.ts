import { InvoicePdfPayload } from "./types";
import { escapeHtml, formatMoney, getBase64Logo } from "./helpers";

export function buildInvoiceHtmlApexOrange(data: InvoicePdfPayload): string {
  const logoBase64 = getBase64Logo();
  const subtotalCents =
    data.items && data.items.length > 0
      ? data.items.reduce((sum, it) => sum + it.quantity * it.unitPriceCents, 0)
      : data.amountCents;
  const paidCents = data.paidCents || 0;
  const balanceDueCents = Math.max(0, data.amountCents - paidCents);

  const itemsRows = (data.items && data.items.length > 0
    ? data.items
    : [{ description: "Professional Services & Development Sprint", quantity: 1, unitPriceCents: data.amountCents }]
  )
    .map(
      (it, idx) => `
      <tr class="table-row">
        <td class="td-num">${String(idx + 1).padStart(2, "0")}</td>
        <td class="td-desc">
          <div class="desc-main">${escapeHtml(it.description)}</div>
          <div class="desc-sub">Deliverable milestone &amp; software sprint scope</div>
        </td>
        <td class="td-price">${formatMoney(it.unitPriceCents, data.currency)}</td>
        <td class="td-qty">${it.quantity}</td>
        <td class="td-total">${formatMoney(it.quantity * it.unitPriceCents, data.currency)}</td>
      </tr>
    `
    )
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
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: #FFFFFF;
      width: 794px;
      height: 1123px;
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      color: #1F242D;
      position: relative;
      overflow: hidden;
      -webkit-font-smoothing: antialiased;
    }

    /* TOP DIAGONAL APEX HEADER */
    .header-container {
      position: relative;
      width: 794px;
      height: 135px;
      overflow: hidden;
    }
    .header-svg {
      position: absolute;
      top: 0;
      left: 0;
      width: 794px;
      height: 135px;
      pointer-events: none;
      z-index: 0;
    }
    .header-content {
      position: relative;
      z-index: 2;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      height: 135px;
      padding: 0 48px;
      color: #FFFFFF;
    }
    .brand-side {
      display: flex;
      align-items: center;
      gap: 14px;
      max-width: 380px;
      height: 104px;
    }
    .brand-badge {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .brand-logo {
      width: 24px;
      height: 24px;
      object-fit: contain;
    }
    .brand-name {
      font-size: 17px;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #FFFFFF;
      text-transform: uppercase;
      line-height: 1.2;
      white-space: nowrap;
    }
    .brand-title {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1.2px;
      color: #FFEDD5;
      text-transform: uppercase;
      margin-top: 2px;
    }

    .meta-side {
      text-align: right;
      height: 135px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .invoice-title {
      font-size: 34px;
      font-weight: 900;
      letter-spacing: 2.5px;
      color: #FFFFFF;
      line-height: 1;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .meta-line {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.9);
      margin-bottom: 2px;
    }
    .meta-line span {
      color: rgba(255, 255, 255, 0.65);
      font-weight: 600;
      margin-right: 6px;
    }
    .meta-line strong {
      font-weight: 700;
    }

    /* BODY */
    .body-content {
      position: relative;
      z-index: 2;
      padding: 26px 48px 20px;
      display: flex;
      flex-direction: column;
      height: calc(1123px - 135px - 44px);
    }

    .sub-header-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 36px;
      margin-bottom: 24px;
    }
    .section-label {
      font-size: 11px;
      font-weight: 900;
      color: #F25C05;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 4px;
    }
    .client-name {
      font-size: 18px;
      font-weight: 900;
      color: #0F172A;
      margin-bottom: 3px;
    }
    .client-detail {
      font-size: 11.5px;
      color: #64748B;
      line-height: 1.5;
    }
    .delivery-link {
      margin-top: 4px;
      color: #F25C05;
      font-size: 11.5px;
      font-weight: 700;
    }

    .payment-row {
      display: flex;
      gap: 12px;
      font-size: 11.5px;
      margin-bottom: 3px;
      color: #64748B;
    }
    .payment-row strong {
      color: #0F172A;
      font-weight: 700;
      min-width: 105px;
    }

    /* FULL ORANGE TABLE WITH GRID BORDERS */
    .table-container {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      border: 1px solid #E2E8F0;
    }
    .table-container th {
      padding: 11px 14px;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #FFFFFF;
      background: #F25C05;
      border: 1px solid #E05304;
    }
    .th-center {
      text-align: center;
    }
    .th-left {
      text-align: left;
    }
    .th-right {
      text-align: right;
    }

    .table-row td {
      padding: 12px 14px;
      font-size: 12px;
      border: 1px solid #E2E8F0;
      vertical-align: top;
    }
    .td-num {
      width: 48px;
      text-align: center;
      color: #64748B;
      font-weight: 700;
    }
    .td-desc {
      text-align: left;
    }
    .desc-main {
      font-weight: 700;
      color: #0F172A;
      font-size: 12.5px;
    }
    .desc-sub {
      font-size: 10.5px;
      color: #64748B;
      margin-top: 2px;
    }
    .td-price {
      width: 110px;
      text-align: right;
      color: #334155;
      font-weight: 600;
    }
    .td-qty {
      width: 60px;
      text-align: center;
      color: #334155;
      font-weight: 600;
    }
    .td-total {
      width: 120px;
      text-align: right;
      font-weight: 800;
      color: #0F172A;
    }

    /* TOTALS & BREAKDOWN */
    .totals-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 36px;
      align-items: flex-start;
      margin-bottom: 20px;
    }

    .terms-box {
      font-size: 11px;
      color: #475569;
      line-height: 1.6;
    }
    .terms-heading {
      font-size: 11.5px;
      font-weight: 900;
      color: #F25C05;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 6px;
    }
    .terms-item {
      margin-bottom: 4px;
    }
    .terms-thank-you {
      font-size: 12px;
      font-weight: 900;
      color: #F25C05;
      margin-top: 14px;
      letter-spacing: 0.3px;
    }

    .breakdown-box {
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-bottom: 12px;
    }
    .breakdown-line {
      display: flex;
      justify-content: space-between;
      color: #64748B;
    }
    .breakdown-line span:last-child {
      font-weight: 700;
      color: #0F172A;
    }

    /* Solid Orange Grand Total Bar */
    .grand-total-banner {
      background: #F25C05;
      color: #FFFFFF;
      padding: 12px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 900;
      border-radius: 2px;
      margin-bottom: 18px;
    }
    .grand-total-banner span:first-child {
      font-size: 13.5px;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .gt-amount {
      font-size: 20px;
      letter-spacing: 0.5px;
    }

    /* SIGNATURE */
    .signature-container {
      margin-top: auto;
      text-align: right;
      padding-bottom: 8px;
    }
    .sig-line {
      width: 190px;
      border-bottom: 1px solid #CBD5E1;
      margin-left: auto;
      margin-bottom: 6px;
    }
    .sig-title {
      font-size: 10px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .sig-name {
      font-size: 13px;
      font-weight: 900;
      color: #0F172A;
      margin-top: 2px;
    }

    /* BOTTOM ANGLED ORANGE FOOTER */
    .footer-container {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 794px;
      height: 44px;
      overflow: hidden;
    }
    .footer-svg {
      position: absolute;
      top: 0;
      left: 0;
      width: 794px;
      height: 44px;
      pointer-events: none;
      z-index: 0;
    }
    .footer-content {
      position: relative;
      z-index: 2;
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 44px;
      padding: 0 48px;
      color: #FFFFFF;
      font-size: 11px;
      font-weight: 600;
    }
    .footer-contacts {
      display: flex;
      gap: 24px;
    }
  </style>
</head>
<body>
  <!-- 1. TOP APEX ORANGE HEADER -->
  <div class="header-container">
    <svg class="header-svg" viewBox="0 0 794 135" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- 1. Main Orange Banner (Stops at y=104, pure white underneath) -->
      <polygon points="0,0 310,0 408,104 0,104" fill="#F25C05" />
      <!-- 2. Orange Accent Stripe (Height 120, parallel diagonal) -->
      <polygon points="342,0 382,0 495,120 455,120" fill="#F25C05" />
      <!-- 3. Black Banner (Height 135, directly flush against Orange Stripe) -->
      <polygon points="382,0 794,0 794,135 509,135" fill="#111315" />
    </svg>

    <div class="header-content">
      <div class="brand-side">
        <div class="brand-badge">
          ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" class="brand-logo" alt="Logo" />` : ""}
        </div>
        <div>
          <div class="brand-name">${escapeHtml(data.business.businessName || "CHETHAKA LAKSHITHA")}</div>
          <div class="brand-title">${escapeHtml(data.business.professionalTitle || "SOFTWARE FREELANCING & CONSULTING")}</div>
        </div>
      </div>

      <div class="meta-side">
        <div class="invoice-title">INVOICE</div>
        <div class="meta-line"><span>Invoice No:</span> <strong>#${escapeHtml(data.code)}</strong></div>
        ${data.dueDate ? `<div class="meta-line"><span>Due Date:</span> <strong>${escapeHtml(data.dueDate)}</strong></div>` : ""}
        <div class="meta-line"><span>Invoice Date:</span> <strong>${escapeHtml(data.issueDate)}</strong></div>
      </div>
    </div>
  </div>

  <!-- 2. BODY CONTENT -->
  <div class="body-content">
    <div class="sub-header-grid">
      <div>
        <div class="section-label">INVOICE TO:</div>
        <div class="client-name">${escapeHtml(data.client.name)}</div>
        ${data.client.contactPerson ? `<div class="client-detail">${escapeHtml(data.client.contactPerson)}</div>` : ""}
        ${data.client.phone ? `<div class="client-detail">Phone: ${escapeHtml(data.client.phone)}</div>` : ""}
        ${data.client.email ? `<div class="client-detail">${escapeHtml(data.client.email)}</div>` : ""}
        ${data.deliveryUrl ? `<div class="delivery-link">Delivery: ${escapeHtml(data.deliveryUrl)}</div>` : ""}
      </div>

      <div>
        <div class="section-label">Payment Method</div>
        <div class="payment-row">
          <strong>Account No:</strong>
          <span>${escapeHtml(data.business.taxId || "1234 5678 910")}</span>
        </div>
        <div class="payment-row">
          <strong>Account Name:</strong>
          <span>${escapeHtml(data.business.businessName || "Chethaka Lakshitha")}</span>
        </div>
        <div class="payment-row">
          <strong>Branch / Info:</strong>
          <span>${escapeHtml(data.business.paymentDetails || "Bank transfer details upon request")}</span>
        </div>
      </div>
    </div>

    <!-- TABLE WITH FULL ORANGE HEADER & GRID BORDERS -->
    <table class="table-container">
      <thead>
        <tr>
          <th class="th-center" style="width: 48px;">NO.</th>
          <th class="th-left">PRODUCT DESCRIPTION</th>
          <th class="th-right" style="width: 110px;">PRICE</th>
          <th class="th-center" style="width: 60px;">QTY.</th>
          <th class="th-right" style="width: 120px;">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- TOTALS & SUMMARY -->
    <div class="totals-grid">
      <!-- Left: Numbered Terms & Conditions -->
      <div class="terms-box">
        <div class="terms-heading">Terms &amp; Conditions:</div>
        <div class="terms-item">01. Payment is due within agreed terms. Development proceeds upon confirmation of payment.</div>
        <div class="terms-item">02. All deliverable milestones, intellectual property, and documentation transfer upon settlement.</div>
        ${data.notes ? `<div class="terms-item">03. ${escapeHtml(data.notes)}</div>` : ""}
        <div class="terms-thank-you">Thank you for your business with us.</div>
      </div>

      <!-- Right: Subtotal, Discount, Tax & Total Banner -->
      <div>
        <div class="breakdown-box">
          <div class="breakdown-line">
            <span>Subtotal:</span>
            <span>${formatMoney(subtotalCents, data.currency)}</span>
          </div>
          ${data.discountCents ? `
            <div class="breakdown-line" style="color: #E11D48;">
              <span>Discount:</span>
              <span>-${formatMoney(data.discountCents, data.currency)}</span>
            </div>
          ` : ""}
          ${data.taxCents ? `
            <div class="breakdown-line">
              <span>Tax:</span>
              <span>${formatMoney(data.taxCents, data.currency)}</span>
            </div>
          ` : ""}
          ${data.advanceCents ? `
            <div class="breakdown-line">
              <span>Required Advance:</span>
              <span>${formatMoney(data.advanceCents, data.currency)}</span>
            </div>
          ` : ""}
          ${paidCents > 0 ? `
            <div class="breakdown-line" style="color: #059669;">
              <span>Amount Paid:</span>
              <span>${formatMoney(paidCents, data.currency)}</span>
            </div>
          ` : ""}
        </div>

        <!-- Solid Orange Total Bar -->
        <div class="grand-total-banner">
          <span>Total:</span>
          <span class="gt-amount">${formatMoney(data.amountCents, data.currency)}</span>
        </div>
      </div>
    </div>

    <!-- SIGNATURE -->
    <div class="signature-container">
      <div class="sig-line"></div>
      <div class="sig-title">Your Name &amp; Signature</div>
      <div class="sig-name">${escapeHtml(data.business.businessName || "Chethaka Lakshitha")}</div>
    </div>
  </div>

  <!-- 3. BOTTOM ANGLED ORANGE FOOTER -->
  <div class="footer-container">
    <svg class="footer-svg" viewBox="0 0 794 44" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="0,0 520,0 575,44 0,44" fill="#F25C05" />
    </svg>

    <div class="footer-content">
      <div class="footer-contacts">
        ${data.business.phone ? `<div>Phone: ${escapeHtml(data.business.phone)}</div>` : ""}
        ${data.business.email || data.business.website ? `<div>${escapeHtml(data.business.email || data.business.website || "")}</div>` : ""}
        ${data.business.address ? `<div>${escapeHtml(data.business.address)}</div>` : ""}
      </div>
      <div style="font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #94A3B8;">
        BillFlow
      </div>
    </div>
  </div>
</body>
</html>`;
}
