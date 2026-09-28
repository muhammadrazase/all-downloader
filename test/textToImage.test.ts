import { describe, it, expect } from 'vitest';
import { wrapLines, SIZE_PRESETS } from '../src/lib/textToImage';

// Fake monospace measurer (1 unit per char) — lets us test wrap logic without a real Canvas.
const measure = (s: string) => s.length;

describe('wrapLines', () => {
  it('keeps a short line on one line', () => {
    expect(wrapLines('hello world', measure, 20)).toEqual(['hello world']);
  });

  it('wraps at the word boundary once maxWidth is exceeded', () => {
    expect(wrapLines('one two three four', measure, 8)).toEqual(['one two', 'three', 'four']);
  });

  it('preserves explicit newlines as paragraph breaks', () => {
    expect(wrapLines('line one\nline two', measure, 100)).toEqual(['line one', 'line two']);
  });

  it('preserves blank lines', () => {
    expect(wrapLines('a\n\nb', measure, 100)).toEqual(['a', '', 'b']);
  });

  it('hard-breaks a single word wider than the line instead of letting it run off the canvas', () => {
    expect(wrapLines('supercalifragilistic', measure, 5)).toEqual(['super', 'calif', 'ragil', 'istic']);
  });

  it('never emits a line wider than maxWidth, even for an unbroken URL', () => {
    const text = 'Check this out: https://example.com/a/very/long/path/that/never/breaks/anywhere-at-all';
    for (const line of wrapLines(text, measure, 20)) expect(line.length).toBeLessThanOrEqual(20);
  });

  it('starts a hard-broken word on a fresh line rather than splicing it into the previous one', () => {
    expect(wrapLines('hi ABCDEFGHIJ', measure, 5)).toEqual(['hi', 'ABCDE', 'FGHIJ']);
  });

  it('keeps surrogate pairs intact when breaking', () => {
    expect(wrapLines('😀😀😀😀', measure, 2)).toEqual(['😀', '😀', '😀', '😀']);
  });

  it('degrades to one code point per line rather than looping forever on a zero-width line', () => {
    expect(wrapLines('abc', measure, 0)).toEqual(['a', 'b', 'c']);
  });
});

describe('SIZE_PRESETS', () => {
  it('has a unique id and a positive width for every preset', () => {
    const ids = SIZE_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of SIZE_PRESETS) expect(preset.width).toBeGreaterThan(0);
  });

  it('labels every fixed-size preset with its exact pixel dimensions', () => {
    for (const preset of SIZE_PRESETS) {
      if (preset.height === undefined) continue;
      expect(preset.label).toContain(`${preset.width}×${preset.height}`);
    }
  });
});
