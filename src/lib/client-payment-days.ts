import type { InvoiceWithClient } from "../types/billing";

export function daysToFullPayment(invoice: InvoiceWithClient): number | null {
  if (
    invoice.status === "DRAFT" ||
    invoice.trashedAt ||
    invoice.amountCents <= 0 ||
    invoice.paidCents < invoice.amountCents
  )
    return null;
  const issue = Date.parse(invoice.issueDate.slice(0, 10));
  if (!Number.isFinite(issue)) return null;
  const payments = (invoice.payments ?? [])
    .filter(
      (payment) => !payment.correction && payment.currency === invoice.currency,
    )
    .sort((a, b) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt));
  let received = 0;
  for (const payment of payments) {
    const date = Date.parse(payment.receivedAt.slice(0, 10));
    if (!Number.isFinite(date)) continue;
    received += payment.amountCents;
    if (received >= invoice.amountCents)
      return Math.max(0, (date - issue) / 86_400_000);
  }
  return null;
}
