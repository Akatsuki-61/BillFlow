import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { app } from "electron";
import path from "path";
import fs from "fs";
import * as schema from "./schema";

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqliteInstance: Database.Database | null = null;

export function getDatabasePath(): string {
  try {
    const userData = app?.getPath ? app.getPath("userData") : path.join(process.cwd(), ".billflow-dev");
    if (!fs.existsSync(userData)) {
      fs.mkdirSync(userData, { recursive: true });
    }
    return path.join(userData, "billflow.db");
  } catch {
    const fallback = path.join(process.cwd(), ".billflow-dev");
    if (!fs.existsSync(fallback)) {
      fs.mkdirSync(fallback, { recursive: true });
    }
    return path.join(fallback, "billflow.db");
  }
}

export function initDatabase(customPath?: string) {
  if (dbInstance && sqliteInstance) {
    return { db: dbInstance, sqlite: sqliteInstance };
  }

  const dbPath = customPath || getDatabasePath();
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });
  dbInstance = db;
  sqliteInstance = sqlite;

  // Run migrations
  try {
    const candidatePaths = [
      app?.isPackaged ? path.join(process.resourcesPath, "drizzle") : "",
      path.join(__dirname, "../drizzle"),
      path.join(process.cwd(), "drizzle"),
    ].filter(Boolean);

    const folder = candidatePaths.find((p) => fs.existsSync(p));
    if (folder) {
      migrate(db, { migrationsFolder: folder });
    }
  } catch (err) {
    console.error("Migration execution notice:", err);
  }

  return { db, sqlite };
}

export function getDb() {
  if (!dbInstance) {
    return initDatabase().db;
  }
  return dbInstance;
}

export function closeDatabaseForTesting() {
  if (sqliteInstance) {
    try {
      sqliteInstance.close();
    } catch {
      // ignore
    }
  }
  sqliteInstance = null;
  dbInstance = null;
}

