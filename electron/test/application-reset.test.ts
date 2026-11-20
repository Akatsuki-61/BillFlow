import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test, vi } from "vitest";
import {
  applyQueuedApplicationReset,
  queueApplicationReset,
} from "../application-reset";

test("full reset retries failed cleanup and removes all managed data without following links", async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "billflow-reset-"));
  const directory = path.join(temp, "workspace");
  const outside = path.join(temp, "external-exports");
  try {
    fs.mkdirSync(directory);
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "exported-backup.bfbackup"), "export");
    fs.mkdirSync(path.join(directory, "profiles", "second"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(directory, "attachments"));
    fs.mkdirSync(path.join(directory, "quarantined-drafts"));
    for (const name of [
      "billflow.db",
      "billflow.db-wal",
      "billflow.db-shm",
      "billflow.db.before-upgrade-12.bak",
      "billflow.db.rolling-backup.key",
      "billflow.db.draft-client.json",
      "appearance.json",
      "exchange-rates.json",
      "profiles.json",
      "profile-lockout.json",
      "window-state.json",
      "BillFlow.ics",
      "quarantined-drafts/old-draft.json",
      "profiles/second/billflow.db",
      "attachments/receipt.pdf",
      "unrelated.txt",
    ]) {
      fs.writeFileSync(path.join(directory, name), "test");
    }
    fs.symlinkSync(outside, path.join(directory, "backups"), "junction");
    const clearSession = vi
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined)
      .mockRejectedValueOnce(new Error("Session unavailable"));

    await applyQueuedApplicationReset(directory, clearSession);
    expect(clearSession).not.toHaveBeenCalled();
    queueApplicationReset(directory);
    await expect(
      applyQueuedApplicationReset(directory, clearSession),
    ).rejects.toThrow("Session unavailable");
    expect(fs.existsSync(path.join(directory, "billflow.db"))).toBe(true);

    await applyQueuedApplicationReset(directory, clearSession);
    expect(fs.readdirSync(directory)).toEqual(["unrelated.txt"]);
    expect(fs.readdirSync(outside)).toEqual(["exported-backup.bfbackup"]);

    await applyQueuedApplicationReset(directory, clearSession);
    expect(clearSession).toHaveBeenCalledTimes(2);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
