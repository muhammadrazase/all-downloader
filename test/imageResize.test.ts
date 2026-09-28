import { describe, it, expect } from 'vitest';
import { computeCoverCrop, computeContainFit, assertResizable, ImageResizeError, SIZE_PRESETS, MAX_MB } from '@/lib/imageResize';

function fileOfSize(bytes: number, name = 'a.png', type = 'image/png'): File {
  const file = new File([new Uint8Array(0)], name, { type });
  Object.defineProperty(file, 'size', { value: bytes });
  return file;
}

describe('computeCoverCrop', () => {
  it('crops the wider dimension, centered, when the source is wider than the target aspect ratio', () => {
    // 2000x1000 (2:1) into a 1:1 target -> crop width down to match height
    const crop = computeCoverCrop(2000, 1000, 1000, 1000);
    expect(crop).toEqual({ sx: 500, sy: 0, sw: 1000, sh: 1000 });
  });

  it('crops the taller dimension, centered, when the source is taller than the target aspect ratio', () => {
    // 1000x2000 (1:2) into a 1:1 target -> crop height down to match width
    const crop = computeCoverCrop(1000, 2000, 1000, 1000);
    expect(crop).toEqual({ sx: 0, sy: 500, sw: 1000, sh: 1000 });
  });

  it('crops nothing when the source already matches the target aspect ratio exactly', () => {
    const crop = computeCoverCrop(1080, 1080, 1080, 1080);
    expect(crop).toEqual({ sx: 0, sy: 0, sw: 1080, sh: 1080 });
  });
});

describe('computeContainFit', () => {
  it('fits the wider dimension exactly and centers vertically when the source is wider than the target', () => {
    const fit = computeContainFit(2000, 1000, 1000, 1000);
    expect(fit).toEqual({ dx: 0, dy: 250, dw: 1000, dh: 500 });
  });

  it('fits the taller dimension exactly and centers horizontally when the source is taller than the target', () => {
    const fit = computeContainFit(1000, 2000, 1000, 1000);
    expect(fit).toEqual({ dx: 250, dy: 0, dw: 500, dh: 1000 });
  });

  it('fills the target exactly, with no offset, when the aspect ratios already match', () => {
    const fit = computeContainFit(1080, 1080, 1080, 1080);
    expect(fit).toEqual({ dx: 0, dy: 0, dw: 1080, dh: 1080 });
  });
});

describe('cover crop and contain fit are inverse-consistent', () => {
  it('cover always produces exactly the target dimensions', () => {
    for (const preset of SIZE_PRESETS) {
      const crop = computeCoverCrop(3000, 1500, preset.width, preset.height);
      expect(crop.sw).toBeGreaterThan(0);
      expect(crop.sh).toBeGreaterThan(0);
      expect(crop.sx).toBeGreaterThanOrEqual(0);
      expect(crop.sy).toBeGreaterThanOrEqual(0);
    }
  });

  it('contain never exceeds the target dimensions', () => {
    for (const preset of SIZE_PRESETS) {
      const fit = computeContainFit(3000, 1500, preset.width, preset.height);
      expect(fit.dw).toBeLessThanOrEqual(preset.width);
      expect(fit.dh).toBeLessThanOrEqual(preset.height);
    }
  });
});

describe('SIZE_PRESETS', () => {
  it('every preset has a unique key and positive dimensions', () => {
    const keys = SIZE_PRESETS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const p of SIZE_PRESETS) {
      expect(p.width).toBeGreaterThan(0);
      expect(p.height).toBeGreaterThan(0);
      expect(p.label.length).toBeGreaterThan(0);
    }
  });
});

describe('assertResizable', () => {
  it('rejects an unsupported file type', () => {
    try {
      assertResizable(fileOfSize(1024, 'a.pdf', 'application/pdf'));
      expect.unreachable('expected assertResizable to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ImageResizeError);
      expect((err as ImageResizeError).code).toBe('unsupported_file');
    }
  });

  it(`rejects a file over ${MAX_MB} MB`, () => {
    try {
      assertResizable(fileOfSize(MAX_MB * 1024 * 1024 + 1));
      expect.unreachable('expected assertResizable to throw');
    } catch (err) {
      expect((err as ImageResizeError).code).toBe('too_large');
    }
  });

  it('accepts a valid image within bounds', () => {
    expect(() => assertResizable(fileOfSize(1024))).not.toThrow();
  });
});
