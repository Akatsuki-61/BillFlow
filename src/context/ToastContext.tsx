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
import { MotionPresence } from "@/components/ui/MotionSurface";
import { ToastBanner } from "@/components/ui/ToastBanner";

export type ToastVariant = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  type?: ToastVariant;
  durationMs?: number;
  action?: ToastAction;
  icon?: React.ReactNode;
  dedupeKey?: string;
  className?: string;
}

interface ToastState {
  id: number;
  message: React.ReactNode;
  type: ToastVariant;
  durationMs: number;
  action?: ToastAction;
  icon?: React.ReactNode;
  dedupeKey?: string;
  className?: string;
}

interface ToastContextValue {
  showToast: (
    message: React.ReactNode,
    variantOrOptions?: ToastVariant | ToastOptions,
  ) => number;
  dismissToast: (id?: number) => void;
}

const MAX_VISIBLE_TOASTS = 5;
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const seqRef = useRef(0);

  const clearTimer = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const dismissToast = useCallback(
    (id?: number) => {
      if (typeof id === "number") {
        clearTimer(id);
        setToasts((prev) => prev.filter((item) => item.id !== id));
        return;
      }
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
      timersRef.current.clear();
      setToasts([]);
    },
    [clearTimer],
  );

  const showToast = useCallback(
    (
      message: React.ReactNode,
      variantOrOptions?: ToastVariant | ToastOptions,
    ): number => {
      const opts: ToastOptions =
        typeof variantOrOptions === "string"
          ? { type: variantOrOptions }
          : variantOrOptions || {};
      const type: ToastVariant = opts.type || "success";
      const durationMs = opts.durationMs ?? 3600;
      const id = ++seqRef.current;

      const nextToast: ToastState = {
        id,
        message,
        type,
        durationMs,
        action: opts.action,
        icon: opts.icon,
        dedupeKey: opts.dedupeKey,
        className: opts.className,
      };

      // Stack newest toast at the top (index 0) and oldest toast at the bottom
      setToasts((prev) => {
        const filtered = opts.dedupeKey
          ? prev.filter((item) => {
              if (item.dedupeKey === opts.dedupeKey) {
                clearTimer(item.id);
                return false;
              }
              return true;
            })
          : prev;
        const next = [nextToast, ...filtered];
        if (next.length > MAX_VISIBLE_TOASTS) {
          for (const dropped of next.slice(MAX_VISIBLE_TOASTS)) {
            clearTimer(dropped.id);
          }
          return next.slice(0, MAX_VISIBLE_TOASTS);
        }
        return next;
      });

      if (durationMs > 0) {
        const timer = setTimeout(() => {
          timersRef.current.delete(id);
          setToasts((prev) => prev.filter((item) => item.id !== id));
        }, durationMs);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [clearTimer],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ showToast, dismissToast }),
    [showToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="bf-toast-stack"
        aria-live="polite"
        aria-relevant="additions removals"
      >
        <MotionPresence>
          {toasts.map((toast) => (
            <ToastBanner
              key={toast.id}
              stacked
              message={toast.message}
              variant={toast.type}
              durationMs={toast.durationMs}
              icon={toast.icon}
              className={toast.className}
              action={
                toast.action
                  ? {
                      label: toast.action.label,
                      onClick: () => {
                        toast.action?.onClick();
                        dismissToast(toast.id);
                      },
                    }
                  : undefined
              }
              onDismiss={() => dismissToast(toast.id)}
            />
          ))}
        </MotionPresence>
      </div>
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
