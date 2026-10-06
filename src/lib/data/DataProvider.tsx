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
  CatalogItem, NewCatalogItemInput, CatalogItemPatchInput,
  InvoicePayment,
  RecordPaymentInput,
} from "@/types/billing";
import { getActiveInvoiceCurrency, getSystemCurrency } from "@/lib/format";
import type {
  AppSettings,
  UpdateSettingsInput,
  ExportDataPayload,
} from "@/types/settings";
import type {
  VendorItem,
  NewVendorInput,
  VendorPatchInput,
  WorkOrderItem,
  NewWorkOrderInput,
  WorkOrderPatchInput,
  ReviewWorkOrderInput,
  RecordWorkOrderPayoutInput,
} from "@/types/outsourcing";
import type {
  AnalyticsSummaryPayload,
  AnalyticsMonthlyTrend,
} from "@/types/analytics";

import type { TaskItem } from "@/types/tasks";
import type { WorkflowAPI, TrackingOffer, AttachmentItem } from "@/types/workflow";
import type { ExpenseItem, NewExpenseInput, ExpensePatchInput } from "@/types/expenses";

interface DataContextType {
  tasks: TaskItem[];
  trackingOffers: TrackingOffer[];
  workflow: WorkflowAPI;

  clients: ClientWithStats[];
  invoices: InvoiceWithClient[];
  vendors: VendorItem[];
  expenses: ExpenseItem[];
  workOrders: WorkOrderItem[];
  catalogItems: CatalogItem[];
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
  recordPayment: (input: RecordPaymentInput) => Promise<{ invoice: InvoiceWithClient; payment: InvoicePayment }>;
  listPayments: (invoiceId: string) => Promise<InvoicePayment[]>;
  exportInvoicePdf: (invoiceId: string) => Promise<{ success: boolean; filePath: string }>;
  openInvoicePdf: (invoiceId: string, reveal?: boolean) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  getNextInvoiceCode: () => Promise<string>;
  createCatalogItem: (input: NewCatalogItemInput) => Promise<CatalogItem>;
  updateCatalogItem: (id: string, patch: CatalogItemPatchInput) => Promise<CatalogItem>;
  deleteCatalogItem: (id: string) => Promise<void>;
  bulkImportCatalogItems: (items: NewCatalogItemInput[]) => Promise<number>;
  createVendor: (input: NewVendorInput) => Promise<VendorItem>;
  updateVendor: (id: string, patch: VendorPatchInput) => Promise<VendorItem>;
  setVendorStatus: (id: string, status: "PENDING" | "PAID") => Promise<VendorItem>;
  deleteVendor: (id: string) => Promise<void>;
  createExpense: (input: NewExpenseInput) => Promise<ExpenseItem>;
  updateExpense: (id: string, patch: ExpensePatchInput) => Promise<ExpenseItem>;
  deleteExpense: (id: string) => Promise<void>;
  attachExpenseReceipt: (expenseId: string, requestId: string) => Promise<AttachmentItem | null>;
  createWorkOrder: (input: NewWorkOrderInput) => Promise<WorkOrderItem>;
  updateWorkOrder: (id: string, patch: WorkOrderPatchInput) => Promise<WorkOrderItem>;
  reviewWorkOrder: (input: ReviewWorkOrderInput) => Promise<WorkOrderItem>;
  recordWorkOrderPayout: (input: RecordWorkOrderPayoutInput) => Promise<WorkOrderItem>;
  removeWorkOrderPayout: (workOrderId: string) => Promise<WorkOrderItem>;
  setWorkOrderPayoutStatus: (id: string, status: "PENDING" | "PAID") => Promise<WorkOrderItem>;
  deleteWorkOrder: (id: string) => Promise<void>;
  getAnalyticsSummary: (
    period?: string,
    currency?: string,
    accountingMethod?: "accrual" | "cash",
  ) => Promise<AnalyticsSummaryPayload>;
  updateSettings: (patch: UpdateSettingsInput) => Promise<AppSettings>;
  getDbPath: () => Promise<string>;
  revealDbFile: () => Promise<void>;
  exportData: () => Promise<ExportDataPayload>;
  importData: (payload: ExportDataPayload) => Promise<{ success: boolean; importedClients: number; importedInvoices: number }>;
  resetData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

// In-memory fallback repository when running outside Electron.
// Financial integrity guarantee: automatic business sample seeding is strictly disabled
// outside an explicit demo mode (isDemoMode()). Memory collections initialize clean.
let memoryCatalog: CatalogItem[] = [];
let memoryClients: ClientWithStats[] = [];
let memoryInvoices: InvoiceWithClient[] = [];
const memoryPayments: InvoicePayment[] = [];
let memoryVendors: VendorItem[] = [];
let memoryExpenses: ExpenseItem[] = [];
let memoryWorkOrders: WorkOrderItem[] = [];
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
    expenses: [...memoryExpenses],
    catalogItems: [...memoryCatalog],
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
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderItem[]>([]);
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
      const [clients, invoices, dashboard, settings, vendors, catalogItems, tasks, trackingOffers, expensesList, workOrdersList] = await Promise.all([
        window.billflow.clients.list(),
        window.billflow.invoices.list(),
        window.billflow.dashboard.summary(),
        window.billflow.settings.get(),
        window.billflow.vendors.list(),
        window.billflow.catalog.list(),
        window.billflow.tasks.list(),
        window.billflow.tracking.pending(),
        window.billflow.expenses ? window.billflow.expenses.list() : Promise.resolve([]),
        window.billflow.workOrders?.list().catch(() => [] as WorkOrderItem[]) ?? Promise.resolve([] as WorkOrderItem[]),
      ]);
      return { clients, invoices, dashboard, settings, vendors, catalogItems, tasks, trackingOffers, expenses: expensesList || [], workOrders: workOrdersList || [], isElectron: true };
    }
    return { ...await loadBrowserSnapshot(), tasks: [] as TaskItem[], trackingOffers: [] as TrackingOffer[], workOrders: memoryWorkOrders, isElectron: false };
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
    setExpenses(snapshot.expenses || []);
    setWorkOrders(snapshot.workOrders || []);
    setCatalogItems(snapshot.catalogItems);
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
      if (!input.clientId || input.newClient) throw new Error("Open the desktop app to create a new client with its invoice.");
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
        discountCents: input.discountCents ?? 0,
        taxCents: input.taxCents ?? 0,
        advanceCents: input.advanceCents ?? 0,
        deliveryUrl: input.deliveryUrl || null,
        notes: input.notes || null,
        currency: input.currency,
        issueDate: input.issueDate || today,
        dueDate: input.dueDate || null,
        status: input.status || "UNPAID",
        paidCents: input.status === "PAID" ? input.amountCents : 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        clientName: client?.name || "Unknown Client",
        clientEmail: client?.email,
        items: input.items ? input.items.map((it, idx) => ({
          id: it.id || `item-${Date.now()}-${idx}`,
          invoiceId: id,
          catalogId: it.catalogId || null,
          description: it.description,
          quantity: it.quantity,
          unitPriceCents: it.unitPriceCents,
          position: idx,
        })) : [],
        payments: [],
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
      const updatedItems = patch.items
        ? patch.items.map((it, idx) => ({
            id: it.id || `item-${Date.now()}-${idx}`,
            invoiceId: id,
            catalogId: it.catalogId || null,
            description: it.description,
            quantity: it.quantity,
            unitPriceCents: it.unitPriceCents,
            position: idx,
          }))
        : target.items;
      const updated: InvoiceWithClient = {
        ...target,
        ...patch,
        items: updatedItems,
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

  const recordPayment = async (input: RecordPaymentInput): Promise<{ invoice: InvoiceWithClient; payment: InvoicePayment }> => {
    if (checkIsElectron() && window.billflow) {
      const result = await window.billflow.invoices.recordPayment(input);
      await refresh();
      return result;
    } else {
      const inv = memoryInvoices.find((i) => i.id === input.invoiceId);
      if (!inv) throw new Error("Invoice not found");
      const payment: InvoicePayment = {
        id: `pay-${Date.now()}`,
        invoiceId: input.invoiceId,
        amountCents: input.amountCents,
        currency: input.currency || inv.currency,
        receivedAt: input.receivedAt || new Date().toISOString(),
        reference: input.reference || "",
        requestId: input.requestId || `req-${Date.now()}`,
      };
      memoryPayments.push(payment);
      const totalPaid = memoryPayments
        .filter((p) => p.invoiceId === input.invoiceId)
        .reduce((sum, p) => sum + p.amountCents, 0);
      let newStatus: InvoiceStatus = inv.status;
      if (totalPaid >= inv.amountCents) {
        newStatus = "PAID";
      } else if (inv.advanceCents && totalPaid >= inv.advanceCents) {
        newStatus = "ADVANCE_PAID";
      }
      const updated: InvoiceWithClient = {
        ...inv,
        paidCents: totalPaid,
        status: newStatus,
        payments: [...(inv.payments || []), payment],
      };
      memoryInvoices = memoryInvoices.map((i) => (i.id === inv.id ? updated : i));
      await refresh();
      return { invoice: updated, payment };
    }
  };

  const listPayments = async (invoiceId: string): Promise<InvoicePayment[]> => {
    if (checkIsElectron() && window.billflow) {
      return await window.billflow.invoices.listPayments(invoiceId);
    }
    return memoryPayments.filter((p) => p.invoiceId === invoiceId);
  };

  const exportInvoicePdf = async (invoiceId: string): Promise<{ success: boolean; filePath: string }> => {
    if (checkIsElectron() && window.billflow) {
      return await window.billflow.invoices.exportPdf(invoiceId);
    }
    return { success: true, filePath: "invoice.pdf" };
  };

  const openInvoicePdf = async (invoiceId: string, reveal?: boolean): Promise<void> => {
    if (checkIsElectron() && window.billflow) {
      await window.billflow.files.openInvoicePdf(invoiceId, reveal);
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
      memoryCatalog = [];
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

  const createCatalogItem = async (input: NewCatalogItemInput): Promise<CatalogItem> => {
    if (!checkIsElectron() || !window.billflow) throw new Error("Open the desktop app to save Catalog records.");
    const created = await window.billflow.catalog.create(input);
    await refresh(); return created;
  };
  const updateCatalogItem = async (id: string, patch: CatalogItemPatchInput): Promise<CatalogItem> => {
    if (!checkIsElectron() || !window.billflow) throw new Error("Open the desktop app to save Catalog records.");
    const updated = await window.billflow.catalog.update(id, patch);
    await refresh(); return updated;
  };
  const deleteCatalogItem = async (id: string): Promise<void> => {
    if (!checkIsElectron() || !window.billflow) throw new Error("Open the desktop app to save Catalog records.");
    await window.billflow.catalog.remove(id); await refresh();
  };
  const bulkImportCatalogItems = async (items: NewCatalogItemInput[]): Promise<number> => {
    if (!checkIsElectron() || !window.billflow) throw new Error("Open the desktop app to import Catalog records.");
    const result = await window.billflow.catalog.bulkImport(items);
    await refresh(); return result.count;
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

  /**
   * Creates a new per-job payable work order.
   * In Electron desktop mode, saves to SQLite `work_orders`, updates the linked task
   * with outsourcing metadata, and increments the vendor balance.
   */
  const createWorkOrder = async (input: NewWorkOrderInput): Promise<WorkOrderItem> => {
    if (checkIsElectron() && window.billflow?.workOrders) {
      const created = await window.billflow.workOrders.create(input);
      await refresh();
      return created;
    } else {
      const id = input.id || `wo-${Date.now()}`;
      const vendor = memoryVendors.find((v) => v.id === input.vendorId);
      const invoice = memoryInvoices.find((i) => i.id === input.invoiceId);
      const newWo: WorkOrderItem = {
        id,
        vendorId: input.vendorId,
        taskId: input.taskId,
        invoiceId: input.invoiceId,
        scope: input.scope,
        feeCents: input.feeCents,
        currency: input.currency,
        dueDate: input.dueDate || null,
        status: input.status || "todo",
        deliveryUrl: input.deliveryUrl || null,
        vendorName: vendor?.name || "Contractor",
        vendorService: vendor?.service,
        vendorEmail: vendor?.email,
        vendorPhone: vendor?.phone,
        vendorIconType: vendor?.iconType,
        invoiceCode: invoice?.code || "INV-000",
        clientId: invoice?.clientId || null,
        clientName: invoice?.clientName || "Client",
        payoutStatus: "PENDING",
      };
      memoryWorkOrders = [newWo, ...memoryWorkOrders];
      await refresh();
      return newWo;
    }
  };

  /**
   * Updates an existing work order.
   */
  const updateWorkOrder = async (id: string, patch: WorkOrderPatchInput): Promise<WorkOrderItem> => {
    if (checkIsElectron() && window.billflow?.workOrders) {
      const updated = await window.billflow.workOrders.update(id, patch);
      await refresh();
      return updated;
    } else {
      const idx = memoryWorkOrders.findIndex((w) => w.id === id);
      if (idx === -1) throw new Error("Work order not found");
      const existing = memoryWorkOrders[idx];
      const updated: WorkOrderItem = {
        ...existing,
        ...patch,
        completedAt: patch.status === "done" && !existing.completedAt ? new Date().toISOString() : existing.completedAt,
      };
      memoryWorkOrders[idx] = updated;
      await refresh();
      return updated;
    }
  };

  /**
   * Reviews contractor deliverable, saves deliverable URL & notes, and updates the original task after review.
   */
  const reviewWorkOrder = async (input: ReviewWorkOrderInput): Promise<WorkOrderItem> => {
    if (checkIsElectron() && window.billflow?.workOrders) {
      const updated = await window.billflow.workOrders.review(input);
      await refresh();
      return updated;
    } else {
      const updated = await updateWorkOrder(input.workOrderId, {
        status: input.status,
        deliveryUrl: input.deliveryUrl,
        notes: input.notes,
        updateTask: input.updateTask,
        taskStatus: input.status,
      });
      return updated;
    }
  };

  /**
   * Explicitly records a vendor payout entry in SQLite `vendor_payouts`.
   * Separate from contractor work progress.
   */
  const recordWorkOrderPayout = async (input: RecordWorkOrderPayoutInput): Promise<WorkOrderItem> => {
    if (checkIsElectron() && window.billflow?.workOrders) {
      const updated = await window.billflow.workOrders.recordPayout(input);
      await refresh();
      return updated;
    } else {
      const wo = memoryWorkOrders.find((w) => w.id === input.workOrderId);
      if (!wo) throw new Error("Work order not found");
      const updated: WorkOrderItem = {
        ...wo,
        payoutStatus: "PAID",
        payoutId: `payout-${Date.now()}`,
        paidAt: input.paidAt || new Date().toISOString(),
        payoutAmountCents: input.amountCents ?? wo.feeCents,
      };
      const idx = memoryWorkOrders.findIndex((w) => w.id === input.workOrderId);
      memoryWorkOrders[idx] = updated;
      await refresh();
      return updated;
    }
  };

  /**
   * Removes a vendor payout entry, reverting payout status to PENDING
   * without affecting contractor work status.
   */
  const removeWorkOrderPayout = async (workOrderId: string): Promise<WorkOrderItem> => {
    if (checkIsElectron() && window.billflow?.workOrders) {
      const updated = await window.billflow.workOrders.removePayout(workOrderId);
      await refresh();
      return updated;
    } else {
      const wo = memoryWorkOrders.find((w) => w.id === workOrderId);
      if (!wo) throw new Error("Work order not found");
      const updated: WorkOrderItem = {
        ...wo,
        payoutStatus: "PENDING",
        payoutId: null,
        paidAt: null,
      };
      const idx = memoryWorkOrders.findIndex((w) => w.id === workOrderId);
      memoryWorkOrders[idx] = updated;
      await refresh();
      return updated;
    }
  };

  /**
   * Toggles settlement payout status between PENDING and PAID.
   * Automatically creates or removes records in `vendor_payouts`.
   */
  const setWorkOrderPayoutStatus = async (id: string, status: "PENDING" | "PAID"): Promise<WorkOrderItem> => {
    if (status === "PAID") {
      return recordWorkOrderPayout({ workOrderId: id });
    } else {
      return removeWorkOrderPayout(id);
    }
  };

  /**
   * Deletes a work order and unlinks outsourcing info from the associated task.
   */
  const deleteWorkOrder = async (id: string): Promise<void> => {
    if (checkIsElectron() && window.billflow?.workOrders) {
      await window.billflow.workOrders.remove(id);
      await refresh();
    } else {
      memoryWorkOrders = memoryWorkOrders.filter((w) => w.id !== id);
      await refresh();
    }
  };

  const getAnalyticsSummary = useCallback(
    async (
      period?: string,
      currency?: string,
      accountingMethod: "accrual" | "cash" = "accrual",
    ): Promise<AnalyticsSummaryPayload> => {
      if (checkIsElectron() && window.billflow) {
        return await window.billflow.analytics.summary(period, currency, accountingMethod);
      } else {
        let totalRevenueCents = 0;
        let paidCents = 0;
        let pendingReceivablesCents = 0;
        let unpaidCount = 0;
        let overdueCents = 0;
        let overdueCount = 0;
        const now = new Date();
        const todayStr = now.toISOString().split("T")[0];

        const targetInvoices = memoryInvoices.filter((inv) => {
          if (currency && currency !== "all" && currency !== "ALL") {
            if (inv.currency && inv.currency.toUpperCase() !== currency.toUpperCase()) {
              return false;
            }
          }
          return true;
        });

        for (const inv of targetInvoices) {
          if (inv.status !== "DRAFT") {
            totalRevenueCents += inv.amountCents;
            const collected = inv.paidCents ?? (inv.status === "PAID" ? inv.amountCents : 0);
            paidCents += collected;
            if (inv.status === "PAID") {
              // fully settled
            } else {
              const unpaid = Math.max(0, inv.amountCents - collected);
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
        let paidCostCents = 0;
        for (const v of memoryVendors) {
          const balance = (Number(v.currentBalance) || 0) * 100;
          totalOutsourcedCents += balance;
          if (v.status === "PAID") {
            paidCostCents += balance;
          }
        }

        // Preserve losses (no Math.max(0, ...))
        const accrualProfitCents = totalRevenueCents - totalOutsourcedCents;
        const cashProfitCents = paidCents - paidCostCents;
        const netProfitCents = accountingMethod === "cash" ? cashProfitCents : accrualProfitCents;
        const isLoss = netProfitCents < 0;

        const baseForMargin = accountingMethod === "cash" ? paidCents : totalRevenueCents;
        const marginPct = baseForMargin > 0 ? Math.round((netProfitCents / baseForMargin) * 100) : 0;
        const paidRatioPct = totalRevenueCents > 0 ? Math.round((paidCents / totalRevenueCents) * 100) : 0;
        const avgInvoiceCents = targetInvoices.length > 0 ? Math.round(totalRevenueCents / targetInvoices.length) : 0;

        let topClientName = "Diversified";
        let topClientMaxBilled = 0;
        const clientBilledMap = new Map<string, number>();
        for (const inv of targetInvoices) {
          if (inv.status !== "DRAFT") {
            const prev = clientBilledMap.get(inv.clientName) || 0;
            clientBilledMap.set(inv.clientName, prev + inv.amountCents);
          }
        }
        for (const [name, billed] of clientBilledMap.entries()) {
          if (billed > topClientMaxBilled) {
            topClientMaxBilled = billed;
            topClientName = name;
          }
        }
        const topClientPct = totalRevenueCents > 0 ? Math.min(100, Math.round((topClientMaxBilled / totalRevenueCents) * 100)) : 0;

        const totalActiveMs = tasks.reduce((sum, t) => sum + (t.activeMilliseconds || 0), 0);
        const totalHours = totalActiveMs / 3600000;
        const effectiveHourlyRate = totalHours > 0 ? Math.round((netProfitCents / 100) / totalHours) : 0;

        const monthlyBurn = Math.round(totalOutsourcedCents / 6);
        const cashflowRunwayMonths = monthlyBurn > 0 && paidCents > 0 ? Math.min(36, Math.max(1, Math.round(paidCents / monthlyBurn))) : 0;

        const monthlyTrends: AnalyticsMonthlyTrend[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          const label = d.toLocaleString("default", { month: "short" });
          monthlyTrends.push({
            key,
            label,
            revenueCents: 0,
            expensesCents: 0,
            profitCents: 0,
            marginPct: 0,
          });
        }

        for (const inv of targetInvoices) {
          if (!inv.issueDate || inv.status === "DRAFT") continue;
          const invKey = inv.issueDate.slice(0, 7);
          const target = monthlyTrends.find((m) => m.key === invKey);
          if (target) {
            target.revenueCents += inv.amountCents;
          }
        }

        for (const v of memoryVendors) {
          const vDate = v.payoutDueDate || v.createdAt;
          if (!vDate) continue;
          const vKey = vDate.slice(0, 7);
          const target = monthlyTrends.find((m) => m.key === vKey);
          if (target) {
            target.expensesCents += (Number(v.currentBalance) || 0) * 100;
          }
        }

        for (const m of monthlyTrends) {
          // Preserve losses across months
          m.profitCents = m.revenueCents - m.expensesCents;
          m.marginPct = m.revenueCents > 0 ? Math.round((m.profitCents / m.revenueCents) * 100) : 0;
        }

        return {
          totalRevenueCents,
          billedAmountCents: totalRevenueCents,
          paidCents,
          collectedCents: paidCents,
          pendingReceivablesCents,
          outstandingCents: pendingReceivablesCents,
          totalOutsourcedCents,
          committedCostCents: totalOutsourcedCents,
          paidCostCents,
          accrualProfitCents,
          cashProfitCents,
          netProfitCents,
          marginPct,
          isLoss,
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
          currency: currency || "ALL",
          period: period || "all",
          accountingMethod,
        };
      }
    },
    [checkIsElectron, tasks],
  );

  const createExpense = async (input: NewExpenseInput): Promise<ExpenseItem> => {
    if (checkIsElectron() && window.billflow?.expenses) {
      const created = await window.billflow.expenses.create(input);
      await refresh();
      return created;
    } else {
      const id = input.requestId || `exp-${Date.now()}`;
      const newExp: ExpenseItem = {
        id,
        invoiceId: input.invoiceId || null,
        merchant: input.merchant,
        description: input.description || "",
        category: input.category,
        amountCents: input.amountCents,
        currency: input.currency || "USD",
        incurredAt: input.incurredAt,
        deductible: input.deductible !== undefined ? input.deductible : true,
        createdAt: new Date().toISOString(),
        attachments: [],
      };
      memoryExpenses = [newExp, ...memoryExpenses];
      await refresh();
      return newExp;
    }
  };

  const updateExpense = async (id: string, patch: ExpensePatchInput): Promise<ExpenseItem> => {
    if (checkIsElectron() && window.billflow?.expenses) {
      const updated = await window.billflow.expenses.update(id, patch);
      await refresh();
      return updated;
    } else {
      memoryExpenses = memoryExpenses.map((exp) => (exp.id === id ? { ...exp, ...patch } : exp));
      const found = memoryExpenses.find((exp) => exp.id === id);
      if (!found) throw new Error("Expense not found");
      await refresh();
      return found;
    }
  };

  const deleteExpense = async (id: string): Promise<void> => {
    if (checkIsElectron() && window.billflow?.expenses) {
      await window.billflow.expenses.remove(id);
      await refresh();
    } else {
      memoryExpenses = memoryExpenses.filter((exp) => exp.id !== id);
      await refresh();
    }
  };

  const attachExpenseReceipt = async (expenseId: string, requestId: string): Promise<AttachmentItem | null> => {
    if (checkIsElectron() && window.billflow?.attachments) {
      const item = await window.billflow.attachments.select({ type: "expense", id: expenseId }, requestId);
      await refresh();
      return item;
    }
    return null;
  };

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
    return getSystemCurrency(
      settings?.defaultCurrency,
      invoices,
      "USD",
    );
  }, [settings?.defaultCurrency, invoices]);

  return (
    <DataContext.Provider
      value={{
        tasks,
        trackingOffers,
        workflow,
        clients,
        invoices,
        vendors,
        expenses,
        workOrders,
        catalogItems, createCatalogItem, updateCatalogItem, deleteCatalogItem, bulkImportCatalogItems,
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
        recordPayment,
        listPayments,
        exportInvoicePdf,
        openInvoicePdf,
        deleteInvoice,
        getNextInvoiceCode,
        createVendor,
        updateVendor,
        setVendorStatus,
        deleteVendor,
        createExpense,
        updateExpense,
        deleteExpense,
        attachExpenseReceipt,
        createWorkOrder,
        updateWorkOrder,
        reviewWorkOrder,
        recordWorkOrderPayout,
        removeWorkOrderPayout,
        setWorkOrderPayoutStatus,
        deleteWorkOrder,
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
    recordPayment,
    listPayments,
    exportInvoicePdf,
    openInvoicePdf,
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
    recordPayment,
    listPayments,
    exportInvoicePdf,
    openInvoicePdf,
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

export function useWorkOrders() {
  const {
    workOrders,
    isLoading,
    error,
    createWorkOrder,
    updateWorkOrder,
    reviewWorkOrder,
    recordWorkOrderPayout,
    removeWorkOrderPayout,
    setWorkOrderPayoutStatus,
    deleteWorkOrder,
    refresh,
  } = useData();

  return {
    workOrders,
    isLoading,
    error,
    createWorkOrder,
    updateWorkOrder,
    reviewWorkOrder,
    recordWorkOrderPayout,
    removeWorkOrderPayout,
    setWorkOrderPayoutStatus,
    deleteWorkOrder,
    refresh,
  };
}

export function useAnalyticsSummary(
  period?: string,
  currency?: string,
  accountingMethod?: "accrual" | "cash",
) {
  const { getAnalyticsSummary, clients, invoices, vendors, activeCurrency } = useData();
  const effectiveCurrency = currency ?? activeCurrency;
  const query = useMemo(
    () => ({ period, currency: effectiveCurrency, accountingMethod, clients, invoices, vendors }),
    [period, effectiveCurrency, accountingMethod, clients, invoices, vendors]
  );
  const [result, setResult] = useState<{
    query: typeof query;
    data: AnalyticsSummaryPayload | null;
    error: string | null;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSummary = useCallback((isCurrent: () => boolean = () => true) =>
    getAnalyticsSummary(query.period, query.currency, query.accountingMethod).then((data) => {
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

export function useCatalog() {
  const { catalogItems, createCatalogItem, updateCatalogItem, deleteCatalogItem, bulkImportCatalogItems, isLoading, isElectron, error } = useData();
  return { catalogItems, createCatalogItem, updateCatalogItem, deleteCatalogItem, bulkImportCatalogItems, isLoading, isElectron, error };
}

export function useExpenses(filter?: { category?: string }) {
  const { expenses, isLoading, error, createExpense, updateExpense, deleteExpense, attachExpenseReceipt, refresh } = useData();
  const filteredExpenses = useMemo(() => {
    if (!filter?.category || filter.category === "All Categories") return expenses;
    return expenses.filter(e => e.category === filter.category);
  }, [expenses, filter?.category]);
  return { expenses: filteredExpenses, allExpenses: expenses, isLoading, error, createExpense, updateExpense, deleteExpense, attachExpenseReceipt, refresh };
}
