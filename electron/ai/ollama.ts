import { z } from "zod";
import type { Currency } from "../../src/types/billing";
import type {
  AiCaptureIntent,
  AiExtractedDeliverable,
  AiOllamaCheckResult,
} from "../../src/types/ai";
import type { CatalogMatchCandidate } from "./entity-parser";
import { validateLocalOllamaUrl } from "./config";

const ollamaDeliverableSchema = z.object({
  description: z.string().trim().min(2).max(220),
  quantity: z.coerce.number().int().min(1).max(999).optional().default(1),
  unitPrice: z.coerce.number().positive().max(100_000_000).nullable().optional(),
});

const ollamaRawResponseSchema = z.object({
  clientName: z.string().trim().max(120).nullable().optional(),
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).nullable().optional(),
  intent: z.enum(["invoice", "quote", "tasks"]).nullable().optional(),
  deliverables: z.array(ollamaDeliverableSchema).max(15).optional(),
  items: z.array(ollamaDeliverableSchema).max(15).optional(),
  lineItems: z.array(ollamaDeliverableSchema).max(15).optional(),
  tasks: z.array(ollamaDeliverableSchema).max(15).optional(),
  notes: z.string().trim().max(400).nullable().optional(),
});

export interface OllamaExtractionResult {
  clientName: string | null;
  currency: Currency | null;
  intent: AiCaptureIntent | null;
  items: AiExtractedDeliverable[];
  notes: string | null;
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

export async function checkLocalOllama(
  rawBaseUrl?: string,
): Promise<AiOllamaCheckResult> {
  let baseUrl: string;
  try {
    baseUrl = validateLocalOllamaUrl(rawBaseUrl);
  } catch (err) {
    return {
      reachable: false,
      baseUrl: rawBaseUrl || "http://127.0.0.1:11434",
      models: [],
      error: err instanceof Error ? err.message : "Invalid local Ollama URL.",
    };
  }

  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) {
      return {
        reachable: false,
        baseUrl,
        models: [],
        error: `Local Ollama responded with HTTP ${res.status}.`,
      };
    }
    const payload = (await res.json()) as {
      models?: Array<{ name?: string; model?: string }>;
    };
    const models = Array.from(
      new Set(
        (payload.models || [])
          .map((m) => (m.name || m.model || "").trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
    return {
      reachable: true,
      baseUrl,
      models,
      error:
        models.length === 0
          ? "Ollama is running, but no models are installed yet (run `ollama pull qwen2.5:3b`)."
          : null,
    };
  } catch {
    return {
      reachable: false,
      baseUrl,
      models: [],
      error: `Could not reach Ollama at ${baseUrl}. Make sure Ollama is running locally.`,
    };
  }
}

export async function runOllamaExtraction(
  cleanedText: string,
  catalogItems: readonly CatalogMatchCandidate[],
  rawBaseUrl: string,
  model: string,
): Promise<OllamaExtractionResult | null> {
  const baseUrl = validateLocalOllamaUrl(rawBaseUrl);
  const catalogContext =
    catalogItems.length > 0
      ? `\n\nFreelancer Service Catalog (use exact catalog title when the client asks for one of these services):\n${catalogItems
          .slice(0, 30)
          .map((c) => `- ${c.title} (${c.category})`)
          .join("\n")}`
      : "";

  const systemPrompt =
    'You extract structured freelance invoice/quote deliverables from client messages. Respond ONLY with a valid JSON object matching: {"clientName":string|null,"currency":"USD"|"LKR"|"EUR"|"GBP"|"CAD"|null,"intent":"invoice"|"quote"|"tasks"|null,"deliverables":[{"description":string,"quantity":number,"unitPrice":number|null}],"notes":string|null}. Keep descriptions crisp and invoice-ready. If a request matches a Service Catalog title, use that exact catalog title. Set unitPrice to null unless the client explicitly mentioned a price. Never invent deliverables not in the message.' +
    catalogContext;

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(25_000),
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      options: { temperature: 0 },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Extract deliverables from this client message:\n\n${cleanedText.slice(0, 3000)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Local Ollama returned HTTP ${res.status}.`);
  }

  const data = (await res.json()) as {
    message?: { content?: string };
    response?: string;
  };
  const reply = data.message?.content ?? data.response ?? "";
  const rawJson = extractJsonObjectFromReply(reply);
  if (!rawJson) return null;

  const parsed = ollamaRawResponseSchema.safeParse(rawJson);
  if (!parsed.success) return null;

  const rawList =
    parsed.data.deliverables ??
    parsed.data.items ??
    parsed.data.lineItems ??
    parsed.data.tasks ??
    [];
  if (rawList.length === 0) return null;

  const items: AiExtractedDeliverable[] = rawList.map((entry, idx) => ({
    id: `ollama-item-${idx + 1}`,
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
  }));

  return {
    clientName: parsed.data.clientName ?? null,
    currency: parsed.data.currency ?? null,
    intent: parsed.data.intent ?? null,
    items,
    notes: parsed.data.notes ?? null,
  };
}
