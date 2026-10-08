import { app, dialog, ipcMain, shell } from "electron";
import { eq } from "drizzle-orm";
import { randomUUID, createHash } from "crypto";
import fs from "fs";
import path from "path";
import { getDb } from "../db";
import { attachments, invoicePayments, expenses, vendorPayouts, invoicePdfExports, invoices } from "../db/schema";
import { attachmentOwnerSchema, recordId } from "../workflow-validation";
import { getOrCreateSettings } from "./settings";
import type { AttachmentOwner, AttachmentItem } from "../../src/types/workflow";
import { AppError } from "./errors";

import { MAX_RECEIPT_BYTES, managedAttachmentPath, receiptFormat, publishManagedAttachment } from "../managed-files";
export { managedAttachmentPath } from "../managed-files";

const ownerColumn = (type: AttachmentOwner["type"]) => type === "payment" ? attachments.paymentId : type === "expense" ? attachments.expenseId : attachments.payoutId;
function checkOwner(owner: AttachmentOwner) {
  const db = getDb();
  const row = owner.type === "payment" ? db.select().from(invoicePayments).where(eq(invoicePayments.id, owner.id)).get() : owner.type === "expense" ? db.select().from(expenses).where(eq(expenses.id, owner.id)).get() : db.select().from(vendorPayouts).where(eq(vendorPayouts.id, owner.id)).get();
  if (!row) throw new AppError("NOT_FOUND", "Save the payment, expense or payout before attaching its receipt.");
}
function publicAttachment(row: typeof attachments.$inferSelect): AttachmentItem {
  const { id, paymentId, expenseId, payoutId, originalName, mimeType, sizeBytes, createdAt } = row;
  return { id, paymentId, expenseId, payoutId, originalName, mimeType, sizeBytes, createdAt };
}
export function listAttachments(input: AttachmentOwner): AttachmentItem[] {
  const owner = attachmentOwnerSchema.parse(input);
  checkOwner(owner);
  return getDb().select().from(attachments).where(eq(ownerColumn(owner.type), owner.id)).all().map(publicAttachment);
}
// Source paths come only from the native picker; this helper is not exposed to the renderer.
export function copyReceipt(input: AttachmentOwner, source: string, requestId: string) {
  const owner = attachmentOwnerSchema.parse(input);
  recordId.parse(requestId);
  checkOwner(owner);
  const db = getDb();
  const existing = db.select().from(attachments).where(eq(attachments.id, requestId)).get();
  if (existing) {
    if ((owner.type === "payment" ? existing.paymentId : owner.type === "expense" ? existing.expenseId : existing.payoutId) !== owner.id) throw new Error("Receipt request belongs to another record.");
    return publicAttachment(existing);
  }
  const stat = fs.statSync(source);
  if (!stat.isFile() || stat.size === 0 || stat.size > MAX_RECEIPT_BYTES) throw new Error("Receipt must be a file smaller than 20 MB.");
  const bytes = fs.readFileSync(source);
  if (bytes.length > MAX_RECEIPT_BYTES) throw new Error("Receipt must be smaller than 20 MB.");
  const { extension, mimeType } = receiptFormat(bytes);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const storedName = `${sha256}.${extension}`;
  const { destination, created } = publishManagedAttachment(storedName, bytes);
  try {
    db.insert(attachments).values({ id: requestId, paymentId: owner.type === "payment" ? owner.id : null, expenseId: owner.type === "expense" ? owner.id : null, payoutId: owner.type === "payout" ? owner.id : null, originalName: path.basename(source), storedName, mimeType, sizeBytes: bytes.length, sha256, createdAt: new Date().toISOString() }).run();
    return publicAttachment(db.select().from(attachments).where(eq(attachments.id, requestId)).get()!);
  } catch (error) {
    if (created) fs.rmSync(destination, { force: true });
    throw error;
  }
}
export async function openAttachment(id: string) {
  const row = getDb().select().from(attachments).where(eq(attachments.id, recordId.parse(id))).get();
  if (!row) throw new Error("Receipt not found.");
  const file = managedAttachmentPath(row.storedName);
  if (!fs.existsSync(file)) throw new Error("Receipt file is missing. Restore it from a complete backup.");
  if (createHash("sha256").update(fs.readFileSync(file)).digest("hex") !== row.sha256) throw new Error("Receipt integrity check failed.");
  const error = await shell.openPath(file);
  if (error) throw new Error(error);
}
export function pdfOutputDirectory() {
  const value = getOrCreateSettings().pdfExportDirectory || app.getPath("downloads");
  if (!path.isAbsolute(value)) throw new Error("Choose an absolute PDF export directory in Settings.");
  if (!fs.existsSync(value) || !fs.statSync(value).isDirectory()) throw new Error("PDF export folder is missing. Choose another folder in Settings.");
  fs.accessSync(value, fs.constants.W_OK);
  return value;
}
// The PDF generator calls this in the main process after saving its invoice.
export function saveInvoicePdf(invoiceId: string, bytes: Buffer) {
  const invoice = getDb().select().from(invoices).where(eq(invoices.id, recordId.parse(invoiceId))).get();
  if (!invoice) throw new Error("Save the invoice before exporting it.");
  if (bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("Invoice exporter did not produce a PDF.");
  const name = `${invoice.code.replace(/[^a-zA-Z0-9_-]/g, "_")}-${createHash("sha256").update(invoiceId).digest("hex").slice(0, 12)}.pdf`;
  const filePath = path.join(pdfOutputDirectory(), name);
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, bytes, { flag: "wx" });
    fs.renameSync(temporary, filePath);
    getDb().insert(invoicePdfExports).values({ invoiceId, filePath, exportedAt: new Date().toISOString() }).onConflictDoUpdate({ target: invoicePdfExports.invoiceId, set: { filePath, exportedAt: new Date().toISOString() } }).run();
  } finally { fs.rmSync(temporary, { force: true }); }
  return filePath;
}
export async function openInvoicePdf(invoiceId: string, reveal = false) {
  if (typeof reveal !== "boolean") throw new Error("Invalid reveal option.");
  const record = getDb().select().from(invoicePdfExports).where(eq(invoicePdfExports.invoiceId, recordId.parse(invoiceId))).get();
  if (!record || !fs.existsSync(record.filePath)) throw new Error("No saved PDF is available. Export this invoice again.");
  if (path.extname(record.filePath).toLowerCase() !== ".pdf") throw new Error("Invalid invoice PDF path.");
  if (reveal) shell.showItemInFolder(record.filePath);
  else { const error = await shell.openPath(record.filePath); if (error) throw new Error(error); }
}
export function registerFileHandlers(broadcast: () => void) {
  ipcMain.handle("attachments:list", (_e, owner: AttachmentOwner) => listAttachments(owner));
  ipcMain.handle("attachments:open", (_e, id: string) => openAttachment(id));
  ipcMain.handle("attachments:select", async (_e, input: AttachmentOwner, requestId: string, filePath?: string) => {
    const owner = attachmentOwnerSchema.parse(input); recordId.parse(requestId); checkOwner(owner);
    let chosenPath = filePath;
    if (!chosenPath) {
      const result = await dialog.showOpenDialog({ title: "Attach receipt", properties: ["openFile"], filters: [{ name: "Receipts", extensions: ["pdf", "png", "jpg", "jpeg", "webp"] }] });
      if (result.canceled || !result.filePaths[0]) return null;
      chosenPath = result.filePaths[0];
    }
    const receipt = copyReceipt(owner, chosenPath, requestId); broadcast(); return receipt;
  });
  ipcMain.handle("attachments:chooseFile", async () => {
    const result = await dialog.showOpenDialog({
      title: "Select payment slip or receipt",
      properties: ["openFile"],
      filters: [{ name: "Receipts & Slips", extensions: ["pdf", "png", "jpg", "jpeg", "webp"] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const target = result.filePaths[0];
    const stat = fs.statSync(target);
    return {
      path: target,
      name: path.basename(target),
      size: stat.size,
    };
  });
  ipcMain.handle("files:selectPdfDirectory", async () => {
    const result = await dialog.showOpenDialog({ title: "Choose invoice PDF folder", properties: ["openDirectory", "createDirectory"] });
    if (result.canceled || !result.filePaths[0]) return null;
    const folder = result.filePaths[0];
    fs.accessSync(folder, fs.constants.W_OK);
    return folder;
  });
  ipcMain.handle("files:openInvoicePdf", (_e, id: string, reveal?: boolean) => openInvoicePdf(id, reveal));
}
