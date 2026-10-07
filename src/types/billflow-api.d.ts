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
import type { ExpenseItem, NewExpenseInput, ExpensePatchInput } from "./expenses";

import type { ThemePreference } from "../lib/theme";

import type { WorkflowAPI } from "./workflow";

export interface BillFlowAPI extends WorkflowAPI {
  isElectron: boolean;
  platform?: string;
  theme: {
    initialPreference: ThemePreference;
    setPreference: (preference: ThemePreference) => Promise<void>;
  };
  expenses: {
    list: (filter?: { category?: string; invoiceId?: string }) => Promise<ExpenseItem[]>;
    create: (input: NewExpenseInput) => Promise<ExpenseItem>;
    update: (id: string, patch: ExpensePatchInput) => Promise<ExpenseItem>;
    remove: (id: string) => Promise<{ success: boolean }>;
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
    update: (id: string, patch: InvoicePatchInput) => Promise<InvoiceWithClient>;
    promoteClient: (invoiceId: string) => Promise<ClientWithStats>;
    setStatus: (id: string, status: InvoiceStatus) => Promise<InvoiceWithClient>;
    recordPayment: (input: RecordPaymentInput) => Promise<{ invoice: InvoiceWithClient; payment: InvoicePayment }>;
    listPayments: (invoiceId: string) => Promise<InvoicePayment[]>;
    exportPdf: (invoiceId: string) => Promise<{ success: boolean; filePath: string }>;
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
    list: (filter?: { vendorId?: string; taskId?: string; invoiceId?: string }) => Promise<WorkOrderItem[]>;
    get: (id: string) => Promise<WorkOrderItem>;
    create: (input: NewWorkOrderInput) => Promise<WorkOrderItem>;
    update: (id: string, patch: WorkOrderPatchInput) => Promise<WorkOrderItem>;
    review: (input: ReviewWorkOrderInput) => Promise<WorkOrderItem>;
    recordPayout: (input: RecordWorkOrderPayoutInput) => Promise<WorkOrderItem>;
    removePayout: (workOrderId: string) => Promise<WorkOrderItem>;
    setPayoutStatus: (id: string, status: "PENDING" | "PAID") => Promise<WorkOrderItem>;
    remove: (id: string) => Promise<{ success: boolean }>;
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
    bulkImport: (items: NewCatalogItemInput[]) => Promise<{ success: boolean; count: number }>;
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
    import: (payload: ExportDataPayload) => Promise<{ success: boolean; importedClients: number; importedInvoices: number }>;
    reset: () => Promise<{ success: boolean }>;
  };
  onDataChanged: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    billflow?: BillFlowAPI;
  }
}
