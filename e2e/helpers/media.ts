import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { expect, type Page, type Locator } from '@playwright/test';

export const FIXTURE_DIR = path.join(__dirname, '..', '..', 'test', 'fixtures', 'video');

export const FIXTURES = {
  clip1080p: path.join(FIXTURE_DIR, 'clip-1080p-3s.mp4'),
  silent: path.join(FIXTURE_DIR, 'silent-360p-3s.mp4'),
  webm: path.join(FIXTURE_DIR, 'clip-vp9-opus-3s.webm'),
  notAVideo: path.join(FIXTURE_DIR, 'not-a-video.mp4'),
  clipRgb6s: path.join(FIXTURE_DIR, 'clip-rgb-6s.mp4'), // 0-2s red, 2-4s green, 4-6s blue — for trim-offset verification
  clipMinuteEdge: path.join(FIXTURE_DIR, 'clip-minute-edge.mp4'), // 59.9667s — rounds to a whole minute at the tenth the UI shows
} as const;

const FFPROBE = process.env.FFPROBE_PATH ?? '/opt/homebrew/bin/ffprobe';
const FFMPEG_PATH = process.env.FFMPEG_PATH ?? '/opt/homebrew/bin/ffmpeg';

export function ffprobeAvailable(): boolean {
  return existsSync(FFPROBE);
}

export interface ProbeStream {
  codec_name?: string;
  codec_type?: string;
  width?: number;
  height?: number;
  nb_frames?: string;
}

export interface Probe {
  streams: ProbeStream[];
  format: { duration?: string; format_name?: string; bit_rate?: string };
}

/**
 * Independent verification: the browser's output is checked with the HOST ffprobe,
 * not with the same wasm build that produced it.
 */
export function probe(file: string): Probe {
  const json = execFileSync(FFPROBE, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], {
    encoding: 'utf-8',
    maxBuffer: 16 * 1024 * 1024,
  });
  return JSON.parse(json) as Probe;
}

export function videoStream(p: Probe): ProbeStream {
  const stream = p.streams.find((s) => s.codec_type === 'video');
  if (!stream) throw new Error('no video stream in output');
  return stream;
}

export function audioStream(p: Probe): ProbeStream | undefined {
  return p.streams.find((s) => s.codec_type === 'audio');
}

export function durationSeconds(p: Probe): number {
  return Number(p.format.duration ?? NaN);
}

export function magicBytes(file: string, length: number): string {
  return readFileSync(file).subarray(0, length).toString('latin1');
}

/** Reads a frame's RGB via the HOST ffmpeg — verifies a trim's OFFSET, not just its duration:
 * two trims of different offsets can share a duration but never a frame color. */
export function frameColorAt(file: string, atSeconds: number): { r: number; g: number; b: number } {
  const raw = execFileSync(FFMPEG_PATH, [
    '-v', 'error', '-ss', String(atSeconds), '-i', file, '-frames:v', '1',
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1x1', '-',
  ]);
  return { r: raw[0]!, g: raw[1]!, b: raw[2]! };
}

export function fileSize(file: string): number {
  return statSync(file).size;
}

/** Average RGB of a cropped region at one frame — precise enough to confirm a watermark landed
 * in a specific corner, unlike frameColorAt's whole-frame downscale. */
export function frameRegionAverageColor(
  file: string,
  atSeconds: number,
  region: { x: number; y: number; width: number; height: number },
): { r: number; g: number; b: number } {
  const raw = execFileSync(FFMPEG_PATH, [
    '-v', 'error', '-ss', String(atSeconds), '-i', file, '-frames:v', '1',
    '-vf', `crop=${region.width}:${region.height}:${region.x}:${region.y},scale=1:1`,
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1x1', '-',
  ]);
  return { r: raw[0]!, g: raw[1]!, b: raw[2]! };
}

/** Builds a short solid-color test video via the host ffmpeg's lavfi source — gives exact control
 * over resolution/color/audio-presence for tests that need to verify content, not just success. */
export function makeSolidColorVideo(
  outPath: string,
  color: string,
  opts: { width?: number; height?: number; seconds?: number; withAudio?: boolean } = {},
): string {
  const { width = 320, height = 240, seconds = 1, withAudio = false } = opts;
  const args = ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${color}:s=${width}x${height}:d=${seconds}`];
  if (withAudio) args.push('-f', 'lavfi', '-i', `sine=frequency=440:duration=${seconds}`);
  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p');
  if (withAudio) args.push('-c:a', 'aac', '-shortest');
  args.push(outPath);
  execFileSync(FFMPEG_PATH, args);
  return outPath;
}

/** Builds a solid-color PNG via the host ffmpeg's lavfi source — no binary fixture to check in. */
export function makeSolidColorPng(outPath: string, color: string, width: number, height: number): string {
  execFileSync(FFMPEG_PATH, ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${color}:s=${width}x${height}`, '-frames:v', '1', outPath]);
  return outPath;
}

/** Extracts the audio track of a fixture video to a standalone MP3 via the host ffmpeg — used to
 * get an audio fixture for the audio trimmer without checking in a new binary file. */
export function extractAudioFixture(sourceVideo: string, outPath: string): string {
  execFileSync(FFMPEG_PATH, ['-v', 'error', '-y', '-i', sourceVideo, '-vn', '-b:a', '192k', outPath]);
  return outPath;
}

/** Selects the output kind on the multi-kind /video-converter page. */
export async function chooseKind(page: Page, label: string): Promise<void> {
  await page.getByRole('button', { name: label, exact: true }).click();
}

export function progressBar(page: Page): Locator {
  return page.getByRole('progressbar');
}

export function errorMessage(page: Page): Locator {
  return page.locator('p.text-danger');
}

export function downloadLink(page: Page): Locator {
  return page.getByRole('link', { name: /^Download / });
}

/**
 * Runs a conversion and saves the real downloaded bytes, exercising the same
 * anchor-with-download-attribute path a user clicks.
 */
export async function convertAndDownload(page: Page, saveAs: string): Promise<string> {
  await page.getByRole('button', { name: /^Convert to / }).click();
  const link = downloadLink(page);
  await expect(link).toBeVisible({ timeout: 150_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
  await download.saveAs(saveAs);
  return saveAs;
}

/**
 * Retries until the UI reflects the selection: a native change event fired before
 * React has hydrated is silently dropped, which leaves Convert disabled forever.
 */
export async function pickFile(page: Page, fixture: string): Promise<void> {
  // .first() — video-watermark has a second file input for its logo overlay;
  // the primary "file to convert" input is always the first one in DOM order.
  const input = page.locator('input[type="file"]').first();
  const reflected = page.getByText(path.basename(fixture), { exact: false }).or(errorMessage(page));
  await expect(async () => {
    await input.setInputFiles(fixture);
    await expect(reflected.first()).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000 });
}
