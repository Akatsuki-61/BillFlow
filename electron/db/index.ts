import { randomUUID } from "crypto";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { app } from "electron";
import path from "path";
import fs from "fs";
import * as schema from "./schema";
import { assertWorkspaceIntegrity } from "./integrity";
import { catalogPriceSchema } from "../validation";

// Financial integrity: automatic business sample seeding is strictly disabled
// outside explicitly seeded test fixtures. The SQLite database always starts
// with a clean state containing zero synthetic clients, invoices, vendors, or tasks.

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqliteInstance: Database.Database | null = null;
let rootDbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let rootSqliteInstance: Database.Database | null = null;
let rootDbPath: string | null = null;
let activePath: string | null = null;
let activeProfileId = "default";
let activeCustomMigrations: string | null = null;
let startupError: Error | null = null;
let workspaceGeneration = 0;
export function getWorkspaceGeneration() {
  return workspaceGeneration;
}

export function getRootDatabasePath(): string {
  if (rootDbPath) return rootDbPath;
  const override = process.env.BILLFLOW_USER_DATA;
  if (override && !path.isAbsolute(override))
    throw new Error("BILLFLOW_USER_DATA must be absolute.");
  const directory =
    override ||
    (app?.getPath
      ? app.getPath("userData")
      : path.join(process.cwd(), ".billflow-dev"));
  fs.mkdirSync(directory, { recursive: true });
  return path.join(directory, "billflow.db");
}

export function getDatabasePath(): string {
  if (activePath) return activePath;
  return getRootDatabasePath();
}

export function getActiveProfileId(): string {
  return activeProfileId;
}

export function migrationFolder(customMigrations?: string): string {
  if (customMigrations) return customMigrations;
  const candidates = [
    app?.isPackaged ? path.join(process.resourcesPath, "drizzle") : "",
    path.join(__dirname, "../drizzle"),
    path.join(process.cwd(), "drizzle"),
  ].filter(Boolean);
  const folder = candidates.find((p) =>
    fs.existsSync(path.join(p, "meta/_journal.json")),
  );
  if (!folder) throw new Error("Required database migrations are missing.");
  return folder;
}

export function migrateDatabase(
  sqlite: Database.Database,
  customMigrations?: string,
) {
  return sqlite.transaction(() =>
    migrateDatabaseInTransaction(sqlite, customMigrations),
  )();
}
function migrateDatabaseInTransaction(
  sqlite: Database.Database,
  customMigrations?: string,
) {
  let legacyExpenses: Record<string, unknown>[] | null = null;
  const folder = migrationFolder(customMigrations);

  // Reconcile development databases that ran intermediate branch migrations
  // (where timestamps 1791229052132, 1791229210154, or 1791229943818 were recorded).
  const hasMigrationTable = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'",
    )
    .get();
  if (hasMigrationTable) {
    const devBranchEntry = sqlite
      .prepare(
        "SELECT 1 FROM __drizzle_migrations WHERE created_at IN (1791229052132, 1791229210154, 1791229943818)",
      )
      .get();
    if (devBranchEntry) {
      const required = [
        "invoice_items",
        "invoice_payments",
        "subtasks",
        "task_history",
        "work_orders",
        "vendor_payouts",
        "attachments",
        "invoice_pdf_exports",
      ];
      if (
        required.some(
          (table) =>
            !sqlite
              .prepare(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
              )
              .get(table),
        )
      )
        throw new Error(
          "Unsupported incomplete legacy workspace layout. The original database and pre-upgrade backup have been preserved.",
        );
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
        const invoiceColumns = (
          sqlite.prepare("PRAGMA table_info(invoices)").all() as Array<{
            name: string;
          }>
        ).map((c) => c.name);
        if (!invoiceColumns.includes("catalog_item_id")) {
          sqlite.exec(
            'ALTER TABLE "invoices" ADD COLUMN "catalog_item_id" text REFERENCES "catalog_items"("id") ON DELETE set null',
          );
        }
        if (!invoiceColumns.includes("request_hash")) {
          sqlite.exec('ALTER TABLE "invoices" ADD COLUMN "request_hash" text');
        }
        const taskColumns = (
          sqlite.prepare("PRAGMA table_info(tasks)").all() as Array<{
            name: string;
          }>
        ).map((c) => c.name);
        if (taskColumns.length && !taskColumns.includes("request_hash")) {
          sqlite.exec('ALTER TABLE "tasks" ADD COLUMN "request_hash" text');
        }
        const settingColumns = (
          sqlite.prepare("PRAGMA table_info(settings)").all() as Array<{
            name: string;
          }>
        ).map((c) => c.name);
        if (!settingColumns.includes("pdf_export_directory")) {
          sqlite.exec(
            'ALTER TABLE "settings" ADD COLUMN "pdf_export_directory" text',
          );
        }
        sqlite
          .prepare(
            "DELETE FROM __drizzle_migrations WHERE created_at IN (1791229052132, 1791229210154, 1791229943818)",
          )
          .run();
        const existingTimestamps = new Set(
          (
            sqlite
              .prepare("SELECT created_at FROM __drizzle_migrations")
              .all() as Array<{ created_at: number }>
          ).map((r) => Number(r.created_at)),
        );
        const journalEntries: Array<{ when: number; hash?: string }> =
          JSON.parse(
            fs.readFileSync(path.join(folder, "meta/_journal.json"), "utf8"),
          ).entries;
        for (const entry of journalEntries) {
          if (
            entry.when <= 1791240000000 &&
            !existingTimestamps.has(entry.when)
          ) {
            sqlite
              .prepare(
                "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
              )
              .run("reconciled", entry.when);
          }
        }
      })();
    }

    // Pre-0005 reconciliation: If migration 0005 (1791234000000) has NOT been recorded in __drizzle_migrations,
    // ensure any leftover pre-0005 dev `expenses` table won't collide with CREATE TABLE expenses in 0005.
    const has0005 = sqlite
      .prepare(
        "SELECT 1 FROM __drizzle_migrations WHERE created_at = 1791234000000",
      )
      .get();
    if (!has0005) {
      if (
        sqlite
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='expenses'",
          )
          .get()
      ) {
        const columns = (
          sqlite.prepare("PRAGMA table_info(expenses)").all() as {
            name: string;
          }[]
        ).map((c) => c.name);
        if (
          ![
            "id",
            "description",
            "category",
            "amount_cents",
            "currency",
            "incurred_at",
          ].every((c) => columns.includes(c))
        )
          throw new Error(
            "Unrecognized legacy expenses schema. Your original database has been preserved.",
          );
        legacyExpenses = sqlite
          .prepare("SELECT * FROM expenses")
          .all() as Record<string, unknown>[];
        sqlite.exec("ALTER TABLE expenses RENAME TO billflow_legacy_expenses");
      }
    }

    // Pre-0006 reconciliation: If migration 0006 (1791240000000) has NOT been recorded in __drizzle_migrations,
    // but expenses table already has merchant/deductible/created_at columns from dev, mark 0006 as reconciled.
    const has0006 = sqlite
      .prepare(
        "SELECT 1 FROM __drizzle_migrations WHERE created_at = 1791240000000",
      )
      .get();
    if (!has0006) {
      const hasExpensesTable = sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='expenses'",
        )
        .get();
      if (hasExpensesTable) {
        const expenseCols = (
          sqlite.prepare("PRAGMA table_info(expenses)").all() as Array<{
            name: string;
          }>
        ).map((c) => c.name);
        if (
          expenseCols.includes("merchant") &&
          expenseCols.includes("deductible") &&
          expenseCols.includes("created_at")
        ) {
          sqlite
            .prepare(
              "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
            )
            .run("reconciled", 1791240000000);
        }
      }
    }
  }

  // Older Sandika profiles store decimal text. Reject unsafe values before
  // the versioned migration converts them to integer minor units.
  const legacy = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='catalog_items'",
    )
    .get();
  if (legacy) {
    const columns = sqlite
      .prepare("PRAGMA table_info(catalog_items)")
      .all() as { name: string }[];
    if (columns.some((column) => column.name === "price")) {
      for (const row of sqlite
        .prepare("SELECT id, price FROM catalog_items")
        .all() as { id: string; price: string }[]) {
        if (!catalogPriceSchema.safeParse(row.price).success) {
          throw new Error(
            `Catalog item ${row.id} has an invalid price; database upgrade was stopped.`,
          );
        }
      }
    }
  }
  const journal = JSON.parse(
    fs.readFileSync(path.join(folder, "meta/_journal.json"), "utf8"),
  ).entries as { tag: string; when: number }[];
  const latest = hasMigrationTable
    ? (
        sqlite
          .prepare(
            "SELECT max(created_at) AS timestamp FROM __drizzle_migrations",
          )
          .get() as { timestamp: number | null }
      ).timestamp || 0
    : 0;
  const expenseMigration = journal.find(
    (entry) => entry.tag === "0007_expenses_ledger",
  );
  // Repair the historical ALTER before Drizzle reaches it, including populated databases.
  if (
    expenseMigration &&
    latest >= 1791235000000 &&
    latest < expenseMigration.when &&
    sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='expenses'",
      )
      .get()
  ) {
    const cols = (
      sqlite.prepare("PRAGMA table_info(expenses)").all() as { name: string }[]
    ).map((c) => c.name);
    if (!cols.includes("merchant"))
      sqlite.exec("ALTER TABLE expenses ADD merchant text NOT NULL DEFAULT ''");
    if (!cols.includes("deductible"))
      sqlite.exec(
        "ALTER TABLE expenses ADD deductible integer NOT NULL DEFAULT 1",
      );
    if (!cols.includes("created_at"))
      sqlite.exec(
        "ALTER TABLE expenses ADD created_at text NOT NULL DEFAULT ''",
      );
    sqlite
      .prepare(
        "UPDATE expenses SET created_at = CASE WHEN incurred_at <> '' THEN incurred_at ELSE CURRENT_TIMESTAMP END WHERE created_at = ''",
      )
      .run();
    sqlite
      .prepare(
        "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
      )
      .run("reconciled-populated-expenses", expenseMigration.when);
  }
  sqlite.exec(
    "CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash text NOT NULL, created_at numeric)",
  );
  const appliedAt =
    (
      sqlite
        .prepare("SELECT max(created_at) AS n FROM __drizzle_migrations")
        .get() as { n: number | null }
    ).n || 0;
  for (const migration of readMigrationFiles({ migrationsFolder: folder })) {
    if (migration.folderMillis <= appliedAt) continue;
    for (const statement of migration.sql) sqlite.exec(statement);
    sqlite
      .prepare(
        "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
      )
      .run(migration.hash, migration.folderMillis);
  }
  if (legacyExpenses) {
    const cols = (
      sqlite.prepare("PRAGMA table_info(expenses)").all() as { name: string }[]
    ).map((c) => c.name);
    const insert = sqlite.prepare(
      `INSERT INTO expenses (${cols.map((c) => '"' + c + '"').join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
    );
    for (const row of legacyExpenses)
      insert.run(
        ...cols.map(
          (c) =>
            row[c] ??
            (
              {
                merchant: "",
                deductible: 1,
                created_at: row.incurred_at || new Date().toISOString(),
                invoice_id: null,
              } as Record<string, unknown>
            )[c],
        ),
      );
    sqlite.exec("DROP TABLE billflow_legacy_expenses");
  }

  // Ensure work_orders has notes column even on databases migrating between intermediate revisions
  const hasWorkOrders = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='work_orders'",
    )
    .get();
  if (hasWorkOrders) {
    const woColumns = (
      sqlite.prepare("PRAGMA table_info(work_orders)").all() as Array<{
        name: string;
      }>
    ).map((c) => c.name);
    if (!woColumns.includes("notes")) {
      sqlite.exec('ALTER TABLE "work_orders" ADD COLUMN "notes" text');
    }
  }

  // Ensure settings has default_invoice_template column
  const hasSettings = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='settings'",
    )
    .get();
  if (hasSettings) {
    const sColumns = (
      sqlite.prepare("PRAGMA table_info(settings)").all() as Array<{
        name: string;
      }>
    ).map((c) => c.name);
    if (!sColumns.includes("default_invoice_template")) {
      sqlite.exec(
        'ALTER TABLE "settings" ADD COLUMN "default_invoice_template" text DEFAULT \'geometric-teal\'',
      );
    }
  }

  // Ensure user_profiles table exists on all databases (including reconciled dev databases)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "user_profiles" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "role" text DEFAULT 'software-engineering' NOT NULL,
      "subtitle" text DEFAULT 'Full-Stack & Systems' NOT NULL,
      "avatar" text DEFAULT 'code' NOT NULL,
      "accent" text DEFAULT 'blue' NOT NULL,
      "theme_preference" text DEFAULT 'system' NOT NULL,
      "default_currency" text DEFAULT 'USD' NOT NULL,
      "invoice_prefix" text DEFAULT 'SE-' NOT NULL,
      "password_hash" text,
      "password_salt" text,
      "password_hint" text,
      "is_active" integer DEFAULT false NOT NULL,
      "is_onboarded" integer DEFAULT false NOT NULL,
      "position" integer DEFAULT 0 NOT NULL,
      "last_active_at" text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
      "created_at" text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
      "updated_at" text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
    );
  `);

  if ((sqlite.pragma("foreign_key_check") as unknown[]).length) {
    throw new Error(
      "Database relationships failed validation after migration.",
    );
  }
  assertWorkspaceIntegrity(sqlite);
}

function backupBeforeUpgrade(
  sqlite: Database.Database,
  databasePath: string,
  customMigrations?: string,
) {
  if (
    databasePath === ":memory:" ||
    !sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='clients'",
      )
      .get()
  )
    return;
  const entries = JSON.parse(
    fs.readFileSync(
      path.join(migrationFolder(customMigrations), "meta/_journal.json"),
      "utf8",
    ),
  ).entries as { when: number }[];
  const hasJournal = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'",
    )
    .get();
  const latest = hasJournal
    ? (
        sqlite
          .prepare("SELECT max(created_at) AS n FROM __drizzle_migrations")
          .get() as { n: number }
      ).n || 0
    : 0;
  if (latest >= Math.max(...entries.map((e) => e.when))) return;
  const backup = `${databasePath}.before-upgrade-${latest}.bak`;
  if (!fs.existsSync(backup)) {
    const temporary = `${backup}.${randomUUID()}.tmp`;
    let handle: number | undefined;
    try {
      handle = fs.openSync(temporary, "wx");
      fs.writeFileSync(handle, sqlite.serialize());
      fs.fsyncSync(handle);
      fs.closeSync(handle);
      handle = undefined;
      fs.renameSync(temporary, backup);
    } finally {
      if (handle !== undefined) fs.closeSync(handle);
      fs.rmSync(temporary, { force: true });
    }
  }
}
export function initDatabase(customPath?: string, customMigrations?: string) {
  startupError = null;
  if (dbInstance && sqliteInstance) {
    if (!customPath || customPath === activePath) {
      return { db: dbInstance, sqlite: sqliteInstance };
    }
    closeDatabaseForTesting();
  }
  const dbPath = customPath || getRootDatabasePath();
  const sqlite = new Database(dbPath);
  try {
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    backupBeforeUpgrade(sqlite, dbPath, customMigrations);
    migrateDatabase(sqlite, customMigrations);
    const initializedDb = drizzle(sqlite, { schema });
    rootDbInstance = initializedDb;
    rootSqliteInstance = sqlite;
    rootDbPath = dbPath;
    dbInstance = initializedDb;
    sqliteInstance = sqlite;
    activePath = dbPath;
    activeProfileId = "default";
    activeCustomMigrations = customMigrations || null;
    return { db: dbInstance, sqlite };
  } catch (error) {
    sqlite.close();
    startupError = new Error(
      `Database upgrade failed. Business writes are disabled. ${error instanceof Error ? error.message : String(error)}`,
    );
    throw startupError;
  }
}

export function getRootDb() {
  if (startupError) throw startupError;
  if (!rootDbInstance) initDatabase();
  return rootDbInstance!;
}

export function switchWorkspaceDatabase(profileId: string) {
  workspaceGeneration++;
  if (startupError) throw startupError;
  if (!/^[a-zA-Z0-9_-]+$/.test(profileId)) {
    throw new Error("Invalid profile identifier.");
  }
  if (!rootDbInstance || !rootSqliteInstance || !rootDbPath) {
    initDatabase();
  }

  if (profileId === "default") {
    if (sqliteInstance && sqliteInstance !== rootSqliteInstance) {
      sqliteInstance.close();
    }
    dbInstance = rootDbInstance;
    sqliteInstance = rootSqliteInstance;
    activePath = rootDbPath;
    activeProfileId = "default";
    return { db: dbInstance!, sqlite: sqliteInstance!, dbPath: activePath! };
  }

  const rootDir = path.dirname(rootDbPath!);
  const profileDir = path.join(rootDir, "profiles", profileId);
  fs.mkdirSync(profileDir, { recursive: true });
  const targetDbPath = path.join(profileDir, "billflow.db");

  if (activePath === targetDbPath && dbInstance && sqliteInstance) {
    activeProfileId = profileId;
    return { db: dbInstance, sqlite: sqliteInstance, dbPath: activePath };
  }

  const sqlite = new Database(targetDbPath);
  try {
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    backupBeforeUpgrade(
      sqlite,
      targetDbPath,
      activeCustomMigrations || undefined,
    );
    migrateDatabase(sqlite, activeCustomMigrations || undefined);
    const nextDb = drizzle(sqlite, { schema });
    if (sqliteInstance && sqliteInstance !== rootSqliteInstance) {
      sqliteInstance.close();
    }
    sqliteInstance = sqlite;
    dbInstance = nextDb;
    activePath = targetDbPath;
    activeProfileId = profileId;
    return { db: dbInstance, sqlite: sqliteInstance, dbPath: targetDbPath };
  } catch (error) {
    sqlite.close();
    throw new Error(
      `Failed to open workspace database for profile "${profileId}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export function deleteWorkspaceDatabaseFiles(profileId: string) {
  if (profileId === "default") {
    throw new Error("Cannot delete the primary default workspace database.");
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(profileId)) {
    throw new Error("Invalid profile identifier.");
  }
  if (activeProfileId === profileId) {
    switchWorkspaceDatabase("default");
  }
  const rootDir = path.dirname(getRootDatabasePath());
  const profileDir = path.join(rootDir, "profiles", profileId);
  if (fs.existsSync(profileDir)) {
    fs.rmSync(profileDir, { recursive: true, force: true });
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
  workspaceGeneration++;
  if (sqliteInstance && sqliteInstance !== rootSqliteInstance) {
    sqliteInstance.close();
  }
  rootSqliteInstance?.close();
  sqliteInstance = null;
  dbInstance = null;
  rootSqliteInstance = null;
  rootDbInstance = null;
  rootDbPath = null;
  activePath = null;
  activeProfileId = "default";
  activeCustomMigrations = null;
  startupError = null;
}
