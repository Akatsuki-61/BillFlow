"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Workspace";
import type { CorrectPaymentInput, InvoicePayment } from "@/types/billing";

export function PaymentCorrectionForm({
  payment,
  onSubmit,
}: {
  payment: InvoicePayment;
  onSubmit: (input: CorrectPaymentInput) => Promise<void>;
}) {
  const [mode, setMode] = useState<"reverse" | "correct" | null>(null);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState((payment.amountCents / 100).toFixed(2));
  const [date, setDate] = useState(payment.receivedAt.slice(0, 10));
  const [reference, setReference] = useState(payment.reference);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!mode)
    return (
      <div className="flex gap-2">
        <Button
          size="small"
          variant="secondary"
          onClick={() => setMode("correct")}
        >
          Correct payment
        </Button>
        <Button size="small" variant="ghost" onClick={() => setMode("reverse")}>
          Reverse payment
        </Button>
      </div>
    );

  return (
    <form
      className="border-t border-line-neutral-200 pt-3 space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        try {
          await onSubmit({
            invoiceId: payment.invoiceId,
            paymentId: payment.id,
            reason,
            ...(mode === "correct" && {
              replacement: {
                amountCents: Math.round(Number(amount) * 100),
                receivedAt: date,
                reference,
              },
            }),
          });
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not update the payment.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-content-neutral-700">
        The original entry and any receipts stay in the payment history.
      </p>
      {mode === "correct" && (
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span>Amount ({payment.currency})</span>
            <input
              className="ui-field w-full"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </label>
          <label className="space-y-1">
            <span>Payment date</span>
            <input
              className="ui-field w-full"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>
          <label className="col-span-2 space-y-1">
            <span>Payment reference</span>
            <input
              className="ui-field w-full"
              type="text"
              maxLength={200}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </label>
        </div>
      )}
      <label className="block space-y-1">
        <span>Reason</span>
        <textarea
          className="ui-field w-full"
          rows={2}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          required
        />
      </label>
      {error && (
        <p className="text-content-rose-600" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          size="small"
          variant={mode === "reverse" ? "danger" : "primary"}
          type="submit"
          disabled={busy || !reason.trim()}
        >
          {mode === "reverse" ? "Confirm reversal" : "Save correction"}
        </Button>
        <Button
          size="small"
          variant="ghost"
          type="button"
          disabled={busy}
          onClick={() => {
            setMode(null);
            setError("");
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
