import {
  MAX_BACKUP_BYTES,
  MAX_BACKUP_ATTACHMENT_BYTES,
  MAX_BACKUP_ROWS_PER_TABLE,
} from "../src/lib/backup-limits";
import { reclaimUnreferencedReceipts } from "./receipt-cleanup";
import { validateInvoiceAmounts } from "../src/lib/invoice-math";
import Database from "better-sqlite3";
import fs from "fs";
import { createHash } from "crypto";
import { getTableColumns } from "drizzle-orm";
import { newCalendarEventSchema, updateSettingsSchema } from "./validation";
import { z } from "zod";
import { getDb, getSqlite, migrateDatabase } from "./db";
import { assertWorkspaceIntegrity } from "./db/integrity";
import {
  clients,
  invoices,
  settings,
  catalogItems,
  vendors,
} from "./db/schema";
import type { ExportDataPayload } from "../src/types/settings";
import { getOrCreateSettings } from "./ipc/settings";
import {
  managedAttachmentPath,
  MAX_RECEIPT_BYTES,
  receiptFormat,
  publishManagedAttachment,
} from "./managed-files";
import {
  createTaskSchema,
  deliveryLink,
  currencySchema,
  taskStatus,
} from "./workflow-validation";

// Parent-first order; deleting uses the reverse order.
export const backupTables = [
  "settings",
  "clients",
  "vendors",
  "catalog_items",
  "catalog_services",
  "invoices",
  "invoice_items",
  "invoice_payments",
  "tasks",
  "calendar_events",
  "subtasks",
  "task_history",
  "expenses",
  "work_orders",
  "vendor_payouts",
  "attachments",
  "invoice_pdf_exports",
  "work_order_pdf_exports",
  "task_time_slots",
] as const;
type Row = Record<string, string | number | null>;
const backupSchema = z
  .object({
    version: z.literal("2"),
    exportedAt: z.string().datetime(),
    settings: z.unknown(),
    clients: z.array(z.unknown()).max(MAX_BACKUP_ROWS_PER_TABLE),
    invoices: z.array(z.unknown()).max(MAX_BACKUP_ROWS_PER_TABLE),
    catalogItems: z
      .array(z.unknown())
      .max(MAX_BACKUP_ROWS_PER_TABLE)
      .optional(),
    vendors: z.array(z.unknown()).max(MAX_BACKUP_ROWS_PER_TABLE).optional(),
    records: z.record(
      z.string(),
      z
        .array(
          z.record(
            z.string(),
            z.union([
              z.string(),
              z
                .number()
                .finite()
                .min(-Number.MAX_SAFE_INTEGER)
                .max(Number.MAX_SAFE_INTEGER),
              z.null(),
            ]),
          ),
        )
        .max(50000),
    ),
    files: z
      .array(
        z
          .object({
            storedName: z.string(),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            base64: z.string().max(Math.ceil((MAX_RECEIPT_BYTES * 4) / 3) + 4),
          })
          .strict(),
      )
      .max(5000),
  })
  .strict();

function readAttachment(row: Row) {
  const file = managedAttachmentPath(String(row.stored_name));
  if (fs.statSync(file).size > MAX_RECEIPT_BYTES)
    throw new Error("Receipt exceeds 20 MiB.");
  const bytes = fs.readFileSync(file);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== row.sha256 || bytes.length !== row.size_bytes)
    throw new Error(`Receipt integrity check failed: ${row.original_name}`);
  return {
    storedName: String(row.stored_name),
    sha256,
    base64: bytes.toString("base64"),
  };
}
export function exportWorkspace(): ExportDataPayload {
  getOrCreateSettings();
  const sqlite = getSqlite();
  return sqlite.transaction(() => {
    const records: Record<string, Row[]> = {};
    for (const table of backupTables)
      records[table] = sqlite
        .prepare(`SELECT * FROM "${table}"`)
        .all() as Row[];
    // PDF output locations are machine-local, independently regenerable artifacts.
    records.invoice_pdf_exports = [];
    records.work_order_pdf_exports = [];
    const unique = [
      ...new Map(
        records.attachments.map((row) => [row.stored_name, row]),
      ).values(),
    ];
    if (
      unique.reduce((sum, row) => sum + Number(row.size_bytes), 0) >
      MAX_BACKUP_ATTACHMENT_BYTES
    )
      throw new Error(
        "Workspace receipts exceed the 100 MiB backup limit. Archive unnecessary receipts before exporting.",
      );
    const files = unique.map(readAttachment);
    const payload = {
      version: "2",
      exportedAt: new Date().toISOString(),
      settings: getOrCreateSettings(),
      clients: getDb().select().from(clients).all(),
      invoices: getDb().select().from(invoices).all(),
      catalogItems: getDb().select().from(catalogItems).all(),
      vendors: getDb().select().from(vendors).all(),
      records,
      files,
    };
    assertBackupBudget(payload);
    return payload;
  })();
}

function validateRows(database: Database.Database, table: string, rows: Row[]) {
  const columns = database
    .prepare(`PRAGMA table_info("${table}")`)
    .all() as Array<{ name: string; type: string; notnull: number }>;
  for (const row of rows) {
    if (
      Object.keys(row).length !== columns.length ||
      columns.some((c) => !(c.name in row))
    )
      throw new Error(`Backup has missing or unexpected ${table} fields.`);
    for (const c of columns) {
      const value = row[c.name];
      if (value === null) {
        if (c.notnull) throw new Error(`Missing ${table}.${c.name}`);
        continue;
      }
      if (
        c.type === "INTEGER" &&
        c.name !== "default_tax_rate" &&
        (typeof value !== "number" || !Number.isSafeInteger(value))
      )
        throw new Error(`Invalid integer ${table}.${c.name}`);
      if (c.type === "TEXT" && typeof value !== "string")
        throw new Error(`Invalid text ${table}.${c.name}`);
      if (c.name.endsWith("cents") && (typeof value !== "number" || value < 0))
        throw new Error(`Invalid amount ${table}.${c.name}`);
    }
    if (row.currency) currencySchema.parse(row.currency);
    if (table === "settings") {
      const fields = Object.fromEntries(
        Object.entries(getTableColumns(settings))
          .filter(([key]) => key !== "id" && key !== "updatedAt")
          .map(([key, column]) => [key, row[column.name]]),
      );
      updateSettingsSchema.parse(fields);
    }
    for (const [field, value] of Object.entries(row)) {
      if (
        value !== null &&
        (field.endsWith("_at") || field === "active_since") &&
        !Number.isFinite(Date.parse(String(value)))
      )
        throw new Error(`Invalid timestamp ${table}.${field}`);
    }
    if (row.delivery_url) deliveryLink.parse(row.delivery_url);
    if (table === "invoices") {
      z.enum(["DRAFT", "UNPAID", "PAID", "OVERDUE", "ADVANCE_PAID"]).parse(
        row.status,
      );
      if (row.client_snapshot)
        z.object({ name: z.string().min(1) })
          .passthrough()
          .parse(JSON.parse(String(row.client_snapshot)));
      if (row.client_id === null && !row.client_snapshot)
        throw new Error("Temporary invoice client snapshot is missing.");
      if (Number(row.advance_cents) > Number(row.amount_cents))
        throw new Error("Advance exceeds invoice total.");
      if (row.tracking_choice !== null)
        z.enum(["yes", "no"]).parse(row.tracking_choice);
    }
    if (table === "tasks") {
      createTaskSchema.parse({
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        priority: row.priority,
        category: row.category,
        assignee: JSON.parse(String(row.assignee)),
        dueDate: row.due_date,
        subtasks: [],
        deliveryUrl: row.delivery_url,
        currency: row.currency,
        outsourceBudgetCents: row.outsource_budget ?? undefined,
      });
      if (
        Number(row.active_milliseconds) < 0 ||
        (row.status === "in-progress" && row.deleted_at === null) !==
          (row.active_since !== null)
      )
        throw new Error("Invalid task working-time state.");
    }
    if (table === "calendar_events") {
      newCalendarEventSchema.parse({
        id: row.id,
        title: row.title,
        description: row.description,
        startDate: row.start_date,
        endDate: row.end_date,
        startTime: row.start_time,
        endTime: row.end_time,
        isAllDay: Boolean(row.is_all_day),
        category: row.category,
        color: row.color,
        clientId: row.client_id,
        clientName: row.client_name,
        taskId: row.task_id,
        taskTitle: row.task_title,
        location: row.location,
      });
      if (![0, 1].includes(Number(row.is_all_day)))
        throw new Error("Invalid calendar all-day value.");
    }
    if (table === "task_history") {
      taskStatus.parse(row.to_status);
      if (row.from_status !== null) taskStatus.parse(row.from_status);
    }
    if (table === "task_time_slots")
      for (const value of [row.start_time, row.end_time])
        if (value !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value)))
          throw new Error("Invalid scheduled task time.");
    if (table === "subtasks" && ![0, 1].includes(Number(row.completed)))
      throw new Error("Invalid subtask completion.");
  }
}
function insertRows(database: Database.Database, table: string, rows: Row[]) {
  const columns = (
    database.prepare(`PRAGMA table_info("${table}")`).all() as Array<{
      name: string;
    }>
  ).map((c) => c.name);
  const insert = database.prepare(
    `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
  );
  for (const row of rows) insert.run(...columns.map((c) => row[c]));
}

export function assertBackupBudget(input: ExportDataPayload) {
  const files = input.files;
  const records = input.records;
  if (
    !Array.isArray(files) ||
    files.length > 5000 ||
    !records ||
    Object.keys(records).length > backupTables.length
  )
    throw new Error("Invalid backup structure or size.");
  let decoded = 0,
    encoded = 0,
    totalRows = 0;
  for (const rows of Object.values(records)) {
    if (!Array.isArray(rows) || rows.length > MAX_BACKUP_ROWS_PER_TABLE)
      throw new Error("Backup has too many records.");
    totalRows += rows.length;
  }
  if (totalRows > 200000) throw new Error("Backup has too many records.");
  for (const file of files) {
    if (!file || typeof file.base64 !== "string")
      throw new Error("Invalid attachment bytes.");
    const length = file.base64.length;
    if (length > Math.ceil((MAX_RECEIPT_BYTES * 4) / 3) + 4)
      throw new Error("Receipt exceeds 20 MiB.");
    encoded += length;
    decoded +=
      Math.floor((length * 3) / 4) -
      (file.base64.endsWith("==") ? 2 : file.base64.endsWith("=") ? 1 : 0);
    if (decoded > MAX_BACKUP_ATTACHMENT_BYTES)
      throw new Error("Backup attachments exceed 100 MiB.");
  }
  const metadataBytes = Buffer.byteLength(
    JSON.stringify({ ...input, files: [] }),
  );
  if (metadataBytes + encoded + files.length * 512 > MAX_BACKUP_BYTES)
    throw new Error("Backup exceeds the 150 MiB restore limit.");
}

export function importWorkspace(input: ExportDataPayload) {
  if (input?.version !== "2")
    throw new Error(
      "This backup predates complete workflow backups. Use the previous app version to restore it, then export a version 2 backup.",
    );
  assertBackupBudget(input);
  const payload = backupSchema.parse(input);
  // Backups from before the calendar feature have no events.
  payload.records.calendar_events ??= [];
  payload.records.task_time_slots ??= [];
  payload.records.work_order_pdf_exports ??= [];
  for (const row of payload.records.vendor_payouts || [])
    row.voided_at ??= null;
  if (Array.isArray(payload.records.settings)) {
    for (const sRow of payload.records.settings) {
      if (
        sRow &&
        typeof sRow === "object" &&
        !("default_invoice_template" in sRow)
      ) {
        sRow.default_invoice_template = "geometric-teal";
      }
    }
  }
  if (
    Object.keys(payload.records).length !== backupTables.length ||
    backupTables.some((t) => !Array.isArray(payload.records[t]))
  )
    throw new Error("Backup is missing required workflow tables.");
  if (
    payload.records.invoice_pdf_exports.length ||
    payload.records.work_order_pdf_exports.length
  )
    throw new Error("Backup must not restore machine-local PDF paths.");
  const sandbox = new Database(":memory:");
  const fileBytes = new Map<string, Buffer>();
  try {
    sandbox.pragma("foreign_keys = ON");
    migrateDatabase(sandbox);
    sandbox.transaction(() => {
      for (const table of backupTables) {
        validateRows(sandbox, table, payload.records[table]);
        insertRows(sandbox, table, payload.records[table]);
      }
    })();
    if (
      payload.records.settings.length !== 1 ||
      payload.records.settings[0].id !== "default"
    )
      throw new Error("Backup must contain the default settings record.");
    // Match the presentation counts so import confirmation cannot misrepresent the payload.
    if (
      payload.clients.length !== payload.records.clients.length ||
      payload.invoices.length !== payload.records.invoices.length ||
      (payload.catalogItems &&
        payload.catalogItems.length !== payload.records.catalog_items.length) ||
      (payload.vendors &&
        payload.vendors.length !== payload.records.vendors.length)
    )
      throw new Error("Backup record counts do not match.");
    for (const file of payload.files) {
      managedAttachmentPath(file.storedName);
      if (
        fileBytes.has(file.storedName) ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
          file.base64,
        )
      )
        throw new Error("Duplicate or invalid attachment bytes.");
      const bytes = Buffer.from(file.base64, "base64");
      const format = receiptFormat(bytes);
      if (
        !bytes.length ||
        bytes.length > MAX_RECEIPT_BYTES ||
        createHash("sha256").update(bytes).digest("hex") !== file.sha256 ||
        file.storedName !== `${file.sha256}.${format.extension}`
      )
        throw new Error("Receipt integrity check failed.");
      fileBytes.set(file.storedName, bytes);
    }
    if (
      [...fileBytes.values()].reduce((s, b) => s + b.length, 0) >
      MAX_BACKUP_ATTACHMENT_BYTES
    )
      throw new Error("Backup attachments exceed 100 MB.");
    const expected = new Set(
      payload.records.attachments.map((r) => String(r.stored_name)),
    );
    if (
      expected.size !== fileBytes.size ||
      [...expected].some((name) => !fileBytes.has(name))
    )
      throw new Error("Backup receipt files are missing or unreferenced.");
    for (const row of payload.records.attachments) {
      const bytes = fileBytes.get(String(row.stored_name))!;
      const format = receiptFormat(bytes);
      if (
        bytes.length !== row.size_bytes ||
        row.sha256 !== createHash("sha256").update(bytes).digest("hex") ||
        row.mime_type !== format.mimeType
      )
        throw new Error("Receipt metadata does not match its bytes.");
    }
    const mismatch = sandbox
      .prepare(
        `SELECT p.id FROM invoice_payments p JOIN invoices i ON i.id=p.invoice_id WHERE p.currency<>i.currency UNION ALL SELECT p.id FROM vendor_payouts p JOIN work_orders w ON w.id=p.work_order_id WHERE p.currency<>w.currency`,
      )
      .all();
    if (mismatch.length)
      throw new Error("Payment currencies do not match their owner.");
    for (const invoice of payload.records.invoices) {
      const items = payload.records.invoice_items.filter(
        (item) => item.invoice_id === invoice.id,
      );
      // Historical backups can predate itemized invoices; validate totals when itemization exists.
      validateInvoiceAmounts({
        amountCents: Number(invoice.amount_cents),
        discountCents: Number(invoice.discount_cents),
        taxCents: Number(invoice.tax_cents),
        advanceCents: Number(invoice.advance_cents),
        items: items.map((item) => ({
          quantity: Number(item.quantity),
          unitPriceCents: Number(item.unit_price_cents),
        })),
      });
    }
    const brokenLinks = sandbox
      .prepare(
        `
      SELECT t.id FROM tasks t JOIN invoice_items item ON item.id=t.invoice_item_id
        JOIN invoices i ON i.id=item.invoice_id
        WHERE t.invoice_id IS NOT item.invoice_id OR t.client_id IS NOT i.client_id OR t.currency<>i.currency
      UNION ALL SELECT t.id FROM tasks t JOIN invoices i ON i.id=t.invoice_id WHERE t.client_id IS NOT i.client_id OR t.currency<>i.currency
      UNION ALL SELECT w.id FROM work_orders w JOIN tasks t ON t.id=w.task_id
        WHERE t.invoice_id IS NOT w.invoice_id
    `,
      )
      .all();
    if (brokenLinks.length)
      throw new Error("Task and work-order source links do not match.");
    assertWorkspaceIntegrity(sandbox);
  } finally {
    sandbox.close();
  }

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
      for (const table of [...backupTables].reverse())
        sqlite.prepare(`DELETE FROM "${table}"`).run();
      for (const table of backupTables)
        insertRows(sqlite, table, payload.records[table]);
    })();
  } catch (error) {
    for (const file of created) fs.rmSync(file, { force: true });
    throw error;
  }
  reclaimUnreferencedReceipts();
  return {
    success: true,
    importedClients: payload.records.clients.length,
    importedInvoices: payload.records.invoices.length,
  };
}

export function resetWorkspace() {
  const sqlite = getSqlite();
  const names = (
    sqlite.prepare("SELECT stored_name FROM attachments").all() as Array<{
      stored_name: string;
    }>
  ).map((r) => r.stored_name);
  sqlite.transaction(() => {
    for (const table of [...backupTables].reverse())
      if (table !== "settings") sqlite.prepare(`DELETE FROM "${table}"`).run();
    sqlite
      .prepare("UPDATE settings SET next_invoice_seq=1 WHERE id='default'")
      .run();
  })();
  for (const name of new Set(names))
    fs.rmSync(managedAttachmentPath(name), { force: true });
  reclaimUnreferencedReceipts();
  return { success: true };
}
