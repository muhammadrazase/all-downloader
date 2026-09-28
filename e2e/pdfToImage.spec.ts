import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { PDFS, pickPdf, readDownload } from './helpers/pdf';

test.beforeEach(() => {
  test.setTimeout(90_000);
});

/** Reads the REAL decoded pixel size via the browser's own image decoder — a different path
 * than the canvas render that produced the file, so this is genuine independent verification. */
async function imgSize(page: Page, index = 0): Promise<{ width: number; height: number }> {
  const img = page.locator('li.card img').nth(index);
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  return img.evaluate((el: HTMLImageElement) => ({ width: el.naturalWidth, height: el.naturalHeight }));
}

test.describe('/pdf-to-jpg', () => {
  test('exports a single page at the requested standard resolution — real decoded pixel dimensions', async ({ page }) => {
    await page.goto('/pdf-to-jpg');
    await pickPdf(page, PDFS.singlePage); // 400x300pt
    await page.getByRole('button', { name: 'Convert to JPG' }).click();
    await expect(page.locator('li.card')).toHaveCount(1);

    expect(await imgSize(page)).toEqual({ width: 800, height: 600 }); // 400*2, 300*2 at standard (scale 2)

    const bytes = await readDownload(page, /^Download JPG$/);
    expect(bytes.subarray(0, 3).toString('hex')).toBe('ffd8ff'); // real JPEG magic bytes
  });

  test('high resolution doubles the pixel output versus standard', async ({ page }) => {
    await page.goto('/pdf-to-jpg');
    await pickPdf(page, PDFS.singlePage);
    await page.getByLabel('Resolution', { exact: true }).selectOption('high');
    await page.getByRole('button', { name: 'Convert to JPG' }).click();

    expect(await imgSize(page)).toEqual({ width: 1600, height: 1200 }); // 400*4, 300*4
  });

  test('PNG format produces real PNG bytes', async ({ page }) => {
    await page.goto('/pdf-to-jpg');
    await pickPdf(page, PDFS.singlePage);
    await page.getByLabel('Format', { exact: true }).selectOption('png');
    await page.getByRole('button', { name: 'Convert to PNG' }).click();

    const bytes = await readDownload(page, /^Download PNG$/);
    expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a'); // real PNG magic bytes
  });

  // regression risk: pdf.js bakes /Rotate into getViewport() automatically, so a naive export
  // could silently produce sideways images or fail to swap width/height where rotated.
  test('rotated pages export right-side-up, with swapped pixel dimensions exactly where rotated', async ({ page }) => {
    await page.goto('/pdf-to-jpg');
    await pickPdf(page, PDFS.rotated); // 4 pages: 0, 90, 180, 270 degrees, each on a 400x300pt MediaBox
    await page.getByRole('button', { name: 'Convert to JPG' }).click();
    await expect(page.locator('li.card img')).toHaveCount(4);

    // 0 and 180 degrees keep the MediaBox's own orientation; 90 and 270 swap it.
    expect(await imgSize(page, 0)).toEqual({ width: 800, height: 600 });
    expect(await imgSize(page, 1)).toEqual({ width: 600, height: 800 });
    expect(await imgSize(page, 2)).toEqual({ width: 800, height: 600 });
    expect(await imgSize(page, 3)).toEqual({ width: 600, height: 800 });
  });

  test('exports a page range, and produces a real zip', async ({ page }) => {
    await page.goto('/pdf-to-jpg');
    await pickPdf(page, PDFS.multiPage10);
    await page.locator('#pdf-to-image-ranges').fill('2, 5, 7');
    await expect(page.locator('#pdf-to-image-ranges ~ [aria-live=polite]')).toContainText('3 images');

    await page.getByRole('button', { name: 'Convert to JPG' }).click();
    await expect(page.locator('li.card img')).toHaveCount(3);

    const zipBytes = await readDownload(page, /^Download all \(\.zip\)$/);
    expect(zipBytes.subarray(0, 4).toString('hex')).toBe('504b0304'); // real zip local-file-header magic bytes
  });

  test('a page-range typo is explained without ever touching pdf.js', async ({ page }) => {
    await page.goto('/pdf-to-jpg');
    await pickPdf(page, PDFS.multiPage10);
    await page.locator('#pdf-to-image-ranges').fill('99');
    await expect(page.locator('#pdf-to-image-ranges ~ [aria-live=polite]')).toContainText('out of range');
    await expect(page.getByRole('button', { name: 'Convert to JPG' })).toBeDisabled();
  });

  // regression: a result set left on screen after changing settings would show thumbnails that
  // no longer match the format/resolution/range controls above them.
  test('changing the format after a result withdraws it', async ({ page }) => {
    await page.goto('/pdf-to-jpg');
    await pickPdf(page, PDFS.singlePage);
    await page.getByRole('button', { name: 'Convert to JPG' }).click();
    await expect(page.locator('li.card img')).toBeVisible();

    await page.getByLabel('Format', { exact: true }).selectOption('png');
    await expect(page.locator('li.card')).toHaveCount(0);
  });

  // regression: withdrawing results used to not stop the render loop — it ran to completion
  // against old settings and left behind blob URLs nothing would ever revoke.
  test('changing a setting mid-render abandons the export instead of orphaning it', async ({ page }) => {
    await page.goto('/pdf-to-jpg');
    await pickPdf(page, PDFS.multiPage10);
    await page.getByLabel('Resolution', { exact: true }).selectOption('high');
    await page.getByRole('button', { name: 'Convert to JPG' }).click();
    await expect(page.locator('li.card img').first()).toBeVisible(); // the run is genuinely in flight

    await page.getByLabel('Format', { exact: true }).selectOption('png');
    await expect(page.getByRole('button', { name: 'Convert to PNG' })).toBeEnabled();
    await expect(page.locator('li.card')).toHaveCount(0);
    await expect(page.locator('[role=progressbar]')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Download all (.zip)' })).toHaveCount(0);

    // and the abandoned run left the tool in a state that still works
    await page.getByRole('button', { name: 'Convert to PNG' }).click();
    await expect(page.locator('li.card img')).toHaveCount(10);
  });

  // regression: placeholders assumed A4-portrait and corrected only once page 1 rendered, so the
  // grid reflowed on load — these fixtures are landscape, exactly where that assumption broke.
  test('the placeholder grid is already the final height before the first page renders', async ({ page }) => {
    await page.goto('/pdf-to-jpg');
    await pickPdf(page, PDFS.multiPage10);
    await page.getByRole('button', { name: 'Convert to JPG' }).click();

    await expect(page.locator('ul.grid')).toBeVisible();
    const placeholderHeight = (await page.locator('ul.grid').boundingBox())!.height;
    await expect(page.locator('li.card img')).toHaveCount(10);
    const renderedHeight = (await page.locator('ul.grid').boundingBox())!.height;

    expect(Math.abs(placeholderHeight - renderedHeight)).toBeLessThan(2);
  });

  // Unsanitised, an uploaded name like `..\..\evil.pdf` would write outside the zip's destination
  // folder (zip slip) — named in memory here so no repo file carries it.
  test('a file name that looks like a path cannot become a path inside the zip', async ({ page }) => {
    await page.goto('/pdf-to-jpg');
    await page.locator('input[accept="application/pdf,.pdf"]').setInputFiles({
      name: '..\\..\\..\\evil.pdf',
      mimeType: 'application/pdf',
      buffer: readFileSync(PDFS.textReport),
    });
    await page.getByRole('button', { name: 'Convert to JPG' }).click();
    await expect(page.locator('li.card img')).toHaveCount(3);

    await expect(page.getByRole('link', { name: 'Download all (.zip)' }).first()).toHaveAttribute('download', 'evil.zip');
    await expect(page.locator('li.card a[download]').first()).toHaveAttribute('download', 'evil-page-1.jpg');

    const zipBytes = await readDownload(page, /^Download all \(\.zip\)$/);
    for (const name of Object.keys(unzipSync(new Uint8Array(zipBytes)))) {
      expect(name).not.toMatch(/[\\/]|\.\./);
    }
  });
});
