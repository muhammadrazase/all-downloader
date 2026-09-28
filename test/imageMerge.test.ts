import { describe, it, expect } from 'vitest';
import { computeGridColumns, computeLayout, assertMergeable, ImageMergeError, MIN_IMAGES, MAX_IMAGES, MAX_MB_PER_IMAGE } from '@/lib/imageMerge';

function fileOfSize(bytes: number, name = 'a.png', type = 'image/png'): File {
  const file = new File([new Uint8Array(0)], name, { type });
  Object.defineProperty(file, 'size', { value: bytes });
  return file;
}

describe('computeGridColumns', () => {
  it('picks a square-ish column count', () => {
    expect(computeGridColumns(1)).toBe(1);
    expect(computeGridColumns(4)).toBe(2);
    expect(computeGridColumns(5)).toBe(3);
    expect(computeGridColumns(9)).toBe(3);
    expect(computeGridColumns(10)).toBe(4);
  });
});

describe('computeLayout — horizontal', () => {
  it('normalizes every image to the shortest height, preserving each aspect ratio', () => {
    const layout = computeLayout([{ width: 200, height: 100 }, { width: 100, height: 50 }], 'horizontal', 0);
    expect(layout.canvasHeight).toBe(50);
    expect(layout.cells[0]).toEqual({ x: 0, y: 0, width: 100, height: 50 });
    expect(layout.cells[1]).toEqual({ x: 100, y: 0, width: 100, height: 50 });
    expect(layout.canvasWidth).toBe(200);
  });

  it('accounts for the gap between images', () => {
    const layout = computeLayout([{ width: 100, height: 100 }, { width: 100, height: 100 }], 'horizontal', 20);
    expect(layout.canvasWidth).toBe(220);
    expect(layout.cells[1]!.x).toBe(120);
  });
});

describe('computeLayout — vertical', () => {
  it('normalizes every image to the narrowest width, stacking top to bottom', () => {
    const layout = computeLayout([{ width: 200, height: 100 }, { width: 100, height: 200 }], 'vertical', 0);
    expect(layout.canvasWidth).toBe(100);
    expect(layout.cells[0]).toEqual({ x: 0, y: 0, width: 100, height: 50 });
    expect(layout.cells[1]).toEqual({ x: 0, y: 50, width: 100, height: 200 });
  });
});

describe('computeLayout — grid', () => {
  it('sizes every cell to the largest image and centers smaller ones inside it', () => {
    const layout = computeLayout([{ width: 100, height: 100 }, { width: 50, height: 50 }, { width: 100, height: 100 }], 'grid', 0);
    expect(layout.canvasWidth).toBe(200); // 2 columns of 100px
    expect(layout.canvasHeight).toBe(200); // 2 rows of 100px
    expect(layout.cells[0]).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    // the 50x50 image is contain-fit and centered inside its 100x100 cell
    expect(layout.cells[1]).toEqual({ x: 100 + 25, y: 25, width: 50, height: 50 });
    expect(layout.cells[2]).toEqual({ x: 0, y: 100, width: 100, height: 100 });
  });

  it('leaves the last row left-aligned when the count does not fill it', () => {
    const sizes = Array.from({ length: 5 }, () => ({ width: 100, height: 100 }));
    const layout = computeLayout(sizes, 'grid', 0);
    expect(layout.cells).toHaveLength(5);
    // 5 images -> 3 columns, 2 rows; last row has only 2 images at columns 0 and 1
    expect(layout.cells[3]!.y).toBe(layout.cells[4]!.y);
    expect(layout.cells[4]!.x).toBeLessThan(layout.canvasWidth);
  });
});

describe('computeLayout — empty input', () => {
  it('returns a zero-size, empty layout rather than throwing or dividing by zero', () => {
    expect(computeLayout([], 'horizontal', 10)).toEqual({ canvasWidth: 0, canvasHeight: 0, cells: [] });
  });
});

describe('assertMergeable', () => {
  it(`rejects fewer than ${MIN_IMAGES} images`, () => {
    try {
      assertMergeable([fileOfSize(1024)]);
      expect.unreachable('expected assertMergeable to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ImageMergeError);
      expect((err as ImageMergeError).code).toBe('too_few');
    }
  });

  it(`rejects more than ${MAX_IMAGES} images`, () => {
    const files = Array.from({ length: MAX_IMAGES + 1 }, () => fileOfSize(1024));
    try {
      assertMergeable(files);
      expect.unreachable('expected assertMergeable to throw');
    } catch (err) {
      expect((err as ImageMergeError).code).toBe('too_many');
    }
  });

  it('rejects an unsupported file type', () => {
    try {
      assertMergeable([fileOfSize(1024), fileOfSize(1024, 'b.pdf', 'application/pdf')]);
      expect.unreachable('expected assertMergeable to throw');
    } catch (err) {
      expect((err as ImageMergeError).code).toBe('unsupported_file');
    }
  });

  it(`rejects a file over ${MAX_MB_PER_IMAGE} MB`, () => {
    try {
      assertMergeable([fileOfSize(1024), fileOfSize(MAX_MB_PER_IMAGE * 1024 * 1024 + 1)]);
      expect.unreachable('expected assertMergeable to throw');
    } catch (err) {
      expect((err as ImageMergeError).code).toBe('too_large');
    }
  });

  it('accepts a valid set of images within bounds', () => {
    expect(() => assertMergeable([fileOfSize(1024), fileOfSize(1024)])).not.toThrow();
  });
});

describe('ImageMergeError', () => {
  it('is a real Error subclass', () => {
    const err = new ImageMergeError('too many', 'too_many');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ImageMergeError');
  });
});
