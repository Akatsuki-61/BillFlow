import type { CalendarEventItem, EventCategory, EventColor, NewCalendarEventInput } from "@/types/calendar";
import type { TaskItem, TaskPriority, TaskCategory } from "@/types/tasks";

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
  status?: "todo" | "in-progress" | "review" | "done";
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
  const clean = dateStr.split("T")[0].replace(/-/g, "");
  return clean.length === 8 ? clean : new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function addOneDayDateOnly(dateStr: string): string {
  const parts = dateStr.split("T")[0].split("-").map(Number);
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

/**
 * Generates an RFC 5545 VEVENT block for a BillFlow CalendarEventItem
 */
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

/**
 * Generates both a VEVENT (for local calendar day grid visibility) and a VTODO (for local calendar reminders/tasks)
 * from a BillFlow TaskItem.
 */
export function buildIcsBlocksFromTask(
  task: TaskItem,
  options?: { includeTodo?: boolean }
): string {
  if (!task.dueDate) return "";
  const dueDateClean = task.dueDate.split("T")[0];
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

  const veventLines: string[] = [
    "BEGIN:VEVENT",
    `UID:billflow-task-${task.id}@billflow.local`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;VALUE=DATE:${formatIcsDateOnly(dueDateClean)}`,
    `DTEND;VALUE=DATE:${addOneDayDateOnly(dueDateClean)}`,
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

/**
 * Generates a complete RFC 5545 iCalendar (.ics) file string containing BillFlow events and tasks
 * so the user can open/import/subscribe to it in Apple Calendar, Outlook, or Google Calendar.
 */
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
  // Match YYYYMMDD or YYYYMMDDTHHMMSS(Z)
  const match = clean.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
  if (!match) {
    const fallback = clean.split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(fallback)) {
      return { dateStr: fallback, timeStr: null, isAllDay: true };
    }
    return {
      dateStr: new Date().toISOString().slice(0, 10),
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

/**
 * Parses an RFC 5545 .ics calendar file from the user's local calendar (Apple Calendar, Outlook, Google Calendar)
 * into structured items that can be imported as Tasks or Calendar Events in BillFlow.
 */
export function parseIcsCalendar(icsContent: string): ParsedLocalCalendarItem[] {
  if (!icsContent || !icsContent.trim()) return [];

  // Unfold RFC 5545 folded lines (CRLF + space/tab)
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

        // Avoid importing duplicate VEVENT if a matching VTODO from BillFlow is also in the same file
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
        const status: "todo" | "in-progress" | "review" | "done" =
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

  // Deduplicate if both billflow-task-<id> and billflow-todo-<id> were in the same exported .ics file
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

/**
 * Triggers download/open of an .ics calendar file so the OS opens it in the user's Local Calendar app.
 */
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

/**
 * Converts a ParsedLocalCalendarItem into a NewCalendarEventInput payload
 */
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
