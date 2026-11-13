import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));
const WIDTH = 660;
const HEIGHT = 440;

const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const version = pkg.version || "0.2.0";

const rawLogoBuffer = await readFile(
  path.join(root, "assets/brand/source/BillFlow-Logo-Colored-Icon.png"),
);
const logoBuffer = await sharp(rawLogoBuffer).trim().png().toBuffer();
const logoDataUri = `data:image/png;base64,${logoBuffer.toString("base64")}`;

const fontBuffer = await readFile(
  path.join(root, "public/fonts/plusjakartasans.woff2"),
);
const fontDataUri = `data:font/woff2;base64,${fontBuffer.toString("base64")}`;

function buildHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      @font-face {
        font-family: "Plus Jakarta Sans";
        src: url("${fontDataUri}") format("woff2");
        font-weight: 400 800;
        font-style: normal;
      }

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      html,
      body {
        width: ${WIDTH}px;
        height: ${HEIGHT}px;
        overflow: hidden;
        background: #ffffff;
        font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
        -webkit-font-smoothing: antialiased;
      }

      .stage {
        position: relative;
        width: ${WIDTH}px;
        height: ${HEIGHT}px;
        background: #ffffff;
        color: #0f172a;
        overflow: hidden;
      }

      .dot-grid {
        position: absolute;
        inset: 0;
        background-image: radial-gradient(#cbd5e1 0.85px, transparent 0.85px);
        background-size: 16px 16px;
        opacity: 0.36;
        -webkit-mask-image: radial-gradient(ellipse 84% 76% at 50% 50%, rgba(0, 0, 0, 0.16) 0%, rgba(0, 0, 0, 0.85) 100%);
        mask-image: radial-gradient(ellipse 84% 76% at 50% 50%, rgba(0, 0, 0, 0.16) 0%, rgba(0, 0, 0, 0.85) 100%);
      }

      .header {
        position: absolute;
        top: 32px;
        left: 40px;
        right: 40px;
        height: 84px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .brand-lockup {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .logo-tile {
        width: 48px;
        height: 48px;
        border-radius: 13px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        box-shadow:
          0 1px 2px rgba(15, 23, 42, 0.05),
          0 8px 18px -6px rgba(37, 99, 235, 0.16);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .logo-tile img {
        width: 27px;
        height: 27px;
        object-fit: contain;
      }

      .brand-copy {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .title-row {
        display: flex;
        align-items: center;
        gap: 9px;
      }

      .brand-name {
        font-size: 22px;
        font-weight: 700;
        letter-spacing: -0.03em;
        line-height: 1.1;
        color: #0f172a;
      }

      .version-pill {
        font-size: 10.5px;
        font-weight: 600;
        letter-spacing: -0.01em;
        color: #1d4ed8;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        padding: 3px 8px;
        border-radius: 999px;
      }

      .brand-tagline {
        font-size: 11.5px;
        font-weight: 500;
        color: #475569;
        letter-spacing: -0.01em;
        white-space: nowrap;
      }

      .product-vignette {
        position: relative;
        width: 234px;
        height: 82px;
      }

      .mini-kanban-card {
        position: absolute;
        top: 8px;
        left: 0;
        width: 112px;
        padding: 8px 10px;
        border-radius: 10px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        box-shadow:
          0 2px 5px rgba(15, 23, 42, 0.04),
          0 10px 20px -8px rgba(15, 23, 42, 0.09);
        transform: rotate(-4deg);
      }

      .mini-kanban-label {
        font-size: 8.5px;
        font-weight: 600;
        color: #64748b;
        margin-bottom: 5px;
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .mini-dot-purple {
        width: 5.5px;
        height: 5.5px;
        border-radius: 999px;
        background: linear-gradient(135deg, #2563eb, #7c3aed);
        flex-shrink: 0;
      }

      .mini-kanban-bars {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .bar {
        height: 4px;
        border-radius: 999px;
        background: #e2e8f0;
      }

      .bar.accent {
        width: 72%;
        background: linear-gradient(90deg, #22d3ee, #2563eb, #7c3aed);
      }

      .bar.short {
        width: 48%;
      }

      .mini-invoice-card {
        position: absolute;
        top: 12px;
        right: 0;
        width: 134px;
        padding: 9px 11px;
        border-radius: 11px;
        background: #ffffff;
        border: 1px solid #dbeafe;
        box-shadow:
          0 2px 4px rgba(15, 23, 42, 0.04),
          0 12px 24px -8px rgba(37, 99, 235, 0.14);
        transform: rotate(2.5deg);
      }

      .mini-inv-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
      }

      .mini-inv-code {
        font-size: 9px;
        font-weight: 700;
        color: #0f172a;
        letter-spacing: -0.02em;
      }

      .mini-paid-chip {
        font-size: 8px;
        font-weight: 700;
        color: #15803d;
        background: #dcfce7;
        border: 1px solid #bbf7d0;
        padding: 1.5px 6px;
        border-radius: 999px;
      }

      .mini-inv-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-top: 5px;
        border-top: 1px dashed #e2e8f0;
      }

      .mini-inv-amount {
        font-size: 11px;
        font-weight: 700;
        color: #0f172a;
        letter-spacing: -0.02em;
      }

      .mini-inv-bars {
        display: flex;
        gap: 3px;
        align-items: flex-end;
      }

      .mini-inv-bars span {
        width: 3px;
        border-radius: 2px;
        background: linear-gradient(180deg, #22d3ee, #2563eb);
      }

      /* Plinths aligned with Finder icon centers (175, 232) and (485, 232) at iconSize 104 */
      .drop-well {
        position: absolute;
        top: 146px;
        width: 164px;
        height: 188px;
        border-radius: 22px;
        background: #ffffff;
      }

      .drop-well.app-well {
        left: 93px;
        border: 1px solid #e2e8f0;
        box-shadow:
          0 0 0 1px rgba(15, 23, 42, 0.03),
          0 2px 4px -1px rgba(15, 23, 42, 0.04),
          0 12px 24px -8px rgba(15, 23, 42, 0.08);
      }

      .drop-well.dest-well {
        left: 403px;
        border: 1.5px dashed #93c5fd;
        background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
        box-shadow:
          0 1px 2px rgba(37, 99, 235, 0.04),
          0 12px 24px -10px rgba(37, 99, 235, 0.09);
      }

      .corner-tick {
        position: absolute;
        width: 8px;
        height: 8px;
        opacity: 0.8;
      }
      .corner-tick.tl { top: 8px; left: 8px; border-top: 1.5px solid #22d3ee; border-left: 1.5px solid #22d3ee; border-top-left-radius: 4px; }
      .corner-tick.tr { top: 8px; right: 8px; border-top: 1.5px solid #2563eb; border-right: 1.5px solid #2563eb; border-top-right-radius: 4px; }
      .corner-tick.bl { bottom: 8px; left: 8px; border-bottom: 1.5px solid #2563eb; border-left: 1.5px solid #2563eb; border-bottom-left-radius: 4px; }
      .corner-tick.br { bottom: 8px; right: 8px; border-bottom: 1.5px solid #7c3aed; border-right: 1.5px solid #7c3aed; border-bottom-right-radius: 4px; }

      .drop-hint-badge {
        position: absolute;
        top: 8px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.03em;
        color: #2563eb;
        background: #eff6ff;
        border: 1px solid #dbeafe;
        padding: 2px 8px;
        border-radius: 999px;
        white-space: nowrap;
      }

      .arrow-bridge {
        position: absolute;
        left: 263px;
        top: 210px;
        width: 134px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .drag-pill {
        position: absolute;
        top: 358px;
        left: 50%;
        transform: translateX(-50%);
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 18px;
        border-radius: 999px;
        background: #ffffff;
        border: 1px solid #dbeafe;
        box-shadow:
          0 0 0 1px rgba(15, 23, 42, 0.03),
          0 2px 4px -1px rgba(15, 23, 42, 0.04),
          0 8px 20px -6px rgba(15, 23, 42, 0.08);
        font-size: 12px;
        font-weight: 600;
        color: #0f172a;
        letter-spacing: -0.01em;
        white-space: nowrap;
      }

      .drag-pill strong {
        color: #2563eb;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <div class="stage">
      <div class="dot-grid"></div>

      <header class="header">
        <div class="brand-lockup">
          <div class="logo-tile">
            <img src="${logoDataUri}" alt="BillFlow" />
          </div>
          <div class="brand-copy">
            <div class="title-row">
              <span class="brand-name">BillFlow</span>
              <span class="version-pill">v${version} · Apple Silicon</span>
            </div>
            <p class="brand-tagline">Local invoicing, tasks, payouts &amp; profit tracking</p>
          </div>
        </div>

        <div class="product-vignette" aria-hidden="true">
          <div class="mini-kanban-card">
            <div class="mini-kanban-label">
              <span class="mini-dot-purple"></span>
              <span>To Do &#8594; Done</span>
            </div>
            <div class="mini-kanban-bars">
              <div class="bar accent"></div>
              <div class="bar short"></div>
            </div>
          </div>
          <div class="mini-invoice-card">
            <div class="mini-inv-top">
              <span class="mini-inv-code">INV-020</span>
              <span class="mini-paid-chip">PAID</span>
            </div>
            <div class="mini-inv-row">
              <span class="mini-inv-amount">$2,450</span>
              <div class="mini-inv-bars">
                <span style="height: 6px"></span>
                <span style="height: 10px"></span>
                <span style="height: 14px"></span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div class="drop-well app-well">
        <span class="corner-tick tl"></span>
        <span class="corner-tick tr"></span>
        <span class="corner-tick bl"></span>
        <span class="corner-tick br"></span>
      </div>

      <div class="arrow-bridge" aria-hidden="true">
        <svg width="130" height="44" viewBox="0 0 130 44" fill="none">
          <defs>
            <linearGradient id="bfFlow" x1="12" y1="22" x2="116" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#22D3EE" />
              <stop offset="52%" stop-color="#2563EB" />
              <stop offset="100%" stop-color="#7C3AED" />
            </linearGradient>
          </defs>
          <path d="M12 14L20 22L12 30" stroke="#BAE6FD" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M25 14L33 22L25 30" stroke="#93C5FD" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M42 22H112" stroke="url(#bfFlow)" stroke-width="3.5" stroke-linecap="round" />
          <path d="M101 11L114 22L101 33" stroke="url(#bfFlow)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>

      <div class="drop-well dest-well">
        <span class="drop-hint-badge">Drop here</span>
      </div>

      <div class="drag-pill">
        <span>Drag <strong>BillFlow.app</strong> into <strong>Applications</strong> to install</span>
      </div>
    </div>
  </body>
</html>`;
}

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch(
  existsSync(chromePath) ? { executablePath: chromePath, headless: true } : { headless: true },
);

try {
  const html = buildHtml();
  for (const [scale, filename] of [
    [1, "dmg-background.png"],
    [2, "dmg-background@2x.png"],
  ]) {
    const context = await browser.newContext({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: scale,
    });
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: path.join(root, "build", filename),
      type: "png",
    });
    await context.close();
  }
  console.log("Generated build/dmg-background.png and build/dmg-background@2x.png.");
} finally {
  await browser.close();
}
