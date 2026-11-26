"use client";

import React from "react";
import {
  AlertTriangle,
  ArrowUpCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCw,
  X,
} from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { MotionPresence } from "@/components/ui/MotionSurface";
import { Button } from "@/components/ui/Workspace";
import { useAppUpdates } from "@/context/UpdateContext";
import { useIsMac } from "@/lib/platform-shortcuts";

function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UpdateDialog() {
  const {
    isOpen,
    status,
    closeUpdateDialog,
    checkForUpdates,
    downloadUpdate,
    cancelDownload,
    installUpdate,
    openReleasePage,
  } = useAppUpdates();
  const isMac = useIsMac();

  const isChecking = status.state === "checking";
  const isUpToDate = status.state === "up-to-date";
  const isAvailable = status.state === "update-available";
  const isDownloading = status.state === "downloading";
  const isDownloaded = status.state === "downloaded";
  const isInstalling = status.state === "installing";
  const isError = status.state === "error";

  const title = isChecking
    ? "Checking for Updates"
    : isUpToDate
      ? "You're Up to Date"
      : isAvailable
        ? `Update Available`
        : isDownloading
          ? `Downloading Update`
          : isDownloaded
            ? `Ready to Install`
            : isInstalling
              ? "Installing Update"
              : isError
                ? "Update Check Failed"
                : "Software Update";

  const subtitle =
    isAvailable && status.latestVersion
      ? `BillFlow v${status.latestVersion} is ready to download (currently v${status.currentVersion}).`
      : isDownloading && status.latestVersion
        ? `Downloading BillFlow v${status.latestVersion} from GitHub Releases.`
        : isDownloaded && status.latestVersion
          ? `BillFlow v${status.latestVersion} has been verified and is ready to install.`
          : `Installed version: BillFlow v${status.currentVersion}`;

  const iconToneClass =
    isUpToDate || isDownloaded
      ? "!bg-emerald-500/12 !text-emerald-600 dark:!text-emerald-400"
      : isError
        ? "!bg-rose-500/12 !text-rose-600 dark:!text-rose-400"
        : "";

  return (
    <MotionPresence>
      {isOpen && (
        <Dialog onClose={closeUpdateDialog} width={500}>
          <div className="app-dialog-header">
            <div className="flex items-start gap-3.5 min-w-0">
              <div
                className={`w-10 h-10 flex items-center justify-center shrink-0 ${iconToneClass}`}
                aria-hidden="true"
              >
                {isChecking || isInstalling ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isUpToDate || isDownloaded ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : isError ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <ArrowUpCircle className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="!text-[20px] !font-semibold !leading-tight">
                  {title}
                </h2>
                <p className="!mt-1 tabular-nums">{subtitle}</p>
              </div>
            </div>
          </div>

          <div className="app-dialog-body space-y-4">
            {/* Checking state */}
            {isChecking && (
              <div className="rounded-2xl border border-line-neutral-200 bg-surface-neutral-50 px-4 py-4 text-[13px] text-content-neutral-600 flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-accent shrink-0" />
                <span>
                  Contacting GitHub Releases for the latest BillFlow build…
                </span>
              </div>
            )}

            {/* Up-to-date state */}
            {isUpToDate && (
              <div className="rounded-2xl border border-line-neutral-200 bg-surface-neutral-50 p-4 space-y-3">
                <p className="text-[13px] text-content-neutral-700 leading-relaxed">
                  Your application is up to date. You&apos;re running the latest
                  release of BillFlow.
                </p>
                <div className="pt-2.5 border-t border-line-neutral-200/70 flex items-center justify-between gap-3 text-xs text-content-neutral-500">
                  <span>Current version</span>
                  <span className="font-mono font-medium text-content-neutral-800 tabular-nums">
                    v{status.currentVersion}
                  </span>
                </div>
              </div>
            )}

            {/* Update available state */}
            {isAvailable && (
              <div className="space-y-3.5">
                <div className="rounded-2xl border border-line-neutral-200 bg-surface-neutral-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-content-neutral-900 tabular-nums">
                    v{status.currentVersion} → v{status.latestVersion}
                  </span>
                  {status.asset && status.asset.sizeBytes > 0 && (
                    <span className="text-content-neutral-500 tabular-nums">
                      {status.asset.name} · {formatSize(status.asset.sizeBytes)}
                    </span>
                  )}
                </div>

                {status.releaseNotes && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-content-neutral-400">
                      What&apos;s New
                    </p>
                    <div className="rounded-2xl border border-line-neutral-200 bg-surface-neutral-50 p-3.5 text-xs text-content-neutral-700 whitespace-pre-wrap max-h-52 overflow-y-auto leading-relaxed">
                      {status.releaseNotes}
                    </div>
                  </div>
                )}

                {!status.asset && (
                  <p className="text-xs text-content-neutral-500 leading-relaxed">
                    No automatic installer for this platform was attached to
                    this release. Open GitHub Releases to download it manually.
                  </p>
                )}
              </div>
            )}

            {/* Downloading state */}
            {isDownloading && (
              <div className="rounded-2xl border border-line-neutral-200 bg-surface-neutral-50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium text-content-neutral-800 truncate">
                    {status.message || "Downloading update…"}
                  </span>
                  <span className="font-mono font-semibold text-accent tabular-nums shrink-0">
                    {status.downloadProgress}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-neutral-200 overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-[width] duration-200"
                    style={{ width: `${Math.max(3, status.downloadProgress)}%` }}
                  />
                </div>
                {status.totalBytes > 0 && (
                  <p className="text-[11.5px] text-content-neutral-500 tabular-nums">
                    {formatSize(status.downloadedBytes)} of{" "}
                    {formatSize(status.totalBytes)}
                  </p>
                )}
              </div>
            )}

            {/* Downloaded & ready to install state */}
            {isDownloaded && (
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-4 space-y-1.5 text-[13px] text-content-neutral-800 leading-relaxed">
                <p className="font-medium text-content-neutral-950">
                  {status.message ||
                    `BillFlow v${status.latestVersion} is ready to install.`}
                </p>
                <p className="text-xs text-content-neutral-600">
                  {isMac
                    ? status.canInstallInPlace
                      ? "BillFlow will close, update the app in place, and relaunch automatically."
                      : "BillFlow will open the downloaded disk image so you can drag it into Applications."
                    : "BillFlow will close and launch the Windows installer to upgrade in place."}
                </p>
              </div>
            )}

            {/* Installing state */}
            {isInstalling && (
              <div className="rounded-2xl border border-line-neutral-200 bg-surface-neutral-50 px-4 py-4 text-[13px] text-content-neutral-600 flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-accent shrink-0" />
                <span>Applying update and restarting BillFlow…</span>
              </div>
            )}

            {/* Error state */}
            {isError && (
              <div className="rounded-2xl border border-rose-500/25 bg-rose-500/8 px-4 py-3.5 text-xs text-rose-700 dark:text-rose-200 leading-relaxed">
                {status.error || "Could not complete the update check."}
              </div>
            )}
          </div>

          <div className="app-dialog-footer !justify-between">
            <button
              type="button"
              onClick={() => void openReleasePage()}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-content-neutral-500 hover:text-content-neutral-900 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>GitHub Releases</span>
            </button>

            <div className="flex items-center gap-2.5">
              {isDownloading ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  onClick={() => void cancelDownload()}
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </Button>
              ) : isAvailable ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="small"
                    onClick={closeUpdateDialog}
                  >
                    <span>Later</span>
                  </Button>
                  {status.asset ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="small"
                      onClick={() => void downloadUpdate()}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Update</span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="primary"
                      size="small"
                      onClick={() => void openReleasePage()}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Download on GitHub</span>
                    </Button>
                  )}
                </>
              ) : isDownloaded ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="small"
                    onClick={closeUpdateDialog}
                  >
                    <span>Later</span>
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="small"
                    onClick={() => void installUpdate()}
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>
                      {status.canInstallInPlace
                        ? "Install & Restart"
                        : "Install Update"}
                    </span>
                  </Button>
                </>
              ) : (
                <>
                  {!isChecking && !isInstalling && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="small"
                      onClick={() => void checkForUpdates()}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{isError ? "Try Again" : "Check Again"}</span>
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="primary"
                    size="small"
                    disabled={isInstalling}
                    onClick={closeUpdateDialog}
                  >
                    <span>Done</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </Dialog>
      )}
    </MotionPresence>
  );
}
