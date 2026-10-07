import type { Currency } from "./billing";
import type { AttachmentItem } from "./workflow";

export interface ExpenseItem {
  id: string;
  invoiceId: string | null;
  merchant: string;
  description: string;
  category: string;
  amountCents: number;
  currency: Currency;
  incurredAt: string;
  deductible: boolean;
  createdAt: string;
  attachments?: AttachmentItem[];
}

export interface NewExpenseInput {
  requestId?: string;
  merchant: string;
  description?: string;
  category: string;
  amountCents: number;
  currency?: Currency;
  incurredAt: string;
  deductible?: boolean;
  invoiceId?: string | null;
}

export interface ExpensePatchInput {
  merchant?: string;
  description?: string;
  category?: string;
  amountCents?: number;
  currency?: Currency;
  incurredAt?: string;
  deductible?: boolean;
  invoiceId?: string | null;
}
