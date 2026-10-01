export type TaskStatus = "todo" | "in-progress" | "review" | "done";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type TaskCategory =
  | "Development"
  | "Design"
  | "Client Ops"
  | "Infrastructure"
  | "Legal"
  | "Documentation";

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskAssignee {
  name: string;
  avatarLetter: string;
  bgColor: string;
  textColor: string;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  assignee: TaskAssignee;
  dueDate: string;
  subtasks: Subtask[];
  isOutsourced?: boolean;
  outsourcedVendor?: string;
  outsourceBudget?: number;
  clientName?: string;
  createdAt: string;
}
