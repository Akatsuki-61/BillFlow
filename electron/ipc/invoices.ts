import { ipcMain } from "electron";
import crypto from "crypto";
import { eq, desc } from "drizzle-orm";
import { getDb } from "../db";
import { clients, invoices, settings, catalogItems } from "../db/schema";
import { newInvoiceSchema, invoicePatchSchema } from "../validation";
import { getOrCreateSettings } from "./settings";
import { AppError, formatError } from "./errors";
import {
  InvoiceWithClient,
  NewInvoiceInput,
  InvoicePatchInput,
  InvoiceStatus,
  Currency,
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

  return filtered.map((r) => ({
    ...r.invoice,
    currency: r.invoice.currency as Currency,
    status: r.invoice.status as InvoiceStatus,
    clientName: r.invoice.clientSnapshot ? JSON.parse(r.invoice.clientSnapshot).name : r.clientName || "Unknown Client",
    clientEmail: r.invoice.clientSnapshot ? JSON.parse(r.invoice.clientSnapshot).email : r.clientEmail || undefined,
  }));
}

export function createInvoice(input: NewInvoiceInput): InvoiceWithClient {
  const value = newInvoiceSchema.parse(input);
  const { requestId, ...details } = value;
  const requestHash = crypto.createHash("sha256").update(JSON.stringify(details)).digest("hex");
  const id = requestId || crypto.randomUUID();
  const db = getDb();
  db.transaction(tx => {
    const existing = tx.select().from(invoices).where(eq(invoices.id, id)).get();
    if (existing) {
      if (existing.requestHash !== requestHash) throw new AppError("CONFLICT", "This invoice request was already used with different details.");
      return;
    }
    if (value.catalogItemId && !tx.select().from(catalogItems).where(eq(catalogItems.id, value.catalogItemId)).get()) {
      throw new AppError("NOT_FOUND", "The selected Catalog item no longer exists.");
    }
    let clientId = value.clientId;
    let client: typeof clients.$inferSelect | undefined;
    if (value.newClient) {
      clientId = crypto.randomUUID();
      tx.insert(clients).values({ id: clientId, ...value.newClient }).run();
      client = tx.select().from(clients).where(eq(clients.id, clientId)).get();
    } else if (clientId) {
      client = tx.select().from(clients).where(eq(clients.id, clientId)).get();
      if (!client) {
        throw new AppError("CLIENT_NOT_FOUND", "The specified client does not exist.");
      }
    } else {
      throw new AppError("CLIENT_NOT_FOUND", "The specified client does not exist.");
    }

    const today = new Date().toISOString().split("T")[0];
    const issueDate = value.issueDate || today;
    const profile = getOrCreateSettings();
    const defaultDue = new Date(`${issueDate}T00:00:00Z`);
    defaultDue.setUTCDate(defaultDue.getUTCDate() + profile.defaultDueDays);
    const dueDate = value.dueDate === undefined ? defaultDue.toISOString().slice(0, 10) : value.dueDate;

    tx.insert(invoices).values({
      id,
      requestHash,
      code: value.code || getNextInvoiceCode(),
      clientId: clientId || null,
      catalogItemId: value.catalogItemId || null,
      title: value.title || null,
      clientSnapshot: client ? JSON.stringify({ name: client.name, email: client.email, contactPerson: client.contactPerson, phone: client.phone, driveUrl: client.driveUrl }) : null,
      businessSnapshot: JSON.stringify(profile),
      deliveryUrl: client?.driveUrl || null,
      notes: profile.defaultNotes || null,
      discountCents: 0,
      taxCents: 0,
      advanceCents: 0,
      amountCents: value.amountCents,
      currency: value.currency,
      issueDate,
      dueDate,
      status: value.status || "UNPAID",
      paidCents: value.status === "PAID" ? value.amountCents : 0,
    }).run();
  });
  return listInvoicesWithClient().find(row => row.id === id)!;
}

export function registerInvoiceHandlers(broadcastDataChanged: () => void) {
  ipcMain.handle("invoices:list", async (_event, filter?: { clientId?: string }) => {
    try {
      return listInvoicesWithClient(filter?.clientId);
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
        const newPaid = newStatus === "PAID" ? newAmount : 0;

        db.update(invoices)
          .set({
            code: validated.code ?? existing.code,
            clientId: validated.clientId ?? existing.clientId,
            catalogItemId: validated.catalogItemId !== undefined ? validated.catalogItemId : existing.catalogItemId,
            title: validated.title !== undefined ? validated.title : existing.title,
            amountCents: newAmount,
            currency: validated.currency ?? existing.currency,
            dueDate: validated.dueDate !== undefined ? validated.dueDate : existing.dueDate,
            status: newStatus,
            paidCents: newPaid,
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

  ipcMain.handle(
    "invoices:setStatus",
    async (_event, id: string, status: InvoiceStatus) => {
      try {
        const db = getDb();
        const existing = db.select().from(invoices).where(eq(invoices.id, id)).get();
        if (!existing) {
          throw new AppError("NOT_FOUND", "Invoice not found.");
        }

        const paidCents = status === "PAID" ? existing.amountCents : 0;

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
}
