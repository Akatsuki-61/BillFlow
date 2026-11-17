"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { useReportingData } from "@/context/ReportingContext";
import { useData } from "@/lib/data/DataProvider";
import { openExternalLink } from "@/lib/deliveryUrl";
import { MotionPresence, MotionSurface } from "./MotionSurface";

function useForeignRecords() {
  const { currency } = useReportingData();
  const { invoices, expenses, workOrders, catalogItems } = useData();
  return [...invoices, ...expenses, ...workOrders, ...catalogItems].some(
    (record) => record.currency !== currency,
  );
}

/** Brief feedback survives navigation, and resets when the workspace is locked or switched. */
export function CurrencyFeedback() {
  const { currency, rates, ready, refreshing, isLoading, checkedAt } =
    useReportingData();
  const foreign = useForeignRecords();
  const pathname = usePathname();
  const seen = useRef(new Set<string>());
  const [notice, setNotice] = useState<{
    key: string;
    message: string;
    warning: boolean;
  } | null>(null);
  const stale = Boolean(rates && checkedAt > Date.parse(rates.nextUpdateAt));
  const state = !ready ? "missing" : stale ? "cached" : "ready";
  const key = `${currency}:${state}:${rates?.updatedAt || "none"}`;
  useEffect(() => {
    if (!foreign || refreshing || isLoading || seen.current.has(key)) return;
    seen.current.add(key);
    // Settings already acknowledges currency changes and shows the complete rate details.
    if (pathname.startsWith("/settings")) return;
    const message = !ready
      ? `Connect to load exchange rates for ${currency} totals.`
      : stale
        ? `Using cached exchange rates for ${currency} totals.`
        : `Totals are shown in ${currency}. Original currencies are preserved.`;
    const timer = setTimeout(
      () => setNotice({ key, message, warning: !ready || stale }),
      0,
    );
    return () => clearTimeout(timer);
  }, [foreign, refreshing, isLoading, key, pathname, ready, stale, currency]);
  useEffect(() => {
    if (!pathname.startsWith("/settings")) return;
    const timer = setTimeout(() => setNotice(null), 0);
    return () => clearTimeout(timer);
  }, [pathname]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(
      () => setNotice(null),
      notice.warning ? 10_000 : 5_000,
    );
    return () => clearTimeout(timer);
  }, [notice]);
  return (
    <MotionPresence>
      {notice && (
        <MotionSurface
          key={notice.key}
          kind="toast"
          className="fixed bottom-6 right-6 z-[9999] flex max-w-[360px] items-start gap-3 rounded-xl border border-line-neutral-200 bg-surface p-3.5 text-content-neutral-950 shadow-xl app-no-drag"
        >
          {notice.warning ? (
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-content-amber-700" />
          ) : (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-content-emerald-700" />
          )}
          <div className="min-w-0 text-xs leading-relaxed">
            <p>{notice.message}</p>
            <Link
              className="mt-1 inline-block font-medium underline"
              href="/settings?tab=invoices"
              onClick={() => setNotice(null)}
            >
              Exchange rate settings
            </Link>
          </div>
          <button
            type="button"
            aria-label="Dismiss currency notification"
            className="flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-surface-neutral-100"
            onClick={() => setNotice(null)}
          >
            <X className="size-3.5" />
          </button>
        </MotionSurface>
      )}
    </MotionPresence>
  );
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
