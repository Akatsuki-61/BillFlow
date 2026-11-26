"use client";

import React from "react";
import { AlertCircle, CheckCircle2, RotateCcw, X } from "lucide-react";
import { MotionSurface } from "@/components/ui/MotionSurface";

export interface ToastBannerAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

export interface ToastBannerProps {
  message: React.ReactNode;
  variant?: "success" | "info" | "error";
  action?: ToastBannerAction | null;
  onDismiss?: () => void;
  icon?: React.ReactNode;
  showProgress?: boolean;
  durationMs?: number;
  stacked?: boolean;
  className?: string;
}

/**
 * Unified accent-tinted notification toast shared across BillFlow.
 * Carries the active Profile Accent hue, border, shadow, and progress bar
 * in both Light and Dark modes (with crimson semantic styling for errors).
 */
export function ToastBanner({
  message,
  variant = "success",
  action,
  onDismiss,
  icon,
  showProgress = true,
  durationMs = 3600,
  stacked = false,
  className = "",
}: ToastBannerProps) {
  const isError = variant === "error";

  return (
    <MotionSurface
      kind="toast"
      role="status"
      aria-live="polite"
      className={`bf-toast-popup zentra-toast ${
        isError ? "zentra-toast--error" : ""
      } ${
        stacked ? "relative" : "fixed bottom-6 right-6 z-[9999]"
      } text-[13px] font-medium max-w-md min-w-[260px] app-no-drag ${className}`}
    >
      <span className="zentra-toast-icon" aria-hidden="true">
        {icon ??
          (isError ? (
            <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={2} />
          ) : (
            <CheckCircle2
              className="success-confirm-pulse rounded-full w-4 h-4 shrink-0"
              strokeWidth={2}
            />
          ))}
      </span>

      <span className="min-w-0 flex-1 leading-snug">{message}</span>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[9px] text-[11.5px] font-semibold bg-accent/12 hover:bg-accent/20 text-accent transition-colors cursor-pointer border border-border-accent shrink-0"
        >
          {action.icon ?? <RotateCcw className="w-3 h-3" />}
          <span>{action.label}</span>
        </button>
      )}

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="shrink-0 p-1 rounded-full text-content-neutral-500 hover:text-content-neutral-950 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {showProgress && durationMs > 0 && (
        <span
          aria-hidden="true"
          className="zentra-toast-progress"
          style={{ "--toast-duration": `${durationMs}ms` } as React.CSSProperties}
        />
      )}
    </MotionSurface>
  );
}
