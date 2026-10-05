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

  // Ensure vendors table exists as a reliable safeguard
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS vendors (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        service TEXT NOT NULL,
        balance_cents INTEGER DEFAULT 0 NOT NULL,
        status TEXT DEFAULT 'PENDING' NOT NULL,
        icon_type TEXT DEFAULT 'devops' NOT NULL,
        email TEXT,
        phone TEXT,
        linked_client_id TEXT,
        linked_client_name TEXT,
        payout_due_date TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
        updated_at TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
        FOREIGN KEY (linked_client_id) REFERENCES clients(id) ON UPDATE NO ACTION ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS vendors_linked_client_id_idx ON vendors (linked_client_id);
    `);

    // Seed default vendors if empty
    const countRow = sqlite.prepare("SELECT COUNT(*) as count FROM vendors").get() as { count: number };
    if (countRow && countRow.count === 0) {
      const insertVendor = sqlite.prepare(`
        INSERT INTO vendors (id, name, service, balance_cents, status, icon_type, email, payout_due_date, linked_client_name)
        VALUES (@id, @name, @service, @balance_cents, @status, @icon_type, @email, @payout_due_date, @linked_client_name)
      `);

      const defaults = [
        {
          id: "vnd-1",
          name: "DevOps Nexus Labs",
          service: "CI/CD Pipeline & Kubernetes Orchestration",
          balance_cents: 320000,
          status: "PENDING",
          icon_type: "devops",
          email: "ops@devopsnexus.io",
          payout_due_date: "Oct 15, 2026",
          linked_client_name: "Fintech Labs Inc.",
        },
        {
          id: "vnd-2",
          name: "PixelCraft Design Studio",
          service: "Mobile App UI Design & Vector Asset Pack",
          balance_cents: 185000,
          status: "PAID",
          icon_type: "design",
          email: "hello@pixelcraft.design",
          payout_due_date: "Oct 08, 2026",
          linked_client_name: "Apex Architecture Ltd",
        },
        {
          id: "vnd-3",
          name: "LexSecure Legal Partners",
          service: "Cross-Border IP & Software Licensing Advisory",
          balance_cents: 140000,
          status: "PENDING",
          icon_type: "legal",
          email: "counsel@lexsecure.com",
          payout_due_date: "Oct 22, 2026",
          linked_client_name: "Quantum AI Corp",
        },
      ];

      for (const d of defaults) {
        insertVendor.run(d);
      }
    }
  } catch (err) {
    console.error("Vendors table initialization notice:", err);
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

