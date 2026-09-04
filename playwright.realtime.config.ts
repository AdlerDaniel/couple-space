import nextEnvironment from "@next/env";
import { defineConfig, devices } from "@playwright/test";

const { loadEnvConfig } = nextEnvironment;
loadEnvConfig(process.cwd());

const externalBaseUrl = process.env.E2E_BASE_URL?.trim();
const localBaseUrl = "http://127.0.0.1:3101";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["archive-realtime.spec.ts", "tracker-lab-realtime.spec.ts"],
  outputDir: ".playwright-results",
  timeout: 120_000,
  expect: {
    timeout: 20_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: externalBaseUrl || localBaseUrl,
    actionTimeout: 12_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chrome",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "npm run build && npm run start -- -H 127.0.0.1 -p 3101",
        url: localBaseUrl,
        reuseExistingServer: false,
        timeout: 240_000,
      },
});
