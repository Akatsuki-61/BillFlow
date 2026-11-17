import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getSqlite, getActiveProfileId } from "./db";
import { ipcMain } from "./security";
import type { ActivityInput, WorkspaceActivity } from "../src/types/activity";
let notify: () => void = () => {};
const activitySchema = z.object({
  kind: z.enum([
    "communication",
    "delivery",
    "pdf-pending",
    "pdf-saved",
    "pdf-failed",
  ]),
  recordId: z.string().min(1).max(160),
  label: z.string().max(160),
  detail: z.string().max(500),
});
export function recordActivity(input: ActivityInput) {
  const value = activitySchema.parse(input);
  getSqlite()
    .prepare(
      "INSERT INTO workspace_activity(id,kind,record_id,label,detail,created_at) VALUES (?,?,?,?,?,?)",
    )
    .run(
      randomUUID(),
      value.kind,
      value.recordId,
      value.label,
      value.detail,
      new Date().toISOString(),
    );
  notify();
}
export function listActivity(): WorkspaceActivity[] {
  return getSqlite()
    .prepare(
      "SELECT id, kind, record_id AS recordId, label, detail, created_at AS createdAt FROM workspace_activity ORDER BY created_at DESC, rowid DESC LIMIT 200",
    )
    .all() as WorkspaceActivity[];
}
export function registerActivityHandlers(changed: () => void) {
  notify = changed;
  ipcMain.handle("workspace:activity", () => listActivity());
  ipcMain.handle(
    "workspace:recordActivity",
    (_event, profileId: string, input: ActivityInput) => {
      if (profileId !== getActiveProfileId())
        throw new Error(
          "WORKSPACE_CHANGED: Activity belongs to another profile.",
        );
      const value = activitySchema.parse(input);
      if (!["communication", "delivery"].includes(value.kind))
        throw new Error(
          "Only communication and delivery actions can be recorded here.",
        );
      recordActivity(value);
    },
  );
}
