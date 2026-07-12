import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Per-IP rate limiting for the extract/download endpoints.
 *
 *  - If Upstash env vars are set → distributed sliding-window (best, multi-server).
 *  - Otherwise → a built-in IN-MEMORY limiter so a single VPS still has real
 *    protection out of the box (no external service needed).
 */

let upstash: Ratelimit | null = null;
let upstashAi: Ratelimit | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = Redis.fromEnv();
  upstash = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '60 s'), prefix: 'ssd:rl', analytics: false });
  // AI routes are far more expensive (yt-dlp + Whisper + free-tier quota) → stricter.
  upstashAi = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(6, '60 s'), prefix: 'ssd:rl:ai', analytics: false });
}

// ── In-memory fallback (single-process), one bucket per named limiter ─
const WINDOW_MS = 60_000;
const MAX_HITS = Number(process.env.RATE_LIMIT_PER_MIN ?? 20);
const MAX_HITS_AI = Number(process.env.AI_RATE_LIMIT_PER_MIN ?? 6);
const buckets = new Map<string, Map<string, number[]>>();

function memoryLimit(bucket: string, ip: string, max: number): boolean {
  const now = Date.now();
  const hits = buckets.get(bucket) ?? new Map<string, number[]>();
  buckets.set(bucket, hits);
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  // Opportunistic cleanup so the map can't grow unbounded.
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  }
  return arr.length <= max;
}

export async function checkRateLimit(ip: string): Promise<{ success: boolean }> {
  if (upstash) return { success: (await upstash.limit(ip)).success };
  return { success: memoryLimit('default', ip, MAX_HITS) };
}

/** Stricter limiter for the expensive AI endpoints (transcribe/summary). */
export async function checkAiRateLimit(ip: string): Promise<{ success: boolean }> {
  if (upstashAi) return { success: (await upstashAi.limit(ip)).success };
  return { success: memoryLimit('ai', ip, MAX_HITS_AI) };
}

export const rateLimitConfigured = () => true;
