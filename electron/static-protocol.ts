import fs from "fs";
import path from "path";
import { createHash } from "crypto";

export function resolveStaticFile(
  root: string,
  requestedUrl: string,
): string | null {
  try {
    const url = new URL(requestedUrl);
    if (
      url.protocol !== "app:" ||
      url.hostname !== "billflow" ||
      url.port ||
      url.username ||
      url.password
    )
      return null;
    const decoded = decodeURIComponent(url.pathname);
    if (decoded.includes("\\") || decoded.includes("\0")) return null;
    const canonicalRoot = fs.realpathSync(root);
    const contained = (file: string) => {
      const relative = path.relative(canonicalRoot, file);
      return (
        relative !== ".." &&
        !relative.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relative)
      );
    };
    let file = path.resolve(canonicalRoot, `.${decoded}`);
    if (!contained(file)) return null;
    const candidates = [
      file,
      path.join(file, "index.html"),
      `${file}.html`,
      ...(file.endsWith(".txt")
        ? [path.join(file.slice(0, -4), "index.txt")]
        : []),
    ];
    const match = candidates.find(
      (candidate) =>
        fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
    );
    if (match) {
      file = fs.realpathSync(match);
      return contained(file) ? file : null;
    }
    return null;
  } catch {
    return null;
  }
}
export function documentCsp(html: string): string {
  const hashes = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .filter((match) => match[1])
    .map(
      (match) =>
        `'sha256-${createHash("sha256").update(match[1]).digest("base64")}'`,
    );
  return `default-src 'self'; script-src 'self' ${hashes.join(" ")}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'`;
}
