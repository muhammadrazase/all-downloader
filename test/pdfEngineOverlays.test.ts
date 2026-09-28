import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PDFDocument } from '@cantoo/pdf-lib';

const require = createRequire(import.meta.url);

// pdfjs-dist's legacy Node build uses Promise.withResolvers, added in Node 22.
// This test environment runs Node 20 — a minimal ponyfill so the ONE test
// below that needs pdf.js as an independent reader can run, without pulling
// the project's actual Node engine requirement forward for this alone.
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
import {
  applyOverlays,
  overlayToDisplayedRect,
  displayedPointToPdf,
  displayedPageSize,
  normalizeRotation,
  truncateToWidth,
  isWinAnsiCompatible,
  imageFormatFromMimeType,
  createTextPdf,
  PdfEngineError,
  type PageGeometry,
  type TextOverlay,
  type ImageOverlay,
  type TableOverlay,
} from '@/lib/pdfEngine';

const fixturesDir = path.join(__dirname, 'fixtures', 'pdf');
const fixture = (name: string) => new Uint8Array(readFileSync(path.join(fixturesDir, name)));

const upright = (width: number, height: number): PageGeometry => ({ width, height, rotation: 0 });

const PNG_1X1 = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),
  (c) => c.charCodeAt(0),
);

/**
 * pdf.js as a SECOND, independent reader — the real contract, since pdf-lib
 * believing its own output proves nothing.
 *
 * pdf.js auto-detects Node and defaults GlobalWorkerOptions.workerSrc to the
 * RELATIVE path "./pdf.worker.mjs", which does not resolve under vitest — the
 * worker spawn then fails and pdf.js falls through a multi-minute retry/timeout
 * path before recovering (empirically ~12 minutes for a single test). Setting
 * the real absolute path avoids that failure path being hit at all.
 */
async function loadPdfjsForTests() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = path.join(
    path.dirname(require.resolve('pdfjs-dist/package.json')),
    'legacy',
    'build',
    'pdf.worker.mjs',
  );
  return pdfjsLib;
}

describe('overlayToDisplayedRect — screen pixels to displayed points', () => {
  it('divides by the render scale so a zoomed-in editor view still measures real points', () => {
    // At 2x render scale, a 200-screen-pixel-wide box is actually 100pt wide.
    expect(overlayToDisplayedRect({ x: 40, y: 40, width: 200, height: 100 }, 2)).toEqual({ x: 20, y: 20, width: 100, height: 50 });
  });

  it('is an identity at scale 1', () => {
    expect(overlayToDisplayedRect({ x: 37, y: 112, width: 150, height: 60 }, 1)).toEqual({ x: 37, y: 112, width: 150, height: 60 });
  });
});

describe('displayedPointToPdf — coordinate transform correctness', () => {
  it('flips the Y axis on an unrotated page (screen down vs PDF up)', () => {
    expect(displayedPointToPdf(0, 0, upright(400, 300))).toEqual({ x: 0, y: 300 });
    expect(displayedPointToPdf(0, 300, upright(400, 300))).toEqual({ x: 0, y: 0 });
  });

  it('round-trips a point back to where it started on an unrotated page', () => {
    const page = upright(612, 792);
    const pdf = displayedPointToPdf(137, 240, page);
    expect(pdf.x).toBeCloseTo(137, 5);
    expect(page.height - pdf.y).toBeCloseTo(240, 5);
  });

  // Rotation cases: the user always works in the page they SEE. On a /Rotate 90
  // page the viewer turns the MediaBox a quarter-turn clockwise, so the displayed
  // top-left corner is the MediaBox's BOTTOM-left — placing content by MediaBox
  // coordinates alone drops it in the wrong corner (verified in a real browser).
  it('maps the displayed top-left corner to the correct MediaBox corner at each rotation', () => {
    const w = 400;
    const h = 300;
    expect(displayedPointToPdf(0, 0, { width: w, height: h, rotation: 0 })).toEqual({ x: 0, y: h });
    expect(displayedPointToPdf(0, 0, { width: w, height: h, rotation: 90 })).toEqual({ x: 0, y: 0 });
    expect(displayedPointToPdf(0, 0, { width: w, height: h, rotation: 180 })).toEqual({ x: w, y: 0 });
    expect(displayedPointToPdf(0, 0, { width: w, height: h, rotation: 270 })).toEqual({ x: w, y: h });
  });

  it('keeps every corner of the displayed page inside the MediaBox at every rotation', () => {
    const page = { width: 400, height: 300 } as const;
    for (const rotation of [0, 90, 180, 270] as const) {
      const geometry: PageGeometry = { ...page, rotation };
      const shown = displayedPageSize(geometry);
      for (const [sx, sy] of [[0, 0], [shown.width, 0], [0, shown.height], [shown.width, shown.height]]) {
        const p = displayedPointToPdf(sx!, sy!, geometry);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(page.width);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(page.height);
      }
    }
  });
});

describe('displayedPageSize', () => {
  it('swaps width and height on a quarter-turn only', () => {
    expect(displayedPageSize({ width: 400, height: 300, rotation: 0 })).toEqual({ width: 400, height: 300 });
    expect(displayedPageSize({ width: 400, height: 300, rotation: 90 })).toEqual({ width: 300, height: 400 });
    expect(displayedPageSize({ width: 400, height: 300, rotation: 180 })).toEqual({ width: 400, height: 300 });
    expect(displayedPageSize({ width: 400, height: 300, rotation: 270 })).toEqual({ width: 300, height: 400 });
  });
});

describe('normalizeRotation', () => {
  it('wraps negative and over-full-turn angles', () => {
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(360)).toBe(0);
  });
  it('snaps a non-conforming angle to the nearest quarter-turn instead of producing an invalid rotation', () => {
    expect(normalizeRotation(89)).toBe(90);
    expect(normalizeRotation(10)).toBe(0);
  });
});

describe('truncateToWidth', () => {
  const widthOf = (s: string) => s.length * 10; // 10 units per character

  it('leaves text that already fits untouched', () => {
    expect(truncateToWidth('abc', 100, widthOf)).toBe('abc');
  });

  it('cuts overlong text down and marks it with an ellipsis', () => {
    const out = truncateToWidth('abcdefghij', 50, widthOf);
    expect(out.endsWith('…')).toBe(true);
    expect(widthOf(out)).toBeLessThanOrEqual(50);
  });

  it('returns empty rather than overflowing when not even one character fits', () => {
    expect(truncateToWidth('abc', 5, widthOf)).toBe('');
    expect(truncateToWidth('abc', 0, widthOf)).toBe('');
  });
});

describe('isWinAnsiCompatible', () => {
  it('accepts plain Latin text', () => {
    expect(isWinAnsiCompatible('Hello World 123 !@#$%')).toBe(true);
  });

  it('accepts common smart-quote punctuation used by word processors', () => {
    expect(isWinAnsiCompatible('“Hello” — it’s a test…')).toBe(true);
  });

  it('rejects Arabic script', () => {
    expect(isWinAnsiCompatible('مرحبا بالعالم')).toBe(false);
  });

  it('rejects CJK script', () => {
    expect(isWinAnsiCompatible('你好世界')).toBe(false);
  });

  it('rejects Cyrillic script', () => {
    expect(isWinAnsiCompatible('привет мир')).toBe(false);
  });

  it('accepts an empty string', () => {
    expect(isWinAnsiCompatible('')).toBe(true);
  });
});

describe('imageFormatFromMimeType', () => {
  it('recognizes PNG', () => expect(imageFormatFromMimeType('image/png')).toBe('png'));
  it('recognizes JPEG (both spellings)', () => {
    expect(imageFormatFromMimeType('image/jpeg')).toBe('jpg');
    expect(imageFormatFromMimeType('image/jpg')).toBe('jpg');
  });
  it('returns null for an unsupported type', () => expect(imageFormatFromMimeType('image/gif')).toBeNull());
});

describe('applyOverlays', () => {
  it('adding a text overlay produces real, extractable text in the output (golden round-trip via an independent reader)', async () => {
    const src = fixture('single-page.pdf'); // 400x300pt
    const overlay: TextOverlay = {
      type: 'text',
      scale: 1,
      page: 0,
      rect: { x: 40, y: 40, width: 200, height: 30 },
      text: 'A brand new sentence added by the editor.',
      fontSize: 14,
      color: { r: 0, g: 0, b: 0 },
    };
    const out = await applyOverlays(src, [overlay]);

    expect((await PDFDocument.load(out)).getPageCount()).toBe(1);

    const pdfjsLib = await loadPdfjsForTests();
    const doc = await pdfjsLib.getDocument({ data: out }).promise;
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    const extracted = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    expect(extracted).toContain('A brand new sentence added by the editor.');
  });

  it('text alignment (center/right) actually shifts the glyph position, not just left-aligned regardless of the field', async () => {
    const src = fixture('single-page.pdf');
    const box = { x: 40, y: 40, width: 300, height: 30 };
    const base: Omit<TextOverlay, 'align'> = { type: 'text', scale: 1, page: 0, rect: box, text: 'Hi', fontSize: 14, color: { r: 0, g: 0, b: 0 } };

    const pdfjsLib = await loadPdfjsForTests();

    async function glyphX(align: TextOverlay['align']) {
      const out = await applyOverlays(src, [{ ...base, align }]);
      const doc = await pdfjsLib.getDocument({ data: out }).promise;
      const content = await (await doc.getPage(1)).getTextContent();
      const item = content.items.find((i) => 'str' in i && i.str === 'Hi');
      if (!item || !('transform' in item)) throw new Error('glyph not found');
      return item.transform[4] as number;
    }

    const leftX = await glyphX('left');
    const centerX = await glyphX('center');
    const rightX = await glyphX('right');
    expect(centerX).toBeGreaterThan(leftX);
    expect(rightX).toBeGreaterThan(centerX);
    expect(leftX).toBeCloseTo(box.x, 0); // left-aligned starts at the box's left edge
  });

  it('rejects non-Latin text with a typed error instead of a raw pdf-lib exception', async () => {
    const overlay: TextOverlay = {
      type: 'text',
      scale: 1,
      page: 0,
      rect: { x: 40, y: 40, width: 200, height: 30 },
      text: '你好世界',
      fontSize: 14,
      color: { r: 0, g: 0, b: 0 },
    };
    await expect(applyOverlays(fixture('single-page.pdf'), [overlay])).rejects.toThrow(PdfEngineError);
  });

  it('adding an image overlay produces a page that still renders (does not corrupt the document)', async () => {
    const overlay: ImageOverlay = {
      type: 'image',
      scale: 1,
      page: 0,
      rect: { x: 40, y: 40, width: 60, height: 60 },
      bytes: PNG_1X1,
      format: 'png',
    };
    const out = await applyOverlays(fixture('single-page.pdf'), [overlay]);
    const reopened = await PDFDocument.load(out);
    expect(reopened.getPageCount()).toBe(1);
    expect(reopened.getPage(0).node.Resources()?.has('XObject' as never)).toBeDefined();
  });

  it('the same image used twice is only embedded once (identity-cached)', async () => {
    const overlays: ImageOverlay[] = [
      { type: 'image', scale: 1, page: 0, rect: { x: 10, y: 10, width: 30, height: 30 }, bytes: PNG_1X1, format: 'png' },
      { type: 'image', scale: 1, page: 0, rect: { x: 200, y: 200, width: 30, height: 30 }, bytes: PNG_1X1, format: 'png' },
    ];
    // Should not throw, and should complete quickly (re-embedding is wasted
    // work, not a correctness bug, but this proves the cache path executes).
    const out = await applyOverlays(fixture('single-page.pdf'), overlays);
    expect((await PDFDocument.load(out)).getPageCount()).toBe(1);
  });

  it('adding a table overlay draws the expected grid and preserves page count', async () => {
    const overlay: TableOverlay = {
      type: 'table',
      scale: 1,
      page: 0,
      rect: { x: 40, y: 40, width: 200, height: 100 },
      rows: 2,
      cols: 3,
      cells: [
        ['A1', 'B1', 'C1'],
        ['A2', 'B2', 'C2'],
      ],
      fontSize: 10,
    };
    const out = await applyOverlays(fixture('single-page.pdf'), [overlay]);
    const reopened = await PDFDocument.load(out);
    expect(reopened.getPageCount()).toBe(1);
  });

  it('a table with non-Latin cell text is rejected with a typed error', async () => {
    const overlay: TableOverlay = {
      type: 'table',
      scale: 1,
      page: 0,
      rect: { x: 40, y: 40, width: 200, height: 100 },
      rows: 1,
      cols: 1,
      cells: [['привет']],
      fontSize: 10,
    };
    await expect(applyOverlays(fixture('single-page.pdf'), [overlay])).rejects.toThrow(PdfEngineError);
  });

  it('an overlay referencing a page index that does not exist is silently skipped, not a crash', async () => {
    const overlay: TextOverlay = {
      type: 'text',
      scale: 1,
      page: 99,
      rect: { x: 0, y: 0, width: 100, height: 20 },
      text: 'orphaned overlay',
      fontSize: 12,
      color: { r: 0, g: 0, b: 0 },
    };
    const out = await applyOverlays(fixture('single-page.pdf'), [overlay]);
    expect((await PDFDocument.load(out)).getPageCount()).toBe(1);
  });

  it('multiple overlays across a multi-page document each land on the correct page', async () => {
    const overlays: TextOverlay[] = [
      { type: 'text', scale: 1, page: 0, rect: { x: 10, y: 10, width: 100, height: 20 }, text: 'on page 1', fontSize: 12, color: { r: 0, g: 0, b: 0 } },
      { type: 'text', scale: 1, page: 9, rect: { x: 10, y: 10, width: 100, height: 20 }, text: 'on page 10', fontSize: 12, color: { r: 0, g: 0, b: 0 } },
    ];
    const out = await applyOverlays(fixture('multi-page-10.pdf'), overlays);
    expect((await PDFDocument.load(out)).getPageCount()).toBe(10);
  });

  it('respects the encrypted/corrupted/page-count guards already enforced by loadDocument', async () => {
    await expect(applyOverlays(fixture('zero-byte.pdf'), [])).rejects.toThrow(PdfEngineError);
  });

  // Regression: the editor used to export EVERY overlay at whichever page's render
  // scale happened to be current, so on a document with differing page sizes the
  // content on page 1 silently shifted once the user looked at page 2.
  it('honours each overlay\'s own capture scale instead of one document-wide scale', async () => {
    const pdfjsLib = await loadPdfjsForTests();
    const at = async (scale: number) => {
      const overlay: TextOverlay = {
        type: 'text', scale, page: 0, rect: { x: 40, y: 40, width: 200, height: 30 },
        text: 'SCALED', fontSize: 12, color: { r: 0, g: 0, b: 0 },
      };
      const out = await applyOverlays(fixture('single-page.pdf'), [overlay]);
      const doc = await pdfjsLib.getDocument({ data: out }).promise;
      const items = (await (await doc.getPage(1)).getTextContent()).items;
      const item = items.find((i) => 'str' in i && i.str === 'SCALED');
      if (!item || !('transform' in item)) throw new Error('glyph not found');
      return item.transform[4] as number;
    };
    // A rect captured at 2x zoom describes half as many points as the same rect at 1x.
    expect(await at(1)).toBeCloseTo(40, 0);
    expect(await at(2)).toBeCloseTo(20, 0);
  });

  it('places two overlays captured at different scales independently in one export', async () => {
    const pdfjsLib = await loadPdfjsForTests();
    const overlays: TextOverlay[] = [
      { type: 'text', scale: 1, page: 0, rect: { x: 40, y: 40, width: 200, height: 30 }, text: 'ATONE', fontSize: 12, color: { r: 0, g: 0, b: 0 } },
      { type: 'text', scale: 2, page: 1, rect: { x: 40, y: 40, width: 200, height: 30 }, text: 'ATTWO', fontSize: 12, color: { r: 0, g: 0, b: 0 } },
    ];
    const out = await applyOverlays(fixture('multi-page-10.pdf'), overlays);
    const doc = await pdfjsLib.getDocument({ data: out }).promise;
    const xOf = async (pageNo: number, str: string) => {
      const items = (await (await doc.getPage(pageNo)).getTextContent()).items;
      const item = items.find((i) => 'str' in i && i.str === str);
      if (!item || !('transform' in item)) throw new Error(`${str} not found`);
      return item.transform[4] as number;
    };
    expect(await xOf(1, 'ATONE')).toBeCloseTo(40, 0);
    expect(await xOf(2, 'ATTWO')).toBeCloseTo(20, 0);
  });

  // Regression: a /Rotate page is DISPLAYED a quarter-turn from its MediaBox, so
  // content placed at the top-left of what the user sees used to be written to the
  // top-RIGHT of the file, lying on its side (confirmed by rendering the export).
  //
  // rotated-pages.pdf holds one 400x300 page at each of 0/90/180/270. Identical
  // input must therefore produce an IDENTICAL displayed result on all four — same
  // device point, same upright glyph matrix — which is the whole contract in one line.
  it('places text identically on every page rotation, in displayed coordinates', async () => {
    const pdfjsLib = await loadPdfjsForTests();
    const rect = { x: 10, y: 10, width: 120, height: 20 };
    const out = await applyOverlays(
      fixture('rotated-pages.pdf'),
      [0, 1, 2, 3].map((page): TextOverlay => ({
        type: 'text', scale: 1, page, rect, text: 'PROBE', fontSize: 12, color: { r: 0, g: 0, b: 0 },
      })),
    );
    const doc = await pdfjsLib.getDocument({ data: out }).promise;

    for (let pageNo = 1; pageNo <= 4; pageNo++) {
      const page = await doc.getPage(pageNo);
      // pdf.js's default viewport applies /Rotate, so its device coordinates are
      // exactly what any reader shows — an independent check of "where the user sees it".
      const viewport = page.getViewport({ scale: 1 });
      const item = (await page.getTextContent()).items.find((i) => 'str' in i && i.str === 'PROBE');
      if (!item || !('transform' in item)) throw new Error(`PROBE missing on page ${pageNo}`);
      const [x, y] = viewport.convertToViewportPoint(item.transform[4] as number, item.transform[5] as number);
      expect([x, y]).toEqual([rect.x, rect.y + 12]); // baseline sits one font-size below the box top

      // Upright means the composed matrix advances along +x and has no shear:
      // a 180° flip would give a negative `a`, a sideways glyph a non-zero `b`.
      const [a, b] = pdfjsLib.Util.transform(viewport.transform, item.transform as number[]);
      expect(a).toBeCloseTo(12, 6);
      expect(b).toBeCloseTo(0, 6);
    }
  });

  it('an image on a rotated page lands where the user placed it', async () => {
    const overlays: ImageOverlay[] = [
      { type: 'image', scale: 1, page: 1, rect: { x: 10, y: 10, width: 50, height: 50 }, bytes: PNG_1X1, format: 'png' },
    ];
    const out = await applyOverlays(fixture('rotated-pages.pdf'), overlays);
    const reopened = await PDFDocument.load(out);
    expect(reopened.getPageCount()).toBe(4);
    expect(reopened.getPage(1).getRotation().angle).toBe(90);
  });

  // Regression: pdf-lib's own `maxWidth` wraps overflowing cell text onto extra
  // lines that run DOWNWARD through the cell border and off the bottom of the table.
  it('keeps overlong table cell text inside the table instead of wrapping it out of the grid', async () => {
    const pdfjsLib = await loadPdfjsForTests();
    const rect = { x: 40, y: 40, width: 200, height: 100 };
    const overlay: TableOverlay = {
      type: 'table', scale: 1, page: 0, rect, rows: 2, cols: 2,
      cells: [['A supremely long cell value that cannot possibly fit', 'B1'], ['A2', 'B2']],
      fontSize: 10,
    };
    const out = await applyOverlays(fixture('single-page.pdf'), [overlay]);
    const doc = await pdfjsLib.getDocument({ data: out }).promise;
    const page = await doc.getPage(1);
    const pageHeight = page.getViewport({ scale: 1 }).height;
    const drawn = (await page.getTextContent()).items.filter((i) => 'str' in i && i.str.trim() && !i.str.includes('Single page'));

    const tableTop = pageHeight - rect.y;
    const tableBottom = pageHeight - (rect.y + rect.height);
    for (const item of drawn) {
      if (!('transform' in item)) continue;
      const y = item.transform[5] as number;
      expect(y).toBeGreaterThanOrEqual(tableBottom);
      expect(y).toBeLessThanOrEqual(tableTop);
    }
    // The long value is cut down to one ellipsised line, never split across rows.
    const longCell = drawn.filter((i) => 'str' in i && i.str.startsWith('A supremely'));
    expect(longCell).toHaveLength(1);
    expect((longCell[0] as { str: string }).str.endsWith('…')).toBe(true);
  });
});

describe('createTextPdf', () => {
  it('produces a valid PDF with real, extractable text (golden round-trip via an independent reader)', async () => {
    const out = await createTextPdf('Invoice #48213\nBill to: Acme Corporation');
    expect((await PDFDocument.load(out)).getPageCount()).toBe(1);

    const pdfjsLib = await loadPdfjsForTests();
    const doc = await pdfjsLib.getDocument({ data: out }).promise;
    const content = await (await doc.getPage(1)).getTextContent();
    const extracted = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    expect(extracted).toContain('Invoice #48213');
    expect(extracted).toContain('Acme Corporation');
  });

  it('paginates long text across multiple pages instead of overflowing one page', async () => {
    const longText = Array.from({ length: 200 }, (_, i) => `Line ${i}`).join('\n');
    const out = await createTextPdf(longText);
    expect((await PDFDocument.load(out)).getPageCount()).toBeGreaterThan(1);
  });

  it('produces a single valid page for empty text rather than crashing', async () => {
    const out = await createTextPdf('');
    expect((await PDFDocument.load(out)).getPageCount()).toBe(1);
  });

  it('rejects non-Latin text with a typed error, consistent with applyOverlays', async () => {
    await expect(createTextPdf('你好世界')).rejects.toThrow(PdfEngineError);
  });

  it('accepts accented Western European text (the OCR tool supports Spanish/French/German/Portuguese)', async () => {
    const out = await createTextPdf('Café con leche — Straße — Endereço');
    expect((await PDFDocument.load(out)).getPageCount()).toBe(1);
  });
});
