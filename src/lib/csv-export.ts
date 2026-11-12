import type { InvoiceWithClient } from "@/types/billing";
import {
  localDateKey,
  remainingBalance,
  isPastDue,
} from "@/lib/visual-metrics";

export type ExportFileFormat = "csv" | "excel";
export type ExportTemplateMode = "executive" | "flat";

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
  // Text from client records must remain text when opened by a spreadsheet.
  const str = spreadsheetText(value);
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

function spreadsheetText(value: unknown): string {
  const raw = String(value ?? "");
  return typeof value === "string" &&
    !/^-\d+(?:\.\d+)?$/.test(raw) &&
    /^[\s\u0000-\u001f]*[=+@-]/.test(raw)
    ? "'" + raw
    : raw;
}

/**
 * Escapes special XML characters for Excel SpreadsheetML output.
 */
export function escapeXml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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
  const currencies = [...new Set(invoices.map((invoice) => invoice.currency))];
  if (currencies.length > 1) {
    const blocks = currencies.map((currency) =>
      generateInvoicesCsv(
        invoices.filter((invoice) => invoice.currency === currency),
        options,
      ),
    );
    return [
      blocks[0],
      ...blocks
        .slice(1)
        .map((block) => block.slice(block.indexOf("\r\n") + "\r\n".length)),
    ].join("\r\n");
  }

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
  const currencies = [...new Set(invoices.map((invoice) => invoice.currency))];
  if (currencies.length > 1) {
    const blocks = currencies.map((currency) =>
      generateOverdueSummaryCsv(
        invoices.filter((invoice) => invoice.currency === currency),
        options,
      ),
    );
    return [
      blocks[0],
      ...blocks
        .slice(1)
        .map((block) => block.slice(block.indexOf("\r\n") + "\r\n".length)),
    ].join("\r\n");
  }

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
    const totalPaid = overdueList.reduce(
      (sum, i) => sum + (i.paidCents ?? 0),
      0,
    );
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
    "Current" | "1-15 Days" | "16-30 Days" | "31-60 Days" | "60+ Days";
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
    const key = `${inv.clientId || inv.clientName.trim().toLowerCase()}__${inv.currency}`;
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
  if (options?.primaryCurrency)
    invoices = invoices.filter(
      (invoice) => invoice.currency === options.primaryCurrency,
    );
  const currencies = [...new Set(invoices.map((invoice) => invoice.currency))];
  if (currencies.length > 1)
    return currencies
      .map((currency) =>
        generateProfessionalOverdueTemplateCsv(
          invoices.filter((invoice) => invoice.currency === currency),
          { ...options, primaryCurrency: currency },
        ),
      )
      .join("\r\n\r\n");

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
      escapeCsvField("OVERDUE INVOICES & ACCOUNTS RECEIVABLE AGING STATEMENT"),
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
  const currencies = [...new Set(invoices.map((invoice) => invoice.currency))];
  if (currencies.length > 1) {
    const blocks = currencies.map((currency) =>
      generateOverdueTsvForClipboard(
        invoices.filter((invoice) => invoice.currency === currency),
        referenceDate,
      ),
    );
    return [
      blocks[0],
      ...blocks
        .slice(1)
        .map((block) => block.slice(block.indexOf("\n") + "\n".length)),
    ].join("\n");
  }

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
    spreadsheetText(v)
      .replace(/[\t\r\n]+/g, " ")
      .trim();

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
 * Parses an RFC 4180 CSV string into a 2D array of rows and cell values.
 * Used by the CSV <-> Excel Conversion Engine.
 */
export function parseRfc4180Csv(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\r" && next === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        i++;
      } else if (char === "\n" || char === "\r") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += char;
      }
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

const EXCEL_WORKBOOK_STYLES = `
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#18181B"/>
    </Style>
    <Style ss:ID="TitleBanner">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="MetaLabel">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#475569"/>
      <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="MetaValue">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/>
      <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="TableHeader">
      <Alignment ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#065F46" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#064E3B"/>
      </Borders>
    </Style>
    <Style ss:ID="SectionHeader">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#1E293B"/>
      <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="DataCell">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>
    <Style ss:ID="CodeCell">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Consolas" ss:Size="10" ss:Bold="1" ss:Color="#4F46E5"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>
    <Style ss:ID="CurrencyCell">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#0F172A"/>
      <NumberFormat ss:Format="#,##0.00"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>
    <Style ss:ID="OverdueCurrencyCell">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#E11D48"/>
      <NumberFormat ss:Format="#,##0.00"/>
      <Interior ss:Color="#FFF1F2" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FECDD3"/>
      </Borders>
    </Style>
    <Style ss:ID="DaysOverdueCell">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#BE123C"/>
      <NumberFormat ss:Format="0"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>
    <Style ss:ID="TotalRowLabel">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#0F172A"/>
      <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#D97706"/>
        <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#D97706"/>
      </Borders>
    </Style>
    <Style ss:ID="TotalRowAmount">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#BE123C"/>
      <NumberFormat ss:Format="#,##0.00"/>
      <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#D97706"/>
        <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#D97706"/>
      </Borders>
    </Style>
  </Styles>
`;

/**
 * Conversion Engine: Converts any RFC 4180 CSV string into a styled Excel XML Workbook (.xls).
 * Automatically detects numeric decimals, headers, and summary rows.
 */
export function convertCsvToExcelWorkbook(
  csvText: string,
  options?: { sheetName?: string },
): string {
  const rows = parseRfc4180Csv(csvText);
  const sheetName = escapeXml(
    (options?.sheetName || "BillFlow Export").slice(0, 31),
  );

  const maxCols = rows.reduce((max, r) => Math.max(max, r.length), 0);
  const colDefs = Array.from(
    { length: maxCols },
    (_, idx) =>
      `<Column ss:Index="${idx + 1}" ss:AutoFitWidth="1" ss:Width="${idx <= 2 ? 150 : 110}"/>`,
  ).join("\n      ");

  const xmlRows = rows
    .map((cells, rowIdx) => {
      if (cells.length === 0 || (cells.length === 1 && cells[0] === "")) {
        return `<Row ss:Height="14"/>`;
      }

      const firstCell = (cells[0] || "").toUpperCase();
      const isHeader =
        rowIdx === 0 ||
        firstCell === "INVOICE NUMBER" ||
        firstCell === "ROW #" ||
        firstCell === "EXECUTIVE KPI METRIC" ||
        firstCell === "AGING BUCKET TIER";
      const isTotalRow =
        firstCell.includes("TOTAL") || firstCell === "GRAND TOTAL SUMMARY";
      const isMetaRow =
        firstCell === "STATEMENT TITLE" ||
        firstCell === "PREPARED BY" ||
        firstCell === "STATEMENT DATE" ||
        firstCell === "REPORTING CURRENCY";

      const rowHeight = isHeader ? 24 : isTotalRow ? 22 : 18;

      const xmlCells = cells
        .map((val, colIdx) => {
          const trimmed = val.trim();
          const isNumericDecimal = /^-?\d+\.\d{2}$/.test(trimmed);
          const isInteger =
            /^\d+$/.test(trimmed) &&
            !trimmed.startsWith("0") &&
            trimmed.length < 9;

          let styleId = "DataCell";
          if (isHeader) styleId = "TableHeader";
          else if (isTotalRow)
            styleId = isNumericDecimal ? "TotalRowAmount" : "TotalRowLabel";
          else if (isMetaRow)
            styleId = colIdx === 0 ? "MetaLabel" : "MetaValue";
          else if (isNumericDecimal) styleId = "CurrencyCell";
          else if (colIdx === 0 && trimmed.startsWith("INV-"))
            styleId = "CodeCell";

          if (
            !isHeader &&
            !isMetaRow &&
            (isNumericDecimal || (isInteger && colIdx > 0))
          ) {
            return `<Cell ss:StyleID="${styleId}"><Data ss:Type="Number">${escapeXml(trimmed)}</Data></Cell>`;
          }
          return `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(val)}</Data></Cell>`;
        })
        .join("");

      return `<Row ss:Height="${rowHeight}">${xmlCells}</Row>`;
    })
    .join("\n        ");

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<?mso-application progid="Excel.Sheet"?>`,
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"`,
    ` xmlns:o="urn:schemas-microsoft-com:office:office"`,
    ` xmlns:x="urn:schemas-microsoft-com:office:excel"`,
    ` xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">`,
    EXCEL_WORKBOOK_STYLES,
    `  <Worksheet ss:Name="${sheetName}">`,
    `    <Table>`,
    `      ${colDefs}`,
    `      ${xmlRows}`,
    `    </Table>`,
    `  </Worksheet>`,
    `</Workbook>`,
  ].join("\n");
}

/**
 * Generates a dedicated multi-worksheet Excel Workbook (.xls) for Overdue Invoices:
 * - Worksheet 1: "Overdue Aging Ledger" (Executive KPIs + Aging Matrix + Itemized Overdue Table)
 * - Worksheet 2: "Client Consolidation" (Grouped by Client Account)
 */
export function generateOverdueExcelWorkbook(
  invoices: InvoiceWithClient[],
  options?: {
    referenceDate?: Date;
    businessName?: string;
    primaryCurrency?: string;
    includeClientRollup?: boolean;
  },
): string {
  if (options?.primaryCurrency)
    invoices = invoices.filter(
      (invoice) => invoice.currency === options.primaryCurrency,
    );
  const currencies = [...new Set(invoices.map((invoice) => invoice.currency))];
  if (currencies.length > 1) {
    const workbooks = currencies.map((currency) =>
      generateOverdueExcelWorkbook(
        invoices.filter((invoice) => invoice.currency === currency),
        { ...options, primaryCurrency: currency },
      ).replace(
        /ss:Name="([^"]+)"/g,
        (_match, name: string) => `ss:Name="${currency} ${name}"`,
      ),
    );
    const worksheets = workbooks
      .flatMap((book) => book.match(/<Worksheet\b[\s\S]*?<\/Worksheet>/g) || [])
      .join("\n");
    return workbooks[0].replace(/<Worksheet\b[\s\S]*<\/Worksheet>/, worksheets);
  }

  const refDate = options?.referenceDate || new Date();
  const execCsv = generateProfessionalOverdueTemplateCsv(invoices, options);
  const clientGroups = consolidateOverdueByClient(invoices, refDate);
  const currency =
    options?.primaryCurrency || clientGroups[0]?.currency || "LKR";

  // Build Worksheet 1 rows from Executive Template CSV via conversion engine
  const sheet1Workbook = convertCsvToExcelWorkbook(execCsv, {
    sheetName: "Overdue Aging Ledger",
  });

  if (options?.includeClientRollup === false) {
    return sheet1Workbook;
  }

  // Build Worksheet 2 for Client Consolidation
  const clientHeaders = [
    "Rank",
    "Client Name",
    "Contact Person",
    "Client Email",
    "Client Phone",
    "Overdue Invoices Count",
    "Invoice Codes",
    "Oldest Due Date",
    "Max Days Overdue",
    "Aging Bucket",
    "Currency",
    "Total Billed",
    "Total Paid",
    "Consolidated Overdue Balance",
  ];

  const clientHeaderXml = `<Row ss:Height="24">${clientHeaders
    .map(
      (h) =>
        `<Cell ss:StyleID="TableHeader"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`,
    )
    .join("")}</Row>`;

  const clientRowsXml = clientGroups
    .map((c, idx) => {
      return [
        `<Row ss:Height="19">`,
        `<Cell ss:StyleID="DataCell"><Data ss:Type="Number">${idx + 1}</Data></Cell>`,
        `<Cell ss:StyleID="DataCell"><Data ss:Type="String">${escapeXml(c.clientName)}</Data></Cell>`,
        `<Cell ss:StyleID="DataCell"><Data ss:Type="String">${escapeXml(c.contactPerson || "-")}</Data></Cell>`,
        `<Cell ss:StyleID="DataCell"><Data ss:Type="String">${escapeXml(c.email || "-")}</Data></Cell>`,
        `<Cell ss:StyleID="DataCell"><Data ss:Type="String">${escapeXml(c.phone || "-")}</Data></Cell>`,
        `<Cell ss:StyleID="DaysOverdueCell"><Data ss:Type="Number">${c.invoicesCount}</Data></Cell>`,
        `<Cell ss:StyleID="CodeCell"><Data ss:Type="String">${escapeXml(c.invoiceCodes.join(", "))}</Data></Cell>`,
        `<Cell ss:StyleID="DataCell"><Data ss:Type="String">${escapeXml(c.oldestDueDate)}</Data></Cell>`,
        `<Cell ss:StyleID="DaysOverdueCell"><Data ss:Type="Number">${c.maxDaysOverdue}</Data></Cell>`,
        `<Cell ss:StyleID="DataCell"><Data ss:Type="String">${escapeXml(c.agingBucket)}</Data></Cell>`,
        `<Cell ss:StyleID="DataCell"><Data ss:Type="String">${escapeXml(c.currency)}</Data></Cell>`,
        `<Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${centsToDecimalString(c.totalBilledCents)}</Data></Cell>`,
        `<Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${centsToDecimalString(c.totalPaidCents)}</Data></Cell>`,
        `<Cell ss:StyleID="OverdueCurrencyCell"><Data ss:Type="Number">${centsToDecimalString(c.totalOverdueCents)}</Data></Cell>`,
        `</Row>`,
      ].join("");
    })
    .join("\n        ");

  const grandBilled = clientGroups.reduce((s, c) => s + c.totalBilledCents, 0);
  const grandPaid = clientGroups.reduce((s, c) => s + c.totalPaidCents, 0);
  const grandOverdue = clientGroups.reduce(
    (s, c) => s + c.totalOverdueCents,
    0,
  );
  const totalInvoicesCount = clientGroups.reduce(
    (s, c) => s + c.invoicesCount,
    0,
  );

  const clientTotalXml =
    clientGroups.length > 0
      ? [
          `<Row ss:Height="22">`,
          `<Cell ss:StyleID="TotalRowLabel"><Data ss:Type="String">TOTAL</Data></Cell>`,
          `<Cell ss:StyleID="TotalRowLabel"><Data ss:Type="String">${clientGroups.length} Delinquent Clients</Data></Cell>`,
          `<Cell ss:StyleID="TotalRowLabel"><Data ss:Type="String"/></Cell>`,
          `<Cell ss:StyleID="TotalRowLabel"><Data ss:Type="String"/></Cell>`,
          `<Cell ss:StyleID="TotalRowLabel"><Data ss:Type="String"/></Cell>`,
          `<Cell ss:StyleID="TotalRowLabel"><Data ss:Type="Number">${totalInvoicesCount}</Data></Cell>`,
          `<Cell ss:StyleID="TotalRowLabel"><Data ss:Type="String"/></Cell>`,
          `<Cell ss:StyleID="TotalRowLabel"><Data ss:Type="String"/></Cell>`,
          `<Cell ss:StyleID="TotalRowLabel"><Data ss:Type="String"/></Cell>`,
          `<Cell ss:StyleID="TotalRowLabel"><Data ss:Type="String"/></Cell>`,
          `<Cell ss:StyleID="TotalRowLabel"><Data ss:Type="String">${escapeXml(currency)}</Data></Cell>`,
          `<Cell ss:StyleID="TotalRowAmount"><Data ss:Type="Number">${centsToDecimalString(grandBilled)}</Data></Cell>`,
          `<Cell ss:StyleID="TotalRowAmount"><Data ss:Type="Number">${centsToDecimalString(grandPaid)}</Data></Cell>`,
          `<Cell ss:StyleID="TotalRowAmount"><Data ss:Type="Number">${centsToDecimalString(grandOverdue)}</Data></Cell>`,
          `</Row>`,
        ].join("")
      : "";

  const sheet2Xml = [
    `  <Worksheet ss:Name="Client Consolidation">`,
    `    <Table>`,
    `      <Column ss:Index="1" ss:Width="55"/>`,
    `      <Column ss:Index="2" ss:Width="170"/>`,
    `      <Column ss:Index="3" ss:Width="130"/>`,
    `      <Column ss:Index="4" ss:Width="160"/>`,
    `      <Column ss:Index="5" ss:Width="115"/>`,
    `      <Column ss:Index="6" ss:Width="120"/>`,
    `      <Column ss:Index="7" ss:Width="150"/>`,
    `      <Column ss:Index="8" ss:Width="100"/>`,
    `      <Column ss:Index="9" ss:Width="110"/>`,
    `      <Column ss:Index="10" ss:Width="100"/>`,
    `      <Column ss:Index="11" ss:Width="75"/>`,
    `      <Column ss:Index="12" ss:Width="120"/>`,
    `      <Column ss:Index="13" ss:Width="120"/>`,
    `      <Column ss:Index="14" ss:Width="150"/>`,
    `      ${clientHeaderXml}`,
    `      ${clientRowsXml}`,
    `      ${clientTotalXml}`,
    `    </Table>`,
    `  </Worksheet>`,
  ].join("\n");

  return sheet1Workbook.replace("</Workbook>", `${sheet2Xml}\n</Workbook>`);
}

/**
 * Generates an Excel Workbook (.xls) for a general list of invoices via the CSV->Excel conversion engine.
 */
export function generateInvoicesExcelWorkbook(
  invoices: InvoiceWithClient[],
  options?: {
    referenceDate?: Date;
    sheetName?: string;
    includeSummaryRow?: boolean;
  },
): string {
  const csv = generateInvoicesCsv(invoices, {
    referenceDate: options?.referenceDate,
    includeSummaryRow: options?.includeSummaryRow ?? true,
  });
  return convertCsvToExcelWorkbook(csv, {
    sheetName: options?.sheetName || "Invoices Register",
  });
}

/**
 * Initiates download of a CSV file in the user's browser or Electron desktop environment.
 */
export function downloadCsvFile(filename: string, csvContent: string): void {
  if (typeof window === "undefined") return;
  const normalizedName = filename.toLowerCase().endsWith(".csv")
    ? filename
    : `${filename}.csv`;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", normalizedName);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Initiates download of a styled Excel SpreadsheetML Workbook (.xls) in browser or Electron.
 */
export function downloadExcelFile(filename: string, workbookXml: string): void {
  if (typeof window === "undefined") return;
  const normalizedName = filename.toLowerCase().endsWith(".xls")
    ? filename
    : `${filename.replace(/\.csv$/i, "")}.xls`;
  const blob = new Blob([workbookXml], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", normalizedName);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
