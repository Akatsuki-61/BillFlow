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
import packageJson from "../../package.json";
import type { AppUpdateStatus } from "@/types/updates";

const FALLBACK_STATUS: AppUpdateStatus = {
  state: "idle",
  currentVersion: packageJson.version,
  latestVersion: null,
  releaseName: null,
  releaseNotes: null,
  releaseUrl: "https://github.com/Akatsuki-61/BillFlow/releases",
  publishedAt: null,
  asset: null,
  downloadedFilePath: null,
  downloadProgress: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  message: "",
  error: null,
  lastCheckedAt: null,
  canInstallInPlace: false,
};

interface UpdateContextValue {
  isOpen: boolean;
  status: AppUpdateStatus;
  openUpdateDialog: (autoCheck?: boolean) => void;
  closeUpdateDialog: () => void;
  checkForUpdates: () => Promise<AppUpdateStatus>;
  downloadUpdate: () => Promise<AppUpdateStatus>;
  cancelDownload: () => Promise<AppUpdateStatus>;
  installUpdate: () => Promise<void>;
  openReleasePage: () => Promise<void>;
}

const UpdateContext = createContext<UpdateContextValue | null>(null);

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<AppUpdateStatus>(FALLBACK_STATUS);
  const statusRef = useRef<AppUpdateStatus>(FALLBACK_STATUS);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const checkForUpdates = useCallback(async (): Promise<AppUpdateStatus> => {
    const api = window.billflow?.updates;
    if (!api) {
      const previewStatus: AppUpdateStatus = {
        ...FALLBACK_STATUS,
        state: "up-to-date",
        latestVersion: FALLBACK_STATUS.currentVersion,
        message: "Your application is up to date.",
        lastCheckedAt: new Date().toISOString(),
      };
      setStatus(previewStatus);
      return previewStatus;
    }
    setStatus((prev) => ({
      ...prev,
      state: "checking",
      error: null,
      message: "Checking GitHub Releases for updates…",
    }));
    try {
      const next = await api.check();
      setStatus(next);
      return next;
    } catch (err) {
      const failed: AppUpdateStatus = {
        ...statusRef.current,
        state: "error",
        error:
          err instanceof Error
            ? err.message
            : "Could not check for updates right now.",
        message: "Update check failed.",
      };
      setStatus(failed);
      return failed;
    }
  }, []);

  const openUpdateDialog = useCallback(
    (autoCheck = true) => {
      setIsOpen(true);
      if (autoCheck) {
        const api = window.billflow?.updates;
        if (!api) {
          void checkForUpdates();
          return;
        }
        void api
          .status()
          .then((current) => {
            setStatus(current);
            if (
              current.state !== "downloading" &&
              current.state !== "downloaded" &&
              current.state !== "installing"
            ) {
              void checkForUpdates();
            }
          })
          .catch(() => {
            void checkForUpdates();
          });
      }
    },
    [checkForUpdates],
  );

  const closeUpdateDialog = useCallback(() => {
    setIsOpen(false);
  }, []);

  const downloadUpdate = useCallback(async (): Promise<AppUpdateStatus> => {
    const api = window.billflow?.updates;
    if (!api) return statusRef.current;
    try {
      const next = await api.download();
      setStatus(next);
      return next;
    } catch (err) {
      const failed: AppUpdateStatus = {
        ...statusRef.current,
        state: "error",
        error:
          err instanceof Error ? err.message : "Failed to download update.",
        message: "Update download failed.",
      };
      setStatus(failed);
      return failed;
    }
  }, []);

  const cancelDownload = useCallback(async (): Promise<AppUpdateStatus> => {
    const api = window.billflow?.updates;
    if (!api) return statusRef.current;
    const next = await api.cancel();
    setStatus(next);
    return next;
  }, []);

  const installUpdate = useCallback(async (): Promise<void> => {
    const api = window.billflow?.updates;
    if (!api) return;
    try {
      await api.install();
    } catch (err) {
      setStatus((prev) => ({
        ...prev,
        state: "error",
        error:
          err instanceof Error ? err.message : "Could not launch update installer.",
        message: "Installation failed.",
      }));
    }
  }, []);

  const openReleasePage = useCallback(async (): Promise<void> => {
    const api = window.billflow?.updates;
    if (api) {
      await api.openReleasePage();
      return;
    }
    window.open(statusRef.current.releaseUrl, "_blank", "noopener,noreferrer");
  }, []);

  useEffect(() => {
    let active = true;
    void window.billflow?.updates
      ?.status?.()
      .then((initial) => {
        if (active && initial) setStatus(initial);
      })
      .catch(() => {});

    const cleanupStatus = window.billflow?.updates?.onStatusChanged?.(
      (next) => {
        if (active) setStatus(next);
      },
    );

    const cleanupOpen = window.billflow?.updates?.onOpenDialog?.(() => {
      if (active) openUpdateDialog(true);
    });

    const cleanupLock = window.billflow?.onWorkspaceLocked?.(() => {
      if (active) setIsOpen(false);
    });

    return () => {
      active = false;
      cleanupStatus?.();
      cleanupOpen?.();
      cleanupLock?.();
    };
  }, [openUpdateDialog]);

  const value = useMemo<UpdateContextValue>(
    () => ({
      isOpen,
      status,
      openUpdateDialog,
      closeUpdateDialog,
      checkForUpdates,
      downloadUpdate,
      cancelDownload,
      installUpdate,
      openReleasePage,
    }),
    [
      isOpen,
      status,
      openUpdateDialog,
      closeUpdateDialog,
      checkForUpdates,
      downloadUpdate,
      cancelDownload,
      installUpdate,
      openReleasePage,
    ],
  );

  return (
    <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>
  );
}

export function useAppUpdates() {
  const ctx = useContext(UpdateContext);
  if (!ctx) {
    throw new Error("useAppUpdates must be used within UpdateProvider");
  }
  return ctx;
}
