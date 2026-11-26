"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useReportingData } from "@/context/ReportingContext";
import { useToast } from "@/context/ToastContext";
import { useData } from "@/lib/data/DataProvider";
import { openExternalLink } from "@/lib/deliveryUrl";

function useForeignRecords() {
  const { currency } = useReportingData();
  const { invoices, expenses, workOrders, catalogItems } = useData();
  return [...invoices, ...expenses, ...workOrders, ...catalogItems].some(
    (record) => record.currency !== currency,
  );
}

/** Brief feedback survives navigation, stacks cleanly with other toasts, and resets on lock/switch. */
export function CurrencyFeedback() {
  const { currency, rates, ready, refreshing, isLoading, checkedAt } =
    useReportingData();
  const { showToast, dismissToast } = useToast();
  const foreign = useForeignRecords();
  const pathname = usePathname();
  const seen = useRef(new Set<string>());
  const activeToastIdRef = useRef<number | null>(null);
  const stale = Boolean(rates && checkedAt > Date.parse(rates.nextUpdateAt));
  const state = !ready ? "missing" : stale ? "cached" : "ready";
  const key = `${currency}:${state}:${rates?.updatedAt || "none"}`;

  useEffect(() => {
    if (!foreign || refreshing || isLoading || seen.current.has(key)) return;
    seen.current.add(key);
    // Settings already acknowledges currency changes and shows the complete rate details.
    if (pathname.startsWith("/settings")) return;

    const warning = !ready || stale;
    const message = !ready
      ? `Connect to load exchange rates for ${currency} totals.`
      : stale
        ? `Using cached exchange rates for ${currency} totals.`
        : `Totals are shown in ${currency}. Original currencies are preserved.`;

    const id = showToast(
      <div className="min-w-0 text-xs leading-relaxed">
        <p>{message}</p>
        <Link
          className="mt-1 inline-block font-semibold text-accent underline underline-offset-2"
          href="/settings?tab=invoices"
          onClick={() => {
            if (activeToastIdRef.current !== null) {
              dismissToast(activeToastIdRef.current);
              activeToastIdRef.current = null;
            }
          }}
        >
          Exchange rate settings
        </Link>
      </div>,
      {
        type: warning ? "info" : "success",
        durationMs: warning ? 10_000 : 5_000,
        dedupeKey: "currency-feedback",
        className: "max-w-[360px] items-start",
        icon: warning ? (
          <AlertCircle className="size-4 text-content-amber-700" />
        ) : (
          <CheckCircle2 className="size-4" />
        ),
      },
    );
    activeToastIdRef.current = id;
  }, [
    foreign,
    refreshing,
    isLoading,
    key,
    pathname,
    ready,
    stale,
    currency,
    showToast,
    dismissToast,
  ]);

  useEffect(() => {
    if (pathname.startsWith("/settings") && activeToastIdRef.current !== null) {
      dismissToast(activeToastIdRef.current);
      activeToastIdRef.current = null;
    }
  }, [pathname, dismissToast]);

  return null;
}

/** The public rate service requires a discreet credit on views that use its rates. */
export function CurrencyAttribution() {
  const foreign = useForeignRecords();
  const pathname = usePathname();
  if (!foreign || pathname.startsWith("/settings")) return null;
  return (
    <div className="px-8 pb-5 pt-2 text-right text-[10px] text-content-neutral-500">
      <a
        className="underline underline-offset-2"
        href="https://www.exchangerate-api.com"
        onClick={(event) =>
          openExternalLink("https://www.exchangerate-api.com", event)
        }
      >
        Rates By Exchange Rate API
      </a>
    </div>
  );
}
