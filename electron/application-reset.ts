import fs from "node:fs";
import path from "node:path";
import { atomicWrite } from "./managed-files";

const markerName = ".reset-billflow";
const managedEntries = new Set([
  "profiles",
  "attachments",
  "receipts",
  "backups",
  "quarantined-drafts",
  "appearance.json",
  "exchange-rates.json",
  "profiles.json",
  "profile-lockout.json",
  "window-state.json",
  "BillFlow.ics",
]);

export function queueApplicationReset(directory: string) {
  atomicWrite(path.join(directory, markerName), "reset\n");
}

export async function applyQueuedApplicationReset(
  directory: string,
  clearSession: () => Promise<void>,
) {
  const marker = path.join(directory, markerName);
  if (!fs.existsSync(marker)) return;

  // Run before opening SQLite or loading a renderer. Leave the marker in
  // place if any step fails so a later launch can finish the reset.
  await clearSession();
  for (const name of fs.readdirSync(directory)) {
    const targetName = name.replace(/\.[a-f0-9-]{36}\.tmp$/i, "");
    if (managedEntries.has(targetName) || /^billflow\.db(?:$|[-.])/.test(name)) {
      fs.rmSync(path.join(directory, name), {
        recursive: true,
        force: true,
        maxRetries: 3,
      });
    }
  }
  fs.unlinkSync(marker);
}
