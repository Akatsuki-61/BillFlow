import { z } from "zod";
export const recordId = z.string().trim().min(1).max(160);
export const currencySchema = z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]);
export const minorAmount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const taskStatus = z.enum(["todo", "in-progress", "review", "done"]);
export const deliveryLink = z.string().url().refine(v => ["https:", "http:"].includes(new URL(v).protocol), "Use an HTTP or HTTPS delivery URL").nullable().optional().or(z.literal(""));
const fields = {
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(10000),
  status: taskStatus,
  priority: z.enum(["low", "medium", "high", "urgent"]),
  category: z.enum(["Development", "Design", "Client Ops", "Infrastructure", "Legal", "Documentation"]),
  assignee: z.object({ name: z.string().trim().min(1).max(120), avatarLetter: z.string().max(4), bgColor: z.string().max(100), textColor: z.string().max(100) }).strict(),
  dueDate: z.string().refine(v => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v), "Use YYYY-MM-DD"),
  subtasks: z.array(z.object({ id: recordId, title: z.string().trim().min(1).max(500), completed: z.boolean() }).strict()).max(200).refine(rows => new Set(rows.map(r => r.id)).size === rows.length, "Duplicate subtask IDs"),
  deliveryUrl: deliveryLink,
  currency: currencySchema.optional(),
  isOutsourced: z.boolean().optional(),
  outsourcedVendor: z.string().max(120).optional(),
  outsourceBudgetCents: minorAmount.optional(),
};
export const createTaskSchema = z.object({ ...fields, id: recordId, clientId: recordId.nullable().optional(), clientName: z.string().max(120).optional() }).strict();
export const patchTaskSchema = z.object(fields).partial().strict();
export const attachmentOwnerSchema = z.object({ type: z.enum(["payment", "expense", "payout"]), id: recordId }).strict();
export const trackingChoiceSchema = z.enum(["yes", "no"]);
