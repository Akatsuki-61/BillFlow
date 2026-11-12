import fs from "fs";
import path from "path";

export function resolveBrandIcon(): string | undefined {
  const candidates = [
    typeof process !== "undefined" && process.resourcesPath
      ? path.join(process.resourcesPath, "brand", "logo-white.png")
      : undefined,
    path.join(process.cwd(), "public", "brand", "logo-white.png"),
    path.join(__dirname, "../public/brand/logo-white.png"),
    path.join(__dirname, "brand/logo-white.png"),
  ];
  return candidates.find((c) => Boolean(c && fs.existsSync(c)));
}

export function getBase64Logo(): string {
  const icon = resolveBrandIcon();
  if (icon && fs.existsSync(icon)) {
    return fs.readFileSync(icon).toString("base64");
  }
  return "";
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatMoney(cents: number, currency: string = "USD"): string {
  const symbol =
    currency === "LKR"
      ? "Rs. "
      : currency === "EUR"
        ? "€"
        : currency === "GBP"
          ? "£"
          : currency === "CAD"
            ? "CA$"
            : "$";
  const val = (cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${val}`;
}

let cachedFontCss: string | undefined;
export function invoiceFontCss(): string {
  if (cachedFontCss) return cachedFontCss;
  const candidates = [
    typeof process.resourcesPath === "string"
      ? path.join(process.resourcesPath, "fonts")
      : "",
    path.join(process.cwd(), "public/fonts"),
    path.join(__dirname, "../public/fonts"),
    path.join(__dirname, "../out/fonts"),
  ];
  const directory = candidates.find(
    (dir) => dir && fs.existsSync(path.join(dir, "nunito.woff2")),
  );
  if (!directory)
    throw new Error("Bundled invoice fonts are missing. Reinstall BillFlow.");
  cachedFontCss = [
    ["Nunito", "nunito"],
    ["Plus Jakarta Sans", "plusjakartasans"],
  ]
    .map(
      ([family, name]) =>
        `@font-face{font-family:'${family}';font-style:normal;font-weight:400 900;font-display:block;src:url(data:font/woff2;base64,${fs.readFileSync(path.join(directory, name + ".woff2")).toString("base64")}) format('woff2');}`,
    )
    .join("");
  return cachedFontCss;
}
