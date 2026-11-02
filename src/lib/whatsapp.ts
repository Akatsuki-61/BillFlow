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
