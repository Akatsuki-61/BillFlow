import { z } from "zod";
import { escapeCsvField } from "../../src/lib/csv-export";
import { dialog, shell } from "electron";
import { captureWorkspace } from "../workspace-session";
import { atomicWrite } from "../managed-files";
import { localDateKey } from "../../src/lib/visual-metrics";
import type { BackupStatus } from "../../src/types/settings";
import { ipcMain } from "../security";
import { eq, sql } from "drizzle-orm";
import {
  getDb,
  getSqlite,
  getDatabasePath,
  getRootDb,
  getActiveProfileId,
} from "../db";
import { settings, userProfiles } from "../db/schema";
import { updateSettingsSchema } from "../validation";
import { formatError } from "./errors";
import type {
  AppSettings,
  UpdateSettingsInput,
  ExportDataPayload,
} from "../../src/types/settings";

import {
  backupTables,
  exportWorkspace,
  importWorkspace,
  resetWorkspace,
} from "../backup";
export { exportWorkspace, importWorkspace, resetWorkspace } from "../backup";

export function getOrCreateSettings(): AppSettings {
  const db = getDb();
  let row = db.select().from(settings).where(eq(settings.id, "default")).get();

  if (!row) {
    db.insert(settings)
      .values({
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
        dateFormat: "YYYY-MM-DD",
        currencyDisplay: "symbol",
      })
      .run();

    row = db.select().from(settings).where(eq(settings.id, "default")).get();
  }

  return row as unknown as AppSettings;
}

export function updateSettings(patch: UpdateSettingsInput): AppSettings {
  const validated = updateSettingsSchema.parse(patch);
  const db = getDb();

  // Ensure default row exists
  getOrCreateSettings();

  db.update(settings)
    .set({
      ...validated,
      updatedAt: sql`(CURRENT_TIMESTAMP)`,
    })
    .where(eq(settings.id, "default"))
    .run();

  const updated = db
    .select()
    .from(settings)
    .where(eq(settings.id, "default"))
    .get();

  try {
    const activeId = getActiveProfileId();
    const rootDb = getRootDb();
    const profilePatch: Record<string, unknown> = {};
    if (validated.defaultCurrency)
      profilePatch.defaultCurrency = validated.defaultCurrency;
    if (validated.invoicePrefix)
      profilePatch.invoicePrefix = validated.invoicePrefix;
    if (validated.professionalTitle && validated.professionalTitle.trim()) {
      profilePatch.subtitle = validated.professionalTitle.trim();
    }
    if (Object.keys(profilePatch).length > 0) {
      rootDb
        .update(userProfiles)
        .set({ ...profilePatch, updatedAt: new Date().toISOString() })
        .where(eq(userProfiles.id, activeId))
        .run();
    }
  } catch {
    // Non-fatal if root profile registry is not yet initialized
  }

  return updated as unknown as AppSettings;
}

function readBackupState() {
  return getSqlite()
    .prepare(
      "SELECT revision, backup_revision, last_backup_at FROM workspace_backup_state WHERE id = 1",
    )
    .get() as {
    revision: number;
    backup_revision: number | null;
    last_backup_at: string | null;
  };
}

export function getBackupStatus(): BackupStatus {
  const state = readBackupState();
  return {
    lastBackupAt: state.last_backup_at,
    hasChanges:
      state.backup_revision === null
        ? state.revision > 0
        : state.revision !== state.backup_revision,
  };
}

export async function saveWorkspaceBackup() {
  const workspace = captureWorkspace();
  const result = await dialog.showSaveDialog({
    title: "Save Workspace Backup",
    defaultPath: `billflow-backup-${localDateKey()}.json`,
    filters: [{ name: "BillFlow Backup", extensions: ["json"] }],
  });
  workspace.assertCurrent();
  if (result.canceled || !result.filePath)
    return { success: false, canceled: true };
  const payload = exportWorkspace();
  const revision = readBackupState().revision;
  atomicWrite(result.filePath, JSON.stringify(payload));
  getSqlite()
    .prepare(
      "UPDATE workspace_backup_state SET backup_revision = ?, last_backup_at = ? WHERE id = 1",
    )
    .run(revision, new Date().toISOString());
  return { success: true, filePath: result.filePath };
}

export async function saveWorkspaceCsv() {
  const workspace = captureWorkspace();
  const result = await dialog.showSaveDialog({
    title: "Export Workspace CSV",
    defaultPath: `billflow-workspace-${localDateKey()}.csv`,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
  workspace.assertCurrent();
  if (result.canceled || !result.filePath)
    return { success: false, canceled: true };
  const sqlite = getSqlite();
  const csv = sqlite.transaction(() => {
    const excluded = new Set([
      "photo_data",
      "signature_data",
      "business_snapshot",
      "pdf_export_directory",
    ]);
    const tables = backupTables.filter(
      (table) => !table.endsWith("_pdf_exports"),
    );
    const columns = [
      ...new Set(
        tables.flatMap((table) =>
          (
            sqlite.prepare(`PRAGMA table_info("${table}")`).all() as {
              name: string;
            }[]
          )
            .map((column) => column.name)
            .filter((name) => !excluded.has(name)),
        ),
      ),
    ].sort();
    const lines = [["record_type", ...columns].map(escapeCsvField).join(",")];
    for (const table of tables)
      for (const row of sqlite
        .prepare(`SELECT * FROM "${table}"`)
        .iterate() as Iterable<Record<string, unknown>>)
        lines.push(
          [table, ...columns.map((column) => row[column])]
            .map(escapeCsvField)
            .join(","),
        );
    return "\uFEFF" + lines.join("\r\n") + "\r\n";
  })();
  atomicWrite(result.filePath, csv);
  return { success: true, filePath: result.filePath };
}

export function registerSettingsHandlers(broadcastDataChanged: () => void) {
  ipcMain.handle("settings:get", async () => {
    try {
      return getOrCreateSettings();
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle(
    "settings:update",
    async (_event, patch: UpdateSettingsInput) => {
      try {
        const res = updateSettings(patch);
        broadcastDataChanged();
        return res;
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle("settings:getDbPath", async () => {
    try {
      return getDatabasePath();
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle("settings:revealDbFile", async () => {
    try {
      const dbPath = getDatabasePath();
      shell.showItemInFolder(dbPath);
      return { success: true };
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle("settings:saveBackup", async () => {
    try {
      const result = await saveWorkspaceBackup();
      if (result.success) broadcastDataChanged();
      return result;
    } catch (error) {
      throw formatError(error);
    }
  });

  ipcMain.handle("settings:exportCsv", async () => {
    try {
      return await saveWorkspaceCsv();
    } catch (error) {
      throw formatError(error);
    }
  });

  ipcMain.handle("settings:export", async () => {
    try {
      return exportWorkspace();
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle(
    "settings:import",
    async (_event, payload: ExportDataPayload, mode?: "replace" | "merge") => {
      try {
        const res = importWorkspace(
          payload,
          z.enum(["replace", "merge"]).optional().parse(mode),
        );
        broadcastDataChanged();
        return res;
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle("settings:reset", async () => {
    try {
      const res = resetWorkspace();
      broadcastDataChanged();
      return res;
    } catch (err) {
      throw formatError(err);
    }
  });
}
