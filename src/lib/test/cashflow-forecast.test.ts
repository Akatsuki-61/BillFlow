import { expect, it } from "vitest";
import { cashflowForecast } from "../cashflow-forecast";

it("forecasts only dated open balances, including the last day of each window", () => {
  const now = new Date(2026, 10, 15, 12);
  const invoice = {
    status: "UNPAID",
    currency: "USD",
    amountCents: 300,
    paidCents: 100,
  } as const;
  const order = {
    currency: "EUR",
    feeCents: 2250,
    payoutAmountCents: 750,
  } as const;
  const [month, days30, days90] = cashflowForecast(
    [
      { ...invoice, dueDate: "2026-11-01" },
      { ...invoice, dueDate: "2026-11-15" },
      { ...invoice, dueDate: "2026-12-15T00:00:00Z" },
      { ...invoice, status: "DRAFT", dueDate: "2026-12-16" },
      { ...invoice, trashedAt: "2026-11-15", dueDate: "2026-11-30" },
      { ...invoice, dueDate: "2027-02-14" },
    ],
    [
      { ...order, payoutDueDate: "2026-11-30" },
      { ...order, payoutDueDate: "2027-02-13" },
      { ...order, payoutDueDate: null },
    ],
    now,
  );
  expect(month.totals).toEqual([
    ["EUR", { collections: 0, payouts: 1500 }],
    ["USD", { collections: 400, payouts: 0 }],
  ]);
  expect(days30.totals).toEqual(month.totals);
  expect(days90.totals).toEqual([
    ["EUR", { collections: 0, payouts: 3000 }],
    ["USD", { collections: 400, payouts: 0 }],
  ]);
});
