"use client";

import {
  Button,
  PageHeader,
  SegmentedControl,
  MetricCard,
  EmptyState,
} from "@/components/ui/Workspace";

import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";

import React, { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Kanban,
  List,
  GitFork,
  Calendar,
  ChevronDown,
  X,
  ExternalLink,
  Link2,
  CheckSquare,
  Trash2,
} from "lucide-react";
import {
  TaskItem,
  TaskStatus,
  TaskPriority,
  TaskCategory,
} from "@/types/tasks";

import { useData } from "@/lib/data/DataProvider";
import type { TaskPatchInput } from "@/types/workflow";
import TaskTiming from "@/components/tasks/TaskTiming";
import Link from "next/link";
import { resolveDeliveryUrl, openExternalLink } from "@/lib/deliveryUrl";

// Team member profiles for assignees
const teamMembers = [
  {
    name: "Nipun Yatawara",
    avatarLetter: "N",
    bgColor: "bg-surface-purple-100",
    textColor: "text-content-purple-700",
  },
  {
    name: "Lahiru Kavinda",
    avatarLetter: "L",
    bgColor: "bg-surface-blue-100",
    textColor: "text-content-blue-700",
  },
  {
    name: "Binuka Madusanka",
    avatarLetter: "B",
    bgColor: "bg-surface-emerald-100",
    textColor: "text-content-emerald-700",
  },
  {
    name: "Sandika Madushan",
    avatarLetter: "S",
    bgColor: "bg-surface-amber-100",
    textColor: "text-content-amber-700",
  },
];

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
    badgeBg: "bg-surface-blue-50 text-content-blue-700 border border-line-blue-200/60",
  },
  {
    id: "review",
    title: "Under Review",
    color: "border-line-amber-400",
    badgeBg: "bg-surface-amber-50 text-content-amber-700 border border-line-amber-200/60",
  },
  {
    id: "done",
    title: "Done",
    color: "border-line-emerald-400",
    badgeBg: "bg-surface-emerald-50 text-content-emerald-700 border border-line-emerald-200/60",
  },
];

export default function TasksPage() {
  const router = useRouter();

  // State
  const { tasks, invoices, workflow, clients, vendors, settings, isElectron, isLoading, error, activeCurrency } = useData();
  const [saving, setSaving] = useState(false);
  const draftId = useRef<string | null>(null);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("all");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTaskForDetail = tasks.find(task => task.id === selectedTaskId) || null;
  const setSelectedTaskForDetail = (task: TaskItem | null) => { setSubtaskTitle(""); setSelectedTaskId(task?.id || null); };
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State for New Task
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStatus, setNewStatus] = useState<TaskStatus>("todo");
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium");
  const [newCategory, setNewCategory] = useState<TaskCategory>("Development");
  const [newAssigneeName, setNewAssigneeName] = useState(teamMembers[0].name);
  const [newDueDate, setNewDueDate] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newIsOutsourced, setNewIsOutsourced] = useState(false);
  const [newOutsourcedVendor, setNewOutsourcedVendor] =
    useState("");
  const [newOutsourceBudget, setNewOutsourceBudget] = useState("");

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const saveTask = async (id: string, patch: TaskPatchInput) => {
    if (saving) return false;
    setSaving(true);
    try { await workflow.tasks.update(id, patch); return true; }
    catch (error) { showToast(error instanceof Error ? error.message : "Could not save task."); return false; }
    finally { setSaving(false); }
  };

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesSearch =
        searchQuery === "" ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.clientName &&
          t.clientName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.outsourcedVendor &&
          t.outsourcedVendor.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesPriority =
        selectedPriority === "all" || t.priority === selectedPriority;

      const matchesCategory =
        selectedCategory === "all" || t.category === selectedCategory;

      const matchesAssignee =
        selectedAssignee === "all" || t.assignee.name === selectedAssignee;

      return (
        matchesSearch && matchesPriority && matchesCategory && matchesAssignee
      );
    });
  }, [
    tasks,
    searchQuery,
    selectedPriority,
    selectedCategory,
    selectedAssignee,
  ]);

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

    void saveTask(taskId, { status: targetStatus });
    setDraggedTaskId(null);
  };

  // Outsource navigation handler
  const handleOutsourceTask = (task: TaskItem) => {
    showToast(`Redirecting to Outsourcing for "${task.title.slice(0, 24)}..."`);
    const resolved = resolveDeliveryUrl(task, { invoices, clients });
    // Passes task context in query parameters for the Outsourcing page to prepopulate voucher modal
    const params = new URLSearchParams({ action: "create-voucher", taskId: task.id, taskTitle: task.title, scope: task.description, invoiceId: task.invoiceId || "", clientId: task.clientId || "", clientName: task.clientName || "", deliveryUrl: resolved.url || "", currency: task.currency || "LKR", vendor: task.outsourcedVendor || "", budget: String(task.outsourceBudget || "") });
    router.push(`/outsourcing?${params}`);
  };

  // Create Task Submission
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || saving) return;
    setSaving(true);

    const assignee =
      teamMembers.find((m) => m.name === newAssigneeName) || teamMembers[0];

    const newTask = {
      id: draftId.current || (draftId.current = crypto.randomUUID()),
      title: newTitle.trim(),
      description: newDescription.trim() || "No detailed description provided.",
      status: newStatus,
      priority: newPriority,
      category: newCategory,
      assignee,
      dueDate: newDueDate,
      clientId: newClientName || null,
      currency: clients.find(client => client.id === newClientName)?.currency || settings?.defaultCurrency || activeCurrency || "LKR",
      isOutsourced: newIsOutsourced,
      outsourcedVendor: newIsOutsourced ? newOutsourcedVendor : undefined,
      outsourceBudgetCents: newIsOutsourced
        ? Math.round(Number(newOutsourceBudget) * 100)
        : undefined,
      subtasks: [],
    };

    try { await workflow.tasks.create(newTask); draftId.current = null; }
    catch (error) { showToast(error instanceof Error ? error.message : "Could not create task."); return; }
    finally { setSaving(false); }
    setIsAddModalOpen(false);

    // Reset Form
    setNewTitle("");
    setNewDescription("");
    setNewIsOutsourced(false);
    showToast(`Task created in ${newStatus.replace("-", " ")}`);
  };

  // Toggle Subtask Completion in Detail Modal
  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) void saveTask(taskId, { subtasks: task.subtasks.map(st => st.id === subtaskId ? { ...st, completed: !st.completed } : st) });
  };
  const handleDeleteTask = async (taskId: string) => {
    if (saving) return;
    setSaving(true);
    try { await workflow.tasks.remove(taskId); setSelectedTaskForDetail(null); showToast("Task removed"); }
    catch (error) { showToast(error instanceof Error ? error.message : "Could not delete task."); }
    finally { setSaving(false); }
  };

  return (
    <div className="workspace-page motion-page">
      {error && <p role="alert" className="ui-card p-4 text-content-red-700">{error}</p>}
      {!isLoading && !isElectron && <p className="ui-card p-4">Open the desktop app to save tasks and linked work.</p>}
      {/* Toast Alert */}
      <MotionPresence>
        {toastMessage && (
          <MotionSurface
            kind="toast"
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-surface-neutral-900 text-white text-sm font-medium rounded-xl shadow-[0_12px_24px_-6px_rgba(0,0,0,0.25)] border border-line-neutral-800 transition-all"
          >
            <div className="w-2 h-2 rounded-full bg-accent-solid animate-ping" />
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
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Header Section matching Clients & Expenses page alignment */}
      <PageHeader
        title="Tasks"
        description="Manage your sprint deliverables, task execution, and vendor outsourcing."
      >
        {/* View Switcher & Primary Action in the right corner */}
        <div className="flex items-center gap-3">
          <SegmentedControl
            value={viewMode}
            onChange={setViewMode}
            label="Task view"
            options={[
              {
                value: "kanban",
                label: (
                  <>
                    <Kanban />
                    Board
                  </>
                ),
              },
              {
                value: "list",
                label: (
                  <>
                    <List />
                    List
                  </>
                ),
              },
            ]}
          />

          {/* Create Task Button */}
          <Button
            variant="primary"
            onClick={() => {
              setNewStatus("todo");
              setIsAddModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4 transition-transform duration-200 group-hover:scale-105 group-hover:rotate-6" />
            <span>New Task</span>
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Total Tasks"
          value={stats.total}
          footer="active items"
        />
        <MetricCard
          label="In Progress"
          value={stats.inProgress}
          footer="in current sprint"
        />
        <MetricCard
          label="Outsourced"
          value={stats.outsourced}
          tone="accent"
          footer="subcontracted"
        />
        <MetricCard
          label="Completed"
          value={stats.completed}
          tone="success"
          footer={`${stats.completionRate}% finished`}
        />
      </div>

      {/* Filter & Search Bar */}
      <div className="ui-card p-4 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3.5">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-content-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search deliverables, clients, vendors..."
            className="ui-field w-full pl-10 pr-4 border border-line-neutral-200/90 text-content-neutral-800 placeholder-content-neutral-400 focus:outline-none focus:border-accent transition-all"
          />
          {searchQuery && (
            <Button
              aria-label="Close"
              variant="ghost"
              size="icon"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        {/* Dropdowns - Equal size and properly inset chevrons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Priority Filter */}
          <div className="relative w-36">
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="ui-field w-full appearance-none pl-3.5 pr-8 border border-line-neutral-200/90 font-medium text-content-neutral-700 focus:outline-none focus:border-accent cursor-pointer transition-colors truncate"
            >
              <option value="all">Priority: All</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <ChevronDown
              className="w-3.5 h-3.5 text-content-neutral-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              strokeWidth={2}
            />
          </div>

          {/* Category Filter */}
          <div className="relative w-36">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="ui-field w-full appearance-none pl-3.5 pr-8 border border-line-neutral-200/90 font-medium text-content-neutral-700 focus:outline-none focus:border-accent cursor-pointer transition-colors truncate"
            >
              <option value="all">Category: All</option>
              <option value="Development">Development</option>
              <option value="Design">Design</option>
              <option value="Infrastructure">Infrastructure</option>
              <option value="Legal">Legal</option>
              <option value="Documentation">Documentation</option>
            </select>
            <ChevronDown
              className="w-3.5 h-3.5 text-content-neutral-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              strokeWidth={2}
            />
          </div>

          {/* Assignee Filter */}
          <div className="relative w-36">
            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="ui-field w-full appearance-none pl-3.5 pr-8 border border-line-neutral-200/90 font-medium text-content-neutral-700 focus:outline-none focus:border-accent cursor-pointer transition-colors truncate"
            >
              <option value="all">Assignee: All</option>
              {teamMembers.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="w-3.5 h-3.5 text-content-neutral-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              strokeWidth={2}
            />
          </div>

          {(selectedPriority !== "all" ||
            selectedCategory !== "all" ||
            selectedAssignee !== "all" ||
            searchQuery !== "") && (
            <Button
              variant="ghost"
              onClick={() => {
                setSelectedPriority("all");
                setSelectedCategory("all");
                setSelectedAssignee("all");
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
        /* KANBAN BOARD */
        <div
          key="board"
          className="motion-page grid grid-cols-1 md:grid-cols-2 md:grid-cols-4 gap-6 items-start"
        >
          {columnDefinitions.map((col) => {
            const columnTasks = filteredTasks.filter(
              (t) => t.status === col.id,
            );
            const isDropTarget = dragOverColumn === col.id;

            return (
              <div
                key={col.id}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
                className={`bg-surface-cool/80 rounded-2xl p-4 border transition-all duration-200 min-h-[360px] flex flex-col ${
                  isDropTarget
                    ? "border-accent bg-accent-soft/30 ring-2 ring-accent/20"
                    : "border-line-neutral-200/70"
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-line-neutral-200/70">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-content-neutral-900 tracking-tight">
                      {col.title}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${col.badgeBg}`}
                    >
                      {columnTasks.length}
                    </span>
                  </div>

                  {/* Column Quick Add */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setNewStatus(col.id);
                      setIsAddModalOpen(true);
                    }}

                    disabled={!isElectron || isLoading || saving}
                    title={`Add task to ${col.title}`}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {/* Column Card Container */}
                <div className="space-y-3.5 flex-1 overflow-y-auto">
                  {columnTasks.length === 0 ? (
                    <EmptyState compact title={`No tasks in ${col.title}`}>
                      <Button
                        variant="ghost"
                        size="small"
                        disabled={!isElectron || isLoading || saving}
                        onClick={() => {
                          setNewStatus(col.id);
                          setIsAddModalOpen(true);
                        }}
                      >
                        <Plus />
                        Add a task
                      </Button>
                    </EmptyState>
                  ) : (
                    columnTasks.map((task) => {
                      const completedSubtasks = task.subtasks.filter(
                        (st) => st.completed,
                      ).length;
                      const isDragging = draggedTaskId === task.id;

                      return (
                        <div
                          key={task.id}
                          draggable={!saving}
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          onClick={() => setSelectedTaskForDetail(task)}
                          className={`motion-card group relative bg-surface rounded-xl p-4 border border-line-neutral-200/80 shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.06),0px_1px_0px_0px_rgba(25,28,33,0.02)] hover:border-line-neutral-300 hover:shadow-[0px_4px_8px_-2px_rgba(0,0,0,0.08)] transition-all cursor-grab active:cursor-grabbing ${
                            isDragging ? "opacity-40 scale-98" : ""
                          }`}
                        >
                          {/* Top Tag Strip */}
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Category Tag */}
                              <span className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-md bg-surface-neutral-100 text-content-neutral-600">
                                {task.category}
                              </span>

                              {/* Priority Pill */}
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider ${
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
                            </div>

                            {/* Client Association */}
                            {task.clientName && (
                              <span className="text-[11px] text-content-neutral-400 font-medium truncate max-w-[90px]">
                                {task.clientName}
                              </span>
                            )}
                          </div>

                          {/* Task Title */}
                          <h3 className="text-sm font-semibold text-content-neutral-900 group-hover:text-accent transition-colors leading-snug">
                            {task.title}
                          </h3>

                          {/* Description snippet */}
                          <p className="text-xs text-content-neutral-500 mt-1.5 line-clamp-2 leading-relaxed">
                            {task.description}
                          </p>

                          {/* Subtasks Progress Bar */}
                          {task.subtasks.length > 0 && (
                            <div className="mt-3 pt-2.5 border-t border-line-neutral-100">
                              <div className="flex items-center justify-between text-[11px] text-content-neutral-500 mb-1">
                                <span className="flex items-center gap-1">
                                  <CheckSquare className="w-3 h-3 text-content-neutral-400" />
                                  <span>Subtasks</span>
                                </span>
                                <span>
                                  {completedSubtasks}/{task.subtasks.length}
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-surface-neutral-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-accent-solid rounded-full transition-all duration-300"
                                  style={{
                                    width: `${
                                      (completedSubtasks /
                                        task.subtasks.length) *
                                      100
                                    }%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Bottom Row: Assignee, Due Date, and DIRECT OUTSOURCE BUTTON */}
                          <div className="mt-3.5 pt-3 border-t border-line-neutral-100 flex items-center justify-between gap-2">
                            {/* Assignee & Due Date */}
                            <div className="flex items-center gap-2">
                              {/* Assignee Avatar */}
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${task.assignee.bgColor} ${task.assignee.textColor}`}
                                title={task.assignee.name}
                              >
                                {task.assignee.avatarLetter}
                              </div>

                              <span className="text-[11px] text-content-neutral-500 flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-content-neutral-400" />
                                <span>
                                  {task.dueDate.replace(", 2026", "")}
                                </span>
                              </span>
                            </div>

                            {/* Direct Outsource Task & Delivery Buttons */}
                            <div className="flex items-center gap-1.5">
                              {(() => {
                                const resolved = resolveDeliveryUrl(task, { invoices, clients });
                                if (!resolved.hasLink) return null;
                                return (
                                  <Button
                                    variant="ghost"
                                    size="small"
                                    onClick={(e) => openExternalLink(resolved.formattedUrl, e)}
                                    title={`${resolved.label}: ${resolved.url}`}
                                    className="text-[11px] text-accent flex items-center gap-1"
                                  >
                                    <Link2 className="w-3 h-3" />
                                    <span className="truncate max-w-[80px]">{resolved.label}</span>
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
                                  className={`w-3 h-3 transition-transform duration-200 group-hover/outsource:rotate-6 ${
                                    task.isOutsourced ? "text-accent" : ""
                                  }`}
                                />
                                <span className="text-[11px]">
                                  {task.isOutsourced ? "Outsourced" : "Outsource"}
                                </span>
                              </Button>
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
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Outsource Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-neutral-100">
                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <EmptyState
                        title="No tasks found"
                        description="Add a deliverable or adjust your filters to find a task."
                      >
                        <Button
                          variant="primary"
                          onClick={() => {
                            setNewStatus("todo");
                            setIsAddModalOpen(true);
                          }}
                        >
                          <Plus />
                          New Task
                        </Button>
                      </EmptyState>
                    </td>
                  </tr>
                )}
                {filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    onClick={() => setSelectedTaskForDetail(task)}
                    className="hover:bg-surface-neutral-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-medium text-content-neutral-900 max-w-xs">
                      <div className="font-semibold text-content-neutral-900 group-hover:text-accent transition-colors truncate">
                        {task.title}
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
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${task.assignee.bgColor} ${task.assignee.textColor}`}
                        >
                          {task.assignee.avatarLetter}
                        </div>
                        <span className="text-xs text-content-neutral-700">
                          {task.assignee.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-content-neutral-500">
                      {task.dueDate}
                    </td>
                    <td className="py-3.5 px-4 text-right">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE NEW TASK MODAL */}
      <MotionPresence>
        {isAddModalOpen && (
          <MotionSurface
            kind="dialog"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-neutral-900/40 backdrop-blur-xs"
          >
            <MotionSurface
              onDismiss={() => setIsAddModalOpen(false)}
              kind="panel"
              className="bg-surface rounded-2xl w-full max-w-xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.25)] border border-line-neutral-200 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-line-neutral-100 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-newspaper font-semibold text-content-neutral-900">
                    Create New Deliverable
                  </h2>
                  <p className="text-xs text-content-neutral-500 mt-0.5">
                    Add a task to the board with team assignments and optional
                    subcontractor outsourcing.
                  </p>
                </div>
                <Button
                  aria-label="Close"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Modal Form */}
              <form
                onSubmit={handleCreateTask}
                className="p-6 space-y-4 max-h-[80vh] overflow-y-auto"
              >
                {/* Task Title */}
                <div>
                  <label className="block text-xs font-semibold text-content-neutral-700 uppercase tracking-wider mb-1.5">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Production Database Migration"
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

                {/* Category & Assignee Row */}
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
                      Team Assignee
                    </label>
                    <select
                      value={newAssigneeName}
                      onChange={(e) => setNewAssigneeName(e.target.value)}
                      className="ui-field w-full px-3.5 border border-line-neutral-200 focus:outline-none focus:border-accent cursor-pointer"
                    >
                      {teamMembers.map((m) => (
                        <option key={m.name} value={m.name}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Client & Due Date Row */}
                <div className="grid grid-cols-2 gap-4">
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
                      {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-content-neutral-700 uppercase tracking-wider mb-1.5">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      placeholder="e.g. Oct 12, 2026"
                      className="ui-field w-full px-3.5 border border-line-neutral-200 focus:outline-none focus:border-accent transition-all"
                    />
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
                          {vendors.map(vendor => <option key={vendor.id} value={vendor.name}>{vendor.name}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-content-neutral-700 mb-1">
                          Estimated Budget ({clients.find(client => client.id === newClientName)?.currency || settings?.defaultCurrency || activeCurrency || "LKR"})
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

                {/* Action Buttons */}
                <div className="pt-4 border-t border-line-neutral-100 flex items-center justify-end gap-3">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" disabled={saving}>
                    Create Deliverable
                  </Button>
                </div>
              </form>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* TASK DETAIL & SUBTASK CHECKLIST DRAWER/MODAL */}
      <MotionPresence>
        {selectedTaskForDetail && (
          <MotionSurface
            kind="dialog"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-neutral-900/40 backdrop-blur-xs"
          >
            <MotionSurface
              onDismiss={() => setSelectedTaskForDetail(null)}
              kind="panel"
              className="bg-surface rounded-2xl w-full max-w-2xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.25)] border border-line-neutral-200 overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-line-neutral-100 flex items-start justify-between gap-4">
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
                  <h2 className="text-xl font-semibold text-content-neutral-900 leading-snug">
                    {selectedTaskForDetail.title}
                  </h2>
                </div>

                <Button
                  aria-label="Close"
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedTaskForDetail(null)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                {/* Description */}
                <div>
                  <h4 className="text-xs font-semibold text-content-neutral-400 uppercase tracking-wider mb-2">
                    Description
                  </h4>
                  <label className="block text-sm">Title<input key={`${selectedTaskForDetail.id}-title`} aria-label="Task title" className="ui-field w-full" defaultValue={selectedTaskForDetail.title} disabled={saving} onBlur={e => { if (e.target.value.trim() && e.target.value !== selectedTaskForDetail.title) void saveTask(selectedTaskForDetail.id, { title: e.target.value }); }} /></label>
                  <textarea key={`${selectedTaskForDetail.id}-description`} aria-label="Task description" className="ui-field ui-textarea w-full mt-3" defaultValue={selectedTaskForDetail.description} disabled={saving} onBlur={e => { if (e.target.value !== selectedTaskForDetail.description) void saveTask(selectedTaskForDetail.id, { description: e.target.value }); }} />
                  <div className="flex gap-4 mt-3 text-sm">
                    {selectedTaskForDetail.invoiceId && <Link href={`/invoices?invoice=${encodeURIComponent(selectedTaskForDetail.invoiceId)}`}>Open {selectedTaskForDetail.invoiceCode || "invoice"}</Link>}
                    {selectedTaskForDetail.clientId && <Link href={`/clients?client=${encodeURIComponent(selectedTaskForDetail.clientId)}`}>Open client</Link>}
                    {(() => {
                      const resolved = resolveDeliveryUrl(selectedTaskForDetail, { invoices, clients });
                      if (!resolved.hasLink) return null;
                      return (
                        <Button
                          variant="secondary"
                          size="small"
                          type="button"
                          onClick={(e) => openExternalLink(resolved.formattedUrl, e)}
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
                        <span className="text-sm font-normal flex-1">{st.title}</span>
                        <Button size="icon" disabled={saving} aria-label={`Delete subtask ${st.title}`} onClick={e => { e.stopPropagation(); void saveTask(selectedTaskForDetail.id, { subtasks: selectedTaskForDetail.subtasks.filter(item => item.id !== st.id) }); }}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    ))}
                  </div>
                  <form className="flex gap-2 mt-3" onSubmit={e => { e.preventDefault(); if (subtaskTitle.trim()) { void saveTask(selectedTaskForDetail.id, { subtasks: [...selectedTaskForDetail.subtasks, { id: crypto.randomUUID(), title: subtaskTitle.trim(), completed: false }] }).then(saved => { if (saved) setSubtaskTitle(""); }); } }}>
                    <input aria-label="New subtask" className="ui-field flex-1" value={subtaskTitle} onChange={e => setSubtaskTitle(e.target.value)} placeholder="Add a subtask" />
                    <Button type="submit" disabled={saving || !subtaskTitle.trim()}>Add</Button>
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

                {/* Status and Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-line-neutral-100 text-xs">
                  <div>
                    <span className="text-content-neutral-400 block mb-1">Status</span>
                    <select
                      value={selectedTaskForDetail.status}
                      disabled={saving}
                      onChange={(e) => void saveTask(selectedTaskForDetail.id, { status: e.target.value as TaskStatus })}
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
                      Assignee
                    </span>
                    <span className="font-semibold text-content-neutral-800">
                      {selectedTaskForDetail.assignee.name}
                    </span>
                  </div>

                  <div>
                    <span className="text-content-neutral-400 block mb-1">
                      Due Date
                    </span>
                    <span className="font-semibold text-content-neutral-800">
                      {selectedTaskForDetail.dueDate}
                    </span>
                  </div>

                  <div>
                    <span className="text-content-neutral-400 block mb-1">Created</span>
                    <span className="font-semibold text-content-neutral-800">
                      {selectedTaskForDetail.createdAt}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer with Delete Action */}
              <div className="px-6 py-4 bg-surface-neutral-50 border-t border-line-neutral-100 flex items-center justify-between">
                <Button
                  variant="danger"
                  disabled={saving}
                  onClick={() => handleDeleteTask(selectedTaskForDetail.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Task</span>
                </Button>

                <Button
                  variant="primary"
                  onClick={() => setSelectedTaskForDetail(null)}
                >
                  Close
                </Button>
              </div>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>
    </div>
  );
}
