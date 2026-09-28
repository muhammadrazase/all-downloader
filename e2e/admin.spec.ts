import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

/**
 * Admin panel: login, tool visibility (nav + hub + direct-URL redirect), and
 * sign-out. Runs against an isolated e2e admin DB (see playwright.config.ts)
 * so it never touches a real dev/prod database.
 */

// Absolute, and resolved the same way playwright.config.ts resolves its default,
// so this script and the dev server it's priming always agree on one file
// regardless of what `process.cwd()` happens to be wherever each one runs.
const ADMIN_DB_PATH = process.env.ADMIN_DB_PATH ?? path.resolve(__dirname, '..', 'data', 'e2e-admin.db');
const ADMIN_EMAIL = 'e2e-admin@example.com';
const ADMIN_PASSWORD = 'e2e-admin-password-123';

test.beforeAll(() => {
  execFileSync('node', [path.join(__dirname, '..', 'scripts', 'create-admin.mjs')], {
    env: { ...process.env, ADMIN_DB_PATH, ADMIN_EMAIL, ADMIN_PASSWORD },
    stdio: 'ignore',
  });
});

async function login(page: import('@playwright/test').Page) {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test('unauthenticated visitors are redirected to login', async ({ page }) => {
  await page.goto('/admin/tools');
  await expect(page).toHaveURL(/\/admin\/login/);
});

test('rejects a wrong password', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill('definitely-wrong');
  await page.getByRole('button', { name: /sign in/i }).click();
  // Next's route announcer also carries role="alert"; scope to the login form's own message.
  await expect(page.locator('form p[role="alert"]')).toContainText(/invalid/i);
});

test('login → hide a tool → it disappears from nav/hub and its page redirects home → re-enable restores it', async ({
  page,
}) => {
  await login(page);

  await page.goto('/admin/tools');
  const tiktokRow = page.locator('li', { hasText: 'TikTok' }).first();
  const toggle = tiktokRow.getByRole('button', { name: /visible|hidden/i });
  await expect(toggle).toHaveText(/visible/i);
  await toggle.click();
  await expect(tiktokRow.getByRole('button')).toHaveText(/hidden/i);

  // Nav no longer lists it.
  await page.goto('/');
  await expect(page.locator('a[href="/tiktok-downloader"]')).toHaveCount(0);

  // Direct hit on the tool's own page redirects home.
  await page.goto('/tiktok-downloader');
  await expect(page).toHaveURL(/\/$/);

  // Re-enable restores both. Must wait for the toggle's own confirmation
  // before navigating away — the click only dispatches the Server Action,
  // it doesn't wait for its revalidatePath to land, so navigating
  // immediately can race ahead of it and hit the still-stale redirect.
  await page.goto('/admin/tools');
  await page.locator('li', { hasText: 'TikTok' }).first().getByRole('button', { name: /hidden/i }).click();
  await expect(tiktokRow.getByRole('button')).toHaveText(/visible/i);
  await page.goto('/tiktok-downloader');
  await expect(page).not.toHaveURL(/\/$/);
});

test('sign out clears the session', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
});

// Direct confirmation for the 6 tools added in this session — proves the registry-driven admin
// panel picked up the two NEW registry entries (converter, file-tool) with zero admin code changes,
// not just that the toggle mechanism works in general (already shown above for a platform).
/** Clicks a row's toggle only if it isn't already in `target` state — makes the test resilient to
 * a previous run having failed mid-way and left the shared e2e DB in the "wrong" state. */
async function ensureToggleState(row: import('@playwright/test').Locator, target: 'visible' | 'hidden'): Promise<void> {
  const button = row.getByRole('button');
  await expect(button).toBeVisible();
  const text = (await button.textContent())?.toLowerCase() ?? '';
  if (!text.includes(target)) {
    await button.click();
    await expect(button).toHaveText(new RegExp(target, 'i'));
  }
}

test('newly-registered converter and file-tool kinds toggle the same way as any other tool', async ({ page }) => {
  await login(page);
  await page.goto('/admin/tools');

  const compressorRow = page.locator('li', { hasText: 'Video Compressor' }).first();
  const mergerRow = page.locator('li', { hasText: 'Image Merger' }).first();
  await ensureToggleState(compressorRow, 'visible');
  await ensureToggleState(mergerRow, 'visible');

  await compressorRow.getByRole('button', { name: /visible/i }).click();
  await expect(compressorRow.getByRole('button')).toHaveText(/hidden/i);
  await mergerRow.getByRole('button', { name: /visible/i }).click();
  await expect(mergerRow.getByRole('button')).toHaveText(/hidden/i);

  await page.goto('/video-compressor');
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/image-merger');
  await expect(page).toHaveURL(/\/$/);

  // Restore both — this test must not leave the shared e2e admin DB in a hidden state for others.
  // Each toggle is awaited to actually flip in the DOM before navigating away, the same way the
  // hide half above (and the pre-existing TikTok test) already does.
  await page.goto('/admin/tools');
  await compressorRow.getByRole('button', { name: /hidden/i }).click();
  await expect(compressorRow.getByRole('button')).toHaveText(/visible/i);
  await mergerRow.getByRole('button', { name: /hidden/i }).click();
  await expect(mergerRow.getByRole('button')).toHaveText(/visible/i);

  await page.goto('/video-compressor');
  await expect(page).not.toHaveURL(/\/$/);
  await page.goto('/image-merger');
  await expect(page).not.toHaveURL(/\/$/);
});
