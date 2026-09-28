import { test, expect, type Page, type Route } from '@playwright/test';
import { AI_TOOL_LIST } from '../src/lib/aiTools';

/**
 * /video-to-text and /video-summary in a real browser. Provider keys are absent
 * in CI, so the API is stubbed at the network boundary with the exact response
 * shapes the route handlers are pinned to in test/aiRoutes.test.ts.
 */

// Needs per-tool fixtures (API route, button label, "not configured" copy) the
// registry doesn't carry, so it can't be auto-derived from AI_TOOL_LIST — the
// guard test below just makes a forgotten entry a loud failure, not a silent gap.
const TOOLS = [
  {
    path: '/video-to-text',
    api: '**/api/ai/transcribe',
    submit: 'Get transcript',
    h1: 'Video to text — free transcript & subtitle generator',
    notConfigured: 'AI transcription is coming soon — it is not enabled on this server yet.',
  },
  {
    path: '/video-summary',
    api: '**/api/ai/summary',
    submit: 'Summarize',
    h1: 'AI video summary — get the gist in seconds',
    notConfigured: 'AI summaries are coming soon — they are not enabled on this server yet.',
  },
] as const;

test('every AI_TOOL_LIST entry has a matching fixture in TOOLS above', () => {
  const covered = new Set(TOOLS.map((t) => t.path));
  const missing = AI_TOOL_LIST.filter((t) => !covered.has(`/${t.slug}`));
  expect(missing.map((t) => t.slug), 'Add a TOOLS entry for each new AI tool.').toEqual([]);
});

const VALID_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

const TRANSCRIPT_BODY = {
  text: 'Hello world, this is the video.',
  srt: '1\n00:00:00,000 --> 00:00:02,000\nHello world,\n',
  vtt: 'WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nHello world,\n',
  language: 'en',
  provider: 'groq',
};

const SUMMARY_BODY = {
  summary: 'A senior editor overview of the clip.',
  points: ['First takeaway', 'Second takeaway'],
  provider: 'groq',
};

function stubApi(page: Page, pattern: string, status: number, body: unknown, delayMs = 0) {
  return page.route(pattern, async (route: Route) => {
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

async function submit(page: Page, label: string, url: string) {
  await page.getByLabel('Video URL').fill(url);
  await page.getByRole('button', { name: label, exact: true }).click();
}

/** The static page copy repeats phrases like "Key points", so results are scoped to their card. */
function resultCard(page: Page, containing: string) {
  return page.locator('div.card').filter({ hasText: containing }).last();
}

/**
 * Every status message is mirrored into an sr-only live region, so it renders
 * twice on purpose. The region is matched by tag because Next's dev-mode toast
 * also carries role="status".
 */
async function expectMessage(page: Page, text: string) {
  await expect(page.locator('p[role="status"][aria-live="polite"]')).toHaveText(text);
  await expect(page.getByText(text).last()).toBeVisible();
}

for (const tool of TOOLS) {
  test.describe(tool.path, () => {
    test('renders one H1, a canonical link and parseable JSON-LD', async ({ page }) => {
      await page.goto(tool.path);

      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveText(tool.h1);

      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveCount(1);
      expect(await canonical.getAttribute('href')).toContain(tool.path);

      const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
      expect(blocks.length).toBeGreaterThanOrEqual(3);
      const types = blocks.map((raw) => (JSON.parse(raw) as { '@type': string })['@type']);
      expect(types).toEqual(expect.arrayContaining(['WebApplication', 'FAQPage', 'HowTo', 'BreadcrumbList']));
    });

    test('rejects an empty and an unsupported link client-side, without calling the API', async ({ page }) => {
      let apiCalls = 0;
      await page.route(tool.api, async (route: Route) => {
        apiCalls++;
        await route.fulfill({ status: 200, body: '{}' });
      });
      await page.goto(tool.path);

      await page.getByRole('button', { name: tool.submit, exact: true }).click();
      await expectMessage(page, 'Paste a video link to get started.');

      await submit(page, tool.submit, 'https://example.com/not-supported');
      await expectMessage(page, 'That link is not from a supported platform.');

      expect(apiCalls).toBe(0);
    });

    test('shows the "launching soon" panel — not a crash — when the server has no AI keys', async ({ page }) => {
      await stubApi(page, tool.api, 503, { error: tool.notConfigured, code: 'not_configured' });
      await page.goto(tool.path);
      await submit(page, tool.submit, VALID_URL);

      await expect(page.getByText('Launching soon')).toBeVisible();
      await expectMessage(page, tool.notConfigured);
      await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);
      await expect(page.locator('body')).not.toContainText('at Object.');
    });

    test('shows a retryable error for a provider failure and surfaces no internals', async ({ page }) => {
      await stubApi(page, tool.api, 502, {
        error: 'The AI service is busy. Please try again shortly.',
        code: 'provider_failed',
      });
      await page.goto(tool.path);
      await submit(page, tool.submit, VALID_URL);

      await expectMessage(page, 'The AI service is busy. Please try again shortly.');
      await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
      const body = await page.locator('body').innerText();
      expect(body).not.toMatch(/gsk_|AIza|\/src\/lib\/|node_modules/);
    });

    test('shows the rate-limit message on 429', async ({ page }) => {
      await stubApi(page, tool.api, 429, { error: 'Too many requests. Please wait a moment and try again.' });
      await page.goto(tool.path);
      await submit(page, tool.submit, VALID_URL);
      await expectMessage(page, 'Too many requests. Please wait a moment and try again.');
    });

    test('runs idle → working → ready with a disabled submit while in flight', async ({ page }) => {
      const body = tool.path === '/video-to-text' ? TRANSCRIPT_BODY : SUMMARY_BODY;
      await stubApi(page, tool.api, 200, body, 4000);
      await page.goto(tool.path);

      // Matched by role, not label: the button's content becomes a spinner while working.
      const button = page.locator('form button[type="submit"]');
      await expect(button).toBeEnabled();
      await submit(page, tool.submit, VALID_URL);

      // Double-submit guard first: it has to hold for the whole in-flight window.
      await expect(button).toBeDisabled();
      await expect(page.getByRole('progressbar', { name: 'Processing progress' })).toBeVisible();
      await expect(page.getByText('Fetching audio')).toBeVisible();

      await expect(page.getByRole('progressbar', { name: 'Processing progress' })).toHaveCount(0);
      await expect(button).toBeEnabled();
    });
  });
}

test.describe('/video-to-text results', () => {
  test('renders the transcript with its stats and downloads a real SRT file', async ({ page }) => {
    await stubApi(page, '**/api/ai/transcribe', 200, TRANSCRIPT_BODY);
    await page.goto('/video-to-text');
    await submit(page, 'Get transcript', VALID_URL);

    const card = resultCard(page, TRANSCRIPT_BODY.text);
    await expect(page.getByRole('region', { name: 'Transcript text' })).toContainText(TRANSCRIPT_BODY.text);
    await expect(card.getByText('6 words')).toBeVisible();
    await expect(card.getByText('1 segments')).toBeVisible();
    await expect(card.getByText('English', { exact: true })).toBeVisible();

    const download = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: '.SRT' }).click(),
    ]).then(([event]) => event);

    expect(download.suggestedFilename()).toBe('subtitles.srt');
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString('utf-8')).toBe(TRANSCRIPT_BODY.srt);
  });

  test('sends translate mode when the checkbox is ticked', async ({ page }) => {
    const modes: string[] = [];
    await page.route('**/api/ai/transcribe', async (route: Route) => {
      const payload = route.request().postDataJSON() as { mode?: string };
      modes.push(payload.mode ?? 'missing');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TRANSCRIPT_BODY) });
    });
    await page.goto('/video-to-text');

    await page.getByLabel('Translate to English').check();
    await submit(page, 'Get transcript', VALID_URL);
    await expect(page.getByRole('region', { name: 'Transcript text' })).toBeVisible();
    expect(modes).toEqual(['translate']);
  });
});

test.describe('/video-summary results', () => {
  test('renders the overview and every key point', async ({ page }) => {
    await stubApi(page, '**/api/ai/summary', 200, SUMMARY_BODY);
    await page.goto('/video-summary');
    await submit(page, 'Summarize', VALID_URL);

    const card = resultCard(page, SUMMARY_BODY.summary);
    await expect(card.getByRole('heading', { name: 'Summary' })).toBeVisible();
    await expect(card.getByText(SUMMARY_BODY.summary)).toBeVisible();
    for (const point of SUMMARY_BODY.points) await expect(card.getByText(point)).toBeVisible();
    await expect(card.getByRole('heading', { name: 'Key points' })).toBeVisible();
  });

  test('renders without a key-points section when the model returns none', async ({ page }) => {
    await stubApi(page, '**/api/ai/summary', 200, { summary: 'Just an overview.', points: [], provider: 'gemini' });
    await page.goto('/video-summary');
    await submit(page, 'Summarize', VALID_URL);

    const card = resultCard(page, 'Just an overview.');
    await expect(card.getByText('Just an overview.')).toBeVisible();
    await expect(card.getByRole('heading', { name: 'Key points' })).toHaveCount(0);
  });
});
