import { updateTask } from "./tasks";
import { captureWorkspace } from "../workspace-session";

import { ipcMain } from "../security";
import crypto from "crypto";
import { eq, desc, and, isNull } from "drizzle-orm";
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
    .where(isNull(vendorPayouts.voidedAt))
    .all();
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
    throw new AppError(
      "NOT_FOUND",
      `Vendor with ID ${validated.vendorId} not found.`,
    );
  }

  const task = db
    .select()
    .from(tasks)
    .where(eq(tasks.id, validated.taskId))
    .get();
  if (!task) {
    throw new AppError(
      "NOT_FOUND",
      `Task with ID ${validated.taskId} not found.`,
    );
  }

  const invoice = db
    .select()
    .from(invoices)
    .where(eq(invoices.id, validated.invoiceId))
    .get();
  if (!invoice) {
    throw new AppError(
      "NOT_FOUND",
      `Invoice with ID ${validated.invoiceId} not found.`,
    );
  }

  if (
    task.deletedAt ||
    (task.invoiceId && task.invoiceId !== invoice.id) ||
    (task.clientId && task.clientId !== invoice.clientId) ||
    task.currency !== invoice.currency
  )
    throw new AppError(
      "SOURCE_MISMATCH",
      "Contractor work must reference the task's invoice and client.",
    );
  const id =
    validated.id || `wo-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

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
        invoiceId: invoice.id,
        clientId: invoice.clientId,
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
  const updateData: Record<string, unknown> = {};
  if (validated.scope !== undefined) updateData.scope = validated.scope;
  if (validated.feeCents !== undefined)
    updateData.feeCents = validated.feeCents;
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

    // If fee or currency changed, keep task in sync
    if (validated.feeCents !== undefined || validated.currency !== undefined) {
      const taskUpdate: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      if (validated.feeCents !== undefined)
        taskUpdate.outsourceBudgetCents = validated.feeCents;

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
      const finalDeliveryUrl =
        validated.deliveryUrl !== undefined
          ? validated.deliveryUrl
          : existing.deliveryUrl;
      if (finalDeliveryUrl) {
        taskUpdate.deliveryUrl = finalDeliveryUrl;
      }
      const targetStatus =
        validated.taskStatus ??
        (validated.status === "done"
          ? "done"
          : validated.status === "review"
            ? "review"
            : undefined);
      if (targetStatus) {
        taskUpdate.status = targetStatus;
        if (targetStatus === "done") {
          taskUpdate.completedAt = new Date().toISOString();
        }
      }
      updateTask(existing.taskId, {
        ...(finalDeliveryUrl ? { deliveryUrl: finalDeliveryUrl } : {}),
        ...(targetStatus ? { status: targetStatus } : {}),
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
  const existingPayout = db
    .select()
    .from(vendorPayouts)
    .where(
      and(
        eq(vendorPayouts.workOrderId, validated.workOrderId),
        isNull(vendorPayouts.voidedAt),
      ),
    )
    .get();

  const amountCents =
    validated.amountCents ?? existingPayout?.amountCents ?? existing.feeCents;
  const paidAt =
    validated.paidAt ?? existingPayout?.paidAt ?? new Date().toISOString();
  if (
    existingPayout &&
    existingPayout.amountCents === amountCents &&
    existingPayout.paidAt === paidAt
  ) {
    return getWorkOrder(validated.workOrderId)!;
  }
  const payoutId = `payout-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

  db.transaction(() => {
    if (existingPayout) {
      db.update(vendorPayouts)
        .set({ voidedAt: new Date().toISOString() })
        .where(eq(vendorPayouts.id, existingPayout.id))
        .run();
    }
    db.insert(vendorPayouts)
      .values({
        id: payoutId,
        workOrderId: validated.workOrderId,
        amountCents,
        currency: existing.currency,
        paidAt,
        requestId: crypto.randomUUID(),
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
  const task = db.select().from(tasks).where(eq(tasks.id, wo.taskId)).get();
  const profile = getOrCreateSettings();

  const pdfBuffer = await generateWorkOrderPdfBuffer({
    voucherNumber: wo.id.slice(-8).toUpperCase(),
    scope: wo.scope,
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

  ipcMain.handle(
    "workOrders:removePayout",
    async (_event, workOrderId: string) => {
      try {
        return removeWorkOrderPayout(workOrderId, broadcastDataChanged);
      } catch (err) {
        throw formatError(err);
      }
    },
  );

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

  ipcMain.handle("workOrders:exportPdf", async (_event, id: string) => {
    try {
      const filePath = await exportWorkOrderPdf(id);
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
