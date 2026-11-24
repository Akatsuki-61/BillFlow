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
  AiStatus,
} from "../../src/types/ai";

export const STANDARD_MODEL_ID = "Xenova/all-MiniLM-L6-v2";
export const ENHANCED_MODEL_ID = "onnx-community/Qwen2.5-0.5B-Instruct";
export const ENHANCED_MODEL_LABEL = "Qwen2.5 0.5B Instruct (INT8 ONNX)";

export interface PinnedModelAsset {
  relativePath: string;
  url: string;
  expectedBytes: number;
  minBytes: number;
}

export const ENHANCED_MODEL_ASSETS: readonly PinnedModelAsset[] = [
  {
    relativePath: "config.json",
    url: `https://huggingface.co/${ENHANCED_MODEL_ID}/resolve/main/config.json`,
    expectedBytes: 1_200,
    minBytes: 100,
  },
  {
    relativePath: "generation_config.json",
    url: `https://huggingface.co/${ENHANCED_MODEL_ID}/resolve/main/generation_config.json`,
    expectedBytes: 500,
    minBytes: 40,
  },
  {
    relativePath: "tokenizer.json",
    url: `https://huggingface.co/${ENHANCED_MODEL_ID}/resolve/main/tokenizer.json`,
    expectedBytes: 7_030_000,
    minBytes: 1_000_000,
  },
  {
    relativePath: "tokenizer_config.json",
    url: `https://huggingface.co/${ENHANCED_MODEL_ID}/resolve/main/tokenizer_config.json`,
    expectedBytes: 8_000,
    minBytes: 200,
  },
  {
    relativePath: "vocab.json",
    url: `https://huggingface.co/${ENHANCED_MODEL_ID}/resolve/main/vocab.json`,
    expectedBytes: 2_780_000,
    minBytes: 500_000,
  },
  {
    relativePath: "merges.txt",
    url: `https://huggingface.co/${ENHANCED_MODEL_ID}/resolve/main/merges.txt`,
    expectedBytes: 1_670_000,
    minBytes: 300_000,
  },
  {
    relativePath: "onnx/model_quantized.onnx",
    url: `https://huggingface.co/${ENHANCED_MODEL_ID}/resolve/main/onnx/model_quantized.onnx`,
    expectedBytes: 512_100_000,
    minBytes: 350_000_000,
  },
];

export const ENHANCED_MODEL_EXPECTED_BYTES = ENHANCED_MODEL_ASSETS.reduce(
  (sum, asset) => sum + asset.expectedBytes,
  0,
);

interface PersistedAiConfig {
  activeTier: AiModelTier;
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

export function getEnhancedModelDir(): string {
  return path.join(getUserModelsDir(), ...ENHANCED_MODEL_ID.split("/"));
}

export function getBundledTessdataDir(): string {
  return path.join(getBundledModelsDir(), "tessdata");
}

function getAiConfigPath(): string {
  return path.join(getUserDataRoot(), "ai-config.json");
}

export function readAiConfig(): PersistedAiConfig {
  try {
    const raw = fs.readFileSync(getAiConfigPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<PersistedAiConfig>;
    if (parsed.activeTier === "enhanced" || parsed.activeTier === "standard") {
      return { activeTier: parsed.activeTier };
    }
  } catch {
    // Default config
  }
  return { activeTier: "standard" };
}

export function writeAiConfig(config: PersistedAiConfig): void {
  atomicWrite(getAiConfigPath(), JSON.stringify(config, null, 2), 0o600);
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
  const dir = getEnhancedModelDir();
  return ENHANCED_MODEL_ASSETS.every((asset) => {
    const filePath = path.join(dir, ...asset.relativePath.split("/"));
    try {
      return fs.existsSync(filePath) && fs.statSync(filePath).size >= asset.minBytes;
    } catch {
      return false;
    }
  });
}

export function getEnhancedModelDiskBytes(): number {
  const dir = getEnhancedModelDir();
  let total = 0;
  for (const asset of ENHANCED_MODEL_ASSETS) {
    const filePath = path.join(dir, ...asset.relativePath.split("/"));
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

export function getAiStatus(): AiStatus {
  const cfg = readAiConfig();
  const enhancedReady = isEnhancedModelDownloaded();
  const activeTier: AiModelTier =
    cfg.activeTier === "enhanced" && enhancedReady ? "enhanced" : "standard";

  return {
    activeTier,
    ocrReady: isOcrReady(),
    standardModelReady: isStandardModelReady(),
    enhancedModelDownloaded: enhancedReady,
    enhancedModelId: ENHANCED_MODEL_ID,
    enhancedModelLabel: ENHANCED_MODEL_LABEL,
    enhancedModelExpectedBytes: ENHANCED_MODEL_EXPECTED_BYTES,
    enhancedModelDiskBytes: getEnhancedModelDiskBytes(),
    downloadState,
    downloadProgress,
    downloadMessage,
    lastError: lastDownloadError,
  };
}

export function setAiTier(tier: AiModelTier): AiStatus {
  if (tier === "enhanced" && !isEnhancedModelDownloaded()) {
    throw new Error(
      "Download the Enhanced Local LLM model in Settings before enabling Enhanced mode.",
    );
  }
  writeAiConfig({ activeTier: tier });
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
    throw new Error("Enhanced model download is already in progress.");
  }

  const controller = new AbortController();
  activeAbortController = controller;
  downloadState = "downloading";
  downloadProgress = 0;
  downloadMessage = "Preparing Enhanced Local LLM download…";
  lastDownloadError = null;

  const modelDir = getEnhancedModelDir();
  fs.mkdirSync(modelDir, { recursive: true });

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
    for (const asset of ENHANCED_MODEL_ASSETS) {
      const targetPath = path.join(modelDir, ...asset.relativePath.split("/"));
      if (
        fs.existsSync(targetPath) &&
        fs.statSync(targetPath).size >= asset.minBytes
      ) {
        completedBytes += fs.statSync(targetPath).size;
        emit(asset.relativePath, `Verified ${asset.relativePath}`, true);
        continue;
      }

      const fileStartBytes = completedBytes;
      let fileBytes = 0;
      emit(asset.relativePath, `Downloading ${asset.relativePath}…`, true);

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
            asset.relativePath,
            `Downloading Enhanced AI model (${mbDone} / ${mbTotal} MB)…`,
          );
        },
      );

      const finalSize = fs.statSync(targetPath).size;
      if (finalSize < asset.minBytes) {
        fs.unlinkSync(targetPath);
        throw new Error(
          `Downloaded file ${asset.relativePath} was incomplete. Please retry.`,
        );
      }
      completedBytes = fileStartBytes + finalSize;
    }

    downloadState = "idle";
    downloadProgress = 100;
    downloadMessage = "Enhanced Local LLM ready.";
    lastDownloadError = null;
    writeAiConfig({ activeTier: "enhanced" });

    onProgress({
      state: "idle",
      progress: 100,
      downloadedBytes: totalExpected,
      totalBytes: totalExpected,
      message: "Enhanced Local LLM ready and enabled.",
      error: null,
    });

    return getAiStatus();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to download Enhanced AI model.";
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
  const dir = getEnhancedModelDir();
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  downloadState = "idle";
  downloadProgress = 0;
  downloadMessage = "";
  lastDownloadError = null;
  writeAiConfig({ activeTier: "standard" });
  return getAiStatus();
}
