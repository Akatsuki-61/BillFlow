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
    const totalBalance = invoices.reduce(
      (sum, i) => sum + remainingBalance(i),
      0,
    );
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

export interface ClientOverdueSummaryRow {
  clientName: string;
  contactPerson: string;
  email: string;
  phone: string;
  currency: string;
  invoicesCount: number;
  invoiceCodes: string[];
  oldestDueDate: string;
  maxDaysOverdue: number;
  agingBucket:
    | "Current"
    | "1-15 Days"
    | "16-30 Days"
    | "31-60 Days"
    | "60+ Days";
  totalBilledCents: number;
  totalPaidCents: number;
  totalOverdueCents: number;
}

/**
 * Consolidates past-due invoices by client account for executive summary reporting.
 */
export function consolidateOverdueByClient(
  invoices: InvoiceWithClient[],
  referenceDate = new Date(),
): ClientOverdueSummaryRow[] {
  const todayKey = localDateKey(referenceDate);
  const overdueList = invoices.filter((inv) => isPastDue(inv, todayKey));

  const map = new Map<string, ClientOverdueSummaryRow>();

  for (const inv of overdueList) {
    const key = `${inv.clientName.trim().toLowerCase()}__${inv.currency}`;
    const days = calculateDaysOverdue(inv.dueDate, referenceDate);
    const balance = remainingBalance(inv);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        clientName: inv.clientName,
        contactPerson: inv.clientContactPerson || "",
        email: inv.clientEmail || "",
        phone: inv.clientPhone || "",
        currency: inv.currency,
        invoicesCount: 1,
        invoiceCodes: [inv.code],
        oldestDueDate: inv.dueDate || "",
        maxDaysOverdue: days,
        agingBucket: getAgingBucket(days),
        totalBilledCents: inv.amountCents,
        totalPaidCents: inv.paidCents ?? 0,
        totalOverdueCents: balance,
      });
    } else {
      existing.invoicesCount += 1;
      existing.invoiceCodes.push(inv.code);
      if (!existing.contactPerson && inv.clientContactPerson) {
        existing.contactPerson = inv.clientContactPerson;
      }
      if (!existing.email && inv.clientEmail) {
        existing.email = inv.clientEmail;
      }
      if (!existing.phone && inv.clientPhone) {
        existing.phone = inv.clientPhone;
      }
      if (
        inv.dueDate &&
        (!existing.oldestDueDate || inv.dueDate < existing.oldestDueDate)
      ) {
        existing.oldestDueDate = inv.dueDate;
      }
      if (days > existing.maxDaysOverdue) {
        existing.maxDaysOverdue = days;
        existing.agingBucket = getAgingBucket(days);
      }
      existing.totalBilledCents += inv.amountCents;
      existing.totalPaidCents += inv.paidCents ?? 0;
      existing.totalOverdueCents += balance;
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => b.totalOverdueCents - a.totalOverdueCents,
  );
}

/**
 * Generates a structured multi-block Executive Accounting Template CSV
 * suitable for Microsoft Excel, Google Sheets, and formal client audit statements.
 */
export function generateProfessionalOverdueTemplateCsv(
  invoices: InvoiceWithClient[],
  options?: {
    referenceDate?: Date;
    businessName?: string;
    primaryCurrency?: string;
  },
): string {
  const refDate = options?.referenceDate || new Date();
  const todayKey = localDateKey(refDate);
  const businessName = options?.businessName || "BillFlow Freelance Studio";

  const overdueList = invoices
    .filter((inv) => isPastDue(inv, todayKey))
    .sort(
      (a, b) =>
        calculateDaysOverdue(b.dueDate, refDate) -
        calculateDaysOverdue(a.dueDate, refDate),
    );

  const currency =
    options?.primaryCurrency || overdueList[0]?.currency || "LKR";
  const totalBilled = overdueList.reduce((sum, i) => sum + i.amountCents, 0);
  const totalPaid = overdueList.reduce((sum, i) => sum + (i.paidCents ?? 0), 0);
  const totalOverdue = overdueList.reduce(
    (sum, i) => sum + remainingBalance(i),
    0,
  );
  const clientGroups = consolidateOverdueByClient(overdueList, refDate);
  const maxDays =
    overdueList.length > 0
      ? Math.max(
          ...overdueList.map((i) => calculateDaysOverdue(i.dueDate, refDate)),
        )
      : 0;

  const bucketDefs: Array<{
    id: "1-15 Days" | "16-30 Days" | "31-60 Days" | "60+ Days";
    label: string;
    statusNote: string;
  }> = [
    {
      id: "1-15 Days",
      label: "1 - 15 Days Past Due",
      statusNote: "Recent Past Due (Grace / Courteous Reminder)",
    },
    {
      id: "16-30 Days",
      label: "16 - 30 Days Past Due",
      statusNote: "Moderate Delay (Follow-up Required)",
    },
    {
      id: "31-60 Days",
      label: "31 - 60 Days Past Due",
      statusNote: "Urgent Attention (Escalated Collection)",
    },
    {
      id: "60+ Days",
      label: "60+ Days Past Due",
      statusNote: "Critical Delinquency (Final Notice)",
    },
  ];

  const lines: string[] = [];

  // SECTION 1: REPORT STATEMENT HEADER
  lines.push(
    [
      escapeCsvField("STATEMENT TITLE"),
      escapeCsvField(
        "OVERDUE INVOICES & ACCOUNTS RECEIVABLE AGING STATEMENT",
      ),
    ].join(","),
  );
  lines.push(
    [escapeCsvField("PREPARED BY"), escapeCsvField(businessName)].join(","),
  );
  lines.push(
    [escapeCsvField("STATEMENT DATE"), escapeCsvField(todayKey)].join(","),
  );
  lines.push(
    [escapeCsvField("REPORTING CURRENCY"), escapeCsvField(currency)].join(","),
  );
  lines.push("");

  // SECTION 2: EXECUTIVE KPI SUMMARY TABLE
  lines.push(
    [
      escapeCsvField("EXECUTIVE KPI METRIC"),
      escapeCsvField("VALUE"),
      escapeCsvField("CURRENCY / UNIT"),
      escapeCsvField("AUDIT NOTE"),
    ].join(","),
  );
  lines.push(
    [
      escapeCsvField("Total Overdue Invoices"),
      escapeCsvField(overdueList.length),
      escapeCsvField("Invoices"),
      escapeCsvField("Open invoices past their payment due date"),
    ].join(","),
  );
  lines.push(
    [
      escapeCsvField("Delinquent Client Accounts"),
      escapeCsvField(clientGroups.length),
      escapeCsvField("Clients"),
      escapeCsvField("Distinct client accounts with unpaid overdue balances"),
    ].join(","),
  );
  lines.push(
    [
      escapeCsvField("Maximum Delinquency"),
      escapeCsvField(maxDays),
      escapeCsvField("Days"),
      escapeCsvField("Longest elapsed days past due date"),
    ].join(","),
  );
  lines.push(
    [
      escapeCsvField("Total Contract Billed"),
      escapeCsvField(centsToDecimalString(totalBilled)),
      escapeCsvField(currency),
      escapeCsvField("Gross billed value of overdue invoices"),
    ].join(","),
  );
  lines.push(
    [
      escapeCsvField("Total Advance / Partial Collected"),
      escapeCsvField(centsToDecimalString(totalPaid)),
      escapeCsvField(currency),
      escapeCsvField("Payments already received against these invoices"),
    ].join(","),
  );
  lines.push(
    [
      escapeCsvField("Total Overdue Balance Due"),
      escapeCsvField(centsToDecimalString(totalOverdue)),
      escapeCsvField(currency),
      escapeCsvField("Net outstanding balance requiring immediate settlement"),
    ].join(","),
  );
  lines.push("");

  // SECTION 3: AGING BUCKET BREAKDOWN MATRIX
  lines.push(
    [
      escapeCsvField("AGING BUCKET TIER"),
      escapeCsvField("INVOICE COUNT"),
      escapeCsvField("OVERDUE BALANCE"),
      escapeCsvField("SHARE OF PAST DUE (%)"),
      escapeCsvField("COLLECTION PRIORITY"),
    ].join(","),
  );
  for (const b of bucketDefs) {
    const matching = overdueList.filter(
      (i) => getAgingBucket(calculateDaysOverdue(i.dueDate, refDate)) === b.id,
    );
    const sumCents = matching.reduce((s, i) => s + remainingBalance(i), 0);
    const sharePct =
      totalOverdue > 0 ? ((sumCents / totalOverdue) * 100).toFixed(1) : "0.0";
    lines.push(
      [
        escapeCsvField(b.label),
        escapeCsvField(matching.length),
        escapeCsvField(centsToDecimalString(sumCents)),
        escapeCsvField(`${sharePct}%`),
        escapeCsvField(b.statusNote),
      ].join(","),
    );
  }
  lines.push("");

  // SECTION 4: ITEMIZED OVERDUE INVOICES LEDGER
  const ledgerHeaders = [
    "Row #",
    "Invoice Number",
    "Client Name",
    "Contact Person",
    "Client Email",
    "Client Phone",
    "Issue Date",
    "Due Date",
    "Days Overdue",
    "Aging Bucket",
    "Status",
    "Currency",
    "Billed Amount",
    "Paid Amount",
    "Overdue Balance Due",
    "Collection Progress (%)",
    "Delivery URL",
    "Notes",
  ];
  lines.push(ledgerHeaders.map(escapeCsvField).join(","));

  overdueList.forEach((inv, idx) => {
    const daysOverdue = calculateDaysOverdue(inv.dueDate, refDate);
    const agingBucket = getAgingBucket(daysOverdue);
    const overdueBalanceCents = remainingBalance(inv);
    const paidPct =
      inv.amountCents > 0
        ? (((inv.paidCents ?? 0) / inv.amountCents) * 100).toFixed(1)
        : "0.0";

    lines.push(
      [
        escapeCsvField(String(idx + 1).padStart(2, "0")),
        escapeCsvField(inv.code),
        escapeCsvField(inv.clientName),
        escapeCsvField(inv.clientContactPerson || ""),
        escapeCsvField(inv.clientEmail || ""),
        escapeCsvField(inv.clientPhone || ""),
        escapeCsvField(inv.issueDate || ""),
        escapeCsvField(inv.dueDate || ""),
        escapeCsvField(daysOverdue),
        escapeCsvField(agingBucket),
        escapeCsvField(inv.status),
        escapeCsvField(inv.currency),
        escapeCsvField(centsToDecimalString(inv.amountCents)),
        escapeCsvField(centsToDecimalString(inv.paidCents ?? 0)),
        escapeCsvField(centsToDecimalString(overdueBalanceCents)),
        escapeCsvField(`${paidPct}%`),
        escapeCsvField(inv.deliveryUrl || ""),
        escapeCsvField(inv.notes || ""),
      ].join(","),
    );
  });

  if (overdueList.length > 0) {
    const overallPaidPct =
      totalBilled > 0 ? ((totalPaid / totalBilled) * 100).toFixed(1) : "0.0";
    lines.push(
      [
        escapeCsvField("TOTAL"),
        escapeCsvField("GRAND TOTAL SUMMARY"),
        escapeCsvField(
          `${overdueList.length} invoices (${clientGroups.length} clients)`,
        ),
        "",
        "",
        "",
        "",
        "",
        escapeCsvField(`Max ${maxDays}d`),
        "",
        "",
        escapeCsvField(currency),
        escapeCsvField(centsToDecimalString(totalBilled)),
        escapeCsvField(centsToDecimalString(totalPaid)),
        escapeCsvField(centsToDecimalString(totalOverdue)),
        escapeCsvField(`${overallPaidPct}%`),
        "",
        "",
      ].join(","),
    );
  }

  return lines.join("\r\n");
}

/**
 * Generates Tab-Separated Values (TSV) for 1-click copy-pasting directly into Excel, Google Sheets, or Notion tables.
 */
export function generateOverdueTsvForClipboard(
  invoices: InvoiceWithClient[],
  referenceDate = new Date(),
): string {
  const todayKey = localDateKey(referenceDate);
  const overdueList = invoices
    .filter((inv) => isPastDue(inv, todayKey))
    .sort(
      (a, b) =>
        calculateDaysOverdue(b.dueDate, referenceDate) -
        calculateDaysOverdue(a.dueDate, referenceDate),
    );

  const headers = [
    "#",
    "Invoice Number",
    "Client Name",
    "Contact Person",
    "Email",
    "Phone",
    "Issue Date",
    "Due Date",
    "Days Overdue",
    "Aging Tier",
    "Currency",
    "Billed Amount",
    "Paid Amount",
    "Overdue Balance Due",
  ];

  const cleanTab = (v: unknown) =>
    String(v ?? "").replace(/[\t\r\n]+/g, " ").trim();

  const rows = overdueList.map((inv, idx) => {
    const days = calculateDaysOverdue(inv.dueDate, referenceDate);
    const bucket = getAgingBucket(days);
    const bal = remainingBalance(inv);
    return [
      String(idx + 1).padStart(2, "0"),
      cleanTab(inv.code),
      cleanTab(inv.clientName),
      cleanTab(inv.clientContactPerson || "-"),
      cleanTab(inv.clientEmail || "-"),
      cleanTab(inv.clientPhone || "-"),
      cleanTab(inv.issueDate || "-"),
      cleanTab(inv.dueDate || "-"),
      String(days),
      cleanTab(bucket),
      cleanTab(inv.currency),
      centsToDecimalString(inv.amountCents),
      centsToDecimalString(inv.paidCents ?? 0),
      centsToDecimalString(bal),
    ].join("\t");
  });

  if (overdueList.length > 0) {
    const totalBilled = overdueList.reduce((s, i) => s + i.amountCents, 0);
    const totalPaid = overdueList.reduce((s, i) => s + (i.paidCents ?? 0), 0);
    const totalOverdue = overdueList.reduce(
      (s, i) => s + remainingBalance(i),
      0,
    );
    const currency = overdueList[0]?.currency || "LKR";
    rows.push(
      [
        "TOTAL",
        `${overdueList.length} Invoices`,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        currency,
        centsToDecimalString(totalBilled),
        centsToDecimalString(totalPaid),
        centsToDecimalString(totalOverdue),
      ].join("\t"),
    );
  }

  return [headers.join("\t"), ...rows].join("\n");
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
