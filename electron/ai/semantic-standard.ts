import type { FeatureExtractionPipeline } from "@huggingface/transformers";
import type { Currency } from "../../src/types/billing";
import type { AiExtractedDeliverable } from "../../src/types/ai";
import { convertCents } from "../../src/lib/currency-conversion";
import { cachedExchangeRates } from "../exchange-rates";
import {
  getBundledModelsDir,
  isStandardModelReady,
  STANDARD_MODEL_ID,
} from "./config";
import { loadTransformers } from "./transformers-loader";
import {
  matchCatalogLexically,
  type CatalogMatchCandidate,
} from "./entity-parser";

const IDLE_DISPOSE_MS = 5 * 60 * 1000;
const CATALOG_MATCH_THRESHOLD = 0.52;

const DELIVERABLE_PROTOTYPE =
  "Build, design, develop, fix, integrate, update, or deliver a software feature, webpage, app, logo, or client service item";
const CHITCHAT_PROTOTYPE =
  "Hello, good morning, hope you are doing well, thank you so much, best regards, have a nice day, talk soon";

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let prototypeEmbeddings: Promise<{
  deliverable: Float32Array;
  chitchat: Float32Array;
}> | null = null;

function scheduleIdleDispose() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = null;
    void disposeStandardModel();
  }, IDLE_DISPOSE_MS);
  idleTimer.unref?.();
}

export async function disposeStandardModel(): Promise<void> {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  prototypeEmbeddings = null;
  const pending = extractorPromise;
  extractorPromise = null;
  if (!pending) return;
  try {
    const pipe = await pending;
    await (pipe as unknown as { dispose?: () => Promise<void> }).dispose?.();
  } catch {
    // ignore dispose error
  }
}

async function getEmbeddingPipeline(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline } = await loadTransformers(getBundledModelsDir());
      const extractor = await pipeline("feature-extraction", STANDARD_MODEL_ID, {
        local_files_only: true,
        dtype: "q8",
      });
      return extractor;
    })().catch((err) => {
      extractorPromise = null;
      throw err;
    });
  }
  scheduleIdleDispose();
  return extractorPromise;
}

async function embedText(text: string): Promise<Float32Array> {
  const pipe = await getEmbeddingPipeline();
  const output = await pipe(text, { pooling: "mean", normalize: true });
  return output.data as Float32Array;
}

function dotProduct(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < len; i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
}

async function getPrototypes() {
  if (!prototypeEmbeddings) {
    prototypeEmbeddings = Promise.all([
      embedText(DELIVERABLE_PROTOTYPE),
      embedText(CHITCHAT_PROTOTYPE),
    ]).then(([deliverable, chitchat]) => ({ deliverable, chitchat }));
  }
  return prototypeEmbeddings;
}

function resolveCatalogPrice(
  cat: CatalogMatchCandidate,
  targetCurrency: Currency | null,
): string | null {
  if (!cat.priceCents || cat.priceCents <= 0) return null;
  if (!targetCurrency || cat.currency === targetCurrency) {
    return (cat.priceCents / 100).toFixed(2);
  }
  const rates = cachedExchangeRates();
  if (!rates) return null;
  const converted = convertCents(cat.priceCents, cat.currency, targetCurrency, rates);
  return converted !== null ? (converted / 100).toFixed(2) : null;
}

/**
 * Enriches extracted deliverables using the bundled all-MiniLM-L6-v2 sentence transformer:
 * 1. Zero-shot semantic filtering of chitchat vs. real deliverables.
 * 2. Semantic cosine-similarity matching against the user's Service Catalog to auto-suggest pricing.
 * Falls back cleanly to lexical matching if model files are absent (e.g., isolated unit tests).
 */
export async function enrichDeliverablesWithStandardModel(
  items: AiExtractedDeliverable[],
  catalogItems: readonly CatalogMatchCandidate[],
  targetCurrency: Currency | null,
): Promise<{
  items: AiExtractedDeliverable[];
  usedNeuralModel: boolean;
}> {
  if (items.length === 0) {
    return { items: [], usedNeuralModel: false };
  }

  if (!isStandardModelReady()) {
    const enriched = items.map((item) => {
      if (item.unitPrice) return item;
      const lexical = matchCatalogLexically(item.description, catalogItems);
      if (!lexical) return item;
      const suggested = resolveCatalogPrice(lexical.item, targetCurrency);
      return {
        ...item,
        catalogId: lexical.item.id,
        catalogTitle: lexical.item.title,
        catalogMatchScore: lexical.score,
        ...(suggested ? { unitPrice: suggested, priceSource: "catalog" as const } : {}),
      };
    });
    return { items: enriched, usedNeuralModel: false };
  }

  try {
    const prototypes = await getPrototypes();

    // Embed catalog entries once for this extraction pass
    const catalogVectors = await Promise.all(
      catalogItems.map(async (cat) => ({
        item: cat,
        vector: await embedText(
          `${cat.title}. ${cat.category}. ${cat.description || ""}`.trim(),
        ),
      })),
    );

    const results: AiExtractedDeliverable[] = [];
    for (const item of items) {
      const vec = await embedText(item.description);
      const deliverableSim = dotProduct(vec, prototypes.deliverable);
      const chitchatSim = dotProduct(vec, prototypes.chitchat);

      // Filter out obvious conversational filler if there are multiple items and no explicit price
      if (
        items.length > 1 &&
        !item.unitPrice &&
        chitchatSim > deliverableSim + 0.08 &&
        deliverableSim < 0.22
      ) {
        continue;
      }

      const semanticConfidence = Math.max(
        0.4,
        Math.min(0.98, Number((0.55 + (deliverableSim - chitchatSim) * 0.8).toFixed(2))),
      );

      let bestCatalog: { item: CatalogMatchCandidate; score: number } | null =
        null;
      for (const entry of catalogVectors) {
        const sim = dotProduct(vec, entry.vector);
        if (sim >= CATALOG_MATCH_THRESHOLD && (!bestCatalog || sim > bestCatalog.score)) {
          bestCatalog = {
            item: entry.item,
            score: Number(sim.toFixed(2)),
          };
        }
      }

      if (bestCatalog) {
        const suggestedPrice =
          !item.unitPrice
            ? resolveCatalogPrice(bestCatalog.item, targetCurrency)
            : null;
        results.push({
          ...item,
          confidence: Math.max(item.confidence, semanticConfidence),
          catalogId: bestCatalog.item.id,
          catalogTitle: bestCatalog.item.title,
          catalogMatchScore: bestCatalog.score,
          ...(suggestedPrice
            ? { unitPrice: suggestedPrice, priceSource: "catalog" as const }
            : {}),
        });
      } else {
        results.push({
          ...item,
          confidence: Math.max(item.confidence, semanticConfidence),
        });
      }
    }

    scheduleIdleDispose();
    return {
      items: results.length > 0 ? results : items,
      usedNeuralModel: true,
    };
  } catch (err) {
    console.warn("[ai:standard] Falling back to lexical matcher:", err);
    return { items, usedNeuralModel: false };
  }
}
