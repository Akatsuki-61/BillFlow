// Status definitions for outsourced deliverables
export type OutsourcingStatus = "Ongoing" | "Under Review" | "Done";

// Payment settlement status
export type PayoutStatus = "Unpaid" | "Paid";

// Supported billing currencies
export type Currency = "USD" | "LKR" | "EUR";

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
