/**
 * Production-preview performance harness config.
 *
 * Usage (from frontend/):
 *   PERF_DIST=<built dist dir> PERF_LABEL=baseline npx playwright test -c perf/perf.config.ts
 *
 * Serves PERF_DIST with `vite preview` on 127.0.0.1:4173 (strict port). Does not use the dev server.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = process.env.PERF_DIST;
if (!dist) {
  throw new Error("PERF_DIST is required: set it to a production build directory (vite build output).");
}

export default defineConfig({
  testDir: ".",
  // PERF_MEMORY=1 selects the P12 memory investigation spec; default runs match only the production-preview spec.
  testMatch: process.env.PERF_MEMORY ? /memory\.perf\.ts$/ : /production-preview\.perf\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  outputDir: path.join(frontendDir, "test-results", "perf", ".playwright"),
  timeout: 15 * 60_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    // Bound every action so a missing or stale element fails fast instead of hanging until the test timeout.
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    headless: true,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      name: "perf-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      },
    },
  ],
  webServer: {
    command: `npx vite preview --outDir "${dist}" --port 4173 --strictPort --host 127.0.0.1`,
    cwd: frontendDir,
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
