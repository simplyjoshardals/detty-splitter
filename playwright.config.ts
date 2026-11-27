import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/**
 * One end-to-end flow plus axe (T11.2). It runs against the production static export, not the
 * dev server: the dev overlay would add elements to the page axe checks. Playwright builds
 * the site, serves `out/` and stops the server when the run ends.
 */
export default defineConfig({
  testDir: "./e2e",
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Copy link writes to the clipboard and the flow reads it back.
    permissions: ["clipboard-read", "clipboard-write"],
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `yarn build && yarn serve out -l ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 240_000,
    reuseExistingServer: true,
  },
});
