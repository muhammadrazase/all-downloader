import { test, expect, type Page } from '@playwright/test';
import { FIXTURES, pickFile } from './helpers/media';
import { CONVERTER_LIST } from '../src/lib/converterTools';

const CONVERTER_ROUTES = CONVERTER_LIST.map((t) => `/${t.slug}`);

function trackRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (req) => urls.push(req.url()));
  return urls;
}

const isFfmpegAsset = (url: string) => /ffmpeg/i.test(new URL(url).pathname);

test.describe('ffmpeg.wasm stays page-scoped and lazy (performance budget)', () => {
  test('the homepage loads no ffmpeg asset or chunk at all', async ({ page }) => {
    const urls = trackRequests(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    expect(urls.filter(isFfmpegAsset)).toEqual([]);
  });

  for (const route of CONVERTER_ROUTES) {
    test(`${route} does not fetch the 32 MB core until the user actually converts`, async ({ page }) => {
      const urls = trackRequests(page);
      await page.goto(route, { waitUntil: 'networkidle' });
      expect(urls.filter((url) => url.includes('/ffmpeg/'))).toEqual([]);

      await pickFile(page, FIXTURES.clip1080p);
      expect(urls.filter((url) => url.includes('/ffmpeg/'))).toEqual([]);
    });
  }

  test('the core is fetched from our own origin, never a third-party CDN', async ({ page }) => {
    const urls = trackRequests(page);
    await page.goto('/video-to-mp3');
    await pickFile(page, FIXTURES.clip1080p);
    await page.getByRole('button', { name: /^Convert to / }).click();

    await expect.poll(() => urls.some((url) => url.endsWith('/ffmpeg/ffmpeg-core.wasm')), { timeout: 60_000 }).toBe(true);
    const origin = new URL(page.url()).origin;
    for (const url of urls.filter((u) => u.includes('/ffmpeg/'))) expect(new URL(url).origin).toBe(origin);
    expect(urls.some((url) => url.endsWith('/ffmpeg/ffmpeg-core.js'))).toBe(true);
  });

  test('the self-hosted core assets are actually served (postinstall copy step ran)', async ({ request }) => {
    for (const [asset, type] of [
      ['/ffmpeg/ffmpeg-core.js', /javascript/],
      ['/ffmpeg/ffmpeg-core.wasm', /wasm|octet-stream/],
    ] as const) {
      const response = await request.get(asset);
      expect(response.status(), `${asset} must be served`).toBe(200);
      expect(response.headers()['content-type']).toMatch(type);
    }
  });
});

test.describe('converter page SEO invariants', () => {
  for (const route of CONVERTER_ROUTES) {
    test(`${route} has exactly one H1, a canonical link, and JSON-LD that parses`, async ({ page }) => {
      await page.goto(route);

      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).not.toBeEmpty();

      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveCount(1);
      expect(await canonical.getAttribute('href')).toContain(route);

      const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
      expect(blocks.length).toBeGreaterThanOrEqual(4);
      const types = blocks.map((raw) => (JSON.parse(raw) as { '@type': string })['@type']);
      expect(types).toEqual(expect.arrayContaining(['WebApplication', 'FAQPage', 'HowTo', 'BreadcrumbList']));
    });

    test(`${route} states the privacy promise the engine actually keeps`, async ({ page }) => {
      await page.goto(route);
      // "leave"/"leaves" — video-watermark and video-merger correctly use the
      // plural verb form ("your video and logo never leave...", "your files
      // never leave...") since their subject is plural, unlike the other
      // converters' singular "your file never leaves...".
      await expect(page.getByText(/never leaves? your device/i).first()).toBeVisible();
    });
  }
});
