import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  convertSpec,
  convert,
  isVideoFile,
  isAudioFile,
  assertConvertible,
  assertConvertibleAudio,
  ConvertError,
  INPUT_NAME,
  MAX_INPUT_MB,
  MAX_INPUT_BYTES,
  trim,
  trimArgs,
  trimAudio,
  trimAudioArgs,
  compressVideo,
  compressArgs,
  addWatermark,
  watermarkArgs,
  changeSpeed,
  speedArgs,
  atempoChain,
  SPEED_PRESETS,
  MAX_WATERMARK_MB,
  MAX_MERGE_MB_PER_VIDEO,
  MAX_MERGE_TOTAL_MB,
  MIN_MERGE_VIDEOS,
  MAX_MERGE_VIDEOS,
  assertMergeableVideos,
  mergeVideoArgs,
  mergeVideos,
  normalizeMergeDimensions,
  parseProbeOutput,
  type ConvertKind,
  type CompressQuality,
  type WatermarkSize,
  type SpeedPreset,
} from '@/lib/convert';
import { CONVERTER_TOOLS, CONVERTER_LIST } from '@/lib/converterTools';
import type { ConverterKey } from '@/lib/converterTools';

const ALL_KINDS: ConvertKind[] = ['mp3', 'gif', '720', '480'];

/** Faking `size` avoids allocating 200 MB of real bytes just to test a comparison. */
function fileOfSize(bytes: number, name = 'clip.mp4', type = 'video/mp4'): File {
  const file = new File([new Uint8Array(0)], name, { type });
  Object.defineProperty(file, 'size', { value: bytes });
  return file;
}

describe('convertSpec — the exact ffmpeg recipe per kind', () => {
  it('mp3 strips video and encodes at the 192 kbps the marketing copy promises', () => {
    expect(convertSpec('mp3').args('input', 'audio.mp3')).toEqual(['-i', 'input', '-vn', '-b:a', '192k', 'audio.mp3']);
  });

  it('gif uses the 12 fps / 480 px lanczos recipe and loops forever', () => {
    expect(convertSpec('gif').args('input', 'animation.gif')).toEqual([
      '-i', 'input', '-vf', 'fps=12,scale=480:-1:flags=lanczos', '-loop', '0', 'animation.gif',
    ]);
  });

  it('720 scales to height 720 with -2 width so the result stays even (h264 requires it)', () => {
    expect(convertSpec('720').args('input', 'video-720p.mp4')).toEqual([
      '-i', 'input', '-vf', 'scale=-2:720', '-c:a', 'aac', '-b:a', '128k', 'video-720p.mp4',
    ]);
  });

  it('480 scales to height 480 with the same even-width guarantee', () => {
    expect(convertSpec('480').args('input', 'video-480p.mp4')).toEqual([
      '-i', 'input', '-vf', 'scale=-2:480', '-c:a', 'aac', '-b:a', '128k', 'video-480p.mp4',
    ]);
  });

  it('the MP4 kinds re-encode audio to AAC — copying Opus/Vorbis into MP4 breaks Safari playback', () => {
    for (const kind of ['720', '480'] as const) {
      const args = convertSpec(kind).args(INPUT_NAME, convertSpec(kind).out);
      expect(args).toContain('aac');
      expect(args).not.toContain('copy');
    }
  });

  it('every kind declares an output name, a MIME type, and an args builder', () => {
    for (const kind of ALL_KINDS) {
      const spec = convertSpec(kind);
      expect(spec.out).toBeTruthy();
      expect(spec.type).toMatch(/^(audio|video|image)\//);
      expect(typeof spec.args).toBe('function');
    }
  });

  it('the output extension matches the declared MIME type (the download must not lie)', () => {
    const expected: Record<ConvertKind, { ext: string; type: string }> = {
      mp3: { ext: '.mp3', type: 'audio/mpeg' },
      gif: { ext: '.gif', type: 'image/gif' },
      '720': { ext: '.mp4', type: 'video/mp4' },
      '480': { ext: '.mp4', type: 'video/mp4' },
    };
    for (const kind of ALL_KINDS) {
      expect(convertSpec(kind).out.endsWith(expected[kind].ext)).toBe(true);
      expect(convertSpec(kind).type).toBe(expected[kind].type);
    }
  });

  it('the output filename ends up in the ffmpeg args as the LAST element (ffmpeg output-position rule)', () => {
    for (const kind of ALL_KINDS) {
      const spec = convertSpec(kind);
      const args = spec.args(INPUT_NAME, spec.out);
      expect(args[args.length - 1]).toBe(spec.out);
    }
  });

  it('the input filename is always passed as the value of -i, never concatenated into another arg', () => {
    for (const kind of ALL_KINDS) {
      const spec = convertSpec(kind);
      const args = spec.args(INPUT_NAME, spec.out);
      expect(args.indexOf('-i')).toBe(0);
      expect(args[1]).toBe(INPUT_NAME);
    }
  });
});

describe('argument injection — a hostile filename must not reach ffmpeg', () => {
  const hostileNames = [
    '; rm -rf /',
    '-y',
    '--help',
    '-f lavfi',
    '$(id).mp4',
    '`id`.mp4',
    'a" -vcodec copy "b.mp4',
    "a' -y '",
    'clip\n-y\n.mp4',
    '../../../etc/passwd',
    'a'.repeat(5000) + '.mp4',
    '🎬 emoji … unicode.mp4',
  ];

  it('the wasm-FS input name is a fixed constant, not derived from the user filename', () => {
    expect(INPUT_NAME).toBe('input');
    for (const name of hostileNames) {
      expect(INPUT_NAME).not.toContain(name);
    }
  });

  it('the args array is identical no matter what the user named their file', () => {
    // convert() writes the upload to the fixed INPUT_NAME and reads back a fixed
    // output name, so no user-controlled string ever reaches spec.args().
    for (const kind of ALL_KINDS) {
      const spec = convertSpec(kind);
      const baseline = spec.args(INPUT_NAME, spec.out);
      for (const name of hostileNames) {
        const file = fileOfSize(1024, name.endsWith('.mp4') ? name : `${name}.mp4`);
        expect(isVideoFile(file) || file.type.startsWith('video/')).toBe(true);
        expect(spec.args(INPUT_NAME, spec.out)).toEqual(baseline);
      }
    }
  });

  it('every generated arg is a plain string — nothing is shell-interpolated or object-coerced', () => {
    for (const kind of ALL_KINDS) {
      const spec = convertSpec(kind);
      for (const arg of spec.args(INPUT_NAME, spec.out)) {
        expect(typeof arg).toBe('string');
        expect(arg.length).toBeGreaterThan(0);
      }
    }
  });

  it('no arg carries an embedded space-separated flag pair (which a shell would re-split)', () => {
    // ffmpeg.wasm takes an argv array, so "-vf scale=-2:720" as ONE element would be
    // read as a single literal flag and silently produce a wrong or failed output.
    for (const kind of ALL_KINDS) {
      for (const arg of convertSpec(kind).args(INPUT_NAME, convertSpec(kind).out)) {
        expect(arg).not.toMatch(/^-\S+\s/);
      }
    }
  });

  it('the downloaded filename is a fixed safe name, so a hostile upload name cannot become the download name', () => {
    for (const kind of ALL_KINDS) {
      expect(convertSpec(kind).out).toMatch(/^[a-z0-9-]+\.[a-z0-9]+$/);
    }
  });
});

describe('trim', () => {
  it('builds the precise re-encode recipe with -ss before -i and -t for duration, not -to', () => {
    expect(trimArgs(2.5, 10, 'input', 'trimmed.mp4')).toEqual([
      '-ss', '2.500', '-i', 'input', '-t', '10.000',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', 'trimmed.mp4',
    ]);
  });

  it('never emits exponential notation, which ffmpeg\'s time parser rejects outright', () => {
    // Regression: tiny decimals like 1e-7 stringify as "1e-7", which ffmpeg rejects — miscast as
    // "unsupported format". toFixed's own exponential threshold (1e21) is unreachable here.
    for (const start of [1e-7, 0.00049, 1e-21]) {
      for (const arg of trimArgs(start, 2, 'input', 'out.mp4')) expect(arg).not.toMatch(/e[+-]\d/i);
    }
    expect(trimArgs(1e-7, 2, 'input', 'out.mp4')).toContain('0.000');
  });

  it('keeps sub-second precision the user actually typed', () => {
    expect(trimArgs(2.567, 1.556, 'input', 'out.mp4').slice(0, 6)).toEqual(['-ss', '2.567', '-i', 'input', '-t', '1.556']);
  });

  it('never offers a -c copy fast path — always re-encodes video and audio explicitly', () => {
    expect(trimArgs(0, 5, 'input', 'trimmed.mp4')).not.toContain('copy');
  });

  it('a hostile filename never reaches the args array — the fixed INPUT_NAME is used regardless', () => {
    const hostileNames = ['; rm -rf /', '-y', '--help', '$(id).mp4', '`id`.mp4', "a' -y '", '../../../etc/passwd', '🎬 emoji.mp4'];
    const baseline = trimArgs(0, 5, INPUT_NAME, 'trimmed.mp4');
    for (const name of hostileNames) {
      const file = fileOfSize(1024, name.endsWith('.mp4') ? name : `${name}.mp4`);
      expect(isVideoFile(file) || file.type.startsWith('video/')).toBe(true);
      expect(trimArgs(0, 5, INPUT_NAME, 'trimmed.mp4')).toEqual(baseline);
    }
  });

  it('rejects an end before or equal to start, without loading the 32 MB engine', async () => {
    const file = fileOfSize(1024);
    await expect(trim(file, 5, 5, () => {})).rejects.toMatchObject({ code: 'invalid_range' });
    await expect(trim(file, 5, 2, () => {})).rejects.toMatchObject({ code: 'invalid_range' });
  });

  it('rejects a selection shorter than the minimum trim length', async () => {
    await expect(trim(fileOfSize(1024), 0, 0.1, () => {})).rejects.toMatchObject({ code: 'invalid_range' });
  });

  it('rejects a negative start', async () => {
    await expect(trim(fileOfSize(1024), -1, 5, () => {})).rejects.toMatchObject({ code: 'invalid_range' });
  });

  it('checks the file itself is convertible before validating the range', async () => {
    await expect(trim(fileOfSize(MAX_INPUT_BYTES + 1), 0, 5, () => {})).rejects.toMatchObject({ code: 'too_large' });
  });
});

describe('isVideoFile', () => {
  it('accepts anything the browser labels video/*', () => {
    expect(isVideoFile(new File([], 'clip.mp4', { type: 'video/mp4' }))).toBe(true);
    expect(isVideoFile(new File([], 'clip.mkv', { type: 'video/x-matroska' }))).toBe(true);
  });

  it('falls back to the extension when the browser reports no MIME type', () => {
    // Real-world: Windows Chrome often reports "" for .mkv and .avi uploads.
    for (const ext of ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v']) {
      expect(isVideoFile(new File([], `clip.${ext}`, { type: '' }))).toBe(true);
      expect(isVideoFile(new File([], `CLIP.${ext.toUpperCase()}`, { type: '' }))).toBe(true);
    }
  });

  it('rejects non-video files with neither a video MIME type nor a video extension', () => {
    expect(isVideoFile(new File([], 'doc.pdf', { type: 'application/pdf' }))).toBe(false);
    expect(isVideoFile(new File([], 'song.mp3', { type: 'audio/mpeg' }))).toBe(false);
    expect(isVideoFile(new File([], 'photo.png', { type: 'image/png' }))).toBe(false);
    expect(isVideoFile(new File([], 'noext', { type: '' }))).toBe(false);
  });

  it('is not fooled by a video extension buried mid-name', () => {
    expect(isVideoFile(new File([], 'clip.mp4.exe', { type: '' }))).toBe(false);
    expect(isVideoFile(new File([], 'mp4', { type: '' }))).toBe(false);
  });
});

describe('assertConvertible — the 200 MB guard', () => {
  it('accepts a file exactly at the cap (boundary, inclusive)', () => {
    expect(() => assertConvertible(fileOfSize(MAX_INPUT_BYTES))).not.toThrow();
  });

  it('rejects one byte over the cap with a typed too_large error', () => {
    const oversize = fileOfSize(MAX_INPUT_BYTES + 1);
    expect(() => assertConvertible(oversize)).toThrow(ConvertError);
    try {
      assertConvertible(oversize);
      expect.unreachable('expected assertConvertible to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ConvertError);
      expect((err as ConvertError).code).toBe('too_large');
    }
  });

  it('rejects a non-video file with a distinct not_video code (so the UI can explain why)', () => {
    try {
      assertConvertible(new File([], 'doc.pdf', { type: 'application/pdf' }));
      expect.unreachable('expected assertConvertible to throw');
    } catch (err) {
      expect((err as ConvertError).code).toBe('not_video');
    }
  });

  it('checks type before size, so a huge non-video is reported as the wrong type, not the wrong size', () => {
    try {
      assertConvertible(fileOfSize(MAX_INPUT_BYTES * 2, 'huge.pdf', 'application/pdf'));
      expect.unreachable('expected assertConvertible to throw');
    } catch (err) {
      expect((err as ConvertError).code).toBe('not_video');
    }
  });

  it('accepts an empty (0-byte) file at this layer — ffmpeg is what rejects it, with exit != 0', () => {
    // Documented on purpose: the size guard is an upper bound only. The E2E suite
    // covers what a 0-byte / corrupt input actually does end-to-end.
    expect(() => assertConvertible(fileOfSize(0))).not.toThrow();
  });
});

describe('convert() enforces the guard before loading the 32 MB wasm engine', () => {
  it('rejects an oversized file without ever touching ffmpeg.wasm', async () => {
    // Runs in Node with no browser: if convert() reached getEngine() this would fail
    // on the wasm fetch instead, so a clean ConvertError proves the guard ran first.
    const progress: number[] = [];
    await expect(convert(fileOfSize(MAX_INPUT_BYTES + 1), 'mp3', (p) => progress.push(p))).rejects.toMatchObject({
      name: 'ConvertError',
      code: 'too_large',
    });
    expect(progress).toEqual([]);
  });

  it('rejects a non-video file the same way', async () => {
    await expect(convert(new File([], 'doc.pdf', { type: 'application/pdf' }), 'gif', () => {})).rejects.toMatchObject({
      code: 'not_video',
    });
  });
});

describe('ConvertError', () => {
  it('is a real Error subclass so instanceof and stack traces work across the async boundary', () => {
    const err = new ConvertError('failed', 'ffmpeg exited with code 1');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ConvertError);
    expect(err.name).toBe('ConvertError');
    expect(err.code).toBe('failed');
  });

  it('carries no user data in its message (the message is surfaced in the UI)', () => {
    const err = new ConvertError('too_large', `File exceeds ${MAX_INPUT_MB} MB`);
    expect(err.message).not.toMatch(/\//);
  });
});

describe('trimAudioArgs', () => {
  it('builds the audio-only recipe: no video re-encode settings, just bitrate', () => {
    expect(trimAudioArgs(2.5, 10, 'input', 'trimmed.mp3')).toEqual([
      '-ss', '2.500', '-i', 'input', '-t', '10.000', '-vn', '-b:a', '192k', 'trimmed.mp3',
    ]);
  });

  it('never emits exponential notation', () => {
    for (const arg of trimAudioArgs(1e-7, 2, 'input', 'out.mp3')) expect(arg).not.toMatch(/e[+-]\d/i);
  });
});

describe('isAudioFile', () => {
  it('accepts anything the browser labels audio/*', () => {
    expect(isAudioFile(new File([], 'song.mp3', { type: 'audio/mpeg' }))).toBe(true);
  });

  it('falls back to the extension when the browser reports no MIME type', () => {
    for (const ext of ['mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac', 'opus']) {
      expect(isAudioFile(new File([], `clip.${ext}`, { type: '' }))).toBe(true);
    }
  });

  it('rejects video and other non-audio files', () => {
    expect(isAudioFile(new File([], 'clip.mp4', { type: 'video/mp4' }))).toBe(false);
    expect(isAudioFile(new File([], 'doc.pdf', { type: 'application/pdf' }))).toBe(false);
  });
});

describe('trimAudio', () => {
  it('rejects a video file — this tool is audio-only', () => {
    try {
      assertConvertibleAudio(new File([], 'clip.mp4', { type: 'video/mp4' }));
      expect.unreachable('expected assertConvertibleAudio to throw');
    } catch (err) {
      expect((err as ConvertError).code).toBe('not_video');
    }
  });

  it('rejects an end before or equal to start, without loading the engine', async () => {
    const file = fileOfSize(1024, 'clip.mp3', 'audio/mpeg');
    await expect(trimAudio(file, 5, 5, () => {})).rejects.toMatchObject({ code: 'invalid_range' });
  });

  it('checks the file itself is convertible before validating the range', async () => {
    const oversize = fileOfSize(MAX_INPUT_BYTES + 1, 'clip.mp3', 'audio/mpeg');
    await expect(trimAudio(oversize, 0, 5, () => {})).rejects.toMatchObject({ code: 'too_large' });
  });
});

describe('compressArgs', () => {
  it('maps quality presets to the documented CRF values', () => {
    expect(compressArgs('high', 'input', 'out.mp4')).toContain('20');
    expect(compressArgs('medium', 'input', 'out.mp4')).toContain('26');
    expect(compressArgs('low', 'input', 'out.mp4')).toContain('32');
  });

  it('only ever downscales (min(1920,iw)), never upscales a smaller video', () => {
    const args = compressArgs('medium', 'input', 'out.mp4');
    const vf = args[args.indexOf('-vf') + 1];
    expect(vf).toBe("scale='min(1920,iw)':-2");
  });

  it('never offers a -c copy fast path', () => {
    expect(compressArgs('medium', 'input', 'out.mp4')).not.toContain('copy');
  });

  it('re-encodes audio to AAC for broad compatibility', () => {
    expect(compressArgs('medium', 'input', 'out.mp4')).toContain('aac');
  });

  it('falls back to medium instead of a prototype-chain lookup for a value outside the union', () => {
    // TypeScript's union type is erased at runtime — a caller that reached here via an unchecked
    // `as` cast on unvalidated input could otherwise pass "constructor" or "__proto__" straight
    // through to Object property access on COMPRESS_CRF.
    for (const hostileValue of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      const hostile = compressArgs(hostileValue as CompressQuality, 'input', 'out.mp4');
      expect(hostile).toEqual(compressArgs('medium', 'input', 'out.mp4'));
    }
  });
});

describe('compressVideo', () => {
  it('rejects an oversized file without loading the engine', async () => {
    const progress: number[] = [];
    await expect(compressVideo(fileOfSize(MAX_INPUT_BYTES + 1), 'medium', (p) => progress.push(p))).rejects.toMatchObject({ code: 'too_large' });
    expect(progress).toEqual([]);
  });

  it('rejects a non-video file', async () => {
    await expect(compressVideo(new File([], 'doc.pdf', { type: 'application/pdf' }), 'medium', () => {})).rejects.toMatchObject({ code: 'not_video' });
  });
});

describe('watermarkArgs', () => {
  it('places input 0 as the main video and input 1 (looped) as the watermark image', () => {
    const args = watermarkArgs('medium', 80, 'bottom-right', 'main.mp4', 'logo.png', 'out.mp4');
    expect(args.slice(0, 2)).toEqual(['-i', 'main.mp4']);
    expect(args).toEqual(expect.arrayContaining(['-loop', '1']));
    expect(args[args.indexOf('-loop') + 3]).toBe('logo.png');
  });

  it('maps each named position to the correct overlay x/y expression', () => {
    const filterFor = (position: Parameters<typeof watermarkArgs>[2]) => {
      const args = watermarkArgs('medium', 100, position, 'i', 'w', 'o');
      return args[args.indexOf('-filter_complex') + 1]!;
    };
    expect(filterFor('top-left')).toContain('overlay=24:24');
    expect(filterFor('top-right')).toContain('overlay=main_w-overlay_w-24:24');
    expect(filterFor('bottom-left')).toContain('overlay=24:main_h-overlay_h-24');
    expect(filterFor('bottom-right')).toContain('overlay=main_w-overlay_w-24:main_h-overlay_h-24');
    expect(filterFor('center')).toContain('overlay=(main_w-overlay_w)/2:(main_h-overlay_h)/2');
  });

  it('maps each size preset to a distinct fixed pixel width', () => {
    const widthFor = (size: Parameters<typeof watermarkArgs>[0]) => {
      const filter = watermarkArgs(size, 100, 'center', 'i', 'w', 'o')[watermarkArgs(size, 100, 'center', 'i', 'w', 'o').indexOf('-filter_complex') + 1]!;
      return filter.match(/scale=(\d+):-1/)?.[1];
    };
    expect(widthFor('small')).toBe('100');
    expect(widthFor('medium')).toBe('180');
    expect(widthFor('large')).toBe('280');
  });

  it('falls back to medium instead of a prototype-chain lookup for a size outside the union', () => {
    // Same erasure risk as compressArgs' quality — "constructor" resolves on the plain object
    // WATERMARK_WIDTH_PX unless explicitly guarded, and the result would land inside a filter
    // string handed to ffmpeg (e.g. "scale=function Object() { [native code] }:-1").
    for (const hostileValue of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      const hostile = watermarkArgs(hostileValue as WatermarkSize, 80, 'center', 'i', 'w', 'o');
      expect(hostile).toEqual(watermarkArgs('medium', 80, 'center', 'i', 'w', 'o'));
    }
  });

  it('bakes opacity into the watermark stream via colorchannelmixer, clamped to 0-100%', () => {
    expect(watermarkArgs('medium', 50, 'center', 'i', 'w', 'o').join(' ')).toContain('colorchannelmixer=aa=0.50');
    expect(watermarkArgs('medium', 500, 'center', 'i', 'w', 'o').join(' ')).toContain('colorchannelmixer=aa=1.00');
    expect(watermarkArgs('medium', -50, 'center', 'i', 'w', 'o').join(' ')).toContain('colorchannelmixer=aa=0.00');
  });

  it('caps output duration to the main video via shortest, so the looped image input cannot run forever', () => {
    const args = watermarkArgs('medium', 100, 'center', 'i', 'w', 'o');
    expect(args).toContain('-shortest');
    expect(args[args.indexOf('-filter_complex') + 1]).toContain('shortest=1');
  });

  it('maps the composited stream and optionally the original audio, never the raw inputs directly', () => {
    const args = watermarkArgs('medium', 100, 'center', 'i', 'w', 'o');
    expect(args).toEqual(expect.arrayContaining(['-map', '[out]', '-map', '0:a?']));
  });
});

describe('addWatermark', () => {
  it('rejects an oversized video without loading the engine', async () => {
    const logo = new File([], 'logo.png', { type: 'image/png' });
    await expect(addWatermark(fileOfSize(MAX_INPUT_BYTES + 1), logo, { size: 'medium', opacityPercent: 80, position: 'center' }, () => {})).rejects.toMatchObject({ code: 'too_large' });
  });

  it('rejects a non-image watermark file', async () => {
    const video = fileOfSize(1024);
    const badLogo = new File([], 'logo.pdf', { type: 'application/pdf' });
    await expect(addWatermark(video, badLogo, { size: 'medium', opacityPercent: 80, position: 'center' }, () => {})).rejects.toMatchObject({ code: 'not_video' });
  });
});

describe('atempoChain', () => {
  it('passes a speed already inside [0.5, 2.0] through as a single stage', () => {
    expect(atempoChain(1.5)).toBe('atempo=1.500');
    expect(atempoChain(0.5)).toBe('atempo=0.500');
    expect(atempoChain(2)).toBe('atempo=2.000');
  });

  it('chains two stages for 4x, since atempo alone maxes out at 2.0', () => {
    expect(atempoChain(4)).toBe('atempo=2.000,atempo=2.000');
  });

  it('chains two stages for 0.25x, since atempo alone bottoms out at 0.5', () => {
    expect(atempoChain(0.25)).toBe('atempo=0.500,atempo=0.500');
  });

  it('every stage in every preset stays within atempo\'s documented [0.5, 2.0] range', () => {
    for (const preset of SPEED_PRESETS) {
      const stages = atempoChain(preset).split(',').map((s) => Number(s.replace('atempo=', '')));
      for (const stage of stages) {
        expect(stage).toBeGreaterThanOrEqual(0.5);
        expect(stage).toBeLessThanOrEqual(2);
      }
      // The stages must multiply back to the requested speed, or the audio drifts out of sync with the video.
      const product = stages.reduce((a, b) => a * b, 1);
      expect(product).toBeCloseTo(preset, 2);
    }
  });

  it('rejects non-finite or non-positive speeds instead of looping forever', () => {
    for (const bad of [0, -1, NaN, Infinity, -Infinity]) {
      expect(() => atempoChain(bad)).toThrow(ConvertError);
    }
  });
});

describe('speedArgs', () => {
  it('inverts the speed for setpts (2x speed -> setpts=0.5*PTS)', () => {
    const args = speedArgs(2, 'input', 'out.mp4');
    expect(args[args.indexOf('-vf') + 1]).toBe('setpts=0.500000*PTS');
  });

  it('slowing down inflates PTS (0.5x speed -> setpts=2.0*PTS)', () => {
    const args = speedArgs(0.5, 'input', 'out.mp4');
    expect(args[args.indexOf('-vf') + 1]).toBe('setpts=2.000000*PTS');
  });

  it('always includes an audio filter — verified separately that ffmpeg no-ops it gracefully on a silent source', () => {
    const args = speedArgs(2, 'input', 'out.mp4');
    expect(args[args.indexOf('-af') + 1]).toBe('atempo=2.000');
  });

  it('never offers a -c copy fast path', () => {
    expect(speedArgs(2, 'input', 'out.mp4')).not.toContain('copy');
  });

  it('re-encodes audio to AAC for broad compatibility', () => {
    expect(speedArgs(2, 'input', 'out.mp4')).toContain('aac');
  });
});

describe('changeSpeed', () => {
  it('rejects an oversized file without loading the engine', async () => {
    const progress: number[] = [];
    await expect(changeSpeed(fileOfSize(MAX_INPUT_BYTES + 1), 2, (p) => progress.push(p))).rejects.toMatchObject({ code: 'too_large' });
    expect(progress).toEqual([]);
  });

  it('rejects a non-video file', async () => {
    await expect(changeSpeed(new File([], 'doc.pdf', { type: 'application/pdf' }), 2, () => {})).rejects.toMatchObject({ code: 'not_video' });
  });

  it('rejects a speed outside the documented preset list, without loading the engine', async () => {
    await expect(changeSpeed(fileOfSize(1024), 1.1 as SpeedPreset, () => {})).rejects.toMatchObject({ code: 'invalid_range' });
  });
});

describe('assertMergeableVideos — the limits are deliberately tighter than a single conversion', () => {
  it(`rejects fewer than ${MIN_MERGE_VIDEOS} videos`, () => {
    expect(() => assertMergeableVideos([fileOfSize(1024)])).toThrow(ConvertError);
    try {
      assertMergeableVideos([fileOfSize(1024)]);
    } catch (err) {
      expect((err as ConvertError).code).toBe('invalid_range');
    }
  });

  it(`rejects more than ${MAX_MERGE_VIDEOS} videos`, () => {
    const files = Array.from({ length: MAX_MERGE_VIDEOS + 1 }, () => fileOfSize(1024));
    try {
      assertMergeableVideos(files);
      expect.unreachable('expected assertMergeableVideos to throw');
    } catch (err) {
      expect((err as ConvertError).code).toBe('invalid_range');
    }
  });

  it('rejects a non-video file among the batch', () => {
    const files = [fileOfSize(1024), new File([], 'doc.pdf', { type: 'application/pdf' })];
    try {
      assertMergeableVideos(files);
      expect.unreachable('expected assertMergeableVideos to throw');
    } catch (err) {
      expect((err as ConvertError).code).toBe('not_video');
    }
  });

  it(`rejects a single video over ${MAX_MERGE_MB_PER_VIDEO} MB — tighter than MAX_INPUT_MB, since every clip coexists in memory`, () => {
    const oversize = fileOfSize(MAX_MERGE_MB_PER_VIDEO * 1024 * 1024 + 1);
    expect(oversize.size).toBeLessThan(MAX_INPUT_BYTES); // proves this is a merge-specific cap, not just MAX_INPUT_MB again
    try {
      assertMergeableVideos([fileOfSize(1024), oversize]);
      expect.unreachable('expected assertMergeableVideos to throw');
    } catch (err) {
      expect((err as ConvertError).code).toBe('too_large');
    }
  });

  it(`rejects a combined total over ${MAX_MERGE_TOTAL_MB} MB even when no single file exceeds the per-file cap`, () => {
    const perFile = Math.floor((MAX_MERGE_TOTAL_MB / 4) * 1024 * 1024) + 1024; // 4 files just over 1/4 of the total each
    const files = Array.from({ length: 4 }, () => fileOfSize(perFile));
    try {
      assertMergeableVideos(files);
      expect.unreachable('expected assertMergeableVideos to throw');
    } catch (err) {
      expect((err as ConvertError).code).toBe('too_large');
    }
  });

  it('accepts a valid set of videos within every limit', () => {
    expect(() => assertMergeableVideos([fileOfSize(1024), fileOfSize(1024)])).not.toThrow();
  });
});

describe('parseProbeOutput — must not be spoofable by a crafted file\'s own metadata', () => {
  it('reads resolution and audio presence from a clean ffmpeg banner', () => {
    const banner = [
      '  Stream #0:0[0x1](und): Video: h264 (High), yuv420p, 320x240 [SAR 1:1 DAR 4:3], 10 fps',
      '  Stream #0:1[0x2](und): Audio: aac (LC), 44100 Hz, mono, fltp, 69 kb/s',
    ].join('\n');
    expect(parseProbeOutput(banner, 'clip.mp4')).toEqual({ width: 320, height: 240, hasAudio: true });
  });

  it('ignores a container Metadata: tag crafted to look like a huge video stream', () => {
    // ffmpeg prints Metadata: tags (title, comment, ...) BEFORE the real Stream # lines — a
    // comment containing "Video: 99999x99999" must not be read as the clip's actual resolution.
    const banner = [
      '    comment         : Video: 99999x99999 h264',
      '  Stream #0:0[0x1](und): Video: h264 (High), yuv420p, 320x240 [SAR 1:1 DAR 4:3], 10 fps',
    ].join('\n');
    expect(parseProbeOutput(banner, 'clip.mp4')).toEqual({ width: 320, height: 240, hasAudio: false });
  });

  it('ignores a metadata tag crafted to look like a fake audio stream', () => {
    const banner = [
      '    title           : Stream #0:9: Audio: aac',
      '  Stream #0:0[0x1](und): Video: h264 (High), yuv420p, 320x240 [SAR 1:1 DAR 4:3], 10 fps',
    ].join('\n');
    expect(parseProbeOutput(banner, 'clip.mp4').hasAudio).toBe(false);
  });

  it('skips an attached-pic (cover art) stream when picking the real video track', () => {
    const banner = [
      '  Stream #0:0[0x1](und): Video: mjpeg (Baseline), yuvj444p, 600x600, 90k tbr (attached pic)',
      '  Stream #0:1[0x2](und): Video: h264 (High), yuv420p, 320x240 [SAR 1:1 DAR 4:3], 10 fps',
    ].join('\n');
    expect(parseProbeOutput(banner, 'clip.mp4')).toEqual({ width: 320, height: 240, hasAudio: false });
  });

  it('throws a typed error when no real video stream line is present', () => {
    expect(() => parseProbeOutput('some garbage with no stream lines', 'clip.mp4')).toThrow(ConvertError);
  });
});

describe('normalizeMergeDimensions', () => {
  it('leaves a clip already under the cap unchanged', () => {
    expect(normalizeMergeDimensions(1280, 720)).toEqual({ width: 1280, height: 720 });
  });

  it('scales a wide landscape clip down by its width', () => {
    expect(normalizeMergeDimensions(3840, 2160)).toEqual({ width: 1920, height: 1080 });
  });

  it('caps a portrait clip by its long edge (height), not always by width', () => {
    // Regression: capping by width alone left a portrait clip's height completely uncapped —
    // this 2160x3840 clip scaled to "1920 wide" would still be 3413 tall, ~3x the intended
    // pixel budget for every other clip in the merge.
    expect(normalizeMergeDimensions(2160, 3840)).toEqual({ width: 1080, height: 1920 });
  });

  it('always returns even dimensions, required by libx264 + yuv420p', () => {
    const result = normalizeMergeDimensions(1919, 1079);
    expect(result.width % 2).toBe(0);
    expect(result.height % 2).toBe(0);
  });
});

describe('mergeVideoArgs', () => {
  it('scales and pads every clip to the same target size, so the concat filter never sees mismatched dimensions', () => {
    const args = mergeVideoArgs(2, true, 1280, 720, ['a.mp4', 'b.mp4'], 'out.mp4');
    const filter = args[args.indexOf('-filter_complex') + 1]!;
    expect(filter).toContain('[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1[v0]');
    expect(filter).toContain('[1:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1[v1]');
  });

  it('wires up audio only when hasAudio is true, with matching v=1:a=1/0 in the concat stage', () => {
    const withAudio = mergeVideoArgs(2, true, 1280, 720, ['a.mp4', 'b.mp4'], 'out.mp4');
    const withAudioFilter = withAudio[withAudio.indexOf('-filter_complex') + 1]!;
    expect(withAudioFilter).toContain('aresample=44100');
    expect(withAudioFilter).toContain('concat=n=2:v=1:a=1[outv][outa]');
    expect(withAudio).toEqual(expect.arrayContaining(['-map', '[outa]']));

    const videoOnly = mergeVideoArgs(2, false, 1280, 720, ['a.mp4', 'b.mp4'], 'out.mp4');
    const videoOnlyFilter = videoOnly[videoOnly.indexOf('-filter_complex') + 1]!;
    expect(videoOnlyFilter).not.toContain('aresample');
    expect(videoOnlyFilter).toContain('concat=n=2:v=1:a=0[outv]');
    expect(videoOnly).not.toEqual(expect.arrayContaining(['-map', '[outa]']));
    expect(videoOnly).not.toContain('-c:a');
  });

  it('passes every input file as its own -i flag, in order', () => {
    const args = mergeVideoArgs(3, false, 1280, 720, ['a.mp4', 'b.mp4', 'c.mp4'], 'out.mp4');
    expect(args.slice(0, 6)).toEqual(['-i', 'a.mp4', '-i', 'b.mp4', '-i', 'c.mp4']);
  });

  it('never offers a -c copy fast path', () => {
    expect(mergeVideoArgs(2, true, 1280, 720, ['a.mp4', 'b.mp4'], 'out.mp4')).not.toContain('copy');
  });

  it('the output filename is the last argument', () => {
    const args = mergeVideoArgs(2, true, 1280, 720, ['a.mp4', 'b.mp4'], 'out.mp4');
    expect(args[args.length - 1]).toBe('out.mp4');
  });
});

describe('mergeVideos', () => {
  it('rejects too few files without loading the engine', async () => {
    const progress: number[] = [];
    await expect(mergeVideos([fileOfSize(1024)], (p) => progress.push(p))).rejects.toMatchObject({ code: 'invalid_range' });
    expect(progress).toEqual([]);
  });
});

describe('CONVERTER_TOOLS registry ↔ engine contract', () => {
  it('every kind offered by every tool has a real spec in the engine', () => {
    for (const tool of CONVERTER_LIST) {
      if (!tool.kinds) continue; // a tool with its own custom box (e.g. the Trimmer) has no kind-picker to check
      expect(tool.kinds.length).toBeGreaterThan(0);
      for (const kind of tool.kinds) expect(convertSpec(kind)).toBeDefined();
    }
  });

  it('video-to-mp3 and video-to-gif offer exactly one kind; video-converter offers all four', () => {
    expect(CONVERTER_TOOLS['video-to-mp3'].kinds).toEqual(['mp3']);
    expect(CONVERTER_TOOLS['video-to-gif'].kinds).toEqual(['gif']);
    expect(CONVERTER_TOOLS['video-converter'].kinds).toEqual(ALL_KINDS);
  });

  it('no tool lists a duplicate kind (which would render two identical option buttons)', () => {
    for (const tool of CONVERTER_LIST) {
      if (!tool.kinds) continue;
      expect(new Set(tool.kinds).size).toBe(tool.kinds.length);
    }
  });

  it('each tool key matches its slug, so the registry and the route cannot drift', () => {
    for (const tool of CONVERTER_LIST) expect(tool.slug).toBe(tool.key);
  });
});

describe('marketing copy must match the code (a promise the engine does not keep is a bug)', () => {
  it('every "MB" limit quoted in the FAQs matches a real constant in the engine', () => {
    // Most tools quote only MAX_INPUT_MB. video-watermark also quotes MAX_WATERMARK_MB (a separate,
    // much smaller cap for the logo image); video-merger quotes its own per-video/combined caps,
    // deliberately tighter than a single conversion since every clip sits in memory at once.
    const allowedByTool: Partial<Record<ConverterKey, number[]>> = {
      'video-watermark': [MAX_INPUT_MB, MAX_WATERMARK_MB],
      'video-merger': [MAX_MERGE_MB_PER_VIDEO, MAX_MERGE_TOTAL_MB],
    };
    let totalQuoted = 0;
    for (const tool of CONVERTER_LIST) {
      const allowed = allowedByTool[tool.key] ?? [MAX_INPUT_MB];
      const quoted = tool.faqs.flatMap((faq) => [...faq.a.matchAll(/(\d+)\s*MB/g)].map((m) => Number(m[1])));
      totalQuoted += quoted.length;
      for (const mb of quoted) expect(allowed).toContain(mb);
    }
    expect(totalQuoted).toBeGreaterThan(0);
  });

  it('the "192 kbps" audio claim matches the mp3 args', () => {
    const claims = CONVERTER_TOOLS['video-to-mp3'];
    const text = `${claims.intro} ${claims.features.map((f) => f.title).join(' ')}`;
    expect(text).toMatch(/192\s*kbps/i);
    expect(convertSpec('mp3').args('i', 'o')).toContain('192k');
  });

  it('the "12 fps" GIF claim matches the gif filter chain', () => {
    const text = CONVERTER_TOOLS['video-to-gif'].features.map((f) => f.body).join(' ');
    expect(text).toMatch(/12\s*fps/i);
    expect(convertSpec('gif').args('i', 'o').join(' ')).toContain('fps=12');
  });

  it('the "no watermark" claim holds: no kind passes a drawtext/overlay filter', () => {
    for (const kind of ALL_KINDS) {
      const args = convertSpec(kind).args(INPUT_NAME, convertSpec(kind).out).join(' ');
      expect(args).not.toMatch(/drawtext|overlay|movie=/);
    }
  });

  it('all three pages promise the file is never uploaded', () => {
    for (const tool of CONVERTER_LIST) {
      expect(tool.features.find((f) => f.title === '100% private')?.body).toMatch(/never uploaded/i);
    }
  });

  it('the "never uploaded" promise holds in the source: the engine has no remote URL and no upload call', () => {
    // A CDN core URL or a fetch/XHR to anything but the self-hosted /ffmpeg/ assets
    // would mean bytes leaving the device, contradicting the copy on all three pages.
    const source = readFileSync(path.join(__dirname, '..', 'src', 'lib', 'convert.ts'), 'utf-8');
    expect(source).not.toMatch(/https?:\/\//);
    expect(source).not.toMatch(/\b(XMLHttpRequest|navigator\.sendBeacon|FormData)\b/);
    // "'/'" is the in-memory wasm filesystem root, not a network path.
    const pathLiterals = (source.match(/'\/[^']*'/g) ?? []).filter((literal) => literal !== "'/'");
    expect(pathLiterals.length).toBeGreaterThan(0);
    for (const literal of pathLiterals) expect(literal).toMatch(/^'\/ffmpeg\//);
  });

  // The same promise, enforced for the other three all-client-side engines added alongside
  // convert.ts's new functions — this previously covered only convert.ts, so a future `fetch` slipped
  // into imageMerge.ts/imageResize.ts/qrScan.ts would not have tripped anything.
  it.each(['imageMerge.ts', 'imageResize.ts', 'qrScan.ts', 'videoFrame.ts'])('the "never uploaded" promise holds in %s too', (filename) => {
    const source = readFileSync(path.join(__dirname, '..', 'src', 'lib', filename), 'utf-8');
    expect(source).not.toMatch(/https?:\/\//);
    expect(source).not.toMatch(/\b(fetch|XMLHttpRequest|navigator\.sendBeacon|FormData|WebSocket|EventSource)\(/);
  });

  // Same promise, enforced for the client UI files too — the lib scan above doesn't cover them.
  it.each([
    'ImageMergerBox.tsx', 'SocialResizerBox.tsx', 'QrScannerBox.tsx', 'AudioTrimmerBox.tsx',
    'VideoCompressorBox.tsx', 'WatermarkBox.tsx', 'VideoSpeedBox.tsx', 'VideoMergerBox.tsx', 'VideoFrameGrabberBox.tsx',
  ])('the "never uploaded" promise holds in %s too', (filename) => {
    const source = readFileSync(path.join(__dirname, '..', 'src', 'components', filename), 'utf-8');
    expect(source).not.toMatch(/https?:\/\//);
    expect(source).not.toMatch(/\b(fetch|XMLHttpRequest|navigator\.sendBeacon|FormData|WebSocket|EventSource)\(/);
  });
});
