import { captureWorkspace } from "../workspace-session";
import { app, dialog, shell } from "electron";
import { ipcMain } from "../security";
import { eq } from "drizzle-orm";
import { randomUUID, createHash } from "crypto";
import fs from "fs";
import path from "path";
import { getActiveProfileId, getDb } from "../db";
import {
  attachments,
  invoicePayments,
  expenses,
  vendorPayouts,
  invoicePdfExports,
  invoices,
  workOrderPdfExports,
  workOrders,
} from "../db/schema";
import { attachmentOwnerSchema, recordId } from "../workflow-validation";
import { getOrCreateSettings } from "./settings";
import type { AttachmentOwner, AttachmentItem } from "../../src/types/workflow";
import { AppError } from "./errors";

import {
  MAX_RECEIPT_BYTES,
  managedAttachmentPath,
  receiptFormat,
  publishManagedAttachment,
  atomicWrite,
} from "../managed-files";
export { managedAttachmentPath } from "../managed-files";

const ownerColumn = (type: AttachmentOwner["type"]) =>
  type === "payment"
    ? attachments.paymentId
    : type === "expense"
      ? attachments.expenseId
      : attachments.payoutId;
function checkOwner(owner: AttachmentOwner) {
  const db = getDb();
  const row =
    owner.type === "payment"
      ? db
          .select()
          .from(invoicePayments)
          .where(eq(invoicePayments.id, owner.id))
          .get()
      : owner.type === "expense"
        ? db.select().from(expenses).where(eq(expenses.id, owner.id)).get()
        : db
            .select()
            .from(vendorPayouts)
            .where(eq(vendorPayouts.id, owner.id))
            .get();
  if (!row)
    throw new AppError(
      "NOT_FOUND",
      "Save the payment, expense or payout before attaching its receipt.",
    );
}
function publicAttachment(
  row: typeof attachments.$inferSelect,
): AttachmentItem {
  const {
    id,
    paymentId,
    expenseId,
    payoutId,
    originalName,
    mimeType,
    sizeBytes,
    createdAt,
  } = row;
  return {
    id,
    paymentId,
    expenseId,
    payoutId,
    originalName,
    mimeType,
    sizeBytes,
    createdAt,
  };
}
export function listAttachments(input: AttachmentOwner): AttachmentItem[] {
  const owner = attachmentOwnerSchema.parse(input);
  checkOwner(owner);
  return getDb()
    .select()
    .from(attachments)
    .where(eq(ownerColumn(owner.type), owner.id))
    .all()
    .map(publicAttachment);
}
// Source paths come only from the native picker; this helper is not exposed to the renderer.
export function copyReceipt(
  input: AttachmentOwner,
  source: string,
  requestId: string,
) {
  const owner = attachmentOwnerSchema.parse(input);
  recordId.parse(requestId);
  checkOwner(owner);
  const db = getDb();
  const existing = db
    .select()
    .from(attachments)
    .where(eq(attachments.id, requestId))
    .get();
  if (existing) {
    if (
      (owner.type === "payment"
        ? existing.paymentId
        : owner.type === "expense"
          ? existing.expenseId
          : existing.payoutId) !== owner.id
    )
      throw new Error("Receipt request belongs to another record.");
    return publicAttachment(existing);
  }
  const stat = fs.statSync(source);
  if (!stat.isFile() || stat.size === 0 || stat.size > MAX_RECEIPT_BYTES)
    throw new Error("Receipt must be a file smaller than 20 MB.");
  const bytes = fs.readFileSync(source);
  if (bytes.length > MAX_RECEIPT_BYTES)
    throw new Error("Receipt must be smaller than 20 MB.");
  const { extension, mimeType } = receiptFormat(bytes);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const storedName = `${sha256}.${extension}`;
  const { destination, created } = publishManagedAttachment(storedName, bytes);
  try {
    db.insert(attachments)
      .values({
        id: requestId,
        paymentId: owner.type === "payment" ? owner.id : null,
        expenseId: owner.type === "expense" ? owner.id : null,
        payoutId: owner.type === "payout" ? owner.id : null,
        originalName: path.basename(source),
        storedName,
        mimeType,
        sizeBytes: bytes.length,
        sha256,
        createdAt: new Date().toISOString(),
      })
      .run();
    return publicAttachment(
      db.select().from(attachments).where(eq(attachments.id, requestId)).get()!,
    );
  } catch (error) {
    if (created) fs.rmSync(destination, { force: true });
    throw error;
  }
}
export async function openAttachment(id: string) {
  const row = getDb()
    .select()
    .from(attachments)
    .where(eq(attachments.id, recordId.parse(id)))
    .get();
  if (!row) throw new Error("Receipt not found.");
  const file = managedAttachmentPath(row.storedName);
  if (!fs.existsSync(file))
    throw new Error(
      "Receipt file is missing. Restore it from a complete backup.",
    );
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile())
    throw new Error("Receipt integrity check failed.");
  if (
    createHash("sha256").update(fs.readFileSync(file)).digest("hex") !==
    row.sha256
  )
    throw new Error("Receipt integrity check failed.");
  const error = await shell.openPath(file);
  if (error) throw new Error(error);
}
export function pdfOutputDirectory() {
  const value =
    getOrCreateSettings().pdfExportDirectory || app.getPath("downloads");
  if (!path.isAbsolute(value))
    throw new Error("Choose an absolute PDF export directory in Settings.");
  if (!fs.existsSync(value))
    throw new Error(
      "PDF export folder is missing. Choose another folder in Settings.",
    );
  const stat = fs.lstatSync(value);
  if (stat.isSymbolicLink() || !stat.isDirectory())
    throw new Error(
      "PDF export folder must be a real directory, not a symbolic link.",
    );
  fs.accessSync(value, fs.constants.W_OK);
  return value;
}
function assertNonSymlinkFile(filePath: string, message: string) {
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(message);
}
// The PDF generator calls this in the main process after saving its invoice.
export function saveInvoicePdf(invoiceId: string, bytes: Buffer) {
  const invoice = getDb()
    .select()
    .from(invoices)
    .where(eq(invoices.id, recordId.parse(invoiceId)))
    .get();
  if (!invoice) throw new Error("Save the invoice before exporting it.");
  if (bytes.subarray(0, 5).toString() !== "%PDF-")
    throw new Error("Invoice exporter did not produce a PDF.");
  const name = `${invoice.code.replace(/[^a-zA-Z0-9_-]/g, "_")}-${createHash("sha256").update(`${getActiveProfileId()}:${invoiceId}`).digest("hex").slice(0, 12)}.pdf`;
  const filePath = path.join(pdfOutputDirectory(), name);
  if (fs.existsSync(filePath) && fs.lstatSync(filePath).isSymbolicLink())
    throw new Error("Cannot overwrite a symbolic link when exporting PDF.");
  atomicWrite(filePath, bytes);
  getDb()
    .insert(invoicePdfExports)
    .values({ invoiceId, filePath, exportedAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: invoicePdfExports.invoiceId,
      set: { filePath, exportedAt: new Date().toISOString() },
    })
    .run();
  return filePath;
}

export function saveWorkOrderPdf(workOrderId: string, bytes: Buffer): string {
  if (
    !getDb()
      .select()
      .from(workOrders)
      .where(eq(workOrders.id, recordId.parse(workOrderId)))
      .get()
  )
    throw new Error("Voucher not found.");
  if (bytes.subarray(0, 5).toString() !== "%PDF-")
    throw new Error("Voucher exporter did not produce a PDF.");
  const safeId = workOrderId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(-12);
  const name = `VOUCHER-${safeId}-${createHash("sha256").update(`${getActiveProfileId()}:${workOrderId}`).digest("hex").slice(0, 8)}.pdf`;
  const filePath = path.join(pdfOutputDirectory(), name);
  if (fs.existsSync(filePath) && fs.lstatSync(filePath).isSymbolicLink())
    throw new Error("Cannot overwrite a symbolic link when exporting PDF.");
  atomicWrite(filePath, bytes);
  getDb()
    .insert(workOrderPdfExports)
    .values({ workOrderId, filePath, exportedAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: workOrderPdfExports.workOrderId,
      set: { filePath, exportedAt: new Date().toISOString() },
    })
    .run();
  return filePath;
}

export async function openWorkOrderPdf(
  id: string,
  reveal = false,
): Promise<void> {
  if (typeof reveal !== "boolean") throw new Error("Invalid reveal option.");
  const filePath = getDb()
    .select()
    .from(workOrderPdfExports)
    .where(eq(workOrderPdfExports.workOrderId, recordId.parse(id)))
    .get()?.filePath;
  if (!filePath) throw new Error("Export the voucher PDF first.");
  if (!fs.existsSync(filePath))
    throw new Error("Voucher PDF file not found. Export it again.");
  assertNonSymlinkFile(filePath, "Invalid voucher PDF file.");
  if (path.extname(filePath).toLowerCase() !== ".pdf")
    throw new Error("Invalid voucher PDF path.");
  if (reveal) shell.showItemInFolder(filePath);
  else {
    const error = await shell.openPath(filePath);
    if (error) throw new Error(error);
  }
}

export async function openInvoicePdf(invoiceId: string, reveal = false) {
  if (typeof reveal !== "boolean") throw new Error("Invalid reveal option.");
  const record = getDb()
    .select()
    .from(invoicePdfExports)
    .where(eq(invoicePdfExports.invoiceId, recordId.parse(invoiceId)))
    .get();
  if (!record || !fs.existsSync(record.filePath))
    throw new Error("No saved PDF is available. Export this invoice again.");
  assertNonSymlinkFile(record.filePath, "Invalid invoice PDF file.");
  if (path.extname(record.filePath).toLowerCase() !== ".pdf")
    throw new Error("Invalid invoice PDF path.");
  if (reveal) shell.showItemInFolder(record.filePath);
  else {
    const error = await shell.openPath(record.filePath);
    if (error) throw new Error(error);
  }
}
const selections = new Map<
  string,
  {
    sender: Electron.WebContents;
    workspace: ReturnType<typeof captureWorkspace>;
    source: string;
    expires: number;
  }
>();
const observedSenders = new WeakSet<Electron.WebContents>();
function expireSelectionsOnNavigation(sender: Electron.WebContents) {
  if (observedSenders.has(sender)) return;
  observedSenders.add(sender);
  const revoke = () => {
    for (const [token, selection] of selections)
      if (selection.sender === sender) selections.delete(token);
  };
  sender.on("did-start-navigation", (event) => {
    if (event.isMainFrame) revoke();
  });
  sender.once("destroyed", revoke);
}
async function selectReceiptFile(event: Electron.IpcMainInvokeEvent) {
  const workspace = captureWorkspace();
  expireSelectionsOnNavigation(event.sender);
  const result = await dialog.showOpenDialog({
    title: "Select receipt",
    properties: ["openFile"],
    filters: [
      { name: "Receipts", extensions: ["pdf", "png", "jpg", "jpeg", "webp"] },
    ],
  });
  workspace.assertCurrent();
  if (result.canceled || !result.filePaths[0]) return null;
  const source = result.filePaths[0];
  const stat = fs.statSync(source);
  if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_RECEIPT_BYTES)
    throw new Error("Receipt must be a file smaller than 20 MB.");
  receiptFormat(fs.readFileSync(source));
  for (const [id, selection] of selections)
    if (selection.expires < Date.now()) selections.delete(id);
  if (selections.size >= 64) selections.delete(selections.keys().next().value!);
  const token = randomUUID();
  selections.set(token, {
    sender: event.sender,
    workspace,
    source,
    expires: Date.now() + 5 * 60 * 1000,
  });
  // The historical path property now carries an opaque capability, never a disk path.
  return { path: token, name: path.basename(source), size: stat.size };
}
export function registerFileHandlers(broadcast: () => void) {
  ipcMain.handle("attachments:list", (_e, owner: AttachmentOwner) =>
    listAttachments(owner),
  );
  ipcMain.handle("attachments:open", (_e, id: string) => openAttachment(id));
  ipcMain.handle(
    "attachments:select",
    async (
      event,
      input: AttachmentOwner,
      requestId: string,
      token?: string,
    ) => {
      const workspace = captureWorkspace();
      const owner = attachmentOwnerSchema.parse(input);
      recordId.parse(requestId);
      checkOwner(owner);
      const selected = token ? { path: token } : await selectReceiptFile(event);
      workspace.assertCurrent();
      if (!selected) return null;
      const selection = selections.get(selected.path);
      if (
        !selection ||
        selection.sender !== event.sender ||
        selection.expires < Date.now()
      )
        throw new Error("Select this receipt using the file picker again.");
      selections.delete(selected.path);
      selection.workspace.assertCurrent();
      const receipt = copyReceipt(owner, selection.source, requestId);
      broadcast();
      return receipt;
    },
  );
  ipcMain.handle("attachments:chooseFile", (event) => selectReceiptFile(event));
  ipcMain.handle("files:selectPdfDirectory", async () => {
    const workspace = captureWorkspace();
    const result = await dialog.showOpenDialog({
      title: "Choose invoice PDF folder",
      properties: ["openDirectory", "createDirectory"],
    });
    workspace.assertCurrent();
    if (result.canceled || !result.filePaths[0]) return null;
    fs.accessSync(result.filePaths[0], fs.constants.W_OK);
    return result.filePaths[0];
  });
  ipcMain.handle("files:openInvoicePdf", (_e, id: string, reveal?: boolean) =>
    openInvoicePdf(id, reveal),
  );
}
