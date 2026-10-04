"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { MotionPresence, MotionSurface } from "@/components/ui/MotionSurface";
import {
  User,
  Receipt,
  Database,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  FolderOpen,
  Download,
  Upload,
  AlertTriangle,
  Save,
  CreditCard,
  Hash,
  Globe,
  Mail,
  Phone,
  MapPin,
  Sparkles,
} from "lucide-react";
import { useSettings } from "@/lib/data/DataProvider";
import type { AppSettings, UpdateSettingsInput, ExportDataPayload } from "@/types/settings";
import type { Currency } from "@/types/billing";

type SettingsTab = "profile" | "invoices" | "data";

function SettingsContent() {
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

  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [dbPath, setDbPath] = useState<string>("");
  const [copiedPath, setCopiedPath] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

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
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedImport, setParsedImport] = useState<ExportDataPayload | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // Sync settings into form
  useEffect(() => {
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
      });
    }
  }, [settings]);

  // Load live DB path
  useEffect(() => {
    getDbPath().then(setDbPath).catch(() => setDbPath("Local database file"));
  }, [getDbPath]);

  // Determine dirty state
  const isDirty = useMemo(() => {
    if (!settings) return false;
    return (
      (formState.businessName ?? "") !== (settings.businessName ?? "") ||
      (formState.professionalTitle ?? "") !== (settings.professionalTitle ?? "") ||
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
      formState.currencyDisplay !== settings.currencyDisplay
    );
  }, [formState, settings]);

  const showToast = (message: string, type: "success" | "error" = "success") => {
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
      const msg = err instanceof Error ? err.message : "Failed to save settings.";
      showToast(msg, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcut Cmd+S / Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty && !isSaving) {
          handleSave();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDirty, isSaving, formState]);

  const handleExportJson = async () => {
    try {
      const payload = await exportData();
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload, null, 2))}`;
      const downloadAnchor = document.createElement("a");
      const dateTag = new Date().toISOString().split("T")[0];
      downloadAnchor.setAttribute("href", jsonString);
      downloadAnchor.setAttribute("download", `billflow-backup-${dateTag}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast("Backup saved to your computer.", "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to export data.";
      showToast(msg, "error");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed || typeof parsed !== "object") {
          throw new Error("Invalid backup file format.");
        }
        if (!Array.isArray(parsed.clients) || !Array.isArray(parsed.invoices)) {
          throw new Error("Backup file does not contain clients or invoices.");
        }
        setParsedImport(parsed as ExportDataPayload);
      } catch (err: unknown) {
        setImportError(err instanceof Error ? err.message : "Failed to read backup file.");
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
      showToast(`Restored ${res.importedClients} clients and ${res.importedInvoices} invoices.`, "success");
      setIsImportModalOpen(false);
      setImportFile(null);
      setParsedImport(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to restore backup.";
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
      showToast("All data cleared. Starting fresh.", "success");
      setIsResetModalOpen(false);
      setResetConfirmation("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reset workspace.";
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
  const avatarLetter = (formState.businessName?.trim().charAt(0) || "Y").toUpperCase();

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8 select-none">
      {/* Toast Notification */}
      <MotionPresence>
        {notification && (
          <div className="fixed top-14 right-6 z-50 pointer-events-none">
            <MotionSurface
              kind="toast"
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium shadow-[0px_4px_12px_rgba(0,0,0,0.08)] pointer-events-auto ${
                notification.type === "success"
                  ? "bg-white text-emerald-800 border-emerald-200"
                  : "bg-white text-rose-800 border-rose-200"
              }`}
            >
              {notification.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{notification.message}</span>
            </MotionSurface>
          </div>
        )}
      </MotionPresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-neutral-200/80">
        <div>
          <h1 className="font-newspaper text-3xl font-normal text-neutral-900 tracking-tight">
            Profile & Settings
          </h1>
          <p className="text-sm text-neutral-500 mt-1 max-w-[65ch]">
            Your details for client invoices, default currency, and offline data backups.
          </p>
        </div>

        {isDirty && (
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Unsaved changes
            </span>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] active:bg-[#5b21b6] disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? "Saving..." : "Save (Cmd+S)"}
            </button>
          </div>
        )}
      </div>

      {/* Simplified 3-Tab Segmented Selector */}
      <div className="flex items-center gap-2 p-1.5 bg-neutral-200/60 rounded-xl w-full sm:w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            activeTab === "profile"
              ? "bg-white text-neutral-950 font-semibold shadow-[0px_1px_2px_rgba(0,0,0,0.06)]"
              : "text-neutral-600 hover:text-neutral-900"
          }`}
        >
          <User className="w-3.5 h-3.5 text-[#7c3aed]" />
          My Profile
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("invoices")}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            activeTab === "invoices"
              ? "bg-white text-neutral-950 font-semibold shadow-[0px_1px_2px_rgba(0,0,0,0.06)]"
              : "text-neutral-600 hover:text-neutral-900"
          }`}
        >
          <Receipt className="w-3.5 h-3.5 text-[#7c3aed]" />
          Invoices
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("data")}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            activeTab === "data"
              ? "bg-white text-neutral-950 font-semibold shadow-[0px_1px_2px_rgba(0,0,0,0.06)]"
              : "text-neutral-600 hover:text-neutral-900"
          }`}
        >
          <Database className="w-3.5 h-3.5 text-[#7c3aed]" />
          Backup & Data
        </button>
      </div>

      {/* Main Content Area */}
      <div>
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-neutral-200/80 p-8 space-y-6 animate-pulse">
            <div className="h-6 w-36 bg-neutral-200 rounded-md" />
            <div className="h-10 w-full bg-neutral-100 rounded-lg" />
            <div className="h-10 w-full bg-neutral-100 rounded-lg" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* TAB 1: MY PROFILE */}
            {activeTab === "profile" && (
              <div className="space-y-6">
                {/* Live Preview Card */}
                <div className="bg-gradient-to-r from-purple-50/70 to-neutral-50 rounded-2xl border border-purple-200/70 p-5 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.04),0px_1px_2px_rgba(0,0,0,0.05)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#7c3aed] text-white flex items-center justify-center text-lg font-bold shadow-sm shrink-0">
                      {avatarLetter}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-neutral-900 text-base">
                          {formState.businessName?.trim() || "Your Name"}
                        </span>
                        <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-100 text-purple-800">
                          Appears on Invoices
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {formState.professionalTitle?.trim() || "Freelance Specialist / Sole Proprietor"}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500 mt-1.5">
                        {formState.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-neutral-400" />
                            {formState.email}
                          </span>
                        )}
                        {formState.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-neutral-400" />
                            {formState.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Basic Personal Info */}
                <div className="bg-white rounded-2xl border border-neutral-200/70 p-6 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06)] space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold text-neutral-900">Your Details</h2>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Enter your name and contact details. These will appear at the top of every invoice you send to clients.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Your Name or Studio Name
                      </label>
                      <input
                        type="text"
                        value={formState.businessName || ""}
                        onChange={(e) => setFormState({ ...formState, businessName: e.target.value })}
                        placeholder="e.g. Alex Carter"
                        className="w-full px-3.5 py-2 text-sm bg-neutral-50/50 border border-neutral-200 rounded-xl focus:bg-white focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        What do you do? (Title)
                      </label>
                      <input
                        type="text"
                        value={formState.professionalTitle || ""}
                        onChange={(e) => setFormState({ ...formState, professionalTitle: e.target.value })}
                        placeholder="e.g. Freelance Web Developer, Designer, Consultant"
                        className="w-full px-3.5 py-2 text-sm bg-neutral-50/50 border border-neutral-200 rounded-xl focus:bg-white focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={formState.email || ""}
                        onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                        placeholder="alex@example.com"
                        className={`w-full px-3.5 py-2 text-sm bg-neutral-50/50 border rounded-xl focus:bg-white outline-none transition-colors ${
                          formErrors.email ? "border-rose-400 focus:ring-rose-400" : "border-neutral-200 focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed]"
                        }`}
                      />
                      {formErrors.email && (
                        <p className="text-xs text-rose-600 mt-1">{formErrors.email}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Phone Number <span className="text-neutral-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="tel"
                        value={formState.phone || ""}
                        onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                        placeholder="+1 (555) 000-0000"
                        className="w-full px-3.5 py-2 text-sm bg-neutral-50/50 border border-neutral-200 rounded-xl focus:bg-white focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] outline-none transition-colors"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Website or Portfolio <span className="text-neutral-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={formState.website || ""}
                        onChange={(e) => setFormState({ ...formState, website: e.target.value })}
                        placeholder="https://yourportfolio.com"
                        className="w-full px-3.5 py-2 text-sm bg-neutral-50/50 border border-neutral-200 rounded-xl focus:bg-white focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] outline-none transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Address & Tax Number */}
                <div className="bg-white rounded-2xl border border-neutral-200/70 p-6 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06)] space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold text-neutral-900">Address & Tax Information</h2>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Optional details if you want your physical location or tax registration number printed on invoices.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Your Address or City
                      </label>
                      <textarea
                        rows={3}
                        value={formState.address || ""}
                        onChange={(e) => setFormState({ ...formState, address: e.target.value })}
                        placeholder="123 Innovation Way&#10;San Francisco, CA 94105"
                        className="w-full px-3.5 py-2 text-sm bg-neutral-50/50 border border-neutral-200 rounded-xl focus:bg-white focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] outline-none transition-colors resize-none leading-relaxed"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Tax / Business Number <span className="text-neutral-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={formState.taxId || ""}
                        onChange={(e) => setFormState({ ...formState, taxId: e.target.value })}
                        placeholder="e.g. VAT or Tax ID number"
                        className="w-full px-3.5 py-2 text-sm bg-neutral-50/50 border border-neutral-200 rounded-xl focus:bg-white focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] outline-none transition-colors"
                      />
                      <p className="text-[11px] text-neutral-400 mt-1.5 leading-relaxed">
                        Leave blank if you are not registered for VAT or sales tax.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Where Clients Send Payment */}
                <div className="bg-white rounded-2xl border border-neutral-200/70 p-6 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06)] space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold text-neutral-900">How Clients Pay You</h2>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Add your bank details, Wise link, or PayPal address. These instructions will be printed at the bottom of your invoices.
                    </p>
                  </div>

                  <div>
                    <textarea
                      rows={4}
                      value={formState.paymentDetails || ""}
                      onChange={(e) => setFormState({ ...formState, paymentDetails: e.target.value })}
                      placeholder={"Bank: Chase / Wise&#10;Account Name: Alex Carter&#10;Account No: 1234 5678 9012&#10;PayPal or Wise Tag: alex@example.com"}
                      className="w-full px-3.5 py-2 text-sm bg-neutral-50/50 border border-neutral-200 rounded-xl focus:bg-white focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] outline-none transition-colors resize-none font-mono text-xs leading-relaxed"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: INVOICES */}
            {activeTab === "invoices" && (
              <div className="space-y-6">
                {/* Currency & Payment Due */}
                <div className="bg-white rounded-2xl border border-neutral-200/70 p-6 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06)] space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold text-neutral-900">Currency & Payment Terms</h2>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Choose the default currency and payment timeline applied to new invoices.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Default Currency
                      </label>
                      <select
                        value={formState.defaultCurrency || "USD"}
                        onChange={(e) => setFormState({ ...formState, defaultCurrency: e.target.value as Currency })}
                        className="w-full px-3.5 py-2 text-sm bg-neutral-50/50 border border-neutral-200 rounded-xl focus:bg-white focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] outline-none transition-colors"
                      >
                        <option value="USD">USD ($ - US Dollar)</option>
                        <option value="EUR">EUR (€ - Euro)</option>
                        <option value="LKR">LKR (Rs - Sri Lanka Rupee)</option>
                        <option value="GBP">GBP (£ - British Pound)</option>
                        <option value="CAD">CAD ($ - Canadian Dollar)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Payment Due Within
                      </label>
                      <select
                        value={String(formState.defaultDueDays ?? 14)}
                        onChange={(e) => setFormState({ ...formState, defaultDueDays: parseInt(e.target.value, 10) })}
                        className="w-full px-3.5 py-2 text-sm bg-neutral-50/50 border border-neutral-200 rounded-xl focus:bg-white focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] outline-none transition-colors"
                      >
                        <option value="0">Due on Receipt (Immediate)</option>
                        <option value="7">7 Days</option>
                        <option value="14">14 Days (Recommended)</option>
                        <option value="30">30 Days</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Default Tax Rate (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={formState.defaultTaxRate ?? 0}
                          onChange={(e) => setFormState({ ...formState, defaultTaxRate: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3.5 py-2 text-sm bg-neutral-50/50 border border-neutral-200 rounded-xl focus:bg-white focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] outline-none transition-colors"
                        />
                        <span className="absolute right-3.5 top-2 text-sm text-neutral-400 pointer-events-none">%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Invoice Numbers */}
                <div className="bg-white rounded-2xl border border-neutral-200/70 p-6 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06)] space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold text-neutral-900">Invoice Numbering</h2>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      BillFlow automatically generates unique, sequential numbers for each invoice.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Invoice Prefix
                      </label>
                      <input
                        type="text"
                        value={formState.invoicePrefix || "INV-"}
                        onChange={(e) => setFormState({ ...formState, invoicePrefix: e.target.value })}
                        placeholder="INV-"
                        className="w-full px-3.5 py-2 text-sm bg-neutral-50/50 border border-neutral-200 rounded-xl focus:bg-white focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] outline-none transition-colors font-mono"
                      />
                      <p className="text-[11px] text-neutral-400 mt-1">
                        Default is <code className="font-mono text-neutral-600">INV-</code>.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Next Number
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formState.nextInvoiceSeq || 1}
                        onChange={(e) => setFormState({ ...formState, nextInvoiceSeq: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                        className="w-full px-3.5 py-2 text-sm bg-neutral-50/50 border border-neutral-200 rounded-xl focus:bg-white focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] outline-none transition-colors font-mono"
                      />
                      <p className="text-[11px] text-neutral-400 mt-1">
                        Change this if you want to start from a specific number.
                      </p>
                    </div>
                  </div>

                  {/* Visual Preview */}
                  <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-[#7c3aed]" />
                      <span className="text-xs font-medium text-purple-950">
                        Your next invoice will be:
                      </span>
                    </div>
                    <span className="font-mono text-xs font-semibold text-[#7c3aed] px-3 py-1 bg-white rounded-lg border border-purple-200 shadow-xs">
                      {previewInvoiceCode}
                    </span>
                  </div>
                </div>

                {/* Default Note */}
                <div className="bg-white rounded-2xl border border-neutral-200/70 p-6 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06)] space-y-3">
                  <div>
                    <h2 className="text-sm font-semibold text-neutral-900">Default Note to Clients</h2>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Friendly text included at the bottom of all your invoices.
                    </p>
                  </div>

                  <div>
                    <textarea
                      rows={3}
                      value={formState.defaultNotes || ""}
                      onChange={(e) => setFormState({ ...formState, defaultNotes: e.target.value })}
                      placeholder="Thank you for your business! Please reach out if you have any questions regarding this invoice."
                      className="w-full px-3.5 py-2 text-sm bg-neutral-50/50 border border-neutral-200 rounded-xl focus:bg-white focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] outline-none transition-colors resize-none leading-relaxed"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: BACKUP & DATA */}
            {activeTab === "data" && (
              <div className="space-y-6">
                {/* Local Storage Card */}
                <div className="bg-white rounded-2xl border border-neutral-200/70 p-6 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06)] space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-neutral-900">Offline & Private Storage</h2>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Your clients and invoices are saved directly on this computer. Nothing is stored on an external cloud server.
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Saved Locally
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-medium text-neutral-400 block uppercase tracking-wider">
                        Database File Location
                      </span>
                      <code className="text-xs font-mono text-neutral-800 block truncate mt-0.5">
                        {dbPath || "Loading database path..."}
                      </code>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleCopyPath}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-100 transition-colors shadow-xs cursor-pointer"
                      >
                        {copiedPath ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-neutral-500" />}
                        {copiedPath ? "Copied" : "Copy Path"}
                      </button>

                      <button
                        type="button"
                        onClick={() => revealDbFile()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100/70 border border-purple-200 rounded-lg transition-colors cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        Open Folder
                      </button>
                    </div>
                  </div>
                </div>

                {/* Backup & Restore */}
                <div className="bg-white rounded-2xl border border-neutral-200/70 p-6 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06)] space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold text-neutral-900">Backup & Restore</h2>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Save a copy of your records or restore from an earlier backup file.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-neutral-200 flex flex-col justify-between gap-3 bg-neutral-50/30">
                      <div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-900">
                          <Download className="w-4 h-4 text-[#7c3aed]" />
                          Download Backup File
                        </div>
                        <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                          Saves all your clients, invoices, and profile settings into a single backup file.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleExportJson}
                        className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-neutral-800 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-xl transition-colors shadow-xs cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Save Backup
                      </button>
                    </div>

                    <div className="p-4 rounded-xl border border-neutral-200 flex flex-col justify-between gap-3 bg-neutral-50/30">
                      <div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-900">
                          <Upload className="w-4 h-4 text-[#7c3aed]" />
                          Restore from Backup
                        </div>
                        <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                          Upload a previously saved backup file to restore your clients and invoices.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setImportFile(null);
                          setParsedImport(null);
                          setImportError(null);
                          setIsImportModalOpen(true);
                        }}
                        className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-neutral-800 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-xl transition-colors shadow-xs cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Choose File to Restore
                      </button>
                    </div>
                  </div>
                </div>

                {/* Reset Data */}
                <div className="bg-white rounded-2xl border border-rose-200/80 p-6 shadow-[0px_0px_0px_1px_rgba(244,63,94,0.08)] space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-rose-50 text-rose-600 shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-rose-950">Start Over (Clear Data)</h2>
                      <p className="text-xs text-rose-700 mt-0.5 leading-relaxed">
                        Need a blank slate? This deletes all clients and invoices created so far.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setResetConfirmation("");
                        setIsResetModalOpen(true);
                      }}
                      className="px-4 py-2 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer"
                    >
                      Clear All Records
                    </button>
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
                    className="bg-white/95 backdrop-blur-md border border-neutral-200/90 rounded-2xl p-4 shadow-[0px_12px_24px_-6px_rgba(0,0,0,0.1),0px_0px_0px_1px_rgba(0,0,0,0.06)] flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#7c3aed] animate-pulse" />
                      <span className="text-xs font-medium text-neutral-800">
                        You have unsaved changes
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
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
                            });
                            setFormErrors({});
                          }
                        }}
                        className="px-3.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                      >
                        Discard
                      </button>

                      <button
                        type="submit"
                        disabled={isSaving}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] active:bg-[#5b21b6] disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {isSaving ? "Saving..." : "Save Changes"}
                      </button>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-xs">
            <MotionSurface
              kind="dialog"
              className="bg-white rounded-2xl max-w-md w-full p-6 border border-neutral-200/80 shadow-[0_22.3px_17.9px_rgba(0,0,0,0.072),0_100px_80px_rgba(0,0,0,0.12)] space-y-4"
            >
              <div>
                <h3 className="text-base font-semibold text-neutral-900">Restore Data from Backup</h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Select a backup file from your computer to restore your clients and invoices.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block border-2 border-dashed border-neutral-200 hover:border-[#7c3aed] rounded-xl p-5 text-center cursor-pointer transition-colors bg-neutral-50/50">
                  <Upload className="w-5 h-5 text-neutral-400 mx-auto mb-1.5" />
                  <span className="text-xs font-medium text-neutral-700 block">
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
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{importError}</span>
                  </div>
                )}

                {parsedImport && (
                  <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-100 text-xs text-purple-950 space-y-1">
                    <div className="font-semibold text-[#7c3aed]">File Verified</div>
                    <div className="text-neutral-700">
                      Contains <strong>{parsedImport.clients?.length || 0} clients</strong> and <strong>{parsedImport.invoices?.length || 0} invoices</strong>.
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!parsedImport || isImporting}
                  onClick={handleConfirmImport}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {isImporting ? "Restoring..." : "Restore Data"}
                </button>
              </div>
            </MotionSurface>
          </div>
        )}
      </MotionPresence>

      {/* RESET CONFIRMATION MODAL */}
      <MotionPresence>
        {isResetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-xs">
            <MotionSurface
              kind="dialog"
              className="bg-white rounded-2xl max-w-sm w-full p-6 border border-rose-200 shadow-[0_22.3px_17.9px_rgba(0,0,0,0.072),0_100px_80px_rgba(0,0,0,0.12)] space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-rose-50 text-rose-600 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-rose-950">Clear all records?</h3>
                  <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                    This will delete all clients and invoices. This cannot be undone.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-neutral-700">
                  Type <span className="font-mono font-bold text-rose-600">DELETE ALL DATA</span> to confirm:
                </label>
                <input
                  type="text"
                  value={resetConfirmation}
                  onChange={(e) => setResetConfirmation(e.target.value)}
                  placeholder="DELETE ALL DATA"
                  className="w-full px-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl font-mono focus:bg-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={resetConfirmation !== "DELETE ALL DATA" || isResetting}
                  onClick={handleConfirmReset}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {isResetting ? "Clearing..." : "Yes, Clear Everything"}
                </button>
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
        <div className="p-8 lg:p-10 max-w-5xl mx-auto space-y-6 animate-pulse">
          <div className="h-10 w-48 bg-neutral-200 rounded-xl" />
          <div className="h-10 w-72 bg-neutral-200 rounded-xl" />
          <div className="h-64 bg-neutral-200 rounded-2xl" />
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
