import crypto from "node:crypto";
import { and, asc, eq, lte } from "drizzle-orm";
import { Notification } from "electron";
import { z } from "zod";
import { getDb } from "../db";
import { clients, invoices, recurringRules } from "../db/schema";
import {
  addDaysToDateKey,
  advanceSchedulePastDate,
} from "../recurring-schedule";
import { ipcMain } from "../security";
import { desktopNotificationsEnabled } from "../desktop-setup";
import {
  newRecurringRuleSchema,
  recurringRulePatchSchema,
} from "../validation";
import { recordActivity } from "../workspace-activity";
import { recordId } from "../workflow-validation";
import { validateInvoiceAmounts } from "../../src/lib/invoice-math";
import { formatCents } from "../../src/lib/format";
import { localDateKey } from "../../src/lib/visual-metrics";
import type { Currency } from "../../src/types/billing";
import type {
  NewRecurringRuleInput,
  RecurringCadence,
  RecurringRuleItem,
  RecurringRuleLineItem,
  RecurringRulePatchInput,
  RecurringRunResult,
} from "../../src/types/recurring";
import { AppError, formatError } from "./errors";
import {
  createInvoiceInTx,
  exportInvoicePdf,
  getInvoiceWithClient,
  getNextInvoiceCode,
} from "./invoices";

function parseItemsJson(raw: string): RecurringRuleLineItem[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RecurringRuleLineItem[]) : [];
  } catch {
    return [];
  }
}

function hydrateRecurringRules(
  rows: Array<{
    rule: typeof recurringRules.$inferSelect;
    clientName: string | null;
    clientEmail: string | null;
    lastInvoiceCode: string | null;
  }>,
): RecurringRuleItem[] {
  return rows.map((row) => ({
    id: row.rule.id,
    clientId: row.rule.clientId,
    clientName: row.clientName || "Unknown Client",
    clientEmail: row.clientEmail ?? null,
    title: row.rule.title,
    cadence: row.rule.cadence as RecurringCadence,
    dayOfMonth: row.rule.dayOfMonth ?? null,
    currency: row.rule.currency as Currency,
    items: parseItemsJson(row.rule.itemsJson),
    discountCents: row.rule.discountCents,
    taxCents: row.rule.taxCents,
    advanceCents: row.rule.advanceCents,
    amountCents: row.rule.amountCents,
    dueDays: row.rule.dueDays,
    autoStatus: row.rule.autoStatus as "DRAFT" | "UNPAID",
    autoExportPdf: Boolean(row.rule.autoExportPdf),
    notes: row.rule.notes ?? null,
    deliveryUrl: row.rule.deliveryUrl ?? null,
    paymentUrl: row.rule.paymentUrl ?? null,
    template: row.rule.template ?? null,
    nextRunDate: row.rule.nextRunDate,
    lastRunDate: row.rule.lastRunDate ?? null,
    lastInvoiceId: row.rule.lastInvoiceId ?? null,
    lastInvoiceCode: row.lastInvoiceCode ?? null,
    isActive: Boolean(row.rule.isActive),
    createdAt: row.rule.createdAt,
    updatedAt: row.rule.updatedAt,
  }));
}

export function listRecurringRules(): RecurringRuleItem[] {
  const rows = getDb()
    .select({
      rule: recurringRules,
      clientName: clients.name,
      clientEmail: clients.email,
      lastInvoiceCode: invoices.code,
    })
    .from(recurringRules)
    .leftJoin(clients, eq(recurringRules.clientId, clients.id))
    .leftJoin(invoices, eq(recurringRules.lastInvoiceId, invoices.id))
    .orderBy(asc(recurringRules.nextRunDate), asc(recurringRules.createdAt))
    .all();
  return hydrateRecurringRules(rows);
}

export function getRecurringRule(id: string): RecurringRuleItem | null {
  const rows = getDb()
    .select({
      rule: recurringRules,
      clientName: clients.name,
      clientEmail: clients.email,
      lastInvoiceCode: invoices.code,
    })
    .from(recurringRules)
    .leftJoin(clients, eq(recurringRules.clientId, clients.id))
    .leftJoin(invoices, eq(recurringRules.lastInvoiceId, invoices.id))
    .where(eq(recurringRules.id, recordId.parse(id)))
    .limit(1)
    .all();
  return hydrateRecurringRules(rows)[0] ?? null;
}

export function createRecurringRule(
  input: NewRecurringRuleInput,
): RecurringRuleItem {
  const parsed = newRecurringRuleSchema.parse(input);
  validateInvoiceAmounts(parsed);

  const db = getDb();
  const client = db
    .select()
    .from(clients)
    .where(eq(clients.id, parsed.clientId))
    .get();
  if (!client) {
    throw new AppError("CLIENT_NOT_FOUND", "The selected client does not exist.");
  }
  if (client.archivedAt) {
    throw new AppError(
      "CLIENT_ARCHIVED",
      "Restore this client before scheduling recurring retainers.",
    );
  }

  const id = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  const anchorDay =
    parsed.dayOfMonth ??
    (["monthly", "quarterly", "yearly"].includes(parsed.cadence)
      ? Number(parsed.nextRunDate.slice(8, 10))
      : null);

  db.insert(recurringRules)
    .values({
      id,
      clientId: parsed.clientId,
      title: parsed.title,
      cadence: parsed.cadence,
      dayOfMonth: anchorDay,
      currency: parsed.currency,
      itemsJson: JSON.stringify(parsed.items),
      discountCents: parsed.discountCents,
      taxCents: parsed.taxCents,
      advanceCents: parsed.advanceCents,
      amountCents: parsed.amountCents,
      dueDays: parsed.dueDays,
      autoStatus: parsed.autoStatus,
      autoExportPdf: parsed.autoExportPdf,
      notes: parsed.notes ?? null,
      deliveryUrl: parsed.deliveryUrl || null,
      paymentUrl: parsed.paymentUrl ?? null,
      template: parsed.template ?? null,
      nextRunDate: parsed.nextRunDate,
      lastRunDate: null,
      lastInvoiceId: null,
      isActive: parsed.isActive ?? true,
      createdAt: nowIso,
      updatedAt: nowIso,
    })
    .run();

  return getRecurringRule(id)!;
}

export function updateRecurringRule(
  idInput: string,
  patchInput: RecurringRulePatchInput,
): RecurringRuleItem {
  const id = recordId.parse(idInput);
  const patch = recurringRulePatchSchema.parse(patchInput);
  const existing = getDb()
    .select()
    .from(recurringRules)
    .where(eq(recurringRules.id, id))
    .get();
  if (!existing) {
    throw new AppError("NOT_FOUND", "Recurring rule not found.");
  }

  const nextClientId = patch.clientId ?? existing.clientId;
  if (patch.clientId && patch.clientId !== existing.clientId) {
    const client = getDb()
      .select()
      .from(clients)
      .where(eq(clients.id, patch.clientId))
      .get();
    if (!client) {
      throw new AppError("CLIENT_NOT_FOUND", "The selected client does not exist.");
    }
    if (client.archivedAt) {
      throw new AppError(
        "CLIENT_ARCHIVED",
        "Restore this client before assigning recurring retainers.",
      );
    }
  }

  const nextItems = patch.items ?? parseItemsJson(existing.itemsJson);
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

  const nowIso = new Date().toISOString();
  getDb()
    .update(recurringRules)
    .set({
      clientId: nextClientId,
      title: patch.title ?? existing.title,
      cadence: patch.cadence ?? existing.cadence,
      dayOfMonth:
        patch.dayOfMonth !== undefined ? patch.dayOfMonth : existing.dayOfMonth,
      currency: patch.currency ?? existing.currency,
      itemsJson: patch.items ? JSON.stringify(patch.items) : existing.itemsJson,
      discountCents: nextDiscount,
      taxCents: nextTax,
      advanceCents: nextAdvance,
      amountCents: nextAmount,
      dueDays: patch.dueDays ?? existing.dueDays,
      autoStatus: patch.autoStatus ?? existing.autoStatus,
      autoExportPdf:
        patch.autoExportPdf !== undefined
          ? patch.autoExportPdf
          : existing.autoExportPdf,
      notes: patch.notes !== undefined ? patch.notes : existing.notes,
      deliveryUrl:
        patch.deliveryUrl !== undefined
          ? patch.deliveryUrl || null
          : existing.deliveryUrl,
      paymentUrl:
        patch.paymentUrl !== undefined ? patch.paymentUrl : existing.paymentUrl,
      template:
        patch.template !== undefined ? patch.template : existing.template,
      nextRunDate: patch.nextRunDate ?? existing.nextRunDate,
      isActive:
        patch.isActive !== undefined ? patch.isActive : existing.isActive,
      updatedAt: nowIso,
    })
    .where(eq(recurringRules.id, id))
    .run();

  return getRecurringRule(id)!;
}

export function toggleRecurringRule(
  idInput: string,
  isActiveInput: boolean,
): RecurringRuleItem {
  const id = recordId.parse(idInput);
  const isActive = z.boolean().parse(isActiveInput);
  const existing = getDb()
    .select()
    .from(recurringRules)
    .where(eq(recurringRules.id, id))
    .get();
  if (!existing) {
    throw new AppError("NOT_FOUND", "Recurring rule not found.");
  }
  getDb()
    .update(recurringRules)
    .set({ isActive, updatedAt: new Date().toISOString() })
    .where(eq(recurringRules.id, id))
    .run();
  return getRecurringRule(id)!;
}

export function deleteRecurringRule(idInput: string): { success: boolean } {
  const id = recordId.parse(idInput);
  const res = getDb()
    .delete(recurringRules)
    .where(eq(recurringRules.id, id))
    .run();
  if (!res.changes) {
    throw new AppError("NOT_FOUND", "Recurring rule not found.");
  }
  return { success: true };
}

function sendRecurringNotification(
  title: string,
  invoiceCode: string,
  clientName: string,
  amountCents: number,
  currency: string,
  navigate?: (route: string) => void,
) {
  try {
    if (
      desktopNotificationsEnabled() &&
      typeof Notification === "function" &&
      (typeof Notification.isSupported !== "function" ||
        Notification.isSupported())
    ) {
      const note = new Notification({
        title: `Recurring invoice ${invoiceCode} ready`,
        body: `${clientName} · ${title} (${formatCents(amountCents, currency)})`,
      });
      if (navigate && typeof note.on === "function") {
        note.on("click", () => navigate("/invoices"));
      }
      if (typeof note.show === "function") {
        note.show();
      }
    }
  } catch {
    // Non-fatal in headless / test environments without OS notification center
  }
}

export async function generateInvoiceForRule(
  ruleIdInput: string,
  options?: {
    today?: string;
    advanceSchedule?: boolean;
    autoExport?: boolean;
    notify?: boolean;
    navigate?: (route: string) => void;
  },
): Promise<{
  rule: RecurringRuleItem;
  invoice: NonNullable<ReturnType<typeof getInvoiceWithClient>>;
  pdfPath?: string | null;
}> {
  const id = recordId.parse(ruleIdInput);
  const today = options?.today || localDateKey(new Date());
  const db = getDb();

  const { invoiceId, template, autoExport, ruleTitle } = db.transaction((tx) => {
    const rule = tx
      .select()
      .from(recurringRules)
      .where(eq(recurringRules.id, id))
      .get();
    if (!rule) {
      throw new AppError("NOT_FOUND", "Recurring rule not found.");
    }
    const items = parseItemsJson(rule.itemsJson);
    if (!items.length) {
      throw new AppError(
        "INVALID_RULE",
        "Recurring rule has no line items.",
      );
    }

    const code = getNextInvoiceCode();
    const dueDate = addDaysToDateKey(today, rule.dueDays);
    const createdInvoiceId = createInvoiceInTx(tx, {
      clientId: rule.clientId,
      code,
      title: rule.title,
      items: items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        catalogId: item.catalogId ?? undefined,
      })),
      discountCents: rule.discountCents,
      taxCents: rule.taxCents,
      advanceCents: rule.advanceCents,
      amountCents: rule.amountCents,
      currency: rule.currency as Currency,
      issueDate: today,
      dueDate,
      status: rule.autoStatus as "DRAFT" | "UNPAID",
      deliveryUrl: rule.deliveryUrl ?? undefined,
      paymentUrl: rule.paymentUrl ?? undefined,
      notes: rule.notes ?? undefined,
    });

    const nextRunDate =
      options?.advanceSchedule === false
        ? rule.nextRunDate
        : advanceSchedulePastDate(
            rule.nextRunDate <= today ? rule.nextRunDate : today,
            today,
            rule.cadence as RecurringCadence,
            rule.dayOfMonth,
          );

    tx.update(recurringRules)
      .set({
        lastRunDate: today,
        lastInvoiceId: createdInvoiceId,
        nextRunDate,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(recurringRules.id, id))
      .run();

    return {
      invoiceId: createdInvoiceId,
      template: rule.template ?? undefined,
      autoExport: Boolean(rule.autoExportPdf),
      ruleTitle: rule.title,
    };
  });

  const createdInvoice = getInvoiceWithClient(invoiceId)!;
  let pdfPath: string | null = null;
  if ((options?.autoExport ?? autoExport) && createdInvoice) {
    try {
      pdfPath = await exportInvoicePdf(invoiceId, template);
    } catch {
      pdfPath = null;
    }
  }

  recordActivity({
    kind: "recurring-generated",
    recordId: invoiceId,
    label: createdInvoice.code,
    detail: `Generated recurring invoice for ${createdInvoice.clientName} (${ruleTitle})`.slice(
      0,
      500,
    ),
  });

  if (options?.notify) {
    sendRecurringNotification(
      ruleTitle,
      createdInvoice.code,
      createdInvoice.clientName,
      createdInvoice.amountCents,
      createdInvoice.currency,
      options.navigate,
    );
  }

  return {
    rule: getRecurringRule(id)!,
    invoice: createdInvoice,
    pdfPath,
  };
}

export async function runDueRecurringRules(
  today = localDateKey(new Date()),
  options?: {
    autoExport?: boolean;
    notify?: boolean;
    navigate?: (route: string) => void;
  },
): Promise<RecurringRunResult> {
  const dueRules = getDb()
    .select({ id: recurringRules.id })
    .from(recurringRules)
    .where(
      and(
        eq(recurringRules.isActive, true),
        lte(recurringRules.nextRunDate, today),
      ),
    )
    .orderBy(asc(recurringRules.nextRunDate))
    .all();

  const generated: RecurringRunResult["generated"] = [];
  const skipped: RecurringRunResult["skipped"] = [];

  for (const row of dueRules) {
    try {
      const outcome = await generateInvoiceForRule(row.id, {
        today,
        advanceSchedule: true,
        autoExport: options?.autoExport ?? true,
        notify: options?.notify ?? true,
        navigate: options?.navigate,
      });
      generated.push({
        ruleId: row.id,
        invoiceId: outcome.invoice.id,
        invoiceCode: outcome.invoice.code,
        pdfPath: outcome.pdfPath ?? null,
      });
    } catch (error) {
      skipped.push({
        ruleId: row.id,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { generated, skipped };
}

export function registerRecurringHandlers(
  broadcastDataChanged: () => void,
  navigate?: (route: string) => void,
) {
  ipcMain.handle("recurring:list", () => {
    try {
      return listRecurringRules();
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle(
    "recurring:create",
    (_event, input: NewRecurringRuleInput) => {
      try {
        const created = createRecurringRule(input);
        broadcastDataChanged();
        return created;
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle(
    "recurring:update",
    (_event, id: string, patch: RecurringRulePatchInput) => {
      try {
        const updated = updateRecurringRule(id, patch);
        broadcastDataChanged();
        return updated;
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle(
    "recurring:toggle",
    (_event, id: string, isActive: boolean) => {
      try {
        const updated = toggleRecurringRule(id, isActive);
        broadcastDataChanged();
        return updated;
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle("recurring:remove", (_event, id: string) => {
    try {
      const res = deleteRecurringRule(id);
      broadcastDataChanged();
      return res;
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle("recurring:runNow", async (_event, id: string) => {
    try {
      const res = await generateInvoiceForRule(id, {
        advanceSchedule: true,
        autoExport: true,
        notify: false,
      });
      broadcastDataChanged();
      return res;
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle("recurring:runDue", async () => {
    try {
      const res = await runDueRecurringRules(localDateKey(new Date()), {
        autoExport: true,
        notify: true,
        navigate,
      });
      if (res.generated.length > 0) broadcastDataChanged();
      return res;
    } catch (err) {
      throw formatError(err);
    }
  });
}
