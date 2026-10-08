import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { initDatabase, closeDatabaseForTesting, getDb, getSqlite } from "../db";
import { clients, invoices, invoiceItems, invoicePayments, expenses, vendors } from "../db/schema";
import { createTask, updateTask, deleteTask, getTaskHistory, listTasks, pendingTracking, decideTracking } from "../ipc/tasks";
import { copyReceipt, listAttachments, managedAttachmentPath, saveInvoicePdf } from "../ipc/files";
import { exportWorkspace, importWorkspace, resetWorkspace, updateSettings } from "../ipc/settings";
import type { TaskCreateInput } from "../../src/types/workflow";

let directory: string;
let databasePath: string;
const assignee = { name: "Chethaka", avatarLetter: "C", bgColor: "bg-surface-purple-100", textColor: "text-content-purple-700" };
const input = (id = "manual"): TaskCreateInput => ({ id, title: "Business website", description: "Website scope", status: "todo", priority: "medium", category: "Development", assignee, dueDate: "", subtasks: [{ id: "subtask", title: "Review layout", completed: false }] });
function invoiceFixture() {
  const db = getDb();
  db.insert(clients).values({ id: "client", name: "Business client", contactPerson: "Client", email: "client@example.com", currency: "LKR", driveUrl: "https://example.com/delivery" }).run();
  db.insert(invoices).values({ id: "invoice", code: "INV-001", clientId: "client", clientSnapshot: JSON.stringify({ name: "Issued client", driveUrl: "https://example.com/issued" }), amountCents: 9000000, advanceCents: 4500000, currency: "LKR", issueDate: "2026-10-06" }).run();
  db.insert(invoiceItems).values([{ id: "website", invoiceId: "invoice", description: "Business website development", unitPriceCents: 8000000, position: 0 }, { id: "consulting", invoiceId: "invoice", description: "AI consulting and recommendations", unitPriceCents: 2000000, position: 1 }]).run();
}
function pay(amount = 4500000, id = "advance") {
  getDb().insert(invoicePayments).values({ id, requestId: id, invoiceId: "invoice", amountCents: amount, currency: "LKR", receivedAt: new Date().toISOString() }).run();
}
function restart() { closeDatabaseForTesting(); initDatabase(databasePath); }

beforeEach(() => {
  closeDatabaseForTesting();
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "billflow-workflow-"));
  databasePath = path.join(directory, "billflow.db");
  initDatabase(databasePath);
});
afterEach(() => {
  vi.useRealTimers(); vi.restoreAllMocks(); closeDatabaseForTesting();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("persistent task workflow", () => {
  it("preserves task CRUD, subtasks and source links after reopening the database", () => {
    createTask(input());
    createTask(input());
    expect(() => createTask({ ...input(), title: "Conflicting retry" })).toThrow("different details");
    expect(listTasks()).toHaveLength(1);
    updateTask("manual", { title: "Website build", subtasks: [{ id: "subtask", title: "Review layout", completed: true }] });
    restart();
    expect(listTasks()[0]).toMatchObject({ title: "Website build", subtasks: [{ completed: true }] });
    deleteTask("manual"); restart();
    expect(listTasks()).toEqual([]);
    expect(() => createTask(input())).toThrow("deleted");
  });
  it("accumulates only In progress intervals across review, restart and completion", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-06T10:00:00Z"));
    createTask(input());
    vi.setSystemTime(new Date("2026-10-06T10:10:00Z")); updateTask("manual", { status: "in-progress" });
    vi.setSystemTime(new Date("2026-10-06T10:20:00Z")); updateTask("manual", { status: "review" });
    restart();
    vi.setSystemTime(new Date("2026-10-06T11:00:00Z")); updateTask("manual", { status: "in-progress" });
    vi.setSystemTime(new Date("2026-10-06T11:05:00Z")); updateTask("manual", { status: "done" });
    updateTask("manual", { status: "done" });
    restart();
    expect(listTasks()[0]).toMatchObject({ activeMilliseconds: 15 * 60000, activeSince: null, startedAt: "2026-10-06T10:10:00.000Z", completedAt: "2026-10-06T11:05:00.000Z" });
    expect(getTaskHistory("manual")).toHaveLength(5);
  });
  it("does not offer tracking for status toggles or a below-threshold advance", () => {
    invoiceFixture();
    getDb().update(invoices).set({ status: "PAID", paidCents: 9000000 }).where(eq(invoices.id, "invoice")).run();
    expect(pendingTracking()).toEqual([]);
    pay(4499999); expect(pendingTracking()).toEqual([]);
    expect(() => decideTracking("invoice", "yes")).toThrow("required advance");
    pay(1, "rest"); expect(pendingTracking()).toHaveLength(1);
  });
  it("creates exactly one task per deliverable and preserves the decision through retries/deletion/restart", () => {
    invoiceFixture(); pay();
    expect(pendingTracking()).toHaveLength(1);
    expect(decideTracking("invoice", "yes").taskIds).toHaveLength(2);
    expect(decideTracking("invoice", "yes").taskIds).toHaveLength(2);
    expect(listTasks()[0]).toMatchObject({ invoiceId: "invoice", clientId: "client", clientName: "Issued client", deliveryUrl: "https://example.com/issued", status: "todo" });
    deleteTask(listTasks()[0].id); restart();
    expect(pendingTracking()).toEqual([]);
    expect(decideTracking("invoice", "yes").taskIds).toHaveLength(1);
    expect(getSqlite().prepare("SELECT COUNT(*) AS n FROM tasks").get()).toEqual({ n: 2 });
    expect(getDb().select().from(invoices).get()?.paidCents).toBe(0); // Task work never invents collections.
  });
  it("persists No without creating tasks or reversing the payment", () => {
    invoiceFixture(); pay(); pendingTracking(); decideTracking("invoice", "no"); restart();
    expect(pendingTracking()).toEqual([]); expect(listTasks()).toEqual([]);
    expect(decideTracking("invoice", "yes")).toEqual({ choice: "no", taskIds: [] });
    expect(getDb().select().from(invoicePayments).all()).toHaveLength(1);
  });
  it("supports invoice-only clients and job-specific delivery overrides", () => {
    invoiceFixture(); pay();
    getDb().update(invoices).set({ clientId: null, deliveryUrl: "https://example.com/job" }).where(eq(invoices.id, "invoice")).run();
    decideTracking("invoice", "yes");
    expect(listTasks()[0]).toMatchObject({ clientId: null, clientName: "Issued client", deliveryUrl: "https://example.com/job" });
  });
  it("validates edits and rolls back duplicate subtask IDs", () => {
    createTask(input());
    expect(() => updateTask("manual", { status: "in-progress", subtasks: [{ id: "x", title: "A", completed: false }, { id: "x", title: "B", completed: true }] })).toThrow();
    expect(listTasks()[0].status).toBe("todo");
    expect(() => updateTask("manual", { deliveryUrl: "javascript:alert(1)" })).toThrow();
    expect(() => updateTask("manual", { title: "   " })).toThrow();
  });
});

describe("managed files and complete backups", () => {
  it("copies a real receipt, reopens its storage after source removal, and restores bytes/owners into a clean profile", () => {
    invoiceFixture(); pay(); decideTracking("invoice", "yes");
    const source = path.join(directory, "receipt.png");
    const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
    fs.writeFileSync(source, bytes);
    copyReceipt({ type: "payment", id: "advance" }, source, "receipt-request");
    copyReceipt({ type: "payment", id: "advance" }, source, "receipt-request");
    fs.rmSync(source); restart();
    expect(listAttachments({ type: "payment", id: "advance" })).toHaveLength(1);
    const backup = exportWorkspace();
    expect(backup.files).toHaveLength(1);
    const storedName = backup.files![0].storedName;
    expect(fs.readFileSync(managedAttachmentPath(storedName))).toEqual(bytes);
    resetWorkspace();
    expect(fs.existsSync(managedAttachmentPath(storedName))).toBe(false);
    importWorkspace(backup); importWorkspace(backup); restart();
    expect(fs.readFileSync(managedAttachmentPath(storedName))).toEqual(bytes);
    expect(listTasks()).toHaveLength(2);
    expect(listAttachments({ type: "payment", id: "advance" })).toHaveLength(1);
    expect(getTaskHistory(listTasks()[0].id)).toHaveLength(1);
  });
  it("rejects missing/corrupt files and broken relationships before changing the workspace", () => {
    invoiceFixture(); pay(); createTask(input());
    const source = path.join(directory, "receipt.png");
    fs.writeFileSync(source, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64"));
    copyReceipt({ type: "payment", id: "advance" }, source, "receipt");
    const backup = exportWorkspace();
    const missing = structuredClone(backup); missing.files = [];
    expect(() => importWorkspace(missing)).toThrow("missing");
    const corrupt = structuredClone(backup); corrupt.files![0].base64 = "AAAA";
    expect(() => importWorkspace(corrupt)).toThrow();
    const orphan = structuredClone(backup); orphan.records!.invoice_items[0].invoice_id = "absent";
    expect(() => importWorkspace(orphan)).toThrow();
    const wrong = structuredClone(backup); wrong.records!.invoice_payments[0].currency = "USD";
    expect(() => importWorkspace(wrong)).toThrow("currencies");
    expect(listTasks()).toHaveLength(1);
    expect(getDb().select().from(invoicePayments).all()).toHaveLength(1);
  });
  it("rolls back live restore errors and cleans newly published receipt files", () => {
    invoiceFixture(); pay();
    const source = path.join(directory, "receipt.png");
    fs.writeFileSync(source, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64"));
    copyReceipt({ type: "payment", id: "advance" }, source, "receipt");
    const backup = exportWorkspace(); resetWorkspace();
    createTask(input());
    getSqlite().exec("CREATE TRIGGER fail_restore BEFORE INSERT ON invoice_items BEGIN SELECT RAISE(ABORT, 'injected restore failure'); END");
    expect(() => importWorkspace(backup)).toThrow("injected restore failure");
    expect(listTasks()).toHaveLength(1);
    expect(getDb().select().from(invoices).all()).toEqual([]);
    expect(fs.existsSync(managedAttachmentPath(backup.files![0].storedName))).toBe(false);
  });
  it("includes every domain and keeps settings on complete business reset", () => {
    updateSettings({ businessName: "Chethaka", defaultTaxRate: 0.5 });
    getDb().insert(vendors).values({ id: "vendor", name: "Developer", service: "Website" }).run();
    getDb().insert(expenses).values({ id: "expense", description: "Hosting", category: "Software", amountCents: 500000, currency: "LKR", incurredAt: "2026-10-06" }).run();
    const backup = exportWorkspace(); resetWorkspace(); importWorkspace(backup);
    expect(getDb().select().from(vendors).all()).toHaveLength(1);
    expect(getDb().select().from(expenses).all()).toHaveLength(1);
    resetWorkspace(); restart();
    expect(getDb().select().from(vendors).all()).toEqual([]);
    expect(exportWorkspace().settings.businessName).toBe("Chethaka");
  });
  it("writes PDF output for an existing invoice and reports a removed export directory without duplicating it", () => {
    invoiceFixture();
    const output = path.join(directory, "pdfs"); fs.mkdirSync(output);
    updateSettings({ pdfExportDirectory: output }); restart();
    const bytes = Buffer.from("%PDF-1.4\n% exporter contract fixture\n%%EOF");
    const first = saveInvoicePdf("invoice", bytes);
    expect(fs.readFileSync(first)).toEqual(bytes);
    expect(saveInvoicePdf("invoice", bytes)).toBe(first);
    fs.rmSync(output, { recursive: true });
    expect(() => saveInvoicePdf("invoice", bytes)).toThrow("missing");
    expect(getDb().select().from(invoices).all()).toHaveLength(1);
  });

  it("edits client profiles while preserving existing invoice clientSnapshots and delivery URLs", () => {
    invoiceFixture();
    const db = getDb();
    
    // Update client profile details and default delivery driveUrl
    db.update(clients)
      .set({
        name: "Updated Client Name",
        email: "updated@example.com",
        driveUrl: "https://drive.google.com/folder-v2",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(clients.id, "client"))
      .run();

    restart();

    // Verify client profile has updated
    const updatedClient = getDb().select().from(clients).where(eq(clients.id, "client")).get();
    expect(updatedClient).toMatchObject({
      name: "Updated Client Name",
      email: "updated@example.com",
      driveUrl: "https://drive.google.com/folder-v2",
    });

    // Verify existing invoice retains its original issued clientSnapshot and delivery details
    const existingInvoice = getDb().select().from(invoices).where(eq(invoices.id, "invoice")).get();
    expect(existingInvoice?.clientSnapshot).toContain("Issued client");
    const snapshot = JSON.parse(existingInvoice?.clientSnapshot || "{}");
    expect(snapshot.driveUrl).toBe("https://example.com/issued");
  });

  it("attaches pre-selected receipt slips directly to payments", () => {
    invoiceFixture(); pay();
    const source = path.join(directory, "slip.png");
    fs.writeFileSync(source, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64"));
    const attached = copyReceipt({ type: "payment", id: "advance" }, source, "slip-req-1");
    expect(attached).toMatchObject({
      id: "slip-req-1",
      paymentId: "advance",
      originalName: "slip.png",
      mimeType: "image/png",
    });
    const list = listAttachments({ type: "payment", id: "advance" });
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("slip-req-1");
  });
});

it("migrates a populated pre-workflow database while preserving client/invoice/vendor records", () => {
  closeDatabaseForTesting();
  fs.rmSync(databasePath);
  const oldFolder = path.join(directory, "old-migrations"); fs.mkdirSync(path.join(oldFolder, "meta"), { recursive: true });
  const journal = JSON.parse(fs.readFileSync("drizzle/meta/_journal.json", "utf8"));
  journal.entries = journal.entries.slice(0, 3);
  fs.writeFileSync(path.join(oldFolder, "meta/_journal.json"), JSON.stringify(journal));
  for (const entry of journal.entries) fs.copyFileSync(`drizzle/${entry.tag}.sql`, path.join(oldFolder, `${entry.tag}.sql`));
  const old = new Database(databasePath); old.pragma("foreign_keys = ON");
  migrate(drizzle(old), { migrationsFolder: oldFolder });
  old.prepare("INSERT INTO clients(id,name,contact_person,email) VALUES ('old-client','Client','Client','client@example.com')").run();
  old.prepare("INSERT INTO invoices(id,code,client_id,amount_cents,issue_date,paid_cents,status) VALUES ('old-invoice','INV-OLD','old-client',10000,'2026-10-01',5000,'UNPAID')").run();
  old.prepare("INSERT INTO vendors(id,name,service) VALUES ('old-vendor','Vendor','Development')").run();
  old.close(); initDatabase(databasePath);
  expect(getDb().select().from(invoices).get()).toMatchObject({ id: "old-invoice", amountCents: 10000, paidCents: 5000, advanceCents: 0 });
  expect(getDb().select().from(vendors).get()?.id).toBe("old-vendor");
  expect(getSqlite().pragma("foreign_key_check")).toEqual([]);
});

it("does not publish a database connection after a required migration failure", () => {
  closeDatabaseForTesting();
  const exists = fs.existsSync;
  const spy = vi.spyOn(fs, "existsSync").mockImplementation(value => String(value).endsWith("_journal.json") ? false : exists(value));
  expect(() => initDatabase(databasePath)).toThrow("Business writes are disabled");
  spy.mockRestore();
  initDatabase(databasePath);
  expect(listTasks()).toEqual([]);
});
