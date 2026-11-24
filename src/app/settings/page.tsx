"use client";
import { WorkspaceActivityPanel } from "@/components/ui/WorkspaceActivityPanel";
import { localDateKey } from "@/lib/visual-metrics";
import { CurrencyRateSettings } from "@/context/ReportingContext";
import { AppearanceFields, FinancialDigestSettings } from "@/components/settings/WorkspaceAppearance";
import { SignatureEditor } from "@/components/settings/SignatureEditor";
import { PhoneField } from "@/components/ui/PhoneField";
import {
  WorkspaceProfileFields,
  type WorkspaceProfileDraft,
} from "@/components/settings/WorkspaceProfileFields";

import { useWorkspaceCommand } from "@/lib/use-workspace-command";
import { MAX_BACKUP_BYTES } from "@/lib/backup-limits";
import { formatShortcut, useIsMac } from "@/lib/platform-shortcuts";

import { Dialog } from "@/components/ui/Dialog";

import { Button, PageHeader } from "@/components/ui/Workspace";

import React, {
  useState,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  Suspense,
} from "react";
import {
  IconCrossfade,
  MotionPresence,
  MotionSurface,
} from "@/components/ui/MotionSurface";
import { m } from "motion/react";
import { SPRING_NAV_GLIDE } from "@/lib/motion";
import {
  User,
  Receipt,
  Database,
  Palette,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  FolderOpen,
  Download,
  Upload,
  AlertTriangle,
  Save,
  Hash,
  Sun,
  Moon,
  Monitor,
  Eye,
  Sparkles,
} from "lucide-react";
import { AiSettingsPanel } from "@/components/settings/AiSettingsPanel";
import { useSettings, useData } from "@/lib/data/DataProvider";
import {
  APPLICATION_RESET_CONFIRMATION,
  type AppSettings,
  type UpdateSettingsInput,
  type ExportDataPayload,
} from "@/types/settings";
import { useTheme } from "@/context/ThemeContext";
import { useProfiles } from "@/context/ProfileContext";
import { useSearchParams } from "next/navigation";
import type {
  Currency,
  InvoiceTemplateId,
  InvoiceWithClient,
} from "@/types/billing";
import dynamic from "next/dynamic";
import { profileStorageKey } from "@/lib/profile-scope";
import { InvoiceTemplateMiniPreview } from "@/components/settings/InvoiceTemplateMiniPreview";

const InvoiceDocumentSheet = dynamic(
  () => import("@/components/invoices/InvoiceDocumentSheet"),
  { ssr: false },
);
const EncryptedBackupCard = dynamic(
  () =>
    import("@/components/settings/EncryptedBackupCard").then(
      (m) => m.EncryptedBackupCard,
    ),
  { ssr: false, loading: () => null },
);

type SettingsTab = "profile" | "invoices" | "ai" | "data" | "appearance";

const INVOICE_TEMPLATE_OPTIONS: Array<{
  id: InvoiceTemplateId;
  name: string;
  summary: string;
  surfaceLabel: string;
  color: string;
}> = [
  {
    id: "geometric-teal",
    name: "Geometric Teal",
    summary: "Teal & slate header on white",
    surfaceLabel: "Light",
    color: "#00A887",
  },
  {
    id: "executive-wave",
    name: "Executive Wave",
    summary: "Charcoal wave & amber table",
    surfaceLabel: "Light",
    color: "#EAA828",
  },
  {
    id: "scarlet-modern",
    name: "Scarlet Modern",
    summary: "Split red header & dotted rows",
    surfaceLabel: "Light",
    color: "#E5252A",
  },
  {
    id: "apex-orange",
    name: "Apex Orange",
    summary: "Orange header & grid table",
    surfaceLabel: "Light",
    color: "#F25C05",
  },
  {
    id: "noir-crimson",
    name: "Noir Crimson",
    summary: "Dark page with red pill rows",
    surfaceLabel: "Dark",
    color: "#D9383A",
  },
];

type ResetScope = "profile" | "application";

const RESET_CONFIRMATION = {
  profile: "DELETE PROFILE RECORDS",
  application: APPLICATION_RESET_CONFIRMATION,
};

function settingsDraft(settings: AppSettings | null): UpdateSettingsInput {
  return {
    businessName: settings?.businessName ?? "",
    professionalTitle: settings?.professionalTitle ?? "",
    email: settings?.email ?? "",
    phone: settings?.phone ?? "",
    website: settings?.website ?? "",
    taxId: settings?.taxId ?? "",
    address: settings?.address ?? "",
    paymentDetails: settings?.paymentDetails ?? "",
    defaultCurrency: settings?.defaultCurrency ?? "USD",
    invoicePrefix: settings?.invoicePrefix ?? "INV-",
    nextInvoiceSeq: settings?.nextInvoiceSeq ?? 1,
    defaultDueDays: settings?.defaultDueDays ?? 14,
    defaultTaxRate: settings?.defaultTaxRate ?? 0,
    defaultNotes: settings?.defaultNotes ?? "",
    defaultInvoiceTemplate: settings?.defaultInvoiceTemplate ?? "geometric-teal",
    dateFormat: settings?.dateFormat ?? "YYYY-MM-DD",
    currencyDisplay: settings?.currencyDisplay ?? "symbol",
    pdfExportDirectory: settings?.pdfExportDirectory || null,
    defaultDeliveryUrl: settings?.defaultDeliveryUrl || null,
    signatureData: settings?.signatureData ?? null,
    typeface: settings?.typeface ?? null,
    layoutDensity: settings?.layoutDensity ?? null,
    notificationPlacement: settings?.notificationPlacement ?? null,
  };
}

function changedSettings(draft: UpdateSettingsInput, saved: AppSettings | null) {
  const baseline = settingsDraft(saved);
  return Object.fromEntries(
    (Object.keys(baseline) as Array<keyof UpdateSettingsInput>)
      .filter((key) => draft[key] !== baseline[key])
      .map((key) => [key, draft[key]]),
  ) as UpdateSettingsInput;
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const initialTab: SettingsTab = [
    "profile",
    "invoices",
    "ai",
    "data",
    "appearance",
  ].includes(requestedTab || "")
    ? (requestedTab as SettingsTab)
    : "profile";
  const { workflow, isElectron, error: dataError } = useData();
  const isMac = useIsMac();
  const { preference, setPreference, ready } = useTheme();
  const { activeProfile, updateProfile, refreshProfiles } = useProfiles();
  const {
    settings,
    isLoading,
    updateSettings,
    getDbPath,
    revealDbFile,
    backupStatus,
    importData,
    resetData,
    refresh: refreshWorkspace,
  } = useSettings();

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  useWorkspaceCommand("section", (section) => {
    if (!["profile", "invoices", "ai", "data", "appearance"].includes(section))
      return false;
    setActiveTab(section as SettingsTab);
    return true;
  });
  const [previousRequestedTab, setPreviousRequestedTab] =
    useState(requestedTab);
  if (previousRequestedTab !== requestedTab) {
    setPreviousRequestedTab(requestedTab);
    setActiveTab(initialTab);
  }
  const [dbPath, setDbPath] = useState<string>("");
  const [copiedPath, setCopiedPath] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const [formState, setFormState] = useState(() => settingsDraft(settings));
  const [profileDraft, setProfileDraft] = useState<WorkspaceProfileDraft>({});

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDraggingBackup, setIsDraggingBackup] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedImport, setParsedImport] = useState<ExportDataPayload | null>(
    null,
  );
  const [selectedDiskBackup, setSelectedDiskBackup] = useState<{
    token: string;
    fileName: string;
    importedClients: number;
    importedInvoices: number;
    receiptsCount: number;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isValidatingImport, setIsValidatingImport] = useState(false);
  const importReadVersion = useRef(0);
  const [importMode, setImportMode] = useState<"replace" | "merge">("replace");

  const [resetScope, setResetScope] = useState<ResetScope | null>(null);
  const [resetError, setResetError] = useState("");
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [previewTemplateId, setPreviewTemplateId] =
    useState<InvoiceTemplateId | null>(null);

  const [previousSettings, setPreviousSettings] = useState(settings);
  if (previousSettings !== settings) {
    setPreviousSettings(settings);
    setFormState({
      ...settingsDraft(settings),
      ...changedSettings(formState, previousSettings),
    });
  }

  // Load live DB path (re-evaluate when active profile changes)
  useEffect(() => {
    getDbPath()
      .then(setDbPath)
      .catch(() => setDbPath("Local database file"));
  }, [getDbPath, activeProfile.id]);

  const settingsPatch = changedSettings(formState, settings);
  const profilePatch = Object.fromEntries(
    (Object.keys(profileDraft) as Array<keyof WorkspaceProfileDraft>)
      .filter((key) => profileDraft[key] !== (activeProfile[key] ?? null))
      .map((key) => [key, profileDraft[key]]),
  ) as WorkspaceProfileDraft;
  const isDirty =
    Object.keys(settingsPatch).length > 0 || Object.keys(profilePatch).length > 0;

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setNotification({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setNotification(null);
      toastTimerRef.current = null;
    }, 3200);
  };

  const handleCopyPath = () => {
    if (!dbPath) return;
    navigator.clipboard.writeText(dbPath);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
    showToast("File path copied to clipboard", "success");
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!isDirty || isSaving) return;
    setFormErrors({});

    // Validate email if provided
    if (formState.email && formState.email.trim() !== "") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email.trim())) {
        setFormErrors({ email: "Please enter a valid email address." });
        showToast("Please enter a valid email address.", "error");
        return;
      }
    }

    setIsSaving(true);
    try {
      if (Object.keys(profilePatch).length > 0) {
        await updateProfile(activeProfile.id, profilePatch);
        setProfileDraft({});
      }
      if (Object.keys(settingsPatch).length > 0) {
        const saved = await updateSettings(settingsPatch);
        setFormState(settingsDraft(saved));
        await refreshProfiles();
      }
      if (typeof window !== "undefined") {
        localStorage.setItem(
          profileStorageKey("billflow_invoice_template"),
          formState.defaultInvoiceTemplate || "geometric-teal",
        );
      }
      showToast("Profile and settings saved.", "success");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to save settings.";
      showToast(msg, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectInvoiceTemplate = async (templateId: InvoiceTemplateId) => {
    setFormState((prev) => ({
      ...prev,
      defaultInvoiceTemplate: templateId,
    }));
    if (typeof window !== "undefined") {
      localStorage.setItem(
        profileStorageKey("billflow_invoice_template"),
        templateId,
      );
    }
    try {
      await updateSettings({ defaultInvoiceTemplate: templateId });
      const label =
        INVOICE_TEMPLATE_OPTIONS.find((t) => t.id === templateId)?.name ||
        templateId;
      showToast(`Default invoice template set to ${label}.`, "success");
    } catch {
      // Keep draft selection in formState so user can save manually
    }
  };

  const saveFromShortcut = useEffectEvent(() => {
    if (isDirty && !isSaving && !resetScope) formRef.current?.requestSubmit();
  });

  // Keyboard shortcut Cmd+S / Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveFromShortcut();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const [savingBackup, setSavingBackup] = useState(false);
  const handleExportJson = async () => {
    setSavingBackup(true);
    try {
      const result = await window.billflow?.settings.saveBackup();
      if (result?.success)
        showToast("Backup saved to your computer.", "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to export data.";
      showToast(msg, "error");
    } finally {
      setSavingBackup(false);
    }
  };

  const exportWorkspaceCsv = async () => {
    try {
      const result = await window.billflow?.settings.exportCsv();
      if (result?.success) showToast("Workspace CSV saved.");
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Could not export the workspace CSV.",
        "error",
      );
    }
  };
  const handleImportMode = async (mode: "replace" | "merge") => {
    setImportMode(mode);
    if (selectedDiskBackup && window.billflow?.settings?.preflightBackupFile) {
      const version = ++importReadVersion.current;
      setIsValidatingImport(true);
      try {
        const preview = await window.billflow.settings.preflightBackupFile(
          selectedDiskBackup.token,
          mode,
        );
        if (version === importReadVersion.current) {
          setSelectedDiskBackup((prev) =>
            prev
              ? {
                  ...prev,
                  importedClients: preview.importedClients,
                  importedInvoices: preview.importedInvoices,
                }
              : prev,
          );
          setImportError(null);
        }
      } catch (error) {
        if (version === importReadVersion.current)
          setImportError(
            error instanceof Error
              ? error.message
              : "Backup validation failed.",
          );
      } finally {
        if (version === importReadVersion.current) setIsValidatingImport(false);
      }
      return;
    }
    if (!parsedImport) return;
    const version = ++importReadVersion.current;
    setIsValidatingImport(true);
    try {
      await window.billflow?.settings.preflight?.(parsedImport, mode);
      if (version === importReadVersion.current) setImportError(null);
    } catch (error) {
      if (version === importReadVersion.current)
        setImportError(
          error instanceof Error ? error.message : "Backup validation failed.",
        );
    } finally {
      if (version === importReadVersion.current) setIsValidatingImport(false);
    }
  };
  const handleChooseDiskBackup = async () => {
    if (!window.billflow?.settings?.chooseBackupFile) return;
    const version = ++importReadVersion.current;
    setIsValidatingImport(true);
    setImportError(null);
    try {
      const chosen = await window.billflow.settings.chooseBackupFile(importMode);
      if (version !== importReadVersion.current) return;
      if (chosen.canceled) return;
      setImportFile(null);
      setParsedImport(null);
      setSelectedDiskBackup({
        token: chosen.token,
        fileName: chosen.fileName,
        importedClients: chosen.importedClients,
        importedInvoices: chosen.importedInvoices,
        receiptsCount: chosen.receiptsCount,
      });
    } catch (error) {
      if (version !== importReadVersion.current) return;
      setSelectedDiskBackup(null);
      setImportError(
        error instanceof Error ? error.message : "Backup validation failed.",
      );
    } finally {
      if (version === importReadVersion.current) setIsValidatingImport(false);
    }
  };
  const handleDropDiskBackup = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingBackup(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.name.toLowerCase().endsWith(".json")) {
      setImportError("Drop a complete BillFlow backup .json file.");
      return;
    }
    if (!window.billflow?.settings?.stageBackupFile) {
      setImportError("Backup staging is unavailable in this environment.");
      return;
    }
    const version = ++importReadVersion.current;
    setIsValidatingImport(true);
    setImportError(null);
    try {
      const staged = await window.billflow.settings.stageBackupFile(
        file,
        importMode,
      );
      if (version !== importReadVersion.current) return;
      setImportFile(null);
      setParsedImport(null);
      setSelectedDiskBackup({
        token: staged.token,
        fileName: staged.fileName,
        importedClients: staged.importedClients,
        importedInvoices: staged.importedInvoices,
        receiptsCount: staged.receiptsCount,
      });
    } catch (error) {
      if (version !== importReadVersion.current) return;
      setSelectedDiskBackup(null);
      setImportError(
        error instanceof Error ? error.message : "Backup validation failed.",
      );
    } finally {
      if (version === importReadVersion.current) setIsValidatingImport(false);
    }
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const version = ++importReadVersion.current;

    setSelectedDiskBackup(null);
    setParsedImport(null);
    if (file.size > MAX_BACKUP_BYTES) {
      setImportError("Backup must be smaller than 150 MB.");
      return;
    }
    setImportFile(file);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed || typeof parsed !== "object") {
          throw new Error("Invalid backup file format.");
        }
        if (
          parsed.version !== "2" ||
          !parsed.records ||
          !Array.isArray(parsed.files)
        )
          throw new Error("Choose a complete version 2 workflow backup.");
        if (!Array.isArray(parsed.clients) || !Array.isArray(parsed.invoices)) {
          throw new Error("Backup file does not contain clients or invoices.");
        }
        await window.billflow?.settings.preflight?.(
          parsed as ExportDataPayload,
          importMode,
        );
        if (version !== importReadVersion.current) return;
        setParsedImport(parsed as ExportDataPayload);
      } catch (err: unknown) {
        if (version !== importReadVersion.current) return;
        setImportError(
          err instanceof Error ? err.message : "Failed to read backup file.",
        );
        setParsedImport(null);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (selectedDiskBackup && window.billflow?.settings?.importBackupFile) {
      setIsImporting(true);
      try {
        const res = await window.billflow.settings.importBackupFile(
          selectedDiskBackup.token,
          importMode,
        );
        await refreshWorkspace();
        showToast(
          `${importMode === "merge" ? "Merged" : "Restored"} ${res.importedClients} clients and ${res.importedInvoices} invoices.`,
          "success",
        );
        setIsImportModalOpen(false);
        setSelectedDiskBackup(null);
        setImportFile(null);
        setParsedImport(null);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Could not import the backup.";
        setImportError(msg);
        showToast(msg, "error");
      } finally {
        setIsImporting(false);
      }
      return;
    }
    if (!parsedImport) return;
    setIsImporting(true);
    try {
      const res = await importData(parsedImport, importMode);
      showToast(
        `${importMode === "merge" ? "Merged" : "Restored"} ${res.importedClients} clients and ${res.importedInvoices} invoices.`,
        "success",
      );
      setIsImportModalOpen(false);
      setImportFile(null);
      setParsedImport(null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Could not import the backup.";
      setImportError(msg);
      showToast(msg, "error");
    } finally {
      setIsImporting(false);
    }
  };

  const openResetDialog = (scope: ResetScope) => {
    setResetConfirmation("");
    setResetError("");
    setResetScope(scope);
  };

  const handleConfirmReset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resetScope || isResetting || resetConfirmation !== RESET_CONFIRMATION[resetScope]) return;

    setResetError("");
    setIsResetting(true);
    try {
      if (resetScope === "application") {
        if (!window.billflow?.settings.resetApplication) {
          throw new Error("Application reset requires the desktop app.");
        }
        await window.billflow.settings.resetApplication(resetConfirmation);
        return;
      }
      await resetData();
      showToast("Records and managed receipts cleared for this profile.");
      setResetScope(null);
    } catch (err: unknown) {
      setResetError(
        err instanceof Error ? err.message : "Could not clear BillFlow data.",
      );
    }
    setIsResetting(false);
  };

  // Preview generated invoice code
  const previewInvoiceCode = useMemo(() => {
    const year = new Date().getFullYear();
    const prefix = formState.invoicePrefix || "INV-";
    const activePrefix = prefix.includes("{YYYY}")
      ? prefix.replace("{YYYY}", String(year))
      : prefix.endsWith("-")
        ? `${prefix}${year}-`
        : `${prefix}-${year}-`;
    const seq = formState.nextInvoiceSeq || 1;
    return `${activePrefix}${String(seq).padStart(3, "0")}`;
  }, [formState.invoicePrefix, formState.nextInvoiceSeq]);

  const samplePreviewInvoice = useMemo<InvoiceWithClient>(() => {
    const currency = (formState.defaultCurrency || "USD") as Currency;
    const items = [
      {
        id: "sample-item-1",
        invoiceId: "sample-preview",
        description: "Full-Stack Feature Architecture & Implementation",
        quantity: 1,
        unitPriceCents: 180000,
        position: 0,
      },
      {
        id: "sample-item-2",
        invoiceId: "sample-preview",
        description: "API Integration & Automated Test Suite",
        quantity: 1,
        unitPriceCents: 60000,
        position: 1,
      },
    ];
    const subtotalCents = 240000;
    const taxRate = formState.defaultTaxRate ?? 0;
    const taxCents = Math.round((subtotalCents * taxRate) / 100);
    const amountCents = subtotalCents + taxCents;
    const dueDays = formState.defaultDueDays ?? 14;
    const today = new Date();
    const due = new Date(today);
    due.setDate(due.getDate() + dueDays);
    const dueDate = localDateKey(due);

    return {
      id: "sample-preview",
      clientId: "sample-client",
      clientName: "Northstar Digital Labs",
      clientEmail: "billing@northstar.example",
      code: previewInvoiceCode,
      currency,
      amountCents,
      taxCents,
      discountCents: 0,
      advanceCents: Math.round(amountCents * 0.5),
      paidCents: 0,
      status: "UNPAID",
      issueDate: localDateKey(today),
      dueDate,
      notes:
        formState.defaultNotes ||
        "Payment is due within the agreed timeframe. Thank you for working together.",
      businessSnapshot: JSON.stringify({
        businessName: formState.businessName || "Your business",
        professionalTitle:
          formState.professionalTitle || "SOFTWARE FREELANCING & CONSULTING",
        email: formState.email || "",
        phone: formState.phone || "",
        website: formState.website || "",
        taxId: formState.taxId || "",
        address: formState.address || "",
        paymentDetails: formState.paymentDetails || "",
      }),
      items,
      payments: [],
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    };
  }, [
    formState.defaultCurrency,
    formState.defaultTaxRate,
    formState.defaultDueDays,
    formState.defaultNotes,
    formState.businessName,
    formState.professionalTitle,
    formState.email,
    formState.phone,
    formState.website,
    formState.taxId,
    formState.address,
    formState.paymentDetails,
    previewInvoiceCode,
  ]);

  // Initial letter for the avatar
  return (
    <div className="workspace-page settings-page motion-page max-w-none">
      {dataError && (
        <p role="alert" className="ui-card p-4 text-content-red-700">
          {dataError}
        </p>
      )}
      {/* Toast Notification */}
      <MotionPresence>
        {notification && (
          <div className="fixed top-14 right-6 z-[9999] pointer-events-none">
            <MotionSurface
              kind="toast"
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium shadow-[0px_4px_12px_rgba(0,0,0,0.08)] pointer-events-auto ${
                notification.type === "success"
                  ? "bg-surface text-content-emerald-800 border-line-emerald-200"
                  : "bg-surface text-content-rose-800 border-line-rose-200"
              }`}
            >
              {notification.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-content-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-content-rose-600 shrink-0" />
              )}
              <span>{notification.message}</span>
            </MotionSurface>
          </div>
        )}
      </MotionPresence>

      <PageHeader title="Settings" />

      <div className="settings-layout">
        <aside className="settings-sidebar">
          <p className="settings-nav-label">YOUR WORKSPACE</p>
          <nav aria-label="Settings section">
            {(
              [
                {
                  id: "profile",
                  title: "Business profile",
                  detail: "Workspace, contact & payment",
                  icon: User,
                },
                {
                  id: "invoices",
                  title: "Invoice preferences",
                  detail: "Defaults, numbering & PDFs",
                  icon: Receipt,
                },
                {
                  id: "ai",
                  title: "AI & Capture",
                  detail: "Local OCR & model level",
                  icon: Sparkles,
                },
                {
                  id: "appearance",
                  title: "Appearance",
                  detail: "Theme & interface",
                  icon: Palette,
                },
                {
                  id: "data",
                  title: "Backup & data",
                  detail: "Storage, backups & reset",
                  icon: Database,
                },
              ] as const
            ).map(({ id, title, detail, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => {
                    setActiveTab(id);
                    document.querySelector("main.workspace-scroll")?.scrollTo({
                      top: 0,
                      behavior: window.matchMedia(
                        "(prefers-reduced-motion: reduce)",
                      ).matches
                        ? "instant"
                        : "smooth",
                    });
                  }}
                >
                  {isActive && (
                    <m.span
                      layoutId="settings-nav-active-pill"
                      transition={SPRING_NAV_GLIDE}
                      className="settings-nav-active-pill"
                    />
                  )}
                  <span className="settings-nav-icon relative z-10">
                    <Icon size={19} />
                  </span>
                  <span className="relative z-10">
                    <strong>{title}</strong>
                    <small>{detail}</small>
                  </span>
                </button>
              );
            })}
          </nav>
          <div className="settings-local-note">
            <Database size={16} />
            <span>
              {isElectron ? "Stored on this device" : "Browser preview"}
              <small>
                {isElectron
                  ? "Your work stays with you."
                  : "Desktop storage is available in the app."}
              </small>
            </span>
          </div>
        </aside>
        {/* Main Content Area */}
        <div className="workspace-form settings-content w-full max-w-none">
          <div key={activeTab} className="settings-section-heading">
            <h2>
              {activeTab === "profile"
                ? "Business profile"
                : activeTab === "invoices"
                  ? "Invoice preferences"
                  : activeTab === "ai"
                    ? "AI & Smart Capture"
                    : activeTab === "appearance"
                      ? "Appearance"
                      : "Backup & data"}
            </h2>
            <p>
              {activeTab === "profile"
                ? "Manage the active workspace and the business details shown on invoices."
                : activeTab === "invoices"
                  ? "Set up the starting point for your next invoice."
                  : activeTab === "ai"
                    ? "Choose between built-in offline AI and the optional downloadable local LLM."
                    : activeTab === "appearance"
                      ? "Customize how BillFlow looks and feels."
                      : "Manage your local storage, backups, and reset options."}
            </p>
          </div>
          <form ref={formRef} onSubmit={handleSave} className="settings-section space-y-6">
          {activeTab === "ai" ? (
            <AiSettingsPanel onNotify={showToast} />
          ) : activeTab === "appearance" ? (
            <div className="settings-section space-y-6">
              <AppearanceFields
                value={formState}
                onChange={(patch) =>
                  setFormState((previous) => ({ ...previous, ...patch }))
                }
              />
              <section
                className="ui-card p-5 flex flex-wrap items-center justify-between gap-4"
                aria-labelledby="appearance-heading"
              >
                <div>
                  <h2
                    id="appearance-heading"
                    className="text-base font-semibold text-content-neutral-900"
                  >
                    Color theme
                  </h2>
                  <p className="text-sm text-content-neutral-500 mt-1">
                    Choose a theme. System follows your device’s appearance.
                  </p>
                  <p
                    className="text-xs text-content-neutral-500 mt-1"
                    role="status"
                  >
                    Changes save automatically on this device.
                  </p>
                </div>
                {ready && (
                  <div
                    className="theme-options"
                    role="group"
                    aria-label="Color theme"
                  >
                    {(
                      [
                        { value: "light", label: "Light", icon: Sun },
                        { value: "dark", label: "Dark", icon: Moon },
                        { value: "system", label: "System", icon: Monitor },
                      ] as const
                    ).map(({ value, label, icon: Icon }) => (
                      <button
                        type="button"
                        key={value}
                        aria-pressed={preference === value}
                        onClick={(e) =>
                          setPreference(value, { trigger: e.currentTarget })
                        }
                      >
                        <div
                          className={`theme-preview theme-preview--${value}`}
                          aria-hidden="true"
                        >
                          <span />
                          <div>
                            <i />
                            <i />
                            <i />
                          </div>
                        </div>
                        <span>
                          <Icon size={14} />
                          {label}
                          {preference === value && <Check size={14} />}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
              <FinancialDigestSettings />
            </div>
          ) : isLoading ? (
            <div className="bg-surface rounded-2xl border border-line-neutral-200/80 p-8 space-y-6 animate-pulse">
              <div className="h-6 w-36 bg-surface-neutral-200 rounded-md" />
              <div className="h-10 w-full bg-surface-neutral-100 rounded-lg" />
              <div className="h-10 w-full bg-surface-neutral-100 rounded-lg" />
            </div>
          ) : (
            <>
              {/* TAB 1: MY PROFILE */}
              {activeTab === "profile" && (
                <div className="settings-section space-y-6">
                  <WorkspaceProfileFields
                    draft={profileDraft}
                    settings={formState}
                    onProfileChange={(patch) =>
                      setProfileDraft((previous) => ({ ...previous, ...patch }))
                    }
                    onSettingsChange={(patch) =>
                      setFormState((previous) => ({ ...previous, ...patch }))
                    }
                  />
                  {/* Basic Personal Info */}
                  <div className="ui-card p-6 space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-content-neutral-900">
                        Invoice contact details
                      </h2>
                      <p className="text-xs text-content-neutral-500 mt-0.5">
                        Enter your name and contact details. These will appear
                        at the top of every invoice you send to clients.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="settings-your-name-or-studio-name"
                          className="block text-xs font-medium text-content-neutral-700 mb-1"
                        >
                          Business or studio name
                        </label>
                        <input
                          id="settings-your-name-or-studio-name"
                          type="text"
                          value={formState.businessName || ""}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              businessName: e.target.value,
                            })
                          }
                          placeholder="e.g. Alex Rivera or Apex Studio"
                          className="ui-field w-full px-3.5 border border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="settings-what-do-you-do-title"
                          className="block text-xs font-medium text-content-neutral-700 mb-1"
                        >
                          Professional title
                        </label>
                        <input
                          id="settings-what-do-you-do-title"
                          type="text"
                          value={formState.professionalTitle || ""}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              professionalTitle: e.target.value,
                            })
                          }
                          placeholder="e.g. Software Developer & AI Consultant"
                          className="ui-field w-full px-3.5 border border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="settings-email-address"
                          className="block text-xs font-medium text-content-neutral-700 mb-1"
                        >
                          Email Address
                        </label>
                        <input
                          id="settings-email-address"
                          type="email"
                          value={formState.email || ""}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              email: e.target.value,
                            })
                          }
                          placeholder="alex@example.com"
                          className={`ui-field w-full px-3.5 py-2 text-sm bg-surface-neutral-50/50 border rounded-xl focus:bg-surface outline-none transition-colors ${
                            formErrors.email
                              ? "border-line-rose-400 focus:ring-line-rose-400"
                              : "border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent"
                          }`}
                        />
                        {formErrors.email && (
                          <p className="text-xs text-content-rose-600 mt-1">
                            {formErrors.email}
                          </p>
                        )}
                      </div>

                      <PhoneField
                        label="Business phone number"
                        value={formState.phone || ""}
                        onChange={(phone) =>
                          setFormState((previous) => ({ ...previous, phone }))
                        }
                      />

                      <div className="sm:col-span-2">
                        <label htmlFor="settings-website" className="block text-xs font-medium text-content-neutral-700 mb-1">
                          Website or Portfolio{" "}
                          <span className="text-content-neutral-400 font-normal">
                            (Optional)
                          </span>
                        </label>
                        <input
                          id="settings-website"
                          type="text"
                          value={formState.website || ""}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              website: e.target.value,
                            })
                          }
                          placeholder="https://yourportfolio.com"
                          className="ui-field w-full px-3.5 border border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Address & Tax Number */}
                  <div className="ui-card p-6 space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-content-neutral-900">
                        Address & Tax Information
                      </h2>
                      <p className="text-xs text-content-neutral-500 mt-0.5">
                        Optional details if you want your physical location or
                        tax registration number printed on invoices.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="settings-your-address-or-city"
                          className="block text-xs font-medium text-content-neutral-700 mb-1"
                        >
                          Your Address or City
                        </label>
                        <textarea
                          id="settings-your-address-or-city"
                          rows={3}
                          value={formState.address || ""}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              address: e.target.value,
                            })
                          }
                          placeholder="123 Innovation Way&#10;San Francisco, CA 94105"
                          className="ui-field ui-textarea w-full px-3.5 border border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors resize-none leading-relaxed"
                        />
                      </div>

                      <div>
                        <label htmlFor="settings-tax-id" className="block text-xs font-medium text-content-neutral-700 mb-1">
                          Tax / Business Number{" "}
                          <span className="text-content-neutral-400 font-normal">
                            (Optional)
                          </span>
                        </label>
                        <input
                          id="settings-tax-id"
                          type="text"
                          value={formState.taxId || ""}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              taxId: e.target.value,
                            })
                          }
                          placeholder="e.g. VAT or Tax ID number"
                          className="ui-field w-full px-3.5 border border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                        />
                        <p className="text-[11px] text-content-neutral-400 mt-1.5 leading-relaxed">
                          Leave blank if you are not registered for VAT or sales
                          tax.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Where Clients Send Payment */}
                  <div className="ui-card p-6 space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-content-neutral-900">
                        How Clients Pay You
                      </h2>
                      <p className="text-xs text-content-neutral-500 mt-0.5">
                        Add your bank details, Wise link, or PayPal address.
                        These instructions will be printed at the bottom of your
                        invoices.
                      </p>
                    </div>

                    <div>
                      <textarea
                        rows={4}
                        value={formState.paymentDetails || ""}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            paymentDetails: e.target.value,
                          })
                        }
                        placeholder={
                          "Bank: Chase / Wise&#10;Account Name: Alex Carter&#10;Account No: 1234 5678 9012&#10;PayPal or Wise Tag: alex@example.com"
                        }
                        className="ui-field ui-textarea w-full px-3.5 border border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors resize-none font-mono leading-relaxed"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: INVOICES */}
              {activeTab === "invoices" && (
                <div className="settings-section space-y-6">
                  <section className="ui-card space-y-4 p-6">
                    <h2 className="text-sm font-semibold">
                      Delivery and signature
                    </h2>
                    <label className="block space-y-1 text-xs font-medium">
                      <span>Default delivery destination</span>
                      <input
                        type="url"
                        value={formState.defaultDeliveryUrl ?? ""}
                        placeholder="https://"
                        className="ui-field w-full"
                        onChange={(event) =>
                          setFormState((previous) => ({
                            ...previous,
                            defaultDeliveryUrl: event.target.value || null,
                          }))
                        }
                      />
                    </label>
                    <SignatureEditor
                      value={formState.signatureData}
                      onChange={(signatureData) =>
                        setFormState((previous) => ({
                          ...previous,
                          signatureData,
                        }))
                      }
                    />
                  </section>
                  {/* Default Invoice Template */}
                  <div className="ui-card p-6 space-y-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold text-content-neutral-900">
                          Default Invoice Design Template
                        </h2>
                        <p className="text-xs text-content-neutral-500 mt-0.5">
                          Pick the page layout used for invoice previews and
                          exported PDFs.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          setPreviewTemplateId(
                            formState.defaultInvoiceTemplate ||
                              "geometric-teal",
                          )
                        }
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Preview template
                      </Button>
                    </div>

                    <div
                      role="radiogroup"
                      aria-label="Default Invoice Design Template"
                      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5"
                    >
                      {INVOICE_TEMPLATE_OPTIONS.map((tmpl) => {
                        const isSelected =
                          (formState.defaultInvoiceTemplate ||
                            "geometric-teal") === tmpl.id;
                        return (
                          <div
                            key={tmpl.id}
                            className={`group relative flex flex-col rounded-xl border transition-all duration-150 ${
                              isSelected
                                ? "border-accent bg-accent/[0.04] ring-2 ring-accent/20"
                                : "border-line-neutral-200 dark:border-white/10 hover:border-line-neutral-300 dark:hover:border-white/20 bg-surface"
                            }`}
                          >
                            <button
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              onClick={() =>
                                void handleSelectInvoiceTemplate(tmpl.id)
                              }
                              className="flex flex-col flex-1 text-left p-3 rounded-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            >
                              {/* Miniature A4 Sheet Preview */}
                              <div className="relative w-full aspect-[180/232] rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-white shadow-[0px_2px_6px_rgba(0,0,0,0.08)] mb-3 transition-transform duration-200 group-hover:scale-[1.01]">
                                <InvoiceTemplateMiniPreview
                                  templateId={tmpl.id}
                                />
                              </div>

                              {/* Template Title & Summary */}
                              <div className="flex items-center gap-2 min-w-0 mb-1">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: tmpl.color }}
                                />
                                <span className="text-xs font-semibold text-content-neutral-900 truncate">
                                  {tmpl.name}
                                </span>
                              </div>

                              <p className="text-[11px] text-content-neutral-500 leading-snug mb-3">
                                {tmpl.summary}
                              </p>

                              {/* Status Footer */}
                              <div className="mt-auto pt-2.5 border-t border-line-neutral-200/60 dark:border-white/10 flex items-center justify-between gap-1.5">
                                {isSelected ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent">
                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                    <span>Active default</span>
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-medium text-content-neutral-400 group-hover:text-content-neutral-700 transition-colors">
                                    Set as default
                                  </span>
                                )}
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-neutral-100 text-content-neutral-500">
                                  {tmpl.surfaceLabel}
                                </span>
                              </div>
                            </button>

                            {/* Quick Full-Size Preview Trigger */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewTemplateId(tmpl.id);
                              }}
                              title={`Preview ${tmpl.name}`}
                              aria-label={`Preview ${tmpl.name} template`}
                              className="absolute top-5 right-5 z-10 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-neutral-900/80 text-white backdrop-blur-sm border border-white/15 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-neutral-900 transition-opacity cursor-pointer shadow-sm"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Preview</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Invoice PDF Folder */}
                  <div className="ui-card p-6 space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-content-neutral-900">
                        Invoice PDF Folder
                      </h2>
                      <p className="text-xs text-content-neutral-500 mt-0.5">
                        Choose where exported invoice PDFs are saved on your
                        computer.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-surface-neutral-50 border border-line-neutral-200/80">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FolderOpen className="w-4 h-4 text-content-neutral-400 shrink-0" />
                        <span className="text-xs font-mono text-content-neutral-700 truncate">
                          {formState.pdfExportDirectory ||
                            "Downloads (default)"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={!isElectron || isSaving}
                          onClick={async () => {
                            try {
                              const folder =
                                await workflow.files.selectPdfDirectory();
                              if (folder)
                                setFormState((previous) => ({
                                  ...previous,
                                  pdfExportDirectory: folder,
                                }));
                            } catch (error) {
                              showToast(
                                error instanceof Error
                                  ? error.message
                                  : "Could not select folder",
                                "error",
                              );
                            }
                          }}
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          Choose folder
                        </Button>
                        {formState.pdfExportDirectory && (
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={isSaving}
                            onClick={() =>
                              setFormState((previous) => ({
                                ...previous,
                                pdfExportDirectory: null,
                              }))
                            }
                          >
                            Reset to Downloads
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <CurrencyRateSettings />
                  <div className="ui-card space-y-4">
                    <div>
                      <h2 className="font-semibold text-content-neutral-900">
                        Payment terms
                      </h2>
                      <p className="text-content-neutral-600">
                        Set the due date offset and tax rate for new invoices.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="settings-payment-due-within"
                          className="block text-xs font-medium text-content-neutral-700 mb-1"
                        >
                          Payment Due Within
                        </label>
                        <select
                          id="settings-payment-due-within"
                          value={String(formState.defaultDueDays ?? 14)}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              defaultDueDays: parseInt(e.target.value, 10),
                            })
                          }
                          className="ui-field w-full px-3.5 border border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                        >
                          <option value="0">Due on Receipt (Immediate)</option>
                          <option value="7">7 Days</option>
                          <option value="14">14 Days (Recommended)</option>
                          <option value="30">30 Days</option>
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="settings-default-tax-rate"
                          className="block text-xs font-medium text-content-neutral-700 mb-1"
                        >
                          Default Tax Rate (%)
                        </label>
                        <div className="relative">
                          <input
                            id="settings-default-tax-rate"
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={formState.defaultTaxRate ?? 0}
                            onChange={(e) =>
                              setFormState({
                                ...formState,
                                defaultTaxRate: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="ui-field w-full px-3.5 border border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                          />
                          <span className="absolute right-3.5 top-2 text-sm text-content-neutral-400 pointer-events-none">
                            %
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Invoice Numbers */}
                  <div className="ui-card p-6 space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-content-neutral-900">
                        Invoice Numbering
                      </h2>
                      <p className="text-xs text-content-neutral-500 mt-0.5">
                        BillFlow automatically generates unique, sequential
                        numbers for each invoice.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="settings-next-number"
                          className="block text-xs font-medium text-content-neutral-700 mb-1"
                        >
                          Next Number
                        </label>
                        <input
                          id="settings-next-number"
                          type="number"
                          min="1"
                          value={formState.nextInvoiceSeq || 1}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              nextInvoiceSeq: Math.max(
                                1,
                                parseInt(e.target.value, 10) || 1,
                              ),
                            })
                          }
                          className="ui-field w-full px-3.5 border border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors font-mono"
                        />
                        <p className="text-[11px] text-content-neutral-400 mt-1">
                          Change this if you want to start from a specific
                          number.
                        </p>
                      </div>
                    </div>

                    {/* Visual Preview */}
                    <div className="p-4 rounded-xl bg-surface-purple-50/60 border border-line-purple-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-accent" />
                        <span className="text-xs font-medium text-content-purple-950">
                          Your next invoice will be:
                        </span>
                      </div>
                      <span className="font-mono text-xs font-semibold text-accent px-3 py-1 bg-surface rounded-lg border border-line-purple-200 shadow-xs">
                        {previewInvoiceCode}
                      </span>
                    </div>
                  </div>

                  {/* Default Note */}
                  <div className="ui-card p-6 space-y-3">
                    <div>
                      <h2 className="text-sm font-semibold text-content-neutral-900">
                        Default Note to Clients
                      </h2>
                      <p className="text-xs text-content-neutral-500 mt-0.5">
                        Friendly text included at the bottom of all your
                        invoices.
                      </p>
                    </div>

                    <div>
                      <textarea
                        rows={3}
                        value={formState.defaultNotes || ""}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            defaultNotes: e.target.value,
                          })
                        }
                        placeholder="Thank you for your business! Please reach out if you have any questions regarding this invoice."
                        className="ui-field ui-textarea w-full px-3.5 border border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors resize-none leading-relaxed"
                      />
                    </div>
                  </div>
                  <WorkspaceActivityPanel />
                </div>
              )}

              {/* TAB 3: BACKUP & DATA */}
              {activeTab === "data" && (
                <div className="settings-section space-y-6">
                  {/* Local Storage Card */}
                  <div className="ui-card p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-content-neutral-900">
                          Offline & Private Storage
                        </h2>
                        <p className="text-xs text-content-neutral-500 mt-0.5">
                          {isElectron
                            ? "Your business records and receipts are stored on this computer in the BillFlow app."
                            : "You are viewing the browser preview. Open the desktop app to manage its SQLite database and complete backups."}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-emerald-50 text-content-emerald-700 border border-line-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-surface-emerald-500" />
                        {isElectron ? "Saved Locally" : "Browser Preview"}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-surface-neutral-50 border border-line-neutral-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-medium text-content-neutral-400 block uppercase tracking-wider">
                          Database File Location
                        </span>
                        <code className="text-xs font-mono text-content-neutral-800 block truncate mt-0.5">
                          {dbPath || "Loading database path..."}
                        </code>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="secondary"
                          type="button"
                          disabled={!isElectron}
                          onClick={handleCopyPath}
                        >
                          <IconCrossfade
                            iconKey={copiedPath ? "copied" : "copy"}
                            className="w-3.5 h-3.5"
                          >
                            {copiedPath ? (
                              <Check className="w-3.5 h-3.5 text-content-emerald-600 success-confirm-pulse rounded-full" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-content-neutral-500" />
                            )}
                          </IconCrossfade>
                          {copiedPath ? "Copied" : "Copy Path"}
                        </Button>

                        <Button
                          variant="secondary"
                          type="button"
                          disabled={!isElectron}
                          onClick={() => revealDbFile()}
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          Open Folder
                        </Button>
                      </div>
                    </div>
                  </div>

                  <section className="ui-card flex flex-wrap items-center justify-between gap-3 p-6">
                    <div>
                      <h2 className="text-sm font-semibold">Workspace CSV</h2>
                      <p className="text-xs text-content-neutral-600">
                        Export record data in a single spreadsheet file.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      disabled={!isElectron}
                      onClick={() => void exportWorkspaceCsv()}
                    >
                      <Download className="w-4 h-4" /> Export Workspace CSV
                    </Button>
                  </section>
                  {/* Backup & Restore */}
                  <div className="ui-card p-6 space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-content-neutral-900">
                        Backup & Restore
                      </h2>
                      <p className="text-xs text-content-neutral-500 mt-0.5">
                        Save a copy of your records or restore from an earlier
                        backup file.
                      </p>
                    </div>

                    {isElectron && backupStatus && (
                      <div
                        className="rounded-xl border border-line-neutral-200 p-3 text-xs text-content-neutral-700"
                        role="status"
                      >
                        <p className="font-medium">
                          {backupStatus.lastBackupAt
                            ? `Last backup ${new Date(backupStatus.lastBackupAt).toLocaleString()}`
                            : "No backup saved yet"}
                        </p>
                        {backupStatus.lastBackupAt && (
                          <p className="mt-1">
                            {backupStatus.hasChanges
                              ? "Workspace changed since this backup."
                              : "Backup is up to date."}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl border border-line-neutral-200 flex flex-col justify-between gap-3 bg-surface-neutral-50/30">
                        <div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-content-neutral-900">
                            <Download className="w-4 h-4 text-accent" />
                            Download Backup File
                          </div>
                          <p className="text-xs text-content-neutral-500 mt-1 leading-relaxed">
                            Saves all workflow records, profile settings and
                            receipt files into one complete backup.
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          type="button"
                          disabled={!isElectron || savingBackup}
                          onClick={handleExportJson}
                          className="w-full"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Save Backup
                        </Button>
                      </div>

                      <div className="p-4 rounded-xl border border-line-neutral-200 flex flex-col justify-between gap-3 bg-surface-neutral-50/30">
                        <div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-content-neutral-900">
                            <Upload className="w-4 h-4 text-accent" />
                            Restore from Backup
                          </div>
                          <p className="text-xs text-content-neutral-500 mt-1 leading-relaxed">
                            Replace business records and profile settings with a
                            complete backup, including managed receipts.
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          type="button"
                          disabled={!isElectron}
                          onClick={() => {
                            setImportFile(null);
                            setParsedImport(null);
                            setSelectedDiskBackup(null);
                            setImportError(null);
                            setIsImportModalOpen(true);
                          }}
                          className="w-full"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Choose File to Restore
                        </Button>
                      </div>
                    </div>
                  </div>

                  <EncryptedBackupCard />

                  <section className="ui-card ui-card--danger space-y-4" aria-labelledby="reset-data-heading">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="size-5 shrink-0 text-content-rose-600" aria-hidden="true" />
                      <h2 id="reset-data-heading" className="font-semibold text-content-rose-950">
                        Reset data
                      </h2>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-rose-200 pt-4">
                      <div>
                        <h3 className="text-sm font-semibold text-content-rose-950">Active profile records</h3>
                        <p className="mt-1 text-content-rose-700">
                          Delete business records and managed receipts for {activeProfile.name}. Keep its settings and passcode.
                        </p>
                      </div>
                      <Button variant="danger" type="button" disabled={!isElectron} onClick={() => openResetDialog("profile")}>
                        Clear profile records
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-rose-200 pt-4">
                      <div>
                        <h3 className="text-sm font-semibold text-content-rose-950">Entire application</h3>
                        <p className="mt-1 text-content-rose-700">
                          Delete every profile, all records, receipts, and local preferences. BillFlow restarts at first-time setup.
                        </p>
                      </div>
                      <Button
                        variant="danger"
                        type="button"
                        disabled={!isElectron}
                        onClick={() => openResetDialog("application")}
                      >
                        Clear full application
                      </Button>
                    </div>
                  </section>
                </div>
              )}
            </>
          )}

              {/* Floating Save Bar */}
              <MotionPresence>
                {isDirty && (
                  <div className="sticky bottom-6 z-20">
                    <MotionSurface
                      kind="panel"
                      className="bg-surface/95 backdrop-blur-md border border-line-neutral-200/90 rounded-2xl p-4 shadow-[0px_12px_24px_-6px_rgba(0,0,0,0.1),0px_0px_0px_1px_rgba(0,0,0,0.06)] flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-accent-solid animate-pulse" />
                        <span className="text-xs font-medium text-content-neutral-800">
                          You have unsaved changes
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <Button
                          variant="ghost"
                          type="button"
                          onClick={() => {
                            setFormState(settingsDraft(settings));
                            setProfileDraft({});
                            setFormErrors({});
                          }}
                        >
                          Discard
                        </Button>

                        <Button
                          variant="primary"
                          type="submit"
                          title={formatShortcut("Cmd+S", isMac)}
                          disabled={isSaving}
                        >
                          <Save className="w-3.5 h-3.5" />
                          {isSaving ? "Saving..." : "Save changes"}
                        </Button>
                      </div>
                    </MotionSurface>
                  </div>
                )}
              </MotionPresence>
          </form>
        </div>
      </div>

      {/* RESTORE MODAL */}
      <MotionPresence>
        {isImportModalOpen && (
          <Dialog onClose={() => setIsImportModalOpen(false)} width={560}>
            <div className="app-dialog-header app-dialog-header--stack">
              <h3 className="text-base font-semibold text-content-neutral-900">
                Restore Data from Backup
              </h3>
              <p className="text-xs text-content-neutral-500 mt-1">
                Select a complete backup, then choose how to import its records.
              </p>
            </div>
            <div className="app-dialog-body">
              <div className="space-y-3">
                {window.billflow?.settings?.chooseBackupFile ? (
                  <button
                    type="button"
                    onClick={() => void handleChooseDiskBackup()}
                    onDragOver={(e) => {
                      if (e.dataTransfer?.types?.includes("Files")) {
                        e.preventDefault();
                        setIsDraggingBackup(true);
                      }
                    }}
                    onDragLeave={(e) => {
                      if (
                        !e.currentTarget.contains(
                          e.relatedTarget as Node | null,
                        )
                      ) {
                        setIsDraggingBackup(false);
                      }
                    }}
                    onDrop={(e) => void handleDropDiskBackup(e)}
                    className={`w-full block border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                      isDraggingBackup
                        ? "border-accent bg-accent-faint/40"
                        : "border-line-neutral-200 hover:border-accent bg-surface-neutral-50/50"
                    }`}
                  >
                    <Upload className="w-5 h-5 text-content-neutral-400 mx-auto mb-1.5" />
                    <span className="text-xs font-medium text-content-neutral-700 block">
                      {isDraggingBackup
                        ? "Drop backup .json file here"
                        : selectedDiskBackup
                          ? selectedDiskBackup.fileName
                          : "Select or drop backup .json file"}
                    </span>
                  </button>
                ) : (
                  <label className="block border-2 border-dashed border-line-neutral-200 hover:border-accent rounded-xl p-5 text-center cursor-pointer transition-colors bg-surface-neutral-50/50">
                    <Upload className="w-5 h-5 text-content-neutral-400 mx-auto mb-1.5" />
                    <span className="text-xs font-medium text-content-neutral-700 block">
                      {importFile ? importFile.name : "Select backup .json file"}
                    </span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}

                {importError && (
                  <div className="p-3 rounded-xl bg-surface-rose-50 border border-line-rose-200 text-xs text-content-rose-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{importError}</span>
                  </div>
                )}

                <fieldset className="space-y-2 text-sm">
                  <legend className="mb-2 font-medium">Import mode</legend>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="backup-import-mode"
                      checked={importMode === "replace"}
                      onChange={() => void handleImportMode("replace")}
                    />{" "}
                    Replace workspace records
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="backup-import-mode"
                      checked={importMode === "merge"}
                      onChange={() => void handleImportMode("merge")}
                    />{" "}
                    Merge into this workspace
                  </label>
                  <p className="text-xs text-content-neutral-600">
                    {importMode === "merge"
                      ? "Adds new records, skips identical records and keeps current workspace settings. Conflicts stop the import."
                      : "Replaces the active workspace records and settings."}
                  </p>
                </fieldset>
                {(selectedDiskBackup || parsedImport) && (
                  <div className="p-3.5 rounded-xl bg-surface-purple-50 border border-line-purple-100 text-xs text-content-purple-950 space-y-1">
                    <div className="font-semibold text-accent">
                      Records, links and receipt hashes verified
                    </div>
                    <div className="text-content-neutral-700">
                      Contains{" "}
                      <strong>
                        {selectedDiskBackup
                          ? selectedDiskBackup.importedClients
                          : parsedImport?.clients?.length || 0}{" "}
                        clients
                      </strong>{" "}
                      and{" "}
                      <strong>
                        {selectedDiskBackup
                          ? selectedDiskBackup.importedInvoices
                          : parsedImport?.invoices?.length || 0}{" "}
                        invoices
                      </strong>
                      .
                    </div>
                    <p>
                      {selectedDiskBackup ? (
                        <>{selectedDiskBackup.receiptsCount} receipts</>
                      ) : (
                        <>
                          {parsedImport?.files?.length || 0} receipts ·
                          Currencies:{" "}
                          {[
                            ...new Set(
                              [
                                ...(parsedImport?.records?.invoices || []),
                                ...(parsedImport?.records?.expenses || []),
                                ...(parsedImport?.records?.work_orders || []),
                              ].map((row) => String(row.currency)),
                            ),
                          ].join(", ") || "No financial records"}
                        </>
                      )}
                    </p>
                    <p>
                      A complete recovery backup is saved locally before
                      replacing this workspace.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="app-dialog-footer">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setIsImportModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                type="button"
                disabled={
                  (!selectedDiskBackup && !parsedImport) ||
                  isImporting ||
                  isValidatingImport ||
                  Boolean(importError)
                }
                onClick={handleConfirmImport}
              >
                {isImporting
                  ? "Importing…"
                  : importMode === "merge"
                    ? "Merge Backup"
                    : "Restore Data"}
              </Button>
            </div>
          </Dialog>
        )}
      </MotionPresence>

      <MotionPresence>
        {resetScope && (
          <Dialog onClose={() => { if (!isResetting) setResetScope(null); }} width={480}>
            <form onSubmit={handleConfirmReset} aria-labelledby="reset-confirmation-title">
              <div className="app-dialog-header">
                <div className="p-2 rounded-xl bg-surface-rose-50 text-content-rose-600 shrink-0">
                  <AlertTriangle className="size-4" aria-hidden="true" />
                </div>
                <div>
                  <h3 id="reset-confirmation-title" className="text-sm font-semibold">
                    {resetScope === "application" ? "Clear full application?" : "Clear profile records?"}
                  </h3>
                  <p className="mt-1 text-xs text-content-neutral-600">
                    {resetScope === "application"
                      ? "This permanently deletes all profiles, passcodes, records, managed attachments, preferences, and backups stored inside BillFlow. BillFlow will restart and open first-time setup. Files exported to other folders stay there."
                      : `This permanently deletes the business records and managed receipts for ${activeProfile.name}. This profile keeps its settings and passcode.`}
                  </p>
                </div>
              </div>
              <div className="app-dialog-body space-y-3">
                <label htmlFor="reset-confirmation" className="block text-xs font-medium">
                  Type <strong className="font-mono">{RESET_CONFIRMATION[resetScope]}</strong> to confirm.
                </label>
                <input
                  id="reset-confirmation"
                  name="confirmation"
                  type="text"
                  value={resetConfirmation}
                  onChange={(event) => setResetConfirmation(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  required
                  disabled={isResetting}
                  className="ui-field w-full font-mono"
                />
                {resetError && <p role="alert" className="text-sm text-content-rose-700">{resetError}</p>}
              </div>
              <div className="app-dialog-footer">
                <Button
                  variant="secondary"
                  type="button"
                  disabled={isResetting}
                  onClick={() => setResetScope(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  type="submit"
                  disabled={resetConfirmation !== RESET_CONFIRMATION[resetScope] || isResetting}
                >
                  {isResetting
                    ? resetScope === "application" ? "Restarting…" : "Clearing…"
                    : resetScope === "application" ? "Clear and restart" : "Clear profile records"}
                </Button>
              </div>
            </form>
          </Dialog>
        )}
      </MotionPresence>

      {/* FULL-SIZE INVOICE TEMPLATE PREVIEW MODAL */}
      {previewTemplateId && (
        <InvoiceDocumentSheet
          invoice={samplePreviewInvoice}
          initialTemplate={previewTemplateId}
          onSelectTemplate={(id) => void handleSelectInvoiceTemplate(id)}
          onClose={() => setPreviewTemplateId(null)}
        />
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="workspace-page settings-page motion-page max-w-none">
          <div className="h-10 w-48 bg-surface-neutral-200 rounded-xl" />
          <div className="h-10 w-72 bg-surface-neutral-200 rounded-xl" />
          <div className="h-64 bg-surface-neutral-200 rounded-2xl" />
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
