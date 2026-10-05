import type { Currency } from "./billing";

export type DateFormat = "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY";
export type CurrencyDisplayMode = "symbol" | "code";

export interface AppSettings {
  id: string;
  businessName: string;
  professionalTitle?: string | null;
  email: string;
  phone?: string | null;
  website?: string | null;
  taxId?: string | null;
  address?: string | null;
  paymentDetails?: string | null;
  defaultCurrency: Currency;
  invoicePrefix: string;
  nextInvoiceSeq: number;
  defaultDueDays: number;
  defaultTaxRate: number;
  defaultNotes?: string | null;
  dateFormat: DateFormat;
  currencyDisplay: CurrencyDisplayMode;
  pdfExportDirectory?: string | null;
  updatedAt: string;
}

export type UpdateSettingsInput = Partial<Omit<AppSettings, "id" | "updatedAt">>;

export interface ExportDataPayload {
  version: string;
  exportedAt: string;
  settings: AppSettings;
  clients: unknown[];
  invoices: unknown[];
  records?: Record<string, Array<Record<string, string | number | null>>>;
  files?: Array<{ storedName: string; sha256: string; base64: string }>;

}
