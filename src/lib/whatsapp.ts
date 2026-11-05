import type { WorkOrderItem } from "@/types/outsourcing";
import { formatCents } from "@/lib/format";

export interface WhatsAppTaskPayload {
  contractorName: string;
  contractorPhone: string;
  taskTitle: string;
  scope: string;
  feeFormatted: string;
  dueDate?: string | null;
  deliveryUrl?: string | null;
  invoiceCode?: string;
  clientName?: string;
  voucherNumber: string;
  freelancerName?: string;
}

export interface WhatsAppInvoicePayload {
  clientName: string;
  clientPhone?: string | null;
  invoiceCode: string;
  totalFormatted: string;
  advanceFormatted?: string | null;
  balanceFormatted: string;
  dueDate?: string | null;
  deliveryUrl?: string | null;
  paymentDetails?: string | null;
  businessName?: string;
}

/**
 * Normalizes phone numbers to standard E.164 digits for WhatsApp links.
 * Strips out spaces, dashes, parentheses, and leading plus sign.
 */
export function normalizeWhatsAppPhone(phone?: string | null): string {
  if (!phone) return "";
  const cleaned = phone.replace(/[^0-9]/g, "");
  // If Sri Lanka local number starts with 0 (e.g. 0771234567), map to 94771234567
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    return `94${cleaned.slice(1)}`;
  }
  return cleaned;
}

/**
 * Builds a friendly, structured delegation brief for the contractor.
 */
export function buildContractorWhatsAppMessage(data: WhatsAppTaskPayload): string {
  const parts: string[] = [];

  parts.push(`Hi ${data.contractorName.trim()}, here are the details for your assigned deliverable:`);
  parts.push("");
  parts.push(`📋 *Deliverable:* ${data.taskTitle || data.scope}`);
  parts.push(`📝 *Scope of Work:* ${data.scope}`);
  parts.push(`💰 *Agreed Fee:* ${data.feeFormatted}`);

  if (data.dueDate) {
    parts.push(`📅 *Target Deadline:* ${data.dueDate}`);
  }

  if (data.deliveryUrl) {
    parts.push(`🔗 *Deliverable URL / Repository:* ${data.deliveryUrl}`);
  }

  if (data.invoiceCode) {
    parts.push(`🔖 *Reference:* Voucher #${data.voucherNumber} (Project ${data.invoiceCode}${data.clientName ? ` · ${data.clientName}` : ""})`);
  } else {
    parts.push(`🔖 *Reference:* Voucher #${data.voucherNumber}`);
  }

  parts.push("");
  parts.push("Please review the scope and reply to confirm. Let me know if you need any additional specifications!");
  if (data.freelancerName) {
    parts.push(`— ${data.freelancerName}`);
  }

  return parts.join("\n");
}

/**
 * Generates an official `https://wa.me/<phone>?text=<encoded>` link.
 * If phone number is empty, generates `https://wa.me/?text=<encoded>` to let user select contact in WhatsApp.
 */
export function generateWhatsAppLink(data: WhatsAppTaskPayload): string {
  const phone = normalizeWhatsAppPhone(data.contractorPhone);
  const message = buildContractorWhatsAppMessage(data);
  const encoded = encodeURIComponent(message);
  return phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

/**
 * Builds a professional invoice delivery message for client via WhatsApp.
 */
export function buildInvoiceWhatsAppMessage(data: WhatsAppInvoicePayload): string {
  const parts: string[] = [];
  parts.push(`Hi ${data.clientName.trim()}, here is your invoice summary:`);
  parts.push("");
  parts.push(`📄 *Invoice Ref:* ${data.invoiceCode}`);
  parts.push(`💰 *Total Amount:* ${data.totalFormatted}`);
  if (data.advanceFormatted) {
    parts.push(`💳 *Required Advance:* ${data.advanceFormatted}`);
  }
  parts.push(`⚖️ *Balance Due:* ${data.balanceFormatted}`);
  if (data.dueDate) {
    parts.push(`📅 *Due Date:* ${data.dueDate}`);
  }
  if (data.deliveryUrl) {
    parts.push(`🔗 *Project Workspace / Delivery Link:* ${data.deliveryUrl}`);
  }
  if (data.paymentDetails) {
    parts.push("");
    parts.push(`🏦 *Payment Instructions:*`);
    parts.push(data.paymentDetails);
  }
  parts.push("");
  parts.push("Thank you for your business! Please reply or share the payment confirmation once transferred.");
  if (data.businessName) {
    parts.push(`— ${data.businessName}`);
  }
  return parts.join("\n");
}

/**
 * Generates a WhatsApp sharing link for an invoice.
 */
export function generateInvoiceWhatsAppLink(data: WhatsAppInvoicePayload): string {
  const phone = normalizeWhatsAppPhone(data.clientPhone);
  const message = buildInvoiceWhatsAppMessage(data);
  const encoded = encodeURIComponent(message);
  return phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

/**
 * Generates an email `mailto:` link for sharing an invoice with pre-filled subject and body.
 */
export function generateInvoiceEmailLink(data: {
  clientEmail?: string | null;
  clientName: string;
  invoiceCode: string;
  totalFormatted: string;
  advanceFormatted?: string | null;
  balanceFormatted: string;
  dueDate?: string | null;
  deliveryUrl?: string | null;
  paymentDetails?: string | null;
  businessName?: string;
}): string {
  const subject = encodeURIComponent(`Invoice ${data.invoiceCode} from ${data.businessName || "BillFlow"}`);
  const lines: string[] = [
    `Hi ${data.clientName},`,
    "",
    `Here is the summary for invoice ${data.invoiceCode}:`,
    "",
    `Total Amount: ${data.totalFormatted}`,
  ];
  if (data.advanceFormatted) {
    lines.push(`Required Advance: ${data.advanceFormatted}`);
  }
  lines.push(`Balance Due: ${data.balanceFormatted}`);
  if (data.dueDate) {
    lines.push(`Due Date: ${data.dueDate}`);
  }
  if (data.deliveryUrl) {
    lines.push(`Project Workspace / Delivery Link: ${data.deliveryUrl}`);
  }
  if (data.paymentDetails) {
    lines.push("");
    lines.push("Payment Instructions:");
    lines.push(data.paymentDetails);
  }
  lines.push("");
  lines.push("Thank you for your business!");
  if (data.businessName) {
    lines.push(`— ${data.businessName}`);
  }

  const body = encodeURIComponent(lines.join("\n"));
  return `mailto:${data.clientEmail || ""}?subject=${subject}&body=${body}`;
}

/**
 * Helper to construct WhatsApp task payload directly from a WorkOrderItem and optional freelancer name.
 */
export function createWhatsAppPayloadFromWorkOrder(
  wo: WorkOrderItem,
  freelancerName?: string,
): WhatsAppTaskPayload {
  return {
    contractorName: wo.vendorName || "Contractor",
    contractorPhone: wo.vendorPhone || "",
    taskTitle: wo.taskTitle || wo.scope,
    scope: wo.scope,
    feeFormatted: formatCents(wo.feeCents, wo.currency),
    dueDate: wo.dueDate,
    deliveryUrl: wo.deliveryUrl,
    invoiceCode: wo.invoiceCode,
    clientName: wo.clientName,
    voucherNumber: wo.id.slice(-8).toUpperCase(),
    freelancerName,
  };
}
