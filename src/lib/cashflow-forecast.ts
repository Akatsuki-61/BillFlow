import type { Currency, InvoiceWithClient } from "../types/billing";
import type { WorkOrderItem } from "../types/outsourcing";
import { localDateKey } from "./visual-metrics";

export function remainingPayout(
  order: Pick<
    WorkOrderItem,
    "feeCents" | "payoutAmountCents" | "remainingPayoutCents"
  >,
) {
  return (
    order.remainingPayoutCents ??
    Math.max(0, order.feeCents - (order.payoutAmountCents ?? 0))
  );
}

export function cashflowForecast(
  invoices: Pick<
    InvoiceWithClient,
    | "status"
    | "trashedAt"
    | "dueDate"
    | "currency"
    | "amountCents"
    | "paidCents"
  >[],
  workOrders: Pick<
    WorkOrderItem,
    | "payoutDueDate"
    | "currency"
    | "feeCents"
    | "payoutAmountCents"
    | "remainingPayoutCents"
  >[],
  now = new Date(),
) {
  const today = localDateKey(now);
  const date = (offset: number) =>
    localDateKey(
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset),
    );
  const periods = [
    {
      label: "This month",
      start: localDateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
      end: localDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    },
    { label: "Next 30 days", start: today, end: date(30) },
    { label: "Next 90 days", start: today, end: date(90) },
  ];
  const rows = [
    ...invoices
      .filter((invoice) => invoice.status !== "DRAFT" && !invoice.trashedAt)
      .map((invoice) => ({
        due: invoice.dueDate?.slice(0, 10),
        currency: invoice.currency,
        collections: Math.max(0, invoice.amountCents - invoice.paidCents),
        payouts: 0,
      })),
    ...workOrders.map((order) => ({
      due: order.payoutDueDate?.slice(0, 10),
      currency: order.currency,
      collections: 0,
      payouts: remainingPayout(order),
    })),
  ];
  return periods.map((period) => {
    const totals = new Map<
      Currency,
      { collections: number; payouts: number }
    >();
    for (const row of rows) {
      if (
        !row.due ||
        row.due < period.start ||
        row.due > period.end ||
        !(row.collections || row.payouts)
      )
        continue;
      const total = totals.get(row.currency) ?? { collections: 0, payouts: 0 };
      total.collections += row.collections;
      total.payouts += row.payouts;
      totals.set(row.currency, total);
    }
    return {
      ...period,
      totals: [...totals].sort(([a], [b]) => a.localeCompare(b)),
    };
  });
}
