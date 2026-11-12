import { app, ipcMain, shell } from "electron";
import { eq, desc, isNull, and } from "drizzle-orm";
import { randomUUID, createHash } from "crypto";
import { execFile, execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import { getDb } from "../db";
import { calendarEvents, clients, tasks } from "../db/schema";
import { newCalendarEventSchema, calendarEventPatchSchema } from "../validation";
import { recordId } from "../workflow-validation";
import { AppError } from "./errors";
import {
  normalizeAndAutoFixDate,
  normalizeAndAutoFixTimeRange,
  generateIcsFromEventsAndTasks,
} from "../../src/lib/local-calendar";
import type {
  CalendarEventItem,
  NewCalendarEventInput,
  CalendarEventPatchInput,
  EventCategory,
  EventColor,
} from "../../src/types/calendar";
import type {
  TaskStatus,
  TaskPriority,
  TaskCategory,
} from "../../src/types/tasks";

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
  if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
    void syncNativeLocalCalendar(broadcast);
  }
  return { success: true };
}

const APPLE_COREDATA_EPOCH_OFFSET_SEC = 978307200; // Seconds between 1970-01-01 and 2001-01-01

function coreDataSecondsToLocalDateAndTime(
  coreDataSec: number,
  isAllDay: boolean
): { dateStr: string; timeStr: string | null } {
  const jsDate = new Date((coreDataSec + APPLE_COREDATA_EPOCH_OFFSET_SEC) * 1000);
  const y = jsDate.getFullYear();
  const m = String(jsDate.getMonth() + 1).padStart(2, "0");
  const d = String(jsDate.getDate()).padStart(2, "0");
  const dateStr = `${y}-${m}-${d}`;
  if (isAllDay) {
    return { dateStr, timeStr: null };
  }
  const hh = String(jsDate.getHours()).padStart(2, "0");
  const mm = String(jsDate.getMinutes()).padStart(2, "0");
  return { dateStr, timeStr: `${hh}:${mm}` };
}

function inferMacCalendarColor(calendarTitle: string): EventColor {
  const lower = (calendarTitle || "").toLowerCase();
  if (lower.includes("holiday") || lower.includes("family")) return "emerald";
  if (lower.includes("work") || lower.includes("university") || lower.includes("ousl")) return "purple";
  if (lower.includes("deadline") || lower.includes("exam") || lower.includes("cat")) return "rose";
  if (lower.includes("home")) return "blue";
  return "cyan";
}

function inferMacEventCategory(summary: string, calendarTitle: string): EventCategory {
  const combined = `${summary} ${calendarTitle}`.toLowerCase();
  if (combined.includes("cat ") || combined.includes("exam") || combined.includes("deadline") || combined.includes("due")) {
    return "deadline";
  }
  if (combined.includes("holiday") || combined.includes("poya") || combined.includes("deepavali") || combined.includes("milestone")) {
    return "milestone";
  }
  if (combined.includes("review") || combined.includes("ps") || combined.includes("ils") || combined.includes("audit")) {
    return "review";
  }
  if (combined.includes("meet") || combined.includes("call") || combined.includes("zoom") || combined.includes("session")) {
    return "meeting";
  }
  return "general";
}

function upsertNativeMacEventToBillFlowDb(raw: {
  uidKey: string;
  title: string;
  description: string;
  calendarName: string;
  startDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  isAllDay: boolean;
  location: string | null;
}): boolean {
  const cleanTitle = (raw.title || "").trim();
  if (!cleanTitle) return false;
  // Skip BillFlow's own exported items to prevent circular duplication
  if (
    raw.calendarName === "BillFlow" ||
    cleanTitle.startsWith("[TASK] ") ||
    cleanTitle.startsWith("[DONE] ") ||
    (raw.description || "").includes("[BF-SYNC:")
  ) {
    return false;
  }

  const hash = createHash("sha1")
    .update(`${raw.uidKey}|${raw.startDate}|${raw.startTime || "allday"}`)
    .digest("hex")
    .slice(0, 20);
  const deterministicId = `macos-cal-${hash}`;
  const db = getDb();
  const now = new Date().toISOString();

  const fixedStart = normalizeAndAutoFixDate(raw.startDate);
  const fixedEnd = raw.endDate ? normalizeAndAutoFixDate(raw.endDate, fixedStart) : fixedStart;
  const fixedTimes = normalizeAndAutoFixTimeRange(raw.startTime, raw.endTime, raw.isAllDay);
  const category = inferMacEventCategory(cleanTitle, raw.calendarName);
  const color = inferMacCalendarColor(raw.calendarName);
  const descWithSource = raw.calendarName
    ? `${raw.description ? `${raw.description}\n` : ""}Local Calendar: ${raw.calendarName}`
    : raw.description || "Synced from macOS Calendar";

  const existing = db
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.id, deterministicId))
    .get();

  if (existing) {
    if (
      existing.title !== cleanTitle ||
      existing.startDate !== fixedStart ||
      existing.startTime !== fixedTimes.startTime ||
      existing.endTime !== fixedTimes.endTime
    ) {
      db.update(calendarEvents)
        .set({
          title: cleanTitle,
          description: descWithSource,
          startDate: fixedStart,
          endDate: fixedEnd,
          startTime: fixedTimes.startTime,
          endTime: fixedTimes.endTime,
          isAllDay: fixedTimes.isAllDay,
          category,
          color,
          location: raw.location || null,
          updatedAt: now,
        })
        .where(eq(calendarEvents.id, deterministicId))
        .run();
      return true;
    }
    return false;
  }

  db.insert(calendarEvents)
    .values({
      id: deterministicId,
      title: cleanTitle,
      description: descWithSource,
      startDate: fixedStart,
      endDate: fixedEnd,
      startTime: fixedTimes.startTime,
      endTime: fixedTimes.endTime,
      isAllDay: fixedTimes.isAllDay,
      category,
      color,
      clientId: null,
      clientName: raw.calendarName || "Local Calendar",
      taskId: null,
      taskTitle: null,
      location: raw.location || null,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return true;
}

type TaskTimeSlotMap = Record<
  string,
  { startTime: string | null; endTime: string | null }
>;

let cachedTaskTimeSlots: TaskTimeSlotMap = {};

function getTaskTimeSlotsPath(): string | null {
  try {
    return path.join(app.getPath("userData"), "billflow-task-times.json");
  } catch {
    return null;
  }
}

function loadPersistedTaskTimeSlots(): TaskTimeSlotMap {
  if (Object.keys(cachedTaskTimeSlots).length > 0) {
    return cachedTaskTimeSlots;
  }
  const filePath = getTaskTimeSlotsPath();
  if (!filePath) return cachedTaskTimeSlots;
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        cachedTaskTimeSlots = parsed;
      }
    }
  } catch {}
  return cachedTaskTimeSlots;
}

function savePersistedTaskTimeSlots(incoming?: TaskTimeSlotMap): TaskTimeSlotMap {
  const current = loadPersistedTaskTimeSlots();
  if (!incoming || typeof incoming !== "object") {
    return current;
  }
  cachedTaskTimeSlots = { ...current, ...incoming };
  const filePath = getTaskTimeSlotsPath();
  if (filePath) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(cachedTaskTimeSlots), "utf-8");
    } catch {}
  }
  return cachedTaskTimeSlots;
}

let lastSqlitePullAt = 0;

/**
 * Reads events directly from macOS Calendar.sqlitedb (OccurrenceCache + CalendarItem) if accessible.
 * All BillFlow SQLite writes are batched inside a single transaction for <3ms execution.
 */
function pullFromMacOsCalendarSqliteDb(forcePull = false): {
  accessible: boolean;
  changedCount: number;
} {
  if (process.platform !== "darwin") {
    return { accessible: false, changedCount: 0 };
  }
  const nowMs = Date.now();
  if (!forcePull && nowMs - lastSqlitePullAt < 15000) {
    return { accessible: true, changedCount: 0 };
  }

  const home = os.homedir();
  const candidatePaths = [
    path.join(home, "Library/Group Containers/group.com.apple.calendar/Calendar.sqlitedb"),
    path.join(home, "Library/Calendars/Calendar.sqlitedb"),
  ];

  const dbPath = candidatePaths.find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });
  if (!dbPath) {
    return { accessible: false, changedCount: 0 };
  }

  let macDb: InstanceType<typeof Database> | null = null;
  let importedCount = 0;
  let accessible = false;
  try {
    macDb = new Database(dbPath, { readonly: true, fileMustExist: true, timeout: 1000 });
    accessible = true;
    lastSqlitePullAt = nowMs;

    const nowCoreDataSec = Math.floor(nowMs / 1000) - APPLE_COREDATA_EPOCH_OFFSET_SEC;
    const minSec = nowCoreDataSec - 90 * 86400; // 90 days ago
    const maxSec = nowCoreDataSec + 365 * 86400; // 365 days ahead

    type RawCalendarRow = {
      itemRowId: number;
      uid: string | null;
      summary: string;
      description: string | null;
      allDay: number;
      startSec: number;
      endSec: number | null;
      calendarTitle: string | null;
      locationTitle: string | null;
    };

    let rowsToImport: RawCalendarRow[] = [];

    // 1. Query OccurrenceCache (includes expanded recurring classes/lectures/holidays shown in Calendar.app)
    try {
      rowsToImport = macDb
        .prepare(
          `
          SELECT
            ci.ROWID as itemRowId,
            ci.unique_identifier as uid,
            ci.summary as summary,
            ci.description as description,
            ci.all_day as allDay,
            oc.occurrence_start_date as startSec,
            oc.occurrence_end_date as endSec,
            c.title as calendarTitle,
            loc.title as locationTitle
          FROM OccurrenceCache oc
          JOIN CalendarItem ci ON oc.event_id = ci.ROWID
          LEFT JOIN Calendar c ON ci.calendar_id = c.ROWID
          LEFT JOIN Location loc ON ci.location_id = loc.ROWID
          WHERE oc.occurrence_start_date >= ? AND oc.occurrence_start_date <= ?
            AND ci.summary IS NOT NULL
          ORDER BY oc.occurrence_start_date ASC
          LIMIT 600
        `
        )
        .all(minSec, maxSec) as RawCalendarRow[];
    } catch {
      // Fallback to direct CalendarItem query below
    }

    // 2. Fallback to CalendarItem if OccurrenceCache returned nothing
    if (rowsToImport.length === 0) {
      try {
        rowsToImport = macDb
          .prepare(
            `
            SELECT
              ci.ROWID as itemRowId,
              ci.unique_identifier as uid,
              ci.summary as summary,
              ci.description as description,
              ci.all_day as allDay,
              ci.start_date as startSec,
              ci.end_date as endSec,
              c.title as calendarTitle,
              loc.title as locationTitle
            FROM CalendarItem ci
            LEFT JOIN Calendar c ON ci.calendar_id = c.ROWID
            LEFT JOIN Location loc ON ci.location_id = loc.ROWID
            WHERE ci.start_date >= ? AND ci.start_date <= ?
              AND ci.summary IS NOT NULL
            ORDER BY ci.start_date ASC
            LIMIT 500
          `
          )
          .all(minSec, maxSec) as RawCalendarRow[];
      } catch {}
    }

    if (rowsToImport.length > 0) {
      const bfDb = getDb();
      bfDb.transaction(() => {
        for (const r of rowsToImport) {
          const isAllDay = Boolean(r.allDay);
          const start = coreDataSecondsToLocalDateAndTime(r.startSec, isAllDay);
          const end =
            r.endSec != null
              ? coreDataSecondsToLocalDateAndTime(r.endSec, isAllDay)
              : { dateStr: start.dateStr, timeStr: null };
          const changed = upsertNativeMacEventToBillFlowDb({
            uidKey: r.uid || `row-${r.itemRowId}`,
            title: r.summary,
            description: r.description || "",
            calendarName: r.calendarTitle || "Apple Calendar",
            startDate: start.dateStr,
            endDate: end.dateStr,
            startTime: start.timeStr,
            endTime: end.timeStr,
            isAllDay,
            location: r.locationTitle || null,
          });
          if (changed) importedCount++;
        }
      });
    }
  } catch {
    // SQLite read may require Full Disk Access; JXA osascript below acts as the fallback bridge
  } finally {
    try {
      macDb?.close();
    } catch {}
  }
  return { accessible, changedCount: importedCount };
}

function isMacCalendarAppRunning(): boolean {
  if (process.platform !== "darwin") return false;
  try {
    const stdout = execSync("pgrep -x Calendar", { encoding: "utf-8", timeout: 300 });
    return Boolean(stdout.trim());
  } catch {
    return false;
  }
}

/**
 * Two-way JXA bridge with macOS Calendar.app:
 * 1) Creates/updates the "BillFlow" calendar inside macOS Calendar.app with all BillFlow Tasks & Events
 * 2) Pulls events from the user's macOS Calendar.app calendars ONLY if Calendar.sqlitedb was not accessible
 */
function syncWithMacOsCalendarAppViaJxa(
  payloadToPush: Array<{
    bfKey: string;
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    startTime: string | null;
    endTime: string | null;
    isAllDay: boolean;
    location: string | null;
  }>,
  shouldPullEvents = false
): Promise<{
  pulledEvents: Array<{
    uidKey: string;
    title: string;
    description: string;
    calendarName: string;
    startDate: string;
    endDate: string;
    startTime: string | null;
    endTime: string | null;
    isAllDay: boolean;
    location: string | null;
  }>;
  pushedCount: number;
  deletedCount: number;
}> {
  if (process.platform !== "darwin") {
    return Promise.resolve({ pulledEvents: [], pushedCount: 0, deletedCount: 0 });
  }

  const jxaScript = `
    ObjC.import('stdlib');
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    function fmtDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function fmtTime(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
    function parseLocal(dateStr, timeStr, addHours) {
      var parts = dateStr.split('-');
      var y = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1, day = parseInt(parts[2], 10);
      if (!timeStr) return new Date(y, m, day, 0, 0, 0);
      var tparts = timeStr.split(':');
      var hh = parseInt(tparts[0], 10) + (addHours || 0), mm = parseInt(tparts[1], 10);
      return new Date(y, m, day, hh, mm, 0);
    }

    function run(argv) {
      var itemsToPush = JSON.parse(argv[0] || "[]");
      var pullMode = argv[1] === "1";
      var Cal = Application("Calendar");
      var wasRunning = false;
      try {
        wasRunning = Cal.running();
      } catch (e) {}

      // Fast direct lookup of BillFlow calendar without iterating every calendar
      var cals = Cal.calendars.whose({ name: "BillFlow" })();
      var bfCal = cals.length > 0 ? cals[0] : null;
      if (!bfCal) {
        bfCal = Cal.Calendar({ name: "BillFlow", description: "BillFlow Tasks & Client Schedule" });
        Cal.calendars.push(bfCal);
      }

      // Fast batch AppleEvent fetch of existing BillFlow event descriptions & summaries
      var existingByKey = {};
      try {
        var existingEvents = bfCal.events();
        var existingDescs = bfCal.events.description();
        var existingSummaries = bfCal.events.summary();
        for (var j = 0; j < existingEvents.length; j++) {
          var desc = (existingDescs && existingDescs[j]) ? String(existingDescs[j]) : "";
          var bfIdx = desc.indexOf("[BF-SYNC:");
          if (bfIdx !== -1) {
            var endIdx = desc.indexOf("]", bfIdx + 9);
            if (endIdx !== -1) {
              var syncKey = desc.substring(bfIdx + 9, endIdx);
              existingByKey[syncKey] = {
                ref: existingEvents[j],
                summary: (existingSummaries && existingSummaries[j]) ? String(existingSummaries[j]) : "",
                desc: desc
              };
            }
          }
        }
      } catch (e) {}

      // 1. Map of active items
      var activeKeyMap = {};
      for (var k = 0; k < itemsToPush.length; k++) {
        activeKeyMap[itemsToPush[k].bfKey] = true;
      }

      // 2. AUTO-DELETE: Remove any events in BillFlow calendar that were deleted or unscheduled in BillFlow
      var deletedCount = 0;
      for (var exKey in existingByKey) {
        if (!activeKeyMap[exKey]) {
          try {
            Cal.delete(existingByKey[exKey].ref);
            deletedCount++;
          } catch(delErr) {}
        }
      }

      // 3. AUTO-EDIT & ADD: Create or update active tasks/events
      var pushedCount = 0;
      for (var m = 0; m < itemsToPush.length; m++) {
        var item = itemsToPush[m];
        var startD = parseLocal(item.startDate, item.isAllDay ? null : (item.startTime || "09:00"), 0);
        var endD = item.isAllDay
          ? parseLocal(item.endDate || item.startDate, null, 24)
          : (item.endTime
              ? parseLocal(item.endDate || item.startDate, item.endTime, 0)
              : parseLocal(item.endDate || item.startDate, item.startTime || "09:00", 1));
        var timeTag = item.isAllDay ? "ALLDAY" : ((item.startTime || "09:00") + "-" + (item.endTime || "10:00"));
        var syncSig = item.startDate + "|" + timeTag;
        var fullDesc = (item.description ? item.description + "\\n" : "") + "[BF-SYNC:" + item.bfKey + "][BF-SIG:" + syncSig + "]";

        var existingEntry = existingByKey[item.bfKey];
        if (existingEntry) {
          try {
            var existingEv = existingEntry.ref;
            var curSummary = existingEntry.summary || "";
            var curDesc = existingEntry.desc || "";
            var needsUpdate = (curSummary !== item.title) ||
                              (curDesc.indexOf("[BF-SIG:" + syncSig + "]") === -1) ||
                              (curDesc !== fullDesc);
            if (needsUpdate) {
              existingEv.summary = item.title;
              existingEv.startDate = startD;
              existingEv.endDate = endD;
              existingEv.alldayEvent = Boolean(item.isAllDay);
              existingEv.description = fullDesc;
              if (item.location !== undefined) {
                existingEv.location = item.location || "";
              }
            }
            pushedCount++;
          } catch (e) {}
        } else {
          try {
            var newEv = Cal.Event({
              summary: item.title,
              description: fullDesc,
              startDate: startD,
              endDate: endD,
              alldayEvent: Boolean(item.isAllDay),
              location: item.location || ""
            });
            bfCal.events.push(newEv);
            pushedCount++;
          } catch (e) {}
        }
      }

      // 4. PULL MODE: Only runs when explicitly requested for external calendars
      var pulledEvents = [];
      if (pullMode) {
        var allCals = Cal.calendars();
        var minDate = new Date(Date.now() - 35 * 86400 * 1000);
        var maxDate = new Date(Date.now() + 90 * 86400 * 1000);
        for (var ci = 0; ci < allCals.length; ci++) {
          try {
            var cName = allCals[ci].name();
            if (cName === "BillFlow") continue;
            var evs = allCals[ci].events.whose({
              _and: [
                { startDate: { _greaterThan: minDate } },
                { startDate: { _lessThan: maxDate } }
              ]
            })();
            for (var ei = 0; ei < evs.length && pulledEvents.length < 250; ei++) {
              try {
                var eObj = evs[ei];
                var sDate = eObj.startDate();
                var eDate = eObj.endDate() || sDate;
                var isAll = Boolean(eObj.alldayEvent());
                pulledEvents.push({
                  uidKey: eObj.uid() + "-" + fmtDate(sDate),
                  title: eObj.summary() || "Local Calendar Event",
                  description: eObj.description() || "",
                  calendarName: cName,
                  startDate: fmtDate(sDate),
                  endDate: fmtDate(eDate),
                  startTime: isAll ? null : fmtTime(sDate),
                  endTime: isAll ? null : fmtTime(eDate),
                  isAllDay: isAll,
                  location: eObj.location() || null
                });
              } catch (innerErr) {}
            }
          } catch (calErr) {}
        }
      }

      if (!wasRunning) {
        try {
          Cal.quit();
        } catch (qErr) {}
      }

      return JSON.stringify({ pushedCount: pushedCount, deletedCount: deletedCount, pulledEvents: pulledEvents });
    }
  `;

  return new Promise((resolve) => {
    execFile(
      "osascript",
      [
        "-l",
        "JavaScript",
        "-e",
        jxaScript,
        JSON.stringify(payloadToPush),
        shouldPullEvents ? "1" : "0",
      ],
      { timeout: 7000 },
      (err, stdout) => {
        if (err || !stdout) {
          resolve({ pulledEvents: [], pushedCount: 0, deletedCount: 0 });
          return;
        }
        try {
          const parsed = JSON.parse(stdout.trim());
          resolve({
            pulledEvents: Array.isArray(parsed.pulledEvents) ? parsed.pulledEvents : [],
            pushedCount: Number(parsed.pushedCount) || 0,
            deletedCount: Number(parsed.deletedCount) || 0,
          });
        } catch {
          resolve({ pulledEvents: [], pushedCount: 0, deletedCount: 0 });
        }
      }
    );
  });
}

let lastJxaPullAt = 0;
let isSyncInFlight = false;
let queuedSyncPayload: {
  broadcast?: () => void;
  incomingTaskTimeSlots?: TaskTimeSlotMap;
  forcePull?: boolean;
  pushOnly?: boolean;
} | null = null;
let pendingBackgroundSyncTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Non-blocking, debounced background calendar sync.
 * Ensures task/event creation, edit, and deletion IPC handlers return in <2ms without waiting on macOS Calendar.
 */
export function scheduleBackgroundNativeCalendarSync(
  broadcast?: () => void,
  options?: {
    pushOnly?: boolean;
    incomingTaskTimeSlots?: TaskTimeSlotMap;
  }
): void {
  if (
    process.platform !== "darwin" ||
    process.env.VITEST ||
    process.env.NODE_ENV === "test"
  ) {
    return;
  }
  if (pendingBackgroundSyncTimer) {
    clearTimeout(pendingBackgroundSyncTimer);
  }
  pendingBackgroundSyncTimer = setTimeout(() => {
    pendingBackgroundSyncTimer = null;
    void syncNativeLocalCalendar(
      broadcast,
      options?.incomingTaskTimeSlots,
      false,
      options?.pushOnly ?? true
    );
  }, 100);
}

export async function syncNativeLocalCalendar(
  broadcast?: () => void,
  incomingTaskTimeSlots?: TaskTimeSlotMap,
  forcePull = false,
  pushOnly = false
): Promise<{ syncedFromMac: number; pushedToMac: number; deletedFromMac: number }> {
  if (
    process.platform !== "darwin" ||
    process.env.VITEST ||
    process.env.NODE_ENV === "test"
  ) {
    return { syncedFromMac: 0, pushedToMac: 0, deletedFromMac: 0 };
  }
  const timeSlots = savePersistedTaskTimeSlots(incomingTaskTimeSlots);

  if (isSyncInFlight) {
    // Queue the latest request so we never drop any task edit or deletion
    queuedSyncPayload = {
      broadcast,
      incomingTaskTimeSlots,
      forcePull: Boolean(queuedSyncPayload?.forcePull || forcePull),
      pushOnly: Boolean((queuedSyncPayload ? queuedSyncPayload.pushOnly : true) && pushOnly),
    };
    return { syncedFromMac: 0, pushedToMac: 0, deletedFromMac: 0 };
  }
  isSyncInFlight = true;

  try {
    let totalSyncedFromMac = 0;

    // Only pull external macOS Calendar events if not in push-only mode
    let shouldPullViaJxa = false;
    if (!pushOnly) {
      const sqliteResult = pullFromMacOsCalendarSqliteDb(forcePull);
      totalSyncedFromMac = sqliteResult.changedCount;
      if (totalSyncedFromMac > 0) {
        broadcast?.();
      }

      // If SQLite was not accessible (FDA required), fallback to JXA pull at most once every 5 minutes unless forced
      const nowMs = Date.now();
      if (!sqliteResult.accessible && (forcePull || nowMs - lastJxaPullAt > 5 * 60 * 1000)) {
        shouldPullViaJxa = true;
        lastJxaPullAt = nowMs;
      }
    }

    // Push BillFlow Tasks & Events to "BillFlow" in macOS Calendar.app (and delete obsolete events)
    const db = getDb();
    const activeTasks = db
      .select()
      .from(tasks)
      .where(isNull(tasks.deletedAt))
      .all()
      .filter((t) => Boolean(t.dueDate));

    const appEvents = db
      .select()
      .from(calendarEvents)
      .all()
      .filter((e) => !e.id.startsWith("macos-cal-"));

    const payloadToPush = [
      ...activeTasks.map((t) => {
        const slot = timeSlots[t.id];
        const normSlot = slot?.startTime
          ? normalizeAndAutoFixTimeRange(slot.startTime, slot.endTime, false)
          : { startTime: null, endTime: null, isAllDay: true };
        return {
          bfKey: `task-${t.id}`,
          title: `${t.status === "done" ? "[DONE] " : "[TASK] "}${t.title}`,
          description: `${t.description || ""}\nStatus: ${t.status.toUpperCase()} | Priority: ${t.priority.toUpperCase()}${t.clientName ? `\nClient: ${t.clientName}` : ""}`,
          startDate: normalizeAndAutoFixDate(t.dueDate),
          endDate: normalizeAndAutoFixDate(t.dueDate),
          startTime: normSlot.startTime,
          endTime: normSlot.endTime,
          isAllDay: normSlot.isAllDay,
          location: t.deliveryUrl || null,
        };
      }),
      ...appEvents.map((e) => ({
        bfKey: `evt-${e.id}`,
        title: e.title,
        description: e.description || "",
        startDate: normalizeAndAutoFixDate(e.startDate),
        endDate: e.endDate ? normalizeAndAutoFixDate(e.endDate, e.startDate) : normalizeAndAutoFixDate(e.startDate),
        startTime: e.startTime || null,
        endTime: e.endTime || null,
        isAllDay: Boolean(e.isAllDay),
        location: e.location || null,
      })),
    ];

    // If this is a background push-only sync (from task/event edit, create, or delete)
    // and Calendar.app is NOT currently running, do NOT launch Calendar.app!
    // Simply keep the local BillFlow.ics export up-to-date.
    const isCalendarRunning = isMacCalendarAppRunning();
    if (pushOnly && !isCalendarRunning) {
      try {
        const icsContent = generateIcsFromEventsAndTasks({
          events: appEvents.map((e) => ({
            id: e.id,
            title: e.title,
            description: e.description,
            startDate: normalizeAndAutoFixDate(e.startDate),
            endDate: e.endDate ? normalizeAndAutoFixDate(e.endDate, e.startDate) : null,
            startTime: e.startTime || null,
            endTime: e.endTime || null,
            isAllDay: Boolean(e.isAllDay),
            category: e.category as EventCategory,
            color: e.color as EventColor,
            clientId: e.clientId || null,
            clientName: e.clientName || null,
            taskId: e.taskId || null,
            taskTitle: e.taskTitle || null,
            location: e.location || null,
            createdAt: e.createdAt,
            updatedAt: e.updatedAt,
          })),
          tasks: activeTasks.map((t) => {
            const slot = timeSlots[t.id];
            return {
              id: t.id,
              title: t.title,
              description: t.description,
              status: t.status as TaskStatus,
              priority: t.priority as TaskPriority,
              category: t.category as TaskCategory,
              assignee: t.assignee,
              dueDate: t.dueDate,
              startTime: slot?.startTime || null,
              endTime: slot?.endTime || null,
              subtasks: [],
              createdAt: t.createdAt,
            };
          }),
          calendarName: "BillFlow",
        });
        const icsPath = path.join(app.getPath("userData"), "BillFlow.ics");
        fs.writeFileSync(icsPath, icsContent, "utf-8");
      } catch {}

      return {
        syncedFromMac: 0,
        pushedToMac: payloadToPush.length,
        deletedFromMac: 0,
      };
    }

    const jxaResult = await syncWithMacOsCalendarAppViaJxa(
      payloadToPush,
      shouldPullViaJxa
    );

    if (jxaResult.pulledEvents.length > 0) {
      let jxaImported = 0;
      db.transaction(() => {
        for (const ev of jxaResult.pulledEvents) {
          if (upsertNativeMacEventToBillFlowDb(ev)) {
            jxaImported++;
          }
        }
      });
      if (jxaImported > 0) {
        totalSyncedFromMac += jxaImported;
        broadcast?.();
      }
    }

    return {
      syncedFromMac: totalSyncedFromMac,
      pushedToMac: jxaResult.pushedCount,
      deletedFromMac: jxaResult.deletedCount,
    };
  } finally {
    isSyncInFlight = false;
    if (queuedSyncPayload) {
      const next = queuedSyncPayload;
      queuedSyncPayload = null;
      void syncNativeLocalCalendar(
        next.broadcast,
        next.incomingTaskTimeSlots,
        next.forcePull,
        next.pushOnly
      );
    }
  }
}

export async function openNativeLocalCalendar(
  broadcast?: () => void,
  incomingTaskTimeSlots?: TaskTimeSlotMap
): Promise<{ success: boolean; syncedFromMac: number; pushedToMac: number }> {
  const timeSlots = savePersistedTaskTimeSlots(incomingTaskTimeSlots);

  if (
    process.platform === "darwin" &&
    !process.env.VITEST &&
    process.env.NODE_ENV !== "test"
  ) {
    try {
      const db = getDb();
      const allTasks = db
        .select()
        .from(tasks)
        .where(isNull(tasks.deletedAt))
        .all();
      const allEvents = listCalendarEvents().filter(
        (e) => !e.id.startsWith("macos-cal-")
      );

      const icsContent = generateIcsFromEventsAndTasks({
        events: allEvents,
        tasks: allTasks.map((t) => {
          const slot = timeSlots[t.id];
          return {
            id: t.id,
            title: t.title,
            description: t.description,
            status: t.status as TaskStatus,
            priority: t.priority as TaskPriority,
            category: t.category as TaskCategory,
            assignee: t.assignee,
            dueDate: t.dueDate,
            startTime: slot?.startTime || null,
            endTime: slot?.endTime || null,
            subtasks: [],
            createdAt: t.createdAt,
          };
        }),
        calendarName: "BillFlow",
      });

      const icsPath = path.join(app.getPath("userData"), "BillFlow.ics");
      fs.writeFileSync(icsPath, icsContent, "utf-8");

      // Open macOS Calendar.app immediately without waiting on JXA
      execFile("open", ["-a", "Calendar", icsPath], () => {});
    } catch {
      try {
        await shell.openExternal("ical://");
      } catch {}
    }
  }

  // Trigger two-way sync in background without blocking the open call
  void syncNativeLocalCalendar(broadcast, incomingTaskTimeSlots, true);

  return {
    success: true,
    syncedFromMac: 0,
    pushedToMac: 0,
  };
}

export function registerCalendarHandlers(broadcast: () => void): void {
  ipcMain.handle("events:list", async (_, filter) => listCalendarEvents(filter));
  ipcMain.handle("events:get", async (_, id) => getCalendarEvent(id));
  ipcMain.handle("events:create", async (_, input) => {
    const created = createCalendarEvent(input, broadcast);
    scheduleBackgroundNativeCalendarSync(broadcast, { pushOnly: true });
    return created;
  });
  ipcMain.handle("events:update", async (_, id, patch) => {
    const updated = updateCalendarEvent(id, patch, broadcast);
    scheduleBackgroundNativeCalendarSync(broadcast, { pushOnly: true });
    return updated;
  });
  ipcMain.handle("events:remove", async (_, id) => {
    const removed = deleteCalendarEvent(id, broadcast);
    scheduleBackgroundNativeCalendarSync(broadcast, { pushOnly: true });
    return removed;
  });
  ipcMain.handle("events:syncNative", async (_, taskTimeSlots?: TaskTimeSlotMap) => {
    savePersistedTaskTimeSlots(taskTimeSlots);
    scheduleBackgroundNativeCalendarSync(broadcast, { pushOnly: true, incomingTaskTimeSlots: taskTimeSlots });
    return { syncedFromMac: 0, pushedToMac: 0 };
  });
  ipcMain.handle("events:openNative", async (_, taskTimeSlots?: TaskTimeSlotMap) =>
    openNativeLocalCalendar(broadcast, taskTimeSlots)
  );
}
