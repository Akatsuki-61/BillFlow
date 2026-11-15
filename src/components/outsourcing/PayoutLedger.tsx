"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Workspace";
import { remainingPayout } from "@/lib/cashflow-forecast";
import { useData, useWorkOrders } from "@/lib/data/DataProvider";
import { formatCents } from "@/lib/format";
import { localDateKey } from "@/lib/visual-metrics";
import type { WorkOrderItem } from "@/types/outsourcing";
import type { AttachmentItem } from "@/types/workflow";

export function PayoutLedger({
  order,
  onChange,
}: {
  order: WorkOrderItem;
  onChange: (order: WorkOrderItem) => void;
}) {
  const { workflow } = useData();
  const { recordWorkOrderPayout, removeWorkOrderPayout, updateWorkOrder } =
    useWorkOrders();
  const [date, setDate] = useState(localDateKey);
  const [amount, setAmount] = useState("");
  const [scheduledDate, setScheduledDate] = useState(order.payoutDueDate ?? "");
  const [selectedPayoutId, setSelectedPayoutId] = useState<string | null>(null);
  const [confirmVoid, setConfirmVoid] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<AttachmentItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const request = useRef<{ key: string; id: string } | null>(null);
  const balance = remainingPayout(order);
  const ledger = order.payouts ?? [];

  useEffect(() => {
    if (!workflow || !selectedPayoutId) return;
    let active = true;
    workflow.attachments
      .list({ type: "payout", id: selectedPayoutId })
      .then((items) => {
        if (active) setReceipts(items);
      })
      .catch((err: unknown) => {
        if (active)
          setError(
            err instanceof Error
              ? err.message
              : "Could not load payout receipts.",
          );
      })
      .finally(() => {
        if (active) setLoadingReceipts(false);
      });
    return () => {
      active = false;
    };
  }, [selectedPayoutId, workflow]);

  const run = async (operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await operation();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update the payout ledger.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-line-neutral-200 bg-surface-neutral-50 p-4 space-y-4">
      <div className="flex justify-between items-baseline gap-3">
        <h4 className="text-sm font-semibold text-content-neutral-950">
          Payouts & receipts
        </h4>
        <span className="text-sm font-semibold text-content-neutral-950 tabular-nums">
          {formatCents(balance, order.currency)} remaining
        </span>
      </div>

      <form
        className="flex items-end flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            const updated = await updateWorkOrder(order.id, {
              payoutDueDate: scheduledDate || null,
            });
            onChange(updated);
            setMessage("Payout date saved.");
          });
        }}
      >
        <label className="space-y-1 text-xs">
          <span className="block">Scheduled payout date</span>
          <input
            type="date"
            className="ui-field"
            value={scheduledDate}
            onChange={(event) => setScheduledDate(event.target.value)}
          />
        </label>
        <Button
          size="small"
          variant="secondary"
          type="submit"
          disabled={busy || scheduledDate === (order.payoutDueDate ?? "")}
        >
          Save date
        </Button>
      </form>

      {balance > 0 && (
        <form
          className="flex items-end flex-wrap gap-2 pt-3 border-t border-line-neutral-200"
          onSubmit={(event) => {
            event.preventDefault();
            const amountCents = Math.round(Number(amount) * 100);
            const key = `${amountCents}:${date}`;
            if (request.current?.key !== key)
              request.current = { key, id: crypto.randomUUID() };
            void run(async () => {
              const updated = await recordWorkOrderPayout({
                workOrderId: order.id,
                amountCents,
                paidAt: date,
                requestId: request.current!.id,
              });
              request.current = null;
              onChange(updated);
              setAmount("");
              setMessage("Payout recorded.");
            });
          }}
        >
          <label className="space-y-1 text-xs">
            <span className="block">Installment ({order.currency})</span>
            <input
              type="number"
              className="ui-field w-32"
              min="0.01"
              max={balance / 100}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={(balance / 100).toFixed(2)}
              required
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="block">Paid on</span>
            <input
              type="date"
              className="ui-field"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>
          <Button size="small" variant="primary" type="submit" disabled={busy}>
            Record payout
          </Button>
          <Button
            size="small"
            variant="ghost"
            type="button"
            disabled={busy}
            onClick={() => setAmount((balance / 100).toFixed(2))}
          >
            Use full balance
          </Button>
        </form>
      )}

      <div className="space-y-2">
        {ledger.length === 0 && (
          <p className="text-xs text-content-neutral-600">
            No payouts recorded.
          </p>
        )}
        {[...ledger].reverse().map((payout) => (
          <div
            key={payout.id}
            className="rounded-lg border border-line-neutral-200 bg-surface p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="text-xs font-medium">
                  {formatCents(payout.amountCents, payout.currency)} ·{" "}
                  {payout.paidAt.slice(0, 10)}
                </p>
                {payout.voidedAt && (
                  <p className="text-xs text-content-neutral-600">
                    Voided {payout.voidedAt.slice(0, 10)}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {workflow && (
                  <Button
                    size="small"
                    variant="secondary"
                    disabled={busy}
                    aria-expanded={selectedPayoutId === payout.id}
                    onClick={() => {
                      if (selectedPayoutId === payout.id) {
                        setSelectedPayoutId(null);
                      } else {
                        setReceipts([]);
                        setLoadingReceipts(true);
                        setSelectedPayoutId(payout.id);
                      }
                    }}
                  >
                    Receipts
                  </Button>
                )}
                {!payout.voidedAt && (
                  <Button
                    size="small"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setConfirmVoid(payout.id)}
                  >
                    Void
                  </Button>
                )}
              </div>
            </div>
            {confirmVoid === payout.id && !payout.voidedAt && (
              <div className="space-y-2">
                <p className="text-xs">
                  Voiding this payout reopens its amount and keeps its receipts.
                </p>
                <Button
                  size="small"
                  variant="danger"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      onChange(
                        await removeWorkOrderPayout(order.id, payout.id),
                      );
                      setConfirmVoid(null);
                      setMessage("Payout voided.");
                    })
                  }
                >
                  Confirm void
                </Button>
                <Button
                  size="small"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setConfirmVoid(null)}
                >
                  Cancel
                </Button>
              </div>
            )}
            {workflow && selectedPayoutId === payout.id && (
              <div className="space-y-2 pt-2 border-t border-line-neutral-200">
                {loadingReceipts ? (
                  <p className="text-xs">Loading receipts…</p>
                ) : (
                  !receipts.length && (
                    <p className="text-xs">No receipts attached.</p>
                  )
                )}
                {receipts.map((receipt) => (
                  <div
                    key={receipt.id}
                    className="flex justify-between gap-2 items-center"
                  >
                    <span className="truncate text-xs">
                      {receipt.originalName}
                    </span>
                    <Button
                      variant="ghost"
                      size="small"
                      onClick={() =>
                        void run(async () => {
                          await workflow.attachments.open(receipt.id);
                        })
                      }
                    >
                      View
                    </Button>
                  </div>
                ))}
                {!payout.voidedAt && (
                  <Button
                    size="small"
                    variant="secondary"
                    disabled={busy || loadingReceipts}
                    onClick={() =>
                      void run(async () => {
                        const owner = {
                          type: "payout" as const,
                          id: payout.id,
                        };
                        if (
                          await workflow.attachments.select(
                            owner,
                            crypto.randomUUID(),
                          )
                        ) {
                          setReceipts(await workflow.attachments.list(owner));
                          setMessage("Receipt attached.");
                        }
                      })
                    }
                  >
                    Attach receipt
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {message && (
        <p role="status" className="text-xs text-content-neutral-700">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-content-rose-600">
          {error}
        </p>
      )}
    </section>
  );
}
