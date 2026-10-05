// Format and size Lahiru's supplied artwork; do not redraw or recolor it.
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = path.join(root, "assets/brand/source");
for (const directory of ["public/brand", "build", "build/tray", "src/app"]) {
  await mkdir(path.join(root, directory), { recursive: true });
}

async function artwork(filename) {
  const input = path.join(source, filename);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + info.channels - 1] === 0) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left) throw new Error(`Empty logo: ${filename}`);
  return sharp(input).extract({ left, top, width: right - left + 1, height: bottom - top + 1 }).png().toBuffer();
}

async function square(input, size, fraction) {
  const inner = Math.round(size * fraction);
  const before = Math.floor((size - inner) / 2);
  const after = size - inner - before;
  return sharp(input)
    .resize(inner, inner, { fit: "contain", background: "#00000000" })
    .extend({ top: before, left: before, bottom: after, right: after, background: "#00000000" })
    .png().toBuffer();
}

const colored = await artwork("BillFlow-Logo-Colored-Icon.png");
const white = await artwork("BillFlow-Logo-White-Icon.png");
const shaped = await artwork("BillFlow-Logo-App-Shape.png");
const appIcon = await square(shaped, 1024, 0.88);
await writeFile(path.join(root, "public/brand/logo-color.png"), await square(colored, 128, 0.94));
await writeFile(path.join(root, "public/brand/logo-white.png"), await square(white, 128, 0.94));
await writeFile(path.join(root, "public/brand/app-icon.png"), appIcon);
await writeFile(path.join(root, "build/icon.png"), appIcon);
await writeFile(path.join(root, "src/app/icon.png"), await sharp(appIcon).resize(512, 512).png().toBuffer());
await writeFile(path.join(root, "src/app/apple-icon.png"), await sharp(appIcon).resize(180, 180).png().toBuffer());

async function ico(sizes, input = appIcon) {
  const frames = await Promise.all(sizes.map(size => sharp(input).resize(size, size).png().toBuffer()));
  const header = Buffer.alloc(6 + 16 * frames.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  sizes.forEach((size, index) => {
    const entry = 6 + 16 * index;
    header[entry] = header[entry + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(frames[index].length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += frames[index].length;
  });
  return Buffer.concat([header, ...frames]);
}
await writeFile(path.join(root, "build/icon.ico"), await ico([16, 24, 32, 48, 64, 128, 256]));
await writeFile(path.join(root, "src/app/favicon.ico"), await ico([16, 32, 48]));

// macOS uses the white artwork's alpha as an adaptive system template.
for (const [filename, size, density] of [["trayTemplate.png", 16, 72], ["trayTemplate@2x.png", 32, 144]]) {
  await writeFile(path.join(root, "build/tray", filename),
    await sharp(await square(white, size, 0.94)).withMetadata({ density }).png().toBuffer());
}
await writeFile(path.join(root, "build/tray/tray-white.ico"), await ico([16, 24, 32, 48], await square(white, 128, 0.94)));
await writeFile(path.join(root, "build/tray/tray-color.ico"), await ico([16, 24, 32, 48], await square(colored, 128, 0.94)));

// Modern macOS ICNS files carry PNG representations for each icon size.
const entries = await Promise.all([
  ["icp4", 16], ["icp5", 32], ["icp6", 64], ["ic07", 128],
  ["ic08", 256], ["ic09", 512], ["ic10", 1024],
].map(async ([type, size]) => {
  const png = await sharp(appIcon).resize(size, size).png().toBuffer();
  const entry = Buffer.alloc(8);
  entry.write(type, 0, "ascii");
  entry.writeUInt32BE(png.length + 8, 4);
  return Buffer.concat([entry, png]);
}));
const header = Buffer.alloc(8);
header.write("icns", 0, "ascii");
header.writeUInt32BE(8 + entries.reduce((sum, entry) => sum + entry.length, 0), 4);
await writeFile(path.join(root, "build/icon.icns"), Buffer.concat([header, ...entries]));
console.log("Generated sidebar, browser, macOS, and Windows branding assets.");
