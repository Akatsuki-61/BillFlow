import type {
  CalendarEventItem,
  EventCategory,
  EventColor,
  NewCalendarEventInput,
} from "@/types/calendar";
import type { TaskItem, TaskPriority, TaskCategory, TaskStatus } from "@/types/tasks";

export interface ParsedLocalCalendarItem {
  uid: string;
  kind: "event" | "task";
  title: string;
  description: string;
  startDate: string; // YYYY-MM-DD
  endDate: string | null;
  startTime: string | null; // HH:mm
  endTime: string | null; // HH:mm
  isAllDay: boolean;
  category: EventCategory;
  color: EventColor;
  priority: TaskPriority;
  taskCategory: TaskCategory;
  location: string | null;
  status?: TaskStatus;
}

/**
 * Internal Auto-Fixer: Normalizes any raw date input into a strict YYYY-MM-DD string.
 * Never throws; falls back to fallbackDate or today's local date if malformed.
 */
export function normalizeAndAutoFixDate(
  rawDate?: string | null,
  fallbackDate?: string
): string {
  const defaultDate =
    fallbackDate && /^\d{4}-\d{2}-\d{2}$/.test(fallbackDate)
      ? fallbackDate
      : new Date().toISOString().slice(0, 10);

  if (!rawDate || !String(rawDate).trim()) {
    return defaultDate;
  }

  const trimmed = String(rawDate).trim();

  // Standard ISO YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Math.min(12, Math.max(1, Number(isoMatch[2])));
    const maxDay = new Date(y, m, 0).getDate();
    const d = Math.min(maxDay, Math.max(1, Number(isoMatch[3])));
    return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  // Slash or dot separated YYYY/MM/DD
  const slashMatch = trimmed.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})/);
  if (slashMatch) {
    const y = Number(slashMatch[1]);
    const m = Math.min(12, Math.max(1, Number(slashMatch[2])));
    const maxDay = new Date(y, m, 0).getDate();
    const d = Math.min(maxDay, Math.max(1, Number(slashMatch[3])));
    return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  // Compact YYYYMMDD
  const compactMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})/);
  if (compactMatch) {
    const y = Number(compactMatch[1]);
    const m = Math.min(12, Math.max(1, Number(compactMatch[2])));
    const maxDay = new Date(y, m, 0).getDate();
    const d = Math.min(maxDay, Math.max(1, Number(compactMatch[3])));
    return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  // Native Date parse fallback (e.g., "Oct 15, 2026")
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return defaultDate;
}

/**
 * Internal Auto-Fixer: Normalizes startTime and endTime to HH:mm and ensures endTime > startTime.
 */
export function normalizeAndAutoFixTimeRange(
  startTime?: string | null,
  endTime?: string | null,
  isAllDay?: boolean
): { startTime: string | null; endTime: string | null; isAllDay: boolean } {
  if (isAllDay) {
    return { startTime: null, endTime: null, isAllDay: true };
  }

  const parseTime = (raw?: string | null): { h: number; m: number } | null => {
    if (!raw || !String(raw).trim()) return null;
    const match = String(raw)
      .trim()
      .match(/^(\d{1,2}):(\d{1,2})/);
    if (!match) return null;
    const h = Math.min(23, Math.max(0, Number(match[1])));
    const m = Math.min(59, Math.max(0, Number(match[2])));
    return { h, m };
  };

  const fmt = (t: { h: number; m: number }) =>
    `${String(t.h).padStart(2, "0")}:${String(t.m).padStart(2, "0")}`;

  const start = parseTime(startTime);
  if (!start) {
    return { startTime: null, endTime: null, isAllDay: Boolean(isAllDay) };
  }

  const end = parseTime(endTime);
  const startMinutes = start.h * 60 + start.m;
  if (!end || end.h * 60 + end.m <= startMinutes) {
    // Auto-fix: set end time to +60 minutes (clamped to 23:59)
    const targetMinutes = Math.min(23 * 60 + 59, startMinutes + 60);
    const endH = Math.floor(targetMinutes / 60);
    const endM = targetMinutes % 60;
    return {
      startTime: fmt(start),
      endTime: fmt({ h: endH, m: endM }),
      isAllDay: false,
    };
  }

  return {
    startTime: fmt(start),
    endTime: fmt(end),
    isAllDay: false,
  };
}

const TASK_TIME_SLOTS_STORAGE_KEY = "billflow_task_time_slots_v1";

const inMemoryTaskTimeSlots = new Map<
  string,
  { startTime: string | null; endTime: string | null }
>();

function readTaskTimeSlotsMap(): Record<
  string,
  { startTime: string | null; endTime: string | null }
> {
  const result: Record<string, { startTime: string | null; endTime: string | null }> = {};
  for (const [k, v] of inMemoryTaskTimeSlots.entries()) {
    result[k] = v;
  }
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(TASK_TIME_SLOTS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          return { ...parsed, ...result };
        }
      }
    } catch {}
  }
  return result;
}

export function getTaskTimeSlot(
  taskId: string
): { startTime: string | null; endTime: string | null } | null {
  if (!taskId) return null;
  const map = readTaskTimeSlotsMap();
  return map[taskId] || null;
}

export function saveTaskTimeSlot(
  taskId: string,
  slot: { startTime?: string | null; endTime?: string | null }
): void {
  if (!taskId) return;
  const normalized = normalizeAndAutoFixTimeRange(
    slot.startTime,
    slot.endTime,
    !slot.startTime
  );
  const entry = {
    startTime: normalized.startTime,
    endTime: normalized.endTime,
  };
  inMemoryTaskTimeSlots.set(taskId, entry);
  if (typeof window !== "undefined") {
    try {
      const existing = readTaskTimeSlotsMap();
      existing[taskId] = entry;
      window.localStorage.setItem(
        TASK_TIME_SLOTS_STORAGE_KEY,
        JSON.stringify(existing)
      );
    } catch {}
  }
}

/**
 * Internal Auto-Fixer & Linker: Silently heals date formats, time ranges, and Task <-> Event <-> Client links
 * in memory so the Calendar UI never encounters broken references or malformed dates.
 */
export function autoFixAndLinkCalendarData(params: {
  tasks: TaskItem[];
  events: CalendarEventItem[];
  clients?: { id: string; name: string }[];
}): {
  tasks: TaskItem[];
  events: CalendarEventItem[];
  repairedCount: number;
} {
  let repairedCount = 0;
  const clientMap = new Map<string, string>();
  const clientNameToId = new Map<string, string>();
  for (const c of params.clients || []) {
    clientMap.set(c.id, c.name);
    clientNameToId.set(c.name.toLowerCase().trim(), c.id);
  }

  const storedTimeSlots = readTaskTimeSlotsMap();

  const fixedTasks: TaskItem[] = params.tasks.map((t) => {
    let changed = false;
    let fixedDueDate = t.dueDate || "";
    if (fixedDueDate) {
      const normalized = normalizeAndAutoFixDate(fixedDueDate);
      if (normalized !== fixedDueDate) {
        fixedDueDate = normalized;
        changed = true;
      }
    }

    let fixedClientName = t.clientName;
    let fixedClientId = t.clientId;
    if (fixedClientId && !fixedClientName && clientMap.has(fixedClientId)) {
      fixedClientName = clientMap.get(fixedClientId);
      changed = true;
    } else if (!fixedClientId && fixedClientName) {
      const matchedId = clientNameToId.get(fixedClientName.toLowerCase().trim());
      if (matchedId) {
        fixedClientId = matchedId;
        changed = true;
      }
    }

    const storedSlot = storedTimeSlots[t.id];
    const rawStartTime = t.startTime ?? storedSlot?.startTime ?? null;
    const rawEndTime = t.endTime ?? storedSlot?.endTime ?? null;
    const normalizedTimes = normalizeAndAutoFixTimeRange(
      rawStartTime,
      rawEndTime,
      !rawStartTime
    );

    if (
      normalizedTimes.startTime !== (t.startTime ?? null) ||
      normalizedTimes.endTime !== (t.endTime ?? null)
    ) {
      changed = true;
    }

    if (changed) repairedCount++;
    return changed
      ? {
          ...t,
          dueDate: fixedDueDate,
          startTime: normalizedTimes.startTime,
          endTime: normalizedTimes.endTime,
          clientId: fixedClientId,
          clientName: fixedClientName,
        }
      : t;
  });

  const taskMap = new Map<string, TaskItem>();
  const taskTitleToTask = new Map<string, TaskItem>();
  for (const t of fixedTasks) {
    taskMap.set(t.id, t);
    taskTitleToTask.set(t.title.toLowerCase().trim(), t);
  }

  const fixedEvents: CalendarEventItem[] = params.events.map((evt) => {
    let changed = false;
    const fixedStart = normalizeAndAutoFixDate(evt.startDate);
    if (fixedStart !== evt.startDate) changed = true;

    let fixedEnd = evt.endDate ? normalizeAndAutoFixDate(evt.endDate, fixedStart) : null;
    if (fixedEnd && fixedEnd < fixedStart) {
      fixedEnd = fixedStart;
      changed = true;
    }

    const fixedTimes = normalizeAndAutoFixTimeRange(
      evt.startTime,
      evt.endTime,
      evt.isAllDay
    );
    if (
      fixedTimes.startTime !== (evt.startTime || null) ||
      fixedTimes.endTime !== (evt.endTime || null)
    ) {
      changed = true;
    }

    let fixedTaskId = evt.taskId || null;
    let fixedTaskTitle = evt.taskTitle || null;
    let fixedClientId = evt.clientId || null;
    let fixedClientName = evt.clientName || null;

    if (fixedTaskId && taskMap.has(fixedTaskId)) {
      const linkedTask = taskMap.get(fixedTaskId)!;
      if (fixedTaskTitle !== linkedTask.title) {
        fixedTaskTitle = linkedTask.title;
        changed = true;
      }
      if (!fixedClientId && linkedTask.clientId) {
        fixedClientId = linkedTask.clientId;
        fixedClientName = linkedTask.clientName || clientMap.get(linkedTask.clientId) || null;
        changed = true;
      }
      if (!linkedTask.startTime && fixedTimes.startTime) {
        linkedTask.startTime = fixedTimes.startTime;
        linkedTask.endTime = fixedTimes.endTime;
      }
    } else if (!fixedTaskId && fixedTaskTitle) {
      const matchedTask = taskTitleToTask.get(fixedTaskTitle.toLowerCase().trim());
      if (matchedTask) {
        fixedTaskId = matchedTask.id;
        fixedTaskTitle = matchedTask.title;
        if (!matchedTask.startTime && fixedTimes.startTime) {
          matchedTask.startTime = fixedTimes.startTime;
          matchedTask.endTime = fixedTimes.endTime;
        }
        changed = true;
      }
    } else if (!fixedTaskId) {
      // Auto-link if event title matches a task title
      const matchedByTitle = taskTitleToTask.get(evt.title.toLowerCase().trim());
      if (matchedByTitle) {
        fixedTaskId = matchedByTitle.id;
        fixedTaskTitle = matchedByTitle.title;
        if (!fixedClientId && matchedByTitle.clientId) {
          fixedClientId = matchedByTitle.clientId;
          fixedClientName = matchedByTitle.clientName || null;
        }
        if (!matchedByTitle.startTime && fixedTimes.startTime) {
          matchedByTitle.startTime = fixedTimes.startTime;
          matchedByTitle.endTime = fixedTimes.endTime;
        }
        changed = true;
      }
    }

    if (fixedClientId && !fixedClientName && clientMap.has(fixedClientId)) {
      fixedClientName = clientMap.get(fixedClientId)!;
      changed = true;
    }

    if (changed) repairedCount++;
    return changed
      ? {
          ...evt,
          startDate: fixedStart,
          endDate: fixedEnd,
          startTime: fixedTimes.startTime,
          endTime: fixedTimes.endTime,
          isAllDay: fixedTimes.isAllDay,
          taskId: fixedTaskId,
          taskTitle: fixedTaskTitle,
          clientId: fixedClientId,
          clientName: fixedClientName,
        }
      : evt;
  });

  return {
    tasks: fixedTasks,
    events: fixedEvents,
    repairedCount,
  };
}

function escapeIcsText(value: string | null | undefined): string {
  if (!value) return "";
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function unescapeIcsText(value: string | null | undefined): string {
  if (!value) return "";
  return String(value)
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function formatIcsDateOnly(dateStr: string): string {
  const clean = normalizeAndAutoFixDate(dateStr).replace(/-/g, "");
  return clean.length === 8
    ? clean
    : new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function addOneDayDateOnly(dateStr: string): string {
  const normalized = normalizeAndAutoFixDate(dateStr);
  const parts = normalized.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return formatIcsDateOnly(dateStr);
  }
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + 1));
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function formatIcsDateTimeLocal(dateStr: string, timeStr?: string | null): string {
  const datePart = formatIcsDateOnly(dateStr);
  const [hh = "09", mm = "00"] = (timeStr || "09:00").split(":");
  const cleanH = String(hh).padStart(2, "0").slice(0, 2);
  const cleanM = String(mm).padStart(2, "0").slice(0, 2);
  return `${datePart}T${cleanH}${cleanM}00`;
}

function formatUtcStamp(isoStr?: string): string {
  const date = isoStr ? new Date(isoStr) : new Date();
  if (isNaN(date.getTime())) {
    return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function buildVEventFromCalendarEvent(event: CalendarEventItem): string {
  const lines: string[] = [
    "BEGIN:VEVENT",
    `UID:billflow-evt-${event.id}@billflow.local`,
    `DTSTAMP:${formatUtcStamp(event.updatedAt || event.createdAt)}`,
  ];

  if (event.isAllDay || !event.startTime) {
    lines.push(`DTSTART;VALUE=DATE:${formatIcsDateOnly(event.startDate)}`);
    const endD = event.endDate
      ? addOneDayDateOnly(event.endDate)
      : addOneDayDateOnly(event.startDate);
    lines.push(`DTEND;VALUE=DATE:${endD}`);
  } else {
    lines.push(`DTSTART:${formatIcsDateTimeLocal(event.startDate, event.startTime)}`);
    const endDateTarget = event.endDate || event.startDate;
    const endTimeTarget = event.endTime || event.startTime;
    lines.push(`DTEND:${formatIcsDateTimeLocal(endDateTarget, endTimeTarget)}`);
  }

  lines.push(`SUMMARY:${escapeIcsText(event.title)}`);

  const descParts: string[] = [];
  if (event.description) descParts.push(event.description);
  if (event.clientName) descParts.push(`Client: ${event.clientName}`);
  if (event.taskTitle) descParts.push(`Linked Task: ${event.taskTitle}`);
  if (descParts.length > 0) {
    lines.push(`DESCRIPTION:${escapeIcsText(descParts.join("\n"))}`);
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  }

  lines.push(`CATEGORIES:${escapeIcsText(event.category.toUpperCase())}`);
  lines.push("STATUS:CONFIRMED");
  lines.push("END:VEVENT");

  return lines.join("\r\n");
}

export function buildIcsBlocksFromTask(
  task: TaskItem,
  options?: { includeTodo?: boolean }
): string {
  if (!task.dueDate) return "";
  const dueDateClean = normalizeAndAutoFixDate(task.dueDate);
  const dtStamp = formatUtcStamp(task.updatedAt || task.createdAt);
  const statusPrefix = task.status === "done" ? "[DONE] " : "[TASK] ";

  const descParts: string[] = [];
  if (task.description) descParts.push(task.description);
  descParts.push(`Status: ${task.status.toUpperCase()}`);
  descParts.push(`Priority: ${task.priority.toUpperCase()}`);
  descParts.push(`Category: ${task.category}`);
  if (task.clientName) descParts.push(`Client: ${task.clientName}`);
  if (task.invoiceCode) descParts.push(`Invoice: ${task.invoiceCode}`);

  const priorityNum =
    task.priority === "urgent"
      ? 1
      : task.priority === "high"
        ? 3
        : task.priority === "medium"
          ? 5
          : 9;

  const slot = getTaskTimeSlot(task.id);
  const effectiveStart = task.startTime ?? slot?.startTime ?? null;
  const effectiveEnd = task.endTime ?? slot?.endTime ?? null;
  const normalizedTimes = normalizeAndAutoFixTimeRange(
    effectiveStart,
    effectiveEnd,
    !effectiveStart
  );

  const dtStartLine = normalizedTimes.startTime
    ? `DTSTART:${formatIcsDateTimeLocal(dueDateClean, normalizedTimes.startTime)}`
    : `DTSTART;VALUE=DATE:${formatIcsDateOnly(dueDateClean)}`;
  const dtEndLine = normalizedTimes.startTime
    ? `DTEND:${formatIcsDateTimeLocal(dueDateClean, normalizedTimes.endTime || normalizedTimes.startTime)}`
    : `DTEND;VALUE=DATE:${addOneDayDateOnly(dueDateClean)}`;

  const veventLines: string[] = [
    "BEGIN:VEVENT",
    `UID:billflow-task-${task.id}@billflow.local`,
    `DTSTAMP:${dtStamp}`,
    dtStartLine,
    dtEndLine,
    `SUMMARY:${escapeIcsText(`${statusPrefix}${task.title}`)}`,
    `DESCRIPTION:${escapeIcsText(descParts.join("\n"))}`,
    `PRIORITY:${priorityNum}`,
    `CATEGORIES:TASK,${escapeIcsText(task.category.toUpperCase())}`,
    `STATUS:${task.status === "done" ? "CONFIRMED" : "TENTATIVE"}`,
    "END:VEVENT",
  ];

  if (options?.includeTodo === false) {
    return veventLines.join("\r\n");
  }

  const vtodoStatus =
    task.status === "done"
      ? "COMPLETED"
      : task.status === "in-progress" || task.status === "review"
        ? "IN-PROCESS"
        : "NEEDS-ACTION";

  const vtodoLines: string[] = [
    "BEGIN:VTODO",
    `UID:billflow-todo-${task.id}@billflow.local`,
    `DTSTAMP:${dtStamp}`,
    `DUE;VALUE=DATE:${formatIcsDateOnly(dueDateClean)}`,
    `SUMMARY:${escapeIcsText(task.title)}`,
    `DESCRIPTION:${escapeIcsText(descParts.join("\n"))}`,
    `PRIORITY:${priorityNum}`,
    `STATUS:${vtodoStatus}`,
    `CATEGORIES:${escapeIcsText(task.category)}`,
    "END:VTODO",
  ];

  return `${veventLines.join("\r\n")}\r\n${vtodoLines.join("\r\n")}`;
}

export function generateIcsFromEventsAndTasks(options: {
  events?: CalendarEventItem[];
  tasks?: TaskItem[];
  calendarName?: string;
}): string {
  const calName = options.calendarName || "BillFlow Tasks & Schedule";
  const blocks: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BillFlow Desktop//Local Calendar Sync Engine//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calName)}`,
  ];

  for (const evt of options.events || []) {
    if (!evt.startDate) continue;
    blocks.push(buildVEventFromCalendarEvent(evt));
  }

  for (const task of options.tasks || []) {
    if (!task.dueDate) continue;
    const block = buildIcsBlocksFromTask(task);
    if (block) blocks.push(block);
  }

  blocks.push("END:VCALENDAR");
  return blocks.join("\r\n");
}

function parseIcsDateTimeValue(rawVal: string): {
  dateStr: string;
  timeStr: string | null;
  isAllDay: boolean;
} {
  const clean = rawVal.trim();
  const match = clean.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
  if (!match) {
    return {
      dateStr: normalizeAndAutoFixDate(clean),
      timeStr: null,
      isAllDay: true,
    };
  }

  const [, y, m, d, hh, mm] = match;
  const dateStr = `${y}-${m}-${d}`;
  if (!hh || !mm) {
    return { dateStr, timeStr: null, isAllDay: true };
  }
  return {
    dateStr,
    timeStr: `${hh}:${mm}`,
    isAllDay: false,
  };
}

function inferEventCategory(rawCategories: string, title: string): EventCategory {
  const combined = `${rawCategories} ${title}`.toLowerCase();
  if (combined.includes("milestone") || combined.includes("launch") || combined.includes("release")) {
    return "milestone";
  }
  if (combined.includes("review") || combined.includes("demo") || combined.includes("audit")) {
    return "review";
  }
  if (combined.includes("deadline") || combined.includes("due") || combined.includes("delivery")) {
    return "deadline";
  }
  if (combined.includes("remind") || combined.includes("follow")) {
    return "reminder";
  }
  if (
    combined.includes("meet") ||
    combined.includes("call") ||
    combined.includes("sync") ||
    combined.includes("zoom") ||
    combined.includes("consult")
  ) {
    return "meeting";
  }
  return "general";
}

function inferEventColor(cat: EventCategory): EventColor {
  switch (cat) {
    case "meeting":
      return "blue";
    case "milestone":
      return "amber";
    case "review":
      return "purple";
    case "deadline":
      return "rose";
    case "reminder":
      return "cyan";
    default:
      return "emerald";
  }
}

function inferTaskPriority(priorityVal: string, title: string): TaskPriority {
  const num = parseInt(priorityVal, 10);
  if (num === 1 || num === 2 || /urgent|critical|asap/i.test(title)) return "urgent";
  if (num === 3 || num === 4 || /high|important/i.test(title)) return "high";
  if (num >= 6 && num <= 9) return "low";
  return "medium";
}

function inferTaskCategory(rawCategories: string, title: string): TaskCategory {
  const combined = `${rawCategories} ${title}`.toLowerCase();
  if (combined.includes("design") || combined.includes("ui") || combined.includes("ux") || combined.includes("figma")) {
    return "Design";
  }
  if (combined.includes("infra") || combined.includes("deploy") || combined.includes("server") || combined.includes("cloud")) {
    return "Infrastructure";
  }
  if (combined.includes("legal") || combined.includes("contract") || combined.includes("nda")) {
    return "Legal";
  }
  if (combined.includes("doc") || combined.includes("spec") || combined.includes("guide")) {
    return "Documentation";
  }
  return "Development";
}

export function parseIcsCalendar(icsContent: string): ParsedLocalCalendarItem[] {
  if (!icsContent || !icsContent.trim()) return [];

  const unfolded = icsContent.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);

  const items: ParsedLocalCalendarItem[] = [];
  let currentBlock: "VEVENT" | "VTODO" | null = null;
  let props: Record<string, string> = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.toUpperCase() === "BEGIN:VEVENT") {
      currentBlock = "VEVENT";
      props = {};
      continue;
    }
    if (line.toUpperCase() === "BEGIN:VTODO") {
      currentBlock = "VTODO";
      props = {};
      continue;
    }

    if (
      (line.toUpperCase() === "END:VEVENT" && currentBlock === "VEVENT") ||
      (line.toUpperCase() === "END:VTODO" && currentBlock === "VTODO")
    ) {
      const rawSummary = unescapeIcsText(props["SUMMARY"] || "").trim();
      if (rawSummary) {
        const uid =
          props["UID"] || `local-ics-${items.length + 1}-${Date.now()}`;

        const isTaskTaggedEvent =
          currentBlock === "VEVENT" &&
          (uid.startsWith("billflow-task-") ||
            rawSummary.startsWith("[TASK] ") ||
            rawSummary.startsWith("[DONE] ") ||
            (props["CATEGORIES"] || "").toUpperCase().includes("TASK"));

        const cleanTitle = rawSummary
          .replace(/^\[TASK\]\s*/i, "")
          .replace(/^\[DONE\]\s*/i, "")
          .trim();

        const rawStart =
          props["DTSTART"] || props["DUE"] || props["COMPLETED"] || "";
        const parsedStart = parseIcsDateTimeValue(rawStart);
        const rawEnd = props["DTEND"] || "";
        const parsedEnd = rawEnd ? parseIcsDateTimeValue(rawEnd) : null;

        const description = unescapeIcsText(props["DESCRIPTION"] || "").trim();
        const location = unescapeIcsText(props["LOCATION"] || "").trim() || null;
        const categories = unescapeIcsText(props["CATEGORIES"] || "");
        const eventCategory = inferEventCategory(categories, cleanTitle);
        const eventColor = inferEventColor(eventCategory);
        const taskPriority = inferTaskPriority(props["PRIORITY"] || "", cleanTitle);
        const taskCategory = inferTaskCategory(categories, cleanTitle);

        const rawStatus = (props["STATUS"] || "").toUpperCase();
        const status: TaskStatus =
          rawStatus === "COMPLETED" || rawSummary.startsWith("[DONE]")
            ? "done"
            : rawStatus === "IN-PROCESS"
              ? "in-progress"
              : "todo";

        items.push({
          uid,
          kind: currentBlock === "VTODO" || isTaskTaggedEvent ? "task" : "event",
          title: cleanTitle,
          description,
          startDate: parsedStart.dateStr,
          endDate: parsedEnd ? parsedEnd.dateStr : null,
          startTime: parsedStart.timeStr,
          endTime: parsedEnd ? parsedEnd.timeStr : null,
          isAllDay: parsedStart.isAllDay,
          category: eventCategory,
          color: eventColor,
          priority: taskPriority,
          taskCategory,
          location,
          status,
        });
      }
      currentBlock = null;
      props = {};
      continue;
    }

    if (currentBlock) {
      const colonIdx = line.indexOf(":");
      if (colonIdx !== -1) {
        const keyPart = line.slice(0, colonIdx).toUpperCase();
        const valPart = line.slice(colonIdx + 1);
        const baseKey = keyPart.split(";")[0];
        props[baseKey] = valPart;
      }
    }
  }

  const seenTaskIds = new Set<string>();
  return items.filter((item) => {
    const match = item.uid.match(/^billflow-(?:task|todo)-(.+)@billflow\.local$/);
    if (match) {
      const taskKey = match[1];
      if (seenTaskIds.has(taskKey)) return false;
      seenTaskIds.add(taskKey);
    }
    return true;
  });
}

export function downloadIcsFile(filename: string, icsContent: string): void {
  if (typeof window === "undefined") return;
  const normalized = filename.toLowerCase().endsWith(".ics")
    ? filename
    : `${filename}.ics`;
  const blob = new Blob([icsContent], {
    type: "text/calendar;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", normalized);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function toNewCalendarEventInput(
  item: ParsedLocalCalendarItem
): NewCalendarEventInput {
  return {
    title: item.title,
    description: item.description,
    startDate: item.startDate,
    endDate: item.endDate,
    startTime: item.isAllDay ? null : item.startTime,
    endTime: item.isAllDay ? null : item.endTime,
    isAllDay: item.isAllDay,
    category: item.category,
    color: item.color,
    location: item.location,
  };
}
