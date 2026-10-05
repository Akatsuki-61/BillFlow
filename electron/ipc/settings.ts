import { ipcMain, shell } from "electron";
import { eq, sql } from "drizzle-orm";
import { getDb, getDatabasePath } from "../db";
import { settings } from "../db/schema";
import { updateSettingsSchema } from "../validation";
import { formatError } from "./errors";
import type { AppSettings, UpdateSettingsInput, ExportDataPayload } from "../../src/types/settings";

import { exportWorkspace, importWorkspace, resetWorkspace } from "../backup";
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
        defaultNotes: "Payment due within specified due date. Thank you for your business.",
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

  const updated = db.select().from(settings).where(eq(settings.id, "default")).get();
  return updated as unknown as AppSettings;
}

export function registerSettingsHandlers(broadcastDataChanged: () => void) {
  ipcMain.handle("settings:get", async () => {
    try {
      return getOrCreateSettings();
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle("settings:update", async (_event, patch: UpdateSettingsInput) => {
    try {
      const res = updateSettings(patch);
      broadcastDataChanged();
      return res;
    } catch (err) {
      throw formatError(err);
    }
  });

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

  ipcMain.handle("settings:export", async () => {
    try {
      return exportWorkspace();
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle("settings:import", async (_event, payload: ExportDataPayload) => {
    try {
      const res = importWorkspace(payload);
      broadcastDataChanged();
      return res;
    } catch (err) {
      throw formatError(err);
    }
  });

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
