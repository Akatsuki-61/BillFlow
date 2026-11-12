import type {
  ClientWithStats,
  InvoiceWithClient,
  DashboardSummary,
  CatalogItem,
} from "./billing";
import type { AppSettings } from "./settings";
import type { VendorItem, WorkOrderItem } from "./outsourcing";
import type { ExpenseItem } from "./expenses";
import type { TaskItem } from "./tasks";
import type { CalendarEventItem } from "./calendar";
import type { TrackingOffer } from "./workflow";
export const WORKSPACE_DATASETS = [
  "clients",
  "invoices",
  "dashboard",
  "settings",
  "vendors",
  "catalogItems",
  "tasks",
  "trackingOffers",
  "expenses",
  "workOrders",
  "events",
] as const;
export type WorkspaceDataset = (typeof WORKSPACE_DATASETS)[number];
export interface WorkspaceSnapshot {
  profileId: string;
  generation: number;
  clients?: ClientWithStats[];
  invoices?: InvoiceWithClient[];
  dashboard?: DashboardSummary;
  settings?: AppSettings;
  vendors?: VendorItem[];
  catalogItems?: CatalogItem[];
  tasks?: TaskItem[];
  trackingOffers?: TrackingOffer[];
  expenses?: ExpenseItem[];
  workOrders?: WorkOrderItem[];
  events?: CalendarEventItem[];
}
export interface WorkspaceChange {
  profileId: string;
  generation: number;
  datasets: WorkspaceDataset[];
}
export function affectedDatasets(channel: string): WorkspaceDataset[] {
  const domain = channel.split(":")[0];
  if (domain === "invoices")
    return [
      "clients",
      "invoices",
      "dashboard",
      "tasks",
      "trackingOffers",
      "workOrders",
      "expenses",
    ];
  if (domain === "clients") return ["clients", "invoices", "dashboard"];
  if (domain === "tasks" || domain === "tracking")
    return ["tasks", "trackingOffers", "invoices", "events", "workOrders"];
  if (domain === "workOrders" || domain === "vendors")
    return ["workOrders", "vendors", "tasks"];
  if (domain === "attachments" || domain === "expenses")
    return ["expenses", "workOrders"];
  if (domain === "events") return ["events", "tasks"];
  if (domain === "catalog") return ["catalogItems"];
  if (domain === "settings") return [...WORKSPACE_DATASETS];
  return [...WORKSPACE_DATASETS];
}
