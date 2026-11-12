import { beforeEach, afterEach, it, expect, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import vm from "vm";
import ts from "typescript";
import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { ipcMain, dialog } from "electron";
import {
  initDatabase,
  closeDatabaseForTesting,
  getDb,
  getSqlite,
  migrateDatabase,
} from "../db";
import {
  clients,
  vendors,
  invoicePayments,
  invoicePdfExports,
} from "../db/schema";
import {
  createInvoice,
  recordPayment,
  removeInvoice,
  registerInvoiceHandlers,
  exportInvoicePdf,
  buildInvoicePdfPayloadAndBuffer,
} from "../ipc/invoices";
import {
  createTask,
  listTasks,
  updateTask,
  getTaskHistory,
} from "../ipc/tasks";
import {
  createWorkOrder,
  recordWorkOrderPayout,
  reviewWorkOrder,
  removeWorkOrder,
  updateWorkOrder,
} from "../ipc/workOrders";
import {
  completeProfileOnboarding,
  createProfile,
  switchProfile,
  verifyProfilePassword,
} from "../ipc/profiles";
import { updateSettings, registerSettingsHandlers } from "../ipc/settings";
import {
  registerFileHandlers,
  copyReceipt,
  managedAttachmentPath,
} from "../ipc/files";
import { createExpense, removeExpense } from "../ipc/expenses";
import { getAnalyticsSummary } from "../ipc/analytics";
import { listClientsWithStats } from "../ipc/clients";
import {
  savePersistedTaskTimeSlots,
  loadPersistedTaskTimeSlots,
} from "../ipc/calendar";
import {
  exportWorkspace,
  importWorkspace,
  assertBackupBudget,
} from "../backup";
import {
  configureIpcSecurity,
  isTrustedDocument,
  assertTrustedSender,
} from "../security";
import { lockProfileSession, isWorkspaceUnlocked } from "../workspace-session";
import { resolveStaticFile, documentCsp } from "../static-protocol";
import { generateInvoiceHtmlPdfBuffer } from "../pdf-generator";
import { assertWorkspaceIntegrity } from "../db/integrity";
import { trustedEvent } from "./trusted-event";
vi.mock("electron", () => ({
  app: undefined,
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  shell: { openPath: vi.fn(async () => ""), showItemInFolder: vi.fn() },
}));
vi.mock("../pdf-generator", () => ({
  generateInvoiceHtmlPdfBuffer: vi.fn(async () => Buffer.from("%PDF-test")),
  generateWorkOrderPdfBuffer: vi.fn(async () => Buffer.from("%PDF-test")),
}));
let dir: string;
const assignee = {
  name: "Test",
  avatarLetter: "T",
  bgColor: "blue",
  textColor: "white",
};
const flush = () => new Promise<void>((r) => setImmediate(r));
function client(id = "a", currency = "USD") {
  getDb()
    .insert(clients)
    .values({
      id,
      name: id,
      contactPerson: id,
      email: id + "@example.invalid",
      currency: currency as "USD",
    })
    .run();
  return id;
}
function invoice(clientId = "a", extra: Record<string, unknown> = {}) {
  return createInvoice({
    clientId,
    currency: "USD",
    amountCents: 10000,
    items: [{ description: "Delivery", quantity: 1, unitPriceCents: 10000 }],
    ...extra,
  } as never);
}
function task(id = "t", clientId = "a", status = "done") {
  return createTask({
    id,
    title: id,
    description: "",
    status,
    priority: "medium",
    category: "Development",
    assignee,
    dueDate: "2026-11-12",
    currency: "USD",
    clientId,
    subtasks: [],
  } as never);
}
function order(status = "done") {
  client();
  const inv = invoice();
  const t = task("t", "a", status);
  getDb()
    .insert(vendors)
    .values({ id: "v", name: "Vendor", service: "Development" })
    .run();
  return createWorkOrder({
    vendorId: "v",
    taskId: t.id,
    invoiceId: inv.id,
    scope: "Delivery",
    feeCents: 3000,
    currency: "USD",
  });
}
function handler(name: string) {
  return vi.mocked(ipcMain.handle).mock.calls.find(([n]) => n === name)![1];
}
const slot = {
  name: "Studio",
  role: "software-engineering",
  subtitle: "Development",
  avatar: "code",
  accent: "blue",
  defaultCurrency: "USD",
  invoicePrefix: "AU-",
  seedRoleCatalog: false,
};
beforeEach(() => {
  closeDatabaseForTesting();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "billflow-security-"));
  initDatabase(path.join(dir, "billflow.db"));
  updateSettings({ pdfExportDirectory: dir });
  vi.clearAllMocks();
});
afterEach(async () => {
  await flush();
  closeDatabaseForTesting();
  fs.rmSync(dir, { recursive: true, force: true });
});
it.each([
  "https://example.invalid/localhost:3000",
  "http://127.0.0.1:3000.evil.invalid",
  "app://other/index.html",
  "app://user@billflow/index.html",
  "file:///tmp/index.html",
  "javascript:alert(1)",
])("rejects an untrusted document: %s", (url) => {
  expect(isTrustedDocument(url)).toBe(false);
});
it("allows only the configured loopback development origin and exact packaged authority", () => {
  expect(isTrustedDocument("app://billflow/tasks/")).toBe(true);
  expect(
    isTrustedDocument("http://127.0.0.1:3000/tasks/", "http://127.0.0.1:3000"),
  ).toBe(true);
  expect(
    isTrustedDocument("http://localhost:3000/tasks/", "http://127.0.0.1:3000"),
  ).toBe(false);
});
it("rejects untrusted senders, subframes and business calls while locked", () => {
  const event = trustedEvent();
  assertTrustedSender(event, "invoices:list");
  expect(() =>
    assertTrustedSender(
      { ...event, senderFrame: { url: "app://billflow/" } as never },
      "invoices:list",
    ),
  ).toThrow(/UNTRUSTED/);
  expect(() =>
    assertTrustedSender({ ...event, sender: {} as never }, "invoices:list"),
  ).toThrow(/UNTRUSTED/);
  configureIpcSecurity(event.sender, null, () => false);
  expect(() => assertTrustedSender(event, "settings:export")).toThrow(/LOCKED/);
  expect(() => assertTrustedSender(event, "profiles:list")).not.toThrow();
});
it("protects real handler exports with the sender guard", () => {
  client();
  invoice();
  registerSettingsHandlers(() => {});
  expect(() =>
    handler("settings:export")({
      senderFrame: { url: "https://example.invalid" },
    } as never),
  ).toThrow(/UNTRUSTED/);
});
it("enforces a main-process lock independently of renderer storage", () => {
  completeProfileOnboarding({
    studioName: "Audit",
    defaultCurrency: "USD",
    profiles: [{ ...slot, password: "secret" }],
  } as never);
  const event = trustedEvent();
  configureIpcSecurity(event.sender, null, isWorkspaceUnlocked);
  lockProfileSession();
  expect(() => assertTrustedSender(event, "invoices:list")).toThrow(/LOCKED/);
  switchProfile("default", "secret");
  expect(() => assertTrustedSender(event, "invoices:list")).not.toThrow();
});
it("rejects onboarding replay without replacing existing credentials", () => {
  const data = {
    studioName: "Audit",
    defaultCurrency: "USD",
    profiles: [{ ...slot, password: "original" }],
  };
  completeProfileOnboarding(data as never);
  expect(() =>
    completeProfileOnboarding({
      ...data,
      profiles: [{ ...slot, password: "replacement" }],
    } as never),
  ).toThrow(/already/);
  expect(verifyProfilePassword("default", "original").valid).toBe(true);
});
it("rejects protocol authority, encoded sibling traversal and escaping symlinks", () => {
  const root = path.join(dir, "out");
  const sibling = path.join(dir, "out-fixture");
  fs.mkdirSync(root);
  fs.mkdirSync(sibling);
  fs.writeFileSync(path.join(root, "index.html"), "local");
  fs.writeFileSync(path.join(sibling, "secret.txt"), "synthetic");
  fs.symlinkSync(sibling, path.join(root, "escape"));
  expect(resolveStaticFile(root, "app://billflow/index.html")).toBe(
    fs.realpathSync(path.join(root, "index.html")),
  );
  for (const url of [
    "app://other/index.html",
    "app://billflow/..%2fout-fixture/secret.txt",
    "app://billflow/escape/secret.txt",
    "app://billflow/%XX",
  ])
    expect(resolveStaticFile(root, url)).toBeNull();
});
it("hashes emitted inline scripts for a restrictive document CSP", () => {
  const csp = documentCsp("<script>window.local=true</script>");
  expect(csp).toContain("script-src 'self' 'sha256-");
  expect(csp).not.toContain("script-src 'unsafe-inline'");
  expect(csp).toContain("object-src 'none'");
});
it("derives payment currency and replays the same request without duplicating it", () => {
  client();
  const inv = invoice();
  const requestId = randomUUID();
  const first = recordPayment({
    invoiceId: inv.id,
    amountCents: 10000,
    requestId,
  });
  const again = recordPayment({
    invoiceId: inv.id,
    amountCents: 10000,
    requestId,
  });
  expect(first.payment.currency).toBe("USD");
  expect(again.payment.id).toBe(first.payment.id);
  expect(getDb().select().from(invoicePayments).all()).toHaveLength(1);
  expect(() =>
    recordPayment({ invoiceId: inv.id, amountCents: 1, currency: "EUR" }),
  ).toThrow(/currency/);
  expect(() => importWorkspace(exportWorkspace())).not.toThrow();
});
it("rejects mismatched totals and advances before inserting an invoice", () => {
  client();
  expect(() => invoice("a", { amountCents: 1 })).toThrow(/total/);
  expect(() => invoice("a", { advanceCents: 10001 })).toThrow(/Advance/);
  expect(getSqlite().prepare("SELECT count(*) n FROM invoices").get()).toEqual({
    n: 0,
  });
});
it("rejects cross-client, incomplete, duplicate and already-billed task imports", () => {
  client();
  client("b");
  const t = task();
  const items = [
    {
      description: "Delivery",
      quantity: 1,
      unitPriceCents: 10000,
      sourceTaskId: t.id,
    },
  ];
  expect(() => invoice("b", { items })).toThrow(/client/);
  updateTask(t.id, { status: "review" });
  expect(() => invoice("a", { items })).toThrow(/completed/);
  updateTask(t.id, { status: "done" });
  invoice("a", { items });
  expect(() => invoice("a", { items })).toThrow(/unbilled/);
});
it("preserves task IDs, timing and history when deleting an unpaid invoice", () => {
  client();
  const t = task();
  const inv = invoice("a", {
    items: [
      {
        description: "Delivery",
        quantity: 1,
        unitPriceCents: 10000,
        sourceTaskId: t.id,
      },
    ],
  });
  removeInvoice(inv.id);
  expect(listTasks()[0]).toMatchObject({
    id: t.id,
    invoiceId: null,
    invoiceItemId: null,
    status: "done",
  });
  expect(getTaskHistory(t.id)).toHaveLength(1);
  expect(() => importWorkspace(exportWorkspace())).not.toThrow();
});
it("edits stable invoice items and prevents currency changes after settlement", async () => {
  client();
  const t = task();
  const inv = invoice("a", {
    items: [
      {
        description: "Delivery",
        quantity: 1,
        unitPriceCents: 10000,
        sourceTaskId: t.id,
      },
    ],
  });
  registerInvoiceHandlers(() => {});
  const event = trustedEvent();
  const updated = await handler("invoices:update")(event, inv.id, {
    items: inv.items,
  });
  expect(updated.items[0].id).toBe(inv.items![0].id);
  recordPayment({ invoiceId: inv.id, amountCents: 1 });
  await expect(
    handler("invoices:update")(event, inv.id, { currency: "EUR" }),
  ).rejects.toThrow(/Currency/);
  expect(() => removeInvoice(inv.id)).toThrow(/payments/);
});
it("rolls back quick-settlement payment and counter together on an injected write failure", async () => {
  client();
  const inv = invoice();
  registerInvoiceHandlers(() => {});
  const event = trustedEvent();
  getSqlite().exec(
    "CREATE TRIGGER fail_invoice BEFORE UPDATE ON invoices BEGIN SELECT RAISE(ABORT, 'injected'); END",
  );
  await expect(
    handler("invoices:setStatus")(event, inv.id, "PAID"),
  ).rejects.toThrow();
  expect(getDb().select().from(invoicePayments).all()).toHaveLength(0);
});
it("records a payment ledger entry when an invoice patch marks it paid", async () => {
  client();
  const inv = invoice();
  registerInvoiceHandlers(() => {});
  const out = await handler("invoices:update")(trustedEvent(), inv.id, {
    status: "PAID",
  });
  expect(out.payments).toHaveLength(1);
  expect(out.paidCents).toBe(10000);
});
it("rejects task and work-order relationship changes that would break restore", () => {
  client();
  const t = task();
  const a = invoice("a", {
    items: [
      {
        description: "Delivery",
        quantity: 1,
        unitPriceCents: 10000,
        sourceTaskId: t.id,
      },
    ],
  });
  const b = invoice();
  expect(() => updateTask(t.id, { currency: "EUR" })).toThrow(/must match/);
  getDb()
    .insert(vendors)
    .values({ id: "v", name: "Vendor", service: "Work" })
    .run();
  expect(() =>
    createWorkOrder({
      vendorId: "v",
      taskId: t.id,
      invoiceId: b.id,
      scope: "Wrong invoice",
      feeCents: 3000,
      currency: "USD",
    }),
  ).toThrow(/invoice/);
  expect(listTasks()[0].invoiceId).toBe(a.id);
});
it("closes timers and records history when reviewing outsourced work", () => {
  const wo = order("in-progress");
  reviewWorkOrder({ workOrderId: wo.id, status: "done", updateTask: true });
  expect(listTasks()[0].activeSince).toBeNull();
  expect(getTaskHistory(wo.taskId).at(-1)?.toStatus).toBe("done");
  expect(() => importWorkspace(exportWorkspace())).not.toThrow();
});
it("validates payout currency and protects paid voucher history", () => {
  const wo = order();
  expect(() =>
    recordWorkOrderPayout({
      workOrderId: wo.id,
      amountCents: 3000,
      currency: "EUR",
    }),
  ).toThrow(/currency/);
  recordWorkOrderPayout({ workOrderId: wo.id, amountCents: 1500 });
  recordWorkOrderPayout({ workOrderId: wo.id });
  expect(
    getSqlite()
      .prepare(
        "SELECT amount_cents FROM vendor_payouts WHERE voided_at IS NULL",
      )
      .get(),
  ).toEqual({ amount_cents: 1500 });
  recordWorkOrderPayout({ workOrderId: wo.id, amountCents: 1200 });
  expect(
    getSqlite()
      .prepare(
        "SELECT amount_cents, voided_at FROM vendor_payouts ORDER BY amount_cents DESC",
      )
      .all(),
  ).toEqual([
    { amount_cents: 1500, voided_at: expect.any(String) },
    { amount_cents: 1200, voided_at: null },
  ]);
  expect(() => importWorkspace(exportWorkspace())).not.toThrow();
  expect(() => updateWorkOrder(wo.id, { currency: "EUR" })).toThrow(/currency/);
  expect(() => removeWorkOrder(wo.id)).toThrow(/payout history/);
});
it("uses actual payout amounts and returns zero for an empty currency period", () => {
  const wo = order();
  expect(getAnalyticsSummary("all", "USD").netProfitCents).toBe(10000);
  recordWorkOrderPayout({ workOrderId: wo.id, amountCents: 1500 });
  expect(getAnalyticsSummary("all", "USD").netProfitCents).toBe(8500);
  expect(getAnalyticsSummary("month", "EUR").totalRevenueCents).toBe(0);
});
it("reports ambiguous legacy financial conflicts without changing their records", () => {
  client();
  const inv = invoice();
  recordPayment({ invoiceId: inv.id, amountCents: 1000 });
  getSqlite().prepare("UPDATE invoice_payments SET currency='EUR'").run();
  expect(() => assertWorkspaceIntegrity(getSqlite())).toThrow(
    /payment currency/,
  );
  expect(() => migrateDatabase(getSqlite())).toThrow(/records were preserved/);
  expect(
    getSqlite()
      .prepare("SELECT currency,amount_cents FROM invoice_payments")
      .get(),
  ).toEqual({ currency: "EUR", amount_cents: 1000 });
});
it("keeps client totals separated by currency", () => {
  client();
  invoice();
  invoice("a", { currency: "EUR" });
  const c = listClientsWithStats()[0];
  expect(c.totalBilledCents).toBe(10000);
  expect(c.totalsByCurrency?.EUR?.billed).toBe(10000);
});
it("requires a one-use picker capability instead of accepting a receipt path", async () => {
  client();
  const inv = invoice();
  const { payment } = recordPayment({ invoiceId: inv.id, amountCents: 1 });
  const png = path.join(dir, "synthetic.png");
  fs.writeFileSync(png, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]));
  registerFileHandlers(() => {});
  const event = trustedEvent();
  await expect(
    handler("attachments:select")(
      event,
      { type: "payment", id: payment.id },
      randomUUID(),
      png,
    ),
  ).rejects.toThrow(/picker/);
  vi.mocked(dialog.showOpenDialog).mockResolvedValue({
    canceled: false,
    filePaths: [png],
  });
  const selected = await handler("attachments:chooseFile")(event);
  expect(selected.path).not.toBe(png);
  await handler("attachments:select")(
    event,
    { type: "payment", id: payment.id },
    randomUUID(),
    selected.path,
  );
  await expect(
    handler("attachments:select")(
      event,
      { type: "payment", id: payment.id },
      randomUUID(),
      selected.path,
    ),
  ).rejects.toThrow(/picker/);
  const beforeNavigation = await handler("attachments:chooseFile")(event);
  event.sender.emit("did-start-navigation", { isMainFrame: true });
  await expect(
    handler("attachments:select")(
      event,
      { type: "payment", id: payment.id },
      randomUUID(),
      beforeNavigation.path,
    ),
  ).rejects.toThrow(/picker/);
});
it("cancels a PDF after a workspace switch rather than publishing into the next profile", async () => {
  client();
  const inv = invoice();
  const state = createProfile({ ...slot, name: "Second" } as never);
  const second = state.profiles.find((p) => p.id !== "default")!;
  let resolve!: (b: Buffer) => void;
  vi.mocked(generateInvoiceHtmlPdfBuffer).mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const pending = exportInvoicePdf(inv.id);
  await flush();
  switchProfile(second.id);
  resolve(Buffer.from("%PDF-original"));
  await expect(pending).rejects.toThrow(/WORKSPACE_CHANGED/);
  expect(getDb().select().from(invoicePdfExports).all()).toHaveLength(0);
});
it("builds draft content from validated values and issued content from stored issuer snapshots", async () => {
  client();
  updateSettings({ businessName: "Original issuer" });
  const inv = invoice();
  updateSettings({ businessName: "New issuer" });
  await buildInvoicePdfPayloadAndBuffer(inv.id);
  expect(
    vi.mocked(generateInvoiceHtmlPdfBuffer).mock.calls.at(-1)![0].business
      .businessName,
  ).toBe("Original issuer");
  await buildInvoicePdfPayloadAndBuffer("draft-preview", undefined, {
    clientId: "a",
    currency: "USD",
    amountCents: 1234,
    items: [{ description: "Actual draft", quantity: 1, unitPriceCents: 1234 }],
  });
  expect(
    vi.mocked(generateInvoiceHtmlPdfBuffer).mock.calls.at(-1)![0].items[0]
      .description,
  ).toBe("Actual draft");
});
it("reclaims a receipt only after its final owner is removed", () => {
  const one = createExpense({
    merchant: "One",
    category: "SOFTWARE",
    amountCents: 100,
    currency: "USD",
    incurredAt: "2026-11-12",
  });
  const two = createExpense({
    merchant: "Two",
    category: "SOFTWARE",
    amountCents: 100,
    currency: "USD",
    incurredAt: "2026-11-12",
  });
  const png = path.join(dir, "synthetic.png");
  fs.writeFileSync(png, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]));
  copyReceipt({ type: "expense", id: one.id }, png, randomUUID());
  copyReceipt({ type: "expense", id: two.id }, png, randomUUID());
  const name = exportWorkspace().files![0].storedName;
  removeExpense(one.id);
  expect(fs.existsSync(managedAttachmentPath(name))).toBe(true);
  removeExpense(two.id);
  expect(fs.existsSync(managedAttachmentPath(name))).toBe(false);
});
it("rejects aggregate backup attachment size before decoding bytes", () => {
  const backup = exportWorkspace();
  const base64 = "A".repeat(Math.ceil((20 * 1024 * 1024 * 4) / 3));
  backup.files = Array.from({ length: 6 }, () => ({
    storedName: "a".repeat(64) + ".png",
    sha256: "a".repeat(64),
    base64,
  }));
  expect(() => assertBackupBudget(backup)).toThrow(/100 MiB/);
});
it("backs up scheduled task times and isolates identical task IDs across profiles", () => {
  client();
  task();
  savePersistedTaskTimeSlots({ t: { startTime: "09:00", endTime: "10:00" } });
  const backup = exportWorkspace();
  const state = createProfile({ ...slot, name: "Second" } as never);
  const second = state.profiles.find((p) => p.id !== "default")!;
  switchProfile(second.id);
  expect(loadPersistedTaskTimeSlots()).toEqual({});
  importWorkspace(backup);
  expect(loadPersistedTaskTimeSlots().t.startTime).toBe("09:00");
});
it("upgrades a populated through-0006 database while preserving expenses", () => {
  const migrations = path.join(dir, "legacy-migrations");
  fs.cpSync(path.resolve("drizzle"), migrations, { recursive: true });
  const journalPath = path.join(migrations, "meta/_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  journal.entries = journal.entries.filter((e: { idx: number }) => e.idx <= 6);
  fs.writeFileSync(journalPath, JSON.stringify(journal));
  const db = new Database(":memory:");
  try {
    migrateDatabase(db, migrations);
    db.exec(
      "INSERT INTO expenses (id,description,category,amount_cents,currency,incurred_at) VALUES ('old','Hosting','SOFTWARE',100,'USD','2026-01-01')",
    );
    migrateDatabase(db);
    expect(
      db.prepare("SELECT amount_cents,created_at FROM expenses").get(),
    ).toEqual({ amount_cents: 100, created_at: "2026-01-01" });
    migrateDatabase(db);
    expect(db.pragma("foreign_key_check")).toEqual([]);
  } finally {
    db.close();
  }
});
it("limits the shipped calendar deletion loop to its initiating profile", () => {
  const source = fs.readFileSync("electron/ipc/calendar.ts", "utf8");
  const sf = ts.createSourceFile(
    "calendar.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  let literal = "";
  function visit(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && n.name.getText(sf) === "jxaScript")
      literal = n.initializer!.getText(sf);
    ts.forEachChild(n, visit);
  }
  visit(sf);
  const script = vm.runInNewContext(literal);
  const events = [
    { description: "[BF-SYNC:profile-a:evt-one]", summary: "A" },
    { description: "[BF-SYNC:profile-b:evt-old]", summary: "B" },
  ];
  const getter = Object.assign(() => events, {
    description: () => events.map((e) => e.description),
    summary: () => events.map((e) => e.summary),
    push: (e: (typeof events)[number]) => events.push(e),
  });
  const removed: unknown[] = [];
  const cal = {
    running: () => true,
    calendars: { whose: () => () => [{ events: getter }] },
    delete: (e: unknown) => removed.push(e),
    Event: (e: unknown) => e,
  };
  const context = {
    ObjC: { import: () => {} },
    Application: () => cal,
  } as Record<string, unknown>;
  vm.createContext(context);
  vm.runInContext(script, context);
  (context.run as (args: string[]) => string)(["[]", "0", "profile-b:"]);
  expect(removed).toEqual([events[1]]);
});

it("keeps an invoice's payment history unchanged when its amount increases", async () => {
  client();
  const inv = invoice();
  recordPayment({ invoiceId: inv.id, amountCents: 10000 });
  registerInvoiceHandlers(() => {});
  const out = await handler("invoices:update")(trustedEvent(), inv.id, {
    amountCents: 12000,
    items: [{ ...inv.items![0], unitPriceCents: 12000 }],
  });
  expect(out.paidCents).toBe(10000);
  expect(out.status).toBe("UNPAID");
  expect(out.payments).toHaveLength(1);
});

it("hydrates invoices with a bounded number of queries as the workspace grows", async () => {
  const { listInvoicesWithClient } = await import("../ipc/invoices");
  client();
  const sqlite = getSqlite();
  const insert = sqlite.prepare(
    "INSERT INTO invoices(id,code,client_id,amount_cents,currency,issue_date) VALUES(?,?,'a',100,'USD','2026-11-12')",
  );
  for (let n = 0; n < 10; n++) insert.run("query-" + n, "QUERY-" + n);
  const spy = vi.spyOn(sqlite, "prepare");
  listInvoicesWithClient();
  const small = spy.mock.calls.length;
  spy.mockRestore();
  for (let n = 10; n < 200; n++) insert.run("query-" + n, "QUERY-" + n);
  const largeSpy = vi.spyOn(sqlite, "prepare");
  expect(listInvoicesWithClient()).toHaveLength(200);
  expect(largeSpy.mock.calls.length).toBeLessThanOrEqual(small + 1);
  largeSpy.mockRestore();
});

it("loads only requested workspace datasets", async () => {
  const { loadWorkspaceSnapshot } = await import("../ipc/workspace");
  client();
  task();
  const snapshot = loadWorkspaceSnapshot(["tasks"]);
  expect(snapshot.tasks).toHaveLength(1);
  expect(snapshot.invoices).toBeUndefined();
  expect(snapshot.clients).toBeUndefined();
});
