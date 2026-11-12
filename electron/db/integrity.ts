import type Database from "better-sqlite3";
import { validateInvoiceAmounts } from "../../src/lib/invoice-math";

// Report ambiguous historical conflicts without rewriting their financial meaning.
export function assertWorkspaceIntegrity(sqlite: Database.Database) {
  // Historical fixture migrations intentionally stop before the current schema.
  if (
    !(
      sqlite.prepare("PRAGMA table_info(vendor_payouts)").all() as {
        name: string;
      }[]
    ).some((column) => column.name === "voided_at")
  )
    return;
  const conflicts = sqlite
    .prepare(
      `
    SELECT 'payment currency' AS kind, p.id FROM invoice_payments p JOIN invoices i ON i.id=p.invoice_id WHERE p.currency<>i.currency
    UNION ALL SELECT 'payout currency', p.id FROM vendor_payouts p JOIN work_orders w ON w.id=p.work_order_id WHERE p.currency<>w.currency
    UNION ALL SELECT 'invoice collection', i.id FROM invoices i WHERE i.paid_cents <> COALESCE((SELECT SUM(p.amount_cents) FROM invoice_payments p WHERE p.invoice_id=i.id),0)
    UNION ALL SELECT 'task invoice', t.id FROM tasks t JOIN invoices i ON i.id=t.invoice_id WHERE t.client_id IS NOT i.client_id OR t.currency<>i.currency
    UNION ALL SELECT 'task item', t.id FROM tasks t JOIN invoice_items item ON item.id=t.invoice_item_id WHERE t.invoice_id IS NOT item.invoice_id
    UNION ALL SELECT 'work order task', w.id FROM work_orders w JOIN tasks t ON t.id=w.task_id WHERE t.invoice_id IS NOT w.invoice_id
    UNION ALL SELECT 'duplicate active payouts', work_order_id FROM vendor_payouts WHERE voided_at IS NULL GROUP BY work_order_id HAVING COUNT(*)>1
    LIMIT 20
  `,
    )
    .all() as { kind: string; id: string }[];
  const items = sqlite
    .prepare("SELECT invoice_id, quantity, unit_price_cents FROM invoice_items")
    .all() as {
    invoice_id: string;
    quantity: number;
    unit_price_cents: number;
  }[];
  const grouped = new Map<
    string,
    { quantity: number; unitPriceCents: number }[]
  >();
  for (const item of items) {
    const list = grouped.get(item.invoice_id) || [];
    list.push({
      quantity: item.quantity,
      unitPriceCents: item.unit_price_cents,
    });
    grouped.set(item.invoice_id, list);
  }
  const invoices = sqlite
    .prepare(
      "SELECT id,amount_cents,discount_cents,tax_cents,advance_cents FROM invoices",
    )
    .all() as {
    id: string;
    amount_cents: number;
    discount_cents: number;
    tax_cents: number;
    advance_cents: number;
  }[];
  for (const invoice of invoices) {
    try {
      validateInvoiceAmounts({
        amountCents: invoice.amount_cents,
        discountCents: invoice.discount_cents,
        taxCents: invoice.tax_cents,
        advanceCents: invoice.advance_cents,
        items: grouped.get(invoice.id),
      });
    } catch {
      conflicts.push({ kind: "invoice total", id: invoice.id });
    }
    if (conflicts.length >= 20) break;
  }
  if (conflicts.length)
    throw new Error(
      `Workspace integrity requires review: ${conflicts.map((row) => `${row.kind} (${row.id})`).join(", ")}. Conflicting records were preserved; no financial values were guessed. Restore a known-good backup or repair a copy of this workspace before continuing.`,
    );
}
