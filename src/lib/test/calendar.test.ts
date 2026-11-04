import { describe, expect, it } from "vitest";
import type { TaskItem } from "@/types/tasks";
import type { CalendarEventItem } from "@/types/calendar";

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
});
