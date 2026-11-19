import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { dialog, shell } from "electron";
import { getActiveProfileId, getDb } from "../db";
import {
  catalogItems,
  clients,
  invoices,
  quoteItems,
  quotes,
} from "../db/schema";
import { atomicWrite } from "../managed-files";
import {
  generateInvoiceHtmlPdfBuffer,
  type InvoicePdfPayload,
} from "../pdf-generator";
import { ipcMain } from "../security";
import {
  convertQuoteSchema,
  newQuoteSchema,
  quotePatchSchema,
  quoteStatusSchema,
} from "../validation";
import { captureWorkspace } from "../workspace-session";
import { recordActivity } from "../workspace-activity";
import { recordId } from "../workflow-validation";
import { validateInvoiceAmounts } from "../../src/lib/invoice-math";
import { localDateKey } from "../../src/lib/visual-metrics";
import type { Currency } from "../../src/types/billing";
import type {
  ConvertQuoteInput,
  ConvertQuoteResult,
  NewQuoteInput,
  QuotePatchInput,
  QuoteStatus,
  QuoteWithClient,
} from "../../src/types/quotes";
import { AppError, formatError } from "./errors";
import { pdfOutputDirectory } from "./files";
import {
  createInvoiceInTx,
  getInvoiceWithClient,
  getNextInvoiceCode,
} from "./invoices";
import { getOrCreateSettings } from "./settings";

function chunks<T>(values: T[], size = 500): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < values.length; i += size)
    result.push(values.slice(i, i + size));
  return result;
}

export function getNextQuoteCode(): string {
  const db = getDb();
  const currentYear = new Date().getFullYear();
  const activePrefix = `QT-${currentYear}-`;
  const rows = db.select({ code: quotes.code }).from(quotes).all();
  let maxSeq = 0;
  for (const row of rows) {
    if (row.code && row.code.startsWith(activePrefix)) {
      const parsed = Number.parseInt(row.code.slice(activePrefix.length), 10);
      if (!Number.isNaN(parsed) && parsed > maxSeq) maxSeq = parsed;
    }
  }
  return `${activePrefix}${String(maxSeq + 1).padStart(3, "0")}`;
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

function hydrateQuotes(
  rows: Array<{
    quote: typeof quotes.$inferSelect;
    clientName: string | null;
    clientEmail: string | null;
    clientPhone: string | null;
    clientBillingAddress: string | null;
    clientContactPerson: string | null;
    clientCategory: string | null;
    convertedInvoiceCode: string | null;
  }>,
): QuoteWithClient[] {
  if (!rows.length) return [];
  const db = getDb();
  const ids = rows.map((row) => row.quote.id);
  const allItems = chunks(ids).flatMap((batch) =>
    db
      .select()
      .from(quoteItems)
      .where(inArray(quoteItems.quoteId, batch))
      .orderBy(asc(quoteItems.position))
      .all(),
  );
  const itemMap = new Map<string, typeof allItems>();
  for (const item of allItems) {
    const list = itemMap.get(item.quoteId) || [];
    list.push(item);
    itemMap.set(item.quoteId, list);
  }

  return rows.map((row) => {
    let snapshot: {
      name?: string;
      email?: string;
      phone?: string;
      billingAddress?: string;
      contactPerson?: string;
      category?: string;
    } | null = null;
    if (row.quote.clientSnapshot) {
      try {
        snapshot = JSON.parse(row.quote.clientSnapshot);
      } catch {
        snapshot = null;
      }
    }
    return {
      id: row.quote.id,
      code: row.quote.code,
      clientId: row.quote.clientId ?? null,
      clientName: snapshot?.name || row.clientName || "Unknown Client",
      clientEmail: snapshot?.email || row.clientEmail || null,
      clientPhone: snapshot?.phone || row.clientPhone || null,
      clientBillingAddress:
        snapshot?.billingAddress || row.clientBillingAddress || null,
      clientContactPerson:
        snapshot?.contactPerson || row.clientContactPerson || null,
      clientCategory: snapshot?.category || row.clientCategory || null,
      title: row.quote.title ?? null,
      currency: row.quote.currency as Currency,
      discountCents: row.quote.discountCents,
      taxCents: row.quote.taxCents,
      advanceCents: row.quote.advanceCents,
      amountCents: row.quote.amountCents,
      issueDate: row.quote.issueDate,
      validUntil: row.quote.validUntil ?? null,
      status: row.quote.status as QuoteStatus,
      template: row.quote.template ?? null,
      deliveryUrl: row.quote.deliveryUrl ?? null,
      notes: row.quote.notes ?? null,
      convertedInvoiceId: row.quote.convertedInvoiceId ?? null,
      convertedInvoiceCode: row.convertedInvoiceCode ?? null,
      convertedAt: row.quote.convertedAt ?? null,
      createdAt: row.quote.createdAt,
      updatedAt: row.quote.updatedAt,
      items: itemMap.get(row.quote.id) || [],
    };
  });
}

export function listQuotes(clientId?: string): QuoteWithClient[] {
  const db = getDb();
  const rows = db
    .select({
      quote: quotes,
      clientName: clients.name,
      clientEmail: clients.email,
      clientPhone: clients.phone,
      clientBillingAddress: clients.billingAddress,
      clientContactPerson: clients.contactPerson,
      clientCategory: clients.category,
      convertedInvoiceCode: invoices.code,
    })
    .from(quotes)
    .leftJoin(clients, eq(quotes.clientId, clients.id))
    .leftJoin(invoices, eq(quotes.convertedInvoiceId, invoices.id))
    .where(clientId ? eq(quotes.clientId, recordId.parse(clientId)) : undefined)
    .orderBy(desc(quotes.issueDate), desc(quotes.createdAt))
    .all();
  return hydrateQuotes(rows);
}

export function getQuoteWithClient(idInput: string): QuoteWithClient | null {
  const id = recordId.parse(idInput);
  const db = getDb();
  const rows = db
    .select({
      quote: quotes,
      clientName: clients.name,
      clientEmail: clients.email,
      clientPhone: clients.phone,
      clientBillingAddress: clients.billingAddress,
      clientContactPerson: clients.contactPerson,
      clientCategory: clients.category,
      convertedInvoiceCode: invoices.code,
    })
    .from(quotes)
    .leftJoin(clients, eq(quotes.clientId, clients.id))
    .leftJoin(invoices, eq(quotes.convertedInvoiceId, invoices.id))
    .where(eq(quotes.id, id))
    .limit(1)
    .all();
  return hydrateQuotes(rows)[0] ?? null;
}

export function createQuote(input: NewQuoteInput): QuoteWithClient {
  const parsed = newQuoteSchema.parse(input);
  validateInvoiceAmounts(parsed);

  const db = getDb();
  const id = crypto.randomUUID();
  const profile = getOrCreateSettings();

  db.transaction((tx) => {
    let clientId = parsed.clientId;
    let client: typeof clients.$inferSelect | undefined;
    let clientSnapshotStr: string | null = null;

    if (parsed.newClient) {
      if (parsed.saveAsPermanentClient !== false) {
        clientId = crypto.randomUUID();
        tx.insert(clients)
          .values({ id: clientId, ...parsed.newClient })
          .run();
        client = tx
          .select()
          .from(clients)
          .where(eq(clients.id, clientId))
          .get();
        clientSnapshotStr = client ? buildClientSnapshot(client) : null;
      } else {
        clientId = undefined;
        clientSnapshotStr = JSON.stringify({
          name: parsed.newClient.name,
          email: parsed.newClient.email,
          contactPerson: parsed.newClient.contactPerson || parsed.newClient.name,
          phone: parsed.newClient.phone || null,
          whatsappPhone: parsed.newClient.whatsappPhone,
          billingAddress: parsed.newClient.billingAddress,
          driveUrl: parsed.newClient.driveUrl || null,
          category: parsed.newClient.category || "Enterprise",
          currency: parsed.newClient.currency || parsed.currency,
        });
      }
    } else if (clientId) {
      client = tx.select().from(clients).where(eq(clients.id, clientId)).get();
      if (!client) {
        throw new AppError(
          "CLIENT_NOT_FOUND",
          "The selected client does not exist.",
        );
      }
      if (client.archivedAt) {
        throw new AppError(
          "CLIENT_ARCHIVED",
          "Restore this client before creating a proposal.",
        );
      }
      clientSnapshotStr = buildClientSnapshot(client);
    }

    const issueDate = parsed.issueDate || localDateKey(new Date());
    let validUntil = parsed.validUntil;
    if (validUntil === undefined) {
      const target = new Date(`${issueDate}T00:00:00Z`);
      target.setUTCDate(target.getUTCDate() + 14);
      validUntil = target.toISOString().slice(0, 10);
    }

    const deliveryUrl =
      parsed.deliveryUrl ||
      client?.driveUrl ||
      parsed.newClient?.driveUrl ||
      profile.defaultDeliveryUrl ||
      null;
    const nowIso = new Date().toISOString();

    tx.insert(quotes)
      .values({
        id,
        code: parsed.code || getNextQuoteCode(),
        clientId: clientId || null,
        clientSnapshot: clientSnapshotStr,
        businessSnapshot: JSON.stringify({
          ...profile,
          signatureData: undefined,
        }),
        title: parsed.title || null,
        currency: parsed.currency,
        discountCents: parsed.discountCents,
        taxCents: parsed.taxCents,
        advanceCents: parsed.advanceCents,
        amountCents: parsed.amountCents,
        issueDate,
        validUntil: validUntil || null,
        status: parsed.status,
        template: parsed.template || profile.defaultInvoiceTemplate || "geometric-teal",
        deliveryUrl,
        notes: parsed.notes ?? null,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      .run();

    for (let i = 0; i < parsed.items.length; i++) {
      const item = parsed.items[i];
      const validCatalog = item.catalogId
        ? tx
            .select({ id: catalogItems.id })
            .from(catalogItems)
            .where(eq(catalogItems.id, item.catalogId))
            .get()
        : undefined;
      tx.insert(quoteItems)
        .values({
          id: crypto.randomUUID(),
          quoteId: id,
          catalogId: validCatalog ? item.catalogId : null,
          description: item.description,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          position: i,
        })
        .run();
    }
  });

  return getQuoteWithClient(id)!;
}

export function updateQuote(
  idInput: string,
  patchInput: QuotePatchInput,
): QuoteWithClient {
  const id = recordId.parse(idInput);
  const patch = quotePatchSchema.parse(patchInput);
  const db = getDb();

  db.transaction((tx) => {
    const existing = tx.select().from(quotes).where(eq(quotes.id, id)).get();
    if (!existing) {
      throw new AppError("NOT_FOUND", "Proposal not found.");
    }
    if (existing.status === "CONVERTED" || existing.convertedInvoiceId) {
      throw new AppError(
        "QUOTE_CONVERTED",
        "Converted proposals are locked and cannot be modified.",
      );
    }

    const existingItems = tx
      .select()
      .from(quoteItems)
      .where(eq(quoteItems.quoteId, id))
      .orderBy(asc(quoteItems.position))
      .all();

    const nextItems = patch.items ?? existingItems;
    const nextDiscount = patch.discountCents ?? existing.discountCents;
    const nextTax = patch.taxCents ?? existing.taxCents;
    const nextAdvance = patch.advanceCents ?? existing.advanceCents;
    const nextAmount = patch.amountCents ?? existing.amountCents;

    validateInvoiceAmounts({
      amountCents: nextAmount,
      discountCents: nextDiscount,
      taxCents: nextTax,
      advanceCents: nextAdvance,
      items: nextItems,
    });

    let nextClientId = existing.clientId;
    let nextClientSnapshot = existing.clientSnapshot;
    if (patch.clientId && patch.clientId !== existing.clientId) {
      const client = tx
        .select()
        .from(clients)
        .where(eq(clients.id, patch.clientId))
        .get();
      if (!client) {
        throw new AppError(
          "CLIENT_NOT_FOUND",
          "The selected client does not exist.",
        );
      }
      if (client.archivedAt) {
        throw new AppError(
          "CLIENT_ARCHIVED",
          "Restore this client before assigning a proposal.",
        );
      }
      nextClientId = client.id;
      nextClientSnapshot = buildClientSnapshot(client);
    }

    tx.update(quotes)
      .set({
        clientId: nextClientId,
        clientSnapshot: nextClientSnapshot,
        code: patch.code ?? existing.code,
        title: patch.title !== undefined ? patch.title : existing.title,
        currency: patch.currency ?? existing.currency,
        discountCents: nextDiscount,
        taxCents: nextTax,
        advanceCents: nextAdvance,
        amountCents: nextAmount,
        issueDate: patch.issueDate ?? existing.issueDate,
        validUntil:
          patch.validUntil !== undefined ? patch.validUntil : existing.validUntil,
        status: patch.status ?? existing.status,
        template:
          patch.template !== undefined ? patch.template : existing.template,
        deliveryUrl:
          patch.deliveryUrl !== undefined
            ? patch.deliveryUrl || null
            : existing.deliveryUrl,
        notes: patch.notes !== undefined ? patch.notes : existing.notes,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(quotes.id, id))
      .run();

    if (patch.items) {
      tx.delete(quoteItems).where(eq(quoteItems.quoteId, id)).run();
      for (let i = 0; i < patch.items.length; i++) {
        const item = patch.items[i];
        const validCatalog = item.catalogId
          ? tx
              .select({ id: catalogItems.id })
              .from(catalogItems)
              .where(eq(catalogItems.id, item.catalogId))
              .get()
          : undefined;
        tx.insert(quoteItems)
          .values({
            id: crypto.randomUUID(),
            quoteId: id,
            catalogId: validCatalog ? item.catalogId : null,
            description: item.description,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            position: i,
          })
          .run();
      }
    }
  });

  return getQuoteWithClient(id)!;
}

export function setQuoteStatus(
  idInput: string,
  statusInput: Exclude<QuoteStatus, "CONVERTED">,
): QuoteWithClient {
  const id = recordId.parse(idInput);
  const status = quoteStatusSchema.parse(statusInput);
  if (status === "CONVERTED") {
    throw new AppError(
      "INVALID_STATUS",
      "Use Convert to Invoice to convert a proposal.",
    );
  }
  const existing = getDb().select().from(quotes).where(eq(quotes.id, id)).get();
  if (!existing) {
    throw new AppError("NOT_FOUND", "Proposal not found.");
  }
  if (existing.status === "CONVERTED" || existing.convertedInvoiceId) {
    throw new AppError(
      "QUOTE_CONVERTED",
      "Converted proposals cannot change status.",
    );
  }
  getDb()
    .update(quotes)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(quotes.id, id))
    .run();
  return getQuoteWithClient(id)!;
}

export function deleteQuote(idInput: string): { success: boolean } {
  const id = recordId.parse(idInput);
  const res = getDb().delete(quotes).where(eq(quotes.id, id)).run();
  if (!res.changes) {
    throw new AppError("NOT_FOUND", "Proposal not found.");
  }
  return { success: true };
}

export function buildQuotePdfPayload(
  quoteIdInput: string,
  templateOverride?: string,
): { quote: QuoteWithClient; payload: InvoicePdfPayload } {
  const quote = getQuoteWithClient(quoteIdInput);
  if (!quote) {
    throw new AppError("NOT_FOUND", "Proposal not found.");
  }
  const profile = getOrCreateSettings();
  const row = getDb()
    .select()
    .from(quotes)
    .where(eq(quotes.id, quote.id))
    .get();
  let businessSnapshot: InvoicePdfPayload["business"] = profile;
  if (row?.businessSnapshot) {
    try {
      const parsed = JSON.parse(row.businessSnapshot);
      if (parsed && typeof parsed === "object") {
        businessSnapshot = {
          ...parsed,
          signatureData: profile.signatureData,
        };
      }
    } catch {
      businessSnapshot = profile;
    }
  }
  const template =
    templateOverride ||
    quote.template ||
    profile.defaultInvoiceTemplate ||
    "geometric-teal";

  return {
    quote,
    payload: {
      documentKind: "quote",
      documentTitle: "PROPOSAL",
      code: quote.code,
      issueDate: quote.issueDate,
      dueDate: quote.validUntil,
      currency: quote.currency,
      status: quote.status,
      template,
      items: quote.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
      })),
      discountCents: quote.discountCents,
      taxCents: quote.taxCents,
      advanceCents: quote.advanceCents,
      amountCents: quote.amountCents,
      paidCents: 0,
      deliveryUrl: quote.deliveryUrl,
      notes: quote.notes,
      client: {
        name: quote.clientName,
        email: quote.clientEmail ?? undefined,
        phone: quote.clientPhone ?? undefined,
        billingAddress: quote.clientBillingAddress,
        contactPerson: quote.clientContactPerson ?? undefined,
      },
      business: businessSnapshot,
    },
  };
}

function managedQuotePdfPath(quote: QuoteWithClient): string {
  const stem = quote.code.replace(/[^a-zA-Z0-9_-]/g, "_");
  const digest = crypto
    .createHash("sha256")
    .update(`${getActiveProfileId()}:quote:${quote.id}`)
    .digest("hex")
    .slice(0, 12);
  return path.join(pdfOutputDirectory(), `Proposal-${stem}-${digest}.pdf`);
}

export async function exportQuotePdf(
  quoteIdInput: string,
  templateOverride?: string,
): Promise<{ success: boolean; filePath: string }> {
  const { quote, payload } = buildQuotePdfPayload(
    quoteIdInput,
    templateOverride,
  );
  const bytes = await generateInvoiceHtmlPdfBuffer(payload);
  if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("Proposal exporter did not produce a valid PDF.");
  }
  const filePath = managedQuotePdfPath(quote);
  if (fs.existsSync(filePath) && fs.lstatSync(filePath).isSymbolicLink()) {
    throw new Error("Cannot overwrite a symbolic link when exporting PDF.");
  }
  atomicWrite(filePath, bytes);
  recordActivity({
    kind: "pdf-saved",
    recordId: quote.id,
    label: quote.code,
    detail: `Proposal PDF exported to ${filePath}`.slice(0, 500),
  });
  return { success: true, filePath };
}

export async function saveQuotePdfAs(
  quoteIdInput: string,
  templateOverride?: string,
): Promise<{ success: boolean; canceled?: boolean; filePath?: string }> {
  const workspace = captureWorkspace();
  const { quote, payload } = buildQuotePdfPayload(
    quoteIdInput,
    templateOverride,
  );
  const bytes = await generateInvoiceHtmlPdfBuffer(payload);
  workspace.assertCurrent();
  const safeCode = quote.code.replace(/[^a-zA-Z0-9_-]/g, "_");
  const result = await dialog.showSaveDialog({
    title: "Save Proposal as PDF",
    defaultPath: `Proposal-${safeCode}.pdf`,
    filters: [{ name: "PDF Document", extensions: ["pdf"] }],
  });
  workspace.assertCurrent();
  if (result.canceled || !result.filePath) {
    return { success: false, canceled: true };
  }
  if (
    fs.existsSync(result.filePath) &&
    fs.lstatSync(result.filePath).isSymbolicLink()
  ) {
    throw new Error("Cannot overwrite a symbolic link when exporting PDF.");
  }
  atomicWrite(result.filePath, bytes);
  return { success: true, canceled: false, filePath: result.filePath };
}

export async function openQuotePdf(
  quoteIdInput: string,
  reveal = false,
): Promise<{ success: boolean }> {
  const quote = getQuoteWithClient(quoteIdInput);
  if (!quote) {
    throw new AppError("NOT_FOUND", "Proposal not found.");
  }
  const filePath = managedQuotePdfPath(quote);
  if (!fs.existsSync(filePath)) {
    await exportQuotePdf(quote.id);
  }
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error("Exported PDF path is invalid.");
  }
  if (reveal) {
    shell.showItemInFolder(filePath);
  } else {
    const err = await shell.openPath(filePath);
    if (err) throw new Error(err);
  }
  return { success: true };
}

export function convertQuoteToInvoice(
  input: ConvertQuoteInput,
): ConvertQuoteResult {
  const parsed = convertQuoteSchema.parse(input);
  const db = getDb();
  const today = localDateKey(new Date());

  const { invoiceId, quoteCode } = db.transaction((tx) => {
    const quoteRow = tx
      .select()
      .from(quotes)
      .where(eq(quotes.id, parsed.quoteId))
      .get();
    if (!quoteRow) {
      throw new AppError("NOT_FOUND", "Proposal not found.");
    }
    if (quoteRow.status === "CONVERTED" || quoteRow.convertedInvoiceId) {
      throw new AppError(
        "ALREADY_CONVERTED",
        "This proposal has already been converted to an invoice.",
      );
    }

    const items = tx
      .select()
      .from(quoteItems)
      .where(eq(quoteItems.quoteId, quoteRow.id))
      .orderBy(asc(quoteItems.position))
      .all();

    let snapshotClient: {
      name?: string;
      email?: string;
      contactPerson?: string;
      phone?: string;
      whatsappPhone?: string | null;
      billingAddress?: string | null;
      driveUrl?: string | null;
      category?: string;
      currency?: Currency;
    } | null = null;
    if (quoteRow.clientSnapshot) {
      try {
        snapshotClient = JSON.parse(quoteRow.clientSnapshot);
      } catch {
        snapshotClient = null;
      }
    }

    const advanceCents =
      parsed.advanceCents !== undefined
        ? parsed.advanceCents
        : quoteRow.advanceCents;
    if (advanceCents > quoteRow.amountCents) {
      throw new AppError(
        "INVALID_ADVANCE",
        "Deposit cannot exceed total proposal amount.",
      );
    }

    const createdInvoiceId = createInvoiceInTx(tx, {
      ...(quoteRow.clientId
        ? { clientId: quoteRow.clientId }
        : {
            newClient: {
              name: snapshotClient?.name || "Proposal Client",
              email: snapshotClient?.email || "client@billflow.local",
              contactPerson: snapshotClient?.contactPerson || "",
              phone: snapshotClient?.phone || undefined,
              whatsappPhone: snapshotClient?.whatsappPhone ?? undefined,
              billingAddress: snapshotClient?.billingAddress ?? undefined,
              driveUrl: snapshotClient?.driveUrl || "",
              category: snapshotClient?.category || "Enterprise",
              currency:
                snapshotClient?.currency || (quoteRow.currency as Currency),
            },
            saveAsPermanentClient: false,
          }),
      code: getNextInvoiceCode(),
      title: quoteRow.title || undefined,
      items: items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        catalogId: item.catalogId,
      })),
      discountCents: quoteRow.discountCents,
      taxCents: quoteRow.taxCents,
      advanceCents,
      amountCents: quoteRow.amountCents,
      currency: quoteRow.currency as Currency,
      issueDate: today,
      dueDate: parsed.dueDate ?? undefined,
      status: parsed.status,
      deliveryUrl: quoteRow.deliveryUrl ?? undefined,
      notes: quoteRow.notes ?? undefined,
    });

    const nowIso = new Date().toISOString();
    tx.update(quotes)
      .set({
        status: "CONVERTED",
        convertedInvoiceId: createdInvoiceId,
        convertedAt: nowIso,
        updatedAt: nowIso,
      })
      .where(eq(quotes.id, quoteRow.id))
      .run();

    return { invoiceId: createdInvoiceId, quoteCode: quoteRow.code };
  });

  const convertedQuote = getQuoteWithClient(parsed.quoteId)!;
  const createdInvoice = getInvoiceWithClient(invoiceId)!;

  recordActivity({
    kind: "quote-converted",
    recordId: invoiceId,
    label: createdInvoice.code,
    detail: `Converted proposal ${quoteCode} into invoice ${createdInvoice.code}`.slice(
      0,
      500,
    ),
  });

  return {
    quote: convertedQuote,
    invoice: createdInvoice,
  };
}

export function registerQuoteHandlers(broadcastDataChanged: () => void) {
  ipcMain.handle("quotes:list", (_event, clientId?: string) => {
    try {
      return listQuotes(clientId);
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle("quotes:nextCode", () => {
    try {
      return getNextQuoteCode();
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle("quotes:create", (_event, input: NewQuoteInput) => {
    try {
      const created = createQuote(input);
      broadcastDataChanged();
      return created;
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle(
    "quotes:update",
    (_event, id: string, patch: QuotePatchInput) => {
      try {
        const updated = updateQuote(id, patch);
        broadcastDataChanged();
        return updated;
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle(
    "quotes:setStatus",
    (_event, id: string, status: Exclude<QuoteStatus, "CONVERTED">) => {
      try {
        const updated = setQuoteStatus(id, status);
        broadcastDataChanged();
        return updated;
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle("quotes:remove", (_event, id: string) => {
    try {
      const res = deleteQuote(id);
      broadcastDataChanged();
      return res;
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle(
    "quotes:exportPdf",
    async (_event, id: string, template?: string) => {
      try {
        return await exportQuotePdf(id, template);
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle(
    "quotes:savePdfAs",
    async (_event, id: string, template?: string) => {
      try {
        return await saveQuotePdfAs(id, template);
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle(
    "quotes:openPdf",
    async (_event, id: string, reveal?: boolean) => {
      try {
        return await openQuotePdf(id, Boolean(reveal));
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle(
    "quotes:convertToInvoice",
    (_event, input: ConvertQuoteInput) => {
      try {
        const result = convertQuoteToInvoice(input);
        broadcastDataChanged();
        return result;
      } catch (err) {
        throw formatError(err);
      }
    },
  );
}
