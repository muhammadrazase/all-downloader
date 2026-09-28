import { describe, it, expect } from 'vitest';
import type { Segment } from '@/lib/ai';
import { toSrt, toVtt } from '@/lib/subtitles';

/**
 * Subtitle files are the product of /video-to-text — a malformed timestamp or a
 * stray blank line makes VLC/YouTube reject the whole file, so the exact bytes matter.
 */

const seg = (start: number, end: number, text: string): Segment => ({ start, end, text });

const SRT_CUE = /^\d+\n\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}\n/;
const VTT_CUE = /^\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}\n/;

describe('toSrt', () => {
  it('emits spec-shaped SRT: 1-based sequential index, comma timing line, blank line between cues', () => {
    const srt = toSrt([seg(0, 2.5, 'Hello there.'), seg(2.5, 4.25, 'Welcome back.')]);
    expect(srt).toBe(
      '1\n00:00:00,000 --> 00:00:02,500\nHello there.\n\n' +
        '2\n00:00:02,500 --> 00:00:04,250\nWelcome back.\n',
    );
  });

  it('numbers every cue sequentially from 1 with no gaps', () => {
    const srt = toSrt(Array.from({ length: 12 }, (_, i) => seg(i, i + 1, `line ${i}`)));
    const indexes = srt
      .trim()
      .split('\n\n')
      .map((block) => Number(block.split('\n')[0]));
    expect(indexes).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('formats a cue past the one-hour mark as HH:MM:SS,mmm', () => {
    expect(toSrt([seg(3725.5, 3726.125, 'late')])).toContain('01:02:05,500 --> 01:02:06,125');
  });

  it('rounds to whole milliseconds instead of emitting a 4-digit field', () => {
    // Regression: rounding the fractional part alone produced "00:00:01,1000",
    // which parsers reject outright. Gemini may return arbitrary decimals.
    const srt = toSrt([seg(1.9996, 59.9999, 'edge')]);
    expect(srt).toContain('00:00:02,000 --> 00:01:00,000');
    expect(srt).not.toMatch(/,\d{4}/);
  });

  it('carries a sub-millisecond rounding across the hour boundary', () => {
    expect(toSrt([seg(3599.9999, 3600, 'rollover')])).toContain('01:00:00,000 --> 01:00:00,000');
  });

  it('clamps a negative timestamp to zero rather than emitting "-1"', () => {
    expect(toSrt([seg(-5, 1, 'clamped')])).toContain('00:00:00,000 --> 00:00:01,000');
  });

  it('falls back to zero for a non-finite timestamp instead of "NaN:NaN:NaN"', () => {
    // Regression: Number(undefined) upstream can reach here as NaN.
    const srt = toSrt([seg(Number.NaN, Number.POSITIVE_INFINITY, 'junk')]);
    expect(srt).toContain('00:00:00,000 --> 00:00:00,000');
    expect(srt).not.toContain('NaN');
  });

  it('collapses a blank line inside cue text, which would otherwise end the cue early', () => {
    // Regression: "a\n\nb" split one cue into a cue plus an orphan block, which
    // desynchronises every following cue in a strict parser.
    const srt = toSrt([seg(0, 1, 'first line\n\nsecond line'), seg(1, 2, 'next')]);
    expect(srt).toBe('1\n00:00:00,000 --> 00:00:01,000\nfirst line\nsecond line\n\n2\n00:00:01,000 --> 00:00:02,000\nnext\n');
    expect(srt.trim().split('\n\n')).toHaveLength(2);
  });

  it('normalises CRLF inside cue text so cue blocks stay separable', () => {
    expect(toSrt([seg(0, 1, 'a\r\n\r\nb')])).toContain('\na\nb\n');
  });

  it('preserves out-of-order and overlapping segments verbatim (no silent re-sorting)', () => {
    const srt = toSrt([seg(10, 12, 'later'), seg(0, 11, 'earlier overlapping')]);
    expect(srt).toContain('1\n00:00:10,000 --> 00:00:12,000\nlater');
    expect(srt).toContain('2\n00:00:00,000 --> 00:00:11,000\nearlier overlapping');
  });

  it('returns a single newline for an empty transcript rather than throwing', () => {
    expect(toSrt([])).toBe('\n');
  });

  it('keeps every cue matching the SRT grammar for a realistic transcript', () => {
    const srt = toSrt([seg(0, 3.2, 'Intro'), seg(3.2, 9.87, 'Body, with punctuation!'), seg(9.87, 12, 'Outro')]);
    for (const block of srt.trim().split('\n\n')) expect(block).toMatch(SRT_CUE);
  });
});

describe('toVtt', () => {
  it('emits the WEBVTT header, a blank line, then dot-separated cues', () => {
    expect(toVtt([seg(0, 2.5, 'Hello there.')])).toBe('WEBVTT\n\n00:00:00.000 --> 00:00:02.500\nHello there.\n');
  });

  it('never uses the SRT comma separator', () => {
    const vtt = toVtt([seg(1.5, 2, 'a'), seg(2, 3, 'b')]);
    expect(vtt).not.toMatch(/\d,\d{3}/);
    expect(vtt.split('\n\n').slice(1).every((block) => VTT_CUE.test(block))).toBe(true);
  });

  it('does not number cues (unlike SRT)', () => {
    const vtt = toVtt([seg(0, 1, 'one'), seg(1, 2, 'two')]);
    expect(vtt.split('\n\n')[1]?.startsWith('00:00:00.000')).toBe(true);
  });

  it('formats past the one-hour mark and rounds milliseconds the same way as SRT', () => {
    expect(toVtt([seg(3725.5, 3726.9999, 'late')])).toContain('01:02:05.500 --> 01:02:07.000');
  });

  it('still emits a valid header for an empty transcript', () => {
    expect(toVtt([]).startsWith('WEBVTT\n')).toBe(true);
  });
});
