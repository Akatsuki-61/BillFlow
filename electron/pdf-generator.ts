import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";

function resolveBrandIcon(): string | undefined {
  const candidates = [
    typeof process !== "undefined" && process.resourcesPath ? path.join(process.resourcesPath, "brand", "logo-white.png") : undefined,
    path.join(process.cwd(), "public", "brand", "logo-white.png"),
    path.join(__dirname, "../public/brand/logo-white.png"),
    path.join(__dirname, "brand/logo-white.png"),
  ];
  return candidates.find((c) => Boolean(c && fs.existsSync(c)));
}

function getBase64Logo(): string {
  const icon = resolveBrandIcon();
  if (icon && fs.existsSync(icon)) {
    return fs.readFileSync(icon).toString("base64");
  }
  return "";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export interface InvoicePdfItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface InvoicePdfPayload {
  code: string;
  issueDate: string;
  dueDate?: string | null;
  currency: string;
  status: string;
  template?: "geometric-teal" | "executive-wave" | string;
  items: InvoicePdfItem[];
  discountCents?: number;
  taxCents?: number;
  advanceCents?: number;
  amountCents: number;
  paidCents?: number;
  deliveryUrl?: string | null;
  notes?: string | null;
  client: {
    name: string;
    email?: string;
    contactPerson?: string;
    phone?: string;
    driveUrl?: string | null;
  };
  business: {
    businessName?: string | null;
    professionalTitle?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    address?: string | null;
    taxId?: string | null;
    paymentDetails?: string | null;
  };
}

export interface WorkOrderPdfPayload {
  voucherNumber: string;
  scope: string;
  feeCents: number;
  currency: string;
  status: string;
  payoutStatus: string;
  dueDate?: string | null;
  completedAt?: string | null;
  paidAt?: string | null;
  deliveryUrl?: string | null;
  notes?: string | null;
  vendor: {
    name: string;
    service?: string;
    email?: string | null;
    phone?: string | null;
  };
  task?: {
    title?: string;
    category?: string;
  };
  parentInvoice?: {
    code?: string;
    clientName?: string;
  };
  business: {
    businessName?: string | null;
    professionalTitle?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    address?: string | null;
  };
}

function formatMoney(cents: number, currency: string): string {
  const symbol =
    currency === "LKR"
      ? "Rs. "
      : currency === "EUR"
        ? "€"
        : currency === "GBP"
          ? "£"
          : currency === "CAD"
            ? "CA$"
            : "$";
  const val = (cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${val}`;
}

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
      margin-top: 14px;
      font-size: 12px;
      display: inline-flex;
      flex-direction: column;
      gap: 6px;
    }
    .meta-row {
      display: flex;
      justify-content: flex-end;
      gap: 16px;
    }
    .meta-label {
      font-weight: 700;
      color: #718096;
    }
    .meta-val {
      font-weight: 800;
      color: #1F262E;
      min-width: 90px;
      text-align: right;
    }
    .status-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #00A887;
      background: rgba(0, 168, 135, 0.1);
      border: 1px solid rgba(0, 168, 135, 0.35);
      margin-top: 6px;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      margin-bottom: 28px;
    }
    .items-table th {
      padding: 10px 12px;
      text-align: left;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.8px;
      color: #00A887;
      text-transform: uppercase;
      border-bottom: 2px solid #00A887;
    }
    .items-table td {
      padding: 14px 12px;
      font-size: 12.5px;
      color: #1F262E;
      border-bottom: 1px solid #E2E8F0;
    }
    .items-table .td-num { color: #718096; font-weight: 600; width: 44px; }
    .items-table .td-desc { font-weight: 600; }
    .items-table .td-price { text-align: right; color: #4A5568; width: 110px; }
    .items-table .td-qty { text-align: center; color: #4A5568; width: 60px; }
    .items-table .td-total { text-align: right; font-weight: 800; width: 120px; }

    .three-columns {
      display: grid;
      grid-template-columns: 1fr 1fr 1.15fr;
      gap: 28px;
      padding-top: 10px;
      padding-bottom: 28px;
      border-bottom: 1px solid #E2E8F0;
    }
    .col-heading {
      font-size: 12.5px;
      font-weight: 800;
      color: #00A887;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .col-body {
      font-size: 12px;
      line-height: 1.55;
      color: #718096;
    }
    .client-name {
      font-size: 14px;
      font-weight: 800;
      color: #1F262E;
      margin-bottom: 3px;
    }
    .delivery-link {
      color: #00A887;
      font-weight: 700;
      text-decoration: none;
      word-break: break-all;
      margin-top: 4px;
      display: inline-block;
    }

    .totals-card {
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      color: #718096;
    }
    .totals-row .val {
      font-weight: 700;
      color: #1F262E;
    }
    .totals-divider {
      border-top: 2px solid #00A887;
      margin: 4px 0;
    }
    .final-total-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 4px 0;
    }
    .final-total-label {
      font-size: 15px;
      font-weight: 900;
      color: #00A887;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .final-total-amount {
      font-size: 21px;
      font-weight: 900;
      color: #00A887;
    }

    .footer-row {
      margin-top: auto;
      padding-top: 24px;
      padding-bottom: 30px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .terms-block {
      max-width: 440px;
    }
    .terms-heading {
      font-size: 12px;
      font-weight: 800;
      color: #00A887;
      margin-bottom: 5px;
    }
    .terms-text {
      font-size: 11px;
      color: #718096;
      line-height: 1.5;
      margin-bottom: 10px;
    }
    .thank-you {
      font-size: 13px;
      font-weight: 800;
      color: #1F262E;
    }

    .bottom-right-svg {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 220px;
      height: 200px;
      pointer-events: none;
      z-index: 1;
    }
  </style>
</head>
<body>
  <!-- Top-Left Vector Art -->
  <svg class="top-left-svg" viewBox="0 0 440 350" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M 188 0 L 286 0 L 196 154 L 98 154 Z" fill="#6B7685" fill-opacity="0.35" />
    <path d="M 0 0 L 58 0 L 0 98 Z" fill="#38414D" />
    <path d="M 58 0 L 122 0 L 0 206 L 0 98 Z" fill="#006758" />
    <path d="M 122 0 L 190 0 L 0 322 L 0 206 Z" fill="#00A887" />
    <path d="M 0 70 L 375 70 L 325 154 L 0 154 Z" fill="#5A6577" />
    <path d="M 0 70 L 342 70 L 292 154 L 0 154 Z" fill="#222831" />
  </svg>

  <!-- Brand Banner with Official BillFlow Logo -->
  <div class="brand-banner">
    ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" class="brand-logo" alt="BillFlow" />` : ""}
    <div>
      <div class="brand-name">${escapeHtml((data.business.businessName || "CHETHAKA LAKSHITHA").toUpperCase())}</div>
      <div class="brand-title">${escapeHtml((data.business.professionalTitle || "SOFTWARE FREELANCING & CONSULTING").toUpperCase())}</div>
    </div>
  </div>

  <!-- Bottom-Right Vector Art -->
  <svg class="bottom-right-svg" viewBox="0 0 220 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M 60 200 L 175 0 L 195 0 L 80 200 Z" fill="#5A6577" />
    <path d="M 80 200 L 195 0 L 220 0 L 220 40 L 115 200 Z" fill="#006758" />
    <path d="M 115 200 L 220 40 L 220 200 Z" fill="#00A887" />
  </svg>

  <!-- Content -->
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
            <span class="meta-label">Invoice#:</span>
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
          <th style="width: 44px;">SL.</th>
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

    <!-- 3-Column Info -->
    <div class="three-columns">
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
        <div class="col-heading">Payment Info:</div>
        <div class="col-body" style="white-space: pre-line;">${data.business.paymentDetails ? escapeHtml(data.business.paymentDetails) : "Bank transfer details provided upon request."}</div>
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

    /* TOP WAVE ARTWORK */
    .wave-bg-svg {
      position: absolute;
      top: 0;
      left: 0;
      width: 794px;
      height: 320px;
      pointer-events: none;
      z-index: 0;
    }
    .header-content {
      position: relative;
      z-index: 2;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 34px 48px 0;
    }
    .brand-side {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .brand-logo {
      width: 38px;
      height: 38px;
      object-fit: contain;
    }
    .brand-name {
      font-size: 17px;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #FFFFFF;
      text-transform: uppercase;
      line-height: 1.2;
    }
    .brand-title {
      font-size: 9.5px;
      font-weight: 700;
      letter-spacing: 1.2px;
      color: #EAA828;
      text-transform: uppercase;
      margin-top: 2px;
    }

    .contact-side {
      text-align: right;
      display: flex;
      gap: 28px;
    }
    .contact-item {
      display: flex;
      flex-direction: column;
      gap: 3px;
      text-align: left;
    }
    .c-label {
      font-size: 10px;
      font-weight: 800;
      color: #EAA828;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .c-val {
      font-size: 10.5px;
      font-weight: 600;
      color: #F1F5F9;
      line-height: 1.35;
    }

    /* BODY */
    .body-content {
      position: relative;
      z-index: 2;
      padding: 36px 48px 24px;
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
    .meta-line {
      font-size: 11.5px;
      margin-bottom: 4px;
      color: #64748B;
    }
    .meta-line strong {
      color: #0F172A;
      font-weight: 800;
      margin-left: 6px;
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
      font-size: 14px;
      letter-spacing: 0.5px;
      border-radius: 2px;
    }
    .grand-total-banner .gt-amount {
      font-size: 18px;
    }

    /* FOOTER */
    .footer-bar {
      margin-top: auto;
      padding-top: 20px;
      padding-bottom: 24px;
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
  <!-- Full-width Multi-Layered Wave Background (Flows continuously without container cutoff) -->
  <svg class="wave-bg-svg" viewBox="0 0 794 320" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- 1. Deep Charcoal Header Base -->
    <path d="M 0 0 L 794 0 L 794 152 C 735 138, 662 123, 572 125 C 471 127, 370 158, 264 180 C 202 194, 135 207, 67 213 C 33 215, 0 212, 0 210 Z" fill="#23262B" />

    <!-- 2. Top-Right Dark Slate Accent Curve -->
    <path d="M 605 0 C 670 40, 740 70, 794 85 L 794 0 Z" fill="#383D46" />

    <!-- 3. Medium Charcoal Grey Ribbon -->
    <path d="M 264 180 C 370 158, 471 127, 572 125 C 662 123, 735 138, 794 152 L 794 210 C 730 186, 651 162, 561 162 C 460 162, 370 172, 280 180 Z" fill="#8B8F96" />

    <!-- 4. Light Silvery Grey Ribbon -->
    <path d="M 292 178 C 382 170, 471 162, 561 162 C 651 162, 730 186, 794 210 L 794 286 C 735 258, 651 218, 561 194 C 471 174, 393 173, 314 178 Z" fill="#CCD0D7" />

    <!-- 5. Soft Edge Accent Ribbon -->
    <path d="M 370 172 C 460 173, 550 190, 628 219 C 696 245, 746 268, 794 286 L 794 292 C 746 274, 696 251, 628 224 C 550 194, 460 175, 370 174 Z" fill="#E4E6EA" />
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
        <div class="meta-line">Invoice No : <strong>${escapeHtml(data.code)}</strong></div>
        <div class="meta-line">Account No : <strong>${escapeHtml(data.code.replace(/[^0-9]/g, "") || "45562784591")}</strong></div>
        <div class="meta-line">Date : <strong>${escapeHtml(data.issueDate)}</strong></div>
        ${data.dueDate ? `<div class="meta-line">Due Date : <strong>${escapeHtml(data.dueDate)}</strong></div>` : ""}
        <div class="status-badge">${escapeHtml(data.status.replace("_", " "))}</div>
      </div>
    </div>

    <!-- TABLE -->
    <table class="table-container">
      <thead>
        <tr>
          <th class="th-gold" colspan="2">ITEM DESCRIPTION</th>
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

export function buildInvoiceHtml(data: InvoicePdfPayload): string {
  if (data.template === "executive-wave") {
    return buildInvoiceHtmlExecutiveWave(data);
  }
  return buildInvoiceHtmlGeometricTeal(data);
}

/**
 * Generates an exact HTML-to-PDF buffer using Electron's native printToPDF.
 * If running outside an Electron app context (e.g. unit tests), falls back to pdf-lib.
 */
export async function generateInvoiceHtmlPdfBuffer(data: InvoicePdfPayload): Promise<Buffer> {
  try {
    const electron = require("electron");
    if (electron && electron.BrowserWindow) {
      const win = new electron.BrowserWindow({
        show: false,
        width: 794,
        height: 1123,
        webPreferences: { offscreen: true },
      });
      const html = buildInvoiceHtml(data);
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      await new Promise((r) => setTimeout(r, 650));
      const pdfBytes = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: "A4",
        margins: { marginType: "none" },
      });
      win.destroy();
      return Buffer.from(pdfBytes);
    }
  } catch {
    // Fallback below
  }

  return generateInvoicePdfBuffer(data);
}

// Color Palette adapted creatively from the geometric EPS design template:
const cTeal = rgb(0.0, 0.66, 0.53);       // Vibrant Bright Teal (#00A887)
const cDarkTeal = rgb(0.0, 0.40, 0.34);   // Deep Teal (#006758)
const cSlate = rgb(0.35, 0.39, 0.46);      // Mid Slate (#5A6577)
const cDarkSlate = rgb(0.22, 0.25, 0.30);  // Dark Slate Stripe (#38414D)
const cSlateShadow = rgb(0.72, 0.76, 0.80);// Subtle Slate Shadow (#B8C2CC)
const cCharcoal = rgb(0.13, 0.16, 0.19);   // Charcoal Banner (#222831)
const cTextPrimary = rgb(0.12, 0.15, 0.18);// Body dark (#1F262E)
const cTextMuted = rgb(0.44, 0.50, 0.58);  // Muted gray (#718096)
const cLine = rgb(0.88, 0.91, 0.94);       // Divider (#E2E8F0)
const cLightBg = rgb(0.96, 0.98, 0.98);    // Ultra light tinted background

export async function generateInvoicePdfBuffer(data: InvoicePdfPayload): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // Standard A4
  const W = 595.28;
  const H = 841.89;
  const margin = 40;

  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // 1. TOP-LEFT GEOMETRIC ARTWORK (Continuous diagonal ribbons with horizontal charcoal banner)
  page.drawSvgPath("M 140 0 L 215 0 L 146 118 L 71 118 Z", { x: 0, y: H, color: cSlateShadow });
  page.drawSvgPath("M 0 0 L 42 0 L 0 71 Z", { x: 0, y: H, color: cDarkSlate });
  page.drawSvgPath("M 42 0 L 90 0 L 0 153 L 0 71 Z", { x: 0, y: H, color: cDarkTeal });
  page.drawSvgPath("M 90 0 L 142 0 L 0 241 L 0 153 Z", { x: 0, y: H, color: cTeal });
  page.drawSvgPath("M 0 52 L 280 52 L 242 118 L 0 118 Z", { x: 0, y: H, color: cSlate });
  page.drawSvgPath("M 0 52 L 258 52 L 220 118 L 0 118 Z", { x: 0, y: H, color: cCharcoal });

  // BillFlow App Logo inside Banner
  const brandIcon = resolveBrandIcon();
  if (brandIcon && fs.existsSync(brandIcon)) {
    try {
      const iconBytes = fs.readFileSync(brandIcon);
      const iconImg = await doc.embedPng(iconBytes);
      page.drawImage(iconImg, {
        x: 32,
        y: H - 94,
        width: 22,
        height: 22,
      });
    } catch {
      // fallback
    }
  }

  // Business Name inside Banner
  const businessName = (data.business.businessName || "CHETHAKA LAKSHITHA").toUpperCase();
  page.drawText(businessName.slice(0, 26), {
    x: 64,
    y: H - 78,
    size: 11.5,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  const subtitle = (data.business.professionalTitle || "SOFTWARE FREELANCING & CONSULTING").toUpperCase();
  page.drawText(subtitle.slice(0, 38), {
    x: 64,
    y: H - 92,
    size: 6.5,
    font: fontBold,
    color: rgb(0.65, 0.72, 0.78),
  });

  // Contact info under banner
  const contactPieces = [data.business.email, data.business.phone].filter(Boolean).join("  |  ");
  if (contactPieces) {
    page.drawText(contactPieces.slice(0, 48), {
      x: 36,
      y: H - 136,
      size: 7.5,
      font: fontRegular,
      color: cTextMuted,
    });
  }

  // 2. TOP-RIGHT: INVOICE TITLE & METADATA
  const rightX = W - margin;
  page.drawText("INVOICE", {
    x: rightX - 128,
    y: H - 78,
    size: 28,
    font: fontBold,
    color: cTeal,
  });

  let metaY = H - 100;
  const drawMetaRow = (label: string, val: string) => {
    page.drawText(label, { x: rightX - 128, y: metaY, size: 8.5, font: fontBold, color: cTextPrimary });
    const tw = fontRegular.widthOfTextAtSize(val, 8.5);
    page.drawText(val, { x: rightX - tw, y: metaY, size: 8.5, font: fontRegular, color: cTextPrimary });
    metaY -= 13;
  };

  drawMetaRow("Invoice#", data.code);
  drawMetaRow("Date", data.issueDate);
  if (data.dueDate) drawMetaRow("Due Date", data.dueDate);

  // Status Badge
  const statusDisplay = data.status.replace("_", " ");
  page.drawRectangle({
    x: rightX - 82,
    y: metaY - 3,
    width: 82,
    height: 15,
    color: cLightBg,
    borderColor: cTeal,
    borderWidth: 0.8,
  });
  page.drawText(statusDisplay, {
    x: rightX - 76,
    y: metaY,
    size: 7.5,
    font: fontBold,
    color: cTeal,
  });

  // 3. LINE ITEMS TABLE (Clean white header, teal labels, thin line)
  let y = H - 195;

  const colX = {
    num: margin + 4,
    desc: margin + 35,
    price: W - margin - 170,
    qty: W - margin - 90,
    total: W - margin,
  };

  // Header Row - Clean WHITE background with TEAL text
  page.drawText("SL.", { x: colX.num, y, size: 9, font: fontBold, color: cTeal });
  page.drawText("Item Description", { x: colX.desc, y, size: 9, font: fontBold, color: cTeal });
  page.drawText("Price", { x: colX.price, y, size: 9, font: fontBold, color: cTeal });
  page.drawText("Qty.", { x: colX.qty, y, size: 9, font: fontBold, color: cTeal });
  const totalHdrW = fontBold.widthOfTextAtSize("Total", 9);
  page.drawText("Total", { x: colX.total - totalHdrW, y, size: 9, font: fontBold, color: cTeal });

  y -= 8;
  page.drawLine({
    start: { x: margin, y },
    end: { x: W - margin, y },
    thickness: 1,
    color: cLine,
  });

  y -= 18;

  const items =
    data.items.length > 0
      ? data.items
      : [{ description: "Professional Software & Consulting Services", quantity: 1, unitPriceCents: data.amountCents }];

  let subtotalCents = 0;

  items.forEach((item, index) => {
    const lineTotal = item.quantity * item.unitPriceCents;
    subtotalCents += lineTotal;

    const rowNum = String(index + 1);
    page.drawText(rowNum, { x: colX.num, y, size: 8.5, font: fontRegular, color: cTextMuted });
    page.drawText(item.description.slice(0, 52), { x: colX.desc, y, size: 8.5, font: fontRegular, color: cTextPrimary });
    page.drawText(formatMoney(item.unitPriceCents, data.currency), { x: colX.price, y, size: 8.5, font: fontRegular, color: cTextMuted });
    page.drawText(String(item.quantity), { x: colX.qty + 5, y, size: 8.5, font: fontRegular, color: cTextMuted });
    const lineTotText = formatMoney(lineTotal, data.currency);
    const totW = fontBold.widthOfTextAtSize(lineTotText, 8.5);
    page.drawText(lineTotText, { x: colX.total - totW, y, size: 8.5, font: fontBold, color: cTextPrimary });

    y -= 8;
    page.drawLine({
      start: { x: margin, y },
      end: { x: W - margin, y },
      thickness: 0.5,
      color: cLine,
    });
    y -= 16;
  });

  y -= 15;

  // 4. THREE-COLUMN SECTION (Invoice to: | Payment Info: | Totals)
  const col1X = margin;
  const col2X = margin + 175;
  const col3X = W - margin - 150;
  const sectionTopY = y;

  // Column 1: "Invoice to:"
  page.drawText("Invoice to:", { x: col1X, y: sectionTopY, size: 10, font: fontBold, color: cTeal });
  let c1Y = sectionTopY - 16;
  page.drawText(data.client.name.slice(0, 32), { x: col1X, y: c1Y, size: 9.5, font: fontBold, color: cTextPrimary });
  c1Y -= 12;
  if (data.client.email) {
    page.drawText(data.client.email.slice(0, 35), { x: col1X, y: c1Y, size: 8, font: fontRegular, color: cTextMuted });
    c1Y -= 11;
  }
  if (data.client.phone) {
    page.drawText(data.client.phone.slice(0, 35), { x: col1X, y: c1Y, size: 8, font: fontRegular, color: cTextMuted });
    c1Y -= 11;
  }
  const delivery = data.deliveryUrl || data.client.driveUrl;
  if (delivery) {
    page.drawText("Delivery Endpoint:", { x: col1X, y: c1Y, size: 7.5, font: fontBold, color: cTextMuted });
    c1Y -= 10;
    page.drawText(delivery.slice(0, 36), { x: col1X, y: c1Y, size: 7.5, font: fontBold, color: cTeal });
  }

  // Column 2: "Payment Info:"
  page.drawText("Payment Info:", { x: col2X, y: sectionTopY, size: 10, font: fontBold, color: cTeal });
  let c2Y = sectionTopY - 16;
  if (data.business.paymentDetails) {
    const pLines = data.business.paymentDetails.split("\n").slice(0, 4);
    pLines.forEach((line) => {
      page.drawText(line.slice(0, 36), { x: col2X, y: c2Y, size: 8, font: fontRegular, color: cTextPrimary });
      c2Y -= 11;
    });
  } else {
    page.drawText("Standard Wire / Bank Transfer", { x: col2X, y: c2Y, size: 8, font: fontRegular, color: cTextPrimary });
    c2Y -= 11;
    page.drawText("Contact issuer for direct details", { x: col2X, y: c2Y, size: 8, font: fontRegular, color: cTextMuted });
    c2Y -= 11;
  }
  if (data.business.taxId) {
    page.drawText(`Tax Reg: ${data.business.taxId}`, { x: col2X, y: c2Y, size: 7.5, font: fontRegular, color: cTextMuted });
  }

  // Column 3: Totals
  let c3Y = sectionTopY;
  const drawTotal = (label: string, cents: number, isBold = false, isHighlight = false, isNegative = false) => {
    const f = isBold ? fontBold : fontRegular;
    const col = isHighlight ? cTeal : isBold ? cTextPrimary : cTextMuted;
    page.drawText(label, { x: col3X, y: c3Y, size: isHighlight ? 10.5 : 8.5, font: f, color: col });
    const formatted = `${isNegative ? "-" : ""}${formatMoney(cents, data.currency)}`;
    const tw = f.widthOfTextAtSize(formatted, isHighlight ? 10.5 : 8.5);
    page.drawText(formatted, { x: W - margin - tw, y: c3Y, size: isHighlight ? 10.5 : 8.5, font: f, color: col });
    c3Y -= 13;
  };

  drawTotal("Sub Total:", subtotalCents);
  if (data.discountCents && data.discountCents > 0) {
    drawTotal("Discount:", data.discountCents, false, false, true);
  }
  if (data.taxCents && data.taxCents > 0) {
    drawTotal("Tax:", data.taxCents);
  }

  // Divider above Final Total
  c3Y -= 2;
  page.drawLine({
    start: { x: col3X, y: c3Y + 4 },
    end: { x: W - margin, y: c3Y + 4 },
    thickness: 1,
    color: cTeal,
  });

  drawTotal("Total:", data.amountCents, true, true);

  if (data.advanceCents && data.advanceCents > 0) {
    drawTotal("Required Advance:", data.advanceCents, true, false);
  }

  const paidCents = data.paidCents || 0;
  if (paidCents > 0) {
    drawTotal("Amount Paid:", paidCents, false, false);
  }

  const remainingDue = Math.max(0, data.amountCents - paidCents);
  drawTotal("Balance Due:", remainingDue, true, false);

  // 5. FOOTER: TERMS & CONDITIONS (NO SIGNATURE!)
  const footerY = 95;

  page.drawText("Terms & Conditions", {
    x: margin,
    y: footerY + 20,
    size: 9,
    font: fontBold,
    color: cTeal,
  });

  const termsText =
    data.notes ||
    "Payment is due within agreed terms. Delivery milestones proceed upon confirmation of the required advance.";
  page.drawText(termsText.slice(0, 95), {
    x: margin,
    y: footerY + 8,
    size: 7.5,
    font: fontRegular,
    color: cTextMuted,
  });

  page.drawLine({
    start: { x: margin, y: footerY - 2 },
    end: { x: margin + 260, y: footerY - 2 },
    thickness: 0.8,
    color: cLine,
  });

  page.drawText("Thank you for your business!", {
    x: margin,
    y: footerY - 16,
    size: 8.5,
    font: fontBold,
    color: cTextPrimary,
  });

  // 6. BOTTOM-RIGHT CORNER ARTWORK (NO SIGNATURE LINE OR LABEL!)
  page.drawSvgPath("M 48 155 L 138 0 L 154 0 L 64 155 Z", { x: W - 170, y: 155, color: cSlate });
  page.drawSvgPath("M 64 155 L 154 0 L 170 0 L 170 32 L 90 155 Z", { x: W - 170, y: 155, color: cDarkTeal });
  page.drawSvgPath("M 90 155 L 170 32 L 170 155 Z", { x: W - 170, y: 155, color: cTeal });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

export async function generateWorkOrderPdfBuffer(data: WorkOrderPdfPayload): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const W = 595.28;
  const H = 841.89;
  const margin = 40;

  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // 1. TOP-LEFT GEOMETRIC ACCENT BANNER (Continuous diagonal ribbons with horizontal charcoal banner)
  page.drawSvgPath("M 140 0 L 215 0 L 146 118 L 71 118 Z", { x: 0, y: H, color: cSlateShadow });
  page.drawSvgPath("M 0 0 L 42 0 L 0 71 Z", { x: 0, y: H, color: cDarkSlate });
  page.drawSvgPath("M 42 0 L 90 0 L 0 153 L 0 71 Z", { x: 0, y: H, color: cDarkTeal });
  page.drawSvgPath("M 90 0 L 142 0 L 0 241 L 0 153 Z", { x: 0, y: H, color: cTeal });
  page.drawSvgPath("M 0 52 L 280 52 L 242 118 L 0 118 Z", { x: 0, y: H, color: cSlate });
  page.drawSvgPath("M 0 52 L 258 52 L 220 118 L 0 118 Z", { x: 0, y: H, color: cCharcoal });

  // BillFlow App Logo inside Banner
  const brandIcon = resolveBrandIcon();
  if (brandIcon && fs.existsSync(brandIcon)) {
    try {
      const iconBytes = fs.readFileSync(brandIcon);
      const iconImg = await doc.embedPng(iconBytes);
      page.drawImage(iconImg, {
        x: 32,
        y: H - 94,
        width: 22,
        height: 22,
      });
    } catch {
      // fallback
    }
  }

  // Business Name inside Banner
  const businessName = (data.business.businessName || "CHETHAKA LAKSHITHA").toUpperCase();
  page.drawText(businessName.slice(0, 26), {
    x: 64,
    y: H - 78,
    size: 11.5,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  const subtitle = (data.business.professionalTitle || "OUTSOURCING & SUBCONTRACTOR VOUCHER").toUpperCase();
  page.drawText(subtitle.slice(0, 38), {
    x: 64,
    y: H - 92,
    size: 6.5,
    font: fontBold,
    color: rgb(0.65, 0.72, 0.78),
  });

  // Top-Right: WORK ORDER Heading
  const rightX = W - margin;
  page.drawText("WORK ORDER", {
    x: rightX - 145,
    y: H - 78,
    size: 22,
    font: fontBold,
    color: cTeal,
  });

  let metaY = H - 100;
  const drawMetaRow = (label: string, val: string) => {
    page.drawText(label, { x: rightX - 145, y: metaY, size: 8.5, font: fontBold, color: cTextPrimary });
    const tw = fontRegular.widthOfTextAtSize(val, 8.5);
    page.drawText(val, { x: rightX - tw, y: metaY, size: 8.5, font: fontRegular, color: cTextPrimary });
    metaY -= 13;
  };

  drawMetaRow("Voucher No:", data.voucherNumber);
  if (data.dueDate) drawMetaRow("Due Date:", data.dueDate);

  // Status Badge
  page.drawRectangle({
    x: rightX - 82,
    y: metaY - 3,
    width: 82,
    height: 15,
    color: cLightBg,
    borderColor: cTeal,
    borderWidth: 0.8,
  });
  page.drawText(data.payoutStatus || "PENDING", {
    x: rightX - 76,
    y: metaY,
    size: 7.5,
    font: fontBold,
    color: cTeal,
  });

  let y = H - 195;

  // Scope & Task Table
  page.drawText("SL.", { x: margin + 4, y, size: 9, font: fontBold, color: cTeal });
  page.drawText("Subcontractor Scope / Deliverable", { x: margin + 35, y, size: 9, font: fontBold, color: cTeal });
  const feeHdrW = fontBold.widthOfTextAtSize("Fee Amount", 9);
  page.drawText("Fee Amount", { x: W - margin - feeHdrW, y, size: 9, font: fontBold, color: cTeal });

  y -= 8;
  page.drawLine({
    start: { x: margin, y },
    end: { x: W - margin, y },
    thickness: 1,
    color: cLine,
  });

  y -= 18;
  page.drawText("1", { x: margin + 4, y, size: 8.5, font: fontRegular, color: cTextMuted });
  page.drawText(data.scope.slice(0, 65), { x: margin + 35, y, size: 8.5, font: fontRegular, color: cTextPrimary });
  const feeText = formatMoney(data.feeCents, data.currency);
  const feeValW = fontBold.widthOfTextAtSize(feeText, 8.5);
  page.drawText(feeText, { x: W - margin - feeValW, y, size: 8.5, font: fontBold, color: cTextPrimary });

  y -= 8;
  page.drawLine({
    start: { x: margin, y },
    end: { x: W - margin, y },
    thickness: 0.5,
    color: cLine,
  });

  y -= 25;

  // 3-Column Section (Vendor To | Linked Project | Payout Summary)
  const col1X = margin;
  const col2X = margin + 175;
  const col3X = W - margin - 150;
  const sectionTopY = y;

  // Column 1: Subcontractor
  page.drawText("Subcontractor:", { x: col1X, y: sectionTopY, size: 10, font: fontBold, color: cTeal });
  let c1Y = sectionTopY - 16;
  page.drawText(data.vendor.name.slice(0, 32), { x: col1X, y: c1Y, size: 9.5, font: fontBold, color: cTextPrimary });
  c1Y -= 12;
  if (data.vendor.service) {
    page.drawText(data.vendor.service.slice(0, 35), { x: col1X, y: c1Y, size: 8, font: fontRegular, color: cTextMuted });
    c1Y -= 11;
  }
  if (data.vendor.email) {
    page.drawText(data.vendor.email.slice(0, 35), { x: col1X, y: c1Y, size: 8, font: fontRegular, color: cTextMuted });
  }

  // Column 2: Linked Project
  page.drawText("Project Details:", { x: col2X, y: sectionTopY, size: 10, font: fontBold, color: cTeal });
  let c2Y = sectionTopY - 16;
  if (data.parentInvoice?.clientName) {
    page.drawText(`Client: ${data.parentInvoice.clientName.slice(0, 28)}`, { x: col2X, y: c2Y, size: 8, font: fontRegular, color: cTextPrimary });
    c2Y -= 11;
  }
  if (data.parentInvoice?.code) {
    page.drawText(`Invoice Ref: ${data.parentInvoice.code}`, { x: col2X, y: c2Y, size: 8, font: fontRegular, color: cTextMuted });
    c2Y -= 11;
  }
  if (data.deliveryUrl) {
    page.drawText(`Delivery: ${data.deliveryUrl.slice(0, 30)}`, { x: col2X, y: c2Y, size: 8, font: fontBold, color: cTeal });
  }

  // Column 3: Totals
  let c3Y = sectionTopY;
  page.drawText("Total Fee:", { x: col3X, y: c3Y, size: 10.5, font: fontBold, color: cTeal });
  const ftw = fontBold.widthOfTextAtSize(feeText, 10.5);
  page.drawText(feeText, { x: W - margin - ftw, y: c3Y, size: 10.5, font: fontBold, color: cTeal });
  c3Y -= 14;

  page.drawText("Payout Status:", { x: col3X, y: c3Y, size: 8.5, font: fontRegular, color: cTextMuted });
  const pText = data.payoutStatus || "PENDING";
  const ptw = fontRegular.widthOfTextAtSize(pText, 8.5);
  page.drawText(pText, { x: W - margin - ptw, y: c3Y, size: 8.5, font: fontRegular, color: cTextPrimary });

  // Footer
  const footerY = 95;
  page.drawText("Terms & Execution", {
    x: margin,
    y: footerY + 20,
    size: 9,
    font: fontBold,
    color: cTeal,
  });
  page.drawText("Voucher confirms agreed subcontractor scope. Payout released upon approved delivery.", {
    x: margin,
    y: footerY + 8,
    size: 7.5,
    font: fontRegular,
    color: cTextMuted,
  });
  page.drawLine({
    start: { x: margin, y: footerY - 2 },
    end: { x: margin + 260, y: footerY - 2 },
    thickness: 0.8,
    color: cLine,
  });
  page.drawText("Thank you for your partnership!", {
    x: margin,
    y: footerY - 16,
    size: 8.5,
    font: fontBold,
    color: cTextPrimary,
  });

  // Bottom-Right Corner Artwork
  page.drawSvgPath("M 48 155 L 138 0 L 154 0 L 64 155 Z", { x: W - 170, y: 155, color: cSlate });
  page.drawSvgPath("M 64 155 L 154 0 L 170 0 L 170 32 L 90 155 Z", { x: W - 170, y: 155, color: cDarkTeal });
  page.drawSvgPath("M 90 155 L 170 32 L 170 155 Z", { x: W - 170, y: 155, color: cTeal });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
