import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import { initDatabase, closeDatabaseForTesting, getDb } from "../db";
import { clients, invoices, vendors } from "../db/schema";
import { listVendors } from "../ipc/vendors";
import { getAnalyticsSummary } from "../ipc/analytics";
import { newVendorSchema } from "../validation";
import { eq } from "drizzle-orm";
import {
  getActiveInvoiceCurrency,
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
      expect(summary.effectiveHourlyRate).toBeGreaterThan(0);
      expect(summary.cashflowRunwayMonths).toBeGreaterThan(0);
      expect(summary.monthlyTrends.length).toBe(6);
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
  });
});
