import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { initDatabase, closeDatabaseForTesting, getDb } from "../db";
import {
  listCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvent,
} from "../ipc/calendar";
import { tasks, clients } from "../db/schema";
import { exportWorkspace, importWorkspace, resetWorkspace } from "../backup";
import { createProfile, listProfilesState, switchProfile } from "../ipc/profiles";

let directory: string;
let databasePath: string;

beforeEach(() => {
  closeDatabaseForTesting();
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "billflow-calendar-test-"));
  databasePath = path.join(directory, "billflow.db");
  initDatabase(databasePath);
});

afterEach(() => {
  vi.restoreAllMocks();
  closeDatabaseForTesting();
  fs.rmSync(directory, { recursive: true, force: true });
});

function restart() {
  closeDatabaseForTesting();
  initDatabase(databasePath);
}

describe("Calendar Events SQLite Persistence & Integration", () => {
  it("backs up, resets, and restores calendar links while accepting older backups", () => {
    getDb().insert(clients).values({
      id: "calendar-client", name: "Website client", contactPerson: "Client", email: "client@example.com",
    }).run();
    const event = createCalendarEvent({
      title: "Website handover", startDate: "2026-11-10", clientId: "calendar-client",
    });
    const backup = exportWorkspace();
    expect(backup.records?.calendar_events).toHaveLength(1);
    resetWorkspace();
    expect(listCalendarEvents()).toEqual([]);
    importWorkspace(backup);
    restart();
    expect(getCalendarEvent(event.id).clientId).toBe("calendar-client");

    const legacyBackup = exportWorkspace();
    delete legacyBackup.records!.calendar_events;
    importWorkspace(legacyBackup);
    expect(listCalendarEvents()).toEqual([]);
  });

  it("isolates calendar data between profiles and preserves the active profile on restart", () => {
    const state = createProfile({ name: "AI consulting", role: "consulting", seedRoleCatalog: false });
    const profile = state.profiles.find(p => p.id !== "default")!;
    const primaryEvent = createCalendarEvent({ title: "Website review", startDate: "2026-11-10" });
    switchProfile(profile.id);
    expect(listCalendarEvents()).toEqual([]);
    const consultingEvent = createCalendarEvent({ title: "AI session", startDate: "2026-11-11" });
    restart();
    expect(listProfilesState().activeProfileId).toBe(profile.id);
    expect(listCalendarEvents().map(e => e.id)).toEqual([consultingEvent.id]);
    switchProfile("default");
    expect(listCalendarEvents().map(e => e.id)).toEqual([primaryEvent.id]);
  });

  it("creates, retrieves, and lists calendar events with restart persistence", () => {
    const event = createCalendarEvent({
      title: "Client Kickoff Meeting",
      description: "Initial discovery session for website project",
      startDate: "2026-10-15",
      endDate: "2026-10-15",
      startTime: "10:00",
      endTime: "11:00",
      isAllDay: false,
      category: "meeting",
      color: "blue",
      location: "https://meet.google.com/abc-defg-hij",
    });

    expect(event.id).toBeTruthy();
    expect(event.title).toBe("Client Kickoff Meeting");
    expect(event.category).toBe("meeting");
    expect(event.startDate).toBe("2026-10-15");
    expect(event.isAllDay).toBe(false);

    const fetched = getCalendarEvent(event.id);
    expect(fetched.id).toBe(event.id);
    expect(fetched.description).toBe("Initial discovery session for website project");

    // Test persistence across restart
    restart();

    const all = listCalendarEvents();
    expect(all.length).toBe(1);
    expect(all[0].id).toBe(event.id);
    expect(all[0].title).toBe("Client Kickoff Meeting");
  });

  it("filters calendar events by date range and category", () => {
    createCalendarEvent({
      title: "Design Review",
      startDate: "2026-10-10",
      category: "review",
      color: "purple",
    });

    createCalendarEvent({
      title: "Sprint Deadline",
      startDate: "2026-10-20",
      category: "deadline",
      color: "rose",
    });

    createCalendarEvent({
      title: "Team Sync",
      startDate: "2026-10-25",
      category: "meeting",
      color: "blue",
    });

    const reviews = listCalendarEvents({ category: "review" });
    expect(reviews.length).toBe(1);
    expect(reviews[0].title).toBe("Design Review");

    const midMonth = listCalendarEvents({
      startDate: "2026-10-15",
      endDate: "2026-10-22",
    });
    expect(midMonth.length).toBe(1);
    expect(midMonth[0].title).toBe("Sprint Deadline");
  });

  it("updates and deletes calendar events", () => {
    const created = createCalendarEvent({
      title: "Consulting Session",
      startDate: "2026-10-18",
      category: "meeting",
      color: "amber",
    });

    const updated = updateCalendarEvent(created.id, {
      title: "AI Consulting Strategy Session",
      color: "emerald",
      isAllDay: true,
    });

    expect(updated.title).toBe("AI Consulting Strategy Session");
    expect(updated.color).toBe("emerald");
    expect(updated.isAllDay).toBe(true);

    const removeResult = deleteCalendarEvent(created.id);
    expect(removeResult.success).toBe(true);

    const remaining = listCalendarEvents();
    expect(remaining.length).toBe(0);
  });

  it("supports linking calendar events with tasks and clients", () => {
    const db = getDb();
    const now = new Date().toISOString();

    // Create a client
    db.insert(clients)
      .values({
        id: "cli-101",
        name: "Acme Corp",
        contactPerson: "Alice Smith",
        email: "contact@acme.com",
        phone: "+123456789",
        currency: "USD",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // Create a task
    db.insert(tasks)
      .values({
        id: "tsk-202",
        title: "Website Development",
        description: "Build company landing page",
        status: "todo",
        priority: "high",
        category: "Development",
        assignee: {
          name: "Chethaka",
          avatarLetter: "C",
          bgColor: "bg-surface-purple-100",
          textColor: "text-content-purple-700",
        },
        dueDate: "2026-10-30",
        clientId: "cli-101",
        clientName: "Acme Corp",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // Create event linked to task and client
    const event = createCalendarEvent({
      title: "Milestone Demo Call",
      startDate: "2026-10-30",
      category: "milestone",
      clientId: "cli-101",
      taskId: "tsk-202",
    });

    expect(event.clientId).toBe("cli-101");
    expect(event.clientName).toBe("Acme Corp");
    expect(event.taskId).toBe("tsk-202");
    expect(event.taskTitle).toBe("Website Development");
  });
});
