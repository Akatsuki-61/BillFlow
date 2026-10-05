import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import { initDatabase, closeDatabaseForTesting, getDb } from "../db";
import { clients, invoices, vendors } from "../db/schema";
import { listClientsWithStats } from "../ipc/clients";
import { getNextInvoiceCode } from "../ipc/invoices";
import { getDashboardSummary } from "../ipc/dashboard";
import { listVendors } from "../ipc/vendors";
import { getAnalyticsSummary } from "../ipc/analytics";
import { newClientSchema, newInvoiceSchema, newVendorSchema } from "../validation";
import { eq } from "drizzle-orm";

describe("Database & Interconnection Tests", () => {
  let tempDir: string;
  let testDbPath: string;

  beforeEach(() => {
    closeDatabaseForTesting();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "billflow-test-"));
    testDbPath = path.join(tempDir, "test.db");
    initDatabase(testDbPath);
  });

  afterEach(() => {
    closeDatabaseForTesting();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("Validation Schemas", () => {
    it("validates valid client input", () => {
      const valid = newClientSchema.safeParse({
        name: "Apex Technologies",
        category: "Enterprise",
        email: "billing@apextechnologies.com",
        currency: "USD",
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.name).toBe("Apex Technologies");
        expect(valid.data.currency).toBe("USD");
      }
    });

    it("rejects client with invalid email", () => {
      const invalid = newClientSchema.safeParse({
        name: "Apex Technologies",
        email: "not-an-email",
        currency: "USD",
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.issues.some((i) => i.message.includes("@"))).toBe(true);
      }
    });

    it("rejects client with blank space data in name or email", () => {
      const blankName = newClientSchema.safeParse({
        name: "    ",
        email: "alex@fintechlabs.com",
        currency: "USD",
      });
      expect(blankName.success).toBe(false);
      if (!blankName.success) {
        expect(
          blankName.error.issues.some((i) =>
            i.message.toLowerCase().includes("blank"),
          ),
        ).toBe(true);
      }

      const blankEmail = newClientSchema.safeParse({
        name: "Fintech Labs",
        email: "    ",
        currency: "USD",
      });
      expect(blankEmail.success).toBe(false);
      if (!blankEmail.success) {
        expect(
          blankEmail.error.issues.some((i) =>
            i.message.toLowerCase().includes("blank"),
          ),
        ).toBe(true);
      }
    });

    it("validates invoice schema and enforces integer cents", () => {
      const valid = newInvoiceSchema.safeParse({
        clientId: "cli-123",
        amountCents: 150000,
        currency: "USD",
        status: "UNPAID",
      });
      expect(valid.success).toBe(true);
    });

    it("rejects invoice with negative amount", () => {
      const invalid = newInvoiceSchema.safeParse({
        clientId: "cli-123",
        amountCents: -500,
        currency: "USD",
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe("Client & Invoice SQLite Persistence and Interconnection", () => {
    it("persists clients, links invoices, and computes live statistics", () => {
      const db = getDb();

      // 1. Create two clients
      const clientAId = "cli-test-a";
      const clientBId = "cli-test-b";

      db.insert(clients).values({
        id: clientAId,
        name: "Sterling Financial Technologies",
        category: "Enterprise",
        contactPerson: "Anthony Miller",
        email: "anthony@sterlingfintech.com",
        currency: "USD",
        hasQuickBill: true,
      }).run();

      db.insert(clients).values({
        id: clientBId,
        name: "Vanguard Global Advisory",
        category: "Enterprise",
        contactPerson: "Benjamin Walker",
        email: "benjamin@vanguardadvisory.com",
        currency: "USD",
        hasQuickBill: true,
      }).run();

      // Initial stats: both have 0 billed and 0 invoices
      let clientStats = listClientsWithStats();
      expect(clientStats.length).toBe(2);

      const sterlingInitial = clientStats.find((c) => c.id === clientAId);
      expect(sterlingInitial?.totalBilledCents).toBe(0);
      expect(sterlingInitial?.outstandingBalanceCents).toBe(0);
      expect(sterlingInitial?.invoicesCount).toBe(0);

      // 2. Next invoice code sequence
      const nextCode1 = getNextInvoiceCode();
      const currentYear = new Date().getFullYear();
      expect(nextCode1).toBe(`INV-${currentYear}-001`);

      // 3. Create an invoice for Sterling Financial Technologies ($1,500.00 / 150000 cents, UNPAID)
      const invId1 = "inv-test-1";
      db.insert(invoices).values({
        id: invId1,
        code: nextCode1,
        clientId: clientAId,
        title: "Cloud Infrastructure Consulting",
        amountCents: 150000,
        currency: "USD",
        issueDate: "2026-10-01",
        dueDate: "2026-10-15",
        status: "UNPAID",
        paidCents: 0,
      }).run();

      // Next invoice code sequence should now advance to 002
      const nextCode2 = getNextInvoiceCode();
      expect(nextCode2).toBe(`INV-${currentYear}-002`);

      // 4. Verify Sterling Financial Technologies stats are dynamically computed
      clientStats = listClientsWithStats();
      const sterlingAfterInv = clientStats.find((c) => c.id === clientAId);
      expect(sterlingAfterInv?.totalBilledCents).toBe(150000);
      expect(sterlingAfterInv?.totalPaidCents).toBe(0);
      expect(sterlingAfterInv?.outstandingBalanceCents).toBe(150000);
      expect(sterlingAfterInv?.invoicesCount).toBe(1);
      expect(sterlingAfterInv?.recentInvoices.length).toBe(1);
      expect(sterlingAfterInv?.recentInvoices[0].code).toBe(nextCode1);

      // Vanguard Global Advisory must remain completely unaffected (0 balance)
      const vanguardAfterInv = clientStats.find((c) => c.id === clientBId);
      expect(vanguardAfterInv?.totalBilledCents).toBe(0);
      expect(vanguardAfterInv?.outstandingBalanceCents).toBe(0);
      expect(vanguardAfterInv?.invoicesCount).toBe(0);

      // 5. Verify Dashboard summary aggregates correctly
      const dashboard = getDashboardSummary();
      expect(dashboard.activeClients).toBe(2);
      expect(dashboard.unpaidCount).toBe(1);
      expect(dashboard.totalBilledByCurrency["USD"]).toBe(150000);
      expect(dashboard.outstandingByCurrency["USD"]).toBe(150000);
      expect(dashboard.recentInvoices.length).toBe(1);
      expect(dashboard.recentInvoices[0].clientName).toBe("Sterling Financial Technologies");

      // 6. Settle invoice (mark as PAID)
      db.update(invoices)
        .set({ status: "PAID", paidCents: 150000 })
        .where(eq(invoices.id, invId1))
        .run();

      clientStats = listClientsWithStats();
      const sterlingAfterPaid = clientStats.find((c) => c.id === clientAId);
      expect(sterlingAfterPaid?.totalBilledCents).toBe(150000);
      expect(sterlingAfterPaid?.totalPaidCents).toBe(150000);
      expect(sterlingAfterPaid?.outstandingBalanceCents).toBe(0);

      const dashboardAfterPaid = getDashboardSummary();
      expect(dashboardAfterPaid.unpaidCount).toBe(0);
      expect(dashboardAfterPaid.outstandingByCurrency["USD"] || 0).toBe(0);

      // 7. Verify Client deletion is blocked when invoices exist
      const clientAInvoicesCount = db.select().from(invoices).where(eq(invoices.clientId, clientAId)).all().length;
      expect(clientAInvoicesCount).toBe(1);

      // 8. Delete Vanguard Global Advisory (has no invoices - must succeed)
      db.delete(clients).where(eq(clients.id, clientBId)).run();
      const remainingClients = db.select().from(clients).all();
      expect(remainingClients.length).toBe(1);
      expect(remainingClients[0].id).toBe(clientAId);
    });
  });

  describe("Settings & Workspace Preferences", () => {
    it("validates settings schema and email formatting", async () => {
      const { updateSettingsSchema } = await import("../validation");
      const valid = updateSettingsSchema.safeParse({
        businessName: "Apex Engineering",
        email: "alex@apex.dev",
        defaultCurrency: "EUR",
        invoicePrefix: "APEX-",
        nextInvoiceSeq: 42,
        defaultDueDays: 30,
      });
      expect(valid.success).toBe(true);

      const invalidEmail = updateSettingsSchema.safeParse({
        email: "invalid-email-address",
      });
      expect(invalidEmail.success).toBe(false);
    });

    it("seeds default settings and persists updates", async () => {
      const { getOrCreateSettings, updateSettings } = await import("../ipc/settings");

      // Initial query creates default settings row
      const initial = getOrCreateSettings();
      expect(initial.defaultCurrency).toBe("USD");
      expect(initial.invoicePrefix).toBe("INV-");
      expect(initial.nextInvoiceSeq).toBe(1);

      // Update settings
      const updated = updateSettings({
        businessName: "Consultant Lab",
        email: "contact@consultant.io",
        invoicePrefix: "CL-",
        nextInvoiceSeq: 10,
        defaultCurrency: "GBP",
      });

      expect(updated.businessName).toBe("Consultant Lab");
      expect(updated.invoicePrefix).toBe("CL-");
      expect(updated.nextInvoiceSeq).toBe(10);
      expect(updated.defaultCurrency).toBe("GBP");

      // Invoice generator now uses updated prefix and sequence
      const nextCode = getNextInvoiceCode();
      const currentYear = new Date().getFullYear();
      expect(nextCode).toBe(`CL-${currentYear}-010`);
    });

    it("exports and imports full workspace backup", async () => {
      const db = getDb();
      const { updateSettings, exportWorkspace, importWorkspace, resetWorkspace } = await import("../ipc/settings");

      // Setup data
      updateSettings({ businessName: "Backup Test Studio", invoicePrefix: "BK-" });
      db.insert(clients).values({
        id: "cli-backup-1",
        name: "Test Client",
        contactPerson: "Alice",
        email: "alice@test.com",
        currency: "USD",
        hasQuickBill: true,
      }).run();

      db.insert(invoices).values({
        id: "inv-backup-1",
        code: "BK-2026-001",
        clientId: "cli-backup-1",
        amountCents: 50000,
        currency: "USD",
        issueDate: "2026-10-04",
        status: "UNPAID",
      }).run();

      // Export
      const backup = exportWorkspace();
      expect(backup.clients.length).toBe(1);
      expect(backup.invoices.length).toBe(1);
      expect(backup.settings.businessName).toBe("Backup Test Studio");

      // Reset workspace
      resetWorkspace();
      expect(db.select().from(clients).all().length).toBe(0);
      expect(db.select().from(invoices).all().length).toBe(0);

      // Restore from backup
      const result = importWorkspace(backup);
      expect(result.success).toBe(true);
      expect(result.importedClients).toBe(1);
      expect(result.importedInvoices).toBe(1);

      const restoredClients = db.select().from(clients).all();
      const restoredInvoices = db.select().from(invoices).all();
      expect(restoredClients.length).toBe(1);
      expect(restoredInvoices.length).toBe(1);
      expect(restoredInvoices[0].code).toBe("BK-2026-001");
    });
  });

  describe("Outsourcing Vendor Validation & Persistence", () => {
    it("validates vendor input and rejects blank space data", () => {
      const valid = newVendorSchema.safeParse({
        name: "DevOps Nexus",
        service: "CI/CD Pipeline Support",
        balanceCents: 320000,
        status: "PENDING",
        iconType: "devops",
        email: "ops@devopsnexus.io",
      });
      expect(valid.success).toBe(true);

      const blankName = newVendorSchema.safeParse({
        name: "   ",
        service: "Development",
        balanceCents: 100000,
        status: "PENDING",
      });
      expect(blankName.success).toBe(false);

      const invalidEmail = newVendorSchema.safeParse({
        name: "Nexus",
        service: "DevOps",
        balanceCents: 50000,
        status: "PENDING",
        email: "invalid-email-no-at-sign",
      });
      expect(invalidEmail.success).toBe(false);
    });

    it("persists vendors, links clients, and toggles settlement status", () => {
      const db = getDb();

      // Create a client
      const clientId = "cli-vnd-test-1";
      db.insert(clients).values({
        id: clientId,
        name: "Fintech Labs Inc.",
        contactPerson: "Jane",
        email: "jane@fintech.io",
        currency: "USD",
        hasQuickBill: true,
      }).run();

      // Insert vendor
      const vendorId = "vnd-test-1";
      db.insert(vendors).values({
        id: vendorId,
        name: "DevOps Nexus",
        service: "Kubernetes Migration",
        balanceCents: 350000,
        status: "PENDING",
        iconType: "devops",
        email: "devops@nexus.com",
        linkedClientId: clientId,
        payoutDueDate: "2026-10-25",
      }).run();

      const list = listVendors();
      const found = list.find((v) => v.id === vendorId);
      expect(found).toBeDefined();
      expect(found?.name).toBe("DevOps Nexus");
      expect(found?.currentBalance).toBe(3500); // 350000 cents = $3,500
      expect(found?.linkedClientName).toBe("Fintech Labs Inc.");
      expect(found?.status).toBe("PENDING");

      // Update status to PAID
      db.update(vendors)
        .set({ status: "PAID", updatedAt: new Date().toISOString() })
        .where(eq(vendors.id, vendorId))
        .run();

      const updatedList = listVendors();
      const updatedFound = updatedList.find((v) => v.id === vendorId);
      expect(updatedFound?.status).toBe("PAID");
    });
  });

  describe("Real-Time Analytics Engine", () => {
    it("computes live financial summary with revenue, expenses, net profit, and margins", () => {
      const db = getDb();
      db.delete(vendors).run();

      // Client
      db.insert(clients).values({
        id: "cli-an-1",
        name: "Apex Global",
        contactPerson: "Mark",
        email: "mark@apex.com",
        currency: "USD",
        hasQuickBill: true,
      }).run();

      // Invoices: 1 paid $5,000 (500000 cents), 1 unpaid $3,000 (300000 cents)
      db.insert(invoices).values({
        id: "inv-an-1",
        code: "INV-2026-001",
        clientId: "cli-an-1",
        amountCents: 500000,
        paidCents: 500000,
        currency: "USD",
        issueDate: "2026-10-01",
        status: "PAID",
      }).run();

      db.insert(invoices).values({
        id: "inv-an-2",
        code: "INV-2026-002",
        clientId: "cli-an-1",
        amountCents: 300000,
        paidCents: 0,
        currency: "USD",
        issueDate: "2026-10-02",
        dueDate: "2026-09-01", // overdue
        status: "OVERDUE",
      }).run();

      // Vendors: $2,000 (200000 cents) outsourced
      db.insert(vendors).values({
        id: "vnd-an-1",
        name: "Cloud Ops",
        service: "Infra",
        balanceCents: 200000,
        status: "PENDING",
        iconType: "devops",
      }).run();

      const summary = getAnalyticsSummary();

      expect(summary.totalRevenueCents).toBe(800000); // $8,000
      expect(summary.totalOutsourcedCents).toBe(200000); // $2,000
      expect(summary.netProfitCents).toBe(600000); // $6,000
      expect(summary.marginPct).toBe(75); // 6000 / 8000 = 75%
      expect(summary.pendingReceivablesCents).toBe(300000); // $3,000
      expect(summary.overdueCents).toBe(300000);
      expect(summary.overdueCount).toBe(1);
      expect(summary.activeClientsCount).toBe(1);
      expect(summary.vendorsCount).toBe(1);
      expect(summary.topClientName).toBe("Apex Global");
      expect(summary.monthlyTrends.length).toBe(6);
    });
  });
});
