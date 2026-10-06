import { sqliteTable, text, integer, index, uniqueIndex, check } from "drizzle-orm/sqlite-core";
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
      .references(() => clients.id, { onDelete: "restrict" }),
    catalogItemId: text("catalog_item_id").references(() => catalogItems.id, { onDelete: "set null" }),
    requestHash: text("request_hash"),
    title: text("title"),
    clientSnapshot: text("client_snapshot"),
    businessSnapshot: text("business_snapshot"),
    deliveryUrl: text("delivery_url"),
    notes: text("notes"),
    discountCents: integer("discount_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    advanceCents: integer("advance_cents").notNull().default(0),
    trackingEligibleAt: text("tracking_eligible_at"),
    trackingChoice: text("tracking_choice", { enum: ["yes", "no"] }),
    trackingDecidedAt: text("tracking_decided_at"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency", { enum: ["USD", "LKR", "EUR", "GBP", "CAD"] })
      .notNull()
      .default("USD"),
    issueDate: text("issue_date").notNull(),
    dueDate: text("due_date"),
    status: text("status", { enum: ["DRAFT", "UNPAID", "ADVANCE_PAID", "PAID", "OVERDUE"] })
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
  pdfExportDirectory: text("pdf_export_directory"),
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


// Shared workflow contracts. Domain UI/API owners extend these same tables.
export const catalogServices = sqliteTable("catalog_services", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  unitPriceCents: integer("unit_price_cents").notNull(),
  currency: text("currency").notNull(),
  category: text("category").notNull().default("Development"),
});

export const invoiceItems = sqliteTable("invoice_items", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  catalogId: text("catalog_id").references(() => catalogServices.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPriceCents: integer("unit_price_cents").notNull(),
  position: integer("position").notNull().default(0),
}, t => [uniqueIndex("invoice_items_order").on(t.invoiceId, t.position), check("item_amount", sql`${t.quantity} > 0 AND ${t.unitPriceCents} >= 0`)]);

export const invoicePayments = sqliteTable("invoice_payments", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").notNull().references(() => invoices.id, { onDelete: "restrict" }),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull(),
  receivedAt: text("received_at").notNull(),
  reference: text("reference").notNull().default(""),
  requestId: text("request_id").notNull().unique(),
}, t => [check("payment_amount", sql`${t.amountCents} > 0`)]);

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  requestHash: text("request_hash"),
  invoiceItemId: text("invoice_item_id").references(() => invoiceItems.id, { onDelete: "restrict" }).unique(),
  invoiceId: text("invoice_id").references(() => invoices.id, { onDelete: "restrict" }),
  clientId: text("client_id").references(() => clients.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  status: text("status", { enum: ["todo", "in-progress", "review", "done"] }).notNull().default("todo"),
  priority: text("priority", { enum: ["low", "medium", "high", "urgent"] }).notNull().default("medium"),
  category: text("category").notNull().default("Development"),
  assignee: text("assignee", { mode: "json" }).$type<import("../../src/types/tasks").TaskAssignee>().notNull(),
  dueDate: text("due_date").notNull().default(""),
  clientName: text("client_name"),
  deliveryUrl: text("delivery_url"),
  isOutsourced: integer("is_outsourced", { mode: "boolean" }).notNull().default(false),
  outsourcedVendor: text("outsourced_vendor"),
  outsourceBudgetCents: integer("outsource_budget"), // contractor amount in minor units
  currency: text("currency").notNull().default("LKR"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  activeSince: text("active_since"),
  activeMilliseconds: integer("active_milliseconds").notNull().default(0),
  deletedAt: text("deleted_at"), // retain generated-item uniqueness after deletion
});

export const subtasks = sqliteTable("subtasks", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
});

export const taskHistory = sqliteTable("task_history", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  occurredAt: text("occurred_at").notNull(),
});

export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").references(() => invoices.id, { onDelete: "restrict" }),
  description: text("description").notNull(),
  category: text("category").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull(),
  incurredAt: text("incurred_at").notNull(),
}, t => [check("expense_amount", sql`${t.amountCents} >= 0`)]);

export const workOrders = sqliteTable("work_orders", {
  id: text("id").primaryKey(),
  vendorId: text("vendor_id").notNull().references(() => vendors.id, { onDelete: "restrict" }),
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "restrict" }),
  invoiceId: text("invoice_id").notNull().references(() => invoices.id, { onDelete: "restrict" }),
  scope: text("scope").notNull(),
  feeCents: integer("fee_cents").notNull(),
  currency: text("currency").notNull(),
  dueDate: text("due_date"),
  status: text("status").notNull().default("todo"),
  completedAt: text("completed_at"),
  deliveryUrl: text("delivery_url"),
  notes: text("notes"),
}, t => [check("work_order_amount", sql`${t.feeCents} >= 0`)]);

export const vendorPayouts = sqliteTable("vendor_payouts", {
  id: text("id").primaryKey(),
  workOrderId: text("work_order_id").notNull().references(() => workOrders.id, { onDelete: "restrict" }),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull(),
  paidAt: text("paid_at").notNull(),
  requestId: text("request_id").notNull().unique(),
}, t => [check("payout_amount", sql`${t.amountCents} > 0`)]);

export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  paymentId: text("payment_id").references(() => invoicePayments.id, { onDelete: "restrict" }),
  expenseId: text("expense_id").references(() => expenses.id, { onDelete: "restrict" }),
  payoutId: text("payout_id").references(() => vendorPayouts.id, { onDelete: "restrict" }),
  originalName: text("original_name").notNull(),
  storedName: text("stored_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  createdAt: text("created_at").notNull(),
}, t => [check("attachment_one_owner", sql`(${t.paymentId} IS NOT NULL) + (${t.expenseId} IS NOT NULL) + (${t.payoutId} IS NOT NULL) = 1`)]);

export const invoicePdfExports = sqliteTable("invoice_pdf_exports", {
  invoiceId: text("invoice_id").primaryKey().references(() => invoices.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  exportedAt: text("exported_at").notNull(),
});
