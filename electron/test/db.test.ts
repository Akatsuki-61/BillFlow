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
        name: "Acme Corp",
        category: "Enterprise",
        email: "billing@acme.com",
        currency: "USD",
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.name).toBe("Acme Corp");
        expect(valid.data.currency).toBe("USD");
      }
    });

    it("rejects client with invalid email", () => {
      const invalid = newClientSchema.safeParse({
        name: "Acme Corp",
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
        name: "Stark Industries",
        category: "Enterprise",
        contactPerson: "Tony Stark",
        email: "tony@stark.com",
        currency: "USD",
        hasQuickBill: true,
      }).run();

      db.insert(clients).values({
        id: clientBId,
        name: "Wayne Enterprises",
        category: "Enterprise",
        contactPerson: "Bruce Wayne",
        email: "bruce@wayne.com",
        currency: "USD",
        hasQuickBill: true,
      }).run();

      // Initial stats: both have 0 billed and 0 invoices
      let clientStats = listClientsWithStats();
      expect(clientStats.length).toBe(2);

      const starkInitial = clientStats.find((c) => c.id === clientAId);
      expect(starkInitial?.totalBilledCents).toBe(0);
      expect(starkInitial?.outstandingBalanceCents).toBe(0);
      expect(starkInitial?.invoicesCount).toBe(0);

      // 2. Next invoice code sequence
      const nextCode1 = getNextInvoiceCode();
      const currentYear = new Date().getFullYear();
      expect(nextCode1).toBe(`INV-${currentYear}-001`);

      // 3. Create an invoice for Stark Industries ($1,500.00 / 150000 cents, UNPAID)
      const invId1 = "inv-test-1";
      db.insert(invoices).values({
        id: invId1,
        code: nextCode1,
        clientId: clientAId,
        title: "Arc Reactor Consulting",
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

      // 4. Verify Stark Industries stats are dynamically computed
      clientStats = listClientsWithStats();
      const starkAfterInv = clientStats.find((c) => c.id === clientAId);
      expect(starkAfterInv?.totalBilledCents).toBe(150000);
      expect(starkAfterInv?.totalPaidCents).toBe(0);
      expect(starkAfterInv?.outstandingBalanceCents).toBe(150000);
      expect(starkAfterInv?.invoicesCount).toBe(1);
      expect(starkAfterInv?.recentInvoices.length).toBe(1);
      expect(starkAfterInv?.recentInvoices[0].code).toBe(nextCode1);

      // Wayne Enterprises must remain completely unaffected (0 balance)
      const wayneAfterInv = clientStats.find((c) => c.id === clientBId);
      expect(wayneAfterInv?.totalBilledCents).toBe(0);
      expect(wayneAfterInv?.outstandingBalanceCents).toBe(0);
      expect(wayneAfterInv?.invoicesCount).toBe(0);

      // 5. Verify Dashboard summary aggregates correctly
      const dashboard = getDashboardSummary();
      expect(dashboard.activeClients).toBe(2);
      expect(dashboard.unpaidCount).toBe(1);
      expect(dashboard.totalBilledByCurrency["USD"]).toBe(150000);
      expect(dashboard.outstandingByCurrency["USD"]).toBe(150000);
      expect(dashboard.recentInvoices.length).toBe(1);
      expect(dashboard.recentInvoices[0].clientName).toBe("Stark Industries");

      // 6. Settle invoice (mark as PAID)
      db.update(invoices)
        .set({ status: "PAID", paidCents: 150000 })
        .where(eq(invoices.id, invId1))
        .run();

      clientStats = listClientsWithStats();
      const starkAfterPaid = clientStats.find((c) => c.id === clientAId);
      expect(starkAfterPaid?.totalBilledCents).toBe(150000);
      expect(starkAfterPaid?.totalPaidCents).toBe(150000);
      expect(starkAfterPaid?.outstandingBalanceCents).toBe(0);

      const dashboardAfterPaid = getDashboardSummary();
      expect(dashboardAfterPaid.unpaidCount).toBe(0);
      expect(dashboardAfterPaid.outstandingByCurrency["USD"] || 0).toBe(0);

      // 7. Verify Client deletion is blocked when invoices exist
      const starkInvoicesCount = db.select().from(invoices).where(eq(invoices.clientId, clientAId)).all().length;
      expect(starkInvoicesCount).toBe(1);

      // 8. Delete Wayne Enterprises (has no invoices - must succeed)
      db.delete(clients).where(eq(clients.id, clientBId)).run();
      const remainingClients = db.select().from(clients).all();
      expect(remainingClients.length).toBe(1);
      expect(remainingClients[0].id).toBe(clientAId);
    });
  });
});
