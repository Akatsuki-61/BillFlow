import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { app } from "electron";
import path from "path";
import fs from "fs";
import * as schema from "./schema";
import { catalogPriceSchema } from "../validation";

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqliteInstance: Database.Database | null = null;
let activePath: string | null = null;
let startupError: Error | null = null;

export function getDatabasePath(): string {
  if (activePath) return activePath;
  const override = process.env.BILLFLOW_USER_DATA;
  if (override && !path.isAbsolute(override)) throw new Error("BILLFLOW_USER_DATA must be absolute.");
  const folder = override || (app?.getPath ? app.getPath("userData") : path.join(process.cwd(), ".billflow-dev"));
  fs.mkdirSync(folder, { recursive: true });
  return path.join(folder, "billflow.db");
}

export function initDatabase(customPath?: string, customMigrations?: string) {
  if (startupError) throw startupError;
  if (dbInstance && sqliteInstance) return { db: dbInstance, sqlite: sqliteInstance };
  const dbPath = customPath || getDatabasePath();
  const sqlite = new Database(dbPath);
  try {
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    const folder = customMigrations || [
      app?.isPackaged ? path.join(process.resourcesPath, "drizzle") : "",
      path.join(__dirname, "../drizzle"), path.join(process.cwd(), "drizzle"),
    ].find(candidate => candidate && fs.existsSync(path.join(candidate, "meta/_journal.json")));
    if (!folder) throw new Error("Required database migrations are missing.");
    // Older Sandika profiles store decimal text. Reject unsafe values before
    // the versioned migration converts them to integer minor units.
    const legacy = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='catalog_items'").get();
    if (legacy) {
      const columns = sqlite.prepare("PRAGMA table_info(catalog_items)").all() as {name:string}[];
      if (columns.some(column => column.name === "price")) {
        for (const row of sqlite.prepare("SELECT id, price FROM catalog_items").all() as {id:string;price:string}[]) {
          if (!catalogPriceSchema.safeParse(row.price).success) throw new Error(`Catalog item ${row.id} has an invalid price; database upgrade was stopped.`);
        }
      }
    }
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: folder });
    if ((sqlite.pragma("foreign_key_check") as unknown[]).length) throw new Error("Database relationships failed validation after migration.");
    dbInstance = db; sqliteInstance = sqlite; activePath = dbPath;
    return { db, sqlite };
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
export function closeDatabaseForTesting() {
  sqliteInstance?.close(); sqliteInstance = null; dbInstance = null; activePath = null; startupError = null;
}
