import { exceedsCanvasLimits } from './imageCompress';

export class HeicConvertError extends Error {
  constructor(message: string, public readonly code: 'unsupported_file' | 'decode_failed' | 'encode_failed' | 'too_large') {
    super(message);
    this.name = 'HeicConvertError';
  }
}

/** Real ISO-BMFF magic-byte sniffing via heic-to's own isHeic() — robust to the empty/generic MIME types Windows/Android often report for HEIC uploads, unlike an extension or MIME check. */
export async function isHeicFile(file: File): Promise<boolean> {
  const { isHeic } = await import('heic-to/csp');
  return isHeic(file);
}

export type HeicOutputFormat = 'jpg' | 'png';

/** One default for both the UI slider and the library fallback — and a value the slider's 0.05 step can actually represent, so the thumb never disagrees with the label. */
export const DEFAULT_JPEG_QUALITY = 0.9;

export interface HeicConvertOptions {
  format: HeicOutputFormat;
  quality?: number; // 0-1, ignored for png
}

const MAX_FILENAME_LENGTH = 120;

/** Path separators are stripped so a crafted upload name can't steer where the file lands; a name that is only an extension (".heic") falls back to a real basename. */
export function buildConvertedFilename(originalName: string, format: HeicOutputFormat): string {
  const base = originalName
    .replace(/\.[^.]+$/, '')
    .replace(/[/\\]+/g, '-')
    .slice(0, MAX_FILENAME_LENGTH)
    .trim();
  return `${base || 'photo'}.${format}`;
}

export interface HeicConvertResult {
  blob: Blob;
  width: number;
  height: number;
}

/** Converts a HEIC/HEIF image to JPG or PNG entirely client-side via the self-hosted heic-to/csp decoder. */
export async function convertHeicToJpg(file: File, opts: HeicConvertOptions): Promise<HeicConvertResult> {
  const { heicTo } = await import('heic-to/csp');
  const mimeType = opts.format === 'jpg' ? 'image/jpeg' : 'image/png';

  let blob: Blob;
  try {
    blob = await heicTo({ blob: file, type: mimeType, quality: opts.format === 'jpg' ? (opts.quality ?? DEFAULT_JPEG_QUALITY) : undefined });
  } catch {
    throw new HeicConvertError('Could not convert this file. It may be corrupted or use an unsupported HEIC variant.', 'decode_failed');
  }

  // No browser can peek a HEIC's dimensions without a full decode, so the canvas-size guard can
  // only run on the already-converted output, not pre-emptively on the input.
  const bitmap = await createImageBitmap(blob).catch(() => null);
  if (!bitmap) throw new HeicConvertError('Could not read the converted image.', 'encode_failed');
  const { width, height } = bitmap;
  bitmap.close();
  if (exceedsCanvasLimits(width, height)) {
    throw new HeicConvertError(`${width}×${height}px is larger than a browser canvas can hold.`, 'too_large');
  }

  return { blob, width, height };
}
