/**
 * Navigation path normalization and active state calculation.
 * Ensures consistent matching across static export URLs, Electron app:// protocol,
 * trailing slashes, query params, and hash fragments.
 */

export function normalizeNavPath(p: string | null | undefined): string {
  if (!p) return "/";
  // Strip search params and hashes
  const clean = p.split("?")[0].split("#")[0];
  // Strip .html extension
  const withoutExt = clean.replace(/\.html$/, "");
  // Strip trailing /index
  const withoutIndex = withoutExt.replace(/\/index$/, "");
  // Strip trailing slashes
  const trimmed = withoutIndex.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

export function isNavActive(
  currentPathname: string | null | undefined,
  targetHref: string,
): boolean {
  const current = normalizeNavPath(currentPathname);
  const target = normalizeNavPath(targetHref);
  if (target === "/") {
    return current === "/";
  }
  return current === target || current.startsWith(target + "/");
}
