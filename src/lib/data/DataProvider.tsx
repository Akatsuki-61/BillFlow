"use client";
import { activeProfileScope } from "@/lib/profile-scope";
import type { WorkspaceDataset, WorkspaceSnapshot } from "@/types/workspace";
import { calculateFinancials } from "@/lib/financials";
import { hydrateTaskTimeSlots } from "@/lib/local-calendar";

import { readBrowserPreferences } from "./browserStorage";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import type {
  ClientWithStats,
  NewClientInput,
  ClientPatchInput,
  InvoiceWithClient,
  NewInvoiceInput,
  InvoicePatchInput,
  InvoiceStatus,
  DashboardSummary,
  Currency,
  CatalogItem,
  NewCatalogItemInput,
  CatalogItemPatchInput,
  InvoicePayment,
  RecordPaymentInput,
} from "@/types/billing";
import { getSystemCurrency } from "@/lib/format";
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
import type { AnalyticsSummaryPayload } from "@/types/analytics";

import type { TaskItem } from "@/types/tasks";
import type {
  WorkflowAPI,
  TrackingOffer,
  AttachmentItem,
} from "@/types/workflow";
import type {
  ExpenseItem,
  NewExpenseInput,
  ExpensePatchInput,
} from "@/types/expenses";
import type {
  CalendarEventItem,
  NewCalendarEventInput,
  CalendarEventPatchInput,
} from "@/types/calendar";

const DEFAULT_SETTINGS: AppSettings = {
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
  defaultNotes:
    "Payment due within specified due date. Thank you for your business.",
  defaultInvoiceTemplate: "geometric-teal",
  dateFormat: "YYYY-MM-DD",
  currencyDisplay: "symbol",
  pdfExportDirectory: "",
  updatedAt: new Date().toISOString(),
};

interface DataContextType {
  tasks: TaskItem[];
  trackingOffers: TrackingOffer[];
  workflow: WorkflowAPI;
  getUnbilledCompletedTasks: (options?: {
    clientId?: string | null;
    clientName?: string | null;
    includeAllClients?: boolean;
  }) => TaskItem[];

  clients: ClientWithStats[];
  invoices: InvoiceWithClient[];
  vendors: VendorItem[];
  expenses: ExpenseItem[];
  workOrders: WorkOrderItem[];
  events: CalendarEventItem[];
  catalogItems: CatalogItem[];
  dashboard: DashboardSummary | null;
  settings: AppSettings | null;
  activeCurrency: Currency;
  isLoading: boolean;
  isElectron: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createClient: (input: NewClientInput) => Promise<ClientWithStats>;
  updateClient: (
    id: string,
    patch: ClientPatchInput,
  ) => Promise<ClientWithStats>;
  deleteClient: (id: string) => Promise<void>;
  createInvoice: (input: NewInvoiceInput) => Promise<InvoiceWithClient>;
  updateInvoice: (
    id: string,
    patch: InvoicePatchInput,
  ) => Promise<InvoiceWithClient>;
  promoteInvoiceClient: (invoiceId: string) => Promise<ClientWithStats>;
  setInvoiceStatus: (
    id: string,
    status: InvoiceStatus,
  ) => Promise<InvoiceWithClient>;
  recordPayment: (
    input: RecordPaymentInput,
  ) => Promise<{ invoice: InvoiceWithClient; payment: InvoicePayment }>;
  listPayments: (invoiceId: string) => Promise<InvoicePayment[]>;
  exportInvoicePdf: (
    invoiceId: string,
    template?: string,
  ) => Promise<{ success: boolean; filePath: string }>;
  saveInvoicePdfAs: (
    invoiceId: string,
    template?: string,
    draft?: NewInvoiceInput,
  ) => Promise<{ success: boolean; canceled?: boolean; filePath?: string }>;
  openInvoicePdf: (invoiceId: string, reveal?: boolean) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  getNextInvoiceCode: () => Promise<string>;
  createCatalogItem: (input: NewCatalogItemInput) => Promise<CatalogItem>;
  updateCatalogItem: (
    id: string,
    patch: CatalogItemPatchInput,
  ) => Promise<CatalogItem>;
  deleteCatalogItem: (id: string) => Promise<void>;
  bulkImportCatalogItems: (items: NewCatalogItemInput[]) => Promise<number>;
  createVendor: (input: NewVendorInput) => Promise<VendorItem>;
  updateVendor: (id: string, patch: VendorPatchInput) => Promise<VendorItem>;
  setVendorStatus: (
    id: string,
    status: "PENDING" | "PAID",
  ) => Promise<VendorItem>;
  deleteVendor: (id: string) => Promise<void>;
  createExpense: (input: NewExpenseInput) => Promise<ExpenseItem>;
  updateExpense: (id: string, patch: ExpensePatchInput) => Promise<ExpenseItem>;
  deleteExpense: (id: string) => Promise<void>;
  attachExpenseReceipt: (
    expenseId: string,
    requestId: string,
  ) => Promise<AttachmentItem | null>;
  createEvent: (input: NewCalendarEventInput) => Promise<CalendarEventItem>;
  updateEvent: (
    id: string,
    patch: CalendarEventPatchInput,
  ) => Promise<CalendarEventItem>;
  deleteEvent: (id: string) => Promise<void>;
  createWorkOrder: (input: NewWorkOrderInput) => Promise<WorkOrderItem>;
  updateWorkOrder: (
    id: string,
    patch: WorkOrderPatchInput,
  ) => Promise<WorkOrderItem>;
  reviewWorkOrder: (input: ReviewWorkOrderInput) => Promise<WorkOrderItem>;
  recordWorkOrderPayout: (
    input: RecordWorkOrderPayoutInput,
  ) => Promise<WorkOrderItem>;
  removeWorkOrderPayout: (workOrderId: string) => Promise<WorkOrderItem>;
  setWorkOrderPayoutStatus: (
    id: string,
    status: "PENDING" | "PAID",
  ) => Promise<WorkOrderItem>;
  deleteWorkOrder: (id: string) => Promise<void>;
  exportWorkOrderPdf: (
    id: string,
  ) => Promise<{ success: boolean; filePath: string }>;
  openWorkOrderPdf: (filePath: string, reveal?: boolean) => Promise<void>;
  getAnalyticsSummary: (
    period?: string,
    currency?: string,
    accountingMethod?: "accrual" | "cash",
  ) => Promise<AnalyticsSummaryPayload>;
  updateSettings: (patch: UpdateSettingsInput) => Promise<AppSettings>;
  getDbPath: () => Promise<string>;
  revealDbFile: () => Promise<void>;
  exportData: () => Promise<ExportDataPayload>;
  importData: (payload: ExportDataPayload) => Promise<{
    success: boolean;
    importedClients: number;
    importedInvoices: number;
  }>;
  resetData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

// In-memory fallback repository when running outside Electron.
let memoryCatalog: CatalogItem[] = [];
let memoryClients: ClientWithStats[] = [];
let memoryInvoices: InvoiceWithClient[] = [];
let memoryPayments: InvoicePayment[] = [];
let memoryVendors: VendorItem[] = [];
let memoryExpenses: ExpenseItem[] = [];
let memoryWorkOrders: WorkOrderItem[] = [];
let memoryEvents: CalendarEventItem[] = [];
let memoryTasks: TaskItem[] = [];
let memorySettings: AppSettings = { ...DEFAULT_SETTINGS };

// Browser storage implements the same async snapshot contract as desktop IPC.
async function loadBrowserSnapshot() {
  if (typeof window !== "undefined") {
    const saved = readBrowserPreferences(
      memorySettings,
      memoryVendors,
      localStorage,
    );
    memorySettings = saved.settings;
    memoryVendors = saved.vendors;
  }
  return {
    clients: [...memoryClients],
    invoices: [...memoryInvoices],
    vendors: [...memoryVendors],
    expenses: [...memoryExpenses],
    catalogItems: [...memoryCatalog],
    tasks: [...memoryTasks],
    workOrders: [...memoryWorkOrders],
    events: [...memoryEvents],
    settings: { ...memorySettings },
    dashboard: {
      activeClients: memoryClients.length,
      unpaidCount: memoryInvoices.filter(
        (invoice) => invoice.status !== "PAID" && invoice.status !== "DRAFT",
      ).length,
      totalBilledByCurrency: {
        USD: memoryInvoices.reduce((acc, inv) => acc + inv.amountCents, 0),
      },
      outstandingByCurrency: {
        USD: memoryInvoices.reduce(
          (acc, inv) => acc + (inv.amountCents - (inv.paidCents || 0)),
          0,
        ),
      },
      recentInvoices: memoryInvoices.slice(0, 5),
    },
  };
}

export function isTaskEligibleForInvoicing(task: TaskItem): boolean {
  return (
    task.status === "done" &&
    (task.invoiceId === null ||
      task.invoiceId === undefined ||
      task.invoiceId.trim() === "")
  );
}

export function filterUnbilledCompletedTasks(
  tasks: TaskItem[],
  options?: {
    clientId?: string | null;
    clientName?: string | null;
    includeAllClients?: boolean;
  },
): TaskItem[] {
  const unbilledDone = tasks.filter(isTaskEligibleForInvoicing);
  if (!options || options.includeAllClients) {
    return unbilledDone;
  }
  const targetClientId = options.clientId?.trim() || "";
  const targetClientName = options.clientName?.trim().toLowerCase() || "";
  if (!targetClientId && !targetClientName) {
    return unbilledDone;
  }
  return unbilledDone.filter((t) => {
    if (targetClientId && t.clientId === targetClientId) return true;
    if (
      targetClientName &&
      t.clientName &&
      t.clientName.trim().toLowerCase() === targetClientName
    ) {
      return true;
    }
    return false;
  });
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
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isElectron, setIsElectron] = useState<boolean>(false);

  const checkIsElectron = useCallback(() => {
    return (
      typeof window !== "undefined" && Boolean(window.billflow?.isElectron)
    );
  }, []);

  const loadSnapshot = useCallback(
    async (
      datasets?: WorkspaceDataset[],
    ): Promise<Partial<WorkspaceSnapshot> & { isElectron: boolean }> => {
      if (checkIsElectron() && window.billflow) {
        if (window.billflow.workspace)
          return {
            ...(await window.billflow.workspace.snapshot(datasets)),
            isElectron: true,
          };
        const [
          clients,
          invoices,
          dashboard,
          settings,
          vendors,
          catalogItems,
          tasks,
          trackingOffers,
          expensesList,
          workOrdersList,
          eventsList,
        ] = await Promise.all([
          window.billflow.clients.list(),
          window.billflow.invoices.list(),
          window.billflow.dashboard.summary(),
          window.billflow.settings.get(),
          window.billflow.vendors.list(),
          window.billflow.catalog.list(),
          window.billflow.tasks.list(),
          window.billflow.tracking.pending(),
          window.billflow.expenses
            ? window.billflow.expenses.list()
            : Promise.resolve([]),
          window.billflow.workOrders
            ?.list()
            .catch(() => [] as WorkOrderItem[]) ??
            Promise.resolve([] as WorkOrderItem[]),
          window.billflow.events
            ? window.billflow.events
                .list()
                .catch(() => [] as CalendarEventItem[])
            : Promise.resolve([] as CalendarEventItem[]),
        ]);
        hydrateTaskTimeSlots(
          Object.fromEntries(
            tasks.map((task) => [
              task.id,
              {
                startTime: task.startTime ?? null,
                endTime: task.endTime ?? null,
              },
            ]),
          ),
        );
        return {
          clients,
          invoices,
          dashboard,
          settings,
          vendors,
          catalogItems,
          tasks,
          trackingOffers,
          expenses: expensesList || [],
          workOrders: workOrdersList || [],
          events: eventsList || [],
          isElectron: true,
        };
      }
      const browser = await loadBrowserSnapshot();
      return {
        ...browser,
        trackingOffers: [] as TrackingOffer[],
        isElectron: false,
      };
    },
    [checkIsElectron],
  );

  const refreshQueue = useRef<Promise<void>>(Promise.resolve());
  const pendingRefresh = useRef<{
    promise: Promise<void>;
    resolve: () => void;
    datasets: Set<WorkspaceDataset> | null;
    scope: string;
  } | null>(null);
  const clearSnapshot = useCallback(() => {
    snapshotRequest.current++;
    setTasks([]);
    setTrackingOffers([]);
    setClients([]);
    setInvoices([]);
    setVendors([]);
    setExpenses([]);
    setWorkOrders([]);
    setEvents([]);
    setCatalogItems([]);
    setSettings(null);
    setDashboard(null);
  }, []);
  const refresh = useCallback(
    (datasets?: WorkspaceDataset[]) => {
      const scope = activeProfileScope();
      if (pendingRefresh.current && pendingRefresh.current.scope === scope) {
        if (!datasets) pendingRefresh.current.datasets = null;
        else if (pendingRefresh.current.datasets)
          datasets.forEach((d) => pendingRefresh.current!.datasets!.add(d));
        return pendingRefresh.current.promise;
      }
      let resolve!: () => void;
      const promise = new Promise<void>((r) => {
        resolve = r;
      });
      const pending = {
        promise,
        resolve,
        datasets: datasets ? new Set(datasets) : null,
        scope,
      };
      pendingRefresh.current = pending;
      setTimeout(() => {
        if (pendingRefresh.current === pending) pendingRefresh.current = null;
        refreshQueue.current = refreshQueue.current
          .catch(() => {})
          .then(() => {
            if (scope !== activeProfileScope()) {
              resolve();
              return;
            }
            const request = ++snapshotRequest.current;
            return loadSnapshot(
              pending.datasets ? [...pending.datasets] : undefined,
            )
              .then((snapshot) => {
                if (
                  request !== snapshotRequest.current ||
                  scope !== activeProfileScope() ||
                  (snapshot.profileId && snapshot.profileId !== scope)
                )
                  return;
                setIsElectron(snapshot.isElectron);
                if (snapshot.tasks) {
                  setTasks(snapshot.tasks);
                  hydrateTaskTimeSlots(
                    Object.fromEntries(
                      snapshot.tasks.map((task) => [
                        task.id,
                        {
                          startTime: task.startTime ?? null,
                          endTime: task.endTime ?? null,
                        },
                      ]),
                    ),
                  );
                }
                if (snapshot.trackingOffers)
                  setTrackingOffers(snapshot.trackingOffers);
                if (snapshot.clients) setClients(snapshot.clients);
                if (snapshot.invoices) setInvoices(snapshot.invoices);
                if (snapshot.vendors) setVendors(snapshot.vendors);
                if (snapshot.expenses) setExpenses(snapshot.expenses);
                if (snapshot.workOrders) setWorkOrders(snapshot.workOrders);
                if (snapshot.events) setEvents(snapshot.events);
                if (snapshot.catalogItems)
                  setCatalogItems(snapshot.catalogItems);
                if (snapshot.settings) setSettings(snapshot.settings);
                if (snapshot.dashboard) setDashboard(snapshot.dashboard);
                setError(null);
              })
              .catch((err: unknown) => {
                if (
                  request === snapshotRequest.current &&
                  scope === activeProfileScope()
                )
                  setError(
                    err instanceof Error ? err.message : "Failed to load data",
                  );
              })
              .finally(() => {
                if (request === snapshotRequest.current) setIsLoading(false);
                resolve();
              });
          });
      }, 0);
      return promise;
    },
    [loadSnapshot],
  );
  useEffect(() => {
    void refresh();
    const clear = () => clearSnapshot();
    const switched = () => {
      clearSnapshot();
      void refresh();
    };
    window.addEventListener("billflow:workspace-locked", clear);
    window.addEventListener("billflow:profile-switched", switched);
    const unsubscribe = window.billflow?.onDataChanged((change) => {
      if (change && change.profileId !== activeProfileScope()) return;
      void refresh(change?.datasets);
    });
    return () => {
      unsubscribe?.();
      window.removeEventListener("billflow:workspace-locked", clear);
      window.removeEventListener("billflow:profile-switched", switched);
    };
  }, [refresh, clearSnapshot]);

  const createClient = async (
    input: NewClientInput,
  ): Promise<ClientWithStats> => {
    if (checkIsElectron() && window.billflow) {
      const created = await window.billflow.clients.create(input);

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

  const updateClient = async (
    id: string,
    patch: ClientPatchInput,
  ): Promise<ClientWithStats> => {
    if (checkIsElectron() && window.billflow) {
      const updated = await window.billflow.clients.update(id, patch);

      return updated;
    } else {
      const idx = memoryClients.findIndex((c) => c.id === id);
      if (idx === -1) throw new Error("Client not found");
      const existing = memoryClients[idx];
      const updated: ClientWithStats = {
        ...existing,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      memoryClients[idx] = updated;
      await refresh();
      return updated;
    }
  };

  const deleteClient = async (id: string): Promise<void> => {
    if (checkIsElectron() && window.billflow) {
      await window.billflow.clients.remove(id);
    } else {
      const hasInvoices = memoryInvoices.some((i) => i.clientId === id);
      if (hasInvoices) {
        throw new Error("Cannot delete client with linked invoices.");
      }
      memoryClients = memoryClients.filter((c) => c.id !== id);
      await refresh();
    }
  };

  const createInvoice = async (
    input: NewInvoiceInput,
  ): Promise<InvoiceWithClient> => {
    if (checkIsElectron() && window.billflow) {
      const created = await window.billflow.invoices.create(input);

      return created;
    } else {
      if (!input.clientId || input.newClient)
        throw new Error(
          "Open the desktop app to create a new client with its invoice.",
        );
      const client = memoryClients.find((c) => c.id === input.clientId);
      const id = `inv-${Date.now()}`;
      const code =
        input.code ||
        `INV-${new Date().getFullYear()}-${String(memoryInvoices.length + 1).padStart(3, "0")}`;
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
        clientPhone: client?.phone,
        clientContactPerson: client?.contactPerson,
        clientCategory: client?.category,
        items: input.items
          ? input.items.map((it, idx) => ({
              id: it.id || `item-${Date.now()}-${idx}`,
              invoiceId: id,
              catalogId: it.catalogId || null,
              description: it.description,
              quantity: it.quantity,
              unitPriceCents: it.unitPriceCents,
              position: idx,
            }))
          : [],
        payments: [],
      };
      memoryInvoices = [newInv, ...memoryInvoices];

      // Link any imported tasks in browser fallback memory
      const nowIso = new Date().toISOString();
      const sourceItemMap = new Map<string, string>();
      if (input.items && newInv.items) {
        input.items.forEach((it, idx) => {
          if (it.sourceTaskId && newInv.items?.[idx]) {
            sourceItemMap.set(it.sourceTaskId, newInv.items[idx].id);
          }
        });
      }
      const linkedSet = new Set<string>([
        ...(input.linkedTaskIds || []),
        ...Array.from(sourceItemMap.keys()),
      ]);
      if (linkedSet.size > 0) {
        memoryTasks = memoryTasks.map((t) => {
          if (!linkedSet.has(t.id)) return t;
          return {
            ...t,
            invoiceId: id,
            invoiceCode: code,
            invoiceItemId: sourceItemMap.get(t.id) ?? t.invoiceItemId ?? null,
            clientId: t.clientId || input.clientId || null,
            clientName: t.clientName || client?.name,
            updatedAt: nowIso,
          };
        });
      }

      await refresh();
      return newInv;
    }
  };

  const updateInvoice = async (
    id: string,
    patch: InvoicePatchInput,
  ): Promise<InvoiceWithClient> => {
    if (checkIsElectron() && window.billflow) {
      const updated = await window.billflow.invoices.update(id, patch);

      return updated;
    } else {
      const idx = memoryInvoices.findIndex((i) => i.id === id);
      if (idx === -1) throw new Error("Invoice not found");
      const client = patch.clientId
        ? memoryClients.find((c) => c.id === patch.clientId)
        : undefined;
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
        clientPhone: client ? client.phone : target.clientPhone,
        clientContactPerson: client
          ? client.contactPerson
          : target.clientContactPerson,
        clientCategory: client ? client.category : target.clientCategory,
        updatedAt: new Date().toISOString(),
      };
      memoryInvoices[idx] = updated;
      await refresh();
      return updated;
    }
  };

  const promoteInvoiceClient = async (
    invoiceId: string,
  ): Promise<ClientWithStats> => {
    if (checkIsElectron() && window.billflow) {
      const client = await window.billflow.invoices.promoteClient(invoiceId);

      return client;
    } else {
      const inv = memoryInvoices.find((i) => i.id === invoiceId);
      if (!inv) throw new Error("Invoice not found");
      const clientName = inv.clientName || "Promoted Client";
      const clientEmail = inv.clientEmail || "";
      const id = `cli-${Date.now()}`;
      const newClient: ClientWithStats = {
        id,
        name: clientName,
        category: "Freelance",
        contactPerson: clientName,
        contactRole: null,
        email: clientEmail,
        phone: null,
        currency: inv.currency,
        driveUrl: inv.deliveryUrl || null,
        hasQuickBill: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        totalBilledCents: inv.amountCents,
        totalPaidCents: inv.paidCents,
        outstandingBalanceCents: Math.max(0, inv.amountCents - inv.paidCents),
        invoicesCount: 1,
        recentInvoices: [],
      };
      memoryClients.push(newClient);
      inv.clientId = id;
      await refresh();
      return newClient;
    }
  };

  const setInvoiceStatus = async (
    id: string,
    status: InvoiceStatus,
  ): Promise<InvoiceWithClient> => {
    if (checkIsElectron() && window.billflow) {
      const updated = await window.billflow.invoices.setStatus(id, status);

      return updated;
    } else {
      return updateInvoice(id, { status });
    }
  };

  const recordPayment = async (
    input: RecordPaymentInput,
  ): Promise<{ invoice: InvoiceWithClient; payment: InvoicePayment }> => {
    if (checkIsElectron() && window.billflow) {
      const result = await window.billflow.invoices.recordPayment(input);

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
      memoryInvoices = memoryInvoices.map((i) =>
        i.id === inv.id ? updated : i,
      );
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

  const exportInvoicePdf = async (
    invoiceId: string,
    template?: string,
  ): Promise<{ success: boolean; filePath: string }> => {
    if (checkIsElectron() && window.billflow) {
      return await window.billflow.invoices.exportPdf(invoiceId, template);
    }
    return { success: true, filePath: "invoice.pdf" };
  };

  const saveInvoicePdfAs = async (
    invoiceId: string,
    template?: string,
    draft?: NewInvoiceInput,
  ): Promise<{ success: boolean; canceled?: boolean; filePath?: string }> => {
    if (checkIsElectron() && window.billflow?.invoices?.savePdfAs) {
      return await window.billflow.invoices.savePdfAs(
        invoiceId,
        template,
        draft,
      );
    }
    window.print();
    return { success: true, canceled: false };
  };

  const openInvoicePdf = async (
    invoiceId: string,
    reveal?: boolean,
  ): Promise<void> => {
    if (checkIsElectron() && window.billflow) {
      await window.billflow.files.openInvoicePdf(invoiceId, reveal);
    }
  };

  const deleteInvoice = async (id: string): Promise<void> => {
    if (checkIsElectron() && window.billflow) {
      await window.billflow.invoices.remove(id);
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
      const nextSeq = Math.max(
        memorySettings.nextInvoiceSeq || 1,
        memoryInvoices.length + 1,
      );
      return `${activePrefix}${String(nextSeq).padStart(3, "0")}`;
    }
  };

  const updateSettings = async (
    patch: UpdateSettingsInput,
  ): Promise<AppSettings> => {
    if (checkIsElectron() && window.billflow) {
      const updated = await window.billflow.settings.update(patch);

      return updated;
    } else {
      memorySettings = {
        ...memorySettings,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      if (typeof window !== "undefined") {
        localStorage.setItem(
          "billflow_memory_settings",
          JSON.stringify(memorySettings),
        );
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
        version: "0.2.0",
        exportedAt: new Date().toISOString(),
        settings: memorySettings,
        clients: memoryClients,
        invoices: memoryInvoices,
      };
    }
  };

  const importData = async (
    payload: ExportDataPayload,
  ): Promise<{
    success: boolean;
    importedClients: number;
    importedInvoices: number;
  }> => {
    if (checkIsElectron() && window.billflow) {
      const res = await window.billflow.settings.import(payload);

      return res;
    } else {
      if (payload.settings) {
        memorySettings = { ...memorySettings, ...payload.settings };
        if (typeof window !== "undefined") {
          localStorage.setItem(
            "billflow_memory_settings",
            JSON.stringify(memorySettings),
          );
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
        importedClients: Array.isArray(payload.clients)
          ? payload.clients.length
          : 0,
        importedInvoices: Array.isArray(payload.invoices)
          ? payload.invoices.length
          : 0,
      };
    }
  };

  const resetData = async (): Promise<void> => {
    if (checkIsElectron() && window.billflow) {
      await window.billflow.settings.reset();
    } else {
      memoryCatalog = [];
      memoryClients = [];
      memoryInvoices = [];
      memoryVendors = [];
      memoryExpenses = [];
      memoryWorkOrders = [];
      memoryTasks = [];
      memoryPayments = [];
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

  const createCatalogItem = async (
    input: NewCatalogItemInput,
  ): Promise<CatalogItem> => {
    if (checkIsElectron() && window.billflow) {
      const created = await window.billflow.catalog.create(input);
      return created;
    }
    const priceCents = Math.round(parseFloat(input.price || "0") * 100);
    const item: CatalogItem = {
      id: `cat-${Date.now()}`,
      title: input.title,
      category: input.category,
      sku: input.sku || `SKU-${Date.now()}`,
      description: input.description || "",
      price: input.price || "0.00",
      priceCents,
      currency: input.currency || "USD",
      unit: input.unit || "/ Hourly",
      iconType: input.iconType || "code",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    memoryCatalog = [item, ...memoryCatalog];
    await refresh();
    return item;
  };
  const updateCatalogItem = async (
    id: string,
    patch: CatalogItemPatchInput,
  ): Promise<CatalogItem> => {
    if (checkIsElectron() && window.billflow) {
      const updated = await window.billflow.catalog.update(id, patch);
      return updated;
    }
    const idx = memoryCatalog.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error("Catalog item not found");
    const existing = memoryCatalog[idx];
    const price = patch.price !== undefined ? patch.price : existing.price;
    const priceCents =
      patch.price !== undefined
        ? Math.round(parseFloat(patch.price || "0") * 100)
        : existing.priceCents;
    const updated: CatalogItem = {
      ...existing,
      ...patch,
      price,
      priceCents,
      updatedAt: new Date().toISOString(),
    };
    memoryCatalog[idx] = updated;
    await refresh();
    return updated;
  };
  const deleteCatalogItem = async (id: string): Promise<void> => {
    if (checkIsElectron() && window.billflow) {
      await window.billflow.catalog.remove(id);
      return;
    }
    memoryCatalog = memoryCatalog.filter((c) => c.id !== id);
    await refresh();
  };
  const bulkImportCatalogItems = async (
    items: NewCatalogItemInput[],
  ): Promise<number> => {
    if (checkIsElectron() && window.billflow) {
      const result = await window.billflow.catalog.bulkImport(items);
      return result.count;
    }
    const imported: CatalogItem[] = items.map((input, idx) => {
      const priceCents = Math.round(parseFloat(input.price || "0") * 100);
      return {
        id: `cat-${Date.now()}-${idx}`,
        title: input.title,
        category: input.category,
        sku: input.sku || `SKU-${Date.now()}-${idx}`,
        description: input.description || "",
        price: input.price || "0.00",
        priceCents,
        currency: input.currency || "USD",
        unit: input.unit || "/ Hourly",
        iconType: input.iconType || "code",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
    memoryCatalog = [...imported, ...memoryCatalog];
    await refresh();
    return imported.length;
  };

  const createVendor = async (input: NewVendorInput): Promise<VendorItem> => {
    if (checkIsElectron() && window.billflow) {
      const created = await window.billflow.vendors.create(input);

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
        localStorage.setItem(
          "billflow_outsourcing_vendors",
          JSON.stringify(memoryVendors),
        );
      }
      await refresh();
      return newVendor;
    }
  };

  const updateVendor = async (
    id: string,
    patch: VendorPatchInput,
  ): Promise<VendorItem> => {
    if (checkIsElectron() && window.billflow) {
      const updated = await window.billflow.vendors.update(id, patch);

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
        localStorage.setItem(
          "billflow_outsourcing_vendors",
          JSON.stringify(memoryVendors),
        );
      }
      await refresh();
      return updated;
    }
  };

  const setVendorStatus = async (
    id: string,
    status: "PENDING" | "PAID",
  ): Promise<VendorItem> => {
    if (checkIsElectron() && window.billflow) {
      const updated = await window.billflow.vendors.setStatus(id, status);

      return updated;
    } else {
      return updateVendor(id, { status });
    }
  };

  const deleteVendor = async (id: string): Promise<void> => {
    if (checkIsElectron() && window.billflow) {
      await window.billflow.vendors.remove(id);
    } else {
      memoryVendors = memoryVendors.filter((v) => v.id !== id);
      if (typeof window !== "undefined") {
        localStorage.setItem(
          "billflow_outsourcing_vendors",
          JSON.stringify(memoryVendors),
        );
      }
      await refresh();
    }
  };

  /**
   * Creates a new per-job payable work order.
   * In Electron desktop mode, saves to SQLite `work_orders`, updates the linked task
   * with outsourcing metadata, and increments the vendor balance.
   */
  const createWorkOrder = async (
    input: NewWorkOrderInput,
  ): Promise<WorkOrderItem> => {
    if (checkIsElectron() && window.billflow?.workOrders) {
      const created = await window.billflow.workOrders.create(input);

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
  const updateWorkOrder = async (
    id: string,
    patch: WorkOrderPatchInput,
  ): Promise<WorkOrderItem> => {
    if (checkIsElectron() && window.billflow?.workOrders) {
      const updated = await window.billflow.workOrders.update(id, patch);

      return updated;
    } else {
      const idx = memoryWorkOrders.findIndex((w) => w.id === id);
      if (idx === -1) throw new Error("Work order not found");
      const existing = memoryWorkOrders[idx];
      const updated: WorkOrderItem = {
        ...existing,
        ...patch,
        completedAt:
          patch.status === "done" && !existing.completedAt
            ? new Date().toISOString()
            : existing.completedAt,
      };
      memoryWorkOrders[idx] = updated;
      await refresh();
      return updated;
    }
  };

  /**
   * Reviews contractor deliverable, saves deliverable URL & notes, and updates the original task after review.
   */
  const reviewWorkOrder = async (
    input: ReviewWorkOrderInput,
  ): Promise<WorkOrderItem> => {
    if (checkIsElectron() && window.billflow?.workOrders) {
      const updated = await window.billflow.workOrders.review(input);

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
  const recordWorkOrderPayout = async (
    input: RecordWorkOrderPayoutInput,
  ): Promise<WorkOrderItem> => {
    if (checkIsElectron() && window.billflow?.workOrders) {
      const updated = await window.billflow.workOrders.recordPayout(input);

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
  const removeWorkOrderPayout = async (
    workOrderId: string,
  ): Promise<WorkOrderItem> => {
    if (checkIsElectron() && window.billflow?.workOrders) {
      const updated =
        await window.billflow.workOrders.removePayout(workOrderId);

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
  const setWorkOrderPayoutStatus = async (
    id: string,
    status: "PENDING" | "PAID",
  ): Promise<WorkOrderItem> => {
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
    } else {
      memoryWorkOrders = memoryWorkOrders.filter((w) => w.id !== id);
      await refresh();
    }
  };

  const exportWorkOrderPdf = async (
    id: string,
  ): Promise<{ success: boolean; filePath: string }> => {
    if (checkIsElectron() && window.billflow?.workOrders) {
      return await window.billflow.workOrders.exportPdf(id);
    }
    return { success: true, filePath: "" };
  };

  const openWorkOrderPdf = async (
    filePath: string,
    reveal = false,
  ): Promise<void> => {
    if (checkIsElectron() && window.billflow?.workOrders) {
      await window.billflow.workOrders.openPdf(filePath, reveal);
    }
  };

  const getAnalyticsSummary = useCallback(
    async (
      period?: string,
      currency?: string,
      accountingMethod: "accrual" | "cash" = "accrual",
    ): Promise<AnalyticsSummaryPayload> => {
      if (checkIsElectron() && window.billflow)
        return window.billflow.analytics.summary(
          period,
          currency,
          accountingMethod,
        );
      return calculateFinancials({
        invoices: memoryInvoices,
        workOrders: memoryWorkOrders,
        expenses: memoryExpenses,
        tasks,
        period,
        currency:
          currency && !["ALL", "all"].includes(currency)
            ? currency
            : memorySettings.defaultCurrency,
        accountingMethod,
        clientCount: memoryClients.length,
        vendorCount: memoryVendors.length,
      });
    },
    [checkIsElectron, tasks],
  );

  const createExpense = async (
    input: NewExpenseInput,
  ): Promise<ExpenseItem> => {
    if (checkIsElectron() && window.billflow?.expenses) {
      const created = await window.billflow.expenses.create(input);

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

  const updateExpense = async (
    id: string,
    patch: ExpensePatchInput,
  ): Promise<ExpenseItem> => {
    if (checkIsElectron() && window.billflow?.expenses) {
      const updated = await window.billflow.expenses.update(id, patch);

      return updated;
    } else {
      memoryExpenses = memoryExpenses.map((exp) =>
        exp.id === id ? { ...exp, ...patch } : exp,
      );
      const found = memoryExpenses.find((exp) => exp.id === id);
      if (!found) throw new Error("Expense not found");
      await refresh();
      return found;
    }
  };

  const deleteExpense = async (id: string): Promise<void> => {
    if (checkIsElectron() && window.billflow?.expenses) {
      await window.billflow.expenses.remove(id);
    } else {
      memoryExpenses = memoryExpenses.filter((exp) => exp.id !== id);
      await refresh();
    }
  };

  const attachExpenseReceipt = async (
    expenseId: string,
    requestId: string,
  ): Promise<AttachmentItem | null> => {
    if (checkIsElectron() && window.billflow?.attachments) {
      const item = await window.billflow.attachments.select(
        { type: "expense", id: expenseId },
        requestId,
      );

      return item;
    }
    return null;
  };

  const createEvent = async (
    input: NewCalendarEventInput,
  ): Promise<CalendarEventItem> => {
    if (checkIsElectron() && window.billflow?.events) {
      const created = await window.billflow.events.create(input);

      return created;
    } else {
      const id = input.id || `evt-${Date.now()}`;
      const now = new Date().toISOString();
      const newEvt: CalendarEventItem = {
        id,
        title: input.title,
        description: input.description || "",
        startDate: input.startDate,
        endDate: input.endDate || null,
        startTime: input.startTime || null,
        endTime: input.endTime || null,
        isAllDay: Boolean(input.isAllDay),
        category: input.category || "general",
        color: input.color || "blue",
        clientId: input.clientId || null,
        clientName: input.clientName || null,
        taskId: input.taskId || null,
        taskTitle: input.taskTitle || null,
        location: input.location || null,
        createdAt: now,
        updatedAt: now,
      };
      memoryEvents = [newEvt, ...memoryEvents];
      await refresh();
      return newEvt;
    }
  };

  const updateEvent = async (
    id: string,
    patch: CalendarEventPatchInput,
  ): Promise<CalendarEventItem> => {
    if (checkIsElectron() && window.billflow?.events) {
      const updated = await window.billflow.events.update(id, patch);

      return updated;
    } else {
      const now = new Date().toISOString();
      memoryEvents = memoryEvents.map((evt) =>
        evt.id === id ? { ...evt, ...patch, updatedAt: now } : evt,
      );
      const found = memoryEvents.find((evt) => evt.id === id);
      if (!found) throw new Error("Calendar event not found");
      await refresh();
      return found;
    }
  };

  const deleteEvent = async (id: string): Promise<void> => {
    if (checkIsElectron() && window.billflow?.events) {
      await window.billflow.events.remove(id);
    } else {
      memoryEvents = memoryEvents.filter((evt) => evt.id !== id);
      await refresh();
    }
  };

  const requireDesktop = () => {
    if (!checkIsElectron() || !window.billflow)
      throw new Error(
        "Open the BillFlow desktop app to save workflow records.",
      );
    return window.billflow;
  };
  const workflow: WorkflowAPI = {
    tasks: {
      list: async () =>
        checkIsElectron() && window.billflow
          ? window.billflow.tasks.list()
          : [...memoryTasks],
      create: async (input) => {
        if (checkIsElectron() && window.billflow) {
          const result = await window.billflow.tasks.create(input);

          return result;
        }
        const created: TaskItem = {
          ...input,
          id: input.id || `tsk-${Date.now()}`,
          subtasks: input.subtasks || [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          activeMilliseconds: 0,
        };
        memoryTasks = [created, ...memoryTasks];
        await refresh();
        return created;
      },
      update: async (id, patch) => {
        if (checkIsElectron() && window.billflow) {
          const result = await window.billflow.tasks.update(id, patch);

          return result;
        }
        const idx = memoryTasks.findIndex((t) => t.id === id);
        if (idx === -1) throw new Error("Task not found");
        const existing = memoryTasks[idx];
        const updated: TaskItem = {
          ...existing,
          ...patch,
          updatedAt: new Date().toISOString(),
          completedAt:
            patch.status === "done" && !existing.completedAt
              ? new Date().toISOString()
              : existing.completedAt,
        };
        memoryTasks[idx] = updated;
        await refresh();
        return updated;
      },
      remove: async (id) => {
        if (checkIsElectron() && window.billflow) {
          await window.billflow.tasks.remove(id);

          return;
        }
        memoryTasks = memoryTasks.filter((t) => t.id !== id);
        await refresh();
      },
      history: async () => [],
    },
    tracking: {
      pending: async () => requireDesktop().tracking.pending(),
      decide: async (id, choice) => {
        const result = await requireDesktop().tracking.decide(id, choice);
        await refresh();
        return result;
      },
    },
    attachments: {
      list: async (owner) => requireDesktop().attachments.list(owner),
      select: async (owner, requestId, filePath?) => {
        const result = await requireDesktop().attachments.select(
          owner,
          requestId,
          filePath,
        );
        await refresh();
        return result;
      },
      chooseFile: async () => {
        const fn = requireDesktop().attachments.chooseFile;
        return fn ? fn() : null;
      },
      open: async (id) => requireDesktop().attachments.open(id),
    },
    files: {
      selectPdfDirectory: async () =>
        requireDesktop().files.selectPdfDirectory(),
      openInvoicePdf: async (id, reveal) =>
        requireDesktop().files.openInvoicePdf(id, reveal),
    },
  };

  const getUnbilledCompletedTasks = useCallback(
    (options?: {
      clientId?: string | null;
      clientName?: string | null;
      includeAllClients?: boolean;
    }): TaskItem[] => {
      return filterUnbilledCompletedTasks(tasks, options);
    },
    [tasks],
  );

  const activeCurrency: Currency = useMemo(() => {
    return getSystemCurrency(settings?.defaultCurrency, invoices, "USD");
  }, [settings?.defaultCurrency, invoices]);

  return (
    <DataContext.Provider
      value={{
        tasks,
        trackingOffers,
        workflow,
        getUnbilledCompletedTasks,
        clients,
        invoices,
        vendors,
        expenses,
        workOrders,
        events,
        catalogItems,
        createCatalogItem,
        updateCatalogItem,
        deleteCatalogItem,
        bulkImportCatalogItems,
        dashboard,
        settings,
        activeCurrency,
        isLoading,
        isElectron,
        error,
        refresh,
        createClient,
        updateClient,
        deleteClient,
        createInvoice,
        updateInvoice,
        promoteInvoiceClient,
        setInvoiceStatus,
        recordPayment,
        listPayments,
        exportInvoicePdf,
        saveInvoicePdfAs,
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
        createEvent,
        updateEvent,
        deleteEvent,
        createWorkOrder,
        updateWorkOrder,
        reviewWorkOrder,
        recordWorkOrderPayout,
        removeWorkOrderPayout,
        setWorkOrderPayoutStatus,
        deleteWorkOrder,
        exportWorkOrderPdf,
        openWorkOrderPdf,
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
  const {
    clients,
    isLoading,
    error,
    createClient,
    updateClient,
    deleteClient,
    refresh,
  } = useData();
  return {
    clients,
    isLoading,
    error,
    createClient,
    updateClient,
    deleteClient,
    refresh,
  };
}

export function useInvoices(filter?: { clientId?: string }) {
  const {
    invoices,
    activeCurrency,
    isLoading,
    error,
    createInvoice,
    updateInvoice,
    promoteInvoiceClient,
    setInvoiceStatus,
    recordPayment,
    listPayments,
    exportInvoicePdf,
    saveInvoicePdfAs,
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
    promoteInvoiceClient,
    promoteClient: promoteInvoiceClient,
    setInvoiceStatus,
    recordPayment,
    listPayments,
    exportInvoicePdf,
    saveInvoicePdfAs,
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
    exportWorkOrderPdf,
    openWorkOrderPdf,
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
    exportWorkOrderPdf,
    openWorkOrderPdf,
    refresh,
  };
}

export function useCatalog() {
  const {
    catalogItems,
    createCatalogItem,
    updateCatalogItem,
    deleteCatalogItem,
    bulkImportCatalogItems,
    isLoading,
    isElectron,
    error,
  } = useData();
  return {
    catalogItems,
    createCatalogItem,
    updateCatalogItem,
    deleteCatalogItem,
    bulkImportCatalogItems,
    isLoading,
    isElectron,
    error,
  };
}

export function useExpenses(filter?: { category?: string }) {
  const {
    expenses,
    isLoading,
    error,
    createExpense,
    updateExpense,
    deleteExpense,
    attachExpenseReceipt,
    refresh,
  } = useData();
  const category = filter?.category;
  const filteredExpenses = useMemo(() => {
    if (!category || category === "All Categories") return expenses;
    return expenses.filter((e) => e.category === category);
  }, [expenses, category]);
  return {
    expenses: filteredExpenses,
    allExpenses: expenses,
    isLoading,
    error,
    createExpense,
    updateExpense,
    deleteExpense,
    attachExpenseReceipt,
    refresh,
  };
}
