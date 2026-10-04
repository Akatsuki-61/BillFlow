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
  return `${symbol}${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
