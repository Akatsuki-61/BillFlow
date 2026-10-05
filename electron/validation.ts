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
  catalogItemId: z.string().trim().nullable().optional(),
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
  catalogItemId: z.string().trim().nullable().optional(),
  title: z.string().trim().max(160).optional(),
  amountCents: z.number().int().nonnegative().optional(),
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).optional(),
  dueDate: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "UNPAID", "PAID", "OVERDUE"]).optional(),
});

export const newCatalogItemSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  category: z.enum(["Development", "Design", "Consulting", "Licensing"]).default("Development"),
  sku: z.string().trim().min(1, "SKU is required").max(60),
  description: z.string().trim().default(""),
  price: z.string().trim().min(1, "Price is required"),
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).default("LKR"),
  unit: z.string().trim().default("/ Hourly"),
  iconType: z.enum(["code", "design", "cloud", "consulting"]).default("code"),
});

export const catalogItemPatchSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  category: z.enum(["Development", "Design", "Consulting", "Licensing"]).optional(),
  sku: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().optional(),
  price: z.string().trim().optional(),
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).optional(),
  unit: z.string().trim().optional(),
  iconType: z.enum(["code", "design", "cloud", "consulting"]).optional(),
});

export const updateSettingsSchema = z.object({
  businessName: z.string().trim().max(120).optional(),
  professionalTitle: z.string().trim().max(120).nullable().optional(),
  email: z
    .string()
    .trim()
    .max(120)
    .refine((val) => val === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), "Please provide a valid email address")
    .optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  website: z.string().trim().max(120).nullable().optional(),
  taxId: z.string().trim().max(60).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  paymentDetails: z.string().trim().max(1000).nullable().optional(),
  defaultCurrency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).optional(),
  invoicePrefix: z.string().trim().min(1).max(20).optional(),
  nextInvoiceSeq: z.number().int().positive().optional(),
  defaultDueDays: z.number().int().min(0).max(365).optional(),
  defaultTaxRate: z.number().min(0).max(100).optional(),
  defaultNotes: z.string().trim().max(1000).nullable().optional(),
  dateFormat: z.enum(["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"]).optional(),
  currencyDisplay: z.enum(["symbol", "code"]).optional(),
});

