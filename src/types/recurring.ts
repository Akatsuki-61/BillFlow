import type { Currency, InvoiceTemplateId } from "./billing";

export type RecurringCadence =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "yearly";

export type RecurringAutoStatus = "DRAFT" | "UNPAID";

export interface RecurringRuleLineItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
  catalogId?: string | null;
}

export interface RecurringRuleItem {
  id: string;
  clientId: string;
  clientName?: string;
  clientEmail?: string | null;
  title: string;
  cadence: RecurringCadence;
  dayOfMonth?: number | null;
  currency: Currency;
  items: RecurringRuleLineItem[];
  discountCents: number;
  taxCents: number;
  advanceCents: number;
  amountCents: number;
  dueDays: number;
  autoStatus: RecurringAutoStatus;
  autoExportPdf: boolean;
  notes?: string | null;
  deliveryUrl?: string | null;
  paymentUrl?: string | null;
  template?: InvoiceTemplateId | string | null;
  nextRunDate: string;
  lastRunDate?: string | null;
  lastInvoiceId?: string | null;
  lastInvoiceCode?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NewRecurringRuleInput {
  clientId: string;
  title: string;
  cadence: RecurringCadence;
  dayOfMonth?: number | null;
  currency: Currency;
  items: RecurringRuleLineItem[];
  discountCents?: number;
  taxCents?: number;
  advanceCents?: number;
  amountCents: number;
  dueDays?: number;
  autoStatus?: RecurringAutoStatus;
  autoExportPdf?: boolean;
  notes?: string | null;
  deliveryUrl?: string | null;
  paymentUrl?: string | null;
  template?: string | null;
  nextRunDate: string;
  isActive?: boolean;
}

export type RecurringRulePatchInput = Partial<NewRecurringRuleInput>;

export interface RecurringRunResult {
  generated: Array<{
    ruleId: string;
    invoiceId: string;
    invoiceCode: string;
    pdfPath?: string | null;
  }>;
  skipped: Array<{
    ruleId: string;
    reason: string;
  }>;
}
