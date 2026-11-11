import { InvoicePdfPayload } from "./types";
import { escapeHtml, formatMoney, getBase64Logo } from "./helpers";

export function buildInvoiceHtmlGeometricTeal(data: InvoicePdfPayload): string {
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
      <tr>
        <td class="td-num">${idx + 1}</td>
        <td class="td-desc">${escapeHtml(it.description)}</td>
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
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: #FFFFFF;
      width: 794px;
      height: 1123px;
      font-family: 'Nunito', ui-rounded, 'SF Pro Rounded', 'Segoe UI Rounded', sans-serif;
      color: #1F262E;
      position: relative;
      overflow: hidden;
      -webkit-font-smoothing: antialiased;
    }

    .top-left-svg {
      position: absolute;
      top: 0;
      left: 0;
      width: 440px;
      height: 350px;
      pointer-events: none;
      z-index: 1;
    }

    .brand-banner {
      position: absolute;
      top: 70px;
      left: 0;
      height: 84px;
      max-width: 335px;
      display: flex;
      align-items: center;
      padding-left: 36px;
      padding-right: 20px;
      z-index: 2;
    }
    .brand-logo {
      width: 32px;
      height: 32px;
      object-fit: contain;
      margin-right: 12px;
      flex-shrink: 0;
    }
    .brand-name {
      color: #FFFFFF;
      font-size: 16px;
      font-weight: 800;
      letter-spacing: 0.5px;
      line-height: 1.2;
      text-transform: uppercase;
    }
    .brand-title {
      color: #CBD5E1;
      font-size: 9.5px;
      font-weight: 700;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      margin-top: 3px;
    }

    .doc-content {
      position: relative;
      z-index: 3;
      padding: 36px 48px;
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-top: 130px;
      padding-bottom: 24px;
    }
    .contact-info {
      font-size: 11.5px;
      color: #718096;
      line-height: 1.6;
    }
    .invoice-title-block {
      text-align: right;
    }
    .invoice-title {
      font-size: 42px;
      font-weight: 900;
      letter-spacing: 1.5px;
      color: #00A887;
      line-height: 1;
      text-transform: uppercase;
    }
    .meta-table {
      margin-top: 12px;
      font-size: 12px;
    }
    .meta-row {
      display: flex;
      justify-content: flex-end;
      gap: 16px;
      margin-bottom: 4px;
    }
    .meta-label {
      color: #718096;
      font-weight: 700;
    }
    .meta-val {
      color: #1F262E;
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
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #00A887;
      background: rgba(0, 168, 135, 0.1);
      border: 1px solid rgba(0, 168, 135, 0.3);
      margin-top: 6px;
    }

    /* Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
    }
    .items-table th {
      border-bottom: 2px solid #00A887;
      padding: 10px 8px;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #00A887;
      text-align: left;
    }
    .items-table td {
      padding: 14px 8px;
      border-bottom: 1px solid #E2E8F0;
      font-size: 12px;
      vertical-align: top;
    }
    .td-num {
      width: 44px;
      color: #718096;
      font-weight: 700;
    }
    .td-desc {
      color: #1F262E;
      font-weight: 700;
    }
    .td-price {
      text-align: right;
      width: 110px;
      color: #1F262E;
      font-weight: 700;
    }
    .td-qty {
      text-align: center;
      width: 60px;
      color: #718096;
      font-weight: 700;
    }
    .td-total {
      text-align: right;
      width: 120px;
      color: #1F262E;
      font-weight: 900;
    }

    /* 2-Column Section */
    .two-columns {
      display: grid;
      grid-template-columns: 1.2fr 1.6fr;
      gap: 32px;
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #E2E8F0;
    }
    .col-heading {
      font-size: 12px;
      font-weight: 900;
      color: #00A887;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .client-name {
      font-size: 13.5px;
      font-weight: 800;
      color: #1F262E;
      margin-bottom: 3px;
    }
    .col-body {
      font-size: 11.5px;
      color: #718096;
      line-height: 1.5;
    }
    .delivery-link {
      margin-top: 6px;
      color: #00A887;
      font-weight: 700;
      word-break: break-all;
    }

    .totals-card {
      text-align: right;
      font-size: 12px;
    }
    .totals-row {
      display: flex;
      justify-content: flex-end;
      gap: 20px;
      margin-bottom: 6px;
      color: #718096;
      font-weight: 700;
    }
    .totals-row .val {
      min-width: 90px;
      color: #1F262E;
      font-weight: 800;
    }
    .totals-divider {
      border-top: 2px solid #00A887;
      margin: 8px 0;
    }
    .final-total-row {
      display: flex;
      justify-content: flex-end;
      align-items: baseline;
      gap: 16px;
      margin-top: 4px;
      margin-bottom: 8px;
    }
    .final-total-label {
      font-size: 15px;
      font-weight: 900;
      color: #00A887;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .final-total-amount {
      font-size: 24px;
      font-weight: 900;
      color: #00A887;
      min-width: 120px;
    }

    /* Footer */
    .footer-row {
      margin-top: auto;
      padding-top: 24px;
    }
    .terms-block {
      max-width: 440px;
    }
    .terms-heading {
      font-size: 11.5px;
      font-weight: 900;
      color: #00A887;
      margin-bottom: 4px;
    }
    .terms-text {
      font-size: 10.5px;
      color: #718096;
      line-height: 1.5;
    }
    .thank-you {
      font-size: 11.5px;
      font-weight: 900;
      color: #1F262E;
      margin-top: 8px;
    }

    .bottom-right-svg {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 200px;
      height: 180px;
      pointer-events: none;
      z-index: 1;
    }
  </style>
</head>
<body>
  <!-- Top Left Geometric Art -->
  <svg class="top-left-svg" viewBox="0 0 440 350" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M 190 0 L 290 0 L 197 155 L 97 155 Z" fill="#6B7685" fill-opacity="0.35" />
    <path d="M 0 0 L 58 0 L 0 98 Z" fill="#38414D" />
    <path d="M 58 0 L 122 0 L 0 205 L 0 98 Z" fill="#006758" />
    <path d="M 122 0 L 190 0 L 0 320 L 0 205 Z" fill="#00A887" />
    <path d="M 0 70 L 378 70 L 328 155 L 0 155 Z" fill="#5A6577" />
    <path d="M 0 70 L 348 70 L 298 155 L 0 155 Z" fill="#222831" />
  </svg>

  <!-- Brand Banner inside ribbon -->
  <div class="brand-banner">
    ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" class="brand-logo" alt="Logo" />` : ""}
    <div>
      <div class="brand-name">${escapeHtml(data.business.businessName || "CHETHAKA LAKSHITHA")}</div>
      <div class="brand-title">${escapeHtml(data.business.professionalTitle || "SOFTWARE FREELANCING & CONSULTING")}</div>
    </div>
  </div>

  <!-- Bottom Right Geometric Art -->
  <svg class="bottom-right-svg" viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M 55 180 L 160 0 L 178 0 L 73 180 Z" fill="#5A6577" />
    <path d="M 73 180 L 178 0 L 200 0 L 200 36 L 105 180 Z" fill="#006758" />
    <path d="M 105 180 L 200 36 L 200 180 Z" fill="#00A887" />
  </svg>

  <!-- Main Document Content -->
  <div class="doc-content">
    <div class="header-row">
      <div class="contact-info">
        ${data.business.email ? `<div>${escapeHtml(data.business.email)}</div>` : ""}
        ${data.business.phone ? `<div>${escapeHtml(data.business.phone)}</div>` : ""}
        ${data.business.taxId ? `<div>Tax / Reg: ${escapeHtml(data.business.taxId)}</div>` : ""}
      </div>

      <div class="invoice-title-block">
        <div class="invoice-title">INVOICE</div>
        <div class="meta-table">
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
        </div>
        <div><span class="status-badge">${escapeHtml(data.status.replace("_", " "))}</span></div>
      </div>
    </div>

    <!-- Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 44px;">No.</th>
          <th>Item Description</th>
          <th style="text-align: right; width: 110px;">Price</th>
          <th style="text-align: center; width: 60px;">Qty.</th>
          <th style="text-align: right; width: 120px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- 2-Column Info -->
    <div class="two-columns">
      <div>
        <div class="col-heading">Invoice to:</div>
        <div class="client-name">${escapeHtml(data.client.name)}</div>
        <div class="col-body">
          ${data.client.email ? `<div>${escapeHtml(data.client.email)}</div>` : ""}
          ${data.client.phone ? `<div>${escapeHtml(data.client.phone)}</div>` : ""}
          ${data.deliveryUrl ? `<div class="delivery-link">${escapeHtml(data.deliveryUrl)}</div>` : ""}
        </div>
      </div>

      <div>
        <div class="totals-card">
          <div class="totals-row">
            <span>Sub Total:</span>
            <span class="val">${formatMoney(subtotalCents, data.currency)}</span>
          </div>
          ${data.discountCents ? `
          <div class="totals-row" style="color: #E11D48;">
            <span>Discount:</span>
            <span class="val">-${formatMoney(data.discountCents, data.currency)}</span>
          </div>` : ""}
          ${data.taxCents ? `
          <div class="totals-row">
            <span>Tax:</span>
            <span class="val">${formatMoney(data.taxCents, data.currency)}</span>
          </div>` : ""}
          <div class="totals-divider"></div>
          <div class="final-total-row">
            <span class="final-total-label">Total:</span>
            <span class="final-total-amount">${formatMoney(data.amountCents, data.currency)}</span>
          </div>
          ${data.advanceCents ? `
          <div class="totals-row" style="padding-top: 4px;">
            <span style="font-weight: 700;">Required Advance:</span>
            <span class="val" style="font-weight: 800;">${formatMoney(data.advanceCents, data.currency)}</span>
          </div>` : ""}
          ${paidCents > 0 ? `
          <div class="totals-row" style="color: #059669;">
            <span style="font-weight: 700;">Amount Paid:</span>
            <span class="val" style="font-weight: 800;">${formatMoney(paidCents, data.currency)}</span>
          </div>` : ""}
          <div class="totals-row">
            <span style="font-weight: 800; color: #1F262E;">Balance Due:</span>
            <span class="val" style="font-weight: 900; color: #1F262E;">${formatMoney(balanceDueCents, data.currency)}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer-row">
      <div class="terms-block">
        <div class="terms-heading">Terms &amp; Conditions</div>
        <div class="terms-text">${escapeHtml(data.notes || "Payment is due within agreed terms. Development milestones proceed upon confirmation of the required advance.")}</div>
        <div class="thank-you">Thank you for your business!</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
