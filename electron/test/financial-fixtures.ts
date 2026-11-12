import { getDb } from "../db";
import { invoices, invoicePayments } from "../db/schema";
import { eq } from "drizzle-orm";
import { createTask } from "../ipc/tasks";
import { createWorkOrder, recordWorkOrderPayout } from "../ipc/workOrders";
import type { Currency } from "../../src/types/billing";
export function seedPayout(
  invoiceId: string,
  vendorId: string,
  amountCents: number,
) {
  const invoice = getDb()
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .get()!;
  const task = createTask({
    id: `task-${vendorId}`,
    title: "Contractor deliverable",
    description: "",
    status: "done",
    priority: "medium",
    category: "Development",
    assignee: {
      name: "Test",
      avatarLetter: "T",
      bgColor: "blue",
      textColor: "white",
    },
    dueDate: "",
    subtasks: [],
    clientId: invoice.clientId,
    currency: invoice.currency as Currency,
  });
  const order = createWorkOrder({
    vendorId,
    taskId: task.id,
    invoiceId,
    scope: "Contractor work",
    feeCents: amountCents,
    currency: invoice.currency as Currency,
  });
  recordWorkOrderPayout({
    workOrderId: order.id,
    amountCents,
    currency: invoice.currency as Currency,
    paidAt: invoice.issueDate,
  });
  return order;
}
export function seedCollection(invoiceId: string) {
  const invoice = getDb()
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .get()!;
  getDb()
    .insert(invoicePayments)
    .values({
      id: `payment-${invoiceId}`,
      requestId: `request-${invoiceId}`,
      invoiceId,
      amountCents: invoice.paidCents,
      currency: invoice.currency,
      receivedAt: invoice.issueDate,
    })
    .run();
}
