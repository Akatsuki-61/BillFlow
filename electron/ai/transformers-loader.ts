import path from "node:path";

type TransformersModule = typeof import("@huggingface/transformers");

/**
 * Shared ONNX Runtime session options for Electron's Chromium PartitionAlloc.
 * Disabling the CPU memory arena prevents ONNX Runtime's BFCArena from issuing
 * large power-of-two reallocations that can exceed Chromium PartitionAlloc's
 * 2 GiB single-allocation fatal trap on macOS ARM64, and lowers RAM usage on
 * both macOS and Windows.
 */
export const SAFE_ONNX_SESSION_OPTIONS = {
  enableCpuMemArena: false,
  enableMemPattern: false,
} as const;

let cachedModule: Promise<TransformersModule> | null = null;

/**
 * Loads @huggingface/transformers cleanly across CommonJS (tsup dist-electron/main.js)
 * and ESM (Vitest), configuring strictly local-only execution so inference never makes
 * unexpected network requests.
 */
export async function loadTransformers(
  localModelRoot: string,
): Promise<TransformersModule> {
  if (!cachedModule) {
    cachedModule = import("@huggingface/transformers");
  }
  const mod = await cachedModule;
  mod.env.allowRemoteModels = false;
  mod.env.allowLocalModels = true;
  mod.env.useBrowserCache = false;
  // Ensure trailing separator so Transformers.js joins repo IDs cleanly on both macOS and Windows
  const normalizedRoot = path.resolve(localModelRoot);
  mod.env.localModelPath = normalizedRoot.endsWith(path.sep)
    ? normalizedRoot
    : `${normalizedRoot}${path.sep}`;
  return mod;
}
