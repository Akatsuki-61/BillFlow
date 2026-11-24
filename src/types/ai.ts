import type { Currency } from "./billing";

export type AiModelTier = "standard" | "enhanced";

export type AiDownloadState = "idle" | "downloading" | "error";

export interface AiStatus {
  activeTier: AiModelTier;
  ocrReady: boolean;
  standardModelReady: boolean;
  enhancedModelDownloaded: boolean;
  enhancedModelId: string;
  enhancedModelLabel: string;
  enhancedModelExpectedBytes: number;
  enhancedModelDiskBytes: number;
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
  engineUsed: "standard" | "enhanced" | "standard-fallback";
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
  warnings: string[];
}
