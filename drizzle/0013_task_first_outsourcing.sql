CREATE TEMP TABLE payable_receipts_stage AS SELECT * FROM attachments;
CREATE TEMP TABLE payable_exports_stage AS SELECT * FROM work_order_pdf_exports;
CREATE TEMP TABLE payable_payouts_stage AS SELECT * FROM vendor_payouts;
CREATE TEMP TABLE payables_stage AS SELECT * FROM work_orders;
DROP TABLE attachments;
DROP TABLE work_order_pdf_exports;
DROP TABLE vendor_payouts;
DROP TABLE work_orders;

CREATE TABLE work_orders (
  id text PRIMARY KEY NOT NULL,
  vendor_id text REFERENCES vendors(id) ON DELETE RESTRICT,
  task_id text REFERENCES tasks(id) ON DELETE RESTRICT,
  invoice_id text REFERENCES invoices(id) ON DELETE RESTRICT,
  scope text NOT NULL,
  fee_cents integer NOT NULL CHECK(fee_cents >= 0),
  currency text NOT NULL,
  due_date text,
  status text NOT NULL DEFAULT 'todo',
  completed_at text,
  delivery_url text,
  notes text,
  payout_due_date text,
  created_at text,
  vendor_snapshot text,
  items text,
  discount_cents integer NOT NULL DEFAULT 0 CHECK(discount_cents >= 0),
  paypal_url text,
  stripe_url text,
  CHECK(invoice_id IS NULL OR task_id IS NOT NULL),
  CHECK(vendor_id IS NOT NULL OR vendor_snapshot IS NOT NULL)
);
INSERT INTO work_orders SELECT * FROM payables_stage;
CREATE INDEX work_orders_invoice_idx ON work_orders (invoice_id);

CREATE TABLE vendor_payouts (
  id text PRIMARY KEY NOT NULL,
  work_order_id text NOT NULL REFERENCES work_orders(id) ON DELETE RESTRICT,
  amount_cents integer NOT NULL CHECK(amount_cents > 0),
  currency text NOT NULL,
  paid_at text NOT NULL,
  request_id text NOT NULL UNIQUE,
  voided_at text
);
INSERT INTO vendor_payouts (id,work_order_id,amount_cents,currency,paid_at,request_id,voided_at)
  SELECT id,work_order_id,amount_cents,currency,paid_at,request_id,voided_at FROM payable_payouts_stage;
CREATE INDEX vendor_payouts_work_order_idx ON vendor_payouts (work_order_id);

CREATE TABLE attachments (
  id text PRIMARY KEY NOT NULL,
  payment_id text REFERENCES invoice_payments(id) ON DELETE RESTRICT,
  expense_id text REFERENCES expenses(id) ON DELETE RESTRICT,
  payout_id text REFERENCES vendor_payouts(id) ON DELETE RESTRICT,
  original_name text NOT NULL,
  stored_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  sha256 text NOT NULL,
  created_at text NOT NULL,
  CHECK((payment_id IS NOT NULL) + (expense_id IS NOT NULL) + (payout_id IS NOT NULL) = 1)
);
INSERT INTO attachments SELECT * FROM payable_receipts_stage;
CREATE INDEX attachments_expense_idx ON attachments (expense_id);

CREATE TABLE work_order_pdf_exports (
  work_order_id text PRIMARY KEY NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  exported_at text NOT NULL
);
INSERT INTO work_order_pdf_exports SELECT * FROM payable_exports_stage;
DROP TABLE payables_stage;
DROP TABLE payable_payouts_stage;
DROP TABLE payable_receipts_stage;
DROP TABLE payable_exports_stage;
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
