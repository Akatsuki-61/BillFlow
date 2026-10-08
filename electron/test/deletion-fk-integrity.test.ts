import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { eq } from "drizzle-orm";
import { initDatabase, closeDatabaseForTesting, getDb } from "../db";
import {
  invoices,
  invoicePayments,
  attachments,
  tasks,
  workOrders,
  vendorPayouts,
  expenses,
  clients,
  vendors,
  catalogItems,
} from "../db/schema";
import { createInvoice, recordPayment, removeInvoice, exportInvoicePdf } from "../ipc/invoices";
import { decideTracking, createTask } from "../ipc/tasks";
import { copyReceipt } from "../ipc/files";
import { updateSettings } from "../ipc/settings";
import { removeClient } from "../ipc/clients";
import { removeVendor } from "../ipc/vendors";
import { createCatalogItem, removeCatalogItem } from "../ipc/catalog";
import { createWorkOrder, recordWorkOrderPayout } from "../ipc/workOrders";
import { createExpense } from "../ipc/expenses";

let directory: string;
let databasePath: string;
let pdfDirectory: string;

const testAssignee = {
  name: "Chethaka",
  avatarLetter: "C",
  bgColor: "bg-surface-purple-100",
  textColor: "text-content-purple-700",
};

beforeEach(() => {
  closeDatabaseForTesting();
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "billflow-deletion-test-"));
  databasePath = path.join(directory, "billflow.db");
  pdfDirectory = path.join(directory, "pdfs");
  fs.mkdirSync(pdfDirectory, { recursive: true });

  initDatabase(databasePath);
  updateSettings({
    businessName: "Chethaka Freelancing",
    professionalTitle: "Full-Stack Developer",
    defaultCurrency: "LKR",
    pdfExportDirectory: pdfDirectory,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  closeDatabaseForTesting();
  fs.rmSync(directory, { recursive: true, force: true });
});

function createDummyReceipt(name = "slip.png"): string {
  const filePath = path.join(directory, name);
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  ]);
  fs.writeFileSync(filePath, pngHeader);
  return filePath;
}

describe("Database Foreign Key Integrity on Deletions", () => {
  it("deleting an invoice with payments, receipts, tasks, work orders, payouts, and expenses succeeds without FK errors", async () => {
    // 1. Create invoice with 2 items in LKR minor units
    const invoice = createInvoice({
      requestId: crypto.randomUUID(),
      newClient: {
        name: "Acme Corp",
        email: "billing@acme.com",
        currency: "LKR",
        contactPerson: "Alice",
      },
      code: "INV-2026-001",
      items: [
        { description: "Website Development", quantity: 1, unitPriceCents: 8000000 },
        { description: "AI Automation Consulting", quantity: 1, unitPriceCents: 2000000 },
      ],
      amountCents: 9000000,
      discountCents: 1000000,
      advanceCents: 4500000,
      currency: "LKR",
      issueDate: "2026-10-01",
    });

    expect(invoice.id).toBeDefined();

    // 2. Export PDF
    await exportInvoicePdf(invoice.id);

    // 3. Record advance payment (45,000 LKR = 4,500,000 cents)
    const payment = recordPayment({
      requestId: crypto.randomUUID(),
      invoiceId: invoice.id,
      amountCents: 4500000,
      currency: "LKR",
      receivedAt: "2026-10-02T10:00:00.000Z",
      reference: "ADV-SLIP-001",
    });

    // 4. Attach payment receipt
    const receiptPath = createDummyReceipt("advance_slip.png");
    copyReceipt({ type: "payment", id: payment.payment.id }, receiptPath, crypto.randomUUID());

    // 5. Generate tasks via tracking decision
    const trackingRes = decideTracking(invoice.id, "yes");
    expect(trackingRes.taskIds.length).toBe(2);

    // 6. Create vendor and outsource one task
    const db = getDb();
    const vendorId = "vnd-subcontractor-001";
    db.insert(vendors)
      .values({
        id: vendorId,
        name: "Subcontractor Dev",
        service: "Frontend Work",
        email: "sub@example.com",
      })
      .run();

    const workOrder = createWorkOrder({
      vendorId,
      taskId: trackingRes.taskIds[0],
      invoiceId: invoice.id,
      scope: "Outsourced Frontend Component",
      feeCents: 3000000,
      currency: "LKR",
    });

    // 7. Record vendor payout and attach payout receipt
    recordWorkOrderPayout({
      workOrderId: workOrder.id,
      amountCents: 3000000,
      currency: "LKR",
    });

    const payout = db
      .select()
      .from(vendorPayouts)
      .where(eq(vendorPayouts.workOrderId, workOrder.id))
      .get()!;
    expect(payout).toBeDefined();

    const payoutReceiptPath = createDummyReceipt("payout_slip.png");
    copyReceipt({ type: "payout", id: payout.id }, payoutReceiptPath, crypto.randomUUID());

    // 8. Create general expense linked to this invoice
    const expense = createExpense({
      invoiceId: invoice.id,
      merchant: "Hosting Provider",
      description: "AWS Cloud Server",
      category: "Infrastructure",
      amountCents: 500000,
      currency: "LKR",
      incurredAt: "2026-10-03",
    });
    expect(expense.invoiceId).toBe(invoice.id);

    // Verify DB state before deletion
    expect(db.select().from(invoices).all()).toHaveLength(1);
    expect(db.select().from(invoicePayments).all()).toHaveLength(1);
    expect(db.select().from(attachments).all()).toHaveLength(2);
    expect(db.select().from(tasks).all()).toHaveLength(2);
    expect(db.select().from(workOrders).all()).toHaveLength(1);
    expect(db.select().from(vendorPayouts).all()).toHaveLength(1);
    expect(db.select().from(expenses).all()).toHaveLength(1);

    // 9. DELETE INVOICE - Must not throw ANY foreign key constraint error!
    const deleteResult = removeInvoice(invoice.id);
    expect(deleteResult).toEqual({ success: true });

    // 10. Verify DB state after deletion
    expect(db.select().from(invoices).all()).toHaveLength(0);
    expect(db.select().from(invoicePayments).all()).toHaveLength(0);
    expect(db.select().from(workOrders).all()).toHaveLength(0);
    expect(db.select().from(vendorPayouts).all()).toHaveLength(0);
    expect(db.select().from(tasks).all()).toHaveLength(0);
    expect(db.select().from(attachments).all()).toHaveLength(0);

    // Expense must be preserved with invoiceId = null
    const remainingExpenses = db.select().from(expenses).all();
    expect(remainingExpenses).toHaveLength(1);
    expect(remainingExpenses[0].invoiceId).toBeNull();
    expect(remainingExpenses[0].amountCents).toBe(500000);

    // 11. Verify persistence survives restart
    closeDatabaseForTesting();
    initDatabase(databasePath);
    const dbReloaded = getDb();
    expect(dbReloaded.select().from(invoices).all()).toHaveLength(0);
    expect(dbReloaded.select().from(expenses).all()).toHaveLength(1);
  });

  it("deleting a client with invoices throws CLIENT_HAS_INVOICES", () => {
    const invoice = createInvoice({
      requestId: crypto.randomUUID(),
      newClient: {
        name: "Client With Invoices",
        email: "cwi@example.com",
        currency: "USD",
        contactPerson: "Bob",
      },
      code: "INV-2026-002",
      items: [{ description: "Consulting", quantity: 1, unitPriceCents: 50000 }],
      amountCents: 50000,
      currency: "USD",
      issueDate: "2026-10-01",
    });

    expect(invoice.clientId).toBeDefined();

    expect(() => removeClient(invoice.clientId!)).toThrowError(/Cannot delete client/);
  });

  it("deleting a client with tasks but no invoices unlinks tasks without FK errors", () => {
    const invoice = createInvoice({
      requestId: crypto.randomUUID(),
      newClient: {
        name: "Temporary Client",
        email: "temp@example.com",
        currency: "USD",
        contactPerson: "Eve",
      },
      code: "INV-2026-003",
      items: [{ description: "Design", quantity: 1, unitPriceCents: 30000 }],
      amountCents: 30000,
      currency: "USD",
      issueDate: "2026-10-01",
    });

    const clientId = invoice.clientId!;

    // Delete the invoice first so client has no invoices
    removeInvoice(invoice.id);

    // Create a manual task linked to this client
    createTask({
      id: crypto.randomUUID(),
      clientId,
      title: "Follow up with Eve",
      description: "Send project brief",
      status: "todo",
      priority: "high",
      category: "Development",
      assignee: testAssignee,
      dueDate: "2026-10-20",
      subtasks: [],
    });

    const db = getDb();
    const taskBefore = db.select().from(tasks).all();
    expect(taskBefore).toHaveLength(1);
    expect(taskBefore[0].clientId).toBe(clientId);

    // Delete client - should succeed and unlink task without FK failure
    const res = removeClient(clientId);
    expect(res).toEqual({ success: true });

    // Client is gone
    const clientAfter = db.select().from(clients).where(eq(clients.id, clientId)).get();
    expect(clientAfter).toBeUndefined();

    // Task remains with clientId = null
    const taskAfter = db.select().from(tasks).all();
    expect(taskAfter).toHaveLength(1);
    expect(taskAfter[0].clientId).toBeNull();
  });

  it("deleting a vendor with active work orders throws VENDOR_HAS_WORK_ORDERS", () => {
    const invoice = createInvoice({
      requestId: crypto.randomUUID(),
      newClient: {
        name: "Vendor Test Client",
        email: "vtc@example.com",
        currency: "USD",
        contactPerson: "Charlie",
      },
      code: "INV-2026-004",
      items: [{ description: "Work", quantity: 1, unitPriceCents: 100000 }],
      amountCents: 100000,
      currency: "USD",
      issueDate: "2026-10-01",
    });

    const db = getDb();
    const vendorId = "vnd-active-001";
    db.insert(vendors)
      .values({
        id: vendorId,
        name: "Assigned Vendor",
        service: "DevOps",
        email: "assigned@example.com",
      })
      .run();

    const task = createTask({
      id: crypto.randomUUID(),
      title: "Deploy Cluster",
      description: "Kubernetes setup",
      status: "todo",
      priority: "medium",
      category: "Development",
      assignee: testAssignee,
      dueDate: "2026-10-25",
      subtasks: [],
    });

    createWorkOrder({
      vendorId,
      taskId: task.id,
      invoiceId: invoice.id,
      scope: "Cluster Setup",
      feeCents: 50000,
      currency: "USD",
    });

    expect(() => removeVendor(vendorId)).toThrowError(/Cannot delete vendor/);
  });

  it("deleting a vendor without work orders succeeds cleanly", () => {
    const db = getDb();
    const vendorId = "vnd-unassigned-001";
    db.insert(vendors)
      .values({
        id: vendorId,
        name: "Unassigned Vendor",
        service: "Copywriting",
        email: "copy@example.com",
      })
      .run();

    const res = removeVendor(vendorId);
    expect(res).toEqual({ success: true });

    expect(db.select().from(vendors).where(eq(vendors.id, vendorId)).get()).toBeUndefined();
  });

  it("deleting a catalog item unlinks invoices without deleting them or FK error", () => {
    const catItem = createCatalogItem({
      title: "Standard Web Package",
      category: "Development",
      sku: "SKU-WEB-001",
      description: "Full site build",
      price: "1500",
      currency: "USD",
      unit: "/ Flat",
      iconType: "code",
    });

    const invoice = createInvoice({
      requestId: crypto.randomUUID(),
      catalogItemId: catItem.id,
      newClient: {
        name: "Catalog Buyer",
        email: "buyer@example.com",
        currency: "USD",
        contactPerson: "Dave",
      },
      code: "INV-2026-005",
      items: [{ description: catItem.title, quantity: 1, unitPriceCents: 150000 }],
      amountCents: 150000,
      currency: "USD",
      issueDate: "2026-10-01",
    });

    const db = getDb();
    const invBefore = db.select().from(invoices).where(eq(invoices.id, invoice.id)).get()!;
    expect(invBefore.catalogItemId).toBe(catItem.id);

    // Delete catalog item
    const res = removeCatalogItem(catItem.id);
    expect(res).toEqual({ success: true });

    // Catalog item is deleted
    expect(db.select().from(catalogItems).where(eq(catalogItems.id, catItem.id)).get()).toBeUndefined();

    // Invoice still exists, but catalogItemId is nullified
    const invAfter = db.select().from(invoices).where(eq(invoices.id, invoice.id)).get()!;
    expect(invAfter).toBeDefined();
    expect(invAfter.catalogItemId).toBeNull();
    expect(invAfter.code).toBe("INV-2026-005");
  });
});
