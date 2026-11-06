import type { InvoiceWithClient } from "@/types/billing";
import { localDateKey, remainingBalance, isPastDue } from "@/lib/visual-metrics";

/**
 * Escapes a single CSV value following the RFC 4180 specification.
 * - Null or undefined values become empty strings.
 * - Wraps in double quotes if it contains commas, double quotes, or newlines.
 * - Escapes existing double quotes as `""`.
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (
    str.includes('"') ||
    str.includes(",") ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Formats integer minor units (cents) to a 2-decimal string without currency symbols.
 * Example: 8000000 -> "80000.00"
 */
export function centsToDecimalString(cents: number): string {
  const amount = (cents || 0) / 100;
  return amount.toFixed(2);
}

/**
 * Calculates how many days an invoice is past its due date.
 * Returns 0 if dueDate is missing or if the invoice is not past due.
 */
export function calculateDaysOverdue(
  dueDate?: string | null,
  referenceDate = new Date(),
): number {
  if (!dueDate) return 0;
  const due = new Date(`${dueDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(due.getTime())) return 0;

  const ref = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  const diffMs = ref.getTime() - due.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Categorizes elapsed overdue days into standard accounts receivable aging buckets.
 */
export function getAgingBucket(
  daysOverdue: number,
): "Current" | "1-15 Days" | "16-30 Days" | "31-60 Days" | "60+ Days" {
  if (daysOverdue <= 0) return "Current";
  if (daysOverdue <= 15) return "1-15 Days";
  if (daysOverdue <= 30) return "16-30 Days";
  if (daysOverdue <= 60) return "31-60 Days";
  return "60+ Days";
}

/**
 * Builds RFC 4180 CSV string for a general list of invoices.
 */
export function generateInvoicesCsv(
  invoices: InvoiceWithClient[],
  options?: { referenceDate?: Date; includeSummaryRow?: boolean },
): string {
  const refDate = options?.referenceDate || new Date();
  const headers = [
    "Invoice Number",
    "Client Name",
    "Contact Person",
    "Email",
    "Phone",
    "Category",
    "Issue Date",
    "Due Date",
    "Status",
    "Days Overdue",
    "Aging Bucket",
    "Currency",
    "Total Billed",
    "Paid Amount",
    "Balance Due",
    "Delivery URL",
    "Notes",
  ];

  const rows = invoices.map((inv) => {
    const daysOverdue = calculateDaysOverdue(inv.dueDate, refDate);
    const agingBucket = getAgingBucket(daysOverdue);
    const balanceCents = remainingBalance(inv);

    return [
      escapeCsvField(inv.code),
      escapeCsvField(inv.clientName),
      escapeCsvField(inv.clientContactPerson || ""),
      escapeCsvField(inv.clientEmail || ""),
      escapeCsvField(inv.clientPhone || ""),
      escapeCsvField(inv.clientCategory || ""),
      escapeCsvField(inv.issueDate || ""),
      escapeCsvField(inv.dueDate || ""),
      escapeCsvField(inv.status),
      escapeCsvField(daysOverdue > 0 ? daysOverdue : 0),
      escapeCsvField(agingBucket),
      escapeCsvField(inv.currency),
      escapeCsvField(centsToDecimalString(inv.amountCents)),
      escapeCsvField(centsToDecimalString(inv.paidCents ?? 0)),
      escapeCsvField(centsToDecimalString(balanceCents)),
      escapeCsvField(inv.deliveryUrl || ""),
      escapeCsvField(inv.notes || ""),
    ].join(",");
  });

  if (options?.includeSummaryRow && invoices.length > 0) {
    const totalBilled = invoices.reduce((sum, i) => sum + i.amountCents, 0);
    const totalPaid = invoices.reduce((sum, i) => sum + (i.paidCents ?? 0), 0);
    const totalBalance = invoices.reduce((sum, i) => sum + remainingBalance(i), 0);
    const currency = invoices[0]?.currency || "USD";

    const summaryRow = [
      escapeCsvField("TOTALS"),
      escapeCsvField(`${invoices.length} invoices`),
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      escapeCsvField(currency),
      escapeCsvField(centsToDecimalString(totalBilled)),
      escapeCsvField(centsToDecimalString(totalPaid)),
      escapeCsvField(centsToDecimalString(totalBalance)),
      "",
      "",
    ].join(",");
    rows.push(summaryRow);
  }

  return [headers.join(","), ...rows].join("\r\n");
}

/**
 * Builds RFC 4180 CSV string specialized for accounts receivable overdue summary and aging report.
 */
export function generateOverdueSummaryCsv(
  invoices: InvoiceWithClient[],
  options?: { referenceDate?: Date },
): string {
  const refDate = options?.referenceDate || new Date();
  const todayKey = localDateKey(refDate);

  // Filter only genuinely overdue invoices with remaining balance
  const overdueList = invoices
    .filter((inv) => isPastDue(inv, todayKey))
    .sort((a, b) => {
      const daysA = calculateDaysOverdue(a.dueDate, refDate);
      const daysB = calculateDaysOverdue(b.dueDate, refDate);
      return daysB - daysA; // Most delinquent first
    });

  const headers = [
    "Invoice Number",
    "Client Name",
    "Contact Person",
    "Client Email",
    "Client Phone",
    "Issue Date",
    "Due Date",
    "Days Overdue",
    "Aging Bucket",
    "Currency",
    "Billed Amount",
    "Paid Amount",
    "Overdue Balance Due",
    "Delivery URL",
    "Notes",
  ];

  const rows = overdueList.map((inv) => {
    const daysOverdue = calculateDaysOverdue(inv.dueDate, refDate);
    const agingBucket = getAgingBucket(daysOverdue);
    const overdueBalanceCents = remainingBalance(inv);

    return [
      escapeCsvField(inv.code),
      escapeCsvField(inv.clientName),
      escapeCsvField(inv.clientContactPerson || ""),
      escapeCsvField(inv.clientEmail || ""),
      escapeCsvField(inv.clientPhone || ""),
      escapeCsvField(inv.issueDate || ""),
      escapeCsvField(inv.dueDate || ""),
      escapeCsvField(daysOverdue),
      escapeCsvField(agingBucket),
      escapeCsvField(inv.currency),
      escapeCsvField(centsToDecimalString(inv.amountCents)),
      escapeCsvField(centsToDecimalString(inv.paidCents ?? 0)),
      escapeCsvField(centsToDecimalString(overdueBalanceCents)),
      escapeCsvField(inv.deliveryUrl || ""),
      escapeCsvField(inv.notes || ""),
    ].join(",");
  });

  if (overdueList.length > 0) {
    const totalBilled = overdueList.reduce((sum, i) => sum + i.amountCents, 0);
    const totalPaid = overdueList.reduce((sum, i) => sum + (i.paidCents ?? 0), 0);
    const totalOverdue = overdueList.reduce(
      (sum, i) => sum + remainingBalance(i),
      0,
    );
    const currency = overdueList[0]?.currency || "USD";

    const summaryRow = [
      escapeCsvField("TOTAL OVERDUE SUMMARY"),
      escapeCsvField(`${overdueList.length} past-due invoices`),
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      escapeCsvField(currency),
      escapeCsvField(centsToDecimalString(totalBilled)),
      escapeCsvField(centsToDecimalString(totalPaid)),
      escapeCsvField(centsToDecimalString(totalOverdue)),
      "",
      "",
    ].join(",");
    rows.push(summaryRow);
  }

  return [headers.join(","), ...rows].join("\r\n");
}

/**
 * Initiates download of a CSV file in the user's browser or Electron desktop environment.
 */
export function downloadCsvFile(filename: string, csvContent: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
