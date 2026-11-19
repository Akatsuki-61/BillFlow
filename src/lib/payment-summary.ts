import type { InvoiceWithClient } from "../types/billing";
import type { WorkOrderItem } from "../types/outsourcing";
import type { AppSettings } from "../types/settings";
import type { TaskStatus } from "../types/tasks";
import { formatCents } from "./format";

export function formatInvoicePaymentSummary(
  invoice: InvoiceWithClient,
  settings?: AppSettings | null,
): string {
  const paidCents = invoice.paidCents ?? 0;
  const remainingCents = Math.max(0, invoice.amountCents - paidCents);
  const lines = [
    `Invoice: ${invoice.code}`,
    `Client: ${invoice.clientName}`,
    `Total: ${formatCents(invoice.amountCents, invoice.currency)}`,
  ];

  const advanceCents = invoice.advanceCents ?? 0;
  if (advanceCents > 0) {
    lines.push(
      `Advance Required: ${formatCents(advanceCents, invoice.currency)}`,
    );
  }
  lines.push(`Paid: ${formatCents(paidCents, invoice.currency)}`);
  lines.push(
    `Remaining Balance: ${formatCents(remainingCents, invoice.currency)}`,
  );

  if (invoice.dueDate) {
    lines.push(`Due Date: ${invoice.dueDate.slice(0, 10)}`);
  }
  if (invoice.paymentUrl) {
    lines.push(`Pay Online: ${invoice.paymentUrl}`);
  }
  if (settings?.paymentDetails?.trim()) {
    lines.push(`Payment Details: ${settings.paymentDetails.trim()}`);
  }
  if (settings?.businessName?.trim()) {
    lines.push(`From: ${settings.businessName.trim()}`);
  }

  return lines.join("\n");
}

export function formatWorkOrderPaymentSummary(
  order: WorkOrderItem,
  settings?: AppSettings | null,
): string {
  const voucherCode = `VND-INV-${order.id.slice(-8).toUpperCase()}`;
  const paidCents = order.payoutAmountCents ?? 0;
  const remainingCents =
    order.remainingPayoutCents ?? Math.max(0, order.feeCents - paidCents);
  const lines = [
    `Work Order: ${voucherCode}`,
    `Contractor: ${order.vendorName || "Contractor"}`,
    `Scope: ${order.scope}`,
    `Agreed Fee: ${formatCents(order.feeCents, order.currency)}`,
    `Paid: ${formatCents(paidCents, order.currency)}`,
    `Remaining Payout: ${formatCents(remainingCents, order.currency)}`,
  ];

  if (order.payoutDueDate) {
    lines.push(`Payout Due: ${order.payoutDueDate.slice(0, 10)}`);
  }
  if (order.deliveryUrl) {
    lines.push(`Delivery Link: ${order.deliveryUrl}`);
  }
  if (settings?.businessName?.trim()) {
    lines.push(`Issued By: ${settings.businessName.trim()}`);
  }

  return lines.join("\n");
}

export function nextTaskStage(
  status: TaskStatus,
): { next: TaskStatus; label: string } | null {
  switch (status) {
    case "todo":
      return { next: "in-progress", label: "Start" };
    case "in-progress":
      return { next: "review", label: "Review" };
    case "review":
      return { next: "done", label: "Complete" };
    default:
      return null;
  }
}
