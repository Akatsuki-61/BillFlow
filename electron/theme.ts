import { app, BrowserWindow, ipcMain, nativeTheme } from "electron";
import fs from "fs";
import path from "path";
import { isThemePreference, type ThemePreference } from "../src/lib/theme";

let preference: ThemePreference = "system";

export function windowThemeColors() {
  return nativeTheme.shouldUseDarkColors
    ? { color: "#17171c", symbolColor: "#f4f4f5" }
    : { color: "#faf9f5", symbolColor: "#111827" };
}

function applyWindowTheme() {
  const colors = windowThemeColors();
  for (const window of BrowserWindow.getAllWindows()) {
    window.setBackgroundColor(colors.color);
    if (process.platform === "win32") window.setTitleBarOverlay(colors);
  }
}

export function registerThemeHandlers() {
  const filePath = path.join(app.getPath("userData"), "appearance.json");
  try {
    const saved: unknown = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (isThemePreference(saved)) preference = saved;
  } catch { /* First launch or an unreadable preference follows the OS. */ }
  nativeTheme.themeSource = preference;
  nativeTheme.on("updated", applyWindowTheme);

  // Only the app's top-level renderer can access these narrow IPC methods.
  ipcMain.on("theme:initial", (event) => {
    event.returnValue = event.senderFrame === event.sender.mainFrame ? preference : "system";
  });
  ipcMain.handle("theme:set", (event, value: unknown) => {
    if (event.senderFrame !== event.sender.mainFrame || !isThemePreference(value)) {
      throw new Error("Invalid theme preference");
    }
    if (value !== preference) {
      // Atomic replacement prevents partial preferences after an interrupted write.
      fs.writeFileSync(filePath + ".tmp", JSON.stringify(value), "utf8");
      fs.renameSync(filePath + ".tmp", filePath);
    }
    preference = value;
    nativeTheme.themeSource = value;
    applyWindowTheme();
  });
}
