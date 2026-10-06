import type {
  ClientWithStats,
  NewClientInput,
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
} from "./outsourcing";
import type { AnalyticsSummaryPayload } from "./analytics";

import type { ThemePreference } from "../lib/theme";

import type { WorkflowAPI } from "./workflow";

export interface BillFlowAPI extends WorkflowAPI {
  isElectron: boolean;
  platform?: string;
  theme: {
    initialPreference: ThemePreference;
    setPreference: (preference: ThemePreference) => Promise<void>;
  };
  clients: {
    list: () => Promise<ClientWithStats[]>;
    get: (id: string) => Promise<ClientWithStats>;
    create: (input: NewClientInput) => Promise<ClientWithStats>;
    remove: (id: string) => Promise<{ success: boolean }>;
  };
  invoices: {
    list: (filter?: { clientId?: string }) => Promise<InvoiceWithClient[]>;
    nextCode: () => Promise<string>;
    create: (input: NewInvoiceInput) => Promise<InvoiceWithClient>;
    update: (id: string, patch: InvoicePatchInput) => Promise<InvoiceWithClient>;
    setStatus: (id: string, status: InvoiceStatus) => Promise<InvoiceWithClient>;
    recordPayment: (input: RecordPaymentInput) => Promise<{ invoice: InvoiceWithClient; payment: InvoicePayment }>;
    listPayments: (invoiceId: string) => Promise<InvoicePayment[]>;
    exportPdf: (invoiceId: string) => Promise<{ success: boolean; filePath: string }>;
    remove: (id: string) => Promise<{ success: boolean }>;
  };
  vendors: {
    list: () => Promise<VendorItem[]>;
    create: (input: NewVendorInput) => Promise<VendorItem>;
    update: (id: string, patch: VendorPatchInput) => Promise<VendorItem>;
    setStatus: (id: string, status: "PENDING" | "PAID") => Promise<VendorItem>;
    remove: (id: string) => Promise<{ success: boolean }>;
  };
  analytics: {
    summary: (period?: string) => Promise<AnalyticsSummaryPayload>;
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
