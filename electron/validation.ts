import path from "path";
import { z } from "zod";

export const newClientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Client name cannot be blank or whitespace only")
    .max(120),
  category: z.string().trim().min(1).max(40).default("Enterprise"),
  contactPerson: z.string().trim().max(120).optional().default(""),
  contactRole: z.string().trim().max(80).optional(),
  email: z
    .string()
    .trim()
    .min(1, "Email cannot be blank or whitespace only")
    .refine((val) => val.includes("@"), "Email must contain an '@' sign")
    .pipe(z.string().email("Please provide a valid email address")),
  phone: z.string().trim().max(40).optional(),
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).default("USD"),
  driveUrl: z
    .string()
    .trim()
    .url("Please provide a valid URL")
    .optional()
    .or(z.literal("")),
});

export const clientPatchSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Client name cannot be blank or whitespace only")
    .max(120)
    .optional(),
  category: z.string().trim().min(1).max(40).optional(),
  contactPerson: z.string().trim().max(120).optional(),
  contactRole: z.string().trim().max(80).nullable().optional(),
  email: z
    .string()
    .trim()
    .min(1, "Email cannot be blank or whitespace only")
    .refine((val) => val.includes("@"), "Email must contain an '@' sign")
    .pipe(z.string().email("Please provide a valid email address"))
    .optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).optional(),
  driveUrl: z
    .string()
    .trim()
    .url("Please provide a valid URL")
    .nullable()
    .optional()
    .or(z.literal("")),
});

export const newInvoiceItemSchema = z.object({
  id: z.string().optional(),
  description: z.string().trim().min(1, "Description is required").max(500),
  quantity: z.number().int().positive("Quantity must be positive").default(1),
  unitPriceCents: z.number().int().nonnegative("Unit price must be non-negative"),
  catalogId: z.string().nullable().optional(),
});

export const newInvoiceSchema = z.object({
  clientId: z.string().min(1).optional(),
  newClient: newClientSchema.optional(),
  saveAsPermanentClient: z.boolean().optional().default(true),
  requestId: z.string().uuid().optional(),
  code: z.string().trim().min(1).max(40).optional(),
  catalogItemId: z.string().trim().nullable().optional(),
  title: z.string().trim().max(160).optional(),
  items: z.array(newInvoiceItemSchema).optional(),
  discountCents: z.number().int().nonnegative().optional().default(0),
  taxCents: z.number().int().nonnegative().optional().default(0),
  advanceCents: z.number().int().nonnegative().optional().default(0),
  deliveryUrl: z.string().trim().url().nullable().optional().or(z.literal("")),
  notes: z.string().trim().max(1000).nullable().optional(),
  amountCents: z.number().int().nonnegative("Amount must be positive"),
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).default("USD"),
  issueDate: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "UNPAID", "ADVANCE_PAID", "PAID", "OVERDUE"]).default("UNPAID"),
}).refine(input => Boolean(input.clientId) !== Boolean(input.newClient), "Select a client or provide new client details.");

export const promoteInvoiceClientSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
});

export const invoicePatchSchema = z.object({
  code: z.string().trim().min(1).max(40).optional(),
  clientId: z.string().min(1).optional(),
  catalogItemId: z.string().trim().nullable().optional(),
  title: z.string().trim().max(160).optional(),
  items: z.array(newInvoiceItemSchema).optional(),
  discountCents: z.number().int().nonnegative().optional(),
  taxCents: z.number().int().nonnegative().optional(),
  advanceCents: z.number().int().nonnegative().optional(),
  deliveryUrl: z.string().trim().url().nullable().optional().or(z.literal("")),
  notes: z.string().trim().max(1000).nullable().optional(),
  amountCents: z.number().int().nonnegative().optional(),
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).optional(),
  dueDate: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "UNPAID", "ADVANCE_PAID", "PAID", "OVERDUE"]).optional(),
});

export const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1),
  amountCents: z.number().int().positive("Payment amount must be greater than 0"),
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).default("LKR"),
  receivedAt: z.string().optional(),
  reference: z.string().trim().max(200).optional().default(""),
  requestId: z.string().uuid().optional(),
});

export const catalogPriceSchema = z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/, "Price must be a non-negative amount with up to two decimal places.").refine(value => Number.isSafeInteger(Math.round(Number(value) * 100)), "Price is too large.");

export const newCatalogItemSchema = z.object({
  requestId: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Title is required").max(160),
  category: z.enum(["Development", "Design", "Consulting", "Licensing"]).default("Development"),
  sku: z.string().trim().min(1, "SKU is required").max(60),
  description: z.string().trim().default(""),
  price: catalogPriceSchema,
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).default("LKR"),
  unit: z.string().trim().default("/ Hourly"),
  iconType: z.enum(["code", "design", "cloud", "consulting"]).default("code"),
});

export const catalogItemPatchSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  category: z.enum(["Development", "Design", "Consulting", "Licensing"]).optional(),
  sku: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().optional(),
  price: catalogPriceSchema.optional(),
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
  pdfExportDirectory: z.string().max(4096).refine(value => path.isAbsolute(value), "Choose an absolute export folder").nullable().optional(),
});

export const newVendorSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Vendor name cannot be blank or whitespace only")
    .max(120),
  service: z
    .string()
    .trim()
    .min(1, "Service description cannot be blank or whitespace only")
    .max(160),
  balanceCents: z.number().int().nonnegative("Balance must be positive").default(0),
  status: z.enum(["PENDING", "PAID"]).default("PENDING"),
  iconType: z.enum(["design", "devops", "legal", "development"]).default("devops"),
  email: z
    .string()
    .trim()
    .max(120)
    .refine(
      (val) => val === "" || (val.includes("@") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)),
      "Email must contain an '@' sign and be a valid address",
    )
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  linkedClientId: z.string().nullable().optional(),
  linkedClientName: z.string().trim().max(120).nullable().optional(),
  payoutDueDate: z.string().trim().max(60).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const vendorPatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  service: z.string().trim().min(1).max(160).optional(),
  balanceCents: z.number().int().nonnegative().optional(),
  status: z.enum(["PENDING", "PAID"]).optional(),
  iconType: z.enum(["design", "devops", "legal", "development"]).optional(),
  email: z
    .string()
    .trim()
    .max(120)
    .refine(
      (val) => val === "" || (val.includes("@") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)),
      "Email must contain an '@' sign and be a valid address",
    )
    .nullable()
    .optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  linkedClientId: z.string().nullable().optional(),
  linkedClientName: z.string().trim().max(120).nullable().optional(),
  payoutDueDate: z.string().trim().max(60).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const newExpenseSchema = z.object({
  requestId: z.string().uuid().optional(),
  merchant: z.string().trim().min(1, "Merchant or payee is required").max(120),
  description: z.string().trim().max(1000).optional().default(""),
  category: z.string().trim().min(1, "Category is required").max(80),
  amountCents: z.number().int().positive("Amount must be positive"),
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).default("USD"),
  incurredAt: z.string().trim().min(1, "Incurred date is required"),
  deductible: z.boolean().optional().default(true),
  invoiceId: z.string().trim().nullable().optional(),
});

export const expensePatchSchema = z.object({
  merchant: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  amountCents: z.number().int().positive().optional(),
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).optional(),
  incurredAt: z.string().trim().min(1).optional(),
  deductible: z.boolean().optional(),
  invoiceId: z.string().trim().nullable().optional(),
});

/**
 * Validation schema for creating a new per-job payable work order.
 * Validates relational foreign key links (vendor, task, invoice),
 * non-negative contractor fee in minor currency units, and optional delivery links.
 */
export const newWorkOrderSchema = z.object({
  id: z.string().optional(),
  vendorId: z.string().trim().min(1, "Vendor ID is required"),
  taskId: z.string().trim().min(1, "Task ID is required"),
  invoiceId: z.string().trim().min(1, "Invoice ID is required"),
  scope: z.string().trim().min(1, "Scope description cannot be blank").max(500),
  feeCents: z.number().int().nonnegative("Contractor fee must be non-negative"),
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).default("LKR"),
  dueDate: z.string().trim().max(60).nullable().optional(),
  status: z.enum(["todo", "in-progress", "review", "done"]).default("todo"),
  deliveryUrl: z.string().trim().url("Please provide a valid delivery URL").nullable().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).nullable().optional(),
});

/**
 * Validation schema for partial updates to an existing work order.
 */
export const workOrderPatchSchema = z.object({
  vendorId: z.string().trim().min(1).optional(),
  scope: z.string().trim().min(1).max(500).optional(),
  feeCents: z.number().int().nonnegative().optional(),
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).optional(),
  dueDate: z.string().trim().max(60).nullable().optional(),
  status: z.enum(["todo", "in-progress", "review", "done"]).optional(),
  deliveryUrl: z.string().trim().url("Please provide a valid delivery URL").nullable().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).nullable().optional(),
  completedAt: z.string().nullable().optional(),
  payoutStatus: z.enum(["PENDING", "PAID"]).optional(),
  updateTask: z.boolean().optional(),
  taskStatus: z.enum(["todo", "in-progress", "review", "done"]).optional(),
});

/**
 * Validation schema for reviewing contractor deliverable and syncing to original task.
 */
export const reviewWorkOrderSchema = z.object({
  workOrderId: z.string().trim().min(1, "Work order ID is required"),
  status: z.enum(["todo", "in-progress", "review", "done"]),
  deliveryUrl: z.string().trim().url("Please provide a valid delivery URL").nullable().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).nullable().optional(),
  updateTask: z.boolean().default(true),
});

/**
 * Validation schema for recording a vendor payout entry.
 */
export const recordWorkOrderPayoutSchema = z.object({
  workOrderId: z.string().trim().min(1, "Work order ID is required"),
  amountCents: z.number().int().positive("Payout amount must be positive").optional(),
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).optional(),
  paidAt: z.string().trim().optional(),
});

