import { ipcMain } from "electron";
import { eq, desc, isNull, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getDb } from "../db";
import { calendarEvents, clients, tasks } from "../db/schema";
import { newCalendarEventSchema, calendarEventPatchSchema } from "../validation";
import { recordId } from "../workflow-validation";
import { AppError } from "./errors";
import {
  normalizeAndAutoFixDate,
  normalizeAndAutoFixTimeRange,
} from "../../src/lib/local-calendar";
import type {
  CalendarEventItem,
  NewCalendarEventInput,
  CalendarEventPatchInput,
  EventCategory,
  EventColor,
} from "../../src/types/calendar";

/**
 * Internal silent auto-healer for calendar event inputs & links.
 * Repairs date/time formats and resolves Task <-> Client foreign keys before DB write.
 */
function autoHealCalendarInput(raw: NewCalendarEventInput): NewCalendarEventInput {
  const db = getDb();
  const fixedStart = normalizeAndAutoFixDate(raw.startDate);
  let fixedEnd = raw.endDate
    ? normalizeAndAutoFixDate(raw.endDate, fixedStart)
    : null;
  if (fixedEnd && fixedEnd < fixedStart) {
    fixedEnd = fixedStart;
  }

  const fixedTimes = normalizeAndAutoFixTimeRange(
    raw.startTime,
    raw.endTime,
    raw.isAllDay
  );

  let validTaskId: string | null = raw.taskId || null;
  let resolvedTaskTitle: string | null = raw.taskTitle || null;
  let validClientId: string | null = raw.clientId || null;
  let resolvedClientName: string | null = raw.clientName || null;

  if (validTaskId) {
    const taskRow = db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, validTaskId), isNull(tasks.deletedAt)))
      .get();
    if (taskRow) {
      resolvedTaskTitle = taskRow.title;
      if (!validClientId && taskRow.clientId) {
        validClientId = taskRow.clientId;
        resolvedClientName = taskRow.clientName || resolvedClientName;
      }
    } else {
      // Auto-fix stale/missing taskId without failing
      validTaskId = null;
    }
  }

  if (validClientId) {
    const clientRow = db
      .select()
      .from(clients)
      .where(eq(clients.id, validClientId))
      .get();
    if (clientRow) {
      resolvedClientName = clientRow.name;
    } else {
      // Auto-fix stale/missing clientId without failing FK constraint
      validClientId = null;
    }
  }

  return {
    ...raw,
    title: (raw.title || "Scheduled Event").trim(),
    startDate: fixedStart,
    endDate: fixedEnd,
    startTime: fixedTimes.startTime,
    endTime: fixedTimes.endTime,
    isAllDay: fixedTimes.isAllDay,
    taskId: validTaskId,
    taskTitle: resolvedTaskTitle,
    clientId: validClientId,
    clientName: resolvedClientName,
  };
}

export function listCalendarEvents(filter?: {
  startDate?: string;
  endDate?: string;
  category?: string;
  taskId?: string;
}): CalendarEventItem[] {
  const db = getDb();
  const allEvents = db
    .select()
    .from(calendarEvents)
    .orderBy(desc(calendarEvents.startDate), desc(calendarEvents.createdAt))
    .all();

  return allEvents
    .filter((evt) => {
      if (filter?.category && filter.category !== "all" && evt.category !== filter.category) {
        return false;
      }
      if (filter?.taskId && evt.taskId !== filter.taskId) {
        return false;
      }
      if (filter?.startDate && evt.startDate < filter.startDate) {
        return false;
      }
      if (filter?.endDate && evt.startDate > filter.endDate) {
        return false;
      }
      return true;
    })
    .map((evt) => ({
      id: evt.id,
      title: evt.title,
      description: evt.description,
      startDate: normalizeAndAutoFixDate(evt.startDate),
      endDate: evt.endDate ? normalizeAndAutoFixDate(evt.endDate, evt.startDate) : null,
      startTime: evt.startTime || null,
      endTime: evt.endTime || null,
      isAllDay: Boolean(evt.isAllDay),
      category: evt.category as EventCategory,
      color: evt.color as EventColor,
      clientId: evt.clientId || null,
      clientName: evt.clientName || null,
      taskId: evt.taskId || null,
      taskTitle: evt.taskTitle || null,
      location: evt.location || null,
      createdAt: evt.createdAt,
      updatedAt: evt.updatedAt,
    }));
}

export function getCalendarEvent(idInput: string): CalendarEventItem {
  const id = recordId.parse(idInput);
  const db = getDb();
  const evt = db.select().from(calendarEvents).where(eq(calendarEvents.id, id)).get();
  if (!evt) {
    throw new AppError("NOT_FOUND", "Calendar event not found.");
  }

  return {
    id: evt.id,
    title: evt.title,
    description: evt.description,
    startDate: normalizeAndAutoFixDate(evt.startDate),
    endDate: evt.endDate ? normalizeAndAutoFixDate(evt.endDate, evt.startDate) : null,
    startTime: evt.startTime || null,
    endTime: evt.endTime || null,
    isAllDay: Boolean(evt.isAllDay),
    category: evt.category as EventCategory,
    color: evt.color as EventColor,
    clientId: evt.clientId || null,
    clientName: evt.clientName || null,
    taskId: evt.taskId || null,
    taskTitle: evt.taskTitle || null,
    location: evt.location || null,
    createdAt: evt.createdAt,
    updatedAt: evt.updatedAt,
  };
}

export function createCalendarEvent(
  input: NewCalendarEventInput,
  broadcast?: () => void
): CalendarEventItem {
  const healed = autoHealCalendarInput(input);
  const parsed = newCalendarEventSchema.parse(healed);
  const db = getDb();
  const id = parsed.id || `evt-${randomUUID()}`;
  const now = new Date().toISOString();

  db.insert(calendarEvents)
    .values({
      id,
      title: parsed.title,
      description: parsed.description || "",
      startDate: parsed.startDate,
      endDate: parsed.endDate || null,
      startTime: parsed.startTime || null,
      endTime: parsed.endTime || null,
      isAllDay: Boolean(parsed.isAllDay),
      category: parsed.category || "general",
      color: parsed.color || "blue",
      clientId: parsed.clientId || null,
      clientName: parsed.clientName || null,
      taskId: parsed.taskId || null,
      taskTitle: parsed.taskTitle || null,
      location: parsed.location || null,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  broadcast?.();
  return getCalendarEvent(id);
}

export function updateCalendarEvent(
  idInput: string,
  input: CalendarEventPatchInput,
  broadcast?: () => void
): CalendarEventItem {
  const id = recordId.parse(idInput);
  const db = getDb();
  const existing = db.select().from(calendarEvents).where(eq(calendarEvents.id, id)).get();
  if (!existing) {
    throw new AppError("NOT_FOUND", "Calendar event not found.");
  }

  const parsed = calendarEventPatchSchema.parse(input);
  const now = new Date().toISOString();

  const mergedStartDate =
    parsed.startDate !== undefined
      ? normalizeAndAutoFixDate(parsed.startDate, existing.startDate)
      : existing.startDate;
  let mergedEndDate =
    parsed.endDate !== undefined
      ? parsed.endDate
        ? normalizeAndAutoFixDate(parsed.endDate, mergedStartDate)
        : null
      : existing.endDate;
  if (mergedEndDate && mergedEndDate < mergedStartDate) {
    mergedEndDate = mergedStartDate;
  }

  const mergedIsAllDay =
    parsed.isAllDay !== undefined ? Boolean(parsed.isAllDay) : Boolean(existing.isAllDay);
  const fixedTimes = normalizeAndAutoFixTimeRange(
    parsed.startTime !== undefined ? parsed.startTime : existing.startTime,
    parsed.endTime !== undefined ? parsed.endTime : existing.endTime,
    mergedIsAllDay
  );

  let validClientId =
    parsed.clientId !== undefined ? parsed.clientId : existing.clientId;
  let resolvedClientName =
    parsed.clientName !== undefined ? parsed.clientName : existing.clientName;
  if (validClientId) {
    const client = db.select().from(clients).where(eq(clients.id, validClientId)).get();
    if (client) {
      resolvedClientName = client.name;
    } else {
      validClientId = null;
    }
  }

  let validTaskId =
    parsed.taskId !== undefined ? parsed.taskId : existing.taskId;
  let resolvedTaskTitle =
    parsed.taskTitle !== undefined ? parsed.taskTitle : existing.taskTitle;
  if (validTaskId) {
    const task = db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, validTaskId), isNull(tasks.deletedAt)))
      .get();
    if (task) {
      resolvedTaskTitle = task.title;
    } else {
      validTaskId = null;
    }
  }

  db.update(calendarEvents)
    .set({
      ...(parsed.title !== undefined ? { title: parsed.title } : {}),
      ...(parsed.description !== undefined ? { description: parsed.description } : {}),
      startDate: mergedStartDate,
      endDate: mergedEndDate,
      startTime: fixedTimes.startTime,
      endTime: fixedTimes.endTime,
      isAllDay: fixedTimes.isAllDay,
      ...(parsed.category !== undefined ? { category: parsed.category } : {}),
      ...(parsed.color !== undefined ? { color: parsed.color } : {}),
      clientId: validClientId || null,
      clientName: resolvedClientName || null,
      taskId: validTaskId || null,
      taskTitle: resolvedTaskTitle || null,
      ...(parsed.location !== undefined ? { location: parsed.location } : {}),
      updatedAt: now,
    })
    .where(eq(calendarEvents.id, id))
    .run();

  broadcast?.();
  return getCalendarEvent(id);
}

export function deleteCalendarEvent(idInput: string, broadcast?: () => void): { success: boolean } {
  const id = recordId.parse(idInput);
  const db = getDb();
  const existing = db.select().from(calendarEvents).where(eq(calendarEvents.id, id)).get();
  if (!existing) {
    throw new AppError("NOT_FOUND", "Calendar event not found.");
  }

  db.delete(calendarEvents).where(eq(calendarEvents.id, id)).run();
  broadcast?.();
  return { success: true };
}

export function registerCalendarHandlers(broadcast: () => void): void {
  ipcMain.handle("events:list", async (_, filter) => listCalendarEvents(filter));
  ipcMain.handle("events:get", async (_, id) => getCalendarEvent(id));
  ipcMain.handle("events:create", async (_, input) => createCalendarEvent(input, broadcast));
  ipcMain.handle("events:update", async (_, id, patch) => updateCalendarEvent(id, patch, broadcast));
  ipcMain.handle("events:remove", async (_, id) => deleteCalendarEvent(id, broadcast));
}
