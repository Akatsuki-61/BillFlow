import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import { initDatabase, closeDatabaseForTesting, getDb } from "../db";
import { clients, invoices, vendors, tasks, workOrders, vendorPayouts, attachments } from "../db/schema";
import { listVendors } from "../ipc/vendors";
import {
  listWorkOrders,
  getWorkOrder,
  createWorkOrder,
  updateWorkOrder,
  reviewWorkOrder,
  recordWorkOrderPayout,
  removeWorkOrderPayout,
} from "../ipc/workOrders";
import { getAnalyticsSummary } from "../ipc/analytics";
import {
  newVendorSchema,
  reviewWorkOrderSchema,
  recordWorkOrderPayoutSchema,
} from "../validation";
import { eq } from "drizzle-orm";
import {
  getActiveInvoiceCurrency,
  getSystemCurrency,
  formatCents,
  formatCurrencyAmount,
  getCurrencySymbol,
} from "../../src/lib/format";

describe("Outsourcing & Analytics Pages Test Suite", () => {
  let tempDir: string;
  let testDbPath: string;

  beforeEach(() => {
    closeDatabaseForTesting();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "billflow-test-pages-"));
    testDbPath = path.join(tempDir, "test.db");
    initDatabase(testDbPath);
  });

  afterEach(() => {
    closeDatabaseForTesting();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("Outsourcing Page: Validation, CRUD & Client Linking", () => {
    it("validates vendor input with strict non-blank and email rules", () => {
      // 1. Valid vendor input
      const valid = newVendorSchema.safeParse({
        name: "DevOps Nexus Labs",
        service: "Kubernetes & Cloud Migration",
        balanceCents: 450000,
        status: "PENDING",
        iconType: "devops",
        email: "ops@devopsnexus.io",
        payoutDueDate: "2026-10-30",
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.name).toBe("DevOps Nexus Labs");
        expect(valid.data.balanceCents).toBe(450000);
      }

      // 2. Reject blank or whitespace-only name
      const blankName = newVendorSchema.safeParse({
        name: "   ",
        service: "Design System",
        balanceCents: 100000,
        status: "PENDING",
      });
      expect(blankName.success).toBe(false);
      if (!blankName.success) {
        expect(blankName.error.issues.some((i) => i.message.toLowerCase().includes("blank"))).toBe(true);
      }

      // 3. Reject blank or whitespace-only service description
      const blankService = newVendorSchema.safeParse({
        name: "PixelCraft",
        service: "   \t\n ",
        balanceCents: 100000,
        status: "PENDING",
      });
      expect(blankService.success).toBe(false);
      if (!blankService.success) {
        expect(blankService.error.issues.some((i) => i.message.toLowerCase().includes("blank"))).toBe(true);
      }

      // 4. Reject invalid email without '@' sign
      const invalidEmail = newVendorSchema.safeParse({
        name: "PixelCraft Studio",
        service: "UI/UX Design",
        balanceCents: 200000,
        status: "PAID",
        email: "contact-pixelcraft-studio.com",
      });
      expect(invalidEmail.success).toBe(false);
      if (!invalidEmail.success) {
        expect(invalidEmail.error.issues.some((i) => i.message.includes("@"))).toBe(true);
      }

      // 5. Reject negative balance cents
      const negativeBalance = newVendorSchema.safeParse({
        name: "PixelCraft Studio",
        service: "UI/UX Design",
        balanceCents: -5000,
        status: "PENDING",
      });
      expect(negativeBalance.success).toBe(false);
    });

    it("persists vendors into SQLite, performs full CRUD, and tracks status", () => {
      const db = getDb();
      // Clear any auto-seeded vendors for deterministic assertion
      db.delete(vendors).run();

      // CREATE
      const vendorId = "vnd-test-crud-1";
      db.insert(vendors).values({
        id: vendorId,
        name: "Quantum Logic Labs",
        service: "AI Model Fine-Tuning",
        balanceCents: 520000, // $5,200
        status: "PENDING",
        iconType: "development",
        email: "team@quantumlogic.ai",
        phone: "+1 (555) 234-5678",
        payoutDueDate: "2026-11-15",
        notes: "Milestone 1 completed",
      }).run();

      // READ
      let allVendors = listVendors();
      expect(allVendors.length).toBe(1);
      const created = allVendors[0];
      expect(created.id).toBe(vendorId);
      expect(created.name).toBe("Quantum Logic Labs");
      expect(created.service).toBe("AI Model Fine-Tuning");
      expect(created.currentBalance).toBe(5200); // 520000 cents converted to dollars
      expect(created.status).toBe("PENDING");
      expect(created.iconType).toBe("development");

      // UPDATE
      db.update(vendors)
        .set({
          balanceCents: 600000, // Updated to $6,000
          notes: "Milestone 2 added",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(vendors.id, vendorId))
        .run();

      allVendors = listVendors();
      expect(allVendors[0].currentBalance).toBe(6000);
      expect(allVendors[0].notes).toBe("Milestone 2 added");

      // STATUS TOGGLE (PENDING -> PAID)
      db.update(vendors)
        .set({ status: "PAID", updatedAt: new Date().toISOString() })
        .where(eq(vendors.id, vendorId))
        .run();

      allVendors = listVendors();
      expect(allVendors[0].status).toBe("PAID");

      // DELETE
      db.delete(vendors).where(eq(vendors.id, vendorId)).run();
      allVendors = listVendors();
      expect(allVendors.length).toBe(0);
    });

    it("links subcontractor vendor to an existing client in the database", () => {
      const db = getDb();
      db.delete(vendors).run();
      db.delete(clients).run();

      // Insert Client
      const clientId = "cli-acme-corp";
      db.insert(clients).values({
        id: clientId,
        name: "Acme Enterprises Inc.",
        contactPerson: "Alice Johnson",
        email: "alice@acme.com",
        currency: "USD",
        hasQuickBill: true,
      }).run();

      // Insert Vendor linked to Client
      const vendorId = "vnd-contractor-acme";
      db.insert(vendors).values({
        id: vendorId,
        name: "VectorFlow UX",
        service: "Design Retainer for Acme",
        balanceCents: 240000, // $2,400
        status: "PENDING",
        iconType: "design",
        linkedClientId: clientId,
      }).run();

      const vendorList = listVendors();
      const contractor = vendorList.find((v) => v.id === vendorId);
      expect(contractor).toBeDefined();
      expect(contractor?.linkedClientId).toBe(clientId);
      expect(contractor?.linkedClientName).toBe("Acme Enterprises Inc.");
    });

    it("calculates pending payables vs settled payouts accurately", () => {
      const db = getDb();
      db.delete(vendors).run();

      db.insert(vendors).values({
        id: "vnd-sum-1",
        name: "Vendor One",
        service: "DevOps",
        balanceCents: 320000, // $3,200
        status: "PENDING",
        iconType: "devops",
      }).run();

      db.insert(vendors).values({
        id: "vnd-sum-2",
        name: "Vendor Two",
        service: "Design",
        balanceCents: 180000, // $1,800
        status: "PAID",
        iconType: "design",
      }).run();

      db.insert(vendors).values({
        id: "vnd-sum-3",
        name: "Vendor Three",
        service: "Legal",
        balanceCents: 140000, // $1,400
        status: "PENDING",
        iconType: "legal",
      }).run();

      const vendorItems = listVendors();

      const pendingPayables = vendorItems
        .filter((v) => v.status === "PENDING")
        .reduce((sum, v) => sum + v.currentBalance, 0);

      const settledPayouts = vendorItems
        .filter((v) => v.status === "PAID")
        .reduce((sum, v) => sum + v.currentBalance, 0);

      expect(pendingPayables).toBe(3200 + 1400); // $4,600
      expect(settledPayouts).toBe(1800); // $1,800
      expect(pendingPayables + settledPayouts).toBe(6400); // $6,400 total
    });
  });

  describe("Analytics Page: Real-Time Intelligence & Financial Engine", () => {
    it("computes live revenue, outsourced expenditure, net profit, and margin percentages", () => {
      const db = getDb();
      db.delete(invoices).run();
      db.delete(vendors).run();
      db.delete(clients).run();

      // Client
      const clientId = "cli-analytics-1";
      db.insert(clients).values({
        id: clientId,
        name: "Horizon Fintech",
        contactPerson: "David",
        email: "david@horizon.io",
        currency: "USD",
        hasQuickBill: true,
      }).run();

      // Invoices: Total $10,000 billed ($6,000 paid, $4,000 unpaid/pending)
      db.insert(invoices).values({
        id: "inv-an-101",
        code: "INV-2026-101",
        clientId,
        amountCents: 600000, // $6,000
        paidCents: 600000,
        currency: "USD",
        issueDate: "2026-10-01",
        status: "PAID",
      }).run();

      db.insert(invoices).values({
        id: "inv-an-102",
        code: "INV-2026-102",
        clientId,
        amountCents: 400000, // $4,000
        paidCents: 0,
        currency: "USD",
        issueDate: "2026-10-03",
        status: "UNPAID",
      }).run();

      // Subcontractors: $3,000 total outsourced cost
      db.insert(vendors).values({
        id: "vnd-an-101",
        name: "Cloud Solutions",
        service: "Cloud Hosting & DevOps",
        balanceCents: 300000, // $3,000
        status: "PENDING",
        iconType: "devops",
      }).run();

      const summary = getAnalyticsSummary();

      expect(summary.totalRevenueCents).toBe(1000000); // $10,000 total revenue
      expect(summary.totalOutsourcedCents).toBe(300000); // $3,000 outsourced expenses
      expect(summary.netProfitCents).toBe(700000); // $7,000 net profit
      expect(summary.marginPct).toBe(70); // 7,000 / 10,000 = 70% profit margin
      expect(summary.pendingReceivablesCents).toBe(400000); // $4,000 pending collections
      expect(summary.unpaidCount).toBe(1);
      expect(summary.paidRatioPct).toBe(60); // 6,000 / 10,000 = 60% collected
      expect(summary.activeClientsCount).toBe(1);
      expect(summary.vendorsCount).toBe(1);
      expect(summary.topClientName).toBe("Horizon Fintech");
    });

    it("tracks overdue receivables and computes cashflow runway and hourly yield", () => {
      const db = getDb();
      db.delete(invoices).run();
      db.delete(vendors).run();
      db.delete(clients).run();

      const clientId = "cli-analytics-2";
      db.insert(clients).values({
        id: clientId,
        name: "Starlight Digital",
        contactPerson: "Elena",
        email: "elena@starlight.io",
        currency: "USD",
        hasQuickBill: true,
      }).run();

      // Overdue invoice ($2,500)
      db.insert(invoices).values({
        id: "inv-an-overdue",
        code: "INV-2026-OD",
        clientId,
        amountCents: 250000, // $2,500
        paidCents: 0,
        currency: "USD",
        issueDate: "2026-08-01",
        dueDate: "2026-08-15", // past date
        status: "OVERDUE",
      }).run();

      // Paid invoice ($7,500)
      db.insert(invoices).values({
        id: "inv-an-paid",
        code: "INV-2026-OK",
        clientId,
        amountCents: 750000, // $7,500
        paidCents: 750000,
        currency: "USD",
        issueDate: "2026-10-01",
        status: "PAID",
      }).run();

      // Vendor ($1,500)
      db.insert(vendors).values({
        id: "vnd-infra",
        name: "Security Auditing Ltd",
        service: "Penetration Testing",
        balanceCents: 150000, // $1,500
        status: "PAID",
        iconType: "legal",
      }).run();

      const summary = getAnalyticsSummary();

      expect(summary.overdueCents).toBe(250000); // $2,500 overdue
      expect(summary.overdueCount).toBe(1);
      expect(summary.avgInvoiceCents).toBe(500000); // (2500 + 7500) / 2 = $5,000
      // Without tracked task hours, hourly rate is truthfully 0 (no synthetic 145/hr fallback)
      expect(summary.effectiveHourlyRate).toBe(0);
      // Actual runway: $7,500 paid / ($1,500 vendor cost / 6 months burn = $250/mo) = 30 months
      expect(summary.cashflowRunwayMonths).toBe(30);
      expect(summary.monthlyTrends.length).toBe(6);

      // Now insert a task with tracked active hours (2.0 hours = 7,200,000 ms)
      db.insert(tasks).values({
        id: "task-test-hourly",
        title: "Penetration Testing Review",
        status: "in-progress",
        priority: "medium",
        category: "Development",
        assignee: { name: "Chethaka", avatarLetter: "C", bgColor: "#7c3aed", textColor: "#ffffff" },
        createdAt: "2026-10-01",
        updatedAt: "2026-10-01",
        activeMilliseconds: 7200000,
      }).run();

      const summaryWithHours = getAnalyticsSummary();
      // Net profit = $10,000 revenue - $1,500 vendor = $8,500 net profit
      // Realized hourly rate = $8,500 / 2 hours = $4,250/hr
      expect(summaryWithHours.effectiveHourlyRate).toBe(4250);
    });

    it("enforces financial integrity: truthful zero metrics on empty states and correct collection on ADVANCE_PAID", () => {
      const db = getDb();
      db.delete(invoices).run();
      db.delete(vendors).run();
      db.delete(clients).run();
      db.delete(tasks).run();

      // 1. Completely empty database -> all ratios and derived metrics are truthfully 0 (not 100% or synthetic defaults)
      const emptySummary = getAnalyticsSummary();
      expect(emptySummary.totalRevenueCents).toBe(0);
      expect(emptySummary.totalOutsourcedCents).toBe(0);
      expect(emptySummary.netProfitCents).toBe(0);
      expect(emptySummary.marginPct).toBe(0); // 0%, never 100%
      expect(emptySummary.paidRatioPct).toBe(0); // 0%, never 100%
      expect(emptySummary.effectiveHourlyRate).toBe(0); // 0, never synthetic 145
      expect(emptySummary.cashflowRunwayMonths).toBe(0); // 0, never synthetic 12
      expect(emptySummary.topClientPct).toBe(0);

      // 2. Invoice with ADVANCE_PAID status
      const clientId = "cli-adv-test";
      db.insert(clients).values({
        id: clientId,
        name: "Acme Logistics",
        contactPerson: "Alice",
        email: "alice@acme.io",
        currency: "LKR",
        hasQuickBill: true,
      }).run();

      // Total 90,000 LKR invoice with 45,000 LKR advance recorded
      db.insert(invoices).values({
        id: "inv-adv-1",
        code: "INV-2026-ADV",
        clientId,
        amountCents: 9000000, // 90,000.00
        paidCents: 4500000, // 45,000.00 advance received
        currency: "LKR",
        issueDate: "2026-10-06",
        status: "ADVANCE_PAID",
      }).run();

      const advanceSummary = getAnalyticsSummary();
      expect(advanceSummary.totalRevenueCents).toBe(9000000);
      expect(advanceSummary.paidCents).toBe(4500000); // Actually counted in paidCents
      expect(advanceSummary.pendingReceivablesCents).toBe(4500000); // 45,000 remaining due
      expect(advanceSummary.paidRatioPct).toBe(50); // 50% collected
      expect(advanceSummary.unpaidCount).toBe(1); // 1 invoice with remaining balance
    });

    it("dynamically recalculates metrics when outsourcing vendors change", () => {
      const db = getDb();
      db.delete(invoices).run();
      db.delete(vendors).run();
      db.delete(clients).run();

      db.insert(clients).values({
        id: "cli-dyn",
        name: "Omni Labs",
        contactPerson: "Sam",
        email: "sam@omni.com",
        currency: "USD",
        hasQuickBill: true,
      }).run();

      db.insert(invoices).values({
        id: "inv-dyn-1",
        code: "INV-DYN-1",
        clientId: "cli-dyn",
        amountCents: 1000000, // $10,000
        currency: "USD",
        issueDate: "2026-10-05",
        status: "PAID",
      }).run();

      // Initial state: 0 vendors -> 100% margin
      let summary = getAnalyticsSummary();
      expect(summary.totalOutsourcedCents).toBe(0);
      expect(summary.netProfitCents).toBe(1000000);
      expect(summary.marginPct).toBe(100);

      // Add Subcontractor $4,000
      db.insert(vendors).values({
        id: "vnd-dyn-1",
        name: "FrontEnd Wizards",
        service: "Web UI Components",
        balanceCents: 400000,
        status: "PENDING",
        iconType: "development",
      }).run();

      summary = getAnalyticsSummary();
      expect(summary.totalOutsourcedCents).toBe(400000);
      expect(summary.netProfitCents).toBe(600000); // $6,000 net profit
      expect(summary.marginPct).toBe(60); // 60% profit margin
      expect(summary.vendorsCount).toBe(1);
    });
  });

  describe("Currency Synchronization between Invoices, Outsourcing & Analytics", () => {
    it("dynamically changes viewing currency when invoice currency is updated", () => {
      const db = getDb();
      db.delete(invoices).run();
      db.delete(vendors).run();
      db.delete(clients).run();

      // Setup client
      db.insert(clients).values({
        id: "cli-curr",
        name: "Global Tech Inc.",
        contactPerson: "Elena Rostova",
        email: "elena@globaltech.com",
        currency: "USD",
        hasQuickBill: true,
      }).run();

      // Initial invoice with USD
      db.insert(invoices).values({
        id: "inv-curr-1",
        code: "INV-2026-001",
        clientId: "cli-curr",
        amountCents: 500000, // $5,000
        currency: "USD",
        issueDate: "2026-10-01",
        status: "UNPAID",
      }).run();

      let currentInvoices = db.select().from(invoices).all();
      let activeCurrency = getActiveInvoiceCurrency(currentInvoices);
      expect(activeCurrency).toBe("USD");
      expect(getCurrencySymbol(activeCurrency)).toBe("$");
      expect(formatCents(500000, activeCurrency)).toBe("$5,000.00");
      expect(formatCurrencyAmount(2500, activeCurrency)).toBe("$2,500.00");

      // User changes currency in invoice to EUR
      db.update(invoices)
        .set({
          currency: "EUR",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(invoices.id, "inv-curr-1"))
        .run();

      currentInvoices = db.select().from(invoices).all();
      activeCurrency = getActiveInvoiceCurrency(currentInvoices);
      expect(activeCurrency).toBe("EUR");
      expect(getCurrencySymbol(activeCurrency)).toBe("€");
      expect(formatCents(500000, activeCurrency)).toBe("€5,000.00");
      expect(formatCurrencyAmount(2500, activeCurrency)).toBe("€2,500.00");

      // User changes currency in invoice to LKR
      db.update(invoices)
        .set({
          currency: "LKR",
          updatedAt: new Date(Date.now() + 1000).toISOString(),
        })
        .where(eq(invoices.id, "inv-curr-1"))
        .run();

      currentInvoices = db.select().from(invoices).all();
      activeCurrency = getActiveInvoiceCurrency(currentInvoices);
      expect(activeCurrency).toBe("LKR");
      expect(getCurrencySymbol(activeCurrency)).toBe("Rs. ");
      expect(formatCents(500000, activeCurrency)).toBe("Rs. 5,000.00");

      // User changes currency in invoice to GBP
      db.update(invoices)
        .set({
          currency: "GBP",
          updatedAt: new Date(Date.now() + 2000).toISOString(),
        })
        .where(eq(invoices.id, "inv-curr-1"))
        .run();

      currentInvoices = db.select().from(invoices).all();
      activeCurrency = getActiveInvoiceCurrency(currentInvoices);
      expect(activeCurrency).toBe("GBP");
      expect(getCurrencySymbol(activeCurrency)).toBe("£");
      expect(formatCents(500000, activeCurrency)).toBe("£5,000.00");

      // User changes currency in invoice to CAD
      db.update(invoices)
        .set({
          currency: "CAD",
          updatedAt: new Date(Date.now() + 3000).toISOString(),
        })
        .where(eq(invoices.id, "inv-curr-1"))
        .run();

      currentInvoices = db.select().from(invoices).all();
      activeCurrency = getActiveInvoiceCurrency(currentInvoices);
      expect(activeCurrency).toBe("CAD");
      expect(getCurrencySymbol(activeCurrency)).toBe("CA$");
      expect(formatCents(500000, activeCurrency)).toBe("CA$5,000.00");
    });

    it("links user settings defaultCurrency across the system and allows user to choose currency", () => {
      const sampleInvoices = [
        { currency: "USD", updatedAt: "2026-10-01T00:00:00.000Z" },
      ];

      // 1. When user chooses LKR in Settings, system currency becomes LKR
      let systemCurrency = getSystemCurrency("LKR", sampleInvoices);
      expect(systemCurrency).toBe("LKR");
      expect(getCurrencySymbol(systemCurrency)).toBe("Rs. ");
      expect(formatCents(9000000, systemCurrency)).toBe("Rs. 90,000.00");

      // 2. When user switches currency in Settings to EUR, system currency becomes EUR
      systemCurrency = getSystemCurrency("EUR", sampleInvoices);
      expect(systemCurrency).toBe("EUR");
      expect(getCurrencySymbol(systemCurrency)).toBe("€");
      expect(formatCents(250000, systemCurrency)).toBe("€2,500.00");

      // 3. When user switches currency in Settings to GBP, system currency becomes GBP
      systemCurrency = getSystemCurrency("GBP", sampleInvoices);
      expect(systemCurrency).toBe("GBP");
      expect(getCurrencySymbol(systemCurrency)).toBe("£");
      expect(formatCents(120000, systemCurrency)).toBe("£1,200.00");

      // 4. When user switches currency in Settings to CAD, system currency becomes CAD
      systemCurrency = getSystemCurrency("CAD", sampleInvoices);
      expect(systemCurrency).toBe("CAD");
      expect(getCurrencySymbol(systemCurrency)).toBe("CA$");
      expect(formatCents(340000, systemCurrency)).toBe("CA$3,400.00");

      // 5. When user switches currency in Settings to USD, system currency becomes USD
      systemCurrency = getSystemCurrency("USD", sampleInvoices);
      expect(systemCurrency).toBe("USD");
      expect(getCurrencySymbol(systemCurrency)).toBe("$");
      expect(formatCents(500000, systemCurrency)).toBe("$5,000.00");

      // 6. When settings currency is absent, it gracefully falls back to active invoice currency
      const fallbackFromInvoices = getSystemCurrency(null, sampleInvoices);
      expect(fallbackFromInvoices).toBe("USD");
    });
  });

  describe("Outsourcing: Completion, Delivery and Payouts Separately", () => {
    it("validates review inputs and payout recording schemas strictly", () => {
      // 1. Valid review input
      const validReview = reviewWorkOrderSchema.safeParse({
        workOrderId: "wo-rev-1",
        status: "done",
        deliveryUrl: "https://github.com/Chethaka/client-website",
        notes: "Frontend components verified against design specs.",
        updateTask: true,
      });
      expect(validReview.success).toBe(true);

      // 2. Reject invalid delivery URL format
      const invalidUrl = reviewWorkOrderSchema.safeParse({
        workOrderId: "wo-rev-1",
        status: "done",
        deliveryUrl: "not-a-valid-url-format",
      });
      expect(invalidUrl.success).toBe(false);

      // 3. Reject notes exceeding 2000 characters
      const oversizedNotes = reviewWorkOrderSchema.safeParse({
        workOrderId: "wo-rev-1",
        status: "review",
        notes: "a".repeat(2001),
      });
      expect(oversizedNotes.success).toBe(false);

      // 4. Valid payout recording input
      const validPayout = recordWorkOrderPayoutSchema.safeParse({
        workOrderId: "wo-payout-1",
        amountCents: 3000000,
        currency: "LKR",
        paidAt: "2026-10-06T12:00:00.000Z",
      });
      expect(validPayout.success).toBe(true);

      // 5. Reject non-positive payout amount
      const zeroPayout = recordWorkOrderPayoutSchema.safeParse({
        workOrderId: "wo-payout-1",
        amountCents: 0,
        currency: "LKR",
      });
      expect(zeroPayout.success).toBe(false);
    });

    it("tracks contractor work completion completely separately from payout entries", () => {
      const db = getDb();
      db.delete(workOrders).run();
      db.delete(vendorPayouts).run();
      db.delete(tasks).run();
      db.delete(invoices).run();
      db.delete(vendors).run();
      db.delete(clients).run();

      // Seed client, invoice, task, and vendor
      const clientId = "cli-sep-1";
      db.insert(clients).values({
        id: clientId,
        name: "Lanka Digital Media",
        contactPerson: "Nimal Perera",
        email: "nimal@lankamedia.lk",
        currency: "LKR",
      }).run();

      const invoiceId = "inv-sep-1";
      db.insert(invoices).values({
        id: invoiceId,
        code: "INV-2026-001",
        clientId,
        amountCents: 9000000, // 90,000 LKR
        currency: "LKR",
        issueDate: "2026-10-06",
        status: "ADVANCE_PAID",
        paidCents: 4500000,
      }).run();

      const taskId = "task-sep-1";
      db.insert(tasks).values({
        id: taskId,
        title: "Business website development",
        clientId,
        clientName: "Lanka Digital Media",
        invoiceId,
        status: "todo",
        priority: "high",
        category: "Development",
        assignee: { name: "Chethaka", avatarLetter: "C", bgColor: "#7c3aed", textColor: "#ffffff" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).run();

      const vendorId = "vnd-sep-1";
      db.insert(vendors).values({
        id: vendorId,
        name: "Kasun Silva",
        service: "Frontend Web Development",
        email: "kasun@webcraft.lk",
        balanceCents: 0,
        status: "PENDING",
        iconType: "development",
      }).run();

      // 1. Create work order: initially "todo" and payoutStatus is "PENDING"
      const createdWo = createWorkOrder({
        vendorId,
        taskId,
        invoiceId,
        scope: "Implement responsive layout and contact forms",
        feeCents: 3000000, // 30,000 LKR
        currency: "LKR",
        dueDate: "2026-10-15",
        status: "todo",
      });

      expect(createdWo.status).toBe("todo");
      expect(createdWo.payoutStatus).toBe("PENDING");
      expect(createdWo.payoutId).toBeNull();
      expect(createdWo.deliveryUrl).toBeNull();
      expect(createdWo.notes).toBeNull();

      // 2. Contractor starts work: status -> "in-progress"
      const inProgressWo = updateWorkOrder(createdWo.id, { status: "in-progress" });
      expect(inProgressWo.status).toBe("in-progress");
      expect(inProgressWo.payoutStatus).toBe("PENDING"); // Still unpaid

      // 3. Contractor submits deliverable for review: status -> "review"
      const reviewWo = updateWorkOrder(createdWo.id, {
        status: "review",
        deliveryUrl: "https://staging.lankamedia.lk",
        notes: "Staging build ready for client review.",
      });
      expect(reviewWo.status).toBe("review");
      expect(reviewWo.deliveryUrl).toBe("https://staging.lankamedia.lk");
      expect(reviewWo.notes).toBe("Staging build ready for client review.");
      expect(reviewWo.payoutStatus).toBe("PENDING"); // Still unpaid

      // 4. Chethaka approves work: status -> "done"
      const doneWo = updateWorkOrder(createdWo.id, { status: "done" });
      expect(doneWo.status).toBe("done");
      expect(doneWo.completedAt).toBeDefined();
      // Crucial test: Completing contractor work MUST NOT automatically settle payout!
      expect(doneWo.payoutStatus).toBe("PENDING");
      expect(doneWo.payoutId).toBeNull();

      // Check SQLite table directly: no vendor payout records exist
      const existingPayouts = db.select().from(vendorPayouts).where(eq(vendorPayouts.workOrderId, createdWo.id)).all();
      expect(existingPayouts.length).toBe(0);
    });

    it("reviews contractor work, retains delivered URL/notes, and synchronizes the original task", () => {
      const db = getDb();
      db.delete(workOrders).run();
      db.delete(vendorPayouts).run();
      db.delete(tasks).run();
      db.delete(invoices).run();
      db.delete(vendors).run();
      db.delete(clients).run();

      const clientId = "cli-rev-1";
      db.insert(clients).values({
        id: clientId,
        name: "Apex Consulting",
        contactPerson: "Kamal Gunaratne",
        email: "kamal@apex.lk",
        currency: "LKR",
      }).run();

      const invoiceId = "inv-rev-1";
      db.insert(invoices).values({
        id: invoiceId,
        code: "INV-2026-002",
        clientId,
        amountCents: 8000000,
        currency: "LKR",
        issueDate: "2026-10-06",
        status: "ADVANCE_PAID",
      }).run();

      const taskId = "task-rev-1";
      db.insert(tasks).values({
        id: taskId,
        title: "Frontend Development Retainer",
        clientId,
        clientName: "Apex Consulting",
        invoiceId,
        status: "in-progress",
        priority: "medium",
        category: "Development",
        assignee: { name: "Chethaka", avatarLetter: "C", bgColor: "#7c3aed", textColor: "#ffffff" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).run();

      const vendorId = "vnd-rev-1";
      db.insert(vendors).values({
        id: vendorId,
        name: "DevStudio Lanka",
        service: "Web Engineering",
        balanceCents: 0,
        status: "PENDING",
      }).run();

      const wo = createWorkOrder({
        vendorId,
        taskId,
        invoiceId,
        scope: "Build responsive pages",
        feeCents: 2500000,
        currency: "LKR",
        status: "in-progress",
      });

      // Call reviewWorkOrder with updateTask: true
      const deliverableUrl = "https://github.com/apex-consulting/web-build";
      const reviewNotes = "Approved PR #14 with verified unit tests and responsive layout.";
      const reviewedWo = reviewWorkOrder({
        workOrderId: wo.id,
        status: "done",
        deliveryUrl: deliverableUrl,
        notes: reviewNotes,
        updateTask: true,
      });

      // 1. Verify work order retained deliverable URL and notes
      expect(reviewedWo.status).toBe("done");
      expect(reviewedWo.deliveryUrl).toBe(deliverableUrl);
      expect(reviewedWo.notes).toBe(reviewNotes);
      expect(reviewedWo.completedAt).toBeDefined();

      // 2. Verify original task was updated with delivery URL, status done, and completedAt timestamp
      const originalTask = db.select().from(tasks).where(eq(tasks.id, taskId)).get();
      expect(originalTask).toBeDefined();
      expect(originalTask?.status).toBe("done");
      expect(originalTask?.deliveryUrl).toBe(deliverableUrl);
      expect(originalTask?.completedAt).toBeDefined();
    });

    it("records contractor payout independently and manages receipt attachment lifecycle", () => {
      const db = getDb();
      db.delete(workOrders).run();
      db.delete(vendorPayouts).run();
      db.delete(attachments).run();
      db.delete(tasks).run();
      db.delete(invoices).run();
      db.delete(vendors).run();
      db.delete(clients).run();

      const clientId = "cli-pay-1";
      db.insert(clients).values({
        id: clientId,
        name: "FinTech Ventures",
        contactPerson: "Dilshan Silva",
        email: "dilshan@fintech.lk",
        currency: "LKR",
      }).run();

      const invoiceId = "inv-pay-1";
      db.insert(invoices).values({
        id: invoiceId,
        code: "INV-2026-003",
        clientId,
        amountCents: 5000000,
        currency: "LKR",
        issueDate: "2026-10-06",
        status: "PAID",
      }).run();

      const taskId = "task-pay-1";
      db.insert(tasks).values({
        id: taskId,
        title: "API Integration Module",
        clientId,
        invoiceId,
        status: "done",
        priority: "medium",
        category: "Development",
        assignee: { name: "Chethaka", avatarLetter: "C", bgColor: "#7c3aed", textColor: "#ffffff" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).run();

      const vendorId = "vnd-pay-1";
      db.insert(vendors).values({
        id: vendorId,
        name: "CloudForge Labs",
        service: "Backend Systems",
        balanceCents: 0,
        status: "PENDING",
      }).run();

      // Create completed work order
      const wo = createWorkOrder({
        vendorId,
        taskId,
        invoiceId,
        scope: "API endpoints integration",
        feeCents: 2000000, // 20,000 LKR
        currency: "LKR",
        status: "done",
        deliveryUrl: "https://api.fintech.lk/v1",
        notes: "All endpoints passing integration tests.",
      });

      expect(wo.status).toBe("done");
      expect(wo.payoutStatus).toBe("PENDING");

      // 1. Record vendor payout entry
      const paidAtTimestamp = "2026-10-06T14:30:00.000Z";
      const paidWo = recordWorkOrderPayout({
        workOrderId: wo.id,
        amountCents: 2000000,
        currency: "LKR",
        paidAt: paidAtTimestamp,
      });

      expect(paidWo.payoutStatus).toBe("PAID");
      expect(paidWo.payoutId).toBeDefined();
      expect(paidWo.paidAt).toBe(paidAtTimestamp);
      expect(paidWo.payoutAmountCents).toBe(2000000);
      // Contractor work status remains "done" (paying contractor does not alter deliverable state)
      expect(paidWo.status).toBe("done");
      expect(paidWo.deliveryUrl).toBe("https://api.fintech.lk/v1");

      // 2. Attach payment confirmation receipt slip to the payout
      const payoutId = paidWo.payoutId!;
      db.insert(attachments).values({
        id: "att-slip-101",
        payoutId,
        originalName: "bank_slip_oct6.pdf",
        storedName: "stored_bank_slip.pdf",
        mimeType: "application/pdf",
        sizeBytes: 102400,
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        createdAt: new Date().toISOString(),
      }).run();

      const attachedReceipts = db.select().from(attachments).where(eq(attachments.payoutId, payoutId)).all();
      expect(attachedReceipts.length).toBe(1);
      expect(attachedReceipts[0].originalName).toBe("bank_slip_oct6.pdf");

      // 3. Remove payout entry: reverts payoutStatus to PENDING and cleans up receipt attachments
      const revertedWo = removeWorkOrderPayout(wo.id);
      expect(revertedWo.payoutStatus).toBe("PENDING");
      expect(revertedWo.payoutId).toBeNull();
      // Work order contractor progress, deliverable URL, and notes are completely retained
      expect(revertedWo.status).toBe("done");
      expect(revertedWo.deliveryUrl).toBe("https://api.fintech.lk/v1");
      expect(revertedWo.notes).toBe("All endpoints passing integration tests.");

      // Check SQLite table: receipt attachment was cleanly removed
      const remainingReceipts = db.select().from(attachments).where(eq(attachments.payoutId, payoutId)).all();
      expect(remainingReceipts.length).toBe(0);
    });

    it("persists deliverable URL, review notes, and independent payout state across database restart", () => {
      const db = getDb();
      db.delete(workOrders).run();
      db.delete(vendorPayouts).run();
      db.delete(tasks).run();
      db.delete(invoices).run();
      db.delete(vendors).run();
      db.delete(clients).run();

      const clientId = "cli-rst-1";
      db.insert(clients).values({
        id: clientId,
        name: "Colombo Cloud Tech",
        contactPerson: "Kavinda Fernando",
        email: "kavinda@colombocloud.lk",
        currency: "LKR",
      }).run();

      const invoiceId = "inv-rst-1";
      db.insert(invoices).values({
        id: invoiceId,
        code: "INV-2026-RST",
        clientId,
        amountCents: 10000000,
        currency: "LKR",
        issueDate: "2026-10-06",
        status: "ADVANCE_PAID",
      }).run();

      const taskId = "task-rst-1";
      db.insert(tasks).values({
        id: taskId,
        title: "Docker & CI/CD Pipeline Setup",
        clientId,
        invoiceId,
        status: "in-progress",
        priority: "high",
        category: "Development",
        assignee: { name: "Chethaka", avatarLetter: "C", bgColor: "#7c3aed", textColor: "#ffffff" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).run();

      const vendorId = "vnd-rst-1";
      db.insert(vendors).values({
        id: vendorId,
        name: "DevOps Global",
        service: "Infrastructure Automation",
        balanceCents: 0,
        status: "PENDING",
      }).run();

      const createdWo = createWorkOrder({
        vendorId,
        taskId,
        invoiceId,
        scope: "GitHub Actions workflow and docker-compose configurations",
        feeCents: 3500000,
        currency: "LKR",
        status: "in-progress",
      });

      // Review work order and update task
      reviewWorkOrder({
        workOrderId: createdWo.id,
        status: "done",
        deliveryUrl: "https://github.com/Chethaka/devops-pipeline",
        notes: "Pipelines green. Automated deployment tested on staging.",
        updateTask: true,
      });

      // Record payout
      recordWorkOrderPayout({
        workOrderId: createdWo.id,
        amountCents: 3500000,
        currency: "LKR",
        paidAt: "2026-10-06T16:00:00.000Z",
      });

      // --- SIMULATE APP RESTART ---
      closeDatabaseForTesting();
      initDatabase(testDbPath);

      // Re-query database after simulated restart
      const restoredWo = getWorkOrder(createdWo.id);
      expect(restoredWo).toBeDefined();
      expect(restoredWo?.status).toBe("done");
      expect(restoredWo?.deliveryUrl).toBe("https://github.com/Chethaka/devops-pipeline");
      expect(restoredWo?.notes).toBe("Pipelines green. Automated deployment tested on staging.");
      expect(restoredWo?.payoutStatus).toBe("PAID");
      expect(restoredWo?.payoutAmountCents).toBe(3500000);
      expect(restoredWo?.vendorName).toBe("DevOps Global");
      expect(restoredWo?.taskTitle).toBe("Docker & CI/CD Pipeline Setup");

      // Verify task in SQLite also retained its delivery URL and done status across restart
      const reloadedDb = getDb();
      const restoredTask = reloadedDb.select().from(tasks).where(eq(tasks.id, taskId)).get();
      expect(restoredTask).toBeDefined();
      expect(restoredTask?.status).toBe("done");
      expect(restoredTask?.deliveryUrl).toBe("https://github.com/Chethaka/devops-pipeline");
      expect(restoredTask?.completedAt).toBeDefined();
    });
  });
});
