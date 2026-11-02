import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

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
  const symbol = currency === "LKR" ? "Rs. " : currency === "EUR" ? "€" : currency === "GBP" ? "£" : currency === "CAD" ? "CA$" : "$";
  const val = (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${symbol}${val}`;
}

export async function generateInvoicePdfBuffer(data: InvoicePdfPayload): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const margin = 40;
  const contentWidth = width - margin * 2;

  const colorPrimary = rgb(0.08, 0.1, 0.15);
  const colorSecondary = rgb(0.4, 0.45, 0.53);
  const colorLine = rgb(0.88, 0.9, 0.94);
  const colorAccent = rgb(0.35, 0.3, 0.85);
  const colorBgHeader = rgb(0.96, 0.97, 0.98);

  let y = height - margin;

  // 1. Header (Brand Name & INVOICE label)
  const businessName = data.business.businessName || "BillFlow Workspace";
  page.drawText(businessName.toUpperCase(), {
    x: margin,
    y: y - 16,
    size: 16,
    font: fontBold,
    color: colorAccent,
  });

  if (data.business.professionalTitle) {
    page.drawText(data.business.professionalTitle, {
      x: margin,
      y: y - 30,
      size: 9,
      font: fontRegular,
      color: colorSecondary,
    });
  }

  page.drawText("INVOICE", {
    x: width - margin - 110,
    y: y - 16,
    size: 20,
    font: fontBold,
    color: colorPrimary,
  });

  const statusText = data.status.replace("_", " ");
  page.drawText(`STATUS: ${statusText}`, {
    x: width - margin - 110,
    y: y - 30,
    size: 9,
    font: fontBold,
    color: data.status === "PAID" ? rgb(0.05, 0.58, 0.38) : data.status === "ADVANCE_PAID" ? rgb(0.15, 0.45, 0.85) : colorSecondary,
  });

  y -= 52;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: colorLine,
  });

  y -= 20;

  // 2. Business Details (Left) & Invoice Meta (Right)
  const metaLeft = margin;
  let bY = y;

  page.drawText("ISSUED BY:", { x: metaLeft, y: bY, size: 8, font: fontBold, color: colorSecondary });
  bY -= 12;
  if (data.business.email) {
    page.drawText(data.business.email, { x: metaLeft, y: bY, size: 9, font: fontRegular, color: colorPrimary });
    bY -= 12;
  }
  if (data.business.phone) {
    page.drawText(data.business.phone, { x: metaLeft, y: bY, size: 9, font: fontRegular, color: colorPrimary });
    bY -= 12;
  }
  if (data.business.address) {
    page.drawText(data.business.address, { x: metaLeft, y: bY, size: 9, font: fontRegular, color: colorPrimary });
    bY -= 12;
  }
  if (data.business.taxId) {
    page.drawText(`Tax ID / Reg: ${data.business.taxId}`, { x: metaLeft, y: bY, size: 8, font: fontRegular, color: colorSecondary });
    bY -= 12;
  }

  // Invoice Meta right column
  const metaRight = width - margin - 160;
  let mY = y;
  const drawMetaRow = (label: string, val: string) => {
    page.drawText(label, { x: metaRight, y: mY, size: 8.5, font: fontBold, color: colorSecondary });
    page.drawText(val, { x: metaRight + 75, y: mY, size: 8.5, font: fontBold, color: colorPrimary });
    mY -= 13;
  };

  drawMetaRow("Invoice No:", data.code);
  drawMetaRow("Issue Date:", data.issueDate);
  if (data.dueDate) drawMetaRow("Due Date:", data.dueDate);
  drawMetaRow("Currency:", data.currency);

  y = Math.min(bY, mY) - 10;

  // 3. Client Box (Bill To)
  page.drawRectangle({
    x: margin,
    y: y - 50,
    width: contentWidth,
    height: 52,
    color: colorBgHeader,
    borderColor: colorLine,
    borderWidth: 1,
  });

  page.drawText("BILLED TO:", { x: margin + 12, y: y - 14, size: 8, font: fontBold, color: colorSecondary });
  page.drawText(data.client.name, { x: margin + 12, y: y - 28, size: 11, font: fontBold, color: colorPrimary });
  const clientSub = [data.client.contactPerson, data.client.email, data.client.phone].filter(Boolean).join("  |  ");
  if (clientSub) {
    page.drawText(clientSub, { x: margin + 12, y: y - 42, size: 8.5, font: fontRegular, color: colorSecondary });
  }

  y -= 66;

  // 4. Line Items Table Header
  const colX = {
    num: margin + 10,
    desc: margin + 35,
    qty: width - margin - 190,
    price: width - margin - 120,
    total: width - margin - 45,
  };

  page.drawRectangle({
    x: margin,
    y: y - 18,
    width: contentWidth,
    height: 22,
    color: rgb(0.92, 0.94, 0.98),
  });

  page.drawText("#", { x: colX.num, y: y - 12, size: 8.5, font: fontBold, color: colorPrimary });
  page.drawText("SERVICE / DELIVERABLE DESCRIPTION", { x: colX.desc, y: y - 12, size: 8.5, font: fontBold, color: colorPrimary });
  page.drawText("QTY", { x: colX.qty, y: y - 12, size: 8.5, font: fontBold, color: colorPrimary });
  page.drawText("UNIT PRICE", { x: colX.price, y: y - 12, size: 8.5, font: fontBold, color: colorPrimary });
  page.drawText("AMOUNT", { x: colX.total, y: y - 12, size: 8.5, font: fontBold, color: colorPrimary });

  y -= 24;

  // Line items rows
  const items = data.items.length > 0 ? data.items : [{ description: "Professional Services", quantity: 1, unitPriceCents: data.amountCents }];
  let subtotalCents = 0;

  items.forEach((item, index) => {
    const lineTotal = item.quantity * item.unitPriceCents;
    subtotalCents += lineTotal;

    const rowBg = index % 2 === 1 ? rgb(0.98, 0.98, 0.99) : rgb(1, 1, 1);
    page.drawRectangle({
      x: margin,
      y: y - 16,
      width: contentWidth,
      height: 20,
      color: rowBg,
    });

    page.drawText(String(index + 1), { x: colX.num, y: y - 11, size: 8.5, font: fontRegular, color: colorSecondary });
    page.drawText(item.description.slice(0, 55), { x: colX.desc, y: y - 11, size: 8.5, font: fontRegular, color: colorPrimary });
    page.drawText(String(item.quantity), { x: colX.qty, y: y - 11, size: 8.5, font: fontRegular, color: colorPrimary });
    page.drawText(formatMoney(item.unitPriceCents, data.currency), { x: colX.price, y: y - 11, size: 8.5, font: fontRegular, color: colorPrimary });
    page.drawText(formatMoney(lineTotal, data.currency), { x: colX.total, y: y - 11, size: 8.5, font: fontBold, color: colorPrimary });

    y -= 20;
  });

  page.drawLine({
    start: { x: margin, y: y + 2 },
    end: { x: width - margin, y: y + 2 },
    thickness: 1,
    color: colorLine,
  });

  y -= 12;

  // 5. Totals & Advance Requirements Block
  const totalsX = width - margin - 220;
  const totalsValX = width - margin;

  const drawTotalRow = (label: string, cents: number, isBold = false, isAccent = false, isNegative = false) => {
    const labelFont = isBold ? fontBold : fontRegular;
    const labelColor = isAccent ? colorAccent : isBold ? colorPrimary : colorSecondary;
    page.drawText(label, { x: totalsX, y, size: 9, font: labelFont, color: labelColor });
    const textVal = `${isNegative ? "-" : ""}${formatMoney(cents, data.currency)}`;
    const textWidth = labelFont.widthOfTextAtSize(textVal, 9);
    page.drawText(textVal, { x: totalsValX - textWidth, y, size: 9, font: labelFont, color: labelColor });
    y -= 15;
  };

  drawTotalRow("Subtotal:", subtotalCents);
  if (data.discountCents && data.discountCents > 0) {
    drawTotalRow("Discount:", data.discountCents, false, false, true);
  }
  if (data.taxCents && data.taxCents > 0) {
    drawTotalRow("Tax:", data.taxCents);
  }

  y -= 2;
  page.drawLine({
    start: { x: totalsX, y: y + 8 },
    end: { x: width - margin, y: y + 8 },
    thickness: 1,
    color: colorLine,
  });

  drawTotalRow("Total Amount:", data.amountCents, true, false);

  if (data.advanceCents && data.advanceCents > 0) {
    drawTotalRow("Required Advance (50%):", data.advanceCents, true, true);
  }

  const paidCents = data.paidCents || 0;
  if (paidCents > 0) {
    drawTotalRow("Amount Paid:", paidCents, false);
  }
  const remainingDue = Math.max(0, data.amountCents - paidCents);
  drawTotalRow("Balance Due:", remainingDue, true);

  y -= 15;

  // 6. Payment Instructions & Bank Details Box
  if (data.business.paymentDetails) {
    page.drawRectangle({
      x: margin,
      y: y - 56,
      width: contentWidth,
      height: 56,
      color: colorBgHeader,
      borderColor: colorLine,
      borderWidth: 1,
    });

    page.drawText("PAYMENT INSTRUCTIONS & BANK DETAILS", {
      x: margin + 12,
      y: y - 16,
      size: 8,
      font: fontBold,
      color: colorSecondary,
    });

    const lines = data.business.paymentDetails.split("\n").slice(0, 2);
    let pY = y - 30;
    lines.forEach((line) => {
      page.drawText(line.slice(0, 100), { x: margin + 12, y: pY, size: 8.5, font: fontRegular, color: colorPrimary });
      pY -= 12;
    });

    y -= 72;
  }

  // 7. Delivery Link & Notes
  const delivery = data.deliveryUrl || data.client.driveUrl;
  if (delivery || data.notes) {
    if (delivery) {
      page.drawText("Project Delivery Destination:", { x: margin, y, size: 8.5, font: fontBold, color: colorSecondary });
      page.drawText(delivery.slice(0, 80), { x: margin + 130, y, size: 8.5, font: fontRegular, color: colorAccent });
      y -= 14;
    }
    if (data.notes) {
      page.drawText("Notes:", { x: margin, y, size: 8.5, font: fontBold, color: colorSecondary });
      page.drawText(data.notes.slice(0, 90), { x: margin + 40, y, size: 8.5, font: fontRegular, color: colorPrimary });
      y -= 14;
    }
  }

  // 8. Footer
  const footerY = margin + 12;
  page.drawLine({
    start: { x: margin, y: footerY + 12 },
    end: { x: width - margin, y: footerY + 12 },
    thickness: 0.5,
    color: colorLine,
  });

  page.drawText("Generated by BillFlow · Thank you for your business!", {
    x: margin,
    y: footerY,
    size: 7.5,
    font: fontRegular,
    color: colorSecondary,
  });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

export async function generateWorkOrderPdfBuffer(data: WorkOrderPdfPayload): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const margin = 40;
  const contentWidth = width - margin * 2;

  const colorPrimary = rgb(0.08, 0.1, 0.15);
  const colorSecondary = rgb(0.4, 0.45, 0.53);
  const colorLine = rgb(0.88, 0.9, 0.94);
  const colorAccent = rgb(0.35, 0.3, 0.85);
  const colorBgHeader = rgb(0.96, 0.97, 0.98);

  let y = height - margin;

  // 1. Header (Brand Name & WORK ORDER / PAYABLE VOUCHER label)
  const businessName = data.business.businessName || "BillFlow Workspace";
  page.drawText(businessName.toUpperCase(), {
    x: margin,
    y: y - 16,
    size: 16,
    font: fontBold,
    color: colorAccent,
  });

  if (data.business.professionalTitle) {
    page.drawText(data.business.professionalTitle, {
      x: margin,
      y: y - 30,
      size: 9,
      font: fontRegular,
      color: colorSecondary,
    });
  }

  const voucherTitle = "WORK ORDER VOUCHER";
  const voucherTitleWidth = fontBold.widthOfTextAtSize(voucherTitle, 16);
  page.drawText(voucherTitle, {
    x: width - margin - voucherTitleWidth,
    y: y - 16,
    size: 16,
    font: fontBold,
    color: colorPrimary,
  });

  const voucherNumText = `#${data.voucherNumber}`;
  const voucherNumWidth = fontBold.widthOfTextAtSize(voucherNumText, 11);
  page.drawText(voucherNumText, {
    x: width - margin - voucherNumWidth,
    y: y - 32,
    size: 11,
    font: fontBold,
    color: colorAccent,
  });

  y -= 48;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: colorLine,
  });

  y -= 20;

  // 2. Metadata Columns: Contractor details (Left) & Voucher Metadata (Right)
  const colLeftX = margin;
  const colRightX = width / 2 + 10;

  // Left: Assigned Subcontractor
  page.drawText("ASSIGNED SUBCONTRACTOR", { x: colLeftX, y, size: 8, font: fontBold, color: colorSecondary });
  let leftY = y - 14;
  page.drawText(data.vendor.name, { x: colLeftX, y: leftY, size: 11, font: fontBold, color: colorPrimary });
  leftY -= 14;

  if (data.vendor.service) {
    page.drawText(`Specialty: ${data.vendor.service}`, { x: colLeftX, y: leftY, size: 8.5, font: fontRegular, color: colorSecondary });
    leftY -= 12;
  }
  if (data.vendor.email) {
    page.drawText(`Email: ${data.vendor.email}`, { x: colLeftX, y: leftY, size: 8.5, font: fontRegular, color: colorSecondary });
    leftY -= 12;
  }
  if (data.vendor.phone) {
    page.drawText(`Phone / WhatsApp: ${data.vendor.phone}`, { x: colLeftX, y: leftY, size: 8.5, font: fontRegular, color: colorSecondary });
    leftY -= 12;
  }

  // Right: Voucher & Job Information
  page.drawText("JOB & VOUCHER DETAILS", { x: colRightX, y, size: 8, font: fontBold, color: colorSecondary });
  let rightY = y - 14;

  const drawField = (label: string, val: string, isAccent = false) => {
    page.drawText(label, { x: colRightX, y: rightY, size: 8.5, font: fontRegular, color: colorSecondary });
    page.drawText(val, { x: colRightX + 110, y: rightY, size: 8.5, font: fontBold, color: isAccent ? colorAccent : colorPrimary });
    rightY -= 14;
  };

  if (data.dueDate) drawField("Agreed Deadline:", data.dueDate);
  drawField("Work Status:", data.status.toUpperCase(), data.status === "done");
  drawField("Payout Settlement:", data.payoutStatus.toUpperCase(), data.payoutStatus === "PAID");
  if (data.paidAt) drawField("Settled On:", new Date(data.paidAt).toLocaleDateString());

  if (data.parentInvoice?.code) {
    drawField("Parent Invoice:", `${data.parentInvoice.code}${data.parentInvoice.clientName ? ` (${data.parentInvoice.clientName})` : ""}`);
  }
  if (data.task?.title) {
    drawField("Linked Sprint Task:", data.task.title.slice(0, 32));
  }

  y = Math.min(leftY, rightY) - 20;

  // 3. Deliverable Scope Table
  page.drawRectangle({
    x: margin,
    y: y - 18,
    width: contentWidth,
    height: 22,
    color: rgb(0.92, 0.94, 0.98),
  });

  page.drawText("#", { x: margin + 8, y: y - 12, size: 8.5, font: fontBold, color: colorPrimary });
  page.drawText("AGREED DELIVERABLE SCOPE & SPECIFICATIONS", { x: margin + 30, y: y - 12, size: 8.5, font: fontBold, color: colorPrimary });
  page.drawText("CONTRACTOR FEE", { x: width - margin - 100, y: y - 12, size: 8.5, font: fontBold, color: colorPrimary });

  y -= 24;

  // Deliverable row
  page.drawRectangle({
    x: margin,
    y: y - 24,
    width: contentWidth,
    height: 28,
    color: rgb(0.98, 0.98, 0.99),
  });

  page.drawText("1", { x: margin + 8, y: y - 14, size: 9, font: fontRegular, color: colorSecondary });
  page.drawText(data.scope.slice(0, 68), { x: margin + 30, y: y - 14, size: 9.5, font: fontBold, color: colorPrimary });
  const feeFormatted = formatMoney(data.feeCents, data.currency);
  page.drawText(feeFormatted, { x: width - margin - 100, y: y - 14, size: 10, font: fontBold, color: colorAccent });

  y -= 36;

  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: colorLine,
  });

  y -= 16;

  // 4. Totals Block
  const totalsX = width - margin - 220;
  const totalsValX = width - margin;

  const drawTotalRow = (label: string, textVal: string, isBold = false, isAccent = false) => {
    const labelFont = isBold ? fontBold : fontRegular;
    const labelColor = isAccent ? colorAccent : isBold ? colorPrimary : colorSecondary;
    page.drawText(label, { x: totalsX, y, size: 9.5, font: labelFont, color: labelColor });
    const textWidth = labelFont.widthOfTextAtSize(textVal, 9.5);
    page.drawText(textVal, { x: totalsValX - textWidth, y, size: 9.5, font: labelFont, color: labelColor });
    y -= 16;
  };

  drawTotalRow("Total Contractor Fee:", feeFormatted, true);
  drawTotalRow("Disbursement Status:", data.payoutStatus === "PAID" ? "Settled / Paid" : "Pending Approval", true, data.payoutStatus === "PAID");

  y -= 12;

  // 5. Deliverable Links & Review Notes Box
  if (data.deliveryUrl || data.notes) {
    page.drawRectangle({
      x: margin,
      y: y - 56,
      width: contentWidth,
      height: 56,
      color: colorBgHeader,
      borderColor: colorLine,
      borderWidth: 1,
    });

    let boxY = y - 16;
    if (data.deliveryUrl) {
      page.drawText("Deliverable Repository / Staging URL:", { x: margin + 12, y: boxY, size: 8, font: fontBold, color: colorSecondary });
      page.drawText(data.deliveryUrl.slice(0, 75), { x: margin + 175, y: boxY, size: 8.5, font: fontRegular, color: colorAccent });
      boxY -= 16;
    }
    if (data.notes) {
      page.drawText("Contractor Handover Notes:", { x: margin + 12, y: boxY, size: 8, font: fontBold, color: colorSecondary });
      page.drawText(data.notes.slice(0, 80), { x: margin + 145, y: boxY, size: 8.5, font: fontRegular, color: colorPrimary });
    }

    y -= 72;
  }

  // 6. Freelancer Business Contact Info
  if (data.business.email || data.business.phone || data.business.address) {
    page.drawText("ISSUED BY", { x: margin, y, size: 8, font: fontBold, color: colorSecondary });
    y -= 12;
    const businessLine = [
      data.business.businessName,
      data.business.email,
      data.business.phone,
    ].filter(Boolean).join(" · ");
    page.drawText(businessLine.slice(0, 95), { x: margin, y, size: 8.5, font: fontRegular, color: colorSecondary });
    y -= 16;
  }

  // 7. Footer
  const footerY = margin + 12;
  page.drawLine({
    start: { x: margin, y: footerY + 12 },
    end: { x: width - margin, y: footerY + 12 },
    thickness: 0.5,
    color: colorLine,
  });

  page.drawText("Generated by BillFlow · Outsourcing & Subcontractor Management", {
    x: margin,
    y: footerY,
    size: 7.5,
    font: fontRegular,
    color: colorSecondary,
  });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
