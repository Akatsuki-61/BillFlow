import { describe, expect, it } from "vitest";
import type { TaskItem } from "@/types/tasks";
import type { CalendarEventItem } from "@/types/calendar";
import {
  generateIcsFromEventsAndTasks,
  parseIcsCalendar,
  toNewCalendarEventInput,
  autoFixAndLinkCalendarData,
  normalizeAndAutoFixDate,
  normalizeAndAutoFixTimeRange,
  saveTaskTimeSlot,
  getTaskTimeSlot,
} from "../local-calendar";

describe("Calendar Date & Item Mapping", () => {
  it("organizes sprint tasks and user local events by normalized date string", () => {
    const tasks: TaskItem[] = [
      {
        id: "task-1",
        title: "Build Landing Page",
        description: "",
        status: "todo",
        priority: "high",
        category: "Development",
        assignee: { name: "Chethaka", avatarLetter: "C", bgColor: "bg-surface-purple-100", textColor: "text-content-purple-700" },
        dueDate: "2026-10-15",
        subtasks: [],
        createdAt: "2026-10-01",
      },
      {
        id: "task-2",
        title: "Setup Analytics",
        description: "",
        status: "in-progress",
        priority: "medium",
        category: "Infrastructure",
        assignee: { name: "Chethaka", avatarLetter: "C", bgColor: "bg-surface-purple-100", textColor: "text-content-purple-700" },
        dueDate: "2026-10-15T18:00:00.000Z",
        subtasks: [],
        createdAt: "2026-10-01",
      },
      {
        id: "task-3",
        title: "No Due Date Task",
        description: "",
        status: "todo",
        priority: "low",
        category: "Documentation",
        assignee: { name: "Chethaka", avatarLetter: "C", bgColor: "bg-surface-purple-100", textColor: "text-content-purple-700" },
        dueDate: "",
        subtasks: [],
        createdAt: "2026-10-01",
      },
    ];

    const events: CalendarEventItem[] = [
      {
        id: "evt-1",
        title: "Kickoff Call with Client",
        description: "",
        startDate: "2026-10-15",
        startTime: "10:00",
        endTime: "11:00",
        isAllDay: false,
        category: "meeting",
        color: "blue",
        createdAt: "2026-10-01",
        updatedAt: "2026-10-01",
      },
      {
        id: "evt-2",
        title: "Mid-Sprint Milestone",
        description: "",
        startDate: "2026-10-20",
        isAllDay: true,
        category: "milestone",
        color: "amber",
        createdAt: "2026-10-01",
        updatedAt: "2026-10-01",
      },
    ];

    // Group tasks by date
    const tasksByDate = new Map<string, TaskItem[]>();
    tasks.forEach((t) => {
      if (!t.dueDate) return;
      const normalized = t.dueDate.split("T")[0];
      const list = tasksByDate.get(normalized) || [];
      list.push(t);
      tasksByDate.set(normalized, list);
    });

    // Group events by date
    const eventsByDate = new Map<string, CalendarEventItem[]>();
    events.forEach((e) => {
      if (!e.startDate) return;
      const normalized = e.startDate.split("T")[0];
      const list = eventsByDate.get(normalized) || [];
      list.push(e);
      eventsByDate.set(normalized, list);
    });

    // 2026-10-15 should have 2 tasks and 1 event
    const oct15Tasks = tasksByDate.get("2026-10-15") || [];
    const oct15Events = eventsByDate.get("2026-10-15") || [];

    expect(oct15Tasks.length).toBe(2);
    expect(oct15Tasks.map((t) => t.id)).toEqual(["task-1", "task-2"]);
    expect(oct15Events.length).toBe(1);
    expect(oct15Events[0].title).toBe("Kickoff Call with Client");

    // Tasks without due date should not be assigned to calendar days
    expect(tasksByDate.has("")).toBe(false);

    // 2026-10-20 should have 1 event and 0 tasks
    expect(eventsByDate.get("2026-10-20")?.length).toBe(1);
    expect(tasksByDate.get("2026-10-20")).toBeUndefined();
  });

  it("exports tasks and events to RFC 5545 .ics and parses local calendar .ics files back into tasks and events", () => {
    const sampleTasks: TaskItem[] = [
      {
        id: "task-101",
        title: "Business Website Development",
        description: "Responsive landing page and CMS",
        status: "in-progress",
        priority: "urgent",
        category: "Development",
        assignee: {
          name: "Chethaka",
          avatarLetter: "C",
          bgColor: "bg-surface-purple-100",
          textColor: "text-content-purple-700",
        },
        dueDate: "2026-11-15",
        clientName: "Acme Lanka",
        subtasks: [],
        createdAt: "2026-11-01T00:00:00Z",
      },
    ];

    const sampleEvents: CalendarEventItem[] = [
      {
        id: "evt-202",
        title: "AI Consulting Strategy Session",
        description: "Customer support automation roadmap",
        startDate: "2026-11-12",
        endDate: "2026-11-12",
        startTime: "14:30",
        endTime: "15:30",
        isAllDay: false,
        category: "meeting",
        color: "blue",
        location: "https://meet.google.com/xyz-abcd",
        createdAt: "2026-11-01T00:00:00Z",
        updatedAt: "2026-11-01T00:00:00Z",
      },
    ];

    const ics = generateIcsFromEventsAndTasks({
      tasks: sampleTasks,
      events: sampleEvents,
      calendarName: "Chethaka Freelance Schedule",
    });

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("BEGIN:VTODO");
    expect(ics).toContain("AI Consulting Strategy Session");
    expect(ics).toContain("Business Website Development");

    const parsed = parseIcsCalendar(ics);
    // Deduplicates matching VEVENT + VTODO for the same BillFlow task into 1 task + 1 event = 2 items
    expect(parsed.length).toBe(2);

    const parsedEvent = parsed.find((i) => i.kind === "event")!;
    expect(parsedEvent.title).toBe("AI Consulting Strategy Session");
    expect(parsedEvent.startDate).toBe("2026-11-12");
    expect(parsedEvent.startTime).toBe("14:30");
    expect(parsedEvent.endTime).toBe("15:30");
    expect(parsedEvent.isAllDay).toBe(false);
    expect(parsedEvent.category).toBe("meeting");

    const eventInput = toNewCalendarEventInput(parsedEvent);
    expect(eventInput.title).toBe("AI Consulting Strategy Session");
    expect(eventInput.location).toBe("https://meet.google.com/xyz-abcd");

    const parsedTask = parsed.find((i) => i.kind === "task")!;
    expect(parsedTask.title).toBe("Business Website Development");
    expect(parsedTask.startDate).toBe("2026-11-15");
    expect(parsedTask.priority).toBe("urgent");
  });

  it("silently auto-fixes malformed dates, inverted time ranges, and broken task/client links", () => {
    expect(normalizeAndAutoFixDate("2026/11/5")).toBe("2026-11-05");
    expect(normalizeAndAutoFixDate("20261109")).toBe("2026-11-09");

    const fixedTimes = normalizeAndAutoFixTimeRange("14:30", "13:00", false);
    expect(fixedTimes.startTime).toBe("14:30");
    expect(fixedTimes.endTime).toBe("15:30"); // Auto-healed +60m

    const rawTasks: TaskItem[] = [
      {
        id: "t-auto-1",
        title: "AI Automation Deliverable",
        description: "",
        status: "todo",
        priority: "high",
        category: "Development",
        assignee: {
          name: "Chethaka",
          avatarLetter: "C",
          bgColor: "bg-surface-purple-100",
          textColor: "text-content-purple-700",
        },
        dueDate: "2026/11/20",
        clientId: "c-1",
        subtasks: [],
        createdAt: "2026-11-01",
      },
    ];

    const rawEvents: CalendarEventItem[] = [
      {
        id: "e-auto-1",
        title: "AI Automation Deliverable",
        description: "",
        startDate: "2026/11/20",
        endDate: "2026-11-10", // Inverted end date (< startDate)
        startTime: "9:5",
        endTime: "8:00", // Inverted end time
        isAllDay: false,
        category: "review",
        color: "purple",
        createdAt: "2026-11-01",
        updatedAt: "2026-11-01",
      },
    ];

    const healed = autoFixAndLinkCalendarData({
      tasks: rawTasks,
      events: rawEvents,
      clients: [{ id: "c-1", name: "Lanka Tech Corp" }],
    });

    expect(healed.repairedCount).toBeGreaterThan(0);
    expect(healed.tasks[0].dueDate).toBe("2026-11-20");
    expect(healed.tasks[0].clientName).toBe("Lanka Tech Corp");

    expect(healed.events[0].startDate).toBe("2026-11-20");
    expect(healed.events[0].endDate).toBe("2026-11-20");
    expect(healed.events[0].startTime).toBe("09:05");
    expect(healed.events[0].endTime).toBe("10:05");
    expect(healed.events[0].taskId).toBe("t-auto-1");
    expect(healed.events[0].clientId).toBe("c-1");
    expect(healed.events[0].clientName).toBe("Lanka Tech Corp");

    // Task time slot persistence & auto-enrichment
    saveTaskTimeSlot("t-auto-1", { startTime: "10:00", endTime: "09:30" }); // Inverted time auto-fixed to 11:00
    const slot = getTaskTimeSlot("t-auto-1");
    expect(slot?.startTime).toBe("10:00");
    expect(slot?.endTime).toBe("11:00");
  });
});
