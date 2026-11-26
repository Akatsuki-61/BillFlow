import type {
  FeatureExtractionPipeline,
  ZeroShotClassificationPipeline,
} from "@huggingface/transformers";
import type { Currency } from "../../src/types/billing";
import type {
  AiCaptureIntent,
  AiExpenseCategory,
  AiExtractedDeliverable,
} from "../../src/types/ai";
import {
  ENHANCED_EMBEDDING_MODEL_ID,
  ENHANCED_NLI_MODEL_ID,
  getUserModelsDir,
  isEnhancedModelDownloaded,
} from "./config";
import {
  applyMatchedCatalogToDeliverable,
  deduplicateDeliverables,
  fuseCatalogScores,
  scoreCatalogCandidateLexically,
  type CatalogMatchCandidate,
} from "./entity-parser";
import { detectCaptureIntentHeuristically } from "./document-parsers";
import { resolveCatalogPrice } from "./semantic-standard";
import { loadTransformers, SAFE_ONNX_SESSION_OPTIONS } from "./transformers-loader";

export { extractJsonObjectFromReply } from "./ollama";

const IDLE_DISPOSE_MS = 5 * 60 * 1000;
const BGE_QUERY_PREFIX =
  "Represent this sentence for searching relevant passages: ";
const ENHANCED_BGE_THRESHOLD = 0.56;

const NLI_INTENT_LABELS: Record<AiCaptureIntent, string> = {
  invoice: "confirming a project order, approving work, or requesting an invoice",
  quote: "asking for a price quote, cost estimate, or project proposal before deciding",
  tasks: "reporting a quick bug fix, minor tweak, or sprint task for a task board",
};

const NLI_EXPENSE_LABELS: Record<AiExpenseCategory, string> = {
  SOFTWARE: "software subscription",
  "AI INFRASTRUCTURE": "artificial intelligence API",
  HOSTING: "cloud web hosting",
  TRAVEL: "business travel",
  MEALS: "food and restaurant meals",
  OFFICE: "office rent and supplies",
  HARDWARE: "computer hardware and electronics",
};

const BGE_EXPENSE_PROTOTYPES: Record<AiExpenseCategory, string> = {
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
    "Laptop MacBook computer, monitor display, mechanical keyboard, mouse, SSD storage, USB cable, dock, electronics hardware",
};

let bgePipelinePromise: Promise<FeatureExtractionPipeline> | null = null;
let nliPipelinePromise: Promise<ZeroShotClassificationPipeline> | null = null;
let bgeExpensePrototypesPromise: Promise<
  Array<{ category: AiExpenseCategory; vector: Float32Array }>
> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleIdleDispose() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = null;
    void disposeEnhancedEngine();
  }, IDLE_DISPOSE_MS);
  idleTimer.unref?.();
}

export async function disposeEnhancedEngine(): Promise<void> {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  const pendingBge = bgePipelinePromise;
  const pendingNli = nliPipelinePromise;
  bgePipelinePromise = null;
  nliPipelinePromise = null;
  bgeExpensePrototypesPromise = null;

  await Promise.all([
    pendingBge
      ? pendingBge
          .then((pipe) =>
            (pipe as unknown as { dispose?: () => Promise<void> }).dispose?.(),
          )
          .catch(() => {})
      : Promise.resolve(),
    pendingNli
      ? pendingNli
          .then((pipe) =>
            (pipe as unknown as { dispose?: () => Promise<void> }).dispose?.(),
          )
          .catch(() => {})
      : Promise.resolve(),
  ]);
}

/** Backwards-compatible alias for disposal calls. */
export const disposeEnhancedLlm = disposeEnhancedEngine;

async function getBgePipeline(): Promise<FeatureExtractionPipeline> {
  if (!isEnhancedModelDownloaded()) {
    throw new Error("Enhanced Offline AI pack is not downloaded.");
  }
  if (!bgePipelinePromise) {
    bgePipelinePromise = (async () => {
      const { pipeline } = await loadTransformers(getUserModelsDir());
      return pipeline("feature-extraction", ENHANCED_EMBEDDING_MODEL_ID, {
        local_files_only: true,
        dtype: "int8",
        session_options: SAFE_ONNX_SESSION_OPTIONS,
      });
    })().catch((err) => {
      bgePipelinePromise = null;
      throw err;
    });
  }
  scheduleIdleDispose();
  return bgePipelinePromise;
}

async function getNliPipeline(): Promise<ZeroShotClassificationPipeline> {
  if (!isEnhancedModelDownloaded()) {
    throw new Error("Enhanced Offline AI pack is not downloaded.");
  }
  if (!nliPipelinePromise) {
    nliPipelinePromise = (async () => {
      const { pipeline } = await loadTransformers(getUserModelsDir());
      return pipeline("zero-shot-classification", ENHANCED_NLI_MODEL_ID, {
        local_files_only: true,
        dtype: "int8",
        session_options: SAFE_ONNX_SESSION_OPTIONS,
      });
    })().catch((err) => {
      nliPipelinePromise = null;
      throw err;
    });
  }
  scheduleIdleDispose();
  return nliPipelinePromise;
}

async function embedWithBge(
  text: string,
  isQuery = false,
): Promise<Float32Array> {
  const pipe = await getBgePipeline();
  const input = isQuery ? `${BGE_QUERY_PREFIX}${text}` : text;
  const output = await pipe(input, { pooling: "cls", normalize: true });
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

interface NormalizedZeroShot {
  labels: string[];
  scores: number[];
}

async function runZeroShot(
  text: string,
  candidateLabels: string[],
  options?: { multi_label?: boolean; hypothesis_template?: string },
): Promise<NormalizedZeroShot> {
  const classifier = await getNliPipeline();
  const raw = await classifier(text, candidateLabels, options);
  const single = Array.isArray(raw) ? raw[0] : raw;
  return {
    labels: (single as NormalizedZeroShot)?.labels ?? [],
    scores: (single as NormalizedZeroShot)?.scores ?? [],
  };
}

/**
 * High-precision Enhanced Offline AI deliverable enrichment:
 * 1. DeBERTa-v3 NLI filters out conversational filler sentences in multi-clause chats.
 * 2. 768-dim BGE-Base v1.5 embeddings + domain-lexical scoring rank Service Catalog matches.
 * 3. DeBERTa-v3 NLI entailment verifies borderline catalog matches to eliminate false positives
 *    and boost true paraphrased matches, replacing raw prose with the crisp Catalog title.
 */
export async function enrichDeliverablesWithEnhancedModel(
  items: AiExtractedDeliverable[],
  catalogItems: readonly CatalogMatchCandidate[],
  targetCurrency: Currency | null,
): Promise<{
  items: AiExtractedDeliverable[];
  usedEnhancedModel: boolean;
}> {
  if (items.length === 0) {
    return { items: [], usedEnhancedModel: false };
  }
  if (!isEnhancedModelDownloaded()) {
    return { items, usedEnhancedModel: false };
  }

  const catalogVectors = await Promise.all(
    catalogItems.map(async (cat) => {
      const [titleVector, fullVector] = await Promise.all([
        embedWithBge(cat.title, false),
        embedWithBge(
          `${cat.title}. ${cat.category}. ${cat.description || ""}`.trim(),
          false,
        ),
      ]);
      return { item: cat, titleVector, fullVector };
    }),
  );

  const DELIVERABLE_LABEL =
    "a requested work deliverable, software task, design item, or service";
  const CHITCHAT_LABEL =
    "a greeting, thank you, scheduling remark, referral mention, or casual conversation";

  const results: AiExtractedDeliverable[] = [];

  for (const item of items) {
    const queryVec = await embedWithBge(item.description, true);

    // Score all catalog candidates with BGE-Base + lexical recall
    const ranked = catalogVectors
      .map((entry) => {
        const bgeSim = Math.max(
          dotProduct(queryVec, entry.titleVector),
          dotProduct(queryVec, entry.fullVector),
        );
        const lexical = scoreCatalogCandidateLexically(
          item.description,
          entry.item,
        );
        const fused = fuseCatalogScores(bgeSim, lexical, ENHANCED_BGE_THRESHOLD);
        return {
          item: entry.item,
          bgeSim,
          lexical,
          fused,
          rankScore: Math.max(bgeSim, lexical),
        };
      })
      .sort((a, b) => b.rankScore - a.rankScore);

    let bestCatalog: { item: CatalogMatchCandidate; score: number } | null =
      null;
    const topCandidate = ranked[0];

    if (topCandidate) {
      if (topCandidate.fused !== null && topCandidate.lexical >= 0.72) {
        // High-confidence title/lexical + BGE agreement
        bestCatalog = {
          item: topCandidate.item,
          score: topCandidate.fused,
        };
      } else if (topCandidate.rankScore >= 0.44) {
        // Verify top candidates via DeBERTa-v3 NLI entailment for high precision on paraphrases
        const shortlist = ranked
          .filter((r) => r.rankScore >= 0.4)
          .slice(0, 3);
        const labelToCandidate = new Map<string, (typeof shortlist)[number]>();
        const labels: string[] = [];
        for (const cand of shortlist) {
          const label = cand.item.title;
          if (!labelToCandidate.has(label)) {
            labelToCandidate.set(label, cand);
            labels.push(label);
          }
        }
        const UNRELATED_LABEL = "something completely unrelated";
        labels.push(UNRELATED_LABEL);

        const nli = await runZeroShot(item.description, labels, {
          multi_label: true,
          hypothesis_template: "This client request is asking for {}.",
        });

        const unrelatedIdx = nli.labels.indexOf(UNRELATED_LABEL);
        const unrelatedScore =
          unrelatedIdx >= 0 ? (nli.scores[unrelatedIdx] ?? 0) : 0;

        let bestVerified: { item: CatalogMatchCandidate; score: number } | null =
          null;
        for (let i = 0; i < nli.labels.length; i += 1) {
          const label = nli.labels[i];
          const entailment = nli.scores[i] ?? 0;
          if (label === UNRELATED_LABEL) continue;
          const cand = labelToCandidate.get(label);
          if (!cand) continue;

          // Accept if NLI confirms entailment clearly above unrelated OR BGE+lexical passed and NLI agrees
          const nliConfirmed =
            entailment >= 0.38 && entailment >= unrelatedScore * 2;
          const strongBgeCorroborated =
            cand.fused !== null && entailment >= 0.18;
          if (nliConfirmed || strongBgeCorroborated) {
            const combined = Math.min(
              0.98,
              Number(
                Math.max(
                  cand.fused ?? 0,
                  cand.bgeSim * 0.55 + entailment * 0.45,
                ).toFixed(2),
              ),
            );
            if (!bestVerified || combined > bestVerified.score) {
              bestVerified = { item: cand.item, score: combined };
            }
          }
        }
        bestCatalog = bestVerified;
      }
    }

    // Use DeBERTa-v3 NLI to prune obvious non-deliverable filler sentences when multiple clauses exist
    let nliDeliverableScore = item.confidence;
    if (items.length > 1 && !item.unitPrice && !bestCatalog) {
      const check = await runZeroShot(item.description, [
        DELIVERABLE_LABEL,
        CHITCHAT_LABEL,
      ]);
      const delIdx = check.labels.indexOf(DELIVERABLE_LABEL);
      const chatIdx = check.labels.indexOf(CHITCHAT_LABEL);
      const delScore = delIdx >= 0 ? check.scores[delIdx] : 0.5;
      const chatScore = chatIdx >= 0 ? check.scores[chatIdx] : 0.5;
      if (chatScore > 0.72 && delScore < 0.35) {
        continue;
      }
      nliDeliverableScore = Math.max(
        0.45,
        Math.min(0.98, Number(delScore.toFixed(2))),
      );
    }

    if (bestCatalog) {
      const suggestedPrice = !item.unitPrice
        ? resolveCatalogPrice(bestCatalog.item, targetCurrency)
        : null;
      results.push(
        applyMatchedCatalogToDeliverable(
          item,
          bestCatalog,
          suggestedPrice,
          Math.max(nliDeliverableScore, 0.88),
        ),
      );
    } else {
      results.push({
        ...item,
        confidence: Math.max(item.confidence, nliDeliverableScore),
      });
    }
  }

  scheduleIdleDispose();
  const deduped = deduplicateDeliverables(results.length > 0 ? results : items);
  return { items: deduped, usedEnhancedModel: true };
}

/**
 * Classifies client message intent (invoice vs quote vs tasks) using DeBERTa-v3 NLI.
 */
export async function classifyCaptureIntentWithEnhancedModel(
  cleanedText: string,
): Promise<{
  intent: AiCaptureIntent;
  confidence: number;
  reason: string;
}> {
  const heuristic = detectCaptureIntentHeuristically(cleanedText);
  if (heuristic.confidence >= 0.85 || !isEnhancedModelDownloaded()) {
    return heuristic;
  }

  const entries = Object.entries(NLI_INTENT_LABELS) as Array<
    [AiCaptureIntent, string]
  >;
  const labels = entries.map(([, label]) => label);
  const labelToIntent = new Map<string, AiCaptureIntent>(
    entries.map(([intent, label]) => [label, intent]),
  );

  const nli = await runZeroShot(cleanedText.slice(0, 800), labels, {
    hypothesis_template: "In this message, the client is {}.",
  });

  scheduleIdleDispose();
  const topLabel = nli.labels[0];
  const topScore = nli.scores[0] ?? 0;
  const secondScore = nli.scores[1] ?? 0;
  const intent = topLabel ? labelToIntent.get(topLabel) : undefined;

  if (intent && topScore >= 0.45 && topScore - secondScore >= 0.12) {
    const reasonMap: Record<AiCaptureIntent, string> = {
      quote:
        "Enhanced AI detected a pricing or proposal inquiry. Recommended as a Proposal / Quote.",
      tasks:
        "Enhanced AI detected a quick fix or sprint item. Ready to add to Kanban Tasks.",
      invoice:
        "Enhanced AI detected confirmed deliverables. Recommended as a New Invoice.",
    };
    return {
      intent,
      confidence: Math.min(0.97, Math.max(0.68, Number(topScore.toFixed(2)))),
      reason: reasonMap[intent],
    };
  }
  return heuristic;
}

async function getBgeExpensePrototypes() {
  if (!bgeExpensePrototypesPromise) {
    const entries = Object.entries(BGE_EXPENSE_PROTOTYPES) as Array<
      [AiExpenseCategory, string]
    >;
    bgeExpensePrototypesPromise = Promise.all(
      entries.map(async ([category, text]) => ({
        category,
        vector: await embedWithBge(text, false),
      })),
    );
  }
  return bgeExpensePrototypesPromise;
}

/**
 * Classifies an unknown receipt merchant into BillFlow's 7 OPEX categories
 * by fusing 768-dim BGE-Base semantic similarity with DeBERTa-v3 NLI zero-shot scores.
 */
export async function classifyExpenseCategoryWithEnhancedModel(input: {
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
  if (input.matchedKnownMerchant || !isEnhancedModelDownloaded()) {
    return {
      category: input.heuristicCategory,
      confidence: input.matchedKnownMerchant ? 0.94 : 0.68,
      source: "heuristic",
    };
  }

  const summary = [
    input.merchant || "",
    input.description || "",
    input.ocrText.slice(0, 400),
  ]
    .filter(Boolean)
    .join(". ");

  const entries = Object.entries(NLI_EXPENSE_LABELS) as Array<
    [AiExpenseCategory, string]
  >;
  const labels = entries.map(([, label]) => label);
  const labelToCat = new Map<string, AiExpenseCategory>(
    entries.map(([cat, label]) => [label, cat]),
  );

  const [queryVec, prototypes, nli] = await Promise.all([
    embedWithBge(summary, true),
    getBgeExpensePrototypes(),
    runZeroShot(summary, labels, {
      hypothesis_template: "This receipt is an expense for {}.",
    }),
  ]);

  const nliScoreByCat = new Map<AiExpenseCategory, number>();
  for (let i = 0; i < nli.labels.length; i += 1) {
    const cat = labelToCat.get(nli.labels[i]);
    if (cat) nliScoreByCat.set(cat, nli.scores[i] ?? 0);
  }

  let bestCategory: AiExpenseCategory = input.heuristicCategory;
  let bestCombined = -1;
  for (const proto of prototypes) {
    const bgeScore = dotProduct(queryVec, proto.vector);
    const nliScore = nliScoreByCat.get(proto.category) ?? 0;
    const combined = bgeScore * 0.6 + nliScore * 0.4;
    if (combined > bestCombined) {
      bestCombined = combined;
      bestCategory = proto.category;
    }
  }

  scheduleIdleDispose();
  if (bestCombined >= 0.36) {
    return {
      category: bestCategory,
      confidence: Math.min(
        0.97,
        Math.max(0.65, Number((bestCombined + 0.25).toFixed(2))),
      ),
      source: "neural",
    };
  }
  return {
    category: input.heuristicCategory,
    confidence: 0.65,
    source: "heuristic",
  };
}
