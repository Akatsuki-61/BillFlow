import type {
  WorkspaceSnapshot,
  WorkspaceDataset,
  WorkspaceChange,
} from "../src/types/workspace";
import { contextBridge, ipcRenderer, webUtils } from "electron";
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
  CorrectPaymentInput,
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
  WorkOrderItem,
  NewWorkOrderInput,
  WorkOrderPatchInput,
  ReviewWorkOrderInput,
  RecordWorkOrderPayoutInput,
} from "../src/types/outsourcing";
import type { AnalyticsSummaryPayload } from "../src/types/analytics";

import type { ThemePreference } from "../src/lib/theme";
import type {
  CreateProfileInput,
  UpdateProfileInput,
  CompleteOnboardingInput,
  ProfileListResponse,
} from "../src/types/profiles";

import type {
  TaskCreateInput,
  TaskPatchInput,
  AttachmentOwner,
} from "../src/types/workflow";
import type {
  ExpenseItem,
  NewExpenseInput,
  ExpensePatchInput,
} from "../src/types/expenses";
import type {
  CalendarEventItem,
  NewCalendarEventInput,
  CalendarEventPatchInput,
} from "../src/types/calendar";

let operationEpoch = 0;
let profileId: string | null = null;
ipcRenderer.on("data:changed", (_event, change?: WorkspaceChange) => {
  if (change && profileId && profileId !== change.profileId) operationEpoch++;
  if (change) profileId = change.profileId;
});
async function invoke(channel: string, ...args: unknown[]) {
  if (
    [
      "profiles:switch",
      "profiles:lock",
      "profiles:completeOnboarding",
    ].includes(channel)
  )
    operationEpoch++;
  const epoch = operationEpoch;
  const result = await ipcRenderer.invoke(channel, ...args);
  if (
    !channel.startsWith("profiles:") &&
    channel !== "theme:set" &&
    epoch !== operationEpoch
  )
    throw new Error(
      "WORKSPACE_CHANGED: The active profile changed during this operation.",
    );
  if (channel.startsWith("profiles:") && result?.activeProfileId)
    profileId = result.activeProfileId;
  return result;
}
const documentUrl = new URL(location.href);
const trustedDocument =
  !documentUrl.username &&
  !documentUrl.password &&
  ((documentUrl.protocol === "app:" &&
    documentUrl.hostname === "billflow" &&
    !documentUrl.port) ||
    (documentUrl.protocol === "http:" &&
      documentUrl.hostname === "127.0.0.1" &&
      documentUrl.port === "3000"));
if (process.isMainFrame && trustedDocument)
  contextBridge.exposeInMainWorld("billflow", {
    isElectron: true,
    currency: { rates: () => invoke("currency:rates") },
    workspace: {
      quarantineDrafts: (drafts: Record<string, string>) =>
        invoke("workspace:quarantineDrafts", drafts),
      activity: () => invoke("workspace:activity"),
      recordActivity: (
        profileId: string,
        input: import("../src/types/activity").ActivityInput,
      ) => invoke("workspace:recordActivity", profileId, input),
      archive: (kind: "clients" | "vendors", id: string, archived: boolean) =>
        invoke("workspace:archive", kind, id, archived),
      onActivityChanged: (callback: () => void) => {
        const listener = () => callback();
        ipcRenderer.on("workspace:activity-changed", listener);
        return () => {
          ipcRenderer.removeListener("workspace:activity-changed", listener);
        };
      },
      draft: (
        profileId: string,
        key: string,
        value?: string | null,
      ): Promise<string | null> =>
        invoke("workspace:draft", profileId, key, value),
      snapshot: (datasets?: WorkspaceDataset[]): Promise<WorkspaceSnapshot> =>
        invoke("workspace:snapshot", datasets),
    },
    platform: process.platform,
    theme: {
      initialPreference: ipcRenderer.sendSync(
        "theme:initial",
      ) as ThemePreference,
      setPreference: (preference: ThemePreference): Promise<void> =>
        invoke("theme:set", preference),
    },
    profiles: {
      lock: (): Promise<{ success: boolean }> => invoke("profiles:lock"),
      list: (): Promise<ProfileListResponse> => invoke("profiles:list"),
      create: (input: CreateProfileInput): Promise<ProfileListResponse> =>
        invoke("profiles:create", input),
      update: (
        id: string,
        patch: UpdateProfileInput,
      ): Promise<ProfileListResponse> => invoke("profiles:update", id, patch),
      switch: (id: string, password?: string): Promise<ProfileListResponse> =>
        invoke("profiles:switch", id, password),
      verifyPassword: (
        id: string,
        password: string,
      ): Promise<{ valid: boolean }> =>
        invoke("profiles:verifyPassword", id, password),
      remove: (id: string, password?: string): Promise<ProfileListResponse> =>
        invoke("profiles:remove", id, password),
      completeOnboarding: (
        input: CompleteOnboardingInput,
      ): Promise<ProfileListResponse> =>
        invoke("profiles:completeOnboarding", input),
    },
    expenses: {
      list: (filter?: {
        category?: string;
        invoiceId?: string;
      }): Promise<ExpenseItem[]> => invoke("expenses:list", filter),
      create: (input: NewExpenseInput): Promise<ExpenseItem> =>
        invoke("expenses:create", input),
      update: (id: string, patch: ExpensePatchInput): Promise<ExpenseItem> =>
        invoke("expenses:update", id, patch),
      remove: (id: string): Promise<{ success: boolean }> =>
        invoke("expenses:remove", id),
    },
    events: {
      list: (filter?: {
        startDate?: string;
        endDate?: string;
        category?: string;
        taskId?: string;
      }): Promise<CalendarEventItem[]> => invoke("events:list", filter),
      get: (id: string): Promise<CalendarEventItem> => invoke("events:get", id),
      create: (input: NewCalendarEventInput): Promise<CalendarEventItem> =>
        invoke("events:create", input),
      update: (
        id: string,
        patch: CalendarEventPatchInput,
      ): Promise<CalendarEventItem> => invoke("events:update", id, patch),
      remove: (id: string): Promise<{ success: boolean }> =>
        invoke("events:remove", id),
      syncNative: (
        taskTimeSlots?: Record<
          string,
          { startTime: string | null; endTime: string | null }
        >,
      ): Promise<{ syncedFromMac: number; pushedToMac: number }> =>
        invoke("events:syncNative", taskTimeSlots),
      openNative: (
        taskTimeSlots?: Record<
          string,
          { startTime: string | null; endTime: string | null }
        >,
      ): Promise<{
        success: boolean;
        syncedFromMac: number;
        pushedToMac: number;
      }> => invoke("events:openNative", taskTimeSlots),
    },
    clients: {
      exportStatement: (id: string) => invoke("clients:statement", id),
      list: (): Promise<ClientWithStats[]> => invoke("clients:list"),
      get: (id: string): Promise<ClientWithStats> => invoke("clients:get", id),
      create: (input: NewClientInput): Promise<ClientWithStats> =>
        invoke("clients:create", input),
      update: (id: string, patch: ClientPatchInput): Promise<ClientWithStats> =>
        invoke("clients:update", id, patch),
      remove: (id: string): Promise<{ success: boolean }> =>
        invoke("clients:remove", id),
    },
    invoices: {
      setStatuses: (ids: string[], status: InvoiceStatus) =>
        invoke("invoices:setStatuses", ids, status),
      listTrash: (): Promise<InvoiceWithClient[]> =>
        invoke("invoices:trashList"),
      trash: (ids: string[]) => invoke("invoices:trash", ids),
      restore: (ids: string[]) => invoke("invoices:restore", ids),
      exportBatch: (ids: string[]) => invoke("invoices:exportBatch", ids),
      prepareShare: (id: string, template?: string) =>
        invoke("invoices:prepareShare", id, template),
      correctPayment: (
        input: CorrectPaymentInput,
      ): Promise<InvoiceWithClient> => invoke("invoices:correctPayment", input),
      list: (filter?: { clientId?: string }): Promise<InvoiceWithClient[]> =>
        invoke("invoices:list", filter),
      nextCode: (): Promise<string> => invoke("invoices:nextCode"),
      create: (input: NewInvoiceInput): Promise<InvoiceWithClient> =>
        invoke("invoices:create", input),
      update: (
        id: string,
        patch: InvoicePatchInput,
      ): Promise<InvoiceWithClient> => invoke("invoices:update", id, patch),
      promoteClient: (invoiceId: string): Promise<ClientWithStats> =>
        invoke("invoices:promoteClient", invoiceId),
      setStatus: (
        id: string,
        status: InvoiceStatus,
      ): Promise<InvoiceWithClient> => invoke("invoices:setStatus", id, status),
      recordPayment: (
        input: RecordPaymentInput,
      ): Promise<{ invoice: InvoiceWithClient; payment: InvoicePayment }> =>
        invoke("invoices:recordPayment", input),
      listPayments: (invoiceId: string): Promise<InvoicePayment[]> =>
        invoke("invoices:listPayments", invoiceId),
      exportPdf: (
        invoiceId: string,
        template?: string,
      ): Promise<{ success: boolean; filePath: string }> =>
        invoke("invoices:exportPdf", invoiceId, template),
      savePdfAs: (
        invoiceId: string,
        template?: string,
        draft?: NewInvoiceInput,
      ): Promise<{ success: boolean; canceled?: boolean; filePath?: string }> =>
        invoke("invoices:savePdfAs", invoiceId, template, draft),
      remove: (id: string): Promise<{ success: boolean }> =>
        invoke("invoices:remove", id),
    },
    vendors: {
      exportStatement: (id: string) => invoke("vendors:statement", id),
      list: (): Promise<VendorItem[]> => invoke("vendors:list"),
      create: (input: NewVendorInput): Promise<VendorItem> =>
        invoke("vendors:create", input),
      update: (id: string, patch: VendorPatchInput): Promise<VendorItem> =>
        invoke("vendors:update", id, patch),
      setStatus: (
        id: string,
        status: "PENDING" | "PAID",
      ): Promise<VendorItem> => invoke("vendors:setStatus", id, status),
      remove: (id: string): Promise<{ success: boolean }> =>
        invoke("vendors:remove", id),
    },
    workOrders: {
      list: (filter?: {
        vendorId?: string;
        taskId?: string;
        invoiceId?: string;
      }): Promise<WorkOrderItem[]> => invoke("workOrders:list", filter),
      get: (id: string): Promise<WorkOrderItem> => invoke("workOrders:get", id),
      create: (input: NewWorkOrderInput): Promise<WorkOrderItem> =>
        invoke("workOrders:create", input),
      update: (
        id: string,
        patch: WorkOrderPatchInput,
      ): Promise<WorkOrderItem> => invoke("workOrders:update", id, patch),
      review: (input: ReviewWorkOrderInput): Promise<WorkOrderItem> =>
        invoke("workOrders:review", input),
      recordPayout: (
        input: RecordWorkOrderPayoutInput,
      ): Promise<WorkOrderItem> => invoke("workOrders:recordPayout", input),
      removePayout: (
        workOrderId: string,
        payoutId?: string,
      ): Promise<WorkOrderItem> =>
        invoke("workOrders:removePayout", workOrderId, payoutId),
      setPayoutStatus: (
        id: string,
        status: "PENDING" | "PAID",
      ): Promise<WorkOrderItem> =>
        invoke("workOrders:setPayoutStatus", id, status),
      remove: (id: string): Promise<{ success: boolean }> =>
        invoke("workOrders:remove", id),
      exportPdf: (
        id: string,
      ): Promise<{ success: boolean; filePath: string }> =>
        invoke("workOrders:exportPdf", id),
      openPdf: (
        workOrderId: string,
        reveal?: boolean,
      ): Promise<{ success: boolean }> =>
        invoke("workOrders:openPdf", workOrderId, reveal),
    },
    analytics: {
      summary: (
        period?: string,
        currency?: string,
        accountingMethod?: "accrual" | "cash",
      ): Promise<AnalyticsSummaryPayload> =>
        invoke("analytics:summary", period, currency, accountingMethod),
    },
    catalog: {
      list: (): Promise<CatalogItem[]> => invoke("catalog:list"),
      create: (input: NewCatalogItemInput): Promise<CatalogItem> =>
        invoke("catalog:create", input),
      update: (
        id: string,
        patch: CatalogItemPatchInput,
      ): Promise<CatalogItem> => invoke("catalog:update", id, patch),
      remove: (id: string): Promise<{ success: boolean }> =>
        invoke("catalog:remove", id),
      bulkImport: (
        items: NewCatalogItemInput[],
      ): Promise<{ success: boolean; count: number }> =>
        invoke("catalog:bulkImport", items),
    },
    dashboard: {
      summary: (): Promise<DashboardSummary> => invoke("dashboard:summary"),
    },
    settings: {
      exportCsv: () => invoke("settings:exportCsv"),
      saveBackup: () => invoke("settings:saveBackup"),
      get: (): Promise<AppSettings> => invoke("settings:get"),
      update: (patch: UpdateSettingsInput): Promise<AppSettings> =>
        invoke("settings:update", patch),
      getDbPath: (): Promise<string> => invoke("settings:getDbPath"),
      revealDbFile: (): Promise<{ success: boolean }> =>
        invoke("settings:revealDbFile"),
      preflight: (payload: ExportDataPayload, mode?: "replace" | "merge") =>
        invoke("settings:preflight", payload, mode),
      chooseBackupFile: (mode?: "replace" | "merge") =>
        invoke("settings:chooseBackupFile", mode),
      stageBackupFile: (file: File, mode?: "replace" | "merge") => {
        const filePath =
          typeof webUtils?.getPathForFile === "function"
            ? webUtils.getPathForFile(file)
            : "";
        if (!filePath) {
          return Promise.reject(
            new Error("Drop a local backup .json file from your computer."),
          );
        }
        return invoke("settings:stageDroppedBackup", filePath, mode);
      },
      preflightBackupFile: (token: string, mode?: "replace" | "merge") =>
        invoke("settings:preflightBackupFile", token, mode),
      importBackupFile: (token: string, mode?: "replace" | "merge") =>
        invoke("settings:importBackupFile", token, mode),
      export: (): Promise<ExportDataPayload> => invoke("settings:export"),
      import: (payload: ExportDataPayload, mode?: "replace" | "merge") =>
        invoke("settings:import", payload, mode),
      reset: (): Promise<{ success: boolean }> => invoke("settings:reset"),
    },
    tasks: {
      reorder: (id: string, target: string, placement: "before" | "after") =>
        invoke("tasks:reorder", id, target, placement),
      removeMany: (ids: string[]) => invoke("tasks:removeMany", ids),
      undoRemove: (token: string) => invoke("tasks:undoRemove", token),
      list: () => invoke("tasks:list"),
      create: (input: TaskCreateInput) => invoke("tasks:create", input),
      update: (id: string, patch: TaskPatchInput) =>
        invoke("tasks:update", id, patch),
      remove: (id: string) => invoke("tasks:remove", id),
      history: (id: string) => invoke("tasks:history", id),
    },
    tracking: {
      pending: () => invoke("tracking:pending"),
      decide: (invoiceId: string, choice: "yes" | "no") =>
        invoke("tracking:decide", invoiceId, choice),
    },
    attachments: {
      list: (owner: AttachmentOwner) => invoke("attachments:list", owner),
      select: (owner: AttachmentOwner, requestId: string, filePath?: string) =>
        invoke("attachments:select", owner, requestId, filePath),
      chooseFile: () => invoke("attachments:chooseFile"),
      stageFile: async (file: File) => {
        const filePath =
          typeof webUtils?.getPathForFile === "function"
            ? webUtils.getPathForFile(file)
            : "";
        if (filePath) {
          return await invoke("attachments:stageDroppedPath", filePath);
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        return await invoke("attachments:stageDroppedFile", file.name, bytes);
      },
      stageDroppedFile: (name: string, data: Uint8Array) =>
        invoke("attachments:stageDroppedFile", name, data),
      open: (id: string) => invoke("attachments:open", id),
    },
    files: {
      openDraft: (link: string) => invoke("files:openDraft", link),
      selectPdfDirectory: () => invoke("files:selectPdfDirectory"),
      openInvoicePdf: (id: string, reveal?: boolean) =>
        invoke("files:openInvoicePdf", id, reveal),
    },
    onWorkspaceLocked: (callback: () => void) => {
      const listener = () => {
        operationEpoch++;
        callback();
      };
      ipcRenderer.on("workspace:locked", listener);
      return () => {
        ipcRenderer.removeListener("workspace:locked", listener);
      };
    },
    onDataChanged: (callback: (change?: WorkspaceChange) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        change?: WorkspaceChange,
      ) => callback(change);
      ipcRenderer.on("data:changed", handler);
      return () => {
        ipcRenderer.removeListener("data:changed", handler);
      };
    },
    onNavigate: (callback: (route: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, route: string) =>
        callback(route);
      ipcRenderer.on("navigate-to", handler);
      return () => {
        ipcRenderer.removeListener("navigate-to", handler);
      };
    },
  });
