CREATE TABLE `calendar_events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`start_time` text,
	`end_time` text,
	`is_all_day` integer DEFAULT 0 NOT NULL,
	`category` text DEFAULT 'general' NOT NULL,
	`color` text DEFAULT 'blue' NOT NULL,
	`client_id` text REFERENCES `clients`(`id`) ON DELETE set null,
	`client_name` text,
	`task_id` text REFERENCES `tasks`(`id`) ON DELETE set null,
	`task_title` text,
	`location` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
