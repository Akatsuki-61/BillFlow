import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { initDatabase, closeDatabaseForTesting, getDb } from "../db";
import { clients } from "../db/schema";
import {
  createInvoice,
  promoteInvoiceClient,
  listInvoicesWithClient,
} from "../ipc/invoices";
import { updateSettings } from "../ipc/settings";

let directory: string;
let databasePath: string;
let pdfDirectory: string;

beforeEach(() => {
  closeDatabaseForTesting();
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "billflow-temp-client-"));
  databasePath = path.join(directory, "billflow.db");
  pdfDirectory = path.join(directory, "pdfs");
  fs.mkdirSync(pdfDirectory, { recursive: true });

  initDatabase(databasePath);
  updateSettings({
    businessName: "Chethaka Freelancing",
    professionalTitle: "Full-Stack & AI Consultant",
    defaultCurrency: "LKR",
    pdfExportDirectory: pdfDirectory,
    paymentDetails: "Bank: Commercial Bank | Account: 1234567890 | Name: Chethaka",
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  closeDatabaseForTesting();
  fs.rmSync(directory, { recursive: true, force: true });
});

function restart() {
  closeDatabaseForTesting();
  initDatabase(databasePath);
}

describe("Temporary Client Workflow & Permanent Promotion", () => {
  it("creates an invoice with a temporary client without polluting the permanent clients directory", () => {
    const db = getDb();
    const beforeClients = db.select().from(clients).all();
    expect(beforeClients.length).toBe(0);

    const inv = createInvoice({
      requestId: crypto.randomUUID(),
      newClient: {
        name: "One-Off Client",
        email: "temp@oneoff.com",
        contactPerson: "Alex Doe",
        currency: "LKR",
        driveUrl: "https://drive.google.com/drive/folders/oneoff123",
      },
      saveAsPermanentClient: false,
      code: "INV-TEMP-001",
      items: [
        {
          description: "Quick Bug Fix & Deployment",
          quantity: 1,
          unitPriceCents: 2500000,
        },
      ],
      amountCents: 2500000,
      currency: "LKR",
      deliveryUrl: "https://drive.google.com/drive/folders/oneoff123",
    });

    expect(inv.clientId).toBeNull();
    expect(inv.clientName).toBe("One-Off Client");
    expect(inv.clientEmail).toBe("temp@oneoff.com");

    // Permanent clients table must still have 0 entries
    const afterClients = db.select().from(clients).all();
    expect(afterClients.length).toBe(0);

    // List invoices resolves the temporary client info from snapshot
    const list = listInvoicesWithClient();
    const found = list.find((i) => i.id === inv.id);
    expect(found).toBeDefined();
    expect(found?.clientId).toBeNull();
    expect(found?.clientName).toBe("One-Off Client");
    expect(found?.clientEmail).toBe("temp@oneoff.com");
  });

  it("promotes a temporary client to permanent directory, updating invoice linkage idempotently", () => {
    const inv = createInvoice({
      requestId: crypto.randomUUID(),
      newClient: {
        name: "Future Retainer Client",
        email: "retainer@future.com",
        contactPerson: "Samantha Ray",
        currency: "LKR",
        driveUrl: "https://drive.google.com/drive/folders/future123",
        category: "Enterprise",
      },
      saveAsPermanentClient: false,
      code: "INV-PROMOTE-001",
      items: [
        {
          description: "Initial AI Consulting Session",
          quantity: 1,
          unitPriceCents: 3000000,
        },
      ],
      amountCents: 3000000,
      currency: "LKR",
    });

    expect(inv.clientId).toBeNull();
    const db = getDb();
    expect(db.select().from(clients).all().length).toBe(0);

    // Promote the client
    const promotedClient = promoteInvoiceClient(inv.id);
    expect(promotedClient).toBeDefined();
    expect(promotedClient.id).toBeTruthy();
    expect(promotedClient.name).toBe("Future Retainer Client");
    expect(promotedClient.email).toBe("retainer@future.com");
    expect(promotedClient.contactPerson).toBe("Samantha Ray");
    expect(promotedClient.currency).toBe("LKR");

    // Check database state
    const allClients = db.select().from(clients).all();
    expect(allClients.length).toBe(1);
    expect(allClients[0].id).toBe(promotedClient.id);

    // Invoice now has clientId linked
    const updatedInvoices = listInvoicesWithClient();
    const updatedInv = updatedInvoices.find((i) => i.id === inv.id);
    expect(updatedInv?.clientId).toBe(promotedClient.id);
    expect(updatedInv?.clientName).toBe("Future Retainer Client");

    // Calling promote again is idempotent and does not create duplicate clients
    const repromoted = promoteInvoiceClient(inv.id);
    expect(repromoted.id).toBe(promotedClient.id);
    expect(db.select().from(clients).all().length).toBe(1);

    // Restart app and verify persistence
    restart();
    const reDb = getDb();
    expect(reDb.select().from(clients).all().length).toBe(1);
    const reInvoices = listInvoicesWithClient();
    const reInv = reInvoices.find((i) => i.id === inv.id);
    expect(reInv?.clientId).toBe(promotedClient.id);
    expect(reInv?.clientName).toBe("Future Retainer Client");
  });
});
