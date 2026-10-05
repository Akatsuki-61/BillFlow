import { ipcMain } from "electron";
import crypto from "crypto";
import { eq, desc } from "drizzle-orm";
import { getDb } from "../db";
import { catalogItems } from "../db/schema";
import { newCatalogItemSchema, catalogItemPatchSchema } from "../validation";
import { AppError, formatError } from "./errors";
import {
  CatalogItem,
  NewCatalogItemInput,
  CatalogItemPatchInput,
  Currency,
  CatalogCategory,
  CatalogIconType,
} from "../../src/types/billing";

export function listCatalogItems(): CatalogItem[] {
  const db = getDb();
  const all = db.select().from(catalogItems).orderBy(desc(catalogItems.createdAt)).all();

  return all.map((c) => ({
    id: c.id,
    title: c.title,
    category: c.category as CatalogCategory,
    sku: c.sku,
    description: c.description,
    price: c.price,
    currency: c.currency as Currency,
    unit: c.unit,
    iconType: c.iconType as CatalogIconType,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
}

export function registerCatalogHandlers(broadcastDataChanged: () => void) {
  ipcMain.handle("catalog:list", async () => {
    try {
      return listCatalogItems();
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle("catalog:create", async (_event, input: NewCatalogItemInput) => {
    try {
      const validated = newCatalogItemSchema.parse(input);
      const db = getDb();
      const id = `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      // Check if SKU exists
      const existingSku = db.select().from(catalogItems).where(eq(catalogItems.sku, validated.sku)).get();
      const skuToUse = existingSku
        ? `${validated.sku}-${Date.now().toString().slice(-4)}`
        : validated.sku;

      db.insert(catalogItems)
        .values({
          id,
          title: validated.title,
          category: validated.category,
          sku: skuToUse,
          description: validated.description || "",
          price: validated.price,
          currency: validated.currency,
          unit: validated.unit || "/ Hourly",
          iconType: validated.iconType || "code",
        })
        .run();

      broadcastDataChanged();
      const all = listCatalogItems();
      return all.find((item) => item.id === id)!;
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle(
    "catalog:update",
    async (_event, id: string, patch: CatalogItemPatchInput) => {
      try {
        const validated = catalogItemPatchSchema.parse(patch);
        const db = getDb();

        const existing = db.select().from(catalogItems).where(eq(catalogItems.id, id)).get();
        if (!existing) {
          throw new AppError("NOT_FOUND", "Catalog item not found.");
        }

        db.update(catalogItems)
          .set({
            title: validated.title ?? existing.title,
            category: validated.category ?? existing.category,
            sku: validated.sku ?? existing.sku,
            description: validated.description !== undefined ? validated.description : existing.description,
            price: validated.price ?? existing.price,
            currency: validated.currency ?? existing.currency,
            unit: validated.unit ?? existing.unit,
            iconType: validated.iconType ?? existing.iconType,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(catalogItems.id, id))
          .run();

        broadcastDataChanged();
        const all = listCatalogItems();
        return all.find((item) => item.id === id)!;
      } catch (err) {
        throw formatError(err);
      }
    }
  );

  ipcMain.handle("catalog:remove", async (_event, id: string) => {
    try {
      const db = getDb();
      db.delete(catalogItems).where(eq(catalogItems.id, id)).run();
      broadcastDataChanged();
      return { success: true };
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle("catalog:bulkImport", async (_event, items: NewCatalogItemInput[]) => {
    try {
      const db = getDb();
      let importedCount = 0;

      for (const item of items) {
        const validated = newCatalogItemSchema.safeParse(item);
        if (validated.success) {
          const val = validated.data;
          const id = `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const existingSku = db.select().from(catalogItems).where(eq(catalogItems.sku, val.sku)).get();
          const skuToUse = existingSku ? `${val.sku}-${importedCount + 1}` : val.sku;

          db.insert(catalogItems)
            .values({
              id,
              title: val.title,
              category: val.category,
              sku: skuToUse,
              description: val.description || "",
              price: val.price,
              currency: val.currency,
              unit: val.unit || "/ Hourly",
              iconType: val.iconType || "code",
            })
            .run();
          importedCount++;
        }
      }

      broadcastDataChanged();
      return { success: true, count: importedCount };
    } catch (err) {
      throw formatError(err);
    }
  });
}
