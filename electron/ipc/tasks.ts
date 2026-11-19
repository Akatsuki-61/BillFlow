import { z } from "zod";
import { compareBoardTasks } from "../../src/lib/task-order";
import { listPayments } from "./invoices";
import { ipcMain } from "../security";
import { randomUUID, createHash } from "crypto";
import { and, eq, isNull, asc, desc } from "drizzle-orm";
import { getActiveProfileId, getDb, getRootDb } from "../db";
import {
  tasks,
  subtasks,
  taskHistory,
  clients,
  invoices,
  invoiceItems,
  calendarEvents,
  workOrders,
  taskTimeSlots,
  settings,
  userProfiles,
} from "../db/schema";
import {
  createTaskSchema,
  patchTaskSchema,
  deliveryLink,
  recordId,
  trackingChoiceSchema,
} from "../workflow-validation";
import type { TaskItem } from "../../src/types/tasks";
import type {
  TaskCreateInput,
  TaskPatchInput,
  TrackingOffer,
} from "../../src/types/workflow";
import { AppError } from "./errors";
import { scheduleBackgroundNativeCalendarSync } from "./calendar";

function resolveDefaultAssignee(tx: Pick<ReturnType<typeof getDb>, "select">) {
  const bizName = tx
    .select({ businessName: settings.businessName })
    .from(settings)
    .where(eq(settings.id, "default"))
    .get()
    ?.businessName?.trim();
  let profileName: string | undefined;
  try {
    const rootDb = getRootDb();
    const activeId = getActiveProfileId();
    profileName =
      rootDb
        .select({ name: userProfiles.name })
        .from(userProfiles)
        .where(eq(userProfiles.id, activeId))
        .get()
        ?.name?.trim() ||
      rootDb
        .select({ name: userProfiles.name })
        .from(userProfiles)
        .where(eq(userProfiles.isActive, true))
        .get()
        ?.name?.trim();
  } catch {
    // Fall back when root DB is not initialized in isolated unit tests
  }
  const resolvedName = bizName || profileName || "Workspace Owner";
  return {
    name: resolvedName,
    avatarLetter: (resolvedName[0] || "W").toUpperCase(),
    bgColor: "bg-surface-purple-100",
    textColor: "text-content-purple-700",
  };
}

export function listTasks(): TaskItem[] {
  const db = getDb();
  const rows = db
    .select()
    .from(tasks)
    .where(isNull(tasks.deletedAt))
    .orderBy(desc(tasks.createdAt))
    .all();
  const invoiceMap = new Map(
    db
      .select({ id: invoices.id, code: invoices.code })
      .from(invoices)
      .all()
      .map((row) => [row.id, row.code]),
  );
  const children = db
    .select({
      id: subtasks.id,
      taskId: subtasks.taskId,
      title: subtasks.title,
      completed: subtasks.completed,
    })
    .from(subtasks)
    .all();
  const childMap = new Map<string, typeof children>();
  for (const child of children) {
    const list = childMap.get(child.taskId) || [];
    list.push(child);
    childMap.set(child.taskId, list);
  }
  const slots = new Map(
    db
      .select()
      .from(taskTimeSlots)
      .all()
      .map((row) => [row.taskId, row]),
  );
  return rows.map((row) => ({
    ...row,
    startTime: slots.get(row.id)?.startTime ?? null,
    endTime: slots.get(row.id)?.endTime ?? null,
    clientName: row.clientName || undefined,
    outsourcedVendor: row.outsourcedVendor || undefined,
    outsourceBudget:
      row.outsourceBudgetCents == null
        ? undefined
        : row.outsourceBudgetCents / 100,
    currency: row.currency as TaskItem["currency"],
    category: row.category as TaskItem["category"],
    invoiceCode: row.invoiceId ? invoiceMap.get(row.invoiceId) : undefined,
    subtasks: (childMap.get(row.id) || []).map((child) => ({
      id: child.id,
      title: child.title,
      completed: child.completed,
    })),
  }));
}

function getTask(id: string) {
  const row = getDb()
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
    .get();
  if (!row) throw new AppError("NOT_FOUND", "Task no longer exists.");
  return row;
}

export function createTask(input: TaskCreateInput): TaskItem {
  const value = createTaskSchema.parse(input);
  const db = getDb();
  const requestHash = createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
  const existing = db.select().from(tasks).where(eq(tasks.id, value.id)).get();
  if (existing) {
    if (existing.deletedAt)
      throw new AppError("DELETED", "This task was already deleted.");
    if (existing.requestHash !== requestHash)
      throw new AppError(
        "REQUEST_CONFLICT",
        "This task request was already saved with different details. Reopen it before editing.",
      );
    return listTasks().find((t) => t.id === value.id)!;
  }
  db.transaction((tx) => {
    const client = value.clientId
      ? tx.select().from(clients).where(eq(clients.id, value.clientId)).get()
      : undefined;
    if (value.clientId && !client)
      throw new AppError("NOT_FOUND", "Client no longer exists.");
    const now = new Date().toISOString();
    const { subtasks: children, ...fields } = value;
    tx.insert(tasks)
      .values({
        ...fields,
        requestHash,
        clientName: client?.name || value.clientName,
        deliveryUrl: deliveryLink.parse(
          value.deliveryUrl || client?.driveUrl || null,
        ),
        currency: value.currency || client?.currency || "LKR",
        createdAt: now,
        updatedAt: now,
        startedAt: value.status === "in-progress" ? now : null,
        activeSince: value.status === "in-progress" ? now : null,
        completedAt: value.status === "done" ? now : null,
      })
      .run();
    for (const child of children)
      tx.insert(subtasks)
        .values({ ...child, taskId: value.id })
        .run();
    tx.insert(taskHistory)
      .values({
        id: randomUUID(),
        taskId: value.id,
        fromStatus: null,
        toStatus: value.status,
        occurredAt: now,
      })
      .run();
  });
  return listTasks().find((t) => t.id === value.id)!;
}

export function updateTask(idInput: string, input: TaskPatchInput): TaskItem {
  const id = recordId.parse(idInput);
  const patch = patchTaskSchema.parse(input);
  const db = getDb();
  db.transaction((tx) => {
    const existing = getTask(id);
    const nextInvoiceId =
      patch.invoiceId !== undefined ? patch.invoiceId : existing.invoiceId;
    const nextItemId =
      patch.invoiceItemId !== undefined
        ? patch.invoiceItemId
        : existing.invoiceItemId;
    const nextClientId =
      patch.clientId !== undefined ? patch.clientId : existing.clientId;
    const nextCurrency = patch.currency ?? existing.currency;
    const invoice = nextInvoiceId
      ? tx.select().from(invoices).where(eq(invoices.id, nextInvoiceId)).get()
      : undefined;
    const item = nextItemId
      ? tx
          .select()
          .from(invoiceItems)
          .where(eq(invoiceItems.id, nextItemId))
          .get()
      : undefined;
    if (
      (nextInvoiceId &&
        (!invoice ||
          (invoice.trashedAt && nextInvoiceId !== existing.invoiceId))) ||
      (nextItemId && (!item || item.invoiceId !== nextInvoiceId)) ||
      (invoice &&
        (invoice.clientId !== nextClientId ||
          invoice.currency !== nextCurrency))
    )
      throw new AppError(
        "SOURCE_MISMATCH",
        "Task invoice, item, client and currency must match.",
      );
    const orders = tx
      .select()
      .from(workOrders)
      .where(eq(workOrders.taskId, id))
      .all();
    if (orders.some((order) => order.invoiceId !== nextInvoiceId))
      throw new AppError(
        "SOURCE_MISMATCH",
        "A contractor work order still references this task and invoice.",
      );
    const now = new Date().toISOString();
    const { subtasks: children, ...fields } = patch;
    const timing: Partial<typeof tasks.$inferInsert> = {};
    if (patch.status && patch.status !== existing.status) {
      timing.activeMilliseconds =
        existing.activeMilliseconds +
        (existing.activeSince
          ? Math.max(0, Date.parse(now) - Date.parse(existing.activeSince))
          : 0);
      timing.activeSince = patch.status === "in-progress" ? now : null;
      timing.startedAt =
        existing.startedAt || (patch.status === "in-progress" ? now : null);
      timing.completedAt = patch.status === "done" ? now : null;
      tx.insert(taskHistory)
        .values({
          id: randomUUID(),
          taskId: id,
          fromStatus: existing.status,
          toStatus: patch.status,
          occurredAt: now,
        })
        .run();
    }
    const groupChanged =
      (patch.status && patch.status !== existing.status) ||
      (patch.priority && patch.priority !== existing.priority);
    tx.update(tasks)
      .set({
        ...fields,
        ...timing,
        ...(groupChanged && { boardPosition: null }),
        updatedAt: now,
      })
      .where(eq(tasks.id, id))
      .run();
    if (patch.title !== undefined && patch.title !== existing.title) {
      tx.update(calendarEvents)
        .set({ taskTitle: patch.title, updatedAt: now })
        .where(eq(calendarEvents.taskId, id))
        .run();
    }
    if (children) {
      tx.delete(subtasks).where(eq(subtasks.taskId, id)).run();
      for (const child of children)
        tx.insert(subtasks)
          .values({ ...child, taskId: id })
          .run();
    }
  });
  return listTasks().find((t) => t.id === id)!;
}

export function deleteTasks(input: string[]) {
  const ids = [...new Set(z.array(recordId).min(1).parse(input))];
  const token = randomUUID();
  const now = new Date().toISOString();
  let deleted = 0;
  getDb().transaction((tx) => {
    for (const id of ids) {
      const task = tx.select().from(tasks).where(eq(tasks.id, id)).get();
      if (!task || task.deletedAt) continue;
      const events = tx
        .select({ id: calendarEvents.id })
        .from(calendarEvents)
        .where(eq(calendarEvents.taskId, id))
        .all();
      tx.update(tasks)
        .set({
          deletedAt: now,
          deletionToken: token,
          deletedEventIds: JSON.stringify(events.map((event) => event.id)),
          updatedAt: now,
          activeSince: null,
          activeMilliseconds:
            task.activeMilliseconds +
            (task.activeSince
              ? Math.max(0, Date.parse(now) - Date.parse(task.activeSince))
              : 0),
        })
        .where(eq(tasks.id, id))
        .run();
      tx.update(calendarEvents)
        .set({ taskId: null, updatedAt: now })
        .where(eq(calendarEvents.taskId, id))
        .run();
      deleted++;
    }
  });
  return { token, deleted };
}
export function deleteTask(id: string) {
  deleteTasks([id]);
}

export function undoTaskDeletion(input: string) {
  const token = z.uuid().parse(input);
  return getDb().transaction((tx) => {
    const deleted = tx
      .select()
      .from(tasks)
      .where(eq(tasks.deletionToken, token))
      .all();
    const now = new Date().toISOString();
    for (const task of deleted) {
      tx.update(tasks)
        .set({
          deletedAt: null,
          deletionToken: null,
          deletedEventIds: null,
          activeSince: task.status === "in-progress" ? now : null,
          updatedAt: now,
        })
        .where(eq(tasks.id, task.id))
        .run();
      if (!task.deletedAt || !task.deletedEventIds) continue;
      for (const eventId of z
        .array(recordId)
        .parse(JSON.parse(task.deletedEventIds))) {
        tx.update(calendarEvents)
          .set({ taskId: task.id, updatedAt: now })
          .where(
            and(
              eq(calendarEvents.id, eventId),
              isNull(calendarEvents.taskId),
              eq(calendarEvents.updatedAt, task.deletedAt),
            ),
          )
          .run();
      }
    }
    return { restored: deleted.length };
  });
}

export function reorderTask(
  idInput: string,
  targetInput: string,
  placementInput: "before" | "after",
) {
  const id = recordId.parse(idInput);
  const targetId = recordId.parse(targetInput);
  const placement = z.enum(["before", "after"]).parse(placementInput);
  if (id === targetId) return;
  getDb().transaction((tx) => {
    const source = getTask(id);
    const target = getTask(targetId);
    if (source.status !== target.status || source.priority !== target.priority)
      throw new AppError(
        "TASK_GROUP",
        "Reorder cards within the same column and priority.",
      );
    const group = tx
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.status, source.status),
          eq(tasks.priority, source.priority),
          isNull(tasks.deletedAt),
        ),
      )
      .orderBy(desc(tasks.createdAt))
      .all()
      .sort(compareBoardTasks)
      .filter((task) => task.id !== id);
    const offset =
      group.findIndex((task) => task.id === targetId) +
      Number(placement === "after");
    group.splice(offset, 0, source);
    group.forEach((task, index) => {
      if (task.boardPosition !== index)
        tx.update(tasks)
          .set({ boardPosition: index })
          .where(eq(tasks.id, task.id))
          .run();
    });
  });
}

export function getTaskHistory(id: string) {
  getTask(recordId.parse(id));
  return getDb()
    .select()
    .from(taskHistory)
    .where(eq(taskHistory.taskId, id))
    .orderBy(asc(taskHistory.occurredAt))
    .all();
}

function qualifyingInvoice(id: string) {
  const db = getDb();
  const invoice = db.select().from(invoices).where(eq(invoices.id, id)).get();
  if (!invoice) throw new AppError("NOT_FOUND", "Invoice no longer exists.");
  const received = listPayments(id)
    .filter(
      (payment) => !payment.correction && payment.currency === invoice.currency,
    )
    .reduce((sum, payment) => sum + payment.amountCents, 0);
  if (
    invoice.trashedAt ||
    invoice.status === "DRAFT" ||
    invoice.advanceCents <= 0 ||
    received < invoice.advanceCents
  )
    throw new AppError(
      "ADVANCE_NOT_PAID",
      "Recorded payments have not met the required advance.",
    );
  return { invoice, received };
}

export function pendingTracking(): TrackingOffer[] {
  const db = getDb();
  return db.transaction((tx) => {
    const offers: TrackingOffer[] = [];
    for (const row of tx
      .select()
      .from(invoices)
      .where(and(isNull(invoices.trackingChoice), isNull(invoices.trashedAt)))
      .all()) {
      if (row.advanceCents <= 0 || row.paidCents < row.advanceCents) continue;
      let result: ReturnType<typeof qualifyingInvoice>;
      try {
        result = qualifyingInvoice(row.id);
      } catch (e) {
        if (e instanceof AppError && e.code === "ADVANCE_NOT_PAID") continue;
        throw e;
      }
      // Missing items are a domain dependency; never invent a deliverable.
      const items = tx
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, row.id))
        .all();
      if (!items.length) continue;
      const eligibleAt = row.trackingEligibleAt || new Date().toISOString();
      if (!row.trackingEligibleAt)
        tx.update(invoices)
          .set({ trackingEligibleAt: eligibleAt })
          .where(eq(invoices.id, row.id))
          .run();
      const client = row.clientId
        ? tx.select().from(clients).where(eq(clients.id, row.clientId)).get()
        : undefined;
      const snapshot = row.clientSnapshot
        ? (JSON.parse(row.clientSnapshot) as { name?: string })
        : undefined;
      offers.push({
        invoiceId: row.id,
        code: row.code,
        clientName: snapshot?.name || client?.name || "Invoice client",
        eligibleAt,
        advanceCents: row.advanceCents,
        receivedCents: result.received,
        currency: row.currency,
      });
    }
    return offers;
  });
}

export function decideTracking(idInput: string, choiceInput: "yes" | "no") {
  const id = recordId.parse(idInput);
  const choice = trackingChoiceSchema.parse(choiceInput);
  const db = getDb();
  return db.transaction((tx) => {
    const invoice = tx.select().from(invoices).where(eq(invoices.id, id)).get();
    if (!invoice) throw new AppError("NOT_FOUND", "Invoice no longer exists.");
    if (!invoice.trackingChoice) {
      qualifyingInvoice(id);
      const items = tx
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, id))
        .orderBy(asc(invoiceItems.position))
        .all();
      if (!items.length)
        throw new AppError(
          "MISSING_ITEMS",
          "Invoice deliverables are not available yet.",
        );
      const now = new Date().toISOString();
      if (choice === "yes") {
        const client = invoice.clientId
          ? tx
              .select()
              .from(clients)
              .where(eq(clients.id, invoice.clientId))
              .get()
          : undefined;
        const snapshot = invoice.clientSnapshot
          ? (JSON.parse(invoice.clientSnapshot) as {
              name?: string;
              driveUrl?: string;
            })
          : undefined;
        for (const item of items) {
          const taskId = randomUUID();
          const inserted = tx
            .insert(tasks)
            .values({
              id: taskId,
              invoiceItemId: item.id,
              invoiceId: id,
              clientId: invoice.clientId,
              title: item.description,
              description: item.description,
              assignee: resolveDefaultAssignee(tx),
              clientName: snapshot?.name || client?.name,
              deliveryUrl: deliveryLink.parse(
                invoice.deliveryUrl ||
                  snapshot?.driveUrl ||
                  client?.driveUrl ||
                  null,
              ),
              currency: invoice.currency,
              dueDate: invoice.dueDate || "",
              createdAt: now,
              updatedAt: now,
            })
            .onConflictDoNothing({ target: tasks.invoiceItemId })
            .run();
          if (inserted.changes)
            tx.insert(taskHistory)
              .values({
                id: randomUUID(),
                taskId,
                fromStatus: null,
                toStatus: "todo",
                occurredAt: now,
              })
              .run();
        }
      }
      tx.update(invoices)
        .set({
          trackingEligibleAt: invoice.trackingEligibleAt || now,
          trackingChoice: choice,
          trackingDecidedAt: now,
        })
        .where(eq(invoices.id, id))
        .run();
    }
    return {
      choice: invoice.trackingChoice || choice,
      taskIds: tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.invoiceId, id), isNull(tasks.deletedAt)))
        .all()
        .map((t) => t.id),
    };
  });
}

export function registerTaskHandlers(broadcast: () => void) {
  ipcMain.handle("tasks:list", () => listTasks());
  ipcMain.handle("tasks:history", (_e, id: string) => getTaskHistory(id));
  ipcMain.handle("tracking:pending", () => pendingTracking());
  ipcMain.handle("tasks:create", (_e, input: TaskCreateInput) => {
    const result = createTask(input);
    broadcast();
    scheduleBackgroundNativeCalendarSync(broadcast, { pushOnly: true });
    return result;
  });
  ipcMain.handle("tasks:update", (_e, id: string, patch: TaskPatchInput) => {
    const result = updateTask(id, patch);
    broadcast();
    scheduleBackgroundNativeCalendarSync(broadcast, { pushOnly: true });
    return result;
  });
  ipcMain.handle(
    "tasks:reorder",
    (_e, id: string, targetId: string, placement: "before" | "after") => {
      reorderTask(id, targetId, placement);
      broadcast();
    },
  );
  ipcMain.handle("tasks:removeMany", (_e, ids: string[]) => {
    const result = deleteTasks(ids);
    broadcast();
    scheduleBackgroundNativeCalendarSync(broadcast, { pushOnly: true });
    return result;
  });
  ipcMain.handle("tasks:undoRemove", (_e, token: string) => {
    const result = undoTaskDeletion(token);
    broadcast();
    scheduleBackgroundNativeCalendarSync(broadcast, { pushOnly: true });
    return result;
  });
  ipcMain.handle("tasks:remove", (_e, id: string) => {
    deleteTask(id);
    broadcast();
    scheduleBackgroundNativeCalendarSync(broadcast, { pushOnly: true });
  });
  ipcMain.handle("tracking:decide", (_e, id: string, choice: "yes" | "no") => {
    const result = decideTracking(id, choice);
    broadcast();
    scheduleBackgroundNativeCalendarSync(broadcast, { pushOnly: true });
    return result;
  });
}
