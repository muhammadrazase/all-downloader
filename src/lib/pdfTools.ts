import type { Faq } from './platforms';

/** Registry for the PDF tool pages, mirrors converterTools.ts. Merge/split stay their own lightweight tool (not a PdfEditorBox "mode") for real code-splitting on these high-traffic pages. */
export type PdfToolKey = 'merge-pdf' | 'split-pdf' | 'pdf-summary' | 'pdf-editor' | 'protect-pdf' | 'unlock-pdf' | 'pdf-to-jpg';

export interface PdfTool {
  key: PdfToolKey;
  slug: string;
  name: string;
  keyword: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  features: { title: string; body: string }[];
  steps: string[];
  faqs: Faq[];
}

const PRIVACY_FEATURE = { title: '100% private', body: 'Your PDF is processed in your browser and never uploaded — open DevTools → Network and see for yourself.' };
const FREE_FEATURE = { title: 'Free & unlimited', body: 'No signup, no watermark, no per-day limit.' };

// The Summarizer is NOT the same privacy tier as merge/split: extracted text
// (not the file) is sent to a third-party AI provider. Say so plainly rather
// than reusing the "100% private, never uploaded" feature line unmodified.
const AI_DISCLOSURE_FEATURE = {
  title: 'Text sent to AI, file never uploaded',
  body: 'Your PDF is read in your browser and only the extracted text — not the file — is sent to Google Gemini or Groq to generate the summary.',
};

export const PDF_TOOLS: Record<PdfToolKey, PdfTool> = {
  'merge-pdf': {
    key: 'merge-pdf',
    slug: 'merge-pdf',
    name: 'Merge PDF',
    keyword: 'merge PDF',
    metaTitle: 'Merge PDF Files Online Free — Combine PDFs in Your Browser',
    metaDescription:
      'Merge multiple PDF files into one, free and private. Drop your PDFs, reorder them, and download the combined file — nothing is ever uploaded.',
    h1: 'Merge PDF files — free, and never uploaded',
    intro:
      'Combine multiple PDFs into a single file, right in your browser. Drop your files, put them in order, and download the merged PDF — nothing leaves your device.',
    features: [
      { title: 'Any order', body: 'Drag files into the order you want before merging.' },
      PRIVACY_FEATURE,
      { title: 'No size games', body: 'No artificial page or file-count limits designed to upsell a paid plan.' },
      FREE_FEATURE,
    ],
    steps: [
      'Drop two or more PDF files into the box above.',
      'Drag to reorder them if needed.',
      'Press “Merge PDFs”.',
      'Download the combined file.',
    ],
    faqs: [
      { q: 'Is my PDF uploaded to a server?', a: 'No. Merging runs entirely in your browser using WebAssembly — your files never leave your device. You can verify this yourself: open your browser\'s DevTools, go to the Network tab, and merge a file with Wi-Fi off.' },
      { q: 'Is there a limit on how many PDFs I can merge?', a: 'No artificial limit — the practical ceiling is your device\'s memory for very large documents.' },
      { q: 'Will this work on a password-protected PDF?', a: 'Not currently — encrypted PDFs are detected and refused with a clear message rather than producing a broken file.' },
      { q: 'Is it free?', a: 'Yes — free, no signup, no watermark.' },
    ],
  },
  'split-pdf': {
    key: 'split-pdf',
    slug: 'split-pdf',
    name: 'Split PDF',
    keyword: 'split PDF',
    metaTitle: 'Split PDF Online Free — Extract Pages in Your Browser',
    metaDescription:
      'Split a PDF into separate files by page range, free and private. Drop your PDF, choose the pages, and download — nothing is ever uploaded.',
    h1: 'Split a PDF — free, and never uploaded',
    intro:
      'Pull specific pages or ranges out of a PDF into their own files, right in your browser. Nothing is uploaded — you can verify that yourself in DevTools.',
    features: [
      { title: 'Page ranges', body: 'Specify exactly which pages you want, e.g. "1-3, 5, 8-10" — or leave it empty for the whole document.' },
      PRIVACY_FEATURE,
      { title: 'Split your way', body: 'One file per range, one file per page, or every selected page combined into a single new PDF.' },
      FREE_FEATURE,
    ],
    steps: [
      'Drop a PDF into the box above.',
      'Enter the page or ranges you want, e.g. "1-3, 5, 8-10" — or leave it empty to use every page.',
      'Choose how to split: one file per range, one file per page, or all selected pages in one file.',
      'Press “Split PDF” and download each resulting file.',
    ],
    faqs: [
      { q: 'Is my PDF uploaded to a server?', a: 'No. Splitting runs entirely in your browser using WebAssembly — your file never leaves your device.' },
      { q: 'Can I extract multiple page ranges at once?', a: 'Yes — separate them with commas, e.g. "1-3, 5, 8-10" produces three separate files.' },
      { q: 'Can I split every page into its own file?', a: 'Yes — choose “One file per page”. Leave the page box empty to do it for the whole document; each file is named after the page number it came from.' },
      { q: 'Can I pull several scattered pages into one new PDF?', a: 'Yes — enter the pages you want, e.g. "2, 7, 11-13", and choose “All selected pages in one file”.' },
      { q: 'What\'s the maximum PDF size?', a: 'Up to 500 pages, matching the practical limit for editing a PDF smoothly in a browser tab.' },
      { q: 'Is it free?', a: 'Yes — free, no signup, no watermark.' },
    ],
  },
  'pdf-summary': {
    key: 'pdf-summary',
    slug: 'pdf-summary',
    name: 'PDF Summary',
    keyword: 'PDF summary',
    metaTitle: 'AI PDF Summary — Summarize Any PDF Free',
    metaDescription:
      'Get an instant AI summary of any PDF. Drop a document and get a clear overview plus key points — free, no signup. The file stays on your device; only its text is summarized.',
    h1: 'AI PDF summary — get the gist in seconds',
    intro:
      'Drop a PDF and get a clear AI summary plus the key points, without reading the whole thing. Works on reports, papers, contracts and more. Free, no signup.',
    features: [
      { title: 'Instant overview', body: 'A concise summary of what the document covers, generated from its actual text.' },
      { title: 'Key points', body: 'The main takeaways as a scannable list.' },
      AI_DISCLOSURE_FEATURE,
      { title: 'Free', body: 'No signup, no account, runs on free AI models with automatic provider fallback.' },
    ],
    steps: [
      'Drop a PDF into the box above.',
      'Click “Summarize”.',
      'Text is extracted from the PDF in your browser, then summarized.',
      'Read the overview and key points — copy them with one click.',
    ],
    faqs: [
      { q: 'Is my PDF uploaded to a server?', a: 'No — the file itself never leaves your device. It is read in your browser, and only the extracted text is sent to an AI provider (Google Gemini or Groq) to generate the summary.' },
      { q: 'Does this work on scanned PDFs?', a: 'Not yet in this version — it needs a PDF with selectable text. A scanned/image-only PDF will show a message pointing you to our OCR tool first.' },
      { q: 'How long can the PDF be?', a: 'Up to 500 pages. Very long documents are summarized from their full text where the AI provider\'s context window allows; otherwise from the beginning and end.' },
      { q: 'Is it free?', a: 'Yes — free, no signup, no watermark.' },
      { q: 'Do you store my document or its summary?', a: 'The extracted text is cached briefly (by content, not by who submitted it) so an identical document is not re-processed — see our Privacy Policy for details.' },
    ],
  },
  'pdf-editor': {
    key: 'pdf-editor',
    slug: 'pdf-editor',
    name: 'PDF Editor',
    keyword: 'PDF editor',
    metaTitle: 'PDF Editor Online Free — Add Text, Images & Tables',
    metaDescription:
      'Edit a PDF for free in your browser — add text, images and tables to any page, then export. Nothing is uploaded; your file never leaves your device.',
    h1: 'Edit a PDF — add text, images and tables, free',
    intro:
      'Add new text, images and tables to any page of a PDF, right in your browser. Drag to position, resize to fit, then export — nothing is ever uploaded.',
    features: [
      { title: 'Add text, images, tables', body: 'Place new content anywhere on any page — drag to move, resize to fit.' },
      PRIVACY_FEATURE,
      { title: 'Multi-page', body: 'Navigate between pages and add content to each one independently.' },
      FREE_FEATURE,
    ],
    steps: [
      'Drop a PDF into the box above.',
      'Click “+ Text”, “+ Image” or “+ Table” to add content to the current page.',
      'Drag to move, or use the corner handle to resize.',
      'Click “Export PDF” and download the result.',
    ],
    faqs: [
      { q: 'Is my PDF uploaded to a server?', a: 'No. Editing runs entirely in your browser using WebAssembly — your file never leaves your device.' },
      { q: 'Can I edit existing text already on the page?', a: 'This version adds new content only — new text, images and tables. Editing text that already exists on the page is not yet supported.' },
      { q: 'What languages are supported for added text?', a: 'Latin-script text (English and similar languages). Other scripts are not yet supported and will show a clear message rather than garbled text.' },
      { q: 'Will this work on a password-protected PDF?', a: 'Not currently — encrypted PDFs are detected and refused with a clear message.' },
      { q: 'Is it free?', a: 'Yes — free, no signup, no watermark.' },
    ],
  },
  'protect-pdf': {
    key: 'protect-pdf',
    slug: 'protect-pdf',
    name: 'Protect PDF',
    keyword: 'protect PDF',
    metaTitle: 'Protect PDF with a Password — Free, Online, No Upload',
    metaDescription:
      'Add password protection to any PDF for free. Set a password and choose what recipients can print, copy or edit — encrypted entirely in your browser, nothing is ever uploaded.',
    h1: 'Protect a PDF with a password — free, and never uploaded',
    intro:
      'Add real password protection to a PDF, right in your browser. Set a password, choose what recipients can print, copy or edit, and download the encrypted file — nothing ever leaves your device.',
    features: [
      { title: 'Real AES-256 encryption', body: 'The same standard used by professional PDF software, not a cosmetic lock.' },
      PRIVACY_FEATURE,
      { title: 'Control print, copy & edit', body: 'Restrict what someone can do once they have the password — or leave everything allowed.' },
      FREE_FEATURE,
    ],
    steps: [
      'Drop a PDF into the box above.',
      'Set a password.',
      'Choose what recipients can print, copy or edit (everything is allowed by default).',
      'Press “Protect PDF” and download the encrypted file.',
    ],
    faqs: [
      { q: 'Is my PDF or password uploaded to a server?', a: 'No. Encryption runs entirely in your browser using WebAssembly — your file and password never leave your device.' },
      { q: 'What encryption does this use?', a: 'AES-256, the current standard for PDF encryption and the same one used by professional desktop PDF software.' },
      { q: 'Can I stop people from printing or editing the file, even with the password?', a: 'Yes — uncheck Print, Copy text or Edit before protecting. These limits are respected by standard PDF readers, though they aren\'t unbreakable the way the password itself is.' },
      { q: 'What if I forget the password?', a: 'It can\'t be recovered — there\'s no backdoor, by design. The success screen lets you reveal and copy it before you navigate away, so save it somewhere safe first.' },
      { q: 'Will this work on a PDF that\'s already password-protected?', a: 'Not directly — unlock it first with our Unlock PDF tool, then protect it with a new password if you like.' },
      { q: 'Is it free?', a: 'Yes — free, no signup, no watermark.' },
    ],
  },
  'unlock-pdf': {
    key: 'unlock-pdf',
    slug: 'unlock-pdf',
    name: 'Unlock PDF',
    keyword: 'unlock PDF',
    metaTitle: 'Unlock PDF — Remove Password from a PDF Online, Free',
    metaDescription:
      'Remove password protection from a PDF for free. Enter the password once and download an unprotected copy — decrypted entirely in your browser, nothing is ever uploaded.',
    h1: 'Unlock a PDF — remove its password, free',
    intro:
      'Remove password protection from a PDF you already have the password for, right in your browser. Enter the password once and download a copy that opens without it — nothing is ever uploaded.',
    features: [
      { title: 'One password, done', body: 'Enter it once and get back a fully unprotected copy.' },
      { title: 'Your file and password never leave your device', body: 'Unlocking runs entirely in your browser — open DevTools → Network and see for yourself.' },
      { title: 'Works on owner-only restrictions too', body: 'Including PDFs that open freely but restrict printing or editing.' },
      FREE_FEATURE,
    ],
    steps: [
      'Drop a password-protected PDF into the box above.',
      'Enter the password.',
      'Press “Unlock PDF”.',
      'Download the copy that opens without a password.',
    ],
    faqs: [
      { q: 'Is my PDF or password uploaded to a server?', a: 'No. Unlocking runs entirely in your browser using WebAssembly — your file and password never leave your device.' },
      { q: 'Do I need to know the password?', a: 'Yes — this removes protection from a file you can already open, it doesn\'t recover or crack an unknown password.' },
      { q: 'What if I don\'t have a password at all, but the file won\'t let me print or edit?', a: 'Some PDFs have no password to open, only an owner password restricting what you can do. Try submitting the form with the password field empty — that unlocks this kind of file too.' },
      { q: 'What happens if I enter the wrong password?', a: 'You\'ll see a clear message and can try again immediately — your file stays loaded, nothing is lost.' },
      { q: 'Is it free?', a: 'Yes — free, no signup, no watermark.' },
    ],
  },
  'pdf-to-jpg': {
    key: 'pdf-to-jpg',
    slug: 'pdf-to-jpg',
    name: 'PDF to JPG',
    keyword: 'PDF to JPG',
    metaTitle: 'PDF to JPG Converter — Export PDF Pages as Images, Free',
    metaDescription:
      'Convert PDF pages to JPG or PNG images for free. Choose a page range and resolution, then download each image or all of them as a .zip — nothing is ever uploaded.',
    h1: 'PDF to JPG — export pages as images, free',
    intro:
      'Turn any PDF’s pages into JPG or PNG images, right in your browser. Pick a page range and resolution, then download each image or grab them all as a .zip — nothing ever leaves your device.',
    features: [
      { title: 'JPG or PNG, two resolutions', body: 'Standard for screens, high for print — your choice per export.' },
      PRIVACY_FEATURE,
      { title: 'Any page range', body: 'Export the whole document or just the pages you need, e.g. "1-3, 5, 8-10".' },
      { title: 'Download all as .zip', body: 'One click grabs every exported page instead of downloading them one by one.' },
    ],
    steps: [
      'Drop a PDF into the box above.',
      'Enter the pages you want, or leave it empty for all of them.',
      'Choose a format and resolution.',
      'Press “Convert” and download each image, or all of them as a .zip.',
    ],
    faqs: [
      { q: 'Is my PDF uploaded to a server?', a: 'No. Every page is rendered to an image entirely in your browser — your file never leaves your device.' },
      { q: 'What’s the difference between Standard and High resolution?', a: 'Standard renders at 144 DPI, sharp on any screen. High renders at 288 DPI, suited to printing.' },
      { q: 'Can I export just a few pages?', a: 'Yes — enter a range like "1-3, 5, 8-10", the same format used by our Split PDF tool. Leave it empty to export every page.' },
      { q: 'How many pages can I export at once?', a: 'Up to 50 images per export — narrow the page range if a document has more than that.' },
      { q: 'Is it free?', a: 'Yes — free, no signup, no watermark.' },
    ],
  },
};

export const PDF_TOOL_LIST: PdfTool[] = Object.values(PDF_TOOLS);
