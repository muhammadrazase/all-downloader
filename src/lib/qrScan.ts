import { exceedsCanvasLimits } from './imageCompress';

export class QrScanError extends Error {
  constructor(message: string, public readonly code: 'unsupported_file' | 'too_large' | 'decode_failed' | 'not_found') {
    super(message);
    this.name = 'QrScanError';
  }
}

export const MAX_MB = 20;
const SUPPORTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp', 'image/gif'];

// Bounds the jsQR fallback's main-thread cost — an unbounded photo could freeze the tab decoding it.
const MAX_SCAN_SIDE = 2000;

export function isSupportedQrImage(file: File): boolean {
  return SUPPORTED_TYPES.includes(file.type);
}

export function assertScannable(file: File): void {
  if (!isSupportedQrImage(file)) throw new QrScanError('Only PNG, JPEG, WebP, BMP and GIF images are supported.', 'unsupported_file');
  if (file.size > MAX_MB * 1024 * 1024) throw new QrScanError(`File must be under ${MAX_MB} MB.`, 'too_large');
}

/** True for a string a scanned QR code commonly encodes and a browser can act on directly. */
export function isOpenableUrl(data: string): boolean {
  return /^https?:\/\//i.test(data);
}

export interface ScanResult {
  data: string;
}

interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]>;
}
type BarcodeDetectorCtor = new (options: { formats: string[] }) => BarcodeDetectorLike;

let nativeDetector: BarcodeDetectorLike | null | undefined; // undefined = not yet checked

/** Native decoder when available (off-main-thread, zero bytes) — checked once and reused. Not in
 * TypeScript's DOM lib yet, hence the cast. */
function getNativeDetector(): BarcodeDetectorLike | null {
  if (nativeDetector !== undefined) return nativeDetector;
  const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  nativeDetector = Ctor ? new Ctor({ formats: ['qr_code'] }) : null;
  return nativeDetector;
}

/** Pure scaling math for the scan-resolution cap — no DOM involved, so it's unit-testable directly.
 * Returns null if even the capped size is somehow beyond what a canvas can back. */
export function computeScanDimensions(sourceWidth: number, sourceHeight: number): { width: number; height: number } | null {
  const scale = Math.min(1, MAX_SCAN_SIDE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  return exceedsCanvasLimits(width, height) ? null : { width, height };
}

/** Downscales to MAX_SCAN_SIDE with `willReadFrequently`, avoiding a GPU→CPU readback per call. */
function toScanCanvas(source: CanvasImageSource, sourceWidth: number, sourceHeight: number): HTMLCanvasElement | null {
  const dims = computeScanDimensions(sourceWidth, sourceHeight);
  if (!dims) return null;
  const { width, height } = dims;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

/** jsQR fallback, dynamic-imported so it never loads on a browser with a native detector. */
async function decodeWithJsQr(canvas: HTMLCanvasElement): Promise<string | null> {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const jsQR = (await import('jsqr')).default;
  const result = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
  return result?.data ?? null;
}

async function decode(source: CanvasImageSource, width: number, height: number): Promise<string | null> {
  const native = getNativeDetector();
  if (native) {
    try {
      const found = await native.detect(source as ImageBitmapSource);
      return found[0]?.rawValue ?? null;
    } catch {
      /* fall through to jsQR below on any native decode failure */
    }
  }
  const canvas = toScanCanvas(source, width, height);
  return canvas ? decodeWithJsQr(canvas) : null;
}

/** Decodes a QR code from an uploaded image file. */
export async function scanImageFile(file: File): Promise<ScanResult> {
  assertScannable(file);

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new QrScanError('Could not read this image. It may be corrupted or an unsupported format.', 'decode_failed');
  });

  try {
    if (exceedsCanvasLimits(bitmap.width, bitmap.height)) {
      throw new QrScanError(`${bitmap.width}×${bitmap.height}px is too large to scan — crop or shrink the photo first.`, 'too_large');
    }
    const data = await decode(bitmap, bitmap.width, bitmap.height);
    if (!data) throw new QrScanError('No QR code was found in this image. Try a clearer or closer photo of the code.', 'not_found');
    return { data };
  } finally {
    bitmap.close();
  }
}

/** Decodes a QR code from a single video frame (a live camera feed) — same engine as the file path. */
export async function scanVideoFrame(video: HTMLVideoElement): Promise<ScanResult | null> {
  if (video.videoWidth === 0 || video.videoHeight === 0) return null;
  const data = await decode(video, video.videoWidth, video.videoHeight);
  return data ? { data } : null;
}
