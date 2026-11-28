import { registerStatementHandlers } from "./ipc/statements";
import { getDesktopSetup, registerDesktopSetupHandlers } from "./desktop-setup";
import { registerActivityHandlers } from "./workspace-activity";
import { registerWorkspaceHandlers } from "./ipc/workspace";
import { registerExchangeRateHandlers } from "./exchange-rates";
import { affectedDatasets } from "../src/types/workspace";
import {
  closeAllDatabases,
  getActiveProfileId,
  getWorkspaceGeneration,
  initDatabase,
} from "./db";
import {
  configureIpcSecurity,
  currentIpcChannel,
  ipcMain,
  isTrustedDocument,
  sanitizeExternalUrl,
} from "./security";
import { isWorkspaceUnlocked, lockProfileSession } from "./workspace-session";
import {
  cachedDocumentCsp,
  resolveStaticFile,
} from "./static-protocol";
import { destroyPdfWindowPool } from "./pdf-generator";
import { APPLICATION_RESET_CONFIRMATION } from "../src/types/settings";
import {
  applyQueuedApplicationReset,
  queueApplicationReset,
} from "./application-reset";
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
  powerMonitor,
  dialog,
  screen,
  session,
} from "electron";
import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";
import {
  clampWindowBounds,
  loadWindowState,
  saveWindowState,
  type WindowState,
} from "./window-state";
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
import { registerAiHandlers, disposeAiResources } from "./ipc/ai";
import { registerUpdateHandlers } from "./updater";
import {
  registerEncryptedBackupHandlers,
  runRollingEncryptedBackup,
} from "./encrypted-backup";
import {
  registerRecurringHandlers,
  runDueRecurringRules,
} from "./ipc/recurring";
import {
  registerDigestHandlers,
  maybeSendDailyDigest,
  syncAppBadgeCount,
} from "./digest";
import { registerQuoteHandlers } from "./ipc/quotes";
import { localDateKey } from "../src/lib/visual-metrics";

import { registerThemeHandlers, windowThemeColors } from "./theme";
import { registerCatalogHandlers } from "./ipc/catalog";
import { registerProfileHandlers, listProfilesState } from "./ipc/profiles";
import {
  setupAboutPanel,
  createApplicationMenu,
  buildQuickActionsMenuTemplate,
} from "./menu";

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
  {
    scheme: "billflow-pdf",
    privileges: {
      standard: true,
      secure: true,
    },
  },
]);

app.setName("BillFlow");

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
let maintenanceTimer: ReturnType<typeof setInterval> | null = null;
let startupMaintenanceTimer: ReturnType<typeof setTimeout> | null = null;
let maintenanceInFlight = false;
let applicationResetQueued = false;
const rendererCrashTimestamps: number[] = [];

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

function navigateToRoute(route: string) {
  showMainWindow();
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;
  const dispatchRoute = () => {
    if (!win.isDestroyed() && isWorkspaceUnlocked()) {
      win.webContents.send("navigate-to", route);
    }
  };
  if (win.webContents.isLoading()) {
    win.webContents.once("did-finish-load", dispatchRoute);
  } else {
    dispatchRoute();
  }
}

function openUpdatesDialog() {
  showMainWindow();
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;
  const dispatchOpen = () => {
    if (win.isDestroyed()) return;
    if (isWorkspaceUnlocked()) {
      win.webContents.send("updates:open-dialog");
    } else {
      void dialog.showMessageBox(win, {
        type: "info",
        title: "Check for Updates",
        message: "Unlock your profile to check for updates",
        detail:
          "Unlock your BillFlow workspace first, then choose Check for Updates again or click the version number in Settings.",
        buttons: ["OK"],
      });
    }
  };
  if (win.webContents.isLoading()) {
    win.webContents.once("did-finish-load", dispatchOpen);
  } else {
    dispatchOpen();
  }
}

function lockWorkspaceNow() {
  lockProfileSession();
  syncAppBadgeCount({ tray });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("workspace:locked");
  }
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
    Menu.buildFromTemplate(
      buildQuickActionsMenuTemplate({
        openApp: showMainWindow,
        navigate: navigateToRoute,
        lockWorkspace: lockWorkspaceNow,
        quit: () => app.quit(),
        includeOpenAndQuit: true,
      }),
    ),
  );
  if (process.platform === "win32") {
    tray.on("click", showMainWindow);
    nativeTheme.on("updated", () => tray?.setImage(trayImage()));
  }
}

function broadcastDataChanged() {
  syncAppBadgeCount({ tray });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("data:changed", {
      profileId: getActiveProfileId(),
      generation: getWorkspaceGeneration(),
      datasets: affectedDatasets(currentIpcChannel()),
    });
  }
}

async function runBackgroundMaintenance() {
  if (maintenanceInFlight || !isWorkspaceUnlocked() || getDesktopSetup()?.permissionsPending) return;
  maintenanceInFlight = true;
  try {
    syncAppBadgeCount({ tray });
    const recurringResult = await runDueRecurringRules(localDateKey(new Date()), {
      autoExport: true,
      notify: true,
      navigate: navigateToRoute,
    });
    if (recurringResult.generated.length > 0 && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("data:changed", {
        profileId: getActiveProfileId(),
        generation: getWorkspaceGeneration(),
        datasets: ["invoices", "clients", "dashboard", "recurringRules", "backupStatus"],
      });
    }
    syncAppBadgeCount({ tray });
    maybeSendDailyDigest({ navigate: navigateToRoute });
    runRollingEncryptedBackup();
  } catch (err) {
    console.warn("Background maintenance warning:", err);
  } finally {
    maintenanceInFlight = false;
  }
}

function createWindow() {
  const isMac = process.platform === "darwin";
  const isWindows = process.platform === "win32";

  const statePath = path.join(app.getPath("userData"), "window-state.json");
  const allDisplays = screen.getAllDisplays().map((d) => d.workArea);
  const primaryWorkArea = screen.getPrimaryDisplay().workArea;
  const rawState = loadWindowState(statePath, allDisplays, primaryWorkArea);
  const matchedWorkArea =
    rawState.x !== undefined && rawState.y !== undefined
      ? screen.getDisplayMatching({
          x: rawState.x,
          y: rawState.y,
          width: rawState.width,
          height: rawState.height,
        }).workArea
      : primaryWorkArea;
  const initialState = clampWindowBounds(
    rawState,
    allDisplays,
    matchedWorkArea,
  );

  const colors = windowThemeColors();
  mainWindow = new BrowserWindow({
    show: false,
    ...(initialState.x !== undefined && initialState.y !== undefined
      ? { x: initialState.x, y: initialState.y }
      : {}),
    width: initialState.width,
    height: initialState.height,
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

  let lastNormalBounds = mainWindow.getBounds();
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const captureNormalBounds = () => {
    if (
      !mainWindow ||
      mainWindow.isDestroyed() ||
      mainWindow.isMaximized() ||
      mainWindow.isMinimized() ||
      mainWindow.isFullScreen()
    ) {
      return;
    }
    lastNormalBounds = mainWindow.getBounds();
  };
  const currentWindowState = (): WindowState => ({
    ...lastNormalBounds,
    isMaximized: Boolean(
      mainWindow && !mainWindow.isDestroyed() && mainWindow.isMaximized(),
    ),
  });
  const scheduleSaveWindowState = () => {
    captureNormalBounds();
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      try {
        saveWindowState(statePath, currentWindowState());
      } catch {
        // Ignore non-fatal disk write error during resize/move
      }
    }, 250);
  };
  mainWindow.on("resize", scheduleSaveWindowState);
  mainWindow.on("move", scheduleSaveWindowState);
  mainWindow.on("maximize", scheduleSaveWindowState);
  mainWindow.on("unmaximize", scheduleSaveWindowState);
  mainWindow.on("close", () => {
    captureNormalBounds();
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    try {
      saveWindowState(statePath, currentWindowState());
    } catch {
      // Ignore non-fatal disk write error during window close
    }
  });

  mainWindow.once("ready-to-show", () => {
    if (
      mainWindow &&
      !mainWindow.isDestroyed() &&
      !(testProfile && process.env.BILLFLOW_VERIFY_HIDDEN === "1")
    ) {
      if (initialState.isMaximized) {
        mainWindow.maximize();
      }
      mainWindow.show();
    }
  });

  const isDev = !app.isPackaged && process.env.TEST_PROD_BUILD !== "1";
  const devUrl = "http://127.0.0.1:3000";
  configureIpcSecurity(
    mainWindow.webContents,
    isDev ? devUrl : null,
    isWorkspaceUnlocked,
  );
  const openExternal = (value: string) => {
    if (!isWorkspaceUnlocked()) return;
    const safeUrl = sanitizeExternalUrl(value);
    if (safeUrl) void shell.openExternal(safeUrl);
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
  const startUrl =
    isDev && !process.env.TEST_PROD_BUILD
      ? devUrl
      : "app://billflow/index.html";
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    lockProfileSession();
    if (details.reason === "clean-exit") return;
    const now = Date.now();
    while (
      rendererCrashTimestamps.length &&
      now - rendererCrashTimestamps[0] > 30_000
    ) {
      rendererCrashTimestamps.shift();
    }
    rendererCrashTimestamps.push(now);
    if (rendererCrashTimestamps.length >= 3) {
      dialog.showErrorBox(
        "BillFlow renderer stopped",
        "The window stopped repeatedly. Restart BillFlow to recover safely.",
      );
      return;
    }
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        void mainWindow.loadURL(startUrl).catch(() => {});
      }
    }, 250);
  });

  if (isDev && !process.env.TEST_PROD_BUILD) {
    mainWindow.loadURL(devUrl).catch(() => {
      // Retry in case dev server is still starting
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          void mainWindow.loadURL(devUrl).catch(() => {});
        }
      }, 1500);
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

if (gotSingleInstanceLock) {
  app
    .whenReady()
    .then(async () => {
      try {
        await applyQueuedApplicationReset(app.getPath("userData"), async () => {
          await session.defaultSession.clearData();
          // Also clear Electron's storage-specific caches and partitions.
          await session.defaultSession.clearStorageData();
        });
      } catch (error) {
        dialog.showErrorBox(
          "BillFlow reset could not finish",
          `${error instanceof Error ? error.message : String(error)}\nRestart BillFlow to retry the reset.`,
        );
        app.quit();
        return;
      }
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
      const lockProtectedWorkspace = () => {
        const state = listProfilesState();
        if (
          !state.profiles.find((profile) => profile.id === state.activeProfileId)
            ?.hasPassword
        )
          return;
        lockProfileSession();
        syncAppBadgeCount({ tray });
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("workspace:locked");
        }
      };
      powerMonitor.on("lock-screen", lockProtectedWorkspace);
      powerMonitor.on("suspend", lockProtectedWorkspace);
      powerMonitor.on("resume", () => {
        void runBackgroundMaintenance();
      });
      registerWorkspaceHandlers(broadcastDataChanged);
      registerActivityHandlers(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("workspace:activity-changed");
        }
      });
      registerExchangeRateHandlers();
      registerStatementHandlers();
      registerProfileHandlers(broadcastDataChanged, () => {
        void runBackgroundMaintenance();
      });
      registerDesktopSetupHandlers();
      registerClientHandlers(broadcastDataChanged);
      registerInvoiceHandlers(broadcastDataChanged);
      registerDashboardHandlers();
      registerThemeHandlers();
      registerSettingsHandlers(broadcastDataChanged);
      ipcMain.handle(
        "settings:resetApplication",
        (_event, confirmation: unknown) => {
          if (confirmation !== APPLICATION_RESET_CONFIRMATION) {
            throw new Error(
              `Type ${APPLICATION_RESET_CONFIRMATION} to confirm the application reset.`,
            );
          }
          if (applicationResetQueued) return;
          queueApplicationReset(app.getPath("userData"));
          applicationResetQueued = true;
          app.relaunch();
          setImmediate(() => app.quit());
        },
      );
      registerEncryptedBackupHandlers(broadcastDataChanged);
      registerRecurringHandlers(broadcastDataChanged, navigateToRoute);
      registerDigestHandlers(navigateToRoute, () => syncAppBadgeCount({ tray }));
      registerQuoteHandlers(broadcastDataChanged);
      registerVendorHandlers(broadcastDataChanged);
      registerWorkOrderHandlers(broadcastDataChanged);
      registerAnalyticsHandlers();
      registerCatalogHandlers(broadcastDataChanged);
      registerTaskHandlers(broadcastDataChanged);
      registerFileHandlers(broadcastDataChanged);
      registerExpenseHandlers(broadcastDataChanged);
      registerCalendarHandlers(broadcastDataChanged);
      registerAiHandlers(() => mainWindow);
      registerUpdateHandlers(() => mainWindow);

      // Register production static file protocol
      const outDir = app.isPackaged
        ? path.join(app.getAppPath(), "out")
        : path.join(__dirname, "../out");

      protocol.handle("app", async (req) => {
        const isRsc =
          req.headers.get("rsc") === "1" || req.url.includes("_rsc=");
        const filePath = resolveStaticFile(outDir, req.url, isRsc);
        if (!filePath) return new Response("Not found", { status: 404 });
        const response = await net.fetch(pathToFileURL(filePath).toString());
        const headers = new Headers(response.headers);
        headers.set("X-Content-Type-Options", "nosniff");
        if (req.url.includes("/_next/static/")) {
          headers.set("Cache-Control", "public, max-age=31536000, immutable");
        }
        if (isRsc && filePath.endsWith(".txt")) {
          headers.set("Content-Type", "text/x-component; charset=utf-8");
        }
        if (filePath.endsWith(".html"))
          headers.set("Content-Security-Policy", cachedDocumentCsp(filePath));
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
      createApplicationMenu(() => mainWindow, showMainWindow, openUpdatesDialog);
      syncAppBadgeCount({ tray });
      startupMaintenanceTimer = setTimeout(() => {
        startupMaintenanceTimer = null;
        void runBackgroundMaintenance();
      }, 2000);
      maintenanceTimer = setInterval(
        () => void runBackgroundMaintenance(),
        15 * 60 * 1000,
      );
      if (process.platform === "darwin") {
        app.dock?.setMenu(
          Menu.buildFromTemplate(
            buildQuickActionsMenuTemplate({
              navigate: navigateToRoute,
              lockWorkspace: lockWorkspaceNow,
              includeOpenAndQuit: false,
            }),
          ),
        );
      }

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
    if (startupMaintenanceTimer) {
      clearTimeout(startupMaintenanceTimer);
      startupMaintenanceTimer = null;
    }
    if (maintenanceTimer) {
      clearInterval(maintenanceTimer);
      maintenanceTimer = null;
    }
    destroyPdfWindowPool();
    void disposeAiResources();
    tray?.destroy();
    tray = null;
  });

  app.on("will-quit", () => {
    closeAllDatabases();
  });
}
