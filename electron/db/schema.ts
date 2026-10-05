import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull().default("Enterprise"),
  contactPerson: text("contact_person").notNull(),
  contactRole: text("contact_role"),
  email: text("email").notNull(),
  phone: text("phone"),
  currency: text("currency", { enum: ["USD", "LKR", "EUR", "GBP", "CAD"] }).notNull().default("USD"),
  driveUrl: text("drive_url"),
  hasQuickBill: integer("has_quick_bill", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    catalogItemId: text("catalog_item_id").references(() => catalogItems.id, { onDelete: "set null" }),
    requestHash: text("request_hash"),
    title: text("title"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency", { enum: ["USD", "LKR", "EUR", "GBP", "CAD"] })
      .notNull()
      .default("USD"),
    issueDate: text("issue_date").notNull(),
    dueDate: text("due_date"),
    status: text("status", { enum: ["DRAFT", "UNPAID", "PAID", "OVERDUE"] })
      .notNull()
      .default("UNPAID"),
    paidCents: integer("paid_cents").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    index("invoices_client_id_idx").on(table.clientId),
  ]
);

export const catalogItems = sqliteTable("catalog_items", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category", { enum: ["Development", "Design", "Consulting", "Licensing"] })
    .notNull()
    .default("Development"),
  sku: text("sku").notNull().unique(),
  description: text("description").notNull().default(""),
  priceCents: integer("price_cents").notNull().default(0),
  currency: text("currency", { enum: ["USD", "LKR", "EUR", "GBP", "CAD"] })
    .notNull()
    .default("LKR"),
  unit: text("unit").notNull().default("/ Hourly"),
  iconType: text("icon_type", { enum: ["code", "design", "cloud", "consulting"] })
    .notNull()
    .default("code"),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export const settings = sqliteTable("settings", {
  id: text("id").primaryKey().default("default"),
  businessName: text("business_name").notNull().default(""),
  professionalTitle: text("professional_title"),
  email: text("email").notNull().default(""),
  phone: text("phone"),
  website: text("website"),
  taxId: text("tax_id"),
  address: text("address"),
  paymentDetails: text("payment_details"),
  defaultCurrency: text("default_currency", { enum: ["USD", "LKR", "EUR", "GBP", "CAD"] })
    .notNull()
    .default("USD"),
  invoicePrefix: text("invoice_prefix").notNull().default("INV-"),
  nextInvoiceSeq: integer("next_invoice_seq").notNull().default(1),
  defaultDueDays: integer("default_due_days").notNull().default(14),
  defaultTaxRate: integer("default_tax_rate").notNull().default(0),
  defaultNotes: text("default_notes"),
  dateFormat: text("date_format").notNull().default("YYYY-MM-DD"),
  currencyDisplay: text("currency_display").notNull().default("symbol"),
  updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export const vendors = sqliteTable(
  "vendors",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    service: text("service").notNull(),
    balanceCents: integer("balance_cents").notNull().default(0),
    status: text("status", { enum: ["PENDING", "PAID"] }).notNull().default("PENDING"),
    iconType: text("icon_type", { enum: ["design", "devops", "legal", "development"] })
      .notNull()
      .default("devops"),
    email: text("email"),
    phone: text("phone"),
    linkedClientId: text("linked_client_id").references(() => clients.id, { onDelete: "set null" }),
    linkedClientName: text("linked_client_name"),
    payoutDueDate: text("payout_due_date"),
    notes: text("notes"),
    createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    index("vendors_linked_client_id_idx").on(table.linkedClientId),
  ]
);

export type ClientRow = typeof clients.$inferSelect;
export type InsertClientRow = typeof clients.$inferInsert;
export type InvoiceRow = typeof invoices.$inferSelect;
export type InsertInvoiceRow = typeof invoices.$inferInsert;
export type CatalogItemRow = typeof catalogItems.$inferSelect;
export type InsertCatalogItemRow = typeof catalogItems.$inferInsert;
export type SettingRow = typeof settings.$inferSelect;
export type InsertSettingRow = typeof settings.$inferInsert;
export type VendorRow = typeof vendors.$inferSelect;
export type InsertVendorRow = typeof vendors.$inferInsert;

