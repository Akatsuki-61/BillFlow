import { describe, expect, it } from "vitest";
import { buildDuplicateInvoiceDraft } from "../invoice-duplicate";
import type { InvoiceWithClient } from "../../types/billing";

function baseInvoice(
  overrides: Partial<InvoiceWithClient> = {},
): InvoiceWithClient {
  return {
    id: "inv-1",
    code: "INV-2026-001",
    clientId: "client-1",
    clientName: "Northwind Studio",
    clientEmail: "billing@northwind.test",
    clientPhone: "+14155550100",
    clientWhatsAppPhone: "+14155550199",
    clientBillingAddress: "100 Main St",
    clientContactPerson: "Alex Mercer",
    clientCategory: "Enterprise",
    amountCents: 110000,
    discountCents: 10000,
    taxCents: 20000,
    advanceCents: 55000,
    currency: "USD",
    issueDate: "2026-10-01",
    dueDate: "2026-10-15",
    status: "PAID",
    paidCents: 110000,
    deliveryUrl: "https://drive.google.com/drive/folders/abc",
    paymentUrl: "https://pay.northwind.test/inv-1",
    notes: "Original terms",
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    items: [
      {
        id: "item-1",
        invoiceId: "inv-1",
        catalogId: "cat-design",
        description: "Product Design Sprint",
        quantity: 2,
        unitPriceCents: 50000,
        position: 0,
      },
    ],
    ...overrides,
  };
}

describe("buildDuplicateInvoiceDraft", () => {
  it("preserves catalogId, pricing, advance, URLs, and DRAFT status for active clients", () => {
    const fixedNow = new Date("2026-11-19T10:00:00");
    const draft = buildDuplicateInvoiceDraft(
      baseInvoice(),
      [{ id: "client-1", archivedAt: null }],
      7,
      fixedNow,
    );

    expect(draft.clientMode).toBe("existing");
    expect(draft.clientId).toBe("client-1");
    expect(draft.status).toBe("DRAFT");
    expect(draft.dueDate).toBe("2026-11-26");
    expect(draft.items).toHaveLength(1);
    expect(draft.items[0].catalogId).toBe("cat-design");
    expect(draft.items[0].unitPrice).toBe("500.00");
    expect(draft.discount).toBe("100.00");
    expect(draft.taxRate).toBe("22.2");
    expect(draft.requireAdvance).toBe(true);
    expect(draft.advancePercent).toBe(50);
    expect(draft.paymentUrl).toBe("https://pay.northwind.test/inv-1");
    expect(draft.deliveryUrl).toBe("https://drive.google.com/drive/folders/abc");
  });

  it("falls back to temporary client mode and preserves clientWhatsAppPhone when client is missing or archived", () => {
    const draft = buildDuplicateInvoiceDraft(
      baseInvoice({ clientId: "archived-1" }),
      [{ id: "archived-1", archivedAt: "2026-11-01T00:00:00Z" }],
      14,
      new Date("2026-11-19T10:00:00"),
    );

    expect(draft.clientMode).toBe("new");
    expect(draft.clientId).toBe("");
    expect(draft.saveAsPermanentClient).toBe(false);
    expect(draft.clientName).toBe("Northwind Studio");
    expect(draft.clientWhatsApp).toBe("+14155550199");
  });

  it("reconstructs pre-discount, pre-tax subtotal on non-itemized invoices so totals are not double-applied", () => {
    // Gross 1,000.00 - discount 100.00 = 900.00 + 10% tax (90.00) = 990.00 (99000 cents)
    const draft = buildDuplicateInvoiceDraft(
      baseInvoice({
        items: [],
        title: "Monthly Advisory Retainer",
        amountCents: 99000,
        discountCents: 10000,
        taxCents: 9000,
        advanceCents: 0,
      }),
      [{ id: "client-1", archivedAt: null }],
    );

    expect(draft.items).toHaveLength(1);
    expect(draft.items[0].description).toBe("Monthly Advisory Retainer");
    expect(draft.items[0].unitPrice).toBe("1000.00");
    expect(draft.discount).toBe("100.00");
    expect(draft.taxRate).toBe("10");
    expect(draft.requireAdvance).toBe(false);
    expect(draft.advancePercent).toBe(50);
  });
});
