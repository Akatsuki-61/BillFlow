import { z } from "zod";
import { BrowserWindow } from "electron";
import { ipcMain } from "../security";
import { getDb } from "../db";
import { clients as clientsTable, catalogItems as catalogTable } from "../db/schema";
import type {
  AiDownloadProgressEvent,
  AiExtractedInvoiceDraft,
  AiExtractionInput,
  AiStatus,
} from "../../src/types/ai";
import type { Currency } from "../../src/types/billing";
import {
  cancelEnhancedModelDownload,
  downloadEnhancedModel,
  getAiStatus,
  isEnhancedModelDownloaded,
  removeEnhancedModelFiles,
  setAiTier,
} from "../ai/config";
import {
  parseMessageDeterministically,
  type CatalogMatchCandidate,
  type ClientMatchCandidate,
} from "../ai/entity-parser";
import { disposeOcrWorker, runLocalOcr } from "../ai/ocr";
import {
  disposeStandardModel,
  enrichDeliverablesWithStandardModel,
} from "../ai/semantic-standard";
import {
  disposeEnhancedLlm,
  runEnhancedLlmExtraction,
} from "../ai/llm-enhanced";

const tierSchema = z.enum(["standard", "enhanced"]);

const extractInputSchema = z
  .object({
    text: z.string().max(40_000).optional(),
    imageBase64: z.string().max(24_000_000).optional(),
    imageMimeType: z.string().max(64).optional(),
    tierOverride: tierSchema.optional(),
  })
  .refine(
    (v) =>
      Boolean(v.text && v.text.trim().length > 0) ||
      Boolean(v.imageBase64 && v.imageBase64.trim().length > 0),
    { message: "Paste a client message or screenshot before analyzing." },
  );

function loadActiveClientsForMatching(): ClientMatchCandidate[] {
  const rows = getDb().select().from(clientsTable).all();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    contactPerson: row.contactPerson,
    phone: row.phone,
    whatsappPhone: row.whatsappPhone,
    currency: (row.currency as Currency) || "USD",
    driveUrl: row.driveUrl,
    archivedAt: row.archivedAt,
  }));
}

function loadActiveCatalogForMatching(): CatalogMatchCandidate[] {
  const rows = getDb().select().from(catalogTable).all();
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description || "",
    price: ((row.priceCents || 0) / 100).toFixed(2),
    priceCents: row.priceCents || 0,
    currency: (row.currency as Currency) || "USD",
    unit: row.unit || "project",
  }));
}

export async function extractInvoiceFromMessage(
  rawInput: AiExtractionInput,
): Promise<AiExtractedInvoiceDraft> {
  const startedAt = Date.now();
  const input = extractInputSchema.parse(rawInput);
  const warnings: string[] = [];

  let sourceKind: "image" | "text" = "text";
  let ocrText: string | null = null;
  let combinedText = (input.text || "").trim();

  if (input.imageBase64 && input.imageBase64.trim().length > 0) {
    sourceKind = "image";
    const ocr = await runLocalOcr(input.imageBase64);
    ocrText = ocr.text;
    if (!ocr.text) {
      throw new Error(
        "No readable text was detected in the screenshot. Try a clearer crop or paste the message text directly.",
      );
    }
    if (ocr.confidence > 0 && ocr.confidence < 0.55) {
      warnings.push(
        "Low OCR confidence on this screenshot — double-check extracted wording before saving.",
      );
    }
    combinedText = combinedText ? `${combinedText}\n\n${ocr.text}` : ocr.text;
  }

  const clientCandidates = loadActiveClientsForMatching();
  const catalogCandidates = loadActiveCatalogForMatching();

  // Step 1: Deterministic exact-fact extraction (client DB match, URLs, dates, currencies, fallback segments)
  const deterministic = parseMessageDeterministically(
    combinedText,
    clientCandidates,
  );

  const status = getAiStatus();
  const requestedTier = input.tierOverride ?? status.activeTier;
  let engineUsed: AiExtractedInvoiceDraft["engineUsed"] = "standard";
  let items = deterministic.candidateItems;
  let currency = deterministic.currency;
  let notes = deterministic.notes;
  let suggestedClient = deterministic.suggestedClient;

  // Step 2: Optional Enhanced Local LLM tier (Qwen2.5-0.5B-Instruct)
  if (requestedTier === "enhanced" && isEnhancedModelDownloaded()) {
    try {
      const llm = await runEnhancedLlmExtraction(
        deterministic.cleanedText || combinedText,
      );
      if (llm && llm.items.length > 0) {
        engineUsed = "enhanced";
        items = llm.items;
        if (!currency && llm.currency) {
          currency = llm.currency;
        }
        if (llm.notes && (!notes || llm.notes.length > notes.length)) {
          notes = llm.notes;
        }
        if (!deterministic.matchedClient && llm.clientName && !suggestedClient) {
          suggestedClient = {
            name: llm.clientName,
            contactPerson: llm.clientName,
          };
        }
      } else {
        engineUsed = "standard-fallback";
        warnings.push(
          "Enhanced LLM produced an incomplete response; used the Standard local engine instead.",
        );
      }
    } catch (err) {
      console.warn("[ai:enhanced] Inference failed, falling back to Standard:", err);
      engineUsed = "standard-fallback";
      warnings.push(
        "Enhanced Local LLM encountered an error; automatically fell back to the Standard engine.",
      );
    }
  }

  // Step 3: Bundled Standard MiniLM semantic filtering + Service Catalog auto-pricing match
  const enriched = await enrichDeliverablesWithStandardModel(
    items,
    catalogCandidates,
    currency ?? deterministic.matchedClient?.currency ?? null,
  );
  items = enriched.items;

  if (items.length === 0) {
    warnings.push(
      "Could not detect specific deliverables automatically. You can still add line items directly in the invoice dialog.",
    );
  }

  return {
    sourceKind,
    ocrText,
    cleanedText: deterministic.cleanedText || combinedText,
    engineUsed,
    durationMs: Date.now() - startedAt,
    matchedClientId: deterministic.matchedClient?.id ?? null,
    matchedClientName: deterministic.matchedClient?.name ?? null,
    clientConfidence: deterministic.clientConfidence,
    suggestedClient,
    currency: currency ?? deterministic.matchedClient?.currency ?? null,
    dueDate: deterministic.dueDate,
    deliveryUrl: deterministic.deliveryUrl,
    notes,
    items,
    warnings,
  };
}

export async function disposeAiResources(): Promise<void> {
  await Promise.all([
    disposeOcrWorker(),
    disposeStandardModel(),
    disposeEnhancedLlm(),
  ]);
}

export function registerAiHandlers(
  getMainWindow: () => BrowserWindow | null,
): void {
  const sendProgress = (event: AiDownloadProgressEvent) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send("ai:download-progress", event);
    }
  };

  ipcMain.handle("ai:status", (): AiStatus => getAiStatus());

  ipcMain.handle("ai:setTier", async (_event, tier: unknown): Promise<AiStatus> => {
    const parsed = tierSchema.parse(tier);
    if (parsed === "standard") {
      await disposeEnhancedLlm();
    }
    return setAiTier(parsed);
  });

  ipcMain.handle(
    "ai:extractInvoice",
    async (_event, input: unknown): Promise<AiExtractedInvoiceDraft> => {
      return extractInvoiceFromMessage(input as AiExtractionInput);
    },
  );

  ipcMain.handle("ai:downloadEnhancedModel", async (): Promise<AiStatus> => {
    return downloadEnhancedModel(sendProgress);
  });

  ipcMain.handle("ai:cancelDownload", (): AiStatus => {
    return cancelEnhancedModelDownload();
  });

  ipcMain.handle("ai:removeEnhancedModel", async (): Promise<AiStatus> => {
    await disposeEnhancedLlm();
    return removeEnhancedModelFiles();
  });
}
