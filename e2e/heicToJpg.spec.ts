import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const FIXTURE_DIR = path.join(__dirname, '..', 'test', 'fixtures', 'image');
const HEIC = {
  sample: path.join(FIXTURE_DIR, 'sample.heic'),
  sample2: path.join(FIXTURE_DIR, 'sample-2.heic'),
  sample3: path.join(FIXTURE_DIR, 'sample-3.heic'),
  // 480x360 of high-frequency noise. The 100x100 samples are too uniform for JPEG quality to
  // move their size measurably, so proving the slider is not a no-op needs a detailed image.
  detailed: path.join(FIXTURE_DIR, 'detail-480x360.heic'),
  notHeic: path.join(__dirname, '..', 'test', 'fixtures', 'images', 'logo-transparent.png'),
};

function trackRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (req) => urls.push(req.url()));
  return urls;
}

/**
 * Counts every image blob URL the page mints and frees. A result the user can no longer see but
 * that was never revoked is a leak the DOM alone can't reveal — these are multi-megabyte photos.
 */
const TRACK_IMAGE_BLOBS = `
  window.__imageBlobs = { created: [], revoked: [] };
  const createUrl = URL.createObjectURL.bind(URL);
  const revokeUrl = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = (source) => {
    const url = createUrl(source);
    if (source && String(source.type).startsWith('image/')) window.__imageBlobs.created.push(url);
    return url;
  };
  URL.revokeObjectURL = (url) => { window.__imageBlobs.revoked.push(url); return revokeUrl(url); };
`;

async function liveImageBlobCount(page: Page): Promise<{ created: number; live: number }> {
  return page.evaluate(() => {
    const tracker = (window as unknown as { __imageBlobs: { created: string[]; revoked: string[] } }).__imageBlobs;
    const revoked = new Set(tracker.revoked);
    return { created: tracker.created.length, live: tracker.created.filter((url) => !revoked.has(url)).length };
  });
}

/** Nine tiny photos convert in ~40ms total, far too fast to interact with — throttling opens a real window. */
async function queueThrottledBatch(page: Page): Promise<() => Promise<void>> {
  const files = [HEIC.sample, HEIC.sample2, HEIC.sample3, HEIC.sample, HEIC.sample2, HEIC.sample3, HEIC.sample, HEIC.sample2, HEIC.sample3];
  await page.locator('input[type="file"]').setInputFiles(files);
  await expect(page.locator('li.card')).toHaveCount(files.length);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 20 });
  await page.getByRole('button', { name: /^Convert/ }).click();
  await expect(page.getByText('Converting…').first()).toBeVisible({ timeout: 30_000 });
  return async () => { await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); };
}

test.beforeEach(() => {
  test.setTimeout(90_000);
});

test.describe('/heic-to-jpg', () => {
  test('converts a real HEIC file to a real JPEG with correct pixel dimensions', async ({ page }) => {
    await page.goto('/heic-to-jpg');
    await page.locator('input[type="file"]').setInputFiles(HEIC.sample);
    await expect(page.getByText('sample.heic')).toBeVisible();

    await page.getByRole('button', { name: /^Convert/ }).click();
    const link = page.getByRole('link', { name: 'Download', exact: true });
    await expect(link).toBeVisible({ timeout: 30_000 });

    const href = await link.getAttribute('href');
    expect(href).toMatch(/^blob:/);
    const magic = await page.evaluate(async (url) => {
      const res = await fetch(url);
      const bytes = new Uint8Array(await res.arrayBuffer());
      return [bytes[0], bytes[1], bytes[2]];
    }, href!);
    expect(magic).toEqual([0xff, 0xd8, 0xff]); // real JPEG magic bytes, not just a renamed file

    // Independent decode via the browser's own image decoder confirms real, correct pixel content.
    const img = page.locator('li img').first();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    expect(await img.evaluate((el: HTMLImageElement) => ({ w: el.naturalWidth, h: el.naturalHeight }))).toEqual({ w: 100, h: 100 });
  });

  test('PNG format produces real PNG bytes', async ({ page }) => {
    await page.goto('/heic-to-jpg');
    await page.locator('input[type="file"]').setInputFiles(HEIC.sample);
    await page.getByLabel('Format', { exact: true }).selectOption('png');
    await page.getByRole('button', { name: /^Convert/ }).click();

    const link = page.getByRole('link', { name: 'Download', exact: true });
    await expect(link).toBeVisible({ timeout: 30_000 });
    const href = await link.getAttribute('href');
    const magic = await page.evaluate(async (url) => {
      const res = await fetch(url);
      const bytes = new Uint8Array(await res.arrayBuffer());
      return Array.from(bytes.subarray(0, 8));
    }, href!);
    expect(magic).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  test('converts a batch of 3 files independently, each with its own result', async ({ page }) => {
    await page.goto('/heic-to-jpg');
    await page.locator('input[type="file"]').setInputFiles([HEIC.sample, HEIC.sample2, HEIC.sample3]);
    await expect(page.locator('li.card')).toHaveCount(3);

    await page.getByRole('button', { name: /^Convert 3 images/ }).click();
    await expect(page.getByRole('link', { name: 'Download', exact: true })).toHaveCount(3, { timeout: 30_000 });
  });

  test('rejects a non-HEIC file with a clear message instead of creating a job', async ({ page }) => {
    await page.goto('/heic-to-jpg');
    await page.locator('input[type="file"]').setInputFiles(HEIC.notHeic);

    await expect(page.locator('p.text-danger')).toContainText('not a HEIC/HEIF file');
    await expect(page.locator('li.card')).toHaveCount(0);
  });

  // Confirms at runtime what's verified in source: heic-to's decoder is a self-hosted inline
  // worker, so nothing here should ever fetch a third-party asset.
  test('every request during pick and convert stays on our own origin — no third-party CDN', async ({ page }) => {
    const urls = trackRequests(page);
    await page.goto('/heic-to-jpg', { waitUntil: 'networkidle' });
    await page.locator('input[type="file"]').setInputFiles(HEIC.sample);
    await page.getByRole('button', { name: /^Convert/ }).click();
    await expect(page.getByRole('link', { name: 'Download', exact: true })).toBeVisible({ timeout: 30_000 });

    const origin = new URL(page.url()).origin;
    for (const url of urls) {
      if (url.startsWith('blob:') || url.startsWith('data:')) continue;
      expect(new URL(url).origin, `unexpected cross-origin request: ${url}`).toBe(origin);
    }
  });

  test('the quality slider really re-encodes — it is not a decorative control', async ({ page }) => {
    await page.goto('/heic-to-jpg');
    await page.locator('input[type="file"]').setInputFiles(HEIC.detailed);

    const sizeAt = async (quality: string): Promise<number> => {
      await page.locator('input[type="range"]').fill(quality);
      await page.getByRole('button', { name: /^(Convert|Re-convert)/ }).click();
      await expect(page.getByRole('button', { name: 'Converted' })).toBeVisible({ timeout: 30_000 });
      const href = await page.getByRole('link', { name: 'Download', exact: true }).getAttribute('href');
      expect(href).toMatch(/^blob:/);
      return page.evaluate(async (url) => (await (await fetch(url)).arrayBuffer()).byteLength, href ?? '');
    };

    const lowest = await sizeAt('0.1');
    const highest = await sizeAt('1');
    expect(highest, 'maximum quality must produce a materially larger file than minimum').toBeGreaterThan(lowest * 5);
  });

  test('removing a photo mid-batch stops its conversion instead of orphaning its result', async ({ page }) => {
    await page.addInitScript(TRACK_IMAGE_BLOBS);
    await page.goto('/heic-to-jpg');
    const unthrottle = await queueThrottledBatch(page);

    await page.locator('li.card').last().getByRole('button', { name: /^Remove / }).click();
    await unthrottle();
    await expect(page.getByRole('button', { name: /^(Converted|Re-convert)/ })).toBeVisible({ timeout: 60_000 });

    await expect(page.locator('li.card')).toHaveCount(8);
    await expect(page.getByRole('link', { name: 'Download', exact: true })).toHaveCount(8);
    // One result per surviving card, and nothing minted for the card that is gone.
    expect(await liveImageBlobCount(page)).toEqual({ created: 8, live: 8 });
  });

  test('Clear all during a batch abandons it cleanly and leaves the tool usable at once', async ({ page }) => {
    await page.addInitScript(TRACK_IMAGE_BLOBS);
    await page.goto('/heic-to-jpg');
    const unthrottle = await queueThrottledBatch(page);

    await page.getByRole('button', { name: 'Clear all' }).click();
    await unthrottle();
    await expect(page.locator('li.card')).toHaveCount(0);

    // The cleared batch must not keep converting in the background and must not hold the button hostage.
    await page.locator('input[type="file"]').setInputFiles(HEIC.sample);
    await expect(page.getByRole('button', { name: 'Convert image' })).toBeEnabled();
    await page.getByRole('button', { name: 'Convert image' }).click();
    await expect(page.getByRole('link', { name: 'Download', exact: true })).toHaveCount(1, { timeout: 30_000 });

    const { created, live } = await liveImageBlobCount(page);
    expect(live, 'every result blob except the one on screen must have been freed').toBe(1);
    expect(created, 'the abandoned batch must not have kept converting').toBeLessThanOrEqual(2);
  });

  test('a crafted filename cannot steer where the download lands', async ({ page }) => {
    await page.goto('/heic-to-jpg');
    const bytes = fs.readFileSync(HEIC.sample);
    await page.locator('input[type="file"]').setInputFiles([
      { name: '../../../../etc/passwd.heic', mimeType: 'image/heic', buffer: bytes },
      { name: '.heic', mimeType: 'image/heic', buffer: bytes },
      { name: `${'a'.repeat(400)}.heic`, mimeType: 'image/heic', buffer: bytes },
    ]);
    await page.getByRole('button', { name: /^Convert/ }).click();
    await expect(page.getByRole('link', { name: 'Download', exact: true })).toHaveCount(3, { timeout: 30_000 });

    const [traversal = '', dotfile = '', overlong = ''] = await page.getByRole('link', { name: 'Download', exact: true })
      .evaluateAll((links) => links.map((link) => link.getAttribute('download') ?? ''));
    expect(traversal).not.toContain('/');
    expect(dotfile, 'a name that is only an extension must not become a hidden dotfile').toBe('photo.jpg');
    expect(overlong.length).toBeLessThanOrEqual(124);
    for (const name of [traversal, dotfile, overlong]) expect(name).toMatch(/\.jpg$/);
  });

  test('the drop zone and per-photo controls are usable by keyboard and touch', async ({ page }) => {
    await page.goto('/heic-to-jpg');
    const dropZone = page.getByRole('button', { name: /Drag HEIC photos here/ });

    // WCAG 2.5.3: the accessible name has to contain the label the user can actually see.
    await expect(dropZone).toContainText('Drag HEIC photos here, or click to choose');

    await dropZone.focus();
    await page.keyboard.press('Space');
    expect(await page.evaluate(() => window.scrollY), 'Space must open the picker, not scroll the page away').toBe(0);

    await page.locator('input[type="file"]').setInputFiles(HEIC.sample);
    const remove = page.getByRole('button', { name: /^Remove / });
    const box = await remove.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });
});
