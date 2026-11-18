"use client";

import React from "react";
import { ExternalLink, FileCheck } from "lucide-react";
import { motion } from "motion/react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Workspace";
import { SPRING_NAV_GLIDE } from "@/lib/motion";
import { formatCents } from "@/lib/format";
import { formatExternalUrl, openExternalLink } from "@/lib/deliveryUrl";
import type { WorkOrderItem } from "@/types/outsourcing";

interface ReviewDeliverableModalProps {
  workOrder: WorkOrderItem;
  reviewStatus: "todo" | "in-progress" | "review" | "done";
  setReviewStatus: (status: "todo" | "in-progress" | "review" | "done") => void;
  reviewDeliveryUrl: string;
  setReviewDeliveryUrl: (url: string) => void;
  reviewNotes: string;
  setReviewNotes: (notes: string) => void;
  reviewUpdateTask: boolean;
  setReviewUpdateTask: (update: boolean) => void;
  isSubmittingReview: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export function ReviewDeliverableModal({
  workOrder,
  reviewStatus,
  setReviewStatus,
  reviewDeliveryUrl,
  setReviewDeliveryUrl,
  reviewNotes,
  setReviewNotes,
  reviewUpdateTask,
  setReviewUpdateTask,
  isSubmittingReview,
  onSubmit,
  onClose,
}: ReviewDeliverableModalProps) {
  return (
    <Dialog onClose={onClose} width={620}>
      <div className="app-dialog-header">
        <div className="flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-accent" />
          <h3 className="outsourcing-modal-title">
            Review Contractor Deliverable
          </h3>
        </div>
      </div>
      <form onSubmit={onSubmit} className="app-dialog-form">
        <div className="app-dialog-body">
          <div className="deliverable-review-box">
            <div className="flex justify-between items-center text-xs">
              <span className="text-content-neutral-500 font-medium">
                Work Order Scope
              </span>
              <span className="font-semibold text-content-neutral-900">
                {workOrder.scope}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-content-neutral-500 font-medium">
                Subcontractor
              </span>
              <span className="font-medium text-content-neutral-800">
                {workOrder.vendorName}
              </span>
            </div>
            {workOrder.taskTitle && (
              <div className="flex justify-between items-center text-xs pt-1 border-t border-line-neutral-200">
                <span className="text-content-neutral-500 font-medium">
                  Original Task
                </span>
                <span className="font-mono text-content-neutral-900">
                  {workOrder.taskTitle}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center text-xs pt-1 border-t border-line-neutral-200">
              <span className="text-content-neutral-500 font-medium">
                Agreed Fee
              </span>
              <span className="font-mono font-bold text-content-neutral-900">
                {formatCents(workOrder.feeCents, workOrder.currency)}
              </span>
            </div>
          </div>

          <div className="outsourcing-form-group">
            <label className="outsourcing-label">Contractor Work Status</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: "todo", label: "Assigned" },
                { id: "in-progress", label: "In Progress" },
                { id: "review", label: "Under Review" },
                { id: "done", label: "Completed" },
              ].map((s) => {
                const isActive = reviewStatus === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      setReviewStatus(
                        s.id as "todo" | "in-progress" | "review" | "done",
                      )
                    }
                    className={`relative px-2 py-1.5 rounded-lg text-xs font-semibold border transition-colors text-center active:scale-[0.97] ${
                      isActive
                        ? "text-white border-accent"
                        : "bg-surface-neutral-50 border-line-neutral-200 text-content-neutral-700 hover:bg-surface-neutral-100"
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="review-status-pill"
                        transition={SPRING_NAV_GLIDE}
                        className="absolute inset-0 rounded-lg bg-accent shadow-xs"
                      />
                    )}
                    <span className="relative z-10">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="outsourcing-form-group">
            <div className="flex justify-between items-center">
              <label className="outsourcing-label">
                Deliverable URL / Repository / Staging
              </label>
              {reviewDeliveryUrl && formatExternalUrl(reviewDeliveryUrl) && (
                <a
                  href={formatExternalUrl(reviewDeliveryUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => openExternalLink(reviewDeliveryUrl, e)}
                  className="text-xs text-accent hover:underline inline-flex items-center gap-1"
                >
                  <span>Open Link</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
            <input
              type="url"
              value={reviewDeliveryUrl}
              onChange={(e) => setReviewDeliveryUrl(e.target.value)}
              placeholder="https://github.com/org/repo or staging URL"
              className="outsourcing-input font-mono text-xs"
            />
            <p className="text-[11px] text-content-neutral-400">
              Retained with this work order and accessible to the freelancer and
              client.
            </p>
          </div>

          <div className="outsourcing-form-group">
            <label className="outsourcing-label">
              Handover Notes / Verification Summary
            </label>
            <textarea
              rows={3}
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Contractor delivery notes, PR summary, or review verification feedback..."
              className="outsourcing-textarea text-xs"
            />
          </div>

          {workOrder.taskId && (
            <div className="p-3 rounded-xl bg-surface-purple-50/50 border border-line-purple-200/70">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reviewUpdateTask}
                  onChange={(e) => setReviewUpdateTask(e.target.checked)}
                  className="mt-0.5 rounded border-line-purple-300 text-accent focus:ring-accent"
                />
                <div className="text-xs">
                  <span className="font-semibold text-content-purple-900 block">
                    Update original task in Kanban board after review
                  </span>
                  <span className="text-content-purple-700 text-[11px] mt-0.5 block">
                    Syncs the delivered URL and sets the linked task to{" "}
                    {reviewStatus === "done" ? "Done" : "Under Review"}{" "}
                    automatically.
                  </span>
                </div>
              </label>
            </div>
          )}
        </div>
        <div className="app-dialog-footer">
          <Button
            variant="secondary"
            type="button"
            onClick={onClose}
            disabled={isSubmittingReview}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={isSubmittingReview}
          >
            {isSubmittingReview
              ? "Saving..."
              : reviewStatus === "done"
                ? "Accept & Complete Work"
                : "Save Review"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
