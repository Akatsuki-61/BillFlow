import type {
  Currency,
  InvoiceWithClient,
  CatalogItem,
} from "../types/billing";
import type { ExpenseItem } from "../types/expenses";
import type { WorkOrderItem } from "../types/outsourcing";

export const REPORTING_CURRENCIES = [
  "USD",
  "LKR",
  "EUR",
  "GBP",
  "CAD",
] as const;
export interface ExchangeRates {
  base: "USD";
  rates: Record<Currency, number>;
  updatedAt: string;
  nextUpdateAt: string;
  fetchedAt: string;
  provider: "ExchangeRate-API";
}
export interface ExchangeRateState {
  snapshot: ExchangeRates | null;
  error: string | null;
}

/** Only reporting copies are converted. Stored records and client documents retain their currency. */
export function convertCents(
  amount: number,
  from: string,
  to: string,
  rates: ExchangeRates | null,
): number | null {
  if (!Number.isSafeInteger(amount))
    throw new Error("The amount exceeds the supported precision.");
  if (from === to) return amount;
  const source = rates?.rates[from as Currency];
  const target = rates?.rates[to as Currency];
  if (
    !source ||
    !target ||
    !Number.isFinite(source) ||
    !Number.isFinite(target) ||
    source <= 0 ||
    target <= 0
  )
    return null;
  const scale = 10_000_000_000;
  const denominator = BigInt(Math.round(source * scale));
  if (denominator === BigInt(0)) return null;
  const numerator =
    BigInt(Math.abs(amount)) * BigInt(Math.round(target * scale));
  const result =
    Number((numerator + denominator / BigInt(2)) / denominator) *
    Math.sign(amount);
  if (!Number.isSafeInteger(result))
    throw new Error("The converted amount exceeds the supported precision.");
  return result;
}

export function reportingRecords(
  input: {
    invoices: InvoiceWithClient[];
    expenses: ExpenseItem[];
    workOrders: WorkOrderItem[];
    catalogItems?: CatalogItem[];
  },
  currency: Currency,
  rates: ExchangeRates | null,
) {
  const missing = new Set<string>();
  const amount = (value: number, source: string) => {
    const converted = convertCents(value, source, currency, rates);
    if (converted === null) missing.add(source);
    return converted;
  };
  const invoices = input.invoices.flatMap((row) => {
    const amountCents = amount(row.amountCents, row.currency);
    if (amountCents === null) return [];
    return [
      {
        ...row,
        currency,
        amountCents,
        paidCents: amount(row.paidCents || 0, row.currency)!,
        advanceCents: amount(row.advanceCents || 0, row.currency)!,
        discountCents: amount(row.discountCents || 0, row.currency)!,
        taxCents: amount(row.taxCents || 0, row.currency)!,
        items: row.items?.map((item) => ({
          ...item,
          unitPriceCents: amount(item.unitPriceCents, row.currency)!,
        })),
        payments: row.payments?.map((payment) => ({
          ...payment,
          currency,
          amountCents: amount(payment.amountCents, payment.currency)!,
        })),
      },
    ];
  });
  const expenses = input.expenses.flatMap((row) => {
    const amountCents = amount(row.amountCents, row.currency);
    return amountCents === null ? [] : [{ ...row, currency, amountCents }];
  });
  const workOrders = input.workOrders.flatMap((row) => {
    const feeCents = amount(row.feeCents, row.currency);
    if (feeCents === null) return [];
    return [
      {
        ...row,
        currency,
        feeCents,
        payoutAmountCents: amount(row.payoutAmountCents || 0, row.currency)!,
        remainingPayoutCents: amount(
          row.remainingPayoutCents ??
            Math.max(0, row.feeCents - (row.payoutAmountCents || 0)),
          row.currency,
        )!,
        payouts: row.payouts?.map((payout) => ({
          ...payout,
          currency,
          amountCents: amount(payout.amountCents, payout.currency)!,
        })),
      },
    ];
  });
  const catalogItems = (input.catalogItems || []).flatMap((row) => {
    const priceCents = amount(row.priceCents, row.currency);
    return priceCents === null
      ? []
      : [
          {
            ...row,
            currency,
            priceCents,
            price: (priceCents / 100).toFixed(2),
          },
        ];
  });
  return {
    invoices,
    expenses,
    workOrders,
    catalogItems,
    missingCurrencies: [...missing].sort(),
    currency,
  };
}
