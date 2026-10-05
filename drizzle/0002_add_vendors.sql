CREATE TABLE `vendors` (
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
CREATE INDEX `vendors_linked_client_id_idx` ON `vendors` (`linked_client_id`);
