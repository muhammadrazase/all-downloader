import { describe, it, expect } from 'vitest';
import { isSupportedQrImage, isOpenableUrl, assertScannable, computeScanDimensions, QrScanError, MAX_MB } from '@/lib/qrScan';

function fileOfSize(bytes: number, name = 'a.png', type = 'image/png'): File {
  const file = new File([new Uint8Array(0)], name, { type });
  Object.defineProperty(file, 'size', { value: bytes });
  return file;
}

describe('isSupportedQrImage', () => {
  it('accepts common raster formats including GIF (some QR codes are shared as GIFs)', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/bmp', 'image/gif']) {
      expect(isSupportedQrImage(new File([], 'x', { type }))).toBe(true);
    }
  });

  it('rejects unsupported types', () => {
    expect(isSupportedQrImage(new File([], 'x', { type: 'application/pdf' }))).toBe(false);
    expect(isSupportedQrImage(new File([], 'x', { type: 'video/mp4' }))).toBe(false);
  });
});

describe('isOpenableUrl', () => {
  it('accepts http and https links', () => {
    expect(isOpenableUrl('https://example.com')).toBe(true);
    expect(isOpenableUrl('http://example.com')).toBe(true);
  });

  it('rejects everything else a QR code might encode, so a plain string is never treated as a link', () => {
    expect(isOpenableUrl('WIFI:S:home;T:WPA;P:pass;;')).toBe(false);
    expect(isOpenableUrl('just some text')).toBe(false);
    expect(isOpenableUrl('mailto:a@b.com')).toBe(false);
    expect(isOpenableUrl('javascript:alert(1)')).toBe(false);
    expect(isOpenableUrl('')).toBe(false);
  });
});

describe('assertScannable', () => {
  it('rejects an unsupported file type', () => {
    try {
      assertScannable(fileOfSize(1024, 'a.pdf', 'application/pdf'));
      expect.unreachable('expected assertScannable to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(QrScanError);
      expect((err as QrScanError).code).toBe('unsupported_file');
    }
  });

  it(`rejects a file over ${MAX_MB} MB`, () => {
    try {
      assertScannable(fileOfSize(MAX_MB * 1024 * 1024 + 1));
      expect.unreachable('expected assertScannable to throw');
    } catch (err) {
      expect((err as QrScanError).code).toBe('too_large');
    }
  });

  it('accepts a valid image within bounds', () => {
    expect(() => assertScannable(fileOfSize(1024))).not.toThrow();
  });
});

describe('computeScanDimensions — caps the main-thread jsQR fallback cost', () => {
  it('leaves a small image untouched', () => {
    expect(computeScanDimensions(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('downscales a huge image to the cap, preserving aspect ratio', () => {
    expect(computeScanDimensions(4000, 2000)).toEqual({ width: 2000, height: 1000 });
    expect(computeScanDimensions(2000, 4000)).toEqual({ width: 1000, height: 2000 });
  });

  it('never upscales a small image past its own size', () => {
    expect(computeScanDimensions(100, 50)).toEqual({ width: 100, height: 50 });
  });

  it('caps even an extreme source to a size well within canvas limits', () => {
    // A 16000x16000 uniform PNG can be well under the 20 MB upload cap yet decode to this — before
    // this guard existed, qrScan.ts fed the FULL decoded size straight to getImageData/jsQR, a
    // ~1 GB main-thread walk. Capping the long edge at MAX_SCAN_SIDE keeps every result far under
    // the 65535px / 2^28px² ceiling exceedsCanvasLimits enforces, so the guard here never actually
    // rejects in practice — it exists as a second line of defense if that cap is ever raised.
    const dims = computeScanDimensions(16_000, 16_000);
    expect(dims).not.toBeNull();
    expect(dims!.width).toBeLessThanOrEqual(2000);
    expect(dims!.height).toBeLessThanOrEqual(2000);
  });
});

describe('QrScanError', () => {
  it('is a real Error subclass', () => {
    const err = new QrScanError('not found', 'not_found');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('QrScanError');
  });
});
