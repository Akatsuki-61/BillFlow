"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type {
  AiDownloadProgressEvent,
  AiExtractedInvoiceDraft,
  AiModelTier,
  AiStatus,
} from "@/types/ai";

interface AiCaptureContextValue {
  isOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  aiStatus: AiStatus | null;
  downloadEvent: AiDownloadProgressEvent | null;
  refreshStatus: () => Promise<void>;
  setTier: (tier: AiModelTier) => Promise<AiStatus | null>;
  downloadEnhancedModel: () => Promise<AiStatus | null>;
  cancelDownload: () => Promise<AiStatus | null>;
  removeEnhancedModel: () => Promise<AiStatus | null>;
  pendingInvoiceDraft: AiExtractedInvoiceDraft | null;
  handoffToInvoice: (draft: AiExtractedInvoiceDraft) => void;
  consumePendingInvoiceDraft: () => AiExtractedInvoiceDraft | null;
}

const AiCaptureContext = createContext<AiCaptureContextValue | null>(null);

export function AiCaptureProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [downloadEvent, setDownloadEvent] =
    useState<AiDownloadProgressEvent | null>(null);
  const [pendingInvoiceDraft, setPendingInvoiceDraft] =
    useState<AiExtractedInvoiceDraft | null>(null);
  const pendingRef = useRef<AiExtractedInvoiceDraft | null>(null);

  const refreshStatus = useCallback(async () => {
    const api = window.billflow?.ai;
    if (!api) return;
    try {
      const next = await api.status();
      setAiStatus(next);
    } catch {
      // Ignore if workspace is locked
    }
  }, []);

  useEffect(() => {
    let active = true;
    void window.billflow?.ai
      ?.status?.()
      .then((next) => {
        if (active) setAiStatus(next);
      })
      .catch(() => {});

    const cleanupProgress = window.billflow?.ai?.onDownloadProgress?.(
      (event) => {
        if (!active) return;
        setDownloadEvent(event);
        setAiStatus((prev) =>
          prev
            ? {
                ...prev,
                downloadState: event.state,
                downloadProgress: event.progress,
                downloadMessage: event.message,
                lastError: event.error ?? null,
              }
            : prev,
        );
        if (event.progress === 100 || event.state !== "downloading") {
          void window.billflow?.ai
            ?.status?.()
            .then((next) => {
              if (active) setAiStatus(next);
            })
            .catch(() => {});
        }
      },
    );

    const handleLocked = () => {
      setIsOpen(false);
      pendingRef.current = null;
      setPendingInvoiceDraft(null);
    };
    const cleanupLock = window.billflow?.onWorkspaceLocked?.(handleLocked);

    return () => {
      active = false;
      cleanupProgress?.();
      cleanupLock?.();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "i"
      ) {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const openDrawer = useCallback(() => {
    setIsOpen(true);
    void refreshStatus();
  }, [refreshStatus]);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleDrawer = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) void refreshStatus();
      return next;
    });
  }, [refreshStatus]);

  const setTier = useCallback(async (tier: AiModelTier) => {
    const api = window.billflow?.ai;
    if (!api) return null;
    const updated = await api.setTier(tier);
    setAiStatus(updated);
    return updated;
  }, []);

  const downloadEnhancedModel = useCallback(async () => {
    const api = window.billflow?.ai;
    if (!api) return null;
    const updated = await api.downloadEnhancedModel();
    setAiStatus(updated);
    return updated;
  }, []);

  const cancelDownload = useCallback(async () => {
    const api = window.billflow?.ai;
    if (!api) return null;
    const updated = await api.cancelDownload();
    setAiStatus(updated);
    return updated;
  }, []);

  const removeEnhancedModel = useCallback(async () => {
    const api = window.billflow?.ai;
    if (!api) return null;
    const updated = await api.removeEnhancedModel();
    setAiStatus(updated);
    setDownloadEvent(null);
    return updated;
  }, []);

  const handoffToInvoice = useCallback(
    (draft: AiExtractedInvoiceDraft) => {
      pendingRef.current = draft;
      setPendingInvoiceDraft(draft);
      setIsOpen(false);
      router.push("/invoices");
    },
    [router],
  );

  const consumePendingInvoiceDraft = useCallback(() => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPendingInvoiceDraft(null);
    return current;
  }, []);

  return (
    <AiCaptureContext.Provider
      value={{
        isOpen,
        openDrawer,
        closeDrawer,
        toggleDrawer,
        aiStatus,
        downloadEvent,
        refreshStatus,
        setTier,
        downloadEnhancedModel,
        cancelDownload,
        removeEnhancedModel,
        pendingInvoiceDraft,
        handoffToInvoice,
        consumePendingInvoiceDraft,
      }}
    >
      {children}
    </AiCaptureContext.Provider>
  );
}

export function useAiCapture() {
  const ctx = useContext(AiCaptureContext);
  if (!ctx) {
    throw new Error("useAiCapture must be used within AiCaptureProvider");
  }
  return ctx;
}
