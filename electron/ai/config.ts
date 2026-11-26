import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { app } from "electron";
import { getRootDatabasePath } from "../db";
import { atomicWrite } from "../managed-files";
import type {
  AiDownloadProgressEvent,
  AiDownloadState,
  AiModelTier,
  AiOllamaConfigInput,
  AiStatus,
} from "../../src/types/ai";

export const STANDARD_MODEL_ID = "Xenova/all-MiniLM-L6-v2";

export const ENHANCED_EMBEDDING_MODEL_ID = "Xenova/bge-base-en-v1.5";
export const ENHANCED_NLI_MODEL_ID = "Xenova/nli-deberta-v3-small";
export const ENHANCED_MODEL_ID = `${ENHANCED_EMBEDDING_MODEL_ID} + ${ENHANCED_NLI_MODEL_ID}`;
export const ENHANCED_MODEL_LABEL =
  "BGE-Base v1.5 + DeBERTa-v3 NLI (INT8 ONNX)";

/** Legacy v0.3.0 Qwen2.5-0.5B folder automatically cleaned up when upgrading/removing. */
export const LEGACY_ENHANCED_MODEL_ID = "onnx-community/Qwen2.5-0.5B-Instruct";

export const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";

export interface PinnedModelAsset {
  modelId: string;
  relativePath: string;
  url: string;
  expectedBytes: number;
  minBytes: number;
}

export const ENHANCED_MODEL_ASSETS: readonly PinnedModelAsset[] = [
  // 1. Xenova/bge-base-en-v1.5 (768-dim semantic embeddings, ~105 MB INT8)
  {
    modelId: ENHANCED_EMBEDDING_MODEL_ID,
    relativePath: "config.json",
    url: `https://huggingface.co/${ENHANCED_EMBEDDING_MODEL_ID}/resolve/main/config.json`,
    expectedBytes: 717,
    minBytes: 100,
  },
  {
    modelId: ENHANCED_EMBEDDING_MODEL_ID,
    relativePath: "tokenizer.json",
    url: `https://huggingface.co/${ENHANCED_EMBEDDING_MODEL_ID}/resolve/main/tokenizer.json`,
    expectedBytes: 711_396,
    minBytes: 100_000,
  },
  {
    modelId: ENHANCED_EMBEDDING_MODEL_ID,
    relativePath: "tokenizer_config.json",
    url: `https://huggingface.co/${ENHANCED_EMBEDDING_MODEL_ID}/resolve/main/tokenizer_config.json`,
    expectedBytes: 366,
    minBytes: 40,
  },
  {
    modelId: ENHANCED_EMBEDDING_MODEL_ID,
    relativePath: "special_tokens_map.json",
    url: `https://huggingface.co/${ENHANCED_EMBEDDING_MODEL_ID}/resolve/main/special_tokens_map.json`,
    expectedBytes: 125,
    minBytes: 20,
  },
  {
    modelId: ENHANCED_EMBEDDING_MODEL_ID,
    relativePath: "vocab.txt",
    url: `https://huggingface.co/${ENHANCED_EMBEDDING_MODEL_ID}/resolve/main/vocab.txt`,
    expectedBytes: 231_508,
    minBytes: 50_000,
  },
  {
    modelId: ENHANCED_EMBEDDING_MODEL_ID,
    relativePath: "onnx/model_int8.onnx",
    url: `https://huggingface.co/${ENHANCED_EMBEDDING_MODEL_ID}/resolve/main/onnx/model_int8.onnx`,
    expectedBytes: 109_622_386,
    minBytes: 90_000_000,
  },
  // 2. Xenova/nli-deberta-v3-small (Zero-shot NLI classifier & catalog verifier, ~154 MB INT8)
  {
    modelId: ENHANCED_NLI_MODEL_ID,
    relativePath: "config.json",
    url: `https://huggingface.co/${ENHANCED_NLI_MODEL_ID}/resolve/main/config.json`,
    expectedBytes: 1_037,
    minBytes: 100,
  },
  {
    modelId: ENHANCED_NLI_MODEL_ID,
    relativePath: "tokenizer.json",
    url: `https://huggingface.co/${ENHANCED_NLI_MODEL_ID}/resolve/main/tokenizer.json`,
    expectedBytes: 8_656_551,
    minBytes: 1_000_000,
  },
  {
    modelId: ENHANCED_NLI_MODEL_ID,
    relativePath: "tokenizer_config.json",
    url: `https://huggingface.co/${ENHANCED_NLI_MODEL_ID}/resolve/main/tokenizer_config.json`,
    expectedBytes: 384,
    minBytes: 40,
  },
  {
    modelId: ENHANCED_NLI_MODEL_ID,
    relativePath: "special_tokens_map.json",
    url: `https://huggingface.co/${ENHANCED_NLI_MODEL_ID}/resolve/main/special_tokens_map.json`,
    expectedBytes: 173,
    minBytes: 20,
  },
  {
    modelId: ENHANCED_NLI_MODEL_ID,
    relativePath: "added_tokens.json",
    url: `https://huggingface.co/${ENHANCED_NLI_MODEL_ID}/resolve/main/added_tokens.json`,
    expectedBytes: 23,
    minBytes: 2,
  },
  {
    modelId: ENHANCED_NLI_MODEL_ID,
    relativePath: "spm.model",
    url: `https://huggingface.co/${ENHANCED_NLI_MODEL_ID}/resolve/main/spm.model`,
    expectedBytes: 2_464_616,
    minBytes: 500_000,
  },
  {
    modelId: ENHANCED_NLI_MODEL_ID,
    relativePath: "onnx/model_int8.onnx",
    url: `https://huggingface.co/${ENHANCED_NLI_MODEL_ID}/resolve/main/onnx/model_int8.onnx`,
    expectedBytes: 160_932_259,
    minBytes: 130_000_000,
  },
];

export const ENHANCED_MODEL_EXPECTED_BYTES = ENHANCED_MODEL_ASSETS.reduce(
  (sum, asset) => sum + asset.expectedBytes,
  0,
);

interface PersistedAiConfig {
  activeTier: AiModelTier;
  ollamaUrl: string;
  ollamaModel: string | null;
}

let downloadState: AiDownloadState = "idle";
let downloadProgress = 0;
let downloadMessage = "";
let lastDownloadError: string | null = null;
let activeAbortController: AbortController | null = null;

function getUserDataRoot(): string {
  try {
    if (app && typeof app.getPath === "function") {
      return app.getPath("userData");
    }
  } catch {
    // Fallback for headless tests
  }
  try {
    return path.dirname(getRootDatabasePath());
  } catch {
    return process.cwd();
  }
}

export function getBundledModelsDir(): string {
  try {
    if (app?.isPackaged && process.resourcesPath) {
      return path.join(process.resourcesPath, "ai-models");
    }
  } catch {
    // dev/test fallback
  }
  const fromDist = path.resolve(__dirname, "../assets/ai-models");
  if (fs.existsSync(fromDist)) return fromDist;
  const fromParent = path.resolve(__dirname, "../../assets/ai-models");
  if (fs.existsSync(fromParent)) return fromParent;
  return path.resolve(process.cwd(), "assets", "ai-models");
}

export function getUserModelsDir(): string {
  return path.join(getUserDataRoot(), "models");
}

export function getUserModelDir(modelId: string): string {
  return path.join(getUserModelsDir(), ...modelId.split("/"));
}

export function getLegacyEnhancedModelDir(): string {
  return getUserModelDir(LEGACY_ENHANCED_MODEL_ID);
}

export function getBundledTessdataDir(): string {
  return path.join(getBundledModelsDir(), "tessdata");
}

function getAiConfigPath(): string {
  return path.join(getUserDataRoot(), "ai-config.json");
}

/**
 * Strictly validates that an Ollama endpoint is local loopback only
 * (127.0.0.1 / localhost / [::1]) to uphold BillFlow's local-first privacy invariant.
 */
export function validateLocalOllamaUrl(rawUrl?: string | null): string {
  const trimmed = (rawUrl || DEFAULT_OLLAMA_URL).trim().replace(/\/+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(
      "Enter a valid local Ollama URL (for example http://127.0.0.1:11434).",
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Local Ollama URL must use http:// or https://.");
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1" && host !== "[::1]") {
    throw new Error(
      "For privacy, BillFlow only connects to Ollama on this computer (127.0.0.1 or localhost).",
    );
  }
  return parsed.origin;
}

export function readAiConfig(): PersistedAiConfig {
  try {
    const raw = fs.readFileSync(getAiConfigPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<PersistedAiConfig>;
    const activeTier: AiModelTier =
      parsed.activeTier === "enhanced" ||
      parsed.activeTier === "ollama" ||
      parsed.activeTier === "standard"
        ? parsed.activeTier
        : "standard";
    let ollamaUrl = DEFAULT_OLLAMA_URL;
    if (typeof parsed.ollamaUrl === "string" && parsed.ollamaUrl.trim()) {
      try {
        ollamaUrl = validateLocalOllamaUrl(parsed.ollamaUrl);
      } catch {
        ollamaUrl = DEFAULT_OLLAMA_URL;
      }
    }
    const ollamaModel =
      typeof parsed.ollamaModel === "string" && parsed.ollamaModel.trim()
        ? parsed.ollamaModel.trim()
        : null;
    return { activeTier, ollamaUrl, ollamaModel };
  } catch {
    // Default config
  }
  return {
    activeTier: "standard",
    ollamaUrl: DEFAULT_OLLAMA_URL,
    ollamaModel: null,
  };
}

export function writeAiConfig(config: PersistedAiConfig): void {
  atomicWrite(getAiConfigPath(), JSON.stringify(config, null, 2), 0o600);
}

export function configureOllama(input: AiOllamaConfigInput): AiStatus {
  const current = readAiConfig();
  const nextUrl =
    input.baseUrl !== undefined
      ? validateLocalOllamaUrl(input.baseUrl)
      : current.ollamaUrl;
  const nextModel =
    input.model !== undefined
      ? input.model && input.model.trim()
        ? input.model.trim()
        : null
      : current.ollamaModel;

  const nextTier: AiModelTier =
    current.activeTier === "ollama" && !nextModel ? "standard" : current.activeTier;

  writeAiConfig({
    activeTier: nextTier,
    ollamaUrl: nextUrl,
    ollamaModel: nextModel,
  });
  return getAiStatus();
}

export function isOcrReady(): boolean {
  const trained = path.join(getBundledTessdataDir(), "eng.traineddata.gz");
  try {
    return fs.existsSync(trained) && fs.statSync(trained).size > 1_000_000;
  } catch {
    return false;
  }
}

export function isStandardModelReady(): boolean {
  const modelDir = path.join(
    getBundledModelsDir(),
    ...STANDARD_MODEL_ID.split("/"),
  );
  const onnxFile = path.join(modelDir, "onnx", "model_quantized.onnx");
  const tokenizerFile = path.join(modelDir, "tokenizer.json");
  try {
    return (
      fs.existsSync(onnxFile) &&
      fs.statSync(onnxFile).size > 10_000_000 &&
      fs.existsSync(tokenizerFile)
    );
  } catch {
    return false;
  }
}

export function isEnhancedModelDownloaded(): boolean {
  return ENHANCED_MODEL_ASSETS.every((asset) => {
    const filePath = path.join(
      getUserModelDir(asset.modelId),
      ...asset.relativePath.split("/"),
    );
    try {
      return fs.existsSync(filePath) && fs.statSync(filePath).size >= asset.minBytes;
    } catch {
      return false;
    }
  });
}

function getDirectorySizeBytes(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        total += getDirectorySizeBytes(full);
      } else if (entry.isFile()) {
        total += fs.statSync(full).size;
      }
    }
  } catch {
    // ignore unreadable path
  }
  return total;
}

export function getEnhancedModelDiskBytes(): number {
  let total = 0;
  for (const asset of ENHANCED_MODEL_ASSETS) {
    const filePath = path.join(
      getUserModelDir(asset.modelId),
      ...asset.relativePath.split("/"),
    );
    try {
      if (fs.existsSync(filePath)) {
        total += fs.statSync(filePath).size;
      }
    } catch {
      // ignore unreadable file
    }
  }
  return total;
}

export function getLegacyEnhancedDiskBytes(): number {
  return getDirectorySizeBytes(getLegacyEnhancedModelDir());
}

export function cleanupLegacyEnhancedModelFiles(): void {
  const legacyDir = getLegacyEnhancedModelDir();
  try {
    if (fs.existsSync(legacyDir)) {
      fs.rmSync(legacyDir, { recursive: true, force: true });
    }
  } catch {
    // non-fatal cleanup
  }
}

export function getAiStatus(): AiStatus {
  const cfg = readAiConfig();
  const enhancedReady = isEnhancedModelDownloaded();
  let activeTier: AiModelTier = "standard";
  if (cfg.activeTier === "enhanced" && enhancedReady) {
    activeTier = "enhanced";
  } else if (cfg.activeTier === "ollama" && cfg.ollamaModel) {
    activeTier = "ollama";
  }

  return {
    activeTier,
    ocrReady: isOcrReady(),
    standardModelReady: isStandardModelReady(),
    enhancedModelDownloaded: enhancedReady,
    enhancedModelId: ENHANCED_MODEL_ID,
    enhancedModelLabel: ENHANCED_MODEL_LABEL,
    enhancedModelExpectedBytes: ENHANCED_MODEL_EXPECTED_BYTES,
    enhancedModelDiskBytes: getEnhancedModelDiskBytes(),
    legacyEnhancedDiskBytes: getLegacyEnhancedDiskBytes(),
    ollamaUrl: cfg.ollamaUrl,
    ollamaModel: cfg.ollamaModel,
    downloadState,
    downloadProgress,
    downloadMessage,
    lastError: lastDownloadError,
  };
}

export function setAiTier(tier: AiModelTier): AiStatus {
  const current = readAiConfig();
  if (tier === "enhanced" && !isEnhancedModelDownloaded()) {
    throw new Error(
      "Download the Enhanced Offline AI pack in Settings before enabling Enhanced mode.",
    );
  }
  if (tier === "ollama" && !current.ollamaModel) {
    throw new Error(
      "Select a local Ollama model in Settings → AI & Capture before enabling Ollama mode.",
    );
  }
  writeAiConfig({ ...current, activeTier: tier });
  return getAiStatus();
}

function downloadPinnedFile(
  url: string,
  destination: string,
  signal: AbortSignal,
  onChunk: (bytes: number, contentLength: number | null) => void,
  redirects = 0,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("Download canceled."));
      return;
    }
    if (redirects > 6) {
      reject(new Error("Too many redirects while downloading AI model."));
      return;
    }
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:") {
      reject(new Error("Only HTTPS model downloads are permitted."));
      return;
    }

    const req = https.get(
      url,
      { headers: { "User-Agent": "BillFlow-Desktop/0.3" } },
      (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          res.resume();
          const nextUrl = new URL(res.headers.location, url).toString();
          resolve(
            downloadPinnedFile(nextUrl, destination, signal, onChunk, redirects + 1),
          );
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(
            new Error(
              `Model server returned HTTP ${res.statusCode ?? "error"}. Please try again.`,
            ),
          );
          return;
        }

        const contentLength = res.headers["content-length"]
          ? Number.parseInt(res.headers["content-length"], 10)
          : null;

        fs.mkdirSync(path.dirname(destination), { recursive: true });
        const tempPath = `${destination}.tmp-${process.pid}`;
        const out = fs.createWriteStream(tempPath);

        const cleanupTemp = () => {
          try {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
          } catch {
            // ignore
          }
        };

        const onAbort = () => {
          req.destroy();
          out.close(() => {
            cleanupTemp();
            reject(new Error("Download canceled."));
          });
        };
        signal.addEventListener("abort", onAbort, { once: true });

        res.on("data", (chunk: Buffer) => {
          onChunk(chunk.length, contentLength);
        });

        res.pipe(out);

        out.on("finish", () => {
          signal.removeEventListener("abort", onAbort);
          out.close(() => {
            if (signal.aborted) {
              cleanupTemp();
              reject(new Error("Download canceled."));
              return;
            }
            try {
              fs.renameSync(tempPath, destination);
              resolve();
            } catch (err) {
              cleanupTemp();
              reject(err);
            }
          });
        });

        const fail = (err: Error) => {
          signal.removeEventListener("abort", onAbort);
          out.close(() => {
            cleanupTemp();
            reject(err);
          });
        };

        res.on("error", fail);
        out.on("error", fail);
      },
    );

    req.setTimeout(120_000, () => {
      req.destroy(new Error("Model download timed out. Check your internet connection."));
    });
    req.on("error", (err) => {
      if (signal.aborted) {
        reject(new Error("Download canceled."));
      } else {
        reject(err);
      }
    });
  });
}

export async function downloadEnhancedModel(
  onProgress: (event: AiDownloadProgressEvent) => void,
): Promise<AiStatus> {
  if (downloadState === "downloading" && activeAbortController) {
    throw new Error("Enhanced AI pack download is already in progress.");
  }

  const controller = new AbortController();
  activeAbortController = controller;
  downloadState = "downloading";
  downloadProgress = 0;
  downloadMessage = "Preparing Enhanced Offline AI pack download…";
  lastDownloadError = null;

  const totalExpected = ENHANCED_MODEL_EXPECTED_BYTES;
  let completedBytes = 0;
  let lastEmitAt = 0;

  const emit = (currentFile: string, message: string, force = false) => {
    const now = Date.now();
    if (!force && now - lastEmitAt < 180) return;
    lastEmitAt = now;
    const pct = Math.min(99, Math.max(0, Math.round((completedBytes / totalExpected) * 100)));
    downloadProgress = pct;
    downloadMessage = message;
    onProgress({
      state: "downloading",
      progress: pct,
      downloadedBytes: completedBytes,
      totalBytes: totalExpected,
      currentFile,
      message,
      error: null,
    });
  };

  try {
    // Reclaim disk space from any legacy Qwen2.5-0.5B files automatically
    cleanupLegacyEnhancedModelFiles();

    for (const asset of ENHANCED_MODEL_ASSETS) {
      const modelDir = getUserModelDir(asset.modelId);
      fs.mkdirSync(modelDir, { recursive: true });
      const targetPath = path.join(modelDir, ...asset.relativePath.split("/"));
      const displayLabel = `${asset.modelId.split("/")[1]}/${asset.relativePath}`;

      if (
        fs.existsSync(targetPath) &&
        fs.statSync(targetPath).size >= asset.minBytes
      ) {
        completedBytes += fs.statSync(targetPath).size;
        emit(displayLabel, `Verified ${displayLabel}`, true);
        continue;
      }

      const fileStartBytes = completedBytes;
      let fileBytes = 0;
      emit(displayLabel, `Downloading ${displayLabel}…`, true);

      await downloadPinnedFile(
        asset.url,
        targetPath,
        controller.signal,
        (chunkBytes) => {
          fileBytes += chunkBytes;
          completedBytes = fileStartBytes + fileBytes;
          const mbDone = (completedBytes / (1024 * 1024)).toFixed(0);
          const mbTotal = (totalExpected / (1024 * 1024)).toFixed(0);
          emit(
            displayLabel,
            `Downloading Enhanced AI pack (${mbDone} / ${mbTotal} MB)…`,
          );
        },
      );

      const finalSize = fs.statSync(targetPath).size;
      if (finalSize < asset.minBytes) {
        fs.unlinkSync(targetPath);
        throw new Error(
          `Downloaded file ${displayLabel} was incomplete. Please retry.`,
        );
      }
      completedBytes = fileStartBytes + finalSize;
    }

    downloadState = "idle";
    downloadProgress = 100;
    downloadMessage = "Enhanced Offline AI ready.";
    lastDownloadError = null;
    const current = readAiConfig();
    writeAiConfig({ ...current, activeTier: "enhanced" });

    onProgress({
      state: "idle",
      progress: 100,
      downloadedBytes: totalExpected,
      totalBytes: totalExpected,
      message: "Enhanced Offline AI pack ready and enabled.",
      error: null,
    });

    return getAiStatus();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to download Enhanced AI pack.";
    const canceled = message.toLowerCase().includes("canceled");
    downloadState = canceled ? "idle" : "error";
    downloadProgress = 0;
    downloadMessage = canceled ? "Download canceled." : message;
    lastDownloadError = canceled ? null : message;

    onProgress({
      state: downloadState,
      progress: 0,
      downloadedBytes: 0,
      totalBytes: totalExpected,
      message: downloadMessage,
      error: lastDownloadError,
    });

    if (canceled) return getAiStatus();
    throw err;
  } finally {
    activeAbortController = null;
  }
}

export function cancelEnhancedModelDownload(): AiStatus {
  if (activeAbortController) {
    activeAbortController.abort();
  }
  return getAiStatus();
}

export function removeEnhancedModelFiles(): AiStatus {
  if (activeAbortController) {
    activeAbortController.abort();
  }
  for (const modelId of [ENHANCED_EMBEDDING_MODEL_ID, ENHANCED_NLI_MODEL_ID]) {
    const dir = getUserModelDir(modelId);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  cleanupLegacyEnhancedModelFiles();
  downloadState = "idle";
  downloadProgress = 0;
  downloadMessage = "";
  lastDownloadError = null;
  const current = readAiConfig();
  writeAiConfig({
    ...current,
    activeTier: current.activeTier === "enhanced" ? "standard" : current.activeTier,
  });
  return getAiStatus();
}
