import type { Currency } from "./billing";
import type { TaskItem, TaskStatus } from "./tasks";

export type TaskCreateInput = Pick<TaskItem, "id" | "title" | "description" | "status" | "priority" | "category" | "assignee" | "dueDate" | "subtasks"> & Partial<Pick<TaskItem, "clientId" | "clientName" | "deliveryUrl" | "currency" | "isOutsourced" | "outsourcedVendor" | "outsourceBudgetCents">>;
export type TaskPatchInput = Partial<Omit<TaskCreateInput, "id" | "clientId" | "clientName">>;
export interface TaskHistoryEntry { id: string; taskId: string; fromStatus: string | null; toStatus: string; occurredAt: string }
export interface TrackingOffer { invoiceId: string; code: string; clientName: string; eligibleAt: string; advanceCents: number; receivedCents: number; currency: Currency }
export type AttachmentOwner = { type: "payment" | "expense" | "payout"; id: string };
export interface AttachmentItem {
  id: string; paymentId: string | null; expenseId: string | null; payoutId: string | null;
  originalName: string; mimeType: string; sizeBytes: number; createdAt: string;
}
export interface WorkflowAPI {
  tasks: {
    list: () => Promise<TaskItem[]>;
    create: (input: TaskCreateInput) => Promise<TaskItem>;
    update: (id: string, patch: TaskPatchInput) => Promise<TaskItem>;
    remove: (id: string) => Promise<void>;
    history: (id: string) => Promise<TaskHistoryEntry[]>;
  };
  tracking: {
    pending: () => Promise<TrackingOffer[]>;
    decide: (invoiceId: string, choice: "yes" | "no") => Promise<{ choice: "yes" | "no"; taskIds: string[] }>;
  };
  attachments: {
    list: (owner: AttachmentOwner) => Promise<AttachmentItem[]>;
    select: (owner: AttachmentOwner, requestId: string) => Promise<AttachmentItem | null>;
    open: (id: string) => Promise<void>;
  };
  files: {
    selectPdfDirectory: () => Promise<string | null>;
    openInvoicePdf: (invoiceId: string, reveal?: boolean) => Promise<void>;
  };
}

export interface TaskTransition { status: TaskStatus; startedAt: string | null; completedAt: string | null; activeSince: string | null; activeMilliseconds: number }
