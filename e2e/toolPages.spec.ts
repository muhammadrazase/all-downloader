import { test, expect, type Page } from '@playwright/test';
import { PLATFORM_LIST } from '../src/lib/platforms';

/**
 * Deterministic per-platform checks: no real platform is contacted, so this spec
 * is safe to run on every commit. Live extraction lives in liveExtraction.spec.ts.
 */

const box = (page: Page, platformName: string) => page.getByLabel(`${platformName} video URL`);
// Structural, not by accessible name: the submit button swaps its label for a
// spinner while fetching, so a name-based locator stops matching mid-flight.
const submit = (page: Page) => page.locator('form button[type="submit"]');
const statusRegion = (page: Page) => page.locator('[aria-live="polite"]');

for (const platform of PLATFORM_LIST) {
  test.describe(`${platform.name} — /${platform.slug}`, () => {
    test('renders the tool with exactly one H1 and a focusable URL field', async ({ page }) => {
      await page.goto(`/${platform.slug}`);

      const h1 = page.locator('h1');
      await expect(h1).toHaveCount(1);
      await expect(h1).toHaveText(platform.h1);
      await expect(box(page, platform.name)).toBeVisible();
      await expect(submit(page)).toBeEnabled();
    });

    test('exposes a canonical URL and parseable JSON-LD', async ({ page }) => {
      await page.goto(`/${platform.slug}`);

      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveCount(1);
      expect(await canonical.getAttribute('href')).toContain(`/${platform.slug}`);

      const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
      expect(blocks.length).toBeGreaterThanOrEqual(4);
      const types = blocks.map((raw) => (JSON.parse(raw) as { '@type': string })['@type']);
      expect(types).toEqual(expect.arrayContaining(['WebApplication', 'FAQPage', 'HowTo', 'BreadcrumbList']));
    });

    test('submitting an empty field shows guidance, never a blank screen or stack trace', async ({ page }) => {
      await page.goto(`/${platform.slug}`);
      await submit(page).click();

      await expect(statusRegion(page)).toContainText('Paste a video link to get started.');
      await expect(page.locator('body')).not.toContainText('at Object.');
      await expect(page.locator('body')).not.toContainText('yt-dlp');
    });

    test('a well-formed link from the wrong host is refused with a readable message', async ({ page }) => {
      await page.goto(`/${platform.slug}`);
      await box(page, platform.name).fill('https://example.com/some/video');
      await submit(page).click();

      await expect(statusRegion(page)).toContainText(`valid ${platform.name} link`, { timeout: 20_000 });
    });

    test('refuses an internal address without exposing that it even tried', async ({ page }) => {
      await page.goto(`/${platform.slug}`);
      await box(page, platform.name).fill('http://169.254.169.254/latest/meta-data/');
      await submit(page).click();

      await expect(statusRegion(page)).toContainText('Internal addresses are not allowed.', { timeout: 20_000 });
      await expect(page.locator('body')).not.toContainText('169.254.169.254');
    });

    test('the state machine shows a loading state and re-enables the button afterwards', async ({ page }) => {
      // The request is held open until the test releases it, so the intermediate
      // "fetching" state is observed deterministically rather than by timing.
      let release: () => void = () => {};
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route('**/api/extract', async (route) => {
        await held;
        await route.fulfill({ status: 502, json: { error: 'Could not fetch this video.' } });
      });

      await page.goto(`/${platform.slug}`);
      await box(page, platform.name).fill(platform.urlExample);
      await submit(page).click();

      await expect(statusRegion(page)).toContainText('Fetching your video…');
      await expect(submit(page)).toBeDisabled();

      release();
      await expect(statusRegion(page)).toContainText('Could not fetch this video.');
      await expect(submit(page)).toBeEnabled();
      await expect(statusRegion(page)).not.toContainText('Fetching your video…');
    });

    test('the submit button keeps an accessible name while it is icon-only and busy', async ({ page }) => {
      // Regression: the button swapped its label for an unlabelled spinner, leaving
      // screen-reader users with a nameless control mid-request.
      let release: () => void = () => {};
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route('**/api/extract', async (route) => {
        await held;
        await route.fulfill({ status: 200, json: mockResult(platform.key) });
      });

      await page.goto(`/${platform.slug}`);
      await expect(submit(page)).toHaveAccessibleName('Download');

      await box(page, platform.name).fill(platform.urlExample);
      await submit(page).click();

      await expect(submit(page)).toHaveAccessibleName('Fetching your video');
      await expect(submit(page)).toHaveAttribute('aria-busy', 'true');

      release();
      await expect(page.getByText('A stable test video')).toBeVisible();
      await expect(submit(page)).toHaveAccessibleName('Download');
      await expect(submit(page)).toHaveAttribute('aria-busy', 'false');
    });

    test('the submit button is disabled while a request is in flight', async ({ page }) => {
      let calls = 0;
      let release: () => void = () => {};
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route('**/api/extract', async (route) => {
        calls++;
        await held;
        await route.fulfill({ status: 200, json: mockResult(platform.key) });
      });

      await page.goto(`/${platform.slug}`);
      await box(page, platform.name).fill(platform.urlExample);
      await submit(page).click();
      await expect(submit(page)).toBeDisabled();

      // A real second click is refused by the disabled button, so no second call.
      await submit(page).click({ timeout: 1_000 }).catch(() => undefined);
      expect(calls).toBe(1);

      release();
      await expect(page.getByText('A stable test video')).toBeVisible();
    });

    test('a successful result renders the thumbnail, title and a working quality menu', async ({ page }) => {
      await page.route('**/api/extract', (route) => route.fulfill({ status: 200, json: mockResult(platform.key) }));

      await page.goto(`/${platform.slug}`);
      await box(page, platform.name).fill(platform.urlExample);
      await submit(page).click();

      await expect(page.getByText('A stable test video')).toBeVisible();
      await expect(page.getByRole('img', { name: 'A stable test video' })).toBeVisible();

      const primary = page.getByRole('link', { name: /Download HD 1080p/ });
      await expect(primary).toBeVisible();
      // The link must resolve to a real download target, not "#" or javascript:.
      const href = await primary.getAttribute('href');
      expect(href).toMatch(/^(https:\/\/|\/api\/download\?)/);

      await expect(page.getByRole('link', { name: 'HD 720p · MP4' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Audio · MP3' })).toBeVisible();
    });

    test('an engine error surfaces the typed message and never a raw 500 page', async ({ page }) => {
      await page.route('**/api/extract', (route) =>
        route.fulfill({
          status: 404,
          json: { error: 'This video is private, removed, age-restricted, or region-locked.' },
        }),
      );

      await page.goto(`/${platform.slug}`);
      await box(page, platform.name).fill(platform.urlExample);
      await submit(page).click();

      await expect(statusRegion(page)).toContainText('This video is private, removed');
      await expect(box(page, platform.name)).toBeVisible(); // the form survives the error
    });

    test('a network failure degrades to a friendly message, not an unhandled rejection', async ({ page }) => {
      await page.route('**/api/extract', (route) => route.abort('connectionrefused'));

      await page.goto(`/${platform.slug}`);
      await box(page, platform.name).fill(platform.urlExample);
      await submit(page).click();

      await expect(statusRegion(page)).toContainText('Network error.');
    });

    test('a very long title does not break the layout or scroll the page sideways', async ({ page }) => {
      await page.route('**/api/extract', (route) =>
        route.fulfill({ status: 200, json: { ...mockResult(platform.key), title: 'Very '.repeat(200) + 'long title' } }),
      );

      await page.goto(`/${platform.slug}`);
      await box(page, platform.name).fill(platform.urlExample);
      await submit(page).click();
      await expect(page.getByRole('link', { name: /Download HD 1080p/ })).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  });
}

test.describe('site-wide invariants', () => {
  test('the sitemap lists every platform tool route', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    const xml = await res.text();
    for (const platform of PLATFORM_LIST) {
      expect(xml).toContain(`/${platform.slug}`);
    }
  });

  test('the health endpoint reports which engine backend is live', async ({ request }) => {
    const res = await request.get('/api/health');
    const body = (await res.json()) as { status: string; engineMode: string };
    expect(['api', 'remote', 'local']).toContain(body.engineMode);
  });

  test('the home box auto-detects each platform from a pasted link', async ({ page }) => {
    await page.goto('/');
    const input = page.getByLabel('Video URL');
    // The detected platform's glyph replaces the neutral dot; PlatformIcon paints
    // it with that platform's brandColor, which is the only observable signal.
    const glyph = page.locator('form svg[viewBox="0 0 24 24"]').first();

    for (const platform of PLATFORM_LIST) {
      await input.fill(platform.urlExample);
      await expect(glyph).toHaveAttribute('fill', platform.brandColor);
    }

    // Unsupported link → the neutral dot, not a brand glyph. (Counting svgs would
    // not work: the Clear button renders its own 24×24 icon whenever the field
    // has text.)
    await input.fill('https://example.com/not-supported');
    await expect(page.locator('form span.bg-ink-faint.rounded-full')).toHaveCount(1);
  });

  test('an unsupported link on the home box is refused before any network call', async ({ page }) => {
    let called = false;
    await page.route('**/api/extract', (route) => {
      called = true;
      return route.fulfill({ status: 200, json: mockResult('youtube') });
    });

    await page.goto('/');
    await page.getByLabel('Video URL').fill('https://example.com/some/video');
    await page.locator('form button[type="submit"]').click();

    // Scoped to DownloaderBox's own status region — the homepage's tool
    // directory grid also has an aria-live region (announcing filter changes),
    // so an unscoped [aria-live="polite"] locator matches both.
    const status = page.locator('form').locator('xpath=..').locator('[aria-live="polite"]');
    await expect(status).toContainText('not from a supported platform');
    expect(called).toBe(false);
  });

  test('/api/extract rejects a non-whitelisted host over real HTTP', async ({ request }) => {
    const res = await request.post('/api/extract', {
      data: { url: 'https://pinterest.169.254.169.254.nip.io/pin/1/', platform: 'pinterest' },
    });
    expect(res.status()).toBe(400);
    expect(await res.json()).toEqual({ error: 'That does not look like a valid Pinterest link.' });
  });

  test('/api/download does not crash on a prototype-chain platform value', async ({ request }) => {
    const res = await request.get('/api/download?u=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dx&p=__proto__&q=720');
    expect(res.status()).toBe(400);
    expect(await res.json()).toEqual({ error: 'Unsupported platform.' });
  });
});

function mockResult(platformKey: string) {
  return {
    platform: platformKey,
    sourceUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    title: 'A stable test video',
    thumbnail: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg',
    duration: 635,
    options: [
      { quality: '1080', label: 'HD 1080p · MP4', kind: 'video' },
      { quality: '720', label: 'HD 720p · MP4', kind: 'video' },
      { quality: 'audio', label: 'Audio · MP3', kind: 'audio' },
    ],
  };
}
