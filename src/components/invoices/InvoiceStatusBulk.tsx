"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Workspace";
import type { InvoiceStatus, InvoiceWorkflowStage } from "@/types/billing";

export const workflowStages: Record<InvoiceWorkflowStage, string> = {
  SENT: "Sent",
  WORK_CONFIRMED: "Work confirmed",
  DELIVERED: "Delivered",
};

export function InvoiceWorkflowSelect({
  value,
  onChange,
}: {
  value: InvoiceWorkflowStage | null;
  onChange: (value: InvoiceWorkflowStage | null) => void;
}) {
  return (
    <label className="block space-y-1 text-xs font-medium">
      <span>Workflow stage</span>
      <select
        className="ui-field w-full"
        value={value ?? ""}
        onChange={(event) =>
          onChange((event.target.value as InvoiceWorkflowStage) || null)
        }
      >
        <option value="">No stage set</option>
        {Object.entries(workflowStages).map(([stage, title]) => (
          <option key={stage} value={stage}>
            {title}
          </option>
        ))}
      </select>
    </label>
  );
}

export function InvoiceStatusBulk({
  ids,
  onClose,
  onSaved,
}: {
  ids: string[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [status, setStatus] = useState<InvoiceStatus | "">("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog onClose={onClose} width={470}>
      <form
        className="app-dialog-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!status || busy) return;
          setBusy(true);
          setError("");
          try {
            await window.billflow!.invoices.setStatuses(ids, status);
            await onSaved();
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Could not change invoice statuses.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="app-dialog-header">
          <h3>Change payment status</h3>
        </div>
        <div className="app-dialog-body">
          <div className="app-dialog-section space-y-3 p-5">
            <p className="text-xs text-content-neutral-700">
              {ids.length} selected invoices
            </p>
            <label className="block space-y-1 text-xs">
              <span>Payment status</span>
              <select
                className="ui-field w-full"
                required
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as InvoiceStatus)
                }
              >
                <option value="">Choose a status</option>
                <option value="DRAFT">Draft</option>
                <option value="UNPAID">Unpaid</option>
                <option value="ADVANCE_PAID">Advance paid</option>
                <option value="PAID">Paid</option>
                <option value="OVERDUE">Overdue</option>
              </select>
            </label>
            {(status === "PAID" || status === "ADVANCE_PAID") && (
              <p className="text-xs text-content-neutral-700">
                This records payments for any amount needed to reach the
                selected status.
              </p>
            )}
            {error && (
              <p role="alert" className="text-xs text-content-rose-700">
                {error}
              </p>
            )}
          </div>
        </div>
        <div className="app-dialog-footer">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={busy || !status}>
            Apply status
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
