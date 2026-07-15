import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev:e2e",
    url: "http://127.0.0.1:3100/setup",
    reuseExistingServer: false,
    env: {
      ...process.env,
      TURSO_DATABASE_URL: "file:./test-results/leetcode-coach-e2e.db",
    },
  },
});
