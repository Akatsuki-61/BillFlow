import { ipcMain } from "electron";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getDb } from "../db";
import { calendarEvents, clients, tasks } from "../db/schema";
import { newCalendarEventSchema, calendarEventPatchSchema } from "../validation";
import { recordId } from "../workflow-validation";
import { AppError } from "./errors";
import type {
  CalendarEventItem,
  NewCalendarEventInput,
  CalendarEventPatchInput,
  EventCategory,
  EventColor,
} from "../../src/types/calendar";

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
      startDate: evt.startDate,
      endDate: evt.endDate || null,
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
    startDate: evt.startDate,
    endDate: evt.endDate || null,
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
  const parsed = newCalendarEventSchema.parse(input);
  const db = getDb();
  const id = parsed.id || `evt-${randomUUID()}`;
  const now = new Date().toISOString();

  let resolvedClientName = parsed.clientName || null;
  if (parsed.clientId && !resolvedClientName) {
    const client = db.select().from(clients).where(eq(clients.id, parsed.clientId)).get();
    if (client) resolvedClientName = client.name;
  }

  let resolvedTaskTitle = parsed.taskTitle || null;
  if (parsed.taskId && !resolvedTaskTitle) {
    const task = db.select().from(tasks).where(eq(tasks.id, parsed.taskId)).get();
    if (task) resolvedTaskTitle = task.title;
  }

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
      clientName: resolvedClientName,
      taskId: parsed.taskId || null,
      taskTitle: resolvedTaskTitle,
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
  const parsed = calendarEventPatchSchema.parse(input);
  const db = getDb();
  const existing = db.select().from(calendarEvents).where(eq(calendarEvents.id, id)).get();
  if (!existing) {
    throw new AppError("NOT_FOUND", "Calendar event not found.");
  }

  const now = new Date().toISOString();
  let resolvedClientName = parsed.clientName !== undefined ? parsed.clientName : existing.clientName;
  if (parsed.clientId && parsed.clientId !== existing.clientId && !parsed.clientName) {
    const client = db.select().from(clients).where(eq(clients.id, parsed.clientId)).get();
    resolvedClientName = client ? client.name : null;
  }

  let resolvedTaskTitle = parsed.taskTitle !== undefined ? parsed.taskTitle : existing.taskTitle;
  if (parsed.taskId && parsed.taskId !== existing.taskId && !parsed.taskTitle) {
    const task = db.select().from(tasks).where(eq(tasks.id, parsed.taskId)).get();
    resolvedTaskTitle = task ? task.title : null;
  }

  db.update(calendarEvents)
    .set({
      ...(parsed.title !== undefined ? { title: parsed.title } : {}),
      ...(parsed.description !== undefined ? { description: parsed.description } : {}),
      ...(parsed.startDate !== undefined ? { startDate: parsed.startDate } : {}),
      ...(parsed.endDate !== undefined ? { endDate: parsed.endDate } : {}),
      ...(parsed.startTime !== undefined ? { startTime: parsed.startTime } : {}),
      ...(parsed.endTime !== undefined ? { endTime: parsed.endTime } : {}),
      ...(parsed.isAllDay !== undefined ? { isAllDay: Boolean(parsed.isAllDay) } : {}),
      ...(parsed.category !== undefined ? { category: parsed.category } : {}),
      ...(parsed.color !== undefined ? { color: parsed.color } : {}),
      ...(parsed.clientId !== undefined ? { clientId: parsed.clientId, clientName: resolvedClientName } : {}),
      ...(parsed.taskId !== undefined ? { taskId: parsed.taskId, taskTitle: resolvedTaskTitle } : {}),
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
