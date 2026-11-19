ALTER TABLE settings ADD COLUMN digest_enabled integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE settings ADD COLUMN digest_last_sent_date text;
--> statement-breakpoint
ALTER TABLE settings ADD COLUMN rolling_backup_enabled integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE settings ADD COLUMN rolling_backup_directory text;
--> statement-breakpoint
ALTER TABLE settings ADD COLUMN rolling_backup_retention integer NOT NULL DEFAULT 10;
--> statement-breakpoint
ALTER TABLE settings ADD COLUMN rolling_backup_interval_hours integer NOT NULL DEFAULT 24;
--> statement-breakpoint
ALTER TABLE settings ADD COLUMN rolling_backup_last_at text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recurring_rules" (
  "id" text PRIMARY KEY NOT NULL,
  "client_id" text NOT NULL REFERENCES "clients"("id") ON DELETE RESTRICT,
  "title" text NOT NULL,
  "cadence" text NOT NULL DEFAULT 'monthly' CHECK ("cadence" IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  "day_of_month" integer CHECK ("day_of_month" IS NULL OR ("day_of_month" >= 1 AND "day_of_month" <= 31)),
  "currency" text NOT NULL DEFAULT 'USD',
  "items_json" text NOT NULL,
  "discount_cents" integer NOT NULL DEFAULT 0,
  "tax_cents" integer NOT NULL DEFAULT 0,
  "advance_cents" integer NOT NULL DEFAULT 0,
  "amount_cents" integer NOT NULL CHECK ("amount_cents" >= 0 AND "discount_cents" >= 0 AND "tax_cents" >= 0 AND "advance_cents" >= 0 AND "advance_cents" <= "amount_cents"),
  "due_days" integer NOT NULL DEFAULT 14 CHECK ("due_days" >= 0 AND "due_days" <= 365),
  "auto_status" text NOT NULL DEFAULT 'DRAFT' CHECK ("auto_status" IN ('DRAFT', 'UNPAID')),
  "auto_export_pdf" integer NOT NULL DEFAULT 1,
  "notes" text,
  "delivery_url" text,
  "payment_url" text,
  "template" text,
  "next_run_date" text NOT NULL,
  "last_run_date" text,
  "last_invoice_id" text REFERENCES "invoices"("id") ON DELETE SET NULL,
  "is_active" integer NOT NULL DEFAULT 1,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
  "updated_at" text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recurring_rules_client_id_idx" ON "recurring_rules" ("client_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recurring_rules_active_next_idx" ON "recurring_rules" ("is_active", "next_run_date");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quotes" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL UNIQUE,
  "client_id" text REFERENCES "clients"("id") ON DELETE RESTRICT,
  "client_snapshot" text,
  "business_snapshot" text,
  "title" text,
  "currency" text NOT NULL DEFAULT 'USD',
  "discount_cents" integer NOT NULL DEFAULT 0,
  "tax_cents" integer NOT NULL DEFAULT 0,
  "advance_cents" integer NOT NULL DEFAULT 0,
  "amount_cents" integer NOT NULL CHECK ("amount_cents" >= 0 AND "discount_cents" >= 0 AND "tax_cents" >= 0 AND "advance_cents" >= 0 AND "advance_cents" <= "amount_cents"),
  "issue_date" text NOT NULL,
  "valid_until" text,
  "status" text NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT', 'SENT', 'APPROVED', 'DECLINED', 'CONVERTED')),
  "template" text,
  "delivery_url" text,
  "notes" text,
  "converted_invoice_id" text UNIQUE REFERENCES "invoices"("id") ON DELETE SET NULL,
  "converted_at" text,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
  "updated_at" text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
  CHECK ("client_id" IS NOT NULL OR "client_snapshot" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotes_client_id_idx" ON "quotes" ("client_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotes_status_idx" ON "quotes" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quote_items" (
  "id" text PRIMARY KEY NOT NULL,
  "quote_id" text NOT NULL REFERENCES "quotes"("id") ON DELETE CASCADE,
  "catalog_id" text REFERENCES "catalog_items"("id") ON DELETE SET NULL,
  "description" text NOT NULL,
  "quantity" integer NOT NULL DEFAULT 1 CHECK ("quantity" > 0),
  "unit_price_cents" integer NOT NULL CHECK ("unit_price_cents" >= 0),
  "position" integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quote_items_quote_id_idx" ON "quote_items" ("quote_id");
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS backup_revision_recurring_rules_insert AFTER INSERT ON recurring_rules
BEGIN UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1; END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS backup_revision_recurring_rules_update AFTER UPDATE ON recurring_rules
BEGIN UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1; END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS backup_revision_recurring_rules_delete AFTER DELETE ON recurring_rules
BEGIN UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1; END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS backup_revision_quotes_insert AFTER INSERT ON quotes
BEGIN UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1; END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS backup_revision_quotes_update AFTER UPDATE ON quotes
BEGIN UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1; END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS backup_revision_quotes_delete AFTER DELETE ON quotes
BEGIN UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1; END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS backup_revision_quote_items_insert AFTER INSERT ON quote_items
BEGIN UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1; END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS backup_revision_quote_items_update AFTER UPDATE ON quote_items
BEGIN UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1; END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS backup_revision_quote_items_delete AFTER DELETE ON quote_items
BEGIN UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1; END;
