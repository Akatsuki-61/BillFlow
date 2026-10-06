import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { eq } from "drizzle-orm";
import { initDatabase, closeDatabaseForTesting, getDb } from "../db";
import { invoiceItems } from "../db/schema";
import { createInvoice, recordPayment, exportInvoicePdf, listInvoicesWithClient } from "../ipc/invoices";
import { pendingTracking, decideTracking, listTasks, updateTask } from "../ipc/tasks";
import { copyReceipt, listAttachments } from "../ipc/files";
import { updateSettings } from "../ipc/settings";

let directory: string;
let databasePath: string;
let pdfDirectory: string;

beforeEach(() => {
  closeDatabaseForTesting();
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "billflow-direct-loop-"));
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

describe("October 10 Demonstration: Chethaka direct-work loop", () => {
  it("completes full workflow: itemized invoice -> vector PDF -> advance payment -> task tracking -> completion -> final payment -> restart", async () => {
    // 1. Create itemized invoice with 2 deliverables in LKR
    // Business website (80,000) + AI consulting (20,000) - Discount (10,000) = 90,000 LKR total
    // Required advance: 50% = 45,000 LKR
    const createInput = {
      requestId: crypto.randomUUID(),
      newClient: {
        name: "Enterprise Client Ltd",
        email: "client@enterprise.com",
        currency: "LKR" as const,
        contactPerson: "Jane Smith",
      },
      code: "INV-2026-001",
      items: [
        {
          description: "Business website development",
          quantity: 1,
          unitPriceCents: 8000000, // 80,000 LKR
        },
        {
          description: "AI consulting session and customer-support automation recommendations",
          quantity: 1,
          unitPriceCents: 2000000, // 20,000 LKR
        },
      ],
      amountCents: 9000000, // 90,000 LKR
      discountCents: 1000000, // 10,000 LKR
      advanceCents: 4500000, // 45,000 LKR
      currency: "LKR" as const,
      deliveryUrl: "https://drive.google.com/drive/folders/chethaka-delivery-123",
      notes: "Please transfer the 50% advance before project kickoff.",
    };

    const created = createInvoice(createInput);
    expect(created.code).toBe("INV-2026-001");
    expect(created.amountCents).toBe(9000000);
    expect(created.advanceCents).toBe(4500000);
    expect(created.status).toBe("UNPAID");
    expect(created.paidCents).toBe(0);

    // Verify line items persisted in SQLite
    const db = getDb();
    const storedItems = db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, created.id)).all();
    expect(storedItems).toHaveLength(2);
    expect(storedItems[0].description).toBe("Business website development");
    expect(storedItems[0].unitPriceCents).toBe(8000000);
    expect(storedItems[1].description).toBe("AI consulting session and customer-support automation recommendations");
    expect(storedItems[1].unitPriceCents).toBe(2000000);

    // 2. Export vector A4 PDF to disk
    const pdfPath = await exportInvoicePdf(created.id);
    expect(typeof pdfPath).toBe("string");
    expect(fs.existsSync(pdfPath)).toBe(true);
    const pdfBytes = fs.readFileSync(pdfPath);
    expect(pdfBytes.length).toBeGreaterThan(1000);
    // PDF header magic bytes
    expect(pdfBytes.slice(0, 5).toString()).toBe("%PDF-");

    // 3. Record advance payment of 45,000 LKR (4,500,000 cents)
    const paymentResult = recordPayment({
      invoiceId: created.id,
      amountCents: 4500000,
      currency: "LKR",
      reference: "SLIP-ADVANCE-001",
      requestId: crypto.randomUUID(),
    });

    expect(paymentResult.invoice.status).toBe("ADVANCE_PAID");
    expect(paymentResult.invoice.paidCents).toBe(4500000);

    // Attach receipt slip to this advance payment
    const dummyReceiptPath = path.join(directory, "bank-slip.png");
    // 1x1 transparent PNG bytes
    const pngBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );
    fs.writeFileSync(dummyReceiptPath, pngBytes);

    const attachmentId = crypto.randomUUID();
    const attachment = copyReceipt(
      { type: "payment", id: paymentResult.payment.id },
      dummyReceiptPath,
      attachmentId,
    );
    expect(attachment.originalName).toBe("bank-slip.png");
    const attachedList = listAttachments({ type: "payment", id: paymentResult.payment.id });
    expect(attachedList).toHaveLength(1);
    expect(attachedList[0].id).toBe(attachmentId);

    // 4. Verify tracking offer triggers automatically
    const pendingOffers = pendingTracking();
    expect(pendingOffers).toHaveLength(1);
    expect(pendingOffers[0].invoiceId).toBe(created.id);
    expect(pendingOffers[0].advanceCents).toBe(4500000);
    expect(pendingOffers[0].receivedCents).toBe(4500000);

    // 5. User accepts tracking ("yes")
    const decision = decideTracking(created.id, "yes");
    expect(decision.choice).toBe("yes");
    expect(decision.taskIds).toHaveLength(2);

    // Verify 2 linked tasks were created in Tasks board
    const currentTasks = listTasks();
    expect(currentTasks).toHaveLength(2);
    const taskTitles = currentTasks.map((t) => t.title);
    expect(taskTitles).toContain("Business website development");
    expect(taskTitles).toContain("AI consulting session and customer-support automation recommendations");

    for (const t of currentTasks) {
      expect(t.status).toBe("todo");
      expect(t.deliveryUrl).toBe("https://drive.google.com/drive/folders/chethaka-delivery-123");
    }

    // Retrying tracking decision is idempotent (never duplicates tasks)
    const secondDecision = decideTracking(created.id, "yes");
    expect(secondDecision.taskIds).toHaveLength(2);
    expect(listTasks()).toHaveLength(2);

    // 6. Complete the tasks
    updateTask(currentTasks[0].id, { status: "in-progress" });
    updateTask(currentTasks[0].id, { status: "done" });
    updateTask(currentTasks[1].id, { status: "in-progress" });
    updateTask(currentTasks[1].id, { status: "done" });

    // Finishing tasks does NOT prematurely mark invoice as PAID
    const invoiceMidway = listInvoicesWithClient().find((i) => i.id === created.id)!;
    expect(invoiceMidway.status).toBe("ADVANCE_PAID");

    // 7. Record remaining payment of 45,000 LKR (4,500,000 cents)
    const finalPayment = recordPayment({
      invoiceId: created.id,
      amountCents: 4500000,
      currency: "LKR",
      reference: "SLIP-FINAL-002",
      requestId: crypto.randomUUID(),
    });

    expect(finalPayment.invoice.status).toBe("PAID");
    expect(finalPayment.invoice.paidCents).toBe(9000000);

    // 8. App restart / persistence check
    restart();

    // Verify records survive restart
    const invoicesAfterRestart = listInvoicesWithClient();
    expect(invoicesAfterRestart).toHaveLength(1);
    const reloadedInvoice = invoicesAfterRestart[0];
    expect(reloadedInvoice.id).toBe(created.id);
    expect(reloadedInvoice.status).toBe("PAID");
    expect(reloadedInvoice.paidCents).toBe(9000000);
    expect(reloadedInvoice.amountCents).toBe(9000000);
    expect(reloadedInvoice.advanceCents).toBe(4500000);
    expect(reloadedInvoice.items).toHaveLength(2);
    expect(reloadedInvoice.payments).toHaveLength(2);

    const tasksAfterRestart = listTasks();
    expect(tasksAfterRestart).toHaveLength(2);
    expect(tasksAfterRestart.every((t) => t.status === "done")).toBe(true);

    const reloadedAttachments = listAttachments({ type: "payment", id: paymentResult.payment.id });
    expect(reloadedAttachments).toHaveLength(1);
    expect(reloadedAttachments[0].originalName).toBe("bank-slip.png");
  });
});
