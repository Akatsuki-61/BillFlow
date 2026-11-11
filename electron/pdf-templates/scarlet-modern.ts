import { InvoicePdfPayload } from "./types";
import { escapeHtml, formatMoney, getBase64Logo } from "./helpers";

export function buildInvoiceHtmlScarletModern(data: InvoicePdfPayload): string {
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

    /* TOP HEADER */
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
      align-items: center;
      height: 135px;
      padding: 0 48px;
      color: #FFFFFF;
    }
    .brand-side {
      display: flex;
      align-items: center;
      gap: 14px;
      max-width: 310px;
    }
    .brand-badge {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: #E5252A;
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
      color: #CBD5E1;
      text-transform: uppercase;
      margin-top: 2px;
    }

    .meta-side {
      text-align: right;
    }
    .invoice-title {
      font-size: 34px;
      font-weight: 900;
      letter-spacing: 2px;
      color: #FFFFFF;
      line-height: 1;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .meta-row {
      display: flex;
      justify-content: flex-end;
      gap: 16px;
      margin-bottom: 2px;
      font-size: 11px;
    }
    .meta-label {
      color: rgba(255, 255, 255, 0.75);
      font-weight: 700;
    }
    .meta-val {
      color: #FFFFFF;
      font-weight: 800;
      min-width: 95px;
      text-align: right;
    }

    /* BODY */
    .body-content {
      position: relative;
      z-index: 2;
      padding: 28px 48px 20px;
      display: flex;
      flex-direction: column;
      height: calc(1123px - 135px - 44px);
    }

    .sub-header-grid {
      margin-bottom: 24px;
    }
    .section-label {
      font-size: 11px;
      font-weight: 900;
      color: #E5252A;
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
      color: #E5252A;
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
      min-width: 100px;
    }

    /* TABLE */
    .table-container {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .table-container th {
      padding: 10px 14px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #FFFFFF;
      border: none;
    }
    .th-red {
      background: #E5252A;
      text-align: left;
    }
    .th-dark {
      background: #1E2229;
    }
    .th-dark.text-right {
      text-align: right;
    }
    .th-dark.text-center {
      text-align: center;
    }

    .table-row td {
      padding: 12px 14px;
      font-size: 12px;
      border-bottom: 1px dotted #CBD5E1;
      vertical-align: top;
    }
    .td-num {
      width: 44px;
      text-align: center;
      color: #94A3B8;
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
    .due-box-label {
      font-size: 11.5px;
      font-weight: 800;
      color: #334155;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .due-amount {
      font-size: 28px;
      font-weight: 900;
      color: #E5252A;
      letter-spacing: -0.5px;
      margin-top: 4px;
    }
    .due-subtext {
      font-size: 11px;
      color: #64748B;
      margin-top: 4px;
    }
    .due-subtext strong {
      color: #0F172A;
    }

    .breakdown-box {
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 5px;
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

    .grand-total-banner {
      background: #E5252A;
      color: #FFFFFF;
      padding: 12px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 900;
      border-radius: 2px;
      margin-bottom: 24px;
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

    /* FOOTER BAR */
    .terms-and-signature {
      margin-top: auto;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 36px;
      align-items: flex-end;
      padding-bottom: 12px;
    }
    .terms-heading {
      font-size: 11.5px;
      font-weight: 900;
      color: #E5252A;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .terms-text {
      font-size: 10px;
      color: #64748B;
      line-height: 1.5;
    }

    .signature-area {
      text-align: right;
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

    /* BOTTOM GEOMETRIC FOOTER */
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
  <!-- 1. TOP HEADER -->
  <div class="header-container">
    <svg class="header-svg" viewBox="0 0 794 135" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="0,0 325,0 420,135 0,135" fill="#1E2229" />
      <polygon points="325,0 794,0 794,135 420,135" fill="#E5252A" />
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
    </div>

    <!-- TABLE -->
    <table class="table-container">
      <thead>
        <tr>
          <th class="th-red" style="width: 44px; text-align: center;">No.</th>
          <th class="th-red">Product Description</th>
          <th class="th-dark text-right">Price</th>
          <th class="th-dark text-center">QTY.</th>
          <th class="th-dark text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- TOTALS & SUMMARY -->
    <div class="totals-grid">
      <div>
        <div class="due-box-label">${balanceDueCents > 0 ? "Total Due" : "Amount Settled"}</div>
        <div class="due-amount">${formatMoney(balanceDueCents > 0 ? balanceDueCents : data.amountCents, data.currency)} ${escapeHtml(data.currency)}</div>
        ${data.advanceCents ? `<div class="due-subtext">Required Advance: <strong>${formatMoney(data.advanceCents, data.currency)}</strong></div>` : ""}
        ${paidCents > 0 ? `<div class="due-subtext" style="color: #059669;">Paid to date: <strong>${formatMoney(paidCents, data.currency)}</strong></div>` : ""}
      </div>

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
      </div>
    </div>

    <!-- Solid Crimson Grand Total Bar -->
    <div class="grand-total-banner">
      <span>Total:</span>
      <span class="gt-amount">${formatMoney(data.amountCents, data.currency)}</span>
    </div>

    <!-- TERMS -->
    <div class="terms-and-signature">
      <div style="max-width: 600px;">
        <div class="terms-heading">Terms &amp; Conditions:</div>
        <div class="terms-text">${escapeHtml(data.notes || "Payment is due within agreed terms. All deliverable milestones, intellectual property, and documentation transfer upon final settlement.")}</div>
      </div>
    </div>
  </div>

  <!-- 3. BOTTOM GEOMETRIC FOOTER -->
  <div class="footer-container">
    <svg class="footer-svg" viewBox="0 0 794 44" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="0,0 520,0 575,44 0,44" fill="#E5252A" />
      <polygon points="520,0 794,0 794,44 575,44" fill="#1E2229" />
    </svg>

    <div class="footer-content">
      <div class="footer-contacts">
        ${data.business.phone ? `<div>Phone: ${escapeHtml(data.business.phone)}</div>` : ""}
        ${data.business.email || data.business.website ? `<div>${escapeHtml(data.business.email || data.business.website || "")}</div>` : ""}
        ${data.business.address ? `<div>${escapeHtml(data.business.address)}</div>` : ""}
      </div>
      <div style="font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #CBD5E1;">
        BillFlow
      </div>
    </div>
  </div>
</body>
</html>`;
}
