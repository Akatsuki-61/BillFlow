import { ipcMain } from "electron";
import crypto from "crypto";
import { eq, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { clients, invoices } from "../db/schema";
import { newClientSchema, clientPatchSchema } from "../validation";
import { AppError, formatError } from "./errors";
import { ClientWithStats, NewClientInput, ClientPatchInput } from "../../src/types/billing";

export function listClientsWithStats(): ClientWithStats[] {
  const db = getDb();
  const allClients = db.select().from(clients).orderBy(desc(clients.createdAt)).all();
  const allInvoices = db.select().from(invoices).orderBy(desc(invoices.issueDate), desc(invoices.createdAt)).all();

  return allClients.map((c) => {
    const clientInvoices = allInvoices.filter((inv) => inv.clientId === c.id);

    let totalBilledCents = 0;
    let totalPaidCents = 0;

    for (const inv of clientInvoices) {
      if (inv.status !== "DRAFT") {
        totalBilledCents += inv.amountCents;
        totalPaidCents += inv.paidCents;
      }
    }

    const outstandingBalanceCents = Math.max(0, totalBilledCents - totalPaidCents);

    const recentInvoices = clientInvoices.slice(0, 3).map((inv) => ({
      id: inv.id,
      code: inv.code,
      date: inv.issueDate,
      amountCents: inv.amountCents,
      currency: inv.currency as ClientWithStats["currency"],
      status: inv.status as ClientWithStats["recentInvoices"][number]["status"],
    }));

    return {
      ...c,
      currency: c.currency as "USD" | "LKR" | "EUR",
      totalBilledCents,
      totalPaidCents,
      outstandingBalanceCents,
      invoicesCount: clientInvoices.length,
      recentInvoices,
    };
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

  ipcMain.handle("clients:get", async (_event, id: string) => {
    try {
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

  ipcMain.handle("clients:update", async (_event, id: string, patch: ClientPatchInput) => {
    try {
      const validated = clientPatchSchema.parse(patch);
      const db = getDb();

      const existing = db.select().from(clients).where(eq(clients.id, id)).get();
      if (!existing) {
        throw new AppError("NOT_FOUND", "Client not found");
      }

      db.update(clients)
        .set({
          ...(validated.name !== undefined && { name: validated.name }),
          ...(validated.category !== undefined && { category: validated.category }),
          ...(validated.contactPerson !== undefined && { contactPerson: validated.contactPerson }),
          ...(validated.contactRole !== undefined && { contactRole: validated.contactRole }),
          ...(validated.email !== undefined && { email: validated.email }),
          ...(validated.phone !== undefined && { phone: validated.phone }),
          ...(validated.currency !== undefined && { currency: validated.currency }),
          ...(validated.driveUrl !== undefined && { driveUrl: validated.driveUrl }),
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
  });

  ipcMain.handle("clients:remove", async (_event, id: string) => {
    try {
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
          `Cannot delete client. This client is linked to ${count} invoice${count > 1 ? "s" : ""}.`
        );
      }

      db.delete(clients).where(eq(clients.id, id)).run();
      broadcastDataChanged();
      return { success: true };
    } catch (err) {
      throw formatError(err);
    }
  });
}
