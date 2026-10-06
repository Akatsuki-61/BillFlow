import { Currency } from "@/types/billing";

export const getCurrencySymbol = (currency: string): string => {
  switch (currency.toUpperCase()) {
    case "LKR":
      return "Rs. ";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "CAD":
      return "CA$";
    case "USD":
    default:
      return "$";
  }
};

export const formatCents = (cents: number, currency: string = "USD"): string => {
  const symbol = getCurrencySymbol(currency);
  const amount = (cents || 0) / 100;
  if (amount < 0) {
    return `-${symbol}${Math.abs(amount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `${symbol}${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const formatCurrencyAmount = (amount: number, currency: string = "USD"): string => {
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const getActiveInvoiceCurrency = (
  invoices?: Array<{ currency?: string; updatedAt?: string; createdAt?: string; issueDate?: string }>,
  fallbackCurrency: string = "USD"
): Currency => {
  if (!invoices || invoices.length === 0) {
    return (fallbackCurrency as Currency) || "USD";
  }
  const sorted = [...invoices].sort((a, b) => {
    const timeA = new Date(a.updatedAt || a.createdAt || a.issueDate || 0).getTime();
    const timeB = new Date(b.updatedAt || b.createdAt || b.issueDate || 0).getTime();
    return timeB - timeA;
  });
  return (sorted[0]?.currency as Currency) || (fallbackCurrency as Currency) || "USD";
};

/**
 * Returns the effective system currency chosen by the user in Settings.
 * Prioritizes user's explicit defaultCurrency setting, then latest invoice currency, then USD fallback.
 */
export const getSystemCurrency = (
  settingsCurrency?: string | null,
  invoices?: Array<{ currency?: string; updatedAt?: string; createdAt?: string; issueDate?: string }>,
  fallbackCurrency: string = "USD"
): Currency => {
  if (settingsCurrency && settingsCurrency.trim() !== "") {
    return settingsCurrency as Currency;
  }
  return getActiveInvoiceCurrency(invoices, fallbackCurrency);
};

export const parseAmountToCents = (val: string | number): number => {
  if (typeof val === "number") return Math.round(val * 100);
  const clean = val.replace(/[^0-9.-]+/g, "");
  const num = parseFloat(clean);
  if (isNaN(num) || num < 0) return 0;
  return Math.round(num * 100);
};

export const formatDateDisplay = (isoStr?: string | null): string => {
  if (!isoStr || isoStr === "Not Set" || isoStr === "Pending") return isoStr || "Not Set";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoStr;
  }
};
