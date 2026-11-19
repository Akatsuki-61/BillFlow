CREATE INDEX IF NOT EXISTS "invoices_catalog_item_id_idx" ON "invoices" ("catalog_item_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_status_trashed_idx" ON "invoices" ("trashed_at", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_items_catalog_id_idx" ON "invoice_items" ("catalog_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_invoice_id_idx" ON "tasks" ("invoice_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_client_id_idx" ON "tasks" ("client_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_deleted_status_idx" ON "tasks" ("deleted_at", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_history_task_id_idx" ON "task_history" ("task_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_invoice_id_idx" ON "expenses" ("invoice_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_incurred_at_idx" ON "expenses" ("incurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_orders_vendor_id_idx" ON "work_orders" ("vendor_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_orders_task_id_idx" ON "work_orders" ("task_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachments_payment_id_idx" ON "attachments" ("payment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachments_payout_id_idx" ON "attachments" ("payout_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_events_client_id_idx" ON "calendar_events" ("client_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_events_task_id_idx" ON "calendar_events" ("task_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_events_start_date_idx" ON "calendar_events" ("start_date");
