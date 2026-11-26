import type { Currency } from "./billing";

export type AiModelTier = "standard" | "enhanced" | "ollama";

export type AiDownloadState = "idle" | "downloading" | "error";

export type AiCaptureIntent = "invoice" | "quote" | "tasks";

export type AiExpenseCategory =
  | "SOFTWARE"
  | "AI INFRASTRUCTURE"
  | "HOSTING"
  | "TRAVEL"
  | "MEALS"
  | "OFFICE"
  | "HARDWARE";

export interface AiOllamaCheckResult {
  reachable: boolean;
  baseUrl: string;
  models: string[];
  error?: string | null;
}

export interface AiOllamaConfigInput {
  baseUrl?: string;
  model?: string | null;
}

export interface AiStatus {
  activeTier: AiModelTier;
  ocrReady: boolean;
  standardModelReady: boolean;
  enhancedModelDownloaded: boolean;
  enhancedModelId: string;
  enhancedModelLabel: string;
  enhancedModelExpectedBytes: number;
  enhancedModelDiskBytes: number;
  legacyEnhancedDiskBytes?: number;
  ollamaUrl: string;
  ollamaModel: string | null;
  downloadState: AiDownloadState;
  downloadProgress: number;
  downloadMessage: string;
  lastError?: string | null;
}

export interface AiDownloadProgressEvent {
  state: AiDownloadState;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  currentFile?: string;
  message: string;
  error?: string | null;
}

export interface AiExtractionInput {
  text?: string;
  imageBase64?: string;
  imageMimeType?: string;
  tierOverride?: AiModelTier;
}

export interface AiExtractedDeliverable {
  id: string;
  description: string;
  quantity: number;
  unitPrice?: string | null;
  priceSource?: "message" | "catalog" | null;
  catalogId?: string | null;
  catalogTitle?: string | null;
  catalogMatchScore?: number | null;
  confidence: number;
}

export interface AiSuggestedClient {
  name: string;
  email?: string;
  contactPerson?: string;
  phone?: string;
  whatsappPhone?: string;
}

export interface AiExtractedInvoiceDraft {
  sourceKind: "image" | "text";
  ocrText?: string | null;
  cleanedText: string;
  engineUsed: "standard" | "enhanced" | "ollama" | "standard-fallback";
  durationMs: number;
  matchedClientId?: string | null;
  matchedClientName?: string | null;
  clientConfidence?: number | null;
  suggestedClient?: AiSuggestedClient | null;
  currency?: Currency | null;
  dueDate?: string | null;
  deliveryUrl?: string | null;
  notes?: string | null;
  items: AiExtractedDeliverable[];
  detectedIntent: AiCaptureIntent;
  intentConfidence: number;
  intentReason: string;
  warnings: string[];
}

export interface AiPaymentSlipScanInput {
  imageBase64?: string;
  stagedToken?: string;
  expectedAmountCents?: number;
  expectedAdvanceCents?: number;
  expectedCurrency?: Currency;
}

export interface AiPaymentSlipMismatch {
  kind: "underpaid" | "overpaid" | "currency_mismatch";
  message: string;
}

export interface AiPaymentSlipScanResult {
  ocrText: string;
  amount: string | null;
  amountCents: number | null;
  currency: Currency | null;
  paymentDate: string | null;
  reference: string | null;
  bankName: string | null;
  confidence: number;
  durationMs: number;
  matchLabel: string | null;
  mismatch: AiPaymentSlipMismatch | null;
  warnings: string[];
}

export interface AiExpenseReceiptScanInput {
  imageBase64?: string;
  stagedToken?: string;
  text?: string;
}

export interface AiExpenseReceiptScanResult {
  ocrText: string;
  merchant: string | null;
  description: string | null;
  amount: string | null;
  amountCents: number | null;
  currency: Currency | null;
  incurredAt: string | null;
  category: AiExpenseCategory;
  categoryConfidence: number;
  categorySource: "neural" | "heuristic";
  durationMs: number;
  warnings: string[];
}
