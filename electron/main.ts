import { registerWorkspaceHandlers } from "./ipc/workspace";
import { affectedDatasets } from "../src/types/workspace";
import { getActiveProfileId, getWorkspaceGeneration } from "./db";
import { currentIpcChannel } from "./security";
import { configureIpcSecurity, isTrustedDocument } from "./security";
import { isWorkspaceUnlocked, lockProfileSession } from "./workspace-session";
import { resolveStaticFile, documentCsp } from "./static-protocol";
import {
  app,
  BrowserWindow,
  protocol,
  net,
  shell,
  Menu,
  Tray,
  nativeImage,
  nativeTheme,
  dialog,
  session,
} from "electron";
import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";
import { initDatabase } from "./db";
import { registerClientHandlers } from "./ipc/clients";
import { registerInvoiceHandlers } from "./ipc/invoices";
import { registerDashboardHandlers } from "./ipc/dashboard";
import { registerSettingsHandlers } from "./ipc/settings";
import { registerVendorHandlers } from "./ipc/vendors";
import { registerWorkOrderHandlers } from "./ipc/workOrders";
import { registerAnalyticsHandlers } from "./ipc/analytics";

import { registerTaskHandlers } from "./ipc/tasks";
import { registerFileHandlers } from "./ipc/files";
import { registerExpenseHandlers } from "./ipc/expenses";
import { registerCalendarHandlers } from "./ipc/calendar";

import { registerThemeHandlers, windowThemeColors } from "./theme";
import { registerCatalogHandlers } from "./ipc/catalog";
import { registerProfileHandlers, listProfilesState } from "./ipc/profiles";
import { setupAboutPanel, createApplicationMenu } from "./menu";

const testProfile = process.env.BILLFLOW_USER_DATA;
if (testProfile) {
  if (!path.isAbsolute(testProfile))
    throw new Error("BILLFLOW_USER_DATA must be absolute.");
  fs.mkdirSync(testProfile, { recursive: true });
  app.setPath("userData", testProfile);
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
  if (!path.isAbsolute(process.env.BILLFLOW_USER_DATA))
    throw new Error("BILLFLOW_USER_DATA must be absolute.");
  app.setPath("userData", process.env.BILLFLOW_USER_DATA);
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showMainWindow();
  });
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
      const image = nativeImage.createFromPath(
        path.join(directory, "trayTemplate.png"),
      );
      image.setTemplateImage(true);
      return image;
    }
    // Follow the Windows taskbar theme, independently of the app's appearance.
    return path.join(
      directory,
      nativeTheme.shouldUseDarkColorsForSystemIntegratedUI
        ? "tray-white.ico"
        : "tray-color.ico",
    );
  };
  tray = new Tray(trayImage());
  tray.setToolTip("BillFlow");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open BillFlow", click: showMainWindow },
      { type: "separator" },
      { label: "Quit BillFlow", click: () => app.quit() },
    ]),
  );
  if (process.platform === "win32") {
    tray.on("click", showMainWindow);
    nativeTheme.on("updated", () => tray?.setImage(trayImage()));
  }
}

function broadcastDataChanged() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("data:changed", {
      profileId: getActiveProfileId(),
      generation: getWorkspaceGeneration(),
      datasets: affectedDatasets(currentIpcChannel()),
    });
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
    if (!(testProfile && process.env.BILLFLOW_VERIFY_HIDDEN === "1"))
      mainWindow?.show();
  });

  const isDev = !app.isPackaged && process.env.TEST_PROD_BUILD !== "1";
  const devUrl = "http://127.0.0.1:3000";
  configureIpcSecurity(
    mainWindow.webContents,
    isDev ? devUrl : null,
    isWorkspaceUnlocked,
  );
  const openExternal = (value: string) => {
    try {
      const url = new URL(value);
      if (
        !url.username &&
        !url.password &&
        ["https:", "http:", "mailto:"].includes(url.protocol)
      )
        void shell.openExternal(url.href);
    } catch {
      /* Invalid links never reach the OS. */
    }
  };
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });
  const guardNavigation = (event: Electron.Event, url: string) => {
    if (!isTrustedDocument(url, isDev ? devUrl : null)) {
      event.preventDefault();
      openExternal(url);
    }
  };
  mainWindow.webContents.on("will-navigate", guardNavigation);
  mainWindow.webContents.on("will-redirect", guardNavigation);
  mainWindow.webContents.on("will-frame-navigate", (event) => {
    if (
      !event.isMainFrame ||
      !isTrustedDocument(event.url, isDev ? devUrl : null)
    )
      event.preventDefault();
  });
  mainWindow.webContents.on("render-process-gone", () => {
    lockProfileSession();
  });

  if (isDev && !process.env.TEST_PROD_BUILD) {
    mainWindow.loadURL(devUrl).catch(() => {
      // Retry in case dev server is still starting
      setTimeout(() => mainWindow?.loadURL(devUrl), 1500);
    });
  } else {
    mainWindow.loadURL("app://billflow/index.html");
  }

  mainWindow.on("closed", () => {
    lockProfileSession();
    configureIpcSecurity(null, null, () => false);
    mainWindow = null;
  });
}

app
  .whenReady()
  .then(() => {
    if (process.platform === "darwin") app.dock?.setIcon(appIconPath());
    // Initialize database and migrations
    try {
      initDatabase();
      listProfilesState();
    } catch (error) {
      dialog.showErrorBox(
        "BillFlow database upgrade failed",
        error instanceof Error ? error.message : String(error),
      );
      app.quit();
      return;
    }

    // Register IPC handlers
    registerWorkspaceHandlers();
    registerProfileHandlers(broadcastDataChanged);
    registerClientHandlers(broadcastDataChanged);
    registerInvoiceHandlers(broadcastDataChanged);
    registerDashboardHandlers();
    registerThemeHandlers();
    registerSettingsHandlers(broadcastDataChanged);
    registerVendorHandlers(broadcastDataChanged);
    registerWorkOrderHandlers(broadcastDataChanged);
    registerAnalyticsHandlers();
    registerCatalogHandlers(broadcastDataChanged);
    registerTaskHandlers(broadcastDataChanged);
    registerFileHandlers(broadcastDataChanged);
    registerExpenseHandlers(broadcastDataChanged);
    registerCalendarHandlers(broadcastDataChanged);

    // Register production static file protocol
    const outDir = app.isPackaged
      ? path.join(app.getAppPath(), "out")
      : path.join(__dirname, "../out");

    protocol.handle("app", async (req) => {
      const filePath = resolveStaticFile(outDir, req.url);
      if (!filePath) return new Response("Not found", { status: 404 });
      const response = await net.fetch(pathToFileURL(filePath).toString());
      const headers = new Headers(response.headers);
      headers.set("X-Content-Type-Options", "nosniff");
      if (filePath.endsWith(".html"))
        headers.set(
          "Content-Security-Policy",
          documentCsp(fs.readFileSync(filePath, "utf8")),
        );
      return new Response(response.body, { status: response.status, headers });
    });
    session.defaultSession.setPermissionRequestHandler(
      (_contents, _permission, callback) => callback(false),
    );
    session.defaultSession.setPermissionCheckHandler(() => false);
    if (app.isPackaged || process.env.TEST_PROD_BUILD === "1") {
      session.defaultSession.webRequest.onBeforeRequest(
        { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
        (_details, callback) => callback({ cancel: true }),
      );
    }

    createWindow();
    createTray();
    setupAboutPanel();
    createApplicationMenu(() => mainWindow, showMainWindow);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  })
  .catch((error) => {
    console.error("BillFlow startup failed", error);
    dialog.showErrorBox(
      "BillFlow could not open your data",
      `${error instanceof Error ? error.message : String(error)}\nNo business writes were enabled. Keep your data directory and repair or reinstall the app.`,
    );
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
