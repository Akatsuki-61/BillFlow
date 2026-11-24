import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { closeDatabaseForTesting, getDb, initDatabase } from "../db";
import { catalogItems, clients } from "../db/schema";
import { extractInvoiceFromMessage, disposeAiResources } from "../ipc/ai";
import { getAiStatus, setAiTier } from "../ai/config";
import { extractJsonObjectFromReply } from "../ai/llm-enhanced";

vi.mock("electron", () => ({
  app: undefined,
  BrowserWindow: vi.fn(),
  ipcMain: { handle: vi.fn(), on: vi.fn() },
}));

let dir: string;

beforeEach(() => {
  closeDatabaseForTesting();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "billflow-ai-"));
  initDatabase(path.join(dir, "billflow.db"));

  getDb()
    .insert(clients)
    .values({
      id: "cli-1",
      name: "Kandy Roasters",
      contactPerson: "Nimal Jayawardena",
      email: "nimal@kandyroasters.lk",
      phone: "+94 77 555 0101",
      whatsappPhone: "+94775550101",
      currency: "USD",
      driveUrl: "https://drive.google.com/drive/folders/kandy-roasters",
    })
    .run();

  getDb()
    .insert(catalogItems)
    .values([
      {
        id: "cat-1",
        title: "E-Commerce Checkout Integration",
        category: "Development",
        sku: "DEV-CHK",
        description: "Stripe and PayHere checkout payment gateway setup",
        priceCents: 30000,
        currency: "USD",
        unit: "service",
        iconType: "code",
      },
      {
        id: "cat-2",
        title: "Brand Logo Refresh",
        category: "Design",
        sku: "DES-LOG",
        description: "Modern vector logo redesign and brand color palette",
        priceCents: 15000,
        currency: "USD",
        unit: "project",
        iconType: "design",
      },
    ])
    .run();
});

afterEach(async () => {
  await disposeAiResources();
  closeDatabaseForTesting();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("Local AI Tiered Extraction Pipeline", () => {
  it("reports bundled Standard tier ready and blocks Enhanced mode before download", () => {
    const status = getAiStatus();
    expect(status.activeTier).toBe("standard");
    expect(status.ocrReady).toBe(true);
    expect(status.standardModelReady).toBe(true);
    expect(status.enhancedModelDownloaded).toBe(false);

    expect(() => setAiTier("enhanced")).toThrow(/Download/i);
  });

  it("extracts invoice items from text and semantically matches Service Catalog with MiniLM", async () => {
    const draft = await extractInvoiceFromMessage({
      text: `
        From: Nimal Jayawardena <nimal@kandyroasters.lk>
        Hi Chethaka,
        Please help us with:
        1. Set up online checkout payment gateway
        2. Redesign our company brand logo
        Need this before 2026-12-15.
      `,
    });

    expect(draft.sourceKind).toBe("text");
    expect(draft.engineUsed).toBe("standard");
    expect(draft.matchedClientId).toBe("cli-1");
    expect(draft.currency).toBe("USD");
    expect(draft.dueDate).toBe("2026-12-15");
    expect(draft.items.length).toBe(2);

    const checkoutItem = draft.items.find((i) =>
      i.description.toLowerCase().includes("checkout"),
    );
    const logoItem = draft.items.find((i) =>
      i.description.toLowerCase().includes("logo"),
    );
    expect(checkoutItem?.catalogId).toBe("cat-1");
    expect(checkoutItem?.unitPrice).toBe("300.00");
    expect(checkoutItem?.priceSource).toBe("catalog");
    expect(logoItem?.catalogId).toBe("cat-2");
    expect(logoItem?.unitPrice).toBe("150.00");
  }, 30_000);

  it("runs offline Tesseract OCR on a pasted PNG screenshot and parses deliverables", async () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="900" height="320">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <text x="36" y="72" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#111111">From: nimal@kandyroasters.lk</text>
        <text x="36" y="132" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#111111">1. Brand logo redesign</text>
        <text x="36" y="192" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#111111">2. Online checkout payment setup</text>
        <text x="36" y="252" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#111111">Due: 2026-12-20</text>
      </svg>
    `;
    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    const dataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;

    const draft = await extractInvoiceFromMessage({ imageBase64: dataUrl });

    expect(draft.sourceKind).toBe("image");
    expect(draft.ocrText).toBeTruthy();
    expect(draft.matchedClientId).toBe("cli-1");
    expect(draft.dueDate).toBe("2026-12-20");
    expect(draft.items.length).toBeGreaterThanOrEqual(2);
  }, 30_000);

  it("parses fenced JSON safely from Enhanced LLM output", () => {
    const reply =
      'Here is the JSON:\n```json\n{"clientName":"Acme","currency":"USD","deliverables":[{"description":"Landing page","quantity":1,"unitPrice":350}],"notes":null}\n```';
    expect(extractJsonObjectFromReply(reply)).toEqual({
      clientName: "Acme",
      currency: "USD",
      deliverables: [
        { description: "Landing page", quantity: 1, unitPrice: 350 },
      ],
      notes: null,
    });
  });
});
