import type {
  WorkspaceSnapshot,
  WorkspaceDataset,
  WorkspaceChange,
} from "./workspace";
import type {
  ClientWithStats,
  NewClientInput,
  ClientPatchInput,
  InvoiceWithClient,
  NewInvoiceInput,
  InvoicePatchInput,
  InvoiceStatus,
  DashboardSummary,
  CatalogItem,
  NewCatalogItemInput,
  CatalogItemPatchInput,
  InvoicePayment,
  RecordPaymentInput,
  CorrectPaymentInput,
} from "./billing";
import type {
  AppSettings,
  UpdateSettingsInput,
  ExportDataPayload,
  RollingBackupStatus,
  FinancialDigestSummary,
} from "./settings";
import type {
  RecurringRuleItem,
  NewRecurringRuleInput,
  RecurringRulePatchInput,
  RecurringRunResult,
} from "./recurring";
import type {
  QuoteWithClient,
  NewQuoteInput,
  QuotePatchInput,
  QuoteStatus,
  ConvertQuoteInput,
  ConvertQuoteResult,
} from "./quotes";
import type {
  VendorItem,
  NewVendorInput,
  VendorPatchInput,
  WorkOrderItem,
  NewWorkOrderInput,
  WorkOrderPatchInput,
  ReviewWorkOrderInput,
  RecordWorkOrderPayoutInput,
} from "./outsourcing";
import type { AnalyticsSummaryPayload } from "./analytics";
import type {
  ExpenseItem,
  NewExpenseInput,
  ExpensePatchInput,
} from "./expenses";
import type {
  CalendarEventItem,
  NewCalendarEventInput,
  CalendarEventPatchInput,
} from "./calendar";
import type {
  AiDownloadProgressEvent,
  AiExtractedInvoiceDraft,
  AiExtractionInput,
  AiModelTier,
  AiStatus,
} from "./ai";

import type { ThemePreference } from "../lib/theme";
import type {
  CreateProfileInput,
  UpdateProfileInput,
  CompleteOnboardingInput,
  ProfileListResponse,
} from "./profiles";

import type { WorkflowAPI } from "./workflow";

type SaveFileResult = {
  success: boolean;
  canceled?: boolean;
  filePath?: string;
};

export interface BillFlowAPI extends WorkflowAPI {
  isElectron: boolean;
  currency?: {
    rates: () => Promise<
      import("../lib/currency-conversion").ExchangeRateState
    >;
  };
  workspace?: {
    quarantineDrafts?: (drafts: Record<string, string>) => Promise<void>;
    activity?: () => Promise<import("./activity").WorkspaceActivity[]>;
    recordActivity?: (
      profileId: string,
      input: import("./activity").ActivityInput,
    ) => Promise<void>;
    archive?: (
      kind: "clients" | "vendors",
      id: string,
      archived: boolean,
    ) => Promise<void>;
    onActivityChanged?: (callback: () => void) => () => void;
    draft?: (
      profileId: string,
      key: string,
      value?: string | null,
    ) => Promise<string | null>;
    snapshot: (datasets?: WorkspaceDataset[]) => Promise<WorkspaceSnapshot>;
  };
  platform?: string;
  theme: {
    initialPreference: ThemePreference;
    setPreference: (preference: ThemePreference) => Promise<void>;
  };
  profiles: {
    lock: () => Promise<{ success: boolean }>;
    list: () => Promise<ProfileListResponse>;
    create: (input: CreateProfileInput) => Promise<ProfileListResponse>;
    update: (
      id: string,
      patch: UpdateProfileInput,
    ) => Promise<ProfileListResponse>;
    switch: (id: string, password?: string) => Promise<ProfileListResponse>;
    verifyPassword: (
      id: string,
      password: string,
    ) => Promise<{ valid: boolean }>;
    remove: (id: string, password?: string) => Promise<ProfileListResponse>;
    completeOnboarding: (
      input: CompleteOnboardingInput,
    ) => Promise<ProfileListResponse>;
    finishSetup: () => Promise<ProfileListResponse>;
  };
  integrations: {
    requestNotifications: () => Promise<void>;
    openNotificationSettings: () => Promise<void>;
    connectCalendar: () => Promise<void>;
  };
  expenses: {
    list: (filter?: {
      category?: string;
      invoiceId?: string;
    }) => Promise<ExpenseItem[]>;
    create: (input: NewExpenseInput) => Promise<ExpenseItem>;
    update: (id: string, patch: ExpensePatchInput) => Promise<ExpenseItem>;
    remove: (id: string) => Promise<{ success: boolean }>;
  };
  events: {
    list: (filter?: {
      startDate?: string;
      endDate?: string;
      category?: string;
      taskId?: string;
    }) => Promise<CalendarEventItem[]>;
    get: (id: string) => Promise<CalendarEventItem>;
    create: (input: NewCalendarEventInput) => Promise<CalendarEventItem>;
    update: (
      id: string,
      patch: CalendarEventPatchInput,
    ) => Promise<CalendarEventItem>;
    remove: (id: string) => Promise<{ success: boolean }>;
    syncNative?: (
      taskTimeSlots?: Record<
        string,
        { startTime: string | null; endTime: string | null }
      >,
    ) => Promise<{ syncedFromMac: number; pushedToMac: number }>;
    openNative?: (
      taskTimeSlots?: Record<
        string,
        { startTime: string | null; endTime: string | null }
      >,
    ) => Promise<{
      success: boolean;
      syncedFromMac: number;
      pushedToMac: number;
    }>;
  };
  clients: {
    exportStatement: (id: string) => Promise<SaveFileResult>;
    list: () => Promise<ClientWithStats[]>;
    get: (id: string) => Promise<ClientWithStats>;
    create: (input: NewClientInput) => Promise<ClientWithStats>;
    update: (id: string, patch: ClientPatchInput) => Promise<ClientWithStats>;
    remove: (id: string) => Promise<{ success: boolean }>;
  };
  invoices: {
    setStatuses: (
      ids: string[],
      status: InvoiceStatus,
    ) => Promise<{ success: boolean }>;
    listTrash: () => Promise<InvoiceWithClient[]>;
    trash: (ids: string[]) => Promise<{ success: boolean }>;
    restore: (ids: string[]) => Promise<{ success: boolean }>;
    correctPayment: (input: CorrectPaymentInput) => Promise<InvoiceWithClient>;
    exportBatch: (
      ids: string[],
    ) => Promise<{ success: boolean; canceled?: boolean; filePaths: string[] }>;
    prepareShare: (
      id: string,
      template?: string,
    ) => Promise<{ success: boolean; filePath: string }>;
    list: (filter?: { clientId?: string }) => Promise<InvoiceWithClient[]>;
    nextCode: () => Promise<string>;
    create: (input: NewInvoiceInput) => Promise<InvoiceWithClient>;
    update: (
      id: string,
      patch: InvoicePatchInput,
    ) => Promise<InvoiceWithClient>;
    promoteClient: (invoiceId: string) => Promise<ClientWithStats>;
    setStatus: (
      id: string,
      status: InvoiceStatus,
    ) => Promise<InvoiceWithClient>;
    recordPayment: (
      input: RecordPaymentInput,
    ) => Promise<{ invoice: InvoiceWithClient; payment: InvoicePayment }>;
    listPayments: (invoiceId: string) => Promise<InvoicePayment[]>;
    exportPdf: (
      invoiceId: string,
      template?: string,
    ) => Promise<{ success: boolean; filePath: string }>;
    savePdfAs?: (
      invoiceId: string,
      template?: string,
      draft?: NewInvoiceInput,
    ) => Promise<{ success: boolean; canceled?: boolean; filePath?: string }>;
    remove: (id: string) => Promise<{ success: boolean }>;
  };
  /** Reusable subcontractor directory management */
  vendors: {
    exportStatement: (id: string) => Promise<SaveFileResult>;
    list: () => Promise<VendorItem[]>;
    create: (input: NewVendorInput) => Promise<VendorItem>;
    update: (id: string, patch: VendorPatchInput) => Promise<VendorItem>;
    setStatus: (id: string, status: "PENDING" | "PAID") => Promise<VendorItem>;
    remove: (id: string) => Promise<{ success: boolean }>;
  };
  /** Per-job payable work orders linking vendors, sprint tasks, and client invoices */
  workOrders: {
    list: (filter?: {
      vendorId?: string;
      taskId?: string;
      invoiceId?: string;
    }) => Promise<WorkOrderItem[]>;
    get: (id: string) => Promise<WorkOrderItem>;
    create: (input: NewWorkOrderInput) => Promise<WorkOrderItem>;
    update: (id: string, patch: WorkOrderPatchInput) => Promise<WorkOrderItem>;
    review: (input: ReviewWorkOrderInput) => Promise<WorkOrderItem>;
    recordPayout: (input: RecordWorkOrderPayoutInput) => Promise<WorkOrderItem>;
    removePayout: (
      workOrderId: string,
      payoutId?: string,
    ) => Promise<WorkOrderItem>;
    setPayoutStatus: (
      id: string,
      status: "PENDING" | "PAID",
    ) => Promise<WorkOrderItem>;
    remove: (id: string) => Promise<{ success: boolean }>;
    exportPdf: (id: string) => Promise<{ success: boolean; filePath: string }>;
    openPdf: (
      workOrderId: string,
      reveal?: boolean,
    ) => Promise<{ success: boolean }>;
  };
  analytics: {
    summary: (
      period?: string,
      currency?: string,
      accountingMethod?: "accrual" | "cash",
    ) => Promise<AnalyticsSummaryPayload>;
  };
  catalog: {
    list: () => Promise<CatalogItem[]>;
    create: (input: NewCatalogItemInput) => Promise<CatalogItem>;
    update: (id: string, patch: CatalogItemPatchInput) => Promise<CatalogItem>;
    remove: (id: string) => Promise<{ success: boolean }>;
    bulkImport: (
      items: NewCatalogItemInput[],
    ) => Promise<{ success: boolean; count: number }>;
  };
  dashboard: {
    summary: () => Promise<DashboardSummary>;
  };
  settings: {
    preflight?: (
      payload: ExportDataPayload,
      mode?: "replace" | "merge",
    ) => Promise<{
      success: boolean;
      importedClients: number;
      importedInvoices: number;
    }>;
    chooseBackupFile?: (mode?: "replace" | "merge") => Promise<
      | { canceled: true }
      | {
          canceled: false;
          token: string;
          fileName: string;
          fileSize: number;
          version: string;
          exportedAt: string;
          importedClients: number;
          importedInvoices: number;
          receiptsCount: number;
        }
    >;
    stageBackupFile?: (
      file: File,
      mode?: "replace" | "merge",
    ) => Promise<{
      canceled: false;
      token: string;
      fileName: string;
      fileSize: number;
      version: string;
      exportedAt: string;
      importedClients: number;
      importedInvoices: number;
      receiptsCount: number;
    }>;
    preflightBackupFile?: (
      token: string,
      mode?: "replace" | "merge",
    ) => Promise<{
      success: boolean;
      importedClients: number;
      importedInvoices: number;
    }>;
    importBackupFile?: (
      token: string,
      mode?: "replace" | "merge",
    ) => Promise<{
      success: boolean;
      importedClients: number;
      importedInvoices: number;
      skipped?: number;
    }>;
    exportCsv: () => Promise<SaveFileResult>;
    saveBackup: () => Promise<SaveFileResult>;
    get: () => Promise<AppSettings>;
    update: (patch: UpdateSettingsInput) => Promise<AppSettings>;
    getDbPath: () => Promise<string>;
    revealDbFile: () => Promise<{ success: boolean }>;
    export: () => Promise<ExportDataPayload>;
    import: (
      payload: ExportDataPayload,
      mode?: "replace" | "merge",
    ) => Promise<{
      success: boolean;
      importedClients: number;
      importedInvoices: number;
      skipped?: number;
    }>;
    reset: () => Promise<{ success: boolean }>;
    resetApplication: (confirmation: string) => Promise<void>;
    saveEncryptedBackup?: (passphrase: string) => Promise<SaveFileResult>;
    chooseRollingBackupDirectory?: () => Promise<string | null>;
    getRollingBackupStatus?: () => Promise<RollingBackupStatus>;
    configureRollingBackup?: (input: {
      enabled?: boolean;
      directory?: string | null;
      retention?: number;
      intervalHours?: number;
      passphrase?: string;
      clearPassphrase?: boolean;
    }) => Promise<RollingBackupStatus>;
    runRollingBackupNow?: (passphraseOverride?: string) => Promise<{
      ran: boolean;
      reason?: string;
      filePath?: string;
      prunedCount?: number;
      status: RollingBackupStatus;
    }>;
    chooseEncryptedBackupFile?: () => Promise<
      | { canceled: true }
      | {
          canceled: false;
          token: string;
          fileName: string;
          fileSize: number;
        }
    >;
    preflightEncryptedBackup?: (
      token: string,
      passphrase: string,
      mode?: "replace" | "merge",
    ) => Promise<{
      success: boolean;
      importedClients: number;
      importedInvoices: number;
      exportedAt: string;
      receiptsCount: number;
    }>;
    restoreEncryptedBackup?: (
      token: string,
      passphrase: string,
      mode?: "replace" | "merge",
    ) => Promise<{
      success: boolean;
      importedClients: number;
      importedInvoices: number;
      skipped?: number;
    }>;
  };
  recurring?: {
    list: () => Promise<RecurringRuleItem[]>;
    create: (input: NewRecurringRuleInput) => Promise<RecurringRuleItem>;
    update: (
      id: string,
      patch: RecurringRulePatchInput,
    ) => Promise<RecurringRuleItem>;
    toggle: (id: string, isActive: boolean) => Promise<RecurringRuleItem>;
    remove: (id: string) => Promise<{ success: boolean }>;
    runNow: (id: string) => Promise<{
      rule: RecurringRuleItem;
      invoice: InvoiceWithClient;
      pdfPath?: string | null;
    }>;
    runDue: () => Promise<RecurringRunResult>;
  };
  quotes?: {
    list: (clientId?: string) => Promise<QuoteWithClient[]>;
    nextCode: () => Promise<string>;
    create: (input: NewQuoteInput) => Promise<QuoteWithClient>;
    update: (id: string, patch: QuotePatchInput) => Promise<QuoteWithClient>;
    setStatus: (
      id: string,
      status: Exclude<QuoteStatus, "CONVERTED">,
    ) => Promise<QuoteWithClient>;
    remove: (id: string) => Promise<{ success: boolean }>;
    exportPdf: (
      id: string,
      template?: string,
    ) => Promise<{ success: boolean; filePath: string }>;
    savePdfAs: (id: string, template?: string) => Promise<SaveFileResult>;
    openPdf: (id: string, reveal?: boolean) => Promise<{ success: boolean }>;
    convertToInvoice: (input: ConvertQuoteInput) => Promise<ConvertQuoteResult>;
  };
  digest?: {
    summary: () => Promise<FinancialDigestSummary>;
    sendTest: () => Promise<{
      sent: boolean;
      reason?: string;
      summary: FinancialDigestSummary;
    }>;
  };
  ai?: {
    status: () => Promise<AiStatus>;
    setTier: (tier: AiModelTier) => Promise<AiStatus>;
    extractInvoice: (
      input: AiExtractionInput,
    ) => Promise<AiExtractedInvoiceDraft>;
    downloadEnhancedModel: () => Promise<AiStatus>;
    cancelDownload: () => Promise<AiStatus>;
    removeEnhancedModel: () => Promise<AiStatus>;
    onDownloadProgress: (
      callback: (event: AiDownloadProgressEvent) => void,
    ) => () => void;
  };
  onWorkspaceLocked?: (callback: () => void) => () => void;
  onDataChanged: (callback: (change?: WorkspaceChange) => void) => () => void;
  onNavigate?: (callback: (route: string) => void) => () => void;
}

declare global {
  interface Window {
    billflow?: BillFlowAPI;
  }
}
