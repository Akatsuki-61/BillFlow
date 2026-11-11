import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { initDatabase, closeDatabaseForTesting, getDb } from "../db";
import { clients } from "../db/schema";
import { createInvoice, listInvoicesWithClient } from "../ipc/invoices";
import { createTask, listTasks, updateTask } from "../ipc/tasks";
import { updateSettings } from "../ipc/settings";
import {
  isTaskEligibleForInvoicing,
  filterUnbilledCompletedTasks,
} from "../../src/lib/data/DataProvider";
import { getInvoiceLinkPalette } from "../../src/components/tasks/TasksView";

let directory: string;
let databasePath: string;
let pdfDirectory: string;

const defaultAssignee = {
  name: "Chethaka",
  avatarLetter: "C",
  bgColor: "bg-surface-purple-100",
  textColor: "text-content-purple-700",
};

function createClient(input: {
  name: string;
  email: string;
  currency: "USD" | "LKR" | "EUR";
}) {
  const id = crypto.randomUUID();
  getDb()
    .insert(clients)
    .values({
      id,
      name: input.name,
      email: input.email,
      contactPerson: input.name,
      currency: input.currency,
      category: "Enterprise",
    })
    .run();
  return { id, ...input };
}

beforeEach(() => {
  closeDatabaseForTesting();
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "billflow-task-to-inv-"));
  databasePath = path.join(directory, "billflow.db");
  pdfDirectory = path.join(directory, "pdfs");
  fs.mkdirSync(pdfDirectory, { recursive: true });

  initDatabase(databasePath);
  updateSettings({
    businessName: "Chethaka Studio",
    defaultCurrency: "USD",
    pdfExportDirectory: pdfDirectory,
  });
});

afterEach(() => {
  closeDatabaseForTesting();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("Task-to-Invoice Workflow & Synchronized Card Link Highlighting", () => {
  it("identifies only unbilled completed tasks and filters by client", () => {
    const clientA = createClient({
      name: "Acme Cloud",
      email: "billing@acme.io",
      currency: "USD",
    });
    const clientB = createClient({
      name: "Vertex AI Labs",
      email: "finance@vertex.io",
      currency: "USD",
    });

    const doneTaskA = createTask({
      id: "tsk-done-acme",
      title: "API Gateway Hardening",
      description: "Completed OAuth2 and rate limiting",
      status: "done",
      priority: "high",
      category: "Development",
      assignee: defaultAssignee,
      dueDate: "2026-11-10",
      clientId: clientA.id,
      subtasks: [],
    });

    const inProgressTaskA = createTask({
      id: "tsk-wip-acme",
      title: "Dashboard Telemetry",
      description: "Still in progress",
      status: "in-progress",
      priority: "medium",
      category: "Development",
      assignee: defaultAssignee,
      dueDate: "2026-11-12",
      clientId: clientA.id,
      subtasks: [],
    });

    const doneTaskB = createTask({
      id: "tsk-done-vertex",
      title: "Design System Audit",
      description: "Completed token audit",
      status: "done",
      priority: "medium",
      category: "Design",
      assignee: defaultAssignee,
      dueDate: "2026-11-11",
      clientId: clientB.id,
      subtasks: [],
    });

    const allTasks = listTasks();
    expect(isTaskEligibleForInvoicing(doneTaskA)).toBe(true);
    expect(isTaskEligibleForInvoicing(inProgressTaskA)).toBe(false);

    // Filter for Client A only
    const eligibleForA = filterUnbilledCompletedTasks(allTasks, {
      clientId: clientA.id,
    });
    expect(eligibleForA.map((t) => t.id)).toEqual([doneTaskA.id]);

    // Include all clients
    const eligibleAll = filterUnbilledCompletedTasks(allTasks, {
      includeAllClients: true,
    });
    expect(eligibleAll.map((t) => t.id).sort()).toEqual(
      [doneTaskA.id, doneTaskB.id].sort(),
    );
  });

  it("atomically links imported tasks to the created invoice and prevents duplicate invoicing", () => {
    const client = createClient({
      name: "Nova FinTech",
      email: "accounts@novafintech.com",
      currency: "USD",
    });

    const task1 = createTask({
      id: "tsk-nova-1",
      title: "Stripe Webhook Integration",
      description: "Idempotent webhook processor",
      status: "done",
      priority: "urgent",
      category: "Development",
      assignee: defaultAssignee,
      dueDate: "2026-11-08",
      clientId: client.id,
      outsourceBudgetCents: 120000,
      subtasks: [
        { id: "sub-1", title: "Signature verification", completed: true },
      ],
    });

    const task2 = createTask({
      id: "tsk-nova-2",
      title: "Ledger Reconciliation Script",
      description: "Automated nightly ledger check",
      status: "done",
      priority: "high",
      category: "Infrastructure",
      assignee: defaultAssignee,
      dueDate: "2026-11-09",
      clientId: client.id,
      outsourceBudgetCents: 80000,
      subtasks: [],
    });

    // Create invoice importing both tasks as line items
    const createdInvoice = createInvoice({
      clientId: client.id,
      code: "INV-2026-900",
      currency: "USD",
      amountCents: 200000,
      items: [
        {
          sourceTaskId: task1.id,
          description: task1.title,
          quantity: 1,
          unitPriceCents: 120000,
        },
        {
          sourceTaskId: task2.id,
          description: task2.title,
          quantity: 1,
          unitPriceCents: 80000,
        },
      ],
      linkedTaskIds: [task1.id, task2.id],
    });

    expect(createdInvoice.code).toBe("INV-2026-900");
    expect(createdInvoice.items).toHaveLength(2);

    // Verify tasks in SQLite now have invoiceId, invoiceItemId, and invoiceCode populated
    const updatedTasks = listTasks();
    const linked1 = updatedTasks.find((t) => t.id === task1.id)!;
    const linked2 = updatedTasks.find((t) => t.id === task2.id)!;

    expect(linked1.invoiceId).toBe(createdInvoice.id);
    expect(linked1.invoiceCode).toBe("INV-2026-900");
    expect(linked1.invoiceItemId).toBe(createdInvoice.items![0].id);

    expect(linked2.invoiceId).toBe(createdInvoice.id);
    expect(linked2.invoiceCode).toBe("INV-2026-900");
    expect(linked2.invoiceItemId).toBe(createdInvoice.items![1].id);

    // Guardrail: Billed tasks must no longer appear in unbilled completed task queries
    const remainingUnbilled = filterUnbilledCompletedTasks(updatedTasks, {
      includeAllClients: true,
    });
    expect(remainingUnbilled).toHaveLength(0);
  });

  it("supports direct updateTask linking and deterministic hover accent palettes", () => {
    const client = createClient({
      name: "Orbit Media",
      email: "hello@orbit.media",
      currency: "USD",
    });

    const task = createTask({
      id: "tsk-orbit-1",
      title: "Brand Motion Guidelines",
      description: "Microinteraction specs",
      status: "done",
      priority: "medium",
      category: "Design",
      assignee: defaultAssignee,
      dueDate: "2026-11-09",
      clientId: client.id,
      subtasks: [],
    });

    const inv = createInvoice({
      clientId: client.id,
      code: "INV-2026-901",
      currency: "USD",
      amountCents: 50000,
      items: [
        {
          description: "Brand Motion Guidelines",
          quantity: 1,
          unitPriceCents: 50000,
        },
      ],
    });

    const patched = updateTask(task.id, { invoiceId: inv.id });
    expect(patched.invoiceId).toBe(inv.id);
    expect(patched.invoiceCode).toBe("INV-2026-901");
    expect(listInvoicesWithClient()).toHaveLength(1);

    // Deterministic palette for synchronized hover highlighting
    const paletteA = getInvoiceLinkPalette("INV-2026-901");
    const paletteB = getInvoiceLinkPalette("INV-2026-901");
    expect(paletteA).toEqual(paletteB);
    expect(["emerald", "indigo", "amber", "teal", "violet"]).toContain(
      paletteA.name,
    );
  });
});
