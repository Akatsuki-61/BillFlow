import type { Currency, InvoiceTemplateId, InvoiceWithClient } from "./billing";

export type QuoteStatus =
  | "DRAFT"
  | "SENT"
  | "APPROVED"
  | "DECLINED"
  | "CONVERTED";

export interface QuoteItemRecord {
  id: string;
  quoteId: string;
  catalogId?: string | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
  position: number;
}

export interface QuoteWithClient {
  id: string;
  code: string;
  clientId: string | null;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientBillingAddress?: string | null;
  clientContactPerson?: string | null;
  clientCategory?: string | null;
  title?: string | null;
  currency: Currency;
  discountCents: number;
  taxCents: number;
  advanceCents: number;
  amountCents: number;
  issueDate: string;
  validUntil?: string | null;
  status: QuoteStatus;
  template?: InvoiceTemplateId | string | null;
  deliveryUrl?: string | null;
  notes?: string | null;
  convertedInvoiceId?: string | null;
  convertedInvoiceCode?: string | null;
  convertedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items: QuoteItemRecord[];
}

export interface NewQuoteInput {
  clientId?: string;
  newClient?: {
    name: string;
    category?: string;
    contactPerson?: string;
    email: string;
    phone?: string;
    whatsappPhone?: string | null;
    billingAddress?: string | null;
    currency?: Currency;
    driveUrl?: string;
  };
  saveAsPermanentClient?: boolean;
  code?: string;
  title?: string;
  items: Array<{
    id?: string;
    description: string;
    quantity: number;
    unitPriceCents: number;
    catalogId?: string | null;
  }>;
  discountCents?: number;
  taxCents?: number;
  advanceCents?: number;
  amountCents: number;
  currency: Currency;
  issueDate?: string;
  validUntil?: string | null;
  status?: Exclude<QuoteStatus, "CONVERTED">;
  template?: string | null;
  deliveryUrl?: string | null;
  notes?: string | null;
}

export type QuotePatchInput = Partial<
  Omit<NewQuoteInput, "newClient" | "saveAsPermanentClient">
>;

export interface ConvertQuoteInput {
  quoteId: string;
  status?: "DRAFT" | "UNPAID";
  dueDate?: string | null;
  advanceCents?: number;
}

export interface ConvertQuoteResult {
  quote: QuoteWithClient;
  invoice: InvoiceWithClient;
}
