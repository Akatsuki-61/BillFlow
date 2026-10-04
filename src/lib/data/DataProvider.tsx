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
} from "@/types/billing";
import type {
  AppSettings,
  UpdateSettingsInput,
  ExportDataPayload,
} from "@/types/settings";

interface DataContextType {
  clients: ClientWithStats[];
  invoices: InvoiceWithClient[];
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
  updateSettings: (patch: UpdateSettingsInput) => Promise<AppSettings>;
  getDbPath: () => Promise<string>;
  revealDbFile: () => Promise<void>;
  exportData: () => Promise<ExportDataPayload>;
  importData: (payload: ExportDataPayload) => Promise<{ success: boolean; importedClients: number; importedInvoices: number }>;
  resetData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

// In-memory fallback repository when running outside Electron
let memoryClients: ClientWithStats[] = [];
let memoryInvoices: InvoiceWithClient[] = [];
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
        const [cList, iList, dSummary, sSettings] = await Promise.all([
          window.billflow.clients.list(),
          window.billflow.invoices.list(),
          window.billflow.dashboard.summary(),
          window.billflow.settings.get(),
        ]);
        setClients(cList);
        setInvoices(iList);
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
        }
        setClients([...memoryClients]);
        setInvoices([...memoryInvoices]);
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
        amountCents: newAmount,
        status: newStatus,
        paidCents: newStatus === "PAID" ? newAmount : 0,
        clientName: client ? client.name : target.clientName,
        clientEmail: client ? client.email : target.clientEmail,
        updatedAt: new Date().toISOString(),
      };
      memoryInvoices[idx] = updated;
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
      memorySettings = {
        ...memorySettings,
        nextInvoiceSeq: 1,
      };
      if (typeof window !== "undefined") {
        localStorage.removeItem("billflow_memory_settings");
      }
      await refresh();
    }
  };

  return (
    <DataContext.Provider
      value={{
        clients,
        invoices,
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
