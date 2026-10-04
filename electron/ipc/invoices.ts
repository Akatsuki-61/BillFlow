import { ipcMain } from "electron";
import crypto from "crypto";
import { eq, desc } from "drizzle-orm";
import { getDb } from "../db";
import { clients, invoices, settings } from "../db/schema";
import { newInvoiceSchema, invoicePatchSchema } from "../validation";
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
    clientName: r.clientName || "Unknown Client",
    clientEmail: r.clientEmail || undefined,
  }));
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
      const validated = newInvoiceSchema.parse(input);
      const db = getDb();

      // Check client exists
      const client = db.select().from(clients).where(eq(clients.id, validated.clientId)).get();
      if (!client) {
        throw new AppError("CLIENT_NOT_FOUND", "The specified client does not exist.");
      }

      const id = crypto.randomUUID();
      const code = validated.code && validated.code.trim() !== ""
        ? validated.code.trim()
        : getNextInvoiceCode();

      const today = new Date().toISOString().split("T")[0];
      const issueDate = validated.issueDate || today;
      const paidCents = validated.status === "PAID" ? validated.amountCents : 0;

      db.insert(invoices)
        .values({
          id,
          code,
          clientId: validated.clientId,
          title: validated.title || null,
          amountCents: validated.amountCents,
          currency: validated.currency,
          issueDate,
          dueDate: validated.dueDate || null,
          status: validated.status,
          paidCents,
        })
        .run();

      broadcastDataChanged();
      const all = listInvoicesWithClient();
      return all.find((inv) => inv.id === id)!;
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
