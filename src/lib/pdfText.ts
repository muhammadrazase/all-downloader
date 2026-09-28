/**
 * Client-side PDF text extraction via pdf.js — only extracted text ever
 * leaves the device. Text-layer documents only (see PLAN-PDF-TOOLS.md §8);
 * a scanned PDF reports `no_text_layer` rather than silently invoking OCR.
 */

export class PdfTextError extends Error {
  constructor(
    message: string,
    public readonly code: 'invalid_pdf' | 'no_text_layer' | 'too_many_pages',
  ) {
    super(message);
    this.name = 'PdfTextError';
  }
}

// Matches PdfEngineError's cap — a page-count ceiling protects memory
// regardless of which tool is reading the file.
const MAX_PAGE_COUNT = 500;

export interface ExtractedText {
  text: string;
  pageCount: number;
}

async function loadPdfjs() {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf/pdf.worker.min.mjs';
  return pdfjsLib;
}

/** Extracts text page by page; throws `no_text_layer` for a scanned/image PDF (expected, not a crash). */
export async function extractPdfText(bytes: Uint8Array): Promise<ExtractedText> {
  const pdfjsLib = await loadPdfjs();

  let doc;
  try {
    // Hardening (§5.1): no XFA, no system-font fallback. `isEvalSupported`
    // was removed upstream in this pdfjs-dist version — nothing to set for it.
    doc = await pdfjsLib.getDocument({
      data: bytes,
      enableXfa: false,
      useSystemFonts: false,
    }).promise;
  } catch {
    throw new PdfTextError('This file could not be read as a PDF. It may be corrupted.', 'invalid_pdf');
  }

  if (doc.numPages > MAX_PAGE_COUNT) {
    throw new PdfTextError(`This PDF has more than ${MAX_PAGE_COUNT} pages, which is too many to summarize.`, 'too_many_pages');
  }
  if (doc.numPages === 0) {
    throw new PdfTextError('This file could not be read as a PDF. It may be corrupted.', 'invalid_pdf');
  }

  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    parts.push(pageText);
    page.cleanup();
  }

  const text = parts.join('\n\n').replace(/[ \t]+/g, ' ').trim();
  if (!text) {
    throw new PdfTextError(
      'This looks like a scanned document with no selectable text. Try our OCR tool to extract text from it first.',
      'no_text_layer',
    );
  }

  return { text, pageCount: doc.numPages };
}
