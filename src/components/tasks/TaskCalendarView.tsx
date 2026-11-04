"use client";

import React, { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Plus,
  CheckCircle2,
  AlertCircle,
  Flag,
  MapPin,
  ExternalLink,
  Link2,
  Video,
  List,
  Grid3X3,
  CalendarDays,
  Filter,
  Layers,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/Workspace";
import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";
import type { TaskItem, TaskStatus, TaskPriority } from "@/types/tasks";
import type { CalendarEventItem, EventCategory, EventColor } from "@/types/calendar";
import { useData } from "@/lib/data/DataProvider";

interface TaskCalendarViewProps {
  tasks: TaskItem[];
  events: CalendarEventItem[];
  onSelectTask: (task: TaskItem) => void;
  onSelectEvent: (event: CalendarEventItem) => void;
  onAddTaskForDate: (dateStr: string) => void;
  onAddEventForDate: (dateStr: string) => void;
  onRescheduleTask: (taskId: string, newDate: string) => Promise<boolean>;
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
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  return dateStr;
}

export default function TaskCalendarView({
  tasks,
  events,
  onSelectTask,
  onSelectEvent,
  onAddTaskForDate,
  onAddEventForDate,
  onRescheduleTask,
}: TaskCalendarViewProps) {
  const today = new Date();
  const todayStr = formatDateString(today.getFullYear(), today.getMonth(), today.getDate());

  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth());
  const [viewType, setViewType] = useState<"grid" | "agenda">("grid");

  // Filters
  const [scopeFilter, setScopeFilter] = useState<"all" | "tasks" | "events">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Drag & drop state for tasks
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // Quick Day Add Dropdown
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);

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

    // Previous month padding
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

    // Current month days
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const dateStr = formatDateString(currentYear, currentMonth, day);
      cells.push({
        dateStr,
        dayNumber: day,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Next month padding to complete 35 or 42 grid cells
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
  const monthStats = useMemo(() => {
    const currentMonthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
    const monthTasks = tasks.filter((t) => t.dueDate && t.dueDate.startsWith(currentMonthPrefix));
    const monthEvents = events.filter((e) => e.startDate && e.startDate.startsWith(currentMonthPrefix));
    const completedTasks = monthTasks.filter((t) => t.status === "done").length;
    const overdueTasks = tasks.filter((t) => t.dueDate && t.dueDate < todayStr && t.status !== "done").length;

    return {
      totalTasks: monthTasks.length,
      totalEvents: monthEvents.length,
      completedTasks,
      overdueTasks,
    };
  }, [tasks, events, currentYear, currentMonth, todayStr]);

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
      void onRescheduleTask(taskId, targetDate);
    }
    setDraggedTaskId(null);
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
    <div className="space-y-4">
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
        </div>

        {/* Filters and View Switcher */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Scope Filter Tabs */}
          <div className="inline-flex rounded-xl bg-surface-neutral-100 p-1 border border-line-neutral-200/70 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setScopeFilter("all")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                scopeFilter === "all"
                  ? "bg-surface shadow-xs text-content-neutral-900 font-bold"
                  : "text-content-neutral-600 hover:text-content-neutral-900"
              }`}
            >
              All Items
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter("tasks")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                scopeFilter === "tasks"
                  ? "bg-surface shadow-xs text-content-neutral-900 font-bold"
                  : "text-content-neutral-600 hover:text-content-neutral-900"
              }`}
            >
              Tasks Only
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter("events")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                scopeFilter === "events"
                  ? "bg-surface shadow-xs text-content-neutral-900 font-bold"
                  : "text-content-neutral-600 hover:text-content-neutral-900"
              }`}
            >
              Events Only
            </button>
          </div>

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

          {/* Create Event Trigger */}
          <Button
            variant="secondary"
            size="small"
            onClick={() => onAddEventForDate(todayStr)}
            className="flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Event</span>
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

              return (
                <div
                  key={cell.dateStr}
                  onDragOver={(e) => handleCellDragOver(e, cell.dateStr)}
                  onDrop={(e) => handleCellDrop(e, cell.dateStr)}
                  className={`min-h-[110px] p-1.5 flex flex-col justify-between transition-colors relative group ${
                    !cell.isCurrentMonth
                      ? "bg-surface-neutral-50/40 text-content-neutral-400"
                      : "bg-surface text-content-neutral-900"
                  } ${cell.isToday ? "ring-2 ring-accent ring-inset bg-accent-soft/20" : ""} ${
                    isOver ? "bg-accent-soft/50 ring-2 ring-accent" : ""
                  }`}
                >
                  {/* Top Bar of Cell: Day Number & Quick Add Button */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                        cell.isToday
                          ? "bg-accent text-white"
                          : cell.isCurrentMonth
                          ? "text-content-neutral-800"
                          : "text-content-neutral-400"
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {/* Quick Add trigger on hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                      <button
                        type="button"
                        title="Add task or event for this date"
                        onClick={() =>
                          setQuickAddDate(quickAddDate === cell.dateStr ? null : cell.dateStr)
                        }
                        className="p-1 rounded-md hover:bg-surface-neutral-200 text-content-neutral-600 hover:text-accent transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Popover for Quick Add on day cell */}
                  {quickAddDate === cell.dateStr && (
                    <div
                      className="absolute z-30 top-7 left-2 right-2 p-2 bg-surface border border-line-neutral-300 rounded-xl shadow-xl space-y-1 text-xs"
                      onMouseLeave={() => setQuickAddDate(null)}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onAddTaskForDate(cell.dateStr);
                          setQuickAddDate(null);
                        }}
                        className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-accent-soft hover:text-accent font-medium text-content-neutral-800 flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3 h-3 text-accent" />
                        <span>Add Task for {cell.dayNumber}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onAddEventForDate(cell.dateStr);
                          setQuickAddDate(null);
                        }}
                        className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-accent-soft hover:text-accent font-medium text-content-neutral-800 flex items-center gap-1.5"
                      >
                        <CalendarIcon className="w-3 h-3 text-accent" />
                        <span>Add Event for {cell.dayNumber}</span>
                      </button>
                    </div>
                  )}

                  {/* Scheduled Items List for Day */}
                  <div className="flex-1 mt-1 space-y-1 overflow-hidden">
                    {/* Render Local Events first */}
                    {cellEvents.slice(0, 2).map((evt) => {
                      const pillStyle = COLOR_PILL_CLASSES[evt.color] || COLOR_PILL_CLASSES.blue;
                      return (
                        <div
                          key={evt.id}
                          onClick={() => onSelectEvent(evt)}
                          title={`${evt.title} (${evt.category})${evt.startTime ? ` at ${evt.startTime}` : ""}`}
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
                          onClick={() => onSelectTask(t)}
                          title={`[${statusBadge.label}] ${t.title} (${t.priority} priority) - Drag to reschedule`}
                          className={`px-1.5 py-0.5 rounded text-[11px] border border-line-neutral-200/90 bg-surface hover:bg-surface-neutral-100/80 cursor-grab active:cursor-grabbing truncate transition-all shadow-2xs flex items-center gap-1 ${
                            t.status === "done" ? "opacity-60 line-through" : ""
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityStyle.dot}`} />
                          <span className="truncate font-medium text-content-neutral-900">{t.title}</span>
                        </div>
                      );
                    })}

                    {/* Overflow Badge */}
                    {totalItems > 3 && (
                      <div
                        onClick={() => {
                          setViewType("agenda");
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
              Upcoming Schedule & Timeline ({agendaItems.length} items)
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

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {task.isOutsourced && (
                          <span className="text-[11px] font-medium px-2 py-1 rounded bg-surface-purple-50 text-content-purple-700 border border-line-purple-200">
                            Outsourced: {task.outsourcedVendor || "Vendor"}
                          </span>
                        )}
                        <Button variant="ghost" size="small" className="text-xs">
                          Details <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
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

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {event.taskTitle && (
                          <span className="text-[11px] font-medium px-2 py-1 rounded bg-surface-blue-50 text-content-blue-700 border border-line-blue-200">
                            Task: {event.taskTitle}
                          </span>
                        )}
                        <Button variant="ghost" size="small" className="text-xs">
                          Edit Event <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
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
  );
}
