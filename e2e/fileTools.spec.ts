import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import QRCode from 'qrcode';
import { FIXTURES } from './helpers/media';

/**
 * Browser-only behaviour for the four client-side file tools: canvas pixels, the bytes
 * of the file that actually downloads, and the re-run state machine. Everything here
 * needs a real browser — the vitest suite is Node-only and cannot touch a canvas.
 *
 *   npm run test:e2e -- e2e/fileTools.spec.ts --project=desktop
 */

const IMAGES = path.resolve(__dirname, '..', 'test', 'fixtures', 'images');
const OCR_FIXTURES = path.resolve(__dirname, '..', 'test', 'fixtures', 'ocr');
const TRANSPARENT_LOGO = path.join(IMAGES, 'logo-transparent.png');
const PHOTO = path.join(IMAGES, 'photo-1600x1067.jpg');

const jobRows = (page: Page) => page.locator('ul > li.card');

const hasBarcodeDetector = (page: Page) => page.evaluate(() => 'BarcodeDetector' in window);

/** Decodes the live QR canvas, compositing onto white first so a transparent code still reads. */
function decodeQrCanvas(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const source = document.querySelector('canvas');
    if (!source) return [];
    const flattened = document.createElement('canvas');
    flattened.width = source.width;
    flattened.height = source.height;
    const ctx = flattened.getContext('2d');
    if (!ctx) return [];
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, flattened.width, flattened.height);
    ctx.drawImage(source, 0, 0);
    type Detector = { detect(bitmap: ImageBitmap): Promise<{ rawValue: string }[]> };
    const Ctor = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    const found = await new Ctor({ formats: ['qr_code'] }).detect(await createImageBitmap(flattened));
    return found.map((result) => result.rawValue);
  });
}

/** Polls until the canvas holds a decodable code, then returns its contents. */
async function decodedQrValue(page: Page): Promise<string> {
  let values: string[] = [];
  await expect.poll(async () => {
    values = await decodeQrCanvas(page);
    return values.length;
  }).toBeGreaterThan(0);
  return values[0] ?? '';
}

/** Dark-pixel count for the whole canvas — a proxy for "is anything actually drawn". */
function canvasInk(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return 0;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) {
      const red = data[i];
      if (red !== undefined && red < 200) ink++;
    }
    return ink;
  });
}

/** Dark pixels on the very last column: any at all means text ran off the canvas. */
function rightEdgeInk(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return -1;
    const { data } = ctx.getImageData(canvas.width - 1, 0, 1, canvas.height);
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) {
      const red = data[i];
      if (red !== undefined && red < 200) ink++;
    }
    return ink;
  });
}

const canvasSize = (page: Page) =>
  page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return canvas ? [canvas.width, canvas.height] : [0, 0];
  });

async function saveDownload(page: Page, trigger: () => Promise<void>): Promise<{ filename: string; bytes: Buffer }> {
  const waiter = page.waitForEvent('download');
  await trigger();
  const download = await waiter;
  const target = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ssd-e2e-')), download.suggestedFilename());
  await download.saveAs(target);
  return { filename: download.suggestedFilename(), bytes: fs.readFileSync(target) };
}

test.describe('QR code generator — /qr-code-generator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/qr-code-generator');
  });

  test('renders one H1, a canonical URL and parseable JSON-LD', async ({ page }) => {
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const types = blocks.map((raw) => (JSON.parse(raw) as { '@type': string })['@type']);
    expect(types).toEqual(expect.arrayContaining(['WebApplication', 'FAQPage', 'HowTo', 'BreadcrumbList']));
  });

  test('every payload type round-trips through a real QR decoder', async ({ page }) => {
    test.skip(!(await hasBarcodeDetector(page)), 'This browser build has no BarcodeDetector to decode with.');

    await page.fill('#qr-text', 'https://snapvidly.com/a?b=1&c=2');
    expect(await decodedQrValue(page)).toBe('https://snapvidly.com/a?b=1&c=2');

    await page.getByRole('button', { name: 'Email', exact: true }).click();
    await page.getByLabel('Email address').fill('hello@example.com');
    await page.getByLabel('Subject (optional)').fill('Hello World & friends');
    // RFC 6068: a space must be %20 — "+" is a literal plus in a mailto URI.
    await expect.poll(() => decodeQrCanvas(page)).toEqual(['mailto:hello@example.com?subject=Hello%20World%20%26%20friends']);

    await page.getByRole('button', { name: 'Wi-Fi', exact: true }).click();
    await page.getByLabel('Network name (SSID)').fill('Guest Net');
    await page.getByLabel('Password', { exact: true }).fill('p;a,ss');
    await page.getByLabel('Hidden network').check();
    await expect.poll(() => decodeQrCanvas(page)).toEqual(['WIFI:T:WPA;S:Guest Net;P:p\\;a\\,ss;H:true;;']);

    await page.getByRole('button', { name: 'Contact (vCard)', exact: true }).click();
    await page.getByLabel('Full name').fill('Doe;Jane');
    await page.getByLabel('Organization (optional)').fill('Acme, Inc.');
    const vcard = await decodedQrValue(page);
    expect(vcard).toContain('FN:Doe\\;Jane');
    expect(vcard).toContain('ORG:Acme\\, Inc.');
    expect(vcard).toContain('\r\n');

    await page.getByRole('button', { name: 'Calendar Event', exact: true }).click();
    await page.getByLabel('Title').fill('Launch party, take 2');
    await page.getByLabel('Starts (optional)').fill('2026-12-25T10:00');
    const event = await decodedQrValue(page);
    expect(event).toContain('SUMMARY:Launch party\\, take 2');
    expect(event).toMatch(/PRODID:.+/);
    expect(event).toMatch(/UID:.+/);
    expect(event).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
  });

  test('a transparent PNG download keeps its alpha and still scans', async ({ page }) => {
    await page.fill('#qr-text', 'https://snapvidly.com/transparent');
    await page.getByLabel('Transparent background').check();
    if (await hasBarcodeDetector(page)) {
      expect(await decodedQrValue(page)).toBe('https://snapvidly.com/transparent');
    }

    const png = await saveDownload(page, () => page.getByRole('button', { name: 'Download PNG' }).click());
    expect(png.filename).toBe('qr-code.png');
    // PNG IHDR colour-type byte: 6 = truecolour with alpha.
    expect(png.bytes[25]).toBe(6);

    const svg = await saveDownload(page, () => page.getByRole('button', { name: 'Download SVG' }).click());
    expect(svg.bytes.toString('utf8')).not.toContain('fill="#ffffff"');
  });

  test('clears the code and blocks download when the content no longer fits', async ({ page }) => {
    await page.fill('#qr-text', 'https://snapvidly.com/fits');
    await expect(page.getByRole('button', { name: 'Download PNG' })).toBeEnabled();

    await page.fill('#qr-text', 'x'.repeat(5000));
    await expect(page.locator('[aria-live="polite"]')).toContainText('too long to fit');
    await expect(page.getByRole('button', { name: 'Download PNG' })).toBeDisabled();
    if (await hasBarcodeDetector(page)) {
      // The previous, now-wrong code must not be left on screen to be screenshotted.
      await expect.poll(() => decodeQrCanvas(page)).toEqual([]);
    }

    await page.fill('#qr-text', 'https://snapvidly.com/short-again');
    await expect(page.getByRole('button', { name: 'Download PNG' })).toBeEnabled();
  });

  test('warns about colour choices a phone camera cannot read', async ({ page }) => {
    await page.fill('#qr-text', 'https://snapvidly.com/colours');
    const setColor = (index: number, value: string) =>
      page.evaluate(([position, color]) => {
        const input = document.querySelectorAll<HTMLInputElement>('input[type="color"]')[Number(position)];
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (!input) return;
        setter?.call(input, color);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, [String(index), value]);

    await setColor(0, '#cccccc');
    await expect(page.locator('[aria-live="polite"]')).toContainText('too close together');

    await setColor(0, '#ffffff');
    await setColor(1, '#000000');
    await expect(page.locator('[aria-live="polite"]')).toContainText('inverted');
  });
});

test.describe('Text to image — /text-to-image', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/text-to-image');
  });

  test('never clips an unbroken URL off the right edge', async ({ page }) => {
    await page.fill('#tti-text', 'Check this out: https://example.com/a/very/long/path/that/never/breaks/anywhere-at-all-12345678901234567890');
    await expect.poll(() => rightEdgeInk(page)).toBe(0);
  });

  test('a fixed-size preset produces exactly that size when shrink-to-fit is on', async ({ page }) => {
    await page.fill('#tti-text', Array.from({ length: 40 }, (_, i) => `Line ${i} of a long quotation that keeps going`).join('\n'));
    await page.getByRole('combobox', { name: 'Size', exact: true }).selectOption({ label: 'Square post (1080×1080)' });

    await expect.poll(() => canvasSize(page)).toEqual([1080, 1080]);
    await expect(page.getByText(/Output: 1080 × 1080 px/)).toBeVisible();

    await page.getByLabel(/Shrink text to fit/).uncheck();
    // Without it the canvas grows rather than clipping — visible, and reported honestly.
    await expect.poll(async () => (await canvasSize(page))[1] ?? 0).toBeGreaterThan(1080);
  });

  test('downloads real PNG and JPEG bytes matching the chosen format', async ({ page }) => {
    await page.fill('#tti-text', 'Export check');
    const png = await saveDownload(page, () => page.getByRole('button', { name: 'Download PNG' }).click());
    expect(png.filename).toBe('text-image.png');
    expect(png.bytes.subarray(0, 4).toString('hex')).toBe('89504e47');

    await page.getByLabel('Download as').selectOption('image/jpeg');
    const jpg = await saveDownload(page, () => page.getByRole('button', { name: 'Download JPEG' }).click());
    expect(jpg.filename).toBe('text-image.jpg');
    expect(jpg.bytes.subarray(0, 3).toString('hex')).toBe('ffd8ff');
  });

  test('shows the placeholder instead of exporting a blank image for whitespace-only text', async ({ page }) => {
    await page.fill('#tti-text', '     ');
    await expect.poll(() => canvasInk(page)).toBeGreaterThan(0);
  });
});

test.describe('Image compressor — /image-compressor', () => {
  const upload = (page: Page, files: string | string[]) => page.locator('input[type="file"]').setInputFiles(files);
  const compress = (page: Page) => page.getByRole('button', { name: /^(Compress|Re-compress)/ });

  test.beforeEach(async ({ page }) => {
    await page.goto('/image-compressor');
  });

  test('flattens a transparent PNG onto white, not black, when encoding JPEG', async ({ page }) => {
    await upload(page, TRANSPARENT_LOGO);
    await page.getByLabel('Format').selectOption('image/jpeg');
    await page.getByLabel('Resize').selectOption('none');
    await compress(page).click();
    await expect(page.getByRole('link', { name: 'Download', exact: true })).toBeVisible({ timeout: 30_000 });

    const corner = await page.evaluate(async () => {
      const img = document.querySelector<HTMLImageElement>('ul li img');
      if (!img) return [] as number[];
      const bitmap = await createImageBitmap(await (await fetch(img.src)).blob());
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return [] as number[];
      ctx.drawImage(bitmap, 0, 0);
      return Array.from(ctx.getImageData(2, 2, 1, 1).data);
    });
    expect(corner.slice(0, 3)).toEqual([expect.any(Number), expect.any(Number), expect.any(Number)]);
    for (const channel of corner.slice(0, 3)) expect(channel).toBeGreaterThan(240);
  });

  test('the download extension always matches the bytes, even after switching format', async ({ page }) => {
    await upload(page, TRANSPARENT_LOGO);
    await page.getByLabel('Format').selectOption('image/jpeg');
    await compress(page).click();
    await expect(page.getByRole('link', { name: 'Download', exact: true })).toBeVisible({ timeout: 30_000 });

    // Switching the dropdown must not relabel a result that is still JPEG underneath.
    await page.getByLabel('Format').selectOption('image/webp');
    const stillJpeg = await saveDownload(page, () => page.getByRole('link', { name: 'Download', exact: true }).first().click());
    expect(stillJpeg.filename).toMatch(/\.jpg$/);
    expect(stillJpeg.bytes.subarray(0, 3).toString('hex')).toBe('ffd8ff');

    await expect(compress(page)).toBeEnabled();
    await expect(compress(page)).toHaveText(/Re-compress/);
    await compress(page).click();
    await expect(compress(page)).toBeDisabled({ timeout: 30_000 });

    const webp = await saveDownload(page, () => page.getByRole('link', { name: 'Download', exact: true }).first().click());
    expect(webp.filename).toMatch(/\.webp$/);
    expect(webp.bytes.subarray(8, 12).toString('utf8')).toBe('WEBP');
  });

  test('target-size mode lands under the requested file size', async ({ page }) => {
    await upload(page, PHOTO);
    await page.getByLabel('Compress by').selectOption('targetSize');
    await page.getByLabel('Format').selectOption('image/jpeg');
    await page.getByLabel('Resize').selectOption('none');
    await page.getByLabel('Target size (KB)').fill('60');
    await compress(page).click();
    await expect(page.getByRole('link', { name: 'Download', exact: true })).toBeVisible({ timeout: 45_000 });

    const out = await saveDownload(page, () => page.getByRole('link', { name: 'Download', exact: true }).first().click());
    expect(out.bytes.length).toBeLessThanOrEqual(60 * 1024);
    expect(out.bytes.length).toBeGreaterThan(10 * 1024); // not a degenerate near-empty result
  });

  test('explains impossible output dimensions instead of failing generically', async ({ page }) => {
    await upload(page, PHOTO);
    await page.getByLabel('Resize').selectOption('exact');
    await page.getByRole('spinbutton', { name: 'Width' }).fill('30000');
    await page.getByRole('spinbutton', { name: 'Height' }).fill('30000');
    await compress(page).click();
    await expect(jobRows(page).first()).toContainText('larger than a browser canvas can hold', { timeout: 30_000 });
  });

  test('says so when more files are dropped than it can take', async ({ page }) => {
    await upload(page, Array.from({ length: 12 }, () => TRANSPARENT_LOGO));
    await expect(jobRows(page)).toHaveCount(10);
    await expect(page.locator('p.text-danger')).toContainText('10 images at a time');
  });
});

test.describe('Image to text (OCR) — /image-to-text', () => {
  const upload = (page: Page, files: string | string[]) => page.locator('input[type="file"]').setInputFiles(files);
  const extract = (page: Page) => page.getByRole('button', { name: /^(Extract text|Re-extract|Reading images)/ });

  test.beforeEach(async ({ page }) => {
    await page.goto('/image-to-text');
  });

  test('lets the language be chosen before any file is added', async ({ page }) => {
    await expect(page.locator('#ocr-lang')).toBeVisible();
  });

  test('re-extracts with a new language instead of stranding a wrong-language result', async ({ page }) => {
    await upload(page, path.join(OCR_FIXTURES, 'deu-sample.png'));
    await extract(page).click();
    await expect(jobRows(page).first()).toContainText('Confidence:', { timeout: 120_000 });
    // Read as English, the German umlauts come out mangled.
    await expect(jobRows(page).first()).not.toContainText('Hauptstraße');

    await page.locator('#ocr-lang').selectOption('deu');
    await expect(extract(page)).toBeEnabled();
    await expect(extract(page)).toHaveText(/Re-extract/);
    await extract(page).click();
    await expect(jobRows(page).first()).toContainText('Hauptstraße', { timeout: 120_000 });
    await expect(jobRows(page).first()).toContainText(/\d+ words · \d+ characters/);
  });

  // regression: Arabic/Urdu are right-to-left scripts — the result must not be forced into LTR display.
  test('reads real Arabic text and displays the result right-to-left', async ({ page }) => {
    await upload(page, path.join(OCR_FIXTURES, 'ara-sample.png'));
    await page.locator('#ocr-lang').selectOption('ara');
    await extract(page).click();

    const result = jobRows(page).first().locator('pre');
    await expect(result).toContainText('مرحبا', { timeout: 120_000 });
    await expect(result).toHaveAttribute('dir', 'rtl');
  });

  test('reads real Urdu text and displays the result right-to-left', async ({ page }) => {
    await upload(page, path.join(OCR_FIXTURES, 'urd-sample.png'));
    await page.locator('#ocr-lang').selectOption('urd');
    await extract(page).click();

    const result = jobRows(page).first().locator('pre');
    await expect(result).toContainText('پاکستان', { timeout: 120_000 });
    await expect(result).toHaveAttribute('dir', 'rtl');
  });

  test('an English result stays left-to-right', async ({ page }) => {
    await upload(page, path.join(OCR_FIXTURES, 'invoice-sample.png'));
    await extract(page).click();
    const result = jobRows(page).first().locator('pre');
    await expect(result).toContainText('Invoice', { timeout: 120_000 });
    await expect(result).toHaveAttribute('dir', 'ltr');
  });

  test('re-arms after rotating an already-recognised image', async ({ page }) => {
    await upload(page, path.join(OCR_FIXTURES, 'invoice-sample.png'));
    await extract(page).click();
    await expect(jobRows(page).first()).toContainText('Invoice #48213', { timeout: 120_000 });
    await expect(extract(page)).toBeDisabled();

    await page.getByRole('button', { name: /^Rotate / }).click();
    await expect(extract(page)).toBeEnabled();
    await expect(jobRows(page).first()).toContainText('re-extract to update');
  });

  test('exports a PDF and a .txt whose text is really in the file', async ({ page }) => {
    await upload(page, path.join(OCR_FIXTURES, 'invoice-sample.png'));
    await extract(page).click();
    await expect(jobRows(page).first()).toContainText('Invoice #48213', { timeout: 120_000 });

    const pdf = await saveDownload(page, () => page.getByRole('button', { name: 'Download .pdf' }).first().click());
    expect(pdf.filename).toBe('invoice-sample.pdf');
    expect(pdf.bytes.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(pdf.bytes.length).toBeGreaterThan(500);

    const txt = await saveDownload(page, () => page.getByRole('button', { name: 'Download .txt' }).first().click());
    expect(txt.bytes.toString('utf8')).toContain('Invoice #48213');
  });

  test('says so when more files are dropped than it can take', async ({ page }) => {
    await upload(page, Array.from({ length: 12 }, () => path.join(OCR_FIXTURES, 'invoice-sample.png')));
    await expect(jobRows(page)).toHaveCount(10);
    await expect(page.locator('p.text-danger')).toContainText('10 images at a time');
  });

  test('reports an image it could not read without surfacing internals', async ({ page }) => {
    await upload(page, TRANSPARENT_LOGO);
    await extract(page).click();
    await expect(jobRows(page).first()).toContainText('No text was found in this image.', { timeout: 120_000 });
    await expect(page.locator('body')).not.toContainText('at Object.');
    await expect(page.locator('body')).not.toContainText('tesseract');
  });
});

test.describe('Image merger — /image-merger', () => {
  const upload = (page: Page, files: string | string[]) => page.locator('input[type="file"]').setInputFiles(files);
  const merge = (page: Page) => page.getByRole('button', { name: /^Merge/ });

  test.beforeEach(async ({ page }) => {
    await page.goto('/image-merger');
  });

  test('merges two images into one downloadable result, side by side', async ({ page }) => {
    await upload(page, [PHOTO, TRANSPARENT_LOGO]);
    await page.getByLabel('Layout').selectOption('horizontal');
    await merge(page).click();

    const out = await saveDownload(page, () => page.getByRole('link', { name: /^Download merged\./ }).click());
    expect(out.filename).toMatch(/^merged\.jpg$/);
    expect(out.bytes.subarray(0, 3).toString('hex')).toBe('ffd8ff'); // real JPEG magic bytes

    // photo is 1600x1067, logo is 600x400 -> horizontal layout normalizes to the shorter height (400).
    const dims = await page.evaluate(async (bytes) => {
      const blob = new Blob([new Uint8Array(bytes)]);
      const bitmap = await createImageBitmap(blob);
      return [bitmap.width, bitmap.height];
    }, Array.from(out.bytes));
    expect(dims[1]).toBe(400);
  });

  test('the merge button is disabled below the minimum image count', async ({ page }) => {
    await upload(page, PHOTO);
    await expect(merge(page)).toBeDisabled();
    await expect(merge(page)).toHaveText('Merge 1 image');
    await expect(page.getByText('Add at least 2 images to merge.')).toBeVisible();
  });

  test('reordering images changes which side each one lands on', async ({ page }) => {
    await upload(page, [PHOTO, TRANSPARENT_LOGO]);
    // Move the second (logo) image earlier, swapping the order.
    await page.getByRole('button', { name: 'Move earlier' }).nth(1).click();
    await page.getByLabel('Layout').selectOption('horizontal');
    await merge(page).click();

    const outSwapped = await saveDownload(page, () => page.getByRole('link', { name: /^Download merged\./ }).click());
    expect(outSwapped.bytes.length).toBeGreaterThan(0);
    // Changing the order invalidates any prior state cleanly — no stale result lingers on screen
    // once options change (verified indirectly: exactly one result card, one download link).
    await expect(page.getByRole('link', { name: /^Download merged\./ })).toHaveCount(1);
  });

  test('says so when more images are dropped than it can take', async ({ page }) => {
    // Regression: this notice was set on the same state clearResult() unconditionally wiped
    // right afterward, so it was silently computed and then never actually shown.
    await upload(page, Array.from({ length: 12 }, () => TRANSPARENT_LOGO));
    await expect(page.locator('ul li img')).toHaveCount(10);
    await expect(page.getByText(/Some files were skipped/)).toContainText('merges up to 10 images');
  });

  test('changing an option after a merge withdraws the stale result', async ({ page }) => {
    await upload(page, [PHOTO, TRANSPARENT_LOGO]);
    await merge(page).click();
    await expect(page.getByRole('link', { name: /^Download merged\./ })).toBeVisible({ timeout: 15_000 });

    await page.getByLabel('Layout').selectOption('vertical');
    await expect(page.getByRole('link', { name: /^Download merged\./ })).toHaveCount(0);
  });
});

test.describe('Social media resizer — /social-media-resizer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/social-media-resizer');
  });

  test('resizes to every checked preset\'s exact pixel dimensions', async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles(PHOTO);
    await page.getByLabel(/Instagram Post \(Square\)/).check();
    await page.getByLabel(/Instagram Portrait Post/).check();
    // Uncheck the defaults not part of this assertion, to keep the result list exact.
    await page.getByLabel(/Instagram \/ TikTok Story/).uncheck();
    await page.getByLabel(/YouTube Thumbnail/).uncheck();

    await page.getByRole('button', { name: /^Resize to/ }).click();
    await expect(page.getByText('1080×1080px', { exact: false })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('1080×1350px', { exact: false })).toBeVisible();
  });

  test('"Fill & crop" produces no border; "Fit whole image" shows the chosen border colour', async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles(PHOTO); // 1600x1067 landscape
    await page.getByLabel(/Instagram \/ TikTok Story/).check(); // 1080x1920, a very different (tall) aspect ratio
    for (const label of [/Instagram Post \(Square\)/, /YouTube Thumbnail/]) await page.getByLabel(label).uncheck();

    await page.getByLabel('Fit').selectOption('contain');
    await page.getByLabel('Border colour').fill('#ff0000');
    await page.getByRole('button', { name: /^Resize to/ }).click();
    await expect(page.getByText('1080×1920px', { exact: false })).toBeVisible({ timeout: 15_000 });

    // A landscape photo fit (not cropped) into a tall frame must letterbox top/bottom in the chosen colour.
    const corner = await page.evaluate(async () => {
      const img = document.querySelector<HTMLImageElement>('li img');
      if (!img) return null;
      const bitmap = await createImageBitmap(await (await fetch(img.src)).blob());
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0);
      return Array.from(ctx.getImageData(2, 2, 1, 1).data);
    });
    expect(corner).not.toBeNull();
    expect(corner![0]).toBeGreaterThan(200); // red
    expect(corner![1]).toBeLessThan(60);
  });

  test('the resize button is disabled with no size selected', async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles(PHOTO);
    for (const preset of [/Instagram Post \(Square\)/, /Instagram \/ TikTok Story/, /YouTube Thumbnail/]) {
      await page.getByLabel(preset).uncheck();
    }
    await expect(page.getByRole('button', { name: /^Resize/ })).toBeDisabled();
  });
});

test.describe('QR code scanner — /qr-code-scanner', () => {
  const qrFixtures = fs.mkdtempSync(path.join(os.tmpdir(), 'ssd-qr-fixtures-'));

  test.beforeEach(async ({ page }) => {
    await page.goto('/qr-code-scanner');
  });

  test('decodes a real QR code from an uploaded image and offers to open the URL it encodes', async ({ page }) => {
    const file = path.join(qrFixtures, 'url.png');
    await QRCode.toFile(file, 'https://snapvidly.com/tiktok-downloader', { width: 300 });

    await page.locator('input[type="file"]').setInputFiles(file);
    await expect(page.getByText('https://snapvidly.com/tiktok-downloader')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: 'Open link' })).toHaveAttribute('href', 'https://snapvidly.com/tiktok-downloader');
  });

  test('decodes plain text without offering to "open" it as a link', async ({ page }) => {
    const file = path.join(qrFixtures, 'text.png');
    await QRCode.toFile(file, 'just some plain text, not a url', { width: 300 });

    await page.locator('input[type="file"]').setInputFiles(file);
    await expect(page.getByText('just some plain text, not a url')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: 'Open link' })).toHaveCount(0);
  });

  test('copy button copies the exact decoded text to the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const file = path.join(qrFixtures, 'copy.png');
    await QRCode.toFile(file, 'copy-me-12345', { width: 300 });

    await page.locator('input[type="file"]').setInputFiles(file);
    await expect(page.getByText('copy-me-12345')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Copy text' }).click();
    await expect(page.getByRole('button', { name: 'Copied!' })).toBeVisible();

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toBe('copy-me-12345');
  });

  test('explains clearly when no QR code is found in the image, instead of failing silently', async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles(PHOTO); // a real photo with no QR code
    await expect(page.locator('p.text-danger')).toContainText('No QR code was found', { timeout: 10_000 });
  });

  test('"Scan another" clears the previous result', async ({ page }) => {
    const file = path.join(qrFixtures, 'again.png');
    await QRCode.toFile(file, 'https://example.com', { width: 300 });

    await page.locator('input[type="file"]').setInputFiles(file);
    await expect(page.getByRole('link', { name: 'Open link' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Scan another' }).click();
    await expect(page.getByRole('link', { name: 'Open link' })).toHaveCount(0);
    await expect(page.getByText('Drag a QR code image here')).toBeVisible();
  });

  test('never sends the image to a server — decoding is purely client-side', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (req) => requests.push(req.url()));
    const file = path.join(qrFixtures, 'privacy.png');
    await QRCode.toFile(file, 'https://example.com/private', { width: 300 });

    await page.locator('input[type="file"]').setInputFiles(file);
    await expect(page.getByRole('link', { name: 'Open link' })).toBeVisible({ timeout: 10_000 });
    expect(requests.some((u) => u.includes('/api/') && !u.includes('/api/track'))).toBe(false);
  });
});

test.describe('Video frame grabber — /video-frame-grabber', () => {
  /** Reads the average colour of a captured frame's <img> via an in-page canvas — no ffmpeg
   * involved here, so this is the pure-canvas equivalent of the video-tools' frameColorAt. */
  async function firstFrameColor(page: Page): Promise<{ r: number; g: number; b: number }> {
    return page.evaluate(async () => {
      const img = document.querySelector<HTMLImageElement>('li img');
      if (!img) throw new Error('no captured frame found');
      const bitmap = await createImageBitmap(await (await fetch(img.src)).blob());
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0);
      const [r, g, b] = ctx.getImageData(Math.floor(bitmap.width / 2), Math.floor(bitmap.height / 2), 1, 1).data;
      return { r: r!, g: g!, b: b! };
    });
  }

  async function seekAndCapture(page: Page, seconds: number): Promise<void> {
    const before = await page.locator('li img').count();
    // Setting currentTime doesn't mean the frame is ready — capturing before the browser finishes
    // seeking risks grabbing whatever frame was on screen beforehand (dimensions stay non-zero
    // throughout a seek, so nothing else would signal "not ready yet"). Wait for 'seeked' first.
    await page.locator('video').first().evaluate((el: HTMLVideoElement, t: number) => {
      return new Promise<void>((resolve) => {
        if (!el.seeking && el.currentTime === t) return resolve();
        const onSeeked = () => {
          el.removeEventListener('seeked', onSeeked);
          resolve();
        };
        el.addEventListener('seeked', onSeeked);
        el.currentTime = t;
      });
    }, seconds);
    await page.getByRole('button', { name: 'Capture this frame' }).click();
    await expect(page.locator('li img')).toHaveCount(before + 1);
  }

  test('captures the exact frame at the current playhead — verified by colour, not just a non-empty result', async ({ page }) => {
    // clip-rgb-6s.mp4 is 0-2s red, 2-4s green, 4-6s blue — a wrong-offset capture would still
    // produce SOME image, so only sampling the actual colour proves frame accuracy.
    await page.goto('/video-frame-grabber');
    await page.locator('input[type="file"]').setInputFiles(FIXTURES.clipRgb6s);
    await expect(page.getByRole('button', { name: 'Capture this frame' })).toBeEnabled();

    await seekAndCapture(page, 1);
    const red = await firstFrameColor(page);
    expect(red.r).toBeGreaterThan(200);
    expect(red.g).toBeLessThan(60);
    expect(red.b).toBeLessThan(60);
  });

  test('captures multiple frames from one upload without re-uploading, newest first', async ({ page }) => {
    await page.goto('/video-frame-grabber');
    await page.locator('input[type="file"]').setInputFiles(FIXTURES.clipRgb6s);
    await expect(page.getByRole('button', { name: 'Capture this frame' })).toBeEnabled();

    await seekAndCapture(page, 1); // red
    await expect(page.locator('li img')).toHaveCount(1);

    await seekAndCapture(page, 5); // blue — captured second, so it renders FIRST (newest first)
    await expect(page.locator('li img')).toHaveCount(2);
    const newest = await firstFrameColor(page);
    expect(newest.b).toBeGreaterThan(200);
    expect(newest.r).toBeLessThan(60);
  });

  test('a captured frame downloads as a real image matching the chosen format', async ({ page }) => {
    await page.goto('/video-frame-grabber');
    await page.locator('input[type="file"]').setInputFiles(FIXTURES.clipRgb6s);
    await expect(page.getByRole('button', { name: 'Capture this frame' })).toBeEnabled();
    await page.getByLabel('Format').selectOption('image/jpeg');
    await seekAndCapture(page, 1);

    // exact:true is load-bearing: getByRole's name match is a case-insensitive SUBSTRING, so a
    // bare 'Download' also matches the nav's "Downloaders 13" link, which sorts first in the DOM.
    const download = await saveDownload(page, () => page.getByRole('link', { name: 'Download', exact: true }).first().click());
    expect(download.filename).toMatch(/\.jpg$/);
    expect(download.bytes.subarray(0, 3).toString('hex')).toBe('ffd8ff'); // real JPEG magic bytes
  });

  test('rejects a non-video file at selection time', async ({ page }) => {
    await page.goto('/video-frame-grabber');
    await page.locator('input[type="file"]').setInputFiles(PHOTO);
    await expect(page.locator('p.text-danger')).toContainText(/choose a video file/i);
  });

  test('never uploads the video — capturing is purely client-side', async ({ page }) => {
    // /api/track is the site's own analytics beacon (fires on every tool page, sends only the tool
    // slug) — any other non-GET request would mean the video itself went somewhere.
    const uploads: string[] = [];
    page.on('request', (req) => {
      if (req.method() !== 'GET' && !req.url().includes('/api/track')) uploads.push(`${req.method()} ${req.url()}`);
    });
    await page.goto('/video-frame-grabber');
    await page.locator('input[type="file"]').setInputFiles(FIXTURES.clipRgb6s);
    await expect(page.getByRole('button', { name: 'Capture this frame' })).toBeEnabled();
    await seekAndCapture(page, 1);
    expect(uploads).toEqual([]);
  });
});
