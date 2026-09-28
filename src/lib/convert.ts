/** Client-side video conversion via ffmpeg.wasm — the file never leaves the browser (private,
 * free); dynamic-imported so the ~32 MB wasm loads only on converter pages, never the main bundle. */
import type { FFmpeg } from '@ffmpeg/ffmpeg';
import { isSupportedInputImage } from './imageCompress';

export type ConvertKind = 'mp3' | 'gif' | '720' | '480';

export type ConvertErrorCode = 'too_large' | 'not_video' | 'failed' | 'invalid_range';

export class ConvertError extends Error {
  constructor(
    readonly code: ConvertErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ConvertError';
  }
}

export const MAX_INPUT_MB = 200;
export const MAX_INPUT_BYTES = MAX_INPUT_MB * 1024 * 1024;

const VIDEO_EXTENSIONS = /\.(mp4|mov|webm|mkv|avi|m4v)$/i;
const AUDIO_EXTENSIONS = /\.(mp3|wav|m4a|ogg|aac|flac|opus)$/i;

/** A browser may report an empty or generic MIME type, so the extension is a valid fallback. */
export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || VIDEO_EXTENSIONS.test(file.name);
}

export function isAudioFile(file: File): boolean {
  return file.type.startsWith('audio/') || AUDIO_EXTENSIONS.test(file.name);
}

/** Throws a typed ConvertError if the file can't be accepted. Shared by the UI and the engine. */
export function assertConvertible(file: File): void {
  if (!isVideoFile(file)) throw new ConvertError('not_video', 'Not a video file');
  if (file.size > MAX_INPUT_BYTES) throw new ConvertError('too_large', `File exceeds ${MAX_INPUT_MB} MB`);
}

export function assertConvertibleAudio(file: File): void {
  if (!isAudioFile(file)) throw new ConvertError('not_video', 'Not an audio file');
  if (file.size > MAX_INPUT_BYTES) throw new ConvertError('too_large', `File exceeds ${MAX_INPUT_MB} MB`);
}

let ff: FFmpeg | null = null;

async function getEngine(): Promise<FFmpeg> {
  if (ff) return ff;
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const { toBlobURL } = await import('@ffmpeg/util');
  const instance = new FFmpeg();
  await instance.load({
    coreURL: await toBlobURL('/ffmpeg/ffmpeg-core.js', 'text/javascript'),
    wasmURL: await toBlobURL('/ffmpeg/ffmpeg-core.wasm', 'application/wasm'),
  });
  ff = instance;
  return ff;
}

/** True once the ~32 MB wasm core is loaded for this session. Lets a UI tell "downloading the
 * engine" apart from "encoding" instead of promising a one-time download on every single run. */
export function isEngineLoaded(): boolean {
  return ff !== null;
}

/** `exec()` throwing (not just a non-zero exit) means the wasm module itself aborted and is dead —
 * without this reset, every tool would keep failing until reload. */
async function execOrReset(engine: FFmpeg, args: string[]): Promise<number> {
  try {
    return await engine.exec(args);
  } catch (err) {
    ff = null;
    throw new ConvertError('failed', err instanceof Error ? err.message : 'ffmpeg aborted unexpectedly');
  }
}

export interface ConvertResult {
  blob: Blob;
  filename: string;
}

export interface ConvertSpec {
  /** Output name inside the wasm filesystem; also the filename the user downloads. */
  out: string;
  type: string;
  args: (input: string, out: string) => string[];
}

const SPEC: Record<ConvertKind, ConvertSpec> = {
  mp3: { out: 'audio.mp3', type: 'audio/mpeg', args: (i, o) => ['-i', i, '-vn', '-b:a', '192k', o] },
  gif: {
    out: 'animation.gif',
    type: 'image/gif',
    args: (i, o) => ['-i', i, '-vf', 'fps=12,scale=480:-1:flags=lanczos', '-loop', '0', o],
  },
  // Audio is re-encoded to AAC, not copied: WebM/MKV's Opus/Vorbis plays in MP4 containers but
  // not on Safari/iOS, and the video re-encode already in progress makes this nearly free.
  '720': { out: 'video-720p.mp4', type: 'video/mp4', args: (i, o) => ['-i', i, '-vf', 'scale=-2:720', '-c:a', 'aac', '-b:a', '128k', o] },
  '480': { out: 'video-480p.mp4', type: 'video/mp4', args: (i, o) => ['-i', i, '-vf', 'scale=-2:480', '-c:a', 'aac', '-b:a', '128k', o] },
};

/** The ffmpeg recipe for a kind. Exported so the arg array is verifiable without running wasm. */
export function convertSpec(kind: ConvertKind): ConvertSpec {
  return SPEC[kind];
}

/** Fixed name inside the wasm FS — the user's filename is never passed to ffmpeg. */
export const INPUT_NAME = 'input';

/** Clamps a raw ffmpeg progress fraction to a 0-100 int — NaN-safe, since a probe-only exec (no
 * known output duration) can emit a non-finite progress value that would otherwise reach the UI. */
export function clampProgress(progress: number): number {
  return Number.isFinite(progress) ? Math.max(0, Math.min(100, Math.round(progress * 100))) : 0;
}

async function removeIfPresent(engine: FFmpeg, name: string): Promise<void> {
  const entries = await engine.listDir('/');
  if (entries.some((entry) => entry.name === name)) await engine.deleteFile(name);
}

/** Best-effort, and run from `finally` — a cleanup failure must never replace a real error already
 * propagating from the try block above it, and the wasm heap needs freeing whether the run
 * succeeded or failed (a failed run used to leave its input resident for the rest of the session). */
async function cleanupFiles(engine: FFmpeg, ...names: string[]): Promise<void> {
  for (const name of names) {
    try {
      await removeIfPresent(engine, name);
    } catch {
      /* best-effort */
    }
  }
}

/** Convert a user's file. onProgress reports 0–100. Throws ConvertError on any failure. */
export async function convert(
  file: File,
  kind: ConvertKind,
  onProgress: (pct: number) => void,
): Promise<ConvertResult> {
  assertConvertible(file);
  const engine = await getEngine();
  const spec = SPEC[kind];

  const onProg = ({ progress }: { progress: number }) => onProgress(clampProgress(progress));
  engine.on('progress', onProg);
  try {
    const { fetchFile } = await import('@ffmpeg/util');
    await engine.writeFile(INPUT_NAME, await fetchFile(file));
    // The engine is a reused singleton: a stale output from an earlier run must be gone
    // before exec, or a failed run would silently hand back the previous file.
    await removeIfPresent(engine, spec.out);

    const exitCode = await execOrReset(engine, spec.args(INPUT_NAME, spec.out));
    if (exitCode !== 0) throw new ConvertError('failed', `ffmpeg exited with code ${exitCode}`);

    const data = await engine.readFile(spec.out);
    if (typeof data === 'string' || data.length === 0) throw new ConvertError('failed', 'ffmpeg produced no output');
    return { blob: new Blob([data], { type: spec.type }), filename: spec.out };
  } finally {
    engine.off('progress', onProg);
    await cleanupFiles(engine, INPUT_NAME, spec.out);
  }
}

const TRIM_OUTPUT = 'trimmed.mp4';
const MIN_TRIM_SECONDS = 0.2;

/** toFixed(3), not String() — String(1e-7) emits scientific notation ffmpeg's parser rejects, and a value that small is reachable from free decimal input. */
function seconds(value: number): string {
  return value.toFixed(3);
}

/** Always re-encodes (no `-c copy`) — copying WebM/Opus into MP4 breaks Safari/iOS playback.
 * Uses -ss before -i with -t for duration, not -to, whose meaning shifts with -ss's placement. */
export function trimArgs(startSeconds: number, durationSeconds: number, input: string, out: string): string[] {
  return [
    '-ss', seconds(startSeconds), '-i', input, '-t', seconds(durationSeconds),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', out,
  ];
}

/** Trims a video to [startSeconds, endSeconds) and re-encodes it. */
export async function trim(
  file: File,
  startSeconds: number,
  endSeconds: number,
  onProgress: (pct: number) => void,
): Promise<ConvertResult> {
  assertConvertible(file);
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || startSeconds < 0 || endSeconds - startSeconds < MIN_TRIM_SECONDS) {
    throw new ConvertError('invalid_range', 'The selected range is invalid.');
  }
  const duration = endSeconds - startSeconds;
  const engine = await getEngine();

  const onProg = ({ progress }: { progress: number }) => onProgress(clampProgress(progress));
  engine.on('progress', onProg);
  try {
    const { fetchFile } = await import('@ffmpeg/util');
    await engine.writeFile(INPUT_NAME, await fetchFile(file));
    // The engine is a reused singleton: a stale output from an earlier run must be gone
    // before exec, or a failed run would silently hand back the previous file.
    await removeIfPresent(engine, TRIM_OUTPUT);

    const args = trimArgs(startSeconds, duration, INPUT_NAME, TRIM_OUTPUT);
    const exitCode = await execOrReset(engine, args);
    if (exitCode !== 0) throw new ConvertError('failed', `ffmpeg exited with code ${exitCode}`);

    const data = await engine.readFile(TRIM_OUTPUT);
    if (typeof data === 'string' || data.length === 0) throw new ConvertError('failed', 'ffmpeg produced no output');
    return { blob: new Blob([data], { type: 'video/mp4' }), filename: TRIM_OUTPUT };
  } finally {
    engine.off('progress', onProg);
    await cleanupFiles(engine, INPUT_NAME, TRIM_OUTPUT);
  }
}

const AUDIO_TRIM_OUTPUT = 'trimmed.mp3';

/** Audio counterpart of trimArgs — no video stream, so no re-encode settings beyond bitrate. */
export function trimAudioArgs(startSeconds: number, durationSeconds: number, input: string, out: string): string[] {
  return ['-ss', seconds(startSeconds), '-i', input, '-t', seconds(durationSeconds), '-vn', '-b:a', '192k', out];
}

/** Trims an audio file to [startSeconds, endSeconds) and re-encodes it to MP3. */
export async function trimAudio(
  file: File,
  startSeconds: number,
  endSeconds: number,
  onProgress: (pct: number) => void,
): Promise<ConvertResult> {
  assertConvertibleAudio(file);
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || startSeconds < 0 || endSeconds - startSeconds < MIN_TRIM_SECONDS) {
    throw new ConvertError('invalid_range', 'The selected range is invalid.');
  }
  const duration = endSeconds - startSeconds;
  const engine = await getEngine();

  const onProg = ({ progress }: { progress: number }) => onProgress(clampProgress(progress));
  engine.on('progress', onProg);
  try {
    const { fetchFile } = await import('@ffmpeg/util');
    await engine.writeFile(INPUT_NAME, await fetchFile(file));
    await removeIfPresent(engine, AUDIO_TRIM_OUTPUT);

    const args = trimAudioArgs(startSeconds, duration, INPUT_NAME, AUDIO_TRIM_OUTPUT);
    const exitCode = await execOrReset(engine, args);
    if (exitCode !== 0) throw new ConvertError('failed', `ffmpeg exited with code ${exitCode}`);

    const data = await engine.readFile(AUDIO_TRIM_OUTPUT);
    if (typeof data === 'string' || data.length === 0) throw new ConvertError('failed', 'ffmpeg produced no output');
    return { blob: new Blob([data], { type: 'audio/mpeg' }), filename: AUDIO_TRIM_OUTPUT };
  } finally {
    engine.off('progress', onProg);
    await cleanupFiles(engine, INPUT_NAME, AUDIO_TRIM_OUTPUT);
  }
}

export type CompressQuality = 'high' | 'medium' | 'low';
const COMPRESS_CRF: Record<CompressQuality, number> = { high: 20, medium: 26, low: 32 };
const COMPRESS_OUTPUT = 'compressed.mp4';
const COMPRESS_MAX_WIDTH = 1920;

/** Guards against an unvalidated cast walking the prototype chain (`"constructor"`) into COMPRESS_CRF. */
function compressCrf(quality: CompressQuality): number {
  return Object.hasOwn(COMPRESS_CRF, quality) ? COMPRESS_CRF[quality] : COMPRESS_CRF.medium;
}

/** Lower CRF = higher quality/larger file. `veryfast` trades a little compression efficiency for
 * an encode time reasonable inside a browser tab. Only ever downscales (min(1920,iw)), never up. */
export function compressArgs(quality: CompressQuality, input: string, out: string): string[] {
  return [
    '-i', input,
    '-vf', `scale='min(${COMPRESS_MAX_WIDTH},iw)':-2`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(compressCrf(quality)),
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', out,
  ];
}

/** Re-encodes a video at a lower bitrate/CRF to shrink its file size, capping resolution at 1080p-ish width. */
export async function compressVideo(
  file: File,
  quality: CompressQuality,
  onProgress: (pct: number) => void,
): Promise<ConvertResult> {
  assertConvertible(file);
  const engine = await getEngine();

  const onProg = ({ progress }: { progress: number }) => onProgress(clampProgress(progress));
  engine.on('progress', onProg);
  try {
    const { fetchFile } = await import('@ffmpeg/util');
    await engine.writeFile(INPUT_NAME, await fetchFile(file));
    await removeIfPresent(engine, COMPRESS_OUTPUT);

    const exitCode = await execOrReset(engine, compressArgs(quality, INPUT_NAME, COMPRESS_OUTPUT));
    if (exitCode !== 0) throw new ConvertError('failed', `ffmpeg exited with code ${exitCode}`);

    const data = await engine.readFile(COMPRESS_OUTPUT);
    if (typeof data === 'string' || data.length === 0) throw new ConvertError('failed', 'ffmpeg produced no output');
    return { blob: new Blob([data], { type: 'video/mp4' }), filename: COMPRESS_OUTPUT };
  } finally {
    engine.off('progress', onProg);
    await cleanupFiles(engine, INPUT_NAME, COMPRESS_OUTPUT);
  }
}

export type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
export type WatermarkSize = 'small' | 'medium' | 'large';
const WATERMARK_WIDTH_PX: Record<WatermarkSize, number> = { small: 100, medium: 180, large: 280 };
const WATERMARK_MARGIN_PX = 24;
const WATERMARK_INPUT = 'watermark.png';
const WATERMARK_OUTPUT = 'watermarked.mp4';

const WATERMARK_POSITION_EXPR: Record<WatermarkPosition, [string, string]> = {
  'top-left': [String(WATERMARK_MARGIN_PX), String(WATERMARK_MARGIN_PX)],
  'top-right': [`main_w-overlay_w-${WATERMARK_MARGIN_PX}`, String(WATERMARK_MARGIN_PX)],
  'bottom-left': [String(WATERMARK_MARGIN_PX), `main_h-overlay_h-${WATERMARK_MARGIN_PX}`],
  'bottom-right': [`main_w-overlay_w-${WATERMARK_MARGIN_PX}`, `main_h-overlay_h-${WATERMARK_MARGIN_PX}`],
  center: ['(main_w-overlay_w)/2', '(main_h-overlay_h)/2'],
};

/** Guards against an unvalidated cast walking the prototype chain into WATERMARK_WIDTH_PX. */
function watermarkWidthPx(size: WatermarkSize): number {
  return Object.hasOwn(WATERMARK_WIDTH_PX, size) ? WATERMARK_WIDTH_PX[size] : WATERMARK_WIDTH_PX.medium;
}

/** `format=rgba,colorchannelmixer=aa=X` bakes the opacity into the logo's alpha channel before the
 * fixed-pixel-width scale (no scale2ref needed — a bigger source video just gets a same-size logo,
 * which is simpler to reason about than a percentage that balloons on 4K input). */
export function watermarkArgs(
  size: WatermarkSize,
  opacityPercent: number,
  position: WatermarkPosition,
  input: string,
  watermark: string,
  out: string,
): string[] {
  const [x, y] = WATERMARK_POSITION_EXPR[position];
  // Number.isFinite guards NaN (e.g. a divide-by-zero upstream) — Math.max/min alone would let
  // it through, since every comparison against NaN is false and toFixed(2) would emit "NaN".
  const clampedPercent = Number.isFinite(opacityPercent) ? Math.max(0, Math.min(100, opacityPercent)) : 100;
  const opacity = clampedPercent / 100;
  const filter = `[1:v]format=rgba,colorchannelmixer=aa=${opacity.toFixed(2)},scale=${watermarkWidthPx(size)}:-1[wm];[0:v][wm]overlay=${x}:${y}:shortest=1[out]`;
  return [
    '-i', input,
    '-loop', '1', '-i', watermark,
    '-filter_complex', filter,
    '-map', '[out]', '-map', '0:a?',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-shortest',
    out,
  ];
}

export interface WatermarkOptions {
  size: WatermarkSize;
  opacityPercent: number;
  position: WatermarkPosition;
}

// A logo is a small graphic by nature — a much lower cap than MAX_INPUT_MB is a real limit here,
// not just a formality, since this file is also decoded/scaled through the same wasm heap as the video.
export const MAX_WATERMARK_MB = 10;

/** Overlays a logo image onto a video at a fixed corner/size. The logo never leaves the browser
 * either — like the video, it's written straight into the wasm filesystem. */
export async function addWatermark(
  file: File,
  watermarkImage: File,
  opts: WatermarkOptions,
  onProgress: (pct: number) => void,
): Promise<ConvertResult> {
  assertConvertible(file);
  if (!isSupportedInputImage(watermarkImage)) throw new ConvertError('not_video', 'Watermark must be a PNG, JPEG, WebP or BMP image');
  if (watermarkImage.size > MAX_WATERMARK_MB * 1024 * 1024) throw new ConvertError('too_large', `Watermark image must be under ${MAX_WATERMARK_MB} MB`);
  const engine = await getEngine();

  const onProg = ({ progress }: { progress: number }) => onProgress(clampProgress(progress));
  engine.on('progress', onProg);
  try {
    const { fetchFile } = await import('@ffmpeg/util');
    await engine.writeFile(INPUT_NAME, await fetchFile(file));
    await engine.writeFile(WATERMARK_INPUT, await fetchFile(watermarkImage));
    await removeIfPresent(engine, WATERMARK_OUTPUT);

    const args = watermarkArgs(opts.size, opts.opacityPercent, opts.position, INPUT_NAME, WATERMARK_INPUT, WATERMARK_OUTPUT);
    const exitCode = await execOrReset(engine, args);
    if (exitCode !== 0) throw new ConvertError('failed', `ffmpeg exited with code ${exitCode}`);

    const data = await engine.readFile(WATERMARK_OUTPUT);
    if (typeof data === 'string' || data.length === 0) throw new ConvertError('failed', 'ffmpeg produced no output');
    return { blob: new Blob([data], { type: 'video/mp4' }), filename: WATERMARK_OUTPUT };
  } finally {
    engine.off('progress', onProg);
    await cleanupFiles(engine, INPUT_NAME, WATERMARK_INPUT, WATERMARK_OUTPUT);
  }
}

// Fixed presets rather than a free-form multiplier — a closed set is simpler to validate and
// covers every speed a real editor asks for (slow-motion through fast-forward).
export const SPEED_PRESETS = [0.25, 0.5, 0.75, 1.25, 1.5, 2, 3, 4] as const;
export type SpeedPreset = (typeof SPEED_PRESETS)[number];
const SPEED_OUTPUT = 'speed-changed.mp4';

/** Chains atempo stages to reach speeds outside its native [0.5, 2.0] range (e.g. 4x -> 2.0,2.0).
 * Guards non-finite/non-positive input — otherwise a bad caller would loop forever. */
export function atempoChain(speed: number): string {
  if (!Number.isFinite(speed) || speed <= 0) throw new ConvertError('invalid_range', 'Unsupported speed.');
  const stages: number[] = [];
  let remaining = speed;
  while (remaining > 2) {
    stages.push(2);
    remaining /= 2;
  }
  while (remaining < 0.5) {
    stages.push(0.5);
    remaining /= 0.5;
  }
  stages.push(remaining);
  return stages.map((s) => `atempo=${s.toFixed(3)}`).join(',');
}

/** `setpts` changes video speed, `atempo` matches the audio without shifting pitch. ffmpeg no-ops
 * `-af` on a silent source rather than erroring, so no separate silent-video path is needed. */
export function speedArgs(speed: SpeedPreset, input: string, out: string): string[] {
  return [
    '-i', input,
    '-vf', `setpts=${(1 / speed).toFixed(6)}*PTS`,
    '-af', atempoChain(speed),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
    out,
  ];
}

/** Speeds up or slows down a video (and its audio, pitch-corrected) by one of SPEED_PRESETS. */
export async function changeSpeed(
  file: File,
  speed: SpeedPreset,
  onProgress: (pct: number) => void,
): Promise<ConvertResult> {
  assertConvertible(file);
  if (!SPEED_PRESETS.includes(speed)) throw new ConvertError('invalid_range', 'Unsupported speed.');
  const engine = await getEngine();

  const onProg = ({ progress }: { progress: number }) => onProgress(clampProgress(progress));
  engine.on('progress', onProg);
  try {
    const { fetchFile } = await import('@ffmpeg/util');
    await engine.writeFile(INPUT_NAME, await fetchFile(file));
    await removeIfPresent(engine, SPEED_OUTPUT);

    const exitCode = await execOrReset(engine, speedArgs(speed, INPUT_NAME, SPEED_OUTPUT));
    if (exitCode !== 0) throw new ConvertError('failed', `ffmpeg exited with code ${exitCode}`);

    const data = await engine.readFile(SPEED_OUTPUT);
    if (typeof data === 'string' || data.length === 0) throw new ConvertError('failed', 'ffmpeg produced no output');
    return { blob: new Blob([data], { type: 'video/mp4' }), filename: SPEED_OUTPUT };
  } finally {
    engine.off('progress', onProg);
    await cleanupFiles(engine, INPUT_NAME, SPEED_OUTPUT);
  }
}

// Every clip sits in the wasm heap at once during a merge, so these are tighter than MAX_INPUT_MB.
export const MIN_MERGE_VIDEOS = 2;
export const MAX_MERGE_VIDEOS = 5;
export const MAX_MERGE_MB_PER_VIDEO = 100;
export const MAX_MERGE_TOTAL_MB = 300;
const MERGE_OUTPUT = 'merged.mp4';
const MERGE_MAX_LONG_EDGE = 1920;

export function assertMergeableVideos(files: File[]): void {
  if (files.length < MIN_MERGE_VIDEOS) throw new ConvertError('invalid_range', `Add at least ${MIN_MERGE_VIDEOS} videos to merge.`);
  if (files.length > MAX_MERGE_VIDEOS) throw new ConvertError('invalid_range', `This tool merges up to ${MAX_MERGE_VIDEOS} videos at once.`);
  let totalBytes = 0;
  for (const f of files) {
    if (!isVideoFile(f)) throw new ConvertError('not_video', 'Every file must be a video.');
    if (f.size > MAX_MERGE_MB_PER_VIDEO * 1024 * 1024) throw new ConvertError('too_large', `Each video must be under ${MAX_MERGE_MB_PER_VIDEO} MB.`);
    totalBytes += f.size;
  }
  if (totalBytes > MAX_MERGE_TOTAL_MB * 1024 * 1024) {
    throw new ConvertError('too_large', `The combined size of all videos must be under ${MAX_MERGE_TOTAL_MB} MB.`);
  }
}

interface ClipProbe {
  width: number;
  height: number;
  hasAudio: boolean;
}

/** Only matches lines that start with "Stream #" — an unanchored match lets a crafted file's own
 * metadata (e.g. a comment tag reading "Video: 99999x99999") spoof the parsed values. */
export function parseProbeOutput(text: string, name: string): ClipProbe {
  const streamLines = text.split('\n').filter((l) => /^\s*Stream #\d+:\d+/.test(l));
  const videoLine = streamLines.find((l) => /:\s*Video:/.test(l) && !/\(attached pic\)/.test(l));
  const videoMatch = videoLine?.match(/(\d{2,5})x(\d{2,5})/);
  if (!videoMatch) throw new ConvertError('failed', `Could not read ${name}'s video format.`);
  return { width: Number(videoMatch[1]), height: Number(videoMatch[2]), hasAudio: streamLines.some((l) => /:\s*Audio:/.test(l)) };
}

/** Parses ffmpeg's own stream-info banner from a throwaway `-i`-only run — no ffprobe.wasm bundled.
 * Must run one clip at a time: the log listener is shared on the singleton engine. */
async function probeClip(engine: FFmpeg, name: string): Promise<ClipProbe> {
  const lines: string[] = [];
  // Collecting only Stream lines also bounds this buffer against a file with pathologically many
  // chapters/metadata entries.
  const onLog = ({ message }: { message: string }) => {
    if (/^\s*Stream #/.test(message)) lines.push(message);
  };
  engine.on('log', onLog);
  try {
    await execOrReset(engine, ['-i', name]);
  } finally {
    engine.off('log', onLog);
  }
  return parseProbeOutput(lines.join('\n'), name);
}

/** Scales down by the LONG edge if needed, rounded to even dimensions (required by libx264) — capping
 * width alone would let a portrait clip's height through uncapped, ~3x the intended pixel budget. */
export function normalizeMergeDimensions(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, MERGE_MAX_LONG_EDGE / Math.max(width, height));
  const w = Math.max(2, Math.round((width * scale) / 2) * 2);
  const h = Math.max(2, Math.round((height * scale) / 2) * 2);
  return { width: w, height: h };
}

/** Scales+pads every clip to one common size so concat can splice mismatched resolutions, and only
 * wires up audio when EVERY clip has it — a mixed set merges as video-only rather than guessing. */
export function mergeVideoArgs(clipCount: number, hasAudio: boolean, targetWidth: number, targetHeight: number, inputNames: string[], out: string): string[] {
  const filters: string[] = [];
  const videoLabels: string[] = [];
  const audioLabels: string[] = [];
  for (let i = 0; i < clipCount; i++) {
    filters.push(
      `[${i}:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]`,
    );
    videoLabels.push(`[v${i}]`);
    if (hasAudio) {
      filters.push(`[${i}:a]aresample=44100,aformat=channel_layouts=stereo[a${i}]`);
      audioLabels.push(`[a${i}]`);
    }
  }
  const concatInputs = hasAudio ? videoLabels.map((v, i) => v + audioLabels[i]).join('') : videoLabels.join('');
  filters.push(`${concatInputs}concat=n=${clipCount}:v=1:a=${hasAudio ? 1 : 0}[outv]${hasAudio ? '[outa]' : ''}`);

  const inputArgs = inputNames.flatMap((name) => ['-i', name]);
  const mapArgs = hasAudio ? ['-map', '[outv]', '-map', '[outa]'] : ['-map', '[outv]'];
  const codecArgs = hasAudio
    ? ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k']
    : ['-c:v', 'libx264', '-pix_fmt', 'yuv420p'];
  return [...inputArgs, '-filter_complex', filters.join(';'), ...mapArgs, ...codecArgs, out];
}

/** Merges 2-5 videos (any mix of resolution/codec) into one, in the order given. */
export async function mergeVideos(files: File[], onProgress: (pct: number) => void): Promise<ConvertResult> {
  assertMergeableVideos(files);
  const engine = await getEngine();
  const inputNames = files.map((_, i) => `merge-input-${i}.mp4`);

  try {
    const { fetchFile } = await import('@ffmpeg/util');
    for (let i = 0; i < files.length; i++) {
      await engine.writeFile(inputNames[i]!, await fetchFile(files[i]!));
    }

    // Sequential, not Promise.all — probeClip's log listener is shared on the one engine instance.
    const probes: ClipProbe[] = [];
    for (const name of inputNames) probes.push(await probeClip(engine, name));
    const hasAudio = probes.every((p) => p.hasAudio);
    // The largest clip, not just the first — otherwise reordering clips would silently change
    // output quality, since target resolution would depend on upload order.
    const largest = probes.reduce((a, b) => (a.width * a.height >= b.width * b.height ? a : b));
    const { width, height } = normalizeMergeDimensions(largest.width, largest.height);

    // Registered only for the actual encode below — the write/probe phase above has no known
    // duration to report progress against.
    const onProg = ({ progress }: { progress: number }) => onProgress(clampProgress(progress));
    engine.on('progress', onProg);
    try {
      await removeIfPresent(engine, MERGE_OUTPUT);
      const exitCode = await execOrReset(engine, mergeVideoArgs(files.length, hasAudio, width, height, inputNames, MERGE_OUTPUT));
      if (exitCode !== 0) throw new ConvertError('failed', `ffmpeg exited with code ${exitCode}`);
    } finally {
      engine.off('progress', onProg);
    }

    const data = await engine.readFile(MERGE_OUTPUT);
    if (typeof data === 'string' || data.length === 0) throw new ConvertError('failed', 'ffmpeg produced no output');
    return { blob: new Blob([data], { type: 'video/mp4' }), filename: MERGE_OUTPUT };
  } finally {
    await cleanupFiles(engine, ...inputNames, MERGE_OUTPUT);
  }
}
