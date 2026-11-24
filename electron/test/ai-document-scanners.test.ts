import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { closeDatabaseForTesting, initDatabase } from "../db";
import {
  detectCaptureIntentHeuristically,
  extractDocumentDate,
  parseBankTransferSlip,
  parseExpenseReceiptDeterministically,
} from "../ai/document-parsers";
import {
  disposeAiResources,
  extractInvoiceFromMessage,
  scanExpenseReceipt,
  scanPaymentSlip,
} from "../ipc/ai";

vi.mock("electron", () => ({
  app: undefined,
  BrowserWindow: vi.fn(),
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  shell: { openPath: vi.fn(async () => ""), showItemInFolder: vi.fn() },
}));

let dir: string;

beforeEach(() => {
  closeDatabaseForTesting();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "billflow-ai-docs-"));
  initDatabase(path.join(dir, "billflow.db"));
});

afterEach(async () => {
  await disposeAiResources();
  closeDatabaseForTesting();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("AI document parsers & scanners", () => {
  it("parses Sri Lankan & international bank slips and detects advance match or mismatch", () => {
    const slipText = `
      Commercial Bank of Ceylon PLC
      CEFT Online Fund Transfer Receipt
      Transaction Date: 25/11/2026
      Reference No: FT2632988412
      Transfer Amount: LKR 42,500.00
      Status: Successful
    `;

    const matched = parseBankTransferSlip(slipText, {
      expectedAmountCents: 8500000,
      expectedAdvanceCents: 4250000,
      expectedCurrency: "LKR",
    });

    expect(matched.bankName).toBe("Commercial Bank");
    expect(matched.amount).toBe("42500.00");
    expect(matched.amountCents).toBe(4250000);
    expect(matched.currency).toBe("LKR");
    expect(matched.paymentDate).toBe("2026-11-25");
    expect(matched.reference).toBe("FT2632988412");
    expect(matched.matchLabel).toMatch(/advance/i);
    expect(matched.mismatch).toBeNull();

    const underpaid = parseBankTransferSlip(slipText, {
      expectedAmountCents: 10000000,
      expectedAdvanceCents: 5000000,
      expectedCurrency: "LKR",
    });
    expect(underpaid.mismatch?.kind).toBe("underpaid");

    const wrongCurrency = parseBankTransferSlip(slipText, {
      expectedAmountCents: 42500,
      expectedCurrency: "USD",
    });
    expect(wrongCurrency.mismatch?.kind).toBe("currency_mismatch");
  });

  it("scans a real PNG bank transfer slip offline via Tesseract OCR", async () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="900" height="360">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <text x="36" y="70" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#111111">Sampath Bank Vishwa Transfer</text>
        <text x="36" y="135" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#111111">Transfer Amount: USD 500.00</text>
        <text x="36" y="195" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#111111">Date: 2026-11-24</text>
        <text x="36" y="255" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#111111">Reference No: TXN99482104</text>
      </svg>
    `;
    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    const dataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;

    const result = await scanPaymentSlip({
      imageBase64: dataUrl,
      expectedAmountCents: 50000,
      expectedCurrency: "USD",
    });

    expect(result.bankName).toBe("Sampath Bank");
    expect(result.amountCents).toBe(50000);
    expect(result.paymentDate).toBe("2026-11-24");
    expect(result.reference).toBe("TXN99482104");
    expect(result.matchLabel).toMatch(/remaining/i);
    expect(result.mismatch).toBeNull();
  }, 30_000);

  it("scans and classifies expense receipts via OCR + MiniLM neural categories", async () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="900" height="360">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <text x="36" y="70" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#111111">OpenAI LLC Receipt</text>
        <text x="36" y="135" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#111111">Date: Nov 22, 2026</text>
        <text x="36" y="195" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#111111">API Usage Tokens</text>
        <text x="36" y="255" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#111111">Amount Paid: $42.50</text>
      </svg>
    `;
    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    const dataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;

    const scanned = await scanExpenseReceipt({ imageBase64: dataUrl });
    expect(scanned.merchant).toBe("OpenAI");
    expect(scanned.amount).toBe("42.50");
    expect(scanned.currency).toBe("USD");
    expect(scanned.incurredAt).toBe("2026-11-22");
    expect(scanned.category).toBe("AI INFRASTRUCTURE");

    // Unknown hardware merchant classified neurally by MiniLM
    const neuralHardware = await scanExpenseReceipt({
      text: "Colombo Tech Mart\nMechanical Keyboard RGB + USB-C Dock\nDate: 2026-11-20\nTotal: LKR 28,500.00",
    });
    expect(neuralHardware.merchant).toBe("Colombo Tech Mart");
    expect(neuralHardware.amount).toBe("28500.00");
    expect(neuralHardware.currency).toBe("LKR");
    expect(neuralHardware.category).toBe("HARDWARE");
    expect(neuralHardware.categorySource).toBe("neural");
  }, 30_000);

  it("detects Quote, Tasks, and Invoice capture intents accurately", async () => {
    expect(
      detectCaptureIntentHeuristically(
        "Hi, how much would you charge to build a mobile app and admin panel? Can you send a quote?",
      ).intent,
    ).toBe("quote");

    expect(
      detectCaptureIntentHeuristically(
        "Quick bug fix for the current sprint: header logo overlaps on mobile. Add to the board please.",
      ).intent,
    ).toBe("tasks");

    const quoteDraft = await extractInvoiceFromMessage({
      text: "Hey Chethaka, could you give us a price estimate for redesigning our landing page and integrating PayHere?",
    });
    expect(quoteDraft.detectedIntent).toBe("quote");

    const invoiceDraft = await extractInvoiceFromMessage({
      text: "Approved! Please go ahead and send the invoice for 1. Landing page redesign ($400) so we can transfer the 50% advance.",
    });
    expect(invoiceDraft.detectedIntent).toBe("invoice");

    expect(extractDocumentDate("Paid on 05-Dec-2026")).toBe("2026-12-05");
    expect(
      parseExpenseReceiptDeterministically(
        "Vercel Inc.\nPro Team Hosting\nTotal Paid: $20.00\n2026-11-01",
      ).heuristicCategory,
    ).toBe("HOSTING");
  }, 30_000);
});
