import type { ExtractResult, QualityOption } from './types';
import type { PlatformKey } from './platforms';
import { humanFormatLabel } from './format';
import { EngineError } from './engine-error';
import { getSetting } from './config/settings.server';

/**
 * Third-party API engine (the free/Vercel path).
 *
 * When RAPIDAPI_KEY + RAPIDAPI_HOST are set, we call a RapidAPI downloader that
 * returns DIRECT media URLs. The browser downloads straight from those URLs, so
 * this uses ~zero server bandwidth — which is what keeps a free host free.
 *
 * This adapter targets the common "all-in-one social downloader" response shape:
 *   { title, thumbnail, duration, medias: [{ url, quality, extension,
 *     videoAvailable, audioAvailable, type }] }
 * Many RapidAPI downloaders use this shape. If yours differs, adjust ONLY
 * `mapMedias()` below — everything else stays the same.
 *
 * Env:
 *   RAPIDAPI_KEY       your RapidAPI key
 *   RAPIDAPI_HOST      e.g. social-download-all-in-one.p.rapidapi.com
 *   RAPIDAPI_ENDPOINT  (optional) full endpoint; defaults to https://<host>/v1/social/autolink
 */

const TIMEOUT_MS = 20_000;

interface ApiMedia {
  url?: string;
  link?: string;
  quality?: string;
  extension?: string;
  type?: string;
  videoAvailable?: boolean;
  audioAvailable?: boolean;
  size?: number;
  formattedSize?: string;
}

export interface RapidApiCreds {
  key: string;
  host: string;
}

export async function extractViaApi(
  url: string,
  platform: PlatformKey,
  creds?: RapidApiCreds,
): Promise<ExtractResult> {
  // Creds are passed down from extract() so the hot path reads each setting once.
  const key = creds?.key ?? getSetting('RAPIDAPI_KEY') ?? '';
  const host = creds?.host ?? getSetting('RAPIDAPI_HOST') ?? '';
  const endpoint = getSetting('RAPIDAPI_ENDPOINT') || `https://${host}/v1/social/autolink`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-rapidapi-key': key,
        'x-rapidapi-host': host,
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new EngineError('The download service is unreachable right now.', 503);
  }

  if (res.status === 429) throw new EngineError('The download service is busy. Please try again shortly.', 429);
  if (!res.ok) throw new EngineError('The download service could not process this link.', 502);

  const data = (await res.json()) as {
    title?: string;
    thumbnail?: string;
    duration?: number;
    medias?: ApiMedia[];
    links?: ApiMedia[];
  };

  const options = mapMedias(data.medias ?? data.links ?? []);
  if (!options.length) throw new EngineError('No downloadable video was found at that link.', 404);

  return {
    platform,
    sourceUrl: url,
    title: data.title || 'video',
    thumbnail: typeof data.thumbnail === 'string' ? data.thumbnail : undefined,
    duration: typeof data.duration === 'number' ? data.duration : undefined,
    options,
  };
}

/** Adjust THIS function if your RapidAPI product returns a different shape. */
function mapMedias(medias: ApiMedia[]): QualityOption[] {
  const out: QualityOption[] = [];
  const seen = new Set<string>();

  for (const m of medias) {
    const link = m.url || m.link;
    if (!link) continue;

    const q = String(m.quality ?? '').toLowerCase();
    const ext = (m.extension || (/(mp3|m4a|aac|opus)/i.test(q) ? 'mp3' : 'mp4')).toLowerCase();
    const isAudio =
      m.type === 'audio' || (m.audioAvailable === true && m.videoAvailable === false) || /audio|mp3|m4a/.test(q) || /mp3|m4a|aac|opus/.test(ext);

    const height = parseHeight(q);
    const key = isAudio ? 'audio' : height ? String(height) : q || link;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      quality: isAudio ? 'audio' : height ? String(height) : q || 'video',
      label: isAudio ? humanFormatLabel('audio', 'mp3') : height ? humanFormatLabel(String(height), 'mp4') : prettifyQuality(q, ext),
      kind: isAudio ? 'audio' : 'video',
      url: link,
      size: typeof m.size === 'number' ? m.size : undefined,
    });
  }

  // Highest video first, audio last.
  return out.sort((a, b) => {
    if (a.quality === 'audio') return 1;
    if (b.quality === 'audio') return -1;
    return (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0);
  });
}

function parseHeight(q: string): number | null {
  const m = /(\d{3,4})\s*p?/.exec(q);
  if (m?.[1]) return parseInt(m[1], 10);
  if (/\bhd\b|1080|full/.test(q)) return 1080;
  if (/\bsd\b/.test(q)) return 480;
  return null;
}

function prettifyQuality(q: string, ext: string): string {
  const label = q ? q.replace(/\b\w/g, (c) => c.toUpperCase()) : 'Video';
  return `${label} · ${ext.toUpperCase()}`;
}
