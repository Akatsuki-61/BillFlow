"use client";

import { useData } from "@/lib/data/DataProvider";
import { cashflowForecast } from "@/lib/cashflow-forecast";
import { formatCents } from "@/lib/format";

export function CashflowForecast() {
  const { invoices, workOrders, isLoading } = useData();

  return (
    <section
      className="ui-card p-5 space-y-4"
      aria-labelledby="cashflow-forecast-heading"
    >
      <div>
        <h2
          id="cashflow-forecast-heading"
          className="text-base font-semibold text-content-neutral-950"
        >
          Cashflow forecast
        </h2>
        <p className="text-xs text-content-neutral-600 mt-1">
          Open invoice balances and remaining vendor payouts on their scheduled
          dates.
        </p>
      </div>
      {isLoading ? (
        <p className="text-xs text-content-neutral-600">Loading forecast…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {cashflowForecast(invoices, workOrders).map((period) => (
            <div
              key={period.label}
              className="min-w-0 rounded-xl border border-line-neutral-200 p-3"
            >
              <h3 className="text-sm font-medium text-content-neutral-950">
                {period.label}
              </h3>
              <p className="mt-0.5 text-xs text-content-neutral-600">
                {period.start} to {period.end}
              </p>
              {period.totals.length ? (
                <table className="mt-3 w-full text-left text-xs tabular-nums">
                  <caption className="sr-only">
                    {period.label} by currency
                  </caption>
                  <thead className="text-content-neutral-600">
                    <tr>
                      <th scope="col" className="pb-2 font-medium">
                        Currency
                      </th>
                      <th scope="col" className="pb-2 text-right font-medium">
                        Collections
                      </th>
                      <th scope="col" className="pb-2 text-right font-medium">
                        Payouts
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {period.totals.map(([currency, total]) => (
                      <tr
                        key={currency}
                        className="border-t border-line-neutral-200 text-content-neutral-950"
                      >
                        <th scope="row" className="py-2 font-medium">
                          {currency}
                        </th>
                        <td className="text-right">
                          {formatCents(total.collections, currency)}
                        </td>
                        <td className="text-right">
                          {formatCents(total.payouts, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-3 text-xs text-content-neutral-600">
                  No collections or payouts due.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
