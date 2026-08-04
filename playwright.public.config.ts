import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.E2E_BASE_URL?.trim();
const localBaseUrl = "http://127.0.0.1:3102";

export default defineConfig({
  testDir: "./tests",
  testMatch: "login-accessibility.visual.spec.ts",
  outputDir: ".playwright-results/public",
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.015,
    },
  },
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: externalBaseUrl || localBaseUrl,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-chrome",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        colorScheme: "light",
      },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "npm run build && npm run start -- -H 127.0.0.1 -p 3102",
        url: localBaseUrl,
        reuseExistingServer: false,
        timeout: 180_000,
      },
});
