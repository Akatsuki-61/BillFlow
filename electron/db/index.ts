import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import fs from "fs";
import * as schema from "./schema";

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqliteInstance: Database.Database | null = null;

function getElectronApp() {
  try {
    if (typeof process !== "undefined" && (process.versions as Record<string, string>)?.electron) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require("electron").app;
    }
  } catch {}
  return null;
}

export function getDatabasePath(): string {
  try {
    const electronApp = getElectronApp();
    const userData = electronApp?.getPath ? electronApp.getPath("userData") : path.join(process.cwd(), ".billflow-dev");
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

  const electronApp = getElectronApp();

  // Run migrations
  try {
    const candidatePaths = [
      electronApp?.isPackaged ? path.join(process.resourcesPath, "drizzle") : "",
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

  // Ensure all tables and columns exist
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS \`clients\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`name\` text NOT NULL,
        \`category\` text DEFAULT 'Enterprise' NOT NULL,
        \`contact_person\` text NOT NULL,
        \`contact_role\` text,
        \`email\` text NOT NULL,
        \`phone\` text,
        \`currency\` text DEFAULT 'USD' NOT NULL,
        \`drive_url\` text,
        \`has_quick_bill\` integer DEFAULT 1 NOT NULL,
        \`created_at\` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
        \`updated_at\` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS \`invoices\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`code\` text NOT NULL,
        \`client_id\` text NOT NULL,
        \`catalog_item_id\` text,
        \`title\` text,
        \`amount_cents\` integer NOT NULL,
        \`currency\` text DEFAULT 'USD' NOT NULL,
        \`issue_date\` text NOT NULL,
        \`due_date\` text,
        \`status\` text DEFAULT 'UNPAID' NOT NULL,
        \`paid_cents\` integer DEFAULT 0 NOT NULL,
        \`created_at\` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
        \`updated_at\` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
        FOREIGN KEY (\`client_id\`) REFERENCES \`clients\`(\`id\`) ON UPDATE no action ON DELETE restrict
      );

      CREATE TABLE IF NOT EXISTS \`settings\` (
        \`id\` text PRIMARY KEY DEFAULT 'default' NOT NULL,
        \`business_name\` text DEFAULT '' NOT NULL,
        \`professional_title\` text,
        \`email\` text DEFAULT '' NOT NULL,
        \`phone\` text,
        \`website\` text,
        \`tax_id\` text,
        \`address\` text,
        \`payment_details\` text,
        \`default_currency\` text DEFAULT 'USD' NOT NULL,
        \`invoice_prefix\` text DEFAULT 'INV-' NOT NULL,
        \`next_invoice_seq\` integer DEFAULT 1 NOT NULL,
        \`default_due_days\` integer DEFAULT 14 NOT NULL,
        \`default_tax_rate\` integer DEFAULT 0 NOT NULL,
        \`default_notes\` text,
        \`date_format\` text DEFAULT 'YYYY-MM-DD' NOT NULL,
        \`currency_display\` text DEFAULT 'symbol' NOT NULL,
        \`updated_at\` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS \`catalog_items\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`title\` text NOT NULL,
        \`category\` text DEFAULT 'Development' NOT NULL,
        \`sku\` text NOT NULL UNIQUE,
        \`description\` text DEFAULT '' NOT NULL,
        \`price\` text DEFAULT '0' NOT NULL,
        \`currency\` text DEFAULT 'LKR' NOT NULL,
        \`unit\` text DEFAULT '/ Hourly' NOT NULL,
        \`icon_type\` text DEFAULT 'code' NOT NULL,
        \`created_at\` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
        \`updated_at\` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
      );
    `);

    try {
      sqlite.exec("ALTER TABLE `invoices` ADD COLUMN `catalog_item_id` text;");
    } catch {
      // column already exists
    }
  } catch (err) {
    console.error("Schema setup notice:", err);
  }

  try {
    const clientCount = sqlite.prepare("SELECT COUNT(*) as count FROM clients").get() as { count: number } | undefined;
    if (clientCount && clientCount.count === 0) {
      const insertClient = sqlite.prepare(`
        INSERT INTO clients (id, name, category, contact_person, contact_role, email, phone, currency, drive_url, has_quick_bill)
        VALUES (@id, @name, @category, @contactPerson, @contactRole, @email, @phone, @currency, @driveUrl, @hasQuickBill)
      `);
      insertClient.run({
        id: "cli-acorn",
        name: "Acorn Global Logistics",
        category: "Enterprise",
        contactPerson: "Harold Sterling",
        contactRole: "Director",
        email: "harold@acornglobal.com",
        phone: "+1 (555) 234-5678",
        currency: "LKR",
        driveUrl: null,
        hasQuickBill: 1,
      });
      insertClient.run({
        id: "cli-apex",
        name: "Apex Digital Solutions",
        category: "Corporate",
        contactPerson: "Peter Vance",
        contactRole: "Lead Consultant",
        email: "peter@apexdigital.com",
        phone: "+1 (555) 345-6789",
        currency: "LKR",
        driveUrl: null,
        hasQuickBill: 1,
      });
      insertClient.run({
        id: "cli-sterling",
        name: "Sterling Financial Technologies",
        category: "Enterprise",
        contactPerson: "Anthony Miller",
        contactRole: "Managing Director",
        email: "anthony@sterlingfintech.com",
        phone: "+1 (555) 999-0000",
        currency: "LKR",
        driveUrl: null,
        hasQuickBill: 1,
      });
      insertClient.run({
        id: "cli-vanguard",
        name: "Vanguard Global Advisory",
        category: "Corporate",
        contactPerson: "Benjamin Walker",
        contactRole: "Operations Director",
        email: "benjamin@vanguardadvisory.com",
        phone: "+1 (555) 123-4567",
        currency: "LKR",
        driveUrl: null,
        hasQuickBill: 1,
      });
    }

    const count = sqlite.prepare("SELECT COUNT(*) as count FROM catalog_items").get() as { count: number } | undefined;
    if (count && count.count === 0) {
      const insert = sqlite.prepare(`
        INSERT INTO catalog_items (id, title, category, sku, description, price, currency, unit, icon_type)
        VALUES (@id, @title, @category, @sku, @description, @price, @currency, @unit, @iconType)
      `);

      const initialItems = [
        {
          id: "cat-1",
          title: "Senior Full-Stack Development",
          category: "Development",
          sku: "DEV-001",
          description: "Architecture design, API implementation, and frontend React development.",
          price: "45000.00",
          currency: "LKR",
          unit: "/ Hourly",
          iconType: "code",
        },
        {
          id: "cat-2",
          title: "UI/UX Design Sprint",
          category: "Design",
          sku: "DES-042",
          description: "Comprehensive wireframing, high-fidelity prototyping, and user testing sessions.",
          price: "360000.00",
          currency: "LKR",
          unit: "/ Daily",
          iconType: "design",
        },
        {
          id: "cat-3",
          title: "Enterprise Server License",
          category: "Licensing",
          sku: "LIC-991",
          description: "Annual license for self-hosted enterprise infrastructure deployment.",
          price: "1500000.00",
          currency: "LKR",
          unit: "/ Unit",
          iconType: "cloud",
        },
        {
          id: "cat-4",
          title: "Cloud Architecture Audit",
          category: "Consulting",
          sku: "CONS-012",
          description: "Security assessment, Docker containerization, and AWS database review.",
          price: "60000.00",
          currency: "LKR",
          unit: "/ Project",
          iconType: "consulting",
        },
      ];

      for (const item of initialItems) {
        insert.run(item);
      }
    }

    const invoiceCount = sqlite.prepare("SELECT COUNT(*) as count FROM invoices").get() as { count: number } | undefined;
    if (invoiceCount && invoiceCount.count === 0) {
      const insertInvoice = sqlite.prepare(`
        INSERT INTO invoices (id, code, client_id, catalog_item_id, title, amount_cents, currency, issue_date, due_date, status, paid_cents)
        VALUES (@id, @code, @clientId, @catalogItemId, @title, @amountCents, @currency, @issueDate, @dueDate, @status, @paidCents)
      `);
      insertInvoice.run({
        id: "inv-acorn-01",
        code: "INV-2023-089",
        clientId: "cli-acorn",
        catalogItemId: "cat-1",
        title: "Senior Full-Stack Development",
        amountCents: 1245000,
        currency: "LKR",
        issueDate: "2023-10-01",
        dueDate: "2023-10-12",
        status: "OVERDUE",
        paidCents: 0,
      });
      insertInvoice.run({
        id: "inv-apex-01",
        code: "INV-2023-090",
        clientId: "cli-apex",
        catalogItemId: "cat-2",
        title: "UI/UX Design Sprint",
        amountCents: 420050,
        currency: "LKR",
        issueDate: "2023-10-14",
        dueDate: "2023-10-28",
        status: "UNPAID",
        paidCents: 0,
      });
      insertInvoice.run({
        id: "inv-sterling-01",
        code: "INV-2023-085",
        clientId: "cli-sterling",
        catalogItemId: "cat-3",
        title: "Enterprise Server License",
        amountCents: 8500000,
        currency: "LKR",
        issueDate: "2023-10-01",
        dueDate: "2023-10-15",
        status: "PAID",
        paidCents: 8500000,
      });
      insertInvoice.run({
        id: "inv-vanguard-01",
        code: "Draft",
        clientId: "cli-vanguard",
        catalogItemId: "cat-4",
        title: "Cloud Architecture Audit",
        amountCents: 150000,
        currency: "LKR",
        issueDate: "2023-10-20",
        dueDate: null,
        status: "DRAFT",
        paidCents: 0,
      });
    }
  } catch (err) {
    console.error("Database seeding notice:", err);
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

