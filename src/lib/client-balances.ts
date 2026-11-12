import type { ClientWithStats, Currency } from "../types/billing";
import { formatCents } from "./format";
export function formatClientBalance(
  client: ClientWithStats,
  field: "billed" | "paid" | "outstanding",
): string {
  const fallback = {
    billed: client.totalBilledCents,
    paid: client.totalPaidCents,
    outstanding: client.outstandingBalanceCents,
  };
  const values =
    client.totalsByCurrency && Object.keys(client.totalsByCurrency).length
      ? client.totalsByCurrency
      : { [client.currency]: fallback };
  return Object.entries(values)
    .map(([currency, total]) =>
      formatCents(total![field], currency as Currency),
    )
    .join(" · ");
}
