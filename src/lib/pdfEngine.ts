/** Client-side PDF operations via @cantoo/pdf-lib — a PDF never leaves the device; dynamic-imported like ffmpeg.wasm in convert.ts. */
import type { PDFDocument as PDFDocumentType, SecurityOptions, EncryptionAlgorithm } from '@cantoo/pdf-lib';

// Page-count cap, not just file-size: memory is bound by decoded pixels/page. See PLAN-PDF-TOOLS.md §3.4.
export const MAX_PAGE_COUNT = 500;

export class PdfEngineError extends Error {
  constructor(
    message: string,
    public readonly code: 'encrypted' | 'too_many_pages' | 'invalid_pdf' | 'invalid_range' | 'wrong_password' | 'invalid_password',
  ) {
    super(message);
    this.name = 'PdfEngineError';
  }
}

async function loadPdfLib() {
  return import('@cantoo/pdf-lib');
}

/** Load and validate a PDF for editing — refuses encrypted documents rather than risk a silently corrupted export. */
export async function loadDocument(bytes: Uint8Array): Promise<PDFDocumentType> {
  const { PDFDocument } = await loadPdfLib();

  // Wraps read+inspect together, not just .load(): a truncated file can make
  // .load() resolve but throw an untyped TypeError lazily from getPageCount().
  let doc: PDFDocumentType;
  let pageCount: number;
  let encrypted: boolean;
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    encrypted = doc.isEncrypted;
    pageCount = doc.getPageCount();
  } catch {
    throw new PdfEngineError('This file could not be read as a PDF. It may be corrupted.', 'invalid_pdf');
  }

  if (encrypted) {
    throw new PdfEngineError('This PDF is password-protected and cannot be edited here.', 'encrypted');
  }
  if (pageCount > MAX_PAGE_COUNT) {
    throw new PdfEngineError(`This PDF has more than ${MAX_PAGE_COUNT} pages, which is too many to edit in the browser.`, 'too_many_pages');
  }
  // A real PDF always has ≥1 page; some truncated files parse "clean" with
  // zero pages via pdf-lib's repair logic — treat that as corruption too.
  if (pageCount === 0) {
    throw new PdfEngineError('This file could not be read as a PDF. It may be corrupted.', 'invalid_pdf');
  }
  return doc;
}

/** Checks encryption without needing a password — used to short-circuit the UI before asking for one. */
export async function isPdfEncrypted(bytes: Uint8Array): Promise<boolean> {
  const { PDFDocument } = await loadPdfLib();
  let doc: PDFDocumentType;
  let pageCount: number;
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    pageCount = doc.getPageCount();
  } catch {
    throw new PdfEngineError('This file could not be read as a PDF. It may be corrupted.', 'invalid_pdf');
  }
  // Same zero-page guard as loadDocument(): without it, a corrupt file that parses with zero
  // pages gets reported as simply "not protected" instead of corrupt.
  if (pageCount === 0) {
    throw new PdfEngineError('This file could not be read as a PDF. It may be corrupted.', 'invalid_pdf');
  }
  return doc.isEncrypted;
}

/**
 * Removes password protection by copying pages into a fresh document (like stripMetadata()) —
 * re-saving the decrypted doc directly still carries the /Encrypt dictionary through, verified empirically.
 */
export async function unlockPdf(bytes: Uint8Array, password: string): Promise<Uint8Array> {
  const { PDFDocument } = await loadPdfLib();
  let doc: PDFDocumentType;
  try {
    // Must always be a defined string, even '': pdf-lib's decrypt branch checks `!== undefined`,
    // not truthiness — and '' is the correct password for an owner-only-protected PDF.
    doc = await PDFDocument.load(bytes, { password });
  } catch {
    // Also catches rarer pdf-lib throws (unsupported encryption/algorithm), not just a wrong
    // password — an accepted simplification rather than sniffing library error text.
    throw new PdfEngineError("That password didn't open this file. Check for caps lock and try again.", 'wrong_password');
  }
  if (doc.getPageCount() > MAX_PAGE_COUNT) {
    throw new PdfEngineError(`This PDF has more than ${MAX_PAGE_COUNT} pages, which is too many to process in the browser.`, 'too_many_pages');
  }
  // Mirrors loadDocument()'s guard: a truncated file can parse "clean" with zero pages.
  if (doc.getPageCount() === 0) {
    throw new PdfEngineError('This file could not be read as a PDF. It may be corrupted.', 'invalid_pdf');
  }
  const out = await PDFDocument.create();
  const copied = await out.copyPages(doc, doc.getPageIndices());
  for (const page of copied) out.addPage(page);
  return out.save({ useObjectStreams: true });
}

export interface ProtectOptions {
  password: string;
  permissions?: SecurityOptions['permissions'];
  algorithm?: EncryptionAlgorithm;
}

// pdf-lib's permission bits are deny-by-default (omitted = restricted, verified empirically) —
// this all-permissive base stops a plain password gate from silently stripping every other right too.
const FULL_PERMISSIONS: Required<NonNullable<SecurityOptions['permissions']>> = {
  printing: 'highResolution',
  modifying: true,
  copying: true,
  annotating: true,
  fillingForms: true,
  contentAccessibility: true,
  documentAssembly: true,
};

/** Adds password protection. Reuses loadDocument(), whose hard-refuse-if-encrypted check is exactly the right guard here. */
export async function protectPdf(bytes: Uint8Array, opts: ProtectOptions): Promise<Uint8Array> {
  // pdf-lib throws a raw, untyped error for an empty password — catch it at the boundary.
  if (!opts.password) {
    throw new PdfEngineError('Enter a password to protect this PDF.', 'invalid_password');
  }
  const doc = await loadDocument(bytes);
  doc.encrypt({
    userPassword: opts.password,
    ownerPassword: opts.password,
    permissions: { ...FULL_PERMISSIONS, ...opts.permissions },
    algorithm: opts.algorithm,
  });
  return doc.save({ useObjectStreams: true });
}

export interface NamedPdf {
  name: string;
  bytes: Uint8Array;
}

/** Merge multiple PDFs, in the given order, into one document. */
export async function mergePdfs(files: NamedPdf[]): Promise<Uint8Array> {
  const { PDFDocument } = await loadPdfLib();
  const out = await PDFDocument.create();

  let totalPages = 0;
  for (const file of files) {
    const src = await loadDocument(file.bytes);
    totalPages += src.getPageCount();
    if (totalPages > MAX_PAGE_COUNT) {
      throw new PdfEngineError(`Merging these files would exceed the ${MAX_PAGE_COUNT}-page limit.`, 'too_many_pages');
    }
    const indices = src.getPages().map((_, i) => i);
    const copied = await out.copyPages(src, indices);
    for (const page of copied) out.addPage(page);
  }

  return out.save({ useObjectStreams: true });
}

/** Split a PDF into page ranges, e.g. "1-3,5,8-10". Returns one output file per range. */
export function parsePageRanges(spec: string, pageCount: number): number[][] {
  const ranges: number[][] = [];
  for (const part of spec.split(',').map((s) => s.trim()).filter(Boolean)) {
    // Whitespace around the dash is allowed: "1 - 3" is what people paste out of
    // a table of contents, and rejecting it reads as a broken input, not a rule.
    const match = /^(\d+)\s*(?:-\s*(\d+))?$/.exec(part);
    if (!match) throw new PdfEngineError(`"${part}" is not a valid page or range.`, 'invalid_range');
    const start = parseInt(match[1]!, 10);
    const end = match[2] ? parseInt(match[2], 10) : start;
    if (end < start) {
      throw new PdfEngineError(`"${part}" runs backwards — write it as "${end}-${start}".`, 'invalid_range');
    }
    if (start < 1 || end > pageCount) {
      throw new PdfEngineError(`"${part}" is out of range for a ${pageCount}-page document.`, 'invalid_range');
    }
    const indices: number[] = [];
    for (let p = start; p <= end; p++) indices.push(p - 1); // 0-indexed internally
    ranges.push(indices);
  }
  if (!ranges.length) throw new PdfEngineError('Enter at least one page or range.', 'invalid_range');
  return ranges;
}

export async function splitPdf(bytes: Uint8Array, ranges: number[][]): Promise<Uint8Array[]> {
  const { PDFDocument } = await loadPdfLib();
  const src = await loadDocument(bytes);

  const outputs: Uint8Array[] = [];
  for (const indices of ranges) {
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, indices);
    for (const page of copied) out.addPage(page);
    outputs.push(await out.save({ useObjectStreams: true }));
  }
  return outputs;
}

export type RotationDegrees = 0 | 90 | 180 | 270;

/** Rotate/delete/reorder in one pass. `order` indexes the ORIGINAL document; pages not listed are dropped. */
export async function applyPageOps(
  bytes: Uint8Array,
  order: number[],
  rotations: Map<number, RotationDegrees>,
): Promise<Uint8Array> {
  const { PDFDocument, degrees } = await loadPdfLib();
  const src = await loadDocument(bytes);
  const out = await PDFDocument.create();

  const copied = await out.copyPages(src, order);
  copied.forEach((page, i) => {
    const originalIndex = order[i]!;
    const rotation = rotations.get(originalIndex);
    if (rotation !== undefined) {
      page.setRotation(degrees((page.getRotation().angle + rotation) % 360));
    }
    out.addPage(page);
  });

  return out.save({ useObjectStreams: true });
}

export async function getPageCount(bytes: Uint8Array): Promise<number> {
  const doc = await loadDocument(bytes);
  return doc.getPageCount();
}

/** Strips metadata by rebuilding through a fresh PDFDocument — @cantoo/pdf-lib exposes no API to delete the catalog's XMP stream directly, but a freshly-created document verifiably never carries the source's Info dict forward. */
export async function stripMetadata(bytes: Uint8Array): Promise<Uint8Array> {
  const { PDFDocument } = await loadPdfLib();
  const src = await loadDocument(bytes);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, src.getPages().map((_, i) => i));
  for (const page of copied) out.addPage(page);
  return out.save({ useObjectStreams: true });
}

// ── Phase 3: add new content (text / image / table) ─────────────────
// Three coordinate systems meet here: SCREEN (CSS px, top-left, overlay's own scale) →
// DISPLAYED (points, top-left, /Rotate applied) → PDF user space (points, bottom-left, unrotated) — pdf-lib only draws in the last.

export interface OverlayRect {
  /** Screen-space, top-left origin, in CSS pixels at the overlay's render scale. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export type TextAlign = 'left' | 'center' | 'right';

/** Each overlay carries its own render scale — page sizes can vary within a document, so a document-wide scale misplaces content. */
interface OverlayBase {
  page: number; // 0-indexed
  rect: OverlayRect;
  scale: number;
}

export interface TextOverlay extends OverlayBase {
  type: 'text';
  text: string;
  fontSize: number;
  color: { r: number; g: number; b: number }; // 0-1 range, matching pdf-lib's rgb()
  align?: TextAlign;
}

export interface ImageOverlay extends OverlayBase {
  type: 'image';
  bytes: Uint8Array;
  format: 'png' | 'jpg';
}

export interface TableOverlay extends OverlayBase {
  type: 'table';
  rows: number;
  cols: number;
  cells: string[][]; // [row][col], length must match rows/cols
  fontSize: number;
}

export type Overlay = TextOverlay | ImageOverlay | TableOverlay;

/** MediaBox size in points plus the page's /Rotate — the page the user sees is this box turned by that angle. */
export interface PageGeometry {
  width: number;
  height: number;
  rotation: RotationDegrees;
}

/** Normalizes any /Rotate value (negative, >360, or non-conforming) to the four angles a PDF page can actually be displayed at. */
export function normalizeRotation(angle: number): RotationDegrees {
  const wrapped = ((Math.round(angle / 90) * 90) % 360 + 360) % 360;
  return wrapped as RotationDegrees;
}

/** Screen px → displayed points. */
export function overlayToDisplayedRect(rect: OverlayRect, scale: number): OverlayRect {
  return { x: rect.x / scale, y: rect.y / scale, width: rect.width / scale, height: rect.height / scale };
}

/** Displayed point (top-left, /Rotate applied) → PDF user-space point (bottom-left, unrotated) — pair with `rotate: degrees(page.rotation)` when drawing. */
export function displayedPointToPdf(x: number, y: number, page: PageGeometry): { x: number; y: number } {
  switch (page.rotation) {
    case 90:
      return { x: y, y: x };
    case 180:
      return { x: page.width - x, y };
    case 270:
      return { x: page.width - y, y: page.height - x };
    default:
      return { x, y: page.height - y };
  }
}

/** The page size the user sees — width and height swap on a quarter-turn. */
export function displayedPageSize(page: PageGeometry): { width: number; height: number } {
  return page.rotation === 90 || page.rotation === 270
    ? { width: page.height, height: page.width }
    : { width: page.width, height: page.height };
}

/** Shortens text to fit `maxWidth`, with an ellipsis — a cell must never spill outside its own borders. */
export function truncateToWidth(text: string, maxWidth: number, widthOf: (s: string) => number): string {
  if (maxWidth <= 0) return '';
  if (widthOf(text) <= maxWidth) return text;
  let end = text.length;
  while (end > 0 && widthOf(`${text.slice(0, end)}…`) > maxWidth) end -= 1;
  return end > 0 ? `${text.slice(0, end)}…` : '';
}

/** WinAnsi is all StandardFonts embeds without a 4th (fontkit) dependency — checked up front so we reject cleanly instead of pdf-lib throwing mid-export. */
export function isWinAnsiCompatible(text: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\xFF‘’“”–—…]*$/.test(text);
}

const TABLE_CELL_PADDING = 4;

/** Draws every overlay and exports. Each overlay carries the render scale its rect was captured at. */
export async function applyOverlays(bytes: Uint8Array, overlays: Overlay[]): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb, degrees } = await loadPdfLib();
  const doc = await loadDocument(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  // Cache embedded images by identity so the same uploaded image used on
  // several pages/objects is only embedded once.
  const imageCache = new Map<Uint8Array, Awaited<ReturnType<PDFDocumentType['embedPng']>>>();
  const pages = doc.getPages();

  for (const overlay of overlays) {
    const page = pages[overlay.page];
    if (!page) continue; // an overlay referencing a page that no longer exists is silently skipped

    const geometry: PageGeometry = {
      width: page.getWidth(),
      height: page.getHeight(),
      rotation: normalizeRotation(page.getRotation().angle),
    };
    // Computed in DISPLAYED space, converted point-by-point at draw time — drawing at `rotate`
    // cancels the page's own /Rotate so content lands upright where it was placed.
    const rotate = degrees(geometry.rotation);
    const { x, y, width, height } = overlayToDisplayedRect(overlay.rect, overlay.scale);
    const at = (px: number, py: number) => displayedPointToPdf(px, py, geometry);

    if (overlay.type === 'text') {
      if (!isWinAnsiCompatible(overlay.text)) {
        throw new PdfEngineError('This text uses characters that cannot be added in this editor yet (Latin script only).', 'invalid_pdf');
      }
      const lineHeight = overlay.fontSize * 1.2;
      const align = overlay.align ?? 'left';
      overlay.text.split('\n').forEach((line, i) => {
        const lineWidth = font.widthOfTextAtSize(line, overlay.fontSize);
        const lineX = align === 'center' ? x + (width - lineWidth) / 2 : align === 'right' ? x + width - lineWidth : x;
        const baseline = at(lineX, y + overlay.fontSize + i * lineHeight);
        page.drawText(line, {
          x: baseline.x,
          y: baseline.y,
          size: overlay.fontSize,
          font,
          color: rgb(overlay.color.r, overlay.color.g, overlay.color.b),
          rotate,
        });
      });
    } else if (overlay.type === 'image') {
      let embedded = imageCache.get(overlay.bytes);
      if (!embedded) {
        embedded = overlay.format === 'png' ? await doc.embedPng(overlay.bytes) : await doc.embedJpg(overlay.bytes);
        imageCache.set(overlay.bytes, embedded);
      }
      // pdf-lib anchors an image at its bottom-left and rotates about that same
      // point, so the anchor is the box's visually-lower-left corner.
      const anchor = at(x, y + height);
      page.drawImage(embedded, { x: anchor.x, y: anchor.y, width, height, rotate });
    } else if (overlay.type === 'table') {
      const rowHeight = height / overlay.rows;
      const colWidth = width / overlay.cols;
      for (let r = 0; r <= overlay.rows; r++) {
        page.drawLine({ start: at(x, y + r * rowHeight), end: at(x + width, y + r * rowHeight), thickness: 1 });
      }
      for (let c = 0; c <= overlay.cols; c++) {
        page.drawLine({ start: at(x + c * colWidth, y), end: at(x + c * colWidth, y + height), thickness: 1 });
      }
      for (let r = 0; r < overlay.rows; r++) {
        for (let c = 0; c < overlay.cols; c++) {
          const cellText = overlay.cells[r]?.[c];
          if (!cellText) continue;
          if (!isWinAnsiCompatible(cellText)) {
            throw new PdfEngineError('This text uses characters that cannot be added in this editor yet (Latin script only).', 'invalid_pdf');
          }
          // Truncated, not wrapped: pdf-lib's own `maxWidth` wrapping pushes extra
          // lines DOWNWARD, straight through the cell border and off the table.
          const fitted = truncateToWidth(cellText, colWidth - TABLE_CELL_PADDING * 2, (s) => font.widthOfTextAtSize(s, overlay.fontSize));
          if (!fitted) continue;
          const baseline = at(
            x + c * colWidth + TABLE_CELL_PADDING,
            y + (r + 1) * rowHeight - rowHeight / 2 + overlay.fontSize / 2,
          );
          page.drawText(fitted, { x: baseline.x, y: baseline.y, size: overlay.fontSize, font, rotate });
        }
      }
    }
  }

  return doc.save({ useObjectStreams: true });
}

// Re-exported so the editor UI doesn't need a separate pdf-lib import just to detect an
// uploaded image's format before building an ImageOverlay.
export function imageFormatFromMimeType(mimeType: string): 'png' | 'jpg' | null {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return 'jpg';
  return null;
}

const TEXT_PDF_PAGE = { width: 595, height: 842 }; // A4 in points
const TEXT_PDF_MARGIN = 50;
const TEXT_PDF_FONT_SIZE = 11;

/**
 * Builds a simple paginated PDF from plain text — used to export OCR/extracted text as a document.
 * StandardFonts.Helvetica is WinAnsi-only (Latin script) — same constraint as applyOverlays.
 */
export async function createTextPdf(text: string): Promise<Uint8Array> {
  if (!isWinAnsiCompatible(text)) {
    throw new PdfEngineError('This text uses characters that cannot be exported to PDF yet (Latin script only).', 'invalid_pdf');
  }
  const { PDFDocument, StandardFonts } = await loadPdfLib();
  const { wrapLines } = await import('./textToImage');
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const maxWidth = TEXT_PDF_PAGE.width - TEXT_PDF_MARGIN * 2;
  const lineHeight = TEXT_PDF_FONT_SIZE * 1.4;
  const linesPerPage = Math.floor((TEXT_PDF_PAGE.height - TEXT_PDF_MARGIN * 2) / lineHeight);
  const lines = wrapLines(text || ' ', (s) => font.widthOfTextAtSize(s, TEXT_PDF_FONT_SIZE), maxWidth);

  for (let i = 0; i < lines.length; i += linesPerPage) {
    const page = doc.addPage([TEXT_PDF_PAGE.width, TEXT_PDF_PAGE.height]);
    const pageLines = lines.slice(i, i + linesPerPage);
    pageLines.forEach((line, row) => {
      if (!line) return;
      page.drawText(line, {
        x: TEXT_PDF_MARGIN,
        y: TEXT_PDF_PAGE.height - TEXT_PDF_MARGIN - row * lineHeight,
        size: TEXT_PDF_FONT_SIZE,
        font,
      });
    });
  }
  if (lines.length === 0) doc.addPage([TEXT_PDF_PAGE.width, TEXT_PDF_PAGE.height]);

  return doc.save({ useObjectStreams: true });
}
