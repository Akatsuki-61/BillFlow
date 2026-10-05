import { z } from "zod";
import { ipcMain, shell } from "electron";
import { eq, sql } from "drizzle-orm";
import { getDb, getDatabasePath } from "../db";
import { settings, clients, invoices, catalogItems, vendors } from "../db/schema";
import { updateSettingsSchema, newClientSchema, catalogPriceSchema } from "../validation";
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

const idSchema=z.string().min(1).max(200);
const currencySchema=z.enum(["USD","LKR","EUR","GBP","CAD"]);
const timestamp=z.string().min(1);
const clientBackup=newClientSchema.extend({id:idSchema,contactRole:z.string().nullable().optional(),phone:z.string().nullable().optional(),driveUrl:z.string().nullable().optional(),hasQuickBill:z.boolean().default(true),createdAt:timestamp,updatedAt:timestamp});
const catalogBackup=z.object({id:idSchema,title:z.string().trim().min(1),category:z.enum(["Development","Design","Consulting","Licensing"]),sku:z.string().trim().min(1),description:z.string(),priceCents:z.number().int().nonnegative().safe(),currency:currencySchema,unit:z.string(),iconType:z.enum(["code","design","cloud","consulting"]),createdAt:timestamp,updatedAt:timestamp});
const invoiceBackup=z.object({id:idSchema,code:z.string().min(1),clientId:idSchema,catalogItemId:idSchema.nullable().optional(),requestHash:z.string().nullable().optional(),title:z.string().nullable().optional(),amountCents:z.number().int().nonnegative().safe(),currency:currencySchema,issueDate:timestamp,dueDate:z.string().nullable().optional(),status:z.enum(["DRAFT","UNPAID","PAID","OVERDUE"]),paidCents:z.number().int().nonnegative().safe().default(0),createdAt:timestamp,updatedAt:timestamp}).refine(row=>row.paidCents<=row.amountCents,"Recorded paid amount exceeds invoice total.");
const vendorBackup=z.object({id:idSchema,name:z.string().min(1),service:z.string().min(1),balanceCents:z.number().int().nonnegative().safe(),status:z.enum(["PENDING","PAID"]),iconType:z.enum(["design","devops","legal","development"]),email:z.string().nullable().optional(),phone:z.string().nullable().optional(),linkedClientId:idSchema.nullable().optional(),linkedClientName:z.string().nullable().optional(),payoutDueDate:z.string().nullable().optional(),notes:z.string().nullable().optional(),createdAt:timestamp,updatedAt:timestamp});

export function exportWorkspace(): ExportDataPayload {
  const db=getDb();
  return db.transaction(tx=>({version:"0.2.0",exportedAt:new Date().toISOString(),settings:getOrCreateSettings(),clients:tx.select().from(clients).all(),invoices:tx.select().from(invoices).all(),catalogItems:tx.select().from(catalogItems).all(),vendors:tx.select().from(vendors).all()}));
}
export function importWorkspace(payload: ExportDataPayload) {
  const backup=z.object({version:z.enum(["0.1.0","0.2.0"]),settings:z.record(z.string(),z.unknown()).optional(),clients:z.array(clientBackup),invoices:z.array(invoiceBackup),catalogItems:z.array(z.unknown()).optional(),vendors:z.array(vendorBackup).optional()}).parse(payload);
  const catalogs=(backup.catalogItems || []).map(row=>{
    if(row && typeof row==="object" && "price" in row && !("priceCents" in row)) {
      const price=catalogPriceSchema.parse(row.price);
      return catalogBackup.parse({...row,priceCents:Math.round(Number(price)*100)});
    }
    return catalogBackup.parse(row);
  });
  const settingsPatch=backup.settings ? updateSettingsSchema.parse(backup.settings) : undefined;
  for(const rows of [backup.clients,backup.invoices,catalogs,backup.vendors || []]) {
    if(new Set(rows.map(row=>row.id)).size!==rows.length)throw new AppError("INVALID_BACKUP","Backup contains duplicate record IDs.");
  }
  const db=getDb();
  db.transaction(tx=>{
    if(settingsPatch)updateSettings(settingsPatch);
    for(const row of backup.clients)tx.insert(clients).values(row).onConflictDoUpdate({target:clients.id,set:row}).run();
    for(const row of catalogs)tx.insert(catalogItems).values(row).onConflictDoUpdate({target:catalogItems.id,set:row}).run();
    for(const row of backup.invoices)tx.insert(invoices).values(row).onConflictDoUpdate({target:invoices.id,set:row}).run();
    for(const row of backup.vendors || [])tx.insert(vendors).values(row).onConflictDoUpdate({target:vendors.id,set:row}).run();
  });
  return {success:true,importedClients:backup.clients.length,importedInvoices:backup.invoices.length};
}
export function resetWorkspace() {
  getDb().transaction(tx=>{
    tx.delete(invoices).run();tx.delete(vendors).run();tx.delete(catalogItems).run();tx.delete(clients).run();
    tx.update(settings).set({nextInvoiceSeq:1}).where(eq(settings.id,"default")).run();
  });
  return {success:true};
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
