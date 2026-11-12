import { ipcMain } from "../security";
import { captureWorkspace } from "../workspace-session";
import { getSqlite } from "../db";
import { z } from "zod";
import {
  WORKSPACE_DATASETS,
  type WorkspaceSnapshot,
  type WorkspaceDataset,
} from "../../src/types/workspace";
import { listClientsWithStats } from "./clients";
import { listInvoicesWithClient } from "./invoices";
import { getDashboardSummary } from "./dashboard";
import { getOrCreateSettings } from "./settings";
import { listVendors } from "./vendors";
import { listCatalogItems } from "./catalog";
import { listTasks, pendingTracking } from "./tasks";
import { listExpenses } from "./expenses";
import { listWorkOrders } from "./workOrders";
import { listCalendarEvents } from "./calendar";
export function loadWorkspaceSnapshot(
  requested: WorkspaceDataset[] = [...WORKSPACE_DATASETS],
): WorkspaceSnapshot {
  const datasets = z
    .array(z.enum(WORKSPACE_DATASETS))
    .max(WORKSPACE_DATASETS.length)
    .parse(requested);
  const workspace = captureWorkspace();
  return getSqlite().transaction(() => {
    const snapshot: WorkspaceSnapshot = {
      profileId: workspace.profileId,
      generation: workspace.generation,
    };
    for (const dataset of datasets) {
      switch (dataset) {
        case "clients":
          snapshot.clients = listClientsWithStats();
          break;
        case "invoices":
          snapshot.invoices = listInvoicesWithClient();
          break;
        case "dashboard":
          snapshot.dashboard = getDashboardSummary();
          break;
        case "settings":
          snapshot.settings = getOrCreateSettings();
          break;
        case "vendors":
          snapshot.vendors = listVendors();
          break;
        case "catalogItems":
          snapshot.catalogItems = listCatalogItems();
          break;
        case "tasks":
          snapshot.tasks = listTasks();
          break;
        case "trackingOffers":
          snapshot.trackingOffers = pendingTracking();
          break;
        case "expenses":
          snapshot.expenses = listExpenses();
          break;
        case "workOrders":
          snapshot.workOrders = listWorkOrders();
          break;
        case "events":
          snapshot.events = listCalendarEvents();
          break;
      }
    }
    return snapshot;
  })();
}
export function registerWorkspaceHandlers() {
  ipcMain.handle(
    "workspace:snapshot",
    (_event, datasets?: WorkspaceDataset[]) => loadWorkspaceSnapshot(datasets),
  );
}
