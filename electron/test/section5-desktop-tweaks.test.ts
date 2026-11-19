import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ipcMain } from "electron";
import { closeDatabaseForTesting, getDb, initDatabase } from "../db";
import { clients, expenses } from "../db/schema";
import { exportWorkspace, resetWorkspace } from "../backup";
import { listProfilesState } from "../ipc/profiles";
import { registerFileHandlers } from "../ipc/files";
import { registerSettingsHandlers } from "../ipc/settings";
import { buildQuickActionsMenuTemplate } from "../menu";
import {
  clampWindowBounds,
  loadWindowState,
  saveWindowState,
  type WindowBounds,
} from "../window-state";
import { trustedEvent } from "./trusted-event";

vi.mock("electron", () => ({
  app: undefined,
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
    showMessageBox: vi.fn(),
  },
  shell: { openPath: vi.fn(async () => ""), showItemInFolder: vi.fn() },
  clipboard: { writeText: vi.fn() },
}));

vi.mock("../pdf-generator", () => ({
  generateInvoiceHtmlPdfBuffer: vi.fn(async () => Buffer.from("%PDF-test")),
  generateWorkOrderPdfBuffer: vi.fn(async () => Buffer.from("%PDF-test")),
}));

function registeredHandler(channel: string) {
  const pair = vi
    .mocked(ipcMain.handle)
    .mock.calls.findLast((call) => call[0] === channel);
  if (!pair) throw new Error(`Missing handler for ${channel}`);
  return pair[1] as (...args: unknown[]) => unknown;
}

describe("Section 5 high-ROI desktop tweaks", () => {
  let dir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    closeDatabaseForTesting();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "billflow-section5-"));
    initDatabase(path.join(dir, "billflow.db"));
    listProfilesState();
  });

  afterEach(() => {
    closeDatabaseForTesting();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("clamps window bounds across displays, recovers from corrupt state, and round-trips maximize state", () => {
    const primary: WindowBounds = { x: 0, y: 25, width: 1728, height: 1055 };
    const secondary: WindowBounds = {
      x: 1728,
      y: 0,
      width: 1920,
      height: 1080,
    };
    const statePath = path.join(dir, "window-state.json");

    // Corrupt file falls back cleanly to default centered size
    fs.writeFileSync(statePath, "{not-valid-json", "utf8");
    expect(loadWindowState(statePath, [primary], primary)).toEqual({
      width: 1440,
      height: 900,
      isMaximized: false,
    });

    // Preserves position inside a connected secondary monitor
    const onSecond = clampWindowBounds(
      { x: 1850, y: 80, width: 1300, height: 820, isMaximized: false },
      [primary, secondary],
      primary,
    );
    expect(onSecond).toEqual({
      x: 1850,
      y: 80,
      width: 1300,
      height: 820,
      isMaximized: false,
    });

    // Unplugged monitor bounds clamp back onto the primary display work area
    const disconnected = clampWindowBounds(
      { x: 4200, y: 1200, width: 1300, height: 820, isMaximized: true },
      [primary],
      primary,
    );
    expect(disconnected.x).toBeDefined();
    expect(disconnected.y).toBeDefined();
    expect(disconnected.x).toBeGreaterThanOrEqual(primary.x);
    expect(disconnected.y).toBeGreaterThanOrEqual(primary.y);
    expect(disconnected.x! + disconnected.width).toBeLessThanOrEqual(
      primary.x + primary.width,
    );
    expect(disconnected.y! + disconnected.height).toBeLessThanOrEqual(
      primary.y + primary.height,
    );
    expect(disconnected.isMaximized).toBe(true);

    // Save + reload round-trip
    saveWindowState(statePath, disconnected);
    expect(loadWindowState(statePath, [primary], primary)).toEqual(disconnected);
  });

  it("builds Tray and Dock quick action menus targeting invoice, expense, and workspace lock actions", () => {
    const navigated: string[] = [];
    let openCalls = 0;
    let lockCalls = 0;
    let quitCalls = 0;

    const trayMenu = buildQuickActionsMenuTemplate({
      openApp: () => {
        openCalls += 1;
      },
      navigate: (route) => navigated.push(route),
      lockWorkspace: () => {
        lockCalls += 1;
      },
      quit: () => {
        quitCalls += 1;
      },
      includeOpenAndQuit: true,
    });
    expect(trayMenu.map((item) => item.label).filter(Boolean)).toEqual([
      "Open BillFlow",
      "New Invoice",
      "Add Expense",
      "Lock Workspace",
      "Quit BillFlow",
    ]);

    const dockMenu = buildQuickActionsMenuTemplate({
      navigate: (route) => navigated.push(route),
      lockWorkspace: () => {
        lockCalls += 1;
      },
      includeOpenAndQuit: false,
    });
    expect(dockMenu.map((item) => item.label).filter(Boolean)).toEqual([
      "New Invoice",
      "Add Expense",
      "Lock Workspace",
    ]);

    trayMenu.find((i) => i.label === "Open BillFlow")?.click?.({} as never, undefined, {} as never);
    trayMenu.find((i) => i.label === "New Invoice")?.click?.({} as never, undefined, {} as never);
    dockMenu.find((i) => i.label === "Add Expense")?.click?.({} as never, undefined, {} as never);
    dockMenu.find((i) => i.label === "Lock Workspace")?.click?.({} as never, undefined, {} as never);
    trayMenu.find((i) => i.label === "Quit BillFlow")?.click?.({} as never, undefined, {} as never);

    expect(openCalls).toBe(1);
    expect(navigated).toEqual(["/invoices?new=1", "/expenses?create=1"]);
    expect(lockCalls).toBe(1);
    expect(quitCalls).toBe(1);
  });

  it("stages dropped receipts via OS file paths with magic-byte and symlink checks", async () => {
    registerFileHandlers(() => {});
    const stagePathHandler = registeredHandler("attachments:stageDroppedPath");
    const selectHandler = registeredHandler("attachments:select");
    const ev = trustedEvent();

    const now = new Date().toISOString();
    getDb()
      .insert(expenses)
      .values({
        id: "exp-drop-path-1",
        merchant: "Cloud Host",
        description: "Compute",
        category: "HOSTING",
        amountCents: 1800,
        currency: "USD",
        incurredAt: "2026-11-19",
        deductible: true,
        createdAt: now,
      })
      .run();

    const validPng = path.join(dir, "dropped-slip.png");
    fs.writeFileSync(
      validPng,
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
    );
    const badFile = path.join(dir, "bad-receipt.png");
    fs.writeFileSync(badFile, Buffer.from("not-an-image"));
    const symlinkPng = path.join(dir, "symlink-slip.png");
    fs.symlinkSync(validPng, symlinkPng);

    expect(() => stagePathHandler(ev, "relative/receipt.png")).toThrow(
      /Invalid receipt file path/,
    );
    expect(() => stagePathHandler(ev, symlinkPng)).toThrow(
      /Receipt must be a file/,
    );
    expect(() => stagePathHandler(ev, badFile)).toThrow(
      /Select a PDF, PNG, JPEG or WebP/,
    );

    const staged = stagePathHandler(ev, validPng) as {
      path: string;
      name: string;
      size: number;
    };
    expect(staged.name).toBe("dropped-slip.png");
    expect(staged.path).not.toBe(validPng);

    const saved = (await selectHandler(
      ev,
      { type: "expense", id: "exp-drop-path-1" },
      "req-drop-path-1",
      staged.path,
    )) as { originalName: string; mimeType: string };
    expect(saved.originalName).toBe("dropped-slip.png");
    expect(saved.mimeType).toBe("image/png");
  });

  it("stages dropped backup files by path, imports via opaque token, and rejects symlinks or non-json files", () => {
    const now = new Date().toISOString();
    getDb()
      .insert(clients)
      .values({
        id: "cli-drop-bkp",
        name: "Dropped Backup Client",
        email: "drop@backup.test",
        contactPerson: "Alex",
        category: "Agency",
        currency: "USD",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const exported = exportWorkspace();
    const backupJson = path.join(dir, "dropped-backup.json");
    fs.writeFileSync(backupJson, JSON.stringify(exported), "utf8");
    const nonJson = path.join(dir, "backup.txt");
    fs.writeFileSync(nonJson, JSON.stringify(exported), "utf8");
    const symlinkBackup = path.join(dir, "link-backup.json");
    fs.symlinkSync(backupJson, symlinkBackup);

    resetWorkspace();
    expect(getDb().select().from(clients).all()).toHaveLength(0);

    registerSettingsHandlers(() => {});
    const stageBackupHandler = registeredHandler("settings:stageDroppedBackup");
    const importBackupHandler = registeredHandler("settings:importBackupFile");
    const ev = trustedEvent();

    expect(() => stageBackupHandler(ev, nonJson, "replace")).toThrow(
      /Drop a local backup \.json file/,
    );
    expect(() => stageBackupHandler(ev, symlinkBackup, "replace")).toThrow(
      /regular JSON file/,
    );

    const staged = stageBackupHandler(ev, backupJson, "replace") as {
      token: string;
      fileName: string;
      importedClients: number;
    };
    expect(staged.fileName).toBe("dropped-backup.json");
    expect(staged.importedClients).toBe(1);

    const imported = importBackupHandler(ev, staged.token, "replace") as {
      success: boolean;
      importedClients: number;
    };
    expect(imported.success).toBe(true);
    expect(getDb().select().from(clients).all()).toHaveLength(1);
  });

  it("includes bundled renderer package notices in build/THIRD_PARTY_NOTICES.txt", () => {
    const notices = fs.readFileSync(
      path.resolve("build/THIRD_PARTY_NOTICES.txt"),
      "utf8",
    );
    for (const pkg of [
      "echarts",
      "zrender",
      "motion",
      "libphonenumber-js",
      "lucide-react",
    ]) {
      expect(notices).toContain(`${pkg} `);
    }
  });
});
