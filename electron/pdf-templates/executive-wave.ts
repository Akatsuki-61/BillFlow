import { InvoicePdfPayload } from "./types";
import { escapeHtml, formatMoney, getBase64Logo } from "./helpers";

export function buildInvoiceHtmlExecutiveWave(data: InvoicePdfPayload): string {
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
      <tr class="${idx % 2 === 1 ? 'row-alt' : 'row-regular'}">
        <td class="td-num">${idx + 1}</td>
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
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: #FFFFFF;
      width: 794px;
      height: 1123px;
      font-family: 'Plus Jakarta Sans', 'Nunito', -apple-system, sans-serif;
      color: #1F242D;
      position: relative;
      overflow: hidden;
      -webkit-font-smoothing: antialiased;
    }

    /* TOP WAVE ARTWORK (Compact height) */
    .wave-bg-svg {
      position: absolute;
      top: 0;
      left: 0;
      width: 794px;
      height: 148px;
      pointer-events: none;
      z-index: 0;
    }
    .header-content {
      position: relative;
      z-index: 2;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 22px 48px 0;
      height: 148px;
    }
    .brand-side {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-logo {
      width: 36px;
      height: 36px;
      object-fit: contain;
    }
    .brand-name {
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #FFFFFF;
      text-transform: uppercase;
      line-height: 1.2;
    }
    .brand-title {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1.2px;
      color: #EAA828;
      text-transform: uppercase;
      margin-top: 2px;
    }

    .contact-side {
      text-align: right;
      display: flex;
      gap: 24px;
    }
    .contact-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      text-align: left;
    }
    .c-label {
      font-size: 9px;
      font-weight: 800;
      color: #EAA828;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .c-val {
      font-size: 10px;
      font-weight: 600;
      color: #F1F5F9;
      line-height: 1.35;
    }

    /* BODY */
    .body-content {
      position: relative;
      z-index: 2;
      padding: 12px 48px 24px;
      display: flex;
      flex-direction: column;
    }

    .client-and-meta {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
    }
    .client-box {
      max-width: 320px;
    }
    .to-label {
      font-size: 12px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .client-name {
      font-size: 18px;
      font-weight: 800;
      color: #0F172A;
      margin-bottom: 4px;
    }
    .client-detail {
      font-size: 11.5px;
      color: #64748B;
      line-height: 1.5;
    }

    .invoice-meta-box {
      text-align: right;
    }
    .invoice-hero {
      font-size: 38px;
      font-weight: 900;
      letter-spacing: 2.5px;
      color: #0F172A;
      line-height: 1;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .meta-row {
      display: flex;
      justify-content: flex-end;
      gap: 16px;
      margin-bottom: 4px;
      font-size: 11.5px;
    }
    .meta-label {
      color: #64748B;
      font-weight: 700;
    }
    .meta-val {
      color: #0F172A;
      font-weight: 800;
      min-width: 95px;
      text-align: right;
    }
    .status-badge {
      display: inline-block;
      padding: 3px 12px;
      border-radius: 9999px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #B45309;
      background: #FEF3C7;
      border: 1px solid #FCD34D;
      margin-top: 4px;
    }

    /* TABLE */
    .table-container {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .table-container th {
      padding: 12px 14px;
      font-size: 11.5px;
      font-weight: 800;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #FFFFFF;
      border: none;
    }
    .th-gold {
      background: #EAA828;
      text-align: left;
    }
    .th-dark {
      background: #20232A;
    }
    .th-dark.text-right {
      text-align: right;
    }
    .th-dark.text-center {
      text-align: center;
    }

    .table-container td {
      padding: 12px 14px;
      font-size: 12px;
      border-bottom: 1px solid #E2E8F0;
    }
    .row-alt {
      background: #F1F3F7;
    }
    .row-regular {
      background: #FFFFFF;
    }
    .td-num {
      width: 36px;
      color: #64748B;
      font-weight: 700;
      text-align: center;
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
      width: 100px;
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
      width: 115px;
      text-align: right;
      font-weight: 800;
      color: #0F172A;
    }

    /* SUMMARY ROW */
    .summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      align-items: flex-start;
      padding-top: 8px;
    }
    .payment-box {
      font-size: 11.5px;
      color: #64748B;
      line-height: 1.6;
    }
    .payment-title {
      font-size: 11.5px;
      font-weight: 800;
      color: #0F172A;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .payment-text {
      white-space: pre-line;
    }

    .totals-box {
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .totals-line {
      display: flex;
      justify-content: space-between;
      color: #64748B;
    }
    .totals-line span:last-child {
      font-weight: 700;
      color: #0F172A;
    }

    .grand-total-banner {
      margin-top: 8px;
      background: #EAA828;
      color: #1E2026;
      padding: 10px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 900;
      border-radius: 2px;
    }
    .grand-total-banner span:first-child {
      font-size: 13px;
      letter-spacing: 1px;
    }
    .gt-amount {
      font-size: 18px;
    }

    /* FOOTER */
    .footer-bar {
      margin-top: auto;
      padding-top: 18px;
      border-top: 1px solid #E2E8F0;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .terms-box {
      max-width: 440px;
    }
    .thank-you-title {
      font-size: 13.5px;
      font-weight: 800;
      color: #0F172A;
      margin-bottom: 4px;
    }
    .terms-desc {
      font-size: 10.5px;
      color: #64748B;
      line-height: 1.5;
    }
    .signature-box {
      text-align: right;
    }
    .signer-name {
      font-size: 13px;
      font-weight: 800;
      color: #0F172A;
    }
    .signer-title {
      font-size: 10px;
      font-weight: 600;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }
  </style>
</head>
<body>
  <!-- Full-width Multi-Layered Wave Background (Flows continuously without container cutoff, compact header) -->
  <svg class="wave-bg-svg" viewBox="0 0 794 148" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- 1. Deep Charcoal Header Base -->
    <path d="M 0 0 L 794 0 L 794 75 C 735 67, 662 60, 572 61 C 471 62, 370 77, 264 88 C 202 95, 135 101, 67 104 C 33 105, 0 104, 0 102 Z" fill="#23262B" />

    <!-- 2. Top-Right Dark Slate Accent Curve -->
    <path d="M 605 0 C 670 20, 740 34, 794 42 L 794 0 Z" fill="#383D46" />

    <!-- 3. Medium Charcoal Grey Ribbon -->
    <path d="M 264 88 C 370 77, 471 62, 572 61 C 662 60, 735 67, 794 75 L 794 102 C 730 90, 651 78, 561 78 C 460 78, 370 84, 280 88 Z" fill="#8B8F96" />

    <!-- 4. Light Silvery Grey Ribbon -->
    <path d="M 292 87 C 382 83, 471 78, 561 78 C 651 78, 730 90, 794 102 L 794 139 C 735 126, 651 106, 561 95 C 471 85, 393 85, 314 87 Z" fill="#CCD0D7" />

    <!-- 5. Soft Edge Accent Ribbon -->
    <path d="M 370 84 C 460 85, 550 93, 628 107 C 696 119, 746 130, 794 139 L 794 142 C 746 133, 696 122, 628 109 C 550 95, 460 86, 370 85 Z" fill="#E4E6EA" />
  </svg>

  <div class="header-content">
      <div class="brand-side">
        ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" class="brand-logo" alt="Logo" />` : ""}
        <div>
          <div class="brand-name">${escapeHtml(data.business.businessName || "CHETHAKA LAKSHITHA")}</div>
          <div class="brand-title">${escapeHtml(data.business.professionalTitle || "SOFTWARE FREELANCING & CONSULTING")}</div>
        </div>
      </div>
      <div class="contact-side">
        ${data.business.phone ? `
          <div class="contact-item">
            <span class="c-label">Phone:</span>
            <span class="c-val">${escapeHtml(data.business.phone)}</span>
          </div>
        ` : ""}
        <div class="contact-item">
          <span class="c-label">Web / Email:</span>
          <span class="c-val">${escapeHtml(data.business.email || data.business.website || "chethaka.dev")}</span>
        </div>
        <div class="contact-item">
          <span class="c-label">Area / Location:</span>
          <span class="c-val">${escapeHtml(data.business.address || data.business.taxId || "Colombo, Sri Lanka")}</span>
        </div>
      </div>
    </div>

  <!-- BODY CONTENT -->
  <div class="body-content">
    <!-- CLIENT & META -->
    <div class="client-and-meta">
      <div class="client-box">
        <div class="to-label">To:</div>
        <div class="client-name">${escapeHtml(data.client.name)}</div>
        ${data.client.driveUrl ? `<div class="client-detail">Delivery: ${escapeHtml(data.client.driveUrl)}</div>` : ""}
        ${data.client.email ? `<div class="client-detail">${escapeHtml(data.client.email)}</div>` : ""}
        ${data.client.phone ? `<div class="client-detail">${escapeHtml(data.client.phone)}</div>` : ""}
      </div>

      <div class="invoice-meta-box">
        <div class="invoice-hero">INVOICE</div>
        <div class="meta-row">
          <span class="meta-label">Invoice No.:</span>
          <span class="meta-val">${escapeHtml(data.code)}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Date:</span>
          <span class="meta-val">${escapeHtml(data.issueDate)}</span>
        </div>
        ${data.dueDate ? `
        <div class="meta-row">
          <span class="meta-label">Due Date:</span>
          <span class="meta-val">${escapeHtml(data.dueDate)}</span>
        </div>` : ""}
        <div style="text-align: right; margin-top: 4px;">
          <span class="status-badge">${escapeHtml(data.status.replace("_", " "))}</span>
        </div>
      </div>
    </div>

    <!-- TABLE -->
    <table class="table-container">
      <thead>
        <tr>
          <th class="th-gold" style="width: 44px; text-align: center;">No.</th>
          <th class="th-gold">ITEM DESCRIPTION</th>
          <th class="th-dark text-right">PRICE</th>
          <th class="th-dark text-center">QTY</th>
          <th class="th-dark text-right">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- SUMMARY & PAYMENT -->
    <div class="summary-grid">
      <div class="payment-box">
        <div class="payment-title">PAYMENT INFO</div>
        <div class="payment-text">${escapeHtml(data.business.paymentDetails || "Payment via Bank Transfer / Wire Transfer\nDetails provided upon invoice issue.")}</div>
      </div>

      <div class="totals-box">
        <div class="totals-line">
          <span>Sub Total:</span>
          <span>${formatMoney(subtotalCents, data.currency)}</span>
        </div>
        ${data.discountCents ? `
          <div class="totals-line">
            <span>Discount:</span>
            <span>-${formatMoney(data.discountCents, data.currency)}</span>
          </div>
        ` : ""}
        ${data.taxCents ? `
          <div class="totals-line">
            <span>Tax / VAT:</span>
            <span>${formatMoney(data.taxCents, data.currency)}</span>
          </div>
        ` : ""}
        ${data.advanceCents ? `
          <div class="totals-line">
            <span>Required Advance:</span>
            <span>${formatMoney(data.advanceCents, data.currency)}</span>
          </div>
        ` : ""}
        ${paidCents > 0 ? `
          <div class="totals-line">
            <span>Amount Paid:</span>
            <span>${formatMoney(paidCents, data.currency)}</span>
          </div>
        ` : ""}
        <div class="grand-total-banner">
          <span>GRAND TOTAL</span>
          <span class="gt-amount">${formatMoney(data.amountCents, data.currency)}</span>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer-bar">
      <div class="terms-box">
        <div class="thank-you-title">Thank you for your business!</div>
        <div class="terms-desc"><strong>TERMS : </strong>${escapeHtml(data.notes || "Payment is due within agreed terms. Development milestones proceed upon confirmation of the required advance.")}</div>
      </div>
      <div class="signature-box">
        <div class="signer-name">${escapeHtml(data.business.businessName || "Chethaka Lakshitha")}</div>
        <div class="signer-title">${escapeHtml(data.business.professionalTitle || "Software Freelancer & Consultant")}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
