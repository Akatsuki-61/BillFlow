import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { Notification, shell } from "electron";
import { getRootDb } from "./db";
import { appSetup } from "./db/schema";
import { ipcMain } from "./security";
import type { DesktopSetup } from "../src/types/profiles";

const runFile = promisify(execFile);

export function getDesktopSetup(): DesktopSetup | null {
  return (
    getRootDb()
      .select({
        permissionsPending: appSetup.permissionsPending,
        notificationsEnabled: appSetup.notificationsEnabled,
        calendarConnected: appSetup.calendarConnected,
      })
      .from(appSetup)
      .where(eq(appSetup.id, 1))
      .get() ?? null
  );
}

export function finishDesktopSetup() {
  getRootDb()
    .update(appSetup)
    .set({ permissionsPending: false })
    .where(eq(appSetup.id, 1))
    .run();
}

export function desktopNotificationsEnabled() {
  const setup = getDesktopSetup();
  return setup ? !setup.permissionsPending && setup.notificationsEnabled : true;
}

async function connectAppleCalendar() {
  if (
    process.platform !== "darwin" ||
    process.env.BILLFLOW_DISABLE_NATIVE_CALENDAR === "1"
  ) {
    return "Apple Calendar is unavailable in this session.";
  }
  if (getDesktopSetup()?.calendarConnected !== false) return null;

  try {
    // A read-only Apple event asks for Automation access without importing events.
    await runFile(
      "/usr/bin/osascript",
      ["-e", 'tell application id "com.apple.iCal" to count calendars'],
      { timeout: 90_000, maxBuffer: 16_384 },
    );
  } catch {
    return "Calendar access is unavailable. To retry, allow BillFlow to control Calendar in System Settings → Privacy & Security → Automation.";
  }

  getRootDb()
    .update(appSetup)
    .set({ calendarConnected: true })
    .where(eq(appSetup.id, 1))
    .run();
  return null;
}

export function registerDesktopSetupHandlers() {
  ipcMain.handle("integrations:requestNotifications", () => {
    // Electron 44 initializes its macOS notification authorization request
    // when it creates the native presenter. Its API reports support, not the OS grant.
    if (
      process.env.BILLFLOW_VERIFY_HIDDEN !== "1" &&
      !Notification.isSupported()
    ) {
      return "Desktop notifications are unavailable on this device.";
    }
    getRootDb()
      .update(appSetup)
      .set({ notificationsEnabled: true })
      .where(eq(appSetup.id, 1))
      .run();
    return null;
  });
  ipcMain.handle("integrations:openNotificationSettings", () => {
    if (process.platform === "darwin") {
      return shell.openExternal(
        "x-apple.systempreferences:com.apple.Notifications-Settings.extension",
      );
    }
    if (process.platform === "win32") {
      return shell.openExternal("ms-settings:notifications");
    }
  });
  ipcMain.handle("integrations:connectCalendar", connectAppleCalendar);
}
