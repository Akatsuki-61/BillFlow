CREATE TABLE `work_order_pdf_exports` (
  `work_order_id` text PRIMARY KEY NOT NULL REFERENCES `work_orders`(`id`) ON DELETE cascade,
  `file_path` text NOT NULL,
  `exported_at` text NOT NULL
);--> statement-breakpoint
CREATE TABLE `task_time_slots` (
  `task_id` text PRIMARY KEY NOT NULL REFERENCES `tasks`(`id`) ON DELETE cascade,
  `start_time` text,
  `end_time` text,
  `updated_at` text NOT NULL
);--> statement-breakpoint
CREATE INDEX `invoice_payments_invoice_idx` ON `invoice_payments` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `work_orders_invoice_idx` ON `work_orders` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `subtasks_task_idx` ON `subtasks` (`task_id`);--> statement-breakpoint
CREATE INDEX `attachments_expense_idx` ON `attachments` (`expense_id`);--> statement-breakpoint
UPDATE `tasks` SET
  `active_milliseconds` = `active_milliseconds` + CASE WHEN julianday(updated_at) >= julianday(active_since) THEN CAST((julianday(updated_at) - julianday(active_since)) * 86400000 AS INTEGER) ELSE 0 END,
  `active_since` = NULL
WHERE `active_since` IS NOT NULL AND (`status` <> 'in-progress' OR `deleted_at` IS NOT NULL);--> statement-breakpoint
UPDATE `tasks` SET `active_since` = COALESCE(`updated_at`, `created_at`) WHERE `status` = 'in-progress' AND `deleted_at` IS NULL AND `active_since` IS NULL;
--> statement-breakpoint
INSERT INTO invoice_payments (id, invoice_id, amount_cents, currency, received_at, reference, request_id)
SELECT 'legacy-recorded-' || i.id, i.id, i.paid_cents, i.currency,
  COALESCE(NULLIF(i.updated_at, ''), i.issue_date), 'Migrated recorded collection', 'legacy-recorded-' || i.id
FROM invoices i
WHERE i.paid_cents > 0 AND NOT EXISTS (SELECT 1 FROM invoice_payments p WHERE p.invoice_id = i.id);
--> statement-breakpoint
INSERT OR IGNORE INTO task_history (id, task_id, from_status, to_status, occurred_at)
SELECT 'reconciled-status-' || t.id, t.id,
  (SELECT h.to_status FROM task_history h WHERE h.task_id=t.id ORDER BY h.occurred_at DESC, h.rowid DESC LIMIT 1),
  t.status, t.updated_at
FROM tasks t
WHERE (SELECT h.to_status FROM task_history h WHERE h.task_id=t.id ORDER BY h.occurred_at DESC, h.rowid DESC LIMIT 1) IS NOT t.status;

--> statement-breakpoint
ALTER TABLE vendor_payouts ADD voided_at text;
