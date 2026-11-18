import { afterEach, beforeEach, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { closeDatabaseForTesting, getDb, initDatabase } from "../db";
import {
  createInvoice,
  listInvoicesWithClient,
  recordPayment,
} from "../ipc/invoices";
import { createExpense } from "../ipc/expenses";
import { createTask } from "../ipc/tasks";
import { createWorkOrder, getWorkOrder } from "../ipc/workOrders";
import { workspaceDraft } from "../ipc/workspace";
import {
  upsertNativeMacEventToBillFlowDb,
  reconcileNativeMacEvents,
  NATIVE_CALENDAR_DATE_PARSER,
} from "../ipc/calendar";
import { calendarEvents } from "../db/schema";
import { buildInvoiceHtml } from "../pdf-generator";
import type { InvoicePdfPayload } from "../pdf-generator";
let directory: string;
beforeEach(() => {
  closeDatabaseForTesting();
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "billflow-audit-fixes-"));
  initDatabase(path.join(directory, "billflow.db"));
});
afterEach(() => {
  closeDatabaseForTesting();
  fs.rmSync(directory, { recursive: true, force: true });
});
function invoice(amountCents = 10000) {
  return createInvoice({
    newClient: {
      name: "Client",
      email: "client@example.test",
      currency: "USD",
    },
    title: "Website",
    currency: "USD",
    amountCents,
    status: "UNPAID",
  });
}
it("rejects overpayment atomically while allowing an idempotent retry", () => {
  const inv = invoice();
  const request = {
    invoiceId: inv.id,
    amountCents: 6000,
    requestId: "74f18189-0eb7-4051-b330-496312772f46",
  };
  recordPayment(request);
  recordPayment(request);
  expect(() => recordPayment({ invoiceId: inv.id, amountCents: 4001 })).toThrow(
    "exceeds",
  );
  expect(listInvoicesWithClient()[0].paidCents).toBe(6000);
  recordPayment({ invoiceId: inv.id, amountCents: 4000 });
  expect(listInvoicesWithClient()[0].status).toBe("PAID");
});
it("rejects changed expense retry payloads", () => {
  const request = {
    requestId: "74f18189-0eb7-4051-b330-496312772f46",
    merchant: "Subscription",
    amountCents: 2000,
    currency: "USD" as const,
    category: "SOFTWARE",
    incurredAt: "2026-11-17",
  };
  const saved = createExpense(request);
  expect(createExpense(request).id).toBe(saved.id);
  expect(() => createExpense({ ...request, amountCents: 2100 })).toThrow(
    "different details",
  );
});
it("gates drafts by profile and persists them outside renderer storage", () => {
  workspaceDraft("default", "client", '{"name":"Private client"}');
  expect(workspaceDraft("default", "client")).toContain("Private client");
  expect(() => workspaceDraft("another-profile", "client")).toThrow(
    "another profile",
  );
  expect(() => workspaceDraft("default", "../../private")).toThrow();
  closeDatabaseForTesting();
  initDatabase(path.join(directory, "billflow.db"));
  expect(workspaceDraft("default", "client")).toContain("Private client");
  workspaceDraft("default", "client", null);
  expect(workspaceDraft("default", "client")).toBeNull();
});
it("outsources an unbilled task and links its existing payable when invoicing", () => {
  const task = createTask({
    id: "task-first",
    title: "Build website",
    description: "",
    status: "done",
    priority: "medium",
    category: "Development",
    assignee: {
      name: "Owner",
      avatarLetter: "O",
      bgColor: "blue",
      textColor: "white",
    },
    dueDate: "",
    subtasks: [],
    currency: "USD",
  });
  const order = createWorkOrder({
    taskId: task.id,
    vendorSnapshot: { name: "Contractor" },
    scope: "Development",
    feeCents: 2000,
    currency: "USD",
  });
  expect(order.invoiceId).toBeNull();
  const created = createInvoice({
    newClient: {
      name: "Client",
      email: "client@example.test",
      currency: "USD",
    },
    currency: "USD",
    amountCents: 10000,
    status: "UNPAID",
    items: [
      {
        description: "Website",
        quantity: 1,
        unitPriceCents: 10000,
        sourceTaskId: task.id,
      },
    ],
  });
  expect(getWorkOrder(order.id)?.invoiceId).toBe(created.id);
});
it("updates native events in place when moved and reconciles a complete source snapshot", () => {
  const source = {
    uidKey: "calendar-uid",
    title: "Review",
    description: "Old notes",
    calendarName: "Work",
    startDate: "2026-11-17",
    endDate: "2026-11-17",
    startTime: "10:00",
    endTime: "11:00",
    isAllDay: false,
    location: "Office",
  };
  upsertNativeMacEventToBillFlowDb(source);
  upsertNativeMacEventToBillFlowDb({
    ...source,
    startDate: "2026-11-18",
    endDate: "2026-11-19",
    startTime: null,
    endTime: null,
    isAllDay: true,
    description: "New notes",
    location: "Remote",
  });
  const rows = getDb().select().from(calendarEvents).all();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    startDate: "2026-11-18",
    endDate: "2026-11-19",
    isAllDay: true,
    location: "Remote",
    description: "New notes\nLocal Calendar: Work",
  });
  expect(reconcileNativeMacEvents(new Set(), "2026-11-01", "2026-11-30")).toBe(
    1,
  );
});
it("uses an exclusive next-day end for native all-day events", () => {
  const parse = vm.runInNewContext(`(${NATIVE_CALENDAR_DATE_PARSER})`);
  const start = parse("2026-11-17", null, 0);
  const end = parse("2026-11-17", null, 24);
  expect(end.getDate()).toBe(18);
  expect(end.getTime()).toBeGreaterThan(start.getTime());
});
it("includes signature and Noir billing/payment details in the actual print document", () => {
  const data = {
    code: "INV-1",
    currency: "USD",
    status: "UNPAID",
    amountCents: 10000,
    issueDate: "2026-11-17",
    template: "noir-crimson",
    items: [{ description: "Website", quantity: 1, unitPriceCents: 10000 }],
    client: { name: "Client", billingAddress: "10 Client Road" },
    business: {
      businessName: "Business",
      signatureData: "data:image/png;base64,AAAA",
    },
    paymentUrl: "https://example.test/pay",
  } as InvoicePdfPayload;
  const html = buildInvoiceHtml(data);
  expect(html).toContain("10 Client Road");
  expect(html).toContain("https://example.test/pay");
  expect(html).toContain("data:image/png;base64,AAAA");
  expect(html).not.toContain("chethaka.dev");
  expect(html).not.toContain("Deliverable milestone");
});

it("validates a backup without touching records and keeps a complete checkpoint before replacement", async () => {
  const { exportWorkspace, importWorkspace } = await import("../backup");
  const first = invoice();
  const backup = exportWorkspace();
  const second = invoice(5000);
  const preview = importWorkspace(backup, "replace", true);
  expect(preview.importedInvoices).toBe(1);
  expect(listInvoicesWithClient()).toHaveLength(2);
  const invalid = structuredClone(backup);
  invalid.records!.invoice_items[0].invoice_id = "missing-invoice";
  expect(() => importWorkspace(invalid, "replace", true)).toThrow();
  expect(listInvoicesWithClient()).toHaveLength(2);
  importWorkspace(backup);
  expect(listInvoicesWithClient().map((row) => row.id)).toEqual([first.id]);
  const files = fs.readdirSync(path.join(directory, "backups"));
  const checkpoint = JSON.parse(
    fs.readFileSync(path.join(directory, "backups", files[0]), "utf8"),
  );
  expect(
    checkpoint.records.invoices.map((row: { id: string }) => row.id),
  ).toContain(second.id);
});

it("hydrates items and payments across batch boundaries", async () => {
  const { getSqlite } = await import("../db");
  const first = invoice();
  const sqlite = getSqlite();
  sqlite.transaction(() => {
    for (let index = 0; index < 501; index++) {
      const id = `batched-${index}`;
      sqlite
        .prepare(
          "INSERT INTO invoices(id,code,amount_cents,currency,issue_date,status) VALUES (?,?,100,'USD','2026-11-17','UNPAID')",
        )
        .run(id, `BATCH-${index}`);
      sqlite
        .prepare(
          "INSERT INTO invoice_items(id,invoice_id,description,quantity,unit_price_cents,position) VALUES (?,?,?,1,100,0)",
        )
        .run(`item-${index}`, id, `Item ${index}`);
      sqlite
        .prepare(
          "INSERT INTO invoice_payments(id,invoice_id,amount_cents,currency,received_at,request_id) VALUES (?,?,50,'USD','2026-11-17',?)",
        )
        .run(`payment-${index}`, id, `request-${index}`);
    }
  })();
  const rows = listInvoicesWithClient();
  expect(rows).toHaveLength(502);
  expect(rows.find((row) => row.id === "batched-500")).toMatchObject({
    items: [{ description: "Item 500" }],
    payments: [{ amountCents: 50 }],
  });
  expect(rows.find((row) => row.id === first.id)?.items).toHaveLength(1);
});

it("reconciles moved and deleted events through the actual native SQLite import path", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { pullFromMacOsCalendarSqliteDb } = await import("../ipc/calendar");
  const sourcePath = path.join(directory, "Calendar.sqlitedb");
  const native = new Database(sourcePath);
  try {
    native.exec(`CREATE TABLE Calendar(title text); CREATE TABLE Location(title text);
      CREATE TABLE CalendarItem(unique_identifier text, summary text, description text, all_day integer, calendar_id integer, location_id integer, start_date real, end_date real);
      CREATE TABLE OccurrenceCache(event_id integer, occurrence_start_date real, occurrence_end_date real);
      INSERT INTO Calendar VALUES ('Fixture Calendar'); INSERT INTO Location VALUES ('Office');`);
    const start = Math.floor(Date.now() / 1000) - 978307200;
    native
      .prepare(
        "INSERT INTO CalendarItem VALUES ('stable-uid','Fixture meeting','Original notes',0,1,1,?,?)",
      )
      .run(start, start + 3600);
    native
      .prepare("INSERT INTO OccurrenceCache VALUES (1,?,?)")
      .run(start, start + 3600);
    expect(pullFromMacOsCalendarSqliteDb(true, sourcePath)).toMatchObject({
      accessible: true,
      changedCount: 1,
    });
    native
      .prepare(
        "UPDATE OccurrenceCache SET occurrence_start_date=?, occurrence_end_date=?",
      )
      .run(start + 172800, start + 180000);
    native.exec("UPDATE CalendarItem SET description='Changed notes'");
    expect(pullFromMacOsCalendarSqliteDb(true, sourcePath).changedCount).toBe(
      1,
    );
    const records = getDb().select().from(calendarEvents).all();
    expect(records).toHaveLength(1);
    expect(records[0].description).toContain("Changed notes");
    getDb()
      .insert(calendarEvents)
      .values({
        id: "user-created",
        title: "Keep local event",
        startDate: records[0].startDate,
      })
      .run();
    native.exec("DELETE FROM OccurrenceCache; DELETE FROM CalendarItem;");
    expect(pullFromMacOsCalendarSqliteDb(true, sourcePath).changedCount).toBe(
      1,
    );
    expect(
      getDb()
        .select()
        .from(calendarEvents)
        .all()
        .map((row) => row.id),
    ).toEqual(["user-created"]);
  } finally {
    native.close();
  }
});

it("finds merge conflicts in a read-only preview", async () => {
  const { exportWorkspace, importWorkspace } = await import("../backup");
  const { getSqlite } = await import("../db");
  const expense = createExpense({
    merchant: "Subscription",
    amountCents: 2000,
    currency: "USD",
    category: "SOFTWARE",
    incurredAt: "2026-11-17",
  });
  const backup = exportWorkspace();
  expect(() => importWorkspace(backup, "merge", true)).not.toThrow();
  getSqlite()
    .prepare("UPDATE expenses SET description='Changed locally' WHERE id=?")
    .run(expense.id);
  expect(() => importWorkspace(backup, "merge", true)).toThrow(
    "merge conflict",
  );
  expect(
    getSqlite()
      .prepare("SELECT description FROM expenses WHERE id=?")
      .get(expense.id),
  ).toEqual({ description: "Changed locally" });
});

it("restores the profile's reporting preference along with its workspace settings", async () => {
  const { exportWorkspace, importWorkspace } = await import("../backup");
  const { listProfilesState, updateProfile } = await import("../ipc/profiles");
  const { updateSettings, getOrCreateSettings } =
    await import("../ipc/settings");
  const profile = listProfilesState().activeProfileId;
  updateSettings({ defaultCurrency: "LKR" });
  const backup = exportWorkspace();
  updateSettings({ defaultCurrency: "USD" });
  importWorkspace(backup);
  expect(
    listProfilesState().profiles.find((item) => item.id === profile)
      ?.defaultCurrency,
  ).toBe("LKR");
  updateProfile(profile, { accent: "purple" });
  expect(getOrCreateSettings().defaultCurrency).toBe("LKR");
});

it("uses validated cached exchange rates offline and rejects corrupt rate files", async () => {
  const { cachedExchangeRates, loadExchangeRates } =
    await import("../exchange-rates");
  const file = path.join(directory, "exchange-rates.json");
  const snapshot = {
    base: "USD",
    rates: { USD: 1, LKR: 300, EUR: 0.9, GBP: 0.75, CAD: 1.4 },
    provider: "ExchangeRate-API",
    updatedAt: "2026-11-17T00:00:00Z",
    nextUpdateAt: "2026-11-18T00:00:00Z",
    fetchedAt: "2026-11-17T00:00:01Z",
  };
  fs.writeFileSync(file, JSON.stringify(snapshot));
  expect(cachedExchangeRates()).toEqual(snapshot);
  expect((await loadExchangeRates()).snapshot).toEqual(snapshot);
  fs.writeFileSync(
    file,
    JSON.stringify({ ...snapshot, rates: { ...snapshot.rates, LKR: -1 } }),
  );
  expect(cachedExchangeRates()).toBeNull();
  fs.writeFileSync(file, "{incomplete");
  expect(cachedExchangeRates()).toBeNull();
});

it("upgrades itemized payables without losing their payout, receipt or export links", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { migrateDatabase } = await import("../db");
  const migrations = path.join(directory, "before-task-first-migrations");
  fs.cpSync(path.resolve("drizzle"), migrations, { recursive: true });
  const journalFile = path.join(migrations, "meta/_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalFile, "utf8"));
  journal.entries = journal.entries.filter(
    (entry: { idx: number }) => entry.idx <= 12,
  );
  fs.writeFileSync(journalFile, JSON.stringify(journal));
  const legacy = new Database(":memory:");
  try {
    legacy.pragma("foreign_keys = ON");
    migrateDatabase(legacy, migrations);
    legacy
      .prepare(
        "INSERT INTO work_orders(id,vendor_snapshot,scope,fee_cents,currency,items,discount_cents,paypal_url,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
      )
      .run(
        "legacy-payable",
        JSON.stringify({ name: "Legacy contractor" }),
        "Website",
        10000,
        "USD",
        JSON.stringify([
          { description: "Development", quantity: 1, unitPriceCents: 11000 },
        ]),
        1000,
        "https://paypal.me/example",
        "2026-11-17T00:00:00Z",
      );
    legacy.exec(
      "INSERT INTO vendor_payouts(id,work_order_id,amount_cents,currency,paid_at,request_id) VALUES ('legacy-payout','legacy-payable',2000,'USD','2026-11-17','legacy-request')",
    );
    legacy
      .prepare(
        "INSERT INTO attachments(id,payout_id,original_name,stored_name,mime_type,size_bytes,sha256,created_at) VALUES (?,?,?,?,?,?,?,?)",
      )
      .run(
        "legacy-receipt",
        "legacy-payout",
        "receipt.pdf",
        "receipt.pdf",
        "application/pdf",
        5,
        "0".repeat(64),
        "2026-11-17T00:00:00Z",
      );
    legacy.exec(
      "INSERT INTO work_order_pdf_exports VALUES ('legacy-payable','/tmp/legacy-payable.pdf','2026-11-17T00:00:00Z')",
    );
    const before = legacy.prepare("SELECT * FROM work_orders").get();
    migrateDatabase(legacy);
    expect(legacy.prepare("SELECT * FROM work_orders").get()).toEqual(before);
    expect(legacy.prepare("SELECT payout_id FROM attachments").get()).toEqual({
      payout_id: "legacy-payout",
    });
    expect(
      legacy.prepare("SELECT work_order_id FROM vendor_payouts").get(),
    ).toEqual({ work_order_id: "legacy-payable" });
    expect(
      legacy.prepare("SELECT file_path FROM work_order_pdf_exports").get(),
    ).toEqual({ file_path: "/tmp/legacy-payable.pdf" });
    expect(legacy.pragma("foreign_key_check")).toEqual([]);
  } finally {
    legacy.close();
  }
});

it("preserves archived ledgers and requires restoring directory entries before new work", async () => {
  const { getSqlite } = await import("../db");
  const { vendors } = await import("../db/schema");
  const original = invoice();
  getSqlite()
    .prepare("UPDATE clients SET archived_at=? WHERE id=?")
    .run("2026-11-17T00:00:00Z", original.clientId);
  expect(() =>
    createInvoice({
      clientId: original.clientId!,
      title: "New work",
      amountCents: 10000,
      currency: "USD",
    }),
  ).toThrow("Restore this client");
  expect(listInvoicesWithClient()[0].id).toBe(original.id);
  getDb()
    .insert(vendors)
    .values({
      id: "archived-vendor",
      name: "Inactive vendor",
      service: "Design",
      archivedAt: "2026-11-17T00:00:00Z",
    })
    .run();
  expect(() =>
    createWorkOrder({
      vendorId: "archived-vendor",
      scope: "New work",
      feeCents: 2000,
      currency: "USD",
    }),
  ).toThrow("Restore this vendor");
});

it("falls back from a native Calendar database whose schema cannot be read", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { pullFromMacOsCalendarSqliteDb } = await import("../ipc/calendar");
  const source = path.join(directory, "unsupported-calendar.db");
  const database = new Database(source);
  database.exec("CREATE TABLE unsupported_calendar_schema(id text)");
  database.close();
  expect(pullFromMacOsCalendarSqliteDb(true, source)).toEqual({
    accessible: false,
    changedCount: 0,
  });
});

it("contains zero hardcoded client or university personal identifiers in runtime source files", () => {
  const forbidden = /\b(chethaka|lakshitha|dheeraj|ousl)\b/i;
  const collectFiles = (dir: string, skipDir: string): string[] => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const out: string[] = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (full.endsWith(skipDir)) continue;
        out.push(...collectFiles(full, skipDir));
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        out.push(full);
      }
    }
    return out;
  };
  const files = [
    ...collectFiles(path.resolve("src"), path.join("src", "lib", "test")),
    ...collectFiles(path.resolve("electron"), path.join("electron", "test")),
  ];
  const violations = files.filter((file) =>
    forbidden.test(fs.readFileSync(file, "utf8")),
  );
  expect(violations).toEqual([]);
});

it("resolves dynamic assignee for advance-tracked tasks from settings instead of hardcoded names", async () => {
  const { updateSettings } = await import("../ipc/settings");
  const { decideTracking, listTasks } = await import("../ipc/tasks");

  const first = createInvoice({
    newClient: {
      name: "Client A",
      email: "a@example.test",
      currency: "USD",
    },
    currency: "USD",
    amountCents: 10000,
    advanceCents: 5000,
    items: [{ description: "API Setup", quantity: 1, unitPriceCents: 10000 }],
  });
  recordPayment({ invoiceId: first.id, amountCents: 5000 });
  decideTracking(first.id, "yes");

  updateSettings({ businessName: "Northwind Studio" });
  const second = createInvoice({
    newClient: {
      name: "Client B",
      email: "b@example.test",
      currency: "USD",
    },
    currency: "USD",
    amountCents: 10000,
    advanceCents: 5000,
    items: [{ description: "Schema Design", quantity: 1, unitPriceCents: 10000 }],
  });
  recordPayment({ invoiceId: second.id, amountCents: 5000 });
  decideTracking(second.id, "yes");

  const tasks = listTasks();
  const blankTask = tasks.find((t) => t.title === "API Setup");
  const brandedTask = tasks.find((t) => t.title === "Schema Design");
  expect(blankTask?.assignee.name).not.toBe("Chethaka");
  expect(brandedTask?.assignee).toMatchObject({
    name: "Northwind Studio",
    avatarLetter: "N",
  });
});
