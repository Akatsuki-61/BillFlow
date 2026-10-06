import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { app } from "electron";
import path from "path";
import fs from "fs";
import * as schema from "./schema";
import { catalogPriceSchema } from "../validation";
import { isDemoMode } from "../demo";

// Financial integrity: automatic business sample seeding is strictly disabled
// outside an explicit demo mode (isDemoMode()). The SQLite database always starts
// with a clean state containing zero synthetic clients, invoices, vendors, or tasks.

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqliteInstance: Database.Database | null = null;
let activePath: string | null = null;
let startupError: Error | null = null;

export function getDatabasePath(): string {
  if (activePath) return activePath;
  const override = process.env.BILLFLOW_USER_DATA;
  if (override && !path.isAbsolute(override)) throw new Error("BILLFLOW_USER_DATA must be absolute.");
  const directory = override || (app?.getPath ? app.getPath("userData") : path.join(process.cwd(), ".billflow-dev"));
  fs.mkdirSync(directory, { recursive: true });
  return path.join(directory, "billflow.db");
}

export function migrationFolder(customMigrations?: string): string {
  if (customMigrations) return customMigrations;
  const candidates = [
    app?.isPackaged ? path.join(process.resourcesPath, "drizzle") : "",
    path.join(__dirname, "../drizzle"),
    path.join(process.cwd(), "drizzle"),
  ].filter(Boolean);
  const folder = candidates.find(p => fs.existsSync(path.join(p, "meta/_journal.json")));
  if (!folder) throw new Error("Required database migrations are missing.");
  return folder;
}

export function migrateDatabase(sqlite: Database.Database, customMigrations?: string) {
  const folder = migrationFolder(customMigrations);

  // Reconcile development databases that ran intermediate branch migrations
  // (where timestamps 1791229052132, 1791229210154, or 1791229943818 were recorded).
  const hasMigrationTable = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'").get();
  if (hasMigrationTable) {
    const devBranchEntry = sqlite.prepare("SELECT 1 FROM __drizzle_migrations WHERE created_at IN (1791229052132, 1791229210154, 1791229943818)").get();
    if (devBranchEntry) {
      sqlite.transaction(() => {
        sqlite.exec(`
          CREATE TABLE IF NOT EXISTS "catalog_items" (
            "id" text PRIMARY KEY NOT NULL,
            "title" text NOT NULL,
            "category" text DEFAULT 'Development' NOT NULL,
            "sku" text NOT NULL UNIQUE,
            "description" text DEFAULT '' NOT NULL,
            "price_cents" integer DEFAULT 0 NOT NULL CHECK ("price_cents" >= 0 AND typeof("price_cents") = 'integer'),
            "currency" text DEFAULT 'LKR' NOT NULL,
            "unit" text DEFAULT '/ Hourly' NOT NULL,
            "icon_type" text DEFAULT 'code' NOT NULL,
            "created_at" text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
            "updated_at" text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
          );
        `);
        const invoiceColumns = (sqlite.prepare("PRAGMA table_info(invoices)").all() as Array<{ name: string }>).map(c => c.name);
        if (!invoiceColumns.includes("catalog_item_id")) {
          sqlite.exec('ALTER TABLE "invoices" ADD COLUMN "catalog_item_id" text REFERENCES "catalog_items"("id") ON DELETE set null');
        }
        if (!invoiceColumns.includes("request_hash")) {
          sqlite.exec('ALTER TABLE "invoices" ADD COLUMN "request_hash" text');
        }
        const taskColumns = (sqlite.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string }>).map(c => c.name);
        if (taskColumns.length && !taskColumns.includes("request_hash")) {
          sqlite.exec('ALTER TABLE "tasks" ADD COLUMN "request_hash" text');
        }
        const settingColumns = (sqlite.prepare("PRAGMA table_info(settings)").all() as Array<{ name: string }>).map(c => c.name);
        if (!settingColumns.includes("pdf_export_directory")) {
          sqlite.exec('ALTER TABLE "settings" ADD COLUMN "pdf_export_directory" text');
        }
        sqlite.prepare("DELETE FROM __drizzle_migrations WHERE created_at IN (1791229052132, 1791229210154, 1791229943818)").run();
        const existingTimestamps = new Set(
          (sqlite.prepare("SELECT created_at FROM __drizzle_migrations").all() as Array<{ created_at: number }>).map(r => Number(r.created_at))
        );
        const journalEntries: Array<{ when: number; hash?: string }> = JSON.parse(
          fs.readFileSync(path.join(folder, "meta/_journal.json"), "utf8")
        ).entries;
        for (const entry of journalEntries) {
          if (!existingTimestamps.has(entry.when)) {
            sqlite.prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)").run("reconciled", entry.when);
          }
        }
      })();
    }
  }

  // Older Sandika profiles store decimal text. Reject unsafe values before
  // the versioned migration converts them to integer minor units.
  const legacy = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='catalog_items'").get();
  if (legacy) {
    const columns = sqlite.prepare("PRAGMA table_info(catalog_items)").all() as { name: string }[];
    if (columns.some(column => column.name === "price")) {
      for (const row of sqlite.prepare("SELECT id, price FROM catalog_items").all() as { id: string; price: string }[]) {
        if (!catalogPriceSchema.safeParse(row.price).success) {
          throw new Error(`Catalog item ${row.id} has an invalid price; database upgrade was stopped.`);
        }
      }
    }
  }
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: folder });

  // Ensure work_orders has notes column even on databases migrating between intermediate revisions
  const hasWorkOrders = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='work_orders'").get();
  if (hasWorkOrders) {
    const woColumns = (sqlite.prepare("PRAGMA table_info(work_orders)").all() as Array<{ name: string }>).map(c => c.name);
    if (!woColumns.includes("notes")) {
      sqlite.exec('ALTER TABLE "work_orders" ADD COLUMN "notes" text');
    }
  }

  if ((sqlite.pragma("foreign_key_check") as unknown[]).length) {
    throw new Error("Database relationships failed validation after migration.");
  }
}

export function initDatabase(customPath?: string, customMigrations?: string) {
  startupError = null;
  if (dbInstance && sqliteInstance) return { db: dbInstance, sqlite: sqliteInstance };
  const dbPath = customPath || getDatabasePath();
  const sqlite = new Database(dbPath);
  try {
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    migrateDatabase(sqlite, customMigrations);
    dbInstance = drizzle(sqlite, { schema });
    sqliteInstance = sqlite;
    activePath = dbPath;
    return { db: dbInstance, sqlite };
  } catch (error) {
    sqlite.close();
    startupError = new Error(`Database upgrade failed. Business writes are disabled. ${error instanceof Error ? error.message : String(error)}`);
    throw startupError;
  }
}

export function getDb() {
  if (startupError) throw startupError;
  return dbInstance || initDatabase().db;
}

export function getSqlite() {
  if (startupError) throw startupError;
  return sqliteInstance || initDatabase().sqlite;
}

export function closeDatabaseForTesting() {
  sqliteInstance?.close();
  sqliteInstance = null;
  dbInstance = null;
  activePath = null;
  startupError = null;
}
