"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Workspace";
import type { InvoiceWithClient } from "@/types/billing";

export function InvoiceTrash({
  onClose,
  onRestore,
}: {
  onClose: () => void;
  onRestore: () => Promise<void>;
}) {
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    window
      .billflow!.invoices.listTrash()
      .then((items) => {
        if (active) setInvoices(items);
      })
      .catch((err: unknown) => {
        if (active)
          setError(
            err instanceof Error ? err.message : "Could not load Trash.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const restore = async (ids: string[]) => {
    setRestoring(true);
    setError("");
    try {
      await window.billflow!.invoices.restore(ids);
      setInvoices((items) => items.filter((item) => !ids.includes(item.id)));
      setSelected((items) => items.filter((id) => !ids.includes(id)));
      await onRestore();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not restore invoices.",
      );
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Dialog onClose={onClose} width={620}>
      <div className="app-dialog-header">
        <div>
          <h3 className="text-base font-semibold">Invoice Trash</h3>
          <p className="mt-1 text-xs text-content-neutral-600">
            Restore invoices to return them to the register and financial
            totals.
          </p>
        </div>
      </div>
      <div className="app-dialog-body">
        <div className="app-dialog-section max-h-[55vh] overflow-y-auto space-y-2 p-5">
          {loading && (
            <p className="text-sm" role="status">
              Loading Trash…
            </p>
          )}
          {!loading && !invoices.length && !error && (
            <p className="text-sm">Trash is empty.</p>
          )}
          {error && (
            <p className="text-sm text-content-rose-600" role="alert">
              {error}
            </p>
          )}
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="flex items-center gap-3 rounded-lg border border-line-neutral-200 p-3"
            >
              <label className="flex flex-1 items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected.includes(invoice.id)}
                  onChange={() =>
                    setSelected((ids) =>
                      ids.includes(invoice.id)
                        ? ids.filter((id) => id !== invoice.id)
                        : [...ids, invoice.id],
                    )
                  }
                />
                <span>
                  <span className="block text-sm font-medium">
                    {invoice.code} · {invoice.clientName}
                  </span>
                  <span className="text-xs text-content-neutral-600">
                    Trashed {invoice.trashedAt?.slice(0, 10)}
                  </span>
                </span>
              </label>
              <Button
                variant="secondary"
                size="small"
                disabled={restoring}
                onClick={() => void restore([invoice.id])}
              >
                Restore
              </Button>
            </div>
          ))}
        </div>
      </div>
      <div className="app-dialog-footer">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button
          variant="primary"
          disabled={restoring || !selected.length}
          onClick={() => void restore(selected)}
        >
          Restore selected{selected.length ? ` (${selected.length})` : ""}
        </Button>
      </div>
    </Dialog>
  );
}
