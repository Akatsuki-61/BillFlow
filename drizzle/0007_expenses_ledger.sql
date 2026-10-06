ALTER TABLE `expenses` ADD `merchant` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `deductible` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL;
