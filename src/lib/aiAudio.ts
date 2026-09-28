import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { AiError } from './ai';
import type { PlatformKey } from './platforms';

/**
 * Extract a small, speech-optimized audio file from a video URL for transcription.
 *
 * Whisper only needs intelligible speech, so we downmix to 16 kHz mono @ 48 kbps —
 * ~21 MB for a full hour, which stays under Groq's per-file limit and keeps the
 * upload fast. The VPS only demuxes audio (cheap); the heavy ML runs on the free API.
 *
 * Inputs are SSRF-validated upstream. yt-dlp is spawned with an ARGS ARRAY (never a
 * shell string). Concurrency is capped so a burst can't exhaust the box.
 */

const YTDLP = process.env.YTDLP_PATH || 'yt-dlp';
const FFMPEG = process.env.FFMPEG_PATH || '';
const COOKIES = process.env.YTDLP_COOKIES || '';
const PROXY = process.env.YTDLP_PROXY || '';
const AUDIO_TIMEOUT_MS = 120_000;
// 30-min cap: most social clips are far under it, it blocks token-bomb long videos
// on the free tier, and keeps Gemini's inline audio upload under its ~20 MB limit.
const MAX_DURATION_SEC = Number(process.env.AI_MAX_DURATION_SEC ?? 1800);
const MAX_CONCURRENT = Number(process.env.AI_MAX_CONCURRENT ?? 2);

let active = 0;

// Reap temp dirs orphaned by a crash/SIGKILL between mkdtemp and cleanup, so disk
// can't leak across restarts. Runs once at module load (best-effort).
(function reapStaleTemp() {
  const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
  try {
    const now = Date.now();
    for (const name of readdirSync(os.tmpdir())) {
      if (!name.startsWith('ssd-ai-')) continue;
      const full = path.join(os.tmpdir(), name);
      try {
        if (now - statSync(full).mtimeMs > MAX_AGE_MS) rmSync(full, { recursive: true, force: true });
      } catch {
        /* ignore individual entries */
      }
    }
  } catch {
    /* tmpdir unreadable — nothing to reap */
  }
})();

/**
 * Restricts yt-dlp to the extractor family that owns each platform — see the
 * matching guard in engine.ts. Without it, a whitelisted host whose path
 * yt-dlp doesn't recognize falls through to the generic extractor, which
 * fetches (and follows redirects for) whatever is at that URL: a real SSRF
 * path, sharpened by `t.co` being an attacker-controlled open redirector.
 */
const EXTRACTOR_FILTER: Record<PlatformKey, string> = {
  tiktok: 'tiktok.*',
  instagram: 'instagram.*',
  youtube: 'youtube.*',
  facebook: 'facebook.*',
  linkedin: 'linkedin.*',
  twitter: 'twitter.*',
  pinterest: 'pinterest.*',
  reddit: 'reddit.*',
  vimeo: 'vimeo.*',
  twitch: 'twitch.*',
  tumblr: 'tumblr.*',
};

export interface ExtractedAudio {
  filePath: string;
  cleanup: () => void;
}

export async function extractAudio(url: string, platform: PlatformKey): Promise<ExtractedAudio> {
  if (active >= MAX_CONCURRENT) {
    throw new AiError('provider_failed', 'The server is busy processing other videos. Please try again in a moment.', 503);
  }

  const dir = mkdtempSync(path.join(os.tmpdir(), 'ssd-ai-'));
  const outTemplate = path.join(dir, 'audio.%(ext)s');

  active++;
  let released = false;
  const cleanup = () => {
    if (released) return;
    released = true;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* already gone */
    }
    active--;
  };

  try {
    const args = [
      '-x',
      '--audio-format',
      'mp3',
      '--postprocessor-args',
      'ffmpeg:-ac 1 -ar 16000 -b:a 48k',
      // Reject long videos AND live streams up front. The `<?` form also MATCHES
      // when duration is unknown (common on Reddit/X); --max-filesize is the hard
      // backstop so an unknown-length stream still can't run away.
      '--match-filter',
      `!is_live & duration<?${MAX_DURATION_SEC}`,
      '--max-filesize',
      '30M',
      '--no-warnings',
      '--no-playlist',
      '-o',
      outTemplate,
    ];
    if (FFMPEG) args.push('--ffmpeg-location', FFMPEG);
    if (COOKIES) args.push('--cookies', COOKIES);
    if (PROXY) args.push('--proxy', PROXY);
    args.push('--use-extractors', EXTRACTOR_FILTER[platform]);
    // `--` ends option parsing: defense-in-depth so the URL can never be read as a flag.
    args.push('--', url);

    await runYtDlp(args);

    const produced = readdirSync(dir).find((f) => f.endsWith('.mp3'));
    if (!produced) {
      // No file → either too long (filtered out) or no audio track.
      throw new AiError('too_long', 'That video is too long, private, or has no audio track.', 422);
    }
    return { filePath: path.join(dir, produced), cleanup };
  } catch (err) {
    cleanup();
    throw err;
  }
}

function runYtDlp(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
    }, AUDIO_TIMEOUT_MS);

    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString().slice(0, 4000);
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(
        (err as NodeJS.ErrnoException).code === 'ENOENT'
          ? new AiError('provider_failed', 'The audio engine is not installed on this server.', 503)
          : new AiError('provider_failed', 'The audio engine failed to start.', 503),
      );
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (killed) return reject(new AiError('too_long', 'That video took too long to process. Try a shorter one.', 504));
      if (code !== 0) {
        const priv = /private|login|sign in|not available|removed|unavailable|age/i.test(stderr);
        return reject(
          new AiError(
            'provider_failed',
            priv ? 'This video is private, removed, or region-locked.' : 'Could not fetch that video.',
            priv ? 404 : 502,
          ),
        );
      }
      resolve();
    });
  });
}
