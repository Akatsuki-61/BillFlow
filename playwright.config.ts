import { defineConfig } from "@playwright/test";
import path from "node:path";
import { version } from "./package.json";

process.env.BILLFLOW_APP_PATH ||= path.resolve(
  `release/test-${version}/mac-arm64/BillFlow.app/Contents/MacOS/BillFlow`,
);

export default defineConfig({
  testDir: "./tests/electron",
  workers: 1,
  fullyParallel: false,
  timeout: 120000,
  expect: { timeout: 15000 },
  reporter: "list",
  outputDir: "release/test-results",
});
