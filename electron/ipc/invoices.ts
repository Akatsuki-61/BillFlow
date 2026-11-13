import { validateInvoiceAmounts } from "../../src/lib/invoice-math";
import { recordId } from "../workflow-validation";
import { z } from "zod";
import { dialog, BrowserWindow } from "electron";
import { ipcMain } from "../security";

import crypto from "crypto";
import { eq, desc, asc, inArray } from "drizzle-orm";
import { getDb, getSqlite } from "../db";
import { captureWorkspace } from "../workspace-session";
import { atomicWrite } from "../managed-files";
import {
  clients,
  invoices,
  settings,
  catalogItems,
  catalogServices,
  invoiceItems,
  invoicePayments,
  invoicePdfExports,
  tasks,
  workOrders,
  expenses,
} from "../db/schema";
import {
  newInvoiceSchema,
  invoicePatchSchema,
  recordPaymentSchema,
  promoteInvoiceClientSchema,
} from "../validation";
import { getOrCreateSettings } from "./settings";
import { AppError, formatError } from "./errors";
import { saveInvoicePdf } from "./files";
import { generateInvoiceHtmlPdfBuffer } from "../pdf-generator";
import {
  InvoiceWithClient,
  NewInvoiceInput,
  InvoicePatchInput,
  InvoiceStatus,
  Currency,
  RecordPaymentInput,
  InvoicePayment,
} from "../../src/types/billing";

export function getNextInvoiceCode(): string {
  const db = getDb();
  let prefixSetting = "INV-";
  let minSeq = 1;

  try {
    const s = db
      .select()
      .from(settings)
      .where(eq(settings.id, "default"))
      .get();
    if (s) {
      if (s.invoicePrefix) prefixSetting = s.invoicePrefix;
      if (typeof s.nextInvoiceSeq === "number" && s.nextInvoiceSeq > 0) {
        minSeq = s.nextInvoiceSeq;
      }
    }
  } catch {
    // fallback if table query fails
  }

  const currentYear = new Date().getFullYear();
  const activePrefix = prefixSetting.includes("{YYYY}")
    ? prefixSetting.replace("{YYYY}", String(currentYear))
    : prefixSetting.endsWith("-")
      ? `${prefixSetting}${currentYear}-`
      : `${prefixSetting}-${currentYear}-`;

  const allRows = db.select({ code: invoices.code }).from(invoices).all();
  let maxSeq = minSeq - 1;

  for (const row of allRows) {
    if (row.code && row.code.startsWith(activePrefix)) {
      const rest = row.code.slice(activePrefix.length);
      const parsed = parseInt(rest, 10);
      if (!isNaN(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }
  }

  const nextSeq = Math.max(minSeq, maxSeq + 1);
  const padded = String(nextSeq).padStart(3, "0");
  return `${activePrefix}${padded}`;
}

export function listInvoicesWithClient(clientId?: string): InvoiceWithClient[] {
  const db = getDb();
  const allInvoices = db
    .select({
      invoice: invoices,
      clientName: clients.name,
      clientEmail: clients.email,
      clientPhone: clients.phone,
      clientContactPerson: clients.contactPerson,
      clientCategory: clients.category,
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .orderBy(desc(invoices.issueDate), desc(invoices.createdAt))
    .all();

  const filtered = clientId
    ? allInvoices.filter((r) => r.invoice.clientId === clientId)
    : allInvoices;

  const ids = filtered.map((row) => row.invoice.id);
  const allItems = ids.length
    ? db
        .select()
        .from(invoiceItems)
        .where(inArray(invoiceItems.invoiceId, ids))
        .orderBy(asc(invoiceItems.position))
        .all()
    : [];
  const allPayments = ids.length
    ? db
        .select()
        .from(invoicePayments)
        .where(inArray(invoicePayments.invoiceId, ids))
        .orderBy(asc(invoicePayments.receivedAt))
        .all()
    : [];
  const itemMap = new Map<string, typeof allItems>();
  const paymentMap = new Map<string, InvoicePayment[]>();
  for (const item of allItems) {
    const rows = itemMap.get(item.invoiceId) || [];
    rows.push(item);
    itemMap.set(item.invoiceId, rows);
  }
  for (const payment of allPayments) {
    const rows = paymentMap.get(payment.invoiceId) || [];
    rows.push({ ...payment, currency: payment.currency as Currency });
    paymentMap.set(payment.invoiceId, rows);
  }
  return filtered.map((r) => {
    const items = itemMap.get(r.invoice.id) || [];
    const payments = paymentMap.get(r.invoice.id) || [];

    let snapshot: {
      name?: string;
      email?: string;
      phone?: string;
      contactPerson?: string;
      category?: string;
    } | null = null;
    if (r.invoice.clientSnapshot) {
      try {
        snapshot = JSON.parse(r.invoice.clientSnapshot);
      } catch {
        snapshot = null;
      }
    }

    return {
      ...r.invoice,
      currency: r.invoice.currency as Currency,
      status: r.invoice.status as InvoiceStatus,
      clientName: snapshot?.name || r.clientName || "Unknown Client",
      clientEmail: snapshot?.email || r.clientEmail || undefined,
      clientPhone: snapshot?.phone || r.clientPhone || null,
      clientContactPerson:
        snapshot?.contactPerson || r.clientContactPerson || null,
      clientCategory: snapshot?.category || r.clientCategory || null,
      items,
      payments,
    };
  });
}

export async function buildInvoicePdfPayloadAndBuffer(
  invoiceId: string,
  templateOverride?: string,
  draftInput?: NewInvoiceInput,
): Promise<{
  invoice: { code?: string; updatedAt?: string };
  pdfBuffer: Buffer;
}> {
  const profile = getOrCreateSettings();
  const template =
    templateOverride || profile.defaultInvoiceTemplate || "geometric-teal";

  if (invoiceId === "draft-preview") {
    const value = newInvoiceSchema.parse(draftInput);
    validateInvoiceAmounts(value);
    const client = value.clientId
      ? getDb()
          .select()
          .from(clients)
          .where(eq(clients.id, value.clientId))
          .get()
      : value.newClient;
    if (!client)
      throw new AppError(
        "CLIENT_NOT_FOUND",
        "Select a client before exporting this draft.",
      );
    const payload = {
      code: value.code || "DRAFT",
      issueDate: value.issueDate || new Date().toISOString().slice(0, 10),
      dueDate: value.dueDate,
      currency: value.currency,
      status: "DRAFT",
      template,
      items: value.items || [],
      discountCents: value.discountCents,
      taxCents: value.taxCents,
      advanceCents: value.advanceCents,
      amountCents: value.amountCents,
      paidCents: 0,
      deliveryUrl: value.deliveryUrl,
      notes: value.notes,
      client: { name: client.name, email: client.email },
      business: profile,
    };
    return {
      invoice: payload,
      pdfBuffer: await generateInvoiceHtmlPdfBuffer(payload),
    };
  }
  if (invoiceId === "sample-preview") {
    const payload = {
      code: "INV-2026-001",
      issueDate: new Date().toISOString().split("T")[0],
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
      currency: profile.defaultCurrency || "USD",
      status: "ADVANCE_PAID",
      template,
      items: [
        {
          description: "Business Website Development & Integration",
          quantity: 1,
          unitPriceCents: 8000000,
        },
        {
          description: "AI Consulting Session & Support Automation Roadmap",
          quantity: 1,
          unitPriceCents: 2000000,
        },
      ],
      amountCents: 9000000,
      advanceCents: 4500000,
      paidCents: 4500000,
      discountCents: 1000000,
      taxCents: 0,
      deliveryUrl: "https://github.com/Chethaka/acme-web-platform",
      notes:
        "Milestone 1 begins upon advance receipt. Full code and deployment upon final settlement.",
      client: { name: "Acme Cloud Corp", email: "billing@acmecloud.com" },
      business: {
        businessName: profile.businessName,
        professionalTitle: profile.professionalTitle,
        email: profile.email,
        phone: profile.phone,
        taxId: profile.taxId,
        paymentDetails: profile.paymentDetails,
      },
    };
    const pdfBuffer = await generateInvoiceHtmlPdfBuffer(payload);
    return { invoice: payload, pdfBuffer };
  }

  const db = getDb();
  const invoice = db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .get();
  if (!invoice) throw new AppError("NOT_FOUND", "Invoice not found.");

  const client = invoice.clientId
    ? db.select().from(clients).where(eq(clients.id, invoice.clientId)).get()
    : undefined;
  let clientSnapshot: {
    name: string;
    email?: string;
    contactPerson?: string;
    phone?: string;
    driveUrl?: string | null;
  } = {
    name: client?.name || "Client",
    email: client?.email,
  };
  if (invoice.clientSnapshot) {
    try {
      const parsed = JSON.parse(invoice.clientSnapshot) as Record<
        string,
        unknown
      >;
      if (parsed && typeof parsed === "object") {
        clientSnapshot = {
          ...(parsed as Partial<typeof clientSnapshot>),
          name:
            typeof parsed.name === "string" && parsed.name.trim()
              ? parsed.name
              : clientSnapshot.name,
        };
      }
    } catch {
      // Fall back to live client record if legacy snapshot JSON is malformed.
    }
  }

  let businessSnapshot = profile;
  if (invoice.businessSnapshot) {
    try {
      const parsed = JSON.parse(invoice.businessSnapshot);
      if (parsed && typeof parsed === "object") {
        businessSnapshot = parsed;
      }
    } catch {
      // Fall back to live profile if legacy business snapshot JSON is malformed.
    }
  }

  const items = db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId))
    .orderBy(asc(invoiceItems.position))
    .all();

  const pdfBuffer = await generateInvoiceHtmlPdfBuffer({
    code: invoice.code,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    status: invoice.status,
    template,
    items: items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
    })),
    discountCents: invoice.discountCents,
    taxCents: invoice.taxCents,
    advanceCents: invoice.advanceCents,
    amountCents: invoice.amountCents,
    paidCents: invoice.paidCents,
    deliveryUrl: invoice.deliveryUrl,
    notes: invoice.notes,
    client: clientSnapshot,
    business: businessSnapshot,
  });

  return { invoice, pdfBuffer };
}

let exportQueue: Promise<unknown> = Promise.resolve();
export function exportInvoicePdf(
  invoiceId: string,
  template?: string,
): Promise<string> {
  const workspace = captureWorkspace();
  const result = exportQueue
    .catch(() => {})
    .then(async () => {
      workspace.assertCurrent();
      const { invoice, pdfBuffer } = await buildInvoicePdfPayloadAndBuffer(
        invoiceId,
        template,
      );
      workspace.assertCurrent();
      const current = getDb()
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoiceId))
        .get();
      if (invoice.updatedAt && current?.updatedAt !== invoice.updatedAt)
        throw new Error(
          "The invoice changed during PDF generation. Export it again.",
        );
      return saveInvoicePdf(invoiceId, pdfBuffer);
    });
  exportQueue = result;
  return result;
}
const scheduledExports = new Map<string, ReturnType<typeof setTimeout>>();
function scheduleInvoiceExport(id: string) {
  if (getSqlite().inTransaction) return;
  const workspace = captureWorkspace();
  const key = `${workspace.databasePath}:${id}`;
  const previous = scheduledExports.get(key);
  if (previous) clearTimeout(previous);
  scheduledExports.set(
    key,
    setTimeout(() => {
      scheduledExports.delete(key);
      try {
        workspace.assertCurrent();
        void exportInvoicePdf(id).catch((error) => {
          if (!process.env.VITEST)
            console.warn("Invoice PDF export deferred:", error.message);
        });
      } catch {
        /* Switching profiles cancels background exports. */
      }
    }, 100),
  );
}

export async function saveInvoicePdfAs(
  invoiceId: string,
  template?: string,
  draftInput?: NewInvoiceInput,
): Promise<{ success: boolean; canceled?: boolean; filePath?: string }> {
  const workspace = captureWorkspace();
  const { invoice, pdfBuffer } = await buildInvoicePdfPayloadAndBuffer(
    invoiceId,
    template,
    draftInput,
  );
  workspace.assertCurrent();
  const win =
    BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  const defaultName = `Invoice-${(invoice.code || "INV").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
  const options = {
    title: "Save Invoice as PDF",
    defaultPath: defaultName,
    filters: [{ name: "PDF Documents", extensions: ["pdf"] }],
  };
  const result = win
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showSaveDialog(options);

  workspace.assertCurrent();
  if (result.canceled || !result.filePath) {
    return { success: false, canceled: true };
  }

  const chosenPath = result.filePath;
  atomicWrite(chosenPath, pdfBuffer);

  if (invoiceId !== "sample-preview" && invoiceId !== "draft-preview") {
    const db = getDb();
    db.insert(invoicePdfExports)
      .values({
        invoiceId,
        filePath: chosenPath,
        exportedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: invoicePdfExports.invoiceId,
        set: { filePath: chosenPath, exportedAt: new Date().toISOString() },
      })
      .run();
  }

  return { success: true, canceled: false, filePath: chosenPath };
}

export function createInvoice(input: NewInvoiceInput): InvoiceWithClient {
  const value = newInvoiceSchema.parse(input);
  validateInvoiceAmounts(value);
  const { requestId, ...details } = value;
  const requestHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(details))
    .digest("hex");
  const id = requestId || crypto.randomUUID();
  const db = getDb();

  db.transaction((tx) => {
    const existing = tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, id))
      .get();
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new AppError(
          "CONFLICT",
          "This invoice request was already used with different details.",
        );
      }
      return;
    }
    if (
      value.catalogItemId &&
      !tx
        .select()
        .from(catalogItems)
        .where(eq(catalogItems.id, value.catalogItemId))
        .get()
    ) {
      throw new AppError(
        "NOT_FOUND",
        "The selected Catalog item no longer exists.",
      );
    }

    let clientId = value.clientId;
    let client: typeof clients.$inferSelect | undefined;
    let clientSnapshotStr: string | null = null;

    if (value.newClient) {
      if (value.saveAsPermanentClient !== false) {
        clientId = crypto.randomUUID();
        tx.insert(clients)
          .values({ id: clientId, ...value.newClient })
          .run();
        client = tx
          .select()
          .from(clients)
          .where(eq(clients.id, clientId))
          .get();
        clientSnapshotStr = client
          ? JSON.stringify({
              name: client.name,
              email: client.email,
              contactPerson: client.contactPerson,
              phone: client.phone,
              driveUrl: client.driveUrl,
              category: client.category,
              currency: client.currency,
            })
          : null;
      } else {
        // Temporary client: keep clientId null, preserve details in clientSnapshot
        clientId = undefined;
        clientSnapshotStr = JSON.stringify({
          name: value.newClient.name,
          email: value.newClient.email,
          contactPerson: value.newClient.contactPerson || value.newClient.name,
          phone: value.newClient.phone || null,
          driveUrl: value.newClient.driveUrl || null,
          category: value.newClient.category || "Enterprise",
          currency: value.newClient.currency || value.currency,
        });
      }
    } else if (clientId) {
      client = tx.select().from(clients).where(eq(clients.id, clientId)).get();
      if (!client) {
        throw new AppError(
          "CLIENT_NOT_FOUND",
          "The specified client does not exist.",
        );
      }
      clientSnapshotStr = JSON.stringify({
        name: client.name,
        email: client.email,
        contactPerson: client.contactPerson,
        phone: client.phone,
        driveUrl: client.driveUrl,
        category: client.category,
        currency: client.currency,
      });
    } else {
      throw new AppError(
        "CLIENT_NOT_FOUND",
        "The specified client does not exist.",
      );
    }

    const taskIds = [
      ...(value.linkedTaskIds || []),
      ...(value.items || []).flatMap((item) =>
        item.sourceTaskId ? [item.sourceTaskId] : [],
      ),
    ];
    const itemTaskIds = (value.items || []).flatMap((item) =>
      item.sourceTaskId ? [item.sourceTaskId] : [],
    );
    if (
      new Set(itemTaskIds).size !== itemTaskIds.length ||
      new Set(value.linkedTaskIds || []).size !==
        (value.linkedTaskIds || []).length
    )
      throw new AppError(
        "INVALID_TASKS",
        "A task can only be billed once per invoice.",
      );
    for (const taskId of new Set(taskIds)) {
      const task = tx.select().from(tasks).where(eq(tasks.id, taskId)).get();
      if (
        !task ||
        task.deletedAt ||
        task.status !== "done" ||
        task.invoiceId ||
        task.invoiceItemId
      )
        throw new AppError(
          "INVALID_TASKS",
          "Only completed, active, unbilled tasks can be imported.",
        );
      if (
        (task.clientId && task.clientId !== clientId) ||
        (!task.clientId &&
          task.clientName &&
          task.clientName.toLowerCase() !==
            (client?.name || value.newClient?.name || "").toLowerCase()) ||
        task.currency !== value.currency
      )
        throw new AppError(
          "TASK_MISMATCH",
          "Imported tasks must belong to the invoice client and currency.",
        );
      if (
        tx.select().from(workOrders).where(eq(workOrders.taskId, task.id)).get()
      )
        throw new AppError(
          "TASK_MISMATCH",
          "This task is already linked to contractor work.",
        );
    }
    const today = new Date().toISOString().split("T")[0];
    const issueDate = value.issueDate || today;
    const profile = getOrCreateSettings();
    const defaultDue = new Date(`${issueDate}T00:00:00Z`);
    defaultDue.setUTCDate(defaultDue.getUTCDate() + profile.defaultDueDays);
    const dueDate =
      value.dueDate === undefined
        ? defaultDue.toISOString().slice(0, 10)
        : value.dueDate;

    const discountCents = value.discountCents || 0;
    const taxCents = value.taxCents || 0;
    const advanceCents = value.advanceCents || 0;
    const deliveryUrl =
      value.deliveryUrl ||
      client?.driveUrl ||
      value.newClient?.driveUrl ||
      null;
    const notes = value.notes || profile.defaultNotes || null;

    tx.insert(invoices)
      .values({
        id,
        requestHash,
        code: value.code || getNextInvoiceCode(),
        clientId: clientId || null,
        catalogItemId: value.catalogItemId || null,
        title: value.title || null,
        clientSnapshot: clientSnapshotStr,
        businessSnapshot: JSON.stringify(profile),
        deliveryUrl,
        notes,
        discountCents,
        taxCents,
        advanceCents,
        amountCents: value.amountCents,
        currency: value.currency,
        issueDate,
        dueDate,
        status: value.status || "UNPAID",
        paidCents: 0,
      })
      .run();

    if (value.status === "PAID" || value.status === "ADVANCE_PAID")
      settleInvoiceStatus(id, value.status);

    // Persist line items and link any imported tasks atomically
    const resolvedClientName = client?.name || value.newClient?.name || null;
    const nowIso = new Date().toISOString();
    const linkedViaItemTaskIds = new Set<string>();

    if (value.items && value.items.length > 0) {
      for (let i = 0; i < value.items.length; i++) {
        const item = value.items[i];
        const itemId = item.id || crypto.randomUUID();
        const validService = item.catalogId
          ? tx
              .select()
              .from(catalogServices)
              .where(eq(catalogServices.id, item.catalogId))
              .get()
          : undefined;
        tx.insert(invoiceItems)
          .values({
            id: itemId,
            invoiceId: id,
            catalogId: validService ? item.catalogId : null,
            description: item.description,
            quantity: item.quantity || 1,
            unitPriceCents: item.unitPriceCents,
            position: i,
          })
          .run();

        if (item.sourceTaskId) {
          const existingTask = tx
            .select()
            .from(tasks)
            .where(eq(tasks.id, item.sourceTaskId))
            .get();
          if (existingTask && !existingTask.deletedAt) {
            tx.update(tasks)
              .set({
                invoiceId: id,
                invoiceItemId: itemId,
                clientId: existingTask.clientId || clientId || null,
                clientName: existingTask.clientName || resolvedClientName,
                updatedAt: nowIso,
              })
              .where(eq(tasks.id, item.sourceTaskId))
              .run();
            linkedViaItemTaskIds.add(item.sourceTaskId);
          }
        }
      }
    } else if (value.title) {
      // Default line item if title was supplied without items array
      const validService = value.catalogItemId
        ? tx
            .select()
            .from(catalogServices)
            .where(eq(catalogServices.id, value.catalogItemId))
            .get()
        : undefined;
      tx.insert(invoiceItems)
        .values({
          id: crypto.randomUUID(),
          invoiceId: id,
          catalogId: validService ? value.catalogItemId : null,
          description: value.title,
          quantity: 1,
          unitPriceCents: value.amountCents + discountCents - taxCents,
          position: 0,
        })
        .run();
    }

    if (value.linkedTaskIds && value.linkedTaskIds.length > 0) {
      for (const linkedTaskId of value.linkedTaskIds) {
        if (linkedViaItemTaskIds.has(linkedTaskId)) continue;
        const existingTask = tx
          .select()
          .from(tasks)
          .where(eq(tasks.id, linkedTaskId))
          .get();
        if (existingTask && !existingTask.deletedAt) {
          tx.update(tasks)
            .set({
              invoiceId: id,
              clientId: existingTask.clientId || clientId || null,
              clientName: existingTask.clientName || resolvedClientName,
              updatedAt: nowIso,
            })
            .where(eq(tasks.id, linkedTaskId))
            .run();
        }
      }
    }
  });

  // Attempt auto-exporting PDF after invoice is created
  scheduleInvoiceExport(id);

  return listInvoicesWithClient().find((row) => row.id === id)!;
}

export function recordPayment(input: RecordPaymentInput): {
  payment: InvoicePayment;
  invoice: InvoiceWithClient;
} {
  const value = recordPaymentSchema.parse(input);
  const db = getDb();
  const paymentId = value.requestId || crypto.randomUUID();

  let createdPayment: InvoicePayment | undefined;

  db.transaction((tx) => {
    const invoice = tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, value.invoiceId))
      .get();
    if (!invoice) throw new AppError("NOT_FOUND", "Invoice not found.");

    if (value.currency && value.currency !== invoice.currency)
      throw new AppError(
        "CURRENCY_MISMATCH",
        "Payment currency must match the invoice.",
      );
    const previous = tx
      .select()
      .from(invoicePayments)
      .where(eq(invoicePayments.id, paymentId))
      .get();
    if (previous) {
      if (
        previous.invoiceId !== invoice.id ||
        previous.amountCents !== value.amountCents ||
        previous.currency !== invoice.currency ||
        previous.reference !== (value.reference || "") ||
        (value.receivedAt && previous.receivedAt !== value.receivedAt)
      )
        throw new AppError(
          "REQUEST_CONFLICT",
          "This payment request was already used with different details.",
        );
      createdPayment = { ...previous, currency: previous.currency as Currency };
      return;
    }
    const now = new Date().toISOString();
    const receivedAt = value.receivedAt || now;

    tx.insert(invoicePayments)
      .values({
        id: paymentId,
        invoiceId: invoice.id,
        amountCents: value.amountCents,
        currency: invoice.currency,
        receivedAt,
        reference: value.reference || "",
        requestId: paymentId,
      })
      .run();

    // Calculate total received payments
    const allPayments = tx
      .select()
      .from(invoicePayments)
      .where(eq(invoicePayments.invoiceId, invoice.id))
      .all();
    if (allPayments.some((p) => p.currency !== invoice.currency))
      throw new AppError(
        "CURRENCY_MISMATCH",
        "Existing payments have inconsistent currencies. Correct them before recording another payment.",
      );
    const totalPaidCents = allPayments.reduce(
      (sum, p) => sum + p.amountCents,
      0,
    );

    if (!Number.isSafeInteger(totalPaidCents))
      throw new AppError(
        "AMOUNT_OVERFLOW",
        "Total payments exceed the supported amount.",
      );
    let nextStatus: InvoiceStatus = invoice.status as InvoiceStatus;
    if (totalPaidCents >= invoice.amountCents) {
      nextStatus = "PAID";
    } else if (
      invoice.advanceCents > 0 &&
      totalPaidCents >= invoice.advanceCents
    ) {
      nextStatus = "ADVANCE_PAID";
    } else if (totalPaidCents > 0 && invoice.status === "DRAFT") {
      nextStatus = "UNPAID";
    }

    tx.update(invoices)
      .set({
        paidCents: totalPaidCents,
        status: nextStatus,
        updatedAt: now,
      })
      .where(eq(invoices.id, invoice.id))
      .run();

    createdPayment = {
      id: paymentId,
      invoiceId: invoice.id,
      amountCents: value.amountCents,
      currency: invoice.currency as Currency,
      receivedAt,
      reference: value.reference || "",
      requestId: paymentId,
    };
  });

  // Re-export PDF with updated payment details
  scheduleInvoiceExport(value.invoiceId);

  const updatedInvoice = listInvoicesWithClient().find(
    (row) => row.id === value.invoiceId,
  )!;
  return { payment: createdPayment!, invoice: updatedInvoice };
}

export function listPayments(invoiceId: string): InvoicePayment[] {
  const db = getDb();
  return db
    .select()
    .from(invoicePayments)
    .where(eq(invoicePayments.invoiceId, invoiceId))
    .orderBy(asc(invoicePayments.receivedAt))
    .all()
    .map((p) => ({
      ...p,
      currency: p.currency as Currency,
    }));
}

export function promoteInvoiceClient(
  invoiceId: string,
): typeof clients.$inferSelect {
  const db = getDb();
  const invoice = db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .get();
  if (!invoice) throw new AppError("NOT_FOUND", "Invoice not found.");

  if (invoice.clientId) {
    const existing = db
      .select()
      .from(clients)
      .where(eq(clients.id, invoice.clientId))
      .get();
    if (existing) return existing;
  }

  if (!invoice.clientSnapshot) {
    throw new AppError(
      "BAD_REQUEST",
      "Invoice does not contain client details to save.",
    );
  }

  let snapshot: {
    name: string;
    email: string;
    contactPerson?: string;
    phone?: string;
    driveUrl?: string;
    category?: string;
    currency?: Currency;
  };
  try {
    snapshot = JSON.parse(invoice.clientSnapshot);
  } catch {
    throw new AppError(
      "BAD_REQUEST",
      "Failed to parse stored client snapshot.",
    );
  }

  const newClientId = crypto.randomUUID();
  const newClientData = {
    id: newClientId,
    name: snapshot.name || "Client",
    email: snapshot.email || "client@example.com",
    contactPerson: snapshot.contactPerson || snapshot.name || "Client",
    phone: snapshot.phone || null,
    driveUrl: snapshot.driveUrl || invoice.deliveryUrl || null,
    category: snapshot.category || "Enterprise",
    currency: (snapshot.currency || invoice.currency || "USD") as Currency,
  };

  db.transaction((tx) => {
    tx.insert(clients).values(newClientData).run();
    tx.update(invoices)
      .set({
        clientId: newClientId,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(invoices.id, invoiceId))
      .run();
  });

  return db.select().from(clients).where(eq(clients.id, newClientId)).get()!;
}

export function removeInvoice(id: string): { success: boolean } {
  recordId.parse(id);
  const db = getDb();
  return db.transaction((tx) => {
    if (!tx.select().from(invoices).where(eq(invoices.id, id)).get())
      throw new AppError("NOT_FOUND", "Invoice not found.");
    if (
      tx
        .select()
        .from(invoicePayments)
        .where(eq(invoicePayments.invoiceId, id))
        .get()
    )
      throw new AppError(
        "HAS_PAYMENTS",
        "Invoices with recorded payments cannot be deleted. Payment history must be preserved.",
      );
    if (tx.select().from(workOrders).where(eq(workOrders.invoiceId, id)).get())
      throw new AppError(
        "HAS_WORK_ORDERS",
        "Remove unpaid contractor work orders before deleting this invoice. Paid work must be retained.",
      );
    tx.update(tasks)
      .set({
        invoiceId: null,
        invoiceItemId: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tasks.invoiceId, id))
      .run();
    tx.update(expenses)
      .set({ invoiceId: null })
      .where(eq(expenses.invoiceId, id))
      .run();
    tx.delete(invoicePdfExports)
      .where(eq(invoicePdfExports.invoiceId, id))
      .run();
    tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id)).run();
    tx.delete(invoices).where(eq(invoices.id, id)).run();
    return { success: true };
  });
}

const invoiceStatusSchema = z.enum([
  "DRAFT",
  "UNPAID",
  "ADVANCE_PAID",
  "PAID",
  "OVERDUE",
]);
export function settleInvoiceStatus(
  id: string,
  requested: InvoiceStatus,
  recordMissing = true,
): void {
  recordId.parse(id);
  const status = invoiceStatusSchema.parse(requested);
  const db = getDb();
  db.transaction((tx) => {
    const invoice = tx.select().from(invoices).where(eq(invoices.id, id)).get();
    if (!invoice) throw new AppError("NOT_FOUND", "Invoice not found.");
    const payments = tx
      .select()
      .from(invoicePayments)
      .where(eq(invoicePayments.invoiceId, id))
      .all();
    if (payments.some((p) => p.currency !== invoice.currency))
      throw new AppError(
        "CURRENCY_MISMATCH",
        "Existing payments do not match the invoice currency.",
      );
    const paid = payments.reduce((sum, p) => sum + p.amountCents, 0);
    const advance =
      status === "ADVANCE_PAID" && !invoice.advanceCents
        ? Math.round(invoice.amountCents * 0.5)
        : invoice.advanceCents;
    const target =
      recordMissing && status === "PAID"
        ? invoice.amountCents
        : recordMissing && status === "ADVANCE_PAID"
          ? advance
          : paid;
    if (target > paid)
      recordPayment({
        invoiceId: id,
        amountCents: target - paid,
        currency: invoice.currency as Currency,
        reference:
          status === "PAID" ? "Full payment settlement" : "Advance payment",
      });
    const finalPaid = Math.max(paid, target);
    const derived =
      finalPaid >= invoice.amountCents && finalPaid > 0
        ? "PAID"
        : advance > 0 && finalPaid >= advance
          ? "ADVANCE_PAID"
          : status === "PAID" || status === "ADVANCE_PAID"
            ? "UNPAID"
            : status;
    tx.update(invoices)
      .set({
        status: derived,
        advanceCents: advance,
        paidCents: finalPaid,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(invoices.id, id))
      .run();
  });
}

export function registerInvoiceHandlers(broadcastDataChanged: () => void) {
  ipcMain.handle(
    "invoices:list",
    async (_event, filter?: { clientId?: string }) => {
      try {
        return listInvoicesWithClient(filter?.clientId);
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle(
    "invoices:promoteClient",
    async (_event, invoiceId: string) => {
      try {
        const validated = promoteInvoiceClientSchema.parse({ invoiceId });
        const created = promoteInvoiceClient(validated.invoiceId);
        broadcastDataChanged();
        return created;
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle("invoices:nextCode", async () => {
    try {
      return getNextInvoiceCode();
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle("invoices:create", async (_event, input: NewInvoiceInput) => {
    try {
      const created = createInvoice(input);
      broadcastDataChanged();
      return created;
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle(
    "invoices:update",
    async (_event, id: string, patch: InvoicePatchInput) => {
      try {
        const validated = invoicePatchSchema.parse(patch);
        const db = getDb();

        const existing = db
          .select()
          .from(invoices)
          .where(eq(invoices.id, id))
          .get();
        if (!existing) {
          throw new AppError("NOT_FOUND", "Invoice not found.");
        }

        const paymentRows = db
          .select()
          .from(invoicePayments)
          .where(eq(invoicePayments.invoiceId, id))
          .all();
        const newCurrency = validated.currency ?? existing.currency;
        const newClientId = validated.clientId ?? existing.clientId;
        if (newClientId !== existing.clientId && existing.status !== "DRAFT")
          throw new AppError(
            "ISSUED_CLIENT",
            "An issued invoice keeps its original client. Create a new invoice for another client.",
          );
        if (newCurrency !== existing.currency && paymentRows.length)
          throw new AppError(
            "HAS_PAYMENTS",
            "Currency cannot change after payments have been recorded.",
          );
        const linkedTasks = db
          .select()
          .from(tasks)
          .where(eq(tasks.invoiceId, id))
          .all();
        if (
          linkedTasks.length &&
          (newCurrency !== existing.currency ||
            newClientId !== existing.clientId)
        )
          throw new AppError(
            "LINKED_TASKS",
            "Client and currency cannot change while deliverables are linked.",
          );
        if (paymentRows.length && newClientId !== existing.clientId)
          throw new AppError(
            "HAS_PAYMENTS",
            "Client cannot change after payments have been recorded.",
          );
        const oldItems = db
          .select()
          .from(invoiceItems)
          .where(eq(invoiceItems.invoiceId, id))
          .all();
        const newAmount = validated.amountCents ?? existing.amountCents;
        validateInvoiceAmounts({
          amountCents: newAmount,
          discountCents: validated.discountCents ?? existing.discountCents,
          taxCents: validated.taxCents ?? existing.taxCents,
          advanceCents: validated.advanceCents ?? existing.advanceCents,
          items: validated.items ?? oldItems,
        });

        db.transaction((tx) => {
          tx.update(invoices)
            .set({
              code: validated.code ?? existing.code,
              clientId: validated.clientId ?? existing.clientId,
              clientSnapshot:
                newClientId !== existing.clientId && newClientId
                  ? JSON.stringify(
                      tx
                        .select()
                        .from(clients)
                        .where(eq(clients.id, newClientId))
                        .get(),
                    )
                  : existing.clientSnapshot,
              catalogItemId:
                validated.catalogItemId !== undefined
                  ? validated.catalogItemId
                  : existing.catalogItemId,
              title:
                validated.title !== undefined
                  ? validated.title
                  : existing.title,
              discountCents:
                validated.discountCents !== undefined
                  ? validated.discountCents
                  : existing.discountCents,
              taxCents:
                validated.taxCents !== undefined
                  ? validated.taxCents
                  : existing.taxCents,
              advanceCents:
                validated.advanceCents !== undefined
                  ? validated.advanceCents
                  : existing.advanceCents,
              deliveryUrl:
                validated.deliveryUrl !== undefined
                  ? validated.deliveryUrl
                  : existing.deliveryUrl,
              notes:
                validated.notes !== undefined
                  ? validated.notes
                  : existing.notes,
              amountCents: newAmount,
              currency: validated.currency ?? existing.currency,
              dueDate:
                validated.dueDate !== undefined
                  ? validated.dueDate
                  : existing.dueDate,
              status: existing.status,
              paidCents: paymentRows.reduce((sum, p) => sum + p.amountCents, 0),
              updatedAt: new Date().toISOString(),
            })
            .where(eq(invoices.id, id))
            .run();

          if (validated.items) {
            const ids = validated.items.map(
              (item) => item.id || crypto.randomUUID(),
            );
            if (new Set(ids).size !== ids.length)
              throw new AppError(
                "DUPLICATE_ITEM",
                "Invoice item IDs must be unique.",
              );
            oldItems.forEach((item, index) =>
              tx
                .update(invoiceItems)
                .set({ position: -index - 1 })
                .where(eq(invoiceItems.id, item.id))
                .run(),
            );
            for (const item of oldItems)
              if (!ids.includes(item.id)) {
                tx.update(tasks)
                  .set({ invoiceItemId: null })
                  .where(eq(tasks.invoiceItemId, item.id))
                  .run();
                tx.delete(invoiceItems)
                  .where(eq(invoiceItems.id, item.id))
                  .run();
              }
            validated.items.forEach((item, index) => {
              const row = tx
                .select()
                .from(invoiceItems)
                .where(eq(invoiceItems.id, ids[index]))
                .get();
              if (row && row.invoiceId !== id)
                throw new AppError(
                  "ITEM_OWNER",
                  "Invoice item belongs to another invoice.",
                );
              if (
                item.sourceTaskId &&
                !linkedTasks.some((task) => task.id === item.sourceTaskId)
              )
                throw new AppError(
                  "INVALID_TASKS",
                  "Import completed tasks when creating an invoice.",
                );
              const fields = {
                description: item.description,
                quantity: item.quantity,
                unitPriceCents: item.unitPriceCents,
                catalogId: item.catalogId || null,
                position: index,
              };
              if (row)
                tx.update(invoiceItems)
                  .set(fields)
                  .where(eq(invoiceItems.id, row.id))
                  .run();
              else
                tx.insert(invoiceItems)
                  .values({ id: ids[index], invoiceId: id, ...fields })
                  .run();
            });
          }
          settleInvoiceStatus(
            id,
            (validated.status ?? existing.status) as InvoiceStatus,
            validated.status !== undefined &&
              validated.status !== existing.status,
          );
        });

        scheduleInvoiceExport(id);

        broadcastDataChanged();
        const all = listInvoicesWithClient();
        return all.find((inv) => inv.id === id)!;
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle(
    "invoices:setStatus",
    async (_event, id: string, status: InvoiceStatus) => {
      try {
        settleInvoiceStatus(id, status);
        scheduleInvoiceExport(id);

        broadcastDataChanged();
        const all = listInvoicesWithClient();
        return all.find((inv) => inv.id === id)!;
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle("invoices:remove", async (_event, id: string) => {
    try {
      const result = removeInvoice(id);
      broadcastDataChanged();
      return result;
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle(
    "invoices:recordPayment",
    async (_event, input: RecordPaymentInput) => {
      try {
        const result = recordPayment(input);
        broadcastDataChanged();
        return result;
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle("invoices:listPayments", async (_event, invoiceId: string) => {
    try {
      return listPayments(invoiceId);
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle(
    "invoices:exportPdf",
    async (_event, invoiceId: string, template?: string) => {
      try {
        const filePath = await exportInvoicePdf(invoiceId, template);
        return { success: true, filePath };
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle(
    "invoices:savePdfAs",
    async (
      _event,
      invoiceId: string,
      template?: string,
      draft?: NewInvoiceInput,
    ) => {
      try {
        return await saveInvoicePdfAs(invoiceId, template, draft);
      } catch (err) {
        throw formatError(err);
      }
    },
  );
}
