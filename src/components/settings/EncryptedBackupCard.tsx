"use client";

import React, { useEffect, useState } from "react";
import {
  Bell,
  CheckCircle2,
  FolderOpen,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { MotionPresence } from "@/components/ui/MotionSurface";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Workspace";
import { useData, useSettings } from "@/lib/data/DataProvider";
import { useToast } from "@/context/ToastContext";
import type {
  FinancialDigestSummary,
  RollingBackupStatus,
} from "@/types/settings";

export function EncryptedBackupCard() {
  const { showToast } = useToast();
  const { isElectron } = useData();
  const { settings, updateSettings, refresh } = useSettings();

  const [rollingStatus, setRollingStatus] = useState<RollingBackupStatus | null>(
    null,
  );
  const [digestSummary, setDigestSummary] =
    useState<FinancialDigestSummary | null>(null);
  const [passphraseInput, setPassphraseInput] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  // Manual encrypted export modal
  const [showManualExport, setShowManualExport] = useState(false);
  const [manualPassphrase, setManualPassphrase] = useState("");
  const [manualPassphraseConfirm, setManualPassphraseConfirm] = useState("");

  // Encrypted restore modal
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreSelection, setRestoreSelection] = useState<{
    token: string;
    fileName: string;
    fileSize: number;
  } | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [restoreMode, setRestoreMode] = useState<"replace" | "merge">("replace");
  const [restorePreview, setRestorePreview] = useState<{
    importedClients: number;
    importedInvoices: number;
    exportedAt: string;
    receiptsCount: number;
  } | null>(null);

  useEffect(() => {
    if (!isElectron || typeof window === "undefined") return;
    let active = true;
    const load = async () => {
      try {
        const [rb, dg] = await Promise.all([
          window.billflow?.settings?.getRollingBackupStatus?.() ?? null,
          window.billflow?.digest?.summary?.() ?? null,
        ]);
        if (!active) return;
        if (rb) setRollingStatus(rb);
        if (dg) setDigestSummary(dg);
      } catch {
        // Non-fatal in preview or locked state
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [isElectron, settings]);

  const handleToggleDigest = async (enabled: boolean) => {
    try {
      await updateSettings({ digestEnabled: enabled });
      showToast(
        enabled
          ? "Morning financial digest enabled."
          : "Morning financial digest paused.",
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not update digest setting.",
        "error",
      );
    }
  };

  const handleSendTestDigest = async () => {
    if (!window.billflow?.digest?.sendTest) return;
    setIsBusy(true);
    try {
      const res = await window.billflow.digest.sendTest();
      setDigestSummary(res.summary);
      showToast(res.summary.headline);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not send digest.",
        "error",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleChooseRollingFolder = async () => {
    if (!window.billflow?.settings?.chooseRollingBackupDirectory) return;
    try {
      const dir = await window.billflow.settings.chooseRollingBackupDirectory();
      if (!dir) return;
      const updated = await window.billflow.settings.configureRollingBackup?.({
        directory: dir,
      });
      if (updated) setRollingStatus(updated);
      await refresh(["settings"]);
      showToast("Rolling encrypted backup folder selected.");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not select backup folder.",
        "error",
      );
    }
  };

  const handleConfigureRolling = async (patch: {
    enabled?: boolean;
    retention?: number;
    intervalHours?: number;
    passphrase?: string;
    clearPassphrase?: boolean;
  }) => {
    if (!window.billflow?.settings?.configureRollingBackup) return;
    setIsBusy(true);
    try {
      const updated =
        await window.billflow.settings.configureRollingBackup(patch);
      setRollingStatus(updated);
      if (patch.passphrase) setPassphraseInput("");
      await refresh(["settings"]);
      showToast(
        patch.passphrase
          ? "Encrypted backup passphrase saved to OS keychain."
          : patch.clearPassphrase
            ? "Stored backup passphrase removed."
            : "Rolling backup schedule updated.",
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not update backup settings.",
        "error",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleRunRollingNow = async () => {
    if (!window.billflow?.settings?.runRollingBackupNow) return;
    setIsBusy(true);
    try {
      const res = await window.billflow.settings.runRollingBackupNow(
        passphraseInput.trim() || undefined,
      );
      setRollingStatus(res.status);
      await refresh(["settings", "backupStatus"]);
      showToast(
        res.filePath
          ? `Saved ${res.filePath.split(/[\\/]/).pop()}`
          : "Rolling encrypted backup complete.",
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Rolling backup failed.",
        "error",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveManualEncrypted = async (e: React.FormEvent) => {
    e.preventDefault();
    if (manualPassphrase.length < 8) {
      showToast("Use a passphrase of at least 8 characters.", "error");
      return;
    }
    if (manualPassphrase !== manualPassphraseConfirm) {
      showToast("Passphrases do not match.", "error");
      return;
    }
    if (!window.billflow?.settings?.saveEncryptedBackup) return;
    setIsBusy(true);
    try {
      const res =
        await window.billflow.settings.saveEncryptedBackup(manualPassphrase);
      if (res.success && res.filePath) {
        setShowManualExport(false);
        setManualPassphrase("");
        setManualPassphraseConfirm("");
        await refresh(["backupStatus"]);
        showToast(
          `Saved encrypted backup ${res.filePath.split(/[\\/]/).pop() || ""}`,
        );
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not save encrypted backup.",
        "error",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleChooseRestoreFile = async () => {
    if (!window.billflow?.settings?.chooseEncryptedBackupFile) return;
    try {
      const res = await window.billflow.settings.chooseEncryptedBackupFile();
      if (res.canceled) return;
      setRestoreSelection({
        token: res.token,
        fileName: res.fileName,
        fileSize: res.fileSize,
      });
      setRestorePreview(null);
      setRestorePassphrase("");
      setShowRestoreModal(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not read backup file.",
        "error",
      );
    }
  };

  const handlePreflightRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreSelection || !window.billflow?.settings?.preflightEncryptedBackup)
      return;
    setIsBusy(true);
    try {
      const preview = await window.billflow.settings.preflightEncryptedBackup(
        restoreSelection.token,
        restorePassphrase,
        restoreMode,
      );
      setRestorePreview(preview);
    } catch (err) {
      setRestorePreview(null);
      showToast(
        err instanceof Error ? err.message : "Incorrect passphrase or invalid file.",
        "error",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreSelection || !window.billflow?.settings?.restoreEncryptedBackup)
      return;
    setIsBusy(true);
    try {
      const result = await window.billflow.settings.restoreEncryptedBackup(
        restoreSelection.token,
        restorePassphrase,
        restoreMode,
      );
      setShowRestoreModal(false);
      setRestoreSelection(null);
      setRestorePreview(null);
      setRestorePassphrase("");
      await refresh();
      showToast(
        `Restored ${result.importedClients} clients and ${result.importedInvoices} invoices from encrypted backup.`,
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Restore failed.",
        "error",
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Startup Database Health & Morning Financial Digest */}
      <div className="ui-card p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold text-content-neutral-900">
                Morning Financial Digest &amp; Startup Check
              </h2>
            </div>
            <p className="text-xs text-content-neutral-500 mt-0.5">
              Fires one local OS notification on startup when invoices are overdue, tasks are due today, or vendor payouts approach, and updates the app badge count.
            </p>
          </div>
          {isElectron && rollingStatus && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                rollingStatus.dbQuickCheckOk
                  ? "bg-surface-emerald-50 text-content-emerald-700 border-line-emerald-200"
                  : "bg-surface-amber-50 text-content-amber-700 border-line-amber-200"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>
                {rollingStatus.dbQuickCheckOk
                  ? "SQLite quick_check: Passed"
                  : "SQLite check pending"}
              </span>
            </span>
          )}
        </div>

        <div className="p-3.5 rounded-xl bg-surface-neutral-50 border border-line-neutral-200/80 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2.5 text-xs font-semibold text-content-neutral-800 cursor-pointer">
            <input
              type="checkbox"
              disabled={!isElectron}
              checked={settings?.digestEnabled !== false}
              onChange={(e) => void handleToggleDigest(e.target.checked)}
              className="rounded border-line-neutral-300 text-accent"
            />
            <span>Show daily financial briefing once per day</span>
          </label>
          <Button
            type="button"
            variant="secondary"
            disabled={!isElectron || isBusy}
            onClick={() => void handleSendTestDigest()}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Send Test Digest</span>
          </Button>
        </div>

        {digestSummary && (
          <div className="rounded-xl border border-line-neutral-200 p-3 text-xs text-content-neutral-700 space-y-1">
            <p className="font-semibold text-content-neutral-900">
              {digestSummary.headline}
            </p>
            <p className="text-content-neutral-500">{digestSummary.body}</p>
          </div>
        )}
      </div>

      {/* Rolling AES-256-GCM Encrypted Backups */}
      <div className="ui-card p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold text-content-neutral-900">
                Rolling AES-256-GCM Encrypted Backups
              </h2>
            </div>
            <p className="text-xs text-content-neutral-500 mt-0.5">
              Automatically encrypt and rotate gzip-compressed `.bfbackup` snapshots into a local or synced folder (iCloud Drive, Dropbox, OneDrive).
            </p>
          </div>
          {rollingStatus?.enabled && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-emerald-50 text-content-emerald-700 border border-line-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{rollingStatus.backupCount} snapshots retained</span>
            </span>
          )}
        </div>

        {/* Folder & Enable Row */}
        <div className="p-3.5 rounded-xl bg-surface-neutral-50 border border-line-neutral-200/80 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <FolderOpen className="w-4 h-4 text-content-neutral-400 shrink-0" />
              <span className="text-xs font-mono text-content-neutral-700 truncate">
                {rollingStatus?.directory || "No rolling backup folder chosen"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={!isElectron || isBusy}
                onClick={() => void handleChooseRollingFolder()}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Choose Folder</span>
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={
                  !isElectron || isBusy || !rollingStatus?.directory
                }
                onClick={() => void handleRunRollingNow()}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Run Now</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-line-neutral-200/60">
            <label className="flex items-center gap-2 text-xs font-semibold text-content-neutral-800 cursor-pointer">
              <input
                type="checkbox"
                disabled={
                  !isElectron ||
                  !rollingStatus?.directory ||
                  !rollingStatus?.hasPassphrase ||
                  isBusy
                }
                checked={Boolean(rollingStatus?.enabled)}
                onChange={(e) =>
                  void handleConfigureRolling({ enabled: e.target.checked })
                }
                className="rounded border-line-neutral-300 text-accent"
              />
              <span>Enable automatic rotation</span>
            </label>

            <label className="flex items-center justify-between gap-2 text-xs text-content-neutral-700">
              <span>Interval:</span>
              <select
                disabled={!isElectron || isBusy}
                value={String(rollingStatus?.intervalHours ?? 24)}
                onChange={(e) =>
                  void handleConfigureRolling({
                    intervalHours: Number.parseInt(e.target.value, 10),
                  })
                }
                className="ui-field px-2.5 text-xs"
              >
                <option value="6">Every 6 hours</option>
                <option value="12">Every 12 hours</option>
                <option value="24">Every 24 hours</option>
                <option value="72">Every 3 days</option>
                <option value="168">Weekly</option>
              </select>
            </label>

            <label className="flex items-center justify-between gap-2 text-xs text-content-neutral-700">
              <span>Keep latest:</span>
              <select
                disabled={!isElectron || isBusy}
                value={String(rollingStatus?.retention ?? 10)}
                onChange={(e) =>
                  void handleConfigureRolling({
                    retention: Number.parseInt(e.target.value, 10),
                  })
                }
                className="ui-field px-2.5 text-xs"
              >
                <option value="5">5 files</option>
                <option value="10">10 files</option>
                <option value="20">20 files</option>
                <option value="30">30 files</option>
              </select>
            </label>
          </div>
        </div>

        {/* OS Keychain Passphrase Row */}
        <div className="p-3.5 rounded-xl border border-line-neutral-200 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-content-neutral-800">
              <KeyRound className="w-3.5 h-3.5 text-accent" />
              <span>Encryption Passphrase</span>
            </div>
            {rollingStatus?.hasPassphrase ? (
              <span className="text-[11px] font-semibold text-content-emerald-700">
                Stored securely in OS keychain
              </span>
            ) : (
              <span className="text-[11px] text-content-neutral-500">
                {rollingStatus?.safeStorageAvailable === false
                  ? "OS keychain unavailable; pass a passphrase manually on Run Now"
                  : "Set a passphrase (min 8 chars) to enable scheduled backups"}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="password"
              value={passphraseInput}
              onChange={(e) => setPassphraseInput(e.target.value)}
              placeholder={
                rollingStatus?.hasPassphrase
                  ? "Enter new passphrase to rotate..."
                  : "Minimum 8 characters..."
              }
              className="ui-field flex-1 min-w-[200px] px-3 text-xs"
            />
            {rollingStatus?.safeStorageAvailable !== false && (
              <Button
                type="button"
                variant="secondary"
                disabled={!isElectron || passphraseInput.length < 8 || isBusy}
                onClick={() =>
                  void handleConfigureRolling({ passphrase: passphraseInput })
                }
              >
                Save to Keychain
              </Button>
            )}
            {rollingStatus?.hasPassphrase && (
              <Button
                type="button"
                variant="ghost"
                disabled={!isElectron || isBusy}
                onClick={() =>
                  void handleConfigureRolling({
                    clearPassphrase: true,
                    enabled: false,
                  })
                }
              >
                Remove Key
              </Button>
            )}
          </div>
          {rollingStatus?.lastRunAt && (
            <p className="text-[11px] text-content-neutral-500">
              Last rolling backup: {new Date(rollingStatus.lastRunAt).toLocaleString()}
            </p>
          )}
        </div>

        {/* Manual Encrypted Export & Restore */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <Button
            type="button"
            variant="secondary"
            disabled={!isElectron || isBusy}
            onClick={() => setShowManualExport(true)}
            className="w-full"
          >
            <Lock className="w-3.5 h-3.5 text-accent" />
            <span>Save Encrypted Backup (.bfbackup)</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!isElectron || isBusy}
            onClick={() => void handleChooseRestoreFile()}
            className="w-full"
          >
            <Upload className="w-3.5 h-3.5 text-accent" />
            <span>Restore Encrypted Backup (.bfbackup)</span>
          </Button>
        </div>
      </div>

      {/* Save Manual Encrypted Backup Dialog */}
      <MotionPresence>
        {showManualExport && (
          <Dialog onClose={() => setShowManualExport(false)} width={440} compact>
            <div className="app-dialog-header">
              <div>
                <h3 className="text-base font-semibold text-content-neutral-900">
                  Save Encrypted Backup
                </h3>
                <p className="text-xs text-content-neutral-500">
                  Your `.bfbackup` file uses AES-256-GCM encryption. Keep this passphrase safe; lost passphrases cannot be recovered.
                </p>
              </div>
            </div>
            <form onSubmit={handleSaveManualEncrypted} className="app-dialog-form">
              <div className="app-dialog-body space-y-3">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-content-neutral-700">
                    Passphrase (min 8 characters)
                  </span>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={manualPassphrase}
                    onChange={(e) => setManualPassphrase(e.target.value)}
                    className="ui-field w-full px-3 text-xs"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-content-neutral-700">
                    Confirm Passphrase
                  </span>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={manualPassphraseConfirm}
                    onChange={(e) => setManualPassphraseConfirm(e.target.value)}
                    className="ui-field w-full px-3 text-xs"
                  />
                </label>
              </div>
              <div className="app-dialog-footer">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowManualExport(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isBusy}>
                  {isBusy ? "Encrypting..." : "Choose Location & Save"}
                </Button>
              </div>
            </form>
          </Dialog>
        )}
      </MotionPresence>

      {/* Restore Encrypted Backup Dialog */}
      <MotionPresence>
        {showRestoreModal && restoreSelection && (
          <Dialog onClose={() => setShowRestoreModal(false)} width={480}>
            <div className="app-dialog-header">
              <div>
                <h3 className="text-base font-semibold text-content-neutral-900">
                  Restore Encrypted Backup
                </h3>
                <p className="text-xs text-content-neutral-500 mt-0.5">
                  File: <strong>{restoreSelection.fileName}</strong>
                </p>
              </div>
            </div>
            <form onSubmit={handlePreflightRestore} className="app-dialog-form">
              <div className="app-dialog-body space-y-3">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="small"
                    variant={restoreMode === "replace" ? "primary" : "secondary"}
                    onClick={() => {
                      setRestoreMode("replace");
                      setRestorePreview(null);
                    }}
                  >
                    Replace Workspace
                  </Button>
                  <Button
                    type="button"
                    size="small"
                    variant={restoreMode === "merge" ? "primary" : "secondary"}
                    onClick={() => {
                      setRestoreMode("merge");
                      setRestorePreview(null);
                    }}
                  >
                    Merge Records
                  </Button>
                </div>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-content-neutral-700">
                    Backup Passphrase
                  </span>
                  <input
                    type="password"
                    required
                    value={restorePassphrase}
                    onChange={(e) => {
                      setRestorePassphrase(e.target.value);
                      setRestorePreview(null);
                    }}
                    placeholder="Enter backup passphrase..."
                    className="ui-field w-full px-3 text-xs"
                  />
                </label>

                {restorePreview && (
                  <div className="p-3 rounded-xl bg-surface-emerald-50 border border-line-emerald-200 text-xs text-content-emerald-900 space-y-1">
                    <p className="font-semibold">
                      Verified backup exported{" "}
                      {restorePreview.exportedAt
                        ? new Date(restorePreview.exportedAt).toLocaleString()
                        : ""}
                    </p>
                    <p>
                      Contains {restorePreview.importedClients} clients,{" "}
                      {restorePreview.importedInvoices} invoices, and{" "}
                      {restorePreview.receiptsCount} receipt files.
                    </p>
                  </div>
                )}
              </div>
              <div className="app-dialog-footer">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowRestoreModal(false)}
                >
                  Cancel
                </Button>
                {!restorePreview ? (
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isBusy || restorePassphrase.length < 8}
                  >
                    {isBusy ? "Verifying..." : "Decrypt & Verify"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    disabled={isBusy}
                    onClick={() => void handleConfirmRestore()}
                  >
                    {isBusy ? "Restoring..." : "Confirm & Restore"}
                  </Button>
                )}
              </div>
            </form>
          </Dialog>
        )}
      </MotionPresence>
    </div>
  );
}
