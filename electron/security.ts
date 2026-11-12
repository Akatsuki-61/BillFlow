import { AsyncLocalStorage } from "async_hooks";
import { ipcMain as nativeIpcMain } from "electron";
import type { WebContents, IpcMainEvent, IpcMainInvokeEvent } from "electron";

const channelContext = new AsyncLocalStorage<string>();
export function currentIpcChannel() {
  return channelContext.getStore() || "";
}
let trustedContents: WebContents | null = null;
let developmentOrigin: string | null = null;
let authorizeWorkspace: () => boolean = () => false;
const bootstrapChannels = new Set([
  "profiles:list",
  "profiles:switch",
  "profiles:verifyPassword",
  "profiles:lock",
  "profiles:completeOnboarding",
  "theme:initial",
  "theme:set",
]);

export function isTrustedDocument(
  value: string,
  devOrigin: string | null = null,
): boolean {
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    if (url.protocol === "app:")
      return url.hostname === "billflow" && !url.port;
    return Boolean(
      devOrigin && url.origin === devOrigin && url.protocol === "http:",
    );
  } catch {
    return false;
  }
}
export function configureIpcSecurity(
  contents: WebContents | null,
  devOrigin: string | null,
  unlocked: () => boolean,
) {
  trustedContents = contents;
  developmentOrigin = devOrigin;
  authorizeWorkspace = unlocked;
}
export function assertTrustedSender(
  event: IpcMainEvent | IpcMainInvokeEvent,
  channel: string,
) {
  if (
    !trustedContents ||
    event.sender !== trustedContents ||
    trustedContents.isDestroyed() ||
    !event.senderFrame ||
    event.senderFrame !== trustedContents.mainFrame ||
    !isTrustedDocument(event.senderFrame.url, developmentOrigin)
  ) {
    throw new Error(
      "UNTRUSTED_SENDER: This operation is only available to the BillFlow window.",
    );
  }
  if (!bootstrapChannels.has(channel) && !authorizeWorkspace())
    throw new Error("WORKSPACE_LOCKED: Unlock your profile to continue.");
}
// All application registrations pass through the same fail-closed boundary.
export const ipcMain = {
  handle(
    channel: string,
    listener: Parameters<typeof nativeIpcMain.handle>[1],
  ) {
    nativeIpcMain.handle(channel, (event, ...args) => {
      assertTrustedSender(event, channel);
      return channelContext.run(channel, () => listener(event, ...args));
    });
  },
  on(channel: string, listener: Parameters<typeof nativeIpcMain.on>[1]) {
    nativeIpcMain.on(channel, (event, ...args) => {
      try {
        assertTrustedSender(event, channel);
        listener(event, ...args);
      } catch {
        event.returnValue = null;
      }
    });
  },
};
