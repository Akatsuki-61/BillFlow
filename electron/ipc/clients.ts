import { ipcMain } from "../security";
import crypto from "crypto";
import { eq, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { clients, invoices, tasks, vendors } from "../db/schema";
import { newClientSchema, clientPatchSchema } from "../validation";
import { recordId } from "../workflow-validation";
import { AppError, formatError } from "./errors";
import {
  ClientWithStats,
  NewClientInput,
  ClientPatchInput,
} from "../../src/types/billing";

export function listClientsWithStats(): ClientWithStats[] {
  const db = getDb();
  const allClients = db
    .select()
    .from(clients)
    .orderBy(desc(clients.createdAt))
    .all();
  const allInvoices = db
    .select()
    .from(invoices)
    .orderBy(desc(invoices.issueDate), desc(invoices.createdAt))
    .all();

  const invoiceMap = new Map<string, typeof allInvoices>();
  for (const invoice of allInvoices) {
    if (!invoice.clientId) continue;
    const list = invoiceMap.get(invoice.clientId) || [];
    list.push(invoice);
    invoiceMap.set(invoice.clientId, list);
  }
  return allClients.map((c) => {
    const linked = invoiceMap.get(c.id) || [];
    const totalsByCurrency: NonNullable<ClientWithStats["totalsByCurrency"]> =
      {};
    for (const invoice of linked)
      if (invoice.status !== "DRAFT") {
        const currency = invoice.currency as ClientWithStats["currency"];
        const totals = (totalsByCurrency[currency] ||= {
          billed: 0,
          paid: 0,
          outstanding: 0,
        });
        totals.billed += invoice.amountCents;
        totals.paid += invoice.paidCents;
        totals.outstanding += Math.max(
          0,
          invoice.amountCents - invoice.paidCents,
        );
      }
    const preferred = totalsByCurrency[
      c.currency as ClientWithStats["currency"]
    ] || { billed: 0, paid: 0, outstanding: 0 };
    return {
      ...c,
      currency: c.currency as ClientWithStats["currency"],
      totalsByCurrency,
      totalBilledCents: preferred.billed,
      totalPaidCents: preferred.paid,
      outstandingBalanceCents: preferred.outstanding,
      invoicesCount: linked.length,
      recentInvoices: linked.slice(0, 3).map((invoice) => ({
        id: invoice.id,
        code: invoice.code,
        date: invoice.issueDate,
        amountCents: invoice.amountCents,
        currency: invoice.currency as ClientWithStats["currency"],
        status:
          invoice.status as ClientWithStats["recentInvoices"][number]["status"],
      })),
    };
  });
}

export function removeClient(idInput: string): { success: boolean } {
  const id = recordId.parse(idInput);
  const db = getDb();
  const countRes = db
    .select({ count: sql<number>`count(*)` })
    .from(invoices)
    .where(eq(invoices.clientId, id))
    .get();

  const count = countRes?.count || 0;
  if (count > 0) {
    throw new AppError(
      "CLIENT_HAS_INVOICES",
      `Cannot delete client. This client is linked to ${count} invoice${count > 1 ? "s" : ""}.`,
    );
  }

  return db.transaction((tx) => {
    tx.update(tasks)
      .set({ clientId: null })
      .where(eq(tasks.clientId, id))
      .run();
    tx.update(vendors)
      .set({ linkedClientId: null })
      .where(eq(vendors.linkedClientId, id))
      .run();
    tx.delete(clients).where(eq(clients.id, id)).run();
    return { success: true };
  });
}

export function registerClientHandlers(broadcastDataChanged: () => void) {
  ipcMain.handle("clients:list", async () => {
    try {
      return listClientsWithStats();
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle("clients:get", async (_event, idInput: string) => {
    try {
      const id = recordId.parse(idInput);
      const all = listClientsWithStats();
      const found = all.find((c) => c.id === id);
      if (!found) throw new AppError("NOT_FOUND", "Client not found");
      return found;
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle("clients:create", async (_event, input: NewClientInput) => {
    try {
      const validated = newClientSchema.parse(input);
      const db = getDb();
      const id = crypto.randomUUID();

      db.insert(clients)
        .values({
          id,
          name: validated.name,
          category: validated.category,
          contactPerson: validated.contactPerson || validated.name,
          contactRole: validated.contactRole || null,
          email: validated.email,
          phone: validated.phone || null,
          currency: validated.currency,
          driveUrl: validated.driveUrl || null,
          hasQuickBill: true,
        })
        .run();

      broadcastDataChanged();
      const created = listClientsWithStats().find((c) => c.id === id);
      return created!;
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle(
    "clients:update",
    async (_event, idInput: string, patch: ClientPatchInput) => {
      try {
        const id = recordId.parse(idInput);
        const validated = clientPatchSchema.parse(patch);
        const db = getDb();

        const existing = db
          .select()
          .from(clients)
          .where(eq(clients.id, id))
          .get();
        if (!existing) {
          throw new AppError("NOT_FOUND", "Client not found");
        }

        db.update(clients)
          .set({
            ...(validated.name !== undefined && { name: validated.name }),
            ...(validated.category !== undefined && {
              category: validated.category,
            }),
            ...(validated.contactPerson !== undefined && {
              contactPerson: validated.contactPerson,
            }),
            ...(validated.contactRole !== undefined && {
              contactRole: validated.contactRole,
            }),
            ...(validated.email !== undefined && { email: validated.email }),
            ...(validated.phone !== undefined && { phone: validated.phone }),
            ...(validated.currency !== undefined && {
              currency: validated.currency,
            }),
            ...(validated.driveUrl !== undefined && {
              driveUrl: validated.driveUrl,
            }),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(clients.id, id))
          .run();

        broadcastDataChanged();
        const updated = listClientsWithStats().find((c) => c.id === id);
        return updated!;
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle("clients:remove", async (_event, id: string) => {
    try {
      const result = removeClient(id);
      broadcastDataChanged();
      return result;
    } catch (err) {
      throw formatError(err);
    }
  });
}
