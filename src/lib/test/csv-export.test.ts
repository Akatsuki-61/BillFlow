import { describe, it, expect } from "vitest";
import {
  escapeCsvField,
  centsToDecimalString,
  calculateDaysOverdue,
  getAgingBucket,
  generateInvoicesCsv,
  generateOverdueSummaryCsv,
  consolidateOverdueByClient,
  generateProfessionalOverdueTemplateCsv,
  generateOverdueTsvForClipboard,
  parseRfc4180Csv,
  convertCsvToExcelWorkbook,
  generateOverdueExcelWorkbook,
  generateInvoicesExcelWorkbook,
} from "../csv-export";
import type { InvoiceWithClient } from "@/types/billing";

describe("CSV Export & Overdue Analysis Engine", () => {
  describe("escapeCsvField", () => {
    it("handles null and undefined by returning an empty string", () => {
      expect(escapeCsvField(null)).toBe("");
      expect(escapeCsvField(undefined)).toBe("");
    });

    it("leaves standard alphanumeric strings untouched", () => {
      expect(escapeCsvField("INV-2026-001")).toBe("INV-2026-001");
      expect(escapeCsvField(12345)).toBe("12345");
    });

    it("wraps strings with commas in double quotes", () => {
      expect(escapeCsvField("Acme, Inc.")).toBe('"Acme, Inc."');
    });

    it("escapes quotes by doubling them and wrapping in quotes", () => {
      expect(escapeCsvField('Website "Redesign" Sprint')).toBe(
        '"Website ""Redesign"" Sprint"',
      );
    });

    it("wraps multiline text with newlines or carriage returns in quotes", () => {
      expect(escapeCsvField("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
      expect(escapeCsvField("Line 1\r\nLine 2")).toBe('"Line 1\r\nLine 2"');
    });
  });

  describe("centsToDecimalString", () => {
    it("formats integer cents into exact 2-decimal currency string", () => {
      expect(centsToDecimalString(8000000)).toBe("80000.00");
      expect(centsToDecimalString(12550)).toBe("125.50");
      expect(centsToDecimalString(0)).toBe("0.00");
      expect(centsToDecimalString(75)).toBe("0.75");
    });
  });

  describe("calculateDaysOverdue & getAgingBucket", () => {
    const fixedNow = new Date("2026-11-05T12:00:00Z");

    it("returns 0 if due date is missing or in the future", () => {
      expect(calculateDaysOverdue(null, fixedNow)).toBe(0);
      expect(calculateDaysOverdue("2026-11-10", fixedNow)).toBe(0);
      expect(calculateDaysOverdue("2026-11-05", fixedNow)).toBe(0);
    });

    it("correctly calculates overdue days for past due dates", () => {
      // 5 days ago (2026-10-31)
      expect(calculateDaysOverdue("2026-10-31", fixedNow)).toBe(5);
      // 20 days ago (2026-10-16)
      expect(calculateDaysOverdue("2026-10-16", fixedNow)).toBe(20);
      // 40 days ago (2026-09-26)
      expect(calculateDaysOverdue("2026-09-26", fixedNow)).toBe(40);
      // 70 days ago (2026-08-27)
      expect(calculateDaysOverdue("2026-08-27", fixedNow)).toBe(70);
    });

    it("categorizes days overdue into standard aging buckets", () => {
      expect(getAgingBucket(0)).toBe("Current");
      expect(getAgingBucket(7)).toBe("1-15 Days");
      expect(getAgingBucket(15)).toBe("1-15 Days");
      expect(getAgingBucket(22)).toBe("16-30 Days");
      expect(getAgingBucket(30)).toBe("16-30 Days");
      expect(getAgingBucket(45)).toBe("31-60 Days");
      expect(getAgingBucket(60)).toBe("31-60 Days");
      expect(getAgingBucket(75)).toBe("60+ Days");
    });
  });

  describe("generateInvoicesCsv", () => {
    const mockInvoices: InvoiceWithClient[] = [
      {
        id: "inv-1",
        code: "INV-2026-001",
        clientId: "cli-1",
        clientName: "Alpha Software Ltd",
        clientContactPerson: "Nimal Perera",
        clientEmail: "nimal@alphasoft.lk",
        clientPhone: "+94 77 123 4567",
        clientCategory: "Enterprise",
        issueDate: "2026-10-01",
        dueDate: "2026-10-15",
        status: "OVERDUE",
        amountCents: 9000000,
        paidCents: 4500000,
        currency: "LKR",
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-01T00:00:00Z",
        deliveryUrl: "https://github.com/org/alpha-repo",
        notes: "First milestone advance paid",
      },
      {
        id: "inv-2",
        code: "INV-2026-002",
        clientId: "cli-2",
        clientName: "Beta Consulting, Inc.",
        clientContactPerson: "Sarah Jones",
        clientEmail: "sarah@betaconsult.com",
        clientPhone: "+1 555 987 6543",
        clientCategory: "Startup",
        issueDate: "2026-10-20",
        dueDate: "2026-11-20",
        status: "UNPAID",
        amountCents: 350000,
        paidCents: 0,
        currency: "USD",
        createdAt: "2026-10-20T00:00:00Z",
        updatedAt: "2026-10-20T00:00:00Z",
        deliveryUrl: "https://staging.beta.io",
        notes: 'Includes 10% "early bird" discount',
      },
    ];

    it("generates valid RFC 4180 CSV with headers and escaped fields", () => {
      const csv = generateInvoicesCsv(mockInvoices, {
        referenceDate: new Date("2026-11-05T12:00:00Z"),
      });

      const lines = csv.split("\r\n");
      expect(lines.length).toBe(3); // 1 header + 2 invoice rows

      // Header row
      expect(lines[0]).toContain("Invoice Number,Client Name");
      expect(lines[0]).toContain("Days Overdue,Aging Bucket");
      expect(lines[0]).toContain("Balance Due");

      // Row 1 (INV-2026-001)
      expect(lines[1]).toContain("INV-2026-001,Alpha Software Ltd");
      expect(lines[1]).toContain("90000.00,45000.00,45000.00");
      expect(lines[1]).toContain("LKR");
      expect(lines[1]).toContain("16-30 Days"); // 21 days overdue

      // Row 2 (Beta Consulting, Inc. with escaped commas and quotes)
      expect(lines[2]).toContain('"Beta Consulting, Inc."');
      expect(lines[2]).toContain('"Includes 10% ""early bird"" discount"');
      expect(lines[2]).toContain("Current");
    });

    it("appends summary row when includeSummaryRow is enabled", () => {
      const csv = generateInvoicesCsv(mockInvoices, {
        referenceDate: new Date("2026-11-05T12:00:00Z"),
        includeSummaryRow: true,
      });

      const lines = csv.split("\r\n");
      expect(lines.length).toBe(5); // Header + two records + a separate summary per currency.
      const summaries = lines.filter((line) => line.startsWith("TOTALS"));
      expect(summaries).toHaveLength(2);
      expect(summaries.every((line) => line.includes("1 invoices"))).toBe(true);
      expect(summaries.some((line) => line.includes("LKR"))).toBe(true);
      expect(summaries.some((line) => line.includes("USD"))).toBe(true);
    });
  });

  describe("generateOverdueSummaryCsv", () => {
    const fixedNow = new Date("2026-11-05T12:00:00Z");

    const mockInvoices: InvoiceWithClient[] = [
      {
        id: "inv-overdue-1",
        code: "INV-2026-001",
        clientId: "cli-1",
        clientName: "Lanka Retail Systems",
        clientContactPerson: "Nimal",
        clientEmail: "nimal@retail.lk",
        clientPhone: "0771234567",
        issueDate: "2026-10-01",
        dueDate: "2026-10-15", // 21 days overdue
        status: "OVERDUE",
        amountCents: 9000000,
        paidCents: 4500000, // 45,000 remaining
        currency: "LKR",
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-01T00:00:00Z",
      },
      {
        id: "inv-overdue-2",
        code: "INV-2026-002",
        clientId: "cli-2",
        clientName: "Cyber Solutions",
        clientContactPerson: "Devon",
        clientEmail: "devon@cybersol.com",
        clientPhone: "0718889999",
        issueDate: "2026-09-01",
        dueDate: "2026-09-20", // 46 days overdue
        status: "OVERDUE",
        amountCents: 2000000,
        paidCents: 0, // 20,000 remaining
        currency: "LKR",
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-01T00:00:00Z",
      },
      {
        id: "inv-paid",
        code: "INV-2026-003",
        clientId: "cli-3",
        clientName: "Completed Client",
        issueDate: "2026-09-01",
        dueDate: "2026-09-15",
        status: "PAID",
        amountCents: 5000000,
        paidCents: 5000000, // Fully paid -> should NOT appear in overdue summary!
        currency: "LKR",
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-01T00:00:00Z",
      },
      {
        id: "inv-future",
        code: "INV-2026-004",
        clientId: "cli-4",
        clientName: "Upcoming Client",
        issueDate: "2026-11-01",
        dueDate: "2026-11-25", // Future due date -> should NOT appear!
        status: "UNPAID",
        amountCents: 4000000,
        paidCents: 0,
        currency: "LKR",
        createdAt: "2026-11-01T00:00:00Z",
        updatedAt: "2026-11-01T00:00:00Z",
      },
    ];

    it("filters out fully paid and future invoices, keeping only genuinely overdue balances", () => {
      const csv = generateOverdueSummaryCsv(mockInvoices, {
        referenceDate: fixedNow,
      });

      const lines = csv.split("\r\n");
      // Header + 2 overdue invoices + 1 summary line = 4 lines
      expect(lines.length).toBe(4);

      // Verify header
      expect(lines[0]).toContain("Invoice Number,Client Name");
      expect(lines[0]).toContain("Days Overdue,Aging Bucket");
      expect(lines[0]).toContain("Overdue Balance Due");

      // Verify sorting: Most overdue first (inv-overdue-2 at 46 days before inv-overdue-1 at 21 days)
      expect(lines[1]).toContain("INV-2026-002");
      expect(lines[1]).toContain("46"); // Days overdue
      expect(lines[1]).toContain("31-60 Days"); // Aging bucket
      expect(lines[1]).toContain("20000.00"); // Balance

      expect(lines[2]).toContain("INV-2026-001");
      expect(lines[2]).toContain("21"); // Days overdue
      expect(lines[2]).toContain("16-30 Days"); // Aging bucket
      expect(lines[2]).toContain("45000.00"); // Balance

      // Verify summary line
      expect(lines[3]).toContain("TOTAL OVERDUE SUMMARY");
      expect(lines[3]).toContain("2 past-due invoices");
      expect(lines[3]).toContain("65000.00"); // 45,000 + 20,000 = 65,000 overdue total
    });

    it("returns only header when there are no overdue invoices", () => {
      const csv = generateOverdueSummaryCsv([], { referenceDate: fixedNow });
      const lines = csv.split("\r\n");
      expect(lines.length).toBe(1);
      expect(lines[0]).toContain("Invoice Number");
    });

    it("consolidates multiple overdue invoices by client account", () => {
      const multiClientInvoices: InvoiceWithClient[] = [
        ...mockInvoices,
        {
          id: "inv-overdue-1b",
          code: "INV-2026-005",
          clientId: "cli-1",
          clientName: "Lanka Retail Systems",
          clientContactPerson: "Nimal",
          clientEmail: "nimal@retail.lk",
          clientPhone: "0771234567",
          issueDate: "2026-09-10",
          dueDate: "2026-09-25", // 41 days overdue
          status: "OVERDUE",
          amountCents: 3000000,
          paidCents: 0, // 30,000 remaining
          currency: "LKR",
          createdAt: "2026-09-10T00:00:00Z",
          updatedAt: "2026-09-10T00:00:00Z",
        },
      ];

      const consolidated = consolidateOverdueByClient(
        multiClientInvoices,
        fixedNow,
      );
      expect(consolidated.length).toBe(2);

      // Lanka Retail Systems now has 45,000 + 30,000 = 75,000 LKR overdue across 2 invoices
      const topClient = consolidated[0];
      expect(topClient.clientName).toBe("Lanka Retail Systems");
      expect(topClient.invoicesCount).toBe(2);
      expect(topClient.invoiceCodes).toEqual(["INV-2026-001", "INV-2026-005"]);
      expect(topClient.totalOverdueCents).toBe(7500000);
      expect(topClient.maxDaysOverdue).toBe(41);
    });

    it("generates structured multi-block Executive Accounting Template CSV and TSV clipboard grid", () => {
      const execCsv = generateProfessionalOverdueTemplateCsv(mockInvoices, {
        referenceDate: fixedNow,
        businessName: "Chethaka Freelance Studio",
        primaryCurrency: "LKR",
      });

      expect(execCsv).toContain(
        "OVERDUE INVOICES & ACCOUNTS RECEIVABLE AGING STATEMENT",
      );
      expect(execCsv).toContain("Chethaka Freelance Studio");
      expect(execCsv).toContain("EXECUTIVE KPI METRIC,VALUE");
      expect(execCsv).toContain("AGING BUCKET TIER,INVOICE COUNT");
      expect(execCsv).toContain("Row #,Invoice Number,Client Name");
      expect(execCsv).toContain("GRAND TOTAL SUMMARY");

      const tsv = generateOverdueTsvForClipboard(mockInvoices, fixedNow);
      const tsvLines = tsv.split("\n");
      expect(tsvLines.length).toBe(4); // Header + 2 rows + TOTAL row
      expect(tsvLines[0]).toContain("Invoice Number\tClient Name");
      expect(tsvLines[3]).toContain("TOTAL\t2 Invoices");
    });

    it("parses RFC 4180 CSV and converts CSV into styled Microsoft Excel XML Workbooks (.xls)", () => {
      const sampleCsv =
        'Invoice Number,Client Name,Balance Due,Notes\r\nINV-2026-001,"Acme, Inc.",45000.00,"Includes ""express"" delivery"\r\nGRAND TOTAL,1 Invoice,45000.00,';

      const parsed = parseRfc4180Csv(sampleCsv);
      expect(parsed.length).toBe(3);
      expect(parsed[1][1]).toBe("Acme, Inc.");
      expect(parsed[1][3]).toBe('Includes "express" delivery');

      const workbookXml = convertCsvToExcelWorkbook(sampleCsv, {
        sheetName: "Overdue Aging",
      });
      expect(workbookXml).toContain('<?mso-application progid="Excel.Sheet"?>');
      expect(workbookXml).toContain('<Worksheet ss:Name="Overdue Aging">');
      expect(workbookXml).toContain('<Style ss:ID="TableHeader">');
      expect(workbookXml).toContain('<Data ss:Type="Number">45000.00</Data>');
      expect(workbookXml).toContain("Acme, Inc.");

      const multiSheetWorkbook = generateOverdueExcelWorkbook(mockInvoices, {
        referenceDate: fixedNow,
        businessName: "Chethaka Freelance Studio",
        primaryCurrency: "LKR",
        includeClientRollup: true,
      });
      expect(multiSheetWorkbook).toContain(
        '<Worksheet ss:Name="Overdue Aging Ledger">',
      );
      expect(multiSheetWorkbook).toContain(
        '<Worksheet ss:Name="Client Consolidation">',
      );

      const generalWorkbook = generateInvoicesExcelWorkbook(mockInvoices, {
        referenceDate: fixedNow,
        sheetName: "All Invoices",
      });
      expect(generalWorkbook).toContain('<Worksheet ss:Name="All Invoices">');
      expect(generalWorkbook).toContain("INV-2026-001");
    });
  });
});
