import { contextBridge, ipcRenderer } from "electron";
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
} from "../src/types/billing";
import type {
  AppSettings,
  UpdateSettingsInput,
  ExportDataPayload,
} from "../src/types/settings";
import type {
  VendorItem,
  NewVendorInput,
  VendorPatchInput,
} from "../src/types/outsourcing";
import type { AnalyticsSummaryPayload } from "../src/types/analytics";

import type { ThemePreference } from "../src/lib/theme";

import type { TaskCreateInput, TaskPatchInput, AttachmentOwner } from "../src/types/workflow";

contextBridge.exposeInMainWorld("billflow", {
  isElectron: true,
  platform: process.platform,
  theme: {
    initialPreference: ipcRenderer.sendSync("theme:initial") as ThemePreference,
    setPreference: (preference: ThemePreference): Promise<void> => ipcRenderer.invoke("theme:set", preference),
  },
  clients: {
    list: (): Promise<ClientWithStats[]> => ipcRenderer.invoke("clients:list"),
    get: (id: string): Promise<ClientWithStats> => ipcRenderer.invoke("clients:get", id),
    create: (input: NewClientInput): Promise<ClientWithStats> =>
      ipcRenderer.invoke("clients:create", input),
    remove: (id: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke("clients:remove", id),
  },
  invoices: {
    list: (filter?: { clientId?: string }): Promise<InvoiceWithClient[]> =>
      ipcRenderer.invoke("invoices:list", filter),
    nextCode: (): Promise<string> => ipcRenderer.invoke("invoices:nextCode"),
    create: (input: NewInvoiceInput): Promise<InvoiceWithClient> =>
      ipcRenderer.invoke("invoices:create", input),
    update: (id: string, patch: InvoicePatchInput): Promise<InvoiceWithClient> =>
      ipcRenderer.invoke("invoices:update", id, patch),
    setStatus: (id: string, status: InvoiceStatus): Promise<InvoiceWithClient> =>
      ipcRenderer.invoke("invoices:setStatus", id, status),
    remove: (id: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke("invoices:remove", id),
  },
  vendors: {
    list: (): Promise<VendorItem[]> => ipcRenderer.invoke("vendors:list"),
    create: (input: NewVendorInput): Promise<VendorItem> =>
      ipcRenderer.invoke("vendors:create", input),
    update: (id: string, patch: VendorPatchInput): Promise<VendorItem> =>
      ipcRenderer.invoke("vendors:update", id, patch),
    setStatus: (id: string, status: "PENDING" | "PAID"): Promise<VendorItem> =>
      ipcRenderer.invoke("vendors:setStatus", id, status),
    remove: (id: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke("vendors:remove", id),
  },
  analytics: {
    summary: (period?: string): Promise<AnalyticsSummaryPayload> =>
      ipcRenderer.invoke("analytics:summary", period),
  },
  catalog: {
    list: (): Promise<CatalogItem[]> => ipcRenderer.invoke("catalog:list"),
    create: (input: NewCatalogItemInput): Promise<CatalogItem> =>
      ipcRenderer.invoke("catalog:create", input),
    update: (id: string, patch: CatalogItemPatchInput): Promise<CatalogItem> =>
      ipcRenderer.invoke("catalog:update", id, patch),
    remove: (id: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke("catalog:remove", id),
    bulkImport: (items: NewCatalogItemInput[]): Promise<{ success: boolean; count: number }> =>
      ipcRenderer.invoke("catalog:bulkImport", items),
  },
  dashboard: {
    summary: (): Promise<DashboardSummary> => ipcRenderer.invoke("dashboard:summary"),
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke("settings:get"),
    update: (patch: UpdateSettingsInput): Promise<AppSettings> =>
      ipcRenderer.invoke("settings:update", patch),
    getDbPath: (): Promise<string> => ipcRenderer.invoke("settings:getDbPath"),
    revealDbFile: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke("settings:revealDbFile"),
    export: (): Promise<ExportDataPayload> => ipcRenderer.invoke("settings:export"),
    import: (payload: ExportDataPayload): Promise<{ success: boolean; importedClients: number; importedInvoices: number }> =>
      ipcRenderer.invoke("settings:import", payload),
    reset: (): Promise<{ success: boolean }> => ipcRenderer.invoke("settings:reset"),
  },
  tasks: {
    list: () => ipcRenderer.invoke("tasks:list"),
    create: (input: TaskCreateInput) => ipcRenderer.invoke("tasks:create", input),
    update: (id: string, patch: TaskPatchInput) => ipcRenderer.invoke("tasks:update", id, patch),
    remove: (id: string) => ipcRenderer.invoke("tasks:remove", id),
    history: (id: string) => ipcRenderer.invoke("tasks:history", id),
  },
  tracking: {
    pending: () => ipcRenderer.invoke("tracking:pending"),
    decide: (invoiceId: string, choice: "yes" | "no") => ipcRenderer.invoke("tracking:decide", invoiceId, choice),
  },
  attachments: {
    list: (owner: AttachmentOwner) => ipcRenderer.invoke("attachments:list", owner),
    select: (owner: AttachmentOwner, requestId: string) => ipcRenderer.invoke("attachments:select", owner, requestId),
    open: (id: string) => ipcRenderer.invoke("attachments:open", id),
  },
  files: {
    selectPdfDirectory: () => ipcRenderer.invoke("files:selectPdfDirectory"),
    openInvoicePdf: (id: string, reveal?: boolean) => ipcRenderer.invoke("files:openInvoicePdf", id, reveal),
  },
  onDataChanged: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("data:changed", handler);
    return () => {
      ipcRenderer.removeListener("data:changed", handler);
    };
  },
});
