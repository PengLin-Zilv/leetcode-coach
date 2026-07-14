import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    env: {
      ...process.env,
      TURSO_DATABASE_URL: "file:./dev.db",
    },
  },
  use: { baseURL: "http://127.0.0.1:3100" },
});
