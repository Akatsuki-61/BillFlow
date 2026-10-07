import { ipcMain } from "electron";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getDb } from "../db";
import { expenses, attachments } from "../db/schema";
import { newExpenseSchema, expensePatchSchema } from "../validation";
import { recordId } from "../workflow-validation";
import { AppError } from "./errors";
import type { ExpenseItem, NewExpenseInput, ExpensePatchInput } from "../../src/types/expenses";
import type { Currency } from "../../src/types/billing";

export function listExpenses(filter?: { category?: string; invoiceId?: string }): ExpenseItem[] {
  const db = getDb();
  const allExpenses = db.select().from(expenses).orderBy(desc(expenses.incurredAt), desc(expenses.createdAt)).all();

  const allAttachments = db.select().from(attachments).all();
  const attachmentsByExpenseId = new Map<string, typeof allAttachments>();

  for (const att of allAttachments) {
    if (att.expenseId) {
      const list = attachmentsByExpenseId.get(att.expenseId) || [];
      list.push(att);
      attachmentsByExpenseId.set(att.expenseId, list);
    }
  }

  return allExpenses
    .filter(exp => {
      if (filter?.category && filter.category !== "All Categories" && exp.category !== filter.category) return false;
      if (filter?.invoiceId && exp.invoiceId !== filter.invoiceId) return false;
      return true;
    })
    .map(exp => {
      const atts = (attachmentsByExpenseId.get(exp.id) || []).map(att => ({
        id: att.id,
        paymentId: att.paymentId,
        expenseId: att.expenseId,
        payoutId: att.payoutId,
        originalName: att.originalName,
        mimeType: att.mimeType,
        sizeBytes: att.sizeBytes,
        createdAt: att.createdAt,
      }));

      return {
        id: exp.id,
        invoiceId: exp.invoiceId || null,
        merchant: exp.merchant,
        description: exp.description,
        category: exp.category,
        amountCents: exp.amountCents,
        currency: exp.currency as Currency,
        incurredAt: exp.incurredAt,
        deductible: Boolean(exp.deductible),
        createdAt: exp.createdAt,
        attachments: atts,
      };
    });
}

export function createExpense(input: NewExpenseInput, broadcast?: () => void): ExpenseItem {
  const parsed = newExpenseSchema.parse(input);
  const db = getDb();
  const id = parsed.requestId || `exp-${randomUUID()}`;

  const existing = db.select().from(expenses).where(eq(expenses.id, id)).get();
  if (existing) {
    const atts = db.select().from(attachments).where(eq(attachments.expenseId, id)).all();
    return {
      id: existing.id,
      invoiceId: existing.invoiceId || null,
      merchant: existing.merchant,
      description: existing.description,
      category: existing.category,
      amountCents: existing.amountCents,
      currency: existing.currency as Currency,
      incurredAt: existing.incurredAt,
      deductible: Boolean(existing.deductible),
      createdAt: existing.createdAt,
      attachments: atts.map(att => ({
        id: att.id,
        paymentId: att.paymentId,
        expenseId: att.expenseId,
        payoutId: att.payoutId,
        originalName: att.originalName,
        mimeType: att.mimeType,
        sizeBytes: att.sizeBytes,
        createdAt: att.createdAt,
      })),
    };
  }

  const newRow = {
    id,
    invoiceId: parsed.invoiceId || null,
    merchant: parsed.merchant,
    description: parsed.description || "",
    category: parsed.category,
    amountCents: parsed.amountCents,
    currency: parsed.currency,
    incurredAt: parsed.incurredAt,
    deductible: parsed.deductible,
    createdAt: new Date().toISOString(),
  };

  db.insert(expenses).values(newRow).run();
  if (broadcast) broadcast();

  return {
    ...newRow,
    currency: newRow.currency as Currency,
    attachments: [],
  };
}

export function updateExpense(idInput: string, patchInput: ExpensePatchInput, broadcast?: () => void): ExpenseItem {
  const id = recordId.parse(idInput);
  const patch = expensePatchSchema.parse(patchInput);
  const db = getDb();

  const existing = db.select().from(expenses).where(eq(expenses.id, id)).get();
  if (!existing) throw new AppError("NOT_FOUND", "Expense record not found.");

  const updateValues: Partial<typeof existing> = {};
  if (patch.merchant !== undefined) updateValues.merchant = patch.merchant;
  if (patch.description !== undefined) updateValues.description = patch.description;
  if (patch.category !== undefined) updateValues.category = patch.category;
  if (patch.amountCents !== undefined) updateValues.amountCents = patch.amountCents;
  if (patch.currency !== undefined) updateValues.currency = patch.currency;
  if (patch.incurredAt !== undefined) updateValues.incurredAt = patch.incurredAt;
  if (patch.deductible !== undefined) updateValues.deductible = patch.deductible;
  if (patch.invoiceId !== undefined) updateValues.invoiceId = patch.invoiceId;

  if (Object.keys(updateValues).length > 0) {
    db.update(expenses).set(updateValues).where(eq(expenses.id, id)).run();
    if (broadcast) broadcast();
  }

  return listExpenses().find(e => e.id === id)!;
}

export function removeExpense(idInput: string, broadcast?: () => void): { success: boolean } {
  const id = recordId.parse(idInput);
  const db = getDb();

  const existing = db.select().from(expenses).where(eq(expenses.id, id)).get();
  if (!existing) throw new AppError("NOT_FOUND", "Expense record not found.");

  db.delete(attachments).where(eq(attachments.expenseId, id)).run();
  db.delete(expenses).where(eq(expenses.id, id)).run();

  if (broadcast) broadcast();
  return { success: true };
}

export function registerExpenseHandlers(broadcast: () => void) {
  ipcMain.handle("expenses:list", (_e, filter?: { category?: string; invoiceId?: string }) => listExpenses(filter));
  ipcMain.handle("expenses:create", (_e, input: NewExpenseInput) => createExpense(input, broadcast));
  ipcMain.handle("expenses:update", (_e, id: string, patch: ExpensePatchInput) => updateExpense(id, patch, broadcast));
  ipcMain.handle("expenses:remove", (_e, id: string) => removeExpense(id, broadcast));
}
