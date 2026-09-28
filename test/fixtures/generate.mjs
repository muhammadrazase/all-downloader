#!/usr/bin/env node
/**
 * Generates the structural-edge-case slice of the PDF test corpus described in
 * PLAN-PDF-TOOLS.md §6.0.2 — the cases that can be built correctly with
 * @cantoo/pdf-lib itself (multi-page, rotated, encrypted, corrupted, non-Latin
 * text, huge page count).
 *
 * NOT covered here, and still needed before a real production launch: actual
 * third-party-producer output (Word export, Google Docs export, InDesign,
 * LaTeX) and actual scanned/photographed documents (flatbed + phone camera).
 * Those need to come from real producing applications/devices, not be
 * synthesized — that's the honest gap this generator does not close.
 */
import { PDFDocument, degrees, StandardFonts } from '@cantoo/pdf-lib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pdf');
mkdirSync(dir, { recursive: true });

// Hardcoded (not imported) in test/pdfEngine.test.ts and e2e/pdf-tools.spec.ts too — keep in sync if changed.
const ENCRYPTED_FIXTURE_PASSWORD = 'test1234';

async function write(name, bytes) {
  writeFileSync(path.join(dir, name), bytes);
  console.log(`  wrote ${name} (${bytes.length} bytes)`);
}

// 1. Single page, plain text — the baseline case.
{
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([400, 300]);
  page.drawText('Single page fixture.', { x: 40, y: 250, size: 16, font });
  await write('single-page.pdf', await doc.save());
}

// 2. Multi-page (10 pages) — for merge/split/reorder testing.
{
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 10; i++) {
    const page = doc.addPage([400, 300]);
    page.drawText(`Page ${i} of 10`, { x: 40, y: 250, size: 16, font });
  }
  await write('multi-page-10.pdf', await doc.save());
}

// 3. Rotated pages (one of each: 90, 180, 270) — coordinate-transform edge case.
{
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const angle of [0, 90, 180, 270]) {
    const page = doc.addPage([400, 300]);
    page.drawText(`Rotated ${angle}`, { x: 40, y: 250, size: 16, font });
    page.setRotation(degrees(angle));
  }
  await write('rotated-pages.pdf', await doc.save());
}

// 4. Encrypted PDFs — real AES-256 encryption via @cantoo/pdf-lib's own
//    .encrypt(), verified directly against the installed package (2.11.1
//    genuinely supports writing encryption, not just reading it).
{
  const withUserPassword = await PDFDocument.create();
  const font1 = await withUserPassword.embedFont(StandardFonts.Helvetica);
  withUserPassword.addPage([400, 300]).drawText('Encrypted fixture.', { x: 40, y: 250, size: 16, font: font1 });
  withUserPassword.encrypt({ userPassword: ENCRYPTED_FIXTURE_PASSWORD, ownerPassword: ENCRYPTED_FIXTURE_PASSWORD });
  await write('encrypted-user-password.pdf', await withUserPassword.save());

  // Owner-only: no password needed to open, but permissions are restricted for
  // anyone without the owner password — a real, distinct case from the above.
  const ownerOnly = await PDFDocument.create();
  const font2 = await ownerOnly.embedFont(StandardFonts.Helvetica);
  ownerOnly.addPage([400, 300]).drawText('Owner-only fixture.', { x: 40, y: 250, size: 16, font: font2 });
  ownerOnly.encrypt({ ownerPassword: 'owner-secret-only', permissions: { printing: true } });
  await write('encrypted-owner-only.pdf', await ownerOnly.save());
}

// 5. Truncated / corrupted — TWO distinct failure modes, found empirically
//    (see PLAN-PDF-TOOLS.md §6.0.2 and pdfEngine.test.ts): @cantoo/pdf-lib's
//    repair logic behaves differently depending on exactly how much of the
//    file survives, so a single "cut it in half" fixture is not enough to
//    exercise the real failure surface.
{
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([400, 300]);
  page.drawText('This file will be truncated.', { x: 40, y: 250, size: 16, font });
  const bytes = await doc.save();

  // ~10%: too little survives to parse at all — pdf-lib throws a raw,
  // untyped TypeError internally. loadDocument()'s catch-all must convert
  // this to a PdfEngineError, not let it escape as-is.
  await write('truncated-throws.pdf', bytes.slice(0, Math.floor(bytes.length * 0.1)));

  // ~20%: enough survives that pdf-lib's repair logic returns a
  // "successfully parsed" document — but with ZERO pages. This is the more
  // dangerous case: no exception is thrown at all, so it must be caught by
  // an explicit zero-page check in loadDocument(), not by error handling.
  await write('truncated-zero-pages.pdf', bytes.slice(0, Math.floor(bytes.length * 0.2)));
}

// 5a. A normal text-layer document: enough prose to be worth summarizing (well over
//     the Summarizer's 200-character floor) but comfortably under its 60k ceiling.
{
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const body = [
    'Revenue reached 4.2 million dollars, up 11 percent year over year, driven mostly by',
    'the new cold-chain corridor between Rotterdam and Milan. Gross margin slipped to 31',
    'percent because diesel surcharges were absorbed rather than passed to customers.',
    'On-time delivery held at 96.4 percent across 18,200 shipments. The Milan hub missed',
    'its target twice in August due to a customs systems outage lasting nine hours.',
    'Headcount grew from 212 to 231, with most additions in dispatch and compliance.',
    'The board asked management to model a 5 percent surcharge pass-through for Q4 and to',
    'present a contingency plan for the Rotterdam lease, which expires in fourteen months.',
  ];
  for (let p = 1; p <= 3; p++) {
    const page = doc.addPage([595, 842]);
    page.drawText(`Quarterly Operations Review — Section ${p}`, { x: 50, y: 790, size: 16, font });
    body.forEach((line, i) => page.drawText(line, { x: 50, y: 750 - i * 22, size: 10, font }));
  }
  await write('text-report-3-pages.pdf', await doc.save());
}

// 5b. A long text-layer document (~40 pages, >60k characters of extractable text).
//     The Summarizer's route caps a request at 60k characters; without a fixture
//     this size, nothing catches a regression where a real multi-chapter PDF is
//     sent whole and bounced by the route's own validation instead of budgeted.
{
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const line = 'The committee reviewed procurement records for the fiscal period and noted variances in unit pricing across three suppliers.';
  for (let p = 1; p <= 40; p++) {
    const page = doc.addPage([595, 842]); // A4
    page.drawText(`Chapter ${p}`, { x: 50, y: 800, size: 14, font });
    for (let i = 0; i < 30; i++) {
      page.drawText(`${i + 1}. ${line}`, { x: 50, y: 770 - i * 24, size: 9, font });
    }
  }
  await write('long-text-40-pages.pdf', await doc.save());
}

// 6. Zero-byte file.
await write('zero-byte.pdf', new Uint8Array(0));

// 7. Non-Latin script text — must be DETECTED and cleanly refused for "add
//    text" per the plan's stated scope limit (StandardFonts is WinAnsi-only),
//    not silently mangled. This fixture holds the source text as a plain
//    string for the test to attempt embedding, not as page content.
writeFileSync(path.join(dir, 'non-latin-sample.txt'), 'مرحبا بالعالم 你好世界 привет мир', 'utf-8');
console.log('  wrote non-latin-sample.txt');

console.log('\nFixture generation complete.');
