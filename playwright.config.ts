import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

/**
 * E2E config. A dev server starts automatically on E2E_PORT (default 3100) and is
 * reused if one is already listening.
 *
 *   npm run test:e2e -- e2e/toolPages.spec.ts --project=desktop   # fast, deterministic
 *   npm run test:e2e                                              # whole suite (slow: wasm specs)
 *   RUN_LIVE_E2E=1 npm run test:e2e -- e2e/liveExtraction.spec.ts --project=desktop
 *
 * Scope to a spec file. The full suite includes ffmpeg.wasm/OCR specs that take
 * many minutes against a cold dev server.
 */

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;
// Isolated from the real admin.db so e2e/admin.spec.ts can freely toggle tools
// and change the password without touching (or racing) a dev/prod database.
// Absolute (not relative): Next's middleware bundle and its main server bundle
// don't reliably share the same resolved `process.cwd()` in `next dev`, so a
// relative path here can make middleware silently open a second, empty DB.
const ADMIN_DB_PATH = process.env.ADMIN_DB_PATH ?? path.resolve(__dirname, 'data', 'e2e-admin.db');

export default defineConfig({
  testDir: 'e2e',
  // retries:0 keeps failures honest — a flaky downloader test is a real signal.
  retries: 0,
  fullyParallel: false,
  workers: process.env.CI ? 1 : 2,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Hard per-action caps. Without these, a slow platform or a stalled dev-server
    // compile hangs the whole run instead of failing one test loudly.
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --port ${PORT}`,
        url: `http://127.0.0.1:${PORT}/api/health`,
        reuseExistingServer: !process.env.CI,
        // Next's first compile of a cold route is slow; this is a startup budget.
        timeout: 180_000,
        stdout: 'ignore',
        stderr: 'pipe',
        // Own build cache — a second `next dev`/`next build` sharing .next with a
        // dev/prod server already running against this checkout corrupts it for both.
        env: { ADMIN_DB_PATH, NEXT_DIST_DIR: path.resolve(__dirname, '.next-e2e') },
      },
});
