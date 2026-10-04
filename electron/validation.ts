import { z } from "zod";

export const newClientSchema = z.object({
  name: z.string().trim().min(1, "Client name is required").max(120),
  category: z.string().trim().min(1).max(40).default("Enterprise"),
  contactPerson: z.string().trim().max(120).optional().default(""),
  contactRole: z.string().trim().max(80).optional(),
  email: z.string().trim().email("Please provide a valid email address"),
  phone: z.string().trim().max(40).optional(),
  currency: z.enum(["USD", "LKR", "EUR"]).default("USD"),
  driveUrl: z
    .string()
    .trim()
    .url("Please provide a valid URL")
    .optional()
    .or(z.literal("")),
});

export const newInvoiceSchema = z.object({
  clientId: z.string().min(1, "Please select an existing client"),
  code: z.string().trim().min(1).max(40).optional(),
  title: z.string().trim().max(160).optional(),
  amountCents: z.number().int().nonnegative("Amount must be positive"),
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).default("USD"),
  issueDate: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "UNPAID", "PAID", "OVERDUE"]).default("UNPAID"),
});

export const invoicePatchSchema = z.object({
  code: z.string().trim().min(1).max(40).optional(),
  clientId: z.string().min(1).optional(),
  title: z.string().trim().max(160).optional(),
  amountCents: z.number().int().nonnegative().optional(),
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).optional(),
  dueDate: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "UNPAID", "PAID", "OVERDUE"]).optional(),
});
