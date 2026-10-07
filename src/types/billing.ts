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
  currency: Currency;
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
  currency: Currency;
  driveUrl?: string;
}

export interface ClientPatchInput {
  name?: string;
  category?: string;
  contactPerson?: string;
  contactRole?: string | null;
  email?: string;
  phone?: string | null;
  currency?: Currency;
  driveUrl?: string | null;
}

export type InvoiceStatus = "DRAFT" | "UNPAID" | "ADVANCE_PAID" | "PAID" | "OVERDUE";

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  catalogId?: string | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
  position: number;
}

export interface NewInvoiceItemInput {
  id?: string;
  catalogId?: string | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  amountCents: number;
  currency: Currency;
  receivedAt: string;
  reference: string;
  requestId: string;
}

export interface RecordPaymentInput {
  invoiceId: string;
  amountCents: number;
  currency?: Currency;
  receivedAt?: string;
  reference?: string;
  requestId?: string;
}

export interface Invoice {
  id: string;
  code: string;
  clientId: string | null;
  catalogItemId?: string | null;
  title?: string | null;
  clientSnapshot?: string | null;
  businessSnapshot?: string | null;
  deliveryUrl?: string | null;
  notes?: string | null;
  discountCents?: number;
  taxCents?: number;
  advanceCents?: number;
  trackingEligibleAt?: string | null;
  trackingChoice?: "yes" | "no" | null;
  trackingDecidedAt?: string | null;
  amountCents: number;
  currency: Currency;
  issueDate: string;
  dueDate?: string | null;
  status: InvoiceStatus;
  paidCents: number;
  items?: InvoiceItem[];
  payments?: InvoicePayment[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceWithClient extends Invoice {
  clientName: string;
  clientEmail?: string;
  items?: InvoiceItem[];
  payments?: InvoicePayment[];
}

export interface NewInvoiceInput {
  clientId?: string;
  newClient?: NewClientInput;
  saveAsPermanentClient?: boolean;
  requestId?: string;
  code?: string;
  catalogItemId?: string | null;
  title?: string;
  items?: NewInvoiceItemInput[];
  discountCents?: number;
  taxCents?: number;
  advanceCents?: number;
  deliveryUrl?: string | null;
  notes?: string | null;
  amountCents: number;
  currency: Currency;
  issueDate?: string;
  dueDate?: string | null;
  status?: InvoiceStatus;
}

export interface InvoicePatchInput {
  code?: string;
  clientId?: string;
  catalogItemId?: string | null;
  title?: string;
  items?: NewInvoiceItemInput[];
  discountCents?: number;
  taxCents?: number;
  advanceCents?: number;
  deliveryUrl?: string | null;
  notes?: string | null;
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

export type CatalogCategory = "Development" | "Design" | "Consulting" | "Licensing";
export type CatalogIconType = "code" | "design" | "cloud" | "consulting";

export interface CatalogItem {
  id: string;
  title: string;
  category: CatalogCategory;
  sku: string;
  description: string;
  price: string; // Decimal display value derived from priceCents.
  priceCents: number;
  currency: Currency;
  unit: string;
  iconType: CatalogIconType;
  createdAt?: string;
  updatedAt?: string;
}

export interface NewCatalogItemInput {
  requestId?: string;
  title: string;
  category: CatalogCategory;
  sku: string;
  description?: string;
  price: string;
  currency?: Currency;
  unit?: string;
  iconType?: CatalogIconType;
}

export interface CatalogItemPatchInput {
  title?: string;
  category?: CatalogCategory;
  sku?: string;
  description?: string;
  price?: string;
  currency?: Currency;
  unit?: string;
  iconType?: CatalogIconType;
}
