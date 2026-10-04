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

export type ClientRow = typeof clients.$inferSelect;
export type InsertClientRow = typeof clients.$inferInsert;
export type InvoiceRow = typeof invoices.$inferSelect;
export type InsertInvoiceRow = typeof invoices.$inferInsert;
