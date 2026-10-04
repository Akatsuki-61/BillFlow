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
  currency: text("currency", { enum: ["USD", "LKR", "EUR"] }).notNull().default("USD"),
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

export type ClientRow = typeof clients.$inferSelect;
export type InsertClientRow = typeof clients.$inferInsert;
export type InvoiceRow = typeof invoices.$inferSelect;
export type InsertInvoiceRow = typeof invoices.$inferInsert;
export type SettingRow = typeof settings.$inferSelect;
export type InsertSettingRow = typeof settings.$inferInsert;

