import type { Currency, InvoiceTemplateId } from "./billing";

export type DateFormat = "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY";
export type CurrencyDisplayMode = "symbol" | "code";

export type NotificationPlacement =
  "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type WorkspaceTypeface = "inter" | "nunito" | "jakarta";
export type LayoutDensity = "compact" | "comfortable" | "spacious";

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
  defaultInvoiceTemplate?: InvoiceTemplateId;
  dateFormat: DateFormat;
  currencyDisplay: CurrencyDisplayMode;
  pdfExportDirectory?: string | null;
  defaultDeliveryUrl?: string | null;
  signatureData?: string | null;
  notificationPlacement?: NotificationPlacement | null;
  typeface?: WorkspaceTypeface | null;
  layoutDensity?: LayoutDensity | null;
  updatedAt: string;
}

export type UpdateSettingsInput = Partial<Omit<AppSettings, "id" | "updatedAt">>;

export interface ExportDataPayload {
  version: string;
  exportedAt: string;
  settings: AppSettings;
  clients: unknown[];
  invoices: unknown[];
  catalogItems?: unknown[];
  vendors?: unknown[];
  records?: Record<string, Array<Record<string, string | number | null>>>;
  files?: Array<{ storedName: string; sha256: string; base64: string }>;
}

export interface BackupStatus {
  lastBackupAt: string | null;
  hasChanges: boolean;
}
