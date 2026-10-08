import { ipcMain } from "electron";
import crypto from "crypto";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { getDb } from "../db";
import { catalogItems, invoices } from "../db/schema";
import { newCatalogItemSchema, catalogItemPatchSchema } from "../validation";
import { AppError, formatError } from "./errors";
import type { CatalogItem, NewCatalogItemInput, CatalogItemPatchInput } from "../../src/types/billing";

export function listCatalogItems(): CatalogItem[] {
  return getDb().select().from(catalogItems).orderBy(desc(catalogItems.createdAt)).all().map(row => ({
    ...row, price: (row.priceCents / 100).toFixed(2),
  }));
}
export function createCatalogItem(input: NewCatalogItemInput): CatalogItem {
  const value = newCatalogItemSchema.parse(input);
  const db = getDb();
  const id = value.requestId || crypto.randomUUID();
  const data = {title:value.title, category:value.category, sku:value.sku, description:value.description, priceCents:Math.round(Number(value.price)*100), currency:value.currency, unit:value.unit, iconType:value.iconType};
  const existing = db.select().from(catalogItems).where(eq(catalogItems.id,id)).get();
  if (existing) {
    if (Object.entries(data).some(([key,val]) => existing[key as keyof typeof existing] !== val)) throw new AppError("CONFLICT", "This Catalog request was already used with different details.");
    return listCatalogItems().find(row => row.id === id)!;
  }
  if (db.select().from(catalogItems).where(eq(catalogItems.sku,value.sku)).get()) throw new AppError("DUPLICATE_SKU", "That SKU already exists. Edit the existing item or use another SKU.");
  db.insert(catalogItems).values({id,...data}).run();
  return listCatalogItems().find(row => row.id === id)!;
}
export function updateCatalogItem(id: string, patch: CatalogItemPatchInput): CatalogItem {
  z.string().min(1).parse(id);
  const value = catalogItemPatchSchema.parse(patch);
  const db = getDb();
  if (!db.select().from(catalogItems).where(eq(catalogItems.id,id)).get()) throw new AppError("NOT_FOUND", "Catalog item not found.");
  const {price,...fields} = value;
  db.update(catalogItems).set({...fields,...(price === undefined ? {} : {priceCents:Math.round(Number(price)*100)}), updatedAt:new Date().toISOString()}).where(eq(catalogItems.id,id)).run();
  return listCatalogItems().find(row => row.id === id)!;
}
export function removeCatalogItem(id: string) {
  z.string().min(1).parse(id);
  const db = getDb();
  const existing = db.select().from(catalogItems).where(eq(catalogItems.id, id)).get();
  if (!existing) throw new AppError("NOT_FOUND", "Catalog item not found.");
  return db.transaction((tx) => {
    tx.update(invoices).set({ catalogItemId: null }).where(eq(invoices.catalogItemId, id)).run();
    tx.delete(catalogItems).where(eq(catalogItems.id, id)).run();
    return { success: true };
  });
}
export function bulkImportCatalogItems(input: NewCatalogItemInput[]) {
  const rows = z.array(newCatalogItemSchema).min(1).max(5000).parse(input);
  if (new Set(rows.map(row => row.sku)).size !== rows.length) throw new AppError("DUPLICATE_SKU", "The import contains repeated SKUs.");
  return getDb().transaction(tx => {
    let count=0;
    for (const row of rows) {
      const data={title:row.title,category:row.category,sku:row.sku,description:row.description,priceCents:Math.round(Number(row.price)*100),currency:row.currency,unit:row.unit,iconType:row.iconType};
      const existing=tx.select().from(catalogItems).where(eq(catalogItems.sku,row.sku)).get();
      if (existing) {
        if (Object.entries(data).some(([key,value])=>existing[key as keyof typeof existing] !== value)) throw new AppError("DUPLICATE_SKU", `SKU ${row.sku} already exists with different details. No items were imported.`);
        continue;
      }
      tx.insert(catalogItems).values({id:crypto.randomUUID(),...data}).run(); count++;
    }
    return {success:true,count};
  });
}
export function registerCatalogHandlers(broadcast: () => void) {
  ipcMain.handle("catalog:list", () => listCatalogItems());
  ipcMain.handle("catalog:create", (_event,input:NewCatalogItemInput) => {try {const result=createCatalogItem(input);broadcast();return result;} catch(error){throw formatError(error);}});
  ipcMain.handle("catalog:update", (_event,id:string,patch:CatalogItemPatchInput) => {try {const result=updateCatalogItem(id,patch);broadcast();return result;} catch(error){throw formatError(error);}});
  ipcMain.handle("catalog:remove", (_event,id:string) => {try {const result=removeCatalogItem(id);broadcast();return result;} catch(error){throw formatError(error);}});
  ipcMain.handle("catalog:bulkImport", (_event,input:NewCatalogItemInput[]) => {try {const result=bulkImportCatalogItems(input);broadcast();return result;} catch(error){throw formatError(error);}});
}
