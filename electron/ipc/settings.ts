import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { escapeCsvField } from "../../src/lib/csv-export";
import { MAX_BACKUP_BYTES } from "../../src/lib/backup-limits";
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
  atomicWrite(result.filePath, JSON.stringify(payload), 0o600);
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

interface BackupSelection {
  sender: Electron.WebContents;
  workspace: ReturnType<typeof captureWorkspace>;
  filePath: string;
  expires: number;
}
const backupSelections = new Map<string, BackupSelection>();
const observedBackupSenders = new WeakSet<Electron.WebContents>();

function expireBackupSelectionsOnNavigation(sender: Electron.WebContents) {
  if (observedBackupSenders.has(sender)) return;
  observedBackupSenders.add(sender);
  const revoke = () => {
    for (const [token, entry] of backupSelections) {
      if (entry.sender === sender) backupSelections.delete(token);
    }
  };
  sender.on("did-start-navigation", (event) => {
    if (event.isMainFrame) revoke();
  });
  sender.once("destroyed", revoke);
}

function readAndParseBackupFile(filePath: string): ExportDataPayload {
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error("Backup must be a regular JSON file.");
  }
  if (stat.size <= 0 || stat.size > MAX_BACKUP_BYTES) {
    throw new Error("Backup must be smaller than 150 MB.");
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid backup file format.");
  }
  return parsed as ExportDataPayload;
}

function resolveBackupSelection(
  sender: Electron.WebContents,
  tokenInput: string,
): BackupSelection {
  const token = z.string().uuid().parse(tokenInput);
  const entry = backupSelections.get(token);
  if (
    !entry ||
    entry.sender !== sender ||
    entry.expires < Date.now()
  ) {
    throw new Error("Choose the backup file again before continuing.");
  }
  entry.workspace.assertCurrent();
  return entry;
}

function stageValidatedBackupPath(
  sender: Electron.WebContents,
  workspace: ReturnType<typeof captureWorkspace>,
  filePath: string,
  mode: "replace" | "merge",
) {
  const parsed = readAndParseBackupFile(filePath);
  const preview = importWorkspace(parsed, mode, true);
  for (const [key, entry] of backupSelections) {
    if (entry.expires < Date.now()) backupSelections.delete(key);
  }
  if (backupSelections.size >= 8) {
    backupSelections.delete(backupSelections.keys().next().value!);
  }
  const token = randomUUID();
  backupSelections.set(token, {
    sender,
    workspace,
    filePath,
    expires: Date.now() + 10 * 60 * 1000,
  });
  const stat = fs.statSync(filePath);
  const recordPayload = parsed as unknown as {
    version?: string;
    exportedAt?: string;
    files?: unknown[];
  };
  return {
    canceled: false as const,
    token,
    fileName: path.basename(filePath),
    fileSize: stat.size,
    version: String(recordPayload.version || "2"),
    exportedAt: String(recordPayload.exportedAt || ""),
    importedClients: preview.importedClients,
    importedInvoices: preview.importedInvoices,
    receiptsCount: Array.isArray(recordPayload.files)
      ? recordPayload.files.length
      : 0,
  };
}

export function stageBackupFileFromPath(
  event: Electron.IpcMainInvokeEvent,
  filePath: string,
  mode?: "replace" | "merge",
) {
  const parsedMode = z.enum(["replace", "merge"]).parse(mode || "replace");
  if (
    typeof filePath !== "string" ||
    !path.isAbsolute(filePath) ||
    path.extname(filePath).toLowerCase() !== ".json"
  ) {
    throw new Error("Drop a local backup .json file.");
  }
  const workspace = captureWorkspace();
  expireBackupSelectionsOnNavigation(event.sender);
  return stageValidatedBackupPath(
    event.sender,
    workspace,
    filePath,
    parsedMode,
  );
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

  ipcMain.handle(
    "settings:chooseBackupFile",
    async (event, mode?: "replace" | "merge") => {
      try {
        const parsedMode = z.enum(["replace", "merge"]).parse(mode || "replace");
        const workspace = captureWorkspace();
        expireBackupSelectionsOnNavigation(event.sender);
        const result = await dialog.showOpenDialog({
          title: "Choose BillFlow Backup File",
          properties: ["openFile"],
          filters: [{ name: "BillFlow Backup", extensions: ["json"] }],
        });
        workspace.assertCurrent();
        if (result.canceled || !result.filePaths[0]) {
          return { canceled: true as const };
        }
        return stageValidatedBackupPath(
          event.sender,
          workspace,
          result.filePaths[0],
          parsedMode,
        );
      } catch (error) {
        throw formatError(error);
      }
    },
  );

  ipcMain.handle(
    "settings:stageDroppedBackup",
    (event, filePath: string, mode?: "replace" | "merge") => {
      try {
        return stageBackupFileFromPath(event, filePath, mode);
      } catch (error) {
        throw formatError(error);
      }
    },
  );

  ipcMain.handle(
    "settings:preflightBackupFile",
    (event, token: string, mode?: "replace" | "merge") => {
      try {
        const parsedMode = z.enum(["replace", "merge"]).parse(mode || "replace");
        const selection = resolveBackupSelection(event.sender, token);
        const parsed = readAndParseBackupFile(selection.filePath);
        return importWorkspace(parsed, parsedMode, true);
      } catch (error) {
        throw formatError(error);
      }
    },
  );

  ipcMain.handle(
    "settings:importBackupFile",
    (event, token: string, mode?: "replace" | "merge") => {
      try {
        const parsedMode = z
          .enum(["replace", "merge"])
          .optional()
          .parse(mode);
        const parsedToken = z.string().uuid().parse(token);
        const selection = resolveBackupSelection(event.sender, parsedToken);
        backupSelections.delete(parsedToken);
        const parsed = readAndParseBackupFile(selection.filePath);
        const res = importWorkspace(parsed, parsedMode);
        broadcastDataChanged();
        return res;
      } catch (error) {
        throw formatError(error);
      }
    },
  );

  ipcMain.handle(
    "settings:preflight",
    (_event, payload: ExportDataPayload, mode?: "replace" | "merge") =>
      importWorkspace(
        payload,
        z.enum(["replace", "merge"]).parse(mode || "replace"),
        true,
      ),
  );
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
