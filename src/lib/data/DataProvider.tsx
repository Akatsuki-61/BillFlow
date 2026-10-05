"use client";

import { readBrowserPreferences } from "./browserStorage";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from "react";
import type {
  ClientWithStats,
  NewClientInput,
  InvoiceWithClient,
  NewInvoiceInput,
  InvoicePatchInput,
  InvoiceStatus,
  DashboardSummary,
  Currency,
} from "@/types/billing";
import { getActiveInvoiceCurrency } from "@/lib/format";
import type {
  AppSettings,
  UpdateSettingsInput,
  ExportDataPayload,
} from "@/types/settings";
import type {
  VendorItem,
  NewVendorInput,
  VendorPatchInput,
} from "@/types/outsourcing";
import type {
  AnalyticsSummaryPayload,
  AnalyticsMonthlyTrend,
} from "@/types/analytics";

import type { TaskItem } from "@/types/tasks";
import type { WorkflowAPI, TrackingOffer } from "@/types/workflow";

interface DataContextType {
  tasks: TaskItem[];
  trackingOffers: TrackingOffer[];
  workflow: WorkflowAPI;

  clients: ClientWithStats[];
  invoices: InvoiceWithClient[];
  vendors: VendorItem[];
  dashboard: DashboardSummary | null;
  settings: AppSettings | null;
  activeCurrency: Currency;
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
  createVendor: (input: NewVendorInput) => Promise<VendorItem>;
  updateVendor: (id: string, patch: VendorPatchInput) => Promise<VendorItem>;
  setVendorStatus: (id: string, status: "PENDING" | "PAID") => Promise<VendorItem>;
  deleteVendor: (id: string) => Promise<void>;
  getAnalyticsSummary: (period?: string) => Promise<AnalyticsSummaryPayload>;
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
let memoryVendors: VendorItem[] = [];
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

// Browser storage implements the same async snapshot contract as desktop IPC.
async function loadBrowserSnapshot() {
  if (typeof window !== "undefined") {
    const saved = readBrowserPreferences(memorySettings, memoryVendors, localStorage);
    memorySettings = saved.settings;
    memoryVendors = saved.vendors;
  }
  return {
    clients: [...memoryClients],
    invoices: [...memoryInvoices],
    vendors: [...memoryVendors],
    settings: { ...memorySettings },
    dashboard: {
      activeClients: memoryClients.length,
      unpaidCount: memoryInvoices.filter((invoice) => invoice.status !== "PAID" && invoice.status !== "DRAFT").length,
      totalBilledByCurrency: {},
      outstandingByCurrency: {},
      recentInvoices: memoryInvoices.slice(0, 5),
    },
  };
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const snapshotRequest = useRef(0);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [trackingOffers, setTrackingOffers] = useState<TrackingOffer[]>([]);
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([]);
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isElectron, setIsElectron] = useState<boolean>(false);

  const checkIsElectron = useCallback(() => {
    return typeof window !== "undefined" && Boolean(window.billflow?.isElectron);
  }, []);

  const loadSnapshot = useCallback(async () => {
    if (checkIsElectron() && window.billflow) {
      const [clients, invoices, dashboard, settings, vendors, tasks, trackingOffers] = await Promise.all([
        window.billflow.clients.list(),
        window.billflow.invoices.list(),
        window.billflow.dashboard.summary(),
        window.billflow.settings.get(),
        window.billflow.vendors.list(),
        window.billflow.tasks.list(),
        window.billflow.tracking.pending(),
      ]);
      return { clients, invoices, dashboard, settings, vendors, tasks, trackingOffers, isElectron: true };
    }
    return { ...await loadBrowserSnapshot(), tasks: [] as TaskItem[], trackingOffers: [] as TrackingOffer[], isElectron: false };
  }, [checkIsElectron]);

  const refresh = useCallback(() => {
    const request = ++snapshotRequest.current;
    return loadSnapshot().then((snapshot) => {
    if (request !== snapshotRequest.current) return;
    setIsElectron(snapshot.isElectron);
    setTasks(snapshot.tasks);
    setTrackingOffers(snapshot.trackingOffers);
    setClients(snapshot.clients);
    setInvoices(snapshot.invoices);
    setVendors(snapshot.vendors);
    setSettings(snapshot.settings);
    setDashboard(snapshot.dashboard);
    setError(null);
  }).catch((err: unknown) => {
    if (request !== snapshotRequest.current) return;
    console.error("Failed to load billflow data:", err);
    const message = err instanceof Error ? err.message : "Failed to load data";
    setError(message);
  }).finally(() => { if (request === snapshotRequest.current) setIsLoading(false); });
  }, [loadSnapshot]);

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
      memoryVendors = [];
      memorySettings = {
        ...memorySettings,
        nextInvoiceSeq: 1,
      };
      if (typeof window !== "undefined") {
        localStorage.removeItem("billflow_memory_settings");
        localStorage.removeItem("billflow_outsourcing_vendors");
      }
      await refresh();
    }
  };

  const createVendor = async (input: NewVendorInput): Promise<VendorItem> => {
    if (checkIsElectron() && window.billflow) {
      const created = await window.billflow.vendors.create(input);
      await refresh();
      return created;
    } else {
      const id = `vnd-${Date.now()}`;
      const balance =
        typeof input.currentBalance === "number"
          ? input.currentBalance
          : typeof input.balanceCents === "number"
            ? Math.round(input.balanceCents / 100)
            : 0;
      const client = memoryClients.find((c) => c.id === input.linkedClientId);
      const newVendor: VendorItem = {
        id,
        name: input.name,
        service: input.service,
        currentBalance: balance,
        status: input.status || "PENDING",
        iconType: input.iconType || "devops",
        email: input.email,
        phone: input.phone,
        linkedClientId: input.linkedClientId,
        linkedClientName: input.linkedClientName || client?.name,
        payoutDueDate: input.payoutDueDate,
        notes: input.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      memoryVendors = [newVendor, ...memoryVendors];
      if (typeof window !== "undefined") {
        localStorage.setItem("billflow_outsourcing_vendors", JSON.stringify(memoryVendors));
      }
      await refresh();
      return newVendor;
    }
  };

  const updateVendor = async (id: string, patch: VendorPatchInput): Promise<VendorItem> => {
    if (checkIsElectron() && window.billflow) {
      const updated = await window.billflow.vendors.update(id, patch);
      await refresh();
      return updated;
    } else {
      const idx = memoryVendors.findIndex((v) => v.id === id);
      if (idx === -1) throw new Error("Vendor not found");
      const existing = memoryVendors[idx];
      const balance =
        typeof patch.currentBalance === "number"
          ? patch.currentBalance
          : typeof patch.balanceCents === "number"
            ? Math.round(patch.balanceCents / 100)
            : existing.currentBalance;
      const updated: VendorItem = {
        ...existing,
        ...patch,
        currentBalance: balance,
        updatedAt: new Date().toISOString(),
      };
      memoryVendors[idx] = updated;
      if (typeof window !== "undefined") {
        localStorage.setItem("billflow_outsourcing_vendors", JSON.stringify(memoryVendors));
      }
      await refresh();
      return updated;
    }
  };

  const setVendorStatus = async (id: string, status: "PENDING" | "PAID"): Promise<VendorItem> => {
    if (checkIsElectron() && window.billflow) {
      const updated = await window.billflow.vendors.setStatus(id, status);
      await refresh();
      return updated;
    } else {
      return updateVendor(id, { status });
    }
  };

  const deleteVendor = async (id: string): Promise<void> => {
    if (checkIsElectron() && window.billflow) {
      await window.billflow.vendors.remove(id);
      await refresh();
    } else {
      memoryVendors = memoryVendors.filter((v) => v.id !== id);
      if (typeof window !== "undefined") {
        localStorage.setItem("billflow_outsourcing_vendors", JSON.stringify(memoryVendors));
      }
      await refresh();
    }
  };

  const getAnalyticsSummary = useCallback(async (period?: string): Promise<AnalyticsSummaryPayload> => {
    if (checkIsElectron() && window.billflow) {
      return await window.billflow.analytics.summary(period);
    } else {
      let totalRevenueCents = 0;
      let paidCents = 0;
      let pendingReceivablesCents = 0;
      let unpaidCount = 0;
      let overdueCents = 0;
      let overdueCount = 0;
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];

      for (const inv of memoryInvoices) {
        if (inv.status !== "DRAFT") {
          totalRevenueCents += inv.amountCents;
          if (inv.status === "PAID") {
            paidCents += inv.amountCents;
          } else {
            const unpaid = Math.max(0, inv.amountCents - (inv.paidCents || 0));
            pendingReceivablesCents += unpaid;
            unpaidCount += 1;
            if (inv.status === "OVERDUE" || (inv.dueDate && inv.dueDate < todayStr)) {
              overdueCents += unpaid;
              overdueCount += 1;
            }
          }
        }
      }

      let totalOutsourcedCents = 0;
      for (const v of memoryVendors) {
        totalOutsourcedCents += v.currentBalance * 100;
      }

      const netProfitCents = Math.max(0, totalRevenueCents - totalOutsourcedCents);
      const marginPct = totalRevenueCents > 0 ? Math.round((netProfitCents / totalRevenueCents) * 100) : 100;
      const paidRatioPct = totalRevenueCents > 0 ? Math.round((paidCents / totalRevenueCents) * 100) : 100;
      const avgInvoiceCents = memoryInvoices.length > 0 ? Math.round(totalRevenueCents / memoryInvoices.length) : 0;
      const topClientName = memoryClients[0]?.name || "N/A";
      const topClientPct = totalRevenueCents > 0 ? 35 : 0;
      const effectiveHourlyRate = avgInvoiceCents > 0 ? Math.max(65, Math.round(avgInvoiceCents / 1600)) : 145;
      const monthlyBurn = Math.max(100000, Math.round(totalOutsourcedCents / 3));
      const availableLiquidity = paidCents + Math.round(pendingReceivablesCents * 0.75);
      const cashflowRunwayMonths = monthlyBurn > 0 ? Math.min(24, Math.max(1, Math.round(availableLiquidity / monthlyBurn))) : 12;

      const monthlyTrends: AnalyticsMonthlyTrend[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleString("default", { month: "short" });
        monthlyTrends.push({
          key,
          label,
          revenueCents: 0,
          expensesCents: Math.round(totalOutsourcedCents / 6),
          profitCents: 0,
          marginPct: 100,
        });
      }

      return {
        totalRevenueCents,
        totalOutsourcedCents,
        netProfitCents,
        marginPct,
        pendingReceivablesCents,
        unpaidCount,
        overdueCents,
        overdueCount,
        paidRatioPct,
        avgInvoiceCents,
        activeClientsCount: memoryClients.length,
        vendorsCount: memoryVendors.length,
        topClientName,
        topClientPct,
        effectiveHourlyRate,
        cashflowRunwayMonths,
        monthlyTrends,
      };
    }
  }, [checkIsElectron]);

  const requireDesktop = () => {
    if (!checkIsElectron() || !window.billflow) throw new Error("Open the BillFlow desktop app to save workflow records.");
    return window.billflow;
  };
  const workflow: WorkflowAPI = {
    tasks: {
      list: async () => requireDesktop().tasks.list(),
      create: async input => { const result = await requireDesktop().tasks.create(input); await refresh(); return result; },
      update: async (id, patch) => { const result = await requireDesktop().tasks.update(id, patch); await refresh(); return result; },
      remove: async id => { await requireDesktop().tasks.remove(id); await refresh(); },
      history: async id => requireDesktop().tasks.history(id),
    },
    tracking: {
      pending: async () => requireDesktop().tracking.pending(),
      decide: async (id, choice) => { const result = await requireDesktop().tracking.decide(id, choice); await refresh(); return result; },
    },
    attachments: {
      list: async owner => requireDesktop().attachments.list(owner),
      select: async (owner, requestId) => { const result = await requireDesktop().attachments.select(owner, requestId); await refresh(); return result; },
      open: async id => requireDesktop().attachments.open(id),
    },
    files: {
      selectPdfDirectory: async () => requireDesktop().files.selectPdfDirectory(),
      openInvoicePdf: async (id, reveal) => requireDesktop().files.openInvoicePdf(id, reveal),
    },
  };

  const activeCurrency: Currency = useMemo(() => {
    return getActiveInvoiceCurrency(
      invoices,
      (settings?.defaultCurrency as Currency) || "USD",
    );
  }, [invoices, settings]);

  return (
    <DataContext.Provider
      value={{
        tasks,
        trackingOffers,
        workflow,
        clients,
        invoices,
        vendors,
        dashboard,
        settings,
        activeCurrency,
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
        createVendor,
        updateVendor,
        setVendorStatus,
        deleteVendor,
        getAnalyticsSummary,
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

export function useActiveCurrency() {
  const { activeCurrency } = useData();
  return { activeCurrency };
}

export function useClients() {
  const { clients, isLoading, error, createClient, deleteClient, refresh } = useData();
  return { clients, isLoading, error, createClient, deleteClient, refresh };
}

export function useInvoices(filter?: { clientId?: string }) {
  const {
    invoices,
    activeCurrency,
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
    activeCurrency,
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

export function useVendors() {
  const {
    vendors,
    isLoading,
    error,
    createVendor,
    updateVendor,
    setVendorStatus,
    deleteVendor,
    refresh,
  } = useData();

  return {
    vendors,
    isLoading,
    error,
    createVendor,
    updateVendor,
    setVendorStatus,
    deleteVendor,
    refresh,
  };
}

export function useAnalyticsSummary(period?: string) {
  const { getAnalyticsSummary, clients, invoices, vendors } = useData();
  const query = useMemo(() => ({ period, clients, invoices, vendors }), [period, clients, invoices, vendors]);
  const [result, setResult] = useState<{
    query: typeof query;
    data: AnalyticsSummaryPayload | null;
    error: string | null;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSummary = useCallback((isCurrent: () => boolean = () => true) =>
    getAnalyticsSummary(query.period).then((data) => {
      if (isCurrent()) setResult({ query, data, error: null });
    }).catch((err: unknown) => {
      if (isCurrent()) {
        const message = err instanceof Error ? err.message : "Failed to load analytics";
        setResult({ query, data: null, error: message });
      }
    }), [getAnalyticsSummary, query]);

  useEffect(() => {
    let active = true;
    void fetchSummary(() => active);
    return () => { active = false; };
  }, [fetchSummary]);

  const refreshSummary = () => {
    setRefreshing(true);
    return fetchSummary().finally(() => setRefreshing(false));
  };
  return {
    data: result?.data ?? null,
    loading: refreshing || result?.query !== query,
    error: result?.query === query ? result.error : null,
    refreshSummary,
  };
}
