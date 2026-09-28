export class ImageCompressError extends Error {
  constructor(message: string, public readonly code: 'unsupported_file' | 'decode_failed' | 'encode_failed' | 'too_large') {
    super(message);
    this.name = 'ImageCompressError';
  }
}

/** Pure aspect-ratio-preserving resize math — no canvas needed, so it's unit-testable directly. */
export function computeTargetDimensions(width: number, height: number, maxWidth: number): { width: number; height: number } {
  if (width <= maxWidth) return { width, height };
  const ratio = maxWidth / width;
  return { width: maxWidth, height: Math.round(height * ratio) };
}

export type ResizeMode =
  | { mode: 'none' }
  | { mode: 'maxWidth'; maxWidth: number }
  | { mode: 'exact'; width: number; height: number };

/** Resolves the final output dimensions for each resize mode — pure, unit-testable. */
export function resolveDimensions(width: number, height: number, resize: ResizeMode): { width: number; height: number } {
  if (resize.mode === 'none') return { width, height };
  if (resize.mode === 'exact') return { width: resize.width, height: resize.height };
  return computeTargetDimensions(width, height, resize.maxWidth);
}

export type ImageFormat = 'image/jpeg' | 'image/webp' | 'image/png';

const IMAGE_FORMATS: readonly ImageFormat[] = ['image/jpeg', 'image/webp', 'image/png'];

/** Narrows a `<select>`'s onChange string to the real union instead of an unchecked `as` cast,
 * which TypeScript erases at runtime. */
export function isImageFormat(value: string): value is ImageFormat {
  return (IMAGE_FORMATS as readonly string[]).includes(value);
}

/** JPEG has no alpha channel, so a transparent source has to be flattened onto a solid colour before encoding. */
export function formatHasAlpha(format: ImageFormat): boolean {
  return format !== 'image/jpeg';
}

// Chrome's hard canvas ceiling: 2^28 total pixels, and 65535 in either direction. Past it
// `toBlob` silently yields null, which would surface as a meaningless "could not compress".
const MAX_CANVAS_PIXELS = 268_435_456;
const MAX_CANVAS_SIDE = 65_535;

/** Pure guard for the dimensions a browser canvas can actually back — unit-testable without a DOM. */
export function exceedsCanvasLimits(width: number, height: number): boolean {
  return width < 1 || height < 1 || width > MAX_CANVAS_SIDE || height > MAX_CANVAS_SIDE || width * height > MAX_CANVAS_PIXELS;
}

export interface CompressOptions {
  quality: number; // 0-1 — ignored for PNG, which is always lossless
  format: ImageFormat;
  resize: ResizeMode;
  backgroundColor: string; // flattening colour for formats without alpha (JPEG)
}

export interface CompressResult {
  blob: Blob;
  width: number;
  height: number;
  quality: number; // the quality actually used — target-size mode picks its own
}

async function drawToCanvas(file: File, opts: CompressOptions): Promise<HTMLCanvasElement> {
  // No `imageOrientation` option: verified against a real EXIF-rotated JPEG that the default
  // already applies EXIF orientation correctly — passing 'none' here would un-rotate real photos.
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new ImageCompressError('Could not read this image. It may be corrupted or an unsupported format.', 'decode_failed');
  });

  const { width, height } = resolveDimensions(bitmap.width, bitmap.height, opts.resize);
  if (exceedsCanvasLimits(width, height)) {
    bitmap.close();
    throw new ImageCompressError(`${width}×${height}px is larger than a browser canvas can hold — choose smaller output dimensions.`, 'too_large');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new ImageCompressError('Canvas 2D context is not available in this browser.', 'encode_failed');
  }
  // Without this, a transparent PNG encoded to JPEG comes out with a solid black background.
  if (!formatHasAlpha(opts.format)) {
    ctx.fillStyle = opts.backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas;
}

async function encode(canvas: HTMLCanvasElement, format: ImageFormat, quality: number): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, format, quality));
  if (!blob) throw new ImageCompressError('Could not compress this image.', 'encode_failed');
  return blob;
}

/** Decodes the image, resizes per `resize`, and re-encodes at the given quality — all via canvas. */
export async function compressImage(file: File, opts: CompressOptions): Promise<CompressResult> {
  const canvas = await drawToCanvas(file, opts);
  const blob = await encode(canvas, opts.format, opts.quality);
  return { blob, width: canvas.width, height: canvas.height, quality: opts.quality };
}

const TARGET_SEARCH_STEPS = 7; // 7 bisections over 0.1-1.0 lands within ~0.7% quality — more is imperceptible

/** Bisects quality to find the largest value that still fits `targetBytes`; returns the smallest achievable result if even the lowest quality overshoots. */
export async function compressToTargetBytes(file: File, opts: CompressOptions, targetBytes: number): Promise<CompressResult> {
  const canvas = await drawToCanvas(file, opts);
  const dimensions = { width: canvas.width, height: canvas.height };
  if (opts.format === 'image/png') {
    const blob = await encode(canvas, opts.format, 1);
    return { blob, ...dimensions, quality: 1 };
  }

  let low = 0.1;
  let high = 1;
  let best = await encode(canvas, opts.format, low);
  let bestQuality = low;
  if (best.size > targetBytes) return { blob: best, ...dimensions, quality: bestQuality };

  for (let step = 0; step < TARGET_SEARCH_STEPS; step++) {
    const mid = (low + high) / 2;
    const candidate = await encode(canvas, opts.format, mid);
    if (candidate.size <= targetBytes) {
      best = candidate;
      bestQuality = mid;
      low = mid;
    } else {
      high = mid;
    }
  }
  return { blob: best, ...dimensions, quality: bestQuality };
}

export function isSupportedInputImage(file: File): boolean {
  return ['image/png', 'image/jpeg', 'image/webp', 'image/bmp'].includes(file.type);
}
