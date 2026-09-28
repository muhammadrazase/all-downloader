import { test, expect } from '@playwright/test';
import {
  PDFS,
  exportEditor,
  openEditor,
  overlayBoxes,
  overlayGeometry,
  pickPdf,
  readDownload,
  readPdf,
  waitForPageAspect,
} from './helpers/pdf';

/**
 * Everything here runs the real @cantoo/pdf-lib and pdf.js in Chromium against real
 * PDFs, and reads the produced bytes back with pdf.js in Node. Each `regression:`
 * test below pins a bug that actually shipped and was reproduced in a browser first.
 */
test.beforeEach(() => {
  test.setTimeout(90_000);
});

const errorBanner = 'p.text-danger';

test.describe('/merge-pdf', () => {
  test('merges several documents in order, preserving each page size', async ({ page }) => {
    await page.goto('/merge-pdf');
    await pickPdf(page, PDFS.singlePage, PDFS.multiPage10);
    await expect(page.locator('ol li[draggable="true"]')).toHaveCount(2);

    await page.getByRole('button', { name: 'Merge PDFs' }).click();
    const pages = await readPdf(await readDownload(page, /Download merged\.pdf/));

    expect(pages).toHaveLength(11);
    expect(pages[0]!.items.map((i) => i.str).join(' ')).toContain('Single page fixture');
    expect(pages[1]!.items.map((i) => i.str).join(' ')).toContain('Page 1 of 10');
    expect(pages[10]!.items.map((i) => i.str).join(' ')).toContain('Page 10 of 10');
  });

  // regression: one unreadable file used to reject the whole drop, and a corrupt PDF
  // that slipped through failed the merge with a message that never named the file.
  test('keeps the readable files and names each one it rejects', async ({ page }) => {
    await page.goto('/merge-pdf');
    await pickPdf(page, PDFS.singlePage, PDFS.multiPage10, PDFS.zeroByte);

    await expect(page.locator(errorBanner)).toContainText('zero-byte.pdf');
    await expect(page.locator('ol li[draggable="true"]')).toHaveCount(2);
    await expect(page.getByLabel('Choose PDF files to merge')).toContainText('2 files added · 11 pages total');

    // The good files must still merge without the user having to start over.
    await page.getByRole('button', { name: 'Merge PDFs' }).click();
    expect(await readPdf(await readDownload(page, /Download merged\.pdf/))).toHaveLength(11);
  });

  test('shows each file\'s page count so the result is predictable before merging', async ({ page }) => {
    await page.goto('/merge-pdf');
    await pickPdf(page, PDFS.multiPage10);
    await expect(page.locator('ol li[draggable="true"]').first()).toContainText('10 pages');
  });

  // regression: the page copy promised drag-to-reorder; only arrow buttons existed.
  test('reorders by dragging, and the merged file follows that order', async ({ page }) => {
    test.skip(test.info().project.name === 'mobile', 'HTML drag-and-drop is a pointer-device affordance');
    await page.goto('/merge-pdf');
    await pickPdf(page, PDFS.singlePage, PDFS.multiPage10);

    const rows = page.locator('ol li[draggable="true"]');
    await rows.nth(1).dragTo(rows.nth(0));
    await expect(rows.first()).toContainText('multi-page-10.pdf');

    await page.getByRole('button', { name: 'Merge PDFs' }).click();
    const pages = await readPdf(await readDownload(page, /Download merged\.pdf/));
    expect(pages[0]!.items.map((i) => i.str).join(' ')).toContain('Page 1 of 10');
  });
});

test.describe('/split-pdf', () => {
  test('splits each range into its own file', async ({ page }) => {
    await page.goto('/split-pdf');
    await pickPdf(page, PDFS.multiPage10);
    await page.locator('#pdf-page-ranges').fill('1-3, 5, 8-10');
    await expect(page.locator('#pdf-page-ranges ~ [aria-live=polite]')).toContainText('3 files, 7 pages');

    await page.getByRole('button', { name: 'Split PDF' }).click();
    await expect(page.getByRole('link', { name: /^Download / })).toHaveCount(3);

    const first = await readPdf(await readDownload(page, /multi-page-10-part-1\.pdf/));
    expect(first).toHaveLength(3);
    expect(first[0]!.items.map((i) => i.str).join(' ')).toContain('Page 1 of 10');
  });

  // regression: "1 - 3" (the spacing people paste) was rejected as malformed.
  test('accepts the spacing people paste, and explains a backwards range honestly', async ({ page }) => {
    await page.goto('/split-pdf');
    await pickPdf(page, PDFS.multiPage10);
    const spec = page.locator('#pdf-page-ranges');
    const preview = page.locator('#pdf-page-ranges ~ [aria-live=polite]');

    await spec.fill('1 - 3');
    await expect(preview).toContainText('1 file, 3 pages');

    await spec.fill('3-1');
    await expect(preview).toContainText('runs backwards');
    await expect(page.getByRole('button', { name: 'Split PDF' })).toBeDisabled();

    await spec.fill('0');
    await expect(preview).toContainText('out of range');
  });

  // regression: after a split, editing the range left the previous download buttons
  // on screen — they no longer matched the range the page was showing.
  test('withdraws previous downloads as soon as the range or mode changes', async ({ page }) => {
    await page.goto('/split-pdf');
    await pickPdf(page, PDFS.multiPage10);
    await page.locator('#pdf-page-ranges').fill('1-3');
    await page.getByRole('button', { name: 'Split PDF' }).click();
    await expect(page.getByRole('link', { name: /^Download / })).toHaveCount(1);

    await page.locator('#pdf-page-ranges').fill('4-6');
    await expect(page.getByRole('link', { name: /^Download / })).toHaveCount(0);
  });

  // regression: a corrupt PDF left the action button enabled; clicking it did nothing at all.
  test('disables the action after an unreadable file rather than going inert', async ({ page }) => {
    await page.goto('/split-pdf');
    await pickPdf(page, PDFS.truncated);
    await expect(page.locator(errorBanner)).toContainText('could not be read');
    await expect(page.getByRole('button', { name: /Split PDF|Reading PDF/ })).toBeDisabled();
  });

  test('splits every page into its own file, named by real page number', async ({ page }) => {
    await page.goto('/split-pdf');
    await pickPdf(page, PDFS.multiPage10);
    await page.locator('fieldset label').filter({ hasText: 'One file per page' }).click();
    // An empty range means the whole document.
    await expect(page.locator('#pdf-page-ranges ~ [aria-live=polite]')).toContainText('10 files, 10 pages');

    await page.getByRole('button', { name: 'Split PDF' }).click();
    await expect(page.getByRole('link', { name: /^Download / })).toHaveCount(10);

    const seventh = await readPdf(await readDownload(page, /multi-page-10-page-7\.pdf/));
    expect(seventh).toHaveLength(1);
    expect(seventh[0]!.items.map((i) => i.str).join(' ')).toContain('Page 7 of 10');
  });

  test('extracts scattered pages into a single new document, in order', async ({ page }) => {
    await page.goto('/split-pdf');
    await pickPdf(page, PDFS.multiPage10);
    await page.locator('fieldset label').filter({ hasText: 'All selected pages in one file' }).click();
    await page.locator('#pdf-page-ranges').fill('2, 7, 9-10');
    await page.getByRole('button', { name: 'Split PDF' }).click();

    const pages = await readPdf(await readDownload(page, /multi-page-10-selected\.pdf/));
    expect(pages.map((p) => p.items.map((i) => i.str).join(' ').trim())).toEqual([
      'Page 2 of 10',
      'Page 7 of 10',
      'Page 9 of 10',
      'Page 10 of 10',
    ]);
  });
});

test.describe('/pdf-editor', () => {
  test('adds text that is really in the exported file, where the user put it', async ({ page }) => {
    await openEditor(page, PDFS.singlePage);
    await page.getByRole('button', { name: '+ Text' }).click();
    await page.locator('textarea').fill('Added by the editor');

    const before = await overlayGeometry(page);
    const pages = await readPdf(await exportEditor(page));
    const item = pages[0]!.items.find((i) => i.str.includes('Added by the editor'));
    expect(item).toBeDefined();

    // Device coordinates from pdf.js vs the box the user dragged, both in the same
    // displayed space once the canvas scale is divided out.
    const scale = before.canvas.width / pages[0]!.width;
    expect(item!.x * scale).toBeCloseTo(before.objects[0]!.box.x, 0);
  });

  // regression: the preview drew text at its raw point size while the export drew it
  // at the page's render scale, so exported text was ~1.75x bigger than what the user
  // sized and positioned — and silently overflowed the box they drew.
  test('previews text at the size it will actually export at', async ({ page }) => {
    await openEditor(page, PDFS.singlePage);
    await page.getByRole('button', { name: '+ Text' }).click();
    const probe = 'WWWWWWWWWW';
    await page.locator('textarea').fill(probe);

    const measured = await page.evaluate((text) => {
      const style = getComputedStyle(document.querySelector('textarea')!);
      const context = document.createElement('canvas').getContext('2d')!;
      context.font = `${style.fontSize} ${style.fontFamily}`;
      return {
        widthPx: context.measureText(text).width,
        canvasWidth: document.querySelector('canvas')!.getBoundingClientRect().width,
      };
    }, probe);

    const pages = await readPdf(await exportEditor(page));
    const scale = measured.canvasWidth / pages[0]!.width;
    // The page is fitted to the viewport, so the zoom is never exactly 1:1 — which is
    // precisely why drawing the preview at the raw point size was visibly wrong.
    expect(scale).not.toBeCloseTo(1, 1);

    const item = pages[0]!.items.find((i) => i.str === probe);
    expect(item).toBeDefined();
    // Same string, same family, same nominal size: the exported run scaled back to the
    // editor's zoom must be the width the user was shown, not 1.75x of it.
    expect(item!.width * scale).toBeCloseTo(measured.widthPx, 0);
  });

  // regression: an 18px drag strip lived INSIDE the object's box, so the area the user
  // aligned content in was 18px shorter and 18px lower than the box the export drew into.
  test('the visible content area is exactly the box the export draws into', async ({ page }) => {
    await openEditor(page, PDFS.singlePage);
    await page.getByRole('button', { name: '+ Text' }).click();

    const geometry = await overlayGeometry(page);
    const { box, content } = geometry.objects[0]!;
    expect(content.x).toBeCloseTo(box.x, 1);
    expect(content.y).toBeCloseTo(box.y, 1);
    expect(content.width).toBeCloseTo(box.width, 1);
    expect(content.height).toBeCloseTo(box.height, 1);
  });

  // regression: the colour picker and alignment buttons changed the export but not the
  // preview, so the editor looked broken and the result was a surprise.
  test('colour and alignment changes show up in the preview, not only in the export', async ({ page }) => {
    await openEditor(page, PDFS.singlePage);
    await page.getByRole('button', { name: '+ Text' }).click();
    await page.locator('textarea').fill('Tinted');

    await page.locator('input[type=color]').fill('#e11d48');
    await page.getByRole('button', { name: 'Align center' }).click();

    const style = await page.evaluate(() => {
      const computed = getComputedStyle(document.querySelector('textarea')!);
      return { color: computed.color, textAlign: computed.textAlign };
    });
    expect(style.color).toBe('rgb(225, 29, 72)');
    expect(style.textAlign).toBe('center');
  });

  // regression: on a document with differing page sizes, every overlay was exported at
  // whichever page's scale was current, so page 1's content moved when you looked at page 2.
  test('content stays put on a mixed-page-size document after visiting another page', async ({ page }) => {
    await openEditor(page, PDFS.rotated);
    await page.getByRole('button', { name: '+ Text' }).click();
    await page.locator('textarea').fill('STAYS');
    const placed = await overlayGeometry(page);

    // Page 2 of rotated-pages.pdf is displayed a quarter-turn, i.e. at a different
    // scale. Waiting for it to really render is the point: under the old code that
    // render is exactly what poisoned page 1's already-placed content.
    await page.getByRole('button', { name: '→' }).click();
    await waitForPageAspect(page, 300 / 400); // the quarter-turned page is taller than it is wide

    const pages = await readPdf(await exportEditor(page));
    const item = pages[0]!.items.find((i) => i.str === 'STAYS');
    expect(item).toBeDefined();
    const scale = placed.canvas.width / pages[0]!.width;
    expect(item!.x * scale).toBeCloseTo(placed.objects[0]!.box.x, 0);
  });

  // regression: a /Rotate page is displayed a quarter-turn from its MediaBox, so content
  // placed at the top-left of what the user saw was written to the top-RIGHT, on its side.
  test('places content where the user sees it on a rotated page', async ({ page }) => {
    await openEditor(page, PDFS.rotated);
    await page.getByRole('button', { name: '→' }).click(); // page 2 is /Rotate 90
    await waitForPageAspect(page, 300 / 400); // the quarter-turned page is taller than it is wide
    await page.getByRole('button', { name: '+ Text' }).click();
    await page.locator('textarea').fill('TURNED');

    const placed = await overlayGeometry(page);
    const pages = await readPdf(await exportEditor(page));
    expect(pages[1]!.rotation).toBe(90);

    const item = pages[1]!.items.find((i) => i.str === 'TURNED');
    expect(item).toBeDefined();
    // Displayed coordinates, so this is literally "is it where the user dropped it".
    const scale = placed.canvas.width / pages[1]!.width;
    expect(item!.x * scale).toBeCloseTo(placed.objects[0]!.box.x, 0);
    expect(item!.y * scale).toBeLessThan(placed.canvas.height / 2);
  });

  // regression: after exporting, the download link kept pointing at the old blob, so a
  // user who added one more thing downloaded a file silently missing it.
  test('withdraws the download link once the document changes again', async ({ page }) => {
    await openEditor(page, PDFS.singlePage);
    await page.getByRole('button', { name: '+ Text' }).click();
    await page.locator('textarea').fill('First');
    await page.getByRole('button', { name: 'Export PDF' }).click();
    await expect(page.getByRole('link', { name: /Download edited\.pdf/ })).toBeVisible();

    await page.getByRole('button', { name: '+ Text' }).click();
    await expect(page.getByRole('link', { name: /Download edited\.pdf/ })).toHaveCount(0);

    // Re-exporting includes both objects.
    await page.locator('textarea').nth(1).fill('Second');
    const pages = await readPdf(await exportEditor(page));
    const text = pages[0]!.items.map((i) => i.str).join(' ');
    expect(text).toContain('First');
    expect(text).toContain('Second');
  });

  test('an added image really lands in the exported file and previews correctly', async ({ page }, testInfo) => {
    const png = testInfo.outputPath('dot.png');
    const { writeFileSync } = await import('node:fs');
    writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));

    await openEditor(page, PDFS.singlePage);
    await page.locator('input[accept="image/png,image/jpeg"]').setInputFiles(png);
    await expect(overlayBoxes(page)).toHaveCount(1);

    // regression: the preview's object URL was revoked before the image could load.
    const preview = await page.evaluate(() => {
      const img = document.querySelector('div.absolute.select-none[role=group] img') as HTMLImageElement | null;
      return img ? { complete: img.complete, naturalWidth: img.naturalWidth } : null;
    });
    expect(preview?.naturalWidth).toBeGreaterThan(0);

    const bytes = await exportEditor(page);
    expect(bytes.length).toBeGreaterThan(0);
    expect(await readPdf(bytes)).toHaveLength(1);
  });

  // regression: pdf-lib's own maxWidth wrapping pushed overlong cell text downward,
  // through the cell border and off the bottom of the table entirely.
  test('keeps overlong table text inside the table', async ({ page }) => {
    await openEditor(page, PDFS.singlePage);
    await page.getByRole('button', { name: '+ Table' }).click();
    await page.locator('table input').first().fill('An extremely long value that cannot fit the column');

    const placed = await overlayGeometry(page);
    const pages = await readPdf(await exportEditor(page));
    const scale = placed.canvas.width / pages[0]!.width;
    const { box } = placed.objects[0]!;

    // One clipped line ending in an ellipsis — never split across rows, and never
    // drawn past the table's own bottom edge the way pdf-lib's wrapping used to.
    const clipped = pages[0]!.items.filter((i) => i.str.endsWith('…'));
    expect(clipped).toHaveLength(1);
    expect('An extremely long value that cannot fit the column').toContain(clipped[0]!.str.slice(0, -1));
    for (const item of pages[0]!.items.filter((i) => !i.str.includes('Single page'))) {
      expect(item.y * scale).toBeGreaterThanOrEqual(box.y - 1);
      expect(item.y * scale).toBeLessThanOrEqual(box.y + box.height + 1);
    }
  });

  test('offers a font size for table text, the way it does for text boxes', async ({ page }) => {
    await openEditor(page, PDFS.singlePage);
    await page.getByRole('button', { name: '+ Table' }).click();
    const sizeField = page.locator('.bg-surface-soft input[type=number]');
    await expect(sizeField).toBeVisible();
    await sizeField.fill('20');

    // single-page.pdf is 400pt wide, so the preview must show 20pt at the page's own zoom.
    const { canvas } = await overlayGeometry(page);
    const expected = 20 * (canvas.width / 400);
    const actual = await page.locator('table input').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(actual).toBeCloseTo(expected, 1);
  });

  test('refuses an unreadable PDF with a clear message and stays usable', async ({ page }) => {
    await page.goto('/pdf-editor');
    await pickPdf(page, PDFS.zeroByte);
    await expect(page.locator(errorBanner)).toContainText('could not be read');

    // The drop zone must still be there — an error must not strand the user.
    await pickPdf(page, PDFS.singlePage);
    await expect(page.getByRole('button', { name: '+ Text' })).toBeEnabled({ timeout: 30_000 });
  });
});

test.describe('/pdf-summary', () => {
  test('refuses a corrupted PDF with a human message, without calling the server', async ({ page }) => {
    let called = false;
    await page.route('**/api/ai/pdf-summary', (route) => { called = true; return route.abort(); });

    await page.goto('/pdf-summary');
    await pickPdf(page, PDFS.zeroByte);
    await page.getByRole('button', { name: 'Summarize', exact: true }).click();

    await expect(page.locator(errorBanner)).toContainText('could not be read');
    expect(called).toBe(false);
  });

  // regression: a short PDF surfaced the route's own Zod text ("200 to 60,000
  // characters"), which reads as a bug to someone who dropped a perfectly real file.
  test('explains a too-short document in its own words, without a round trip', async ({ page }) => {
    let called = false;
    await page.route('**/api/ai/pdf-summary', (route) => { called = true; return route.abort(); });

    await page.goto('/pdf-summary');
    await pickPdf(page, PDFS.singlePage);
    await page.getByRole('button', { name: 'Summarize', exact: true }).click();

    await expect(page.locator(errorBanner)).toContainText('not enough text');
    await expect(page.locator(errorBanner)).not.toContainText('60,000');
    expect(called).toBe(false);
  });

  test('renders the summary as an overview plus key points, with a copy button', async ({ page }) => {
    await page.route('**/api/ai/pdf-summary', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          summary: 'Summary: A report about procurement.\nKey points:\n- Prices varied.\n- Three suppliers.',
          provider: 'gemini',
        }),
      }),
    );

    await page.goto('/pdf-summary');
    await pickPdf(page, PDFS.textReport);
    await page.getByRole('button', { name: 'Summarize', exact: true }).click();

    const result = page.locator('[aria-live=polite]');
    await expect(result).toContainText('A report about procurement.');
    await expect(result.locator('ul li')).toHaveCount(2);
    // The prompt's own scaffolding must not be shown to the reader.
    await expect(result).not.toContainText('Summary:');
    await expect(page.getByRole('button', { name: 'Copy summary' })).toBeVisible();
  });

  // regression: a real 40-page document was sent whole, blew the route's 60k ceiling
  // and came back as a raw 400 — the tool did not work at the lengths its own FAQ
  // advertises ("up to 500 pages").
  test('budgets a real long document into the request and says the summary is partial', async ({ page }) => {
    let sentChars = 0;
    await page.route('**/api/ai/pdf-summary', async (route) => {
      sentChars = (JSON.parse(route.request().postData() ?? '{}') as { text?: string }).text?.length ?? 0;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ summary: 'Summary: A long report.\nKey points:\n- It was summarized.', provider: 'gemini' }),
      });
    });

    await page.goto('/pdf-summary');
    await pickPdf(page, PDFS.longText);
    await page.getByRole('button', { name: 'Summarize', exact: true }).click();

    await expect(page.locator('[aria-live=polite]')).toContainText('It was summarized.', { timeout: 60_000 });
    expect(sentChars).toBeGreaterThan(50_000); // most of the document really was sent
    expect(sentChars).toBeLessThanOrEqual(60_000); // and it fits the route's ceiling
    await expect(page.locator('[aria-live=polite]')).toContainText('too long to send whole');
  });

  test('surfaces a server refusal (such as no AI key configured) as a clear message, not a crash', async ({ page }) => {
    await page.route('**/api/ai/pdf-summary', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'PDF summaries are coming soon — they are not enabled on this server yet.', code: 'not_configured' }),
      }),
    );

    await page.goto('/pdf-summary');
    await pickPdf(page, PDFS.textReport);
    await page.getByRole('button', { name: 'Summarize', exact: true }).click();

    await expect(page.locator(errorBanner)).toContainText('coming soon');
    await expect(page.getByRole('button', { name: 'Summarize', exact: true })).toBeEnabled();
  });
});
