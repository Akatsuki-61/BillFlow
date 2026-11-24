import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Clock, Waves } from "lucide-react";
import { useReportingData } from "@/context/ReportingContext";
import { formatCents, getCurrencySymbol } from "@/lib/format";
import { isPastDue, recentMonths, sharePercent } from "@/lib/visual-metrics";
import { buildAudienceGrowthData } from "@/lib/widgets/chartData";
import type { Currency, InvoiceWithClient } from "@/types/billing";
import type { DashboardPeriod } from "@/types/dashboard";
import { useDashboardMetrics, type DashboardMetrics } from "./DashboardMetricsContext";

function amount(cents: number, currency: Currency) {
  return formatCents(cents, currency).replace(/\.00$/, "");
}

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function periodLabel(period: DashboardPeriod) {
  if (period === "month") {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(new Date());
  }
  return { quarter: "This quarter", year: "This year", all: "All time" }[period];
}

function WidgetHeading({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children?: ReactNode;
}) {
  return (
    <div className="ledger-heading">
      <div>
        <h3>{title}</h3>
        <p className="ledger-note">{note}</p>
      </div>
      {children}
    </div>
  );
}

function MetricTile({
  title,
  value,
  note,
  icon,
}: {
  title: string;
  value: string;
  note: string;
  icon: ReactNode;
}) {
  return (
    <article className="ledger-widget ledger-widget--metric">
      <h3>
        {icon}
        {title}
      </h3>
      <strong className="ledger-value">{value}</strong>
      <p className="ledger-note">{note}</p>
    </article>
  );
}

function CashFlow({ currency }: { currency: Currency }) {
  const { invoices, expenses, workOrders } = useReportingData();
  const months = useMemo(() => {
    const now = new Date();
    const { chartData } = buildAudienceGrowthData(
      invoices, expenses, workOrders, currency, now,
    );
    const cashMonths = chartData.slice(-6);
    return recentMonths(now).map(({ key, label }, index) => {
      const { collections, profit } = cashMonths[index];
      return {
        key,
        label,
        collected: Math.round(collections * 100),
        costs: Math.round((collections - profit) * 100),
      };
    });
  }, [invoices, expenses, workOrders, currency]);
  const [selectedKey, setSelectedKey] = useState<string>();
  const selected =
    months.find((month) => month.key === selectedKey) ?? months[months.length - 1];
  const max = Math.max(0, ...months.flatMap((month) => [month.collected, month.costs]));
  const increment = 2 * 10 ** Math.floor(Math.log10(Math.max(1, max) / 10));
  const tick = max > 0 ? Math.ceil(max / (3 * increment)) * increment : 0;
  const top = tick * 3;
  const scaleLabel = (cents: number) =>
    `${getCurrencySymbol(currency)}${compactNumber.format(cents / 100)}`;

  return (
    <article className="ledger-widget">
      <WidgetHeading title="Cash flow" note="Payments received and expenses paid">
        <div className="ledger-legend" aria-hidden="true">
          <span><i className="ledger-swatch" />Collected</span>
          <span><i className="ledger-swatch ledger-swatch--secondary" />Expenses</span>
        </div>
      </WidgetHeading>
      <div className="ledger-chart" role="group" aria-label="Cash flow by month">
        <div className="ledger-axis" aria-hidden="true">
          {[3, 2, 1, 0].map((step) => (
            <span key={step}>
              {tick || step === 0 ? scaleLabel(tick * step) : "\u00a0"}
            </span>
          ))}
        </div>
        <div className="ledger-plot">
          <div className="ledger-gridlines" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="ledger-months">
            {months.map(({ key, label, collected, costs }) => (
              <button
                key={key}
                type="button"
                className="ledger-month"
                aria-label={`${label}, ${amount(collected, currency)} collected, ${amount(costs, currency)} expenses`}
                aria-pressed={key === selected.key}
                onClick={() => setSelectedKey(key)}
              >
                <span className="ledger-bar-pair" aria-hidden="true">
                  <i className="ledger-bar" style={{ blockSize: `${sharePercent(collected, top)}%` }} />
                  <i className="ledger-bar" style={{ blockSize: `${sharePercent(costs, top)}%` }} />
                </span>
                <span className="ledger-month-label">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="ledger-detail" aria-live="polite">
        <strong>{selected.label} {selected.key.slice(0, 4)}</strong>
        <span>{amount(selected.collected, currency)} collected</span>
        <span>{amount(selected.costs, currency)} expenses</span>
      </div>
    </article>
  );
}

function PaymentBreakdown({ metrics }: { metrics: DashboardMetrics }) {
  const { activeCurrency, pendingCents, totalRevenueCents, financials } = metrics;
  const collected = Math.max(0, totalRevenueCents - pendingCents);
  const overdue = Math.min(pendingCents, financials.overdueCents);
  const rows = [
    { label: "Collected", tone: "paid", value: collected },
    { label: "Open, not due", tone: "open", value: pendingCents - overdue },
    { label: "Overdue", tone: "late", value: overdue },
  ];
  return (
    <article className="ledger-widget">
      <WidgetHeading title="Payment breakdown" note="Share of gross invoiced">
        <span className="ledger-badge">{activeCurrency}</span>
      </WidgetHeading>
      <div className="ledger-breakdown-value">
        <strong className="ledger-value">{Math.round(sharePercent(collected, totalRevenueCents))}%</strong>
        <span>collected</span>
      </div>
      <div className="ledger-track" aria-hidden="true">
        {rows.filter(({ value }) => value > 0).map(({ label, tone, value }) => (
          <i key={label} data-ledger-tone={tone} style={{ flex: value }} />
        ))}
      </div>
      <dl className="ledger-breakdown">
        {rows.map(({ label, tone, value }) => (
          <div key={label}>
            <dt>
              <i className="ledger-swatch" aria-hidden="true" data-ledger-tone={tone} />
              {label}
            </dt>
            <dd>{amount(value, activeCurrency)}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function invoiceStatus(invoice: InvoiceWithClient) {
  if (invoice.status === "PAID") return { tone: "paid", label: "Paid" };
  if (isPastDue(invoice)) return { tone: "late", label: "Overdue" };
  if (invoice.status === "ADVANCE_PAID") return { tone: "open", label: "Advance paid" };
  return { tone: "open", label: "Unpaid" };
}

function RecentInvoices({
  metrics,
  compact,
}: {
  metrics: DashboardMetrics;
  compact: boolean;
}) {
  const { activeCurrency, filteredInvoices, period } = metrics;
  const recent = [...filteredInvoices]
    .sort((left, right) =>
      right.issueDate.localeCompare(left.issueDate) ||
      right.createdAt.localeCompare(left.createdAt),
    )
    .slice(0, compact ? 2 : 3);

  return (
    <article className="ledger-widget">
      <WidgetHeading title="Recent invoices" note={periodLabel(period)}>
        <span className="ledger-badge">{activeCurrency}</span>
      </WidgetHeading>
      <div className="ledger-table-wrap">
        <table className="ledger-table" aria-label="Recent invoices">
          <thead>
            <tr>
              <th scope="col">Invoice</th>
              <th scope="col">Client</th>
              <th scope="col">Status</th>
              <th scope="col" className="ledger-amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((invoice) => {
              const status = invoiceStatus(invoice);
              return (
                <tr key={invoice.id}>
                  <td>
                    <Link href={`/invoices?invoice=${encodeURIComponent(invoice.id)}`}>
                      {invoice.code}
                    </Link>
                  </td>
                  <td>{invoice.clientName}</td>
                  <td>
                    <span className="ledger-status" data-ledger-tone={status.tone}>
                      {status.label}
                    </span>
                  </td>
                  <td className="ledger-amount">{amount(invoice.amountCents, activeCurrency)}</td>
                </tr>
              );
            })}
            {!recent.length && (
              <tr><td colSpan={4}><p className="ledger-empty">No invoices issued in this period.</p></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function ActiveClients({
  invoices,
  compact,
}: {
  invoices: InvoiceWithClient[];
  compact: boolean;
}) {
  const totals = new Map<string, { name: string; id: string | null; count: number }>();
  for (const invoice of invoices) {
    const key = invoice.clientId
      ? `client:${invoice.clientId}`
      : `temporary:${(invoice.clientEmail || invoice.clientName).trim().toLowerCase()}`;
    const current = totals.get(key);
    if (current) current.count += 1;
    else totals.set(key, { name: invoice.clientName, id: invoice.clientId, count: 1 });
  }
  const clients = [...totals.entries()]
    .sort(([, left], [, right]) =>
      right.count - left.count || left.name.localeCompare(right.name),
    )
    .slice(0, compact ? 2 : 3);

  return (
    <article className="ledger-widget">
      <WidgetHeading title="Active clients" note="Invoiced this period">
        <strong className="ledger-client-count">{totals.size.toLocaleString()}</strong>
      </WidgetHeading>
      {!clients.length ? <p className="ledger-empty">No clients invoiced in this period.</p> : (
        <ul className="ledger-client-list">
          {clients.map(([key, client]) => {
            const initials = client.name.trim().split(/\s+/).slice(0, 2)
              .map((word) => [...word][0]).join("").toUpperCase();
            return (
              <li key={key}>
                <span className="ledger-initials" aria-hidden="true">{initials}</span>
                {client.id ? (
                  <Link href={`/invoices?client=${encodeURIComponent(client.id)}`}>{client.name}</Link>
                ) : <span>{client.name}</span>}
                <small>{client.count} {client.count === 1 ? "invoice" : "invoices"}</small>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

export function LedgerWidget({ widgetId, compact }: { widgetId: string; compact: boolean }) {
  const metrics = useDashboardMetrics();
  const { activeCurrency, financials, filteredInvoices } = metrics;
  const count = filteredInvoices.length;

  switch (widgetId) {
    case "total-revenue":
      return (
        <MetricTile
          title="Gross invoiced"
          value={amount(metrics.totalRevenueCents, activeCurrency)}
          note={`${count} ${count === 1 ? "invoice" : "invoices"} issued`}
          icon={<ArrowUpRight className="ledger-mark" aria-hidden="true" />}
        />
      );
    case "collected-revenue":
      return (
        <MetricTile
          title="Collected"
          value={amount(metrics.paidCents, activeCurrency)}
          note={`${metrics.paidRatioPct}% of gross invoiced`}
          icon={<Check className="ledger-mark ledger-mark--green" aria-hidden="true" />}
        />
      );
    case "pending-receivables":
      return (
        <MetricTile
          title="Outstanding"
          value={amount(metrics.pendingCents, activeCurrency)}
          note={`${amount(financials.overdueCents, activeCurrency)} overdue`}
          icon={<Clock className="ledger-mark ledger-mark--orange" aria-hidden="true" />}
        />
      );
    case "net-profit":
      return (
        <MetricTile
          title="Net profit"
          value={amount(metrics.netProfitCents, activeCurrency)}
          note={`${metrics.marginPct}% net margin`}
          icon={<Waves className="ledger-mark" aria-hidden="true" />}
        />
      );
    case "cash-flow":
      return <CashFlow currency={activeCurrency} />;
    case "collection-rate-gauge":
      return <PaymentBreakdown metrics={metrics} />;
    case "recent-invoices":
      return <RecentInvoices metrics={metrics} compact={compact} />;
    case "active-clients":
      return <ActiveClients invoices={filteredInvoices} compact={compact} />;
    default:
      return null;
  }
}
