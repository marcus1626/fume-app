// End-to-end smoke tests of the product's main flows (e2e/), in Chromium at a desk size. Playwright starts the app
// itself on a fixed port; every page load recreates the in-memory mock (the LYSNE demo), so each test signs in with
// the query string on its first `page.goto` (app/README.md). When the app runs on the real backend, the same tests
// prove the flows still work.
import { defineConfig, devices } from "@playwright/test";

const port = 5190;
const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  workers: ci ? 2 : undefined,
  reporter: ci ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  // The dev server compiles a page's modules on first load, so a cold start can be slow.
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: `npx vite --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !ci,
    timeout: 120_000,
  },
});
