ALTER TABLE `expenses` ADD `merchant` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `deductible` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `created_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `expenses` SET `created_at` = COALESCE(NULLIF(`incurred_at`, ''), CURRENT_TIMESTAMP) WHERE `created_at` = '';
