import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const mainFrame = {};
  return {
    mainFrame,
    sender: { mainFrame },
    handle: vi.fn(),
    on: vi.fn(),
    read: vi.fn(),
    write: vi.fn(),
    rename: vi.fn(),
    background: vi.fn(),
    overlay: vi.fn(),
    nativeTheme: { themeSource: "system", shouldUseDarkColors: false, on: vi.fn() },
  };
});

vi.mock("electron", () => ({
  app: { getPath: () => "/test/userData" },
  BrowserWindow: { getAllWindows: () => [{ setBackgroundColor: mocks.background, setTitleBarOverlay: mocks.overlay }] },
  ipcMain: { on: mocks.on, handle: mocks.handle },
  nativeTheme: mocks.nativeTheme,
}));
vi.mock("fs", () => ({ default: { readFileSync: mocks.read, writeFileSync: mocks.write, renameSync: mocks.rename } }));

async function setup() {
  const theme = await import("../theme");
  theme.registerThemeHandlers();
  return {
    ...theme,
    set: mocks.handle.mock.calls[0][1] as (event: unknown, value: unknown) => void,
    initial: mocks.on.mock.calls[0][1] as (event: Record<string, unknown>) => void,
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.nativeTheme.themeSource = "system";
  mocks.nativeTheme.shouldUseDarkColors = false;
  mocks.read.mockReturnValue('"dark"');
});

describe("desktop appearance", () => {
  it("restores the preference before window creation and exposes it to preload", async () => {
    const theme = await setup();
    expect(mocks.nativeTheme.themeSource).toBe("dark");
    const event = { sender: mocks.sender, senderFrame: mocks.mainFrame, returnValue: null };
    theme.initial(event);
    expect(event.returnValue).toBe("dark");
  });
  it("uses System for missing or corrupt saved preferences", async () => {
    mocks.read.mockImplementation(() => { throw new Error("Missing file"); });
    await setup();
    expect(mocks.nativeTheme.themeSource).toBe("system");
  });
  it("atomically persists a changed preference and updates the window", async () => {
    const theme = await setup();
    theme.set({ sender: mocks.sender, senderFrame: mocks.mainFrame }, "light");
    expect(mocks.write).toHaveBeenCalledWith("/test/userData/appearance.json.tmp", '"light"', "utf8");
    expect(mocks.rename).toHaveBeenCalledWith("/test/userData/appearance.json.tmp", "/test/userData/appearance.json");
    expect(mocks.nativeTheme.themeSource).toBe("light");
    expect(mocks.background).toHaveBeenCalledWith("#faf9f5");
  });
  it("rejects invalid preferences and iframe requests without writing", async () => {
    const theme = await setup();
    expect(() => theme.set({ sender: mocks.sender, senderFrame: mocks.mainFrame }, "invalid")).toThrow();
    expect(() => theme.set({ sender: mocks.sender, senderFrame: {} }, "light")).toThrow();
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("refreshes the window background when the system appearance changes", async () => {
    await setup();
    mocks.nativeTheme.shouldUseDarkColors = true;
    const update = mocks.nativeTheme.on.mock.calls[0][1] as () => void;
    update();
    expect(mocks.background).toHaveBeenCalledWith("#17171c");
  });
});
