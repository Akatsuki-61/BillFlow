import { ipcMain } from "electron";
import crypto from "crypto";
import { eq, desc, asc } from "drizzle-orm";
import { getDb } from "../db";
import { clients, invoices, settings, catalogItems, catalogServices, invoiceItems, invoicePayments } from "../db/schema";
import { newInvoiceSchema, invoicePatchSchema, recordPaymentSchema, promoteInvoiceClientSchema } from "../validation";
import { getOrCreateSettings } from "./settings";
import { AppError, formatError } from "./errors";
import { saveInvoicePdf } from "./files";
import { generateInvoicePdfBuffer } from "../pdf-generator";
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
    const s = db.select().from(settings).where(eq(settings.id, "default")).get();
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
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .orderBy(desc(invoices.issueDate), desc(invoices.createdAt))
    .all();

  const filtered = clientId
    ? allInvoices.filter((r) => r.invoice.clientId === clientId)
    : allInvoices;

  return filtered.map((r) => {
    const items = db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, r.invoice.id))
      .orderBy(asc(invoiceItems.position))
      .all();

    const payments = db
      .select()
      .from(invoicePayments)
      .where(eq(invoicePayments.invoiceId, r.invoice.id))
      .orderBy(asc(invoicePayments.receivedAt))
      .all()
      .map((p) => ({
        ...p,
        currency: p.currency as Currency,
      }));

    return {
      ...r.invoice,
      currency: r.invoice.currency as Currency,
      status: r.invoice.status as InvoiceStatus,
      clientName: r.invoice.clientSnapshot ? JSON.parse(r.invoice.clientSnapshot).name : r.clientName || "Unknown Client",
      clientEmail: r.invoice.clientSnapshot ? JSON.parse(r.invoice.clientSnapshot).email : r.clientEmail || undefined,
      items,
      payments,
    };
  });
}

export async function exportInvoicePdf(invoiceId: string): Promise<string> {
  const db = getDb();
  const invoice = db.select().from(invoices).where(eq(invoices.id, invoiceId)).get();
  if (!invoice) throw new AppError("NOT_FOUND", "Invoice not found.");

  const client = invoice.clientId
    ? db.select().from(clients).where(eq(clients.id, invoice.clientId)).get()
    : undefined;
  const clientSnapshot = invoice.clientSnapshot
    ? JSON.parse(invoice.clientSnapshot)
    : { name: client?.name || "Client", email: client?.email };

  const profile = getOrCreateSettings();
  const items = db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId))
    .orderBy(asc(invoiceItems.position))
    .all();

  const pdfBuffer = await generateInvoicePdfBuffer({
    code: invoice.code,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    status: invoice.status,
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
    business: profile,
  });

  return saveInvoicePdf(invoiceId, pdfBuffer);
}

export function createInvoice(input: NewInvoiceInput): InvoiceWithClient {
  const value = newInvoiceSchema.parse(input);
  const { requestId, ...details } = value;
  const requestHash = crypto.createHash("sha256").update(JSON.stringify(details)).digest("hex");
  const id = requestId || crypto.randomUUID();
  const db = getDb();

  db.transaction((tx) => {
    const existing = tx.select().from(invoices).where(eq(invoices.id, id)).get();
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new AppError("CONFLICT", "This invoice request was already used with different details.");
      }
      return;
    }
    if (value.catalogItemId && !tx.select().from(catalogItems).where(eq(catalogItems.id, value.catalogItemId)).get()) {
      throw new AppError("NOT_FOUND", "The selected Catalog item no longer exists.");
    }

    let clientId = value.clientId;
    let client: typeof clients.$inferSelect | undefined;
    let clientSnapshotStr: string | null = null;

    if (value.newClient) {
      if (value.saveAsPermanentClient !== false) {
        clientId = crypto.randomUUID();
        tx.insert(clients).values({ id: clientId, ...value.newClient }).run();
        client = tx.select().from(clients).where(eq(clients.id, clientId)).get();
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
        throw new AppError("CLIENT_NOT_FOUND", "The specified client does not exist.");
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
      throw new AppError("CLIENT_NOT_FOUND", "The specified client does not exist.");
    }

    const today = new Date().toISOString().split("T")[0];
    const issueDate = value.issueDate || today;
    const profile = getOrCreateSettings();
    const defaultDue = new Date(`${issueDate}T00:00:00Z`);
    defaultDue.setUTCDate(defaultDue.getUTCDate() + profile.defaultDueDays);
    const dueDate = value.dueDate === undefined ? defaultDue.toISOString().slice(0, 10) : value.dueDate;

    const discountCents = value.discountCents || 0;
    const taxCents = value.taxCents || 0;
    const advanceCents = value.advanceCents || 0;
    const deliveryUrl = value.deliveryUrl || client?.driveUrl || (value.newClient?.driveUrl || null);
    const notes = value.notes || profile.defaultNotes || null;

    tx.insert(invoices).values({
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
      paidCents: value.status === "PAID" ? value.amountCents : 0,
    }).run();

    // Persist line items
    if (value.items && value.items.length > 0) {
      for (let i = 0; i < value.items.length; i++) {
        const item = value.items[i];
        const validService = item.catalogId
          ? tx.select().from(catalogServices).where(eq(catalogServices.id, item.catalogId)).get()
          : undefined;
        tx.insert(invoiceItems).values({
          id: item.id || crypto.randomUUID(),
          invoiceId: id,
          catalogId: validService ? item.catalogId : null,
          description: item.description,
          quantity: item.quantity || 1,
          unitPriceCents: item.unitPriceCents,
          position: i,
        }).run();
      }
    } else if (value.title) {
      // Default line item if title was supplied without items array
      const validService = value.catalogItemId
        ? tx.select().from(catalogServices).where(eq(catalogServices.id, value.catalogItemId)).get()
        : undefined;
      tx.insert(invoiceItems).values({
        id: crypto.randomUUID(),
        invoiceId: id,
        catalogId: validService ? value.catalogItemId : null,
        description: value.title,
        quantity: 1,
        unitPriceCents: value.amountCents,
        position: 0,
      }).run();
    }
  });

  // Attempt auto-exporting PDF after invoice is created
  exportInvoicePdf(id).catch((err) => {
    if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
      console.warn(`[Invoice] Automatic PDF export for ${id} deferred:`, err.message);
    }
  });

  return listInvoicesWithClient().find((row) => row.id === id)!;
}

export function recordPayment(input: RecordPaymentInput): { payment: InvoicePayment; invoice: InvoiceWithClient } {
  const value = recordPaymentSchema.parse(input);
  const db = getDb();
  const paymentId = value.requestId || crypto.randomUUID();

  let createdPayment: InvoicePayment | undefined;

  db.transaction((tx) => {
    const invoice = tx.select().from(invoices).where(eq(invoices.id, value.invoiceId)).get();
    if (!invoice) throw new AppError("NOT_FOUND", "Invoice not found.");

    const now = new Date().toISOString();
    const receivedAt = value.receivedAt || now;

    tx.insert(invoicePayments).values({
      id: paymentId,
      invoiceId: invoice.id,
      amountCents: value.amountCents,
      currency: value.currency || invoice.currency,
      receivedAt,
      reference: value.reference || "",
      requestId: paymentId,
    }).run();

    // Calculate total received payments
    const allPayments = tx
      .select()
      .from(invoicePayments)
      .where(eq(invoicePayments.invoiceId, invoice.id))
      .all();
    const totalPaidCents = allPayments.reduce((sum, p) => sum + p.amountCents, 0);

    let nextStatus: InvoiceStatus = invoice.status as InvoiceStatus;
    if (totalPaidCents >= invoice.amountCents) {
      nextStatus = "PAID";
    } else if (invoice.advanceCents > 0 && totalPaidCents >= invoice.advanceCents) {
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
      currency: (value.currency || invoice.currency) as Currency,
      receivedAt,
      reference: value.reference || "",
      requestId: paymentId,
    };
  });

  // Re-export PDF with updated payment details
  exportInvoicePdf(value.invoiceId).catch((err) => {
    if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
      console.warn(`[Invoice] PDF re-export after payment for ${value.invoiceId} deferred:`, err.message);
    }
  });

  const updatedInvoice = listInvoicesWithClient().find((row) => row.id === value.invoiceId)!;
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

export function promoteInvoiceClient(invoiceId: string): typeof clients.$inferSelect {
  const db = getDb();
  const invoice = db.select().from(invoices).where(eq(invoices.id, invoiceId)).get();
  if (!invoice) throw new AppError("NOT_FOUND", "Invoice not found.");

  if (invoice.clientId) {
    const existing = db.select().from(clients).where(eq(clients.id, invoice.clientId)).get();
    if (existing) return existing;
  }

  if (!invoice.clientSnapshot) {
    throw new AppError("BAD_REQUEST", "Invoice does not contain client details to save.");
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
    throw new AppError("BAD_REQUEST", "Failed to parse stored client snapshot.");
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

export function registerInvoiceHandlers(broadcastDataChanged: () => void) {
  ipcMain.handle("invoices:list", async (_event, filter?: { clientId?: string }) => {
    try {
      return listInvoicesWithClient(filter?.clientId);
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle("invoices:promoteClient", async (_event, invoiceId: string) => {
    try {
      const validated = promoteInvoiceClientSchema.parse({ invoiceId });
      const created = promoteInvoiceClient(validated.invoiceId);
      broadcastDataChanged();
      return created;
    } catch (err) {
      throw formatError(err);
    }
  });

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

        const existing = db.select().from(invoices).where(eq(invoices.id, id)).get();
        if (!existing) {
          throw new AppError("NOT_FOUND", "Invoice not found.");
        }

        const newStatus = validated.status ?? existing.status;
        const newAmount = validated.amountCents ?? existing.amountCents;
        const newPaid = newStatus === "PAID" ? newAmount : existing.paidCents;

        db.transaction((tx) => {
          tx.update(invoices)
            .set({
              code: validated.code ?? existing.code,
              clientId: validated.clientId ?? existing.clientId,
              catalogItemId: validated.catalogItemId !== undefined ? validated.catalogItemId : existing.catalogItemId,
              title: validated.title !== undefined ? validated.title : existing.title,
              discountCents: validated.discountCents !== undefined ? validated.discountCents : existing.discountCents,
              taxCents: validated.taxCents !== undefined ? validated.taxCents : existing.taxCents,
              advanceCents: validated.advanceCents !== undefined ? validated.advanceCents : existing.advanceCents,
              deliveryUrl: validated.deliveryUrl !== undefined ? validated.deliveryUrl : existing.deliveryUrl,
              notes: validated.notes !== undefined ? validated.notes : existing.notes,
              amountCents: newAmount,
              currency: validated.currency ?? existing.currency,
              dueDate: validated.dueDate !== undefined ? validated.dueDate : existing.dueDate,
              status: newStatus,
              paidCents: newPaid,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(invoices.id, id))
            .run();

          if (validated.items) {
            tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id)).run();
            for (let i = 0; i < validated.items.length; i++) {
              const item = validated.items[i];
              tx.insert(invoiceItems).values({
                id: item.id || crypto.randomUUID(),
                invoiceId: id,
                catalogId: item.catalogId || null,
                description: item.description,
                quantity: item.quantity || 1,
                unitPriceCents: item.unitPriceCents,
                position: i,
              }).run();
            }
          }
        });

        exportInvoicePdf(id).catch((err) => {
          console.warn(`[Invoice] Re-export PDF after update for ${id} deferred:`, err.message);
        });

        broadcastDataChanged();
        const all = listInvoicesWithClient();
        return all.find((inv) => inv.id === id)!;
      } catch (err) {
        throw formatError(err);
      }
    }
  );

  ipcMain.handle(
    "invoices:setStatus",
    async (_event, id: string, status: InvoiceStatus) => {
      try {
        const db = getDb();
        const existing = db.select().from(invoices).where(eq(invoices.id, id)).get();
        if (!existing) {
          throw new AppError("NOT_FOUND", "Invoice not found.");
        }

        const paidCents = status === "PAID" ? existing.amountCents : existing.paidCents;

        db.update(invoices)
          .set({
            status,
            paidCents,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(invoices.id, id))
          .run();

        broadcastDataChanged();
        const all = listInvoicesWithClient();
        return all.find((inv) => inv.id === id)!;
      } catch (err) {
        throw formatError(err);
      }
    }
  );

  ipcMain.handle("invoices:remove", async (_event, id: string) => {
    try {
      const db = getDb();
      db.delete(invoices).where(eq(invoices.id, id)).run();
      broadcastDataChanged();
      return { success: true };
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle("invoices:recordPayment", async (_event, input: RecordPaymentInput) => {
    try {
      const result = recordPayment(input);
      broadcastDataChanged();
      return result;
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle("invoices:listPayments", async (_event, invoiceId: string) => {
    try {
      return listPayments(invoiceId);
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle("invoices:exportPdf", async (_event, invoiceId: string) => {
    try {
      const filePath = await exportInvoicePdf(invoiceId);
      return filePath;
    } catch (err) {
      throw formatError(err);
    }
  });
}
