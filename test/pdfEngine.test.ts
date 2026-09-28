import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument } from '@cantoo/pdf-lib';
import {
  loadDocument,
  mergePdfs,
  splitPdf,
  parsePageRanges,
  applyPageOps,
  getPageCount,
  stripMetadata,
  isPdfEncrypted,
  unlockPdf,
  protectPdf,
  PdfEngineError,
  MAX_PAGE_COUNT,
} from '@/lib/pdfEngine';

const fixturesDir = path.join(__dirname, 'fixtures', 'pdf');
const fixture = (name: string) => new Uint8Array(readFileSync(path.join(fixturesDir, name)));

// Matches test/fixtures/generate.mjs's ENCRYPTED_FIXTURE_PASSWORD — keep in sync if it changes.
const ENCRYPTED_FIXTURE_PASSWORD = 'test1234';

describe('loadDocument', () => {
  it('loads a valid PDF and reports its page count', async () => {
    const doc = await loadDocument(fixture('single-page.pdf'));
    expect(doc.getPageCount()).toBe(1);
  });

  it('rejects a zero-byte file with a typed, non-crashing error', async () => {
    await expect(loadDocument(fixture('zero-byte.pdf'))).rejects.toThrow(PdfEngineError);
    await expect(loadDocument(fixture('zero-byte.pdf'))).rejects.toMatchObject({ code: 'invalid_pdf' });
  });

  it('rejects a truncated file that fails to parse at all with a typed error, not a raw parser exception', async () => {
    // Verified empirically: at this truncation depth, @cantoo/pdf-lib throws
    // an untyped internal TypeError. loadDocument()'s catch-all must convert it.
    const promise = loadDocument(fixture('truncated-throws.pdf'));
    await expect(promise).rejects.toThrow(PdfEngineError);
    await expect(promise).rejects.toMatchObject({ code: 'invalid_pdf' });
  });

  it('rejects a truncated file that "successfully" parses with zero pages (silent-corruption case)', async () => {
    // Verified empirically: pdf-lib's repair logic returns a zero-page document without
    // throwing, so without an explicit guard this would silently pass validation.
    const promise = loadDocument(fixture('truncated-zero-pages.pdf'));
    await expect(promise).rejects.toThrow(PdfEngineError);
    await expect(promise).rejects.toMatchObject({ code: 'invalid_pdf' });
  });

  it('rejects a document over the page-count cap', async () => {
    const big = await PDFDocument.create();
    for (let i = 0; i < MAX_PAGE_COUNT + 1; i++) big.addPage([50, 50]);
    const bytes = await big.save();
    await expect(loadDocument(bytes)).rejects.toMatchObject({ code: 'too_many_pages' });
  });

  it('accepts a document exactly at the page-count cap', async () => {
    const atCap = await PDFDocument.create();
    for (let i = 0; i < MAX_PAGE_COUNT; i++) atCap.addPage([50, 50]);
    const bytes = await atCap.save();
    const doc = await loadDocument(bytes);
    expect(doc.getPageCount()).toBe(MAX_PAGE_COUNT);
  });
});

describe('mergePdfs', () => {
  it('merges two documents in order and preserves total page count', async () => {
    const a = fixture('single-page.pdf');
    const b = fixture('rotated-pages.pdf'); // 4 pages
    const merged = await mergePdfs([{ name: 'a.pdf', bytes: a }, { name: 'b.pdf', bytes: b }]);
    expect(await getPageCount(merged)).toBe(1 + 4);
  });

  it('the merged output re-opens cleanly with no corruption (golden round-trip)', async () => {
    const merged = await mergePdfs([
      { name: 'a.pdf', bytes: fixture('single-page.pdf') },
      { name: 'b.pdf', bytes: fixture('multi-page-10.pdf') },
    ]);
    const reopened = await PDFDocument.load(merged);
    expect(reopened.getPageCount()).toBe(11);
  });

  it('refuses a merge that would exceed the page-count cap', async () => {
    const big = await PDFDocument.create();
    for (let i = 0; i < MAX_PAGE_COUNT; i++) big.addPage([50, 50]);
    const bigBytes = await big.save();
    await expect(
      mergePdfs([{ name: 'big.pdf', bytes: bigBytes }, { name: 'one-more.pdf', bytes: fixture('single-page.pdf') }]),
    ).rejects.toMatchObject({ code: 'too_many_pages' });
  });

  it('dropping the source Info-dictionary metadata on merge is real, not assumed (verified via read-back)', async () => {
    const src = await PDFDocument.create();
    src.setTitle('Secret Title');
    src.setAuthor('Secret Author');
    src.addPage([100, 100]);
    const srcBytes = await src.save();

    const merged = await mergePdfs([{ name: 'src.pdf', bytes: srcBytes }]);
    const reopened = await PDFDocument.load(merged);
    expect(reopened.getTitle()).toBeUndefined();
    expect(reopened.getAuthor()).toBeUndefined();
  });
});

describe('parsePageRanges', () => {
  it('parses a mix of single pages and ranges', () => {
    const ranges = parsePageRanges('1-3,5,8-10', 10);
    expect(ranges).toEqual([[0, 1, 2], [4], [7, 8, 9]]);
  });

  it('rejects an out-of-range page number', () => {
    expect(() => parsePageRanges('1-3,99', 10)).toThrow(PdfEngineError);
  });

  it('rejects a malformed range (end before start) and says how to write it, rather than blaming the page count', () => {
    expect(() => parsePageRanges('5-2', 10)).toThrow(PdfEngineError);
    // The old message claimed "out of range for a 10-page document", which is
    // simply untrue for 5-2 and sends the user looking for the wrong mistake.
    expect(() => parsePageRanges('5-2', 10)).toThrow(/runs backwards/);
  });

  it('accepts the spacing people actually paste ("1 - 3", "1-3, 5")', () => {
    expect(parsePageRanges('1 - 3', 10)).toEqual([[0, 1, 2]]);
    expect(parsePageRanges(' 2 ,  4 - 5 ', 10)).toEqual([[1], [3, 4]]);
  });

  it('accepts zero-padded page numbers', () => {
    expect(parsePageRanges('01-03', 10)).toEqual([[0, 1, 2]]);
  });

  it('rejects garbage input', () => {
    expect(() => parsePageRanges('one to five', 10)).toThrow(PdfEngineError);
    expect(() => parsePageRanges('1-3-5', 10)).toThrow(PdfEngineError);
    expect(() => parsePageRanges('1-', 10)).toThrow(PdfEngineError);
    expect(() => parsePageRanges('-3', 10)).toThrow(PdfEngineError);
  });

  it('rejects an empty or whitespace-only spec', () => {
    expect(() => parsePageRanges('', 10)).toThrow(PdfEngineError);
    expect(() => parsePageRanges('   ', 10)).toThrow(PdfEngineError);
    expect(() => parsePageRanges(',,,', 10)).toThrow(PdfEngineError);
  });

  it('rejects page 0 — pages are 1-indexed for the user', () => {
    expect(() => parsePageRanges('0', 10)).toThrow(PdfEngineError);
    expect(() => parsePageRanges('0-2', 10)).toThrow(PdfEngineError);
  });
});

describe('splitPdf', () => {
  it('splits a 10-page document into the requested ranges with correct page counts', async () => {
    const src = fixture('multi-page-10.pdf');
    const ranges = parsePageRanges('1-3,5,8-10', 10);
    const outputs = await splitPdf(src, ranges);
    expect(outputs).toHaveLength(3);
    expect(await getPageCount(outputs[0]!)).toBe(3);
    expect(await getPageCount(outputs[1]!)).toBe(1);
    expect(await getPageCount(outputs[2]!)).toBe(3);
  });

  it('each split output re-opens cleanly (golden round-trip)', async () => {
    const outputs = await splitPdf(fixture('multi-page-10.pdf'), parsePageRanges('1,10', 10));
    for (const out of outputs) {
      const reopened = await PDFDocument.load(out);
      expect(reopened.getPageCount()).toBe(1);
    }
  });
});

describe('applyPageOps (rotate / reorder / delete)', () => {
  it('reorders pages: output page order matches the requested index sequence', async () => {
    const src = fixture('multi-page-10.pdf');
    const reversed = [...Array(10).keys()].reverse();
    const out = await applyPageOps(src, reversed, new Map());
    expect(await getPageCount(out)).toBe(10);
  });

  it('deleting pages is real: omitted indices do not appear in the output', async () => {
    const src = fixture('multi-page-10.pdf');
    const keepOnlyFirstThree = [0, 1, 2];
    const out = await applyPageOps(src, keepOnlyFirstThree, new Map());
    expect(await getPageCount(out)).toBe(3);
  });

  it('rotation is applied additively to whatever rotation the page already had', async () => {
    const src = fixture('rotated-pages.pdf'); // pages are 0/90/180/270
    const out = await applyPageOps(src, [0, 1, 2, 3], new Map([[1, 90]]));
    const reopened = await PDFDocument.load(out);
    // original page index 1 had 90; +90 more = 180
    expect(reopened.getPage(1).getRotation().angle).toBe(180);
  });

  it('rotation wraps correctly at 360 degrees', async () => {
    const src = fixture('rotated-pages.pdf');
    const out = await applyPageOps(src, [0, 1, 2, 3], new Map([[3, 90]])); // 270 + 90 = 360 -> 0
    const reopened = await PDFDocument.load(out);
    expect(reopened.getPage(3).getRotation().angle).toBe(0);
  });

  it('the output re-opens cleanly after combined reorder+rotate+delete (golden round-trip)', async () => {
    const src = fixture('multi-page-10.pdf');
    const out = await applyPageOps(src, [3, 1, 0], new Map([[3, 90]]));
    const reopened = await PDFDocument.load(out);
    expect(reopened.getPageCount()).toBe(3);
  });
});

describe('stripMetadata', () => {
  it('removes Title/Author from a document that has them set (verified via read-back, not assumed)', async () => {
    const src = await PDFDocument.create();
    src.setTitle('Secret Title');
    src.setAuthor('Secret Author');
    src.addPage([100, 100]);
    const bytes = await src.save();

    const stripped = await stripMetadata(bytes);
    const reopened = await PDFDocument.load(stripped);
    expect(reopened.getTitle()).toBeUndefined();
    expect(reopened.getAuthor()).toBeUndefined();
  });

  it('preserves page content and count while stripping metadata', async () => {
    const stripped = await stripMetadata(fixture('multi-page-10.pdf'));
    expect(await getPageCount(stripped)).toBe(10);
  });
});

describe('loadDocument — real encrypted PDFs', () => {
  it('refuses a real encrypted PDF instead of silently producing a corrupted export', async () => {
    await expect(loadDocument(fixture('encrypted-user-password.pdf'))).rejects.toMatchObject({ code: 'encrypted' });
  });

  it('refuses an owner-only-protected PDF the same way, even though it has no open password', async () => {
    await expect(loadDocument(fixture('encrypted-owner-only.pdf'))).rejects.toMatchObject({ code: 'encrypted' });
  });
});

describe('isPdfEncrypted', () => {
  it('is false for a normal PDF', async () => {
    expect(await isPdfEncrypted(fixture('single-page.pdf'))).toBe(false);
  });

  it('is true for an encrypted PDF, without needing a password', async () => {
    expect(await isPdfEncrypted(fixture('encrypted-user-password.pdf'))).toBe(true);
    expect(await isPdfEncrypted(fixture('encrypted-owner-only.pdf'))).toBe(true);
  });

  it('rejects a corrupted file with a typed error', async () => {
    await expect(isPdfEncrypted(fixture('zero-byte.pdf'))).rejects.toMatchObject({ code: 'invalid_pdf' });
  });

  // Regression: this fixture parses "clean" with zero pages, so without this guard the Unlock UI
  // told users their corrupt file simply "isn't password-protected".
  it('rejects a truncated file that parses with zero pages, rather than calling it unprotected', async () => {
    await expect(isPdfEncrypted(fixture('truncated-zero-pages.pdf'))).rejects.toMatchObject({ code: 'invalid_pdf' });
  });
});

describe('unlockPdf', () => {
  it('removes protection with the right password, preserving page content', async () => {
    const out = await unlockPdf(fixture('encrypted-user-password.pdf'), ENCRYPTED_FIXTURE_PASSWORD);
    const reopened = await PDFDocument.load(out);
    expect(reopened.isEncrypted).toBe(false);
    expect(reopened.getPageCount()).toBe(1);
  });

  it('rejects a wrong password with a typed error', async () => {
    await expect(unlockPdf(fixture('encrypted-user-password.pdf'), 'not-the-password')).rejects.toMatchObject({ code: 'wrong_password' });
  });

  // Easy to get wrong: an owner-only-protected PDF has no user password, so the EMPTY string is
  // correct — a UI that disables Unlock on an empty field would make this common case unreachable.
  it('unlocks an owner-only-protected PDF with an empty-string password', async () => {
    const out = await unlockPdf(fixture('encrypted-owner-only.pdf'), '');
    const reopened = await PDFDocument.load(out);
    expect(reopened.isEncrypted).toBe(false);
    expect(reopened.getPageCount()).toBe(1);
  });

});

describe('protectPdf', () => {
  it('the protected output re-opens with the given password (golden round-trip)', async () => {
    const out = await protectPdf(fixture('multi-page-10.pdf'), { password: 'secret123' });
    const reopened = await PDFDocument.load(out, { password: 'secret123' });
    expect(reopened.getPageCount()).toBe(10);
  });

  it('refuses an empty password with a typed error, not pdf-lib\'s raw internal message', async () => {
    await expect(protectPdf(fixture('single-page.pdf'), { password: '' })).rejects.toMatchObject({ code: 'invalid_password' });
  });

  it('refuses to double-protect an already-encrypted PDF', async () => {
    await expect(protectPdf(fixture('encrypted-user-password.pdf'), { password: 'new-pw' })).rejects.toMatchObject({ code: 'encrypted' });
  });

  // Regression: pdf-lib's deny-by-default bits used to make omitted `permissions` block
  // everything (`/P -3904`); protectPdf() now merges onto an allow-everything default (`/P -4`).
  it('defaults to fully-permissive permissions when none are specified', async () => {
    const out = await protectPdf(fixture('single-page.pdf'), { password: 'pw' });
    const raw = Buffer.from(out).toString('latin1');
    expect(raw).toMatch(/\/P -4(?!\d)/);
  });

  it('an explicit permission restriction is honored alongside the rest defaulting to allowed', async () => {
    const out = await protectPdf(fixture('single-page.pdf'), { password: 'pw', permissions: { printing: false } });
    const raw = Buffer.from(out).toString('latin1');
    expect(raw).not.toMatch(/\/P -4(?!\d)/);
  });
});
