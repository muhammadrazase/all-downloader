import { spawn } from 'node:child_process';
import { EngineError } from './engine-error';
import type { ImageResult } from './types';

const YTDLP = process.env.YTDLP_PATH || 'yt-dlp';
const COOKIES = process.env.YTDLP_COOKIES || '';
const PROXY = process.env.YTDLP_PROXY || '';
const TIMEOUT_MS = 12_000;

/** Grab a TikTok cover image via a light yt-dlp print (no full download). */
export async function grabTiktokThumbnail(url: string): Promise<ImageResult> {
  const extra: string[] = [];
  if (COOKIES) extra.push('--cookies', COOKIES);
  if (PROXY) extra.push('--proxy', PROXY);
  const out = await runPrint([
    '--no-warnings',
    '--no-playlist',
    '--print',
    '%(thumbnail)s|%(title)s',
    ...extra,
    url,
  ]);
  const line = out.trim().split('\n')[0] ?? '';
  const sep = line.indexOf('|');
  const thumb = sep >= 0 ? line.slice(0, sep) : line;
  const title = sep >= 0 ? line.slice(sep + 1) : '';
  if (!thumb || !/^https?:\/\//.test(thumb)) {
    throw new EngineError('No thumbnail was found (the video may be private or removed).', 404);
  }
  return {
    source: url,
    title: title && title !== 'NA' ? title : undefined,
    images: [{ label: 'Cover image (HD)', url: thumb, ext: 'jpg' }],
  };
}

function runPrint(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
    }, TIMEOUT_MS);

    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString();
      if (stdout.length > 200_000) child.kill('SIGKILL');
    });
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString().slice(0, 2000);
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(
        (err as NodeJS.ErrnoException).code === 'ENOENT'
          ? new EngineError('The extraction engine is not installed.', 503)
          : new EngineError('The extraction engine failed to start.', 503),
      );
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (killed) return reject(new EngineError('This link took too long to process.', 504));
      if (code !== 0) {
        const priv = /private|login|not available|removed|unavailable/i.test(stderr);
        return reject(new EngineError(priv ? 'This video is private or removed.' : 'Could not fetch this thumbnail.', priv ? 404 : 502));
      }
      resolve(stdout);
    });
  });
}
