import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { ipcMain } from "electron";
import {
  closeAllDatabases,
  closeDatabaseForTesting,
  getDb,
  getSqlite,
  getWorkspaceGeneration,
  initDatabase,
  switchWorkspaceDatabase,
} from "../db";
import { assertWorkspaceIntegrity } from "../db/integrity";
import {
  clients,
  expenses,
  invoiceItems,
  invoices,
  tasks,
  vendors,
} from "../db/schema";
import {
  correctPayment,
  createInvoice,
  promoteInvoiceClient,
  recordPayment,
  registerInvoiceHandlers,
} from "../ipc/invoices";
import {
  createWorkOrder,
  getWorkOrder,
  recordWorkOrderPayout,
  removeWorkOrder,
  removeWorkOrderPayout,
  updateWorkOrder,
} from "../ipc/workOrders";
import { updateSettings } from "../ipc/settings";
import { createTask, decideTracking, listTasks } from "../ipc/tasks";
import {
  listProfilesState,
  updateProfile,
  completeProfileOnboarding,
} from "../ipc/profiles";
import { upsertNativeMacEventToBillFlowDb } from "../ipc/calendar";
import { registerFileHandlers } from "../ipc/files";
import { recordActivity } from "../workspace-activity";
import { isWorkspaceUnlocked, lockProfileSession } from "../workspace-session";
import { configureIpcSecurity } from "../security";
import { trustedEvent } from "./trusted-event";

vi.mock("electron", () => ({
  app: undefined,
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  dialog: { showOpenDialog: vi.fn(), showMessageBox: vi.fn() },
  shell: { openPath: vi.fn(async () => ""), showItemInFolder: vi.fn() },
}));

vi.mock("../pdf-generator", () => ({
  generateInvoiceHtmlPdfBuffer: vi.fn(async () => Buffer.from("%PDF-test")),
  generateWorkOrderPdfBuffer: vi.fn(async () => Buffer.from("%PDF-test")),
}));

let dir: string;

const assignee = {
  name: "Chethaka",
  avatarLetter: "C",
  bgColor: "blue",
  textColor: "white",
};

function registeredHandler(channel: string) {
  const pair = vi
    .mocked(ipcMain.handle)
    .mock.calls.findLast((call) => call[0] === channel);
  if (!pair) throw new Error(`Missing handler for ${channel}`);
  return pair[1] as (...args: unknown[]) => Promise<unknown>;
}

describe("Section 3 data integrity and desktop lifecycle fixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    closeDatabaseForTesting();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "billflow-section3-"));
    initDatabase(path.join(dir, "billflow.db"));
    listProfilesState();
  });

  afterEach(() => {
    closeDatabaseForTesting();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("updates linked tasks when promoteInvoiceClient promotes a temporary client", () => {
    const inv = createInvoice({
      code: "INV-TEMP-PROMOTE",
      saveAsPermanentClient: false,
      newClient: {
        name: "Temp Studio",
        email: "temp@studio.test",
        contactPerson: "Alex",
        category: "Enterprise",
        currency: "USD",
      },
      amountCents: 20000,
      advanceCents: 10000,
      currency: "USD",
      items: [{ description: "Landing page build", quantity: 1, unitPriceCents: 20000 }],
    });
    recordPayment({
      invoiceId: inv.id,
      amountCents: 10000,
      currency: "USD",
      requestId: randomUUID(),
    });
    decideTracking(inv.id, "yes");

    const promoted = promoteInvoiceClient(inv.id);
    const linkedTask = listTasks().find((t) => t.invoiceId === inv.id)!;
    expect(linkedTask.clientId).toBe(promoted.id);
    expect(linkedTask.clientName).toBe("Temp Studio");
    expect(() => assertWorkspaceIntegrity(getSqlite())).not.toThrow();
  });

  it("syncs sibling work orders and inherits task.invoiceId in createWorkOrder", () => {
    const db = getDb();
    const client = {
      id: "cli-wo-sync-1",
      name: "Acme Corp",
      email: "billing@acme.test",
      contactPerson: "Dana",
      category: "Enterprise",
      currency: "USD" as const,
    };
    db.insert(clients).values(client).run();
    const vendor = {
      id: "vnd-wo-sync-1",
      name: "Contractor A",
      service: "Backend",
      balanceCents: 0,
      iconType: "development" as const,
    };
    db.insert(vendors).values(vendor).run();
    const task = createTask({
      id: "task-wo-sync-1",
      title: "API integration",
      description: "Build API",
      status: "todo",
      priority: "high",
      category: "Development",
      assignee,
      dueDate: "2026-12-01",
      clientId: client.id,
      clientName: client.name,
      currency: "USD",
      subtasks: [],
    });

    const firstWo = createWorkOrder({
      vendorId: vendor.id,
      taskId: task.id,
      scope: "Initial endpoint",
      feeCents: 5000,
      currency: "USD",
      dueDate: "2026-12-01",
      status: "in-progress",
    });
    expect(firstWo.invoiceId).toBeNull();

    const invoice = createInvoice({
      code: "INV-WO-LINK",
      clientId: client.id,
      amountCents: 40000,
      currency: "USD",
      items: [{ description: "Milestone", quantity: 1, unitPriceCents: 40000 }],
    });

    // Simulate task created without invoiceId originally, then unlinked firstWo synced when linking
    getDb()
      .update(tasks)
      .set({ invoiceId: null })
      .where(eq(tasks.id, task.id))
      .run();

    const secondWo = createWorkOrder({
      vendorId: vendor.id,
      taskId: task.id,
      invoiceId: invoice.id,
      scope: "Second endpoint",
      feeCents: 7000,
      currency: "USD",
      dueDate: "2026-12-01",
      status: "todo",
    });

    expect(secondWo.invoiceId).toBe(invoice.id);
    expect(getWorkOrder(firstWo.id)?.invoiceId).toBe(invoice.id);

    // Omitting invoiceId on a subsequent work order inherits task.invoiceId automatically
    const thirdWo = createWorkOrder({
      vendorId: vendor.id,
      taskId: task.id,
      scope: "Third endpoint",
      feeCents: 3000,
      currency: "USD",
      dueDate: "2026-12-01",
      status: "todo",
    });
    expect(thirdWo.invoiceId).toBe(invoice.id);
    expect(() => assertWorkspaceIntegrity(getSqlite())).not.toThrow();
  });

  it("re-unlocks passwordless profiles after lockProfileSession while keeping passworded profiles locked", () => {
    completeProfileOnboarding({
      studioName: "Solo Studio",
      defaultCurrency: "USD",
      profiles: [
        {
          name: "Open Profile",
          role: "software-engineering",
          subtitle: "Full-Stack",
          avatar: "code",
          accent: "blue",
          defaultCurrency: "USD",
          invoicePrefix: "SE-",
          seedRoleCatalog: false,
        },
      ],
    });
    expect(isWorkspaceUnlocked()).toBe(true);
    lockProfileSession();
    expect(isWorkspaceUnlocked()).toBe(false);

    const reopened = listProfilesState();
    expect(reopened.isLocked).toBe(false);
    expect(isWorkspaceUnlocked()).toBe(true);

    updateProfile("default", { password: "strong-password" });
    lockProfileSession();
    const reopenedProtected = listProfilesState();
    expect(reopenedProtected.isLocked).toBe(true);
    expect(isWorkspaceUnlocked()).toBe(false);
  });

  it("hardens invoices:update against corrected payments, archived clients, private snapshots, and missing catalogServices", async () => {
    registerInvoiceHandlers(() => {});
    const updateHandler = registeredHandler("invoices:update");
    const ev = trustedEvent();
    configureIpcSecurity(ev.sender, null, () => true);

    const db = getDb();
    const activeClient = {
      id: "cli-active-upd",
      name: "Active Client",
      email: "active@test.local",
      contactPerson: "Sam",
      category: "Enterprise",
      currency: "USD" as const,
      photoData: "data:image/png;base64,SECRETPHOTO",
      relationshipNotes: "PRIVATE_NOTE",
    };
    db.insert(clients).values(activeClient).run();

    const archivedClient = {
      id: "cli-arch-upd",
      name: "Archived Client",
      email: "old@test.local",
      contactPerson: "Old",
      category: "Enterprise",
      currency: "USD" as const,
      archivedAt: new Date().toISOString(),
    };
    db.insert(clients).values(archivedClient).run();

    const draftInv = createInvoice({
      code: "INV-DRAFT-CHECK",
      clientId: activeClient.id,
      amountCents: 10000,
      currency: "USD",
      status: "DRAFT",
      items: [{ description: "Initial", quantity: 1, unitPriceCents: 10000 }],
    });

    await expect(
      updateHandler(ev, draftInv.id, { clientId: archivedClient.id }),
    ).rejects.toThrow(/Archived clients/);

    // Reassigning to another active client strips photoData and nulls unknown catalogId cleanly
    const secondActive = {
      id: "cli-clean-upd",
      name: "Clean Client",
      email: "clean@test.local",
      contactPerson: "Jo",
      category: "Enterprise",
      currency: "USD" as const,
      photoData: "data:image/png;base64,PRIVATE",
      relationshipNotes: "HIDDEN",
    };
    db.insert(clients).values(secondActive).run();

    await updateHandler(ev, draftInv.id, {
      clientId: secondActive.id,
      items: [
        {
          description: "Service line",
          quantity: 1,
          unitPriceCents: 10000,
          catalogId: "non-existent-catalog-item-id",
        },
      ],
    });
    const updatedRow = db
      .select()
      .from(invoices)
      .where(eq(invoices.id, draftInv.id))
      .get()!;
    expect(updatedRow.clientSnapshot).not.toContain("PRIVATE");
    expect(updatedRow.clientSnapshot).not.toContain("HIDDEN");
    const savedItem = db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, draftInv.id))
      .get()!;
    expect(savedItem.catalogId).toBeNull();

    // Active vs corrected payments on an issued invoice
    const issued = createInvoice({
      code: "INV-CORR-CHECK",
      clientId: activeClient.id,
      amountCents: 50000,
      currency: "USD",
      items: [{ description: "Audit", quantity: 1, unitPriceCents: 50000 }],
    });
    const rec = recordPayment({
      invoiceId: issued.id,
      amountCents: 40000,
      currency: "USD",
      requestId: randomUUID(),
    });
    correctPayment({
      invoiceId: issued.id,
      paymentId: rec.payment.id,
      reason: "Over-entered typo",
      replacement: {
        amountCents: 15000,
        receivedAt: new Date().toISOString(),
        reference: "CORR-1",
      },
    });

    await expect(
      updateHandler(ev, issued.id, {
        amountCents: 20000,
        items: [{ description: "Audit", quantity: 1, unitPriceCents: 20000 }],
      }),
    ).resolves.toMatchObject({ paidCents: 15000 });
    expect(() => assertWorkspaceIntegrity(getSqlite())).not.toThrow();
  });

  it("bounds tracking task titles, macOS calendar strings, and workspace_activity rows", () => {
    const db = getDb();
    const client = {
      id: "cli-long-text",
      name: "Long Text Client",
      email: "long@test.local",
      contactPerson: "Lin",
      category: "Enterprise",
      currency: "USD" as const,
    };
    db.insert(clients).values(client).run();
    const longDesc = "A".repeat(400);
    const inv = createInvoice({
      code: "INV-LONG-DESC",
      clientId: client.id,
      amountCents: 10000,
      advanceCents: 5000,
      currency: "USD",
      items: [{ description: longDesc, quantity: 1, unitPriceCents: 10000 }],
    });
    // Simulate corrupted snapshot JSON gracefully ignored by decideTracking
    db.update(invoices)
      .set({ clientSnapshot: "{invalid-json" })
      .where(eq(invoices.id, inv.id))
      .run();
    recordPayment({
      invoiceId: inv.id,
      amountCents: 5000,
      currency: "USD",
      requestId: randomUUID(),
    });
    decideTracking(inv.id, "yes");
    const createdTask = listTasks().find((t) => t.invoiceId === inv.id)!;
    expect(createdTask.title.length).toBeLessThanOrEqual(240);

    const inserted = upsertNativeMacEventToBillFlowDb({
      uidKey: "mac-long-event",
      title: "T".repeat(250),
      description: "D".repeat(1500),
      calendarName: "Personal",
      startDate: "2026-11-20",
      endDate: "2026-11-20",
      startTime: "09:00",
      endTime: "10:00",
      isAllDay: false,
      location: "L".repeat(500),
    });
    expect(inserted).toBe(true);
    const calRow = getSqlite()
      .prepare(
        "SELECT title, description, location FROM calendar_events WHERE title LIKE 'T%'",
      )
      .get() as { title: string; description: string; location: string };
    expect(calRow.title.length).toBeLessThanOrEqual(150);
    expect(calRow.description.length).toBeLessThanOrEqual(1000);
    expect(calRow.location.length).toBeLessThanOrEqual(300);

    for (let i = 0; i < 1015; i++) {
      recordActivity({
        kind: "communication",
        recordId: `rec-${i}`,
        label: `Item ${i}`,
        detail: "Sent update",
      });
    }
    const activityCount = (
      getSqlite()
        .prepare("SELECT COUNT(*) AS count FROM workspace_activity")
        .get() as { count: number }
    ).count;
    expect(activityCount).toBe(1000);
  });

  it("keeps vendor balanceCents and sibling task outsourcing flags consistent across work order lifecycle", () => {
    const db = getDb();
    const vendor = {
      id: "vnd-lifecycle-1",
      name: "Subcontractor B",
      service: "QA",
      balanceCents: 0,
      iconType: "development" as const,
    };
    db.insert(vendors).values(vendor).run();
    const task = createTask({
      id: "task-lifecycle-1",
      title: "QA Suite",
      description: "Write E2E tests",
      status: "todo",
      priority: "medium",
      category: "Development",
      assignee,
      dueDate: "2026-12-05",
      currency: "USD",
      subtasks: [],
    });

    const wo1 = createWorkOrder({
      vendorId: vendor.id,
      taskId: task.id,
      scope: "Phase 1",
      feeCents: 10000,
      currency: "USD",
      dueDate: "2026-12-05",
      status: "in-progress",
    });
    const wo2 = createWorkOrder({
      vendorId: vendor.id,
      taskId: task.id,
      scope: "Phase 2",
      feeCents: 5000,
      currency: "USD",
      dueDate: "2026-12-06",
      status: "todo",
    });
    const balanceAfterCreate = () =>
      getDb().select().from(vendors).where(eq(vendors.id, vendor.id)).get()!
        .balanceCents;
    expect(balanceAfterCreate()).toBe(15000);

    updateWorkOrder(wo1.id, { feeCents: 12000 });
    expect(balanceAfterCreate()).toBe(17000);

    recordWorkOrderPayout({
      workOrderId: wo1.id,
      amountCents: 12000,
      requestId: randomUUID(),
    });
    expect(balanceAfterCreate()).toBe(5000);

    removeWorkOrderPayout(wo1.id);
    expect(balanceAfterCreate()).toBe(17000);

    // Work order with payout history (even voided) preserves audit trail and blocks deletion
    expect(() => removeWorkOrder(wo1.id)).toThrow(/payout history/i);

    // On an unpaid task with two work orders, removing woB keeps isOutsourced true and falls back to woA; removing woA clears it
    const unpaidTask = createTask({
      id: "task-lifecycle-unpaid",
      title: "Unpaid QA Suite",
      description: "Write E2E tests",
      status: "todo",
      priority: "medium",
      category: "Development",
      assignee,
      dueDate: "2026-12-08",
      currency: "USD",
      subtasks: [],
    });
    const woA = createWorkOrder({
      vendorId: vendor.id,
      taskId: unpaidTask.id,
      scope: "Unit tests",
      feeCents: 4000,
      currency: "USD",
      dueDate: "2026-12-08",
      status: "in-progress",
    });
    const woB = createWorkOrder({
      vendorId: vendor.id,
      taskId: unpaidTask.id,
      scope: "Load tests",
      feeCents: 6000,
      currency: "USD",
      dueDate: "2026-12-09",
      status: "todo",
    });
    expect(balanceAfterCreate()).toBe(27000);

    // Removing wo2 (also unpaid on first task) drops vendor balance by 5000
    removeWorkOrder(wo2.id);
    expect(balanceAfterCreate()).toBe(22000);

    // Removing woB while woA remains keeps unpaidTask.isOutsourced true and falls back to woA
    removeWorkOrder(woB.id);
    expect(balanceAfterCreate()).toBe(16000);
    const unpaidAfterFirstRemove = listTasks().find(
      (t) => t.id === unpaidTask.id,
    )!;
    expect(unpaidAfterFirstRemove.isOutsourced).toBe(true);
    expect(unpaidAfterFirstRemove.outsourceBudgetCents).toBe(4000);

    // Removing final work order woA resets unpaidTask.isOutsourced to false
    removeWorkOrder(woA.id);
    expect(balanceAfterCreate()).toBe(12000);
    const unpaidAfterFinalRemove = listTasks().find(
      (t) => t.id === unpaidTask.id,
    )!;
    expect(unpaidAfterFinalRemove.isOutsourced).toBe(false);
    expect(unpaidAfterFinalRemove.outsourceBudgetCents ?? null).toBeNull();
  });

  it("computes invoice dueDate across DST boundaries using pure UTC calendar math", () => {
    updateSettings({ defaultDueDays: 7 });
    const client = {
      id: "cli-dst-2026",
      name: "DST Client",
      email: "dst@test.local",
      contactPerson: "Chris",
      category: "Enterprise",
      currency: "USD" as const,
    };
    getDb().insert(clients).values(client).run();
    const inv = createInvoice({
      code: "INV-DST-2026",
      clientId: client.id,
      issueDate: "2026-03-07",
      amountCents: 10000,
      currency: "USD",
      items: [{ description: "Consulting", quantity: 1, unitPriceCents: 10000 }],
    });
    expect(inv.dueDate).toBe("2026-03-14");
  });

  it("configures SQLite busy_timeout, preserves workspaceGeneration on failed switches, and closes cleanly", () => {
    const row = getSqlite().pragma("busy_timeout") as Array<{
      timeout: number;
    }>;
    expect(row[0].timeout).toBe(5000);

    const beforeGen = getWorkspaceGeneration();
    expect(() => switchWorkspaceDatabase("../bad")).toThrow();
    expect(getWorkspaceGeneration()).toBe(beforeGen);

    expect(() => closeAllDatabases()).not.toThrow();
  });

  it("stages dropped receipt bytes securely via opaque token and rejects invalid signatures", async () => {
    registerFileHandlers(() => {});
    const stageHandler = registeredHandler("attachments:stageDroppedFile");
    const selectHandler = registeredHandler("attachments:select");
    const ev = trustedEvent();
    configureIpcSecurity(ev.sender, null, () => true);

    expect(() =>
      stageHandler(ev, "bad.png", new Uint8Array([0x00, 0x01, 0x02, 0x03])),
    ).toThrow(/Select a PDF, PNG, JPEG or WebP/);

    const exp = getDb()
      .insert(expenses)
      .values({
        id: "exp-drop-1",
        merchant: "Cloud Host",
        description: "Hosting",
        category: "HOSTING",
        amountCents: 2500,
        currency: "USD",
        incurredAt: "2026-11-19",
        deductible: true,
        createdAt: new Date().toISOString(),
      })
      .run();
    expect(exp.changes).toBe(1);

    const pngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    const staged = (await stageHandler(ev, "../receipt.png", pngBytes)) as {
      path: string;
      name: string;
      size: number;
    };
    expect(staged.name).toBe("receipt.png");
    expect(staged.size).toBe(pngBytes.length);

    const saved = (await selectHandler(
      ev,
      { type: "expense", id: "exp-drop-1" },
      "req-drop-1",
      staged.path,
    )) as { originalName: string; mimeType: string };
    expect(saved.originalName).toBe("receipt.png");
    expect(saved.mimeType).toBe("image/png");
  });
});
