import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { dialog, ipcMain } from "electron";
import {
  closeDatabaseForTesting,
  getDb,
  getSqlite,
  initDatabase,
  switchWorkspaceDatabase,
} from "../db";
import { clients } from "../db/schema";
import { exportWorkspace, resetWorkspace } from "../backup";
import { cachedDocumentCsp, documentCsp } from "../static-protocol";
import {
  createInvoice,
  exportInvoiceBatch,
  getInvoiceWithClient,
  recordPayment,
  setInvoiceTrash,
} from "../ipc/invoices";
import {
  createProfile,
  listProfilesState,
  updateProfile,
} from "../ipc/profiles";
import { registerSettingsHandlers } from "../ipc/settings";
import { trustedEvent } from "./trusted-event";

vi.mock("electron", () => ({
  app: undefined,
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() },
  shell: { openPath: vi.fn(async () => ""), showItemInFolder: vi.fn() },
  clipboard: { writeText: vi.fn() },
}));

vi.mock("../pdf-generator", () => ({
  generateInvoiceHtmlPdfBuffer: vi.fn(async () => Buffer.from("%PDF-test")),
  generateWorkOrderPdfBuffer: vi.fn(async () => Buffer.from("%PDF-test")),
}));

const EXPECTED_SECTION4_INDEXES = [
  "invoices_catalog_item_id_idx",
  "invoices_status_trashed_idx",
  "invoice_items_catalog_id_idx",
  "tasks_invoice_id_idx",
  "tasks_client_id_idx",
  "tasks_deleted_status_idx",
  "task_history_task_id_idx",
  "expenses_invoice_id_idx",
  "expenses_incurred_at_idx",
  "work_orders_vendor_id_idx",
  "work_orders_task_id_idx",
  "attachments_payment_id_idx",
  "attachments_payout_id_idx",
  "calendar_events_client_id_idx",
  "calendar_events_task_id_idx",
  "calendar_events_start_date_idx",
];

function registeredHandler(channel: string) {
  const pair = vi
    .mocked(ipcMain.handle)
    .mock.calls.findLast((call) => call[0] === channel);
  if (!pair) throw new Error(`Missing handler for ${channel}`);
  return pair[1] as (...args: unknown[]) => unknown;
}

describe("Section 4 performance, size, and disk-backed optimizations", () => {
  let dir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    closeDatabaseForTesting();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "billflow-section4-"));
    initDatabase(path.join(dir, "billflow.db"));
    listProfilesState();
  });

  afterEach(() => {
    closeDatabaseForTesting();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("applies all 16 migration 0015 performance indexes in sqlite_master", () => {
    const rows = getSqlite()
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
      .all() as Array<{ name: string }>;
    const existing = new Set(rows.map((row) => row.name));
    for (const indexName of EXPECTED_SECTION4_INDEXES) {
      expect(existing.has(indexName)).toBe(true);
    }
  });

  it("configures synchronous = NORMAL and temp_store = MEMORY across primary and switched workspaces", () => {
    expect(getSqlite().pragma("synchronous", { simple: true })).toBe(1);
    expect(getSqlite().pragma("temp_store", { simple: true })).toBe(2);

    const created = createProfile({
      name: "AI Consulting",
      role: "ai-development",
    });
    const secondary = created.profiles.find((p) => p.id !== "default")!;
    switchWorkspaceDatabase(secondary.id);

    expect(getSqlite().pragma("synchronous", { simple: true })).toBe(1);
    expect(getSqlite().pragma("temp_store", { simple: true })).toBe(2);
  });

  it("hydrates a single active invoice with getInvoiceWithClient and filters out missing or trashed records", () => {
    const clientId = "cli-s4-single";
    const now = new Date().toISOString();
    getDb()
      .insert(clients)
      .values({
        id: clientId,
        name: "Acme Studio",
        email: "billing@acme.test",
        contactPerson: "Dana",
        category: "Enterprise",
        currency: "USD",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const invoice = createInvoice({
      code: "INV-S4-001",
      clientId,
      issueDate: "2026-11-18",
      amountCents: 25000,
      currency: "USD",
      items: [
        { description: "Architecture Audit", quantity: 1, unitPriceCents: 25000 },
      ],
    });
    recordPayment({
      invoiceId: invoice.id,
      amountCents: 10000,
      currency: "USD",
      receivedAt: now,
    });

    const loaded = getInvoiceWithClient(invoice.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.clientName).toBe("Acme Studio");
    expect(loaded!.items).toHaveLength(1);
    expect(loaded!.payments).toHaveLength(1);
    expect(loaded!.paidCents).toBe(10000);

    expect(getInvoiceWithClient("missing-invoice-id")).toBeNull();

    const unpaid = createInvoice({
      code: "INV-S4-TRASH",
      clientId,
      issueDate: "2026-11-18",
      amountCents: 10000,
      currency: "USD",
      items: [{ description: "Draft Work", quantity: 1, unitPriceCents: 10000 }],
    });
    setInvoiceTrash([unpaid.id], true);
    expect(getInvoiceWithClient(unpaid.id)).toBeNull();
    expect(getInvoiceWithClient(unpaid.id, true)?.id).toBe(unpaid.id);
  });

  it("caches static document CSP by mtimeMs and invalidates when mtimeMs changes", () => {
    const htmlPath = path.join(dir, "doc.html");
    const htmlOne = "<html><script>window.__v = 1;</script></html>";
    const fixedTime = new Date(Math.floor(Date.now() / 1000) * 1000 - 10_000);
    fs.writeFileSync(htmlPath, htmlOne, "utf8");
    fs.utimesSync(htmlPath, fixedTime, fixedTime);

    const cspOne = cachedDocumentCsp(htmlPath);
    expect(cspOne).toBe(documentCsp(htmlOne));

    // Overwrite bytes while preserving exact mtimeMs to prove cache hit by mtimeMs
    const htmlTwo = "<html><script>window.__v = 2;</script></html>";
    fs.writeFileSync(htmlPath, htmlTwo, "utf8");
    fs.utimesSync(htmlPath, fixedTime, fixedTime);
    expect(cachedDocumentCsp(htmlPath)).toBe(cspOne);

    // Bump mtimeMs so the cache recomputes the new script hash
    const bumped = new Date(fixedTime.getTime() + 5000);
    fs.utimesSync(htmlPath, bumped, bumped);
    const cspTwo = cachedDocumentCsp(htmlPath);
    expect(cspTwo).toBe(documentCsp(htmlTwo));
    expect(cspTwo).not.toBe(cspOne);
  });

  it("skips rewriting profiles.json when unchanged and writes again after a profile mutation", async () => {
    const mirrorPath = path.join(dir, "profiles.json");
    expect(fs.existsSync(mirrorPath)).toBe(true);
    const first = JSON.parse(fs.readFileSync(mirrorPath, "utf8")) as {
      updatedAt: string;
      profiles: Array<{ subtitle: string }>;
    };

    await new Promise((resolve) => setTimeout(resolve, 15));
    listProfilesState();
    const second = JSON.parse(fs.readFileSync(mirrorPath, "utf8")) as {
      updatedAt: string;
    };
    expect(second.updatedAt).toBe(first.updatedAt);

    updateProfile("default", { subtitle: "Distributed Systems" });
    const third = JSON.parse(fs.readFileSync(mirrorPath, "utf8")) as {
      updatedAt: string;
      profiles: Array<{ subtitle: string }>;
    };
    expect(third.profiles[0].subtitle).toBe("Distributed Systems");
    expect(third.updatedAt).not.toBe(first.updatedAt);
  });

  it("supports disk-backed backup token preflight/import and rejects invalid or spent tokens", async () => {
    const clientId = "cli-backup-1";
    const now = new Date().toISOString();
    getDb()
      .insert(clients)
      .values({
        id: clientId,
        name: "Backup Client",
        email: "backup@client.test",
        contactPerson: "Sam",
        category: "Startup",
        currency: "USD",
        createdAt: now,
        updatedAt: now,
      })
      .run();
    createInvoice({
      code: "INV-BKP-01",
      clientId,
      issueDate: "2026-11-18",
      amountCents: 12000,
      currency: "USD",
      items: [{ description: "Setup", quantity: 1, unitPriceCents: 12000 }],
    });

    const exported = exportWorkspace();
    const backupPath = path.join(dir, "workspace-backup.json");
    fs.writeFileSync(backupPath, JSON.stringify(exported), "utf8");

    resetWorkspace();
    expect(getDb().select().from(clients).all()).toHaveLength(0);

    registerSettingsHandlers(() => {});
    const chooseHandler = registeredHandler("settings:chooseBackupFile");
    const preflightHandler = registeredHandler("settings:preflightBackupFile");
    const importHandler = registeredHandler("settings:importBackupFile");
    const ev = trustedEvent();

    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: [backupPath],
    });

    const chosen = (await chooseHandler(ev, "replace")) as {
      canceled: boolean;
      token: string;
      fileName: string;
      importedClients: number;
      importedInvoices: number;
    };
    expect(chosen.canceled).toBe(false);
    expect(chosen.fileName).toBe("workspace-backup.json");
    expect(chosen.importedClients).toBe(1);
    expect(chosen.importedInvoices).toBe(1);

    const preflight = preflightHandler(ev, chosen.token, "replace") as {
      success: boolean;
      importedClients: number;
      importedInvoices: number;
    };
    expect(preflight.success).toBe(true);
    expect(preflight.importedClients).toBe(1);

    const imported = importHandler(ev, chosen.token, "replace") as {
      success: boolean;
      importedClients: number;
      importedInvoices: number;
    };
    expect(imported.success).toBe(true);
    expect(imported.importedClients).toBe(1);
    expect(getDb().select().from(clients).all()).toHaveLength(1);

    // Spent or fabricated tokens must be rejected
    expect(() => importHandler(ev, chosen.token, "replace")).toThrow(
      /Choose the backup file again/,
    );
    expect(() =>
      preflightHandler(ev, "00000000-0000-0000-0000-000000000000", "replace"),
    ).toThrow(/Choose the backup file again/);
  });

  it("caps exportInvoiceBatch at 200 invoice IDs", async () => {
    const oversizedIds = Array.from({ length: 201 }, (_, i) => `inv-${i}`);
    await expect(exportInvoiceBatch(oversizedIds)).rejects.toThrow();
  });
});
