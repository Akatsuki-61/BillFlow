import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = fileURLToPath(new URL("../", import.meta.url));
const WIDTH = 660;
const HEIGHT = 440;

const { version } = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
const font = await readFile(path.join(root, "public/fonts/plusjakartasans.woff2"));

function buildHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    @font-face {
      font-family: "Plus Jakarta Sans";
      src: url("data:font/woff2;base64,${font.toString("base64")}") format("woff2");
      font-weight: 400 800;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      inline-size: ${WIDTH}px;
      block-size: ${HEIGHT}px;
      display: grid;
      grid-template-rows: 124px 192px 1fr;
      place-items: center;
      position: relative;
      overflow: clip;
      background:
        radial-gradient(ellipse at 96% 94%, #e5eefc, transparent 49%),
        radial-gradient(ellipse at 0 0, #eceafa, transparent 49%),
        #f8f9fe;
      color: #17233b;
      font-family: "Plus Jakarta Sans", sans-serif;
    }

    .paper-lines {
      position: absolute;
      inset: 0;
      background:
        repeating-linear-gradient(0deg, transparent 0 21px, #7386b4 21px 22px),
        repeating-linear-gradient(90deg, transparent 0 21px, #7386b4 21px 22px);
      mask-image: radial-gradient(ellipse at top left, black 0, transparent 31%),
        radial-gradient(ellipse at bottom right, black 0, transparent 38%);
      opacity: .2;
    }

    .receipt,
    .ledger {
      position: absolute;
      inline-size: 115px;
      block-size: 150px;
      border: 2px solid #6b82b8;
      border-radius: 16px;
      opacity: .24;
      background: repeating-linear-gradient(
        to bottom, transparent 0 17px, #6b82b8 17px 19px
      ) center 37px / 66px 77px no-repeat;
    }

    .receipt {
      inset: 285px auto auto -31px;
      transform: rotate(-24deg);
    }

    .ledger {
      inset: -67px -22px auto auto;
      transform: rotate(23deg);
    }

    header {
      display: grid;
      place-items: center;
      gap: 5px;
      position: relative;
      align-self: end;
    }

    h1, p { margin: 0; }

    h1 {
      font-size: 27px;
      font-weight: 800;
      letter-spacing: -.055em;
    }

    .version {
      font-size: 11px;
      font-weight: 650;
      color: #536481;
      font-variant-numeric: tabular-nums;
    }

    /* Finder supplies the clickable app and Applications icons. */
    .arrow {
      inline-size: 82px;
      block-size: 40px;
      background: linear-gradient(100deg, #0071bd, #5439cc);
      clip-path: polygon(0 39%, 68% 39%, 53% 11%, 65% 0, 100% 50%,
        65% 100%, 53% 89%, 68% 61%, 0 61%);
    }

    .instructions {
      position: relative;
      align-self: end;
      margin-block-end: 44px;
      font-size: 13px;
      color: #334561;
    }
  </style>
</head>
<body>
  <div class="paper-lines" aria-hidden="true"></div>
  <div class="receipt" aria-hidden="true"></div>
  <div class="ledger" aria-hidden="true"></div>
  <header>
    <h1>BillFlow</h1>
    <p class="version">Version ${version}</p>
  </header>
  <div class="arrow" aria-hidden="true"></div>
  <p class="instructions">Drag <strong>BillFlow</strong> to <strong>Applications</strong></p>
</body>
</html>`;
}

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch(
  existsSync(chromePath)
    ? { executablePath: chromePath, headless: true }
    : { headless: true },
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
