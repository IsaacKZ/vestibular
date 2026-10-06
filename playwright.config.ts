import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

const chromiumExecutable =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ??
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    serviceWorkers: "block",
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    launchOptions: {
      executablePath: chromiumExecutable,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
  },
  webServer: {
    command: "npm run preview -- --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
