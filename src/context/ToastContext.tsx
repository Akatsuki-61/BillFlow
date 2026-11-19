"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";

export type ToastVariant = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  type?: ToastVariant;
  durationMs?: number;
  action?: ToastAction;
}

interface ToastState {
  id: number;
  message: string;
  type: ToastVariant;
  action?: ToastAction;
}

interface ToastContextValue {
  showToast: (
    message: string,
    variantOrOptions?: ToastVariant | ToastOptions,
  ) => void;
  dismissToast: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);

  const dismissToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback(
    (message: string, variantOrOptions?: ToastVariant | ToastOptions) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const opts: ToastOptions =
        typeof variantOrOptions === "string"
          ? { type: variantOrOptions }
          : variantOrOptions || {};
      const type: ToastVariant = opts.type || "success";
      const durationMs = opts.durationMs ?? 3600;
      const id = ++seqRef.current;
      setToast({ id, message, type, action: opts.action });
      if (durationMs > 0) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          setToast((current) => (current?.id === id ? null : current));
        }, durationMs);
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ showToast, dismissToast }),
    [showToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <MotionPresence>
        {toast && (
          <MotionSurface
            key={toast.id}
            kind="toast"
            role="status"
            aria-live="polite"
            className={`bf-toast-popup fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl shadow-[0_14px_30px_-6px_rgba(0,0,0,0.38)] border max-w-md ${
              toast.type === "error"
                ? "bg-surface-rose-950 border-line-rose-800 text-content-rose-100"
                : "bg-surface-neutral-900 border-line-neutral-700 text-white"
            }`}
          >
            {toast.type === "error" ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="success-confirm-pulse rounded-full w-4 h-4 text-content-emerald-400 shrink-0" />
            )}
            <span className="min-w-0 flex-1 leading-snug">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  dismissToast();
                }}
                className="shrink-0 text-xs font-semibold underline underline-offset-2 text-accent hover:opacity-90 cursor-pointer"
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={dismissToast}
              aria-label="Dismiss notification"
              className="shrink-0 p-0.5 rounded-md text-white/60 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </MotionSurface>
        )}
      </MotionPresence>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
