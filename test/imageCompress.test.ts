import { describe, it, expect } from 'vitest';
import {
  computeTargetDimensions,
  resolveDimensions,
  isSupportedInputImage,
  formatHasAlpha,
  exceedsCanvasLimits,
} from '../src/lib/imageCompress';

describe('computeTargetDimensions', () => {
  it('leaves the image unchanged if already within maxWidth', () => {
    expect(computeTargetDimensions(800, 600, 1920)).toEqual({ width: 800, height: 600 });
  });

  it('scales down proportionally when wider than maxWidth', () => {
    expect(computeTargetDimensions(4000, 2000, 2000)).toEqual({ width: 2000, height: 1000 });
  });

  it('rounds the scaled height', () => {
    expect(computeTargetDimensions(1000, 333, 300)).toEqual({ width: 300, height: 100 });
  });
});

describe('resolveDimensions', () => {
  it('mode "none" returns the original dimensions', () => {
    expect(resolveDimensions(1234, 567, { mode: 'none' })).toEqual({ width: 1234, height: 567 });
  });

  it('mode "exact" returns the requested dimensions regardless of aspect ratio', () => {
    expect(resolveDimensions(1000, 500, { mode: 'exact', width: 300, height: 300 })).toEqual({ width: 300, height: 300 });
  });

  it('mode "maxWidth" delegates to computeTargetDimensions', () => {
    expect(resolveDimensions(4000, 2000, { mode: 'maxWidth', maxWidth: 1000 })).toEqual({ width: 1000, height: 500 });
  });
});

describe('isSupportedInputImage', () => {
  it('accepts common raster formats', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/bmp']) {
      expect(isSupportedInputImage(new File([], 'x', { type }))).toBe(true);
    }
  });

  it('rejects unsupported types', () => {
    expect(isSupportedInputImage(new File([], 'x', { type: 'application/pdf' }))).toBe(false);
  });
});

describe('formatHasAlpha', () => {
  it('reports JPEG as the one output format that must be flattened onto a solid colour', () => {
    expect(formatHasAlpha('image/jpeg')).toBe(false);
    expect(formatHasAlpha('image/png')).toBe(true);
    expect(formatHasAlpha('image/webp')).toBe(true);
  });
});

describe('exceedsCanvasLimits', () => {
  it('accepts everyday photo and print dimensions', () => {
    expect(exceedsCanvasLimits(6000, 4000)).toBe(false);
    expect(exceedsCanvasLimits(1, 1)).toBe(false);
  });

  it('rejects an area beyond what a browser canvas can back', () => {
    expect(exceedsCanvasLimits(30_000, 30_000)).toBe(true);
  });

  it('rejects a single side beyond the canvas maximum', () => {
    expect(exceedsCanvasLimits(70_000, 1)).toBe(true);
    expect(exceedsCanvasLimits(1, 70_000)).toBe(true);
  });

  it('rejects degenerate (zero or negative) dimensions', () => {
    expect(exceedsCanvasLimits(0, 100)).toBe(true);
    expect(exceedsCanvasLimits(100, 0)).toBe(true);
  });
});
