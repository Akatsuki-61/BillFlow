export type Currency = "USD" | "LKR" | "EUR" | "GBP" | "CAD";

export type ClientCategory = "Enterprise" | "Startup" | "Agency" | string;

export interface Client {
  id: string;
  name: string;
  category: ClientCategory;
  contactPerson: string;
  contactRole?: string | null;
  email: string;
  phone?: string | null;
  currency: "USD" | "LKR" | "EUR";
  driveUrl?: string | null;
  hasQuickBill: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientRecentInvoice {
  id: string;
  code: string;
  date: string;
  amountCents: number;
  currency: Currency;
  status: InvoiceStatus;
}

export interface ClientWithStats extends Client {
  totalBilledCents: number;
  totalPaidCents: number;
  outstandingBalanceCents: number;
  invoicesCount: number;
  recentInvoices: ClientRecentInvoice[];
}

export interface NewClientInput {
  name: string;
  category?: string;
  contactPerson?: string;
  contactRole?: string;
  email: string;
  phone?: string;
  currency: "USD" | "LKR" | "EUR";
  driveUrl?: string;
}

export type InvoiceStatus = "DRAFT" | "UNPAID" | "PAID" | "OVERDUE";

export interface Invoice {
  id: string;
  code: string;
  clientId: string;
  title?: string | null;
  amountCents: number;
  currency: Currency;
  issueDate: string;
  dueDate?: string | null;
  status: InvoiceStatus;
  paidCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceWithClient extends Invoice {
  clientName: string;
  clientEmail?: string;
}

export interface NewInvoiceInput {
  clientId: string;
  code?: string;
  title?: string;
  amountCents: number;
  currency: Currency;
  issueDate?: string;
  dueDate?: string | null;
  status?: InvoiceStatus;
}

export interface InvoicePatchInput {
  code?: string;
  clientId?: string;
  title?: string;
  amountCents?: number;
  currency?: Currency;
  dueDate?: string | null;
  status?: InvoiceStatus;
}

export interface DashboardSummary {
  activeClients: number;
  unpaidCount: number;
  totalBilledByCurrency: Record<string, number>;
  outstandingByCurrency: Record<string, number>;
  recentInvoices: InvoiceWithClient[];
}
