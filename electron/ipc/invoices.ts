import { recordActivity } from "../workspace-activity";
import { localDateKey } from "../../src/lib/visual-metrics";
import { validateInvoiceAmounts } from "../../src/lib/invoice-math";
import { recordId } from "../workflow-validation";
import { z } from "zod";
import { clipboard, dialog, BrowserWindow } from "electron";
import { ipcMain } from "../security";

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { formatCents } from "../../src/lib/format";
import { buildInvoiceWhatsAppMessage } from "../../src/lib/whatsapp";
import { eq, desc, asc, inArray, and, isNull, isNotNull } from "drizzle-orm";
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
  invoicePaymentCorrections,
  invoicePdfExports,
  tasks,
  workOrders,
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
  CorrectPaymentInput,
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

function chunks<T>(values: T[], size = 500): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < values.length; i += size)
    result.push(values.slice(i, i + size));
  return result;
}

const invoiceWithClientSelect = {
  invoice: invoices,
  clientName: clients.name,
  clientEmail: clients.email,
  clientPhone: clients.phone,
  clientWhatsAppPhone: clients.whatsappPhone,
  clientBillingAddress: clients.billingAddress,
  clientContactPerson: clients.contactPerson,
  clientCategory: clients.category,
};

type RawInvoiceClientRow = {
  invoice: typeof invoices.$inferSelect;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  clientWhatsAppPhone: string | null;
  clientBillingAddress: string | null;
  clientContactPerson: string | null;
  clientCategory: string | null;
};

function hydrateInvoices(
  db: ReturnType<typeof getDb>,
  allInvoices: RawInvoiceClientRow[],
): InvoiceWithClient[] {
  if (allInvoices.length === 0) return [];

  const ids = allInvoices.map((row) => row.invoice.id);
  const allItems = chunks(ids).flatMap((batch) =>
    db
      .select()
      .from(invoiceItems)
      .where(inArray(invoiceItems.invoiceId, batch))
      .orderBy(asc(invoiceItems.position))
      .all(),
  );
  const allPayments = readPayments(ids);
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
  return allInvoices.map((r) => {
    const items = itemMap.get(r.invoice.id) || [];
    const payments = paymentMap.get(r.invoice.id) || [];

    let snapshot: {
      name?: string;
      email?: string;
      phone?: string;
      whatsappPhone?: string;
      billingAddress?: string;
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
      clientWhatsAppPhone: r.invoice.clientId
        ? r.clientWhatsAppPhone
        : snapshot?.whatsappPhone,
      clientBillingAddress: snapshot?.billingAddress || r.clientBillingAddress,
      clientContactPerson:
        snapshot?.contactPerson || r.clientContactPerson || null,
      clientCategory: snapshot?.category || r.clientCategory || null,
      items,
      payments,
    };
  });
}

export function getInvoiceWithClient(
  id: string,
  trash = false,
): InvoiceWithClient | null {
  const db = getDb();
  const rows = db
    .select(invoiceWithClientSelect)
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(
      and(
        eq(invoices.id, id),
        trash ? isNotNull(invoices.trashedAt) : isNull(invoices.trashedAt),
      ),
    )
    .limit(1)
    .all();
  return hydrateInvoices(db, rows)[0] ?? null;
}

export function listInvoicesWithClient(
  clientId?: string,
  trash = false,
): InvoiceWithClient[] {
  const db = getDb();
  const allInvoices = db
    .select(invoiceWithClientSelect)
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(
      and(
        trash ? isNotNull(invoices.trashedAt) : isNull(invoices.trashedAt),
        clientId ? eq(invoices.clientId, clientId) : undefined,
      ),
    )
    .orderBy(desc(invoices.issueDate), desc(invoices.createdAt))
    .all();

  return hydrateInvoices(db, allInvoices);
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
      issueDate: value.issueDate || localDateKey(new Date()),
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
      deliveryUrl: value.deliveryUrl || profile.defaultDeliveryUrl,
      paymentUrl: value.paymentUrl,
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
      issueDate: localDateKey(new Date()),
      dueDate: localDateKey(new Date(Date.now() + 14 * 86400000)),
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
      deliveryUrl: "https://github.com/acme-cloud/web-platform",
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
  if (!invoice || invoice.trashedAt)
    throw new AppError("NOT_FOUND", "Active invoice not found.");

  const client = invoice.clientId
    ? db.select().from(clients).where(eq(clients.id, invoice.clientId)).get()
    : undefined;
  let clientSnapshot: {
    billingAddress?: string | null;
    name: string;
    email?: string;
    contactPerson?: string;
    phone?: string;
    driveUrl?: string | null;
  } = {
    name: client?.name || "Client",
    billingAddress: client?.billingAddress,
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
        businessSnapshot = {
          ...parsed,
          signatureData: profile.signatureData,
        };
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
    paymentUrl: invoice.paymentUrl,
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
  recordActivity({
    kind: "pdf-pending",
    recordId: invoiceId,
    label: "Invoice PDF",
    detail: "Waiting to export",
  });
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
      if (
        !current ||
        current.trashedAt ||
        current.updatedAt !== invoice.updatedAt
      )
        throw new Error(
          "The invoice changed during PDF generation. Export it again.",
        );
      const saved = saveInvoicePdf(invoiceId, pdfBuffer);
      recordActivity({
        kind: "pdf-saved",
        recordId: invoiceId,
        label: invoice.code || invoiceId,
        detail: `PDF exported to ${saved}`.slice(0, 500),
      });
      return saved;
    });
  const tracked = result.catch((error) => {
    try {
      workspace.assertCurrent();
      recordActivity({
        kind: "pdf-failed",
        recordId: invoiceId,
        label: "Invoice PDF",
        detail:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "PDF export failed",
      });
    } catch {
      /* The originating profile is no longer active. */
    }
    throw error;
  });
  exportQueue = tracked.then(
    () => undefined,
    () => undefined,
  );
  return tracked;
}
export async function exportInvoiceBatch(idsInput: string[]) {
  const ids = [...new Set(z.array(recordId).min(1).max(200).parse(idsInput))];
  const workspace = captureWorkspace();
  const result = await dialog.showOpenDialog({
    title: "Choose a Folder for Invoice PDFs",
    properties: ["openDirectory", "createDirectory"],
  });
  workspace.assertCurrent();
  const directory = result.filePaths[0];
  if (result.canceled || !directory)
    return { success: false, canceled: true, filePaths: [] };
  const staging = fs.mkdtempSync(path.join(directory, ".billflow-invoices-"));
  const documents: Array<{
    temporary: string;
    filePath: string;
    id: string;
    updatedAt?: string;
  }> = [];
  const published: string[] = [];
  const used = new Set<string>();
  try {
    for (const id of ids) {
      workspace.assertCurrent();
      const { invoice, pdfBuffer } = await buildInvoicePdfPayloadAndBuffer(id);
      workspace.assertCurrent();
      const stem = `Invoice-${(invoice.code ?? id).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
      let filePath = path.join(directory, `${stem}.pdf`);
      for (
        let suffix = 2;
        fs.lstatSync(filePath, { throwIfNoEntry: false }) ||
        used.has(filePath.toLowerCase());
        suffix++
      )
        filePath = path.join(directory, `${stem}-${suffix}.pdf`);
      used.add(filePath.toLowerCase());
      const temporary = path.join(staging, `${documents.length}.pdf`);
      atomicWrite(temporary, pdfBuffer);
      documents.push({ temporary, filePath, id, updatedAt: invoice.updatedAt });
    }
    for (const document of documents) {
      const current = getDb()
        .select()
        .from(invoices)
        .where(eq(invoices.id, document.id))
        .get();
      if (
        !current ||
        current.trashedAt ||
        current.updatedAt !== document.updatedAt
      )
        throw new Error(
          "An invoice changed during PDF generation. Export the selection again.",
        );
      if (fs.lstatSync(document.filePath, { throwIfNoEntry: false }))
        throw new Error(
          "A file appeared in the export folder. Export the selection again.",
        );
    }
    for (const document of documents) {
      fs.renameSync(document.temporary, document.filePath);
      published.push(document.filePath);
    }
    return { success: true, filePaths: published };
  } catch (error) {
    for (const file of published) fs.rmSync(file, { force: true });
    throw error;
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

async function prepareInvoiceShare(invoiceId: string, template?: string) {
  const id = recordId.parse(invoiceId);
  const workspace = captureWorkspace();
  const filePath = await exportInvoicePdf(id, template);
  workspace.assertCurrent();
  const invoice = getInvoiceWithClient(id);
  if (!invoice) throw new AppError("NOT_FOUND", "Active invoice not found.");
  const settings = getOrCreateSettings();
  const balance = Math.max(0, invoice.amountCents - invoice.paidCents);
  const advance = Math.min(
    balance,
    Math.max(0, (invoice.advanceCents ?? 0) - invoice.paidCents),
  );
  clipboard.writeText(
    buildInvoiceWhatsAppMessage({
      clientName: invoice.clientName,
      invoiceCode: invoice.code,
      totalFormatted: formatCents(invoice.amountCents, invoice.currency),
      advanceFormatted: advance ? formatCents(advance, invoice.currency) : null,
      balanceFormatted: formatCents(balance, invoice.currency),
      dueDate: balance ? invoice.dueDate : null,
      businessName: settings.businessName,
      paymentDetails: balance ? settings.paymentDetails : null,
      paymentUrl: balance ? invoice.paymentUrl : null,
    }),
  );
  return { success: true, filePath };
}

const scheduledExports = new Map<string, ReturnType<typeof setTimeout>>();
function scheduleInvoiceExport(id: string) {
  if (getSqlite().inTransaction) return;
  const row = getDb()
    .select({ status: invoices.status, trashedAt: invoices.trashedAt })
    .from(invoices)
    .where(eq(invoices.id, id))
    .get();
  if (!row || row.trashedAt || row.status === "DRAFT") return;
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

  if (invoiceId !== "sample-preview" && invoiceId !== "draft-preview") {
    const current = getDb()
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .get();
    if (
      !current ||
      current.trashedAt ||
      current.updatedAt !== invoice.updatedAt
    )
      throw new Error(
        "The invoice changed during PDF generation. Export it again.",
      );
  }

  const chosenPath = result.filePath.toLowerCase().endsWith(".pdf")
    ? result.filePath
    : `${result.filePath}.pdf`;
  if (fs.existsSync(chosenPath) && fs.lstatSync(chosenPath).isSymbolicLink())
    throw new Error("Cannot overwrite a symbolic link when exporting PDF.");
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

function buildClientSnapshot(client: typeof clients.$inferSelect): string {
  return JSON.stringify({
    name: client.name,
    email: client.email,
    contactPerson: client.contactPerson,
    phone: client.phone,
    whatsappPhone: client.whatsappPhone,
    billingAddress: client.billingAddress,
    driveUrl: client.driveUrl,
    category: client.category,
    currency: client.currency,
  });
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
      if (existing.trashedAt)
        throw new AppError(
          "IN_TRASH",
          "Restore this invoice from Trash before using it.",
        );
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
        clientSnapshotStr = client ? buildClientSnapshot(client) : null;
      } else {
        // Temporary client: keep clientId null, preserve details in clientSnapshot
        clientId = undefined;
        clientSnapshotStr = JSON.stringify({
          name: value.newClient.name,
          email: value.newClient.email,
          contactPerson: value.newClient.contactPerson || value.newClient.name,
          phone: value.newClient.phone || null,
          whatsappPhone: value.newClient.whatsappPhone,
          billingAddress: value.newClient.billingAddress,
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
      clientSnapshotStr = buildClientSnapshot(client);
    } else {
      throw new AppError(
        "CLIENT_NOT_FOUND",
        "The specified client does not exist.",
      );
    }

    if (client?.archivedAt)
      throw new AppError(
        "CLIENT_ARCHIVED",
        "Restore this client before creating a new invoice.",
      );
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
    }
    const today = localDateKey(new Date());
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
      profile.defaultDeliveryUrl ||
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
        businessSnapshot: JSON.stringify({
          ...profile,
          signatureData: undefined,
        }),
        workflowStage: value.workflowStage,
        paymentUrl: value.paymentUrl,
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
    for (const taskId of new Set(taskIds)) {
      tx.update(workOrders)
        .set({ invoiceId: id })
        .where(eq(workOrders.taskId, taskId))
        .run();
    }
  });

  // Attempt auto-exporting PDF after invoice is created
  scheduleInvoiceExport(id);

  return getInvoiceWithClient(id)!;
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
    if (!invoice || invoice.trashedAt)
      throw new AppError("NOT_FOUND", "Active invoice not found.");

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

    refreshInvoiceCollection(tx, invoice, now);

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

  const updatedInvoice = getInvoiceWithClient(value.invoiceId)!;
  return { payment: createdPayment!, invoice: updatedInvoice };
}

function readPayments(invoiceIds: string[]): InvoicePayment[] {
  return chunks(invoiceIds).flatMap((batch) =>
    getDb()
      .select({
        payment: invoicePayments,
        correction: invoicePaymentCorrections,
      })
      .from(invoicePayments)
      .leftJoin(
        invoicePaymentCorrections,
        eq(invoicePaymentCorrections.originalPaymentId, invoicePayments.id),
      )
      .where(inArray(invoicePayments.invoiceId, batch))
      .orderBy(asc(invoicePayments.receivedAt), asc(invoicePayments.id))
      .all()
      .map(({ payment, correction }) => ({
        ...payment,
        currency: payment.currency as Currency,
        ...(correction && { correction }),
      })),
  );
}

export function listPayments(invoiceId: string): InvoicePayment[] {
  return readPayments([recordId.parse(invoiceId)]);
}

type InvoiceTransaction = Parameters<
  Parameters<ReturnType<typeof getDb>["transaction"]>[0]
>[0];
function refreshInvoiceCollection(
  tx: InvoiceTransaction,
  invoice: typeof invoices.$inferSelect,
  now: string,
) {
  const active = listPayments(invoice.id).filter(
    (payment) => !payment.correction,
  );
  if (active.some((payment) => payment.currency !== invoice.currency))
    throw new AppError(
      "CURRENCY_MISMATCH",
      "Existing payments do not match the invoice currency.",
    );
  const total = active.reduce((sum, payment) => sum + payment.amountCents, 0);
  if (!Number.isSafeInteger(total))
    throw new AppError(
      "AMOUNT_OVERFLOW",
      "Total payments exceed the supported amount.",
    );
  if (total > invoice.amountCents)
    throw new AppError(
      "PAYMENT_EXCEEDS_BALANCE",
      "This payment exceeds the invoice balance. Enter the amount still outstanding.",
    );
  const overdue =
    invoice.status === "OVERDUE" ||
    Boolean(invoice.dueDate && invoice.dueDate < localDateKey(new Date(now)));
  let status: InvoiceStatus = overdue ? "OVERDUE" : "UNPAID";
  if (invoice.status === "DRAFT" && total === 0) {
    status = "DRAFT";
  } else if (total >= invoice.amountCents) {
    status = "PAID";
  } else if (invoice.advanceCents > 0 && total >= invoice.advanceCents) {
    status = "ADVANCE_PAID";
  }
  tx.update(invoices)
    .set({
      paidCents: total,
      status,
      updatedAt: now,
      ...(total < invoice.advanceCents &&
        !invoice.trackingChoice && { trackingEligibleAt: null }),
    })
    .where(eq(invoices.id, invoice.id))
    .run();
}

const correctionSchema = z.object({
  invoiceId: recordId,
  paymentId: recordId,
  reason: z
    .string()
    .trim()
    .min(1, "Enter a reason for this correction.")
    .max(500),
  replacement: recordPaymentSchema
    .pick({ amountCents: true, receivedAt: true, reference: true })
    .required()
    .optional(),
});
export function correctPayment(input: CorrectPaymentInput): InvoiceWithClient {
  const value = correctionSchema.parse({
    ...input,
    replacement: input?.replacement && {
      ...input.replacement,
      reference: input.replacement.reference ?? "",
    },
  });
  const db = getDb();
  db.transaction((tx) => {
    const invoice = tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, value.invoiceId))
      .get();
    if (!invoice || invoice.trashedAt)
      throw new AppError("NOT_FOUND", "Active invoice not found.");
    const original = listPayments(invoice.id).find(
      (payment) => payment.id === value.paymentId,
    );
    if (!original)
      throw new AppError("NOT_FOUND", "Payment not found on this invoice.");
    if (original.correction)
      throw new AppError(
        "ALREADY_CORRECTED",
        "This payment was already reversed or corrected.",
      );
    const now = new Date().toISOString();
    const replacementId = value.replacement ? crypto.randomUUID() : null;
    if (value.replacement && replacementId) {
      tx.insert(invoicePayments)
        .values({
          id: replacementId,
          requestId: replacementId,
          invoiceId: invoice.id,
          currency: invoice.currency,
          ...value.replacement,
        })
        .run();
    }
    tx.insert(invoicePaymentCorrections)
      .values({
        originalPaymentId: original.id,
        replacementPaymentId: replacementId,
        reason: value.reason,
        correctedAt: now,
      })
      .run();
    refreshInvoiceCollection(tx, invoice, now);
  });
  scheduleInvoiceExport(value.invoiceId);
  return getInvoiceWithClient(value.invoiceId)!;
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
  if (!invoice || invoice.trashedAt)
    throw new AppError("NOT_FOUND", "Active invoice not found.");

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
    whatsappPhone?: string | null;
    billingAddress?: string | null;
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
    whatsappPhone: snapshot.whatsappPhone ?? null,
    billingAddress: snapshot.billingAddress ?? null,
    driveUrl: snapshot.driveUrl || invoice.deliveryUrl || null,
    category: snapshot.category || "Enterprise",
    currency: (snapshot.currency || invoice.currency || "USD") as Currency,
  };

  db.transaction((tx) => {
    const now = new Date().toISOString();
    tx.insert(clients).values(newClientData).run();
    tx.update(invoices)
      .set({
        clientId: newClientId,
        updatedAt: now,
      })
      .where(eq(invoices.id, invoiceId))
      .run();
    tx.update(tasks)
      .set({
        clientId: newClientId,
        clientName: newClientData.name,
        updatedAt: now,
      })
      .where(eq(tasks.invoiceId, invoiceId))
      .run();
  });

  return db.select().from(clients).where(eq(clients.id, newClientId)).get()!;
}

export function setInvoiceTrash(
  idsInput: string[],
  trash: boolean,
): { success: boolean } {
  const ids = [...new Set(z.array(recordId).min(1).parse(idsInput))];
  return getDb().transaction((tx) => {
    const now = new Date().toISOString();
    for (const id of ids) {
      const invoice = tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, id))
        .get();
      if (!invoice) throw new AppError("NOT_FOUND", "Invoice not found.");
      if (Boolean(invoice.trashedAt) === trash) continue;
      if (
        trash &&
        tx
          .select()
          .from(invoicePayments)
          .where(eq(invoicePayments.invoiceId, id))
          .get()
      )
        throw new AppError(
          "HAS_PAYMENTS",
          "Invoices with recorded payments cannot be moved to Trash.",
        );
      if (
        trash &&
        tx.select().from(workOrders).where(eq(workOrders.invoiceId, id)).get()
      )
        throw new AppError(
          "HAS_WORK_ORDERS",
          "Remove unpaid contractor work orders before moving this invoice to Trash. Paid work must be retained.",
        );
      tx.update(invoices)
        .set({ trashedAt: trash ? now : null, updatedAt: now })
        .where(eq(invoices.id, id))
        .run();
    }
    return { success: true };
  });
}

export function removeInvoice(id: string) {
  return setInvoiceTrash([id], true);
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
    if (!invoice || invoice.trashedAt)
      throw new AppError("NOT_FOUND", "Active invoice not found.");
    const payments = listPayments(id).filter((p) => !p.correction);
    if (payments.some((p) => p.currency !== invoice.currency))
      throw new AppError(
        "CURRENCY_MISMATCH",
        "Existing payments do not match the invoice currency.",
      );
    const paid = payments.reduce((sum, p) => sum + p.amountCents, 0);
    if (status === "DRAFT" && paid > 0)
      throw new AppError(
        "HAS_PAYMENTS",
        "Reverse or correct recorded payments before moving this invoice to Draft.",
      );
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
      finalPaid >= invoice.amountCents && (finalPaid > 0 || status === "PAID")
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

export function setInvoiceStatuses(
  idsInput: string[],
  statusInput: InvoiceStatus,
) {
  const ids = [...new Set(z.array(recordId).min(1).parse(idsInput))];
  const status = invoiceStatusSchema.parse(statusInput);
  const db = getDb();
  db.transaction((tx) => {
    for (const id of ids) {
      settleInvoiceStatus(id, status);
      const invoice = tx
        .select({ status: invoices.status, code: invoices.code })
        .from(invoices)
        .where(eq(invoices.id, id))
        .get()!;
      if (invoice.status !== status)
        throw new AppError(
          "STATUS_CONFLICT",
          `${invoice.code} cannot move to this status with its current payment history.`,
        );
    }
  });
  ids.forEach(scheduleInvoiceExport);
  return { success: true };
}

const invoiceListFilterSchema = z
  .object({
    clientId: recordId.optional(),
  })
  .optional();

export function registerInvoiceHandlers(broadcastDataChanged: () => void) {
  ipcMain.handle(
    "invoices:list",
    async (_event, filter?: { clientId?: string }) => {
      try {
        const parsedFilter = invoiceListFilterSchema.parse(filter);
        return listInvoicesWithClient(parsedFilter?.clientId);
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
    async (_event, idInput: string, patch: InvoicePatchInput) => {
      try {
        const id = recordId.parse(idInput);
        const validated = invoicePatchSchema.parse(patch);
        const db = getDb();

        db.transaction((tx) => {
          const existing = tx
            .select()
            .from(invoices)
            .where(eq(invoices.id, id))
            .get();
          if (!existing || existing.trashedAt) {
            throw new AppError("NOT_FOUND", "Active invoice not found.");
          }

          const paymentRows = tx
            .select({
              payment: invoicePayments,
              correction: invoicePaymentCorrections,
            })
            .from(invoicePayments)
            .leftJoin(
              invoicePaymentCorrections,
              eq(
                invoicePaymentCorrections.originalPaymentId,
                invoicePayments.id,
              ),
            )
            .where(eq(invoicePayments.invoiceId, id))
            .all();
          const activePaidCents = paymentRows
            .filter((row) => !row.correction)
            .reduce((sum, row) => sum + row.payment.amountCents, 0);

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
          const linkedTasks = tx
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

          let nextClientSnapshot = existing.clientSnapshot;
          if (newClientId !== existing.clientId && newClientId) {
            const nextClient = tx
              .select()
              .from(clients)
              .where(eq(clients.id, newClientId))
              .get();
            if (!nextClient) {
              throw new AppError(
                "CLIENT_NOT_FOUND",
                "The specified client does not exist.",
              );
            }
            if (nextClient.archivedAt) {
              throw new AppError(
                "CLIENT_ARCHIVED",
                "Archived clients cannot be assigned to an invoice.",
              );
            }
            nextClientSnapshot = buildClientSnapshot(nextClient);
          }

          const oldItems = tx
            .select()
            .from(invoiceItems)
            .where(eq(invoiceItems.invoiceId, id))
            .all();
          const newAmount = validated.amountCents ?? existing.amountCents;
          if (activePaidCents > newAmount)
            throw new AppError(
              "PAYMENT_EXCEEDS_BALANCE",
              "The invoice total cannot be less than payments already recorded. Correct the payment first.",
            );
          validateInvoiceAmounts({
            amountCents: newAmount,
            discountCents: validated.discountCents ?? existing.discountCents,
            taxCents: validated.taxCents ?? existing.taxCents,
            advanceCents: validated.advanceCents ?? existing.advanceCents,
            items: validated.items ?? oldItems,
          });

          tx.update(invoices)
            .set({
              code: validated.code ?? existing.code,
              clientId: validated.clientId ?? existing.clientId,
              clientSnapshot: nextClientSnapshot,
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
              workflowStage:
                validated.workflowStage === undefined
                  ? existing.workflowStage
                  : validated.workflowStage,
              paymentUrl:
                validated.paymentUrl === undefined
                  ? existing.paymentUrl
                  : validated.paymentUrl,
              status: existing.status,
              paidCents: activePaidCents,
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
              const validService = item.catalogId
                ? tx
                    .select()
                    .from(catalogServices)
                    .where(eq(catalogServices.id, item.catalogId))
                    .get()
                : undefined;
              const fields = {
                description: item.description,
                quantity: item.quantity,
                unitPriceCents: item.unitPriceCents,
                catalogId: validService ? item.catalogId : null,
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
        return getInvoiceWithClient(id)!;
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle(
    "invoices:setStatuses",
    (_event, ids: string[], status: InvoiceStatus) => {
      try {
        const result = setInvoiceStatuses(ids, status);
        broadcastDataChanged();
        return result;
      } catch (error) {
        throw formatError(error);
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
        return getInvoiceWithClient(id)!;
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle("invoices:exportBatch", async (_event, ids: string[]) => {
    try {
      return await exportInvoiceBatch(ids);
    } catch (error) {
      throw formatError(error);
    }
  });
  ipcMain.handle(
    "invoices:prepareShare",
    async (_event, id: string, template?: string) => {
      try {
        return await prepareInvoiceShare(id, template);
      } catch (error) {
        throw formatError(error);
      }
    },
  );

  ipcMain.handle("invoices:trashList", () =>
    listInvoicesWithClient(undefined, true),
  );
  for (const trash of [true, false]) {
    ipcMain.handle(
      trash ? "invoices:trash" : "invoices:restore",
      (_event, ids: string[]) => {
        try {
          const result = setInvoiceTrash(ids, trash);
          broadcastDataChanged();
          return result;
        } catch (error) {
          throw formatError(error);
        }
      },
    );
  }
  ipcMain.handle(
    "invoices:correctPayment",
    (_event, input: CorrectPaymentInput) => {
      try {
        const result = correctPayment(input);
        broadcastDataChanged();
        return result;
      } catch (error) {
        throw formatError(error);
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
