import { convertCents } from "./currency-conversion";
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

/** A client's progress and displayed balances must use the same reporting currency. */
export function clientBalanceInCurrency(
  client: ClientWithStats,
  field: "billed" | "paid" | "outstanding",
  currency: string,
  rates: import("./currency-conversion").ExchangeRates | null,
): number | null {
  const values =
    client.totalsByCurrency && Object.keys(client.totalsByCurrency).length
      ? client.totalsByCurrency
      : {
          [client.currency]: {
            billed: client.totalBilledCents,
            paid: client.totalPaidCents,
            outstanding: client.outstandingBalanceCents,
          },
        };
  let total = 0;
  for (const [source, amounts] of Object.entries(values)) {
    const converted = convertCents(amounts![field], source, currency, rates);
    if (converted === null) return null;
    total += converted;
  }
  return total;
}
