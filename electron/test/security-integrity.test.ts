import { compareBoardTasks } from "../../src/lib/task-order";
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
  getRootDatabasePath,
  getActiveProfileId,
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
  setInvoiceTrash,
  setInvoiceStatuses,
  listInvoicesWithClient,
  listPayments,
  correctPayment,
  registerInvoiceHandlers,
  exportInvoicePdf,
  buildInvoicePdfPayloadAndBuffer,
} from "../ipc/invoices";
import {
  createTask,
  listTasks,
  updateTask,
  getTaskHistory,
  reorderTask,
  deleteTasks,
  undoTaskDeletion,
} from "../ipc/tasks";
import {
  createWorkOrder,
  recordWorkOrderPayout,
  reviewWorkOrder,
  removeWorkOrder,
  removeWorkOrderPayout,
  updateWorkOrder,
} from "../ipc/workOrders";
import {
  completeProfileOnboarding,
  createProfile,
  listProfilesState,
  switchProfile,
  updateProfile,
  verifyProfilePassword,
} from "../ipc/profiles";
import {
  getOrCreateSettings,
  updateSettings,
  registerSettingsHandlers,
} from "../ipc/settings";
import {
  registerFileHandlers,
  copyReceipt,
  managedAttachmentPath,
  openAttachment,
  openInvoicePdf,
} from "../ipc/files";
import { createExpense, removeExpense } from "../ipc/expenses";
import { getAnalyticsSummary } from "../ipc/analytics";
import { listClientsWithStats } from "../ipc/clients";
import {
  NATIVE_CALENDAR_DATE_PARSER,
  savePersistedTaskTimeSlots,
  loadPersistedTaskTimeSlots,
} from "../ipc/calendar";
import {
  exportWorkspace,
  resetWorkspace,
  importWorkspace,
  assertBackupBudget,
} from "../backup";
import {
  configureIpcSecurity,
  isTrustedDocument,
  assertTrustedSender,
  sanitizeExternalUrl,
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
  fs.writeFileSync(path.join(root, "index.txt"), "rsc-root");
  fs.mkdirSync(path.join(root, "invoices"));
  fs.writeFileSync(path.join(root, "invoices", "index.html"), "inv-html");
  fs.writeFileSync(path.join(root, "invoices", "index.txt"), "inv-rsc");
  fs.writeFileSync(path.join(sibling, "secret.txt"), "synthetic");
  fs.symlinkSync(sibling, path.join(root, "escape"));
  expect(resolveStaticFile(root, "app://billflow/index.html")).toBe(
    fs.realpathSync(path.join(root, "index.html")),
  );
  expect(resolveStaticFile(root, "app://billflow/invoices/")).toBe(
    fs.realpathSync(path.join(root, "invoices", "index.html")),
  );
  expect(resolveStaticFile(root, "app://billflow/invoices/?_rsc=abc")).toBe(
    fs.realpathSync(path.join(root, "invoices", "index.txt")),
  );
  expect(resolveStaticFile(root, "app://billflow/invoices/", true)).toBe(
    fs.realpathSync(path.join(root, "invoices", "index.txt")),
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
it("preserves task IDs, timing and history when trashing and restoring an unpaid invoice", () => {
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
    invoiceId: inv.id,
    invoiceItemId: inv.items![0].id,
    status: "done",
  });
  expect(listInvoicesWithClient()).toEqual([]);
  expect(listInvoicesWithClient(undefined, true)).toMatchObject([
    { id: inv.id },
  ]);
  setInvoiceTrash([inv.id], false);
  expect(listInvoicesWithClient()).toMatchObject([
    { id: inv.id, trashedAt: null },
  ]);
  expect(getTaskHistory(t.id)).toHaveLength(1);
  expect(() => importWorkspace(exportWorkspace())).not.toThrow();
});
it("preserves payment receipts and recalculates collections after a correction and reversal", () => {
  client();
  const inv = invoice("a", { advanceCents: 5000 });
  const { payment } = recordPayment({
    invoiceId: inv.id,
    amountCents: 10000,
    receivedAt: "2026-10-02",
  });
  const source = path.join(dir, "transfer.pdf");
  fs.writeFileSync(source, "%PDF-1.4 fixture");
  copyReceipt(
    { type: "payment", id: payment.id },
    source,
    "correction-fixture",
  );
  const corrected = correctPayment({
    invoiceId: inv.id,
    paymentId: payment.id,
    reason: "Transposed amount",
    replacement: {
      amountCents: 3500,
      receivedAt: "2026-11-02",
      reference: "Correct reference",
    },
  });
  expect(corrected).toMatchObject({ paidCents: 3500 });
  const history = listPayments(inv.id);
  expect(history[0]).toMatchObject({
    id: payment.id,
    amountCents: 10000,
    correction: {
      reason: "Transposed amount",
      replacementPaymentId: history[1].id,
    },
  });
  expect(getAnalyticsSummary("all", "USD", "cash").paidCents).toBe(3500);
  expect(() =>
    correctPayment({
      invoiceId: inv.id,
      paymentId: payment.id,
      reason: "Duplicate",
    }),
  ).toThrow(/already/);
  expect(
    correctPayment({
      invoiceId: inv.id,
      paymentId: history[1].id,
      reason: "Duplicate transfer",
    }).paidCents,
  ).toBe(0);
  expect(() => removeInvoice(inv.id)).toThrow(/recorded payments/);
  const backup = exportWorkspace();
  expect(backup.records?.invoice_payment_corrections).toHaveLength(2);
  expect(backup.records?.attachments).toMatchObject([
    { payment_id: payment.id },
  ]);
  expect(() => importWorkspace(backup)).not.toThrow();
  expect(getAnalyticsSummary("all", "USD", "cash").paidCents).toBe(0);
});

it("rolls back a multi-invoice trash action if any selected invoice is protected", () => {
  client();
  const eligible = invoice();
  const protectedInvoice = invoice();
  recordPayment({ invoiceId: protectedInvoice.id, amountCents: 1 });
  expect(() =>
    setInvoiceTrash([eligible.id, protectedInvoice.id], true),
  ).toThrow(/recorded payments/);
  expect(listInvoicesWithClient(undefined, true)).toEqual([]);
  setInvoiceTrash([eligible.id], true);
  expect(getAnalyticsSummary("all", "USD").totalRevenueCents).toBe(
    protectedInvoice.amountCents,
  );
  expect(() => importWorkspace(exportWorkspace())).not.toThrow();
  expect(listInvoicesWithClient(undefined, true)).toMatchObject([
    { id: eligible.id },
  ]);
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
  expect(getTaskHistory(wo.taskId!).at(-1)?.toStatus).toBe("done");
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
  const requestId = randomUUID();
  const first = recordWorkOrderPayout({
    workOrderId: wo.id,
    amountCents: 1500,
    requestId,
  });
  expect(first).toMatchObject({
    payoutStatus: "PENDING",
    remainingPayoutCents: 1500,
  });
  expect(
    recordWorkOrderPayout({ workOrderId: wo.id, amountCents: 1500, requestId })
      .payouts,
  ).toHaveLength(1);
  expect(() =>
    recordWorkOrderPayout({ workOrderId: wo.id, amountCents: 1501 }),
  ).toThrow(/remaining/);
  const partial = recordWorkOrderPayout({
    workOrderId: wo.id,
    amountCents: 1200,
  });
  expect(partial).toMatchObject({
    payoutAmountCents: 2700,
    remainingPayoutCents: 300,
    payoutStatus: "PENDING",
  });
  const settled = recordWorkOrderPayout({ workOrderId: wo.id });
  expect(settled).toMatchObject({
    payoutAmountCents: 3000,
    remainingPayoutCents: 0,
    payoutStatus: "PAID",
  });
  expect(settled.payouts).toHaveLength(3);
  const reopened = removeWorkOrderPayout(wo.id, undefined, requestId);
  expect(reopened).toMatchObject({
    payoutAmountCents: 1500,
    remainingPayoutCents: 1500,
    payoutStatus: "PENDING",
  });
  expect(
    reopened.payouts?.find((payout) => payout.id === requestId)?.voidedAt,
  ).toBeTruthy();
  expect(() => importWorkspace(exportWorkspace())).not.toThrow();
  expect(() => updateWorkOrder(wo.id, { currency: "EUR" })).toThrow(/currency/);
  expect(() => removeWorkOrder(wo.id)).toThrow(/payout history/);
});
it("uses actual payouts and refuses to silently omit foreign currencies without rates", () => {
  const wo = order();
  expect(getAnalyticsSummary("all", "USD").netProfitCents).toBe(10000);
  recordWorkOrderPayout({ workOrderId: wo.id, amountCents: 1500 });
  expect(getAnalyticsSummary("all", "USD").netProfitCents).toBe(8500);
  expect(() => getAnalyticsSummary("month", "EUR")).toThrow("Exchange rates");
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
  const script = vm.runInNewContext(literal, { NATIVE_CALENDAR_DATE_PARSER });
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

it("accepts all 5 invoice templates in settings validation", async () => {
  const { updateSettingsSchema } = await import("../validation");
  for (const template of [
    "geometric-teal",
    "executive-wave",
    "scarlet-modern",
    "apex-orange",
    "noir-crimson",
  ] as const) {
    const parsed = updateSettingsSchema.safeParse({
      defaultInvoiceTemplate: template,
    });
    expect(parsed.success).toBe(true);
  }
});

it("falls back safely when legacy invoice snapshots contain invalid JSON", async () => {
  client();
  const inv = createInvoice({
    clientId: "a",
    issueDate: "2026-11-12",
    dueDate: "2026-11-19",
    currency: "USD",
    amountCents: 10000,
    items: [{ description: "Work", quantity: 1, unitPriceCents: 10000 }],
  });
  getSqlite()
    .prepare(
      "UPDATE invoices SET client_snapshot = '{broken', business_snapshot = '{broken' WHERE id = ?",
    )
    .run(inv.id);

  const built = await buildInvoicePdfPayloadAndBuffer(inv.id);
  expect(built.invoice.code).toBe(inv.code);
});

it("applies bulk invoice settlement atomically and keeps independent workflow stages", () => {
  client();
  updateSettings({ defaultDeliveryUrl: "https://example.invalid/deliveries" });
  const first = invoice("a", {
    workflowStage: "SENT",
    paymentUrl: "https://example.invalid/pay",
  });
  const second = invoice();
  setInvoiceStatuses([first.id, second.id], "OVERDUE");
  expect(listInvoicesWithClient().map((item) => item.status)).toEqual([
    "OVERDUE",
    "OVERDUE",
  ]);
  expect(() => setInvoiceStatuses([first.id, "missing"], "PAID")).toThrow();
  expect(listPayments(first.id)).toEqual([]);
  setInvoiceStatuses([first.id, second.id], "PAID");
  expect(
    listInvoicesWithClient().find((item) => item.id === first.id),
  ).toMatchObject({
    paidCents: 10000,
    workflowStage: "SENT",
    paymentUrl: "https://example.invalid/pay",
    deliveryUrl: "https://example.invalid/deliveries",
  });
});

it("tracks average time to full payment and average billed per invoiced client", () => {
  client("a");
  client("b");
  client("no-invoices");
  const first = invoice("a", { issueDate: "2026-10-01" });
  const second = invoice("a", { issueDate: "2026-10-04" });
  invoice("b", { issueDate: "2026-10-06" });
  recordPayment({
    invoiceId: first.id,
    receivedAt: "2026-10-03",
    amountCents: 1000,
  });
  recordPayment({
    invoiceId: first.id,
    receivedAt: "2026-10-06",
    amountCents: 9000,
  });
  recordPayment({
    invoiceId: second.id,
    receivedAt: "2026-10-11",
    amountCents: 10000,
  });
  expect(
    listClientsWithStats().find((row) => row.id === "a")?.averagePaymentDays,
  ).toBe(6);
  expect(
    listClientsWithStats().find((row) => row.id === "b")?.averagePaymentDays,
  ).toBeNull();
  expect(getAnalyticsSummary("all", "USD")).toMatchObject({
    billedClientCount: 2,
    averageBilledPerClientCents: 15000,
  });
});

it("calculates an itemized standalone payable, keeps its one-time vendor and protects paid amounts", () => {
  const payable = createWorkOrder({
    vendorSnapshot: {
      name: "One-time supplier",
      billingAddress: "1 Main Street",
    },
    scope: "Studio supplies",
    items: [{ description: "USB drives", quantity: 4, unitPriceCents: 500 }],
    discountCents: 200,
    feeCents: 1,
    currency: "USD",
    paypalUrl: "https://www.paypal.com/pay",
    stripeUrl: "https://buy.stripe.com/qa",
  });
  expect(payable).toMatchObject({
    vendorId: null,
    invoiceId: null,
    taskId: null,
    vendorName: "One-time supplier",
    feeCents: 1800,
    remainingPayoutCents: 1800,
    vendorBillingAddress: "1 Main Street",
  });
  recordWorkOrderPayout({ workOrderId: payable.id, amountCents: 1000 });
  expect(() => updateWorkOrder(payable.id, { discountCents: 1500 })).toThrow(
    /lower than/,
  );
  expect(getAnalyticsSummary("all", "USD")).toMatchObject({
    committedCostCents: 1800,
    paidCostCents: 1000,
  });
  expect(getDb().select().from(vendors).all()).toEqual([]);
  expect(() => importWorkspace(exportWorkspace())).not.toThrow();
});

it("persists manual card order and restores a batch of deleted cards", () => {
  client();
  const first = task("first", "a", "in-progress");
  const second = task("second", "a", "in-progress");
  const third = task("third", "a", "todo");
  reorderTask(second.id, first.id, "before");
  expect(
    listTasks()
      .filter((row) => row.status === "in-progress")
      .sort(compareBoardTasks)
      .map((row) => row.id),
  ).toEqual([second.id, first.id]);
  expect(() => reorderTask(second.id, third.id, "before")).toThrow(
    /same column/,
  );
  const { token, deleted } = deleteTasks([first.id, second.id, first.id]);
  expect(deleted).toBe(2);
  expect(listTasks().map((row) => row.id)).toEqual([third.id]);
  expect(undoTaskDeletion(token).restored).toBe(2);
  const ordered = listTasks()
    .filter((row) => row.status === "in-progress")
    .sort(compareBoardTasks);
  expect(ordered.map((row) => row.id)).toEqual([second.id, first.id]);
  expect(ordered.every((row) => row.activeSince)).toBe(true);
  expect(undoTaskDeletion(token).restored).toBe(0);
});

it("merges disjoint records, skips identical rows and rolls back conflicts", () => {
  client();
  const first = invoice();
  recordPayment({ invoiceId: first.id, amountCents: 5000 });
  const backup = exportWorkspace();
  resetWorkspace();
  updateSettings({ businessName: "Destination Workspace" });
  client("existing");
  expect(importWorkspace(backup, "merge")).toMatchObject({
    importedClients: 1,
    importedInvoices: 1,
    skipped: 0,
  });
  expect(importWorkspace(backup, "merge")).toMatchObject({
    importedClients: 0,
    importedInvoices: 0,
    skipped: 4,
  });
  expect(getOrCreateSettings().businessName).toBe("Destination Workspace");
  expect(listPayments(first.id)).toHaveLength(1);
  const conflicting = structuredClone(backup);
  const records = conflicting.records!;
  records.clients[0].name = "Conflicting source";
  records.clients.unshift({ ...records.clients[0], id: "new" });
  conflicting.clients.push({ id: "new" });
  expect(() => importWorkspace(conflicting, "merge")).toThrow(
    /conflict in clients/,
  );
  expect(
    listClientsWithStats()
      .map((row) => row.id)
      .sort(),
  ).toEqual(["a", "existing"]);
});

it("blocks onboarding replay on locked default profile and keeps secondary profile DB active on error", () => {
  const second = createProfile({
    name: "Secondary",
    role: "ai-development",
    seedRoleCatalog: false,
  }).profiles.find((p) => p.id !== "default")!;
  switchProfile(second.id);
  expect(getActiveProfileId()).toBe(second.id);
  expect(() => completeProfileOnboarding({} as never)).toThrow();
  expect(getActiveProfileId()).toBe(second.id);

  switchProfile("default");
  updateProfile("default", { password: "secret" });
  lockProfileSession();
  const state = listProfilesState();
  expect(state.needsOnboarding).toBe(false);
  expect(() =>
    completeProfileOnboarding({
      studioName: "Override",
      defaultCurrency: "USD",
      profiles: [{ ...slot, password: "new-password" }],
    } as never),
  ).toThrow(/already/);
  expect(verifyProfilePassword("default", "secret").valid).toBe(true);
});

it("rejects profiles:verifyPassword while workspace is locked", () => {
  completeProfileOnboarding({
    studioName: "Audit",
    defaultCurrency: "USD",
    profiles: [{ ...slot, password: "secret" }],
  } as never);
  const event = trustedEvent();
  configureIpcSecurity(event.sender, null, isWorkspaceUnlocked);
  lockProfileSession();
  expect(() =>
    assertTrustedSender(event, "profiles:verifyPassword"),
  ).toThrow(/LOCKED/);
});

it("sanitizes external URLs and blocks unsafe schemes, credentials, control chars, and mailto attachments", () => {
  expect(sanitizeExternalUrl("https://example.com/pay?a=1")).toBe(
    "https://example.com/pay?a=1",
  );
  expect(
    sanitizeExternalUrl("mailto:client@example.com?subject=Hi&body=Pay"),
  ).toBe("mailto:client@example.com?subject=Hi&body=Pay");
  for (const unsafe of [
    "file:///etc/passwd",
    "javascript:alert(1)",
    "https://user:pass@example.com/",
    "https://example.com/\nX",
    "mailto:client@example.com?attach=/etc/passwd&subject=Hi",
    "mailto:client@example.com?subject=a&subject=b",
  ]) {
    expect(sanitizeExternalUrl(unsafe)).toBeNull();
  }
});

it("neutralizes String.replace special patterns in buildInvoiceHtml supplement", async () => {
  const actual = await vi.importActual<typeof import("../pdf-generator")>(
    "../pdf-generator",
  );
  const html = actual.buildInvoiceHtml({
    code: "INV-2026-900",
    issueDate: "2026-11-18",
    currency: "USD",
    status: "UNPAID",
    template: "noir-crimson",
    amountCents: 10000,
    items: [{ description: "Audit", quantity: 1, unitPriceCents: 10000 }],
    paymentUrl: "https://pay.example.com/$&/$`",
    client: {
      name: "Acme",
      billingAddress: "Suite $& and $`",
    },
    business: {
      businessName: "Studio",
    },
  });
  expect(html.match(/<!DOCTYPE html>/gi)).toHaveLength(1);
  expect(html).toContain("Suite $&amp; and $`");
  expect(html).not.toContain('<p><strong>Billing address</strong><br>Suite <div class="footer-bar"');
});

it("strips pdf_export_directory on backup export and preserves local folder on restore", () => {
  client();
  invoice();
  const exported = exportWorkspace();
  expect((exported.settings as { pdfExportDirectory: string | null }).pdfExportDirectory).toBeNull();
  expect(exported.records?.settings?.[0]?.pdf_export_directory).toBeNull();

  const tampered = structuredClone(exported);
  tampered.records!.settings[0].pdf_export_directory = "/tmp/attacker-dir";
  importWorkspace(tampered);
  expect(getOrCreateSettings().pdfExportDirectory).toBe(dir);
});

it("detects invoice and work-order overpayments in assertWorkspaceIntegrity", () => {
  client();
  const inv = invoice();
  getSqlite()
    .prepare("UPDATE invoices SET paid_cents = amount_cents + 1 WHERE id = ?")
    .run(inv.id);
  expect(() => assertWorkspaceIntegrity(getSqlite())).toThrow(
    /invoice overpayment/,
  );

  getSqlite()
    .prepare("UPDATE invoices SET paid_cents = 0 WHERE id = ?")
    .run(inv.id);
  const t = task("t-over", "a", "done");
  getDb()
    .insert(vendors)
    .values({ id: "v-over", name: "Vendor", service: "Work" })
    .run();
  const wo = createWorkOrder({
    vendorId: "v-over",
    taskId: t.id,
    invoiceId: inv.id,
    scope: "Overpay check",
    feeCents: 2000,
    currency: "USD",
  });
  getSqlite()
    .prepare(
      "INSERT INTO vendor_payouts(id,work_order_id,amount_cents,currency,paid_at,request_id) VALUES ('p-over',?,2500,'USD','2026-11-18','req-over')",
    )
    .run(wo.id);
  expect(() => assertWorkspaceIntegrity(getSqlite())).toThrow(
    /work order overpayment/,
  );
});

it("rejects mismatched attachment sizes before reading and non-PDF magic bytes renamed as .pdf", async () => {
  client();
  const inv = invoice();
  const { payment } = recordPayment({ invoiceId: inv.id, amountCents: 5000 });
  const source = path.join(dir, "receipt.pdf");
  fs.writeFileSync(source, "%PDF-1.4 valid");
  const att = copyReceipt({ type: "payment", id: payment.id }, source, "att-size");
  const { stored_name: storedName } = getSqlite()
    .prepare("SELECT stored_name FROM attachments WHERE id = ?")
    .get(att.id) as { stored_name: string };
  const storedPath = managedAttachmentPath(storedName);
  fs.chmodSync(storedPath, 0o600);
  fs.writeFileSync(storedPath, "%PDF-1.4 tampered larger payload");
  await expect(openAttachment(att.id)).rejects.toThrow(
    /Receipt integrity check failed/,
  );

  const fakePdf = path.join(dir, "not-a-pdf.pdf");
  fs.writeFileSync(fakePdf, "<html><body>not a pdf</body></html>");
  getDb()
    .insert(invoicePdfExports)
    .values({
      invoiceId: inv.id,
      filePath: fakePdf,
      exportedAt: new Date().toISOString(),
    })
    .run();
  await expect(openInvoicePdf(inv.id)).rejects.toThrow(/Invalid invoice PDF/);
});

it("strips photoData from profiles.json with 0o600 permissions and rejects whitespace passwords", () => {
  const tinyPng =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  createProfile({
    name: "Visual Studio",
    role: "design",
    photoData: tinyPng,
    seedRoleCatalog: false,
  });
  const mirrorPath = path.join(path.dirname(getRootDatabasePath()), "profiles.json");
  const mirror = JSON.parse(fs.readFileSync(mirrorPath, "utf8")) as {
    profiles: Record<string, unknown>[];
  };
  expect(mirror.profiles.some((p) => "photoData" in p)).toBe(false);
  if (process.platform !== "win32") {
    expect(fs.statSync(mirrorPath).mode & 0o777).toBe(0o600);
  }
  expect(() =>
    createProfile({
      name: "Whitespace Pass",
      role: "general",
      password: "    ",
      seedRoleCatalog: false,
    }),
  ).toThrow(/whitespace/i);
});
