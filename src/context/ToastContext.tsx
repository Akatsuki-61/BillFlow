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
          <ToastBanner
            key={toast.id}
            message={toast.message}
            variant={toast.type}
            action={
              toast.action
                ? {
                    label: toast.action.label,
                    onClick: () => {
                      toast.action?.onClick();
                      dismissToast();
                    },
                  }
                : undefined
            }
            onDismiss={dismissToast}
          />
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
