import type { Currency, InvoiceTemplateId } from "./billing";

export const APPLICATION_RESET_CONFIRMATION = "RESET BILLFLOW";

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
  digestEnabled?: boolean;
  digestLastSentDate?: string | null;
  rollingBackupEnabled?: boolean;
  rollingBackupDirectory?: string | null;
  rollingBackupRetention?: number;
  rollingBackupIntervalHours?: number;
  rollingBackupLastAt?: string | null;
  updatedAt: string;
}

export type UpdateSettingsInput = Partial<Omit<AppSettings, "id" | "updatedAt">>;

export interface RollingBackupStatus {
  enabled: boolean;
  directory: string | null;
  retention: number;
  intervalHours: number;
  lastRunAt: string | null;
  hasPassphrase: boolean;
  backupCount: number;
  dbQuickCheckOk: boolean;
  dbCheckedAt: string | null;
}

export interface FinancialDigestSummary {
  date: string;
  overdueInvoicesCount: number;
  overdueInvoicesByCurrency: Record<string, number>;
  tasksDueTodayCount: number;
  overdueTasksCount: number;
  upcomingPayoutsCount: number;
  upcomingPayoutsByCurrency: Record<string, number>;
  badgeCount: number;
  hasItems: boolean;
  headline: string;
  body: string;
}

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
