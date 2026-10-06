import type { Currency } from "./billing";

// Status definitions for outsourced deliverables
export type OutsourcingStatus = "Ongoing" | "Under Review" | "Done";

// Payment settlement status
export type PayoutStatus = "Unpaid" | "Paid";

// Supported billing currencies
export type { Currency };

// Data interface for an outsourced deliverable task
export interface OutsourcedTask {
  id: string;
  payableInvoiceId: string; // Sequential payable voucher identifier (e.g. VND-INV-1001)
  title: string; // Task or deliverable title
  description: string; // Scope of work and specifications
  vendorName: string; // Assigned external sub-contractor name
  vendorPhone: string; // Contractor WhatsApp contact (E.164 format)
  vendorEmail?: string;
  vendorRole?: string;
  parentInvoiceId: string; // Linked client receivable invoice
  clientName: string; // Client organization name
  payoutAmount: number; // Agreed contractor payout
  currency: Currency;
  targetDeliveryDate: string; // Milestone deadline (YYYY-MM-DD)
  assignedDate: string; // Delegation timestamp (YYYY-MM-DD)
  status: OutsourcingStatus;
  payoutStatus: PayoutStatus;
  paidAt?: string;
  deliverableUrl?: string;
  notes?: string;
}

// Summary statistical model for liabilities and execution
export interface OutsourcingStats {
  totalCommitted: number;
  totalPaid: number;
  totalPending: number;
  activeCount: number;
  underReviewCount: number;
  doneCount: number;
}

// Vendor / Subcontractor entity stored in SQLite DB
export interface VendorItem {
  id: string;
  name: string;
  service: string;
  currentBalance: number; // in dollars for UI display
  status: "PENDING" | "PAID";
  iconType: "design" | "devops" | "legal" | "development";
  email?: string | null;
  phone?: string | null;
  linkedClientId?: string | null;
  linkedClientName?: string | null;
  payoutDueDate?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface NewVendorInput {
  name: string;
  service: string;
  currentBalance?: number;
  balanceCents?: number;
  status?: "PENDING" | "PAID";
  iconType?: "design" | "devops" | "legal" | "development";
  email?: string;
  phone?: string;
  linkedClientId?: string;
  linkedClientName?: string;
  payoutDueDate?: string;
  notes?: string;
}

export interface VendorPatchInput {
  name?: string;
  service?: string;
  currentBalance?: number;
  balanceCents?: number;
  status?: "PENDING" | "PAID";
  iconType?: "design" | "devops" | "legal" | "development";
  email?: string | null;
  phone?: string | null;
  linkedClientId?: string | null;
  linkedClientName?: string | null;
  payoutDueDate?: string | null;
  notes?: string | null;
}

/**
 * Per-job payable work order entity stored in SQLite `work_orders` table.
 * Links an agreed contractor scope, fee, and deadline to a specific vendor,
 * sprint deliverable task, and parent client invoice.
 */
export interface WorkOrderItem {
  id: string;
  vendorId: string;
  taskId: string;
  invoiceId: string;
  scope: string;
  feeCents: number;
  currency: Currency;
  dueDate?: string | null;
  status: "todo" | "in-progress" | "review" | "done";
  completedAt?: string | null;
  deliveryUrl?: string | null;
  notes?: string | null;
  createdAt?: string;

  // Joined/hydrated fields for display:
  vendorName?: string;
  vendorService?: string;
  vendorEmail?: string | null;
  vendorPhone?: string | null;
  vendorIconType?: "design" | "devops" | "legal" | "development";
  taskTitle?: string;
  invoiceCode?: string;
  clientId?: string | null;
  clientName?: string;
  payoutStatus?: "PENDING" | "PAID";
  payoutId?: string | null;
  paidAt?: string | null;
  payoutAmountCents?: number | null;
}

export interface NewWorkOrderInput {
  id?: string;
  vendorId: string;
  taskId: string;
  invoiceId: string;
  scope: string;
  feeCents: number;
  currency: Currency;
  dueDate?: string | null;
  status?: "todo" | "in-progress" | "review" | "done";
  deliveryUrl?: string | null;
  notes?: string | null;
}

export interface WorkOrderPatchInput {
  vendorId?: string;
  scope?: string;
  feeCents?: number;
  currency?: Currency;
  dueDate?: string | null;
  status?: "todo" | "in-progress" | "review" | "done";
  completedAt?: string | null;
  deliveryUrl?: string | null;
  notes?: string | null;
  payoutStatus?: "PENDING" | "PAID";
  updateTask?: boolean;
  taskStatus?: "todo" | "in-progress" | "review" | "done";
}

/** Input for reviewing contractor deliverable and syncing to original task */
export interface ReviewWorkOrderInput {
  workOrderId: string;
  status: "todo" | "in-progress" | "review" | "done";
  deliveryUrl?: string | null;
  notes?: string | null;
  updateTask?: boolean;
}

/** Input for explicitly recording a vendor payout entry */
export interface RecordWorkOrderPayoutInput {
  workOrderId: string;
  amountCents?: number;
  currency?: Currency;
  paidAt?: string;
}
