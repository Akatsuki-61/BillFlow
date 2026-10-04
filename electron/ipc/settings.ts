import { ipcMain, shell } from "electron";
import { eq, sql } from "drizzle-orm";
import { getDb, getDatabasePath } from "../db";
import { settings, clients, invoices } from "../db/schema";
import { updateSettingsSchema } from "../validation";
import { formatError, AppError } from "./errors";
import type { AppSettings, UpdateSettingsInput, ExportDataPayload } from "../../src/types/settings";

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

export function exportWorkspace(): ExportDataPayload {
  const db = getDb();
  const currentSettings = getOrCreateSettings();
  const allClients = db.select().from(clients).all();
  const allInvoices = db.select().from(invoices).all();

  return {
    version: "0.1.0",
    exportedAt: new Date().toISOString(),
    settings: currentSettings,
    clients: allClients,
    invoices: allInvoices,
  };
}

export function importWorkspace(payload: ExportDataPayload): {
  success: boolean;
  importedClients: number;
  importedInvoices: number;
} {
  if (!payload || typeof payload !== "object") {
    throw new AppError("INVALID_BACKUP", "Invalid backup file structure.");
  }
  if (!Array.isArray(payload.clients) || !Array.isArray(payload.invoices)) {
    throw new AppError("INVALID_BACKUP", "Backup is missing client or invoice records.");
  }

  const db = getDb();

  // Restore settings if present
  if (payload.settings) {
    try {
      updateSettings(payload.settings);
    } catch (e) {
      console.warn("Could not import full settings, continuing:", e);
    }
  }

  // Insert or update clients
  let importedClients = 0;
  for (const client of payload.clients as Array<Record<string, unknown>>) {
    if (client.id && client.name && client.email) {
      const existing = db.select().from(clients).where(eq(clients.id, String(client.id))).get();
      if (existing) {
        db.update(clients)
          .set({
            name: String(client.name),
            category: String(client.category || "Enterprise"),
            contactPerson: String(client.contactPerson || client.name),
            contactRole: client.contactRole ? String(client.contactRole) : null,
            email: String(client.email),
            phone: client.phone ? String(client.phone) : null,
            currency: (client.currency as "USD" | "LKR" | "EUR") || "USD",
            driveUrl: client.driveUrl ? String(client.driveUrl) : null,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(clients.id, String(client.id)))
          .run();
      } else {
        db.insert(clients)
          .values({
            id: String(client.id),
            name: String(client.name),
            category: String(client.category || "Enterprise"),
            contactPerson: String(client.contactPerson || client.name),
            contactRole: client.contactRole ? String(client.contactRole) : null,
            email: String(client.email),
            phone: client.phone ? String(client.phone) : null,
            currency: (client.currency as "USD" | "LKR" | "EUR") || "USD",
            driveUrl: client.driveUrl ? String(client.driveUrl) : null,
            hasQuickBill: Boolean(client.hasQuickBill ?? true),
            createdAt: client.createdAt ? String(client.createdAt) : new Date().toISOString(),
            updatedAt: client.updatedAt ? String(client.updatedAt) : new Date().toISOString(),
          })
          .run();
      }
      importedClients++;
    }
  }

  // Insert or update invoices
  let importedInvoices = 0;
  for (const inv of payload.invoices as Array<Record<string, unknown>>) {
    if (inv.id && inv.code && inv.clientId && inv.amountCents !== undefined) {
      const existing = db.select().from(invoices).where(eq(invoices.id, String(inv.id))).get();
      if (existing) {
        db.update(invoices)
          .set({
            code: String(inv.code),
            clientId: String(inv.clientId),
            title: inv.title ? String(inv.title) : null,
            amountCents: Number(inv.amountCents),
            currency: (inv.currency as "USD" | "LKR" | "EUR" | "GBP" | "CAD") || "USD",
            issueDate: String(inv.issueDate || new Date().toISOString().split("T")[0]),
            dueDate: inv.dueDate ? String(inv.dueDate) : null,
            status: (inv.status as "DRAFT" | "UNPAID" | "PAID" | "OVERDUE") || "UNPAID",
            paidCents: Number(inv.paidCents ?? 0),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(invoices.id, String(inv.id)))
          .run();
      } else {
        db.insert(invoices)
          .values({
          id: String(inv.id),
          code: String(inv.code),
          clientId: String(inv.clientId),
          title: inv.title ? String(inv.title) : null,
          amountCents: Number(inv.amountCents),
          currency: (inv.currency as "USD" | "LKR" | "EUR" | "GBP" | "CAD") || "USD",
          issueDate: String(inv.issueDate || new Date().toISOString().split("T")[0]),
          dueDate: inv.dueDate ? String(inv.dueDate) : null,
          status: (inv.status as "DRAFT" | "UNPAID" | "PAID" | "OVERDUE") || "UNPAID",
          paidCents: Number(inv.paidCents ?? 0),
          createdAt: inv.createdAt ? String(inv.createdAt) : new Date().toISOString(),
          updatedAt: inv.updatedAt ? String(inv.updatedAt) : new Date().toISOString(),
        })
        .run();
      }
      importedInvoices++;
    }
  }

  return {
    success: true,
    importedClients,
    importedInvoices,
  };
}

export function resetWorkspace(): { success: boolean } {
  const db = getDb();
  // Delete invoices first to maintain foreign key integrity
  db.delete(invoices).run();
  db.delete(clients).run();

  try {
    db.update(settings).set({ nextInvoiceSeq: 1 }).where(eq(settings.id, "default")).run();
  } catch {
    // ignore
  }

  return { success: true };
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
