import { isSupportedInputImage, exceedsCanvasLimits, type ImageFormat } from './imageCompress';

export class ImageMergeError extends Error {
  constructor(message: string, public readonly code: 'too_few' | 'too_many' | 'unsupported_file' | 'decode_failed' | 'too_large' | 'encode_failed') {
    super(message);
    this.name = 'ImageMergeError';
  }
}

export const MIN_IMAGES = 2;
export const MAX_IMAGES = 10;
export const MAX_MB_PER_IMAGE = 20;

export type MergeLayout = 'horizontal' | 'vertical' | 'grid';

export interface MergeOptions {
  layout: MergeLayout;
  gap: number;
  backgroundColor: string;
  format: ImageFormat;
  quality: number;
}

export interface Cell {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Layout {
  canvasWidth: number;
  canvasHeight: number;
  cells: Cell[];
}

/** Square-ish grid — enough columns that the last row is never mostly empty. */
export function computeGridColumns(count: number): number {
  return Math.max(1, Math.ceil(Math.sqrt(count)));
}

/** Fits `size` inside `box` without cropping, centered — the leftover space is filled by the caller's
 * background. Never scales up: the grid cell size is the largest image's footprint, so without this
 * cap a small image sharing a grid with a much bigger one would be blown up and visibly pixelated. */
function containFit(size: { width: number; height: number }, box: { width: number; height: number }): Cell {
  const scale = Math.min(box.width / size.width, box.height / size.height, 1);
  const width = Math.round(size.width * scale);
  const height = Math.round(size.height * scale);
  return { x: Math.round((box.width - width) / 2), y: Math.round((box.height - height) / 2), width, height };
}

/** Pure geometry: given each source image's natural size, computes the merged canvas size and
 * every image's placement — no canvas/DOM involved, so this is fully unit-testable. */
export function computeLayout(sizes: { width: number; height: number }[], layout: MergeLayout, gap: number): Layout {
  if (sizes.length === 0) return { canvasWidth: 0, canvasHeight: 0, cells: [] };

  if (layout === 'horizontal') {
    const commonHeight = Math.min(...sizes.map((s) => s.height));
    let x = 0;
    const cells: Cell[] = sizes.map((s) => {
      const width = Math.round((s.width * commonHeight) / s.height);
      const cell = { x, y: 0, width, height: commonHeight };
      x += width + gap;
      return cell;
    });
    return { canvasWidth: x - gap, canvasHeight: commonHeight, cells };
  }

  if (layout === 'vertical') {
    const commonWidth = Math.min(...sizes.map((s) => s.width));
    let y = 0;
    const cells: Cell[] = sizes.map((s) => {
      const height = Math.round((s.height * commonWidth) / s.width);
      const cell = { x: 0, y, width: commonWidth, height };
      y += height + gap;
      return cell;
    });
    return { canvasWidth: commonWidth, canvasHeight: y - gap, cells };
  }

  // grid: every cell is the same box (the largest image's footprint), each image contain-fit inside it.
  const columns = computeGridColumns(sizes.length);
  const rows = Math.ceil(sizes.length / columns);
  const cellWidth = Math.max(...sizes.map((s) => s.width));
  const cellHeight = Math.max(...sizes.map((s) => s.height));
  const cells = sizes.map((s, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const box = containFit(s, { width: cellWidth, height: cellHeight });
    return { x: col * (cellWidth + gap) + box.x, y: row * (cellHeight + gap) + box.y, width: box.width, height: box.height };
  });
  return { canvasWidth: columns * cellWidth + (columns - 1) * gap, canvasHeight: rows * cellHeight + (rows - 1) * gap, cells };
}

export function assertMergeable(files: File[]): void {
  if (files.length < MIN_IMAGES) throw new ImageMergeError(`Add at least ${MIN_IMAGES} images to merge.`, 'too_few');
  if (files.length > MAX_IMAGES) throw new ImageMergeError(`This tool merges up to ${MAX_IMAGES} images at once.`, 'too_many');
  for (const f of files) {
    if (!isSupportedInputImage(f)) throw new ImageMergeError('Only PNG, JPEG, WebP and BMP images are supported.', 'unsupported_file');
    if (f.size > MAX_MB_PER_IMAGE * 1024 * 1024) throw new ImageMergeError(`Each image must be under ${MAX_MB_PER_IMAGE} MB.`, 'too_large');
  }
}

export interface MergeResult {
  blob: Blob;
  width: number;
  height: number;
}

/** Decodes every image, lays them out per `opts.layout`, and composites one final image — all via canvas. */
export async function mergeImages(files: File[], opts: MergeOptions): Promise<MergeResult> {
  assertMergeable(files);

  const bitmaps: ImageBitmap[] = [];
  try {
    // Sequential, not Promise.all: a decoded bitmap can be far bigger than its compressed bytes,
    // so one oversized image should fail immediately, not after the whole batch decodes first.
    for (const f of files) {
      const bitmap = await createImageBitmap(f).catch(() => {
        throw new ImageMergeError('Could not read one of the images. It may be corrupted or an unsupported format.', 'decode_failed');
      });
      if (exceedsCanvasLimits(bitmap.width, bitmap.height)) {
        bitmap.close();
        throw new ImageMergeError(`One of your images (${bitmap.width}×${bitmap.height}px) is larger than a browser canvas can hold.`, 'too_large');
      }
      bitmaps.push(bitmap);
    }

    const layout = computeLayout(bitmaps, opts.layout, opts.gap);
    if (exceedsCanvasLimits(layout.canvasWidth, layout.canvasHeight)) {
      throw new ImageMergeError(`${layout.canvasWidth}×${layout.canvasHeight}px is larger than a browser canvas can hold — try fewer images or a smaller gap.`, 'too_large');
    }

    const canvas = document.createElement('canvas');
    canvas.width = layout.canvasWidth;
    canvas.height = layout.canvasHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageMergeError('Canvas 2D context is not available in this browser.', 'encode_failed');

    ctx.fillStyle = opts.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    bitmaps.forEach((bitmap, i) => {
      const cell = layout.cells[i]!;
      ctx.drawImage(bitmap, cell.x, cell.y, cell.width, cell.height);
    });

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, opts.format, opts.quality));
    if (!blob) throw new ImageMergeError('Could not create the merged image.', 'encode_failed');
    return { blob, width: canvas.width, height: canvas.height };
  } finally {
    bitmaps.forEach((b) => b.close());
  }
}
