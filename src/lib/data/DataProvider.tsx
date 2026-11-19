"use client";
import { activeProfileScope } from "@/lib/profile-scope";
import type { WorkspaceDataset, WorkspaceSnapshot } from "@/types/workspace";
import { hydrateTaskTimeSlots } from "@/lib/local-calendar";

import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
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
  BackupStatus,
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
  backupStatus: BackupStatus | null;
  activeCurrency: Currency;
  isLoading: boolean;
  isElectron: boolean;
  error: string | null;
  refresh: (datasets?: WorkspaceDataset[]) => Promise<void>;
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
  removeWorkOrderPayout: (
    workOrderId: string,
    payoutId?: string,
  ) => Promise<WorkOrderItem>;
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
  importData: (
    payload: ExportDataPayload,
    mode?: "replace" | "merge",
  ) => Promise<{
    success: boolean;
    importedClients: number;
    importedInvoices: number;
  }>;
  resetData: () => Promise<void>;
}

type RefreshFn = (datasets?: WorkspaceDataset[]) => Promise<void>;

interface ClientsContextValue {
  clients: ClientWithStats[];
  isLoading: boolean;
  error: string | null;
  createClient: DataContextType["createClient"];
  updateClient: DataContextType["updateClient"];
  deleteClient: DataContextType["deleteClient"];
  refresh: RefreshFn;
}

interface InvoicesContextValue {
  invoices: InvoiceWithClient[];
  activeCurrency: Currency;
  isLoading: boolean;
  error: string | null;
  createInvoice: DataContextType["createInvoice"];
  updateInvoice: DataContextType["updateInvoice"];
  promoteInvoiceClient: DataContextType["promoteInvoiceClient"];
  promoteClient: DataContextType["promoteInvoiceClient"];
  setInvoiceStatus: DataContextType["setInvoiceStatus"];
  recordPayment: DataContextType["recordPayment"];
  listPayments: DataContextType["listPayments"];
  exportInvoicePdf: DataContextType["exportInvoicePdf"];
  saveInvoicePdfAs: DataContextType["saveInvoicePdfAs"];
  openInvoicePdf: DataContextType["openInvoicePdf"];
  deleteInvoice: DataContextType["deleteInvoice"];
  getNextInvoiceCode: DataContextType["getNextInvoiceCode"];
  refresh: RefreshFn;
}

interface SettingsContextValue {
  settings: AppSettings | null;
  backupStatus: BackupStatus | null;
  isLoading: boolean;
  error: string | null;
  updateSettings: DataContextType["updateSettings"];
  getDbPath: DataContextType["getDbPath"];
  revealDbFile: DataContextType["revealDbFile"];
  exportData: DataContextType["exportData"];
  importData: DataContextType["importData"];
  resetData: DataContextType["resetData"];
  refresh: RefreshFn;
}

interface VendorsContextValue {
  vendors: VendorItem[];
  isLoading: boolean;
  error: string | null;
  createVendor: DataContextType["createVendor"];
  updateVendor: DataContextType["updateVendor"];
  setVendorStatus: DataContextType["setVendorStatus"];
  deleteVendor: DataContextType["deleteVendor"];
  refresh: RefreshFn;
}

interface WorkOrdersContextValue {
  workOrders: WorkOrderItem[];
  isLoading: boolean;
  error: string | null;
  createWorkOrder: DataContextType["createWorkOrder"];
  updateWorkOrder: DataContextType["updateWorkOrder"];
  reviewWorkOrder: DataContextType["reviewWorkOrder"];
  recordWorkOrderPayout: DataContextType["recordWorkOrderPayout"];
  removeWorkOrderPayout: DataContextType["removeWorkOrderPayout"];
  setWorkOrderPayoutStatus: DataContextType["setWorkOrderPayoutStatus"];
  deleteWorkOrder: DataContextType["deleteWorkOrder"];
  exportWorkOrderPdf: DataContextType["exportWorkOrderPdf"];
  openWorkOrderPdf: DataContextType["openWorkOrderPdf"];
  refresh: RefreshFn;
}

interface CatalogContextValue {
  catalogItems: CatalogItem[];
  createCatalogItem: DataContextType["createCatalogItem"];
  updateCatalogItem: DataContextType["updateCatalogItem"];
  deleteCatalogItem: DataContextType["deleteCatalogItem"];
  bulkImportCatalogItems: DataContextType["bulkImportCatalogItems"];
  isLoading: boolean;
  isElectron: boolean;
  error: string | null;
}

interface ExpensesContextValue {
  expenses: ExpenseItem[];
  isLoading: boolean;
  error: string | null;
  createExpense: DataContextType["createExpense"];
  updateExpense: DataContextType["updateExpense"];
  deleteExpense: DataContextType["deleteExpense"];
  attachExpenseReceipt: DataContextType["attachExpenseReceipt"];
  refresh: RefreshFn;
}

interface TasksContextValue {
  tasks: TaskItem[];
  trackingOffers: TrackingOffer[];
  getUnbilledCompletedTasks: DataContextType["getUnbilledCompletedTasks"];
  isLoading: boolean;
  error: string | null;
  workflow: WorkflowAPI;
  refresh: RefreshFn;
}

const DataContext = createContext<DataContextType | null>(null);
const RefreshContext = createContext<RefreshFn | null>(null);
const CurrencyContext = createContext<{ activeCurrency: Currency } | null>(
  null,
);
const ClientsContext = createContext<ClientsContextValue | null>(null);
const InvoicesContext = createContext<InvoicesContextValue | null>(null);
const SettingsContext = createContext<SettingsContextValue | null>(null);
const VendorsContext = createContext<VendorsContextValue | null>(null);
const WorkOrdersContext = createContext<WorkOrdersContextValue | null>(null);
const CatalogContext = createContext<CatalogContextValue | null>(null);
const ExpensesContext = createContext<ExpensesContextValue | null>(null);
const TasksContext = createContext<TasksContextValue | null>(null);

function checkIsElectron(): boolean {
  return typeof window !== "undefined" && Boolean(window.billflow?.isElectron);
}

function requireDesktop() {
  if (!checkIsElectron() || !window.billflow) {
    throw new Error("Open the BillFlow desktop app to save workflow records.");
  }
  return window.billflow;
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
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isElectron, setIsElectron] = useState<boolean>(false);

  const loadSnapshot = useCallback(
    async (
      datasets?: WorkspaceDataset[],
    ): Promise<Partial<WorkspaceSnapshot> & { isElectron: boolean }> => {
      if (checkIsElectron() && window.billflow) {
        if (window.billflow.workspace) {
          return {
            ...(await window.billflow.workspace.snapshot(datasets)),
            isElectron: true,
          };
        }
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
          window.billflow.expenses.list(),
          window.billflow.workOrders
            .list()
            .catch(() => [] as WorkOrderItem[]),
          window.billflow.events
            .list()
            .catch(() => [] as CalendarEventItem[]),
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
      return {
        clients: [],
        invoices: [],
        vendors: [],
        expenses: [],
        catalogItems: [],
        tasks: [],
        workOrders: [],
        events: [],
        trackingOffers: [],
        isElectron: false,
      };
    },
    [],
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
    setBackupStatus(null);
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
                if (snapshot.backupStatus)
                  setBackupStatus(snapshot.backupStatus);
                if (!snapshot.isElectron) {
                  setSettings(null);
                  setDashboard(null);
                }
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
  ): Promise<ClientWithStats> => requireDesktop().clients.create(input);

  const updateClient = async (
    id: string,
    patch: ClientPatchInput,
  ): Promise<ClientWithStats> => requireDesktop().clients.update(id, patch);

  const deleteClient = async (id: string): Promise<void> => {
    await requireDesktop().clients.remove(id);
  };

  const createInvoice = async (
    input: NewInvoiceInput,
  ): Promise<InvoiceWithClient> => requireDesktop().invoices.create(input);

  const updateInvoice = async (
    id: string,
    patch: InvoicePatchInput,
  ): Promise<InvoiceWithClient> => requireDesktop().invoices.update(id, patch);

  const promoteInvoiceClient = async (
    invoiceId: string,
  ): Promise<ClientWithStats> =>
    requireDesktop().invoices.promoteClient(invoiceId);

  const setInvoiceStatus = async (
    id: string,
    status: InvoiceStatus,
  ): Promise<InvoiceWithClient> =>
    requireDesktop().invoices.setStatus(id, status);

  const recordPayment = async (
    input: RecordPaymentInput,
  ): Promise<{ invoice: InvoiceWithClient; payment: InvoicePayment }> =>
    requireDesktop().invoices.recordPayment(input);

  const listPayments = async (invoiceId: string): Promise<InvoicePayment[]> =>
    requireDesktop().invoices.listPayments(invoiceId);

  const exportInvoicePdf = async (
    invoiceId: string,
    template?: string,
  ): Promise<{ success: boolean; filePath: string }> =>
    requireDesktop().invoices.exportPdf(invoiceId, template);

  const saveInvoicePdfAs = async (
    invoiceId: string,
    template?: string,
    draft?: NewInvoiceInput,
  ): Promise<{ success: boolean; canceled?: boolean; filePath?: string }> => {
    const fn = requireDesktop().invoices.savePdfAs;
    if (!fn) {
      throw new Error(
        "Open the BillFlow desktop app to save invoice PDFs.",
      );
    }
    return await fn(invoiceId, template, draft);
  };

  const openInvoicePdf = async (
    invoiceId: string,
    reveal?: boolean,
  ): Promise<void> => {
    await requireDesktop().files.openInvoicePdf(invoiceId, reveal);
  };

  const deleteInvoice = async (id: string): Promise<void> => {
    await requireDesktop().invoices.remove(id);
  };

  const getNextInvoiceCode = async (): Promise<string> =>
    requireDesktop().invoices.nextCode();

  const updateSettings = async (
    patch: UpdateSettingsInput,
  ): Promise<AppSettings> => requireDesktop().settings.update(patch);

  const getDbPath = async (): Promise<string> =>
    requireDesktop().settings.getDbPath();

  const revealDbFile = async (): Promise<void> => {
    await requireDesktop().settings.revealDbFile();
  };

  const exportData = async (): Promise<ExportDataPayload> =>
    requireDesktop().settings.export();

  const importData = async (
    payload: ExportDataPayload,
    mode?: "replace" | "merge",
  ): Promise<{
    success: boolean;
    importedClients: number;
    importedInvoices: number;
  }> => requireDesktop().settings.import(payload, mode);

  const resetData = async (): Promise<void> => {
    await requireDesktop().settings.reset();
  };

  const createCatalogItem = async (
    input: NewCatalogItemInput,
  ): Promise<CatalogItem> => requireDesktop().catalog.create(input);

  const updateCatalogItem = async (
    id: string,
    patch: CatalogItemPatchInput,
  ): Promise<CatalogItem> => requireDesktop().catalog.update(id, patch);

  const deleteCatalogItem = async (id: string): Promise<void> => {
    await requireDesktop().catalog.remove(id);
  };

  const bulkImportCatalogItems = async (
    items: NewCatalogItemInput[],
  ): Promise<number> => {
    const result = await requireDesktop().catalog.bulkImport(items);
    return result.count;
  };

  const createVendor = async (input: NewVendorInput): Promise<VendorItem> =>
    requireDesktop().vendors.create(input);

  const updateVendor = async (
    id: string,
    patch: VendorPatchInput,
  ): Promise<VendorItem> => requireDesktop().vendors.update(id, patch);

  const setVendorStatus = async (
    id: string,
    status: "PENDING" | "PAID",
  ): Promise<VendorItem> => requireDesktop().vendors.setStatus(id, status);

  const deleteVendor = async (id: string): Promise<void> => {
    await requireDesktop().vendors.remove(id);
  };

  const createWorkOrder = async (
    input: NewWorkOrderInput,
  ): Promise<WorkOrderItem> => requireDesktop().workOrders.create(input);

  const updateWorkOrder = async (
    id: string,
    patch: WorkOrderPatchInput,
  ): Promise<WorkOrderItem> => requireDesktop().workOrders.update(id, patch);

  const reviewWorkOrder = async (
    input: ReviewWorkOrderInput,
  ): Promise<WorkOrderItem> => requireDesktop().workOrders.review(input);

  const recordWorkOrderPayout = async (
    input: RecordWorkOrderPayoutInput,
  ): Promise<WorkOrderItem> =>
    requireDesktop().workOrders.recordPayout(input);

  const removeWorkOrderPayout = async (
    workOrderId: string,
    payoutId?: string,
  ): Promise<WorkOrderItem> =>
    requireDesktop().workOrders.removePayout(workOrderId, payoutId);

  const setWorkOrderPayoutStatus = async (
    id: string,
    status: "PENDING" | "PAID",
  ): Promise<WorkOrderItem> =>
    status === "PAID"
      ? recordWorkOrderPayout({ workOrderId: id })
      : removeWorkOrderPayout(id);

  const deleteWorkOrder = async (id: string): Promise<void> => {
    await requireDesktop().workOrders.remove(id);
  };

  const exportWorkOrderPdf = async (
    id: string,
  ): Promise<{ success: boolean; filePath: string }> =>
    requireDesktop().workOrders.exportPdf(id);

  const openWorkOrderPdf = async (
    filePath: string,
    reveal = false,
  ): Promise<void> => {
    await requireDesktop().workOrders.openPdf(filePath, reveal);
  };

  const getAnalyticsSummary = useCallback(
    async (
      period?: string,
      currency?: string,
      accountingMethod: "accrual" | "cash" = "accrual",
    ): Promise<AnalyticsSummaryPayload> =>
      requireDesktop().analytics.summary(period, currency, accountingMethod),
    [],
  );

  const createExpense = async (
    input: NewExpenseInput,
  ): Promise<ExpenseItem> => requireDesktop().expenses.create(input);

  const updateExpense = async (
    id: string,
    patch: ExpensePatchInput,
  ): Promise<ExpenseItem> => requireDesktop().expenses.update(id, patch);

  const deleteExpense = async (id: string): Promise<void> => {
    await requireDesktop().expenses.remove(id);
  };

  const attachExpenseReceipt = async (
    expenseId: string,
    requestId: string,
  ): Promise<AttachmentItem | null> =>
    requireDesktop().attachments.select(
      { type: "expense", id: expenseId },
      requestId,
    );

  const createEvent = async (
    input: NewCalendarEventInput,
  ): Promise<CalendarEventItem> => requireDesktop().events.create(input);

  const updateEvent = async (
    id: string,
    patch: CalendarEventPatchInput,
  ): Promise<CalendarEventItem> => requireDesktop().events.update(id, patch);

  const deleteEvent = async (id: string): Promise<void> => {
    await requireDesktop().events.remove(id);
  };

  const workflow: WorkflowAPI = {
    tasks: {
      reorder: (id, target, placement) =>
        requireDesktop().tasks.reorder(id, target, placement),
      removeMany: (ids) => requireDesktop().tasks.removeMany(ids),
      undoRemove: (token) => requireDesktop().tasks.undoRemove(token),
      list: async () => requireDesktop().tasks.list(),
      create: async (input) => requireDesktop().tasks.create(input),
      update: async (id, patch) => requireDesktop().tasks.update(id, patch),
      remove: async (id) => {
        await requireDesktop().tasks.remove(id);
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
      stageFile: async (file) => {
        const att = requireDesktop().attachments;
        if (att.stageFile) return att.stageFile(file);
        if (!att.stageDroppedFile) return null;
        const bytes = new Uint8Array(await file.arrayBuffer());
        return att.stageDroppedFile(file.name, bytes);
      },
      stageDroppedFile: async (name, data) => {
        const fn = requireDesktop().attachments.stageDroppedFile;
        return fn ? fn(name, data) : null;
      },
      open: async (id) => requireDesktop().attachments.open(id),
    },
    files: {
      openDraft: (link) => requireDesktop().files.openDraft(link),
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

  const latestActions = {
    workflow,
    createCatalogItem,
    updateCatalogItem,
    deleteCatalogItem,
    bulkImportCatalogItems,
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
    updateSettings,
    getDbPath,
    revealDbFile,
    exportData,
    importData,
    resetData,
  };
  const actionsRef = useRef(latestActions);
  useLayoutEffect(() => {
    actionsRef.current = latestActions;
  });

  const stableActions = useMemo<typeof latestActions>(
    () => ({
      workflow: {
        tasks: {
          reorder: (...args) =>
            actionsRef.current.workflow.tasks.reorder(...args),
          removeMany: (...args) =>
            actionsRef.current.workflow.tasks.removeMany(...args),
          undoRemove: (...args) =>
            actionsRef.current.workflow.tasks.undoRemove(...args),
          list: () => actionsRef.current.workflow.tasks.list(),
          create: (...args) => actionsRef.current.workflow.tasks.create(...args),
          update: (...args) => actionsRef.current.workflow.tasks.update(...args),
          remove: (...args) => actionsRef.current.workflow.tasks.remove(...args),
          history: (...args) =>
            actionsRef.current.workflow.tasks.history(...args),
        },
        tracking: {
          pending: () => actionsRef.current.workflow.tracking.pending(),
          decide: (...args) =>
            actionsRef.current.workflow.tracking.decide(...args),
        },
        attachments: {
          list: (...args) =>
            actionsRef.current.workflow.attachments.list(...args),
          select: (...args) =>
            actionsRef.current.workflow.attachments.select(...args),
          chooseFile: () =>
            actionsRef.current.workflow.attachments.chooseFile?.() ??
            Promise.resolve(null),
          stageFile: (...args) =>
            actionsRef.current.workflow.attachments.stageFile?.(...args) ??
            Promise.resolve(null),
          stageDroppedFile: (...args) =>
            actionsRef.current.workflow.attachments.stageDroppedFile?.(...args) ??
            Promise.resolve(null),
          open: (...args) =>
            actionsRef.current.workflow.attachments.open(...args),
        },
        files: {
          openDraft: (...args) =>
            actionsRef.current.workflow.files.openDraft(...args),
          selectPdfDirectory: () =>
            actionsRef.current.workflow.files.selectPdfDirectory(),
          openInvoicePdf: (...args) =>
            actionsRef.current.workflow.files.openInvoicePdf(...args),
        },
      },
      createCatalogItem: (...args) =>
        actionsRef.current.createCatalogItem(...args),
      updateCatalogItem: (...args) =>
        actionsRef.current.updateCatalogItem(...args),
      deleteCatalogItem: (...args) =>
        actionsRef.current.deleteCatalogItem(...args),
      bulkImportCatalogItems: (...args) =>
        actionsRef.current.bulkImportCatalogItems(...args),
      createClient: (...args) => actionsRef.current.createClient(...args),
      updateClient: (...args) => actionsRef.current.updateClient(...args),
      deleteClient: (...args) => actionsRef.current.deleteClient(...args),
      createInvoice: (...args) => actionsRef.current.createInvoice(...args),
      updateInvoice: (...args) => actionsRef.current.updateInvoice(...args),
      promoteInvoiceClient: (...args) =>
        actionsRef.current.promoteInvoiceClient(...args),
      setInvoiceStatus: (...args) =>
        actionsRef.current.setInvoiceStatus(...args),
      recordPayment: (...args) => actionsRef.current.recordPayment(...args),
      listPayments: (...args) => actionsRef.current.listPayments(...args),
      exportInvoicePdf: (...args) =>
        actionsRef.current.exportInvoicePdf(...args),
      saveInvoicePdfAs: (...args) =>
        actionsRef.current.saveInvoicePdfAs(...args),
      openInvoicePdf: (...args) => actionsRef.current.openInvoicePdf(...args),
      deleteInvoice: (...args) => actionsRef.current.deleteInvoice(...args),
      getNextInvoiceCode: () => actionsRef.current.getNextInvoiceCode(),
      createVendor: (...args) => actionsRef.current.createVendor(...args),
      updateVendor: (...args) => actionsRef.current.updateVendor(...args),
      setVendorStatus: (...args) => actionsRef.current.setVendorStatus(...args),
      deleteVendor: (...args) => actionsRef.current.deleteVendor(...args),
      createExpense: (...args) => actionsRef.current.createExpense(...args),
      updateExpense: (...args) => actionsRef.current.updateExpense(...args),
      deleteExpense: (...args) => actionsRef.current.deleteExpense(...args),
      attachExpenseReceipt: (...args) =>
        actionsRef.current.attachExpenseReceipt(...args),
      createEvent: (...args) => actionsRef.current.createEvent(...args),
      updateEvent: (...args) => actionsRef.current.updateEvent(...args),
      deleteEvent: (...args) => actionsRef.current.deleteEvent(...args),
      createWorkOrder: (...args) => actionsRef.current.createWorkOrder(...args),
      updateWorkOrder: (...args) => actionsRef.current.updateWorkOrder(...args),
      reviewWorkOrder: (...args) => actionsRef.current.reviewWorkOrder(...args),
      recordWorkOrderPayout: (...args) =>
        actionsRef.current.recordWorkOrderPayout(...args),
      removeWorkOrderPayout: (...args) =>
        actionsRef.current.removeWorkOrderPayout(...args),
      setWorkOrderPayoutStatus: (...args) =>
        actionsRef.current.setWorkOrderPayoutStatus(...args),
      deleteWorkOrder: (...args) => actionsRef.current.deleteWorkOrder(...args),
      exportWorkOrderPdf: (...args) =>
        actionsRef.current.exportWorkOrderPdf(...args),
      openWorkOrderPdf: (...args) =>
        actionsRef.current.openWorkOrderPdf(...args),
      updateSettings: (...args) => actionsRef.current.updateSettings(...args),
      getDbPath: () => actionsRef.current.getDbPath(),
      revealDbFile: () => actionsRef.current.revealDbFile(),
      exportData: () => actionsRef.current.exportData(),
      importData: (...args) => actionsRef.current.importData(...args),
      resetData: () => actionsRef.current.resetData(),
    }),
    [],
  );

  const currencyContextValue = useMemo(
    () => ({ activeCurrency }),
    [activeCurrency],
  );

  const clientsContextValue = useMemo<ClientsContextValue>(
    () => ({
      clients,
      isLoading,
      error,
      createClient: stableActions.createClient,
      updateClient: stableActions.updateClient,
      deleteClient: stableActions.deleteClient,
      refresh,
    }),
    [clients, isLoading, error, stableActions, refresh],
  );

  const invoicesContextValue = useMemo<InvoicesContextValue>(
    () => ({
      invoices,
      activeCurrency,
      isLoading,
      error,
      createInvoice: stableActions.createInvoice,
      updateInvoice: stableActions.updateInvoice,
      promoteInvoiceClient: stableActions.promoteInvoiceClient,
      promoteClient: stableActions.promoteInvoiceClient,
      setInvoiceStatus: stableActions.setInvoiceStatus,
      recordPayment: stableActions.recordPayment,
      listPayments: stableActions.listPayments,
      exportInvoicePdf: stableActions.exportInvoicePdf,
      saveInvoicePdfAs: stableActions.saveInvoicePdfAs,
      openInvoicePdf: stableActions.openInvoicePdf,
      deleteInvoice: stableActions.deleteInvoice,
      getNextInvoiceCode: stableActions.getNextInvoiceCode,
      refresh,
    }),
    [invoices, activeCurrency, isLoading, error, stableActions, refresh],
  );

  const settingsContextValue = useMemo<SettingsContextValue>(
    () => ({
      settings,
      backupStatus,
      isLoading,
      error,
      updateSettings: stableActions.updateSettings,
      getDbPath: stableActions.getDbPath,
      revealDbFile: stableActions.revealDbFile,
      exportData: stableActions.exportData,
      importData: stableActions.importData,
      resetData: stableActions.resetData,
      refresh,
    }),
    [settings, backupStatus, isLoading, error, stableActions, refresh],
  );

  const vendorsContextValue = useMemo<VendorsContextValue>(
    () => ({
      vendors,
      isLoading,
      error,
      createVendor: stableActions.createVendor,
      updateVendor: stableActions.updateVendor,
      setVendorStatus: stableActions.setVendorStatus,
      deleteVendor: stableActions.deleteVendor,
      refresh,
    }),
    [vendors, isLoading, error, stableActions, refresh],
  );

  const workOrdersContextValue = useMemo<WorkOrdersContextValue>(
    () => ({
      workOrders,
      isLoading,
      error,
      createWorkOrder: stableActions.createWorkOrder,
      updateWorkOrder: stableActions.updateWorkOrder,
      reviewWorkOrder: stableActions.reviewWorkOrder,
      recordWorkOrderPayout: stableActions.recordWorkOrderPayout,
      removeWorkOrderPayout: stableActions.removeWorkOrderPayout,
      setWorkOrderPayoutStatus: stableActions.setWorkOrderPayoutStatus,
      deleteWorkOrder: stableActions.deleteWorkOrder,
      exportWorkOrderPdf: stableActions.exportWorkOrderPdf,
      openWorkOrderPdf: stableActions.openWorkOrderPdf,
      refresh,
    }),
    [workOrders, isLoading, error, stableActions, refresh],
  );

  const catalogContextValue = useMemo<CatalogContextValue>(
    () => ({
      catalogItems,
      createCatalogItem: stableActions.createCatalogItem,
      updateCatalogItem: stableActions.updateCatalogItem,
      deleteCatalogItem: stableActions.deleteCatalogItem,
      bulkImportCatalogItems: stableActions.bulkImportCatalogItems,
      isLoading,
      isElectron,
      error,
    }),
    [catalogItems, stableActions, isLoading, isElectron, error],
  );

  const expensesContextValue = useMemo<ExpensesContextValue>(
    () => ({
      expenses,
      isLoading,
      error,
      createExpense: stableActions.createExpense,
      updateExpense: stableActions.updateExpense,
      deleteExpense: stableActions.deleteExpense,
      attachExpenseReceipt: stableActions.attachExpenseReceipt,
      refresh,
    }),
    [expenses, isLoading, error, stableActions, refresh],
  );

  const tasksContextValue = useMemo<TasksContextValue>(
    () => ({
      tasks,
      trackingOffers,
      getUnbilledCompletedTasks,
      isLoading,
      error,
      workflow: stableActions.workflow,
      refresh,
    }),
    [
      tasks,
      trackingOffers,
      getUnbilledCompletedTasks,
      isLoading,
      error,
      stableActions,
      refresh,
    ],
  );

  const contextValue = useMemo(
    () => ({
      tasks,
      trackingOffers,
      getUnbilledCompletedTasks,
      clients,
      invoices,
      vendors,
      expenses,
      workOrders,
      events,
      catalogItems,
      dashboard,
      settings,
      backupStatus,
      activeCurrency,
      isLoading,
      isElectron,
      error,
      refresh,
      getAnalyticsSummary,
      ...stableActions,
    }),
    [
      tasks,
      trackingOffers,
      getUnbilledCompletedTasks,
      clients,
      invoices,
      vendors,
      expenses,
      workOrders,
      events,
      catalogItems,
      dashboard,
      settings,
      backupStatus,
      activeCurrency,
      isLoading,
      isElectron,
      error,
      refresh,
      getAnalyticsSummary,
      stableActions,
    ],
  );

  return (
    <RefreshContext.Provider value={refresh}>
      <CurrencyContext.Provider value={currencyContextValue}>
        <ClientsContext.Provider value={clientsContextValue}>
          <InvoicesContext.Provider value={invoicesContextValue}>
            <SettingsContext.Provider value={settingsContextValue}>
              <VendorsContext.Provider value={vendorsContextValue}>
                <WorkOrdersContext.Provider value={workOrdersContextValue}>
                  <CatalogContext.Provider value={catalogContextValue}>
                    <ExpensesContext.Provider value={expensesContextValue}>
                      <TasksContext.Provider value={tasksContextValue}>
                        <DataContext.Provider value={contextValue}>
                          {children}
                        </DataContext.Provider>
                      </TasksContext.Provider>
                    </ExpensesContext.Provider>
                  </CatalogContext.Provider>
                </WorkOrdersContext.Provider>
              </VendorsContext.Provider>
            </SettingsContext.Provider>
          </InvoicesContext.Provider>
        </ClientsContext.Provider>
      </CurrencyContext.Provider>
    </RefreshContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}

export function useDataRefresh() {
  const context = useContext(RefreshContext);
  if (!context) {
    throw new Error("useDataRefresh must be used within a DataProvider");
  }
  return context;
}

export function useActiveCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useActiveCurrency must be used within a DataProvider");
  }
  return context;
}

export function useClients() {
  const context = useContext(ClientsContext);
  if (!context) {
    throw new Error("useClients must be used within a DataProvider");
  }
  return context;
}

export function useInvoices(filter?: { clientId?: string }) {
  const context = useContext(InvoicesContext);
  if (!context) {
    throw new Error("useInvoices must be used within a DataProvider");
  }
  const clientId = filter?.clientId;
  const filteredInvoices = useMemo(
    () =>
      clientId
        ? context.invoices.filter((i) => i.clientId === clientId)
        : context.invoices,
    [context.invoices, clientId],
  );

  return useMemo(
    () => ({
      ...context,
      invoices: filteredInvoices,
      allInvoices: context.invoices,
    }),
    [context, filteredInvoices],
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a DataProvider");
  }
  return context;
}

export function useVendors() {
  const context = useContext(VendorsContext);
  if (!context) {
    throw new Error("useVendors must be used within a DataProvider");
  }
  return context;
}

export function useWorkOrders() {
  const context = useContext(WorkOrdersContext);
  if (!context) {
    throw new Error("useWorkOrders must be used within a DataProvider");
  }
  return context;
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) {
    throw new Error("useCatalog must be used within a DataProvider");
  }
  return context;
}

export function useExpenses(filter?: { category?: string }) {
  const context = useContext(ExpensesContext);
  if (!context) {
    throw new Error("useExpenses must be used within a DataProvider");
  }
  const category = filter?.category;
  const filteredExpenses = useMemo(() => {
    if (!category || category === "All Categories") return context.expenses;
    return context.expenses.filter((e) => e.category === category);
  }, [context.expenses, category]);
  return useMemo(
    () => ({
      ...context,
      expenses: filteredExpenses,
      allExpenses: context.expenses,
    }),
    [context, filteredExpenses],
  );
}

export function useTasks() {
  const context = useContext(TasksContext);
  if (!context) {
    throw new Error("useTasks must be used within a DataProvider");
  }
  return context;
}
