import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  FIXTURES,
  audioStream,
  chooseKind,
  convertAndDownload,
  downloadLink,
  durationSeconds,
  errorMessage,
  extractAudioFixture,
  ffprobeAvailable,
  fileSize,
  frameColorAt,
  frameRegionAverageColor,
  magicBytes,
  makeSolidColorPng,
  makeSolidColorVideo,
  pickFile,
  probe,
  progressBar,
  videoStream,
} from './helpers/media';
import { MIN_MERGE_VIDEOS, MAX_MERGE_VIDEOS } from '@/lib/convert';

// Generated once at import time via the HOST ffmpeg — but only when it's actually present, since
// this file is imported (and these top-level calls would run) even on a host where the whole
// suite is about to be skipped for lacking ffprobe/ffmpeg.
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ssd-e2e-fixtures-'));
const AUDIO_FIXTURE = ffprobeAvailable() ? extractAudioFixture(FIXTURES.clip1080p, path.join(TMP_DIR, 'clip.mp3')) : '';
const RED_LOGO = ffprobeAvailable() ? makeSolidColorPng(path.join(TMP_DIR, 'red-logo.png'), 'red', 200, 100) : '';
const RED_CLIP_WITH_AUDIO = ffprobeAvailable() ? makeSolidColorVideo(path.join(TMP_DIR, 'red.mp4'), 'red', { width: 320, height: 240, seconds: 1, withAudio: true }) : '';
const BLUE_CLIP_WITH_AUDIO = ffprobeAvailable() ? makeSolidColorVideo(path.join(TMP_DIR, 'blue.mp4'), 'blue', { width: 480, height: 360, seconds: 1, withAudio: true }) : '';
const GREEN_CLIP_SILENT = ffprobeAvailable() ? makeSolidColorVideo(path.join(TMP_DIR, 'green.mp4'), 'green', { width: 320, height: 240, seconds: 1, withAudio: false }) : '';

// Every assertion below runs the REAL self-hosted ffmpeg.wasm core in Chromium and
// verifies the produced bytes with the host ffprobe — not with the wasm that made them.
test.skip(!ffprobeAvailable(), 'host ffprobe is required to verify converter output');
test.beforeEach(() => {
  // Real single-thread wasm encodes are CPU-bound; once per run is enough, and the
  // phone-sized flow is covered explicitly by the last describe below.
  test.skip(test.info().project.name === 'mobile', 'covered once per run on the desktop project');
  test.setTimeout(240_000);
});

const SOURCE_DURATION = 3;
const CONVERT_TIMEOUT = 150_000;

test.describe('/video-to-mp3', () => {
  test('converts a real video to a real, playable 192 kbps MP3 of the right duration', async ({ page }, testInfo) => {
    await page.goto('/video-to-mp3');
    await pickFile(page, FIXTURES.clip1080p);

    const out = await convertAndDownload(page, testInfo.outputPath('audio.mp3'));
    const result = probe(out);

    expect(result.streams).toHaveLength(1);
    expect(audioStream(result)?.codec_name).toBe('mp3');
    expect(durationSeconds(result)).toBeGreaterThan(SOURCE_DURATION - 0.3);
    expect(durationSeconds(result)).toBeLessThan(SOURCE_DURATION + 0.3);
    // 192 kbps x 3 s ~= 72 KB; a near-empty file would mean a silently broken encode.
    expect(fileSize(out)).toBeGreaterThan(40_000);
    expect(Number(result.format.bit_rate)).toBeGreaterThan(150_000);
  });

  test('offers the result as an audio player and a correctly named download', async ({ page }) => {
    await page.goto('/video-to-mp3');
    await pickFile(page, FIXTURES.clip1080p);
    await page.getByRole('button', { name: /^Convert to / }).click();

    const link = downloadLink(page);
    await expect(link).toBeVisible({ timeout: CONVERT_TIMEOUT });
    await expect(link).toHaveAttribute('download', 'audio.mp3');
    await expect(page.locator('audio')).toBeVisible();
    // The preview must come from an in-browser blob, never a server URL.
    expect(await link.getAttribute('href')).toMatch(/^blob:/);
  });
});

test.describe('/video-to-gif', () => {
  test('produces a valid animated GIF at the advertised 480 px / 12 fps', async ({ page }, testInfo) => {
    await page.goto('/video-to-gif');
    await pickFile(page, FIXTURES.clip1080p);

    const out = await convertAndDownload(page, testInfo.outputPath('animation.gif'));
    expect(['GIF87a', 'GIF89a']).toContain(magicBytes(out, 6));

    const stream = videoStream(probe(out));
    expect(stream.codec_name).toBe('gif');
    // 1920x1080 scaled to width 480 keeps the 16:9 ratio -> 270 px tall.
    expect(stream.width).toBe(480);
    expect(stream.height).toBe(270);
    // fps=12 over a 3 s clip; wasm may drop the final frame, so allow a small margin.
    expect(Number(stream.nb_frames)).toBeGreaterThanOrEqual(30);
    expect(Number(stream.nb_frames)).toBeLessThanOrEqual(36);
    await expect(page.getByAltText('Converted GIF')).toBeVisible();
  });
});

test.describe('/video-converter', () => {
  test('720p downscales to exactly 1280x720 and keeps the audio track', async ({ page }, testInfo) => {
    await page.goto('/video-converter');
    await chooseKind(page, '720p video');
    await pickFile(page, FIXTURES.clip1080p);

    const out = await convertAndDownload(page, testInfo.outputPath('video-720p.mp4'));
    const result = probe(out);
    const video = videoStream(result);

    expect(video.height).toBe(720);
    expect(video.width).toBe(1280);
    expect(video.codec_name).toBe('h264');
    expect(audioStream(result)?.codec_name).toBe('aac');
    expect(durationSeconds(result)).toBeGreaterThan(SOURCE_DURATION - 0.5);
  });

  test('480p downscales to 854x480 — scale=-2 must round the width to an EVEN number', async ({ page }, testInfo) => {
    // 1920/1080 * 480 = 853.33; an odd width would make libx264 fail outright.
    await page.goto('/video-converter');
    await chooseKind(page, '480p video');
    await pickFile(page, FIXTURES.clip1080p);

    const out = await convertAndDownload(page, testInfo.outputPath('video-480p.mp4'));
    const video = videoStream(probe(out));
    expect(video.height).toBe(480);
    expect(video.width).toBe(854);
    expect(video.width! % 2).toBe(0);
  });

  test('WebM/VP9+Opus input converts to a 720p MP4 whose audio is playable in a browser', async ({ page }, testInfo) => {
    // All three pages advertise WebM input; `-c:a copy` into an MP4 container is the
    // risky part, because MP4 + Opus is not universally playable.
    await page.goto('/video-converter');
    await chooseKind(page, '720p video');
    await pickFile(page, FIXTURES.webm);

    const out = await convertAndDownload(page, testInfo.outputPath('webm-720p.mp4'));
    const result = probe(out);
    expect(videoStream(result).height).toBe(720);
    expect(['aac', 'mp3']).toContain(audioStream(result)?.codec_name);
  });

  test('switching kinds between runs returns the newly chosen format, not the previous one', async ({ page }, testInfo) => {
    await page.goto('/video-converter');
    await pickFile(page, FIXTURES.clip1080p);
    const mp3 = await convertAndDownload(page, testInfo.outputPath('first.mp3'));
    expect(audioStream(probe(mp3))?.codec_name).toBe('mp3');

    await chooseKind(page, 'Animated GIF');
    const gif = await convertAndDownload(page, testInfo.outputPath('second.gif'));
    expect(['GIF87a', 'GIF89a']).toContain(magicBytes(gif, 6));
    await expect(downloadLink(page)).toHaveAttribute('download', 'animation.gif');
  });
});

test.describe('/video-trimmer', () => {
  async function trimAndDownload(page: import('@playwright/test').Page, saveAs: string): Promise<string> {
    await page.getByRole('button', { name: 'Trim video' }).click();
    const link = downloadLink(page);
    await expect(link).toBeVisible({ timeout: CONVERT_TIMEOUT });
    const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
    await download.saveAs(saveAs);
    return saveAs;
  }

  test('trims to the requested OFFSET, not just the requested duration — verified by frame color', async ({ page }, testInfo) => {
    await page.goto('/video-trimmer');
    await pickFile(page, FIXTURES.clipRgb6s); // 0-2s red, 2-4s green, 4-6s blue
    await expect(page.getByLabel('Start time in seconds', { exact: true })).toBeEnabled();

    await page.getByLabel('Start time in seconds', { exact: true }).fill('2');
    await page.getByLabel('End time in seconds', { exact: true }).fill('4');
    const out = await trimAndDownload(page, testInfo.outputPath('trimmed.mp4'));

    const result = probe(out);
    expect(durationSeconds(result)).toBeGreaterThan(2 - 0.3);
    expect(durationSeconds(result)).toBeLessThan(2 + 0.3);

    // A correct 2-4s trim and a buggy (e.g. 1-3s) trim would have the SAME duration here —
    // this is the assertion that actually catches an offset bug.
    const color = frameColorAt(out, 0.1);
    expect(color.g).toBeGreaterThan(200);
    expect(color.r).toBeLessThan(60);
    expect(color.b).toBeLessThan(60);
  });

  test('the "set to current time" button captures live playback position', async ({ page }) => {
    await page.goto('/video-trimmer');
    await pickFile(page, FIXTURES.clipRgb6s);
    const video = page.locator('video').first();
    await expect(video).toBeVisible();
    await expect(page.getByLabel('Start time in seconds', { exact: true })).toBeEnabled();

    await video.evaluate((el: HTMLVideoElement) => { el.currentTime = 3; });
    await expect(async () => {
      await page.getByRole('group', { name: 'Start' }).getByRole('button', { name: 'Set to current time' }).click();
      await expect(page.getByLabel('Start time in seconds', { exact: true })).toHaveValue('3');
    }).toPass({ timeout: 5_000 });
  });

  test('live validation explains an invalid range without ever calling ffmpeg', async ({ page }) => {
    const urls: string[] = [];
    page.on('request', (r) => urls.push(r.url()));
    await page.goto('/video-trimmer');
    await pickFile(page, FIXTURES.clip1080p); // 3s clip
    await expect(page.getByLabel('Start time in seconds', { exact: true })).toBeEnabled();

    await page.getByLabel('Start time in seconds', { exact: true }).fill('2');
    await page.getByLabel('End time in seconds', { exact: true }).fill('1');
    await expect(page.getByText('End must be after start.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Trim video' })).toBeDisabled();
    expect(urls.some((u) => u.includes('/ffmpeg/'))).toBe(false);
  });

  test('a negative start is explained, not silently swallowed', async ({ page }) => {
    // Regression: the parser clamped a negative start to 0, so the tool trimmed from the
    // beginning while the field still read -5 — and "Start can't be negative." was unreachable.
    await page.goto('/video-trimmer');
    await pickFile(page, FIXTURES.clipRgb6s);
    await expect(page.getByLabel('Start time in seconds', { exact: true })).toBeEnabled();

    await page.getByLabel('Start time in seconds', { exact: true }).fill('-5');
    await expect(page.getByText("Start can't be negative.")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Trim video' })).toBeDisabled();

    await page.getByLabel('Start time in seconds', { exact: true }).fill('1');
    await expect(page.getByText("Start can't be negative.")).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Trim video' })).toBeEnabled();
  });

  test('a start past the end of the video blames the start, not the end', async ({ page }) => {
    await page.goto('/video-trimmer');
    await pickFile(page, FIXTURES.clipRgb6s);
    await expect(page.getByLabel('Start time in seconds', { exact: true })).toBeEnabled();

    await page.getByLabel('Start time in seconds', { exact: true }).fill('10');
    await expect(page.getByText("Start is past the video's 0:06.0 length.")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Trim video' })).toBeDisabled();
  });

  test('a clip a tenth under a minute never renders as ":60.0", and its last frame is selectable', async ({ page }) => {
    // Two regressions meet at 59.9667s: a formatter that printed "0:60.0", and a playhead that
    // rounded past the clip's end, writing an end the range check then rejected as invalid.
    await page.goto('/video-trimmer');
    await pickFile(page, FIXTURES.clipMinuteEdge);
    await expect(page.getByLabel('End time in seconds', { exact: true })).toBeEnabled();

    await expect(page.getByLabel('End time in seconds', { exact: true })).toHaveAttribute('placeholder', '1:00.0');
    expect(await page.locator('body').textContent()).not.toMatch(/\d:60\.\d/);

    const video = page.locator('video').first();
    await video.evaluate((el: HTMLVideoElement) => { el.currentTime = el.duration; });
    await page.getByRole('group', { name: 'End' }).getByRole('button', { name: 'Set to current time' }).click();
    await expect(page.getByRole('button', { name: 'Trim video' })).toBeEnabled();
    await expect(page.locator('p.text-danger')).toHaveCount(0);
  });

  test('a file the browser cannot decode says so instead of hanging on a blank player', async ({ page }) => {
    // Regression: a renamed text file passes the extension check, so the drop zone was replaced
    // by a player that never fired loadedmetadata — every control disabled, no message, forever.
    await page.goto('/video-trimmer');
    await page.locator('input[type="file"]').setInputFiles(FIXTURES.notAVideo);

    await expect(errorMessage(page)).toBeVisible();
    const text = (await errorMessage(page).textContent()) ?? '';
    expect(text).toMatch(/could not open this video/i);
    expect(text).not.toMatch(/ffmpeg|wasm|Error:|at .*\.js|undefined/i);
    // And the user is returned somewhere they can act from.
    await expect(page.getByRole('button', { name: 'Choose a video file to trim' })).toBeVisible();
  });

  test('both "Set to current time" buttons are distinguishable to assistive tech', async ({ page }) => {
    // Share a visible label on purpose (WCAG 2.5.3); the legend as an accessible DESCRIPTION
    // disambiguates them in the name-only element lists screen readers offer.
    await page.goto('/video-trimmer');
    await pickFile(page, FIXTURES.clipRgb6s);
    await expect(page.getByLabel('Start time in seconds', { exact: true })).toBeEnabled();

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Accessibility.enable');
    const tree = await cdp.send('Accessibility.getFullAXTree');
    const buttons = tree.nodes.filter((n) => n.role?.value === 'button' && /Set to current time/.test(String(n.name?.value ?? '')));

    expect(buttons).toHaveLength(2);
    expect(buttons.map((b) => String(b.description?.value ?? '')).sort()).toEqual(['End', 'Start']);
    for (const b of buttons) expect(b.name?.value).toBe('Set to current time');
  });

  // regression risk: pulling a second clip out of the same upload must not require re-uploading it.
  test('trimming again after a result reuses the loaded video, without re-uploading', async ({ page }, testInfo) => {
    await page.goto('/video-trimmer');
    await pickFile(page, FIXTURES.clipRgb6s);
    await page.getByLabel('Start time in seconds', { exact: true }).fill('0');
    await page.getByLabel('End time in seconds', { exact: true }).fill('2');
    const first = await trimAndDownload(page, testInfo.outputPath('first.mp4'));
    await expect(page.locator('video')).toHaveCount(2); // source player + result preview, both present

    // "Trim another part" drops only the clip; the upload stays loaded (the deliberate
    // difference from the other converters' "Convert another", which clears the file).
    await page.getByRole('button', { name: 'Trim another part' }).click();
    await expect(downloadLink(page)).toHaveCount(0);
    await expect(page.locator('video')).toHaveCount(1);

    // Still a real, decodable video — not just an element left on screen with a dead src.
    const source = await page.locator('video').first().evaluate(async (el: HTMLVideoElement) => {
      el.currentTime = 4.5;
      await new Promise((resolve) => setTimeout(resolve, 400));
      return { readyState: el.readyState, duration: el.duration, error: el.error?.code ?? null };
    });
    expect(source.error).toBeNull();
    expect(source.readyState).toBeGreaterThanOrEqual(2);
    expect(source.duration).toBeCloseTo(6, 1);

    await page.getByLabel('Start time in seconds', { exact: true }).fill('4');
    await page.getByLabel('End time in seconds', { exact: true }).fill('6');
    const second = await trimAndDownload(page, testInfo.outputPath('second.mp4'));

    expect(durationSeconds(probe(first))).toBeGreaterThan(1.7);
    expect(durationSeconds(probe(second))).toBeGreaterThan(1.7);
    // Durations alone cannot tell "cut 4-6s from the source" apart from "re-cut the first clip":
    // both are 2 s. The colours can — red for 0-2s, blue for 4-6s.
    expect(frameColorAt(first, 0.1).r).toBeGreaterThan(200);
    const secondColor = frameColorAt(second, 0.1);
    expect(secondColor.b).toBeGreaterThan(200);
    expect(secondColor.r).toBeLessThan(60);
  });
});

test.describe('/video-compressor', () => {
  async function compressAndDownload(page: import('@playwright/test').Page, saveAs: string): Promise<string> {
    await page.getByRole('button', { name: 'Compress video' }).click();
    const link = downloadLink(page);
    await expect(link).toBeVisible({ timeout: CONVERT_TIMEOUT });
    const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
    await download.saveAs(saveAs);
    return saveAs;
  }

  test('re-encodes to a real, playable H.264 MP4 of the right duration', async ({ page }, testInfo) => {
    await page.goto('/video-compressor');
    await pickFile(page, FIXTURES.clip1080p);
    await page.getByRole('button', { name: 'Smallest file' }).click();

    const out = await compressAndDownload(page, testInfo.outputPath('compressed.mp4'));
    const result = probe(out);
    const video = videoStream(result);
    expect(video.codec_name).toBe('h264');
    expect(durationSeconds(result)).toBeGreaterThan(SOURCE_DURATION - 0.5);
    expect(durationSeconds(result)).toBeLessThan(SOURCE_DURATION + 0.5);
  });

  test('"Best quality" produces a larger file than "Smallest file" for the same source', async ({ page }, testInfo) => {
    // Switches the preset on the same loaded file rather than re-uploading — the CRF ordering
    // between presets must hold regardless, and this avoids a flaky re-upload race.
    await page.goto('/video-compressor');
    await pickFile(page, FIXTURES.clip1080p);
    await page.getByRole('button', { name: 'Best quality' }).click();
    const best = await compressAndDownload(page, testInfo.outputPath('best.mp4'));

    await page.getByRole('button', { name: 'Smallest file' }).click();
    const smallest = await compressAndDownload(page, testInfo.outputPath('smallest.mp4'));

    expect(fileSize(best)).toBeGreaterThan(fileSize(smallest));
  });

  test('picking a file triggers no network request — the engine only loads once Compress is pressed', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (req) => requests.push(req.url()));
    await page.goto('/video-compressor');
    await pickFile(page, FIXTURES.clip1080p);
    await expect(page.getByRole('button', { name: 'Compress video' })).toBeEnabled();
    expect(requests.some((u) => u.includes('/ffmpeg/'))).toBe(false);
  });
});

test.describe('/audio-trimmer', () => {
  test.skip(!AUDIO_FIXTURE, 'requires the host-ffmpeg-generated audio fixture');

  test('trims an audio file to the requested range and re-encodes to a real, playable MP3', async ({ page }, testInfo) => {
    await page.goto('/audio-trimmer');
    await pickFile(page, AUDIO_FIXTURE);
    await expect(page.getByLabel('Start time in seconds', { exact: true })).toBeEnabled();

    await page.getByLabel('Start time in seconds', { exact: true }).fill('0');
    await page.getByLabel('End time in seconds', { exact: true }).fill('1.5');
    await page.getByRole('button', { name: 'Trim audio' }).click();

    const link = downloadLink(page);
    await expect(link).toBeVisible({ timeout: CONVERT_TIMEOUT });
    const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
    const out = testInfo.outputPath('trimmed.mp3');
    await download.saveAs(out);

    const result = probe(out);
    expect(audioStream(result)?.codec_name).toBe('mp3');
    expect(durationSeconds(result)).toBeGreaterThan(1.5 - 0.3);
    expect(durationSeconds(result)).toBeLessThan(1.5 + 0.3);
    await expect(page.locator('audio').last()).toBeVisible();
  });

  test('rejects a video file — this tool is audio-only', async ({ page }) => {
    await page.goto('/audio-trimmer');
    await pickFile(page, FIXTURES.clip1080p);
    await expect(errorMessage(page)).toContainText(/audio file/i);
  });

  test('live validation explains an invalid range without ever calling ffmpeg', async ({ page }) => {
    const urls: string[] = [];
    page.on('request', (r) => urls.push(r.url()));
    await page.goto('/audio-trimmer');
    await pickFile(page, AUDIO_FIXTURE);
    await expect(page.getByLabel('Start time in seconds', { exact: true })).toBeEnabled();

    await page.getByLabel('Start time in seconds', { exact: true }).fill('2');
    await page.getByLabel('End time in seconds', { exact: true }).fill('1');
    await expect(page.getByText('End must be after start.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Trim audio' })).toBeDisabled();
    expect(urls.some((u) => u.includes('/ffmpeg/'))).toBe(false);
  });
});

test.describe('/video-watermark', () => {
  test.skip(!RED_LOGO, 'requires the host-ffmpeg-generated solid-color logo fixture');

  test('overlays the logo at the requested corner, verified by sampling that exact region', async ({ page }, testInfo) => {
    await page.goto('/video-watermark');
    await page.locator('input[type="file"]').first().setInputFiles(FIXTURES.clip1080p);
    await page.locator('input[type="file"]').nth(1).setInputFiles(RED_LOGO);
    await expect(page.getByText('red-logo.png')).toBeVisible();

    await page.getByLabel('Position').selectOption('bottom-right');
    await page.getByLabel('Size').selectOption('medium'); // 180px wide, 2:1 source -> 90px tall
    await page.getByLabel('Opacity').fill('100');

    await page.getByRole('button', { name: 'Add watermark' }).click();
    const link = downloadLink(page);
    await expect(link).toBeVisible({ timeout: CONVERT_TIMEOUT });
    const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
    const out = testInfo.outputPath('watermarked.mp4');
    await download.saveAs(out);

    const result = probe(out);
    expect(durationSeconds(result)).toBeGreaterThan(SOURCE_DURATION - 0.5);

    // Sample well inside the logo's known bottom-right box (1920x1080 source, 180x90 logo, 24px margin).
    const inside = frameRegionAverageColor(out, 0.1, { x: 1920 - 24 - 90, y: 1080 - 24 - 45, width: 40, height: 20 });
    expect(inside.r).toBeGreaterThan(180);
    expect(inside.g).toBeLessThan(80);
    expect(inside.b).toBeLessThan(80);

    // The opposite corner must be untouched by the overlay.
    const outside = frameRegionAverageColor(out, 0.1, { x: 20, y: 20, width: 40, height: 20 });
    expect(outside.r).toBeLessThan(180);
  });

  test('requires both a video and a logo before the button enables', async ({ page }) => {
    await page.goto('/video-watermark');
    await expect(page.getByRole('button', { name: 'Add watermark' })).toBeDisabled();
    await page.locator('input[type="file"]').first().setInputFiles(FIXTURES.clip1080p);
    await expect(page.getByRole('button', { name: 'Add watermark' })).toBeDisabled();
  });

  test('rejects a non-image file as the watermark', async ({ page }) => {
    await page.goto('/video-watermark');
    await page.locator('input[type="file"]').first().setInputFiles(FIXTURES.clip1080p);
    await page.locator('input[type="file"]').nth(1).setInputFiles(FIXTURES.notAVideo);
    await expect(errorMessage(page)).toContainText(/PNG, JPEG, WebP or BMP/i);
  });
});

test.describe('/video-speed-changer', () => {
  async function speedAndDownload(page: import('@playwright/test').Page, saveAs: string): Promise<string> {
    await page.getByRole('button', { name: /^Change speed to/ }).click();
    const link = downloadLink(page);
    await expect(link).toBeVisible({ timeout: CONVERT_TIMEOUT });
    const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
    await download.saveAs(saveAs);
    return saveAs;
  }

  test('2x speed halves the duration and keeps both streams valid', async ({ page }, testInfo) => {
    await page.goto('/video-speed-changer');
    await pickFile(page, FIXTURES.clip1080p);
    await page.getByRole('button', { name: '2x', exact: true }).click();

    const out = await speedAndDownload(page, testInfo.outputPath('2x.mp4'));
    const result = probe(out);
    expect(videoStream(result).codec_name).toBe('h264');
    expect(audioStream(result)?.codec_name).toBe('aac');
    expect(durationSeconds(result)).toBeGreaterThan(SOURCE_DURATION / 2 - 0.5);
    expect(durationSeconds(result)).toBeLessThan(SOURCE_DURATION / 2 + 0.5);
  });

  test('0.5x speed doubles the duration', async ({ page }, testInfo) => {
    await page.goto('/video-speed-changer');
    await pickFile(page, FIXTURES.clip1080p);
    await page.getByRole('button', { name: '0.5x', exact: true }).click();

    const out = await speedAndDownload(page, testInfo.outputPath('0.5x.mp4'));
    const result = probe(out);
    expect(durationSeconds(result)).toBeGreaterThan(SOURCE_DURATION * 2 - 0.5);
    expect(durationSeconds(result)).toBeLessThan(SOURCE_DURATION * 2 + 0.5);
  });

  test('4x speed (a chained atempo case) still produces a valid, much shorter file', async ({ page }, testInfo) => {
    await page.goto('/video-speed-changer');
    await pickFile(page, FIXTURES.clip1080p);
    await page.getByRole('button', { name: '4x', exact: true }).click();

    const out = await speedAndDownload(page, testInfo.outputPath('4x.mp4'));
    const result = probe(out);
    expect(videoStream(result).codec_name).toBe('h264');
    expect(durationSeconds(result)).toBeGreaterThan(SOURCE_DURATION / 4 - 0.5);
    expect(durationSeconds(result)).toBeLessThan(SOURCE_DURATION / 4 + 0.5);
  });

  test('works on a video with no audio track (ffmpeg no-ops the audio filter rather than failing)', async ({ page }, testInfo) => {
    await page.goto('/video-speed-changer');
    await pickFile(page, FIXTURES.silent);
    await page.getByRole('button', { name: '2x', exact: true }).click();

    const out = await speedAndDownload(page, testInfo.outputPath('silent-2x.mp4'));
    const result = probe(out);
    expect(videoStream(result).codec_name).toBe('h264');
    expect(audioStream(result)).toBeUndefined();
  });

  test('never uploads the file — verified across a real run, not just at selection time', async ({ page }, testInfo) => {
    const uploads: string[] = [];
    page.on('request', (req) => {
      if (req.method() !== 'GET' && !req.url().includes('/api/track')) uploads.push(`${req.method()} ${req.url()}`);
    });
    await page.goto('/video-speed-changer');
    await pickFile(page, FIXTURES.clip1080p);
    await page.getByRole('button', { name: '2x', exact: true }).click();
    await speedAndDownload(page, testInfo.outputPath('privacy-check.mp4'));
    expect(uploads).toEqual([]);
  });
});

test.describe('/video-merger', () => {
  test.skip(!RED_CLIP_WITH_AUDIO, 'requires the host-ffmpeg-generated solid-color video fixtures');

  async function uploadAndMerge(page: import('@playwright/test').Page, files: string[], saveAs: string): Promise<string> {
    await page.locator('input[type="file"]').setInputFiles(files);
    await page.getByRole('button', { name: /^Merge \d+ videos?/ }).click();
    const link = downloadLink(page);
    await expect(link).toBeVisible({ timeout: CONVERT_TIMEOUT });
    const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
    await download.saveAs(saveAs);
    return saveAs;
  }

  test('merges clips of different resolutions, matching the LARGEST clip\'s size, with correctly summed duration', async ({ page }, testInfo) => {
    await page.goto('/video-merger');
    // red is 320x240, blue is 480x360 (larger area) — target size follows the largest clip, not
    // upload order, so reordering these two can't silently change output quality.
    const out = await uploadAndMerge(page, [RED_CLIP_WITH_AUDIO, BLUE_CLIP_WITH_AUDIO], testInfo.outputPath('merged.mp4'));

    const result = probe(out);
    const video = videoStream(result);
    expect(video.codec_name).toBe('h264');
    expect(video.width).toBe(480);
    expect(video.height).toBe(360);
    expect(durationSeconds(result)).toBeGreaterThan(1.7);
    expect(durationSeconds(result)).toBeLessThan(2.3);
  });

  test('plays clips back in the order they were uploaded, verified by frame colour at each half', async ({ page }, testInfo) => {
    await page.goto('/video-merger');
    const out = await uploadAndMerge(page, [RED_CLIP_WITH_AUDIO, BLUE_CLIP_WITH_AUDIO], testInfo.outputPath('order.mp4'));

    const first = frameColorAt(out, 0.2);
    expect(first.r).toBeGreaterThan(180);
    expect(first.b).toBeLessThan(80);
    const second = frameColorAt(out, 1.2);
    expect(second.b).toBeGreaterThan(180);
    expect(second.r).toBeLessThan(80);
  });

  test('reordering before merging changes which clip plays first', async ({ page }, testInfo) => {
    await page.goto('/video-merger');
    await page.locator('input[type="file"]').setInputFiles([RED_CLIP_WITH_AUDIO, BLUE_CLIP_WITH_AUDIO]);
    await page.getByRole('button', { name: 'Move later' }).first().click(); // swap red<->blue
    const out = await uploadAndMerge(page, [], testInfo.outputPath('reordered.mp4'));

    const first = frameColorAt(out, 0.2);
    expect(first.b).toBeGreaterThan(180);
    expect(first.r).toBeLessThan(80);
  });

  test('keeps audio only when every clip has it — a silent clip in the mix makes the whole result video-only', async ({ page }, testInfo) => {
    await page.goto('/video-merger');
    const bothAudio = await uploadAndMerge(page, [RED_CLIP_WITH_AUDIO, BLUE_CLIP_WITH_AUDIO], testInfo.outputPath('both-audio.mp4'));
    expect(audioStream(probe(bothAudio))?.codec_name).toBe('aac');

    await page.goto('/video-merger');
    const mixed = await uploadAndMerge(page, [RED_CLIP_WITH_AUDIO, GREEN_CLIP_SILENT], testInfo.outputPath('mixed.mp4'));
    expect(audioStream(probe(mixed))).toBeUndefined();
    expect(videoStream(probe(mixed)).codec_name).toBe('h264');
  });

  test('the merge button is disabled below the minimum clip count', async ({ page }) => {
    await page.goto('/video-merger');
    await page.locator('input[type="file"]').setInputFiles([RED_CLIP_WITH_AUDIO]);
    await expect(page.getByRole('button', { name: /^Merge/ })).toBeDisabled();
    await expect(page.getByText(`Add at least ${MIN_MERGE_VIDEOS} videos to merge.`)).toBeVisible();
  });

  test('only accepts up to the maximum clip count, and says so', async ({ page }) => {
    await page.goto('/video-merger');
    const files = Array.from({ length: MAX_MERGE_VIDEOS + 2 }, () => RED_CLIP_WITH_AUDIO);
    await page.locator('input[type="file"]').setInputFiles(files);
    await expect(page.locator('li:has(button[aria-label="Remove video"])')).toHaveCount(MAX_MERGE_VIDEOS);
    await expect(page.getByText(/Some files were skipped/)).toContainText(`merges up to ${MAX_MERGE_VIDEOS} videos`);
  });

  test('rejects a non-video file among the selection', async ({ page }) => {
    // FIXTURES.notAVideo deliberately keeps a .mp4 extension (it tests a decode FAILURE elsewhere,
    // not selection-time rejection) — a real non-video file is what exercises isVideoFile() here.
    await page.goto('/video-merger');
    await page.locator('input[type="file"]').setInputFiles([RED_CLIP_WITH_AUDIO, RED_LOGO]);
    await expect(page.locator('li:has(button[aria-label="Remove video"])')).toHaveCount(1);
    await expect(page.getByText(/Some files were skipped/)).toContainText('only video files are supported');
  });

  test('never uploads the videos — verified across a real run, not just at selection time', async ({ page }, testInfo) => {
    const uploads: string[] = [];
    page.on('request', (req) => {
      if (req.method() !== 'GET' && !req.url().includes('/api/track')) uploads.push(`${req.method()} ${req.url()}`);
    });
    await page.goto('/video-merger');
    await uploadAndMerge(page, [RED_CLIP_WITH_AUDIO, BLUE_CLIP_WITH_AUDIO], testInfo.outputPath('privacy-check.mp4'));
    expect(uploads).toEqual([]);
  });
});

test.describe('error paths — must fail clearly, never hang or leak internals', () => {
  test('a text file renamed .mp4 fails with a friendly message and no stack trace', async ({ page }) => {
    await page.goto('/video-to-mp3');
    await pickFile(page, FIXTURES.notAVideo);
    await page.getByRole('button', { name: /^Convert to / }).click();

    await expect(errorMessage(page)).toBeVisible({ timeout: CONVERT_TIMEOUT });
    const text = (await errorMessage(page).textContent()) ?? '';
    expect(text).toMatch(/Conversion failed/i);
    expect(text).not.toMatch(/ffmpeg|wasm|Error:|at .*\.js|stack|undefined/i);
    await expect(downloadLink(page)).toHaveCount(0);
    // The button must return to a usable state so the user can retry.
    await expect(page.getByRole('button', { name: /^Convert to / })).toBeEnabled();
  });

  test('a non-video file is rejected at selection time, before the 32 MB engine is fetched', async ({ page }) => {
    const engineRequests: string[] = [];
    page.on('request', (req) => req.url().includes('/ffmpeg/') && engineRequests.push(req.url()));

    await page.goto('/video-to-gif');
    await pickFile(page, 'test/fixtures/pdf/single-page.pdf');

    await expect(errorMessage(page)).toHaveText(/choose a video file/i);
    expect(engineRequests).toEqual([]);
  });

  test('a video with no audio track fails instead of silently handing back the PREVIOUS conversion', async ({ page }) => {
    // Regression: the wasm filesystem is a reused singleton, so a failed run used to
    // read back the earlier run's output file and present it as this run's result.
    await page.goto('/video-converter');
    await pickFile(page, FIXTURES.clip1080p);
    await page.getByRole('button', { name: /^Convert to / }).click();
    await expect(downloadLink(page)).toBeVisible({ timeout: CONVERT_TIMEOUT });

    await page.getByRole('button', { name: 'Convert another' }).click();
    await pickFile(page, FIXTURES.silent);
    await page.getByRole('button', { name: /^Convert to / }).click();

    await expect(errorMessage(page)).toBeVisible({ timeout: CONVERT_TIMEOUT });
    await expect(downloadLink(page)).toHaveCount(0);
    await expect(page.locator('audio')).toHaveCount(0);
  });
});

test.describe('conversion UX', () => {
  test('shows progress, disables double-submit, and keeps the main thread responsive', async ({ page }) => {
    await page.goto('/video-converter');
    await chooseKind(page, '720p video');
    await pickFile(page, FIXTURES.clip1080p);

    // Records the worst frame gap across the WHOLE encode: ffmpeg.wasm must stay in its
    // worker, or the main thread would stall for seconds and blow the INP budget.
    await page.evaluate(() => {
      const probe = window as unknown as { __worstFrameGap: number };
      probe.__worstFrameGap = 0;
      let previous = performance.now();
      const tick = () => {
        const now = performance.now();
        probe.__worstFrameGap = Math.max(probe.__worstFrameGap, now - previous);
        previous = now;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    await page.getByRole('button', { name: /^Convert to / }).click();

    await expect(progressBar(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Converting…' })).toBeDisabled();
    const value = Number(await progressBar(page).getAttribute('aria-valuenow'));
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(100);

    await expect(downloadLink(page)).toBeVisible({ timeout: CONVERT_TIMEOUT });

    const worstFrameGapMs = await page.evaluate(() => (window as unknown as { __worstFrameGap: number }).__worstFrameGap);
    expect(worstFrameGapMs).toBeLessThan(1000);
  });

  test('"Convert another" clears the previous result so no stale download stays on screen', async ({ page }) => {
    await page.goto('/video-to-gif');
    await pickFile(page, FIXTURES.clip1080p);
    await page.getByRole('button', { name: /^Convert to / }).click();
    await expect(downloadLink(page)).toBeVisible({ timeout: CONVERT_TIMEOUT });

    await page.getByRole('button', { name: 'Convert another' }).click();
    await expect(downloadLink(page)).toHaveCount(0);
    await expect(page.getByText('Drag a video here, or click to choose')).toBeVisible();
  });
});

test.describe('mobile viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the whole convert flow works on a phone-sized screen without horizontal scroll', async ({ page }, testInfo) => {
    await page.goto('/video-to-gif');
    await expect(page.getByRole('button', { name: 'Choose a video file to convert' })).toBeVisible();

    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflows).toBe(false);

    await pickFile(page, FIXTURES.clip1080p);
    const out = await convertAndDownload(page, testInfo.outputPath('mobile.gif'));
    expect(['GIF87a', 'GIF89a']).toContain(magicBytes(out, 6));
  });
});
