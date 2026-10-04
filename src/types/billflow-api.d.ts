import type {
  ClientWithStats,
  NewClientInput,
  InvoiceWithClient,
  NewInvoiceInput,
  InvoicePatchInput,
  InvoiceStatus,
  DashboardSummary,
} from "./billing";

export interface BillFlowAPI {
  isElectron: boolean;
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
    remove: (id: string) => Promise<{ success: boolean }>;
  };
  dashboard: {
    summary: () => Promise<DashboardSummary>;
  };
  onDataChanged: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    billflow?: BillFlowAPI;
  }
}
