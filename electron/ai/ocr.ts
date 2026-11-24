import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { Worker } from "tesseract.js";
import { getBundledTessdataDir, isOcrReady } from "./config";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MiB
const IDLE_DISPOSE_MS = 5 * 60 * 1000;

let workerPromise: Promise<Worker> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function toUnpackedPath(resolvedPath: string): string {
  const asarToken = `${path.sep}app.asar${path.sep}`;
  const unpackedToken = `${path.sep}app.asar.unpacked${path.sep}`;
  return resolvedPath.includes(asarToken)
    ? resolvedPath.replace(asarToken, unpackedToken)
    : resolvedPath;
}

function scheduleIdleDispose() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = null;
    void disposeOcrWorker();
  }, IDLE_DISPOSE_MS);
  idleTimer.unref?.();
}

export async function disposeOcrWorker(): Promise<void> {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  const pending = workerPromise;
  workerPromise = null;
  if (!pending) return;
  try {
    const worker = await pending;
    await worker.terminate();
  } catch {
    // ignore cleanup failure
  }
}

async function getOcrWorker(): Promise<Worker> {
  if (!isOcrReady()) {
    throw new Error(
      "Offline OCR model (eng.traineddata.gz) is missing. Run npm run ai:prepare-models or reinstall BillFlow.",
    );
  }
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, OEM } = await import("tesseract.js");
      const langPath = getBundledTessdataDir();

      // Resolve worker & core paths safely for both dev and ASAR-packaged builds (Mac & Windows)
      let workerPath: string | undefined;
      let corePath: string | undefined;
      try {
        const req = createRequire(__filename);
        workerPath = toUnpackedPath(
          req.resolve("tesseract.js/src/worker-script/node/index.js"),
        );
        const corePkgPath = toUnpackedPath(
          req.resolve("tesseract.js-core/package.json"),
        );
        corePath = path.dirname(corePkgPath);
      } catch {
        // Fallback to tesseract.js default resolution
      }

      const options: Record<string, unknown> = {
        langPath,
        cachePath: langPath,
        cacheMethod: "readOnly",
        gzip: true,
        errorHandler: () => {
          // Handled via rejected promise
        },
      };
      if (workerPath && fs.existsSync(workerPath)) {
        options.workerPath = workerPath;
      }
      if (corePath && fs.existsSync(corePath)) {
        options.corePath = corePath;
      }

      const worker = await createWorker(
        "eng",
        OEM.LSTM_ONLY,
        options as Parameters<typeof createWorker>[2],
      );
      return worker;
    })().catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  scheduleIdleDispose();
  return workerPromise;
}

export function decodeBase64Image(imageBase64: string): Buffer {
  const trimmed = imageBase64.trim();
  const commaIdx = trimmed.indexOf(",");
  const rawBase64 =
    trimmed.startsWith("data:") && commaIdx !== -1
      ? trimmed.slice(commaIdx + 1)
      : trimmed;

  const estimatedBytes = Math.ceil((rawBase64.length * 3) / 4);
  if (estimatedBytes > MAX_IMAGE_BYTES) {
    throw new Error("Screenshot is too large (maximum 15 MB).");
  }

  const buffer = Buffer.from(rawBase64, "base64");
  if (buffer.length < 16) {
    throw new Error("Invalid or empty image data.");
  }

  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  const isWebp =
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP";
  const isBmp = buffer[0] === 0x42 && buffer[1] === 0x4d;
  const isGif = buffer.subarray(0, 3).toString("ascii") === "GIF";

  if (!isPng && !isJpeg && !isWebp && !isBmp && !isGif) {
    throw new Error(
      "Unsupported image format. Please paste a PNG, JPEG, or WebP screenshot.",
    );
  }

  return buffer;
}

export async function runLocalOcr(imageBase64: string): Promise<{
  text: string;
  confidence: number;
}> {
  const buffer = decodeBase64Image(imageBase64);
  const worker = await getOcrWorker();
  const result = await worker.recognize(buffer);
  scheduleIdleDispose();
  return {
    text: (result.data.text || "").trim(),
    confidence: Math.max(0, Math.min(1, (result.data.confidence || 0) / 100)),
  };
}
