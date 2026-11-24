import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const MODELS_ROOT = path.join(ROOT_DIR, "assets", "ai-models");

const BUNDLED_ASSETS = [
  {
    label: "Tesseract English LSTM (eng_fast)",
    target: path.join(MODELS_ROOT, "tessdata", "eng.traineddata.gz"),
    url: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
    fallbackUrl:
      "https://github.com/naptha/tessdata/raw/gh-pages/4.0.0_fast/eng.traineddata.gz",
    minBytes: 1_500_000,
  },
  {
    label: "MiniLM config.json",
    target: path.join(
      MODELS_ROOT,
      "Xenova",
      "all-MiniLM-L6-v2",
      "config.json",
    ),
    url: "https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/config.json",
    minBytes: 100,
  },
  {
    label: "MiniLM tokenizer.json",
    target: path.join(
      MODELS_ROOT,
      "Xenova",
      "all-MiniLM-L6-v2",
      "tokenizer.json",
    ),
    url: "https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/tokenizer.json",
    minBytes: 100_000,
  },
  {
    label: "MiniLM tokenizer_config.json",
    target: path.join(
      MODELS_ROOT,
      "Xenova",
      "all-MiniLM-L6-v2",
      "tokenizer_config.json",
    ),
    url: "https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/tokenizer_config.json",
    minBytes: 100,
  },
  {
    label: "MiniLM special_tokens_map.json",
    target: path.join(
      MODELS_ROOT,
      "Xenova",
      "all-MiniLM-L6-v2",
      "special_tokens_map.json",
    ),
    url: "https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/special_tokens_map.json",
    minBytes: 50,
  },
  {
    label: "MiniLM vocab.txt",
    target: path.join(MODELS_ROOT, "Xenova", "all-MiniLM-L6-v2", "vocab.txt"),
    url: "https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/vocab.txt",
    minBytes: 50_000,
  },
  {
    label: "MiniLM quantized ONNX model (~22 MB)",
    target: path.join(
      MODELS_ROOT,
      "Xenova",
      "all-MiniLM-L6-v2",
      "onnx",
      "model_quantized.onnx",
    ),
    url: "https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx",
    minBytes: 15_000_000,
  },
];

function downloadFile(url, destination, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 6) {
      reject(new Error(`Too many redirects for ${url}`));
      return;
    }
    const req = https.get(
      url,
      { headers: { "User-Agent": "BillFlow-Build/1.0" } },
      (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          res.resume();
          const nextUrl = new URL(res.headers.location, url).toString();
          resolve(downloadFile(nextUrl, destination, redirects + 1));
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(
            new Error(`HTTP ${res.statusCode ?? "error"} downloading ${url}`),
          );
          return;
        }
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        const tempPath = `${destination}.tmp-${process.pid}`;
        const out = fs.createWriteStream(tempPath);
        res.pipe(out);
        out.on("finish", () => {
          out.close(() => {
            fs.renameSync(tempPath, destination);
            resolve();
          });
        });
        out.on("error", (err) => {
          out.close(() => {
            try {
              fs.unlinkSync(tempPath);
            } catch {}
            reject(err);
          });
        });
      },
    );
    req.setTimeout(60_000, () => {
      req.destroy(new Error(`Timeout downloading ${url}`));
    });
    req.on("error", reject);
  });
}

async function ensureAsset(asset) {
  if (fs.existsSync(asset.target)) {
    const stat = fs.statSync(asset.target);
    if (stat.size >= asset.minBytes) {
      return { skipped: true, size: stat.size };
    }
  }
  console.log(`[ai-models] Fetching ${asset.label}...`);
  try {
    await downloadFile(asset.url, asset.target);
  } catch (err) {
    if (asset.fallbackUrl) {
      console.warn(
        `[ai-models] Primary mirror failed for ${asset.label}, trying fallback...`,
      );
      await downloadFile(asset.fallbackUrl, asset.target);
    } else {
      throw err;
    }
  }
  const stat = fs.statSync(asset.target);
  if (stat.size < asset.minBytes) {
    fs.unlinkSync(asset.target);
    throw new Error(
      `Downloaded ${asset.label} looks incomplete (${stat.size} bytes).`,
    );
  }
  return { skipped: false, size: stat.size };
}

async function main() {
  let downloaded = 0;
  let totalBytes = 0;
  for (const asset of BUNDLED_ASSETS) {
    const res = await ensureAsset(asset);
    totalBytes += res.size;
    if (!res.skipped) downloaded += 1;
  }
  const mb = (totalBytes / (1024 * 1024)).toFixed(1);
  if (downloaded === 0) {
    console.log(
      `[ai-models] Bundled OCR + Standard ML models ready (${mb} MB).`,
    );
  } else {
    console.log(
      `[ai-models] Prepared ${downloaded} asset(s); bundled total ${mb} MB.`,
    );
  }
}

main().catch((err) => {
  console.error("[ai-models] Failed to prepare bundled AI models:", err);
  process.exit(1);
});
