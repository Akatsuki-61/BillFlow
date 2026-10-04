"use client";

import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Kanban,
  List,
  GitFork,
  Calendar,
  CheckCircle2,
  Clock,
  ChevronDown,
  X,
  ExternalLink,
  CheckSquare,
  Trash2,
} from "lucide-react";
import {
  TaskItem,
  TaskStatus,
  TaskPriority,
  TaskCategory,
} from "@/types/tasks";

// Team member profiles for assignees
const teamMembers = [
  { name: "Nipun Yatawara", avatarLetter: "N", bgColor: "bg-purple-100", textColor: "text-purple-700" },
  { name: "Lahiru Kavinda", avatarLetter: "L", bgColor: "bg-blue-100", textColor: "text-blue-700" },
  { name: "Binuka Madusanka", avatarLetter: "B", bgColor: "bg-emerald-100", textColor: "text-emerald-700" },
  { name: "Sandika Madushan", avatarLetter: "S", bgColor: "bg-amber-100", textColor: "text-amber-700" },
];

// Initial dataset starts blank
const initialTasks: TaskItem[] = [];

const columnDefinitions: { id: TaskStatus; title: string; color: string; badgeBg: string }[] = [
  { id: "todo", title: "To Do", color: "border-neutral-300", badgeBg: "bg-neutral-100 text-neutral-700" },
  { id: "in-progress", title: "In Progress", color: "border-blue-400", badgeBg: "bg-blue-50 text-blue-700 border border-blue-200/60" },
  { id: "review", title: "Under Review", color: "border-amber-400", badgeBg: "bg-amber-50 text-amber-700 border border-amber-200/60" },
  { id: "done", title: "Done", color: "border-emerald-400", badgeBg: "bg-emerald-50 text-emerald-700 border border-emerald-200/60" },
];

export default function TasksPage() {
  const router = useRouter();

  // State
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("all");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<TaskItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State for New Task
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStatus, setNewStatus] = useState<TaskStatus>("todo");
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium");
  const [newCategory, setNewCategory] = useState<TaskCategory>("Development");
  const [newAssigneeName, setNewAssigneeName] = useState(teamMembers[0].name);
  const [newDueDate, setNewDueDate] = useState("");
  const [newClientName, setNewClientName] = useState("Nexus Tech");
  const [newIsOutsourced, setNewIsOutsourced] = useState(false);
  const [newOutsourcedVendor, setNewOutsourcedVendor] = useState("DevOps Nexus");
  const [newOutsourceBudget, setNewOutsourceBudget] = useState("1500");

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesSearch =
        searchQuery === "" ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.clientName && t.clientName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.outsourcedVendor && t.outsourcedVendor.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesPriority =
        selectedPriority === "all" || t.priority === selectedPriority;

      const matchesCategory =
        selectedCategory === "all" || t.category === selectedCategory;

      const matchesAssignee =
        selectedAssignee === "all" || t.assignee.name === selectedAssignee;

      return matchesSearch && matchesPriority && matchesCategory && matchesAssignee;
    });
  }, [tasks, searchQuery, selectedPriority, selectedCategory, selectedAssignee]);

  // Statistics
  const stats = useMemo(() => {
    const total = tasks.length;
    const inProgress = tasks.filter((t) => t.status === "in-progress").length;
    const outsourced = tasks.filter((t) => t.isOutsourced).length;
    const completed = tasks.filter((t) => t.status === "done").length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

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

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t))
    );

    const task = tasks.find((t) => t.id === taskId);
    showToast(`Moved "${task?.title.slice(0, 28)}..." to ${targetStatus.replace("-", " ")}`);
    setDraggedTaskId(null);
  };

  // Outsource navigation handler
  const handleOutsourceTask = (task: TaskItem) => {
    showToast(`Redirecting to Outsourcing for "${task.title.slice(0, 24)}..."`);
    // Passes task context in query parameters for the Outsourcing page to prepopulate voucher modal
    router.push(
      `/outsourcing?action=create-voucher&taskId=${task.id}&taskTitle=${encodeURIComponent(
        task.title
      )}&vendor=${encodeURIComponent(task.outsourcedVendor || "DevOps Nexus")}&budget=${task.outsourceBudget || 1500}`
    );
  };

  // Create Task Submission
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const assignee =
      teamMembers.find((m) => m.name === newAssigneeName) || teamMembers[0];

    const newTask: TaskItem = {
      id: `task-${Date.now()}`,
      title: newTitle.trim(),
      description: newDescription.trim() || "No detailed description provided.",
      status: newStatus,
      priority: newPriority,
      category: newCategory,
      assignee,
      dueDate: newDueDate || "Oct 15, 2026",
      clientName: newClientName,
      isOutsourced: newIsOutsourced,
      outsourcedVendor: newIsOutsourced ? newOutsourcedVendor : undefined,
      outsourceBudget: newIsOutsourced ? parseFloat(newOutsourceBudget) || 1000 : undefined,
      subtasks: [
        { id: `st-${Date.now()}-1`, title: "Initial scope alignment", completed: false },
        { id: `st-${Date.now()}-2`, title: "Review deliverable checkpoint", completed: false },
      ],
      createdAt: new Date().toISOString().split("T")[0],
    };

    setTasks([newTask, ...tasks]);
    setIsAddModalOpen(false);

    // Reset Form
    setNewTitle("");
    setNewDescription("");
    setNewIsOutsourced(false);
    showToast(`Task created in ${newStatus.replace("-", " ")}`);
  };

  // Toggle Subtask Completion in Detail Modal
  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const updatedSubtasks = t.subtasks.map((st) =>
            st.id === subtaskId ? { ...st, completed: !st.completed } : st
          );
          const updated = { ...t, subtasks: updatedSubtasks };
          if (selectedTaskForDetail?.id === taskId) {
            setSelectedTaskForDetail(updated);
          }
          return updated;
        }
        return t;
      })
    );
  };

  // Delete Task
  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (selectedTaskForDetail?.id === taskId) {
      setSelectedTaskForDetail(null);
    }
    showToast("Task removed");
  };

  return (
    <div className="p-8 lg:p-10 max-w-7xl mx-auto space-y-8 motion-page select-none">
      {/* Toast Alert */}
      <MotionPresence>
        {toastMessage && (
          <MotionSurface kind="toast" className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-neutral-900 text-white text-sm font-medium rounded-xl shadow-[0_12px_24px_-6px_rgba(0,0,0,0.25)] border border-neutral-800 transition-all">
            <div className="w-2 h-2 rounded-full bg-[#7c3aed] animate-ping" />
            <span>{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="text-neutral-400 hover:text-white ml-2 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* Header Section matching Clients & Expenses page alignment */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-[42px] font-serif font-normal text-neutral-900 tracking-tight leading-none">
            To-Do & Deliverables
          </h1>
          <p className="text-sm text-neutral-500 mt-2 font-normal">
            Manage your sprint deliverables, task execution, and vendor outsourcing.
          </p>
        </div>

        {/* View Switcher & Primary Action in the right corner */}
        <div className="flex items-center gap-3">
          {/* Board / List Toggle */}
          <div className="flex items-center p-1 bg-neutral-200/70 rounded-xl text-neutral-600 text-xs font-medium">
            <button
              onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "kanban"
                  ? "bg-white text-neutral-900 shadow-xs font-semibold"
                  : "hover:text-neutral-900"
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Board</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "list"
                  ? "bg-white text-neutral-900 shadow-xs font-semibold"
                  : "hover:text-neutral-900"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>

          {/* Create Task Button */}
          <button
            onClick={() => {
              setNewStatus("todo");
              setIsAddModalOpen(true);
            }}
            className="group inline-flex items-center gap-2 px-4 py-2.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-xl text-sm font-medium shadow-[0px_2px_4px_rgba(124,58,237,0.25)] hover:shadow-[0px_4px_8px_rgba(124,58,237,0.35)] transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#7c3aed]/40"
          >
            <Plus className="w-4 h-4 transition-transform duration-200 group-hover:scale-105 group-hover:rotate-6" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Compact Metric Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Total Tasks */}
        <div className="bg-[#ececf0] rounded-xl p-3.5 border border-neutral-200/70 shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.04)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
            <span>Total Tasks</span>
            <CheckSquare className="w-3.5 h-3.5 text-neutral-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-serif text-2xl md:text-[26px] font-normal text-neutral-900 leading-none">
              {stats.total}
            </span>
            <span className="text-[11px] text-neutral-500 font-medium">active items</span>
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-[#ececf0] rounded-xl p-3.5 border border-neutral-200/70 shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.04)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold text-blue-600 uppercase tracking-wider">
            <span>In Progress</span>
            <Clock className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-serif text-2xl md:text-[26px] font-normal text-neutral-900 leading-none">
              {stats.inProgress}
            </span>
            <span className="text-[11px] text-blue-600 font-medium">in current sprint</span>
          </div>
        </div>

        {/* Outsourced Tasks */}
        <div className="bg-[#f2edfc] rounded-xl p-3.5 border border-purple-200/80 shadow-[0px_2px_3px_-1px_rgba(124,58,237,0.06)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold text-purple-700 uppercase tracking-wider">
            <span>Outsourced</span>
            <GitFork className="w-3.5 h-3.5 text-[#7c3aed]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-serif text-2xl md:text-[26px] font-normal text-[#7c3aed] leading-none">
              {stats.outsourced}
            </span>
            <span className="text-[11px] text-purple-700/80 font-medium">subcontracted</span>
          </div>
        </div>

        {/* Completed */}
        <div className="bg-[#ececf0] rounded-xl p-3.5 border border-neutral-200/70 shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.04)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
            <span>Completed</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-serif text-2xl md:text-[26px] font-normal text-neutral-900 leading-none">
              {stats.completed}
            </span>
            <span className="text-[11px] text-emerald-600 font-medium">{stats.completionRate}% finished</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-neutral-200/80 shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.04),0px_1px_0px_0px_rgba(25,28,33,0.02)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search deliverables, clients, vendors..."
            className="w-full pl-10 pr-4 py-2 bg-neutral-50/70 border border-neutral-200/90 rounded-xl text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-[#7c3aed] focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdowns - Equal size and properly inset chevrons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Priority Filter */}
          <div className="relative w-36">
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full appearance-none pl-3.5 pr-8 py-2 bg-neutral-50/70 hover:bg-neutral-100/70 border border-neutral-200/90 rounded-xl text-xs font-medium text-neutral-700 focus:outline-none focus:border-[#7c3aed] cursor-pointer transition-colors truncate"
            >
              <option value="all">Priority: All</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <ChevronDown
              className="w-3.5 h-3.5 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              strokeWidth={2}
            />
          </div>

          {/* Category Filter */}
          <div className="relative w-36">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full appearance-none pl-3.5 pr-8 py-2 bg-neutral-50/70 hover:bg-neutral-100/70 border border-neutral-200/90 rounded-xl text-xs font-medium text-neutral-700 focus:outline-none focus:border-[#7c3aed] cursor-pointer transition-colors truncate"
            >
              <option value="all">Category: All</option>
              <option value="Development">Development</option>
              <option value="Design">Design</option>
              <option value="Infrastructure">Infrastructure</option>
              <option value="Legal">Legal</option>
              <option value="Documentation">Documentation</option>
            </select>
            <ChevronDown
              className="w-3.5 h-3.5 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              strokeWidth={2}
            />
          </div>

          {/* Assignee Filter */}
          <div className="relative w-36">
            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="w-full appearance-none pl-3.5 pr-8 py-2 bg-neutral-50/70 hover:bg-neutral-100/70 border border-neutral-200/90 rounded-xl text-xs font-medium text-neutral-700 focus:outline-none focus:border-[#7c3aed] cursor-pointer transition-colors truncate"
            >
              <option value="all">Assignee: All</option>
              {teamMembers.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="w-3.5 h-3.5 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              strokeWidth={2}
            />
          </div>

          {(selectedPriority !== "all" ||
            selectedCategory !== "all" ||
            selectedAssignee !== "all" ||
            searchQuery !== "") && (
            <button
              onClick={() => {
                setSelectedPriority("all");
                setSelectedCategory("all");
                setSelectedAssignee("all");
                setSearchQuery("");
              }}
              className="text-xs text-neutral-500 hover:text-neutral-900 underline px-2 cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area: Kanban View vs List View */}
      {viewMode === "kanban" ? (
        /* KANBAN BOARD */
        <div key="board" className="motion-page grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
          {columnDefinitions.map((col) => {
            const columnTasks = filteredTasks.filter((t) => t.status === col.id);
            const isDropTarget = dragOverColumn === col.id;

            return (
              <div
                key={col.id}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
                className={`bg-[#f4f4f6]/80 rounded-2xl p-4 border transition-all duration-200 min-h-[580px] flex flex-col ${
                  isDropTarget
                    ? "border-[#7c3aed] bg-[#ede9fe]/30 ring-2 ring-[#7c3aed]/20"
                    : "border-neutral-200/70"
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-neutral-200/70">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-neutral-900 tracking-tight">
                      {col.title}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${col.badgeBg}`}
                    >
                      {columnTasks.length}
                    </span>
                  </div>

                  {/* Column Quick Add */}
                  <button
                    onClick={() => {
                      setNewStatus(col.id);
                      setIsAddModalOpen(true);
                    }}
                    className="p-1 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-200/60 transition-colors cursor-pointer"
                    title={`Add task to ${col.title}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Column Card Container */}
                <div className="space-y-3.5 flex-1 overflow-y-auto">
                  {columnTasks.length === 0 ? (
                    <div className="h-36 flex flex-col items-center justify-center text-center p-4 border border-dashed border-neutral-300 rounded-xl">
                      <p className="text-xs text-neutral-400">No tasks in {col.title}</p>
                      <button
                        onClick={() => {
                          setNewStatus(col.id);
                          setIsAddModalOpen(true);
                        }}
                        className="mt-2 text-xs font-medium text-[#7c3aed] hover:underline cursor-pointer"
                      >
                        + Add a task
                      </button>
                    </div>
                  ) : (
                    columnTasks.map((task) => {
                      const completedSubtasks = task.subtasks.filter(
                        (st) => st.completed
                      ).length;
                      const isDragging = draggedTaskId === task.id;

                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          onClick={() => setSelectedTaskForDetail(task)}
                          className={`motion-card group relative bg-white rounded-xl p-4 border border-neutral-200/80 shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.06),0px_1px_0px_0px_rgba(25,28,33,0.02)] hover:border-neutral-300 hover:shadow-[0px_4px_8px_-2px_rgba(0,0,0,0.08)] transition-all cursor-grab active:cursor-grabbing ${
                            isDragging ? "opacity-40 scale-98" : ""
                          }`}
                        >
                          {/* Top Tag Strip */}
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Category Tag */}
                              <span className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600">
                                {task.category}
                              </span>

                              {/* Priority Pill */}
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                  task.priority === "urgent"
                                    ? "bg-rose-100 text-rose-800"
                                    : task.priority === "high"
                                    ? "bg-orange-100 text-orange-800"
                                    : task.priority === "medium"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {task.priority}
                              </span>
                            </div>

                            {/* Client Association */}
                            {task.clientName && (
                              <span className="text-[11px] text-neutral-400 font-medium truncate max-w-[90px]">
                                {task.clientName}
                              </span>
                            )}
                          </div>

                          {/* Task Title */}
                          <h3 className="text-sm font-semibold text-neutral-900 group-hover:text-[#7c3aed] transition-colors leading-snug">
                            {task.title}
                          </h3>

                          {/* Description snippet */}
                          <p className="text-xs text-neutral-500 mt-1.5 line-clamp-2 leading-relaxed">
                            {task.description}
                          </p>

                          {/* Subtasks Progress Bar */}
                          {task.subtasks.length > 0 && (
                            <div className="mt-3 pt-2.5 border-t border-neutral-100">
                              <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-1">
                                <span className="flex items-center gap-1">
                                  <CheckSquare className="w-3 h-3 text-neutral-400" />
                                  <span>Subtasks</span>
                                </span>
                                <span>
                                  {completedSubtasks}/{task.subtasks.length}
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#7c3aed] rounded-full transition-all duration-300"
                                  style={{
                                    width: `${
                                      (completedSubtasks / task.subtasks.length) * 100
                                    }%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Bottom Row: Assignee, Due Date, and DIRECT OUTSOURCE BUTTON */}
                          <div className="mt-3.5 pt-3 border-t border-neutral-100 flex items-center justify-between gap-2">
                            {/* Assignee & Due Date */}
                            <div className="flex items-center gap-2">
                              {/* Assignee Avatar */}
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${task.assignee.bgColor} ${task.assignee.textColor}`}
                                title={task.assignee.name}
                              >
                                {task.assignee.avatarLetter}
                              </div>

                              <span className="text-[11px] text-neutral-500 flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-neutral-400" />
                                <span>{task.dueDate.replace(", 2026", "")}</span>
                              </span>
                            </div>

                            {/* Direct Outsource Task Button (User Requirement) */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOutsourceTask(task);
                              }}
                              className={`group/outsource inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
                                task.isOutsourced
                                  ? "bg-[#ede9fe] text-[#7c3aed] border border-purple-200/80 hover:bg-[#ddd6fe]"
                                  : "bg-neutral-100 text-neutral-700 hover:bg-[#7c3aed] hover:text-white"
                              }`}
                              title={
                                task.isOutsourced
                                  ? `Outsourced to ${task.outsourcedVendor || "Vendor"}. Click to view or create voucher.`
                                  : "Outsource this task to external subcontractor"
                              }
                            >
                              <GitFork
                                className={`w-3 h-3 transition-transform duration-200 group-hover/outsource:rotate-6 ${
                                  task.isOutsourced ? "text-[#7c3aed]" : ""
                                }`}
                              />
                              <span className="text-[11px]">
                                {task.isOutsourced ? "Outsourced" : "Outsource"}
                              </span>
                            </button>
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
        <div key="list" className="motion-page bg-white rounded-2xl border border-neutral-200/80 overflow-hidden shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.06)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f8f8fa] border-b border-neutral-200/80 text-xs text-neutral-500 uppercase font-semibold">
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
              <tbody className="divide-y divide-neutral-100">
                {filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    onClick={() => setSelectedTaskForDetail(task)}
                    className="hover:bg-neutral-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-medium text-neutral-900 max-w-xs">
                      <div className="font-semibold text-neutral-900 group-hover:text-[#7c3aed] transition-colors truncate">
                        {task.title}
                      </div>
                      <div className="text-xs text-neutral-400 truncate">
                        {task.clientName ? `Client: ${task.clientName}` : task.description}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-xs px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 font-medium">
                        {task.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                          task.status === "done"
                            ? "bg-emerald-50 text-emerald-700"
                            : task.status === "in-progress"
                            ? "bg-blue-50 text-blue-700"
                            : task.status === "review"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-neutral-100 text-neutral-700"
                        }`}
                      >
                        {task.status.replace("-", " ")}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${
                          task.priority === "urgent"
                            ? "bg-rose-100 text-rose-800"
                            : task.priority === "high"
                            ? "bg-orange-100 text-orange-800"
                            : task.priority === "medium"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-blue-800"
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
                        <span className="text-xs text-neutral-700">{task.assignee.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-neutral-500">{task.dueDate}</td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOutsourceTask(task);
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          task.isOutsourced
                            ? "bg-[#ede9fe] text-[#7c3aed] border border-purple-200"
                            : "bg-neutral-100 text-neutral-700 hover:bg-[#7c3aed] hover:text-white"
                        }`}
                      >
                        <GitFork className="w-3.5 h-3.5" />
                        <span>{task.isOutsourced ? "Outsourced" : "Outsource"}</span>
                      </button>
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
          <MotionSurface kind="dialog" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-xs">
            <MotionSurface kind="panel" className="bg-white rounded-2xl w-full max-w-xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.25)] border border-neutral-200 overflow-hidden">
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-newspaper font-semibold text-neutral-900">
                    Create New Deliverable
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Add a task to the board with team assignments and optional subcontractor outsourcing.
                  </p>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleCreateTask} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                {/* Task Title */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Production Database Migration"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-[#7c3aed] focus:bg-white transition-all"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Detailed requirements, acceptance criteria, or external links..."
                    className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-[#7c3aed] focus:bg-white transition-all resize-none"
                  />
                </div>

                {/* Status & Priority Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                      Initial Column / Status
                    </label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as TaskStatus)}
                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-[#7c3aed] cursor-pointer"
                    >
                      <option value="todo">To Do</option>
                      <option value="in-progress">In Progress</option>
                      <option value="review">Under Review</option>
                      <option value="done">Done</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                      Priority
                    </label>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-[#7c3aed] cursor-pointer"
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
                    <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                      Category
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as TaskCategory)}
                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-[#7c3aed] cursor-pointer"
                    >
                      <option value="Development">Development</option>
                      <option value="Design">Design</option>
                      <option value="Infrastructure">Infrastructure</option>
                      <option value="Legal">Legal</option>
                      <option value="Documentation">Documentation</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                      Team Assignee
                    </label>
                    <select
                      value={newAssigneeName}
                      onChange={(e) => setNewAssigneeName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-[#7c3aed] cursor-pointer"
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
                    <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                      Client Association
                    </label>
                    <select
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-[#7c3aed] cursor-pointer"
                    >
                      <option value="Nexus Tech">Nexus Tech</option>
                      <option value="Apex Architecture">Apex Architecture</option>
                      <option value="Vanguard Media">Vanguard Media</option>
                      <option value="Internal">Internal</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                      Due Date
                    </label>
                    <input
                      type="text"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      placeholder="e.g. Oct 12, 2026"
                      className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-[#7c3aed] focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {/* Subcontractor Outsourcing Section */}
                <div className="pt-3 border-t border-neutral-100">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newIsOutsourced}
                      onChange={(e) => setNewIsOutsourced(e.target.checked)}
                      className="w-4 h-4 rounded text-[#7c3aed] focus:ring-[#7c3aed] border-neutral-300"
                    />
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
                      <GitFork className="w-3.5 h-3.5 text-[#7c3aed]" />
                      <span>Outsource this task to an external vendor</span>
                    </div>
                  </label>

                  {newIsOutsourced && (
                    <div className="motion-page mt-3.5 p-3.5 bg-[#f4f4f8] rounded-xl border border-purple-200/60 grid grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">
                          Subcontractor Vendor
                        </label>
                        <select
                          value={newOutsourcedVendor}
                          onChange={(e) => setNewOutsourcedVendor(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-xs font-medium focus:outline-none focus:border-[#7c3aed]"
                        >
                          <option value="Studio ArchiType">Studio ArchiType (UI/UX)</option>
                          <option value="DevOps Nexus">DevOps Nexus (Infra)</option>
                          <option value="ClearCopy Legal">ClearCopy Legal (Contracts)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">
                          Estimated Budget ($ USD)
                        </label>
                        <input
                          type="number"
                          value={newOutsourceBudget}
                          onChange={(e) => setNewOutsourceBudget(e.target.value)}
                          placeholder="1500"
                          className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-xs font-medium focus:outline-none focus:border-[#7c3aed]"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-4 border-t border-neutral-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#7c3aed] text-white text-sm font-medium hover:bg-[#6d28d9] shadow-sm transition-all cursor-pointer"
                  >
                    Create Deliverable
                  </button>
                </div>
              </form>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>

      {/* TASK DETAIL & SUBTASK CHECKLIST DRAWER/MODAL */}
      <MotionPresence>
        {selectedTaskForDetail && (
          <MotionSurface kind="dialog" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-xs">
            <MotionSurface kind="panel" className="bg-white rounded-2xl w-full max-w-2xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.25)] border border-neutral-200 overflow-hidden">
              {/* Header */}
              <div className="px-6 py-5 border-b border-neutral-100 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600">
                      {selectedTaskForDetail.category}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                        selectedTaskForDetail.priority === "urgent"
                          ? "bg-rose-100 text-rose-800"
                          : selectedTaskForDetail.priority === "high"
                          ? "bg-orange-100 text-orange-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {selectedTaskForDetail.priority}
                    </span>
                    {selectedTaskForDetail.clientName && (
                      <span className="text-xs text-neutral-400">
                        Client: {selectedTaskForDetail.clientName}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-semibold text-neutral-900 leading-snug">
                    {selectedTaskForDetail.title}
                  </h2>
                </div>

                <button
                  onClick={() => setSelectedTaskForDetail(null)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                {/* Description */}
                <div>
                  <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Description
                  </h4>
                  <p className="text-sm text-neutral-700 leading-relaxed bg-[#f8f8fa] p-3.5 rounded-xl border border-neutral-200/60">
                    {selectedTaskForDetail.description}
                  </p>
                </div>

                {/* Subtasks Checklist */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                      Checklist & Subtasks
                    </h4>
                    <span className="text-xs text-neutral-500 font-medium">
                      {selectedTaskForDetail.subtasks.filter((s) => s.completed).length} of{" "}
                      {selectedTaskForDetail.subtasks.length} done
                    </span>
                  </div>

                  <div className="space-y-2">
                    {selectedTaskForDetail.subtasks.map((st) => (
                      <div
                        key={st.id}
                        onClick={() => handleToggleSubtask(selectedTaskForDetail.id, st.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                          st.completed
                            ? "bg-emerald-50/50 border-emerald-200/60 text-neutral-500 line-through"
                            : "bg-white border-neutral-200/90 text-neutral-900 hover:bg-neutral-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={st.completed}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm font-normal">{st.title}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Subcontractor Outsourcing Box */}
                <div className="p-4 rounded-xl bg-[#f5f3ff] border border-purple-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center shrink-0 text-[#7c3aed]">
                      <GitFork className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="text-sm font-semibold text-neutral-900">
                        {selectedTaskForDetail.isOutsourced
                          ? `Outsourced to ${selectedTaskForDetail.outsourcedVendor}`
                          : "Outsource this Task"}
                      </h5>
                      <p className="text-xs text-neutral-600 mt-0.5">
                        {selectedTaskForDetail.isOutsourced
                          ? `Budget allocated: $${selectedTaskForDetail.outsourceBudget?.toLocaleString() || "1,500"}. Open Outsourcing view to generate payout voucher.`
                          : "Delegate this task to an external specialist or engineering agency."}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOutsourceTask(selectedTaskForDetail)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer whitespace-nowrap"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>
                      {selectedTaskForDetail.isOutsourced
                        ? "Open Outsourcing"
                        : "Outsource Task"}
                    </span>
                  </button>
                </div>

                {/* Status and Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-neutral-100 text-xs">
                  <div>
                    <span className="text-neutral-400 block mb-1">Status</span>
                    <select
                      value={selectedTaskForDetail.status}
                      onChange={(e) => {
                        const newStat = e.target.value as TaskStatus;
                        setTasks((prev) =>
                          prev.map((t) =>
                            t.id === selectedTaskForDetail.id ? { ...t, status: newStat } : t
                          )
                        );
                        setSelectedTaskForDetail({
                          ...selectedTaskForDetail,
                          status: newStat,
                        });
                      }}
                      className="w-full px-2 py-1 bg-neutral-100 border border-neutral-200 rounded-lg font-medium text-neutral-800"
                    >
                      <option value="todo">To Do</option>
                      <option value="in-progress">In Progress</option>
                      <option value="review">Review</option>
                      <option value="done">Done</option>
                    </select>
                  </div>

                  <div>
                    <span className="text-neutral-400 block mb-1">Assignee</span>
                    <span className="font-semibold text-neutral-800">
                      {selectedTaskForDetail.assignee.name}
                    </span>
                  </div>

                  <div>
                    <span className="text-neutral-400 block mb-1">Due Date</span>
                    <span className="font-semibold text-neutral-800">
                      {selectedTaskForDetail.dueDate}
                    </span>
                  </div>

                  <div>
                    <span className="text-neutral-400 block mb-1">Created</span>
                    <span className="font-semibold text-neutral-800">
                      {selectedTaskForDetail.createdAt}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer with Delete Action */}
              <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between">
                <button
                  onClick={() => handleDeleteTask(selectedTaskForDetail.id)}
                  className="inline-flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-800 font-medium cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Task</span>
                </button>

                <button
                  onClick={() => setSelectedTaskForDetail(null)}
                  className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </MotionSurface>
          </MotionSurface>
        )}
      </MotionPresence>
    </div>
  );
}
