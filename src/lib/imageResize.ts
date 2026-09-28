import { isSupportedInputImage, exceedsCanvasLimits, type ImageFormat } from './imageCompress';

export class ImageResizeError extends Error {
  constructor(message: string, public readonly code: 'unsupported_file' | 'too_large' | 'decode_failed' | 'encode_failed') {
    super(message);
    this.name = 'ImageResizeError';
  }
}

export const MAX_MB = 30;

export interface SizePreset {
  key: string;
  label: string;
  width: number;
  height: number;
}

// Ordered by platform, widest-used first — each a real, current published spec size.
export const SIZE_PRESETS: SizePreset[] = [
  { key: 'ig-post', label: 'Instagram Post (Square)', width: 1080, height: 1080 },
  { key: 'ig-portrait', label: 'Instagram Portrait Post', width: 1080, height: 1350 },
  { key: 'ig-story', label: 'Instagram / TikTok Story', width: 1080, height: 1920 },
  { key: 'yt-thumbnail', label: 'YouTube Thumbnail', width: 1280, height: 720 },
  { key: 'yt-shorts', label: 'YouTube Shorts Cover', width: 1080, height: 1920 },
  { key: 'x-post', label: 'X (Twitter) Post', width: 1600, height: 900 },
  { key: 'x-header', label: 'X (Twitter) Header', width: 1500, height: 500 },
  { key: 'fb-post', label: 'Facebook Post', width: 1200, height: 630 },
  { key: 'fb-cover', label: 'Facebook Cover Photo', width: 820, height: 312 },
  { key: 'linkedin-post', label: 'LinkedIn Post', width: 1200, height: 627 },
  { key: 'pinterest-pin', label: 'Pinterest Pin', width: 1000, height: 1500 },
];

export type FitMode = 'cover' | 'contain';

/** CSS "background-size: cover" semantics — the source rectangle to crop (centered) so that
 * scaling it fills the target exactly, with nothing left over. Pure, unit-testable. */
export function computeCoverCrop(
  srcWidth: number,
  srcHeight: number,
  targetWidth: number,
  targetHeight: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const scale = Math.max(targetWidth / srcWidth, targetHeight / srcHeight);
  const sw = Math.round(targetWidth / scale);
  const sh = Math.round(targetHeight / scale);
  return { sx: Math.round((srcWidth - sw) / 2), sy: Math.round((srcHeight - sh) / 2), sw, sh };
}

/** CSS "background-size: contain" semantics — where to draw the whole source, scaled to fit
 * inside the target without cropping (the caller fills the leftover space). Pure, unit-testable. */
export function computeContainFit(
  srcWidth: number,
  srcHeight: number,
  targetWidth: number,
  targetHeight: number,
): { dx: number; dy: number; dw: number; dh: number } {
  const scale = Math.min(targetWidth / srcWidth, targetHeight / srcHeight);
  const dw = Math.round(srcWidth * scale);
  const dh = Math.round(srcHeight * scale);
  return { dx: Math.round((targetWidth - dw) / 2), dy: Math.round((targetHeight - dh) / 2), dw, dh };
}

export interface ResizeOptions {
  preset: SizePreset;
  fit: FitMode;
  backgroundColor: string; // only used by 'contain', for the letterboxed area
  format: ImageFormat;
  quality: number;
}

export interface ResizeResult {
  blob: Blob;
  width: number;
  height: number;
}

export function assertResizable(file: File): void {
  if (!isSupportedInputImage(file)) throw new ImageResizeError('Only PNG, JPEG, WebP and BMP images are supported.', 'unsupported_file');
  if (file.size > MAX_MB * 1024 * 1024) throw new ImageResizeError(`File must be under ${MAX_MB} MB.`, 'too_large');
}

/** Resizes one image to one preset's exact pixel dimensions, either cropping to fill ('cover')
 * or letterboxing to fit ('contain') — all via canvas. */
export async function resizeImage(file: File, opts: ResizeOptions): Promise<ResizeResult> {
  assertResizable(file);
  if (exceedsCanvasLimits(opts.preset.width, opts.preset.height)) {
    throw new ImageResizeError(`${opts.preset.width}×${opts.preset.height}px is larger than a browser canvas can hold.`, 'too_large');
  }

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new ImageResizeError('Could not read this image. It may be corrupted or an unsupported format.', 'decode_failed');
  });

  try {
    const canvas = document.createElement('canvas');
    canvas.width = opts.preset.width;
    canvas.height = opts.preset.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageResizeError('Canvas 2D context is not available in this browser.', 'encode_failed');

    if (opts.fit === 'cover') {
      const { sx, sy, sw, sh } = computeCoverCrop(bitmap.width, bitmap.height, opts.preset.width, opts.preset.height);
      ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, opts.preset.width, opts.preset.height);
    } else {
      ctx.fillStyle = opts.backgroundColor;
      ctx.fillRect(0, 0, opts.preset.width, opts.preset.height);
      const { dx, dy, dw, dh } = computeContainFit(bitmap.width, bitmap.height, opts.preset.width, opts.preset.height);
      ctx.drawImage(bitmap, dx, dy, dw, dh);
    }

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, opts.format, opts.quality));
    if (!blob) throw new ImageResizeError('Could not create the resized image.', 'encode_failed');
    return { blob, width: canvas.width, height: canvas.height };
  } finally {
    bitmap.close();
  }
}
