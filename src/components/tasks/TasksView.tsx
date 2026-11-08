"use client";

import { Dialog } from "@/components/ui/Dialog";

import { DataBreakdown, MonthlyBars } from "@/components/ui/DataGraphic";
import { recentMonths, taskProgress } from "@/lib/visual-metrics";

import {
  Button,
  PageHeader,
  SegmentedControl,
  EmptyState,
} from "@/components/ui/Workspace";

import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";

import React, { useState, useMemo, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Search,
  Kanban,
  List,
  GitFork,
  Calendar,
  X,
  ExternalLink,
  Link2,
  CheckSquare,
  Trash2,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import {
  TaskItem,
  TaskStatus,
  TaskPriority,
  TaskCategory,
} from "@/types/tasks";
import type {
  CalendarEventItem,
  EventCategory,
  EventColor,
} from "@/types/calendar";
import { useData } from "@/lib/data/DataProvider";
import type { TaskPatchInput } from "@/types/workflow";
import TaskTiming from "@/components/tasks/TaskTiming";
import TaskCalendarView from "@/components/tasks/TaskCalendarView";
import EventModal from "@/components/tasks/EventModal";
import SubmitWorkModal from "@/components/tasks/SubmitWorkModal";
import Link from "next/link";
import { resolveDeliveryUrl, openExternalLink } from "@/lib/deliveryUrl";
import { SelectDropdown, SelectOption } from "@/components/ui/SelectDropdown";
import {
  saveTaskTimeSlot,
  getTaskTimeSlot,
  normalizeAndAutoFixDate,
  normalizeAndAutoFixTimeRange,
} from "@/lib/local-calendar";

const PRIORITY_OPTIONS: SelectOption[] = [
  { value: "all", label: "Priority: All" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: "all", label: "Category: All" },
  { value: "Development", label: "Development" },
  { value: "Design", label: "Design" },
  { value: "Infrastructure", label: "Infrastructure" },
  { value: "Legal", label: "Legal" },
  { value: "Documentation", label: "Documentation" },
];

function HighlightText({ text, query }: { text: string; query: string }) {
  const trimmed = query.trim();
  if (!trimmed) return <>{text}</>;
  const lowerText = text.toLowerCase();
  const lowerQuery = trimmed.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  if (index === -1) return <>{text}</>;

  const before = text.substring(0, index);
  const match = text.substring(index, index + trimmed.length);
  const after = text.substring(index + trimmed.length);

  return (
    <>
      {before}
      <mark className="bg-accent/25 text-accent rounded px-0.5 font-semibold">
        {match}
      </mark>
      {after}
    </>
  );
}

const columnDefinitions: {
  id: TaskStatus;
  title: string;
  color: string;
  badgeBg: string;
}[] = [
  {
    id: "todo",
    title: "To Do",
    color: "border-line-neutral-300",
    badgeBg: "bg-surface-neutral-100 text-content-neutral-700",
  },
  {
    id: "in-progress",
    title: "In Progress",
    color: "border-line-blue-400",
    badgeBg:
      "bg-surface-blue-50 text-content-blue-700 border border-line-blue-200/60",
  },
  {
    id: "review",
    title: "Under Review",
    color: "border-line-amber-400",
    badgeBg:
      "bg-surface-amber-50 text-content-amber-700 border border-line-amber-200/60",
  },
  {
    id: "done",
    title: "Done",
    color: "border-line-emerald-400",
    badgeBg:
      "bg-surface-emerald-50 text-content-emerald-700 border border-line-emerald-200/60",
  },
];

export default function TasksView({
  defaultView = "kanban",
}: {
  defaultView?: "kanban" | "list";
} = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialView =
    searchParams?.get("view") === "list"
      ? "list"
      : defaultView === "list"
        ? "list"
        : "kanban";

  const {
    tasks,
    events,
    createEvent,
    deleteEvent,
    invoices,
    workflow,
    clients,
    vendors,
    settings,
    isElectron,
    isLoading,
    error,
    activeCurrency,
  } = useData();
  const [saving, setSaving] = useState(false);
  const draftId = useRef<string | null>(null);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">(initialView);

  React.useEffect(() => {
    if (
      searchParams?.get("view") === "calendar" ||
      (typeof window !== "undefined" && window.location.hash === "#calendar")
    ) {
      const timer = setTimeout(() => {
        document
          .getElementById("task-calendar-section")
          ?.scrollIntoView({ behavior: "smooth" });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedEventToEdit, setSelectedEventToEdit] = useState<CalendarEventItem | null>(null);
  const [calendarTargetDate, setCalendarTargetDate] = useState<string>("");
  const [calendarTargetTaskId, setCalendarTargetTaskId] = useState<string>("");
  const [taskForSubmitWork, setTaskForSubmitWork] = useState<TaskItem | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTaskForDetail =
    tasks.find((task) => task.id === selectedTaskId) || null;
  const setSelectedTaskForDetail = (task: TaskItem | null) => {
    setSubtaskTitle("");
    setSelectedTaskId(task?.id || null);
  };
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const leadFreelancerName =
    settings?.businessName?.trim() || "Lead Freelancer";

  // Form State for Unified New Task / Event Creation Modal
  const [newRecordType, setNewRecordType] = useState<"task" | "event">("task");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStatus, setNewStatus] = useState<TaskStatus>("todo");
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium");
  const [newCategory, setNewCategory] = useState<TaskCategory>("Development");
  const [newDueDate, setNewDueDate] = useState("");
  const [newStartTime, setNewStartTime] = useState("10:00");
  const [newEndTime, setNewEndTime] = useState("11:00");
  const [newIsAllDay, setNewIsAllDay] = useState(false);
  const [newEventCategory, setNewEventCategory] = useState<EventCategory>("meeting");
  const [newEventColor, setNewEventColor] = useState<EventColor>("blue");
  const [newEventLocation, setNewEventLocation] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newIsOutsourced, setNewIsOutsourced] = useState(false);
  const [newOutsourcedVendor, setNewOutsourcedVendor] = useState("");
  const [newOutsourceBudget, setNewOutsourceBudget] = useState("");
  const [hasTaskDraft, setHasTaskDraft] = useState(false);
  const [timeSlotVersion, setTimeSlotVersion] = useState(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isTaskFormDirty = () => {
    return Boolean(
      newTitle.trim() ||
        newDescription.trim() ||
        newDueDate.trim() ||
        newClientName.trim() ||
        newOutsourcedVendor.trim() ||
        newOutsourceBudget.trim(),
    );
  };

  const saveTaskDraft = () => {
    if (!isTaskFormDirty()) return;
    const draft = {
      newTitle,
      newDescription,
      newStatus,
      newPriority,
      newCategory,
      newDueDate,
      newClientName,
      newIsOutsourced,
      newOutsourcedVendor,
      newOutsourceBudget,
    };
    try {
      localStorage.setItem("billflow_draft_task", JSON.stringify(draft));
      setHasTaskDraft(true);
    } catch {}
  };

  const clearTaskDraft = () => {
    try {
      localStorage.removeItem("billflow_draft_task");
    } catch {}
    setHasTaskDraft(false);
  };

  const handleRestoreTaskDraft = () => {
    try {
      const saved = localStorage.getItem("billflow_draft_task");
      if (!saved) return;
      const draft = JSON.parse(saved);
      if (draft.newTitle !== undefined) setNewTitle(draft.newTitle);
      if (draft.newDescription !== undefined)
        setNewDescription(draft.newDescription);
      if (draft.newStatus !== undefined) setNewStatus(draft.newStatus);
      if (draft.newPriority !== undefined) setNewPriority(draft.newPriority);
      if (draft.newCategory !== undefined) setNewCategory(draft.newCategory);
      if (draft.newDueDate !== undefined) setNewDueDate(draft.newDueDate);
      if (draft.newClientName !== undefined)
        setNewClientName(draft.newClientName);
      if (draft.newIsOutsourced !== undefined)
        setNewIsOutsourced(draft.newIsOutsourced);
      if (draft.newOutsourcedVendor !== undefined)
        setNewOutsourcedVendor(draft.newOutsourcedVendor);
      if (draft.newOutsourceBudget !== undefined)
        setNewOutsourceBudget(draft.newOutsourceBudget);
      showToast("Draft restored");
    } catch {}
  };

  const closeAddTaskModal = (saveDraft = true) => {
    if (saveDraft) {
      saveTaskDraft();
    }
    setIsAddModalOpen(false);
  };

  const openAddTaskModal = (status: TaskStatus = "todo") => {
    setNewStatus(status);
    try {
      const saved = localStorage.getItem("billflow_draft_task");
      setHasTaskDraft(Boolean(saved));
    } catch {
      setHasTaskDraft(false);
    }
    setIsAddModalOpen(true);
  };

  const showToast = React.useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      toastTimerRef.current = null;
      setToastMessage(null);
    }, 3500);
  }, []);

  const saveTask = async (id: string, patch: TaskPatchInput) => {
    if (saving) return false;
    setSaving(true);
    try {
      await workflow.tasks.update(id, patch);
      return true;
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not save task.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitWork = async (patch: TaskPatchInput) => {
    if (!taskForSubmitWork) return;
    const currentId = taskForSubmitWork.id;
    const currentTitle = taskForSubmitWork.title;
    const success = await saveTask(currentId, patch);
    if (success) {
      showToast(
        `Deliverable "${currentTitle.length > 24 ? currentTitle.slice(0, 24) + "..." : currentTitle}" marked Done`,
      );
      setTaskForSubmitWork(null);
    }
  };

  const handleCloseSubmitWork = () => {
    setTaskForSubmitWork(null);
  };

  // Search and Filter logic
  const trimmedSearchQuery = searchQuery.trim().toLowerCase();
  const isSearching = trimmedSearchQuery.length > 0;

  // Base filtered tasks matching priority & category filters
  const baseTasks = useMemo(() => {
    void timeSlotVersion;
    return tasks
      .filter((t) => {
        const matchesPriority =
          selectedPriority === "all" || t.priority === selectedPriority;
        const matchesCategory =
          selectedCategory === "all" || t.category === selectedCategory;
        return matchesPriority && matchesCategory;
      })
      .map((t) => ({ ...t }));
  }, [tasks, selectedPriority, selectedCategory, timeSlotVersion]);

  const isTaskMatch = (title: string) => {
    return isSearching && title.toLowerCase().includes(trimmedSearchQuery);
  };

  // In Kanban, tasks matching search by title float to top of their column
  const getColumnTasks = (status: TaskStatus) => {
    const colTasks = baseTasks.filter((t) => t.status === status);
    if (!isSearching) {
      return colTasks;
    }
    return [...colTasks].sort((a, b) => {
      const aMatch = a.title.toLowerCase().includes(trimmedSearchQuery);
      const bMatch = b.title.toLowerCase().includes(trimmedSearchQuery);
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return 0;
    });
  };

  // In List View, matching tasks float to top
  const displayListTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return baseTasks;
    return [...baseTasks].sort((a, b) => {
      const aMatch = a.title.toLowerCase().includes(query);
      const bMatch = b.title.toLowerCase().includes(query);
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return 0;
    });
  }, [baseTasks, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = tasks.length;
    const inProgress = tasks.filter((t) => t.status === "in-progress").length;
    const outsourced = tasks.filter((t) => t.isOutsourced).length;
    const completed = tasks.filter((t) => t.status === "done").length;
    const completionRate =
      total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, inProgress, outsourced, completed, completionRate };
  }, [tasks]);

  // Drag and Drop handlers (HTML5 native API for robust Next.js/Turbopack compatibility)
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedTaskId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColumn !== status) {
      setDragOverColumn(status);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData("text/plain") || draggedTaskId;
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Moving to 'done' triggers the Submit Work popup before completing
    if (targetStatus === "done" && task.status !== "done") {
      setTaskForSubmitWork(task);
      setDraggedTaskId(null);
      return;
    }

    void saveTask(taskId, { status: targetStatus });
    setDraggedTaskId(null);
  };

  // Outsource navigation handler
  const handleOutsourceTask = (task: TaskItem) => {
    showToast(`Redirecting to Outsourcing for "${task.title.slice(0, 24)}..."`);
    const resolved = resolveDeliveryUrl(task, { invoices, clients });
    // Passes task context in query parameters for the Outsourcing page to prepopulate voucher modal
    const params = new URLSearchParams({
      action: "create-voucher",
      taskId: task.id,
      taskTitle: task.title,
      scope: task.description,
      invoiceId: task.invoiceId || "",
      clientId: task.clientId || "",
      clientName: task.clientName || "",
      deliveryUrl: resolved.url || "",
      currency: task.currency || "LKR",
      vendor: task.outsourcedVendor || "",
      budget: String(task.outsourceBudget || ""),
    });
    router.push(`/outsourcing?${params}`);
  };

  // Create Task or Event Submission (Unified Creation Modal)
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || saving) return;
    setSaving(true);

    const normalizedDate = newDueDate
      ? normalizeAndAutoFixDate(newDueDate)
      : "";
    const normalizedTime = normalizeAndAutoFixTimeRange(
      newStartTime,
      newEndTime,
      newIsAllDay
    );

    if (newRecordType === "event") {
      try {
        await createEvent({
          title: newTitle.trim(),
          description: newDescription.trim(),
          startDate:
            normalizedDate || new Date().toISOString().split("T")[0],
          endDate: normalizedDate || new Date().toISOString().split("T")[0],
          startTime: normalizedTime.isAllDay ? null : normalizedTime.startTime,
          endTime: normalizedTime.isAllDay ? null : normalizedTime.endTime,
          isAllDay: normalizedTime.isAllDay,
          category: newEventCategory,
          color: newEventColor,
          clientId: newClientName || null,
          location: newEventLocation.trim() || null,
        });
        clearTaskDraft();
        closeAddTaskModal(false);
        setNewTitle("");
        setNewDescription("");
        setNewEventLocation("");
        showToast(`Event "${newTitle.trim()}" scheduled in calendar`);
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : "Could not create event."
        );
      } finally {
        setSaving(false);
      }
      return;
    }

    const assignee = {
      name: leadFreelancerName,
      avatarLetter: (leadFreelancerName[0] || "L").toUpperCase(),
      bgColor: "bg-surface-purple-100",
      textColor: "text-content-purple-700",
    };

    const taskId = draftId.current || (draftId.current = crypto.randomUUID());

    const newTask = {
      id: taskId,
      title: newTitle.trim(),
      description: newDescription.trim() || "No detailed description provided.",
      status: newStatus,
      priority: newPriority,
      category: newCategory,
      assignee,
      dueDate: normalizedDate,
      clientId: newClientName || null,
      currency:
        clients.find((client) => client.id === newClientName)?.currency ||
        settings?.defaultCurrency ||
        activeCurrency ||
        "LKR",
      isOutsourced: newIsOutsourced,
      outsourcedVendor: newIsOutsourced ? newOutsourcedVendor : undefined,
      outsourceBudgetCents: newIsOutsourced
        ? Math.round(Number(newOutsourceBudget) * 100)
        : undefined,
      subtasks: [],
    };

    try {
      saveTaskTimeSlot(taskId, {
        startTime: normalizedTime.isAllDay ? null : normalizedTime.startTime,
        endTime: normalizedTime.isAllDay ? null : normalizedTime.endTime,
      });
      await workflow.tasks.create(newTask);
      setTimeSlotVersion((v) => v + 1);
      draftId.current = null;
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not create task.",
      );
      return;
    } finally {
      setSaving(false);
    }
    clearTaskDraft();
    closeAddTaskModal(false);

    // Reset Form
    const createdTitle = newTitle.trim();
    setNewTitle("");
    setNewDescription("");
    setNewIsOutsourced(false);
    showToast(`Task "${createdTitle}" created in ${newStatus.replace("-", " ")}`);
  };

  // Toggle Subtask Completion in Detail Modal
  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task)
      void saveTask(taskId, {
        subtasks: task.subtasks.map((st) =>
          st.id === subtaskId ? { ...st, completed: !st.completed } : st,
        ),
      });
  };
  const handleDeleteTask = async (taskId: string) => {
    if (saving) return;
    const target = tasks.find((t) => t.id === taskId);
    const targetTitle = target?.title;
    setSaving(true);
    try {
      await workflow.tasks.remove(taskId);
      setSelectedTaskForDetail(null);
      showToast(targetTitle ? `Task "${targetTitle}" deleted` : "Task deleted");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not delete task.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="workspace-page motion-page">
      {error && (
        <p role="alert" className="ui-card p-4 text-content-red-700">
          {error}
        </p>
      )}
      {!isLoading && !isElectron && (
        <p className="ui-card p-4">
          Open the desktop app to save tasks and linked work.
        </p>
      )}
      {/* Toast Alert */}
      <MotionPresence>
        {toastMessage && (
          <MotionSurface
            key={toastMessage}
            kind="toast"
            className="bf-toast-popup fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-4 py-3 bg-surface-neutral-900 text-white text-sm font-medium rounded-xl shadow-[0_14px_30px_-6px_rgba(0,0,0,0.38)] border border-line-neutral-800 transition-all"
          >
            {/\b(deleted|removed)\b/i.test(toastMessage) ? (
              <span className="bf-toast-trash-badge w-6 h-6 rounded-lg bg-rose-500/20 border border-rose-500/35 text-rose-400 flex items-center justify-center shrink-0">
                <i className="fa-solid fa-trash" aria-hidden="true" />
              </span>
            ) : /\b(created|added|scheduled)\b/i.test(toastMessage) ? (
              <span className="bf-toast-add-badge w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/35 text-emerald-400 flex items-center justify-center shrink-0">
                <i className="fa-solid fa-circle-plus" aria-hidden="true" />
              </span>
            ) : (
              <div className="w-2.5 h-2.5 rounded-full bg-accent-solid animate-ping shrink-0" />
            )}
            <span>{toastMessage}</span>
            <Button
              aria-label="Close"
              variant="ghost"
              size="icon"
              onClick={() => setToastMessage(null)}
              className="ml-2"
            >
              <X className="w-4 h-4" />
            </Button>
            <span
              aria-hidden="true"
              className={`bf-toast-progress-bar absolute bottom-0 left-0 right-0 h-[2.5px] ${
                /\b(deleted|removed)\b/i.test(toastMessage)
                  ? "bg-rose-500/80"
                  : /\b(created|added|scheduled)\b/i.test(toastMessage)
                    ? "bg-emerald-500/85"
                    : "bg-accent"
              }`}
            />
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Header Section matching Clients & Expenses page alignment */}
      <PageHeader
        title="Tasks"
        description="The work ahead, in progress and ready to deliver."
      >
        {/* View Switcher & Primary Actions in the right corner */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <SegmentedControl
            value={viewMode}
            onChange={(val) => {
              setViewMode(val as "kanban" | "list");
            }}
            label="Task view"
            options={[
              {
                value: "kanban",
                label: (
                  <>
                    <Kanban className="w-4 h-4" />
                    Board
                  </>
                ),
              },
              {
                value: "list",
                label: (
                  <>
                    <List className="w-4 h-4" />
                    List
                  </>
                ),
              },
            ]}
          />

          {/* Jump to Calendar Button */}
          <Button
            variant="secondary"
            onClick={() => {
              document
                .getElementById("task-calendar-section")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
            className="gap-1.5"
            title="Jump to Calendar and milestones at the bottom of the page"
          >
            <Calendar className="w-4 h-4" />
            <span>Calendar</span>
          </Button>

          {/* Create Event Button */}
          <Button
            variant="secondary"
            onClick={() => {
              setCalendarTargetDate(new Date().toISOString().split("T")[0]);
              setCalendarTargetTaskId("");
              setSelectedEventToEdit(null);
              setIsEventModalOpen(true);
            }}
            title="Schedule a client meeting, milestone review, or deadline"
          >
            <Calendar className="w-4 h-4" />
            <span>New Event</span>
          </Button>

          {/* Create Task Button */}
          <Button variant="primary" onClick={() => openAddTaskModal("todo")} className="flex items-center gap-1.5">
            <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
            <span>New Task</span>
          </Button>
        </div>
      </PageHeader>

      {/* ==============================================================          ZENTRA 3-CARD SPRINT BENTO HEADER ROW
         ===================================================================== */}
      <div className="task-overview grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="ui-card p-6 space-y-5">
          <h2>Work in Motion</h2>
          <div>
            <div className="summary-value">{stats.completionRate}%</div>
            <p className="summary-caption">
              {stats.completed} of {stats.total} tasks completed
            </p>
          </div>
          <DataBreakdown
            label="Tasks by current stage"
            total={stats.total}
            rows={[
              {
                label: "To do",
                value: tasks.filter((task) => task.status === "todo").length,
                display: `${tasks.filter((task) => task.status === "todo").length} tasks`,
              },
              {
                label: "In progress",
                value: stats.inProgress,
                display: `${stats.inProgress} tasks`,
              },
              {
                label: "Review",
                value: tasks.filter((task) => task.status === "review").length,
                display: `${tasks.filter((task) => task.status === "review").length} tasks`,
                tone: "pink",
              },
              {
                label: "Done",
                value: stats.completed,
                display: `${stats.completed} tasks`,
                tone: "green",
              },
            ]}
          />
        </section>
        <section className="ui-card p-6 space-y-5">
          <h2>Completed Deliverables</h2>
          <div>
            <div className="summary-value">{stats.completed}</div>
            <p className="summary-caption">Tasks moved to Done</p>
          </div>
          <MonthlyBars
            label="Completed tasks · last six months"
            tone="green"
            formatValue={String}
            points={recentMonths().map((month) => ({
              ...month,
              value: tasks.filter(
                (task) =>
                  task.status === "done" &&
                  task.completedAt?.startsWith(month.key),
              ).length,
            }))}
          />
        </section>
        <section className="ui-card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2>Outsourced</h2>
            <button
              type="button"
              onClick={() => router.push("/outsourcing")}
              className="zentra-circle-btn zentra-circle-btn--sm"
              aria-label="Open Outsourcing"
            >
              <GitFork className="w-4 h-4" />
            </button>
          </div>
          <div>
            <div className="summary-value">{stats.outsourced}</div>
            <p className="summary-caption">Tasks assigned to subcontractors</p>
          </div>
          <DataBreakdown
            label="Outsourced task status"
            total={stats.outsourced}
            rows={[
              {
                label: "In delivery",
                value: tasks.filter(
                  (task) => task.isOutsourced && task.status !== "done",
                ).length,
                display: `${tasks.filter((task) => task.isOutsourced && task.status !== "done").length} tasks`,
                tone: "pink",
              },
              {
                label: "Completed",
                value: tasks.filter(
                  (task) => task.isOutsourced && task.status === "done",
                ).length,
                display: `${tasks.filter((task) => task.isOutsourced && task.status === "done").length} tasks`,
                tone: "green",
              },
            ]}
          />
        </section>
      </div>

      {/* Filter & Search Bar */}
      <div className="ui-card p-3.5 px-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input - Strictly searches task title */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-content-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sprint deliverables by name..."
            className="ui-field ui-search-input w-full !pl-10 pl-10 pr-9 !rounded-full border border-line-neutral-200/90 text-content-neutral-800 placeholder-content-neutral-400 focus:outline-none focus:border-accent transition-all text-xs"
            style={{ paddingLeft: "40px" }}
          />
          {searchQuery && (
            <Button
              aria-label="Clear search"
              variant="ghost"
              size="icon"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 text-content-neutral-400 hover:text-content-neutral-600"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        {/* Dropdowns - Priority & Category */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <SelectDropdown
            value={selectedPriority}
            onChange={setSelectedPriority}
            options={PRIORITY_OPTIONS}
            renderValue={(opt) =>
              opt?.value === "all" ? "Priority: All" : `Priority: ${opt?.label}`
            }
            buttonClassName="ui-field h-[38px] px-3.5 flex items-center justify-between gap-2 !rounded-full border border-line-neutral-200/90 font-medium text-content-neutral-700 text-xs hover:border-line-neutral-300 focus:outline-none focus:border-accent cursor-pointer transition-colors w-36"
            menuClassName="w-40"
          />

          <SelectDropdown
            value={selectedCategory}
            onChange={setSelectedCategory}
            options={CATEGORY_OPTIONS}
            renderValue={(opt) =>
              opt?.value === "all" ? "Category: All" : `Category: ${opt?.label}`
            }
            buttonClassName="ui-field h-[38px] px-3.5 flex items-center justify-between gap-2 !rounded-full border border-line-neutral-200/90 font-medium text-content-neutral-700 text-xs hover:border-line-neutral-300 focus:outline-none focus:border-accent cursor-pointer transition-colors w-40"
            menuClassName="w-44"
          />

          {(selectedPriority !== "all" ||
            selectedCategory !== "all" ||
            searchQuery !== "") && (
            <Button
              variant="ghost"
              size="small"
              onClick={() => {
                setSelectedPriority("all");
                setSelectedCategory("all");
                setSearchQuery("");
              }}
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area: Kanban View vs List View */}
      {viewMode === "kanban" ? (
        /* ZENTRA KANBAN BOARD */
        <div
          key="board"
          className="motion-page grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start"
        >
          {columnDefinitions.map((col) => {
            const columnTasks = getColumnTasks(col.id);
            const totalInCol = columnTasks.length;
            const matchCount = isSearching
              ? columnTasks.filter((t) => isTaskMatch(t.title)).length
              : 0;
            const isDropTarget = dragOverColumn === col.id;
            const colStripeClass =
              col.id === "done"
                ? "zentra-stripe-green"
                : col.id === "in-progress"
                  ? "zentra-stripe-blue"
                  : col.id === "review"
                    ? "zentra-stripe-pink"
                    : "zentra-stripe-amber";

            return (
              <div
                key={col.id}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
                className={`ui-card p-4 transition-all duration-200 min-h-[420px] flex flex-col ${
                  isDropTarget ? "!border-accent ring-2 ring-accent/20" : ""
                }`}
              >
                {/* Column Header + Zentra Striped Accent Bar */}
                <div className="pb-3 mb-3 border-b border-line-neutral-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[15px] text-content-neutral-950 tracking-[-0.02em]">
                        {col.title}
                      </span>
                      <span
                        className={`zentra-pill-badge !px-2 !py-0.5 !text-[11px] ${
                          isSearching && matchCount > 0
                            ? "!bg-accent-faint !text-accent"
                            : ""
                        }`}
                      >
                        {isSearching
                          ? `${matchCount}/${totalInCol}`
                          : totalInCol}
                      </span>
                    </div>

                    {/* Column Quick Add */}
                    <button
                      type="button"
                      onClick={() => openAddTaskModal(col.id)}
                      disabled={!isElectron || isLoading || saving}
                      title={`Add task to ${col.title}`}
                      aria-label={`Add task to ${col.title}`}
                      className="zentra-circle-btn zentra-circle-btn--sm flex items-center justify-center text-content-neutral-600 hover:text-accent"
                    >
                      <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
                    </button>
                  </div>

                  {/* Mini Diagonal-Striped Column Strip */}
                  <div className="w-full h-[8px] rounded-full bg-surface-neutral-100 p-[1.5px] flex items-center">
                    <div
                      style={{
                        width: `${
                          stats.total > 0
                            ? Math.round((totalInCol / stats.total) * 100)
                            : 0
                        }%`,
                      }}
                      className={`h-full rounded-full ${colStripeClass} transition-all duration-500`}
                    />
                  </div>
                </div>

                {/* Column Card Container */}
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {columnTasks.length === 0 ? (
                    <EmptyState compact title={`No tasks in ${col.title}`}>
                      <Button
                        variant="ghost"
                        size="small"
                        disabled={!isElectron || isLoading || saving}
                        onClick={() => openAddTaskModal(col.id)}
                        className="flex items-center gap-1.5"
                      >
                        <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
                        <span>Add a task</span>
                      </Button>
                    </EmptyState>
                  ) : (
                    columnTasks.map((task) => {
                      const completedSubtasks = task.subtasks.filter(
                        (st) => st.completed,
                      ).length;
                      const isDragging = draggedTaskId === task.id;
                      const matched = isTaskMatch(task.title);
                      const dimmed = isSearching && !matched;
                      const taskProgressPct = taskProgress(task);

                      return (
                        <div
                          key={task.id}
                          draggable={!saving}
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          onClick={() => setSelectedTaskForDetail(task)}
                          className={`motion-card group relative bg-surface-neutral-50/75 dark:bg-surface-secondary rounded-[18px] p-4 border transition-all duration-200 cursor-grab active:cursor-grabbing ${
                            isDragging
                              ? "opacity-40 scale-98"
                              : matched
                                ? "ring-2 ring-accent border-accent opacity-100 z-10"
                                : dimmed
                                  ? "opacity-35 dark:opacity-25 grayscale-[70%] border-line-neutral-200/50 shadow-none hover:opacity-75"
                                  : "border-line-neutral-200/80 hover:border-line-neutral-300 hover:bg-surface shadow-2xs"
                          }`}
                        >
                          {/* Top Tag Strip */}
                          <div className="flex items-center justify-between gap-1.5 mb-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-surface border border-line-neutral-200 text-content-neutral-600">
                                {task.category}
                              </span>

                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                  task.priority === "urgent"
                                    ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300"
                                    : task.priority === "high"
                                      ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300"
                                      : task.priority === "medium"
                                        ? "bg-accent-faint text-accent border border-border-accent dark:bg-accent-soft dark:text-accent"
                                        : "bg-surface text-content-neutral-600 border border-line-neutral-200"
                                }`}
                              >
                                {task.priority}
                              </span>

                              {matched && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-accent-soft text-accent uppercase tracking-wider">
                                  Match
                                </span>
                              )}
                            </div>

                            {task.clientName && (
                              <span className="text-[11px] text-content-neutral-400 font-medium truncate max-w-[90px]">
                                {task.clientName}
                              </span>
                            )}
                          </div>

                          {/* Task Title */}
                          <h3 className="text-[13.5px] font-semibold text-content-neutral-950 group-hover:text-accent transition-colors leading-snug">
                            <HighlightText
                              text={task.title}
                              query={searchQuery}
                            />
                          </h3>

                          {/* Description snippet */}
                          <p className="text-xs text-content-neutral-500 mt-1 line-clamp-2 leading-relaxed">
                            {task.description}
                          </p>

                          {/* Inline Zentra Diagonal-Striped Progress Bar */}
                          <div className="mt-3 pt-2.5 border-t border-line-neutral-100">
                            <div className="flex items-center justify-between text-[11px] text-content-neutral-500 mb-1.5">
                              <span className="flex items-center gap-1 font-medium">
                                <CheckSquare className="w-3 h-3 text-content-neutral-400" />
                                <span>
                                  {task.subtasks.length > 0
                                    ? `Subtasks (${completedSubtasks}/${task.subtasks.length})`
                                    : "Progress not measured"}
                                </span>
                              </span>
                              <span className="font-semibold tabular-nums text-content-neutral-900">
                                {taskProgressPct === null
                                  ? "—"
                                  : `${taskProgressPct}%`}
                              </span>
                            </div>
                            <div className="w-full h-[14px] rounded-[5px] bg-surface p-[2px] border border-line-neutral-200/60 flex items-center">
                              <div
                                className={`h-full rounded-[3px] ${colStripeClass} transition-all duration-300`}
                                style={{
                                  width: `${taskProgressPct ?? 0}%`,
                                }}
                              />
                            </div>
                          </div>

                          {/* Bottom Row: Due Date and Direct Outsource / Delivery Actions */}
                          <div className="mt-3 pt-2.5 border-t border-line-neutral-100 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-content-neutral-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-content-neutral-400" />
                              <span>
                                {task.dueDate
                                  ? task.dueDate.replace(", 2026", "")
                                  : "No due date"}
                              </span>
                            </span>

                            <div className="flex items-center gap-1.5">
                              {task.status !== "done" ? (
                                <Button
                                  variant="ghost"
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTaskForSubmitWork(task);
                                  }}
                                  title="Submit work and move deliverable to Done"
                                  className="text-[11px] text-content-emerald-700 dark:text-content-emerald-400 hover:bg-surface-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-1 font-medium"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Submit</span>
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTaskForSubmitWork(task);
                                  }}
                                  title="View handover details or update link"
                                  className="text-[11px] text-content-emerald-700 dark:text-content-emerald-400 hover:bg-surface-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-1 font-medium"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Handover</span>
                                </Button>
                              )}
                              {(() => {
                                const resolved = resolveDeliveryUrl(task, {
                                  invoices,
                                  clients,
                                });
                                if (!resolved.hasLink) return null;
                                return (
                                  <Button
                                    variant="ghost"
                                    size="small"
                                    onClick={(e) =>
                                      openExternalLink(resolved.formattedUrl, e)
                                    }
                                    title={`${resolved.label}: ${resolved.url}`}
                                    className="text-[11px] text-accent flex items-center gap-1"
                                  >
                                    <Link2 className="w-3 h-3" />
                                    <span className="truncate max-w-[72px]">
                                      {resolved.label}
                                    </span>
                                  </Button>
                                );
                              })()}
                              <Button
                                variant="secondary"
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOutsourceTask(task);
                                }}
                                title={
                                  task.isOutsourced
                                    ? `Outsourced to ${task.outsourcedVendor || "Vendor"}. Click to view or create voucher.`
                                    : "Outsource this task to external subcontractor"
                                }
                              >
                                <GitFork
                                  className={`w-3 h-3 transition-transform duration-200 ${
                                    task.isOutsourced ? "text-accent" : ""
                                  }`}
                                />
                                <span className="text-[11px]">
                                  {task.isOutsourced
                                    ? "Outsourced"
                                    : "Outsource"}
                                </span>
                              </Button>
                              <button
                                type="button"
                                disabled={!isElectron || isLoading || saving}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleDeleteTask(task.id);
                                }}
                                title={`Delete task "${task.title}"`}
                                aria-label={`Delete task ${task.title}`}
                                className="p-1.5 rounded-lg text-content-neutral-400 hover:text-content-rose-600 hover:bg-surface-rose-50 transition-colors cursor-pointer"
                              >
                                <i className="fa-solid fa-trash" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div key="list" className="ui-card motion-page overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-light border-b border-line-neutral-200/80 text-xs text-content-neutral-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Task Deliverable</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Outsource Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-neutral-100">
                {displayListTasks.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <EmptyState
                        title="No tasks found"
                        description="Add a deliverable or adjust your filters to find a task."
                      >
                        <Button
                          variant="primary"
                          onClick={() => openAddTaskModal("todo")}
                        >
                          <Plus />
                          New Task
                        </Button>
                      </EmptyState>
                    </td>
                  </tr>
                )}
                {displayListTasks.map((task) => {
                  const matched = isTaskMatch(task.title);
                  const dimmed = isSearching && !matched;

                  return (
                    <tr
                      key={task.id}
                      onClick={() => setSelectedTaskForDetail(task)}
                      className={`transition-colors cursor-pointer group ${
                        matched
                          ? "bg-accent/10 border-l-4 border-l-accent opacity-100"
                          : dimmed
                            ? "opacity-35 dark:opacity-25 grayscale-[70%] hover:opacity-75"
                            : "hover:bg-surface-neutral-50/80"
                      }`}
                    >
                      <td className="py-3.5 px-4 font-medium text-content-neutral-900 max-w-xs">
                        <div className="font-semibold text-content-neutral-900 group-hover:text-accent transition-colors truncate">
                          <HighlightText
                            text={task.title}
                            query={searchQuery}
                          />
                        </div>
                        <div className="text-xs text-content-neutral-400 truncate">
                          {task.clientName
                            ? `Client: ${task.clientName}`
                            : task.description}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-xs px-2 py-0.5 rounded-md bg-surface-neutral-100 text-content-neutral-600 font-medium">
                          {task.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                            task.status === "done"
                              ? "bg-surface-emerald-50 text-content-emerald-700"
                              : task.status === "in-progress"
                                ? "bg-surface-blue-50 text-content-blue-700"
                                : task.status === "review"
                                  ? "bg-surface-amber-50 text-content-amber-700"
                                  : "bg-surface-neutral-100 text-content-neutral-700"
                          }`}
                        >
                          {task.status.replace("-", " ")}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${
                            task.priority === "urgent"
                              ? "bg-surface-rose-100 text-content-rose-800"
                              : task.priority === "high"
                                ? "bg-surface-orange-100 text-content-orange-800"
                                : task.priority === "medium"
                                  ? "bg-surface-amber-100 text-content-amber-800"
                                  : "bg-surface-blue-100 text-content-blue-800"
                          }`}
                        >
                          {task.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-content-neutral-500">
                        {task.dueDate || "No due date"}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTaskForSubmitWork(task);
                            }}
                            className="text-xs text-content-emerald-700 dark:text-content-emerald-400 hover:bg-surface-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-1 font-medium"
                            title={
                              task.status === "done"
                                ? "View handover details"
                                : "Submit work and complete deliverable"
                            }
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>
                              {task.status === "done" ? "Handover" : "Submit"}
                            </span>
                          </Button>
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOutsourceTask(task);
                            }}
                          >
                            <GitFork className="w-3.5 h-3.5" />
                            <span>
                              {task.isOutsourced ? "Outsourced" : "Outsource"}
                            </span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="small"
                            disabled={!isElectron || isLoading || saving}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeleteTask(task.id);
                            }}
                            title={`Delete task "${task.title}"`}
                            aria-label={`Delete task ${task.title}`}
                            className="text-xs text-content-rose-600 hover:bg-surface-rose-50"
                          >
                            <i className="fa-solid fa-trash" aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CALENDAR & SCHEDULE SECTION AT THE END OF TASK PAGE */}
      <section
        id="task-calendar-section"
        className="mt-12 pt-8 border-t border-line-neutral-200/80 space-y-4 scroll-mt-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-accent" />
              <h2 className="text-xl font-newspaper font-semibold text-content-neutral-900 dark:text-content-neutral-100">
                Calendar &amp; Schedule
              </h2>
            </div>
            <p className="text-xs text-content-neutral-500 mt-1">
              Deliverable deadlines, client milestones, and scheduled work events linked with your tasks.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setCalendarTargetDate(new Date().toISOString().split("T")[0]);
                setCalendarTargetTaskId("");
                setSelectedEventToEdit(null);
                setIsEventModalOpen(true);
              }}
              className="gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Schedule Event</span>
            </Button>
          </div>
        </div>

        <TaskCalendarView
          tasks={baseTasks}
          events={events}
          onSelectTask={(task) => setSelectedTaskForDetail(task)}
          onSelectEvent={(evt) => {
            setSelectedEventToEdit(evt);
            setIsEventModalOpen(true);
          }}
          onAddTaskForDate={(dateStr) => {
            setNewDueDate(dateStr);
            openAddTaskModal("todo");
          }}
          onAddEventForDate={(dateStr) => {
            setCalendarTargetDate(dateStr);
            setCalendarTargetTaskId("");
            setSelectedEventToEdit(null);
            setIsEventModalOpen(true);
          }}
          onRescheduleTask={async (taskId, newDate) => {
            const ok = await saveTask(taskId, { dueDate: newDate });
            if (ok) showToast(`Rescheduled task to ${newDate}`);
            return ok;
          }}
          onUpdateTask={async (taskId, patch) => {
            return saveTask(taskId, patch);
          }}
          onDeleteTask={async (taskId) => {
            await handleDeleteTask(taskId);
          }}
          onDeleteEvent={async (eventId) => {
            try {
              await deleteEvent(eventId);
              showToast("Calendar event removed");
            } catch (err) {
              showToast(
                err instanceof Error ? err.message : "Could not delete event."
              );
            }
          }}
          onQuickCreateTask={async (input) => {
            const assignee = {
              name: leadFreelancerName,
              avatarLetter: (leadFreelancerName[0] || "L").toUpperCase(),
              bgColor: "bg-surface-purple-100",
              textColor: "text-content-purple-700",
            };
            const taskId = crypto.randomUUID();
            saveTaskTimeSlot(taskId, {
              startTime: input.startTime || null,
              endTime: input.endTime || null,
            });
            await workflow.tasks.create({
              id: taskId,
              title: input.title,
              description:
                input.description || "Scheduled from Calendar & Local Schedule.",
              status: input.status || "todo",
              priority: input.priority,
              category: input.category,
              assignee,
              dueDate: input.dueDate,
              clientId: null,
              currency: settings?.defaultCurrency || activeCurrency || "LKR",
              subtasks: [],
            });
            setTimeSlotVersion((v) => v + 1);
            showToast(
              `Added task "${input.title}" for ${input.dueDate}${input.startTime ? ` at ${input.startTime}` : ""}`
            );
          }}
          onQuickCreateEvent={async (input) => {
            await createEvent(input);
            showToast(`Scheduled event "${input.title}" for ${input.startDate}`);
          }}
          onNotify={(msg) => showToast(msg)}
        />
      </section>

      {/* UNIFIED CREATE NEW TASK OR EVENT MODAL */}
      <MotionPresence>
        {isAddModalOpen && (
          <Dialog onClose={() => closeAddTaskModal()} width={700}>
            <div className="app-dialog-header">
              <div>
                <h2 className="text-xl font-newspaper font-semibold text-content-neutral-900">
                  {newRecordType === "task"
                    ? "Create New Deliverable"
                    : "Schedule Calendar Event"}
                </h2>
                <p className="text-xs text-content-neutral-500 mt-0.5">
                  {newRecordType === "task"
                    ? "Add a task with scheduled date, time, and optional subcontractor outsourcing."
                    : "Schedule a local calendar event with date, start/end time, and client link."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {hasTaskDraft && newRecordType === "task" && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="small"
                    onClick={handleRestoreTaskDraft}
                    className="text-xs gap-1.5 font-medium border-accent/40 text-accent hover:bg-accent/10"
                    title="Restore previously typed task draft"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </Button>
                )}
              </div>
            </div>
            <form onSubmit={handleCreateTask} className="app-dialog-form">
              <div className="app-dialog-body">
                {/* Record Type Selector (Select Task or Event inside the creation modal) */}
                <div>
                  <label className="block text-xs font-semibold text-content-neutral-700 uppercase tracking-wider mb-1.5">
                    Select Type (Task or Event)
                  </label>
                  <div className="grid grid-cols-2 gap-2.5 p-1 rounded-xl bg-surface-neutral-100 border border-line-neutral-200/80">
                    <button
                      type="button"
                      onClick={() => setNewRecordType("task")}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        newRecordType === "task"
                          ? "bg-accent text-white shadow-xs"
                          : "text-content-neutral-700 hover:text-content-neutral-900"
                      }`}
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Task Deliverable</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewRecordType("event")}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        newRecordType === "event"
                          ? "bg-accent text-white shadow-xs"
                          : "text-content-neutral-700 hover:text-content-neutral-900"
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Calendar Event</span>
                    </button>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold text-content-neutral-700 uppercase tracking-wider mb-1.5">
                    {newRecordType === "task" ? "Task Title" : "Event Title"}{" "}
                    <span className="text-content-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder={
                      newRecordType === "task"
                        ? "e.g. Production Database Migration"
                        : "e.g. Client Sprint Review & AI Architecture Demo"
                    }
                    className="ui-field w-full px-3.5 border border-line-neutral-200 focus:outline-none focus:border-accent transition-all"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-content-neutral-700 uppercase tracking-wider mb-1.5">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Detailed requirements, acceptance criteria, or external links..."
                    className="ui-field ui-textarea w-full px-3.5 border border-line-neutral-200 focus:outline-none focus:border-accent transition-all resize-none"
                  />
                </div>

                {/* Date & Time Row (Available for BOTH Task and Event) */}
                <div className="p-3.5 rounded-xl bg-surface-neutral-50/80 border border-line-neutral-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-content-neutral-700 uppercase tracking-wider">
                      Scheduled Date &amp; Time
                    </span>
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-content-neutral-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newIsAllDay}
                        onChange={(e) => setNewIsAllDay(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-accent focus:ring-accent"
                      />
                      <span>All-day (no specific time)</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-content-neutral-600 mb-1">
                        {newRecordType === "task" ? "Due Date" : "Event Date"}
                      </label>
                      <input
                        type="date"
                        value={newDueDate}
                        onChange={(e) => setNewDueDate(e.target.value)}
                        className="ui-field w-full px-3 border border-line-neutral-200 focus:outline-none focus:border-accent transition-all"
                      />
                    </div>

                    {!newIsAllDay && (
                      <>
                        <div>
                          <label className="block text-[11px] font-semibold text-content-neutral-600 mb-1">
                            Start Time
                          </label>
                          <input
                            type="time"
                            aria-label="Start time"
                            value={newStartTime}
                            onChange={(e) => setNewStartTime(e.target.value)}
                            className="ui-field w-full px-3 border border-line-neutral-200 focus:outline-none focus:border-accent transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-content-neutral-600 mb-1">
                            End Time
                          </label>
                          <input
                            type="time"
                            aria-label="End time"
                            value={newEndTime}
                            onChange={(e) => setNewEndTime(e.target.value)}
                            className="ui-field w-full px-3 border border-line-neutral-200 focus:outline-none focus:border-accent transition-all"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {newRecordType === "task" ? (
                  <>
                    {/* Status & Priority Row */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-content-neutral-700 uppercase tracking-wider mb-1.5">
                          Initial Column / Status
                        </label>
                        <select
                          value={newStatus}
                          onChange={(e) =>
                            setNewStatus(e.target.value as TaskStatus)
                          }
                          className="ui-field w-full px-3.5 border border-line-neutral-200 focus:outline-none focus:border-accent cursor-pointer"
                        >
                          <option value="todo">To Do</option>
                          <option value="in-progress">In Progress</option>
                          <option value="review">Under Review</option>
                          <option value="done">Done</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-content-neutral-700 uppercase tracking-wider mb-1.5">
                          Priority
                        </label>
                        <select
                          value={newPriority}
                          onChange={(e) =>
                            setNewPriority(e.target.value as TaskPriority)
                          }
                          className="ui-field w-full px-3.5 border border-line-neutral-200 focus:outline-none focus:border-accent cursor-pointer"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </div>
                    </div>

                    {/* Category & Client Row */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-content-neutral-700 uppercase tracking-wider mb-1.5">
                          Category
                        </label>
                        <select
                          value={newCategory}
                          onChange={(e) =>
                            setNewCategory(e.target.value as TaskCategory)
                          }
                          className="ui-field w-full px-3.5 border border-line-neutral-200 focus:outline-none focus:border-accent cursor-pointer"
                        >
                          <option value="Development">Development</option>
                          <option value="Design">Design</option>
                          <option value="Infrastructure">Infrastructure</option>
                          <option value="Legal">Legal</option>
                          <option value="Documentation">Documentation</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-content-neutral-700 uppercase tracking-wider mb-1.5">
                          Client Association
                        </label>
                        <select
                          value={newClientName}
                          onChange={(e) => setNewClientName(e.target.value)}
                          className="ui-field w-full px-3.5 border border-line-neutral-200 focus:outline-none focus:border-accent cursor-pointer"
                        >
                          <option value="">No client / Internal</option>
                          {clients.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Subcontractor Outsourcing Section */}
                    <div className="pt-3 border-t border-line-neutral-100">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newIsOutsourced}
                          onChange={(e) => setNewIsOutsourced(e.target.checked)}
                          className="w-4 h-4 rounded text-accent focus:ring-accent border-line-neutral-300"
                        />
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-content-neutral-900">
                          <GitFork className="w-3.5 h-3.5 text-accent" />
                          <span>Outsource this task to an external vendor</span>
                        </div>
                      </label>

                      {newIsOutsourced && (
                        <div className="motion-page mt-3.5 p-3.5 bg-surface-tinted rounded-xl border border-line-purple-200/60 grid grid-cols-2 gap-3.5">
                          <div>
                            <label className="block text-xs font-medium text-content-neutral-700 mb-1">
                              Subcontractor Vendor
                            </label>
                            <select
                              value={newOutsourcedVendor}
                              onChange={(e) =>
                                setNewOutsourcedVendor(e.target.value)
                              }
                              className="ui-field w-full px-3 border border-line-neutral-200 font-medium focus:outline-none focus:border-accent"
                            >
                              <option value="">Select a vendor</option>
                              {vendors.map((vendor) => (
                                <option key={vendor.id} value={vendor.name}>
                                  {vendor.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-content-neutral-700 mb-1">
                              Estimated Budget (
                              {clients.find((client) => client.id === newClientName)
                                ?.currency ||
                                settings?.defaultCurrency ||
                                activeCurrency ||
                                "LKR"}
                              )
                            </label>
                            <input
                              type="number"
                              value={newOutsourceBudget}
                              onChange={(e) =>
                                setNewOutsourceBudget(e.target.value)
                              }
                              placeholder="0"
                              className="ui-field w-full px-3 border border-line-neutral-200 font-medium focus:outline-none focus:border-accent"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  /* Event-specific fields inside the Unified Creation Modal */
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-content-neutral-700 uppercase tracking-wider mb-1.5">
                          Event Type
                        </label>
                        <select
                          value={newEventCategory}
                          onChange={(e) =>
                            setNewEventCategory(e.target.value as EventCategory)
                          }
                          className="ui-field w-full px-3.5 border border-line-neutral-200 focus:outline-none focus:border-accent cursor-pointer"
                        >
                          <option value="meeting">👥 Client Meeting</option>
                          <option value="milestone">🚩 Project Milestone</option>
                          <option value="review">🔍 Deliverable Review</option>
                          <option value="deadline">⏰ Hard Deadline</option>
                          <option value="reminder">🔔 Follow-up Reminder</option>
                          <option value="general">📅 General Schedule</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-content-neutral-700 uppercase tracking-wider mb-1.5">
                          Client Association
                        </label>
                        <select
                          value={newClientName}
                          onChange={(e) => setNewClientName(e.target.value)}
                          className="ui-field w-full px-3.5 border border-line-neutral-200 focus:outline-none focus:border-accent cursor-pointer"
                        >
                          <option value="">No client / Internal</option>
                          {clients.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-content-neutral-700 uppercase tracking-wider mb-1.5">
                          Badge Color
                        </label>
                        <select
                          value={newEventColor}
                          onChange={(e) =>
                            setNewEventColor(e.target.value as EventColor)
                          }
                          className="ui-field w-full px-3.5 border border-line-neutral-200 focus:outline-none focus:border-accent cursor-pointer"
                        >
                          <option value="blue">Ocean Blue</option>
                          <option value="emerald">Emerald</option>
                          <option value="amber">Amber Gold</option>
                          <option value="purple">Royal Purple</option>
                          <option value="rose">Crimson Rose</option>
                          <option value="cyan">Sky Cyan</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-content-neutral-700 uppercase tracking-wider mb-1.5">
                          Location / Meeting Link
                        </label>
                        <input
                          type="text"
                          value={newEventLocation}
                          onChange={(e) => setNewEventLocation(e.target.value)}
                          placeholder="e.g. Google Meet, Zoom, or Office"
                          className="ui-field w-full px-3.5 border border-line-neutral-200 focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="app-dialog-footer">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => closeAddTaskModal()}
                >
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={saving} className="flex items-center gap-1.5">
                  <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
                  <span>
                    {newRecordType === "task"
                      ? "Create Deliverable"
                      : "Schedule Event"}
                  </span>
                </Button>
              </div>
            </form>
          </Dialog>
        )}
      </MotionPresence>

      {/* TASK DETAIL & SUBTASK CHECKLIST DRAWER/MODAL */}
      <MotionPresence>
        {selectedTaskForDetail && (
          <Dialog onClose={() => setSelectedTaskForDetail(null)} width={820}>
            <div className="app-dialog-header">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-md bg-surface-neutral-100 text-content-neutral-600">
                    {selectedTaskForDetail.category}
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                      selectedTaskForDetail.priority === "urgent"
                        ? "bg-surface-rose-100 text-content-rose-800"
                        : selectedTaskForDetail.priority === "high"
                          ? "bg-surface-orange-100 text-content-orange-800"
                          : "bg-surface-amber-100 text-content-amber-800"
                    }`}
                  >
                    {selectedTaskForDetail.priority}
                  </span>
                  {selectedTaskForDetail.clientName && (
                    <span className="text-xs text-content-neutral-400">
                      Client: {selectedTaskForDetail.clientName}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold text-content-neutral-900 leading-snug">
                    {selectedTaskForDetail.title}
                  </h2>
                  <Button
                    variant="ghost"
                    size="small"
                    onClick={() => setTaskForSubmitWork(selectedTaskForDetail)}
                    className="shrink-0 text-xs text-content-emerald-700 dark:text-content-emerald-400 hover:bg-surface-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-1.5 font-medium border border-line-emerald-200/80"
                    title={
                      selectedTaskForDetail.status === "done"
                        ? "View deliverable handover details"
                        : "Submit work and mark deliverable Done"
                    }
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-content-emerald-600" />
                    <span>
                      {selectedTaskForDetail.status === "done"
                        ? "Handover Details"
                        : "Submit Work"}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
            <div className="app-dialog-body">
              {/* Body */}
              <div className="app-dialog-section p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                {/* Description */}
                <div>
                  <h4 className="text-xs font-semibold text-content-neutral-400 uppercase tracking-wider mb-2">
                    Description
                  </h4>
                  <label className="block text-sm">
                    Title
                    <input
                      key={`${selectedTaskForDetail.id}-title`}
                      aria-label="Task title"
                      className="ui-field w-full"
                      defaultValue={selectedTaskForDetail.title}
                      disabled={saving}
                      onBlur={(e) => {
                        if (
                          e.target.value.trim() &&
                          e.target.value !== selectedTaskForDetail.title
                        )
                          void saveTask(selectedTaskForDetail.id, {
                            title: e.target.value,
                          });
                      }}
                    />
                  </label>
                  <textarea
                    key={`${selectedTaskForDetail.id}-description`}
                    aria-label="Task description"
                    className="ui-field ui-textarea w-full mt-3"
                    defaultValue={selectedTaskForDetail.description}
                    disabled={saving}
                    onBlur={(e) => {
                      if (e.target.value !== selectedTaskForDetail.description)
                        void saveTask(selectedTaskForDetail.id, {
                          description: e.target.value,
                        });
                    }}
                  />
                  <div className="flex gap-4 mt-3 text-sm">
                    {selectedTaskForDetail.invoiceId && (
                      <Link
                        href={`/invoices?invoice=${encodeURIComponent(selectedTaskForDetail.invoiceId)}`}
                      >
                        Open {selectedTaskForDetail.invoiceCode || "invoice"}
                      </Link>
                    )}
                    {selectedTaskForDetail.clientId && (
                      <Link
                        href={`/clients?client=${encodeURIComponent(selectedTaskForDetail.clientId)}`}
                      >
                        Open client
                      </Link>
                    )}
                    {(() => {
                      const resolved = resolveDeliveryUrl(
                        selectedTaskForDetail,
                        { invoices, clients },
                      );
                      if (!resolved.hasLink) return null;
                      return (
                        <Button
                          variant="secondary"
                          size="small"
                          type="button"
                          onClick={(e) =>
                            openExternalLink(resolved.formattedUrl, e)
                          }
                          className="inline-flex items-center gap-1.5 text-xs text-accent font-semibold"
                          title={`${resolved.label}: ${resolved.url}`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>{resolved.label}</span>
                        </Button>
                      );
                    })()}
                  </div>
                  <TaskTiming task={selectedTaskForDetail} />
                </div>

                {/* Subtasks Checklist */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <h4 className="text-xs font-semibold text-content-neutral-400 uppercase tracking-wider">
                      Checklist & Subtasks
                    </h4>
                    <span className="text-xs text-content-neutral-500 font-medium">
                      {
                        selectedTaskForDetail.subtasks.filter(
                          (s) => s.completed,
                        ).length
                      }{" "}
                      of {selectedTaskForDetail.subtasks.length} done
                    </span>
                  </div>

                  <div className="space-y-2">
                    {selectedTaskForDetail.subtasks.map((st) => (
                      <div
                        key={st.id}
                        onClick={() =>
                          handleToggleSubtask(selectedTaskForDetail.id, st.id)
                        }
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                          st.completed
                            ? "bg-surface-emerald-50/50 border-line-emerald-200/60 text-content-neutral-500 line-through"
                            : "bg-surface border-line-neutral-200/90 text-content-neutral-900 hover:bg-surface-neutral-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={st.completed}
                          onChange={() => {}}
                          disabled={saving}
                          className="w-4 h-4 rounded text-content-emerald-600 focus:ring-line-emerald-500"
                        />
                        <span className="text-sm font-normal flex-1">
                          {st.title}
                        </span>
                        <Button
                          size="icon"
                          disabled={saving}
                          data-trash-popup="Delete Subtask"
                          aria-label={`Delete subtask ${st.title}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void saveTask(selectedTaskForDetail.id, {
                              subtasks: selectedTaskForDetail.subtasks.filter(
                                (item) => item.id !== st.id,
                              ),
                            });
                          }}
                        >
                          <i className="fa-solid fa-trash" aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <form
                    className="flex gap-2 mt-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (subtaskTitle.trim()) {
                        void saveTask(selectedTaskForDetail.id, {
                          subtasks: [
                            ...selectedTaskForDetail.subtasks,
                            {
                              id: crypto.randomUUID(),
                              title: subtaskTitle.trim(),
                              completed: false,
                            },
                          ],
                        }).then((saved) => {
                          if (saved) setSubtaskTitle("");
                        });
                      }
                    }}
                  >
                    <input
                      aria-label="New subtask"
                      className="ui-field flex-1"
                      value={subtaskTitle}
                      onChange={(e) => setSubtaskTitle(e.target.value)}
                      placeholder="Add a subtask"
                    />
                    <Button
                      type="submit"
                      disabled={saving || !subtaskTitle.trim()}
                    >
                      Add
                    </Button>
                  </form>
                </div>

                {/* Subcontractor Outsourcing Box */}
                <div className="p-4 rounded-xl bg-accent-pale border border-line-purple-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-surface-purple-100 flex items-center justify-center shrink-0 text-accent">
                      <GitFork className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="text-sm font-semibold text-content-neutral-900">
                        {selectedTaskForDetail.isOutsourced
                          ? `Outsourced to ${selectedTaskForDetail.outsourcedVendor}`
                          : "Outsource this Task"}
                      </h5>
                      <p className="text-xs text-content-neutral-600 mt-0.5">
                        {selectedTaskForDetail.isOutsourced
                          ? `Budget: ${selectedTaskForDetail.currency || activeCurrency || "LKR"} ${selectedTaskForDetail.outsourceBudget?.toLocaleString() || "Not set"}. Open Outsourcing to agree the contractor fee.`
                          : "Delegate this task to an external specialist or engineering agency."}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    onClick={() => handleOutsourceTask(selectedTaskForDetail)}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>
                      {selectedTaskForDetail.isOutsourced
                        ? "Open Outsourcing"
                        : "Outsource Task"}
                    </span>
                  </Button>
                </div>

                {/* Status, Priority, Category, Due Date & Time Editable Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 border-t border-line-neutral-100 text-xs">
                  <div>
                    <span className="text-content-neutral-400 block mb-1">
                      Status
                    </span>
                    <select
                      aria-label="Task status"
                      value={selectedTaskForDetail.status}
                      disabled={saving}
                      onChange={(e) => {
                        const newStatus = e.target.value as TaskStatus;
                        if (
                          newStatus === "done" &&
                          selectedTaskForDetail.status !== "done"
                        ) {
                          setTaskForSubmitWork(selectedTaskForDetail);
                        } else {
                          void saveTask(selectedTaskForDetail.id, {
                            status: newStatus,
                          });
                        }
                      }}
                      className="ui-field w-full px-2 border border-line-neutral-200 font-medium text-content-neutral-800"
                    >
                      <option value="todo">To Do</option>
                      <option value="in-progress">In Progress</option>
                      <option value="review">Review</option>
                      <option value="done">Done</option>
                    </select>
                  </div>

                  <div>
                    <span className="text-content-neutral-400 block mb-1">
                      Priority
                    </span>
                    <select
                      aria-label="Task priority"
                      value={selectedTaskForDetail.priority}
                      disabled={saving}
                      onChange={(e) => {
                        void saveTask(selectedTaskForDetail.id, {
                          priority: e.target.value as TaskPriority,
                        });
                      }}
                      className="ui-field w-full px-2 border border-line-neutral-200 font-medium text-content-neutral-800"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <span className="text-content-neutral-400 block mb-1">
                      Category
                    </span>
                    <select
                      aria-label="Task category"
                      value={selectedTaskForDetail.category}
                      disabled={saving}
                      onChange={(e) => {
                        void saveTask(selectedTaskForDetail.id, {
                          category: e.target.value as TaskCategory,
                        });
                      }}
                      className="ui-field w-full px-2 border border-line-neutral-200 font-medium text-content-neutral-800"
                    >
                      <option value="Development">Development</option>
                      <option value="Design">Design</option>
                      <option value="Infrastructure">Infrastructure</option>
                      <option value="Legal">Legal</option>
                      <option value="Documentation">Documentation</option>
                    </select>
                  </div>

                  <div>
                    <span className="text-content-neutral-400 block mb-1">
                      Due Date
                    </span>
                    <input
                      type="date"
                      aria-label="Task due date"
                      value={
                        selectedTaskForDetail.dueDate
                          ? selectedTaskForDetail.dueDate.split("T")[0]
                          : ""
                      }
                      disabled={saving}
                      onChange={(e) => {
                        void saveTask(selectedTaskForDetail.id, {
                          dueDate: e.target.value,
                        });
                      }}
                      className="ui-field w-full px-2 border border-line-neutral-200 font-medium text-content-neutral-800"
                    />
                  </div>

                  <div>
                    <span className="text-content-neutral-400 block mb-1">
                      Start Time
                    </span>
                    <input
                      type="time"
                      aria-label="Task start time"
                      value={
                        selectedTaskForDetail.startTime ??
                        getTaskTimeSlot(selectedTaskForDetail.id)?.startTime ??
                        ""
                      }
                      disabled={saving}
                      onChange={(e) => {
                        const currentSlot = getTaskTimeSlot(selectedTaskForDetail.id);
                        saveTaskTimeSlot(selectedTaskForDetail.id, {
                          startTime: e.target.value || null,
                          endTime:
                            selectedTaskForDetail.endTime ??
                            currentSlot?.endTime ??
                            null,
                        });
                        setTimeSlotVersion((v) => v + 1);
                      }}
                      className="ui-field w-full px-2 border border-line-neutral-200 font-medium text-content-neutral-800"
                    />
                  </div>

                  <div>
                    <span className="text-content-neutral-400 block mb-1">
                      End Time
                    </span>
                    <input
                      type="time"
                      aria-label="Task end time"
                      value={
                        selectedTaskForDetail.endTime ??
                        getTaskTimeSlot(selectedTaskForDetail.id)?.endTime ??
                        ""
                      }
                      disabled={saving}
                      onChange={(e) => {
                        const currentSlot = getTaskTimeSlot(selectedTaskForDetail.id);
                        saveTaskTimeSlot(selectedTaskForDetail.id, {
                          startTime:
                            selectedTaskForDetail.startTime ??
                            currentSlot?.startTime ??
                            "09:00",
                          endTime: e.target.value || null,
                        });
                        setTimeSlotVersion((v) => v + 1);
                      }}
                      className="ui-field w-full px-2 border border-line-neutral-200 font-medium text-content-neutral-800"
                    />
                  </div>
                </div>
              </div>

              {/* Footer with Delete Action */}
            </div>
            <div className="app-dialog-footer">
              <Button
                variant="danger"
                disabled={saving}
                onClick={() => handleDeleteTask(selectedTaskForDetail.id)}
              >
                <i className="fa-solid fa-trash" aria-hidden="true" />
                <span>Delete Task</span>
              </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setCalendarTargetDate(selectedTaskForDetail.dueDate || new Date().toISOString().split("T")[0]);
                      setCalendarTargetTaskId(selectedTaskForDetail.id);
                      setSelectedEventToEdit(null);
                      setIsEventModalOpen(true);
                    }}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Schedule Event</span>
                  </Button>

                  <Button
                    variant="primary"
                    onClick={() => setSelectedTaskForDetail(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </Dialog>
        )}
      </MotionPresence>

      {/* USER LOCAL CALENDAR EVENT MODAL */}
      <EventModal
        isOpen={isEventModalOpen}
        onClose={() => {
          setIsEventModalOpen(false);
          setSelectedEventToEdit(null);
        }}
        eventToEdit={selectedEventToEdit}
        initialDate={calendarTargetDate}
        initialTaskId={calendarTargetTaskId}
        onSaved={(msg) => showToast(msg)}
      />
      {/* SUBMIT WORK POPUP MODAL */}
      <MotionPresence>
        {taskForSubmitWork && (
          <SubmitWorkModal
            key={taskForSubmitWork.id}
            task={taskForSubmitWork}
            isOpen={Boolean(taskForSubmitWork)}
            onClose={handleCloseSubmitWork}
            onSubmit={handleSubmitWork}
            saving={saving}
          />
        )}
      </MotionPresence>
    </div>
  );
}
