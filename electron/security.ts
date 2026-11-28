import { AsyncLocalStorage } from "async_hooks";
import { ipcMain as nativeIpcMain } from "electron";
import type { WebContents, IpcMainEvent, IpcMainInvokeEvent } from "electron";
import { formatError } from "./ipc/errors";

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
  "profiles:lock",
  "profiles:completeOnboarding",
  "theme:initial",
  "theme:set",
  "window:close-response",
]);

const allowedMailtoParams = new Set(["subject", "body", "cc", "bcc"]);
export function sanitizeExternalUrl(value: string): string | null {
  if (!value || value.length > 4096 || /[\x00-\x1f\x7f]/.test(value))
    return null;
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    if (url.protocol === "https:" || url.protocol === "http:") return url.href;
    if (url.protocol === "mailto:") {
      const keys = [...url.searchParams.keys()];
      if (
        new Set(keys).size !== keys.length ||
        keys.some((key) => !allowedMailtoParams.has(key.toLowerCase()))
      )
        return null;
      return url.href;
    }
    return null;
  } catch {
    return null;
  }
}

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
      try {
        const result = channelContext.run(channel, () =>
          listener(event, ...args),
        );
        if (
          result &&
          typeof (result as PromiseLike<unknown>).then === "function"
        ) {
          return (result as Promise<unknown>).catch((error) => {
            throw formatError(error);
          });
        }
        return result;
      } catch (error) {
        throw formatError(error);
      }
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
  once(channel: string, listener: Parameters<typeof nativeIpcMain.once>[1]) {
    nativeIpcMain.once(channel, (event, ...args) => {
      try {
        assertTrustedSender(event, channel);
        listener(event, ...args);
      } catch {
        event.returnValue = null;
      }
    });
  },
  removeAllListeners(channel: string) {
    nativeIpcMain.removeAllListeners(channel);
  },
};
