import { describe, it, expect } from 'vitest';
import { createWorker, OEM } from 'tesseract.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSupportedImage } from '../src/lib/ocr';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..');

/**
 * Runs Tesseract directly in Node against the exact `public/ocr` assets the
 * browser tool self-hosts, to verify real recognition accuracy — not just
 * that the API resolves. `cacheMethod: 'none'` avoids writing stray cache
 * files (Node's default cache path is the process cwd). No network calls:
 * `langPath` is a local filesystem path here, read directly from disk.
 */
async function recognizeFixture(file: string, lang = 'eng') {
  const worker = await createWorker(lang, OEM.LSTM_ONLY, {
    langPath: path.join(root, 'public', 'ocr'),
    cacheMethod: 'none',
  });
  try {
    return await worker.recognize(path.join(root, 'test', 'fixtures', 'ocr', file));
  } finally {
    await worker.terminate();
  }
}

describe('isSupportedImage', () => {
  it('accepts common raster formats', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/bmp']) {
      expect(isSupportedImage(new File([], 'x', { type }))).toBe(true);
    }
  });

  it('rejects unsupported types', () => {
    for (const type of ['application/pdf', 'image/svg+xml', 'text/plain', '']) {
      expect(isSupportedImage(new File([], 'x', { type }))).toBe(false);
    }
  });
});

describe('OCR recognition (real, against vendored assets)', () => {
  it('reads known ground-truth text from a synthetic invoice image', async () => {
    const { data } = await recognizeFixture('invoice-sample.png');
    expect(data.text).toContain('Invoice #48213');
    expect(data.text).toContain('Acme Corporation');
    expect(data.text).toContain('1,204.50');
    expect(data.text).toContain('2026-10-01');
    expect(data.confidence).toBeGreaterThan(80);
  }, 30_000);

  it.each([
    ['spa', 'spa-sample.png', ['Café', 'leche', 'euros', 'Mayor']],
    ['fra', 'fra-sample.png', ['Café', 'lait', 'euros', 'Paix']],
    ['deu', 'deu-sample.png', ['Rechnung', 'Gesamtbetrag', 'Euro', 'Hauptstraße']],
    ['por', 'por-sample.png', ['Café', 'leite', 'euros', 'Principal']],
    // Arabic/Urdu ground truth: 'hello', 'thank you', a country name, per language — rendered via
    // headless Chromium (correct contextual letter shaping) and independently confirmed to round-trip
    // through this exact vendored model before being committed as a fixture.
    ['ara', 'ara-sample.png', ['مرحبا', 'شكرا', 'مصر']],
    ['urd', 'urd-sample.png', ['سلام', 'شکریہ', 'پاکستان']],
  ] as const)('reads known ground-truth text in %s', async (lang, file, expectedWords) => {
    const { data } = await recognizeFixture(file, lang);
    for (const word of expectedWords) expect(data.text).toContain(word);
    expect(data.confidence).toBeGreaterThan(80);
  }, 30_000);
});
