import { ipcMain } from "electron";
import crypto from "crypto";
import { eq, desc } from "drizzle-orm";
import { getDb } from "../db";
import {
  workOrders,
  vendors,
  tasks,
  invoices,
  clients,
  vendorPayouts,
  attachments,
} from "../db/schema";
import {
  newWorkOrderSchema,
  workOrderPatchSchema,
  reviewWorkOrderSchema,
  recordWorkOrderPayoutSchema,
} from "../validation";
import { AppError, formatError } from "./errors";
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

  const allPayouts = db.select().from(vendorPayouts).all();
  const payoutMap = new Map(allPayouts.map((p) => [p.workOrderId, p]));

  return query.map((wo) => {
    const v = vendorMap.get(wo.vendorId);
    const t = taskMap.get(wo.taskId);
    const inv = invoiceMap.get(wo.invoiceId);
    const payout = payoutMap.get(wo.id);

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
      feeCents: wo.feeCents,
      currency: wo.currency as WorkOrderItem["currency"],
      dueDate: wo.dueDate,
      status: (wo.status as WorkOrderItem["status"]) || "todo",
      completedAt: wo.completedAt,
      deliveryUrl: wo.deliveryUrl || t?.deliveryUrl || null,
      notes: wo.notes || null,
      vendorName: v?.name || "Unknown Contractor",
      vendorService: v?.service,
      vendorEmail: v?.email,
      vendorPhone: v?.phone,
      vendorIconType: v?.iconType as WorkOrderItem["vendorIconType"],
      taskTitle: t?.title || "Deliverable Task",
      invoiceCode: inv?.code || "INV-000",
      clientId: inv?.clientId || t?.clientId || null,
      clientName: clientName || "Client Account",
      payoutStatus: payout ? "PAID" : "PENDING",
      payoutId: payout?.id || null,
      paidAt: payout?.paidAt || null,
      payoutAmountCents: payout?.amountCents || null,
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
  const db = getDb();

  // Validate relationships exist
  const vendor = db
    .select()
    .from(vendors)
    .where(eq(vendors.id, validated.vendorId))
    .get();
  if (!vendor) {
    throw new AppError("NOT_FOUND", `Vendor with ID ${validated.vendorId} not found.`);
  }

  const task = db
    .select()
    .from(tasks)
    .where(eq(tasks.id, validated.taskId))
    .get();
  if (!task) {
    throw new AppError("NOT_FOUND", `Task with ID ${validated.taskId} not found.`);
  }

  const invoice = db
    .select()
    .from(invoices)
    .where(eq(invoices.id, validated.invoiceId))
    .get();
  if (!invoice) {
    throw new AppError("NOT_FOUND", `Invoice with ID ${validated.invoiceId} not found.`);
  }

  const id =
    validated.id ||
    `wo-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

  db.transaction(() => {
    // 1. Insert into work_orders
    db.insert(workOrders)
      .values({
        id,
        vendorId: validated.vendorId,
        taskId: validated.taskId,
        invoiceId: validated.invoiceId,
        scope: validated.scope,
        feeCents: validated.feeCents,
        currency: validated.currency,
        dueDate: validated.dueDate || null,
        status: validated.status || "todo",
        deliveryUrl: validated.deliveryUrl || task.deliveryUrl || null,
        notes: validated.notes || null,
      })
      .run();

    // 2. Update task outsourcing fields
    db.update(tasks)
      .set({
        isOutsourced: true,
        outsourcedVendor: vendor.name,
        outsourceBudgetCents: validated.feeCents,
        currency: validated.currency,
        deliveryUrl: validated.deliveryUrl || task.deliveryUrl || null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tasks.id, validated.taskId))
      .run();

    // 3. Update vendor current balance with this work order fee
    const currentBalance = vendor.balanceCents || 0;
    db.update(vendors)
      .set({
        balanceCents: currentBalance + validated.feeCents,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(vendors.id, validated.vendorId))
      .run();
  });

  broadcastDataChanged?.();
  const created = getWorkOrder(id);
  if (!created) throw new AppError("INTERNAL", "Failed to retrieve created work order.");
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

  const updateData: Record<string, unknown> = {};
  if (validated.scope !== undefined) updateData.scope = validated.scope;
  if (validated.feeCents !== undefined) updateData.feeCents = validated.feeCents;
  if (validated.currency !== undefined) updateData.currency = validated.currency;
  if (validated.dueDate !== undefined) updateData.dueDate = validated.dueDate;
  if (validated.notes !== undefined) updateData.notes = validated.notes;
  if (validated.deliveryUrl !== undefined) updateData.deliveryUrl = validated.deliveryUrl;

  if (validated.status !== undefined) {
    updateData.status = validated.status;
    if (validated.status === "done" && !existing.completedAt) {
      updateData.completedAt = new Date().toISOString();
    }
  }
  if (validated.completedAt !== undefined) updateData.completedAt = validated.completedAt;

  db.transaction(() => {
    if (Object.keys(updateData).length > 0) {
      db.update(workOrders)
        .set(updateData)
        .where(eq(workOrders.id, id))
        .run();
    }

    // If fee or currency changed, keep task in sync
    if (validated.feeCents !== undefined || validated.currency !== undefined) {
      const taskUpdate: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      if (validated.feeCents !== undefined) taskUpdate.outsourceBudgetCents = validated.feeCents;
      if (validated.currency !== undefined) taskUpdate.currency = validated.currency;

      db.update(tasks)
        .set(taskUpdate)
        .where(eq(tasks.id, existing.taskId))
        .run();
    }

    // If updateTask requested, sync delivery URL, status, and completion to original task after review
    if (validated.updateTask) {
      const taskUpdate: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      const finalDeliveryUrl = validated.deliveryUrl !== undefined ? validated.deliveryUrl : existing.deliveryUrl;
      if (finalDeliveryUrl) {
        taskUpdate.deliveryUrl = finalDeliveryUrl;
      }
      const targetStatus = validated.taskStatus ?? (validated.status === "done" ? "done" : validated.status === "review" ? "review" : undefined);
      if (targetStatus) {
        taskUpdate.status = targetStatus;
        if (targetStatus === "done") {
          taskUpdate.completedAt = new Date().toISOString();
        }
      }
      db.update(tasks)
        .set(taskUpdate)
        .where(eq(tasks.id, existing.taskId))
        .run();
    }

    // If payoutStatus was explicitly supplied (toggle action)
    if (validated.payoutStatus) {
      if (validated.payoutStatus === "PAID") {
        const existingPayout = db
          .select()
          .from(vendorPayouts)
          .where(eq(vendorPayouts.workOrderId, id))
          .get();
        if (!existingPayout) {
          db.insert(vendorPayouts)
            .values({
              id: `payout-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
              workOrderId: id,
              amountCents: validated.feeCents ?? existing.feeCents,
              currency: validated.currency ?? existing.currency,
              paidAt: new Date().toISOString(),
              requestId: crypto.randomUUID(),
            })
            .run();
        }
      } else {
        db.delete(vendorPayouts)
          .where(eq(vendorPayouts.workOrderId, id))
          .run();
      }
    }
  });

  broadcastDataChanged?.();
  const updated = getWorkOrder(id);
  if (!updated) throw new AppError("INTERNAL", "Failed to retrieve updated work order.");
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

  const existingPayout = db
    .select()
    .from(vendorPayouts)
    .where(eq(vendorPayouts.workOrderId, validated.workOrderId))
    .get();

  const payoutId = existingPayout
    ? existingPayout.id
    : `payout-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

  db.transaction(() => {
    if (existingPayout) {
      db.update(vendorPayouts)
        .set({
          amountCents: validated.amountCents ?? existing.feeCents,
          currency: validated.currency ?? existing.currency,
          paidAt: validated.paidAt ?? new Date().toISOString(),
        })
        .where(eq(vendorPayouts.id, existingPayout.id))
        .run();
    } else {
      db.insert(vendorPayouts)
        .values({
          id: payoutId,
          workOrderId: validated.workOrderId,
          amountCents: validated.amountCents ?? existing.feeCents,
          currency: validated.currency ?? existing.currency,
          paidAt: validated.paidAt ?? new Date().toISOString(),
          requestId: crypto.randomUUID(),
        })
        .run();
    }
  });

  broadcastDataChanged?.();
  const updated = getWorkOrder(validated.workOrderId);
  if (!updated) throw new AppError("INTERNAL", "Failed to retrieve work order.");
  return updated;
}

/**
 * Removes a vendor payout entry from SQLite `vendor_payouts` and any attached receipts,
 * reverting payoutStatus to PENDING without modifying contractor work status.
 */
export function removeWorkOrderPayout(
  workOrderId: string,
  broadcastDataChanged?: () => void,
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

  db.transaction(() => {
    // Delete any attachments associated with this payout
    const payouts = db
      .select()
      .from(vendorPayouts)
      .where(eq(vendorPayouts.workOrderId, workOrderId))
      .all();
    for (const p of payouts) {
      db.delete(attachments).where(eq(attachments.payoutId, p.id)).run();
    }
    db.delete(vendorPayouts)
      .where(eq(vendorPayouts.workOrderId, workOrderId))
      .run();
  });

  broadcastDataChanged?.();
  const updated = getWorkOrder(workOrderId);
  if (!updated) throw new AppError("INTERNAL", "Failed to retrieve work order.");
  return updated;
}

/**
 * Toggles payout status of a work order (creates or removes a vendorPayouts ledger entry).
 */
export function setWorkOrderPayoutStatus(
  id: string,
  status: "PENDING" | "PAID",
  broadcastDataChanged?: () => void,
): WorkOrderItem {
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

  db.transaction(() => {
    // 1. Remove payouts and attachments
    const payouts = db
      .select()
      .from(vendorPayouts)
      .where(eq(vendorPayouts.workOrderId, id))
      .all();
    for (const p of payouts) {
      db.delete(attachments).where(eq(attachments.payoutId, p.id)).run();
    }
    db.delete(vendorPayouts)
      .where(eq(vendorPayouts.workOrderId, id))
      .run();

    // 2. Remove work order
    db.delete(workOrders)
      .where(eq(workOrders.id, id))
      .run();

    // 3. Reset task outsource state
    db.update(tasks)
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
 * Registers work order IPC handlers on the electron main process.
 */
export function registerWorkOrderHandlers(broadcastDataChanged: () => void) {
  ipcMain.handle(
    "workOrders:list",
    async (
      _event,
      filter?: { vendorId?: string; taskId?: string; invoiceId?: string },
    ) => {
      try {
        return listWorkOrders(filter);
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle("workOrders:get", async (_event, id: string) => {
    try {
      const wo = getWorkOrder(id);
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
        return updateWorkOrder(id, patch, broadcastDataChanged);
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

  ipcMain.handle("workOrders:removePayout", async (_event, workOrderId: string) => {
    try {
      return removeWorkOrderPayout(workOrderId, broadcastDataChanged);
    } catch (err) {
      throw formatError(err);
    }
  });

  ipcMain.handle(
    "workOrders:setPayoutStatus",
    async (_event, id: string, status: "PENDING" | "PAID") => {
      try {
        return setWorkOrderPayoutStatus(id, status, broadcastDataChanged);
      } catch (err) {
        throw formatError(err);
      }
    },
  );

  ipcMain.handle("workOrders:remove", async (_event, id: string) => {
    try {
      return removeWorkOrder(id, broadcastDataChanged);
    } catch (err) {
      throw formatError(err);
    }
  });
}
