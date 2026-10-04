import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    main: "electron/main.ts",
    preload: "electron/preload.ts",
  },
  outDir: "dist-electron",
  format: ["cjs"],
  target: "node22",
  external: ["electron", "better-sqlite3"],
  clean: true,
  sourcemap: true,
  dts: false,
});
