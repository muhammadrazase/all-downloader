import { test, expect } from '@playwright/test';
import { PLATFORM_LIST } from '../src/lib/platforms';
import { AI_TOOL_LIST } from '../src/lib/aiTools';
import { CONVERTER_LIST } from '../src/lib/converterTools';
import { IMAGE_TOOL_LIST } from '../src/lib/imageTools';
import { PDF_TOOL_LIST } from '../src/lib/pdfTools';
import { FILE_TOOL_LIST } from '../src/lib/fileTools';

/**
 * Registry-driven smoke test for EVERY tool page — auto-discovers a tool the moment
 * it's added to any registry below, with zero code change needed here. This is the
 * baseline every tool gets for free; deep functional coverage (real conversions,
 * OCR, PDF output, etc.) lives in the per-category specs alongside this file.
 */

interface ToolPage {
  category: string;
  slug: string;
  name: string;
  h1: string;
}

const ALL_TOOLS: ToolPage[] = [
  ...PLATFORM_LIST.map((t) => ({ category: 'Downloader', slug: t.slug, name: t.name, h1: t.h1 })),
  ...AI_TOOL_LIST.map((t) => ({ category: 'AI Tool', slug: t.slug, name: t.name, h1: t.h1 })),
  ...CONVERTER_LIST.map((t) => ({ category: 'Converter', slug: t.slug, name: t.name, h1: t.h1 })),
  ...IMAGE_TOOL_LIST.map((t) => ({ category: 'Thumbnail Grabber', slug: t.slug, name: t.name, h1: t.h1 })),
  ...PDF_TOOL_LIST.map((t) => ({ category: 'PDF Tool', slug: t.slug, name: t.name, h1: t.h1 })),
  ...FILE_TOOL_LIST.map((t) => ({ category: 'File Tool', slug: t.slug, name: t.name, h1: t.h1 })),
];

// Bump this whenever a tool is added to/removed from ANY registry above, and update
// the tool list + count in CLAUDE.md to match. This turns forgetting that update
// into a loud, named test failure instead of a silent drift between docs and code.
const EXPECTED_TOOL_COUNT = 41;

test(`registered tool count matches CLAUDE.md (currently ${EXPECTED_TOOL_COUNT})`, () => {
  expect(
    ALL_TOOLS.length,
    `Found ${ALL_TOOLS.length} tools but CLAUDE.md/EXPECTED_TOOL_COUNT says ${EXPECTED_TOOL_COUNT}. ` +
      'A tool was added or removed — update EXPECTED_TOOL_COUNT here AND the tool inventory in CLAUDE.md.',
  ).toBe(EXPECTED_TOOL_COUNT);
});

for (const tool of ALL_TOOLS) {
  test(`[${tool.category}] /${tool.slug} — "${tool.name}" loads cleanly, desktop + mobile`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(`console: ${m.text()}`);
    });

    const response = await page.goto(`/${tool.slug}`, { waitUntil: 'networkidle' });
    expect(response?.status(), `GET /${tool.slug} should return 200`).toBe(200);

    const h1 = page.locator('h1');
    await expect(h1, `/${tool.slug} should render exactly one H1`).toHaveCount(1);
    await expect(h1, `/${tool.slug}'s H1 should match its registry entry`).toHaveText(tool.h1);

    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical, `/${tool.slug} should have exactly one canonical link`).toHaveCount(1);
    expect(await canonical.getAttribute('href'), `/${tool.slug}'s canonical href looks wrong`).toContain(`/${tool.slug}`);

    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(blocks.length, `/${tool.slug} should emit at least one JSON-LD block`).toBeGreaterThan(0);
    blocks.forEach((raw, i) => {
      expect(() => JSON.parse(raw), `/${tool.slug} JSON-LD block #${i} does not parse: ${raw.slice(0, 200)}`).not.toThrow();
    });

    // Reuse the already-loaded page for the mobile check — no second navigation needed.
    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `/${tool.slug} overflows horizontally by ${overflow}px at 390px wide`).toBeLessThanOrEqual(1);

    expect(errors, `/${tool.slug} ("${tool.name}") logged console/page errors:\n${errors.join('\n')}`).toEqual([]);
  });
}
