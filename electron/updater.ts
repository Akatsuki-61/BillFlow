import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import https from "node:https";
import { execFileSync, spawn } from "node:child_process";
import { app, BrowserWindow, shell } from "electron";
import { version as packageVersion } from "../package.json";
import { ipcMain } from "./security";
import type {
  AppUpdateAsset,
  AppUpdateStatus,
} from "../src/types/updates";

export const GITHUB_REPO_OWNER = "Akatsuki-61";
export const GITHUB_REPO_NAME = "BillFlow";
export const GITHUB_RELEASES_PAGE_URL = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases`;
export const GITHUB_LATEST_RELEASE_API_URL = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`;

const ALLOWED_DOWNLOAD_HOST_SUFFIXES = [
  "github.com",
  "githubusercontent.com",
] as const;

export interface GitHubReleaseAssetPayload {
  name?: string;
  browser_download_url?: string;
  size?: number;
}

export interface GitHubReleasePayload {
  tag_name?: string;
  name?: string;
  body?: string;
  html_url?: string;
  published_at?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: GitHubReleaseAssetPayload[];
}

export function getInstalledVersion(): string {
  try {
    if (app && typeof app.getVersion === "function" && app.isPackaged) {
      return app.getVersion();
    }
  } catch {
    // Fallback for tests or dev runs
  }
  return packageVersion;
}

export function normalizeVersion(raw: string): string {
  return raw.trim().replace(/^v/i, "");
}

function parseSemver(raw: string): {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
} | null {
  const cleaned = normalizeVersion(raw);
  const match = cleaned.match(
    /^(\d+)\.(\d+)(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/,
  );
  if (!match) return null;
  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: match[3] ? Number.parseInt(match[3], 10) : 0,
    prerelease: match[4] ? match[4].split(".") : [],
  };
}

/**
 * Compares two semver strings.
 * Returns > 0 if `a > b`, < 0 if `a < b`, and 0 if equal.
 */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) {
    return normalizeVersion(a).localeCompare(normalizeVersion(b), undefined, {
      numeric: true,
    });
  }
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;

  // Release without prerelease tag is newer than prerelease (1.0.0 > 1.0.0-beta.1)
  if (pa.prerelease.length === 0 && pb.prerelease.length > 0) return 1;
  if (pa.prerelease.length > 0 && pb.prerelease.length === 0) return -1;

  const maxLen = Math.max(pa.prerelease.length, pb.prerelease.length);
  for (let i = 0; i < maxLen; i += 1) {
    const segA = pa.prerelease[i];
    const segB = pb.prerelease[i];
    if (segA === undefined) return -1;
    if (segB === undefined) return 1;
    const numA = /^\d+$/.test(segA) ? Number.parseInt(segA, 10) : null;
    const numB = /^\d+$/.test(segB) ? Number.parseInt(segB, 10) : null;
    if (numA !== null && numB !== null) {
      if (numA !== numB) return numA - numB;
    } else if (segA !== segB) {
      return segA < segB ? -1 : 1;
    }
  }
  return 0;
}

export function validateGitHubAssetUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid update download URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Update downloads must use HTTPS.");
  }
  const host = parsed.hostname.toLowerCase();
  const allowed = ALLOWED_DOWNLOAD_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
  if (!allowed) {
    throw new Error(
      `Refusing to download update from untrusted host: ${host}.`,
    );
  }
  return parsed.toString();
}

export function selectReleaseAsset(
  assets: readonly GitHubReleaseAssetPayload[],
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): AppUpdateAsset | null {
  const valid = assets
    .filter(
      (a): a is Required<Pick<GitHubReleaseAssetPayload, "name" | "browser_download_url">> & {
        size?: number;
      } =>
        typeof a.name === "string" &&
        a.name.trim().length > 0 &&
        typeof a.browser_download_url === "string" &&
        a.browser_download_url.startsWith("https://"),
    )
    .map((a) => ({
      name: a.name.trim(),
      lower: a.name.trim().toLowerCase(),
      downloadUrl: a.browser_download_url,
      sizeBytes: typeof a.size === "number" && a.size > 0 ? a.size : 0,
    }))
    .filter((a) => !a.lower.endsWith(".blockmap") && !a.lower.endsWith(".sha256"));

  if (platform === "darwin") {
    const dmgs = valid.filter((a) => a.lower.endsWith(".dmg"));
    if (dmgs.length === 0) return null;
    const picked =
      arch === "arm64"
        ? dmgs.find((a) => a.lower.includes("arm64") || a.lower.includes("apple")) ||
          dmgs.find((a) => a.lower.includes("universal")) ||
          dmgs.find((a) => !a.lower.includes("x64") && !a.lower.includes("intel"))
        : dmgs.find((a) => a.lower.includes("x64") || a.lower.includes("intel")) ||
          dmgs.find((a) => a.lower.includes("universal")) ||
          dmgs.find((a) => !a.lower.includes("arm64"));
    const finalPick = picked ?? dmgs[0];
    return {
      name: finalPick.name,
      downloadUrl: finalPick.downloadUrl,
      sizeBytes: finalPick.sizeBytes,
    };
  }

  if (platform === "win32") {
    const exes = valid.filter((a) => a.lower.endsWith(".exe"));
    if (exes.length === 0) return null;
    const picked =
      exes.find((a) => a.lower.includes("setup")) ||
      exes.find((a) => a.lower.includes(arch.toLowerCase())) ||
      exes[0];
    return {
      name: picked.name,
      downloadUrl: picked.downloadUrl,
      sizeBytes: picked.sizeBytes,
    };
  }

  // Linux fallback
  const linuxAsset = valid.find(
    (a) => a.lower.endsWith(".appimage") || a.lower.endsWith(".deb"),
  );
  return linuxAsset
    ? {
        name: linuxAsset.name,
        downloadUrl: linuxAsset.downloadUrl,
        sizeBytes: linuxAsset.sizeBytes,
      }
    : null;
}

function getUpdatesDirectory(): string {
  let root = os.tmpdir();
  try {
    if (app && typeof app.getPath === "function") {
      root = app.getPath("userData");
    }
  } catch {
    // fallback to tmpdir
  }
  return path.join(root, "updates");
}

function getCurrentMacAppBundlePath(): string | null {
  if (process.platform !== "darwin") return null;
  try {
    if (!app?.isPackaged) return null;
  } catch {
    return null;
  }
  // Typical path: /Applications/BillFlow.app/Contents/MacOS/BillFlow
  const bundlePath = path.resolve(process.execPath, "..", "..", "..");
  if (!bundlePath.endsWith(".app") || !fs.existsSync(bundlePath)) {
    return null;
  }
  return bundlePath;
}

function canInstallInPlaceNow(): boolean {
  if (process.platform === "win32") {
    return true;
  }
  if (process.platform === "darwin") {
    const bundlePath = getCurrentMacAppBundlePath();
    if (!bundlePath) return false;
    try {
      fs.accessSync(path.dirname(bundlePath), fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Generates a self-cleaning macOS updater script that waits for the current
 * BillFlow PID to exit, swaps the mounted .app bundle atomically (with backup
 * rollback on copy failure), clears quarantine xattrs, unmounts the DMG, and
 * relaunches the updated BillFlow.app.
 */
export function buildMacUpdateScript(options: {
  pid: number;
  sourceAppPath: string;
  targetAppPath: string;
  mountPoint: string;
  dmgPath: string;
  scriptPath: string;
}): string {
  const backupPath = `${options.targetAppPath}.billflow-prev`;
  return `#!/bin/sh
set -e
PID=${options.pid}
SRC=${shellQuote(options.sourceAppPath)}
TARGET=${shellQuote(options.targetAppPath)}
BACKUP=${shellQuote(backupPath)}
MOUNT=${shellQuote(options.mountPoint)}
DMG=${shellQuote(options.dmgPath)}
SELF=${shellQuote(options.scriptPath)}

# Wait up to 20 seconds for BillFlow to quit cleanly
i=0
while kill -0 "$PID" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge 40 ]; then
    break
  fi
  sleep 0.5
done

cleanup() {
  hdiutil detach "$MOUNT" -quiet 2>/dev/null || hdiutil detach -force "$MOUNT" -quiet 2>/dev/null || true
  rmdir "$MOUNT" 2>/dev/null || true
  rm -f "$SELF" 2>/dev/null || true
}
trap cleanup EXIT

rm -rf "$BACKUP"
mv "$TARGET" "$BACKUP"

if ditto "$SRC" "$TARGET"; then
  xattr -dr com.apple.quarantine "$TARGET" 2>/dev/null || true
  rm -rf "$BACKUP"
  rm -f "$DMG" 2>/dev/null || true
  open -n "$TARGET"
else
  rm -rf "$TARGET"
  mv "$BACKUP" "$TARGET"
  open -n "$TARGET"
  exit 1
fi
`;
}

let updateStatus: AppUpdateStatus = {
  state: "idle",
  currentVersion: getInstalledVersion(),
  latestVersion: null,
  releaseName: null,
  releaseNotes: null,
  releaseUrl: GITHUB_RELEASES_PAGE_URL,
  publishedAt: null,
  asset: null,
  downloadedFilePath: null,
  downloadProgress: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  message: "",
  error: null,
  lastCheckedAt: null,
  canInstallInPlace: canInstallInPlaceNow(),
};

let activeDownloadAbort: AbortController | null = null;
let broadcastFn: ((status: AppUpdateStatus) => void) | null = null;

function setStatus(patch: Partial<AppUpdateStatus>): AppUpdateStatus {
  updateStatus = {
    ...updateStatus,
    currentVersion: getInstalledVersion(),
    canInstallInPlace: canInstallInPlaceNow(),
    ...patch,
  };
  broadcastFn?.(updateStatus);
  return updateStatus;
}

export function getUpdateStatus(): AppUpdateStatus {
  return {
    ...updateStatus,
    currentVersion: getInstalledVersion(),
    canInstallInPlace: canInstallInPlaceNow(),
  };
}

export async function checkForUpdates(): Promise<AppUpdateStatus> {
  if (
    updateStatus.state === "downloading" ||
    updateStatus.state === "installing"
  ) {
    return getUpdateStatus();
  }

  const currentVersion = getInstalledVersion();
  setStatus({
    state: "checking",
    error: null,
    message: "Checking GitHub Releases for updates…",
  });

  try {
    const response = await fetch(GITHUB_LATEST_RELEASE_API_URL, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": `BillFlow-Desktop/${currentVersion}`,
      },
      signal: AbortSignal.timeout(15_000),
    });

    const checkedAt = new Date().toISOString();

    if (response.status === 404) {
      // Repository has no published (non-draft) GitHub release yet
      return setStatus({
        state: "up-to-date",
        latestVersion: currentVersion,
        releaseName: null,
        releaseNotes: null,
        releaseUrl: GITHUB_RELEASES_PAGE_URL,
        publishedAt: null,
        asset: null,
        downloadedFilePath: null,
        downloadProgress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        message: "Your application is up to date.",
        error: null,
        lastCheckedAt: checkedAt,
      });
    }

    if (!response.ok) {
      throw new Error(
        response.status === 403
          ? "GitHub rate limit reached. Try again in a few minutes."
          : `Could not check GitHub Releases (HTTP ${response.status}).`,
      );
    }

    const release = (await response.json()) as GitHubReleasePayload;
    const rawTag = release.tag_name || release.name || "";
    const latestVersion = normalizeVersion(rawTag);
    const releaseUrl = release.html_url || GITHUB_RELEASES_PAGE_URL;

    if (!latestVersion || compareSemver(latestVersion, currentVersion) <= 0) {
      return setStatus({
        state: "up-to-date",
        latestVersion: latestVersion || currentVersion,
        releaseName: release.name || null,
        releaseNotes: release.body || null,
        releaseUrl,
        publishedAt: release.published_at || null,
        asset: null,
        downloadedFilePath: null,
        downloadProgress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        message: "Your application is up to date.",
        error: null,
        lastCheckedAt: checkedAt,
      });
    }

    const asset = selectReleaseAsset(release.assets || []);
    const existingDownloaded =
      asset &&
      updateStatus.downloadedFilePath &&
      fs.existsSync(updateStatus.downloadedFilePath) &&
      path.basename(updateStatus.downloadedFilePath) ===
        path.basename(asset.name) &&
      (asset.sizeBytes === 0 ||
        fs.statSync(updateStatus.downloadedFilePath).size === asset.sizeBytes)
        ? updateStatus.downloadedFilePath
        : null;

    if (existingDownloaded) {
      return setStatus({
        state: "downloaded",
        latestVersion,
        releaseName: release.name || `BillFlow v${latestVersion}`,
        releaseNotes: release.body || null,
        releaseUrl,
        publishedAt: release.published_at || null,
        asset,
        downloadedFilePath: existingDownloaded,
        downloadProgress: 100,
        downloadedBytes: asset?.sizeBytes ?? 0,
        totalBytes: asset?.sizeBytes ?? 0,
        message: `BillFlow v${latestVersion} is downloaded and ready to install.`,
        error: null,
        lastCheckedAt: checkedAt,
      });
    }

    return setStatus({
      state: "update-available",
      latestVersion,
      releaseName: release.name || `BillFlow v${latestVersion}`,
      releaseNotes: release.body || null,
      releaseUrl,
      publishedAt: release.published_at || null,
      asset,
      downloadedFilePath: null,
      downloadProgress: 0,
      downloadedBytes: 0,
      totalBytes: asset?.sizeBytes ?? 0,
      message: asset
        ? `BillFlow v${latestVersion} is available.`
        : `BillFlow v${latestVersion} is available on GitHub Releases.`,
      error: null,
      lastCheckedAt: checkedAt,
    });
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : "Could not check for updates. Verify your internet connection.";
    return setStatus({
      state: "error",
      error: msg,
      message: "Update check failed.",
      lastCheckedAt: new Date().toISOString(),
    });
  }
}

function streamHttpsDownload(
  url: string,
  destination: string,
  signal: AbortSignal,
  onChunk: (bytes: number, totalBytes: number | null) => void,
  redirects = 0,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("Download canceled."));
      return;
    }
    if (redirects > 6) {
      reject(new Error("Too many redirects while downloading update."));
      return;
    }

    let safeUrl: string;
    try {
      safeUrl = validateGitHubAssetUrl(url);
    } catch (err) {
      reject(err);
      return;
    }

    const req = https.get(
      safeUrl,
      { headers: { "User-Agent": `BillFlow-Desktop/${getInstalledVersion()}` } },
      (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          res.resume();
          const nextUrl = new URL(res.headers.location, safeUrl).toString();
          resolve(
            streamHttpsDownload(nextUrl, destination, signal, onChunk, redirects + 1),
          );
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(
            new Error(
              `Update server returned HTTP ${res.statusCode ?? "error"}. Please try again.`,
            ),
          );
          return;
        }

        const totalBytes = res.headers["content-length"]
          ? Number.parseInt(res.headers["content-length"], 10)
          : null;

        fs.mkdirSync(path.dirname(destination), { recursive: true });
        const tempPath = `${destination}.tmp-${process.pid}`;
        const out = fs.createWriteStream(tempPath);

        const cleanupTemp = () => {
          try {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
          } catch {
            // ignore
          }
        };

        const onAbort = () => {
          req.destroy();
          out.close(() => {
            cleanupTemp();
            reject(new Error("Download canceled."));
          });
        };
        signal.addEventListener("abort", onAbort, { once: true });

        res.on("data", (chunk: Buffer) => {
          onChunk(chunk.length, totalBytes);
        });
        res.pipe(out);

        out.on("finish", () => {
          signal.removeEventListener("abort", onAbort);
          out.close(() => {
            if (signal.aborted) {
              cleanupTemp();
              reject(new Error("Download canceled."));
              return;
            }
            try {
              fs.renameSync(tempPath, destination);
              resolve();
            } catch (err) {
              cleanupTemp();
              reject(err);
            }
          });
        });

        const fail = (err: Error) => {
          signal.removeEventListener("abort", onAbort);
          out.close(() => {
            cleanupTemp();
            reject(err);
          });
        };

        res.on("error", fail);
        out.on("error", fail);
      },
    );

    req.setTimeout(120_000, () => {
      req.destroy(
        new Error("Update download timed out. Check your internet connection."),
      );
    });
    req.on("error", (err) => {
      if (signal.aborted) {
        reject(new Error("Download canceled."));
      } else {
        reject(err);
      }
    });
  });
}

export async function downloadUpdate(): Promise<AppUpdateStatus> {
  if (updateStatus.state === "downloading" && activeDownloadAbort) {
    return getUpdateStatus();
  }
  const asset = updateStatus.asset;
  if (!asset) {
    throw new Error(
      "No compatible installer asset was found in the latest GitHub release for this platform.",
    );
  }

  const safeName = path.basename(asset.name).replace(/[^A-Za-z0-9._ -]/g, "_");
  const destination = path.join(getUpdatesDirectory(), safeName);

  // Reuse already-downloaded verified file if present
  if (
    fs.existsSync(destination) &&
    asset.sizeBytes > 0 &&
    fs.statSync(destination).size === asset.sizeBytes
  ) {
    return setStatus({
      state: "downloaded",
      downloadedFilePath: destination,
      downloadProgress: 100,
      downloadedBytes: asset.sizeBytes,
      totalBytes: asset.sizeBytes,
      message: `BillFlow v${updateStatus.latestVersion} is ready to install.`,
      error: null,
    });
  }

  const controller = new AbortController();
  activeDownloadAbort = controller;

  let downloadedBytes = 0;
  let totalBytes = asset.sizeBytes;
  let lastEmitAt = 0;

  setStatus({
    state: "downloading",
    downloadedFilePath: null,
    downloadProgress: 0,
    downloadedBytes: 0,
    totalBytes,
    message: `Downloading ${asset.name}…`,
    error: null,
  });

  try {
    await streamHttpsDownload(
      asset.downloadUrl,
      destination,
      controller.signal,
      (chunkLen, contentLength) => {
        downloadedBytes += chunkLen;
        if (contentLength && contentLength > 0) {
          totalBytes = contentLength;
        }
        const now = Date.now();
        if (now - lastEmitAt < 180) return;
        lastEmitAt = now;
        const pct =
          totalBytes > 0
            ? Math.min(99, Math.round((downloadedBytes / totalBytes) * 100))
            : 0;
        const mbDone = (downloadedBytes / (1024 * 1024)).toFixed(1);
        const mbTotal =
          totalBytes > 0 ? (totalBytes / (1024 * 1024)).toFixed(1) : "?";
        setStatus({
          state: "downloading",
          downloadProgress: pct,
          downloadedBytes,
          totalBytes,
          message: `Downloading update (${mbDone} / ${mbTotal} MB)…`,
        });
      },
    );

    const finalSize = fs.statSync(destination).size;
    if (asset.sizeBytes > 0 && finalSize < Math.floor(asset.sizeBytes * 0.95)) {
      fs.unlinkSync(destination);
      throw new Error("Downloaded installer was incomplete. Please try again.");
    }

    return setStatus({
      state: "downloaded",
      downloadedFilePath: destination,
      downloadProgress: 100,
      downloadedBytes: finalSize,
      totalBytes: totalBytes || finalSize,
      message: `BillFlow v${updateStatus.latestVersion} is ready to install.`,
      error: null,
    });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Failed to download update.";
    const canceled = msg.toLowerCase().includes("canceled");
    if (canceled) {
      return setStatus({
        state: "update-available",
        downloadedFilePath: null,
        downloadProgress: 0,
        downloadedBytes: 0,
        message: `BillFlow v${updateStatus.latestVersion} is available.`,
        error: null,
      });
    }
    return setStatus({
      state: "error",
      downloadedFilePath: null,
      downloadProgress: 0,
      error: msg,
      message: "Update download failed.",
    });
  } finally {
    activeDownloadAbort = null;
  }
}

export function cancelUpdateDownload(): AppUpdateStatus {
  if (activeDownloadAbort) {
    activeDownloadAbort.abort();
  }
  return getUpdateStatus();
}

export async function installDownloadedUpdate(): Promise<{
  started: boolean;
  mode: "in-place" | "installer" | "opened-dmg";
}> {
  const filePath = updateStatus.downloadedFilePath;
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error("Download the update before installing.");
  }

  setStatus({
    state: "installing",
    message: `Installing BillFlow v${updateStatus.latestVersion || ""}…`,
    error: null,
  });

  if (process.platform === "win32") {
    const child = spawn(filePath, [], {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });
    child.unref();
    setTimeout(() => app.quit(), 400);
    return { started: true, mode: "installer" };
  }

  if (process.platform === "darwin") {
    const targetAppPath = getCurrentMacAppBundlePath();
    if (targetAppPath && canInstallInPlaceNow() && filePath.toLowerCase().endsWith(".dmg")) {
      const mountPoint = fs.mkdtempSync(
        path.join(os.tmpdir(), "billflow-update-mnt-"),
      );
      try {
        execFileSync(
          "hdiutil",
          ["attach", "-nobrowse", "-readonly", "-mountpoint", mountPoint, filePath],
          { stdio: "ignore", timeout: 45_000 },
        );
        const entries = fs.readdirSync(mountPoint);
        const appEntry =
          entries.find((e) => e === "BillFlow.app") ||
          entries.find((e) => e.endsWith(".app"));
        if (!appEntry) {
          throw new Error("Could not find BillFlow.app inside the downloaded DMG.");
        }
        const sourceAppPath = path.join(mountPoint, appEntry);
        const scriptPath = path.join(
          os.tmpdir(),
          `billflow-apply-update-${process.pid}-${Date.now()}.sh`,
        );
        const script = buildMacUpdateScript({
          pid: process.pid,
          sourceAppPath,
          targetAppPath,
          mountPoint,
          dmgPath: filePath,
          scriptPath,
        });
        fs.writeFileSync(scriptPath, script, { mode: 0o700 });

        const helper = spawn("/bin/sh", [scriptPath], {
          detached: true,
          stdio: "ignore",
        });
        helper.unref();
        setTimeout(() => app.quit(), 400);
        return { started: true, mode: "in-place" };
      } catch (err) {
        try {
          execFileSync("hdiutil", ["detach", "-force", mountPoint], {
            stdio: "ignore",
          });
        } catch {
          // ignore
        }
        try {
          fs.rmdirSync(mountPoint);
        } catch {
          // ignore
        }
        // Fallback: open the DMG in Finder so the user can drag BillFlow.app to Applications
        console.warn("[updater] In-place macOS swap failed, opening DMG:", err);
        await shell.openPath(filePath);
        setStatus({
          state: "downloaded",
          message:
            "Opened the downloaded disk image. Drag BillFlow into Applications to finish updating.",
        });
        return { started: true, mode: "opened-dmg" };
      }
    }

    // Running in development or non-writable bundle path: open the downloaded DMG
    await shell.openPath(filePath);
    setStatus({
      state: "downloaded",
      message:
        "Opened the downloaded disk image. Drag BillFlow into Applications to finish updating.",
    });
    return { started: true, mode: "opened-dmg" };
  }

  await shell.openPath(filePath);
  return { started: true, mode: "installer" };
}

export function registerUpdateHandlers(
  getMainWindow: () => BrowserWindow | null,
): void {
  broadcastFn = (status) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send("updates:status-changed", status);
    }
  };

  ipcMain.handle("updates:status", (): AppUpdateStatus => getUpdateStatus());
  ipcMain.handle(
    "updates:check",
    async (): Promise<AppUpdateStatus> => checkForUpdates(),
  );
  ipcMain.handle(
    "updates:download",
    async (): Promise<AppUpdateStatus> => downloadUpdate(),
  );
  ipcMain.handle(
    "updates:cancel",
    (): AppUpdateStatus => cancelUpdateDownload(),
  );
  ipcMain.handle("updates:install", async () => installDownloadedUpdate());
  ipcMain.handle("updates:openReleasePage", async () => {
    const targetUrl = validateGitHubAssetUrl(
      updateStatus.releaseUrl || GITHUB_RELEASES_PAGE_URL,
    );
    await shell.openExternal(targetUrl);
    return { opened: true };
  });
}
