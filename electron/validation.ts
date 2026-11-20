import path from "path";
import { z } from "zod";
import { deliveryLink, minorAmount, recordId } from "./workflow-validation";
const invoiceDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      Number.isFinite(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Use a valid YYYY-MM-DD date",
  );
const timestamp = z
  .string()
  .max(40)
  .refine((v) => Number.isFinite(Date.parse(v)), "Use a valid payment date");

export const imageDataSchema = z
  .string()
  .max(700_000)
  .regex(
    /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/,
    "Choose a PNG, JPEG, or WebP image.",
  )
  .nullable()
  .optional();
export const onlinePaymentUrl = z
  .url({
    protocol: /^https$/,
    hostname: /^.+$/,
  })
  .max(2048)
  .refine((value) => {
    const url = new URL(value);
    return !url.username && !url.password;
  }, "Use an HTTPS link without credentials.")
  .nullable()
  .optional();
export const invoiceWorkflowStage = z.enum([
  "SENT",
  "WORK_CONFIRMED",
  "DELIVERED",
]);
const clientContactFields = {
  whatsappPhone: z.string().trim().max(40).nullable().optional(),
  relationshipNotes: z.string().trim().max(4000).nullable().optional(),
  billingAddress: z.string().trim().max(1000).nullable().optional(),
  photoData: imageDataSchema,
};
const vendorContactFields = {
  billingAddress: clientContactFields.billingAddress,
  photoData: imageDataSchema,
};

const driveUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .url("Please provide a valid URL")
  .regex(/^https?:\/\//i, "Use an HTTP or HTTPS URL")
  .refine((val) => {
    try {
      const url = new URL(val);
      return !url.username && !url.password;
    } catch {
      return false;
    }
  }, "URL must not contain credentials");

export const newClientSchema = z.object({
  ...clientContactFields,
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
  driveUrl: driveUrlSchema.optional().or(z.literal("")),
});

export const clientPatchSchema = z.object({
  ...clientContactFields,
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
  driveUrl: driveUrlSchema.nullable().optional().or(z.literal("")),
});

export const newInvoiceItemSchema = z.object({
  id: z.string().optional(),
  description: z.string().trim().min(1, "Description is required").max(500),
  quantity: z
    .number()
    .int()
    .positive("Quantity must be positive")
    .max(1_000_000)
    .default(1),
  unitPriceCents: minorAmount,
  catalogId: z.string().nullable().optional(),
  sourceTaskId: z.string().nullable().optional(),
});

export const newInvoiceSchema = z
  .object({
    paymentUrl: onlinePaymentUrl,
    workflowStage: invoiceWorkflowStage.nullable().optional(),
    clientId: z.string().min(1).optional(),
    newClient: newClientSchema.optional(),
    saveAsPermanentClient: z.boolean().optional().default(true),
    requestId: z.string().uuid().optional(),
    code: z.string().trim().min(1).max(40).optional(),
    catalogItemId: z.string().trim().nullable().optional(),
    title: z.string().trim().max(160).optional(),
    items: z.array(newInvoiceItemSchema).max(500).optional(),
    linkedTaskIds: z
      .array(z.string().trim().min(1).max(160))
      .max(500)
      .optional(),
    discountCents: minorAmount.optional().default(0),
    taxCents: minorAmount.optional().default(0),
    advanceCents: minorAmount.optional().default(0),
    deliveryUrl: deliveryLink,
    notes: z.string().trim().max(1000).nullable().optional(),
    amountCents: minorAmount,
    currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).default("USD"),
    issueDate: invoiceDate.optional(),
    dueDate: invoiceDate.nullable().optional(),
    status: z
      .enum(["DRAFT", "UNPAID", "ADVANCE_PAID", "PAID", "OVERDUE"])
      .default("UNPAID"),
  })
  .refine(
    (input) => Boolean(input.clientId) !== Boolean(input.newClient),
    "Select a client or provide new client details.",
  );

export const promoteInvoiceClientSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
});

export const invoicePatchSchema = z.object({
  paymentUrl: onlinePaymentUrl,
  workflowStage: invoiceWorkflowStage.nullable().optional(),
  code: z.string().trim().min(1).max(40).optional(),
  clientId: z.string().min(1).optional(),
  catalogItemId: z.string().trim().nullable().optional(),
  title: z.string().trim().max(160).optional(),
  items: z.array(newInvoiceItemSchema).max(500).optional(),
  discountCents: minorAmount.optional(),
  taxCents: minorAmount.optional(),
  advanceCents: minorAmount.optional(),
  deliveryUrl: deliveryLink,
  notes: z.string().trim().max(1000).nullable().optional(),
  amountCents: minorAmount.optional(),
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).optional(),
  dueDate: invoiceDate.nullable().optional(),
  status: z
    .enum(["DRAFT", "UNPAID", "ADVANCE_PAID", "PAID", "OVERDUE"])
    .optional(),
});

export const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1),
  amountCents: minorAmount.refine((n) => n > 0, "Payment must be positive"),
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).optional(),
  receivedAt: timestamp.optional(),
  reference: z.string().trim().max(200).optional().default(""),
  requestId: z.string().uuid().optional(),
});

export const catalogPriceSchema = z
  .string()
  .trim()
  .regex(
    /^\d+(?:\.\d{1,2})?$/,
    "Price must be a non-negative amount with up to two decimal places.",
  )
  .refine(
    (value) => Number.isSafeInteger(Math.round(Number(value) * 100)),
    "Price is too large.",
  );

export const newCatalogItemSchema = z.object({
  requestId: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Title is required").max(160),
  category: z
    .enum(["Development", "Design", "Consulting", "Licensing"])
    .default("Development"),
  sku: z.string().trim().min(1, "SKU is required").max(60),
  description: z.string().trim().max(2000).default(""),
  price: catalogPriceSchema,
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).default("LKR"),
  unit: z.string().trim().max(60).default("/ Hourly"),
  iconType: z.enum(["code", "design", "cloud", "consulting"]).default("code"),
});

export const catalogItemPatchSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  category: z
    .enum(["Development", "Design", "Consulting", "Licensing"])
    .optional(),
  sku: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(2000).optional(),
  price: catalogPriceSchema.optional(),
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).optional(),
  unit: z.string().trim().max(60).optional(),
  iconType: z.enum(["code", "design", "cloud", "consulting"]).optional(),
});

export const updateSettingsSchema = z.object({
  defaultDeliveryUrl: deliveryLink,
  signatureData: imageDataSchema,
  notificationPlacement: z
    .enum(["top-left", "top-right", "bottom-left", "bottom-right"])
    .nullable()
    .optional(),
  typeface: z
    .enum(["inter", "nunito", "jakarta", "elegant-sans"])
    .nullable()
    .optional(),
  layoutDensity: z
    .enum(["compact", "comfortable", "spacious"])
    .nullable()
    .optional(),
  businessName: z.string().trim().max(120).optional(),
  professionalTitle: z.string().trim().max(120).nullable().optional(),
  email: z
    .string()
    .trim()
    .max(120)
    .refine(
      (val) => val === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      "Please provide a valid email address",
    )
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
  defaultInvoiceTemplate: z
    .enum([
      "geometric-teal",
      "executive-wave",
      "scarlet-modern",
      "apex-orange",
      "noir-crimson",
    ])
    .optional(),
  dateFormat: z.enum(["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"]).optional(),
  currencyDisplay: z.enum(["symbol", "code"]).optional(),
  pdfExportDirectory: z
    .string()
    .max(4096)
    .refine(
      (value) => path.isAbsolute(value),
      "Choose an absolute export folder",
    )
    .nullable()
    .optional(),
  digestEnabled: z.boolean().optional(),
  digestLastSentDate: invoiceDate.nullable().optional(),
  rollingBackupEnabled: z.boolean().optional(),
  rollingBackupDirectory: z
    .string()
    .max(4096)
    .refine(
      (value) => path.isAbsolute(value),
      "Choose an absolute encrypted backup folder",
    )
    .nullable()
    .optional(),
  rollingBackupRetention: z.number().int().min(1).max(100).optional(),
  rollingBackupIntervalHours: z.number().int().min(1).max(720).optional(),
  rollingBackupLastAt: timestamp.nullable().optional(),
});

export const newVendorSchema = z.object({
  ...vendorContactFields,
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
  balanceCents: minorAmount.default(0),
  status: z.enum(["PENDING", "PAID"]).default("PENDING"),
  iconType: z
    .enum(["design", "devops", "legal", "development"])
    .default("devops"),
  email: z
    .string()
    .trim()
    .max(120)
    .refine(
      (val) =>
        val === "" ||
        (val.includes("@") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)),
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
  ...vendorContactFields,
  name: z.string().trim().min(1).max(120).optional(),
  service: z.string().trim().min(1).max(160).optional(),
  balanceCents: minorAmount.optional(),
  status: z.enum(["PENDING", "PAID"]).optional(),
  iconType: z.enum(["design", "devops", "legal", "development"]).optional(),
  email: z
    .string()
    .trim()
    .max(120)
    .refine(
      (val) =>
        val === "" ||
        (val.includes("@") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)),
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
  amountCents: minorAmount.refine((n) => n > 0, "Amount must be positive"),
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).default("USD"),
  incurredAt: timestamp,
  deductible: z.boolean().optional().default(true),
  invoiceId: z.string().trim().nullable().optional(),
});

export const expensePatchSchema = z.object({
  merchant: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  amountCents: minorAmount
    .refine((n) => n > 0, "Amount must be positive")
    .optional(),
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).optional(),
  incurredAt: timestamp.optional(),
  deductible: z.boolean().optional(),
  invoiceId: z.string().trim().nullable().optional(),
});

/**
 * Validation schema for creating a new per-job payable work order.
 * Validates relational foreign key links (vendor, task, invoice),
 * non-negative contractor fee in minor currency units, and optional delivery links.
 */
export const payableItemSchema = newInvoiceItemSchema.pick({
  description: true,
  quantity: true,
  unitPriceCents: true,
});
export const payableVendorSchema = z.object({
  name: z.string().trim().min(1, "Enter a vendor name.").max(120),
  service: z.string().trim().max(160).nullable().optional(),
  email: z.string().trim().max(120).email().nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  billingAddress: clientContactFields.billingAddress,
});
const payableFields = {
  items: z.array(payableItemSchema).min(1).max(500).nullable().optional(),
  discountCents: minorAmount.optional(),
  paypalUrl: onlinePaymentUrl,
  stripeUrl: onlinePaymentUrl,
};
export const newWorkOrderSchema = z
  .object({
    id: z.string().optional(),
    ...payableFields,
    vendorId: z.string().trim().min(1).nullable().optional(),
    vendorSnapshot: payableVendorSchema.nullable().optional(),
    taskId: z.string().trim().min(1).nullable().optional(),
    invoiceId: z.string().trim().min(1).nullable().optional(),
    scope: z
      .string()
      .trim()
      .min(1, "Scope description cannot be blank")
      .max(500),
    feeCents: minorAmount,
    currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).default("LKR"),
    dueDate: z.string().trim().max(60).nullable().optional(),
    payoutDueDate: invoiceDate.nullable().optional(),
    status: z.enum(["todo", "in-progress", "review", "done"]).default("todo"),
    deliveryUrl: deliveryLink,
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine(
    (value) => Boolean(value.vendorId) !== Boolean(value.vendorSnapshot),
    "Choose a directory vendor or enter a one-time vendor.",
  )
  .refine(
    (value) => !value.invoiceId || Boolean(value.taskId),
    "An invoice-linked work order requires a source task.",
  );

/**
 * Validation schema for partial updates to an existing work order.
 */
export const workOrderPatchSchema = z.object({
  vendorSnapshot: payableVendorSchema.optional(),
  ...payableFields,
  vendorId: z.string().trim().min(1).optional(),
  scope: z.string().trim().min(1).max(500).optional(),
  feeCents: minorAmount.optional(),
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).optional(),
  dueDate: z.string().trim().max(60).nullable().optional(),
  payoutDueDate: invoiceDate.nullable().optional(),
  status: z.enum(["todo", "in-progress", "review", "done"]).optional(),
  deliveryUrl: deliveryLink,
  notes: z.string().trim().max(2000).nullable().optional(),
  completedAt: timestamp.nullable().optional(),
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
  deliveryUrl: deliveryLink,
  notes: z.string().trim().max(2000).nullable().optional(),
  updateTask: z.boolean().default(true),
});

/**
 * Validation schema for recording a vendor payout entry.
 */
export const recordWorkOrderPayoutSchema = z.object({
  workOrderId: z.string().trim().min(1, "Work order ID is required"),
  amountCents: minorAmount
    .refine((n) => n > 0, "Payout amount must be positive")
    .optional(),
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).optional(),
  paidAt: timestamp.optional(),
  requestId: z.string().uuid().optional(),
});

/**
 * Validation schema for user local calendar events.
 */
export const newCalendarEventSchema = z.object({
  id: recordId.optional(),
  title: z.string().trim().min(1, "Event title is required").max(150),
  description: z.string().trim().max(1000).optional().default(""),
  startDate: z.string().trim().min(1, "Start date is required").max(40),
  endDate: z.string().trim().max(40).nullable().optional(),
  startTime: z.string().trim().max(20).nullable().optional(),
  endTime: z.string().trim().max(20).nullable().optional(),
  isAllDay: z.boolean().optional().default(false),
  category: z
    .enum(["meeting", "milestone", "review", "deadline", "reminder", "general"])
    .default("general"),
  color: z
    .enum(["blue", "emerald", "amber", "purple", "rose", "cyan"])
    .default("blue"),
  clientId: recordId.nullable().optional(),
  clientName: z.string().trim().max(120).nullable().optional(),
  taskId: recordId.nullable().optional(),
  taskTitle: z.string().trim().max(240).nullable().optional(),
  location: z.string().trim().max(300).nullable().optional(),
});

export const calendarEventPatchSchema = newCalendarEventSchema.partial();

export const recurringCadenceSchema = z.enum([
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly",
]);

export const recurringLineItemSchema = z.object({
  description: z.string().trim().min(1, "Description is required").max(500),
  quantity: z
    .number()
    .int()
    .positive("Quantity must be positive")
    .max(1_000_000)
    .default(1),
  unitPriceCents: minorAmount,
  catalogId: z.string().nullable().optional(),
});

const invoiceTemplateSchema = z
  .enum([
    "geometric-teal",
    "executive-wave",
    "scarlet-modern",
    "apex-orange",
    "noir-crimson",
  ])
  .nullable()
  .optional();

export const newRecurringRuleSchema = z.object({
  clientId: recordId,
  title: z.string().trim().min(1, "Retainer title is required").max(160),
  cadence: recurringCadenceSchema.default("monthly"),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).default("USD"),
  items: z.array(recurringLineItemSchema).min(1).max(500),
  discountCents: minorAmount.optional().default(0),
  taxCents: minorAmount.optional().default(0),
  advanceCents: minorAmount.optional().default(0),
  amountCents: minorAmount,
  dueDays: z.number().int().min(0).max(365).default(14),
  autoStatus: z.enum(["DRAFT", "UNPAID"]).default("DRAFT"),
  autoExportPdf: z.boolean().default(true),
  notes: z.string().trim().max(1000).nullable().optional(),
  deliveryUrl: deliveryLink,
  paymentUrl: onlinePaymentUrl,
  template: invoiceTemplateSchema,
  nextRunDate: invoiceDate,
  isActive: z.boolean().optional().default(true),
});

export const recurringRulePatchSchema = newRecurringRuleSchema.partial();

export const quoteStatusSchema = z.enum([
  "DRAFT",
  "SENT",
  "APPROVED",
  "DECLINED",
  "CONVERTED",
]);

export const newQuoteSchema = z
  .object({
    clientId: z.string().min(1).optional(),
    newClient: newClientSchema.optional(),
    saveAsPermanentClient: z.boolean().optional().default(true),
    code: z.string().trim().min(1).max(40).optional(),
    title: z.string().trim().max(160).optional(),
    items: z.array(recurringLineItemSchema).min(1).max(500),
    discountCents: minorAmount.optional().default(0),
    taxCents: minorAmount.optional().default(0),
    advanceCents: minorAmount.optional().default(0),
    amountCents: minorAmount,
    currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).default("USD"),
    issueDate: invoiceDate.optional(),
    validUntil: invoiceDate.nullable().optional(),
    status: z
      .enum(["DRAFT", "SENT", "APPROVED", "DECLINED"])
      .default("DRAFT"),
    template: invoiceTemplateSchema,
    deliveryUrl: deliveryLink,
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .refine(
    (input) => Boolean(input.clientId) !== Boolean(input.newClient),
    "Select a client or provide new client details.",
  );

export const quotePatchSchema = z.object({
  clientId: z.string().min(1).optional(),
  code: z.string().trim().min(1).max(40).optional(),
  title: z.string().trim().max(160).nullable().optional(),
  items: z.array(recurringLineItemSchema).min(1).max(500).optional(),
  discountCents: minorAmount.optional(),
  taxCents: minorAmount.optional(),
  advanceCents: minorAmount.optional(),
  amountCents: minorAmount.optional(),
  currency: z.enum(["USD", "LKR", "EUR", "GBP", "CAD"]).optional(),
  issueDate: invoiceDate.optional(),
  validUntil: invoiceDate.nullable().optional(),
  status: z.enum(["DRAFT", "SENT", "APPROVED", "DECLINED"]).optional(),
  template: invoiceTemplateSchema,
  deliveryUrl: deliveryLink,
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const convertQuoteSchema = z.object({
  quoteId: recordId,
  status: z.enum(["DRAFT", "UNPAID"]).optional().default("UNPAID"),
  dueDate: invoiceDate.nullable().optional(),
  advanceCents: minorAmount.optional(),
});
