import Database from "better-sqlite3";
import fs from "fs";
import { createHash } from "crypto";
import { getTableColumns } from "drizzle-orm";
import { updateSettingsSchema } from "./validation";
import { z } from "zod";
import { getDb, getSqlite, migrateDatabase } from "./db";
import { clients, invoices, settings } from "./db/schema";
import type { ExportDataPayload } from "../src/types/settings";
import { getOrCreateSettings } from "./ipc/settings";
import { managedAttachmentPath, MAX_RECEIPT_BYTES, receiptFormat, publishManagedAttachment } from "./managed-files";
import { createTaskSchema, deliveryLink, currencySchema, taskStatus } from "./workflow-validation";

// Parent-first order; deleting uses the reverse order.
export const backupTables = ["settings", "clients", "vendors", "catalog_services", "invoices", "invoice_items", "invoice_payments", "tasks", "subtasks", "task_history", "expenses", "work_orders", "vendor_payouts", "attachments", "invoice_pdf_exports"] as const;
type Row = Record<string, string | number | null>;
const backupSchema = z.object({
  version: z.literal("2"), exportedAt: z.string().datetime(), settings: z.unknown(), clients: z.array(z.unknown()), invoices: z.array(z.unknown()),
  records: z.record(z.string(), z.array(z.record(z.string(), z.union([z.string(), z.number().finite().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER), z.null()]))).max(50000)),
  files: z.array(z.object({ storedName: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/), base64: z.string().max(Math.ceil(MAX_RECEIPT_BYTES * 4 / 3) + 4) }).strict()).max(5000),
}).strict();

function readAttachment(row: Row) {
  const bytes = fs.readFileSync(managedAttachmentPath(String(row.stored_name)));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== row.sha256 || bytes.length !== row.size_bytes) throw new Error(`Receipt integrity check failed: ${row.original_name}`);
  return { storedName: String(row.stored_name), sha256, base64: bytes.toString("base64") };
}
export function exportWorkspace(): ExportDataPayload {
  getOrCreateSettings();
  const sqlite = getSqlite();
  return sqlite.transaction(() => {
    const records: Record<string, Row[]> = {};
    for (const table of backupTables) records[table] = sqlite.prepare(`SELECT * FROM "${table}"`).all() as Row[];
    // PDF output locations are machine-local, independently regenerable artifacts.
    records.invoice_pdf_exports = [];
    const files = [...new Map(records.attachments.map(row => [row.stored_name, readAttachment(row)])).values()];
    return { version: "2", exportedAt: new Date().toISOString(), settings: getOrCreateSettings(), clients: getDb().select().from(clients).all(), invoices: getDb().select().from(invoices).all(), records, files };
  })();
}

function validateRows(database: Database.Database, table: string, rows: Row[]) {
  const columns = database.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string; type: string; notnull: number }>;
  for (const row of rows) {
    if (Object.keys(row).length !== columns.length || columns.some(c => !(c.name in row))) throw new Error(`Backup has missing or unexpected ${table} fields.`);
    for (const c of columns) {
      const value = row[c.name];
      if (value === null) { if (c.notnull) throw new Error(`Missing ${table}.${c.name}`); continue; }
      if (c.type === "INTEGER" && c.name !== "default_tax_rate" && (typeof value !== "number" || !Number.isSafeInteger(value))) throw new Error(`Invalid integer ${table}.${c.name}`);
      if (c.type === "TEXT" && typeof value !== "string") throw new Error(`Invalid text ${table}.${c.name}`);
      if (c.name.endsWith("cents") && (typeof value !== "number" || value < 0)) throw new Error(`Invalid amount ${table}.${c.name}`);
    }
    if (row.currency) currencySchema.parse(row.currency);
    if (table === "settings") {
      const fields = Object.fromEntries(Object.entries(getTableColumns(settings)).filter(([key]) => key !== "id" && key !== "updatedAt").map(([key, column]) => [key, row[column.name]]));
      updateSettingsSchema.parse(fields);
    }
    for (const [field, value] of Object.entries(row)) {
      if (value !== null && (field.endsWith("_at") || field === "active_since") && !Number.isFinite(Date.parse(String(value)))) throw new Error(`Invalid timestamp ${table}.${field}`);
    }
    if (row.delivery_url) deliveryLink.parse(row.delivery_url);
    if (table === "invoices") {
      z.enum(["DRAFT", "UNPAID", "PAID", "OVERDUE", "ADVANCE_PAID"]).parse(row.status);
      if (row.client_snapshot) z.object({ name: z.string().min(1) }).passthrough().parse(JSON.parse(String(row.client_snapshot)));
      if (row.client_id === null && !row.client_snapshot) throw new Error("Temporary invoice client snapshot is missing.");
      if (Number(row.advance_cents) > Number(row.amount_cents)) throw new Error("Advance exceeds invoice total.");
      if (row.tracking_choice !== null) z.enum(["yes", "no"]).parse(row.tracking_choice);
    }
    if (table === "tasks") {
      createTaskSchema.parse({ id: row.id, title: row.title, description: row.description, status: row.status, priority: row.priority, category: row.category, assignee: JSON.parse(String(row.assignee)), dueDate: row.due_date, subtasks: [], deliveryUrl: row.delivery_url, currency: row.currency, outsourceBudgetCents: row.outsource_budget ?? undefined });
      if (Number(row.active_milliseconds) < 0 || ((row.status === "in-progress" && row.deleted_at === null) !== (row.active_since !== null))) throw new Error("Invalid task working-time state.");
    }
    if (table === "task_history") { taskStatus.parse(row.to_status); if (row.from_status !== null) taskStatus.parse(row.from_status); }
    if (table === "subtasks" && ![0,1].includes(Number(row.completed))) throw new Error("Invalid subtask completion.");
  }
}
function insertRows(database: Database.Database, table: string, rows: Row[]) {
  const columns = (database.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>).map(c => c.name);
  const insert = database.prepare(`INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(",")}) VALUES (${columns.map(() => "?").join(",")})`);
  for (const row of rows) insert.run(...columns.map(c => row[c]));
}

export function importWorkspace(input: ExportDataPayload) {
  if (input?.version !== "2") throw new Error("This backup predates complete workflow backups. Use the previous app version to restore it, then export a version 2 backup.");
  const payload = backupSchema.parse(input);
  if (Object.keys(payload.records).length !== backupTables.length || backupTables.some(t => !Array.isArray(payload.records[t]))) throw new Error("Backup is missing required workflow tables.");
  if (payload.records.invoice_pdf_exports.length) throw new Error("Backup must not restore machine-local PDF paths.");
  const sandbox = new Database(":memory:");
  const fileBytes = new Map<string, Buffer>();
  try {
    sandbox.pragma("foreign_keys = ON");
    migrateDatabase(sandbox);
    sandbox.transaction(() => {
      for (const table of backupTables) { validateRows(sandbox, table, payload.records[table]); insertRows(sandbox, table, payload.records[table]); }
    })();
    if (payload.records.settings.length !== 1 || payload.records.settings[0].id !== "default") throw new Error("Backup must contain the default settings record.");
    // Match the presentation counts so import confirmation cannot misrepresent the payload.
    if (payload.clients.length !== payload.records.clients.length || payload.invoices.length !== payload.records.invoices.length) throw new Error("Backup record counts do not match.");
    for (const file of payload.files) {
      managedAttachmentPath(file.storedName);
      if (fileBytes.has(file.storedName) || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.base64)) throw new Error("Duplicate or invalid attachment bytes.");
      const bytes = Buffer.from(file.base64, "base64");
      const format = receiptFormat(bytes);
      if (!bytes.length || bytes.length > MAX_RECEIPT_BYTES || createHash("sha256").update(bytes).digest("hex") !== file.sha256 || file.storedName !== `${file.sha256}.${format.extension}`) throw new Error("Receipt integrity check failed.");
      fileBytes.set(file.storedName, bytes);
    }
    if ([...fileBytes.values()].reduce((s, b) => s + b.length, 0) > 100 * 1024 * 1024) throw new Error("Backup attachments exceed 100 MB.");
    const expected = new Set(payload.records.attachments.map(r => String(r.stored_name)));
    if (expected.size !== fileBytes.size || [...expected].some(name => !fileBytes.has(name))) throw new Error("Backup receipt files are missing or unreferenced.");
    for (const row of payload.records.attachments) {
      const bytes = fileBytes.get(String(row.stored_name))!;
      const format = receiptFormat(bytes);
      if (bytes.length !== row.size_bytes || row.sha256 !== createHash("sha256").update(bytes).digest("hex") || row.mime_type !== format.mimeType) throw new Error("Receipt metadata does not match its bytes.");
    }
    const mismatch = sandbox.prepare(`SELECT p.id FROM invoice_payments p JOIN invoices i ON i.id=p.invoice_id WHERE p.currency<>i.currency UNION ALL SELECT p.id FROM vendor_payouts p JOIN work_orders w ON w.id=p.work_order_id WHERE p.currency<>w.currency`).all();
    if (mismatch.length) throw new Error("Payment currencies do not match their owner.");
    const brokenLinks = sandbox.prepare(`
      SELECT t.id FROM tasks t JOIN invoice_items item ON item.id=t.invoice_item_id
        JOIN invoices i ON i.id=item.invoice_id
        WHERE t.invoice_id IS NOT item.invoice_id OR t.client_id IS NOT i.client_id OR t.currency<>i.currency
      UNION ALL SELECT w.id FROM work_orders w JOIN tasks t ON t.id=w.task_id
        WHERE t.invoice_id IS NOT w.invoice_id
    `).all();
    if (brokenLinks.length) throw new Error("Task and work-order source links do not match.");
  } finally { sandbox.close(); }

  const created: string[] = [];
  try {
    // Content-addressed files are immutable: publish new files before committing their metadata.
    // A process interruption before commit leaves only unreferenced files, never partial records.
    for (const [name, bytes] of fileBytes) {
      const published = publishManagedAttachment(name, bytes);
      if (published.created) created.push(published.destination);
    }
    const sqlite = getSqlite();
    sqlite.transaction(() => {
      for (const table of [...backupTables].reverse()) sqlite.prepare(`DELETE FROM "${table}"`).run();
      for (const table of backupTables) insertRows(sqlite, table, payload.records[table]);
    })();
  } catch (error) {
    for (const file of created) fs.rmSync(file, { force: true });
    throw error;
  }
  return { success: true, importedClients: payload.records.clients.length, importedInvoices: payload.records.invoices.length };
}

export function resetWorkspace() {
  const sqlite = getSqlite();
  const names = (sqlite.prepare("SELECT stored_name FROM attachments").all() as Array<{ stored_name: string }>).map(r => r.stored_name);
  sqlite.transaction(() => {
    for (const table of [...backupTables].reverse()) if (table !== "settings") sqlite.prepare(`DELETE FROM "${table}"`).run();
    sqlite.prepare("UPDATE settings SET next_invoice_seq=1 WHERE id='default'").run();
  })();
  for (const name of new Set(names)) fs.rmSync(managedAttachmentPath(name), { force: true });
  return { success: true };
}
