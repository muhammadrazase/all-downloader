#!/usr/bin/env node
/**
 * Self-hosts the pdf.js worker and the Tesseract OCR engine into /public so the
 * PDF tools never load executable code from a third-party CDN (this app has no
 * CSP, so a floating CDN version would defeat the pdfjs-dist CVE pin entirely —
 * see PLAN-PDF-TOOLS.md §4). Pins the SIMD+LSTM-only Tesseract core variant
 * specifically: the default build lets tesseract.js feature-detect and fetch
 * several core variants, which costs ~19 MB instead of the ~2.7 MB this single
 * pinned file needs. Runs on postinstall; non-fatal if source packages are
 * missing (matches copy-ffmpeg.mjs's convention).
 */
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nodeModules = path.join(root, 'node_modules');

function copyIfPresent(label, srcDir, files, destDir) {
  if (!files.every((f) => existsSync(path.join(srcDir, f)))) {
    console.warn(`[copy-pdf-assets] ${label} not found — skipping (run \`npm i\` to restore it).`);
    return false;
  }
  mkdirSync(destDir, { recursive: true });
  for (const f of files) copyFileSync(path.join(srcDir, f), path.join(destDir, f));
  console.log(`[copy-pdf-assets] ${label} copied to ${path.relative(root, destDir)}`);
  return true;
}

try {
  copyIfPresent(
    'pdf.js worker',
    path.join(nodeModules, 'pdfjs-dist', 'build'),
    ['pdf.worker.min.mjs'],
    path.join(root, 'public', 'pdf'),
  );

  copyIfPresent(
    'Tesseract worker',
    path.join(nodeModules, 'tesseract.js', 'dist'),
    ['worker.min.js'],
    path.join(root, 'public', 'ocr'),
  );

  // SIMD+LSTM-only variant — the smallest core that still does real OCR work.
  copyIfPresent(
    'Tesseract WASM core (simd-lstm)',
    path.join(nodeModules, 'tesseract.js-core'),
    ['tesseract-core-simd-lstm.wasm', 'tesseract-core-simd-lstm.wasm.js'],
    path.join(root, 'public', 'ocr'),
  );

  if (!existsSync(path.join(root, 'public', 'ocr', 'eng.traineddata.gz'))) {
    console.warn(
      '[copy-pdf-assets] public/ocr/eng.traineddata.gz is missing — OCR will not work until it is vendored ' +
        '(fetch the English file from the tesseract-ocr/tessdata_fast release, gzip it, and place it there).',
    );
  }
} catch (e) {
  console.warn('[copy-pdf-assets] skipped:', e?.message);
  process.exit(0);
}
