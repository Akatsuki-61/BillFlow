import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";
import {
  buildInvoiceHtmlGeometricTeal,
  buildInvoiceHtmlExecutiveWave,
  buildInvoiceHtmlScarletModern,
  buildInvoiceHtmlApexOrange,
  InvoicePdfPayload,
  InvoicePdfItem,
  formatMoney,
  escapeHtml,
  getBase64Logo,
  resolveBrandIcon,
} from "./pdf-templates";

export type { InvoicePdfPayload, InvoicePdfItem };
export {
  buildInvoiceHtmlGeometricTeal,
  buildInvoiceHtmlExecutiveWave,
  buildInvoiceHtmlScarletModern,
  buildInvoiceHtmlApexOrange,
};

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

export function buildInvoiceHtml(data: InvoicePdfPayload): string {
  if (data.template === "executive-wave") {
    return buildInvoiceHtmlExecutiveWave(data);
  }
  if (data.template === "scarlet-modern") {
    return buildInvoiceHtmlScarletModern(data);
  }
  if (data.template === "apex-orange") {
    return buildInvoiceHtmlApexOrange(data);
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
    page.drawText(label, { x: rightX - 138, y: metaY, size: 8.5, font: fontBold, color: cTextPrimary });
    const tw = fontRegular.widthOfTextAtSize(val, 8.5);
    page.drawText(val, { x: rightX - tw, y: metaY, size: 8.5, font: fontRegular, color: cTextPrimary });
    metaY -= 13;
  };

  drawMetaRow("Invoice No.:", data.code);
  drawMetaRow("Date:", data.issueDate);
  if (data.dueDate) drawMetaRow("Due Date:", data.dueDate);

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
  page.drawText("No.", { x: colX.num, y, size: 9, font: fontBold, color: cTeal });
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
  page.drawText("No.", { x: margin + 4, y, size: 9, font: fontBold, color: cTeal });
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
