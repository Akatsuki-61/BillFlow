"use client";

import React from "react";
import { Paperclip } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Workspace";
import { PaymentCorrectionForm } from "./PaymentCorrectionForm";
import { formatCents, formatDateDisplay } from "@/lib/format";
import type { InvoiceWithClient } from "@/types/billing";
import type { AttachmentItem, WorkflowAPI } from "@/types/workflow";

interface PaymentInspectionModalProps {
  invoice: InvoiceWithClient;
  paymentAttachments: Record<string, AttachmentItem[]>;
  isLoadingAttachments: boolean;
  isElectron: boolean;
  workflow?: WorkflowAPI | null;
  onClose: () => void;
  onUpdateInvoice: (updated: InvoiceWithClient) => void;
  onRefresh: () => Promise<void>;
  onAttachReceipt: (paymentId: string) => void;
  onToast: (message: string) => void;
}

export function PaymentInspectionModal({
  invoice,
  paymentAttachments,
  isLoadingAttachments,
  isElectron,
  workflow,
  onClose,
  onUpdateInvoice,
  onRefresh,
  onAttachReceipt,
  onToast,
}: PaymentInspectionModalProps) {
  return (
    <Dialog onClose={onClose} width={620}>
      <div className="app-dialog-header">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-surface-purple-100 text-content-purple-700 flex items-center justify-center">
            <Paperclip className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-content-neutral-900">
              Payments & Attached Receipts
            </h3>
            <p className="text-xs text-content-neutral-400">
              {invoice.code} · {invoice.clientName}
            </p>
          </div>
        </div>
      </div>
      <div className="app-dialog-body">
        <div className="app-dialog-section p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {isLoadingAttachments ? (
            <p className="text-xs text-content-neutral-500">
              Loading payment receipts...
            </p>
          ) : !invoice.payments || invoice.payments.length === 0 ? (
            <p className="text-xs text-content-neutral-500">
              No payments have been recorded for this invoice yet.
            </p>
          ) : (
            invoice.payments.map((payment, idx) => {
              const slips = paymentAttachments[payment.id] || [];

              return (
                <div
                  key={payment.id || idx}
                  className="p-3.5 rounded-xl border border-line-neutral-200 bg-surface-neutral-50/60 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-content-neutral-900 text-sm">
                      {formatCents(payment.amountCents, payment.currency)}
                    </span>
                    <span className="text-[11px] text-content-neutral-500">
                      {formatDateDisplay(payment.receivedAt)}
                    </span>
                  </div>

                  {payment.reference && (
                    <div className="text-[11px] text-content-neutral-600 font-mono">
                      Ref: {payment.reference}
                    </div>
                  )}

                  {payment.correction ? (
                    <div className="rounded-lg bg-surface-neutral-100 p-2 text-content-neutral-800">
                      <p className="font-medium">
                        {payment.correction.replacementPaymentId
                          ? "Corrected"
                          : "Reversed"}{" "}
                        · {formatDateDisplay(payment.correction.correctedAt)}
                      </p>
                      <p className="mt-1 break-words">
                        {payment.correction.reason}
                      </p>
                    </div>
                  ) : (
                    isElectron && (
                      <PaymentCorrectionForm
                        payment={payment}
                        onSubmit={async (input) => {
                          const updated =
                            await window.billflow!.invoices.correctPayment(
                              input,
                            );
                          onUpdateInvoice(updated);
                          await onRefresh();
                          onToast(
                            input.replacement
                              ? "Payment corrected."
                              : "Payment reversed.",
                          );
                        }}
                      />
                    )
                  )}

                  <div className="pt-2 border-t border-line-neutral-200/60">
                    {slips.length > 0 ? (
                      <div className="space-y-1.5">
                        {slips.map((att) => (
                          <div
                            key={att.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-surface border border-line-neutral-200 text-xs"
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <Paperclip className="w-3.5 h-3.5 text-accent" />
                              <span className="truncate">
                                {att.originalName}
                              </span>
                              <span className="text-[10px] text-content-neutral-400">
                                ({Math.round(att.sizeBytes / 1024)} KB)
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="small"
                              onClick={() => workflow?.attachments.open(att.id)}
                            >
                              View Slip
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-content-neutral-400 italic">
                          No payment slip attached.
                        </span>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => onAttachReceipt(payment.id)}
                        >
                          Attach Slip
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      <div className="app-dialog-footer">
        <Button variant="primary" type="button" onClick={onClose}>
          Done
        </Button>
      </div>
    </Dialog>
  );
}
