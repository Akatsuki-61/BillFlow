import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import { initDatabase, closeDatabaseForTesting, getDb } from "../db";
import { clients, invoices } from "../db/schema";
import { listClientsWithStats } from "../ipc/clients";
import { getNextInvoiceCode } from "../ipc/invoices";
import { getDashboardSummary } from "../ipc/dashboard";
import { newClientSchema, newInvoiceSchema } from "../validation";
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
});
