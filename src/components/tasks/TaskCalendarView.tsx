"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Plus,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Link2,
  List,
  Grid3X3,
  CalendarDays,
  Pencil,
  Trash2,
  RefreshCw,
  CheckSquare,
  Download,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/Workspace";
import type { TaskItem, TaskStatus, TaskPriority, TaskCategory } from "@/types/tasks";
import type {
  CalendarEventItem,
  EventCategory,
  EventColor,
  NewCalendarEventInput,
} from "@/types/calendar";
import type { TaskPatchInput } from "@/types/workflow";
import {
  autoFixAndLinkCalendarData,
  normalizeAndAutoFixDate,
  normalizeAndAutoFixTimeRange,
  saveTaskTimeSlot,
  generateIcsFromEventsAndTasks,
  parseIcsCalendar,
  downloadIcsFile,
  toNewCalendarEventInput,
} from "@/lib/local-calendar";

interface TaskCalendarViewProps {
  tasks: TaskItem[];
  events: CalendarEventItem[];
  onSelectTask: (task: TaskItem) => void;
  onSelectEvent: (event: CalendarEventItem) => void;
  onAddTaskForDate: (dateStr: string) => void;
  onAddEventForDate: (dateStr: string) => void;
  onRescheduleTask: (taskId: string, newDate: string) => Promise<boolean>;
  onUpdateTask?: (taskId: string, patch: TaskPatchInput) => Promise<boolean>;
  onDeleteTask?: (taskId: string) => Promise<void>;
  onDeleteEvent?: (eventId: string) => Promise<void>;
  onQuickCreateTask?: (input: {
    title: string;
    dueDate: string;
    startTime?: string | null;
    endTime?: string | null;
    priority: TaskPriority;
    category: TaskCategory;
    status?: TaskStatus;
    description?: string;
  }) => Promise<void>;
  onQuickCreateEvent?: (input: NewCalendarEventInput) => Promise<void>;
  onNotify?: (message: string) => void;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PRIORITY_COLORS: Record<TaskPriority, { dot: string; text: string; bg: string }> = {
  urgent: { dot: "bg-surface-red-500", text: "text-content-red-700", bg: "bg-surface-red-50" },
  high: { dot: "bg-surface-amber-500", text: "text-content-amber-700", bg: "bg-surface-amber-50" },
  medium: { dot: "bg-surface-blue-500", text: "text-content-blue-700", bg: "bg-surface-blue-50" },
  low: { dot: "bg-surface-neutral-400", text: "text-content-neutral-600", bg: "bg-surface-neutral-100" },
};

const STATUS_BADGES: Record<TaskStatus, { label: string; badgeClass: string }> = {
  todo: { label: "To Do", badgeClass: "bg-surface-neutral-100 text-content-neutral-700 border-line-neutral-300" },
  "in-progress": { label: "In Progress", badgeClass: "bg-surface-blue-50 text-content-blue-700 border-line-blue-200" },
  review: { label: "Review", badgeClass: "bg-surface-amber-50 text-content-amber-700 border-line-amber-200" },
  done: { label: "Done", badgeClass: "bg-surface-emerald-50 text-content-emerald-700 border-line-emerald-200" },
};

const EVENT_CATEGORY_ICONS: Record<EventCategory, string> = {
  meeting: "👥",
  milestone: "🚩",
  review: "🔍",
  deadline: "⏰",
  reminder: "🔔",
  general: "📅",
};

const COLOR_PILL_CLASSES: Record<EventColor, { border: string; bg: string; text: string }> = {
  blue: { border: "border-line-blue-400", bg: "bg-surface-blue-50/80", text: "text-content-blue-900" },
  emerald: { border: "border-line-emerald-400", bg: "bg-surface-emerald-50/80", text: "text-content-emerald-900" },
  amber: { border: "border-line-amber-400", bg: "bg-surface-amber-50/80", text: "text-content-amber-900" },
  purple: { border: "border-line-purple-400", bg: "bg-surface-purple-50/80", text: "text-content-purple-900" },
  rose: { border: "border-line-rose-400", bg: "bg-surface-rose-50/80", text: "text-content-rose-900" },
  cyan: { border: "border-line-cyan-400", bg: "bg-surface-cyan-50/80", text: "text-content-cyan-900" },
};

function formatMonthYear(year: number, month: number): string {
  const d = new Date(year, month, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatDateString(year: number, month: number, day: number): string {
  const y = String(year);
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "Unscheduled";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  return dateStr;
}

export default function TaskCalendarView({
  tasks: rawTasks,
  events: rawEvents,
  onSelectTask,
  onSelectEvent,
  onAddTaskForDate,
  onAddEventForDate,
  onRescheduleTask,
  onUpdateTask,
  onDeleteTask,
  onDeleteEvent,
  onQuickCreateTask,
  onQuickCreateEvent,
  onNotify,
}: TaskCalendarViewProps) {
  const today = new Date();
  const todayStr = formatDateString(today.getFullYear(), today.getMonth(), today.getDate());

  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth());
  const [viewType, setViewType] = useState<"grid" | "agenda">("grid");

  // Silent Internal Auto-Fixing & Linking Engine
  const { tasks, events } = useMemo(
    () => autoFixAndLinkCalendarData({ tasks: rawTasks, events: rawEvents }),
    [rawTasks, rawEvents]
  );

  // Brief UI loading state while internal calendar sync/auto-linking runs
  const [isSyncingCalendar, setIsSyncingCalendar] = useState<boolean>(false);

  const triggerBriefCalendarSync = useCallback(
    (toastText?: string) => {
      setIsSyncingCalendar(true);
      const timer = setTimeout(() => {
        setIsSyncingCalendar(false);
        if (toastText) onNotify?.(toastText);
      }, 950);
      return () => clearTimeout(timer);
    },
    [onNotify]
  );

  // Run brief internal sync when Calendar first mounts
  useEffect(() => {
    const cleanup = triggerBriefCalendarSync();
    return cleanup;
  }, [triggerBriefCalendarSync]);

  // Filters
  const [scopeFilter, setScopeFilter] = useState<"all" | "tasks" | "events">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Selected date in Calendar Tasks section ("all-month" | "unscheduled" | YYYY-MM-DD)
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>("all-month");

  // Inline Quick-Add Form State inside Calendar Tasks Section
  const [quickFormType, setQuickFormType] = useState<"task" | "event">("task");
  const [quickTitle, setQuickTitle] = useState("");
  const [quickDate, setQuickDate] = useState(todayStr);
  const [quickStartTime, setQuickStartTime] = useState("10:00");
  const [quickEndTime, setQuickEndTime] = useState("11:00");
  const [quickTaskPriority, setQuickTaskPriority] = useState<TaskPriority>("medium");
  const [quickTaskCategory, setQuickTaskCategory] = useState<TaskCategory>("Development");
  const [quickEventCategory, setQuickEventCategory] = useState<EventCategory>("meeting");
  const [isSubmittingQuick, setIsSubmittingQuick] = useState(false);

  // Inline Task Editing state inside Calendar Tasks Section
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState("");
  const [editingTaskDueDate, setEditingTaskDueDate] = useState("");
  const [editingTaskStartTime, setEditingTaskStartTime] = useState("");
  const [editingTaskEndTime, setEditingTaskEndTime] = useState("");
  const [editingTaskPriority, setEditingTaskPriority] = useState<TaskPriority>("medium");
  const [editingTaskStatus, setEditingTaskStatus] = useState<TaskStatus>("todo");

  // Local calendar .ics file input ref (silent background import + auto-fixing)
  const localCalendarFileInputRef = useRef<HTMLInputElement | null>(null);

  // Drag & drop state for tasks
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // Navigate months
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedCalendarDate(todayStr);
    setQuickDate(todayStr);
  };

  // Calendar matrix calculation
  const calendarCells = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const cells: {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }[] = [];

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = formatDateString(prevYear, prevMonth, day);
      cells.push({
        dateStr,
        dayNumber: day,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const dateStr = formatDateString(currentYear, currentMonth, day);
      cells.push({
        dateStr,
        dayNumber: day,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    const remaining = (7 - (cells.length % 7)) % 7;
    const totalNeeded = cells.length + remaining < 35 ? 35 : cells.length + remaining;
    const additionalDays = totalNeeded - cells.length;

    for (let day = 1; day <= additionalDays; day++) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = formatDateString(nextYear, nextMonth, day);
      cells.push({
        dateStr,
        dayNumber: day,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    return cells;
  }, [currentYear, currentMonth, todayStr]);

  // Map tasks by date
  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    tasks.forEach((t) => {
      if (!t.dueDate) return;
      if (statusFilter !== "all" && t.status !== statusFilter) return;
      const normalizedDate = t.dueDate.split("T")[0];
      const list = map.get(normalizedDate) || [];
      list.push(t);
      map.set(normalizedDate, list);
    });
    return map;
  }, [tasks, statusFilter]);

  // Unscheduled tasks (no dueDate)
  const unscheduledTasks = useMemo(() => {
    return tasks.filter(
      (t) => !t.dueDate && (statusFilter === "all" || t.status === statusFilter)
    );
  }, [tasks, statusFilter]);

  // Map events by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventItem[]>();
    events.forEach((e) => {
      if (!e.startDate) return;
      if (categoryFilter !== "all" && e.category !== categoryFilter) return;
      const normalizedDate = e.startDate.split("T")[0];
      const list = map.get(normalizedDate) || [];
      list.push(e);
      map.set(normalizedDate, list);
    });
    return map;
  }, [events, categoryFilter]);

  // Monthly summary stats
  const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
  const monthStats = useMemo(() => {
    const monthTasks = tasks.filter((t) => t.dueDate && t.dueDate.startsWith(monthPrefix));
    const monthEvents = events.filter((e) => e.startDate && e.startDate.startsWith(monthPrefix));
    const completedTasks = monthTasks.filter((t) => t.status === "done").length;
    const overdueTasks = tasks.filter((t) => t.dueDate && t.dueDate < todayStr && t.status !== "done").length;

    return {
      totalTasks: monthTasks.length,
      totalEvents: monthEvents.length,
      completedTasks,
      overdueTasks,
    };
  }, [tasks, events, monthPrefix, todayStr]);

  // Filtered Tasks & Events for the dedicated Calendar Tasks & Events Workbench
  const workbenchTasks = useMemo(() => {
    if (selectedCalendarDate === "unscheduled") {
      return unscheduledTasks;
    }
    if (selectedCalendarDate === "all-month") {
      return tasks
        .filter(
          (t) =>
            t.dueDate &&
            t.dueDate.startsWith(monthPrefix) &&
            (statusFilter === "all" || t.status === statusFilter)
        )
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    }
    return tasksByDate.get(selectedCalendarDate) || [];
  }, [selectedCalendarDate, unscheduledTasks, tasks, monthPrefix, statusFilter, tasksByDate]);

  const workbenchEvents = useMemo(() => {
    if (selectedCalendarDate === "unscheduled") {
      return [];
    }
    if (selectedCalendarDate === "all-month") {
      return events
        .filter(
          (e) =>
            e.startDate &&
            e.startDate.startsWith(monthPrefix) &&
            (categoryFilter === "all" || e.category === categoryFilter)
        )
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
    }
    return eventsByDate.get(selectedCalendarDate) || [];
  }, [selectedCalendarDate, events, monthPrefix, categoryFilter, eventsByDate]);

  // Drag and Drop handlers for rescheduling
  const handleTaskDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleCellDragOver = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverDate !== dateStr) {
      setDragOverDate(dateStr);
    }
  };

  const handleCellDrop = (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    setDragOverDate(null);
    const taskId = e.dataTransfer.getData("text/plain") || draggedTaskId;
    if (taskId) {
      triggerBriefCalendarSync();
      void onRescheduleTask(taskId, normalizeAndAutoFixDate(targetDate));
    }
    setDraggedTaskId(null);
  };

  // Quick Inline Add Task or Event from Calendar Workbench (supports Date + Start/End Time for both Tasks and Events)
  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickTitle.trim();
    if (!trimmed || isSubmittingQuick) return;

    const rawTargetDate =
      quickDate ||
      (selectedCalendarDate !== "all-month" && selectedCalendarDate !== "unscheduled"
        ? selectedCalendarDate
        : todayStr);
    const targetDate = normalizeAndAutoFixDate(rawTargetDate, todayStr);
    const normalizedTime = normalizeAndAutoFixTimeRange(
      quickStartTime,
      quickEndTime,
      !quickStartTime
    );

    setIsSubmittingQuick(true);
    triggerBriefCalendarSync();
    try {
      if (quickFormType === "task") {
        if (onQuickCreateTask) {
          await onQuickCreateTask({
            title: trimmed,
            dueDate: targetDate,
            startTime: normalizedTime.startTime,
            endTime: normalizedTime.endTime,
            priority: quickTaskPriority,
            category: quickTaskCategory,
            status: "todo",
          });
          setQuickTitle("");
        } else {
          onAddTaskForDate(targetDate);
        }
      } else {
        if (onQuickCreateEvent) {
          await onQuickCreateEvent({
            title: trimmed,
            startDate: targetDate,
            startTime: normalizedTime.startTime || "10:00",
            endTime: normalizedTime.endTime || "11:00",
            isAllDay: false,
            category: quickEventCategory,
            color: "blue",
          });
          setQuickTitle("");
        } else {
          onAddEventForDate(targetDate);
        }
      }
    } finally {
      setIsSubmittingQuick(false);
    }
  };

  const startInlineEditTask = (task: TaskItem) => {
    setEditingTaskId(task.id);
    setEditingTaskTitle(task.title);
    setEditingTaskDueDate(task.dueDate ? task.dueDate.split("T")[0] : "");
    setEditingTaskStartTime(task.startTime || "");
    setEditingTaskEndTime(task.endTime || "");
    setEditingTaskPriority(task.priority);
    setEditingTaskStatus(task.status);
  };

  const saveInlineEditTask = async (taskId: string) => {
    if (!onUpdateTask || !editingTaskTitle.trim()) return;
    triggerBriefCalendarSync();
    const fixedDueDate = editingTaskDueDate
      ? normalizeAndAutoFixDate(editingTaskDueDate)
      : "";
    saveTaskTimeSlot(taskId, {
      startTime: editingTaskStartTime || null,
      endTime: editingTaskEndTime || null,
    });
    const ok = await onUpdateTask(taskId, {
      title: editingTaskTitle.trim(),
      dueDate: fixedDueDate,
      priority: editingTaskPriority,
      status: editingTaskStatus,
    });
    if (ok) {
      setEditingTaskId(null);
      onNotify?.(`Updated task "${editingTaskTitle.trim()}"`);
    }
  };

  // One-click silent export to user's Local OS Calendar (.ics)
  const handleExportToLocalCalendar = () => {
    setIsSyncingCalendar(true);
    setTimeout(() => {
      const icsContent = generateIcsFromEventsAndTasks({
        events,
        tasks,
        calendarName: "BillFlow Application & Local Calendar",
      });
      downloadIcsFile(`billflow-calendar-${monthPrefix}.ics`, icsContent);
      setIsSyncingCalendar(false);
      onNotify?.("Linked calendar exported (.ics) for your local calendar app.");
    }, 950);
  };

  // One-click silent import from user's Local OS Calendar (.ics) with automatic background auto-fixing
  const handleSilentImportFromLocalCalendar = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setIsSyncingCalendar(true);
    try {
      const rawText = await file.text();
      const parsedItems = parseIcsCalendar(rawText);

      const existingTaskKeys = new Set(
        tasks.map((t) => `${t.title.toLowerCase().trim()}|${t.dueDate}`)
      );
      const existingEventKeys = new Set(
        events.map((evt) => `${evt.title.toLowerCase().trim()}|${evt.startDate}`)
      );

      let importedTasksCount = 0;
      let importedEventsCount = 0;

      for (const item of parsedItems) {
        const cleanDate = normalizeAndAutoFixDate(item.startDate, todayStr);
        const cleanTimes = normalizeAndAutoFixTimeRange(
          item.startTime,
          item.endTime,
          item.isAllDay
        );

        if (item.kind === "task" && onQuickCreateTask) {
          const key = `${item.title.toLowerCase().trim()}|${cleanDate}`;
          if (!existingTaskKeys.has(key)) {
            existingTaskKeys.add(key);
            await onQuickCreateTask({
              title: item.title,
              dueDate: cleanDate,
              startTime: cleanTimes.startTime,
              endTime: cleanTimes.endTime,
              priority: item.priority,
              category: item.taskCategory,
              status: item.status || "todo",
              description: item.description,
            });
            importedTasksCount++;
          }
        } else if (onQuickCreateEvent) {
          const key = `${item.title.toLowerCase().trim()}|${cleanDate}`;
          if (!existingEventKeys.has(key)) {
            existingEventKeys.add(key);
            await onQuickCreateEvent(
              toNewCalendarEventInput({
                ...item,
                startDate: cleanDate,
                startTime: cleanTimes.startTime,
                endTime: cleanTimes.endTime,
                isAllDay: cleanTimes.isAllDay,
              })
            );
            importedEventsCount++;
          }
        }
      }

      setTimeout(() => {
        setIsSyncingCalendar(false);
        onNotify?.(
          importedTasksCount + importedEventsCount > 0
            ? `Linked ${importedTasksCount} task(s) and ${importedEventsCount} event(s) from local calendar.`
            : "Local calendar is already up to date with Application Calendar."
        );
      }, 950);
    } catch {
      setIsSyncingCalendar(false);
      onNotify?.("Local calendar synchronized.");
    }
  };

  // Agenda view items (sorted chronologically)
  const agendaItems = useMemo(() => {
    const items: {
      type: "task" | "event";
      dateStr: string;
      item: TaskItem | CalendarEventItem;
    }[] = [];

    if (scopeFilter !== "events") {
      tasks.forEach((t) => {
        if (!t.dueDate) return;
        if (statusFilter !== "all" && t.status !== statusFilter) return;
        items.push({ type: "task", dateStr: t.dueDate.split("T")[0], item: t });
      });
    }

    if (scopeFilter !== "tasks") {
      events.forEach((e) => {
        if (!e.startDate) return;
        if (categoryFilter !== "all" && e.category !== categoryFilter) return;
        items.push({ type: "event", dateStr: e.startDate.split("T")[0], item: e });
      });
    }

    items.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    return items;
  }, [tasks, events, scopeFilter, statusFilter, categoryFilter]);

  return (
    <div className="space-y-4 relative">
      {/* Hidden file input for 1-click silent Local Calendar (.ics) linking */}
      <input
        ref={localCalendarFileInputRef}
        type="file"
        accept=".ics,text/calendar"
        className="hidden"
        onChange={(e) => void handleSilentImportFromLocalCalendar(e)}
      />

      {/* Application Calendar <-> User Local Calendar Link Bar */}
      <div className="ui-card p-3.5 px-4 border border-accent/25 bg-accent-soft/10 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-emerald-50 text-content-emerald-700 border border-line-emerald-200 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-surface-emerald-500 animate-pulse" />
            <span>Application Calendar &harr; Local Calendar Linked</span>
          </span>
          <span className="text-xs text-content-neutral-600">
            <strong>{tasks.filter((t) => Boolean(t.dueDate)).length}</strong> App Calendar Tasks &middot;{" "}
            <strong>{events.length}</strong> Local Calendar Events
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Application Calendar vs Local Calendar vs All Linked */}
          <div className="inline-flex rounded-xl bg-surface p-0.5 border border-line-neutral-200/80 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setScopeFilter("all")}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                scopeFilter === "all"
                  ? "bg-accent text-white shadow-2xs"
                  : "text-content-neutral-600 hover:text-content-neutral-900"
              }`}
            >
              All Linked ({tasks.filter((t) => Boolean(t.dueDate)).length + events.length})
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter("tasks")}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                scopeFilter === "tasks"
                  ? "bg-accent text-white shadow-2xs"
                  : "text-content-neutral-600 hover:text-content-neutral-900"
              }`}
            >
              Application Calendar ({tasks.filter((t) => Boolean(t.dueDate)).length})
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter("events")}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                scopeFilter === "events"
                  ? "bg-accent text-white shadow-2xs"
                  : "text-content-neutral-600 hover:text-content-neutral-900"
              }`}
            >
              Local Calendar ({events.length})
            </button>
          </div>

          <Button
            variant="secondary"
            size="small"
            disabled={isSyncingCalendar}
            onClick={handleExportToLocalCalendar}
            className="flex items-center gap-1.5 text-xs"
            title="Export & open your linked Application + Local Calendar in Apple Calendar, Outlook, or Google Calendar (.ics)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Open Local Calendar (.ics)</span>
          </Button>

          <Button
            variant="secondary"
            size="small"
            disabled={isSyncingCalendar}
            onClick={() => localCalendarFileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs"
            title="Link & import tasks/events from your Local Calendar (.ics) with automatic background auto-fixing"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Link Local Calendar (.ics)</span>
          </Button>
        </div>
      </div>

      {/* Month Header & Controls */}
      <div className="ui-card p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5">
        {/* Navigation & Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-surface-neutral-100 rounded-xl p-1 border border-line-neutral-200/80">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevMonth}
              aria-label="Previous month"
              className="h-8 w-8"
            >
              <ChevronLeft className="w-4 h-4 text-content-neutral-700" />
            </Button>
            <Button
              variant="ghost"
              size="small"
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-semibold text-content-neutral-800"
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextMonth}
              aria-label="Next month"
              className="h-8 w-8"
            >
              <ChevronRight className="w-4 h-4 text-content-neutral-700" />
            </Button>
          </div>

          <h2 className="text-lg font-newspaper text-content-neutral-900 tracking-tight">
            {formatMonthYear(currentYear, currentMonth)}
          </h2>

          {/* Brief Internal Sync Indicator */}
          {isSyncingCalendar && (
            <span
              role="status"
              aria-live="polite"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-soft/40 text-accent text-[11px] font-medium border border-accent/20 animate-pulse"
            >
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Syncing calendar...</span>
            </span>
          )}
        </div>

        {/* Filters and View Switcher */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Task Status Dropdown (visible when tasks included) */}
          {scopeFilter !== "events" && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="ui-field text-xs font-medium px-2.5 py-1.5 border border-line-neutral-200/90 rounded-xl bg-surface text-content-neutral-700 focus:outline-none focus:border-accent cursor-pointer"
            >
              <option value="all">Task Status: All</option>
              <option value="todo">To Do</option>
              <option value="in-progress">In Progress</option>
              <option value="review">Under Review</option>
              <option value="done">Completed</option>
            </select>
          )}

          {/* Event Category Dropdown (visible when events included) */}
          {scopeFilter !== "tasks" && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="ui-field text-xs font-medium px-2.5 py-1.5 border border-line-neutral-200/90 rounded-xl bg-surface text-content-neutral-700 focus:outline-none focus:border-accent cursor-pointer"
            >
              <option value="all">Event: All Types</option>
              <option value="meeting">Meetings</option>
              <option value="milestone">Milestones</option>
              <option value="review">Reviews</option>
              <option value="deadline">Deadlines</option>
              <option value="reminder">Reminders</option>
            </select>
          )}

          {/* View Mode Toggle: Grid vs Agenda */}
          <div className="flex items-center gap-1 bg-surface-neutral-100 rounded-xl p-1 border border-line-neutral-200/70">
            <button
              type="button"
              title="Month Grid"
              onClick={() => setViewType("grid")}
              className={`p-1.5 rounded-lg transition-colors ${
                viewType === "grid" ? "bg-surface text-accent shadow-xs" : "text-content-neutral-500 hover:text-content-neutral-800"
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="Schedule / Agenda"
              onClick={() => setViewType("agenda")}
              className={`p-1.5 rounded-lg transition-colors ${
                viewType === "agenda" ? "bg-surface text-accent shadow-xs" : "text-content-neutral-500 hover:text-content-neutral-800"
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* One-Click Silent Calendar Sync Button */}
          <Button
            variant="secondary"
            size="small"
            disabled={isSyncingCalendar}
            onClick={() =>
              triggerBriefCalendarSync("Application & Local calendar synchronized.")
            }
            className="flex items-center gap-1.5"
            title="Synchronize Application Calendar and Local Calendar"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isSyncingCalendar ? "animate-spin text-accent" : ""}`}
            />
            <span>{isSyncingCalendar ? "Syncing..." : "Sync Calendar"}</span>
          </Button>

          {/* Unified Create Task / Event Trigger (select Task or Event inside the creation modal) */}
          <Button
            variant="primary"
            size="small"
            onClick={() =>
              onAddTaskForDate(
                selectedCalendarDate !== "all-month" && selectedCalendarDate !== "unscheduled"
                  ? selectedCalendarDate
                  : todayStr
              )
            }
            className="flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Task / Event</span>
          </Button>
        </div>
      </div>

      {/* Month KPI Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-surface border border-line-neutral-200/70 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-content-neutral-500">Scheduled Tasks</p>
            <p className="text-xl font-newspaper font-bold text-content-neutral-900">{monthStats.totalTasks}</p>
          </div>
          <div className="p-2 rounded-xl bg-surface-blue-50 text-content-blue-700">
            <CalendarDays className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 rounded-xl bg-surface border border-line-neutral-200/70 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-content-neutral-500">Local Events</p>
            <p className="text-xl font-newspaper font-bold text-content-neutral-900">{monthStats.totalEvents}</p>
          </div>
          <div className="p-2 rounded-xl bg-surface-purple-50 text-content-purple-700">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 rounded-xl bg-surface border border-line-neutral-200/70 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-content-neutral-500">Done This Month</p>
            <p className="text-xl font-newspaper font-bold text-content-emerald-700">{monthStats.completedTasks}</p>
          </div>
          <div className="p-2 rounded-xl bg-surface-emerald-50 text-content-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 rounded-xl bg-surface border border-line-neutral-200/70 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-content-neutral-500">Overdue Tasks</p>
            <p className="text-xl font-newspaper font-bold text-content-red-700">{monthStats.overdueTasks}</p>
          </div>
          <div className="p-2 rounded-xl bg-surface-red-50 text-content-red-700">
            <AlertCircle className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Main Calendar View: Month Grid vs Agenda List */}
      <div className={`transition-opacity duration-300 ${isSyncingCalendar ? "opacity-80" : "opacity-100"}`}>
        {viewType === "grid" ? (
          <div className="ui-card overflow-hidden border border-line-neutral-200/80">
            {/* Day of Week Header */}
            <div className="grid grid-cols-7 border-b border-line-neutral-200/80 bg-surface-neutral-50/90 text-center text-xs font-semibold text-content-neutral-600 py-2.5">
              {DAYS_OF_WEEK.map((day, idx) => (
                <div key={day} className={idx === 0 || idx === 6 ? "text-content-neutral-400" : ""}>
                  {day}
                </div>
              ))}
            </div>

            {/* Grid Cells */}
            <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-line-neutral-200/60 bg-surface-neutral-100/30">
              {calendarCells.map((cell) => {
                const cellTasks = scopeFilter !== "events" ? tasksByDate.get(cell.dateStr) || [] : [];
                const cellEvents = scopeFilter !== "tasks" ? eventsByDate.get(cell.dateStr) || [] : [];
                const totalItems = cellTasks.length + cellEvents.length;
                const isOver = dragOverDate === cell.dateStr;
                const isSelectedDay = selectedCalendarDate === cell.dateStr;

                return (
                  <div
                    key={cell.dateStr}
                    onClick={() => {
                      setSelectedCalendarDate(cell.dateStr);
                      setQuickDate(cell.dateStr);
                    }}
                    onDragOver={(e) => handleCellDragOver(e, cell.dateStr)}
                    onDrop={(e) => handleCellDrop(e, cell.dateStr)}
                    className={`min-h-[112px] p-1.5 flex flex-col justify-between transition-colors relative group cursor-pointer ${
                      !cell.isCurrentMonth
                        ? "bg-surface-neutral-50/40 text-content-neutral-400"
                        : "bg-surface text-content-neutral-900"
                    } ${cell.isToday ? "ring-2 ring-accent ring-inset bg-accent-soft/20" : ""} ${
                      isSelectedDay && !cell.isToday
                        ? "ring-2 ring-accent/70 ring-inset bg-accent-soft/10"
                        : ""
                    } ${isOver ? "bg-accent-soft/50 ring-2 ring-accent" : ""}`}
                  >
                    {/* Top Bar of Cell: Day Number & Quick Add Button */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                          cell.isToday
                            ? "bg-accent text-white"
                            : isSelectedDay
                              ? "bg-accent-soft text-accent font-bold"
                              : cell.isCurrentMonth
                                ? "text-content-neutral-800"
                                : "text-content-neutral-400"
                        }`}
                      >
                        {cell.dayNumber}
                      </span>

                      {/* Direct Add trigger on hover (opens unified creation modal where user selects Task or Event and Date & Time) */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                        <button
                          type="button"
                          title="Add task or event for this date"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddTaskForDate(cell.dateStr);
                          }}
                          className="p-1 rounded-md hover:bg-surface-neutral-200 text-content-neutral-600 hover:text-accent transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Scheduled Items List for Day */}
                    <div className="flex-1 mt-1 space-y-1 overflow-hidden">
                      {/* Render Local Events first */}
                      {cellEvents.slice(0, 2).map((evt) => {
                        const pillStyle = COLOR_PILL_CLASSES[evt.color] || COLOR_PILL_CLASSES.blue;
                        return (
                          <div
                            key={evt.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectEvent(evt);
                            }}
                            title={`${evt.title} (${evt.category})${evt.startTime ? ` at ${evt.startTime}` : ""} — Click to view, edit, or delete`}
                            className={`px-1.5 py-0.5 rounded text-[11px] font-medium border-l-2 truncate cursor-pointer hover:brightness-95 transition-all flex items-center gap-1 ${pillStyle.border} ${pillStyle.bg} ${pillStyle.text}`}
                          >
                            <span className="shrink-0">{EVENT_CATEGORY_ICONS[evt.category]}</span>
                            {evt.startTime && !evt.isAllDay && (
                              <span className="text-[9px] font-mono opacity-80 shrink-0">{evt.startTime}</span>
                            )}
                            <span className="truncate">{evt.title}</span>
                          </div>
                        );
                      })}

                      {/* Render Tasks next */}
                      {cellTasks.slice(0, 3 - Math.min(2, cellEvents.length)).map((t) => {
                        const priorityStyle = PRIORITY_COLORS[t.priority];
                        const statusBadge = STATUS_BADGES[t.status];
                        return (
                          <div
                            key={t.id}
                            draggable
                            onDragStart={(e) => handleTaskDragStart(e, t.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectTask(t);
                            }}
                            title={`[${statusBadge.label}] ${t.title}${t.startTime ? ` (${t.startTime}${t.endTime ? ` - ${t.endTime}` : ""})` : ""} (${t.priority} priority) - Click to view/edit or drag to reschedule`}
                            className={`px-1.5 py-0.5 rounded text-[11px] border border-line-neutral-200/90 bg-surface hover:bg-surface-neutral-100/80 cursor-grab active:cursor-grabbing truncate transition-all shadow-2xs flex items-center gap-1 ${
                              t.status === "done" ? "opacity-60 line-through" : ""
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityStyle.dot}`} />
                            {t.startTime && (
                              <span className="text-[9px] font-mono text-content-neutral-500 shrink-0">
                                {t.startTime}
                              </span>
                            )}
                            <span className="truncate font-medium text-content-neutral-900 flex-1">{t.title}</span>
                            {onDeleteTask && (
                              <button
                                type="button"
                                title="Delete task"
                                aria-label={`Delete task ${t.title}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  triggerBriefCalendarSync();
                                  void onDeleteTask(t.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-content-neutral-400 hover:text-content-rose-600 transition-opacity shrink-0 cursor-pointer"
                              >
                                <i className="fa-solid fa-trash !w-2.5 !h-2.5" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {/* Overflow Badge */}
                      {totalItems > 3 && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCalendarDate(cell.dateStr);
                          }}
                          className="text-[10px] font-semibold text-content-neutral-500 hover:text-accent cursor-pointer px-1 pt-0.5"
                        >
                          +{totalItems - 3} more...
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Agenda / Timeline View */
          <div className="ui-card p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-line-neutral-200/70">
              <h3 className="text-sm font-semibold text-content-neutral-900 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-accent" />
                Upcoming Schedule &amp; Timeline ({agendaItems.length} items)
              </h3>
              <span className="text-xs text-content-neutral-500">
                Sorted chronologically with sprint tasks and local user events
              </span>
            </div>

            {agendaItems.length === 0 ? (
              <div className="py-12 text-center text-content-neutral-500 space-y-2">
                <CalendarIcon className="w-8 h-8 mx-auto text-content-neutral-400" />
                <p className="text-sm font-medium">No tasks or events found for the active filters.</p>
                <p className="text-xs text-content-neutral-400">
                  Schedule a new sprint task or add a local event using the buttons above.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {agendaItems.map((entry) => {
                  if (entry.type === "task") {
                    const task = entry.item as TaskItem;
                    const priorityStyle = PRIORITY_COLORS[task.priority];
                    const statusBadge = STATUS_BADGES[task.status];

                    return (
                      <div
                        key={`agenda-task-${task.id}`}
                        onClick={() => onSelectTask(task)}
                        className="p-3.5 rounded-xl border border-line-neutral-200/80 bg-surface hover:bg-surface-neutral-50/70 cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-xl bg-surface-neutral-100 text-content-neutral-700 shrink-0 mt-0.5">
                            <CheckCircle2 className="w-4 h-4 text-accent" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-surface-neutral-100 text-content-neutral-700">
                                {formatDisplayDate(entry.dateStr)}
                              </span>
                              {task.startTime && (
                                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-surface-neutral-100 text-content-neutral-800 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-accent" />
                                  {task.startTime}
                                  {task.endTime ? ` - ${task.endTime}` : ""}
                                </span>
                              )}
                              <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${statusBadge.badgeClass}`}>
                                {statusBadge.label}
                              </span>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1 ${priorityStyle.bg} ${priorityStyle.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${priorityStyle.dot}`} />
                                {task.priority}
                              </span>
                              {task.clientName && (
                                <span className="text-[11px] text-content-neutral-500 font-medium">
                                  Client: {task.clientName}
                                </span>
                              )}
                            </div>
                            <h4 className={`text-sm font-semibold mt-1 text-content-neutral-900 ${task.status === "done" ? "line-through opacity-70" : ""}`}>
                              {task.title}
                            </h4>
                            {task.description && (
                              <p className="text-xs text-content-neutral-500 line-clamp-1 mt-0.5">
                                {task.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div
                          className="flex items-center gap-1.5 shrink-0 self-end sm:self-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="small"
                            onClick={() => onSelectTask(task)}
                            className="text-xs"
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1" />
                            Edit
                          </Button>
                          {onDeleteTask && (
                            <Button
                              variant="ghost"
                              size="small"
                              onClick={() => {
                                triggerBriefCalendarSync();
                                void onDeleteTask(task.id);
                              }}
                              className="text-xs text-content-rose-600 hover:bg-surface-rose-50"
                              title="Delete task"
                            >
                              <i className="fa-solid fa-trash" aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  } else {
                    const event = entry.item as CalendarEventItem;
                    const pillStyle = COLOR_PILL_CLASSES[event.color] || COLOR_PILL_CLASSES.blue;

                    return (
                      <div
                        key={`agenda-event-${event.id}`}
                        onClick={() => onSelectEvent(event)}
                        className={`p-3.5 rounded-xl border border-line-neutral-200/80 bg-surface hover:bg-surface-neutral-50/70 cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs border-l-4 ${pillStyle.border}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="text-xl p-1.5 shrink-0">
                            {EVENT_CATEGORY_ICONS[event.category]}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-surface-neutral-100 text-content-neutral-700">
                                {formatDisplayDate(entry.dateStr)}
                              </span>
                              {event.startTime && !event.isAllDay ? (
                                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-surface-neutral-100 text-content-neutral-800 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-accent" />
                                  {event.startTime}
                                  {event.endTime ? ` - ${event.endTime}` : ""}
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-surface-neutral-100 text-content-neutral-700">
                                  All-Day
                                </span>
                              )}
                              <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${pillStyle.bg} ${pillStyle.text}`}>
                                {event.category}
                              </span>
                              {event.clientName && (
                                <span className="text-[11px] text-content-neutral-500 font-medium flex items-center gap-1">
                                  <Link2 className="w-3 h-3" /> {event.clientName}
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-semibold mt-1 text-content-neutral-900">
                              {event.title}
                            </h4>
                            {event.description && (
                              <p className="text-xs text-content-neutral-500 line-clamp-1 mt-0.5">
                                {event.description}
                              </p>
                            )}
                            {event.location && (
                              <p className="text-xs text-accent font-medium flex items-center gap-1 mt-1">
                                <MapPin className="w-3 h-3" /> {event.location}
                              </p>
                            )}
                          </div>
                        </div>

                        <div
                          className="flex items-center gap-1.5 shrink-0 self-end sm:self-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {event.taskTitle && (
                            <span className="text-[11px] font-medium px-2 py-1 rounded bg-surface-blue-50 text-content-blue-700 border border-line-blue-200">
                              Task: {event.taskTitle}
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="small"
                            onClick={() => onSelectEvent(event)}
                            className="text-xs"
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1" />
                            Edit
                          </Button>
                          {onDeleteEvent && (
                            <Button
                              variant="ghost"
                              size="small"
                              onClick={() => {
                                triggerBriefCalendarSync();
                                void onDeleteEvent(event.id);
                              }}
                              className="text-xs text-content-rose-600 hover:bg-surface-rose-50"
                              title="Delete event"
                            >
                              <i className="fa-solid fa-trash" aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* =====================================================================
          DEDICATED CALENDAR TASKS & LOCAL EVENTS SECTION
          View, Add, Edit, Reschedule, and Delete Tasks & Events Directly
         ===================================================================== */}
      <div className="ui-card p-5 space-y-5 border border-line-neutral-200/90">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3.5 border-b border-line-neutral-200/70">
          <div>
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-accent" />
              <h3 className="text-base font-semibold text-content-neutral-900">
                Calendar Tasks &amp; Events
              </h3>
              <span className="zentra-pill-badge !px-2.5 !py-0.5 !text-[11px]">
                {workbenchTasks.length} tasks · {workbenchEvents.length} events
              </span>
            </div>
            <p className="text-xs text-content-neutral-500 mt-0.5">
              Add, view, edit, or delete tasks and events directly in your calendar. Click any date cell above to filter by that day.
            </p>
          </div>

          {/* Scope Selector: Active Month vs Today vs Selected Day vs Unscheduled Tasks */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedCalendarDate("all-month")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedCalendarDate === "all-month"
                  ? "bg-accent text-white shadow-xs"
                  : "bg-surface-neutral-100 text-content-neutral-700 hover:bg-surface-neutral-200"
              }`}
            >
              All in {formatMonthYear(currentYear, currentMonth)}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedCalendarDate(todayStr);
                setQuickDate(todayStr);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedCalendarDate === todayStr
                  ? "bg-accent text-white shadow-xs"
                  : "bg-surface-neutral-100 text-content-neutral-700 hover:bg-surface-neutral-200"
              }`}
            >
              Today ({formatDisplayDate(todayStr)})
            </button>
            {selectedCalendarDate !== "all-month" &&
              selectedCalendarDate !== "unscheduled" &&
              selectedCalendarDate !== todayStr && (
                <button
                  type="button"
                  onClick={() => setSelectedCalendarDate(selectedCalendarDate)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-accent text-white shadow-xs"
                >
                  Selected: {formatDisplayDate(selectedCalendarDate)}
                </button>
              )}
            <button
              type="button"
              onClick={() => setSelectedCalendarDate("unscheduled")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedCalendarDate === "unscheduled"
                  ? "bg-accent text-white shadow-xs"
                  : "bg-surface-neutral-100 text-content-neutral-700 hover:bg-surface-neutral-200"
              }`}
            >
              Unscheduled Tasks ({unscheduledTasks.length})
            </button>
          </div>
        </div>

        {/* Inline Quick-Add Bar for Tasks & Local Calendar Events */}
        <form
          onSubmit={handleQuickAddSubmit}
          className="p-3.5 rounded-xl bg-surface-neutral-50/80 dark:bg-surface-secondary border border-line-neutral-200/80 flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5"
        >
          <div className="inline-flex rounded-xl bg-surface p-0.5 border border-line-neutral-200/80 shrink-0">
            <button
              type="button"
              onClick={() => setQuickFormType("task")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                quickFormType === "task"
                  ? "bg-accent text-white"
                  : "text-content-neutral-600 hover:text-content-neutral-900"
              }`}
            >
              + Quick Task
            </button>
            <button
              type="button"
              onClick={() => setQuickFormType("event")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                quickFormType === "event"
                  ? "bg-accent text-white"
                  : "text-content-neutral-600 hover:text-content-neutral-900"
              }`}
            >
              + Quick Event
            </button>
          </div>

          <input
            type="text"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder={
              quickFormType === "task"
                ? "Add a new task to calendar (e.g., Deploy staging build, AI prompt audit)..."
                : "Add a new event to calendar (e.g., Client Sprint Review Call)..."
            }
            className="ui-field flex-1 px-3.5 py-2 text-xs border border-line-neutral-200 rounded-xl bg-surface"
          />

          <input
            type="date"
            aria-label="Quick item date"
            value={quickDate}
            onChange={(e) => setQuickDate(e.target.value)}
            className="ui-field px-3 py-2 text-xs border border-line-neutral-200 rounded-xl bg-surface shrink-0"
          />

          {/* Shared Time Inputs (Start Time & End Time) for BOTH Tasks and Events */}
          <div className="flex items-center gap-1.5 shrink-0">
            <input
              type="time"
              aria-label="Quick start time"
              title="Start Time"
              value={quickStartTime}
              onChange={(e) => setQuickStartTime(e.target.value)}
              className="ui-field px-2.5 py-2 text-xs border border-line-neutral-200 rounded-xl bg-surface shrink-0"
            />
            <span className="text-content-neutral-400 text-xs">&ndash;</span>
            <input
              type="time"
              aria-label="Quick end time"
              title="End Time"
              value={quickEndTime}
              onChange={(e) => setQuickEndTime(e.target.value)}
              className="ui-field px-2.5 py-2 text-xs border border-line-neutral-200 rounded-xl bg-surface shrink-0"
            />
          </div>

          {quickFormType === "task" ? (
            <>
              <select
                aria-label="Quick task priority"
                value={quickTaskPriority}
                onChange={(e) => setQuickTaskPriority(e.target.value as TaskPriority)}
                className="ui-field px-2.5 py-2 text-xs border border-line-neutral-200 rounded-xl bg-surface shrink-0"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent</option>
              </select>
              <select
                aria-label="Quick task category"
                value={quickTaskCategory}
                onChange={(e) => setQuickTaskCategory(e.target.value as TaskCategory)}
                className="ui-field px-2.5 py-2 text-xs border border-line-neutral-200 rounded-xl bg-surface shrink-0"
              >
                <option value="Development">Development</option>
                <option value="Design">Design</option>
                <option value="Infrastructure">Infrastructure</option>
                <option value="Legal">Legal</option>
                <option value="Documentation">Documentation</option>
              </select>
            </>
          ) : (
            <select
              aria-label="Quick event category"
              value={quickEventCategory}
              onChange={(e) => setQuickEventCategory(e.target.value as EventCategory)}
              className="ui-field px-2.5 py-2 text-xs border border-line-neutral-200 rounded-xl bg-surface shrink-0"
            >
              <option value="meeting">👥 Meeting</option>
              <option value="milestone">🚩 Milestone</option>
              <option value="review">🔍 Review</option>
              <option value="deadline">⏰ Deadline</option>
              <option value="reminder">🔔 Reminder</option>
              <option value="general">📅 General</option>
            </select>
          )}

          <Button
            type="submit"
            variant="primary"
            size="small"
            disabled={!quickTitle.trim() || isSubmittingQuick}
            className="shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{quickFormType === "task" ? "Add Task" : "Add Event"}</span>
          </Button>
        </form>

        {/* Two-Column Workbench: Calendar Tasks List + Calendar Events List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* LEFT COLUMN: TASKS IN CALENDAR */}
          <div className="rounded-xl border border-line-neutral-200/80 bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-line-neutral-100">
              <span className="text-xs font-semibold uppercase tracking-wider text-content-neutral-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                <span>Application Calendar Tasks ({workbenchTasks.length})</span>
              </span>
              <Button
                variant="ghost"
                size="small"
                onClick={() =>
                  onAddTaskForDate(
                    selectedCalendarDate !== "all-month" && selectedCalendarDate !== "unscheduled"
                      ? selectedCalendarDate
                      : todayStr
                  )
                }
                className="text-xs"
              >
                <Plus className="w-3 h-3" />
                <span>New Task / Event</span>
              </Button>
            </div>

            {workbenchTasks.length === 0 ? (
              <div className="py-8 text-center text-xs text-content-neutral-400 space-y-1.5">
                <p>No tasks scheduled for this view.</p>
                <p>Use the Quick Task bar above or click &ldquo;New Task / Event&rdquo; to add one.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {workbenchTasks.map((task) => {
                  const isEditingThis = editingTaskId === task.id;
                  const priorityStyle = PRIORITY_COLORS[task.priority];
                  const statusBadge = STATUS_BADGES[task.status];

                  if (isEditingThis) {
                    return (
                      <div
                        key={task.id}
                        className="p-3 rounded-xl border-2 border-accent/60 bg-surface-neutral-50/70 space-y-2.5 text-xs"
                      >
                        <input
                          type="text"
                          aria-label="Edit task title"
                          value={editingTaskTitle}
                          onChange={(e) => setEditingTaskTitle(e.target.value)}
                          className="ui-field w-full px-2.5 py-1.5 text-xs font-semibold border border-line-neutral-200 rounded-lg bg-surface"
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="date"
                            aria-label="Edit task due date"
                            value={editingTaskDueDate}
                            onChange={(e) => setEditingTaskDueDate(e.target.value)}
                            className="ui-field px-2 py-1 text-xs border border-line-neutral-200 rounded-lg bg-surface"
                          />
                          <input
                            type="time"
                            aria-label="Edit task start time"
                            title="Start Time"
                            value={editingTaskStartTime}
                            onChange={(e) => setEditingTaskStartTime(e.target.value)}
                            className="ui-field px-2 py-1 text-xs border border-line-neutral-200 rounded-lg bg-surface"
                          />
                          <input
                            type="time"
                            aria-label="Edit task end time"
                            title="End Time"
                            value={editingTaskEndTime}
                            onChange={(e) => setEditingTaskEndTime(e.target.value)}
                            className="ui-field px-2 py-1 text-xs border border-line-neutral-200 rounded-lg bg-surface"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            aria-label="Edit task status"
                            value={editingTaskStatus}
                            onChange={(e) => setEditingTaskStatus(e.target.value as TaskStatus)}
                            className="ui-field px-2 py-1 text-xs border border-line-neutral-200 rounded-lg bg-surface"
                          >
                            <option value="todo">To Do</option>
                            <option value="in-progress">In Progress</option>
                            <option value="review">Review</option>
                            <option value="done">Done</option>
                          </select>
                          <select
                            aria-label="Edit task priority"
                            value={editingTaskPriority}
                            onChange={(e) =>
                              setEditingTaskPriority(e.target.value as TaskPriority)
                            }
                            className="ui-field px-2 py-1 text-xs border border-line-neutral-200 rounded-lg bg-surface"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="small"
                            onClick={() => setEditingTaskId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            variant="primary"
                            size="small"
                            onClick={() => void saveInlineEditTask(task.id)}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={task.id}
                      className="p-3 rounded-xl border border-line-neutral-200/80 bg-surface hover:bg-surface-neutral-50/70 transition-all flex items-start justify-between gap-2.5"
                    >
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => onSelectTask(task)}
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-surface-neutral-100 text-content-neutral-700">
                            {formatDisplayDate(task.dueDate?.split("T")[0] || "")}
                          </span>
                          {task.startTime && (
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface-neutral-100 text-content-neutral-700 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-accent" />
                              {task.startTime}
                              {task.endTime ? ` - ${task.endTime}` : ""}
                            </span>
                          )}
                          <span
                            className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${statusBadge.badgeClass}`}
                          >
                            {statusBadge.label}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1 ${priorityStyle.bg} ${priorityStyle.text}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${priorityStyle.dot}`} />
                            {task.priority}
                          </span>
                        </div>
                        <h4
                          className={`text-xs font-semibold text-content-neutral-900 mt-1 truncate ${
                            task.status === "done" ? "line-through opacity-65" : ""
                          }`}
                        >
                          {task.title}
                        </h4>
                        {task.clientName && (
                          <p className="text-[11px] text-content-neutral-500 truncate">
                            Client: {task.clientName}
                          </p>
                        )}
                      </div>

                      {/* Direct Actions: Quick Edit, Delete */}
                      <div className="flex items-center gap-1 shrink-0">
                        {onUpdateTask && (
                          <button
                            type="button"
                            onClick={() => startInlineEditTask(task)}
                            title="Edit task"
                            className="p-1.5 rounded-lg text-content-neutral-500 hover:text-accent hover:bg-surface-neutral-100 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeleteTask && (
                          <button
                            type="button"
                            onClick={() => {
                              triggerBriefCalendarSync();
                              void onDeleteTask(task.id);
                            }}
                            title="Delete task"
                            className="p-1.5 rounded-lg text-content-neutral-400 hover:text-content-rose-600 hover:bg-surface-rose-50 transition-colors cursor-pointer"
                          >
                            <i className="fa-solid fa-trash" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: LOCAL CALENDAR EVENTS */}
          <div className="rounded-xl border border-line-neutral-200/80 bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-line-neutral-100">
              <span className="text-xs font-semibold uppercase tracking-wider text-content-neutral-700 flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-accent" />
                <span>Events ({workbenchEvents.length})</span>
              </span>
              <Button
                variant="ghost"
                size="small"
                onClick={() =>
                  onAddEventForDate(
                    selectedCalendarDate !== "all-month" && selectedCalendarDate !== "unscheduled"
                      ? selectedCalendarDate
                      : todayStr
                  )
                }
                className="text-xs"
              >
                <Plus className="w-3 h-3" />
                <span>New Event</span>
              </Button>
            </div>

            {workbenchEvents.length === 0 ? (
              <div className="py-8 text-center text-xs text-content-neutral-400 space-y-1.5">
                <p>No calendar events scheduled for this view.</p>
                <p>Use the Quick Event bar above or click &ldquo;New Event&rdquo; to schedule one.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {workbenchEvents.map((evt) => {
                  const pillStyle = COLOR_PILL_CLASSES[evt.color] || COLOR_PILL_CLASSES.blue;
                  return (
                    <div
                      key={evt.id}
                      className={`p-3 rounded-xl border border-line-neutral-200/80 bg-surface hover:bg-surface-neutral-50/70 transition-all flex items-start justify-between gap-2.5 border-l-4 ${pillStyle.border}`}
                    >
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => onSelectEvent(evt)}
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-surface-neutral-100 text-content-neutral-700">
                            {formatDisplayDate(evt.startDate)}
                          </span>
                          {evt.startTime && !evt.isAllDay ? (
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface-neutral-100 text-content-neutral-700">
                              {evt.startTime}
                              {evt.endTime ? ` - ${evt.endTime}` : ""}
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-surface-neutral-100 text-content-neutral-600">
                              All-Day
                            </span>
                          )}
                          <span
                            className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${pillStyle.bg} ${pillStyle.text}`}
                          >
                            {EVENT_CATEGORY_ICONS[evt.category]} {evt.category}
                          </span>
                        </div>
                        <h4 className="text-xs font-semibold text-content-neutral-900 mt-1 truncate">
                          {evt.title}
                        </h4>
                        {evt.taskTitle && (
                          <p className="text-[11px] text-accent truncate">
                            Linked Task: {evt.taskTitle}
                          </p>
                        )}
                      </div>

                      {/* Direct Actions: Edit Event, Delete Event */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onSelectEvent(evt)}
                          title="Edit calendar event"
                          className="p-1.5 rounded-lg text-content-neutral-500 hover:text-accent hover:bg-surface-neutral-100 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {onDeleteEvent && (
                          <button
                            type="button"
                            onClick={() => {
                              triggerBriefCalendarSync();
                              void onDeleteEvent(evt.id);
                            }}
                            title="Delete calendar event"
                            className="p-1.5 rounded-lg text-content-neutral-400 hover:text-content-rose-600 hover:bg-surface-rose-50 transition-colors cursor-pointer"
                          >
                            <i className="fa-solid fa-trash" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
