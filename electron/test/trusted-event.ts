import { configureIpcSecurity } from "../security";
import { EventEmitter } from "node:events";
export function trustedEvent() {
  const frame = { url: "app://billflow/index.html" };
  const sender = Object.assign(new EventEmitter(), {
    mainFrame: frame,
    isDestroyed: () => false,
  });
  configureIpcSecurity(sender as Electron.WebContents, null, () => true);
  return {
    sender,
    senderFrame: frame,
  } as unknown as Electron.IpcMainInvokeEvent;
}
