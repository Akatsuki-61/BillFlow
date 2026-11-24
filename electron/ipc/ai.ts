import { z } from "zod";
import { BrowserWindow } from "electron";
import { ipcMain } from "../security";
import { getDb } from "../db";
import { clients as clientsTable, catalogItems as catalogTable } from "../db/schema";
import type {
  AiDownloadProgressEvent,
  AiExpenseReceiptScanInput,
  AiExpenseReceiptScanResult,
  AiExtractedInvoiceDraft,
  AiExtractionInput,
  AiPaymentSlipScanInput,
  AiPaymentSlipScanResult,
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
import {
  parseBankTransferSlip,
  parseExpenseReceiptDeterministically,
} from "../ai/document-parsers";
import { disposeOcrWorker, runLocalOcr } from "../ai/ocr";
import {
  classifyCaptureIntentWithStandardModel,
  classifyExpenseCategoryWithStandardModel,
  disposeStandardModel,
  enrichDeliverablesWithStandardModel,
} from "../ai/semantic-standard";
import {
  disposeEnhancedLlm,
  runEnhancedLlmExtraction,
} from "../ai/llm-enhanced";
import { peekStagedAttachmentBytes } from "./files";

const tierSchema = z.enum(["standard", "enhanced"]);
const currencySchema = z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]);

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

const paymentSlipScanSchema = z
  .object({
    imageBase64: z.string().max(24_000_000).optional(),
    stagedToken: z.string().min(8).max(128).optional(),
    expectedAmountCents: z.number().int().min(0).optional(),
    expectedAdvanceCents: z.number().int().min(0).optional(),
    expectedCurrency: currencySchema.optional(),
  })
  .refine((v) => Boolean(v.imageBase64 || v.stagedToken), {
    message: "Provide a bank slip image to scan.",
  });

const expenseReceiptScanSchema = z
  .object({
    imageBase64: z.string().max(24_000_000).optional(),
    stagedToken: z.string().min(8).max(128).optional(),
    text: z.string().max(40_000).optional(),
  })
  .refine((v) => Boolean(v.imageBase64 || v.stagedToken || v.text?.trim()), {
    message: "Provide a receipt image or text to scan.",
  });

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

  // Step 3: Bundled Standard MiniLM semantic filtering + Service Catalog auto-pricing + Intent classification
  const [enriched, intent] = await Promise.all([
    enrichDeliverablesWithStandardModel(
      items,
      catalogCandidates,
      currency ?? deterministic.matchedClient?.currency ?? null,
    ),
    classifyCaptureIntentWithStandardModel(
      deterministic.cleanedText || combinedText,
    ),
  ]);
  items = enriched.items;

  if (items.length === 0) {
    warnings.push(
      "Could not detect specific deliverables automatically. You can still add line items directly in the form.",
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
    detectedIntent: intent.intent,
    intentConfidence: intent.confidence,
    intentReason: intent.reason,
    warnings,
  };
}

function resolveScanImageDataUrl(
  imageBase64: string | undefined,
  stagedToken: string | undefined,
  sender?: Electron.WebContents,
): string {
  if (imageBase64 && imageBase64.trim()) return imageBase64;
  if (stagedToken && sender) {
    const staged = peekStagedAttachmentBytes(sender, stagedToken);
    if (!staged.mimeType.startsWith("image/")) {
      throw new Error(
        "Automatic OCR scanning supports PNG, JPEG, and WebP images. PDFs can still be attached directly.",
      );
    }
    return `data:${staged.mimeType};base64,${staged.bytes.toString("base64")}`;
  }
  throw new Error("No readable image was provided for scanning.");
}

export async function scanPaymentSlip(
  rawInput: AiPaymentSlipScanInput,
  sender?: Electron.WebContents,
): Promise<AiPaymentSlipScanResult> {
  const startedAt = Date.now();
  const input = paymentSlipScanSchema.parse(rawInput);
  const dataUrl = resolveScanImageDataUrl(
    input.imageBase64,
    input.stagedToken,
    sender,
  );
  const ocr = await runLocalOcr(dataUrl);
  if (!ocr.text) {
    throw new Error(
      "No readable text was found on this payment slip. Try a clearer image or enter the payment manually.",
    );
  }

  const parsed = parseBankTransferSlip(ocr.text, {
    expectedAmountCents: input.expectedAmountCents,
    expectedAdvanceCents: input.expectedAdvanceCents,
    expectedCurrency: input.expectedCurrency,
  });

  if (ocr.confidence > 0 && ocr.confidence < 0.5) {
    parsed.warnings.push(
      "Low OCR confidence on this slip — double-check the extracted amount and reference.",
    );
  }

  return {
    ocrText: ocr.text,
    amount: parsed.amount,
    amountCents: parsed.amountCents,
    currency: parsed.currency,
    paymentDate: parsed.paymentDate,
    reference: parsed.reference,
    bankName: parsed.bankName,
    confidence: ocr.confidence,
    durationMs: Date.now() - startedAt,
    matchLabel: parsed.matchLabel,
    mismatch: parsed.mismatch,
    warnings: parsed.warnings,
  };
}

export async function scanExpenseReceipt(
  rawInput: AiExpenseReceiptScanInput,
  sender?: Electron.WebContents,
): Promise<AiExpenseReceiptScanResult> {
  const startedAt = Date.now();
  const input = expenseReceiptScanSchema.parse(rawInput);
  const warnings: string[] = [];

  let ocrText = (input.text || "").trim();
  if (input.imageBase64 || input.stagedToken) {
    const dataUrl = resolveScanImageDataUrl(
      input.imageBase64,
      input.stagedToken,
      sender,
    );
    const ocr = await runLocalOcr(dataUrl);
    if (!ocr.text && !ocrText) {
      throw new Error(
        "No readable text was found on this receipt. Try a clearer photo or enter the expense manually.",
      );
    }
    if (ocr.confidence > 0 && ocr.confidence < 0.5) {
      warnings.push(
        "Low OCR confidence on this receipt — verify merchant and total before saving.",
      );
    }
    ocrText = ocrText ? `${ocrText}\n${ocr.text}` : ocr.text;
  }

  const parsed = parseExpenseReceiptDeterministically(ocrText);
  const classified = await classifyExpenseCategoryWithStandardModel({
    merchant: parsed.merchant,
    description: parsed.description,
    ocrText,
    heuristicCategory: parsed.heuristicCategory,
    matchedKnownMerchant: parsed.matchedKnownMerchant,
  });

  return {
    ocrText,
    merchant: parsed.merchant,
    description: parsed.description,
    amount: parsed.amount,
    amountCents: parsed.amountCents,
    currency: parsed.currency,
    incurredAt: parsed.incurredAt,
    category: classified.category,
    categoryConfidence: classified.confidence,
    categorySource: classified.source,
    durationMs: Date.now() - startedAt,
    warnings: [...warnings, ...parsed.warnings],
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

  ipcMain.handle(
    "ai:scanPaymentSlip",
    async (event, input: unknown): Promise<AiPaymentSlipScanResult> => {
      return scanPaymentSlip(input as AiPaymentSlipScanInput, event.sender);
    },
  );

  ipcMain.handle(
    "ai:scanExpenseReceipt",
    async (event, input: unknown): Promise<AiExpenseReceiptScanResult> => {
      return scanExpenseReceipt(
        input as AiExpenseReceiptScanInput,
        event.sender,
      );
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
