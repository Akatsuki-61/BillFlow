import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    main: "electron/main.ts",
    preload: "electron/preload.ts",
  },
  outDir: "dist-electron",
  format: ["cjs"],
  target: "node22",
  external: [
    "electron",
    "better-sqlite3",
    "pdf-lib",
    "tesseract.js",
    "@huggingface/transformers",
    "onnxruntime-node",
  ],
  noExternal: [/^drizzle-orm(?:\/|$)/, /^zod(?:\/|$)/],
  clean: true,
  sourcemap: false,
  minify: true,
  dts: false,
});
