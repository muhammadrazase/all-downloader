import type { ExtractResult } from './types';
import type { PlatformKey } from './platforms';
import { EngineError } from './engine-error';

/**
 * Dedup layer in front of the extraction engine. Trending links get requested
 * thousands of times, and every miss costs a RapidAPI unit or a yt-dlp spawn,
 * so this is the highest-leverage cache in the app.
 *
 * Two mechanisms: a TTL cache, plus single-flight so N concurrent requests for
 * the same link make ONE upstream call instead of N.
 */

// Results that carry direct CDN URLs are SIGNED and expire, so they must not
// outlive the signature. A bare quality menu (local yt-dlp) has no URLs in it
// and is effectively immutable, so it can live much longer.
const SIGNED_TTL_MS = 12 * 60 * 1000;
const MENU_TTL_MS = 6 * 60 * 60 * 1000;
const NOT_FOUND_TTL_MS = 60 * 1000;
const MAX_ENTRIES = 5_000;

// Params that identify a sharer/session, never the video itself.
const TRACKING_PARAMS = [
  'si', 'igsh', 'igshid', 'feature', 't', '_r', '_t', 'is_from_webapp', 'sender_device',
  'web_id', 'share_app_id', 'share_link_id', 'ref', 'ref_src', 'ref_url', 's', 'fbclid', 'gclid',
];

type Entry =
  | { kind: 'ok'; value: ExtractResult; expires: number }
  | { kind: 'not_found'; message: string; expires: number };

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<ExtractResult>>();

/**
 * Conservative normalizer: collapses the same link shared with different
 * tracking params onto one key. Deliberately does NOT try to extract each
 * platform's video ID — a wrong guess there would collide two different videos
 * and serve the wrong one, which is far worse than a lower hit rate.
 */
export function canonicalKey(rawUrl: string, platform: PlatformKey): string {
  let normalized = rawUrl.trim();
  try {
    const u = new URL(rawUrl);
    u.hash = '';
    u.protocol = 'https:';
    u.host = u.host.toLowerCase().replace(/^(www|m|mobile)\./, '');
    for (const p of TRACKING_PARAMS) u.searchParams.delete(p);
    for (const p of [...u.searchParams.keys()]) {
      if (p.toLowerCase().startsWith('utm_')) u.searchParams.delete(p);
    }
    u.searchParams.sort();
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.replace(/\/+$/, '');
    normalized = u.toString();
  } catch {
    /* not a parseable URL — validated upstream, so fall back to the raw string */
  }
  return `extract:v1:${platform}:${normalized}`;
}

function ttlFor(result: ExtractResult): number {
  const hasSignedUrls = result.options.some((o) => typeof o.url === 'string' && o.url.length > 0);
  return hasSignedUrls ? SIGNED_TTL_MS : MENU_TTL_MS;
}

function remember(key: string, entry: Entry): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, entry);
}

function read(key: string): Entry | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expires <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  // Refresh LRU recency.
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

/** Wraps an extract call with TTL caching, negative caching, and single-flight. */
export async function cachedExtract(
  url: string,
  platform: PlatformKey,
  run: () => Promise<ExtractResult>,
): Promise<ExtractResult> {
  const key = canonicalKey(url, platform);

  const hit = read(key);
  if (hit?.kind === 'ok') return hit.value;
  if (hit?.kind === 'not_found') throw new EngineError(hit.message, 404);

  const existing = inflight.get(key);
  if (existing) return existing;

  const pending = run()
    .then((result) => {
      remember(key, { kind: 'ok', value: result, expires: Date.now() + ttlFor(result) });
      return result;
    })
    .catch((err: unknown) => {
      // Cache "this link has nothing" briefly; never cache transient 5xx.
      if (err instanceof EngineError && err.status === 404) {
        remember(key, { kind: 'not_found', message: err.message, expires: Date.now() + NOT_FOUND_TTL_MS });
      }
      throw err;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, pending);
  return pending;
}

/** Test/ops helper — drops everything so a stale signed URL can't linger. */
export function clearExtractCache(): void {
  cache.clear();
  inflight.clear();
}
