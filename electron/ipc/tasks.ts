import { ipcMain } from "electron";
import { randomUUID, createHash } from "crypto";
import { and, eq, isNull, asc, desc } from "drizzle-orm";
import { getDb } from "../db";
import { tasks, subtasks, taskHistory, clients, invoices, invoiceItems, invoicePayments } from "../db/schema";
import { createTaskSchema, patchTaskSchema, deliveryLink, recordId, trackingChoiceSchema } from "../workflow-validation";
import type { TaskItem } from "../../src/types/tasks";
import type { TaskCreateInput, TaskPatchInput, TrackingOffer } from "../../src/types/workflow";
import { AppError } from "./errors";

const defaultAssignee = { name: "Chethaka", avatarLetter: "C", bgColor: "bg-surface-purple-100", textColor: "text-content-purple-700" };

export function listTasks(): TaskItem[] {
  const db = getDb();
  return db.select().from(tasks).where(isNull(tasks.deletedAt)).orderBy(desc(tasks.createdAt)).all().map(row => {
    const invoice = row.invoiceId ? db.select().from(invoices).where(eq(invoices.id, row.invoiceId)).get() : undefined;
    return { ...row, clientName: row.clientName || undefined, outsourcedVendor: row.outsourcedVendor || undefined, outsourceBudget: row.outsourceBudgetCents == null ? undefined : row.outsourceBudgetCents / 100, currency: row.currency as TaskItem["currency"], category: row.category as TaskItem["category"], invoiceCode: invoice?.code, subtasks: db.select({ id: subtasks.id, title: subtasks.title, completed: subtasks.completed }).from(subtasks).where(eq(subtasks.taskId, row.id)).all() };
  });
}

function getTask(id: string) {
  const row = getDb().select().from(tasks).where(and(eq(tasks.id, id), isNull(tasks.deletedAt))).get();
  if (!row) throw new AppError("NOT_FOUND", "Task no longer exists.");
  return row;
}

export function createTask(input: TaskCreateInput): TaskItem {
  const value = createTaskSchema.parse(input);
  const db = getDb();
  const requestHash = createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const existing = db.select().from(tasks).where(eq(tasks.id, value.id)).get();
  if (existing) {
    if (existing.deletedAt) throw new AppError("DELETED", "This task was already deleted.");
    if (existing.requestHash !== requestHash) throw new AppError("REQUEST_CONFLICT", "This task request was already saved with different details. Reopen it before editing.");
    return listTasks().find(t => t.id === value.id)!;
  }
  db.transaction(tx => {
    const client = value.clientId ? tx.select().from(clients).where(eq(clients.id, value.clientId)).get() : undefined;
    if (value.clientId && !client) throw new AppError("NOT_FOUND", "Client no longer exists.");
    const now = new Date().toISOString();
    const { subtasks: children, ...fields } = value;
    tx.insert(tasks).values({ ...fields, requestHash, clientName: client?.name || value.clientName, deliveryUrl: deliveryLink.parse(value.deliveryUrl || client?.driveUrl || null), currency: value.currency || client?.currency || "LKR", createdAt: now, updatedAt: now, startedAt: value.status === "in-progress" ? now : null, activeSince: value.status === "in-progress" ? now : null, completedAt: value.status === "done" ? now : null }).run();
    for (const child of children) tx.insert(subtasks).values({ ...child, taskId: value.id }).run();
    tx.insert(taskHistory).values({ id: randomUUID(), taskId: value.id, fromStatus: null, toStatus: value.status, occurredAt: now }).run();
  });
  return listTasks().find(t => t.id === value.id)!;
}

export function updateTask(idInput: string, input: TaskPatchInput): TaskItem {
  const id = recordId.parse(idInput);
  const patch = patchTaskSchema.parse(input);
  const db = getDb();
  db.transaction(tx => {
    const existing = getTask(id);
    const now = new Date().toISOString();
    const { subtasks: children, ...fields } = patch;
    const timing: Partial<typeof tasks.$inferInsert> = {};
    if (patch.status && patch.status !== existing.status) {
      timing.activeMilliseconds = existing.activeMilliseconds + (existing.activeSince ? Math.max(0, Date.parse(now) - Date.parse(existing.activeSince)) : 0);
      timing.activeSince = patch.status === "in-progress" ? now : null;
      timing.startedAt = existing.startedAt || (patch.status === "in-progress" ? now : null);
      timing.completedAt = patch.status === "done" ? now : null;
      tx.insert(taskHistory).values({ id: randomUUID(), taskId: id, fromStatus: existing.status, toStatus: patch.status, occurredAt: now }).run();
    }
    tx.update(tasks).set({ ...fields, ...timing, updatedAt: now }).where(eq(tasks.id, id)).run();
    if (children) {
      tx.delete(subtasks).where(eq(subtasks.taskId, id)).run();
      for (const child of children) tx.insert(subtasks).values({ ...child, taskId: id }).run();
    }
  });
  return listTasks().find(t => t.id === id)!;
}

export function deleteTask(id: string) {
  recordId.parse(id);
  const db = getDb();
  db.transaction(tx => {
    const existing = tx.select().from(tasks).where(eq(tasks.id, id)).get();
    if (!existing || existing.deletedAt) return;
    const now = new Date().toISOString();
    // Close active time and retain the last real status plus source-item uniqueness.
    tx.update(tasks).set({ deletedAt: now, updatedAt: now, activeSince: null, activeMilliseconds: existing.activeMilliseconds + (existing.activeSince ? Math.max(0, Date.parse(now) - Date.parse(existing.activeSince)) : 0) }).where(eq(tasks.id, id)).run();
  });
}

export function getTaskHistory(id: string) {
  getTask(recordId.parse(id));
  return getDb().select().from(taskHistory).where(eq(taskHistory.taskId, id)).orderBy(asc(taskHistory.occurredAt)).all();
}

function qualifyingInvoice(id: string) {
  const db = getDb();
  const invoice = db.select().from(invoices).where(eq(invoices.id, id)).get();
  if (!invoice) throw new AppError("NOT_FOUND", "Invoice no longer exists.");
  const received = db.select().from(invoicePayments).where(and(eq(invoicePayments.invoiceId, id), eq(invoicePayments.currency, invoice.currency))).all().reduce((sum, p) => sum + p.amountCents, 0);
  if (invoice.status === "DRAFT" || invoice.advanceCents <= 0 || received < invoice.advanceCents) throw new AppError("ADVANCE_NOT_PAID", "Recorded payments have not met the required advance.");
  return { invoice, received };
}

export function pendingTracking(): TrackingOffer[] {
  const db = getDb();
  return db.transaction(tx => {
    const offers: TrackingOffer[] = [];
    for (const row of tx.select().from(invoices).where(isNull(invoices.trackingChoice)).all()) {
      let result: ReturnType<typeof qualifyingInvoice>;
      try { result = qualifyingInvoice(row.id); } catch (e) { if (e instanceof AppError && e.code === "ADVANCE_NOT_PAID") continue; throw e; }
      // Missing items are a domain dependency; never invent a deliverable.
      const items = tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, row.id)).all();
      if (!items.length) continue;
      const eligibleAt = row.trackingEligibleAt || new Date().toISOString();
      if (!row.trackingEligibleAt) tx.update(invoices).set({ trackingEligibleAt: eligibleAt }).where(eq(invoices.id, row.id)).run();
      const client = row.clientId ? tx.select().from(clients).where(eq(clients.id, row.clientId)).get() : undefined;
      const snapshot = row.clientSnapshot ? JSON.parse(row.clientSnapshot) as { name?: string } : undefined;
      offers.push({ invoiceId: row.id, code: row.code, clientName: snapshot?.name || client?.name || "Invoice client", eligibleAt, advanceCents: row.advanceCents, receivedCents: result.received, currency: row.currency });
    }
    return offers;
  });
}

export function decideTracking(idInput: string, choiceInput: "yes" | "no") {
  const id = recordId.parse(idInput);
  const choice = trackingChoiceSchema.parse(choiceInput);
  const db = getDb();
  return db.transaction(tx => {
    const invoice = tx.select().from(invoices).where(eq(invoices.id, id)).get();
    if (!invoice) throw new AppError("NOT_FOUND", "Invoice no longer exists.");
    if (!invoice.trackingChoice) {
      qualifyingInvoice(id);
      const items = tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id)).orderBy(asc(invoiceItems.position)).all();
      if (!items.length) throw new AppError("MISSING_ITEMS", "Invoice deliverables are not available yet.");
      const now = new Date().toISOString();
      if (choice === "yes") {
        const client = invoice.clientId ? tx.select().from(clients).where(eq(clients.id, invoice.clientId)).get() : undefined;
        const snapshot = invoice.clientSnapshot ? JSON.parse(invoice.clientSnapshot) as { name?: string; driveUrl?: string } : undefined;
        for (const item of items) {
          const taskId = randomUUID();
          const inserted = tx.insert(tasks).values({ id: taskId, invoiceItemId: item.id, invoiceId: id, clientId: invoice.clientId, title: item.description, description: item.description, assignee: defaultAssignee, clientName: snapshot?.name || client?.name, deliveryUrl: deliveryLink.parse(invoice.deliveryUrl || snapshot?.driveUrl || client?.driveUrl || null), currency: invoice.currency, dueDate: invoice.dueDate || "", createdAt: now, updatedAt: now }).onConflictDoNothing({ target: tasks.invoiceItemId }).run();
          if (inserted.changes) tx.insert(taskHistory).values({ id: randomUUID(), taskId, fromStatus: null, toStatus: "todo", occurredAt: now }).run();
        }
      }
      tx.update(invoices).set({ trackingEligibleAt: invoice.trackingEligibleAt || now, trackingChoice: choice, trackingDecidedAt: now }).where(eq(invoices.id, id)).run();
    }
    return { choice: invoice.trackingChoice || choice, taskIds: tx.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.invoiceId, id), isNull(tasks.deletedAt))).all().map(t => t.id) };
  });
}

export function registerTaskHandlers(broadcast: () => void) {
  ipcMain.handle("tasks:list", () => listTasks());
  ipcMain.handle("tasks:history", (_e, id: string) => getTaskHistory(id));
  ipcMain.handle("tracking:pending", () => pendingTracking());
  ipcMain.handle("tasks:create", (_e, input: TaskCreateInput) => { const result = createTask(input); broadcast(); return result; });
  ipcMain.handle("tasks:update", (_e, id: string, patch: TaskPatchInput) => { const result = updateTask(id, patch); broadcast(); return result; });
  ipcMain.handle("tasks:remove", (_e, id: string) => { deleteTask(id); broadcast(); });
  ipcMain.handle("tracking:decide", (_e, id: string, choice: "yes" | "no") => { const result = decideTracking(id, choice); broadcast(); return result; });
}
