import type { FeatureExtractionPipeline } from "@huggingface/transformers";
import type { Currency } from "../../src/types/billing";
import type {
  AiCaptureIntent,
  AiExpenseCategory,
  AiExtractedDeliverable,
} from "../../src/types/ai";
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
import { detectCaptureIntentHeuristically } from "./document-parsers";

const IDLE_DISPOSE_MS = 5 * 60 * 1000;
const CATALOG_MATCH_THRESHOLD = 0.52;

const DELIVERABLE_PROTOTYPE =
  "Build, design, develop, fix, integrate, update, or deliver a software feature, webpage, app, logo, or client service item";
const CHITCHAT_PROTOTYPE =
  "Hello, good morning, hope you are doing well, thank you so much, best regards, have a nice day, talk soon";

const EXPENSE_CATEGORY_PROTOTYPES: Record<AiExpenseCategory, string> = {
  SOFTWARE:
    "Software license, SaaS subscription, Figma, Adobe Creative Cloud, JetBrains IDE, GitHub, Slack, Zoom, productivity tools",
  "AI INFRASTRUCTURE":
    "AI API usage, LLM tokens, OpenAI ChatGPT, Anthropic Claude API, Cursor AI, GPU compute, machine learning inference credits",
  HOSTING:
    "Cloud server hosting, AWS Amazon Web Services, Vercel, Netlify, DigitalOcean, Cloudflare, domain name renewal, DNS, database hosting",
  TRAVEL:
    "Flight ticket, Uber taxi ride, PickMe cab, hotel stay, fuel, airport transit, business travel expenses",
  MEALS:
    "Coffee shop, Starbucks, restaurant lunch dinner, client meeting food, cafe bakery meal receipt",
  OFFICE:
    "Office rent, coworking space, internet fiber broadband bill, stationery, desk supplies, utilities",
  HARDWARE:
    "Laptop MacBook computer, monitor display, mechanical keyboard, mouse, SSD storage, USB cable, electronics hardware",
};

const INTENT_PROTOTYPES: Record<AiCaptureIntent, string> = {
  invoice:
    "Client confirms work scope, approves project, asks to send an invoice or pay advance deposit for deliverables",
  quote:
    "Client asks how much it would cost, requests a price estimate, quotation, ballpark pricing, or project proposal before deciding",
  tasks:
    "Client reports a quick bug fix, minor tweak, sprint ticket, or ongoing maintenance task to add directly to the Kanban task board",
};

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let prototypeEmbeddings: Promise<{
  deliverable: Float32Array;
  chitchat: Float32Array;
}> | null = null;
let expenseCategoryEmbeddings: Promise<
  Array<{ category: AiExpenseCategory; vector: Float32Array }>
> | null = null;
let intentEmbeddings: Promise<
  Array<{ intent: AiCaptureIntent; vector: Float32Array }>
> | null = null;

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
  expenseCategoryEmbeddings = null;
  intentEmbeddings = null;
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

async function getExpenseCategoryPrototypes() {
  if (!expenseCategoryEmbeddings) {
    const entries = Object.entries(EXPENSE_CATEGORY_PROTOTYPES) as Array<
      [AiExpenseCategory, string]
    >;
    expenseCategoryEmbeddings = Promise.all(
      entries.map(async ([category, text]) => ({
        category,
        vector: await embedText(text),
      })),
    );
  }
  return expenseCategoryEmbeddings;
}

async function getIntentPrototypes() {
  if (!intentEmbeddings) {
    const entries = Object.entries(INTENT_PROTOTYPES) as Array<
      [AiCaptureIntent, string]
    >;
    intentEmbeddings = Promise.all(
      entries.map(async ([intent, text]) => ({
        intent,
        vector: await embedText(text),
      })),
    );
  }
  return intentEmbeddings;
}

/**
 * Classifies an expense receipt into BillFlow's 7 OPEX categories using bundled
 * all-MiniLM-L6-v2 neural embeddings (with heuristic prior for known merchants).
 */
export async function classifyExpenseCategoryWithStandardModel(input: {
  merchant: string | null;
  description: string | null;
  ocrText: string;
  heuristicCategory: AiExpenseCategory;
  matchedKnownMerchant: boolean;
}): Promise<{
  category: AiExpenseCategory;
  confidence: number;
  source: "neural" | "heuristic";
}> {
  if (input.matchedKnownMerchant) {
    return {
      category: input.heuristicCategory,
      confidence: 0.94,
      source: "heuristic",
    };
  }
  if (!isStandardModelReady()) {
    return {
      category: input.heuristicCategory,
      confidence: 0.68,
      source: "heuristic",
    };
  }

  try {
    const summary = [
      input.merchant || "",
      input.description || "",
      input.ocrText.slice(0, 320),
    ]
      .filter(Boolean)
      .join(". ");

    const [vec, prototypes] = await Promise.all([
      embedText(summary),
      getExpenseCategoryPrototypes(),
    ]);

    let bestCategory: AiExpenseCategory = input.heuristicCategory;
    let bestScore = -1;
    for (const proto of prototypes) {
      const score = dotProduct(vec, proto.vector);
      if (score > bestScore) {
        bestScore = score;
        bestCategory = proto.category;
      }
    }

    scheduleIdleDispose();
    if (bestScore >= 0.24) {
      return {
        category: bestCategory,
        confidence: Math.min(0.95, Math.max(0.55, Number((bestScore + 0.35).toFixed(2)))),
        source: "neural",
      };
    }
    return {
      category: input.heuristicCategory,
      confidence: 0.65,
      source: "heuristic",
    };
  } catch (err) {
    console.warn("[ai:standard] Expense classification fallback:", err);
    return {
      category: input.heuristicCategory,
      confidence: 0.65,
      source: "heuristic",
    };
  }
}

/**
 * Detects whether a captured client message is best routed to:
 * - New Invoice ("invoice")
 * - Proposal / Quote ("quote")
 * - Direct Kanban Tasks ("tasks")
 * Uses zero-shot MiniLM cosine similarity fused with explicit linguistic intent cues.
 */
export async function classifyCaptureIntentWithStandardModel(
  cleanedText: string,
): Promise<{
  intent: AiCaptureIntent;
  confidence: number;
  reason: string;
}> {
  const heuristic = detectCaptureIntentHeuristically(cleanedText);
  if (heuristic.confidence >= 0.82 || !isStandardModelReady()) {
    return heuristic;
  }

  try {
    const [vec, prototypes] = await Promise.all([
      embedText(cleanedText.slice(0, 600)),
      getIntentPrototypes(),
    ]);

    const scores = prototypes
      .map((p) => ({ intent: p.intent, score: dotProduct(vec, p.vector) }))
      .sort((a, b) => b.score - a.score);

    scheduleIdleDispose();
    const top = scores[0];
    const second = scores[1];
    if (top && second && top.score - second.score >= 0.05 && top.score >= 0.24) {
      const reasonMap: Record<AiCaptureIntent, string> = {
        quote: "Message reads like a pricing inquiry — recommended as a Proposal / Quote.",
        tasks: "Message reads like sprint tasks or fixes — ready to add to Kanban Tasks.",
        invoice: "Message describes billable deliverables — recommended as a New Invoice.",
      };
      return {
        intent: top.intent,
        confidence: Math.min(0.92, Math.max(0.62, Number((top.score + 0.4).toFixed(2)))),
        reason: reasonMap[top.intent],
      };
    }
    return heuristic;
  } catch {
    return heuristic;
  }
}
