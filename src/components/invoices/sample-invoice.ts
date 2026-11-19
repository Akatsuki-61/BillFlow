import type { Currency, InvoiceWithClient } from "@/types/billing";
import type { AppSettings } from "@/types/settings";

export function buildSampleInvoice(
  settings?: AppSettings | null,
): InvoiceWithClient {
  return {
    id: "sample-preview",
    code: "INV-2026-001",
    clientName: "Acme Cloud Corp",
    clientEmail: "billing@acmecloud.com",
    clientId: null,
    currency: (settings?.defaultCurrency as Currency) || "USD",
    status: "ADVANCE_PAID",
    issueDate: new Date().toISOString(),
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString(),
    amountCents: 9000000,
    advanceCents: 4500000,
    paidCents: 4500000,
    taxCents: 0,
    discountCents: 1000000,
    notes:
      "Milestone 1 (Website staging) begins upon advance receipt. Full code and deployment upon final settlement.",
    deliveryUrl: "https://github.com/acme-cloud/web-platform",
    items: [
      {
        id: "it-1",
        invoiceId: "sample-preview",
        description: "Business Website Development & Integration",
        quantity: 1,
        unitPriceCents: 8000000,
        position: 0,
      },
      {
        id: "it-2",
        invoiceId: "sample-preview",
        description: "AI Consulting Session & Support Automation Roadmap",
        quantity: 1,
        unitPriceCents: 2000000,
        position: 1,
      },
    ],
    payments: [
      {
        id: "pay-1",
        invoiceId: "sample-preview",
        amountCents: 4500000,
        currency: (settings?.defaultCurrency as Currency) || "USD",
        receivedAt: new Date().toISOString(),
        reference: "50% upfront project deposit",
        requestId: "req-1",
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
