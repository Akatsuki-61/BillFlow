import { app, BrowserWindow, protocol, net, shell } from "electron";
import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";
import { initDatabase } from "./db";
import { registerClientHandlers } from "./ipc/clients";
import { registerInvoiceHandlers } from "./ipc/invoices";
import { registerDashboardHandlers } from "./ipc/dashboard";
import { registerSettingsHandlers } from "./ipc/settings";

import { registerThemeHandlers, windowThemeColors } from "./theme";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;

function broadcastDataChanged() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("data:changed");
  }
}

function createWindow() {
  const isMac = process.platform === "darwin";
  const isWindows = process.platform === "win32";

  const colors = windowThemeColors();
  mainWindow = new BrowserWindow({
    show: false,
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: "BillFlow",
    titleBarStyle: isMac ? "hiddenInset" : isWindows ? "hidden" : "default",
    trafficLightPosition: isMac ? { x: 16, y: 14 } : undefined,
    titleBarOverlay: isWindows
      ? {
          ...colors,
          height: 40,
        }
      : false,
    backgroundColor: colors.color,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  // Handle external links safely via default system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http:") || url.startsWith("https:") || url.startsWith("mailto:")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      // Don't intercept localhost during dev
      if (!url.includes("localhost:3000")) {
        event.preventDefault();
        shell.openExternal(url);
      }
    }
  });

  const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
  const devUrl = process.env.DEV_URL || "http://localhost:3000";

  if (isDev && !process.env.TEST_PROD_BUILD) {
    mainWindow.loadURL(devUrl).catch(() => {
      // Retry in case dev server is still starting
      setTimeout(() => mainWindow?.loadURL(devUrl), 1500);
    });
  } else {
    mainWindow.loadURL("app://billflow/index.html");
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Initialize database and migrations
  initDatabase();

  // Register IPC handlers
  registerClientHandlers(broadcastDataChanged);
  registerInvoiceHandlers(broadcastDataChanged);
  registerDashboardHandlers();
  registerThemeHandlers();
  registerSettingsHandlers(broadcastDataChanged);

  // Register production static file protocol
  const outDir = app.isPackaged
    ? path.join(process.resourcesPath, "out")
    : path.join(__dirname, "../out");

  protocol.handle("app", async (req) => {
    const url = new URL(req.url);
    let filePath = path.join(outDir, decodeURIComponent(url.pathname));

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    } else if (!fs.existsSync(filePath)) {
      if (fs.existsSync(filePath + ".html")) {
        filePath = filePath + ".html";
      } else if (fs.existsSync(path.join(filePath, "index.html"))) {
        filePath = path.join(filePath, "index.html");
      }
    }

    if (!filePath.startsWith(outDir) || !fs.existsSync(filePath)) {
      const fallbackIndex = path.join(outDir, "index.html");
      if (fs.existsSync(fallbackIndex)) {
        return net.fetch(pathToFileURL(fallbackIndex).toString());
      }
      return new Response("Not found", { status: 404 });
    }

    return net.fetch(pathToFileURL(filePath).toString());
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
