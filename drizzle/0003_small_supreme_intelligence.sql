CREATE TABLE `__new_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`client_id` text,
	`title` text,
	`client_snapshot` text,
	`business_snapshot` text,
	`delivery_url` text,
	`notes` text,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`tax_cents` integer DEFAULT 0 NOT NULL,
	`advance_cents` integer DEFAULT 0 NOT NULL,
	`tracking_eligible_at` text,
	`tracking_choice` text,
	`tracking_decided_at` text,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`issue_date` text NOT NULL,
	`due_date` text,
	`status` text DEFAULT 'UNPAID' NOT NULL,
	`paid_cents` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_invoices`("id", "code", "client_id", "title", "amount_cents", "currency", "issue_date", "due_date", "status", "paid_cents", "created_at", "updated_at", "client_snapshot", "delivery_url")
SELECT i."id", i."code", i."client_id", i."title", i."amount_cents", i."currency", i."issue_date", i."due_date", i."status", i."paid_cents", i."created_at", i."updated_at",
(SELECT json_object('name',c.name,'email',c.email,'contactPerson',c.contact_person,'phone',c.phone,'driveUrl',c.drive_url) FROM clients c WHERE c.id=i.client_id),
(SELECT c.drive_url FROM clients c WHERE c.id=i.client_id)
FROM invoices i;
--> statement-breakpoint
DROP TABLE `invoices`;--> statement-breakpoint
ALTER TABLE `__new_invoices` RENAME TO `invoices`;--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_code_unique` ON `invoices` (`code`);--> statement-breakpoint
CREATE INDEX `invoices_client_id_idx` ON `invoices` (`client_id`);--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_id` text,
	`expense_id` text,
	`payout_id` text,
	`original_name` text NOT NULL,
	`stored_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`payment_id`) REFERENCES `invoice_payments`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`payout_id`) REFERENCES `vendor_payouts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "attachment_one_owner" CHECK(("attachments"."payment_id" IS NOT NULL) + ("attachments"."expense_id" IS NOT NULL) + ("attachments"."payout_id" IS NOT NULL) = 1)
);
--> statement-breakpoint
CREATE TABLE `catalog_services` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`category` text DEFAULT 'Development' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`incurred_at` text NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "expense_amount" CHECK("expenses"."amount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`catalog_id` text,
	`description` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`catalog_id`) REFERENCES `catalog_services`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "item_amount" CHECK("invoice_items"."quantity" > 0 AND "invoice_items"."unit_price_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_items_order` ON `invoice_items` (`invoice_id`,`position`);--> statement-breakpoint
CREATE TABLE `invoice_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`received_at` text NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`request_id` text NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "payment_amount" CHECK("invoice_payments"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_payments_request_id_unique` ON `invoice_payments` (`request_id`);--> statement-breakpoint
CREATE TABLE `subtasks` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`title` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `task_history` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`occurred_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_item_id` text,
	`invoice_id` text,
	`client_id` text,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`category` text DEFAULT 'Development' NOT NULL,
	`assignee` text NOT NULL,
	`due_date` text DEFAULT '' NOT NULL,
	`client_name` text,
	`delivery_url` text,
	`is_outsourced` integer DEFAULT false NOT NULL,
	`outsourced_vendor` text,
	`outsource_budget` integer,
	`currency` text DEFAULT 'LKR' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`started_at` text,
	`completed_at` text,
	`active_since` text,
	`active_milliseconds` integer DEFAULT 0 NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`invoice_item_id`) REFERENCES `invoice_items`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_invoice_item_id_unique` ON `tasks` (`invoice_item_id`);--> statement-breakpoint
CREATE TABLE `vendor_payouts` (
	`id` text PRIMARY KEY NOT NULL,
	`work_order_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`paid_at` text NOT NULL,
	`request_id` text NOT NULL,
	FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "payout_amount" CHECK("vendor_payouts"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vendor_payouts_request_id_unique` ON `vendor_payouts` (`request_id`);--> statement-breakpoint
CREATE TABLE `work_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor_id` text NOT NULL,
	`task_id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`scope` text NOT NULL,
	`fee_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`due_date` text,
	`status` text DEFAULT 'todo' NOT NULL,
	`completed_at` text,
	`delivery_url` text,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "work_order_amount" CHECK("work_orders"."fee_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE `settings` ADD `pdf_export_directory` text;