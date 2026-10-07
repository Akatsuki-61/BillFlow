import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { initDatabase, closeDatabaseForTesting } from "../db";
import { listExpenses, createExpense, updateExpense, removeExpense } from "../ipc/expenses";
import { copyReceipt, listAttachments } from "../ipc/files";

let directory: string;
let databasePath: string;

beforeEach(() => {
  closeDatabaseForTesting();
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "billflow-expenses-test-"));
  databasePath = path.join(directory, "billflow.db");
  initDatabase(databasePath);
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

describe("Expenses SQLite Ledger & API", () => {
  it("creates, reads, updates, attaches receipts, and removes expenses with restart persistence", () => {
    // 1. Create expenses
    const exp1 = createExpense({
      merchant: "Adobe Creative Cloud",
      description: "Creative Cloud Subscription",
      category: "SOFTWARE",
      amountCents: 5499,
      currency: "USD",
      incurredAt: "2026-10-06",
      deductible: true,
    });

    const exp2 = createExpense({
      merchant: "Vercel Inc.",
      description: "Pro Team Hosting",
      category: "HOSTING",
      amountCents: 2000,
      currency: "USD",
      incurredAt: "2026-10-05",
      deductible: true,
    });

    expect(exp1.merchant).toBe("Adobe Creative Cloud");
    expect(exp1.amountCents).toBe(5499);
    expect(exp1.deductible).toBe(true);

    const initialList = listExpenses();
    expect(initialList).toHaveLength(2);

    // 2. Attach receipt to exp1
    const dummyReceiptPath = path.join(directory, "adobe_receipt.pdf");
    const pdfContent = Buffer.from("%PDF-1.4 dummy receipt content for testing");
    fs.writeFileSync(dummyReceiptPath, pdfContent);

    const attachmentId = crypto.randomUUID();
    const att = copyReceipt({ type: "expense", id: exp1.id }, dummyReceiptPath, attachmentId);
    expect(att.originalName).toBe("adobe_receipt.pdf");

    const attsList = listAttachments({ type: "expense", id: exp1.id });
    expect(attsList).toHaveLength(1);
    expect(attsList[0].id).toBe(attachmentId);

    // 3. Update expense deductible & description
    const updated = updateExpense(exp1.id, { deductible: false, description: "Updated Adobe Subscription" });
    expect(updated.deductible).toBe(false);
    expect(updated.description).toBe("Updated Adobe Subscription");

    // 4. Test filtering
    const softwareOnly = listExpenses({ category: "SOFTWARE" });
    expect(softwareOnly).toHaveLength(1);
    expect(softwareOnly[0].merchant).toBe("Adobe Creative Cloud");

    // 5. Restart app / DB connection to verify desktop persistence
    restart();

    const afterRestartList = listExpenses();
    expect(afterRestartList).toHaveLength(2);
    const reloadedExp1 = afterRestartList.find(e => e.id === exp1.id)!;
    expect(reloadedExp1.merchant).toBe("Adobe Creative Cloud");
    expect(reloadedExp1.deductible).toBe(false);
    expect(reloadedExp1.attachments).toHaveLength(1);
    expect(reloadedExp1.attachments![0].originalName).toBe("adobe_receipt.pdf");

    // 6. Delete an expense
    removeExpense(exp2.id);
    const listAfterDelete = listExpenses();
    expect(listAfterDelete).toHaveLength(1);
    expect(listAfterDelete[0].id).toBe(exp1.id);
  });
});
