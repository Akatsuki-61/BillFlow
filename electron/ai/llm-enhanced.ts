import { z } from "zod";
import type { TextGenerationPipeline } from "@huggingface/transformers";
import type { Currency } from "../../src/types/billing";
import type { AiExtractedDeliverable } from "../../src/types/ai";
import {
  ENHANCED_MODEL_ID,
  getUserModelsDir,
  isEnhancedModelDownloaded,
} from "./config";
import { loadTransformers } from "./transformers-loader";

const IDLE_DISPOSE_MS = 5 * 60 * 1000;

let generatorPromise: Promise<TextGenerationPipeline> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

const llmOutputSchema = z.object({
  clientName: z.string().trim().max(120).nullable().optional(),
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).nullable().optional(),
  deliverables: z
    .array(
      z.object({
        description: z.string().trim().min(2).max(220),
        quantity: z.number().int().min(1).max(999).optional().default(1),
        unitPrice: z.number().positive().max(100_000_000).nullable().optional(),
      }),
    )
    .max(15)
    .optional()
    .default([]),
  notes: z.string().trim().max(400).nullable().optional(),
});

export interface EnhancedLlmExtraction {
  clientName: string | null;
  currency: Currency | null;
  items: AiExtractedDeliverable[];
  notes: string | null;
}

function scheduleIdleDispose() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = null;
    void disposeEnhancedLlm();
  }, IDLE_DISPOSE_MS);
  idleTimer.unref?.();
}

export async function disposeEnhancedLlm(): Promise<void> {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  const pending = generatorPromise;
  generatorPromise = null;
  if (!pending) return;
  try {
    const pipe = await pending;
    await (pipe as unknown as { dispose?: () => Promise<void> }).dispose?.();
  } catch {
    // ignore cleanup failure
  }
}

async function getEnhancedPipeline(): Promise<TextGenerationPipeline> {
  if (!isEnhancedModelDownloaded()) {
    throw new Error("Enhanced Local LLM model is not downloaded.");
  }
  if (!generatorPromise) {
    generatorPromise = (async () => {
      const { pipeline } = await loadTransformers(getUserModelsDir());
      const generator = await pipeline("text-generation", ENHANCED_MODEL_ID, {
        local_files_only: true,
        dtype: "q8",
      });
      return generator;
    })().catch((err) => {
      generatorPromise = null;
      throw err;
    });
  }
  scheduleIdleDispose();
  return generatorPromise;
}

export function extractJsonObjectFromReply(raw: string): unknown | null {
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function runEnhancedLlmExtraction(
  cleanedText: string,
): Promise<EnhancedLlmExtraction | null> {
  if (!isEnhancedModelDownloaded()) return null;

  const pipe = await getEnhancedPipeline();
  const truncated = cleanedText.slice(0, 2200);

  const messages = [
    {
      role: "system",
      content:
        'You extract freelance invoice deliverables from client messages. Respond ONLY with valid minified JSON matching: {"clientName":string|null,"currency":"USD"|"LKR"|"EUR"|"GBP"|"CAD"|null,"deliverables":[{"description":string,"quantity":number,"unitPrice":number|null}],"notes":string|null}. Keep each description concise and invoice-ready. Never invent tasks not in the message.',
    },
    {
      role: "user",
      content: `Extract invoice items from this client message:\n\n${truncated}`,
    },
  ];

  const output = await pipe(messages, {
    max_new_tokens: 260,
    do_sample: false,
    return_full_text: false,
  });

  scheduleIdleDispose();

  const first = Array.isArray(output) ? output[0] : output;
  const generated = (first as { generated_text?: unknown })?.generated_text;
  let replyText = "";
  if (typeof generated === "string") {
    replyText = generated;
  } else if (Array.isArray(generated)) {
    const last = generated[generated.length - 1] as { content?: string } | undefined;
    replyText = typeof last?.content === "string" ? last.content : "";
  }

  const rawJson = extractJsonObjectFromReply(replyText);
  if (!rawJson) return null;

  const parsed = llmOutputSchema.safeParse(rawJson);
  if (!parsed.success || parsed.data.deliverables.length === 0) {
    return null;
  }

  const items: AiExtractedDeliverable[] = parsed.data.deliverables.map(
    (entry, idx) => ({
      id: `llm-item-${idx + 1}`,
      description: entry.description,
      quantity: entry.quantity ?? 1,
      unitPrice:
        entry.unitPrice && entry.unitPrice > 0
          ? entry.unitPrice.toFixed(2)
          : null,
      priceSource:
        entry.unitPrice && entry.unitPrice > 0 ? ("message" as const) : null,
      catalogId: null,
      catalogTitle: null,
      catalogMatchScore: null,
      confidence: 0.92,
    }),
  );

  return {
    clientName: parsed.data.clientName ?? null,
    currency: parsed.data.currency ?? null,
    items,
    notes: parsed.data.notes ?? null,
  };
}
