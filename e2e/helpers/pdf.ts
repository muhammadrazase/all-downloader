import path from 'node:path';
import { createRequire } from 'node:module';
import { expect, type Page } from '@playwright/test';

const require = createRequire(__filename);

export const PDF_FIXTURE_DIR = path.join(__dirname, '..', '..', 'test', 'fixtures', 'pdf');

export const PDFS = {
  singlePage: path.join(PDF_FIXTURE_DIR, 'single-page.pdf'), // 400x300pt
  multiPage10: path.join(PDF_FIXTURE_DIR, 'multi-page-10.pdf'),
  rotated: path.join(PDF_FIXTURE_DIR, 'rotated-pages.pdf'), // 0/90/180/270
  zeroByte: path.join(PDF_FIXTURE_DIR, 'zero-byte.pdf'),
  truncated: path.join(PDF_FIXTURE_DIR, 'truncated-zero-pages.pdf'),
  textReport: path.join(PDF_FIXTURE_DIR, 'text-report-3-pages.pdf'), // real prose, within the summary bounds
  longText: path.join(PDF_FIXTURE_DIR, 'long-text-40-pages.pdf'), // >60k extractable characters
  notAPdf: path.join(PDF_FIXTURE_DIR, 'non-latin-sample.txt'),
  encryptedUserPassword: path.join(PDF_FIXTURE_DIR, 'encrypted-user-password.pdf'), // password: test1234
  encryptedOwnerOnly: path.join(PDF_FIXTURE_DIR, 'encrypted-owner-only.pdf'), // no open password, ownerPassword: owner-secret-only
} as const;

// pdfjs-dist's legacy Node build needs Promise.withResolvers (Node 22+); this
// runner is on Node 20. Same minimal ponyfill the vitest suite uses.
if (!('withResolvers' in Promise)) {
  (Promise as unknown as { withResolvers: <T>() => { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } }).withResolvers = function withResolvers<T>() {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

export interface TextItem {
  str: string;
  /** Device coordinates of the glyph on the page AS DISPLAYED (the page's /Rotate applied). */
  x: number;
  y: number;
  /** Advance width of the run, in the same displayed units as `x`/`y`. */
  width: number;
}

export interface PageReport {
  width: number;
  height: number;
  rotation: number;
  items: TextItem[];
}

/**
 * Reads produced bytes back with pdf.js — a different library from the
 * @cantoo/pdf-lib that wrote them, so "it worked" is never just one library
 * agreeing with itself. Its default viewport applies /Rotate, so the coordinates
 * here are what a reader actually shows the user.
 */
export async function readPdf(bytes: Buffer, password?: string): Promise<PageReport[]> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = path.join(
    path.dirname(require.resolve('pdfjs-dist/package.json')),
    'legacy',
    'build',
    'pdf.worker.mjs',
  );
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes), password }).promise;
  const pages: PageReport[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    pages.push({
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
      rotation: page.rotate,
      items: content.items
        .filter((item): item is typeof item & { str: string; transform: number[]; width: number } => 'str' in item && item.str.trim().length > 0)
        .map((item) => {
          const [x, y] = viewport.convertToViewportPoint(item.transform[4]!, item.transform[5]!);
          return { str: item.str, x: x as number, y: y as number, width: item.width };
        }),
    });
  }
  return pages;
}

/** Pulls a blob: download link's bytes out of the page without going through the OS download flow. */
export async function readDownload(page: Page, name: RegExp | string): Promise<Buffer> {
  const link = page.getByRole('link', { name });
  await expect(link).toBeVisible();
  const href = await link.getAttribute('href');
  expect(href).toMatch(/^blob:/);
  const base64 = await page.evaluate(async (url) => {
    const response = await fetch(url);
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
    return btoa(binary);
  }, href!);
  return Buffer.from(base64, 'base64');
}

export function pickPdf(page: Page, ...files: string[]) {
  return page.locator('input[accept="application/pdf,.pdf"]').setInputFiles(files);
}

/** Opens the editor on a fixture and waits for the page canvas to finish rendering. */
export async function openEditor(page: Page, file: string) {
  await page.goto('/pdf-editor');
  await pickPdf(page, file);
  await expect(page.getByRole('button', { name: '+ Text' })).toBeEnabled({ timeout: 30_000 });
}

export function overlayBoxes(page: Page) {
  return page.locator('div.absolute.select-none[role=group]');
}

/**
 * Waits until the canvas is showing a page of the given shape. Content can only be
 * placed on a page that has finished rendering — the editor disables the add buttons
 * until then — so "the toolbar looks enabled" is not a safe signal on its own.
 * Keyed on aspect ratio, not width, because the page is fitted to the viewport.
 */
export async function waitForPageAspect(page: Page, ratio: number) {
  await expect
    .poll(async () => {
      const box = await page.locator('canvas').boundingBox();
      return box && box.height > 0 ? Math.round((box.width / box.height) * 100) / 100 : 0;
    }, { timeout: 30_000 })
    .toBeCloseTo(ratio, 1);
  await expect(page.getByRole('button', { name: '+ Text' })).toBeEnabled();
}

/** Geometry of the overlay boxes relative to the rendered page canvas, in CSS pixels. */
export async function overlayGeometry(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) throw new Error('no page canvas');
    const canvasBox = canvas.getBoundingClientRect();
    return {
      canvas: { width: canvasBox.width, height: canvasBox.height },
      objects: [...document.querySelectorAll('div.absolute.select-none[role=group]')].map((el) => {
        const box = el.getBoundingClientRect();
        const content = el.children[1]!.getBoundingClientRect();
        return {
          box: { x: box.x - canvasBox.x, y: box.y - canvasBox.y, width: box.width, height: box.height },
          content: { x: content.x - canvasBox.x, y: content.y - canvasBox.y, width: content.width, height: content.height },
        };
      }),
    };
  });
}

export async function exportEditor(page: Page): Promise<Buffer> {
  await page.getByRole('button', { name: 'Export PDF' }).click();
  return readDownload(page, /Download edited\.pdf/);
}
