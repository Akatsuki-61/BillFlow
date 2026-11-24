const path = require("node:path");
const { execFileSync } = require("node:child_process");

/**
 * Electron-builder afterSign hook for macOS:
 * `@electron/fuses` modifies the Electron Framework Mach-O binary in-place,
 * which invalidates Electron's default linker signature on Apple Silicon.
 * When no paid Apple Developer ID certificate is installed, electron-builder
 * skips signing, leaving an invalid signature that macOS kills with SIGKILL
 * (Code Signature Invalid). This hook verifies the bundle signature and
 * applies a valid deep ad-hoc signature (`-`) whenever needed so the DMG
 * launches cleanly on ARM64 Macs.
 */
exports.default = async function afterSignMac(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  try {
    execFileSync("codesign", ["--verify", "--deep", "--strict", appPath], {
      stdio: "ignore",
    });
    return;
  } catch {
    // Signature missing or invalidated by @electron/fuses — apply deep ad-hoc signature
  }

  console.log(
    `[afterSign] Applying deep ad-hoc code signature to ${appPath}...`,
  );
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], {
    stdio: "inherit",
  });
  execFileSync("codesign", ["--verify", "--deep", "--strict", appPath], {
    stdio: "inherit",
  });
};
