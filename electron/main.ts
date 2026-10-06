import { app, BrowserWindow, protocol, net, shell, Menu, Tray, nativeImage, nativeTheme, dialog } from "electron";
import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";
import { initDatabase } from "./db";
import { registerClientHandlers } from "./ipc/clients";
import { registerInvoiceHandlers } from "./ipc/invoices";
import { registerDashboardHandlers } from "./ipc/dashboard";
import { registerSettingsHandlers } from "./ipc/settings";
import { registerVendorHandlers } from "./ipc/vendors";
import { registerAnalyticsHandlers } from "./ipc/analytics";

import { registerTaskHandlers } from "./ipc/tasks";
import { registerFileHandlers } from "./ipc/files";
import { registerExpenseHandlers } from "./ipc/expenses";

import { registerThemeHandlers, windowThemeColors } from "./theme";
import { registerCatalogHandlers } from "./ipc/catalog";

const testProfile = process.env.BILLFLOW_USER_DATA;
if (testProfile) {
  if (!path.isAbsolute(testProfile)) throw new Error("BILLFLOW_USER_DATA must be absolute.");
  fs.mkdirSync(testProfile, {recursive:true});
  app.setPath("userData",testProfile);
}

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

app.setName("BillFlow");
if (process.env.BILLFLOW_USER_DATA) {
  if (!path.isAbsolute(process.env.BILLFLOW_USER_DATA)) throw new Error("BILLFLOW_USER_DATA must be absolute.");
  app.setPath("userData", process.env.BILLFLOW_USER_DATA);
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function appIconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "brand", "icon.png")
    : path.join(__dirname, "../build/icon.png");
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  if (mainWindow?.isMinimized()) mainWindow.restore();
  mainWindow?.show();
  mainWindow?.focus();
}

function createTray() {
  if (process.platform !== "darwin" && process.platform !== "win32") return;
  const directory = app.isPackaged
    ? path.join(process.resourcesPath, "brand", "tray")
    : path.join(__dirname, "../build/tray");
  const trayImage = () => {
    if (process.platform === "darwin") {
      const image = nativeImage.createFromPath(path.join(directory, "trayTemplate.png"));
      image.setTemplateImage(true);
      return image;
    }
    // Follow the Windows taskbar theme, independently of the app's appearance.
    return path.join(directory, nativeTheme.shouldUseDarkColorsForSystemIntegratedUI
      ? "tray-white.ico" : "tray-color.ico");
  };
  tray = new Tray(trayImage());
  tray.setToolTip("BillFlow");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open BillFlow", click: showMainWindow },
    { type: "separator" },
    { label: "Quit BillFlow", click: () => app.quit() },
  ]));
  if (process.platform === "win32") {
    tray.on("click", showMainWindow);
    nativeTheme.on("updated", () => tray?.setImage(trayImage()));
  }
}

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
    icon: appIconPath(),
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

  mainWindow.once("ready-to-show", () => {
    if (!(testProfile && process.env.BILLFLOW_VERIFY_HIDDEN === "1")) mainWindow?.show();
  });

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
  if (process.platform === "darwin") app.dock?.setIcon(appIconPath());
  // Initialize database and migrations
  try { initDatabase(); } catch (error) {
    dialog.showErrorBox("BillFlow database upgrade failed", error instanceof Error ? error.message : String(error));
    app.quit(); return;
  }

  // Register IPC handlers
  registerClientHandlers(broadcastDataChanged);
  registerInvoiceHandlers(broadcastDataChanged);
  registerDashboardHandlers();
  registerThemeHandlers();
  registerSettingsHandlers(broadcastDataChanged);
  registerVendorHandlers(broadcastDataChanged);
  registerAnalyticsHandlers();
  registerCatalogHandlers(broadcastDataChanged);
  registerTaskHandlers(broadcastDataChanged);
  registerFileHandlers(broadcastDataChanged);
  registerExpenseHandlers(broadcastDataChanged);

  // Register production static file protocol
  const outDir = app.isPackaged
    ? path.join(app.getAppPath(), "out")
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
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch(error => {
  console.error("BillFlow startup failed", error);
  dialog.showErrorBox("BillFlow could not open your data", `${error instanceof Error ? error.message : String(error)}\nNo business writes were enabled. Keep your data directory and repair or reinstall the app.`);
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  tray?.destroy();
  tray = null;
});
