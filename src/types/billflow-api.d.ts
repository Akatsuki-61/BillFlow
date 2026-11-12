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
} from "./billing";
import type {
  AppSettings,
  UpdateSettingsInput,
  ExportDataPayload,
} from "./settings";
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

import type { ThemePreference } from "../lib/theme";
import type {
  CreateProfileInput,
  UpdateProfileInput,
  CompleteOnboardingInput,
  ProfileListResponse,
} from "./profiles";

import type { WorkflowAPI } from "./workflow";

export interface BillFlowAPI extends WorkflowAPI {
  isElectron: boolean;
  workspace?: {
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
    list: () => Promise<ClientWithStats[]>;
    get: (id: string) => Promise<ClientWithStats>;
    create: (input: NewClientInput) => Promise<ClientWithStats>;
    update: (id: string, patch: ClientPatchInput) => Promise<ClientWithStats>;
    remove: (id: string) => Promise<{ success: boolean }>;
  };
  invoices: {
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
    removePayout: (workOrderId: string) => Promise<WorkOrderItem>;
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
    get: () => Promise<AppSettings>;
    update: (patch: UpdateSettingsInput) => Promise<AppSettings>;
    getDbPath: () => Promise<string>;
    revealDbFile: () => Promise<{ success: boolean }>;
    export: () => Promise<ExportDataPayload>;
    import: (payload: ExportDataPayload) => Promise<{
      success: boolean;
      importedClients: number;
      importedInvoices: number;
    }>;
    reset: () => Promise<{ success: boolean }>;
  };
  onDataChanged: (callback: (change?: WorkspaceChange) => void) => () => void;
  onNavigate?: (callback: (route: string) => void) => () => void;
}

declare global {
  interface Window {
    billflow?: BillFlowAPI;
  }
}
