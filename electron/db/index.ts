import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { app } from "electron";
import path from "path";
import fs from "fs";
import * as schema from "./schema";

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqliteInstance: Database.Database | null = null;
let activePath: string | null = null;

export function getDatabasePath(): string {
  if (activePath) return activePath;
  const directory = app?.getPath ? app.getPath("userData") : path.join(process.cwd(), ".billflow-dev");
  fs.mkdirSync(directory, { recursive: true });
  return path.join(directory, "billflow.db");
}

export function migrationFolder(): string {
  const candidates = [
    app?.isPackaged ? path.join(process.resourcesPath, "drizzle") : "",
    path.join(__dirname, "../drizzle"),
    path.join(process.cwd(), "drizzle"),
  ].filter(Boolean);
  const folder = candidates.find(p => fs.existsSync(path.join(p, "meta/_journal.json")));
  if (!folder) throw new Error("Required BillFlow migrations are missing. Reinstall the app before opening your data.");
  return folder;
}

export function migrateDatabase(sqlite: Database.Database) {
  migrate(drizzle(sqlite), { migrationsFolder: migrationFolder() });
  if ((sqlite.pragma("foreign_key_check") as unknown[]).length) throw new Error("Database relationship validation failed.");
}

export function initDatabase(customPath?: string) {
  if (dbInstance && sqliteInstance) return { db: dbInstance, sqlite: sqliteInstance };
  const dbPath = customPath || getDatabasePath();
  const sqlite = new Database(dbPath);
  try {
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    migrateDatabase(sqlite);
    // Publish the connection only after all required migrations succeed.
    dbInstance = drizzle(sqlite, { schema });
    sqliteInstance = sqlite;
    activePath = dbPath;
    return { db: dbInstance, sqlite };
  } catch (error) {
    sqlite.close();
    throw new Error("BillFlow could not migrate its database. Business writes are disabled.", { cause: error });
  }
}

export function getDb() { return dbInstance || initDatabase().db; }
export function getSqlite() { return sqliteInstance || initDatabase().sqlite; }

export function closeDatabaseForTesting() {
  sqliteInstance?.close();
  sqliteInstance = null;
  dbInstance = null;
  activePath = null;
}
