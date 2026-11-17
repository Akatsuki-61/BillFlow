import { ipcMain } from "../security";
import { captureWorkspace } from "../workspace-session";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  getDatabasePath,
  getActiveProfileId,
  getRootDatabasePath,
} from "../db";
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
import { getBackupStatus, getOrCreateSettings } from "./settings";
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
        case "backupStatus":
          break;
        case "events":
          snapshot.events = listCalendarEvents();
          break;
      }
    }
    // Read after datasets that may initialize persisted workflow state.
    if (datasets.includes("backupStatus"))
      snapshot.backupStatus = getBackupStatus();
    return snapshot;
  })();
}
const draftKey = z.enum([
  "client",
  "expense",
  "catalog",
  "task",
  "workorder",
  "invoice",
]);
export function workspaceDraft(
  profileId: string,
  key: string,
  value?: string | null,
): string | null {
  if (profileId !== getActiveProfileId())
    throw new Error("WORKSPACE_CHANGED: The draft belongs to another profile.");
  const name = draftKey.parse(key);
  const file = `${getDatabasePath()}.draft-${name}.json`;
  if (value !== undefined) {
    if (value === null) {
      fs.rmSync(file, { force: true });
      return null;
    }
    z.string()
      .max(8 * 1024 * 1024)
      .parse(value);
    JSON.parse(value);
    fs.writeFileSync(file + ".tmp", value, { encoding: "utf8", mode: 0o600 });
    fs.renameSync(file + ".tmp", file);
    return value;
  }
  try {
    if (fs.statSync(file).size > 8 * 1024 * 1024) return null;
    return fs.readFileSync(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
export function registerWorkspaceHandlers() {
  ipcMain.handle("workspace:quarantineDrafts", (_event, input: unknown) => {
    const drafts = z
      .record(
        z
          .string()
          .regex(
            /^billflow_draft_(?:client|expense|catalog|task|workorder|invoice)(?::[a-zA-Z0-9-]+)?$/,
          ),
        z.string().max(8 * 1024 * 1024),
      )
      .parse(input);
    const serialized = JSON.stringify(drafts);
    if (serialized.length > 32 * 1024 * 1024 || Object.keys(drafts).length > 30)
      throw new Error("Legacy drafts exceed the migration limit.");
    if (!Object.keys(drafts).length) return;
    const directory = path.join(
      path.dirname(getRootDatabasePath()),
      "quarantined-drafts",
    );
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(directory, `${randomUUID()}.json`), serialized, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
  });
  ipcMain.handle(
    "workspace:archive",
    (_event, kind: string, id: string, archived: boolean) => {
      const table = z.enum(["clients", "vendors"]).parse(kind);
      const identity = z.string().min(1).max(160).parse(id);
      z.boolean().parse(archived);
      const result = getSqlite()
        .prepare(`UPDATE ${table} SET archived_at=?, updated_at=? WHERE id=?`)
        .run(
          archived ? new Date().toISOString() : null,
          new Date().toISOString(),
          identity,
        );
      if (!result.changes) throw new Error("Directory record not found.");
    },
  );
  ipcMain.handle(
    "workspace:draft",
    (_event, profileId: string, key: string, value?: string | null) =>
      workspaceDraft(profileId, key, value),
  );
  ipcMain.handle(
    "workspace:snapshot",
    (_event, datasets?: WorkspaceDataset[]) => loadWorkspaceSnapshot(datasets),
  );
}
