"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Download,
  HardDrive,
  Loader2,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useAiCapture } from "@/context/AiCaptureContext";
import { useData } from "@/lib/data/DataProvider";
import { Button } from "@/components/ui/Workspace";
import type { AiModelTier } from "@/types/ai";

function formatMegabytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 MB";
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

export function AiSettingsPanel({
  onNotify,
}: {
  onNotify: (message: string, type?: "success" | "error") => void;
}) {
  const { isElectron } = useData();
  const {
    aiStatus,
    downloadEvent,
    setTier,
    checkOllama,
    configureOllama,
    downloadEnhancedModel,
    cancelDownload,
    removeEnhancedModel,
    openDrawer,
  } = useAiCapture();

  const [busyAction, setBusyAction] = useState<
    "tier" | "download" | "remove" | "ollama-check" | "ollama-save" | null
  >(null);

  const [ollamaUrlDraft, setOllamaUrlDraft] = useState<string | null>(null);
  const [ollamaModelDraft, setOllamaModelDraft] = useState<string | null>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaStatusText, setOllamaStatusText] = useState<string | null>(null);
  const [ollamaReachable, setOllamaReachable] = useState<boolean | null>(null);

  const ollamaUrlInput =
    ollamaUrlDraft ?? aiStatus?.ollamaUrl ?? "http://127.0.0.1:11434";
  const ollamaSelectedModel =
    ollamaModelDraft ?? aiStatus?.ollamaModel ?? "";

  const activeTier: AiModelTier = aiStatus?.activeTier ?? "standard";
  const isDownloading =
    aiStatus?.downloadState === "downloading" ||
    downloadEvent?.state === "downloading" ||
    busyAction === "download";
  const downloadProgress =
    downloadEvent?.state === "downloading"
      ? downloadEvent.progress
      : (aiStatus?.downloadProgress ?? 0);
  const downloadMessage =
    downloadEvent?.message || aiStatus?.downloadMessage || "";
  const enhancedDownloaded = Boolean(aiStatus?.enhancedModelDownloaded);
  const expectedSizeLabel = formatMegabytes(
    aiStatus?.enhancedModelExpectedBytes ?? 282_621_541,
  );
  const diskSizeLabel = formatMegabytes(aiStatus?.enhancedModelDiskBytes ?? 0);
  const legacyDiskBytes = aiStatus?.legacyEnhancedDiskBytes ?? 0;

  const handleSelectTier = async (tier: AiModelTier) => {
    if (!isElectron) {
      onNotify("Local AI settings are available in the BillFlow desktop app.", "error");
      return;
    }
    if (tier === activeTier) return;
    setBusyAction("tier");
    try {
      await setTier(tier);
      onNotify(
        tier === "enhanced"
          ? "Switched Smart Capture to Enhanced Offline AI."
          : tier === "ollama"
            ? "Switched Smart Capture to Local Ollama."
            : "Switched Smart Capture to Standard Offline AI.",
      );
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : "Could not change AI tier.",
        "error",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleDownload = async () => {
    if (!isElectron) return;
    setBusyAction("download");
    try {
      const updated = await downloadEnhancedModel();
      if (updated?.enhancedModelDownloaded) {
        onNotify("Enhanced Offline AI pack downloaded and enabled.");
      }
    } catch (err) {
      onNotify(
        err instanceof Error
          ? err.message
          : "Enhanced AI pack download failed.",
        "error",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleCancel = async () => {
    try {
      await cancelDownload();
      onNotify("Model download canceled.");
    } catch {
      // ignore
    }
  };

  const handleRemove = async () => {
    setBusyAction("remove");
    try {
      await removeEnhancedModel();
      onNotify("Removed Enhanced AI model files and switched to Standard mode.");
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : "Could not delete model files.",
        "error",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleDetectOllama = async () => {
    if (!isElectron) return;
    setBusyAction("ollama-check");
    setOllamaStatusText(null);
    try {
      const result = await checkOllama(ollamaUrlInput.trim());
      if (!result) return;
      setOllamaReachable(result.reachable);
      setOllamaModels(result.models);
      if (result.reachable && result.models.length > 0) {
        setOllamaStatusText(
          `Connected to ${result.baseUrl} · ${result.models.length} model${result.models.length === 1 ? "" : "s"} available.`,
        );
        if (!ollamaSelectedModel || !result.models.includes(ollamaSelectedModel)) {
          setOllamaModelDraft(result.models[0]);
        }
      } else {
        setOllamaStatusText(
          result.error || `Could not reach Ollama at ${result.baseUrl}.`,
        );
      }
    } catch (err) {
      setOllamaReachable(false);
      setOllamaStatusText(
        err instanceof Error ? err.message : "Could not check local Ollama.",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveAndUseOllama = async () => {
    if (!isElectron) return;
    const chosenModel = ollamaSelectedModel.trim();
    if (!chosenModel) {
      onNotify("Detect and select a local Ollama model first.", "error");
      return;
    }
    setBusyAction("ollama-save");
    try {
      await configureOllama({
        baseUrl: ollamaUrlInput.trim(),
        model: chosenModel,
      });
      await setTier("ollama");
      onNotify(`Switched Smart Capture to Local Ollama (${chosenModel}).`);
    } catch (err) {
      onNotify(
        err instanceof Error
          ? err.message
          : "Could not save Local Ollama settings.",
        "error",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const selectableOllamaModels = Array.from(
    new Set([
      ...(ollamaSelectedModel ? [ollamaSelectedModel] : []),
      ...ollamaModels,
    ]),
  );

  return (
    <div className="settings-section space-y-5">
      {/* Privacy & Architecture Guarantee */}
      <section className="ui-card p-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3.5 max-w-2xl">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-content-neutral-950">
              100% On-Device Local AI &amp; Offline OCR
            </h3>
            <p className="text-xs text-content-neutral-600 mt-1 leading-relaxed">
              Smart Capture reads pasted WhatsApp, Slack, Signal, or email
              screenshots and text directly on this computer. Client messages
              and screenshots never leave your device, and you can switch engines
              directly from the Smart Capture footer anytime.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="small"
          onClick={openDrawer}
          className="shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          <span>Open Smart Capture</span>
        </Button>
      </section>

      {!isElectron && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-3.5 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Local OCR and ONNX models run in the BillFlow desktop application.
          </span>
        </div>
      )}

      {/* Tier Selector Grid */}
      <section className="space-y-3" aria-label="AI extraction engine tier">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-content-neutral-950">
              Extraction Intelligence Level
            </h3>
            <p className="text-xs text-content-neutral-500 mt-0.5">
              Start with the built-in offline engine, upgrade to the fast
              Enhanced neural pack, or connect your own local Ollama model.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Tier 1: Standard Built-In */}
          <div
            className={`ui-card p-5 flex flex-col justify-between gap-4 border-2 transition-colors ${
              activeTier === "standard"
                ? "border-accent bg-accent-faint/20"
                : "border-line-neutral-200"
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-surface-neutral-100 text-content-neutral-900 flex items-center justify-center">
                    <Zap className="w-4.5 h-4.5 text-accent" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-content-neutral-950">
                      Standard (Built-in Offline)
                    </h4>
                    <p className="text-[11.5px] text-content-neutral-500">
                      Tesseract LSTM OCR + MiniLM-L6-v2 Embeddings
                    </p>
                  </div>
                </div>
                {activeTier === "standard" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-white text-[11px] font-semibold">
                    <CheckCircle2 className="w-3 h-3" />
                    Active
                  </span>
                )}
              </div>

              <ul className="space-y-1.5 text-xs text-content-neutral-700">
                <li>• Bundled directly inside BillFlow (~26 MB total, 0 downloads)</li>
                <li>• Instant (&lt;0.5s) on any macOS or Windows laptop</li>
                <li>• Matches client messages to your Service Catalog titles &amp; rates</li>
                <li>• Zero hallucinations — extracts exact dates, links, and prices</li>
              </ul>

              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                <span
                  className={`px-2 py-0.5 rounded-full font-medium ${
                    aiStatus?.ocrReady
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  OCR: {aiStatus?.ocrReady ? "Ready" : "Not prepared"}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full font-medium ${
                    aiStatus?.standardModelReady
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  MiniLM: {aiStatus?.standardModelReady ? "Bundled" : "Fallback"}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-line-neutral-200/70 flex items-center justify-between">
              <span className="text-[11px] text-content-neutral-500">
                Default recommended for low RAM &amp; instant speed
              </span>
              <Button
                type="button"
                variant={activeTier === "standard" ? "secondary" : "primary"}
                size="small"
                disabled={activeTier === "standard" || busyAction !== null}
                onClick={() => void handleSelectTier("standard")}
              >
                {activeTier === "standard" ? "Selected" : "Use Standard"}
              </Button>
            </div>
          </div>

          {/* Tier 2: Enhanced Fast Offline Neural Pack (BGE-Base + DeBERTa NLI) */}
          <div
            className={`ui-card p-5 flex flex-col justify-between gap-4 border-2 transition-colors ${
              activeTier === "enhanced"
                ? "border-accent bg-accent-faint/20"
                : "border-line-neutral-200"
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-accent-faint text-accent flex items-center justify-center">
                    <Cpu className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-content-neutral-950">
                      Enhanced (Fast Offline Neural Pack)
                    </h4>
                    <p className="text-[11.5px] text-content-neutral-500">
                      {aiStatus?.enhancedModelLabel ||
                        "BGE-Base v1.5 + DeBERTa-v3 NLI (INT8 ONNX)"}
                    </p>
                  </div>
                </div>
                {activeTier === "enhanced" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-white text-[11px] font-semibold">
                    <CheckCircle2 className="w-3 h-3" />
                    Active
                  </span>
                ) : enhancedDownloaded ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium">
                    Downloaded
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-surface-neutral-100 text-content-neutral-600 text-[11px] font-medium">
                    Optional ({expectedSizeLabel})
                  </span>
                )}
              </div>

              <ul className="space-y-1.5 text-xs text-content-neutral-700">
                <li>
                  • Fast (&lt;1s) on Mac &amp; Windows — zero hallucinations or broken JSON
                </li>
                <li>
                  • 768-dim BGE-Base + DeBERTa-v3 NLI for sharper Service Catalog
                  &amp; intent matching
                </li>
                <li>
                  • Boosts Expense Receipt OPEX categorization for unknown merchants
                </li>
                <li>
                  • Low RAM (~350 MB), auto-unloads when idle, remove anytime
                </li>
              </ul>

              {legacyDiskBytes > 0 && !enhancedDownloaded && !isDownloading && (
                <p className="text-[11px] text-content-neutral-500">
                  Installing this pack automatically cleans up ~{formatMegabytes(legacyDiskBytes)} from the previous Qwen model.
                </p>
              )}

              {/* Download Progress UI */}
              {isDownloading && (
                <div className="rounded-xl border border-line-neutral-200 bg-surface-neutral-50 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-content-neutral-800 flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                      <span>{downloadMessage || "Downloading Enhanced pack…"}</span>
                    </span>
                    <span className="font-mono font-semibold text-accent tabular-nums">
                      {downloadProgress}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-surface-neutral-200 overflow-hidden">
                    <div
                      className="h-full bg-accent transition-[width] duration-200 rounded-full"
                      style={{ width: `${Math.max(3, downloadProgress)}%` }}
                    />
                  </div>
                </div>
              )}

              {aiStatus?.lastError && !isDownloading && (
                <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 px-3 py-2 text-xs text-rose-700 dark:text-rose-200 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{aiStatus.lastError}</span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-line-neutral-200/70 flex flex-wrap items-center justify-between gap-2">
              {enhancedDownloaded ? (
                <>
                  <span className="inline-flex items-center gap-1 text-[11px] text-content-neutral-500">
                    <HardDrive className="w-3.5 h-3.5" />
                    {diskSizeLabel} stored locally
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="small"
                      disabled={busyAction !== null}
                      onClick={() => void handleRemove()}
                      title="Delete downloaded Enhanced AI weights to free disk space"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      <span>Delete Pack</span>
                    </Button>
                    <Button
                      type="button"
                      variant={
                        activeTier === "enhanced" ? "secondary" : "primary"
                      }
                      size="small"
                      disabled={activeTier === "enhanced" || busyAction !== null}
                      onClick={() => void handleSelectTier("enhanced")}
                    >
                      {activeTier === "enhanced" ? "Selected" : "Use Enhanced"}
                    </Button>
                  </div>
                </>
              ) : isDownloading ? (
                <>
                  <span className="text-[11px] text-content-neutral-500">
                    Saving to local app data…
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="small"
                    onClick={() => void handleCancel()}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-[11px] text-content-neutral-500">
                    One-time download (~{expectedSizeLabel}) · offline forever after
                  </span>
                  <Button
                    type="button"
                    variant="primary"
                    size="small"
                    disabled={!isElectron || busyAction !== null}
                    onClick={() => void handleDownload()}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download &amp; Enable</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tier 3: Optional Local Ollama (Advanced Generative LLM on 127.0.0.1) */}
        <div
          className={`ui-card p-5 space-y-4 border-2 transition-colors ${
            activeTier === "ollama"
              ? "border-accent bg-accent-faint/20"
              : "border-line-neutral-200"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 max-w-2xl">
              <div className="w-9 h-9 rounded-xl bg-surface-neutral-100 text-content-neutral-900 flex items-center justify-center shrink-0">
                <Server className="w-4.5 h-4.5 text-accent" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-content-neutral-950">
                  Optional Local Ollama (Full Generative LLM)
                </h4>
                <p className="text-xs text-content-neutral-500 mt-0.5 leading-relaxed">
                  Already run Ollama locally? Connect BillFlow to models like{" "}
                  <span className="font-mono text-[11px]">qwen2.5</span>,{" "}
                  <span className="font-mono text-[11px]">llama3.2</span>, or{" "}
                  <span className="font-mono text-[11px]">gemma3</span> for
                  rewriting long, unstructured chats. Strictly limited to{" "}
                  <span className="font-mono text-[11px]">127.0.0.1</span> /{" "}
                  <span className="font-mono text-[11px]">localhost</span>.
                </p>
              </div>
            </div>
            {activeTier === "ollama" ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-white text-[11px] font-semibold">
                <CheckCircle2 className="w-3 h-3" />
                Active
              </span>
            ) : aiStatus?.ollamaModel ? (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium">
                Ready ({aiStatus.ollamaModel})
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-surface-neutral-100 text-content-neutral-600 text-[11px] font-medium">
                Optional
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <label className="space-y-1 text-xs">
              <span className="font-medium text-content-neutral-700">
                Local Ollama URL
              </span>
              <input
                type="text"
                value={ollamaUrlInput}
                onChange={(e) => setOllamaUrlDraft(e.target.value)}
                placeholder="http://127.0.0.1:11434"
                className="ui-field w-full h-9 !min-h-[36px] px-3 text-xs font-mono"
              />
            </label>

            <label className="space-y-1 text-xs">
              <span className="font-medium text-content-neutral-700">
                Installed Model
              </span>
              <select
                value={ollamaSelectedModel}
                onChange={(e) => setOllamaModelDraft(e.target.value)}
                disabled={selectableOllamaModels.length === 0}
                className="ui-field w-full h-9 !min-h-[36px] px-3 text-xs"
              >
                {selectableOllamaModels.length === 0 ? (
                  <option value="">Click Detect Models to list installed models</option>
                ) : (
                  selectableOllamaModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))
                )}
              </select>
            </label>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="small"
                disabled={!isElectron || busyAction !== null}
                onClick={() => void handleDetectOllama()}
              >
                {busyAction === "ollama-check" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>Detect Models</span>
              </Button>
              <Button
                type="button"
                variant={activeTier === "ollama" ? "secondary" : "primary"}
                size="small"
                disabled={
                  !isElectron ||
                  !ollamaSelectedModel.trim() ||
                  busyAction !== null
                }
                onClick={() => void handleSaveAndUseOllama()}
              >
                {activeTier === "ollama" &&
                ollamaSelectedModel === aiStatus?.ollamaModel
                  ? "Selected"
                  : "Use Ollama"}
              </Button>
            </div>
          </div>

          {ollamaStatusText && (
            <p
              className={`text-xs ${
                ollamaReachable
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-amber-700 dark:text-amber-300"
              }`}
            >
              {ollamaStatusText}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
