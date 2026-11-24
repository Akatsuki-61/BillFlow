"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  ClipboardPaste,
  Cpu,
  Image as ImageIcon,
  Link2,
  Loader2,
  Plus,
  Receipt,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react";
import { useAiCapture } from "@/context/AiCaptureContext";
import { useData } from "@/lib/data/DataProvider";
import { preprocessScreenshotForOcr } from "@/lib/image-preprocess";
import { formatShortcut, useIsMac } from "@/lib/platform-shortcuts";
import { EASE_ENTER, EASE_EXIT } from "@/lib/motion";
import { Button } from "@/components/ui/Workspace";
import type {
  AiExtractedDeliverable,
  AiExtractedInvoiceDraft,
} from "@/types/ai";

interface EditableDeliverable extends AiExtractedDeliverable {
  selected: boolean;
}

export function SmartCaptureDrawer() {
  const { isOpen, closeDrawer, aiStatus, handoffToInvoice } = useAiCapture();
  const { isElectron } = useData();
  const reducedMotion = useReducedMotion();
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
  const [showRawOcr, setShowRawOcr] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Re-run preprocessing if the user toggles dark-mode inversion on an attached screenshot
  const handleToggleDarkInvert = async (checked: boolean) => {
    setAutoInvertDark(checked);
    if (imageFile) {
      await loadImageBlob(imageFile, checked);
    }
  };

  // Escape key & global paste listener while drawer is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
      }
    };

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
      // If focus is not in an input/textarea and user pastes text, put it straight in the message box
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      if (activeTag !== "textarea" && activeTag !== "input") {
        const pastedText = event.clipboardData?.getData("text/plain");
        if (pastedText && pastedText.trim()) {
          event.preventDefault();
          setRawText((prev) => (prev ? `${prev}\n${pastedText}` : pastedText));
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("paste", handlePaste);
    };
  }, [isOpen, closeDrawer, loadImageBlob]);

  const handleClear = () => {
    setRawText("");
    setImagePreviewUrl(null);
    setImageOcrDataUrl(null);
    setImageFile(null);
    setWasDarkInverted(false);
    setResult(null);
    setEditableItems([]);
    setShowRawOcr(false);
    setError(null);
  };

  const handleClearImage = () => {
    setImagePreviewUrl(null);
    setImageOcrDataUrl(null);
    setImageFile(null);
    setWasDarkInverted(false);
  };

  const handleAnalyze = async () => {
    if (!isElectron || !window.billflow?.ai) {
      setError(
        "Local AI capture requires the BillFlow desktop application.",
      );
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
        ? "Reading screenshot text with offline OCR…"
        : aiStatus?.activeTier === "enhanced"
          ? "Analyzing message with Local LLM…"
          : "Extracting deliverables with Standard local AI…",
    );

    try {
      const extracted = await window.billflow.ai.extractInvoice({
        ...(rawText.trim() ? { text: rawText.trim() } : {}),
        ...(imageOcrDataUrl
          ? { imageBase64: imageOcrDataUrl, imageMimeType: "image/png" }
          : {}),
      });
      setResult(extracted);
      setEditableItems(
        extracted.items.map((item) => ({
          ...item,
          selected: true,
        })),
      );
      setShowRawOcr(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not analyze this message. Try pasting clearer text or screenshot.",
      );
    } finally {
      setIsAnalyzing(false);
      setAnalyzeStep("");
    }
  };

  const handleCreateInvoice = () => {
    if (!result) return;
    const chosenItems: AiExtractedDeliverable[] = editableItems
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

    handoffToInvoice({
      ...result,
      items: chosenItems,
    });
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

  if (typeof document === "undefined") return null;

  const activeTierLabel =
    aiStatus?.activeTier === "enhanced"
      ? "Enhanced · Local LLM"
      : "Standard · Offline ML";

  const selectedCount = editableItems.filter(
    (item) => item.selected && item.description.trim().length > 0,
  ).length;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end app-no-drag"
          role="dialog"
          aria-modal="true"
          aria-label="Smart Invoice Capture"
        >
          {/* Backdrop */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.18 }}
            onClick={closeDrawer}
            className="fixed inset-0 bg-black/30 dark:bg-black/55 backdrop-blur-[2px]"
          />

          {/* Right Slide-Over Panel */}
          <m.aside
            initial={{ x: reducedMotion ? 0 : 480, opacity: reducedMotion ? 1 : 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: reducedMotion ? 0 : 480, opacity: reducedMotion ? 1 : 0 }}
            transition={{
              duration: reducedMotion ? 0 : 0.24,
              ease: EASE_ENTER,
            }}
            className="relative z-10 w-full max-w-[500px] h-full bg-surface border-l border-line-neutral-200 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.28)] flex flex-col"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-line-neutral-200/80 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-accent-faint text-accent flex items-center justify-center shrink-0">
                  <Sparkles className="w-4.5 h-4.5" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[15px] font-semibold text-content-neutral-950 truncate">
                      Smart Capture
                    </h2>
                    <Link
                      href="/settings?tab=ai"
                      onClick={closeDrawer}
                      title="Configure Local AI engine in Settings"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-neutral-100 hover:bg-surface-neutral-200/70 text-content-neutral-700 transition-colors"
                    >
                      <Cpu className="w-3 h-3 text-accent" />
                      <span>{activeTierLabel}</span>
                    </Link>
                  </div>
                  <p className="text-xs text-content-neutral-500 truncate">
                    Paste a WhatsApp, Slack, or email screenshot or message.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeDrawer}
                aria-label="Close Smart Capture"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-content-neutral-500 hover:text-content-neutral-900 hover:bg-surface-neutral-100 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Screenshot Drop & Paste Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file && file.type.startsWith("image/")) {
                    void loadImageBlob(file);
                  }
                }}
                className={`rounded-2xl border-2 border-dashed transition-colors p-3.5 ${
                  isDragging
                    ? "border-accent bg-accent-faint/60"
                    : "border-line-neutral-200 bg-surface-neutral-50/70"
                }`}
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

                {imagePreviewUrl ? (
                  <div className="space-y-2.5">
                    <div className="relative rounded-xl overflow-hidden border border-line-neutral-200 bg-surface max-h-48 flex items-center justify-center">
                      <img
                        src={imagePreviewUrl}
                        alt="Pasted client screenshot"
                        className="max-h-48 w-auto object-contain"
                      />
                      <button
                        type="button"
                        onClick={handleClearImage}
                        aria-label="Remove screenshot"
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white hover:bg-black flex items-center justify-center cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11.5px] text-content-neutral-600">
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={autoInvertDark}
                          onChange={(e) =>
                            void handleToggleDarkInvert(e.target.checked)
                          }
                          className="rounded accent-purple-600 cursor-pointer"
                        />
                        <span>Auto-invert dark chat screenshots</span>
                      </label>
                      {wasDarkInverted && (
                        <span className="text-[11px] font-medium text-accent">
                          Dark UI inverted for OCR
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 py-1">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-surface border border-line-neutral-200 flex items-center justify-center text-content-neutral-500 shrink-0">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-content-neutral-800">
                          Paste screenshot ({formatShortcut("Cmd+V", isMac)}) or drop image
                        </p>
                        <p className="text-[11px] text-content-neutral-500">
                          Processed 100% locally via offline Tesseract OCR
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="small"
                      onClick={() => fileInputRef.current?.click()}
                      className="shrink-0 text-xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Browse</span>
                    </Button>
                  </div>
                )}
              </div>

              {/* Message Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="smart-capture-text"
                    className="text-[11px] font-bold uppercase tracking-wider text-content-neutral-500 flex items-center gap-1.5"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    <span>Or Paste Message Text</span>
                  </label>
                  {(rawText || imagePreviewUrl) && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="text-[11px] text-content-neutral-500 hover:text-content-neutral-900 cursor-pointer"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <textarea
                  ref={textareaRef}
                  id="smart-capture-text"
                  rows={4}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      void handleAnalyze();
                    }
                  }}
                  placeholder="Paste WhatsApp, Slack, Signal, or email text here...&#10;e.g. 'Hi, we need a landing page redesign and Stripe checkout by next Friday.'"
                  className="ui-field w-full px-3.5 py-2.5 text-xs resize-y min-h-[92px]"
                />
              </div>

              {/* Analyze Trigger */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="primary"
                  disabled={isAnalyzing || (!rawText.trim() && !imageOcrDataUrl)}
                  onClick={() => void handleAnalyze()}
                  className="flex-1 justify-center"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{analyzeStep || "Analyzing…"}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>
                        {imageOcrDataUrl
                          ? "Scan Screenshot & Extract"
                          : "Extract Invoice Details"}
                      </span>
                    </>
                  )}
                </Button>
              </div>

              {/* Error Banner */}
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/30 px-3.5 py-2.5 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Extracted Results Preview */}
              {result && (
                <m.div
                  initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reducedMotion ? 0 : 0.2, ease: EASE_EXIT }}
                  className="space-y-3.5 pt-2 border-t border-line-neutral-200/80"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-content-neutral-700">
                      Extracted Invoice Draft
                    </h3>
                    <span className="text-[11px] text-content-neutral-500 tabular-nums">
                      {result.engineUsed === "enhanced"
                        ? "Enhanced Local LLM"
                        : "Standard Local ML"}{" "}
                      · {(result.durationMs / 1000).toFixed(1)}s
                    </span>
                  </div>

                  {/* Warnings */}
                  {result.warnings.length > 0 && (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/25 px-3 py-2 space-y-1">
                      {result.warnings.map((warning, idx) => (
                        <p
                          key={idx}
                          className="text-[11.5px] text-amber-800 dark:text-amber-200 flex items-start gap-1.5"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{warning}</span>
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Detected Client & Metadata Summary */}
                  <div className="rounded-xl border border-line-neutral-200 bg-surface-neutral-50/70 p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      {result.matchedClientId ? (
                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-medium">
                          <UserCheck className="w-4 h-4 shrink-0" />
                          <span>
                            Matched client: <strong>{result.matchedClientName}</strong>
                          </span>
                        </div>
                      ) : result.suggestedClient ? (
                        <div className="flex items-center gap-2 text-content-neutral-800 font-medium">
                          <UserPlus className="w-4 h-4 shrink-0 text-accent" />
                          <span>
                            New client detected:{" "}
                            <strong>{result.suggestedClient.name}</strong>
                            {result.suggestedClient.email
                              ? ` (${result.suggestedClient.email})`
                              : ""}
                          </span>
                        </div>
                      ) : (
                        <span className="text-content-neutral-500">
                          Client not identified — pick in invoice form
                        </span>
                      )}
                      {result.currency && (
                        <span className="px-2 py-0.5 rounded-md bg-surface border border-line-neutral-200 font-mono text-[11px] font-semibold text-content-neutral-800">
                          {result.currency}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-content-neutral-600">
                      {result.dueDate && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface border border-line-neutral-200">
                          <Calendar className="w-3 h-3 text-accent" />
                          Due {result.dueDate}
                        </span>
                      )}
                      {result.deliveryUrl && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface border border-line-neutral-200 max-w-full truncate">
                          <Link2 className="w-3 h-3 text-accent shrink-0" />
                          <span className="truncate">{result.deliveryUrl}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Deliverables Checklist */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-content-neutral-500">
                        Deliverables / Line Items ({selectedCount})
                      </span>
                      <button
                        type="button"
                        onClick={handleAddBlankItem}
                        className="inline-flex items-center gap-1 text-[11.5px] font-medium text-accent hover:underline cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        Add item
                      </button>
                    </div>

                    <div className="space-y-2">
                      {editableItems.map((item) => (
                        <div
                          key={item.id}
                          className={`rounded-xl border p-2.5 space-y-2 transition-colors ${
                            item.selected
                              ? "border-line-neutral-200 bg-surface"
                              : "border-line-neutral-200/50 bg-surface-neutral-50/50 opacity-60"
                          }`}
                        >
                          <div className="flex items-start gap-2">
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
                              className={`mt-1 w-4.5 h-4.5 rounded-md border flex items-center justify-center shrink-0 cursor-pointer ${
                                item.selected
                                  ? "bg-accent border-accent text-white"
                                  : "border-line-neutral-300 bg-surface"
                              }`}
                            >
                              {item.selected && (
                                <Check className="w-3 h-3" strokeWidth={2.6} />
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
                              className="ui-field flex-1 h-8 !min-h-[32px] px-2.5 text-xs"
                            />

                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              aria-label="Remove item"
                              className="p-1.5 text-content-neutral-400 hover:text-rose-500 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-2 pl-6.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-content-neutral-500">
                                Qty
                              </span>
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
                                className="ui-field w-14 h-7 !min-h-[28px] px-2 text-center text-xs"
                              />
                              <span className="text-[11px] text-content-neutral-500 ml-1">
                                Price
                              </span>
                              <input
                                type="number"
                                step="any"
                                min={0}
                                value={item.unitPrice ?? ""}
                                placeholder="Add later"
                                onChange={(e) =>
                                  handleUpdateItem(item.id, {
                                    unitPrice: e.target.value || null,
                                  })
                                }
                                className="ui-field w-24 h-7 !min-h-[28px] px-2 text-xs"
                              />
                            </div>

                            {item.priceSource === "catalog" && item.catalogTitle && (
                              <span
                                title={`Matched Catalog item: ${item.catalogTitle}`}
                                className="px-2 py-0.5 rounded-full bg-accent-faint text-accent text-[10.5px] font-medium truncate max-w-[165px]"
                              >
                                Catalog{" "}
                                {item.catalogMatchScore
                                  ? `${Math.round(item.catalogMatchScore * 100)}%`
                                  : ""}
                              </span>
                            )}
                            {item.priceSource === "message" && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10.5px] font-medium">
                                From message
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Raw OCR viewer */}
                  {result.ocrText && (
                    <div className="rounded-xl border border-line-neutral-200 bg-surface-neutral-50/60 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowRawOcr((prev) => !prev)}
                        className="w-full px-3 py-2 flex items-center justify-between text-[11.5px] font-medium text-content-neutral-600 hover:text-content-neutral-900 cursor-pointer"
                      >
                        <span>View extracted OCR text</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${
                            showRawOcr ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      {showRawOcr && (
                        <pre className="px-3 pb-3 pt-1 text-[11px] text-content-neutral-600 whitespace-pre-wrap font-mono border-t border-line-neutral-200/60 max-h-40 overflow-y-auto">
                          {result.ocrText}
                        </pre>
                      )}
                    </div>
                  )}
                </m.div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-line-neutral-200/80 bg-surface-neutral-50/70 flex items-center justify-between gap-3 shrink-0">
              <Link
                href="/settings?tab=ai"
                onClick={closeDrawer}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-content-neutral-600 hover:text-content-neutral-950"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>AI Settings</span>
              </Link>

              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" onClick={closeDrawer}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={!result}
                  onClick={handleCreateInvoice}
                >
                  <Receipt className="w-4 h-4" />
                  <span>Create Invoice</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </m.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
