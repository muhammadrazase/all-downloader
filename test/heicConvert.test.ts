import { describe, it, expect } from 'vitest';
import { buildConvertedFilename, DEFAULT_JPEG_QUALITY, HeicConvertError } from '@/lib/heicConvert';

// convertHeicToJpg()/isHeicFile() need a real browser and are covered in e2e/heicToJpg.spec.ts —
// this file only unit-tests the pure filename derivation, the piece that handles attacker input.
describe('buildConvertedFilename', () => {
  it('swaps the source extension for the chosen output format', () => {
    expect(buildConvertedFilename('IMG_4821.heic', 'jpg')).toBe('IMG_4821.jpg');
    expect(buildConvertedFilename('IMG_4821.HEIF', 'png')).toBe('IMG_4821.png');
  });

  it('keeps every dot but the last, so a dotted name is not truncated', () => {
    expect(buildConvertedFilename('holiday.2024.beach.heic', 'jpg')).toBe('holiday.2024.beach.jpg');
  });

  it('appends an extension to a name that has none', () => {
    expect(buildConvertedFilename('no-extension', 'jpg')).toBe('no-extension.jpg');
  });

  it('falls back to a real basename instead of producing a hidden dotfile', () => {
    expect(buildConvertedFilename('.heic', 'jpg')).toBe('photo.jpg');
    expect(buildConvertedFilename('', 'png')).toBe('photo.png');
    expect(buildConvertedFilename('   ', 'jpg')).toBe('photo.jpg');
  });

  it('strips path separators so a crafted name cannot steer where the download lands', () => {
    expect(buildConvertedFilename('../../../../etc/passwd.heic', 'jpg')).toBe('..-..-..-..-etc-passwd.jpg');
    expect(buildConvertedFilename('C:\\Windows\\System32\\config.heic', 'jpg')).toBe('C:-Windows-System32-config.jpg');
    expect(buildConvertedFilename('/absolute/photo.heic', 'png')).not.toContain('/');
  });

  it('caps a very long name so the result stays a writable filename', () => {
    const out = buildConvertedFilename(`${'a'.repeat(400)}.heic`, 'jpg');
    expect(out.length).toBeLessThanOrEqual(124);
    expect(out.endsWith('.jpg')).toBe(true);
  });

  it('leaves unicode and markup-looking names intact — React escapes them, mangling them is not our job', () => {
    expect(buildConvertedFilename('ünïcödé 🎞 photo.HEIC', 'jpg')).toBe('ünïcödé 🎞 photo.jpg');
    expect(buildConvertedFilename('<img src=x onerror=alert(1)>.heic', 'jpg')).toBe('<img src=x onerror=alert(1)>.jpg');
  });
});

describe('HeicConvertError', () => {
  it('carries a machine-readable code alongside the user-facing message', () => {
    const error = new HeicConvertError('Could not read the converted image.', 'encode_failed');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('HeicConvertError');
    expect(error.code).toBe('encode_failed');
  });
});

describe('DEFAULT_JPEG_QUALITY', () => {
  // The quality slider runs 0.1→1 in 0.05 steps; a default off that grid would render the thumb
  // at one value while the label and the actual encode used another.
  it('lands exactly on a step the quality slider can represent', () => {
    expect(DEFAULT_JPEG_QUALITY).toBeGreaterThanOrEqual(0.1);
    expect(DEFAULT_JPEG_QUALITY).toBeLessThanOrEqual(1);
    expect(Math.round((DEFAULT_JPEG_QUALITY - 0.1) / 0.05)).toBeCloseTo((DEFAULT_JPEG_QUALITY - 0.1) / 0.05, 9);
  });
});
