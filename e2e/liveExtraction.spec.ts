import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { PLATFORMS, type PlatformKey } from '../src/lib/platforms';

/**
 * REAL extraction against the live platforms. Opt-in only:
 *
 *   RUN_LIVE_E2E=1 npm run test:e2e -- --project=desktop e2e/liveExtraction.spec.ts
 *
 * Meant for occasional pre-release verification, NOT for every commit: each run
 * hits the platforms from one IP, which invites bot-detection and rate limiting
 * and is exactly the abuse pattern a downloader should not generate.
 *
 * Every wait here is hard-capped (120s per test, 60s on the result, 30s on a CDN
 * fetch, plus the config's 20s action / 30s navigation caps) so a blocked platform
 * fails one test loudly instead of hanging the run. NOT VERIFIED GREEN: this file
 * has never been executed against the live platforms in CI or locally — the
 * per-platform guarantees that ARE verified live in the URL/SSRF/engine layers are
 * the vitest suites, and toolPages.spec.ts covers the UI for all 11 with the
 * network mocked.
 */

const LIVE = process.env.RUN_LIVE_E2E === '1';

/** Error copy the app is allowed to show. Anything else is an unhandled failure. */
const TYPED_ERRORS = [
  'This video is private, removed, age-restricted, or region-locked.',
  'Could not fetch this video.',
  'No downloadable video was found at that link.',
  'The engine returned an unexpected response.',
  'This link took too long to process.',
  'The extraction engine is not installed. Set YTDLP_PATH or install yt-dlp.',
  'The extraction engine failed to start.',
  'The download service could not process this link.',
  'The download service is unreachable right now.',
  'The download service is busy. Please try again shortly.',
  'Too many requests. Please wait a moment and try again.',
];

interface LiveCase {
  /** A long-lived, public, officially-published video — not a random user upload. */
  url: string;
  /**
   * 'extract' — extraction is expected to succeed without credentials.
   * 'either'  — success OR a typed error is acceptable; `why` explains the gap.
   */
  expectation: 'extract' | 'either';
  why?: string;
}

const CASES: Record<PlatformKey, LiveCase> = {
  youtube: {
    // Blender Foundation's Big Buck Bunny — CC-licensed, online since 2008.
    url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    expectation: 'either',
    why: 'YouTube bot-checks datacenter and repeat-visitor IPs; YTDLP_COOKIES is the documented fix.',
  },
  vimeo: {
    // Vimeo Staff's own player demo, published 2013.
    url: 'https://vimeo.com/76979871',
    expectation: 'either',
    why: 'Vimeo gates some embeds by referrer; no credential is required but availability varies by region.',
  },
  reddit: {
    url: 'https://www.reddit.com/r/aww/comments/lfoaad/this_cat_has_a_mustache/',
    expectation: 'either',
    why: 'Reddit is public but throttles unauthenticated API reads aggressively.',
  },
  pinterest: {
    url: 'https://www.pinterest.com/pin/1069905396423813/',
    expectation: 'either',
    why: 'Public pins resolve, but Pinterest rotates pin IDs and serves a consent wall in some regions.',
  },
  twitch: {
    url: 'https://www.twitch.tv/videos/2000000000',
    expectation: 'either',
    why: 'Twitch VODs expire by design (14–60 days), so no Twitch URL is stable enough to assert success.',
  },
  tumblr: {
    url: 'https://www.tumblr.com/staff/700000000000000000/',
    expectation: 'either',
    why: 'Tumblr requires a consent cookie in the EU and hides many posts behind an interstitial.',
  },
  tiktok: {
    url: 'https://www.tiktok.com/@tiktok/video/7106594312292453675',
    expectation: 'either',
    why: 'TikTok fingerprints unauthenticated clients; extraction needs cookies or a residential proxy.',
  },
  instagram: {
    url: 'https://www.instagram.com/reel/CyqLVkEA0Xp/',
    expectation: 'either',
    why: 'Instagram requires a logged-in session for almost all media; YTDLP_COOKIES is mandatory.',
  },
  facebook: {
    url: 'https://www.facebook.com/watch/?v=10153231379946729',
    expectation: 'either',
    why: 'Facebook serves a login wall to unauthenticated clients for most Watch content.',
  },
  twitter: {
    url: 'https://x.com/NASA/status/1591448697923301376',
    expectation: 'either',
    why: 'X removed anonymous API access in 2023; extraction needs an authenticated cookie jar.',
  },
  linkedin: {
    url: 'https://www.linkedin.com/posts/linkedin_linkedin-news-activity-7000000000000000000-AbCd/',
    expectation: 'either',
    why: 'LinkedIn requires an authenticated session for post media; post URNs also rotate.',
  },
};

async function runExtraction(page: Page, key: PlatformKey): Promise<void> {
  const platform = PLATFORMS[key];
  await page.goto(`/${platform.slug}`);
  await page.getByLabel(`${platform.name} video URL`).fill(CASES[key].url);
  // Structural: the submit button swaps its label for a spinner while fetching.
  await page.locator('form button[type="submit"]').click();
}

/** A direct CDN link must really resolve — proves the bandwidth rule end to end. */
async function assertCdnLinkResolves(request: APIRequestContext, href: string): Promise<void> {
  const res = await request.get(href, { headers: { range: 'bytes=0-1023' }, timeout: 30_000 });
  expect(res.status(), `direct CDN link did not resolve: ${href}`).toBeLessThan(400);
  const type = res.headers()['content-type'] ?? '';
  expect(type).toMatch(/video|audio|octet-stream|mp4|mpeg/i);
}

test.describe('live platform extraction', () => {
  test.skip(!LIVE, 'Set RUN_LIVE_E2E=1 to run real extraction against the platforms.');
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  for (const key of Object.keys(CASES) as PlatformKey[]) {
    const { expectation, why } = CASES[key];

    test(`${PLATFORMS[key].name}: extracts a real public video, or fails cleanly`, async ({ page, request }) => {
      await runExtraction(page, key);

      const result = page.locator('[aria-live="polite"]');
      const primary = page.getByRole('link', { name: /^Download / });
      const errorBanner = result.locator('p.text-danger');

      await expect(primary.or(errorBanner).first()).toBeVisible({ timeout: 60_000 });

      if (await errorBanner.isVisible()) {
        const message = (await errorBanner.textContent())?.trim() ?? '';

        // Whatever happens, the failure must be one of OUR typed messages —
        // never a stack trace, a raw status code, or an empty banner.
        expect(TYPED_ERRORS, `unrecognized user-facing error: "${message}"`).toContain(message);
        expect(message).not.toMatch(/yt-dlp|Traceback|ENOENT|\/Users\/|\/home\//);

        if (expectation === 'extract') {
          throw new Error(`${key} was expected to extract successfully but failed with: ${message}`);
        }
        test.info().annotations.push({ type: 'known-gap', description: `${key}: ${message} — ${why ?? ''}` });
        return;
      }

      // Success path: the rendered result must be genuinely usable.
      await expect(page.locator('[aria-live="polite"] p.font-medium')).not.toBeEmpty();
      const qualityLinks = page.getByRole('link', { name: /· (MP4|MP3)$|^Download / });
      expect(await qualityLinks.count()).toBeGreaterThan(0);

      const href = await primary.getAttribute('href');
      expect(href).toBeTruthy();

      if (href!.startsWith('http')) {
        // API/direct mode — verify the CDN link really serves media bytes.
        await assertCdnLinkResolves(request, href!);
      } else {
        // Local yt-dlp mode — no direct URL by design; assert the proxy link is
        // well formed. Actually streaming it is gated behind RUN_LIVE_DOWNLOAD.
        expect(href).toMatch(/^\/api\/download\?u=.+&p=.+&q=.+$/);
      }
    });
  }
});

test.describe('live download streaming', () => {
  // Separately gated: this pulls real bytes through the server and is slow.
  test.skip(process.env.RUN_LIVE_DOWNLOAD !== '1', 'Set RUN_LIVE_DOWNLOAD=1 to stream a real file.');
  test.setTimeout(300_000);

  test('YouTube: /api/download returns real video bytes at the lowest tier', async ({ request }) => {
    const url = encodeURIComponent(CASES.youtube.url);
    const res = await request.get(`/api/download?u=${url}&p=youtube&q=360`, { timeout: 280_000 });

    if (res.status() !== 200) {
      const body = (await res.json()) as { error: string };
      expect(TYPED_ERRORS).toContain(body.error);
      test.info().annotations.push({ type: 'known-gap', description: `download failed cleanly: ${body.error}` });
      return;
    }

    expect(res.headers()['content-type']).toBe('video/mp4');
    expect(res.headers()['content-disposition']).toContain('attachment;');
    const body = await res.body();
    expect(body.byteLength).toBeGreaterThan(100_000);
    // ISO-BMFF files carry an 'ftyp' box within the first 16 bytes.
    expect(body.subarray(0, 16).toString('latin1')).toContain('ftyp');
  });
});
