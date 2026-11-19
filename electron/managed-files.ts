import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { getDatabasePath } from "./db";

export const MAX_RECEIPT_BYTES = 20 * 1024 * 1024;
export function attachmentDirectory() {
  const directory = path.join(path.dirname(getDatabasePath()), "attachments");
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (fs.lstatSync(directory).isSymbolicLink())
    throw new Error("Attachment storage cannot be a symbolic link.");
  if (process.platform !== "win32") {
    try {
      fs.chmodSync(directory, 0o700);
    } catch {
      // Ignore permission errors on read-only/unsupported filesystems
    }
  }
  return directory;
}
export function managedAttachmentPath(name: string) {
  if (!/^[a-f0-9]{64}\.(pdf|png|jpg|webp)$/.test(name))
    throw new Error("Invalid managed attachment name.");
  const file = path.join(attachmentDirectory(), name);
  if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink())
    throw new Error("Attachment cannot be a symbolic link.");
  return file;
}
export function receiptFormat(bytes: Buffer) {
  if (bytes.subarray(0, 5).toString() === "%PDF-")
    return { extension: "pdf", mimeType: "application/pdf" };
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return { extension: "png", mimeType: "image/png" };
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return { extension: "jpg", mimeType: "image/jpeg" };
  if (
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP"
  )
    return { extension: "webp", mimeType: "image/webp" };
  throw new Error("Select a PDF, PNG, JPEG or WebP receipt.");
}

// Publish only complete files; an interrupted copy leaves an unreferenced temporary file.
export function publishManagedAttachment(name: string, bytes: Buffer) {
  const destination = managedAttachmentPath(name);
  if (fs.existsSync(destination)) {
    if (!fs.readFileSync(destination).equals(bytes))
      throw new Error("Existing managed receipt failed integrity validation.");
    return { destination, created: false };
  }
  const temporary = path.join(attachmentDirectory(), `${randomUUID()}.tmp`);
  let handle: number | undefined;
  try {
    handle = fs.openSync(temporary, "wx", 0o600);
    if (process.platform !== "win32") fs.fchmodSync(handle, 0o600);
    fs.writeFileSync(handle, bytes);
    fs.fsyncSync(handle);
    fs.closeSync(handle);
    handle = undefined;
    fs.renameSync(temporary, destination);
    return { destination, created: true };
  } finally {
    if (handle !== undefined) fs.closeSync(handle);
    fs.rmSync(temporary, { force: true });
  }
}

export function atomicWrite(
  destination: string,
  bytes: Buffer | string,
  mode = 0o600,
) {
  const temporary = `${destination}.${randomUUID()}.tmp`;
  let handle: number | undefined;
  try {
    handle = fs.openSync(temporary, "wx", mode);
    if (process.platform !== "win32") fs.fchmodSync(handle, mode);
    fs.writeFileSync(handle, bytes);
    fs.fsyncSync(handle);
    fs.closeSync(handle);
    handle = undefined;
    fs.renameSync(temporary, destination);
  } finally {
    if (handle !== undefined) fs.closeSync(handle);
    fs.rmSync(temporary, { force: true });
  }
}
