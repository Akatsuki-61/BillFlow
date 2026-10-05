CREATE TABLE IF NOT EXISTS `vendors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`service` text NOT NULL,
	`balance_cents` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`icon_type` text DEFAULT 'devops' NOT NULL,
	`email` text,
	`phone` text,
	`linked_client_id` text,
	`linked_client_name` text,
	`payout_due_date` text,
	`notes` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`linked_client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `vendors_linked_client_id_idx` ON `vendors` (`linked_client_id`);

--> statement-breakpoint
CREATE TABLE `catalog_items_minor` (
 `id` text PRIMARY KEY NOT NULL,
 `title` text NOT NULL,
 `category` text DEFAULT 'Development' NOT NULL,
 `sku` text NOT NULL UNIQUE,
 `description` text DEFAULT '' NOT NULL,
 `price_cents` integer DEFAULT 0 NOT NULL CHECK (`price_cents` >= 0 AND typeof(`price_cents`) = 'integer'),
 `currency` text DEFAULT 'LKR' NOT NULL,
 `unit` text DEFAULT '/ Hourly' NOT NULL,
 `icon_type` text DEFAULT 'code' NOT NULL,
 `created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
 `updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
INSERT INTO `catalog_items_minor` SELECT id, title, category, sku, description, CAST(round(CAST(price AS REAL) * 100) AS INTEGER), currency, unit, icon_type, created_at, updated_at FROM `catalog_items`;
--> statement-breakpoint
DROP TABLE `catalog_items`;
--> statement-breakpoint
ALTER TABLE `catalog_items_minor` RENAME TO `catalog_items`;
--> statement-breakpoint
CREATE TABLE `invoices_catalog` (
 `id` text PRIMARY KEY NOT NULL,
 `code` text NOT NULL,
 `client_id` text NOT NULL REFERENCES `clients`(`id`) ON DELETE restrict,
 `catalog_item_id` text REFERENCES `catalog_items`(`id`) ON DELETE set null,
 `request_hash` text,
 `title` text,
 `amount_cents` integer NOT NULL,
 `currency` text DEFAULT 'USD' NOT NULL,
 `issue_date` text NOT NULL,
 `due_date` text,
 `status` text DEFAULT 'UNPAID' NOT NULL,
 `paid_cents` integer DEFAULT 0 NOT NULL,
 `created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
 `updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
INSERT INTO `invoices_catalog` (id,code,client_id,catalog_item_id,title,amount_cents,currency,issue_date,due_date,status,paid_cents,created_at,updated_at)
SELECT id,code,client_id,CASE WHEN catalog_item_id IN (SELECT id FROM catalog_items) THEN catalog_item_id ELSE NULL END,title,amount_cents,currency,issue_date,due_date,status,paid_cents,created_at,updated_at FROM invoices;
--> statement-breakpoint
DROP TABLE invoices;
--> statement-breakpoint
ALTER TABLE invoices_catalog RENAME TO invoices;
--> statement-breakpoint
CREATE UNIQUE INDEX invoices_code_unique ON invoices(code);
--> statement-breakpoint
CREATE INDEX invoices_client_id_idx ON invoices(client_id);
