"use client";

import {
  Button,
  PageHeader,
  SegmentedControl,
} from "@/components/ui/Workspace";

import React, { useState, useEffect, useEffectEvent, useMemo, Suspense } from "react";
import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";
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
  Mail,
  Phone,
} from "lucide-react";
import { useSettings, useData } from "@/lib/data/DataProvider";
import type { UpdateSettingsInput, ExportDataPayload } from "@/types/settings";
import { useTheme } from "@/context/ThemeContext";
import { useSearchParams } from "next/navigation";
import type { Currency } from "@/types/billing";
import { getCurrencySymbol } from "@/lib/format";
import type { AccentPreference } from "@/lib/theme";

type SettingsTab = "profile" | "invoices" | "data" | "appearance";

const ACCENT_OPTIONS: Array<{
  id: AccentPreference;
  name: string;
  description: string;
  color: string;
}> = [
  { id: "purple", name: "Purple", description: "Default", color: "#7c3aed" },
  { id: "blue", name: "Blue", description: "Ocean", color: "#2563eb" },
  { id: "emerald", name: "Emerald", description: "Forest", color: "#059669" },
  { id: "rose", name: "Rose", description: "Ruby", color: "#e11d48" },
  { id: "amber", name: "Amber", description: "Bronze", color: "#d97706" },
  { id: "indigo", name: "Indigo", description: "Midnight", color: "#4f46e5" },
];

function SettingsContent() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const initialTab: SettingsTab = ["profile", "invoices", "data", "appearance"].includes(requestedTab || "") ? requestedTab as SettingsTab : "profile";
  const { workflow, isElectron, error: dataError } = useData();
  const { preference, setPreference, accent, setAccent, ready } = useTheme();
  const {
    settings,
    isLoading,
    updateSettings,
    getDbPath,
    revealDbFile,
    exportData,
    importData,
    resetData,
  } = useSettings();

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [previousRequestedTab, setPreviousRequestedTab] = useState(requestedTab);
  if (previousRequestedTab !== requestedTab) { setPreviousRequestedTab(requestedTab); setActiveTab(initialTab); }
  const [dbPath, setDbPath] = useState<string>("");
  const [copiedPath, setCopiedPath] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Form State
  const [formState, setFormState] = useState<UpdateSettingsInput>({
    businessName: "",
    professionalTitle: "",
    email: "",
    phone: "",
    website: "",
    taxId: "",
    address: "",
    paymentDetails: "",
    defaultCurrency: "USD",
    invoicePrefix: "INV-",
    nextInvoiceSeq: 1,
    defaultDueDays: 14,
    defaultTaxRate: 0,
    defaultNotes: "",
    dateFormat: "YYYY-MM-DD",
    currencyDisplay: "symbol",
    pdfExportDirectory: null,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedImport, setParsedImport] = useState<ExportDataPayload | null>(
    null,
  );
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // Reset the draft when newly loaded or saved settings replace the source.
  const [previousSettings, setPreviousSettings] = useState(settings);
  if (previousSettings !== settings) {
    setPreviousSettings(settings);
    if (settings) {
      setFormState({
        businessName: settings.businessName || "",
        professionalTitle: settings.professionalTitle || "",
        email: settings.email || "",
        phone: settings.phone || "",
        website: settings.website || "",
        taxId: settings.taxId || "",
        address: settings.address || "",
        paymentDetails: settings.paymentDetails || "",
        defaultCurrency: settings.defaultCurrency || "USD",
        invoicePrefix: settings.invoicePrefix || "INV-",
        nextInvoiceSeq: settings.nextInvoiceSeq || 1,
        defaultDueDays: settings.defaultDueDays ?? 14,
        defaultTaxRate: settings.defaultTaxRate ?? 0,
        defaultNotes: settings.defaultNotes || "",
        dateFormat: settings.dateFormat || "YYYY-MM-DD",
        currencyDisplay: settings.currencyDisplay || "symbol",
        pdfExportDirectory: settings.pdfExportDirectory || null,
      });
    }
  }

  // Load live DB path
  useEffect(() => {
    getDbPath()
      .then(setDbPath)
      .catch(() => setDbPath("Local database file"));
  }, [getDbPath]);

  // Determine dirty state
  const isDirty = useMemo(() => {
    if (!settings) return false;
    return (
      (formState.businessName ?? "") !== (settings.businessName ?? "") ||
      (formState.professionalTitle ?? "") !==
        (settings.professionalTitle ?? "") ||
      (formState.email ?? "") !== (settings.email ?? "") ||
      (formState.phone ?? "") !== (settings.phone ?? "") ||
      (formState.website ?? "") !== (settings.website ?? "") ||
      (formState.taxId ?? "") !== (settings.taxId ?? "") ||
      (formState.address ?? "") !== (settings.address ?? "") ||
      (formState.paymentDetails ?? "") !== (settings.paymentDetails ?? "") ||
      formState.defaultCurrency !== settings.defaultCurrency ||
      (formState.invoicePrefix ?? "") !== (settings.invoicePrefix ?? "") ||
      formState.nextInvoiceSeq !== settings.nextInvoiceSeq ||
      formState.defaultDueDays !== settings.defaultDueDays ||
      formState.defaultTaxRate !== settings.defaultTaxRate ||
      (formState.defaultNotes ?? "") !== (settings.defaultNotes ?? "") ||
      formState.dateFormat !== settings.dateFormat ||
      formState.currencyDisplay !== settings.currencyDisplay ||
      (formState.pdfExportDirectory || null) !== (settings.pdfExportDirectory || null)
    );
  }, [formState, settings]);

  const showToast = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3200);
  };

  const handleCopyPath = () => {
    if (!dbPath) return;
    navigator.clipboard.writeText(dbPath);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
    showToast("File path copied to clipboard", "success");
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
      await updateSettings(formState);
      showToast("Profile and settings saved.", "success");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to save settings.";
      showToast(msg, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const saveFromShortcut = useEffectEvent(() => {
    if (isDirty && !isSaving) void handleSave();
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

  const handleExportJson = async () => {
    try {
      const payload = await exportData();
      const jsonString = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: "application/json" }));
      const downloadAnchor = document.createElement("a");
      const dateTag = new Date().toISOString().split("T")[0];
      downloadAnchor.setAttribute("href", jsonString);
      downloadAnchor.setAttribute(
        "download",
        `billflow-backup-${dateTag}.json`,
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setTimeout(() => URL.revokeObjectURL(jsonString), 1000);
      showToast("Backup saved to your computer.", "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to export data.";
      showToast(msg, "error");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsedImport(null);
    if (file.size > 150 * 1024 * 1024) { setImportError("Backup must be smaller than 150 MB."); return; }
    setImportFile(file);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed || typeof parsed !== "object") {
          throw new Error("Invalid backup file format.");
        }
        if (parsed.version !== "2" || !parsed.records || !Array.isArray(parsed.files)) throw new Error("Choose a complete version 2 workflow backup.");
        if (!Array.isArray(parsed.clients) || !Array.isArray(parsed.invoices)) {
          throw new Error("Backup file does not contain clients or invoices.");
        }
        setParsedImport(parsed as ExportDataPayload);
      } catch (err: unknown) {
        setImportError(
          err instanceof Error ? err.message : "Failed to read backup file.",
        );
        setParsedImport(null);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (!parsedImport) return;
    setIsImporting(true);
    try {
      const res = await importData(parsedImport);
      showToast(
        `Restored ${res.importedClients} clients and ${res.importedInvoices} invoices.`,
        "success",
      );
      setIsImportModalOpen(false);
      setImportFile(null);
      setParsedImport(null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to restore backup.";
      showToast(msg, "error");
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmReset = async () => {
    if (resetConfirmation !== "DELETE ALL DATA") return;
    setIsResetting(true);
    try {
      await resetData();
      showToast("Business records and managed receipts cleared. Profile and appearance kept.", "success");
      setIsResetModalOpen(false);
      setResetConfirmation("");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to reset workspace.";
      showToast(msg, "error");
    } finally {
      setIsResetting(false);
    }
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

  // Initial letter for the avatar
  const avatarLetter = (
    formState.businessName?.trim().charAt(0) || "Y"
  ).toUpperCase();

  return (
    <div className="workspace-page motion-page max-w-none">
      {dataError && <p role="alert" className="ui-card p-4 text-content-red-700">{dataError}</p>}
      {/* Toast Notification */}
      <MotionPresence>
        {notification && (
          <div className="fixed top-14 right-6 z-50 pointer-events-none">
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

      {/* Header */}
      <PageHeader
        title="Profile & Settings"
        description="Your details for client invoices, default currency, and offline data backups."
      >
        {isDirty && activeTab !== "appearance" && (
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-amber-50 text-content-amber-800 border border-line-amber-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-surface-amber-500 animate-pulse" />
              Unsaved changes
            </span>
            <Button
              variant="primary"
              type="button"
              onClick={() => handleSave()}
              disabled={isSaving}
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? "Saving..." : "Save (Cmd+S)"}
            </Button>
          </div>
        )}
      </PageHeader>

      <SegmentedControl
        value={activeTab}
        onChange={setActiveTab}
        label="Settings section"
        options={[
          {
            value: "profile",
            label: (
              <>
                <User />
                My Profile
              </>
            ),
          },
          {
            value: "invoices",
            label: (
              <>
                <Receipt />
                Invoices
              </>
            ),
          },
          {
            value: "appearance",
            label: (
              <>
                <Palette />
                Appearance
              </>
            ),
          },
          {
            value: "data",
            label: (
              <>
                <Database />
                Backup & Data
              </>
            ),
          },
        ]}
      />

      {/* Main Content Area */}
      <div className="workspace-form w-full max-w-none">
        {activeTab === "appearance" ? (
          <div className="space-y-6">
            <section
              className="ui-card p-5 flex flex-wrap items-center justify-between gap-4"
              aria-labelledby="appearance-heading"
            >
              <div>
                <h2 id="appearance-heading" className="text-base font-semibold text-content-neutral-900">
                  Color theme
                </h2>
                <p className="text-sm text-content-neutral-500 mt-1">
                  Choose a theme. System follows your device’s appearance.
                </p>
                <p className="text-xs text-content-neutral-500 mt-1" role="status">
                  Changes save automatically on this device.
                </p>
              </div>
              {ready && (
                <SegmentedControl
                  value={preference}
                  onChange={setPreference}
                  label="Color theme"
                  options={[
                    { value: "light", label: "Light" },
                    { value: "dark", label: "Dark" },
                    { value: "system", label: "System" },
                  ]}
                />
              )}
            </section>

            <section
              className="ui-card p-5 space-y-4"
              aria-labelledby="accent-heading"
            >
              <div>
                <h2 id="accent-heading" className="text-base font-semibold text-content-neutral-900">
                  Accent color
                </h2>
                <p className="text-sm text-content-neutral-500 mt-1">
                  Select your highlight color for buttons, navigation links, badges, and metrics.
                </p>
                <p className="text-xs text-content-neutral-500 mt-1" role="status">
                  Updates instantly across light and dark modes.
                </p>
              </div>

              <div
                role="radiogroup"
                aria-labelledby="accent-heading"
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-1"
              >
                {ACCENT_OPTIONS.map((option) => {
                  const isSelected = accent === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`${option.name} accent color (${option.description})`}
                      onClick={() => setAccent(option.id)}
                      className={`group relative flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        isSelected
                          ? "bg-accent-soft/40 border-accent shadow-xs ring-1 ring-accent/40"
                          : "bg-surface border-line-neutral-200/80 hover:border-line-neutral-300 hover:bg-surface-neutral-50/70"
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shadow-xs transition-transform group-hover:scale-105"
                        style={{ backgroundColor: option.color }}
                      >
                        {isSelected && (
                          <Check className="w-4 h-4 text-white stroke-[2.5]" />
                        )}
                      </div>
                      <span className="mt-2 text-xs font-semibold text-content-neutral-900">
                        {option.name}
                      </span>
                      <span className="text-[11px] text-content-neutral-500">
                        {option.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        ) : isLoading ? (
          <div className="bg-surface rounded-2xl border border-line-neutral-200/80 p-8 space-y-6 animate-pulse">
            <div className="h-6 w-36 bg-surface-neutral-200 rounded-md" />
            <div className="h-10 w-full bg-surface-neutral-100 rounded-lg" />
            <div className="h-10 w-full bg-surface-neutral-100 rounded-lg" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* TAB 1: MY PROFILE */}
            {activeTab === "profile" && (
              <div className="space-y-6">
                {/* Live Preview Card */}
                <div className="ui-card from-surface-purple-50/70 to-surface-neutral-50 border-line-purple-200/70 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-accent-solid text-white flex items-center justify-center text-lg font-bold shadow-sm shrink-0">
                      {avatarLetter}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-content-neutral-900 text-base">
                          {formState.businessName?.trim() || "Your Name"}
                        </span>
                        <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-md bg-surface-purple-100 text-content-purple-800">
                          Appears on Invoices
                        </span>
                      </div>
                      <p className="text-xs text-content-neutral-500 mt-0.5">
                        {formState.professionalTitle?.trim() ||
                          "Freelance Specialist / Sole Proprietor"}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-content-neutral-500 mt-1.5">
                        {formState.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-content-neutral-400" />
                            {formState.email}
                          </span>
                        )}
                        {formState.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-content-neutral-400" />
                            {formState.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Basic Personal Info */}
                <div className="ui-card p-6 space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold text-content-neutral-900">
                      Your Details
                    </h2>
                    <p className="text-xs text-content-neutral-500 mt-0.5">
                      Enter your name and contact details. These will appear at
                      the top of every invoice you send to clients.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-content-neutral-700 mb-1">
                        Your Name or Studio Name
                      </label>
                      <input
                        type="text"
                        value={formState.businessName || ""}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            businessName: e.target.value,
                          })
                        }
                        placeholder="e.g. Alex Carter"
                        className="ui-field w-full px-3.5 border border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-content-neutral-700 mb-1">
                        What do you do? (Title)
                      </label>
                      <input
                        type="text"
                        value={formState.professionalTitle || ""}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            professionalTitle: e.target.value,
                          })
                        }
                        placeholder="e.g. Freelance Web Developer, Designer, Consultant"
                        className="ui-field w-full px-3.5 border border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-content-neutral-700 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={formState.email || ""}
                        onChange={(e) =>
                          setFormState({ ...formState, email: e.target.value })
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

                    <div>
                      <label className="block text-xs font-medium text-content-neutral-700 mb-1">
                        Phone Number{" "}
                        <span className="text-content-neutral-400 font-normal">
                          (Optional)
                        </span>
                      </label>
                      <input
                        type="tel"
                        value={formState.phone || ""}
                        onChange={(e) =>
                          setFormState({ ...formState, phone: e.target.value })
                        }
                        placeholder="+1 (555) 000-0000"
                        className="ui-field w-full px-3.5 border border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-content-neutral-700 mb-1">
                        Website or Portfolio{" "}
                        <span className="text-content-neutral-400 font-normal">
                          (Optional)
                        </span>
                      </label>
                      <input
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
                      Optional details if you want your physical location or tax
                      registration number printed on invoices.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-content-neutral-700 mb-1">
                        Your Address or City
                      </label>
                      <textarea
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
                      <label className="block text-xs font-medium text-content-neutral-700 mb-1">
                        Tax / Business Number{" "}
                        <span className="text-content-neutral-400 font-normal">
                          (Optional)
                        </span>
                      </label>
                      <input
                        type="text"
                        value={formState.taxId || ""}
                        onChange={(e) =>
                          setFormState({ ...formState, taxId: e.target.value })
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
                      Add your bank details, Wise link, or PayPal address. These
                      instructions will be printed at the bottom of your
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
              <div className="space-y-6">
                <div className="ui-card p-6 space-y-3">
                  <h2 className="text-sm font-semibold">Invoice PDF folder</h2>
                  <p className="text-sm text-content-neutral-600">{formState.pdfExportDirectory || "Downloads (default)"}</p>
                  <div className="flex gap-3">
                    <Button disabled={!isElectron || isSaving} onClick={async () => {
                      try { const folder = await workflow.files.selectPdfDirectory(); if (folder) setFormState(previous => ({ ...previous, pdfExportDirectory: folder })); }
                      catch (error) { showToast(error instanceof Error ? error.message : "Could not select folder", "error"); }
                    }}><FolderOpen className="w-4 h-4" />Choose folder</Button>
                    <Button disabled={isSaving || !formState.pdfExportDirectory} onClick={() => setFormState(previous => ({ ...previous, pdfExportDirectory: null }))}>Use Downloads</Button>
                  </div>
                  <p className="text-xs text-content-neutral-500">Save changes to apply this folder to invoice exports.</p>
                </div>
                {/* Currency & Payment Due */}
                <div className="ui-card p-6 space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold text-content-neutral-900">
                      Currency & Payment Terms
                    </h2>
                    <p className="text-xs text-content-neutral-500 mt-0.5">
                      Configure your primary system currency and invoice payment timeline. Changes automatically apply across Dashboard, Invoices, Clients, Tasks, Outsourcing, Catalog, Expenses, and Analytics.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-medium text-content-neutral-700">
                          Default Currency
                        </label>
                        <span className="text-[11px] font-semibold text-accent">
                          Active: {formState.defaultCurrency || "USD"} ({getCurrencySymbol(formState.defaultCurrency || "USD").trim()})
                        </span>
                      </div>
                      <select
                        value={formState.defaultCurrency || "USD"}
                        onChange={async (e) => {
                          const newCurrency = e.target.value as Currency;
                          setFormState((prev) => ({
                            ...prev,
                            defaultCurrency: newCurrency,
                          }));
                          try {
                            await updateSettings({ defaultCurrency: newCurrency });
                            showToast(
                              `System currency updated to ${newCurrency} (${getCurrencySymbol(newCurrency).trim()}). All pages now use this currency.`,
                              "success"
                            );
                          } catch (err: unknown) {
                            const msg = err instanceof Error ? err.message : "Failed to update currency";
                            showToast(msg, "error");
                          }
                        }}
                        className="ui-field w-full px-3.5 border border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                      >
                        <option value="USD">USD ($ - US Dollar)</option>
                        <option value="EUR">EUR (€ - Euro)</option>
                        <option value="LKR">LKR (Rs. - Sri Lanka Rupee)</option>
                        <option value="GBP">GBP (£ - British Pound)</option>
                        <option value="CAD">CAD (CA$ - Canadian Dollar)</option>
                      </select>
                      <p className="text-[11px] text-content-neutral-400 mt-1">
                        Changing this setting automatically syncs currency type across all pages in BillFlow.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-content-neutral-700 mb-1">
                        Payment Due Within
                      </label>
                      <select
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
                      <label className="block text-xs font-medium text-content-neutral-700 mb-1">
                        Default Tax Rate (%)
                      </label>
                      <div className="relative">
                        <input
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
                      <label className="block text-xs font-medium text-content-neutral-700 mb-1">
                        Invoice Prefix
                      </label>
                      <input
                        type="text"
                        value={formState.invoicePrefix || "INV-"}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            invoicePrefix: e.target.value,
                          })
                        }
                        placeholder="INV-"
                        className="ui-field w-full px-3.5 border border-line-neutral-200 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors font-mono"
                      />
                      <p className="text-[11px] text-content-neutral-400 mt-1">
                        Default is{" "}
                        <code className="font-mono text-content-neutral-600">INV-</code>
                        .
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-content-neutral-700 mb-1">
                        Next Number
                      </label>
                      <input
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
                        Change this if you want to start from a specific number.
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
                      Friendly text included at the bottom of all your invoices.
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
              </div>
            )}

            {/* TAB 3: BACKUP & DATA */}
            {activeTab === "data" && (
              <div className="space-y-6">
                {/* Local Storage Card */}
                <div className="ui-card p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-content-neutral-900">
                        Offline & Private Storage
                      </h2>
                      <p className="text-xs text-content-neutral-500 mt-0.5">
                        Your clients and invoices are saved directly on this
                        computer. Nothing is stored on an external cloud server.
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-emerald-50 text-content-emerald-700 border border-line-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-surface-emerald-500" />
                      Saved Locally
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
                        onClick={handleCopyPath}
                      >
                        {copiedPath ? (
                          <Check className="w-3.5 h-3.5 text-content-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-content-neutral-500" />
                        )}
                        {copiedPath ? "Copied" : "Copy Path"}
                      </Button>

                      <Button
                        variant="secondary"
                        type="button"
                        onClick={() => revealDbFile()}
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        Open Folder
                      </Button>
                    </div>
                  </div>
                </div>

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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-line-neutral-200 flex flex-col justify-between gap-3 bg-surface-neutral-50/30">
                      <div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-content-neutral-900">
                          <Download className="w-4 h-4 text-accent" />
                          Download Backup File
                        </div>
                        <p className="text-xs text-content-neutral-500 mt-1 leading-relaxed">
                          Saves all workflow records, profile settings and receipt
                          files into one complete backup.
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        type="button"
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
                        onClick={() => {
                          setImportFile(null);
                          setParsedImport(null);
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

                {/* Reset Data */}
                <div className="ui-card p-6 space-y-4 ui-card--danger">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-surface-rose-50 text-content-rose-600 shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-content-rose-950">
                        Start Over (Clear Data)
                      </h2>
                      <p className="text-xs text-content-rose-700 mt-0.5 leading-relaxed">
                        Need a blank slate? This deletes all
                        business records and managed receipts. Profile and appearance settings are kept.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      variant="danger"
                      type="button"
                      onClick={() => {
                        setResetConfirmation("");
                        setIsResetModalOpen(true);
                      }}
                    >
                      Clear All Records
                    </Button>
                  </div>
                </div>
              </div>
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
                          if (settings) {
                            setFormState({
                              businessName: settings.businessName || "",
                              professionalTitle:
                                settings.professionalTitle || "",
                              email: settings.email || "",
                              phone: settings.phone || "",
                              website: settings.website || "",
                              taxId: settings.taxId || "",
                              address: settings.address || "",
                              paymentDetails: settings.paymentDetails || "",
                              defaultCurrency:
                                settings.defaultCurrency || "USD",
                              invoicePrefix: settings.invoicePrefix || "INV-",
                              nextInvoiceSeq: settings.nextInvoiceSeq || 1,
                              defaultDueDays: settings.defaultDueDays ?? 14,
                              defaultTaxRate: settings.defaultTaxRate ?? 0,
                              defaultNotes: settings.defaultNotes || "",
                              dateFormat: settings.dateFormat || "YYYY-MM-DD",
                              currencyDisplay:
                                settings.currencyDisplay || "symbol",
                              pdfExportDirectory: settings.pdfExportDirectory || null,
                            });
                            setFormErrors({});
                          }
                        }}
                      >
                        Discard
                      </Button>

                      <Button
                        variant="primary"
                        type="submit"
                        disabled={isSaving}
                      >
                        <Save className="w-3.5 h-3.5" />
                        {isSaving ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </MotionSurface>
                </div>
              )}
            </MotionPresence>
          </form>
        )}
      </div>

      {/* RESTORE MODAL */}
      <MotionPresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-neutral-900/40 backdrop-blur-xs">
            <MotionSurface
              kind="dialog"
              onDismiss={() => setIsImportModalOpen(false)}
              className="bg-surface rounded-2xl max-w-md w-full p-6 border border-line-neutral-200/80 shadow-[0_22.3px_17.9px_rgba(0,0,0,0.072),0_100px_80px_rgba(0,0,0,0.12)] space-y-4"
            >
              <div>
                <h3 className="text-base font-semibold text-content-neutral-900">
                  Restore Data from Backup
                </h3>
                <p className="text-xs text-content-neutral-500 mt-1">
                  Select a complete backup. Restoring replaces all business records
                  and profile settings with the backup contents.
                </p>
              </div>

              <div className="space-y-3">
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

                {importError && (
                  <div className="p-3 rounded-xl bg-surface-rose-50 border border-line-rose-200 text-xs text-content-rose-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{importError}</span>
                  </div>
                )}

                {parsedImport && (
                  <div className="p-3.5 rounded-xl bg-surface-purple-50 border border-line-purple-100 text-xs text-content-purple-950 space-y-1">
                    <div className="font-semibold text-accent">
                      File Verified
                    </div>
                    <div className="text-content-neutral-700">
                      Contains{" "}
                      <strong>
                        {parsedImport.clients?.length || 0} clients
                      </strong>{" "}
                      and{" "}
                      <strong>
                        {parsedImport.invoices?.length || 0} invoices
                      </strong>
                      .
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-line-neutral-100">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="button"
                  disabled={!parsedImport || isImporting}
                  onClick={handleConfirmImport}
                >
                  {isImporting ? "Restoring..." : "Restore Data"}
                </Button>
              </div>
            </MotionSurface>
          </div>
        )}
      </MotionPresence>

      {/* RESET CONFIRMATION MODAL */}
      <MotionPresence>
        {isResetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-neutral-900/40 backdrop-blur-xs">
            <MotionSurface
              kind="dialog"
              onDismiss={() => setIsResetModalOpen(false)}
              className="bg-surface rounded-2xl max-w-sm w-full p-6 border border-line-rose-200 shadow-[0_22.3px_17.9px_rgba(0,0,0,0.072),0_100px_80px_rgba(0,0,0,0.12)] space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-surface-rose-50 text-content-rose-600 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-content-rose-950">
                    Clear all records?
                  </h3>
                  <p className="text-xs text-content-rose-700 mt-1 leading-relaxed">
                    This will delete all business records and managed receipts. Profile and appearance settings are kept. This cannot be
                    undone.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-content-neutral-700">
                  Type{" "}
                  <span className="font-mono font-bold text-content-rose-600">
                    DELETE ALL DATA
                  </span>{" "}
                  to confirm:
                </label>
                <input
                  type="text"
                  value={resetConfirmation}
                  onChange={(e) => setResetConfirmation(e.target.value)}
                  placeholder="DELETE ALL DATA"
                  className="ui-field w-full px-3 border border-line-neutral-200 font-mono focus:border-line-rose-500 focus:ring-1 focus:ring-line-rose-500 outline-none transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-line-neutral-100">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  type="button"
                  disabled={
                    resetConfirmation !== "DELETE ALL DATA" || isResetting
                  }
                  onClick={handleConfirmReset}
                >
                  {isResetting ? "Clearing..." : "Clear Business Data"}
                </Button>
              </div>
            </MotionSurface>
          </div>
        )}
      </MotionPresence>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="workspace-page motion-page max-w-none">
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
