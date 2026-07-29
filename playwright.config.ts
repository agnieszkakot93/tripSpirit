import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium-authenticated",
      testMatch:
        /seed\.spec\.ts|itinerary-persists-after-reload\.spec\.ts|trip-list-persists-after-reload\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "chromium",
      testIgnore: [
        /auth\.setup\.ts/,
        /auth-redirect\.spec\.ts/,
        /seed\.spec\.ts/,
        /itinerary-persists-after-reload\.spec\.ts/,
        /trip-list-persists-after-reload\.spec\.ts/,
      ],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-unauth",
      testMatch: /auth-redirect\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Mirror scripts/dev-local.sh: migrate local D1, then next dev --webpack.
    command: `npx wrangler d1 migrations apply tripsprint-ai-db --local && npx next dev --webpack -p ${PORT}`,
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
