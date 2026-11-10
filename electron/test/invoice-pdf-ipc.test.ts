import { afterEach, beforeEach, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { ipcMain } from "electron";
import { closeDatabaseForTesting, initDatabase } from "../db";
import { createInvoice, registerInvoiceHandlers } from "../ipc/invoices";
import { updateSettings } from "../ipc/settings";
import { buildInvoiceHtml } from "../pdf-generator";

vi.mock("electron", () => ({ app: undefined, ipcMain: { handle: vi.fn() } }));

let directory: string;
beforeEach(() => {
  closeDatabaseForTesting();
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "billflow-pdf-ipc-"));
  initDatabase(path.join(directory, "billflow.db"));
  updateSettings({ pdfExportDirectory: directory });
});
afterEach(() => {
  closeDatabaseForTesting();
  vi.clearAllMocks();
  fs.rmSync(directory, { recursive: true, force: true });
});

it("returns the PDF result promised by the preload API", async () => {
  const invoice = createInvoice({
    requestId: randomUUID(), code: "PDF-001", currency: "LKR", amountCents: 100000,
    newClient: { name: "Website client", contactPerson: "Client", email: "client@example.com", currency: "LKR" },
    items: [{ description: "AI consulting", quantity: 1, unitPriceCents: 100000 }],
  });
  registerInvoiceHandlers(() => {});
  const handler = vi.mocked(ipcMain.handle).mock.calls.find(([channel]) => channel === "invoices:exportPdf")![1];
  const result = await handler({} as Electron.IpcMainInvokeEvent, invoice.id);
  expect(result).toMatchObject({ success: true, filePath: expect.any(String) });
  expect(fs.readFileSync(result.filePath).subarray(0, 5).toString()).toBe("%PDF-");
});

it("renders both Geometric Teal and Executive Wave templates correctly", () => {
  const payload = {
    code: "INV-2026-001",
    issueDate: "2026-11-04",
    dueDate: "2026-11-18",
    currency: "USD",
    status: "UNPAID",
    amountCents: 150000,
    items: [{ description: "Full-Stack Development", quantity: 1, unitPriceCents: 150000 }],
    client: { name: "Acme Corp", email: "acme@example.com" },
    business: { businessName: "Chethaka Lakshitha", professionalTitle: "Software Consultant" },
  };

  const tealHtml = buildInvoiceHtml({ ...payload, template: "geometric-teal" });
  expect(tealHtml).toContain("top-left-svg");
  expect(tealHtml).toContain("INVOICE");

  const waveHtml = buildInvoiceHtml({ ...payload, template: "executive-wave" });
  expect(waveHtml).toContain("wave-header");
  expect(waveHtml).toContain("grand-total-banner");
  expect(waveHtml).toContain("th-gold");
});

it("supports setting defaultInvoiceTemplate in settings", () => {
  const updated = updateSettings({ defaultInvoiceTemplate: "executive-wave" });
  expect(updated.defaultInvoiceTemplate).toBe("executive-wave");
});
