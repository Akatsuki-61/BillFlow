"use client";

import React, { useState, useMemo } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Workspace";
import {
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  Link2,
  Sparkles,
  Send,
  Building2,
  Receipt,
  CheckSquare,
  FileText,
} from "lucide-react";
import type { TaskItem } from "@/types/tasks";
import type { TaskPatchInput } from "@/types/workflow";
import { useData } from "@/lib/data/DataProvider";
import {
  resolveDeliveryUrl,
  formatExternalUrl,
  openExternalLink,
} from "@/lib/deliveryUrl";

export interface SubmitWorkModalProps {
  task: TaskItem;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (patch: TaskPatchInput) => Promise<boolean | void>;
  saving?: boolean;
}

export default function SubmitWorkModal({
  task,
  isOpen,
  onClose,
  onSubmit,
  saving = false,
}: SubmitWorkModalProps) {
  const { clients, invoices } = useData();

  // Resolve initial delivery link from task, invoice or client
  const resolved = useMemo(
    () => resolveDeliveryUrl(task, { clients, invoices }),
    [task, clients, invoices],
  );

  const [deliveryUrlInput, setDeliveryUrlInput] = useState(() => task.deliveryUrl?.trim() || resolved.url || "");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [completeAllSubtasks, setCompleteAllSubtasks] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  if (!isOpen || !task) return null;

  // Subtask calculations
  const totalSubtasks = task.subtasks?.length || 0;
  const completedSubtasks =
    task.subtasks?.filter((st) => st.completed).length || 0;
  const incompleteSubtasks = totalSubtasks - completedSubtasks;

  // Client information
  const clientName =
    task.clientName ||
    clients.find((c) => c.id === task.clientId)?.name ||
    "Client";

  // Formatted URL for previews and actions
  const normalizedUrl = formatExternalUrl(deliveryUrlInput);

  // Generate ready-to-send client message
  const clientHandoverMessage = [
    `Hi ${clientName},`,
    "",
    `The deliverable "${task.title}" has been completed and is ready for your review:`,
    normalizedUrl ? `🔗 Delivery Link: ${normalizedUrl}` : "",
    deliveryNotes.trim() ? `📝 Notes: ${deliveryNotes.trim()}` : "",
    "",
    "Please review and let me know if you need any adjustments!",
  ]
    .filter(Boolean)
    .join("\n");

  const handleCopyLink = async () => {
    if (!normalizedUrl) return;
    try {
      await navigator.clipboard.writeText(normalizedUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(clientHandoverMessage);
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);

    const trimmed = deliveryUrlInput.trim();
    let finalUrl: string | null = null;

    if (trimmed) {
      finalUrl = formatExternalUrl(trimmed);
      try {
        const parsed = new URL(finalUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          setUrlError("Please use an HTTP or HTTPS deliverable link.");
          return;
        }
      } catch {
        setUrlError("Please enter a valid website, repository, or Drive URL.");
        return;
      }
    }

    // Build subtasks update if requested
    let updatedSubtasks = task.subtasks;
    if (completeAllSubtasks && incompleteSubtasks > 0) {
      updatedSubtasks = task.subtasks.map((st) => ({
        ...st,
        completed: true,
      }));
    }

    // Append notes to description if provided
    let updatedDescription = task.description;
    if (deliveryNotes.trim()) {
      const timestamp = new Date().toISOString().slice(0, 10);
      const noteEntry = `\n\n[Delivery Handover — ${timestamp}]: ${deliveryNotes.trim()}`;
      if (!updatedDescription.includes(noteEntry.trim())) {
        updatedDescription = `${updatedDescription.trim()}${noteEntry}`;
      }
    }

    const patch: TaskPatchInput = {
      status: "done",
      deliveryUrl: finalUrl,
      subtasks: updatedSubtasks,
      description: updatedDescription,
    };

    await onSubmit(patch);
  };

  return (
    <Dialog onClose={onClose} width={680}>
      {/* Header */}
      <div className="app-dialog-header">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-accent-faint dark:bg-accent-soft/20 border border-border-accent/60 flex items-center justify-center shrink-0 text-accent">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-newspaper font-semibold text-content-neutral-900 dark:text-content-neutral-100">
                Submit Work & Complete Deliverable
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent-faint dark:bg-accent-soft/25 text-accent border border-border-accent/60">
                Move to Done
              </span>
            </div>
            <p className="text-xs text-content-neutral-500">
              Confirm handover links and final notes before marking this sprint
              task as completed.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="app-dialog-form">
        <div className="app-dialog-body space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* Deliverable Context Card */}
          <div className="p-3.5 rounded-xl bg-surface-neutral-50/80 dark:bg-surface-secondary border border-line-neutral-200/80 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">
                  {task.category}
                </span>
                <h3 className="text-sm font-semibold text-content-neutral-900 dark:text-content-neutral-100 leading-snug">
                  {task.title}
                </h3>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider bg-surface border border-line-neutral-200 text-content-neutral-600 shrink-0">
                {task.priority} priority
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs text-content-neutral-500 pt-1 border-t border-line-neutral-200/50 flex-wrap">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-content-neutral-400" />
                <span className="font-medium text-content-neutral-700 dark:text-content-neutral-300">
                  {clientName}
                </span>
              </span>

              {task.invoiceCode && (
                <span className="flex items-center gap-1">
                  <Receipt className="w-3.5 h-3.5 text-content-neutral-400" />
                  <span>Invoice: {task.invoiceCode}</span>
                </span>
              )}

              {task.dueDate && (
                <span className="text-[11px] text-content-neutral-400">
                  Due: {task.dueDate}
                </span>
              )}

              {task.isOutsourced && task.outsourcedVendor && (
                <span className="text-[11px] text-accent bg-accent-faint dark:bg-accent-soft/20 px-2 py-0.5 rounded-md border border-border-accent/60">
                  Outsourced to {task.outsourcedVendor}
                </span>
              )}
            </div>
          </div>

          {/* Delivery Location / Link Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="submit-work-delivery-url"
                className="text-xs font-semibold text-content-neutral-700 dark:text-content-neutral-300 uppercase tracking-wider flex items-center gap-1.5"
              >
                <Link2 className="w-3.5 h-3.5 text-accent" />
                <span>Deliverable Location / Link</span>
              </label>

              {resolved.hasLink && (
                <span className="text-[11px] text-content-neutral-500 italic">
                  {resolved.source === "invoice"
                    ? "Inherited from Invoice"
                    : resolved.source === "client"
                      ? "Inherited from Client Drive"
                      : "Direct Task Link"}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  id="submit-work-delivery-url"
                  type="text"
                  value={deliveryUrlInput}
                  onChange={(e) => {
                    setDeliveryUrlInput(e.target.value);
                    if (urlError) setUrlError(null);
                  }}
                  placeholder="https://github.com/..., staging URL, or Google Drive folder"
                  className={`ui-field w-full px-3.5 text-xs border ${
                    urlError
                      ? "border-rose-400 focus:border-rose-500"
                      : "border-line-neutral-200 focus:border-accent"
                  } transition-all`}
                />
              </div>

              {normalizedUrl && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="small"
                    onClick={handleCopyLink}
                    title="Copy delivery link to clipboard"
                    className="shrink-0 text-xs gap-1"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-accent" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="small"
                    onClick={(e) => openExternalLink(normalizedUrl, e)}
                    title="Open deliverable link in browser"
                    className="shrink-0 text-xs gap-1 text-accent"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open</span>
                  </Button>
                </>
              )}
            </div>

            {urlError ? (
              <p className="text-xs text-rose-500 font-medium">{urlError}</p>
            ) : (
              <p className="text-[11px] text-content-neutral-400">
                Enter or verify the link (e.g. GitHub repo, staging website, or
                Google Drive folder) where the client can access the finished
                work.
              </p>
            )}
          </div>

          {/* Subtasks Completion Check (if task has subtasks) */}
          {totalSubtasks > 0 && (
            <div
              className={`p-3 rounded-xl border transition-colors ${
                incompleteSubtasks > 0
                  ? "bg-accent-faint/30 dark:bg-accent-soft/15 border-border-accent/60 dark:border-border-accent/40"
                  : "bg-surface-neutral-50/80 dark:bg-surface-secondary border-line-neutral-200/80"
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-content-neutral-900 dark:text-content-neutral-100">
                  <CheckSquare className="w-3.5 h-3.5 text-accent" />
                  <span>Subtask Checklist</span>
                </span>
                <span className="font-medium text-content-neutral-500">
                  {completedSubtasks} of {totalSubtasks} completed
                </span>
              </div>

              {incompleteSubtasks > 0 ? (
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={completeAllSubtasks}
                    onChange={(e) => setCompleteAllSubtasks(e.target.checked)}
                    className="w-4 h-4 rounded text-accent focus:ring-accent border-line-neutral-300 accent-accent cursor-pointer"
                  />
                  <span className="text-xs text-content-neutral-700 dark:text-content-neutral-300">
                    Mark remaining{" "}
                    <strong className="text-accent font-semibold">
                      {incompleteSubtasks} unchecked subtask
                      {incompleteSubtasks > 1 ? "s" : ""}
                    </strong>{" "}
                    as completed
                  </span>
                </label>
              ) : (
                <p className="text-[11px] text-accent mt-1 flex items-center gap-1 font-medium">
                  <Check className="w-3 h-3 text-accent" />
                  All subtasks have been checked off.
                </p>
              )}
            </div>
          )}

          {/* Handover & Delivery Notes */}
          <div>
            <label
              htmlFor="submit-work-notes"
              className="block text-xs font-semibold text-content-neutral-700 dark:text-content-neutral-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-content-neutral-400" />
              <span>Handover Notes / Summary (Optional)</span>
            </label>
            <textarea
              id="submit-work-notes"
              rows={2}
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder="e.g. Staging build deployed to Vercel. Google Drive documentation folder updated."
              className="ui-field ui-textarea w-full px-3.5 py-2 text-xs border border-line-neutral-200 focus:outline-none focus:border-accent transition-all resize-none"
            />
          </div>

          {/* Quick Client Handover Message Box */}
          <div className="p-3.5 rounded-xl bg-surface-neutral-50 dark:bg-surface-secondary border border-line-neutral-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-content-neutral-700 dark:text-content-neutral-300 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-accent" />
                <span>Client Handover Message (WhatsApp / Email)</span>
              </span>

              <Button
                type="button"
                variant="ghost"
                size="small"
                onClick={handleCopyMessage}
                className="text-xs gap-1 text-accent hover:bg-accent-faint"
                title="Copy client handover message to clipboard"
              >
                {copiedMessage ? (
                  <>
                    <Check className="w-3 h-3 text-accent" />
                    <span>Copied Message</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Message</span>
                  </>
                )}
              </Button>
            </div>

            <pre className="text-[11px] font-sans whitespace-pre-wrap bg-surface p-2.5 rounded-lg border border-line-neutral-200/80 text-text-placeholder leading-relaxed select-all">
              {clientHandoverMessage}
            </pre>
          </div>

          {/* Workflow Notice */}
          <div className="p-3 rounded-xl bg-accent-faint/60 dark:bg-accent-soft/20 border border-border-accent/60 dark:border-border-accent/40 flex items-start gap-2.5 text-xs text-content-neutral-400">
            <Sparkles className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Moving this task to{" "}
              <strong className="text-content-neutral-900 dark:text-content-neutral-100 font-semibold">
                Done
              </strong>{" "}
              logs the deliverable completion timestamp in the background. Client
              invoice payment progress remains separate until the client approves
              the work and settles the remaining balance.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="app-dialog-footer">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            disabled={saving}
            className="!bg-accent-solid hover:opacity-90 !text-white gap-1.5 shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Submit Work & Mark Done</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
