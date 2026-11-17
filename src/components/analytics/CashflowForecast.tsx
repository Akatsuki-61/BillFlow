"use client";

import { useData } from "@/lib/data/DataProvider";
import { useReportingData, ReportingGuard } from "@/context/ReportingContext";
import { cashflowForecast } from "@/lib/cashflow-forecast";
import { formatCents } from "@/lib/format";
import "./analytics.css";

export function CashflowForecast() {
  const { invoices, workOrders } = useReportingData();
  const { isLoading } = useData();
  const periods = cashflowForecast(invoices, workOrders);

  return (
    <ReportingGuard>
      <section
        className="ui-card p-5 space-y-4 cashflow-forecast-section"
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
            Open invoice balances and remaining vendor payouts on their
            scheduled dates.
          </p>
        </div>
        {isLoading ? (
          <p className="text-xs text-content-neutral-600">Loading forecast…</p>
        ) : (
          <div className="cashflow-forecast-grid">
            {periods.map((period) => (
              <div key={period.label} className="cashflow-forecast-card">
                <div className="cashflow-forecast-card-header">
                  <h3 className="cashflow-forecast-card-title">
                    {period.label}
                  </h3>
                  <p className="cashflow-forecast-card-range">
                    {period.start} to {period.end}
                  </p>
                </div>
                <div className="cashflow-forecast-table-wrap">
                  <table className="cashflow-forecast-table">
                    <caption className="sr-only">
                      {period.label} by currency
                    </caption>
                    <colgroup>
                      <col className="cashflow-forecast-col-currency" />
                      <col className="cashflow-forecast-col-amount" />
                      <col className="cashflow-forecast-col-amount" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th scope="col">Currency</th>
                        <th scope="col" className="cashflow-forecast-num">
                          Collections
                        </th>
                        <th scope="col" className="cashflow-forecast-num">
                          Payouts
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {period.totals.length ? (
                        period.totals.map(([currency, total]) => (
                          <tr key={currency}>
                            <th scope="row">{currency}</th>
                            <td className="cashflow-forecast-num">
                              {formatCents(total.collections, currency)}
                            </td>
                            <td className="cashflow-forecast-num">
                              {formatCents(total.payouts, currency)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr className="cashflow-forecast-empty-row">
                          <td
                            colSpan={3}
                            className="cashflow-forecast-empty-cell"
                          >
                            No collections or payouts due.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </ReportingGuard>
  );
}
