import { app, BrowserWindow, Menu, MenuItemConstructorOptions, dialog } from "electron";
import path from "path";
import fs from "fs";

export function getAboutIconPath(): string | undefined {
  const candidates: (string | undefined)[] = [
    process.resourcesPath ? path.join(process.resourcesPath, "brand", "logo-white.png") : undefined,
    typeof app?.getAppPath === "function" ? path.join(app.getAppPath(), "out", "brand", "logo-white.png") : undefined,
    typeof app?.getAppPath === "function" ? path.join(app.getAppPath(), "public", "brand", "logo-white.png") : undefined,
    path.join(process.cwd(), "out", "brand", "logo-white.png"),
    path.join(process.cwd(), "public", "brand", "logo-white.png"),
    path.join(__dirname, "../public/brand/logo-white.png"),
    path.join(__dirname, "../assets/brand/source/BillFlow-Logo-White-Icon.png"),
    path.join(process.cwd(), "assets", "brand", "source", "BillFlow-Logo-White-Icon.png"),
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return undefined;
}

export function setupAboutPanel(): void {
  if (process.platform !== "darwin") return;
  const iconPath = getAboutIconPath();
  const currentVersion = app?.getVersion ? app.getVersion() : "0.1.2";
  app.setAboutPanelOptions({
    applicationName: "BillFlow",
    applicationVersion: currentVersion,
    version: currentVersion,
    copyright: "Copyright © 2026 Akatsuki-61",
    authors: ["Akatsuki-61"],
    website: "https://github.com/Akatsuki-61/BillFlow",
    ...(iconPath ? { iconPath } : {}),
  });
}

export function buildMenuTemplate(
  navigate: (route: string) => void,
  isMac: boolean = process.platform === "darwin",
  getMainWindow?: () => BrowserWindow | null,
): MenuItemConstructorOptions[] {
  const appMenu: MenuItemConstructorOptions = {
    label: app?.name || "BillFlow",
    submenu: [
      {
        label: "About BillFlow",
        click: () => {
          setupAboutPanel();
          app.showAboutPanel();
        },
      },
      {
        label: "Settings...",
        accelerator: "CmdOrCtrl+,",
        click: () => navigate("/settings"),
      },
      {
        label: "Check for Updates...",
        click: () => {
          const win = getMainWindow ? getMainWindow() : null;
          const currentVersion = app?.getVersion ? app.getVersion() : "0.1.2";
          const options = {
            type: "info" as const,
            title: "Check for Updates",
            message: "BillFlow is up to date",
            detail: `You are running the latest version of BillFlow (v${currentVersion}).`,
            buttons: ["OK"],
          };
          if (win && !win.isDestroyed()) {
            dialog.showMessageBox(win, options);
          } else {
            dialog.showMessageBox(options);
          }
        },
      },
      { type: "separator" },
      { role: "hide", label: "Hide BillFlow" },
      { role: "hideOthers", label: "Hide Others" },
      { role: "unhide", label: "Show All" },
      { type: "separator" },
      { role: "quit", label: "Quit BillFlow" },
    ],
  };

  const fileMenu: MenuItemConstructorOptions = {
    label: "File",
    submenu: [
      {
        label: "New Invoice",
        accelerator: "CmdOrCtrl+N",
        click: () => navigate("/invoices?new=1"),
      },
      { type: "separator" },
      isMac ? { role: "close" } : { role: "quit" },
    ],
  };

  const editMenu: MenuItemConstructorOptions = {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ],
  };

  const viewMenu: MenuItemConstructorOptions = {
    label: "View",
    submenu: [
      { role: "reload" },
      { role: "forceReload" },
      { role: "toggleDevTools" },
      { type: "separator" },
      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" },
    ],
  };

  const tabsMenu: MenuItemConstructorOptions = {
    label: "Tabs",
    submenu: [
      {
        label: "Dashboard",
        accelerator: "CmdOrCtrl+1",
        click: () => navigate("/"),
      },
      {
        label: "Invoices",
        accelerator: "CmdOrCtrl+2",
        click: () => navigate("/invoices"),
      },
      {
        label: "Clients",
        accelerator: "CmdOrCtrl+3",
        click: () => navigate("/clients"),
      },
      {
        label: "Catalog",
        accelerator: "CmdOrCtrl+4",
        click: () => navigate("/catalog"),
      },
      {
        label: "Expenses",
        accelerator: "CmdOrCtrl+5",
        click: () => navigate("/expenses"),
      },
      {
        label: "Outsourcing",
        accelerator: "CmdOrCtrl+6",
        click: () => navigate("/outsourcing"),
      },
      {
        label: "Tasks",
        accelerator: "CmdOrCtrl+7",
        click: () => navigate("/tasks"),
      },
      {
        label: "Analytics",
        accelerator: "CmdOrCtrl+8",
        click: () => navigate("/analytics"),
      },
      { type: "separator" },
      {
        label: "Support",
        click: () => navigate("/support"),
      },
    ],
  };

  const windowMenu: MenuItemConstructorOptions = {
    label: "Window",
    submenu: isMac
      ? [
          { role: "minimize" },
          { role: "zoom" },
          { type: "separator" },
          { role: "front" },
        ]
      : [
          { role: "minimize" },
          { role: "close" },
        ],
  };

  return isMac
    ? [appMenu, fileMenu, editMenu, viewMenu, tabsMenu, windowMenu]
    : [fileMenu, editMenu, viewMenu, tabsMenu, windowMenu];
}

export function createApplicationMenu(
  getMainWindow: () => BrowserWindow | null,
  showWindow?: () => void,
): void {
  const navigate = (route: string) => {
    if (showWindow) {
      showWindow();
    }
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();

      if (win.webContents.isLoading()) {
        win.webContents.once("did-finish-load", () => {
          win.webContents.send("navigate-to", route);
        });
      } else {
        win.webContents.send("navigate-to", route);
      }
    }
  };

  const template = buildMenuTemplate(navigate, process.platform === "darwin", getMainWindow);
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
