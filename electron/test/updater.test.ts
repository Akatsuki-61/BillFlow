import { describe, expect, it, vi, afterEach } from "vitest";
import {
  buildMacUpdateScript,
  checkForUpdates,
  compareSemver,
  normalizeVersion,
  selectReleaseAsset,
  validateGitHubAssetUrl,
  type GitHubReleaseAssetPayload,
} from "../updater";

vi.mock("electron", () => ({
  app: {
    isPackaged: false,
    getVersion: () => "0.3.0",
    getPath: () => "/tmp",
    quit: vi.fn(),
  },
  BrowserWindow: vi.fn(),
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  shell: { openExternal: vi.fn(), openPath: vi.fn() },
}));

const SAMPLE_ASSETS: GitHubReleaseAssetPayload[] = [
  {
    name: "BillFlow-0.4.0-arm64.dmg",
    browser_download_url:
      "https://github.com/Akatsuki-61/BillFlow/releases/download/v0.4.0/BillFlow-0.4.0-arm64.dmg",
    size: 165_000_000,
  },
  {
    name: "BillFlow-0.4.0-x64.dmg",
    browser_download_url:
      "https://github.com/Akatsuki-61/BillFlow/releases/download/v0.4.0/BillFlow-0.4.0-x64.dmg",
    size: 170_000_000,
  },
  {
    name: "BillFlow.Setup.0.4.0.exe",
    browser_download_url:
      "https://github.com/Akatsuki-61/BillFlow/releases/download/v0.4.0/BillFlow.Setup.0.4.0.exe",
    size: 158_000_000,
  },
  {
    name: "BillFlow.Setup.0.4.0.exe.blockmap",
    browser_download_url:
      "https://github.com/Akatsuki-61/BillFlow/releases/download/v0.4.0/BillFlow.Setup.0.4.0.exe.blockmap",
    size: 180_000,
  },
];

describe("GitHub Releases App Updater", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("compares semantic versions accurately across tags and prereleases", () => {
    expect(normalizeVersion("v0.3.0")).toBe("0.3.0");
    expect(compareSemver("0.3.1", "0.3.0")).toBeGreaterThan(0);
    expect(compareSemver("v1.0.0", "0.9.9")).toBeGreaterThan(0);
    expect(compareSemver("0.3.0", "v0.3.0")).toBe(0);
    expect(compareSemver("0.3.0", "0.3.1")).toBeLessThan(0);
    expect(compareSemver("0.4.0", "0.4.0-beta.1")).toBeGreaterThan(0);
    expect(compareSemver("0.4.0-beta.2", "0.4.0-beta.1")).toBeGreaterThan(0);
  });

  it("selects the right GitHub release installer asset per platform and CPU arch", () => {
    expect(selectReleaseAsset(SAMPLE_ASSETS, "darwin", "arm64")?.name).toBe(
      "BillFlow-0.4.0-arm64.dmg",
    );
    expect(selectReleaseAsset(SAMPLE_ASSETS, "darwin", "x64")?.name).toBe(
      "BillFlow-0.4.0-x64.dmg",
    );
    expect(selectReleaseAsset(SAMPLE_ASSETS, "win32", "x64")?.name).toBe(
      "BillFlow.Setup.0.4.0.exe",
    );
  });

  it("restricts update downloads strictly to HTTPS GitHub hosts", () => {
    expect(
      validateGitHubAssetUrl(
        "https://github.com/Akatsuki-61/BillFlow/releases/download/v0.4.0/BillFlow.dmg",
      ),
    ).toContain("github.com");
    expect(
      validateGitHubAssetUrl(
        "https://objects.githubusercontent.com/github-production-release-asset/foo.dmg",
      ),
    ).toContain("githubusercontent.com");
    expect(() =>
      validateGitHubAssetUrl("http://github.com/Akatsuki-61/BillFlow/releases"),
    ).toThrow(/HTTPS/i);
    expect(() =>
      validateGitHubAssetUrl("https://evil.example.com/BillFlow.dmg"),
    ).toThrow(/untrusted/i);
  });

  it("reports up-to-date cleanly when GitHub has no published release yet (404) or matching version", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Not Found", { status: 404 })),
    );
    const noRelease = await checkForUpdates();
    expect(noRelease.state).toBe("up-to-date");
    expect(noRelease.message).toMatch(/up to date/i);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            tag_name: "v0.3.0",
            name: "BillFlow v0.3.0",
            body: "Current release",
            html_url: "https://github.com/Akatsuki-61/BillFlow/releases/tag/v0.3.0",
            assets: SAMPLE_ASSETS,
          }),
          { status: 200 },
        ),
      ),
    );
    const sameVersion = await checkForUpdates();
    expect(sameVersion.state).toBe("up-to-date");
    expect(sameVersion.message).toMatch(/up to date/i);
  });

  it("detects newer GitHub Releases with notes and platform asset", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            tag_name: "v0.4.0",
            name: "BillFlow v0.4.0",
            body: "- Faster AI\n- In-app updater",
            html_url: "https://github.com/Akatsuki-61/BillFlow/releases/tag/v0.4.0",
            published_at: "2026-12-01T00:00:00Z",
            assets: SAMPLE_ASSETS,
          }),
          { status: 200 },
        ),
      ),
    );
    const res = await checkForUpdates();
    expect(res.state).toBe("update-available");
    expect(res.latestVersion).toBe("0.4.0");
    expect(res.releaseNotes).toContain("In-app updater");
    expect(res.asset).not.toBeNull();
  });

  it("generates a safe quoted macOS in-place swap script with rollback", () => {
    const script = buildMacUpdateScript({
      pid: 12345,
      sourceAppPath: "/tmp/mnt/BillFlow.app",
      targetAppPath: "/Applications/BillFlow.app",
      mountPoint: "/tmp/mnt",
      dmgPath: "/tmp/BillFlow-0.4.0-arm64.dmg",
      scriptPath: "/tmp/apply.sh",
    });
    expect(script).toContain("ditto");
    expect(script).toContain("com.apple.quarantine");
    expect(script).toContain("hdiutil detach");
    expect(script).toContain("open -n");
    expect(script).toContain("/Applications/BillFlow.app.billflow-prev");
  });
});
