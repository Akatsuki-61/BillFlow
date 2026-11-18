import { describe, expect, it } from "vitest";
import {
  formatInvoicePaymentSummary,
  formatWorkOrderPaymentSummary,
  nextTaskStage,
} from "../payment-summary";
import type { InvoiceWithClient } from "../../types/billing";
import type { WorkOrderItem } from "../../types/outsourcing";
import type { AppSettings } from "../../types/settings";

describe("Payment Summary Formatting & Task Stage Progression", () => {
  const settings = {
    businessName: "Apex Engineering",
    paymentDetails: "Commercial Bank · Acct 00112233",
  } as AppSettings;

  it("formats an itemized invoice payment summary with advance, paid, remaining balance, and bank details", () => {
    const invoice = {
      id: "inv-1",
      code: "INV-2026-042",
      clientId: "c1",
      clientName: "Northwind Corp",
      status: "ADVANCE_PAID",
      currency: "USD",
      issueDate: "2026-11-01",
      dueDate: "2026-11-15",
      amountCents: 200000,
      advanceCents: 100000,
      paidCents: 100000,
      discountCents: 0,
      taxCents: 0,
      paymentUrl: "https://pay.example.test/inv-42",
      createdAt: "2026-11-01T00:00:00Z",
      updatedAt: "2026-11-01T00:00:00Z",
      items: [],
      payments: [],
    } as InvoiceWithClient;

    const summary = formatInvoicePaymentSummary(invoice, settings);
    expect(summary).toContain("INV-2026-042");
    expect(summary).toContain("Northwind Corp");
    expect(summary).toContain("$2,000.00");
    expect(summary).toContain("Advance Required: $1,000.00");
    expect(summary).toContain("Remaining Balance: $1,000.00");
    expect(summary).toContain("2026-11-15");
    expect(summary).toContain("https://pay.example.test/inv-42");
    expect(summary).toContain("Commercial Bank · Acct 00112233");
  });

  it("formats a subcontractor work order summary with voucher code and remaining payout", () => {
    const order = {
      id: "wo-abc12345",
      vendorId: "v1",
      vendorName: "Devon Design",
      scope: "Landing Page UI",
      feeCents: 50000,
      payoutAmountCents: 20000,
      remainingPayoutCents: 30000,
      currency: "USD",
      payoutDueDate: "2026-11-20",
      status: "in-progress",
      payoutStatus: "PENDING",
    } as WorkOrderItem;

    const summary = formatWorkOrderPaymentSummary(order, settings);
    expect(summary).toContain("VND-INV-ABC12345");
    expect(summary).toContain("Devon Design");
    expect(summary).toContain("Landing Page UI");
    expect(summary).toContain("$500.00");
    expect(summary).toContain("$300.00");
    expect(summary).toContain("2026-11-20");
  });

  it("returns deterministic next task stage transitions until done", () => {
    expect(nextTaskStage("todo")).toEqual({
      next: "in-progress",
      label: "Start",
    });
    expect(nextTaskStage("in-progress")).toEqual({
      next: "review",
      label: "Review",
    });
    expect(nextTaskStage("review")).toEqual({
      next: "done",
      label: "Complete",
    });
    expect(nextTaskStage("done")).toBeNull();
  });
});
