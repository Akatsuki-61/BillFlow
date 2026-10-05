"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
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
} from "@/types/billing";
import type {
  AppSettings,
  UpdateSettingsInput,
  ExportDataPayload,
} from "@/types/settings";

interface DataContextType {
  clients: ClientWithStats[];
  invoices: InvoiceWithClient[];
  catalogItems: CatalogItem[];
  dashboard: DashboardSummary | null;
  settings: AppSettings | null;
  isLoading: boolean;
  isElectron: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createClient: (input: NewClientInput) => Promise<ClientWithStats>;
  deleteClient: (id: string) => Promise<void>;
  createInvoice: (input: NewInvoiceInput) => Promise<InvoiceWithClient>;
  updateInvoice: (id: string, patch: InvoicePatchInput) => Promise<InvoiceWithClient>;
  setInvoiceStatus: (id: string, status: InvoiceStatus) => Promise<InvoiceWithClient>;
  deleteInvoice: (id: string) => Promise<void>;
  getNextInvoiceCode: () => Promise<string>;
  createCatalogItem: (input: NewCatalogItemInput) => Promise<CatalogItem>;
  updateCatalogItem: (id: string, patch: CatalogItemPatchInput) => Promise<CatalogItem>;
  deleteCatalogItem: (id: string) => Promise<void>;
  bulkImportCatalogItems: (items: NewCatalogItemInput[]) => Promise<number>;
  updateSettings: (patch: UpdateSettingsInput) => Promise<AppSettings>;
  getDbPath: () => Promise<string>;
  revealDbFile: () => Promise<void>;
  exportData: () => Promise<ExportDataPayload>;
  importData: (payload: ExportDataPayload) => Promise<{ success: boolean; importedClients: number; importedInvoices: number }>;
  resetData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

const defaultFallbackClients: ClientWithStats[] = [
  {
    id: "cli-globex",
    name: "Globex Corporation",
    category: "Enterprise",
    contactPerson: "Hank Scorpio",
    contactRole: "Director",
    email: "hank@globex.com",
    phone: "+1 (555) 234-5678",
    currency: "LKR",
    driveUrl: null,
    hasQuickBill: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    totalBilledCents: 1245000,
    totalPaidCents: 0,
    outstandingBalanceCents: 1245000,
    invoicesCount: 1,
    recentInvoices: [],
  },
  {
    id: "cli-initech",
    name: "Initech LLC",
    category: "Corporate",
    contactPerson: "Peter Gibbons",
    contactRole: "Lead Consultant",
    email: "peter@initech.com",
    phone: "+1 (555) 345-6789",
    currency: "LKR",
    driveUrl: null,
    hasQuickBill: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    totalBilledCents: 420050,
    totalPaidCents: 0,
    outstandingBalanceCents: 420050,
    invoicesCount: 1,
    recentInvoices: [],
  },
  {
    id: "cli-stark",
    name: "Stark Industries",
    category: "Enterprise",
    contactPerson: "Tony Stark",
    contactRole: "CEO",
    email: "tony@starkindustries.com",
    phone: "+1 (555) 999-0000",
    currency: "LKR",
    driveUrl: null,
    hasQuickBill: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    totalBilledCents: 8500000,
    totalPaidCents: 8500000,
    outstandingBalanceCents: 0,
    invoicesCount: 1,
    recentInvoices: [],
  },
  {
    id: "cli-wayne",
    name: "Wayne Enterprises",
    category: "Corporate",
    contactPerson: "Bruce Wayne",
    contactRole: "Managing Director",
    email: "bruce@wayneenterprises.com",
    phone: "+1 (555) 123-4567",
    currency: "LKR",
    driveUrl: null,
    hasQuickBill: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    totalBilledCents: 150000,
    totalPaidCents: 0,
    outstandingBalanceCents: 150000,
    invoicesCount: 1,
    recentInvoices: [],
  },
];

export const defaultFallbackCatalogItems: CatalogItem[] = [
  {
    id: "cat-1",
    title: "Senior Full-Stack Development",
    category: "Development",
    sku: "DEV-001",
    description: "Architecture design, API implementation, and frontend React development.",
    price: "45000.00",
    currency: "LKR",
    unit: "/ Hourly",
    iconType: "code",
  },
  {
    id: "cat-2",
    title: "UI/UX Design Sprint",
    category: "Design",
    sku: "DES-042",
    description: "Comprehensive wireframing, high-fidelity prototyping, and user testing sessions.",
    price: "360000.00",
    currency: "LKR",
    unit: "/ Daily",
    iconType: "design",
  },
  {
    id: "cat-3",
    title: "Enterprise Server License",
    category: "Licensing",
    sku: "LIC-991",
    description: "Annual license for self-hosted enterprise infrastructure deployment.",
    price: "1500000.00",
    currency: "LKR",
    unit: "/ Unit",
    iconType: "cloud",
  },
  {
    id: "cat-4",
    title: "Cloud Architecture Audit",
    category: "Consulting",
    sku: "CONS-012",
    description: "Security assessment, Docker containerization, and AWS database review.",
    price: "60000.00",
    currency: "LKR",
    unit: "/ Project",
    iconType: "consulting",
  },
];

export const defaultFallbackInvoices: InvoiceWithClient[] = [
  {
    id: "inv-globex-01",
    code: "INV-2023-089",
    clientId: "cli-globex",
    catalogItemId: "cat-1",
    title: "Senior Full-Stack Development",
    amountCents: 1245000,
    currency: "LKR",
    issueDate: "2023-10-01",
    dueDate: "2023-10-12",
    status: "OVERDUE",
    paidCents: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    clientName: "Globex Corporation",
    clientEmail: "hank@globex.com",
  },
  {
    id: "inv-initech-01",
    code: "INV-2023-090",
    clientId: "cli-initech",
    catalogItemId: "cat-2",
    title: "UI/UX Design Sprint",
    amountCents: 420050,
    currency: "LKR",
    issueDate: "2023-10-14",
    dueDate: "2023-10-28",
    status: "UNPAID",
    paidCents: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    clientName: "Initech LLC",
    clientEmail: "peter@initech.com",
  },
  {
    id: "inv-stark-01",
    code: "INV-2023-085",
    clientId: "cli-stark",
    catalogItemId: "cat-3",
    title: "Enterprise Server License",
    amountCents: 8500000,
    currency: "LKR",
    issueDate: "2023-10-01",
    dueDate: "2023-10-15",
    status: "PAID",
    paidCents: 8500000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    clientName: "Stark Industries",
    clientEmail: "tony@starkindustries.com",
  },
  {
    id: "inv-wayne-01",
    code: "Draft",
    clientId: "cli-wayne",
    catalogItemId: "cat-4",
    title: "Cloud Architecture Audit",
    amountCents: 150000,
    currency: "LKR",
    issueDate: "2023-10-20",
    dueDate: null,
    status: "DRAFT",
    paidCents: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    clientName: "Wayne Enterprises",
    clientEmail: "bruce@wayneenterprises.com",
  },
];

// In-memory fallback repository when running outside Electron
let memoryClients: ClientWithStats[] = [...defaultFallbackClients];
let memoryInvoices: InvoiceWithClient[] = [...defaultFallbackInvoices];
let memoryCatalog: CatalogItem[] = [...defaultFallbackCatalogItems];
let memorySettings: AppSettings = {
  id: "default",
  businessName: "",
  professionalTitle: "",
  email: "",
  phone: "",
  website: "",
  taxId: "",
  address: "",
  paymentDetails: "",
  defaultCurrency: "USD",
  invoicePrefix: "INV-",
  nextInvoiceSeq: 1,
  defaultDueDays: 14,
  defaultTaxRate: 0,
  defaultNotes: "Payment due within specified due date. Thank you for your business.",
  dateFormat: "YYYY-MM-DD",
  currencyDisplay: "symbol",
  updatedAt: new Date().toISOString(),
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isElectron, setIsElectron] = useState<boolean>(false);

  const checkIsElectron = useCallback(() => {
    return typeof window !== "undefined" && Boolean(window.billflow?.isElectron);
  }, []);

  const refresh = useCallback(async () => {
    try {
      if (checkIsElectron() && window.billflow) {
        setIsElectron(true);
        const [cList, iList, catList, dSummary, sSettings] = await Promise.all([
          window.billflow.clients.list(),
          window.billflow.invoices.list(),
          window.billflow.catalog.list(),
          window.billflow.dashboard.summary(),
          window.billflow.settings.get(),
        ]);
        setClients(cList);
        setInvoices(iList);
        setCatalogItems(catList);
        setDashboard(dSummary);
        setSettings(sSettings);
      } else {
        setIsElectron(false);
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem("billflow_memory_settings");
          if (stored) {
            try {
              memorySettings = { ...memorySettings, ...JSON.parse(stored) };
            } catch {
              // ignore
            }
          }
          const storedClients = localStorage.getItem("billflow_memory_clients");
          if (storedClients) {
            try {
              const parsed = JSON.parse(storedClients);
              if (Array.isArray(parsed) && parsed.length > 0) {
                memoryClients = parsed;
              }
            } catch {
              // ignore
            }
          }
          const storedInvoices = localStorage.getItem("billflow_memory_invoices");
          if (storedInvoices) {
            try {
              const parsed = JSON.parse(storedInvoices);
              if (Array.isArray(parsed)) {
                memoryInvoices = parsed;
              }
            } catch {
              // ignore
            }
          }
          const storedCatalog = localStorage.getItem("billflow_memory_catalog");
          if (storedCatalog) {
            try {
              const parsed = JSON.parse(storedCatalog);
              if (Array.isArray(parsed) && parsed.length > 0) {
                memoryCatalog = parsed;
              }
            } catch {
              // ignore
            }
          }
        }
        setClients([...memoryClients]);
        setInvoices([...memoryInvoices]);
        setCatalogItems([...memoryCatalog]);
        setSettings({ ...memorySettings });
        setDashboard({
          activeClients: memoryClients.length,
          unpaidCount: memoryInvoices.filter((i) => i.status !== "PAID" && i.status !== "DRAFT").length,
          totalBilledByCurrency: {},
          outstandingByCurrency: {},
          recentInvoices: memoryInvoices.slice(0, 5),
        });
      }
      setError(null);
    } catch (err: unknown) {
      console.error("Failed to load billflow data:", err);
      const msg = err && typeof err === "object" && "message" in err ? String(err.message) : "Failed to load data";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [checkIsElectron]);

  useEffect(() => {
    refresh();

    if (checkIsElectron() && window.billflow?.onDataChanged) {
      const unsubscribe = window.billflow.onDataChanged(() => {
        refresh();
      });
      return () => {
        unsubscribe();
      };
    }
  }, [refresh, checkIsElectron]);

  const createClient = async (input: NewClientInput): Promise<ClientWithStats> => {
    if (checkIsElectron() && window.billflow) {
      const created = await window.billflow.clients.create(input);
      await refresh();
      return created;
    } else {
      const id = `cli-${Date.now()}`;
      const newClient: ClientWithStats = {
        id,
        name: input.name,
        category: input.category || "Enterprise",
        contactPerson: input.contactPerson || input.name,
        contactRole: input.contactRole || null,
        email: input.email,
        phone: input.phone || null,
        currency: input.currency,
        driveUrl: input.driveUrl || null,
        hasQuickBill: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        totalBilledCents: 0,
        totalPaidCents: 0,
        outstandingBalanceCents: 0,
        invoicesCount: 0,
        recentInvoices: [],
      };
      memoryClients = [newClient, ...memoryClients];
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("billflow_memory_clients", JSON.stringify(memoryClients));
        } catch {
          // ignore
        }
      }
      await refresh();
      return newClient;
    }
  };

  const deleteClient = async (id: string): Promise<void> => {
    if (checkIsElectron() && window.billflow) {
      await window.billflow.clients.remove(id);
      await refresh();
    } else {
      const hasInvoices = memoryInvoices.some((i) => i.clientId === id);
      if (hasInvoices) {
        throw new Error("Cannot delete client with linked invoices.");
      }
      memoryClients = memoryClients.filter((c) => c.id !== id);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("billflow_memory_clients", JSON.stringify(memoryClients));
        } catch {
          // ignore
        }
      }
      await refresh();
    }
  };

  const createInvoice = async (input: NewInvoiceInput): Promise<InvoiceWithClient> => {
    if (checkIsElectron() && window.billflow) {
      const created = await window.billflow.invoices.create(input);
      await refresh();
      return created;
    } else {
      const client = memoryClients.find((c) => c.id === input.clientId);
      const id = `inv-${Date.now()}`;
      const code = input.code || `INV-${new Date().getFullYear()}-${String(memoryInvoices.length + 1).padStart(3, "0")}`;
      const today = new Date().toISOString().split("T")[0];
      const newInv: InvoiceWithClient = {
        id,
        code,
        clientId: input.clientId,
        catalogItemId: input.catalogItemId || null,
        title: input.title || null,
        amountCents: input.amountCents,
        currency: input.currency,
        issueDate: input.issueDate || today,
        dueDate: input.dueDate || null,
        status: input.status || "UNPAID",
        paidCents: input.status === "PAID" ? input.amountCents : 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        clientName: client?.name || "Unknown Client",
        clientEmail: client?.email,
      };
      memoryInvoices = [newInv, ...memoryInvoices];
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("billflow_memory_invoices", JSON.stringify(memoryInvoices));
        } catch {}
      }
      await refresh();
      return newInv;
    }
  };

  const updateInvoice = async (id: string, patch: InvoicePatchInput): Promise<InvoiceWithClient> => {
    if (checkIsElectron() && window.billflow) {
      const updated = await window.billflow.invoices.update(id, patch);
      await refresh();
      return updated;
    } else {
      const idx = memoryInvoices.findIndex((i) => i.id === id);
      if (idx === -1) throw new Error("Invoice not found");
      const client = patch.clientId ? memoryClients.find((c) => c.id === patch.clientId) : undefined;
      const target = memoryInvoices[idx];
      const newStatus = patch.status ?? target.status;
      const newAmount = patch.amountCents ?? target.amountCents;
      const updated: InvoiceWithClient = {
        ...target,
        ...patch,
        catalogItemId: patch.catalogItemId !== undefined ? patch.catalogItemId : target.catalogItemId,
        amountCents: newAmount,
        status: newStatus,
        paidCents: newStatus === "PAID" ? newAmount : 0,
        clientName: client ? client.name : target.clientName,
        clientEmail: client ? client.email : target.clientEmail,
        updatedAt: new Date().toISOString(),
      };
      memoryInvoices[idx] = updated;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("billflow_memory_invoices", JSON.stringify(memoryInvoices));
        } catch {}
      }
      await refresh();
      return updated;
    }
  };

  const setInvoiceStatus = async (id: string, status: InvoiceStatus): Promise<InvoiceWithClient> => {
    if (checkIsElectron() && window.billflow) {
      const updated = await window.billflow.invoices.setStatus(id, status);
      await refresh();
      return updated;
    } else {
      return updateInvoice(id, { status });
    }
  };

  const deleteInvoice = async (id: string): Promise<void> => {
    if (checkIsElectron() && window.billflow) {
      await window.billflow.invoices.remove(id);
      await refresh();
    } else {
      memoryInvoices = memoryInvoices.filter((i) => i.id !== id);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("billflow_memory_invoices", JSON.stringify(memoryInvoices));
        } catch {}
      }
      await refresh();
    }
  };

  const getNextInvoiceCode = async (): Promise<string> => {
    if (checkIsElectron() && window.billflow) {
      return window.billflow.invoices.nextCode();
    } else {
      const prefix = memorySettings.invoicePrefix || "INV-";
      const year = new Date().getFullYear();
      const activePrefix = prefix.includes("{YYYY}")
        ? prefix.replace("{YYYY}", String(year))
        : prefix.endsWith("-")
        ? `${prefix}${year}-`
        : `${prefix}-${year}-`;
      const nextSeq = Math.max(memorySettings.nextInvoiceSeq || 1, memoryInvoices.length + 1);
      return `${activePrefix}${String(nextSeq).padStart(3, "0")}`;
    }
  };

  const createCatalogItem = async (input: NewCatalogItemInput): Promise<CatalogItem> => {
    if (checkIsElectron() && window.billflow) {
      const created = await window.billflow.catalog.create(input);
      await refresh();
      return created;
    } else {
      const id = `cat-${Date.now()}`;
      const newItem: CatalogItem = {
        id,
        title: input.title,
        category: input.category,
        sku: input.sku,
        description: input.description || "",
        price: input.price,
        currency: input.currency || "LKR",
        unit: input.unit || "/ Hourly",
        iconType: input.iconType || "code",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      memoryCatalog = [newItem, ...memoryCatalog];
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("billflow_memory_catalog", JSON.stringify(memoryCatalog));
        } catch {}
      }
      await refresh();
      return newItem;
    }
  };

  const updateCatalogItem = async (id: string, patch: CatalogItemPatchInput): Promise<CatalogItem> => {
    if (checkIsElectron() && window.billflow) {
      const updated = await window.billflow.catalog.update(id, patch);
      await refresh();
      return updated;
    } else {
      const idx = memoryCatalog.findIndex((c) => c.id === id);
      if (idx === -1) throw new Error("Catalog item not found");
      const target = memoryCatalog[idx];
      const updated: CatalogItem = {
        ...target,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      memoryCatalog[idx] = updated;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("billflow_memory_catalog", JSON.stringify(memoryCatalog));
        } catch {}
      }
      await refresh();
      return updated;
    }
  };

  const deleteCatalogItem = async (id: string): Promise<void> => {
    if (checkIsElectron() && window.billflow) {
      await window.billflow.catalog.remove(id);
      await refresh();
    } else {
      memoryCatalog = memoryCatalog.filter((c) => c.id !== id);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("billflow_memory_catalog", JSON.stringify(memoryCatalog));
        } catch {}
      }
      await refresh();
    }
  };

  const bulkImportCatalogItems = async (items: NewCatalogItemInput[]): Promise<number> => {
    if (checkIsElectron() && window.billflow) {
      const res = await window.billflow.catalog.bulkImport(items);
      await refresh();
      return res.count;
    } else {
      let count = 0;
      for (const item of items) {
        const id = `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        memoryCatalog.push({
          id,
          title: item.title,
          category: item.category,
          sku: item.sku,
          description: item.description || "",
          price: item.price,
          currency: item.currency || "LKR",
          unit: item.unit || "/ Hourly",
          iconType: item.iconType || "code",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        count++;
      }
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("billflow_memory_catalog", JSON.stringify(memoryCatalog));
        } catch {}
      }
      await refresh();
      return count;
    }
  };

  const updateSettings = async (patch: UpdateSettingsInput): Promise<AppSettings> => {
    if (checkIsElectron() && window.billflow) {
      const updated = await window.billflow.settings.update(patch);
      await refresh();
      return updated;
    } else {
      memorySettings = {
        ...memorySettings,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      if (typeof window !== "undefined") {
        localStorage.setItem("billflow_memory_settings", JSON.stringify(memorySettings));
      }
      await refresh();
      return memorySettings;
    }
  };

  const getDbPath = async (): Promise<string> => {
    if (checkIsElectron() && window.billflow) {
      return window.billflow.settings.getDbPath();
    }
    return "In-Memory Browser Fallback (Local Storage)";
  };

  const revealDbFile = async (): Promise<void> => {
    if (checkIsElectron() && window.billflow) {
      await window.billflow.settings.revealDbFile();
    }
  };

  const exportData = async (): Promise<ExportDataPayload> => {
    if (checkIsElectron() && window.billflow) {
      return window.billflow.settings.export();
    } else {
      return {
        version: "0.1.0",
        exportedAt: new Date().toISOString(),
        settings: memorySettings,
        clients: memoryClients,
        invoices: memoryInvoices,
      };
    }
  };

  const importData = async (payload: ExportDataPayload): Promise<{ success: boolean; importedClients: number; importedInvoices: number }> => {
    if (checkIsElectron() && window.billflow) {
      const res = await window.billflow.settings.import(payload);
      await refresh();
      return res;
    } else {
      if (payload.settings) {
        memorySettings = { ...memorySettings, ...payload.settings };
        if (typeof window !== "undefined") {
          localStorage.setItem("billflow_memory_settings", JSON.stringify(memorySettings));
        }
      }
      if (Array.isArray(payload.clients)) {
        memoryClients = payload.clients as ClientWithStats[];
      }
      if (Array.isArray(payload.invoices)) {
        memoryInvoices = payload.invoices as InvoiceWithClient[];
      }
      await refresh();
      return {
        success: true,
        importedClients: Array.isArray(payload.clients) ? payload.clients.length : 0,
        importedInvoices: Array.isArray(payload.invoices) ? payload.invoices.length : 0,
      };
    }
  };

  const resetData = async (): Promise<void> => {
    if (checkIsElectron() && window.billflow) {
      await window.billflow.settings.reset();
      await refresh();
    } else {
      memoryClients = [];
      memoryInvoices = [];
      memoryCatalog = [];
      memorySettings = {
        ...memorySettings,
        nextInvoiceSeq: 1,
      };
      if (typeof window !== "undefined") {
        localStorage.removeItem("billflow_memory_settings");
        localStorage.removeItem("billflow_memory_clients");
        localStorage.removeItem("billflow_memory_invoices");
        localStorage.removeItem("billflow_memory_catalog");
      }
      await refresh();
    }
  };

  return (
    <DataContext.Provider
      value={{
        clients,
        invoices,
        catalogItems,
        dashboard,
        settings,
        isLoading,
        isElectron,
        error,
        refresh,
        createClient,
        deleteClient,
        createInvoice,
        updateInvoice,
        setInvoiceStatus,
        deleteInvoice,
        getNextInvoiceCode,
        createCatalogItem,
        updateCatalogItem,
        deleteCatalogItem,
        bulkImportCatalogItems,
        updateSettings,
        getDbPath,
        revealDbFile,
        exportData,
        importData,
        resetData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}

export function useClients() {
  const { clients, isLoading, error, createClient, deleteClient, refresh } = useData();
  return { clients, isLoading, error, createClient, deleteClient, refresh };
}

export function useInvoices(filter?: { clientId?: string }) {
  const {
    invoices,
    isLoading,
    error,
    createInvoice,
    updateInvoice,
    setInvoiceStatus,
    deleteInvoice,
    getNextInvoiceCode,
    refresh,
  } = useData();

  const filteredInvoices = filter?.clientId
    ? invoices.filter((i) => i.clientId === filter.clientId)
    : invoices;

  return {
    invoices: filteredInvoices,
    allInvoices: invoices,
    isLoading,
    error,
    createInvoice,
    updateInvoice,
    setInvoiceStatus,
    deleteInvoice,
    getNextInvoiceCode,
    refresh,
  };
}

export function useCatalog() {
  const {
    catalogItems,
    isLoading,
    error,
    createCatalogItem,
    updateCatalogItem,
    deleteCatalogItem,
    bulkImportCatalogItems,
    refresh,
  } = useData();
  return {
    catalogItems,
    isLoading,
    error,
    createCatalogItem,
    updateCatalogItem,
    deleteCatalogItem,
    bulkImportCatalogItems,
    refresh,
  };
}

export function useDashboardSummary() {
  const { dashboard, isLoading, error, refresh } = useData();
  return { dashboard, isLoading, error, refresh };
}

export function useSettings() {
  const {
    settings,
    isLoading,
    error,
    updateSettings,
    getDbPath,
    revealDbFile,
    exportData,
    importData,
    resetData,
    refresh,
  } = useData();
  return {
    settings,
    isLoading,
    error,
    updateSettings,
    getDbPath,
    revealDbFile,
    exportData,
    importData,
    resetData,
    refresh,
  };
}
