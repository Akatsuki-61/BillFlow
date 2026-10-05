CREATE TABLE `catalog_items` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`category` text DEFAULT 'Development' NOT NULL,
	`sku` text NOT NULL UNIQUE,
	`description` text DEFAULT '' NOT NULL,
	`price` text DEFAULT '0' NOT NULL,
	`currency` text DEFAULT 'LKR' NOT NULL,
	`unit` text DEFAULT '/ Hourly' NOT NULL,
	`icon_type` text DEFAULT 'code' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `invoices` ADD COLUMN `catalog_item_id` text;
