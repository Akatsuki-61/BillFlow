import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const clients = sqliteTable("clients", {
  archivedAt: text("archived_at"),
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull().default("Enterprise"),
  contactPerson: text("contact_person").notNull(),
  contactRole: text("contact_role"),
  email: text("email").notNull(),
  phone: text("phone"),
  currency: text("currency", { enum: ["USD", "LKR", "EUR", "GBP", "CAD"] })
    .notNull()
    .default("USD"),
  driveUrl: text("drive_url"),
  whatsappPhone: text("whatsapp_phone"),
  relationshipNotes: text("relationship_notes"),
  billingAddress: text("billing_address"),
  photoData: text("photo_data"),
  hasQuickBill: integer("has_quick_bill", { mode: "boolean" })
    .notNull()
    .default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    clientId: text("client_id").references(() => clients.id, {
      onDelete: "restrict",
    }),
    catalogItemId: text("catalog_item_id").references(() => catalogItems.id, {
      onDelete: "set null",
    }),
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
    status: text("status", {
      enum: ["DRAFT", "UNPAID", "ADVANCE_PAID", "PAID", "OVERDUE"],
    })
      .notNull()
      .default("UNPAID"),
    paidCents: integer("paid_cents").notNull().default(0),
    trashedAt: text("trashed_at"),
    workflowStage: text("workflow_stage", {
      enum: ["SENT", "WORK_CONFIRMED", "DELIVERED"],
    }),
    paymentUrl: text("payment_url"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    index("invoices_client_id_idx").on(table.clientId),
    index("invoices_catalog_item_id_idx").on(table.catalogItemId),
    index("invoices_trashed_at_idx").on(table.trashedAt),
    index("invoices_status_trashed_idx").on(table.trashedAt, table.status),
  ],
);

export const catalogItems = sqliteTable("catalog_items", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category", {
    enum: ["Development", "Design", "Consulting", "Licensing"],
  })
    .notNull()
    .default("Development"),
  sku: text("sku").notNull().unique(),
  description: text("description").notNull().default(""),
  priceCents: integer("price_cents").notNull().default(0),
  currency: text("currency", { enum: ["USD", "LKR", "EUR", "GBP", "CAD"] })
    .notNull()
    .default("LKR"),
  unit: text("unit").notNull().default("/ Hourly"),
  iconType: text("icon_type", {
    enum: ["code", "design", "cloud", "consulting"],
  })
    .notNull()
    .default("code"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const appSetup = sqliteTable("app_setup", {
  id: integer("id").primaryKey(),
  permissionsPending: integer("permissions_pending", { mode: "boolean" }).notNull().default(true),
  notificationsEnabled: integer("notifications_enabled", { mode: "boolean" }).notNull().default(false),
  calendarConnected: integer("calendar_connected", { mode: "boolean" }).notNull().default(false),
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
  defaultCurrency: text("default_currency", {
    enum: ["USD", "LKR", "EUR", "GBP", "CAD"],
  })
    .notNull()
    .default("USD"),
  invoicePrefix: text("invoice_prefix").notNull().default("INV-"),
  nextInvoiceSeq: integer("next_invoice_seq").notNull().default(1),
  defaultDueDays: integer("default_due_days").notNull().default(14),
  defaultTaxRate: integer("default_tax_rate").notNull().default(0),
  defaultNotes: text("default_notes"),
  defaultInvoiceTemplate: text("default_invoice_template").default(
    "geometric-teal",
  ),
  dateFormat: text("date_format").notNull().default("YYYY-MM-DD"),
  currencyDisplay: text("currency_display").notNull().default("symbol"),
  pdfExportDirectory: text("pdf_export_directory"),
  defaultDeliveryUrl: text("default_delivery_url"),
  signatureData: text("signature_data"),
  notificationPlacement: text("notification_placement"),
  typeface: text("typeface"),
  layoutDensity: text("layout_density"),
  digestEnabled: integer("digest_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  digestLastSentDate: text("digest_last_sent_date"),
  rollingBackupEnabled: integer("rolling_backup_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  rollingBackupDirectory: text("rolling_backup_directory"),
  rollingBackupRetention: integer("rolling_backup_retention")
    .notNull()
    .default(10),
  rollingBackupIntervalHours: integer("rolling_backup_interval_hours")
    .notNull()
    .default(24),
  rollingBackupLastAt: text("rolling_backup_last_at"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const vendors = sqliteTable(
  "vendors",
  {
    archivedAt: text("archived_at"),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    service: text("service").notNull(),
    balanceCents: integer("balance_cents").notNull().default(0),
    status: text("status", { enum: ["PENDING", "PAID"] })
      .notNull()
      .default("PENDING"),
    iconType: text("icon_type", {
      enum: ["design", "devops", "legal", "development"],
    })
      .notNull()
      .default("devops"),
    email: text("email"),
    phone: text("phone"),
    linkedClientId: text("linked_client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    linkedClientName: text("linked_client_name"),
    payoutDueDate: text("payout_due_date"),
    notes: text("notes"),
    billingAddress: text("billing_address"),
    photoData: text("photo_data"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [index("vendors_linked_client_id_idx").on(table.linkedClientId)],
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

export const invoiceItems = sqliteTable(
  "invoice_items",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    catalogId: text("catalog_id").references(() => catalogServices.id, {
      onDelete: "set null",
    }),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPriceCents: integer("unit_price_cents").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    uniqueIndex("invoice_items_order").on(t.invoiceId, t.position),
    index("invoice_items_catalog_id_idx").on(t.catalogId),
    check("item_amount", sql`${t.quantity} > 0 AND ${t.unitPriceCents} >= 0`),
  ],
);

export const invoicePayments = sqliteTable(
  "invoice_payments",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    receivedAt: text("received_at").notNull(),
    reference: text("reference").notNull().default(""),
    requestId: text("request_id").notNull().unique(),
  },
  (t) => [
    check("payment_amount", sql`${t.amountCents} > 0`),
    index("invoice_payments_invoice_idx").on(t.invoiceId),
  ],
);

export const invoicePaymentCorrections = sqliteTable(
  "invoice_payment_corrections",
  {
    originalPaymentId: text("original_payment_id")
      .primaryKey()
      .notNull()
      .references(() => invoicePayments.id, { onDelete: "restrict" }),
    replacementPaymentId: text("replacement_payment_id")
      .unique()
      .references(() => invoicePayments.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    correctedAt: text("corrected_at").notNull(),
  },
  (t) => [
    check(
      "payment_correction_reason",
      sql`length(trim(${t.reason})) BETWEEN 1 AND 500`,
    ),
    check(
      "payment_correction_replacement",
      sql`${t.originalPaymentId} IS NOT ${t.replacementPaymentId}`,
    ),
  ],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    requestHash: text("request_hash"),
    invoiceItemId: text("invoice_item_id")
      .references(() => invoiceItems.id, { onDelete: "restrict" })
      .unique(),
    invoiceId: text("invoice_id").references(() => invoices.id, {
      onDelete: "restrict",
    }),
    clientId: text("client_id").references(() => clients.id, {
      onDelete: "restrict",
    }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status", { enum: ["todo", "in-progress", "review", "done"] })
      .notNull()
      .default("todo"),
    priority: text("priority", { enum: ["low", "medium", "high", "urgent"] })
      .notNull()
      .default("medium"),
    category: text("category").notNull().default("Development"),
    assignee: text("assignee", { mode: "json" })
      .$type<import("../../src/types/tasks").TaskAssignee>()
      .notNull(),
    dueDate: text("due_date").notNull().default(""),
    clientName: text("client_name"),
    deliveryUrl: text("delivery_url"),
    isOutsourced: integer("is_outsourced", { mode: "boolean" })
      .notNull()
      .default(false),
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
    boardPosition: integer("board_position"),
    deletionToken: text("deletion_token"),
    deletedEventIds: text("deleted_event_ids"),
  },
  (t) => [
    index("tasks_invoice_id_idx").on(t.invoiceId),
    index("tasks_client_id_idx").on(t.clientId),
    index("tasks_deleted_status_idx").on(t.deletedAt, t.status),
  ],
);

export const subtasks = sqliteTable(
  "subtasks",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    completed: integer("completed", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => [index("subtasks_task_idx").on(t.taskId)],
);

export const taskHistory = sqliteTable(
  "task_history",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    occurredAt: text("occurred_at").notNull(),
  },
  (t) => [index("task_history_task_id_idx").on(t.taskId)],
);

export const expenses = sqliteTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id").references(() => invoices.id, {
      onDelete: "restrict",
    }),
    merchant: text("merchant").notNull().default(""),
    description: text("description").notNull().default(""),
    category: text("category").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    incurredAt: text("incurred_at").notNull(),
    deductible: integer("deductible", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [
    check("expense_amount", sql`${t.amountCents} >= 0`),
    index("expenses_invoice_id_idx").on(t.invoiceId),
    index("expenses_incurred_at_idx").on(t.incurredAt),
  ],
);

export const workOrders = sqliteTable(
  "work_orders",
  {
    id: text("id").primaryKey(),
    vendorId: text("vendor_id").references(() => vendors.id, {
      onDelete: "restrict",
    }),
    taskId: text("task_id").references(() => tasks.id, {
      onDelete: "restrict",
    }),
    invoiceId: text("invoice_id").references(() => invoices.id, {
      onDelete: "restrict",
    }),
    scope: text("scope").notNull(),
    payoutDueDate: text("payout_due_date"),
    feeCents: integer("fee_cents").notNull(),
    currency: text("currency").notNull(),
    dueDate: text("due_date"),
    status: text("status").notNull().default("todo"),
    completedAt: text("completed_at"),
    deliveryUrl: text("delivery_url"),
    notes: text("notes"),
    createdAt: text("created_at"),
    vendorSnapshot: text("vendor_snapshot", { mode: "json" }).$type<
      import("../../src/types/outsourcing").PayableVendor
    >(),
    items: text("items", { mode: "json" }).$type<
      import("../../src/types/outsourcing").PayableItem[]
    >(),
    discountCents: integer("discount_cents").notNull().default(0),
    paypalUrl: text("paypal_url"),
    stripeUrl: text("stripe_url"),
  },
  (t) => [
    check("work_order_amount", sql`${t.feeCents} >= 0`),
    check(
      "work_order_source",
      sql`${t.invoiceId} IS NULL OR ${t.taskId} IS NOT NULL`,
    ),
    check(
      "work_order_vendor",
      sql`${t.vendorId} IS NOT NULL OR ${t.vendorSnapshot} IS NOT NULL`,
    ),
    check("work_order_discount", sql`${t.discountCents} >= 0`),
    index("work_orders_vendor_id_idx").on(t.vendorId),
    index("work_orders_task_id_idx").on(t.taskId),
    index("work_orders_invoice_idx").on(t.invoiceId),
  ],
);

export const vendorPayouts = sqliteTable(
  "vendor_payouts",
  {
    id: text("id").primaryKey(),
    workOrderId: text("work_order_id")
      .notNull()
      .references(() => workOrders.id, { onDelete: "restrict" }),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    paidAt: text("paid_at").notNull(),
    voidedAt: text("voided_at"),
    requestId: text("request_id").notNull().unique(),
  },
  (t) => [
    check("payout_amount", sql`${t.amountCents} > 0`),
    index("vendor_payouts_work_order_idx").on(t.workOrderId),
  ],
);

export const attachments = sqliteTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    paymentId: text("payment_id").references(() => invoicePayments.id, {
      onDelete: "restrict",
    }),
    expenseId: text("expense_id").references(() => expenses.id, {
      onDelete: "restrict",
    }),
    payoutId: text("payout_id").references(() => vendorPayouts.id, {
      onDelete: "restrict",
    }),
    originalName: text("original_name").notNull(),
    storedName: text("stored_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    check(
      "attachment_one_owner",
      sql`(${t.paymentId} IS NOT NULL) + (${t.expenseId} IS NOT NULL) + (${t.payoutId} IS NOT NULL) = 1`,
    ),
    index("attachments_payment_id_idx").on(t.paymentId),
    index("attachments_expense_idx").on(t.expenseId),
    index("attachments_payout_id_idx").on(t.payoutId),
  ],
);

export const invoicePdfExports = sqliteTable("invoice_pdf_exports", {
  invoiceId: text("invoice_id")
    .primaryKey()
    .references(() => invoices.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  exportedAt: text("exported_at").notNull(),
});

export const userProfiles = sqliteTable("user_profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull().default("software-engineering"),
  subtitle: text("subtitle").notNull().default("Full-Stack & Systems"),
  avatar: text("avatar").notNull().default("code"),
  photoData: text("photo_data"),
  accent: text("accent").notNull().default("blue"),
  themePreference: text("theme_preference").notNull().default("system"),
  defaultCurrency: text("default_currency", {
    enum: ["USD", "LKR", "EUR", "GBP", "CAD"],
  })
    .notNull()
    .default("USD"),
  invoicePrefix: text("invoice_prefix").notNull().default("SE-"),
  passwordHash: text("password_hash"),
  passwordSalt: text("password_salt"),
  passwordHint: text("password_hint"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
  isOnboarded: integer("is_onboarded", { mode: "boolean" })
    .notNull()
    .default(false),
  position: integer("position").notNull().default(0),
  lastActiveAt: text("last_active_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export type UserProfileRow = typeof userProfiles.$inferSelect;
export type InsertUserProfileRow = typeof userProfiles.$inferInsert;
export const calendarEvents = sqliteTable(
  "calendar_events",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    startDate: text("start_date").notNull(),
    endDate: text("end_date"),
    startTime: text("start_time"),
    endTime: text("end_time"),
    isAllDay: integer("is_all_day", { mode: "boolean" })
      .notNull()
      .default(false),
    category: text("category").notNull().default("general"),
    color: text("color").notNull().default("blue"),
    clientId: text("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    clientName: text("client_name"),
    taskId: text("task_id").references(() => tasks.id, {
      onDelete: "set null",
    }),
    taskTitle: text("task_title"),
    location: text("location"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [
    index("calendar_events_client_id_idx").on(t.clientId),
    index("calendar_events_task_id_idx").on(t.taskId),
    index("calendar_events_start_date_idx").on(t.startDate),
  ],
);

export const workOrderPdfExports = sqliteTable("work_order_pdf_exports", {
  workOrderId: text("work_order_id")
    .primaryKey()
    .references(() => workOrders.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  exportedAt: text("exported_at").notNull(),
});
export const taskTimeSlots = sqliteTable("task_time_slots", {
  taskId: text("task_id")
    .primaryKey()
    .references(() => tasks.id, { onDelete: "cascade" }),
  startTime: text("start_time"),
  endTime: text("end_time"),
  updatedAt: text("updated_at").notNull(),
});

export const recurringRules = sqliteTable(
  "recurring_rules",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    cadence: text("cadence", {
      enum: ["weekly", "biweekly", "monthly", "quarterly", "yearly"],
    })
      .notNull()
      .default("monthly"),
    dayOfMonth: integer("day_of_month"),
    currency: text("currency", { enum: ["USD", "LKR", "EUR", "GBP", "CAD"] })
      .notNull()
      .default("USD"),
    itemsJson: text("items_json").notNull(),
    discountCents: integer("discount_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    advanceCents: integer("advance_cents").notNull().default(0),
    amountCents: integer("amount_cents").notNull(),
    dueDays: integer("due_days").notNull().default(14),
    autoStatus: text("auto_status", { enum: ["DRAFT", "UNPAID"] })
      .notNull()
      .default("DRAFT"),
    autoExportPdf: integer("auto_export_pdf", { mode: "boolean" })
      .notNull()
      .default(true),
    notes: text("notes"),
    deliveryUrl: text("delivery_url"),
    paymentUrl: text("payment_url"),
    template: text("template"),
    nextRunDate: text("next_run_date").notNull(),
    lastRunDate: text("last_run_date"),
    lastInvoiceId: text("last_invoice_id").references(() => invoices.id, {
      onDelete: "set null",
    }),
    isActive: integer("is_active", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [
    index("recurring_rules_client_id_idx").on(t.clientId),
    index("recurring_rules_active_next_idx").on(t.isActive, t.nextRunDate),
  ],
);

export const quotes = sqliteTable(
  "quotes",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    clientId: text("client_id").references(() => clients.id, {
      onDelete: "restrict",
    }),
    clientSnapshot: text("client_snapshot"),
    businessSnapshot: text("business_snapshot"),
    title: text("title"),
    currency: text("currency", { enum: ["USD", "LKR", "EUR", "GBP", "CAD"] })
      .notNull()
      .default("USD"),
    discountCents: integer("discount_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    advanceCents: integer("advance_cents").notNull().default(0),
    amountCents: integer("amount_cents").notNull(),
    issueDate: text("issue_date").notNull(),
    validUntil: text("valid_until"),
    status: text("status", {
      enum: ["DRAFT", "SENT", "APPROVED", "DECLINED", "CONVERTED"],
    })
      .notNull()
      .default("DRAFT"),
    template: text("template"),
    deliveryUrl: text("delivery_url"),
    notes: text("notes"),
    convertedInvoiceId: text("converted_invoice_id")
      .unique()
      .references(() => invoices.id, { onDelete: "set null" }),
    convertedAt: text("converted_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [
    index("quotes_client_id_idx").on(t.clientId),
    index("quotes_status_idx").on(t.status),
  ],
);

export const quoteItems = sqliteTable(
  "quote_items",
  {
    id: text("id").primaryKey(),
    quoteId: text("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    catalogId: text("catalog_id").references(() => catalogItems.id, {
      onDelete: "set null",
    }),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPriceCents: integer("unit_price_cents").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("quote_items_quote_id_idx").on(t.quoteId)],
);
