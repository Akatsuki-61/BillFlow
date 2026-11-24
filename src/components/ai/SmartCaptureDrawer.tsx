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
  ClipboardList,
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  Plus,
  Receipt,
  Settings,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  X,
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
} from "@/types/ai";
import "./smart-capture.css";

interface EditableDeliverable extends AiExtractedDeliverable {
  selected: boolean;
}

export function SmartCaptureDrawer() {
  const router = useRouter();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    isOpen,
    closeDrawer,
    aiStatus,
    handoffToInvoice,
    handoffToQuote,
  } = useAiCapture();
  const { isElectron, workflow, activeCurrency, settings } = useData();
  const { activeProfile } = useProfiles();
  const { showToast } = useToast();
  const isMac = useIsMac();

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
  const [editableItems, setEditableItems] = useState<EditableDeliverable[]>([]);
  const [targetDestination, setTargetDestination] =
    useState<AiCaptureIntent>("invoice");
  const [isCreatingTasks, setIsCreatingTasks] = useState(false);

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
    setError(null);
    textareaRef.current?.focus();
  };

  const handleClearImage = () => {
    setImagePreviewUrl(null);
    setImageOcrDataUrl(null);
    setImageFile(null);
    setWasDarkInverted(false);
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
        : aiStatus?.activeTier === "enhanced"
          ? "Analyzing with Local LLM…"
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
      setEditableItems(
        extracted.items.map((item) => ({
          ...item,
          selected: true,
        })),
      );
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
      .filter((item) => item.selected && item.description.trim().length > 0)
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

  const handleDispatchAction = async () => {
    if (!result) return;
    const chosenItems = buildCuratedItems();
    const curatedDraft: AiExtractedInvoiceDraft = {
      ...result,
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
      setError("Select at least one deliverable to add to the Kanban board.");
      return;
    }
    setIsCreatingTasks(true);
    setError(null);
    try {
      const due = new Date();
      due.setDate(due.getDate() + (settings?.defaultDueDays ?? 7));
      const dueDate = result.dueDate || localDateKey(due);
      const currency =
        result.currency || settings?.defaultCurrency || activeCurrency || "USD";
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
          ...(result.matchedClientId
            ? { clientId: result.matchedClientId }
            : {}),
          ...(result.matchedClientName || result.suggestedClient?.name
            ? {
                clientName:
                  result.matchedClientName || result.suggestedClient?.name,
              }
            : {}),
          ...(result.deliveryUrl ? { deliveryUrl: result.deliveryUrl } : {}),
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
    patch: Partial<EditableDeliverable>,
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
        selected: true,
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    setEditableItems((prev) => prev.filter((item) => item.id !== id));
  };

  const hasContent = Boolean(rawText.trim() || imageOcrDataUrl);
  const selectedCount = editableItems.filter(
    (item) => item.selected && item.description.trim().length > 0,
  ).length;
  const activeEngineLabel =
    aiStatus?.activeTier === "enhanced"
      ? "Enhanced Local LLM"
      : "Standard Offline AI";

  const dialogProps = {
    closedby: "any",
  } as Record<string, string>;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="smart-capture-sheet app-no-drag"
      onClose={() => {
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
            <div className="space-y-5">
              {/* Destination Selector & Intent Summary */}
              <section className="space-y-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-content-neutral-950">
                    Destination
                  </h2>
                  <span className="text-xs text-content-neutral-500 tabular-nums">
                    {result.engineUsed === "enhanced"
                      ? "Enhanced LLM"
                      : "Standard AI"}{" "}
                    · {(result.durationMs / 1000).toFixed(1)}s
                  </span>
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

                <p className="text-[12.5px] text-content-neutral-500">
                  {result.intentReason}
                </p>
              </section>

              {/* Soft Warnings */}
              {result.warnings.length > 0 && (
                <div className="space-y-1.5 border-l-2 border-amber-500/70 pl-3 py-0.5">
                  {result.warnings.map((warning, idx) => (
                    <p
                      key={idx}
                      className="text-[12.5px] text-content-amber-700"
                    >
                      {warning}
                    </p>
                  ))}
                </div>
              )}

              {/* Detected Client & Details */}
              <section className="border-t border-line-neutral-200 pt-4 space-y-2.5 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  {result.matchedClientId ? (
                    <span className="inline-flex items-center gap-2 text-content-neutral-900 font-medium min-w-0">
                      <UserCheck className="w-4 h-4 text-content-emerald-600 shrink-0" />
                      <span className="truncate">{result.matchedClientName}</span>
                    </span>
                  ) : result.suggestedClient ? (
                    <span className="inline-flex items-center gap-2 text-content-neutral-900 font-medium min-w-0">
                      <UserPlus className="w-4 h-4 text-accent shrink-0" />
                      <span className="truncate">
                        {result.suggestedClient.name}
                        {result.suggestedClient.email
                          ? ` · ${result.suggestedClient.email}`
                          : ""}
                      </span>
                    </span>
                  ) : (
                    <span className="text-content-neutral-500">
                      Client will be selected in the form
                    </span>
                  )}
                  {result.currency && (
                    <span className="text-xs font-semibold text-content-neutral-600 tabular-nums shrink-0">
                      {result.currency}
                    </span>
                  )}
                </div>

                {(result.dueDate || result.deliveryUrl) && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-content-neutral-500">
                    {result.dueDate && (
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        <span>Due {result.dueDate}</span>
                      </span>
                    )}
                    {result.deliveryUrl && (
                      <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
                        <Link2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{result.deliveryUrl}</span>
                      </span>
                    )}
                  </div>
                )}
              </section>

              {/* Deliverables List */}
              <section className="border-t border-line-neutral-200 pt-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-content-neutral-950">
                    Deliverables ({selectedCount})
                  </h2>
                  <button
                    type="button"
                    onClick={handleAddBlankItem}
                    className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add item</span>
                  </button>
                </div>

                <div className="divide-y divide-line-neutral-200">
                  {editableItems.map((item) => (
                    <div
                      key={item.id}
                      className={`py-3 space-y-2 transition-opacity ${
                        item.selected ? "opacity-100" : "opacity-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateItem(item.id, {
                              selected: !item.selected,
                            })
                          }
                          aria-label={
                            item.selected
                              ? "Unselect deliverable"
                              : "Select deliverable"
                          }
                          className={`w-[18px] h-[18px] rounded-[6px] border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                            item.selected
                              ? "bg-accent-solid border-accent-solid text-white shadow-2xs"
                              : "border-line-neutral-300 bg-transparent"
                          }`}
                        >
                          {item.selected && (
                            <Check className="w-3 h-3" strokeWidth={2.75} />
                          )}
                        </button>

                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) =>
                            handleUpdateItem(item.id, {
                              description: e.target.value,
                            })
                          }
                          placeholder="Deliverable description"
                          className="ui-field flex-1 h-9 !min-h-[36px] px-3 text-[13px]"
                        />

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          aria-label="Remove item"
                          className="p-1.5 text-content-neutral-400 hover:text-content-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2 pl-[28px]">
                        <div className="flex items-center gap-2">
                          <label className="inline-flex items-center gap-1.5 text-xs text-content-neutral-500">
                            <span>Qty</span>
                            <input
                              type="number"
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
                              className="ui-field w-14 h-8 !min-h-[32px] px-2 text-center text-xs tabular-nums"
                            />
                          </label>
                          <label className="inline-flex items-center gap-1.5 text-xs text-content-neutral-500">
                            <span>Price</span>
                            <input
                              type="number"
                              step="any"
                              min={0}
                              value={item.unitPrice ?? ""}
                              placeholder="Optional"
                              onChange={(e) =>
                                handleUpdateItem(item.id, {
                                  unitPrice: e.target.value || null,
                                })
                              }
                              className="ui-field w-28 h-8 !min-h-[32px] px-2.5 text-xs tabular-nums"
                            />
                          </label>
                        </div>

                        {item.priceSource === "catalog" && item.catalogTitle && (
                          <span
                            title={`Matched catalog service: ${item.catalogTitle}`}
                            className="text-[12px] font-medium text-accent truncate max-w-[140px] tabular-nums"
                          >
                            Catalog{" "}
                            {item.catalogMatchScore
                              ? `${Math.round(item.catalogMatchScore * 100)}%`
                              : ""}
                          </span>
                        )}
                        {item.priceSource === "message" && (
                          <span className="text-[12px] font-medium text-content-emerald-600">
                            From message
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
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

        {/* Minimal Footer */}
        <footer className="smart-capture-footer">
          <Link
            href="/settings?tab=ai"
            onClick={closeDrawer}
            className="smart-capture-settings-link"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>{activeEngineLabel}</span>
          </Link>

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
