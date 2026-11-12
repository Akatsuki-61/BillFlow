import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/electron",
  workers: 1,
  fullyParallel: false,
  timeout: 120000,
  expect: { timeout: 15000 },
  reporter: "list",
  outputDir: "release/test-results",
});
