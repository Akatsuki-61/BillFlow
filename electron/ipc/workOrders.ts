import { payableAmount } from "../../src/lib/payable-math";
import { recordId } from "../workflow-validation";
import { updateTask } from "./tasks";
import { captureWorkspace } from "../workspace-session";

import { ipcMain } from "../security";
import crypto from "crypto";
import { z } from "zod";
import { eq, desc, asc, and, isNull } from "drizzle-orm";
import { getDb } from "../db";
import {
  workOrders,
  vendors,
  tasks,
  invoices,
  clients,
  vendorPayouts,
} from "../db/schema";
import {
  newWorkOrderSchema,
  workOrderPatchSchema,
  reviewWorkOrderSchema,
  recordWorkOrderPayoutSchema,
} from "../validation";
import { AppError, formatError } from "./errors";
import { generateWorkOrderPdfBuffer } from "../pdf-generator";
import { saveWorkOrderPdf, openWorkOrderPdf } from "./files";
import { getOrCreateSettings } from "./settings";
import type {
  WorkOrderItem,
  NewWorkOrderInput,
  WorkOrderPatchInput,
  ReviewWorkOrderInput,
  RecordWorkOrderPayoutInput,
} from "../../src/types/outsourcing";

/**
 * Lists all payable work orders with hydrated vendor, task, invoice, and client details.
 * Tracks contractor work status and payout status separately.
 */
export function listWorkOrders(filter?: {
  vendorId?: string;
  taskId?: string;
  invoiceId?: string;
}): WorkOrderItem[] {
  const db = getDb();
  let query = db.select().from(workOrders).orderBy(desc(workOrders.id)).all();

  if (filter?.vendorId) {
    query = query.filter((wo) => wo.vendorId === filter.vendorId);
  }
  if (filter?.taskId) {
    query = query.filter((wo) => wo.taskId === filter.taskId);
  }
  if (filter?.invoiceId) {
    query = query.filter((wo) => wo.invoiceId === filter.invoiceId);
  }

  // Pre-load lookup maps for fast hydration
  const allVendors = db.select().from(vendors).all();
  const vendorMap = new Map(allVendors.map((v) => [v.id, v]));

  const allTasks = db.select().from(tasks).all();
  const taskMap = new Map(allTasks.map((t) => [t.id, t]));

  const allInvoices = db.select().from(invoices).all();
  const invoiceMap = new Map(allInvoices.map((i) => [i.id, i]));

  const allClients = db.select().from(clients).all();
  const clientMap = new Map(allClients.map((c) => [c.id, c.name]));

  const allPayouts = db
    .select()
    .from(vendorPayouts)
    .orderBy(asc(vendorPayouts.paidAt), asc(vendorPayouts.id))
    .all();
  const payoutMap = new Map<string, WorkOrderItem["payouts"]>();
  for (const payout of allPayouts) {
    const ledger = payoutMap.get(payout.workOrderId) ?? [];
    ledger.push({
      ...payout,
      currency: payout.currency as WorkOrderItem["currency"],
    });
    payoutMap.set(payout.workOrderId, ledger);
  }

  return query.map((wo) => {
    const v = wo.vendorId ? vendorMap.get(wo.vendorId) : wo.vendorSnapshot;
    const t = wo.taskId ? taskMap.get(wo.taskId) : undefined;
    const inv = wo.invoiceId ? invoiceMap.get(wo.invoiceId) : undefined;
    const payouts = payoutMap.get(wo.id) ?? [];
    const active = payouts.filter((payout) => !payout.voidedAt);
    const paid = active.reduce((sum, payout) => sum + payout.amountCents, 0);
    const remaining = Math.max(0, wo.feeCents - paid);
    const latest = active.at(-1);

    let clientName = t?.clientName;
    if (!clientName && inv?.clientId) {
      clientName = clientMap.get(inv.clientId);
    }
    if (!clientName && inv?.clientSnapshot) {
      try {
        const snap = JSON.parse(inv.clientSnapshot);
        clientName = snap?.name;
      } catch {
        // ignore snapshot parse errors
      }
    }

    return {
      id: wo.id,
      vendorId: wo.vendorId,
      taskId: wo.taskId,
      invoiceId: wo.invoiceId,
      scope: wo.scope,
      createdAt: wo.createdAt ?? undefined,
      vendorSnapshot: wo.vendorSnapshot,
      items: wo.items,
      discountCents: wo.discountCents,
      paypalUrl: wo.paypalUrl,
      stripeUrl: wo.stripeUrl,
      feeCents: wo.feeCents,
      currency: wo.currency as WorkOrderItem["currency"],
      dueDate: wo.dueDate,
      payoutDueDate: wo.payoutDueDate,
      status: (wo.status as WorkOrderItem["status"]) || "todo",
      completedAt: wo.completedAt,
      deliveryUrl: wo.deliveryUrl || t?.deliveryUrl || null,
      notes: wo.notes || null,
      vendorName: v?.name || "Unknown Contractor",
      vendorService: v?.service ?? undefined,
      vendorEmail: v?.email,
      vendorPhone: v?.phone,
      vendorBillingAddress: v?.billingAddress,
      vendorIconType: wo.vendorId
        ? vendorMap.get(wo.vendorId)?.iconType
        : undefined,
      taskTitle: t?.title || wo.scope,
      invoiceCode: inv?.code,
      clientId: inv?.clientId || t?.clientId || null,
      clientName: clientName || undefined,
      payoutStatus: remaining === 0 ? "PAID" : "PENDING",
      payoutId: latest?.id ?? null,
      paidAt: latest?.paidAt ?? null,
      payoutAmountCents: paid,
      remainingPayoutCents: remaining,
      payouts,
    };
  });
}

export function getWorkOrder(id: string): WorkOrderItem | null {
  const all = listWorkOrders();
  return all.find((wo) => wo.id === id) || null;
}

/**
 * Creates a work order linking a reusable vendor to a source task and client invoice.
 * Updates task outsource flags and vendor balances transactionally.
 */
export function createWorkOrder(
  input: NewWorkOrderInput,
  broadcastDataChanged?: () => void,
): WorkOrderItem {
  const validated = newWorkOrderSchema.parse(input);
  if (validated.taskId && !validated.invoiceId) {
    const source = getDb()
      .select()
      .from(tasks)
      .where(eq(tasks.id, validated.taskId))
      .get();
    validated.invoiceId = source?.invoiceId || null;
  }
  const db = getDb();

  // Validate relationships exist
  const vendor = validated.vendorId
    ? db.select().from(vendors).where(eq(vendors.id, validated.vendorId)).get()
    : undefined;
  if (validated.vendorId && !vendor)
    throw new AppError("NOT_FOUND", "Vendor not found.");
  if (vendor?.archivedAt)
    throw new AppError(
      "VENDOR_ARCHIVED",
      "Restore this vendor before creating a new work order.",
    );
  const task = validated.taskId
    ? db.select().from(tasks).where(eq(tasks.id, validated.taskId)).get()
    : undefined;
  const invoice = validated.invoiceId
    ? db
        .select()
        .from(invoices)
        .where(eq(invoices.id, validated.invoiceId))
        .get()
    : undefined;
  if (validated.taskId && (!task || task.deletedAt))
    throw new AppError("NOT_FOUND", "Task not found.");
  if (validated.invoiceId && (!invoice || invoice.trashedAt))
    throw new AppError("NOT_FOUND", "Invoice not found.");
  if (
    task &&
    invoice &&
    ((task.invoiceId && task.invoiceId !== invoice.id) ||
      (task.clientId && task.clientId !== invoice.clientId) ||
      task.currency !== invoice.currency)
  )
    throw new AppError(
      "SOURCE_MISMATCH",
      "Contractor work must reference the task's invoice and client.",
    );
  const fee = validated.items
    ? payableAmount(validated.items, validated.discountCents)
    : validated.feeCents;
  if (!validated.items && validated.discountCents)
    throw new AppError(
      "INVALID_DISCOUNT",
      "Add line items before applying a discount.",
    );

  const id = validated.id || crypto.randomUUID();
  db.transaction((tx) => {
    tx.insert(workOrders)
      .values({
        ...validated,
        id,
        feeCents: fee,
        createdAt: new Date().toISOString(),
        deliveryUrl: validated.deliveryUrl || task?.deliveryUrl || null,
      })
      .run();
    if (task) {
      tx.update(tasks)
        .set({
          isOutsourced: true,
          outsourcedVendor: vendor?.name ?? validated.vendorSnapshot?.name,
          outsourceBudgetCents: fee,
          invoiceId: invoice?.id || task.invoiceId,
          clientId: invoice?.clientId || task.clientId,
          deliveryUrl: validated.deliveryUrl || task.deliveryUrl,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tasks.id, task.id))
        .run();
    }
    if (vendor) {
      tx.update(vendors)
        .set({
          balanceCents: vendor.balanceCents + fee,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(vendors.id, vendor.id))
        .run();
    }
  });

  broadcastDataChanged?.();
  const created = getWorkOrder(id);
  if (!created)
    throw new AppError("INTERNAL", "Failed to retrieve created work order.");
  return created;
}

/**
 * Updates an existing work order.
 * Contractor work progress (todo/in-progress/review/done), deliveryUrl, and notes
 * are updated independently from payout entries.
 */
export function updateWorkOrder(
  id: string,
  patch: WorkOrderPatchInput,
  broadcastDataChanged?: () => void,
): WorkOrderItem {
  const validated = workOrderPatchSchema.parse(patch);
  const db = getDb();

  const existing = db
    .select()
    .from(workOrders)
    .where(eq(workOrders.id, id))
    .get();
  if (!existing) {
    throw new AppError("NOT_FOUND", "Work order not found");
  }

  const payout = db
    .select()
    .from(vendorPayouts)
    .where(eq(vendorPayouts.workOrderId, id))
    .get();
  if (validated.currency && validated.currency !== existing.currency && payout)
    throw new AppError(
      "HAS_PAYOUT",
      "Voucher currency cannot change after payout.",
    );
  const paid = getWorkOrder(id)?.payoutAmountCents ?? 0;
  const items =
    validated.items === undefined ? existing.items : validated.items;
  const discount = validated.discountCents ?? existing.discountCents;
  if (!items && discount)
    throw new AppError(
      "INVALID_DISCOUNT",
      "Add line items before applying a discount.",
    );
  const fee = items
    ? payableAmount(items, discount)
    : (validated.feeCents ?? existing.feeCents);
  if (fee < paid && fee !== existing.feeCents)
    throw new AppError(
      "FEE_BELOW_PAYOUTS",
      "The fee cannot be lower than the payouts already recorded.",
    );
  const updateData: Record<string, unknown> = {};
  if (validated.vendorSnapshot) {
    if (existing.vendorId)
      throw new AppError("VENDOR_LINK", "Edit this vendor in the directory.");
    updateData.vendorSnapshot = validated.vendorSnapshot;
  }
  if (fee !== existing.feeCents) updateData.feeCents = fee;
  if (validated.items !== undefined) updateData.items = items;
  if (validated.discountCents !== undefined)
    updateData.discountCents = discount;
  if (validated.paypalUrl !== undefined)
    updateData.paypalUrl = validated.paypalUrl;
  if (validated.stripeUrl !== undefined)
    updateData.stripeUrl = validated.stripeUrl;
  if (validated.payoutDueDate !== undefined)
    updateData.payoutDueDate = validated.payoutDueDate;
  if (validated.scope !== undefined) updateData.scope = validated.scope;
  if (validated.currency !== undefined)
    updateData.currency = validated.currency;
  if (validated.dueDate !== undefined) updateData.dueDate = validated.dueDate;
  if (validated.notes !== undefined) updateData.notes = validated.notes;
  if (validated.deliveryUrl !== undefined)
    updateData.deliveryUrl = validated.deliveryUrl;

  if (validated.status !== undefined) {
    updateData.status = validated.status;
    if (validated.status === "done" && !existing.completedAt) {
      updateData.completedAt = new Date().toISOString();
    }
  }
  if (validated.completedAt !== undefined)
    updateData.completedAt = validated.completedAt;

  db.transaction(() => {
    if (Object.keys(updateData).length > 0) {
      db.update(workOrders).set(updateData).where(eq(workOrders.id, id)).run();
    }

    if (existing.taskId && fee !== existing.feeCents) {
      db.update(tasks)
        .set({ outsourceBudgetCents: fee, updatedAt: new Date().toISOString() })
        .where(eq(tasks.id, existing.taskId))
        .run();
    }
    if (existing.taskId && validated.updateTask) {
      const deliveryUrl =
        validated.deliveryUrl === undefined
          ? existing.deliveryUrl
          : validated.deliveryUrl;
      const status =
        validated.taskStatus ??
        (validated.status === "done" || validated.status === "review"
          ? validated.status
          : undefined);
      if (deliveryUrl || status)
        updateTask(existing.taskId, {
          ...(deliveryUrl && { deliveryUrl }),
          ...(status && { status }),
        });
    }

    if (validated.payoutStatus === "PAID")
      recordWorkOrderPayout({ workOrderId: id });
    else if (validated.payoutStatus === "PENDING") removeWorkOrderPayout(id);
  });

  broadcastDataChanged?.();
  const updated = getWorkOrder(id);
  if (!updated)
    throw new AppError("INTERNAL", "Failed to retrieve updated work order.");
  return updated;
}

/**
 * Reviews contractor work, saves delivered URL & notes, and updates the original task after review.
 */
export function reviewWorkOrder(
  input: ReviewWorkOrderInput,
  broadcastDataChanged?: () => void,
): WorkOrderItem {
  const validated = reviewWorkOrderSchema.parse(input);
  return updateWorkOrder(
    validated.workOrderId,
    {
      status: validated.status,
      deliveryUrl: validated.deliveryUrl,
      notes: validated.notes,
      updateTask: validated.updateTask,
      taskStatus: validated.status,
    },
    broadcastDataChanged,
  );
}

/**
 * Records a vendor payout entry in SQLite `vendor_payouts` ledger.
 * Tracked separately from contractor deliverable progress.
 */
export function recordWorkOrderPayout(
  input: RecordWorkOrderPayoutInput,
  broadcastDataChanged?: () => void,
): WorkOrderItem {
  const validated = recordWorkOrderPayoutSchema.parse(input);
  const db = getDb();
  const existing = db
    .select()
    .from(workOrders)
    .where(eq(workOrders.id, validated.workOrderId))
    .get();
  if (!existing) {
    throw new AppError("NOT_FOUND", "Work order not found");
  }

  if (validated.currency && validated.currency !== existing.currency)
    throw new AppError(
      "CURRENCY_MISMATCH",
      "Payout currency must match the voucher.",
    );
  db.transaction((tx) => {
    const requestId = validated.requestId ?? crypto.randomUUID();
    const previous = tx
      .select()
      .from(vendorPayouts)
      .where(eq(vendorPayouts.requestId, requestId))
      .get();
    if (previous) {
      if (
        previous.workOrderId !== existing.id ||
        (validated.amountCents !== undefined &&
          previous.amountCents !== validated.amountCents) ||
        (validated.paidAt !== undefined && previous.paidAt !== validated.paidAt)
      )
        throw new AppError(
          "REQUEST_CONFLICT",
          "This payout request was already used with different details.",
        );
      return;
    }

    const active = tx
      .select()
      .from(vendorPayouts)
      .where(
        and(
          eq(vendorPayouts.workOrderId, existing.id),
          isNull(vendorPayouts.voidedAt),
        ),
      )
      .all();
    const remaining = Math.max(
      0,
      existing.feeCents -
        active.reduce((sum, payout) => sum + payout.amountCents, 0),
    );
    if (remaining === 0 && validated.amountCents === undefined) return;
    const amountCents = validated.amountCents ?? remaining;
    if (amountCents > remaining)
      throw new AppError(
        "PAYOUT_EXCEEDS_BALANCE",
        "The payout cannot exceed the remaining work order balance.",
      );
    tx.insert(vendorPayouts)
      .values({
        id: requestId,
        workOrderId: existing.id,
        amountCents,
        currency: existing.currency,
        paidAt: validated.paidAt ?? new Date().toISOString(),
        requestId,
      })
      .run();
  });

  broadcastDataChanged?.();
  const updated = getWorkOrder(validated.workOrderId);
  if (!updated)
    throw new AppError("INTERNAL", "Failed to retrieve work order.");
  return updated;
}

/**
 * Voids the active vendor payout while retaining its ledger entry and attached receipts,
 * reverting payoutStatus to PENDING without modifying contractor work status.
 */
export function removeWorkOrderPayout(
  workOrderId: string,
  broadcastDataChanged?: () => void,
  payoutId?: string,
): WorkOrderItem {
  const db = getDb();
  const existing = db
    .select()
    .from(workOrders)
    .where(eq(workOrders.id, workOrderId))
    .get();
  if (!existing) {
    throw new AppError("NOT_FOUND", "Work order not found");
  }

  db.transaction((tx) => {
    tx.update(vendorPayouts)
      .set({ voidedAt: new Date().toISOString() })
      .where(
        and(
          eq(vendorPayouts.workOrderId, workOrderId),
          isNull(vendorPayouts.voidedAt),
          payoutId ? eq(vendorPayouts.id, payoutId) : undefined,
        ),
      )
      .run();
  });

  broadcastDataChanged?.();
  const updated = getWorkOrder(workOrderId);
  if (!updated)
    throw new AppError("INTERNAL", "Failed to retrieve work order.");
  return updated;
}

/**
 * Toggles payout status while preserving previous ledger entries.
 */
export function setWorkOrderPayoutStatus(
  id: string,
  status: "PENDING" | "PAID",
  broadcastDataChanged?: () => void,
): WorkOrderItem {
  if (status !== "PAID" && status !== "PENDING")
    throw new AppError("INVALID_STATUS", "Select a valid payout status.");
  if (status === "PAID") {
    return recordWorkOrderPayout({ workOrderId: id }, broadcastDataChanged);
  } else {
    return removeWorkOrderPayout(id, broadcastDataChanged);
  }
}

/**
 * Deletes a work order and resets task outsource flags.
 */
export function removeWorkOrder(
  id: string,
  broadcastDataChanged?: () => void,
): { success: boolean } {
  const db = getDb();
  const existing = db
    .select()
    .from(workOrders)
    .where(eq(workOrders.id, id))
    .get();
  if (!existing) {
    throw new AppError("NOT_FOUND", "Work order not found");
  }

  db.transaction((tx) => {
    if (
      tx
        .select()
        .from(vendorPayouts)
        .where(eq(vendorPayouts.workOrderId, id))
        .get()
    )
      throw new AppError(
        "HAS_PAYOUT",
        "Work orders with payout history cannot be deleted. Corrected settlements and receipts are retained.",
      );
    // 2. Remove work order
    tx.delete(workOrders).where(eq(workOrders.id, id)).run();

    // 3. Reset task outsource state
    if (existing.taskId)
      tx.update(tasks)
        .set({
          isOutsourced: false,
          outsourcedVendor: null,
          outsourceBudgetCents: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tasks.id, existing.taskId))
        .run();
  });

  broadcastDataChanged?.();
  return { success: true };
}

/**
 * Generates and saves a formal PDF voucher for a work order.
 */
export async function exportWorkOrderPdf(id: string): Promise<string> {
  const workspace = captureWorkspace();
  const wo = getWorkOrder(id);
  if (!wo) throw new AppError("NOT_FOUND", "Work order not found");

  const db = getDb();
  const task = wo.taskId
    ? db.select().from(tasks).where(eq(tasks.id, wo.taskId)).get()
    : undefined;
  const profile = getOrCreateSettings();

  const pdfBuffer = await generateWorkOrderPdfBuffer({
    voucherNumber: wo.id.slice(-8).toUpperCase(),
    scope: wo.scope,
    items: wo.items,
    discountCents: wo.discountCents,
    paidCents: wo.payoutAmountCents ?? 0,
    payoutDueDate: wo.payoutDueDate,
    paypalUrl: wo.paypalUrl,
    stripeUrl: wo.stripeUrl,
    feeCents: wo.feeCents,
    currency: wo.currency,
    status: wo.status,
    payoutStatus: wo.payoutStatus || "PENDING",
    dueDate: wo.dueDate,
    completedAt: wo.completedAt,
    paidAt: wo.paidAt,
    deliveryUrl: wo.deliveryUrl,
    notes: wo.notes,
    vendor: {
      name: wo.vendorName || "Contractor",
      service: wo.vendorService,
      email: wo.vendorEmail,
      phone: wo.vendorPhone,
      billingAddress: wo.vendorBillingAddress,
    },
    task: {
      title: task?.title || wo.taskTitle,
      category: task?.category,
    },
    parentInvoice: {
      code: wo.invoiceCode,
      clientName: wo.clientName,
    },
    business: {
      businessName: profile.businessName,
      professionalTitle: profile.professionalTitle,
      email: profile.email,
      phone: profile.phone,
      website: profile.website,
      address: profile.address,
    },
  });

  workspace.assertCurrent();
  return saveWorkOrderPdf(wo.id, pdfBuffer);
}

/**
 * Registers work order IPC handlers on the electron main process.
 */
const workOrderListFilterSchema = z
  .object({
    vendorId: recordId.optional(),
    taskId: recordId.optional(),
    invoiceId: recordId.optional(),
  })
  .optional();

export function registerWorkOrderHandlers(broadcastDataChanged: () => void) {
  ipcMain.handle(
    "workOrders:list",
    async (
      _event,
      filter?: { vendorId?: string; taskId?: string; invoiceId?: string },
    ) => {
      try {
        return listWorkOrders(workOrderListFilterSchema.parse(filter));
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle("workOrders:get", async (_event, id: string) => {
    try {
      const wo = getWorkOrder(recordId.parse(id));
      if (!wo) throw new AppError("NOT_FOUND", "Work order not found");
      return wo;
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle(
    "workOrders:create",
    async (_event, input: NewWorkOrderInput) => {
      try {
        return createWorkOrder(input, broadcastDataChanged);
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle(
    "workOrders:update",
    async (_event, id: string, patch: WorkOrderPatchInput) => {
      try {
        return updateWorkOrder(recordId.parse(id), patch, broadcastDataChanged);
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle(
    "workOrders:review",
    async (_event, input: ReviewWorkOrderInput) => {
      try {
        return reviewWorkOrder(input, broadcastDataChanged);
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle(
    "workOrders:recordPayout",
    async (_event, input: RecordWorkOrderPayoutInput) => {
      try {
        return recordWorkOrderPayout(input, broadcastDataChanged);
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle(
    "workOrders:removePayout",
    async (_event, workOrderId: string, payoutId?: string) => {
      try {
        return removeWorkOrderPayout(
          recordId.parse(workOrderId),
          broadcastDataChanged,
          payoutId === undefined ? undefined : recordId.parse(payoutId),
        );
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle(
    "workOrders:setPayoutStatus",
    async (_event, id: string, status: "PENDING" | "PAID") => {
      try {
        return setWorkOrderPayoutStatus(
          recordId.parse(id),
          z.enum(["PENDING", "PAID"]).parse(status),
          broadcastDataChanged,
        );
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle("workOrders:remove", async (_event, id: string) => {
    try {
      return removeWorkOrder(recordId.parse(id), broadcastDataChanged);
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle("workOrders:exportPdf", async (_event, id: string) => {
    try {
      const filePath = await exportWorkOrderPdf(recordId.parse(id));
      return { success: true, filePath };
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle(
    "workOrders:openPdf",
    async (_event, filePath: string, reveal?: boolean) => {
      try {
        await openWorkOrderPdf(filePath, reveal);
        return { success: true };
      } catch (err) {
        throw formatError(err);
      }
    },
  );
}
