import { describe, expect, it } from "vitest";
import {
  convertCents,
  reportingRecords,
  type ExchangeRates,
} from "../currency-conversion";
import { calculateFinancials } from "../financials";
import type { InvoiceWithClient, CatalogItem } from "../../types/billing";
import type { ExpenseItem } from "../../types/expenses";
import type { WorkOrderItem } from "../../types/outsourcing";
const rates: ExchangeRates = {
  base: "USD",
  rates: { USD: 1, LKR: 300.125, EUR: 0.9, GBP: 0.75, CAD: 1.4 },
  updatedAt: "2026-11-17T00:00:00Z",
  nextUpdateAt: "2026-11-18T00:00:00Z",
  fetchedAt: "2026-11-17T00:00:01Z",
  provider: "ExchangeRate-API",
};
describe("profile reporting currency", () => {
  it("rounds integer minor units and converts in both directions without requiring a USD record", () => {
    expect(convertCents(20000, "USD", "LKR", rates)).toBe(6002500);
    expect(convertCents(2000, "USD", "LKR", rates)).toBe(600250);
    expect(convertCents(9000, "EUR", "LKR", rates)).toBe(3001250);
    expect(convertCents(600250, "LKR", "USD", rates)).toBe(2000);
    expect(convertCents(-2000, "USD", "LKR", rates)).toBe(-600250);
    expect(convertCents(1, "USD", "EUR", rates)).toBe(1);
  });
  it("keeps same-currency records usable offline and flags missing foreign rates", () => {
    expect(convertCents(2000, "USD", "USD", null)).toBe(2000);
    expect(convertCents(2000, "USD", "LKR", null)).toBeNull();
    expect(
      convertCents(2000, "USD", "LKR", {
        ...rates,
        rates: { ...rates.rates, USD: 0 },
      }),
    ).toBeNull();
    expect(() =>
      convertCents(Number.MAX_SAFE_INTEGER, "USD", "LKR", rates),
    ).toThrow("precision");
  });
  it("aggregates foreign revenue, subscriptions and actual payouts while leaving originals unchanged", () => {
    const invoice = {
      id: "invoice",
      code: "INV-1",
      clientId: "client",
      clientName: "Client",
      status: "PAID",
      currency: "USD",
      amountCents: 20000,
      paidCents: 20000,
      advanceCents: 0,
      issueDate: "2026-11-17",
      payments: [
        {
          id: "payment",
          currency: "USD",
          amountCents: 20000,
          receivedAt: "2026-11-17",
        },
      ],
    } as InvoiceWithClient;
    const expense = {
      id: "expense",
      merchant: "Subscription",
      currency: "USD",
      amountCents: 2000,
      incurredAt: "2026-11-17",
      category: "SOFTWARE",
    } as ExpenseItem;
    const order = {
      id: "order",
      vendorId: null,
      taskId: null,
      invoiceId: null,
      scope: "Contractor work",
      status: "done",
      currency: "EUR",
      feeCents: 9000,
      paidCents: 4500,
      remainingCents: 4500,
      payouts: [
        {
          id: "payout",
          currency: "EUR",
          amountCents: 4500,
          paidAt: "2026-11-17",
        },
      ],
    } as WorkOrderItem;
    const catalog = {
      id: "catalog",
      currency: "EUR",
      priceCents: 9000,
      price: "90.00",
    } as CatalogItem;
    const before = JSON.stringify({ invoice, expense, order, catalog });
    const converted = reportingRecords(
      {
        invoices: [invoice],
        expenses: [expense],
        workOrders: [order],
        catalogItems: [catalog],
      },
      "LKR",
      rates,
    );
    const totals = calculateFinancials({
      ...converted,
      period: "all",
      currency: "LKR",
    });
    expect(converted.missingCurrencies).toEqual([]);
    expect(totals.totalRevenueCents).toBe(6002500);
    expect(totals.netProfitCents).toBe(3901625);
    expect(converted.catalogItems[0].priceCents).toBe(3001250);
    expect(JSON.stringify({ invoice, expense, order, catalog })).toBe(before);
    expect(
      reportingRecords(
        { invoices: [invoice], expenses: [], workOrders: [] },
        "LKR",
        null,
      ).missingCurrencies,
    ).toEqual(["USD"]);
  });
});

it("formats calendar dates on their selected day in both positive and negative time zones", async () => {
  const { formatDateDisplay } = await import("../format");
  const original = process.env.TZ;
  try {
    for (const timezone of ["Asia/Colombo", "America/Los_Angeles"]) {
      process.env.TZ = timezone;
      expect(formatDateDisplay("2026-11-17")).toBe("Nov 17, 2026");
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

it("buckets timestamped receipts by local month while keeping date-only fields stable", async () => {
  const { financialDateInPeriod } = await import("../financials");
  const original = process.env.TZ;
  try {
    process.env.TZ = "Asia/Colombo";
    const now = new Date("2026-12-01T03:00:00+05:30");
    expect(financialDateInPeriod("2026-11-30T22:00:00Z", "month", now)).toBe(
      true,
    );
    expect(financialDateInPeriod("2026-11-30T22:00:00Z", "2026-12", now)).toBe(
      true,
    );
    process.env.TZ = "America/Los_Angeles";
    expect(financialDateInPeriod("2026-12-01T01:00:00Z", "2026-11")).toBe(true);
    expect(financialDateInPeriod("2026-12-01", "2026-12")).toBe(true);
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

it("weights client collection progress across all original currencies", async () => {
  const { clientBalanceInCurrency } = await import("../client-balances");
  const client = {
    currency: "USD",
    totalBilledCents: 20000,
    totalPaidCents: 10000,
    outstandingBalanceCents: 10000,
    totalsByCurrency: {
      USD: { billed: 20000, paid: 10000, outstanding: 10000 },
      LKR: { billed: 10000000, paid: 10000000, outstanding: 0 },
    },
  } as import("../../types/billing").ClientWithStats;
  const billed = clientBalanceInCurrency(client, "billed", "LKR", rates)!;
  const paid = clientBalanceInCurrency(client, "paid", "LKR", rates)!;
  expect(billed).toBe(16002500);
  expect(paid).toBe(13001250);
  expect(Math.round((paid / billed) * 100)).toBe(81);
  expect(clientBalanceInCurrency(client, "billed", "LKR", null)).toBeNull();
});
