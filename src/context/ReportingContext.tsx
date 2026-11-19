"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  useActiveCurrency,
  useCatalog,
  useExpenses,
  useInvoices,
  useWorkOrders,
} from "@/lib/data/DataProvider";
import {
  convertCents,
  reportingRecords,
  type ExchangeRateState,
} from "@/lib/currency-conversion";
import { formatCents, formatDateDisplay } from "@/lib/format";
import { openExternalLink } from "@/lib/deliveryUrl";

function useReportingState() {
  const { allInvoices: invoices, isLoading: invoicesLoading } = useInvoices();
  const { allExpenses: expenses, isLoading: expensesLoading } = useExpenses();
  const { workOrders, isLoading: workOrdersLoading } = useWorkOrders();
  const { catalogItems, isLoading: catalogLoading } = useCatalog();
  const { activeCurrency } = useActiveCurrency();
  const isLoading =
    invoicesLoading || expensesLoading || workOrdersLoading || catalogLoading;
  const [rates, setRates] = useState<ExchangeRateState>({
    snapshot: null,
    error: null,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [checkedAt, setCheckedAt] = useState(() => Date.now());
  const refreshRates = useCallback(async () => {
    if (!window.billflow?.currency) return;
    setRefreshing(true);
    try {
      setRates(await window.billflow.currency.rates());
    } catch {
      setRates((state) => ({
        ...state,
        error:
          "Could not load exchange rates. Try again after unlocking your profile.",
      }));
    } finally {
      setRefreshing(false);
      setCheckedAt(Date.now());
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(refreshRates);
    const switched = () => {
      void refreshRates();
    };
    window.addEventListener("billflow:profile-switched", switched);
    window.addEventListener("online", switched);
    const interval = setInterval(switched, 60 * 60 * 1000);
    return () => {
      window.removeEventListener("billflow:profile-switched", switched);
      window.removeEventListener("online", switched);
      clearInterval(interval);
    };
  }, [refreshRates]);
  const records = useMemo(
    () =>
      reportingRecords(
        { invoices, expenses, workOrders, catalogItems },
        activeCurrency,
        rates.snapshot,
      ),
    [
      invoices,
      expenses,
      workOrders,
      catalogItems,
      activeCurrency,
      rates.snapshot,
    ],
  );
  const convert = useCallback(
    (cents: number, from: string, to: string = activeCurrency) =>
      convertCents(cents, from, to, rates.snapshot),
    [activeCurrency, rates.snapshot],
  );
  const ready = records.missingCurrencies.length === 0;
  return useMemo(
    () => ({
      ...records,
      checkedAt,
      rates: rates.snapshot,
      rateError: rates.error,
      refreshing,
      refreshRates,
      convert,
      isLoading,
      ready,
    }),
    [
      records,
      checkedAt,
      rates.snapshot,
      rates.error,
      refreshing,
      refreshRates,
      convert,
      isLoading,
      ready,
    ],
  );
}
const ReportingContext = createContext<ReturnType<
  typeof useReportingState
> | null>(null);
export function ReportingProvider({ children }: { children: ReactNode }) {
  const state = useReportingState();
  return (
    <ReportingContext.Provider value={state}>
      {children}
    </ReportingContext.Provider>
  );
}
export function useReportingData() {
  const value = useContext(ReportingContext);
  if (!value) throw new Error("ReportingProvider is required.");
  return value;
}
export function ReportingGuard({ children }: { children: ReactNode }) {
  const { ready, refreshing, currency } = useReportingData();
  if (!ready)
    return (
      <div className="ui-card p-5 text-sm" role="status">
        {refreshing
          ? "Loading exchange rates…"
          : `Totals in ${currency} are unavailable until exchange rates can be loaded. Original records remain available below.`}
      </div>
    );
  return children;
}
export function CurrencyRateSettings() {
  const {
    currency,
    rates,
    ready,
    missingCurrencies,
    rateError,
    refreshing,
    refreshRates,
    checkedAt,
  } = useReportingData();
  const stale = rates && checkedAt > Date.parse(rates.nextUpdateAt);
  return (
    <section className="ui-card p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Exchange rates</h2>
          <p className="mt-1 text-xs text-content-neutral-600">
            Reports use {currency}. Saved invoices and expenses keep their
            original currency.
          </p>
        </div>
        <button
          type="button"
          className="ui-button ui-button--secondary ui-button--small"
          disabled={refreshing}
          onClick={() => void refreshRates()}
        >
          {refreshing ? "Updating…" : "Refresh rates"}
        </button>
      </div>
      <p className="text-xs text-content-neutral-600" role="status">
        {rates
          ? `${stale ? "Cached rates" : "Rates"} from ${formatDateDisplay(rates.updatedAt.slice(0, 10))}. ${stale ? "They will refresh when a connection is available." : "Updated daily; available offline after the first update."}`
          : "Connect once to download exchange rates."}
        {!ready ? ` Rates needed for ${missingCurrencies.join(", ")}.` : ""}
        {rateError ? ` ${rateError}` : ""}
      </p>
      <a
        className="inline-block text-xs text-content-neutral-600 underline"
        href="https://www.exchangerate-api.com"
        onClick={(event) =>
          openExternalLink("https://www.exchangerate-api.com", event)
        }
      >
        Rates By Exchange Rate API
      </a>
    </section>
  );
}
export function ReportedMoney({
  cents,
  currency,
  className = "",
}: {
  cents: number;
  currency: string;
  className?: string;
}) {
  const reporting = useReportingData();
  const converted = reporting.convert(cents, currency);
  if (currency === reporting.currency)
    return <span className={className}>{formatCents(cents, currency)}</span>;
  return (
    <span className={`reported-money ${className}`}>
      <span className="reported-money-primary">
        {converted === null
          ? "Conversion unavailable"
          : formatCents(converted, reporting.currency)}
      </span>
      <small>
        ({formatCents(cents, currency)} {currency})
      </small>
    </span>
  );
}
