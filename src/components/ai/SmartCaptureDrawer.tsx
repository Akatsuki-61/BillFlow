"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Cpu,
  Download,
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  Package,
  Plus,
  Receipt,
  Server,
  Settings,
  Sparkles,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useAiCapture } from "@/context/AiCaptureContext";
import { useProfiles } from "@/context/ProfileContext";
import { useToast } from "@/context/ToastContext";
import { useData } from "@/lib/data/DataProvider";
import { preprocessScreenshotForOcr } from "@/lib/image-preprocess";
import { formatShortcut, useIsMac } from "@/lib/platform-shortcuts";
import { localDateKey } from "@/lib/visual-metrics";
import type {
  AiCaptureIntent,
  AiExtractedDeliverable,
  AiExtractedInvoiceDraft,
  AiModelTier,
} from "@/types/ai";
import type { CatalogItem, ClientWithStats } from "@/types/billing";
import "./smart-capture.css";

export function SmartCaptureDrawer() {
  const router = useRouter();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const engineMenuRef = useRef<HTMLDivElement>(null);
  const clientPickerRef = useRef<HTMLDivElement>(null);
  const catalogPickerRef = useRef<HTMLDivElement>(null);

  const {
    isOpen,
    closeDrawer,
    aiStatus,
    downloadEvent,
    setTier,
    downloadEnhancedModel,
    handoffToInvoice,
    handoffToQuote,
  } = useAiCapture();
  const {
    isElectron,
    workflow,
    activeCurrency,
    settings,
    clients,
    catalogItems,
  } = useData();
  const { activeProfile } = useProfiles();
  const { showToast } = useToast();
  const isMac = useIsMac();

  const [engineMenuOpen, setEngineMenuOpen] = useState(false);
  const [isSwitchingEngine, setIsSwitchingEngine] = useState(false);

  const [rawText, setRawText] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageOcrDataUrl, setImageOcrDataUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<Blob | null>(null);
  const [wasDarkInverted, setWasDarkInverted] = useState(false);
  const [autoInvertDark, setAutoInvertDark] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<AiExtractedInvoiceDraft | null>(null);
  const [editableItems, setEditableItems] = useState<AiExtractedDeliverable[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientInput, setClientInput] = useState("");
  const [dueDateInput, setDueDateInput] = useState("");
  const [clientMenuOpen, setClientMenuOpen] = useState(false);
  const [catalogPickerItemId, setCatalogPickerItemId] = useState<string | null>(
    null,
  );
  const [targetDestination, setTargetDestination] =
    useState<AiCaptureIntent>("invoice");
  const [isCreatingTasks, setIsCreatingTasks] = useState(false);

  const activeClients = clients.filter((c) => !c.archivedAt);

  // Sync native <dialog> showModal() / close() with React state
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
      const timer = setTimeout(() => textareaRef.current?.focus(), 40);
      return () => clearTimeout(timer);
    }
    if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Progressive fallback for click-outside light dismiss if closedby="any" isn't supported
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isOpen) return;
    if ("closedBy" in HTMLDialogElement.prototype) return;

    let pressedOutside = false;
    const isOutsideDialog = (e: PointerEvent) => {
      const rect = dialog.getBoundingClientRect();
      return (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      );
    };
    const onPointerDown = (e: PointerEvent) => {
      pressedOutside = isOutsideDialog(e);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (pressedOutside && isOutsideDialog(e)) {
        dialog.close();
      }
      pressedOutside = false;
    };
    dialog.addEventListener("pointerdown", onPointerDown);
    dialog.addEventListener("pointerup", onPointerUp);
    return () => {
      dialog.removeEventListener("pointerdown", onPointerDown);
      dialog.removeEventListener("pointerup", onPointerUp);
    };
  }, [isOpen]);

  const loadImageBlob = useCallback(
    async (blob: Blob, invertDark = autoInvertDark) => {
      setError(null);
      try {
        const processed = await preprocessScreenshotForOcr(blob, {
          autoInvertDark: invertDark,
        });
        setImageFile(blob);
        setImagePreviewUrl(processed.previewUrl);
        setImageOcrDataUrl(processed.dataUrl);
        setWasDarkInverted(processed.wasInverted);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not read screenshot image.",
        );
      }
    },
    [autoInvertDark],
  );

  const handleToggleDarkInvert = async (checked: boolean) => {
    setAutoInvertDark(checked);
    if (imageFile) {
      await loadImageBlob(imageFile, checked);
    }
  };

  // Global clipboard paste handler while sheet is open
  useEffect(() => {
    if (!isOpen) return;
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          if (blob) {
            event.preventDefault();
            void loadImageBlob(blob);
            return;
          }
        }
      }
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      if (activeTag !== "textarea" && activeTag !== "input") {
        const pastedText = event.clipboardData?.getData("text/plain");
        if (pastedText && pastedText.trim()) {
          event.preventDefault();
          setRawText((prev) => (prev ? `${prev}\n${pastedText}` : pastedText));
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isOpen, loadImageBlob]);

  const handleClear = () => {
    setRawText("");
    setImagePreviewUrl(null);
    setImageOcrDataUrl(null);
    setImageFile(null);
    setWasDarkInverted(false);
    setResult(null);
    setEditableItems([]);
    setSelectedClientId(null);
    setClientInput("");
    setDueDateInput("");
    setClientMenuOpen(false);
    setCatalogPickerItemId(null);
    setError(null);
    textareaRef.current?.focus();
  };

  const handleClearImage = () => {
    setImagePreviewUrl(null);
    setImageOcrDataUrl(null);
    setImageFile(null);
    setWasDarkInverted(false);
  };

  // Close inline popovers (engine switcher, client picker, catalog picker) on outside click
  useEffect(() => {
    if (!isOpen || (!engineMenuOpen && !clientMenuOpen && !catalogPickerItemId)) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        engineMenuOpen &&
        engineMenuRef.current &&
        !engineMenuRef.current.contains(target)
      ) {
        setEngineMenuOpen(false);
      }
      if (
        clientMenuOpen &&
        clientPickerRef.current &&
        !clientPickerRef.current.contains(target)
      ) {
        setClientMenuOpen(false);
      }
      if (
        catalogPickerItemId &&
        catalogPickerRef.current &&
        !catalogPickerRef.current.contains(target)
      ) {
        setCatalogPickerItemId(null);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen, engineMenuOpen, clientMenuOpen, catalogPickerItemId]);

  const handleSelectEngine = async (tier: AiModelTier) => {
    if (!isElectron) {
      setError("Local AI engine selection requires the BillFlow desktop app.");
      setEngineMenuOpen(false);
      return;
    }

    if (tier === "enhanced" && !aiStatus?.enhancedModelDownloaded) {
      if (
        aiStatus?.downloadState === "downloading" ||
        downloadEvent?.state === "downloading"
      ) {
        return;
      }
      setIsSwitchingEngine(true);
      setError(null);
      try {
        const updated = await downloadEnhancedModel();
        if (updated?.enhancedModelDownloaded) {
          showToast("Enhanced Offline AI pack downloaded and enabled.");
          setEngineMenuOpen(false);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not download the Enhanced Offline AI pack.",
        );
      } finally {
        setIsSwitchingEngine(false);
      }
      return;
    }

    if (tier === "ollama" && !aiStatus?.ollamaModel) {
      setEngineMenuOpen(false);
      closeDrawer();
      router.push("/settings?tab=ai");
      return;
    }

    if (tier === (aiStatus?.activeTier ?? "standard")) {
      setEngineMenuOpen(false);
      return;
    }

    setIsSwitchingEngine(true);
    setError(null);
    try {
      await setTier(tier);
      setEngineMenuOpen(false);
      const label =
        tier === "enhanced"
          ? "Enhanced Offline AI"
          : tier === "ollama"
            ? `Local Ollama (${aiStatus?.ollamaModel || "model"})`
            : "Standard Offline AI";
      showToast(`Switched Smart Capture to ${label}.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not switch AI engine.",
      );
    } finally {
      setIsSwitchingEngine(false);
    }
  };

  const handleAnalyze = async () => {
    if (!isElectron || !window.billflow?.ai) {
      setError("Local AI capture requires the BillFlow desktop application.");
      return;
    }
    if (!imageOcrDataUrl && !rawText.trim()) {
      setError("Paste a screenshot or client message first.");
      return;
    }

    setError(null);
    setIsAnalyzing(true);
    setAnalyzeStep(
      imageOcrDataUrl
        ? "Reading screenshot…"
        : aiStatus?.activeTier === "ollama"
          ? "Analyzing with Local Ollama…"
          : aiStatus?.activeTier === "enhanced"
            ? "Analyzing with Enhanced AI…"
            : "Extracting details…",
    );

    try {
      const extracted = await window.billflow.ai.extractInvoice({
        ...(rawText.trim() ? { text: rawText.trim() } : {}),
        ...(imageOcrDataUrl
          ? { imageBase64: imageOcrDataUrl, imageMimeType: "image/png" }
          : {}),
      });
      setResult(extracted);
      setTargetDestination(extracted.detectedIntent || "invoice");
      setEditableItems(extracted.items.map((item) => ({ ...item })));
      setSelectedClientId(extracted.matchedClientId ?? null);
      setClientInput(
        extracted.matchedClientName || extracted.suggestedClient?.name || "",
      );
      setDueDateInput(extracted.dueDate || "");
      setClientMenuOpen(false);
      setCatalogPickerItemId(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not analyze this message. Try clearer text or another screenshot.",
      );
    } finally {
      setIsAnalyzing(false);
      setAnalyzeStep("");
    }
  };

  const buildCuratedItems = (): AiExtractedDeliverable[] =>
    editableItems
      .filter((item) => item.description.trim().length > 0)
      .map((item) => ({
        id: item.id,
        description: item.description.trim(),
        quantity: Math.max(1, item.quantity || 1),
        unitPrice: item.unitPrice,
        priceSource: item.priceSource,
        catalogId: item.catalogId,
        catalogTitle: item.catalogTitle,
        catalogMatchScore: item.catalogMatchScore,
        confidence: item.confidence,
      }));

  const handleSelectSavedClient = (client: ClientWithStats) => {
    setSelectedClientId(client.id);
    setClientInput(client.name);
    setClientMenuOpen(false);
  };

  const handleClientInputChange = (value: string) => {
    setClientInput(value);
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) {
      setSelectedClientId(null);
      return;
    }
    const exactMatch = activeClients.find(
      (c) => c.name.trim().toLowerCase() === trimmed,
    );
    setSelectedClientId(exactMatch ? exactMatch.id : null);
  };

  const handlePickCatalogItemForRow = (rowId: string, cat: CatalogItem) => {
    const formattedPrice =
      cat.priceCents > 0 ? (cat.priceCents / 100).toFixed(2) : cat.price || null;
    handleUpdateItem(rowId, {
      description: cat.title,
      unitPrice: formattedPrice,
      priceSource: "catalog",
      catalogId: cat.id,
      catalogTitle: cat.title,
      catalogMatchScore: 1,
    });
    setCatalogPickerItemId(null);
  };

  const handleDispatchAction = async () => {
    if (!result) return;
    const chosenItems = buildCuratedItems();
    const trimmedClient = clientInput.trim();
    const matchedClientRecord =
      (selectedClientId
        ? activeClients.find((c) => c.id === selectedClientId)
        : undefined) ??
      (trimmedClient
        ? activeClients.find(
            (c) => c.name.trim().toLowerCase() === trimmedClient.toLowerCase(),
          )
        : undefined);

    const resolvedDueDate = dueDateInput.trim() || null;
    const curatedDraft: AiExtractedInvoiceDraft = {
      ...result,
      matchedClientId: matchedClientRecord?.id ?? null,
      matchedClientName: matchedClientRecord?.name ?? null,
      suggestedClient: matchedClientRecord
        ? null
        : trimmedClient
          ? {
              ...(result.suggestedClient ?? {}),
              name: trimmedClient,
            }
          : null,
      currency:
        result.currency ??
        matchedClientRecord?.currency ??
        settings?.defaultCurrency ??
        activeCurrency ??
        null,
      dueDate: resolvedDueDate,
      deliveryUrl: result.deliveryUrl ?? matchedClientRecord?.driveUrl ?? null,
      items: chosenItems,
    };

    if (targetDestination === "invoice") {
      handoffToInvoice(curatedDraft);
      return;
    }

    if (targetDestination === "quote") {
      handoffToQuote(curatedDraft);
      return;
    }

    if (chosenItems.length === 0) {
      setError("Add at least one deliverable to send to the Kanban board.");
      return;
    }
    setIsCreatingTasks(true);
    setError(null);
    try {
      const due = new Date();
      due.setDate(due.getDate() + (settings?.defaultDueDays ?? 7));
      const dueDate = curatedDraft.dueDate || localDateKey(due);
      const currency =
        curatedDraft.currency ||
        settings?.defaultCurrency ||
        activeCurrency ||
        "USD";
      const ownerName = activeProfile?.name || "You";
      const assignee = {
        name: ownerName,
        avatarLetter: ownerName.slice(0, 1).toUpperCase() || "B",
        bgColor: "bg-indigo-100",
        textColor: "text-indigo-700",
      };

      for (const item of chosenItems) {
        await workflow.tasks.create({
          id: `task-${crypto.randomUUID().slice(0, 8)}`,
          title: item.description.slice(0, 140),
          description: result.notes || result.cleanedText.slice(0, 300),
          status: "todo",
          priority: "medium",
          category: "Development",
          assignee,
          dueDate,
          currency,
          ...(curatedDraft.matchedClientId
            ? { clientId: curatedDraft.matchedClientId }
            : {}),
          ...(curatedDraft.matchedClientName ||
          curatedDraft.suggestedClient?.name
            ? {
                clientName:
                  curatedDraft.matchedClientName ||
                  curatedDraft.suggestedClient?.name,
              }
            : {}),
          ...(curatedDraft.deliveryUrl
            ? { deliveryUrl: curatedDraft.deliveryUrl }
            : {}),
          subtasks: [],
        });
      }

      showToast(
        `Added ${chosenItems.length} task${chosenItems.length === 1 ? "" : "s"} to your Kanban board.`,
      );
      closeDrawer();
      router.push("/tasks");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not create tasks on the board.",
      );
    } finally {
      setIsCreatingTasks(false);
    }
  };

  const handleUpdateItem = (
    id: string,
    patch: Partial<AiExtractedDeliverable>,
  ) => {
    setEditableItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const handleAddBlankItem = () => {
    setEditableItems((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        description: "",
        quantity: 1,
        unitPrice: null,
        priceSource: null,
        catalogId: null,
        catalogTitle: null,
        catalogMatchScore: null,
        confidence: 1,
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    setEditableItems((prev) => prev.filter((item) => item.id !== id));
    if (catalogPickerItemId === id) {
      setCatalogPickerItemId(null);
    }
  };

  const hasContent = Boolean(rawText.trim() || imageOcrDataUrl);
  const activeDeliverables = editableItems.filter(
    (item) => item.description.trim().length > 0,
  );
  const selectedCount = activeDeliverables.length;
  const hasCatalogMatch = editableItems.some(
    (item) => Boolean(item.catalogId || item.priceSource === "catalog"),
  );
  const selectedSavedClient = selectedClientId
    ? activeClients.find((c) => c.id === selectedClientId) ?? null
    : null;
  const effectiveCurrency =
    result?.currency ||
    selectedSavedClient?.currency ||
    settings?.defaultCurrency ||
    activeCurrency ||
    "USD";
  const estimatedSubtotal = activeDeliverables.reduce((sum, item) => {
    const price = item.unitPrice ? Number.parseFloat(item.unitPrice) : Number.NaN;
    if (!Number.isFinite(price) || price <= 0) return sum;
    return sum + price * Math.max(1, item.quantity || 1);
  }, 0);
  const formattedEstimatedSubtotal =
    estimatedSubtotal > 0
      ? new Intl.NumberFormat(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(estimatedSubtotal)
      : null;
  const activeTier: AiModelTier = aiStatus?.activeTier ?? "standard";
  const isDownloadingEnhanced =
    aiStatus?.downloadState === "downloading" ||
    downloadEvent?.state === "downloading";
  const downloadProgress =
    downloadEvent?.state === "downloading"
      ? downloadEvent.progress
      : (aiStatus?.downloadProgress ?? 0);
  const expectedEnhancedMb = Math.round(
    (aiStatus?.enhancedModelExpectedBytes ?? 282_621_541) / (1024 * 1024),
  );
  const activeEngineLabel =
    activeTier === "ollama"
      ? aiStatus?.ollamaModel
        ? `Ollama · ${aiStatus.ollamaModel}`
        : "Local Ollama"
      : activeTier === "enhanced"
        ? "Enhanced Offline AI"
        : "Standard Offline AI";

  const dialogProps = {
    closedby: "any",
  } as Record<string, string>;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="smart-capture-sheet app-no-drag"
      onCancel={(e) => {
        if (engineMenuOpen || clientMenuOpen || catalogPickerItemId) {
          e.preventDefault();
          setEngineMenuOpen(false);
          setClientMenuOpen(false);
          setCatalogPickerItemId(null);
        }
      }}
      onClose={() => {
        setEngineMenuOpen(false);
        setClientMenuOpen(false);
        setCatalogPickerItemId(null);
        if (dialogRef.current) dialogRef.current.returnValue = "";
        if (isOpen) closeDrawer();
      }}
      {...dialogProps}
    >
      {/* Clean Editorial Header */}
      <header className="smart-capture-header">
          <div className="min-w-0">
            <h1 id={titleId} className="smart-capture-title">
              Smart Capture
            </h1>
            <p className="smart-capture-subtitle">
              Drop a screenshot or paste a client message.
            </p>
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Close Smart Capture"
            className="smart-capture-close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Scrollable Sheet Body */}
        <div className="smart-capture-body">
          {/* Unified Composer (Text + Screenshot Drop/Paste + Primary Action) */}
          <div
            data-dragging={isDragging}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setIsDragging(false);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file && file.type.startsWith("image/")) {
                void loadImageBlob(file);
              }
            }}
            className="smart-capture-composer"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/bmp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void loadImageBlob(file);
                e.target.value = "";
              }}
            />

            {imagePreviewUrl && (
              <div className="px-3.5 pt-3.5 space-y-2">
                <div className="relative rounded-xl overflow-hidden border border-line-neutral-200 bg-canvas max-h-44 flex items-center justify-center">
                  <img
                    src={imagePreviewUrl}
                    alt="Pasted client screenshot"
                    className="max-h-44 w-auto object-contain"
                  />
                  <button
                    type="button"
                    onClick={handleClearImage}
                    aria-label="Remove screenshot"
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/75 text-white hover:bg-black flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-content-neutral-500">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoInvertDark}
                      onChange={(e) =>
                        void handleToggleDarkInvert(e.target.checked)
                      }
                      className="rounded cursor-pointer"
                    />
                    <span>Invert dark screenshot for OCR</span>
                  </label>
                  {wasDarkInverted && (
                    <span className="text-accent font-medium">Inverted</span>
                  )}
                </div>
              </div>
            )}

            <textarea
              ref={textareaRef}
              aria-label="Client message text or screenshot notes"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void handleAnalyze();
                }
              }}
              placeholder={
                imagePreviewUrl
                  ? "Add optional context or click Scan & extract..."
                  : `Paste message text or press ${formatShortcut("Cmd+V", isMac)} with a screenshot...`
              }
              className="smart-capture-textarea"
            />

            <div className="smart-capture-toolbar">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="smart-capture-tool-btn"
                  title="Attach or drop a screenshot (PNG, JPG, WebP)"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>{imagePreviewUrl ? "Replace image" : "Screenshot"}</span>
                  {!imagePreviewUrl && (
                    <span className="smart-capture-kbd">
                      {formatShortcut("Cmd+V", isMac)}
                    </span>
                  )}
                </button>

                {hasContent && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="smart-capture-tool-btn"
                  >
                    Clear
                  </button>
                )}
              </div>

              <button
                type="button"
                disabled={isAnalyzing || !hasContent}
                onClick={() => void handleAnalyze()}
                className="smart-capture-extract-btn"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{analyzeStep || "Analyzing…"}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{imageOcrDataUrl ? "Scan & extract" : "Extract"}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error Feedback */}
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-line-rose-200 bg-surface-rose-50/80 px-3.5 py-2.5 text-[13px] text-content-rose-700 flex items-start gap-2.5"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Quiet Typographic Overview Before First Extraction */}
          {!result && !isAnalyzing && (
            <div className="smart-capture-guide">
              <div className="smart-capture-guide-row">
                <ImageIcon className="w-4 h-4 smart-capture-guide-icon" />
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium text-content-neutral-900">
                    Offline screenshot OCR
                  </p>
                  <p className="text-[13px] text-content-neutral-500 mt-0.5 leading-relaxed">
                    Drop or paste any chat screenshot. Dark themes are
                    automatically inverted for clean reading.
                  </p>
                </div>
              </div>
              <div className="smart-capture-guide-row">
                <Receipt className="w-4 h-4 smart-capture-guide-icon" />
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium text-content-neutral-900">
                    Client &amp; catalog matching
                  </p>
                  <p className="text-[13px] text-content-neutral-500 mt-0.5 leading-relaxed">
                    Matches saved clients, extracts due dates and links, and
                    suggests rates from your Service Catalog.
                  </p>
                </div>
              </div>
              <div className="smart-capture-guide-row">
                <Sparkles className="w-4 h-4 smart-capture-guide-icon" />
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium text-content-neutral-900">
                    Intent-aware routing
                  </p>
                  <p className="text-[13px] text-content-neutral-500 mt-0.5 leading-relaxed">
                    Detects whether to pre-fill a New Invoice, Proposal / Quote,
                    or create Kanban Tasks directly.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Extracted Result Workspace */}
          {result && (
            <div className="space-y-4">
              {/* Destination Selector & Status Chips */}
              <section className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[14px] font-semibold tracking-[-0.02em] text-content-neutral-950">
                    Destination
                  </h2>
                  <div className="flex items-center gap-1.5">
                    {hasCatalogMatch && (
                      <span className="smart-capture-source-pill smart-capture-source-pill--catalog">
                        Matched from catalog
                      </span>
                    )}
                    <span className="smart-capture-engine-chip tabular-nums">
                      {result.engineUsed === "ollama"
                        ? "Local Ollama"
                        : result.engineUsed === "enhanced"
                          ? "Enhanced AI"
                          : "Standard AI"}{" "}
                      · {(result.durationMs / 1000).toFixed(1)}s
                    </span>
                  </div>
                </div>

                <div
                  role="radiogroup"
                  aria-label="Destination workspace workflow"
                  className="smart-capture-segments"
                >
                  {(
                    [
                      { id: "invoice", label: "Invoice", icon: Receipt },
                      { id: "quote", label: "Proposal", icon: FileText },
                      { id: "tasks", label: "Tasks", icon: ClipboardList },
                    ] as const
                  ).map((opt) => {
                    const Icon = opt.icon;
                    const active = targetDestination === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setTargetDestination(opt.id)}
                        className="smart-capture-segment"
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>

                <p className="text-[12px] text-content-neutral-500 leading-relaxed">
                  {result.intentReason}
                </p>
              </section>

              {/* Soft Warnings */}
              {result.warnings.length > 0 && (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-3.5 py-2.5 space-y-1">
                  {result.warnings.map((warning, idx) => (
                    <p
                      key={idx}
                      className="text-[12px] text-content-amber-700 leading-relaxed"
                    >
                      {warning}
                    </p>
                  ))}
                </div>
              )}

              {/* Editable Client & Due Date Card */}
              <section className="smart-capture-item-card smart-capture-item-card--interactive">
                <div ref={clientPickerRef} className="relative">
                  <div className="smart-capture-item-top">
                    {selectedSavedClient ? (
                      <UserCheck className="w-4 h-4 text-content-emerald-600 shrink-0" />
                    ) : clientInput.trim() ? (
                      <UserPlus className="w-4 h-4 text-accent shrink-0" />
                    ) : (
                      <User className="w-4 h-4 text-content-neutral-400 shrink-0" />
                    )}

                    <input
                      type="text"
                      aria-label="Client name"
                      value={clientInput}
                      onChange={(e) => handleClientInputChange(e.target.value)}
                      placeholder="Add or select a client"
                      className="smart-capture-item-title"
                    />

                    {activeClients.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setCatalogPickerItemId(null);
                          setClientMenuOpen((prev) => !prev);
                        }}
                        aria-expanded={clientMenuOpen}
                        aria-label="Choose from saved clients"
                        title="Choose from saved clients"
                        className="smart-capture-picker-btn"
                        data-active={Boolean(selectedSavedClient)}
                      >
                        <Users className="w-3.5 h-3.5" />
                        <ChevronDown
                          className={`w-3 h-3 transition-transform duration-150 ${
                            clientMenuOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    )}
                  </div>

                  {clientMenuOpen && activeClients.length > 0 && (
                    <div
                      role="listbox"
                      aria-label="Saved clients"
                      className="smart-capture-inline-dropdown"
                    >
                      <div className="smart-capture-inline-dropdown-title">
                        Saved Clients
                      </div>
                      {activeClients.map((client) => {
                        const isPicked = selectedClientId === client.id;
                        return (
                          <button
                            key={client.id}
                            type="button"
                            role="option"
                            aria-selected={isPicked}
                            onClick={() => handleSelectSavedClient(client)}
                            className="smart-capture-inline-option"
                          >
                            <div className="min-w-0 flex-1 text-left">
                              <div className="text-[12.5px] font-medium text-content-neutral-900 truncate">
                                {client.name}
                              </div>
                              {(client.contactPerson || client.email) && (
                                <div className="text-[11px] text-content-neutral-500 truncate">
                                  {client.contactPerson || client.email}
                                </div>
                              )}
                            </div>
                            <span className="text-[11px] font-semibold text-content-neutral-500 tabular-nums shrink-0">
                              {client.currency}
                            </span>
                            {isPicked && (
                              <Check className="w-3.5 h-3.5 text-accent shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="smart-capture-item-bottom">
                  <label className="smart-capture-metric-box smart-capture-metric-box--date">
                    <Calendar className="w-3.5 h-3.5 text-content-neutral-400 shrink-0" />
                    <span className="smart-capture-metric-label">Due</span>
                    <input
                      type="date"
                      aria-label="Due date"
                      value={dueDateInput}
                      onChange={(e) => setDueDateInput(e.target.value)}
                      className="smart-capture-metric-input smart-capture-metric-input--date"
                    />
                  </label>

                  <span className="smart-capture-currency-chip tabular-nums">
                    {effectiveCurrency}
                  </span>

                  {result.deliveryUrl && (
                    <span
                      title={result.deliveryUrl}
                      className="smart-capture-meta-chip max-w-full"
                    >
                      <Link2 className="w-3 h-3 shrink-0" />
                      <span className="truncate">{result.deliveryUrl}</span>
                    </span>
                  )}
                </div>
              </section>

              {/* Deliverables Cards */}
              <section className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-[14px] font-semibold tracking-[-0.02em] text-content-neutral-950">
                    Deliverables ({selectedCount})
                  </h2>
                  <button
                    type="button"
                    onClick={handleAddBlankItem}
                    className="smart-capture-add-item-btn"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add item</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {editableItems.map((item) => {
                    const isCatalogOpen = catalogPickerItemId === item.id;
                    return (
                      <div
                        key={item.id}
                        className="smart-capture-item-card smart-capture-item-card--interactive"
                      >
                        <div
                          ref={isCatalogOpen ? catalogPickerRef : undefined}
                          className="relative"
                        >
                          <div className="smart-capture-item-top">
                            <input
                              type="text"
                              aria-label="Deliverable name"
                              value={item.description}
                              onChange={(e) =>
                                handleUpdateItem(item.id, {
                                  description: e.target.value,
                                  catalogId: null,
                                  catalogTitle: null,
                                  catalogMatchScore: null,
                                  priceSource:
                                    item.priceSource === "catalog"
                                      ? null
                                      : item.priceSource,
                                })
                              }
                              placeholder="Deliverable name"
                              className="smart-capture-item-title"
                            />

                            {catalogItems.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setClientMenuOpen(false);
                                  setCatalogPickerItemId(
                                    isCatalogOpen ? null : item.id,
                                  );
                                }}
                                aria-expanded={isCatalogOpen}
                                aria-label="Choose from Service Catalog"
                                title={
                                  item.catalogTitle
                                    ? `Catalog item: ${item.catalogTitle} (click to switch)`
                                    : "Choose from Service Catalog"
                                }
                                className="smart-capture-picker-btn"
                                data-active={Boolean(item.catalogId)}
                              >
                                <Package className="w-3.5 h-3.5" />
                                <ChevronDown
                                  className={`w-3 h-3 transition-transform duration-150 ${
                                    isCatalogOpen ? "rotate-180" : ""
                                  }`}
                                />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              aria-label="Remove item"
                              className="smart-capture-item-remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {isCatalogOpen && catalogItems.length > 0 && (
                            <div
                              role="listbox"
                              aria-label="Service Catalog items"
                              className="smart-capture-inline-dropdown"
                            >
                              <div className="smart-capture-inline-dropdown-title">
                                Service Catalog
                              </div>
                              {catalogItems.map((cat) => {
                                const isPicked = item.catalogId === cat.id;
                                const priceLabel =
                                  cat.priceCents > 0
                                    ? `${cat.currency} ${(cat.priceCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                    : cat.price || "";
                                return (
                                  <button
                                    key={cat.id}
                                    type="button"
                                    role="option"
                                    aria-selected={isPicked}
                                    onClick={() =>
                                      handlePickCatalogItemForRow(item.id, cat)
                                    }
                                    className="smart-capture-inline-option"
                                  >
                                    <div className="min-w-0 flex-1 text-left">
                                      <div className="text-[12.5px] font-medium text-content-neutral-900 truncate">
                                        {cat.title}
                                      </div>
                                      <div className="text-[11px] text-content-neutral-500 truncate">
                                        {cat.category}
                                      </div>
                                    </div>
                                    {priceLabel && (
                                      <span className="text-[11.5px] font-medium text-content-neutral-600 tabular-nums shrink-0">
                                        {priceLabel}
                                      </span>
                                    )}
                                    {isPicked && (
                                      <Check className="w-3.5 h-3.5 text-accent shrink-0" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="smart-capture-item-bottom">
                          <label className="smart-capture-metric-box smart-capture-metric-box--qty">
                            <span className="smart-capture-metric-label">Qty</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              value={item.quantity}
                              onChange={(e) =>
                                handleUpdateItem(item.id, {
                                  quantity: Math.max(
                                    1,
                                    Number.parseInt(e.target.value, 10) || 1,
                                  ),
                                })
                              }
                              className="smart-capture-metric-input smart-capture-metric-input--qty"
                            />
                          </label>

                          <label className="smart-capture-metric-box smart-capture-metric-box--price">
                            <span className="smart-capture-metric-label">
                              {effectiveCurrency}
                            </span>
                            <input
                              type="number"
                              inputMode="decimal"
                              step="any"
                              min={0}
                              value={item.unitPrice ?? ""}
                              placeholder="0.00"
                              onChange={(e) =>
                                handleUpdateItem(item.id, {
                                  unitPrice: e.target.value || null,
                                })
                              }
                              className="smart-capture-metric-input smart-capture-metric-input--price"
                            />
                          </label>

                          {item.priceSource === "catalog" && item.catalogTitle && (
                            <span className="text-[11.5px] font-medium text-accent shrink-0">
                              From catalog
                            </span>
                          )}
                          {item.priceSource === "message" && (
                            <span className="text-[11.5px] font-medium text-content-emerald-600 shrink-0">
                              From message
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {formattedEstimatedSubtotal && (
                  <div className="smart-capture-total-bar">
                    <span>Estimated total</span>
                    <strong className="tabular-nums">
                      {effectiveCurrency} {formattedEstimatedSubtotal}
                    </strong>
                  </div>
                )}
              </section>

              {/* Native <details> Raw OCR Viewer */}
              {result.ocrText && (
                <details className="group border-t border-line-neutral-200 pt-3">
                  <summary className="flex items-center justify-between text-[12.5px] font-medium text-content-neutral-500 hover:text-content-neutral-900 cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden">
                    <span>Raw OCR text</span>
                    <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
                  </summary>
                  <pre className="mt-2.5 p-3 rounded-xl bg-surface-neutral-50 border border-line-neutral-200 text-xs text-content-neutral-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {result.ocrText}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>

        {/* Minimal Footer with In-Place AI Engine Switcher */}
        <footer className="smart-capture-footer">
          <div ref={engineMenuRef} className="smart-capture-engine-switcher">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={engineMenuOpen}
              aria-label="Switch Smart Capture AI engine"
              disabled={isSwitchingEngine && !isDownloadingEnhanced}
              onClick={() => setEngineMenuOpen((prev) => !prev)}
              className="smart-capture-engine-trigger"
            >
              {isDownloadingEnhanced || isSwitchingEngine ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-accent shrink-0" />
              ) : activeTier === "ollama" ? (
                <Server className="w-3.5 h-3.5 text-accent shrink-0" />
              ) : activeTier === "enhanced" ? (
                <Cpu className="w-3.5 h-3.5 text-accent shrink-0" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-accent shrink-0" />
              )}
              <span className="truncate max-w-[180px]">
                {isDownloadingEnhanced
                  ? `Downloading Enhanced (${downloadProgress}%)…`
                  : activeEngineLabel}
              </span>
              <ChevronUp
                className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${
                  engineMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {engineMenuOpen && (
              <div
                role="listbox"
                aria-label="Select AI engine"
                className="smart-capture-engine-popover"
              >
                <div className="px-2.5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-content-neutral-400">
                  Local AI Engine
                </div>

                <button
                  type="button"
                  role="option"
                  aria-selected={activeTier === "standard"}
                  onClick={() => void handleSelectEngine("standard")}
                  className="smart-capture-engine-option"
                >
                  <Zap className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1 text-left">
                    <div className="text-[12.5px] font-medium text-content-neutral-900">
                      Standard Offline AI
                    </div>
                    <div className="text-[11px] text-content-neutral-500">
                      Built-in MiniLM · Instant
                    </div>
                  </div>
                  {activeTier === "standard" && (
                    <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  role="option"
                  aria-selected={activeTier === "enhanced"}
                  onClick={() => void handleSelectEngine("enhanced")}
                  className="smart-capture-engine-option"
                >
                  {isDownloadingEnhanced ? (
                    <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0 mt-0.5" />
                  ) : aiStatus?.enhancedModelDownloaded ? (
                    <Cpu className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                  ) : (
                    <Download className="w-4 h-4 text-content-neutral-500 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1 text-left">
                    <div className="text-[12.5px] font-medium text-content-neutral-900">
                      Enhanced Offline AI
                    </div>
                    <div className="text-[11px] text-content-neutral-500">
                      {isDownloadingEnhanced
                        ? `Downloading pack (${downloadProgress}%)…`
                        : aiStatus?.enhancedModelDownloaded
                          ? "BGE-Base + DeBERTa NLI · High precision"
                          : `Click to download (~${expectedEnhancedMb} MB) & enable`}
                    </div>
                    {isDownloadingEnhanced && (
                      <div className="mt-1.5 h-1.5 w-full rounded-full bg-surface-neutral-200 overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full transition-[width] duration-200"
                          style={{ width: `${Math.max(4, downloadProgress)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  {activeTier === "enhanced" && (
                    <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  role="option"
                  aria-selected={activeTier === "ollama"}
                  onClick={() => void handleSelectEngine("ollama")}
                  className="smart-capture-engine-option"
                >
                  <Server className="w-4 h-4 text-content-neutral-500 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1 text-left">
                    <div className="text-[12.5px] font-medium text-content-neutral-900">
                      Local Ollama
                    </div>
                    <div className="text-[11px] text-content-neutral-500 truncate">
                      {aiStatus?.ollamaModel
                        ? `${aiStatus.ollamaModel} · 127.0.0.1`
                        : "Set up local Ollama in Settings"}
                    </div>
                  </div>
                  {activeTier === "ollama" && (
                    <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                  )}
                </button>

                <div className="mt-1 pt-1 border-t border-line-neutral-200">
                  <Link
                    href="/settings?tab=ai"
                    onClick={() => {
                      setEngineMenuOpen(false);
                      closeDrawer();
                    }}
                    className="smart-capture-engine-settings"
                  >
                    <Settings className="w-3.5 h-3.5 shrink-0" />
                    <span>Manage AI models in Settings…</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {result && (
            <button
              type="button"
              disabled={isCreatingTasks}
              onClick={() => void handleDispatchAction()}
              className="smart-capture-cta"
            >
              {isCreatingTasks ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Adding tasks…</span>
                </>
              ) : targetDestination === "quote" ? (
                <>
                  <span>Create proposal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              ) : targetDestination === "tasks" ? (
                <>
                  <span>
                    Add {selectedCount || 1} task
                    {selectedCount === 1 ? "" : "s"}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <span>Create invoice</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          )}
        </footer>
    </dialog>
  );
}
