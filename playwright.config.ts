import { defineConfig } from "@playwright/test";
export default defineConfig({
  globalTeardown:"./tests/fixtures/cleanup.ts",
  testDir: "tests/e2e",
  timeout: 120000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.TEST_BASE_URL || "http://localhost:3000",
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  outputDir: "test-results",
});
