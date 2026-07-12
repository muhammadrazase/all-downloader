import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, createReadStream, readdirSync, statSync, rmSync } from 'node:fs';
import type { ExtractResult, QualityOption } from './types';
import type { PlatformKey } from './platforms';
import { humanFormatLabel } from './format';
import { EngineError } from './engine-error';
import { extractViaApi } from './engine-api';

export { EngineError };

/**
 * Extraction engine.
 *
 *  - `extract()` reads metadata + the list of qualities the visitor can pick.
 *  - `prepareDownload()` fetches ONE chosen quality (merging video+audio with
 *    ffmpeg when needed) to a temp file and returns a stream for the response.
 *
 * Two backends, chosen by env:
 *   1. Remote engine (production): forward to ENGINE_URL.
 *   2. Local yt-dlp (self-host / dev): spawn the binary with an ARGS ARRAY.
 *
 * yt-dlp path: YTDLP_PATH (default 'yt-dlp'). ffmpeg path: FFMPEG_PATH (optional;
 * required for HD merges + MP3). Inputs are validated upstream (SSRF + whitelist).
 */

const EXTRACT_TIMEOUT_MS = 20_000;
const DOWNLOAD_TIMEOUT_MS = 180_000;
const YTDLP = process.env.YTDLP_PATH || 'yt-dlp';
const FFMPEG = process.env.FFMPEG_PATH || '';
// Optional hardening for real-world extraction:
const COOKIES = process.env.YTDLP_COOKIES || ''; // cookies.txt — needed for many IG/FB and bot-checked YouTube
const PROXY = process.env.YTDLP_PROXY || ''; // proxy URL — helps when datacenter IPs are blocked
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_DOWNLOADS ?? 3);
const MAX_FILESIZE_MB = Number(process.env.MAX_DOWNLOAD_MB ?? 1500);

const VIDEO_TIERS = [2160, 1440, 1080, 720, 480, 360];

let activeDownloads = 0;

/** Shared yt-dlp flags for cookies/proxy when configured. */
function extraArgs(): string[] {
  const a: string[] = [];
  if (COOKIES) a.push('--cookies', COOKIES);
  if (PROXY) a.push('--proxy', PROXY);
  return a;
}

// ── Metadata + quality options ──────────────────────────────────────
export async function extract(url: string, platform: PlatformKey): Promise<ExtractResult> {
  // Engine selection (dormant unless configured):
  //   1. RapidAPI downloader  → free/Vercel path, returns direct CDN URLs
  //   2. Remote engine service → ENGINE_URL
  //   3. Local yt-dlp          → self-host / dev (default)
  if (process.env.RAPIDAPI_KEY && process.env.RAPIDAPI_HOST) return extractViaApi(url, platform);
  if (process.env.ENGINE_URL) return extractViaRemote(url, platform);

  const json = await runYtDlpJson(url);
  const title = typeof json.title === 'string' ? json.title : 'video';
  const thumbnail = typeof json.thumbnail === 'string' ? json.thumbnail : undefined;
  const duration = typeof json.duration === 'number' ? json.duration : undefined;
  const options = buildOptions(Array.isArray(json.formats) ? (json.formats as RawFormat[]) : []);

  if (!options.length) throw new EngineError('No downloadable video was found at that link.', 404);
  return { platform, sourceUrl: url, title, thumbnail, duration, options };
}

async function extractViaRemote(url: string, platform: PlatformKey): Promise<ExtractResult> {
  const r = await fetch(`${process.env.ENGINE_URL}/extract`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(process.env.ENGINE_KEY ? { 'x-api-key': process.env.ENGINE_KEY } : {}),
    },
    body: JSON.stringify({ url, platform }),
    signal: AbortSignal.timeout(EXTRACT_TIMEOUT_MS),
  });
  if (!r.ok) throw new EngineError('The download service could not process this link.', 502);
  const data = (await r.json()) as ExtractResult;
  if (!data?.options?.length) throw new EngineError('No downloadable video was found at that link.', 404);
  return { ...data, platform, sourceUrl: url };
}

interface RawFormat {
  height?: number;
  vcodec?: string;
  acodec?: string;
}

/** Turn yt-dlp's raw formats into a clean menu: video tiers ≤ source max, + MP3. */
function buildOptions(raw: RawFormat[]): QualityOption[] {
  const heights = new Set<number>();
  let hasAudio = false;
  for (const f of raw) {
    if (f.vcodec && f.vcodec !== 'none' && typeof f.height === 'number') heights.add(f.height);
    if (f.acodec && f.acodec !== 'none') hasAudio = true;
  }
  const max = heights.size ? Math.max(...heights) : 0;

  const tiers = VIDEO_TIERS.filter((h) => h <= max);
  if (!tiers.length && max > 0) tiers.push(max); // very low-res source

  const options: QualityOption[] = tiers.map((h) => ({
    quality: String(h),
    label: humanFormatLabel(String(h), 'mp4'),
    kind: 'video',
  }));

  if (hasAudio || max > 0) {
    options.push({ quality: 'audio', label: humanFormatLabel('audio', 'mp3'), kind: 'audio' });
  }
  return options;
}

// ── Download one chosen quality ─────────────────────────────────────
export interface PreparedDownload {
  stream: NodeJS.ReadableStream;
  filename: string;
  contentType: string;
  size?: number;
  cleanup: () => void;
}

export async function prepareDownload(
  url: string,
  quality: string,
  platform: PlatformKey,
): Promise<PreparedDownload> {
  if (process.env.ENGINE_URL) {
    // Production: let the engine service stream the file back to us.
    const r = await fetch(
      `${process.env.ENGINE_URL}/download?u=${encodeURIComponent(url)}&p=${platform}&q=${quality}`,
      { headers: process.env.ENGINE_KEY ? { 'x-api-key': process.env.ENGINE_KEY } : {} },
    );
    if (!r.ok || !r.body) throw new EngineError('Could not prepare this download.', 502);
    const { Readable } = await import('node:stream');
    return {
      stream: Readable.fromWeb(r.body as import('stream/web').ReadableStream),
      filename: filenameFromDisposition(r.headers.get('content-disposition')) ?? `video-${quality}.mp4`,
      contentType: r.headers.get('content-type') ?? 'video/mp4',
      cleanup: () => {},
    };
  }

  // Protect a small VPS: cap simultaneous heavy (ffmpeg) downloads.
  if (activeDownloads >= MAX_CONCURRENT) {
    throw new EngineError('The server is busy preparing other downloads. Please try again in a moment.', 503);
  }

  const isAudio = quality === 'audio';
  const dir = mkdtempSync(path.join(os.tmpdir(), 'ssd-'));
  const outTemplate = path.join(dir, '%(title).80s.%(ext)s');

  activeDownloads++;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* temp dir already gone */
    }
    activeDownloads--;
  };

  try {
    const args = isAudio
      ? ['-x', '--audio-format', 'mp3', '--audio-quality', '0', '-o', outTemplate]
      : [
          '-f',
          `bestvideo[height<=${sanitizeHeight(quality)}]+bestaudio/best[height<=${sanitizeHeight(quality)}]`,
          '--merge-output-format',
          'mp4',
          '-o',
          outTemplate,
        ];
    args.push('--max-filesize', `${MAX_FILESIZE_MB}M`);
    if (FFMPEG) args.push('--ffmpeg-location', FFMPEG);
    args.push('--no-warnings', '--no-playlist', ...extraArgs(), url);

    await runYtDlp(args, DOWNLOAD_TIMEOUT_MS);

    const files = readdirSync(dir);
    const produced = files[0];
    if (!produced) throw new EngineError('The download could not be created (it may exceed the size limit).', 502);

    const filePath = path.join(dir, produced);
    const size = statSync(filePath).size;
    const stream = createReadStream(filePath);
    stream.on('close', finish);
    stream.on('error', finish);

    return {
      stream,
      filename: produced,
      contentType: isAudio ? 'audio/mpeg' : 'video/mp4',
      size,
      cleanup: finish,
    };
  } catch (err) {
    finish();
    throw err;
  }
}

function sanitizeHeight(q: string): number {
  const n = parseInt(q, 10);
  return Number.isFinite(n) && n > 0 && n <= 4320 ? n : 720;
}

function filenameFromDisposition(cd: string | null): string | undefined {
  if (!cd) return undefined;
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  return m?.[1] ? decodeURIComponent(m[1]) : undefined;
}

// ── yt-dlp process helpers (args array, timeout, bounded output) ─────
function runYtDlpJson(url: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP, ['-J', '--no-warnings', '--no-playlist', ...extraArgs(), url], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
    }, EXTRACT_TIMEOUT_MS);

    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString();
      if (stdout.length > 20_000_000) child.kill('SIGKILL');
    });
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(engineErrorFromSpawn(err));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (killed) return reject(new EngineError('This link took too long to process.', 504));
      if (code !== 0) return reject(engineErrorFromStderr(stderr));
      try {
        resolve(JSON.parse(stdout) as Record<string, unknown>);
      } catch {
        reject(new EngineError('The engine returned an unexpected response.', 502));
      }
    });
  });
}

function runYtDlp(args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString().slice(0, 4000);
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(engineErrorFromSpawn(err));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (killed) return reject(new EngineError('This download took too long.', 504));
      if (code !== 0) return reject(engineErrorFromStderr(stderr));
      resolve();
    });
  });
}

function engineErrorFromSpawn(err: Error): EngineError {
  return (err as NodeJS.ErrnoException).code === 'ENOENT'
    ? new EngineError('The extraction engine is not installed. Set YTDLP_PATH or install yt-dlp.', 503)
    : new EngineError('The extraction engine failed to start.', 503);
}

function engineErrorFromStderr(stderr: string): EngineError {
  const priv = /private|login|sign in|not available|removed|unavailable|age/i.test(stderr);
  return new EngineError(
    priv ? 'This video is private, removed, age-restricted, or region-locked.' : 'Could not fetch this video.',
    priv ? 404 : 502,
  );
}
