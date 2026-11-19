import type { Currency, InvoiceStatus, InvoiceWithClient } from "../types/billing";
import { localDateKey } from "./visual-metrics";

export interface DuplicateInvoiceLineDraft {
  id: string;
  catalogId?: string;
  description: string;
  quantity: number;
  unitPrice: string;
}

export interface DuplicateInvoiceDraft {
  clientMode: "existing" | "new";
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientContact: string;
  clientPhone: string;
  clientWhatsApp: string;
  clientCategory: string;
  saveAsPermanentClient: boolean;
  currency: Currency;
  dueDate: string;
  status: InvoiceStatus;
  items: DuplicateInvoiceLineDraft[];
  discount: string;
  taxRate: string;
  requireAdvance: boolean;
  advancePercent: number;
  deliveryUrl: string;
  paymentUrl: string;
  notes: string;
}

/**
 * Builds clean draft form values for duplicating an existing invoice without
 * losing client contact channels, catalog links, or pre-discount pricing.
 */
export function buildDuplicateInvoiceDraft(
  inv: InvoiceWithClient,
  activeClients: readonly { id: string; archivedAt?: string | null }[],
  defaultDueDays = 14,
  now = new Date(),
): DuplicateInvoiceDraft {
  const hasActiveClient = Boolean(
    inv.clientId &&
      activeClients.some((c) => c.id === inv.clientId && !c.archivedAt),
  );

  const due = new Date(now.getTime());
  due.setDate(due.getDate() + defaultDueDays);
  const dueDate = localDateKey(due);

  const discountCents = inv.discountCents ?? 0;
  const taxCents = inv.taxCents ?? 0;
  const advanceCents = inv.advanceCents ?? 0;

  let items: DuplicateInvoiceLineDraft[];
  if (inv.items && inv.items.length > 0) {
    items = inv.items.map((item, idx) => ({
      id: `${now.getTime()}-${idx}`,
      ...(item.catalogId ? { catalogId: item.catalogId } : {}),
      description: item.description,
      quantity: item.quantity || 1,
      unitPrice: ((item.unitPriceCents || 0) / 100).toFixed(2),
    }));
  } else {
    // Reconstruct pre-discount, pre-tax subtotal so discount/tax aren't applied twice
    const grossSubtotalCents = Math.max(
      0,
      (inv.amountCents || 0) - taxCents + discountCents,
    );
    items = [
      {
        id: "1",
        description: inv.title || "Freelance services",
        quantity: 1,
        unitPrice: (grossSubtotalCents / 100).toFixed(2),
      },
    ];
  }

  const subtotalCents = items.reduce(
    (sum, it) =>
      sum +
      Math.round(parseFloat(it.unitPrice || "0") * 100) * (it.quantity || 1),
    0,
  );
  const netBeforeTax = Math.max(0, subtotalCents - discountCents);

  const hasAdvance = advanceCents > 0 && inv.amountCents > 0;
  const advancePercent = hasAdvance
    ? Math.min(100, Math.max(1, Math.round((advanceCents / inv.amountCents) * 100)))
    : 50;

  return {
    clientMode: hasActiveClient ? "existing" : "new",
    clientId: hasActiveClient ? inv.clientId! : "",
    clientName: hasActiveClient ? "" : inv.clientName || "",
    clientEmail: hasActiveClient ? "" : inv.clientEmail || "",
    clientContact: hasActiveClient ? "" : inv.clientContactPerson || "",
    clientPhone: hasActiveClient ? "" : inv.clientPhone || "",
    clientWhatsApp: hasActiveClient ? "" : inv.clientWhatsAppPhone || "",
    clientCategory: hasActiveClient
      ? "Enterprise"
      : inv.clientCategory || "Enterprise",
    saveAsPermanentClient: hasActiveClient,
    currency: inv.currency,
    dueDate,
    status: "DRAFT",
    items,
    discount: discountCents > 0 ? (discountCents / 100).toFixed(2) : "",
    taxRate:
      taxCents > 0 && netBeforeTax > 0
        ? String(Math.round((taxCents / netBeforeTax) * 1000) / 10)
        : "",
    requireAdvance: hasAdvance,
    advancePercent,
    deliveryUrl: inv.deliveryUrl || "",
    paymentUrl: inv.paymentUrl || "",
    notes: inv.notes || "",
  };
}
