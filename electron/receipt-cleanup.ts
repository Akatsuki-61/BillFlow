import fs from "fs";
import { getSqlite } from "./db";
import { attachmentDirectory, managedAttachmentPath } from "./managed-files";
// Called after metadata commits. Interrupted/failed cleanup is retried on the next mutation.
export function reclaimUnreferencedReceipts() {
  const referenced = new Set(
    (
      getSqlite()
        .prepare("SELECT DISTINCT stored_name FROM attachments")
        .all() as { stored_name: string }[]
    ).map((row) => row.stored_name),
  );
  for (const name of fs.readdirSync(attachmentDirectory())) {
    if (
      !/^[a-f0-9]{64}\.(pdf|png|jpg|webp)$/.test(name) ||
      referenced.has(name)
    )
      continue;
    try {
      fs.rmSync(managedAttachmentPath(name), { force: true });
    } catch {
      /* Retain for a later cleanup attempt. */
    }
  }
}
