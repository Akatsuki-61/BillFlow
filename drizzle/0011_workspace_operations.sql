ALTER TABLE invoices ADD COLUMN trashed_at text;
CREATE INDEX invoices_trashed_at_idx ON invoices (trashed_at);
CREATE TABLE invoice_payment_corrections (
  original_payment_id text PRIMARY KEY NOT NULL REFERENCES invoice_payments(id) ON DELETE RESTRICT,
  replacement_payment_id text UNIQUE REFERENCES invoice_payments(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 500),
  corrected_at text NOT NULL,
  CHECK(original_payment_id IS NOT replacement_payment_id)
);
ALTER TABLE work_orders ADD COLUMN payout_due_date text;
UPDATE work_orders SET payout_due_date = (
  SELECT substr(v.payout_due_date, 1, 10) FROM vendors v WHERE v.id = work_orders.vendor_id
) WHERE vendor_id IN (SELECT id FROM vendors WHERE date(substr(payout_due_date, 1, 10)) = substr(payout_due_date, 1, 10));
CREATE INDEX vendor_payouts_work_order_idx ON vendor_payouts (work_order_id);
CREATE TABLE workspace_backup_state (
  id integer PRIMARY KEY CHECK(id = 1),
  revision integer NOT NULL DEFAULT 0,
  backup_revision integer,
  last_backup_at text
);
INSERT INTO workspace_backup_state (id) VALUES (1);
CREATE TRIGGER backup_revision_settings_insert AFTER INSERT ON settings
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_settings_update AFTER UPDATE ON settings
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_settings_delete AFTER DELETE ON settings
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_clients_insert AFTER INSERT ON clients
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_clients_update AFTER UPDATE ON clients
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_clients_delete AFTER DELETE ON clients
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_vendors_insert AFTER INSERT ON vendors
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_vendors_update AFTER UPDATE ON vendors
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_vendors_delete AFTER DELETE ON vendors
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_catalog_items_insert AFTER INSERT ON catalog_items
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_catalog_items_update AFTER UPDATE ON catalog_items
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_catalog_items_delete AFTER DELETE ON catalog_items
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_catalog_services_insert AFTER INSERT ON catalog_services
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_catalog_services_update AFTER UPDATE ON catalog_services
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_catalog_services_delete AFTER DELETE ON catalog_services
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_invoices_insert AFTER INSERT ON invoices
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_invoices_update AFTER UPDATE ON invoices
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_invoices_delete AFTER DELETE ON invoices
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_invoice_items_insert AFTER INSERT ON invoice_items
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_invoice_items_update AFTER UPDATE ON invoice_items
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_invoice_items_delete AFTER DELETE ON invoice_items
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_invoice_payments_insert AFTER INSERT ON invoice_payments
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_invoice_payments_update AFTER UPDATE ON invoice_payments
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_invoice_payments_delete AFTER DELETE ON invoice_payments
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_invoice_payment_corrections_insert AFTER INSERT ON invoice_payment_corrections
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_invoice_payment_corrections_update AFTER UPDATE ON invoice_payment_corrections
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_invoice_payment_corrections_delete AFTER DELETE ON invoice_payment_corrections
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_tasks_insert AFTER INSERT ON tasks
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_tasks_update AFTER UPDATE ON tasks
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_tasks_delete AFTER DELETE ON tasks
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_calendar_events_insert AFTER INSERT ON calendar_events
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_calendar_events_update AFTER UPDATE ON calendar_events
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_calendar_events_delete AFTER DELETE ON calendar_events
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_subtasks_insert AFTER INSERT ON subtasks
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_subtasks_update AFTER UPDATE ON subtasks
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_subtasks_delete AFTER DELETE ON subtasks
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_task_history_insert AFTER INSERT ON task_history
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_task_history_update AFTER UPDATE ON task_history
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_task_history_delete AFTER DELETE ON task_history
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_expenses_insert AFTER INSERT ON expenses
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_expenses_update AFTER UPDATE ON expenses
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_expenses_delete AFTER DELETE ON expenses
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_work_orders_insert AFTER INSERT ON work_orders
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_work_orders_update AFTER UPDATE ON work_orders
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_work_orders_delete AFTER DELETE ON work_orders
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_vendor_payouts_insert AFTER INSERT ON vendor_payouts
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_vendor_payouts_update AFTER UPDATE ON vendor_payouts
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_vendor_payouts_delete AFTER DELETE ON vendor_payouts
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_attachments_insert AFTER INSERT ON attachments
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_attachments_update AFTER UPDATE ON attachments
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_attachments_delete AFTER DELETE ON attachments
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_task_time_slots_insert AFTER INSERT ON task_time_slots
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_task_time_slots_update AFTER UPDATE ON task_time_slots
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
CREATE TRIGGER backup_revision_task_time_slots_delete AFTER DELETE ON task_time_slots
BEGIN
  UPDATE workspace_backup_state SET revision = revision + 1 WHERE id = 1;
END;
