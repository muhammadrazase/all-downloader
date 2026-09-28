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
let upstashAdminLogin: Ratelimit | null = null;
let upstashTrack: Ratelimit | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = Redis.fromEnv();
  upstash = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '60 s'), prefix: 'ssd:rl', analytics: false });
  // AI routes are far more expensive (yt-dlp + Whisper + free-tier quota) → stricter.
  upstashAi = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(6, '60 s'), prefix: 'ssd:rl:ai', analytics: false });
  // Admin login: a secondary layer alongside the account-lockout in adminUser.ts.
  upstashAdminLogin = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '900 s'),
    prefix: 'ssd:rl:admin-login',
    analytics: false,
  });
  // Analytics beacon: fires once per tool-page visit, so a real visitor browsing
  // several tools needs real headroom — kept separate from the shared default
  // bucket so it can never starve /api/extract or /api/download for the same IP.
  upstashTrack = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '60 s'), prefix: 'ssd:rl:track', analytics: false });
}

// ── In-memory fallback (single-process), one bucket per named limiter ─
const WINDOW_MS = 60_000;
const ADMIN_LOGIN_WINDOW_MS = 900_000; // 15 min
const MAX_HITS = Number(process.env.RATE_LIMIT_PER_MIN ?? 20);
const MAX_HITS_AI = Number(process.env.AI_RATE_LIMIT_PER_MIN ?? 6);
const MAX_HITS_ADMIN_LOGIN = 5;
const MAX_HITS_TRACK = Number(process.env.TRACK_RATE_LIMIT_PER_MIN ?? 60);
const buckets = new Map<string, Map<string, number[]>>();

function memoryLimit(bucket: string, ip: string, max: number, windowMs: number = WINDOW_MS): boolean {
  const now = Date.now();
  const hits = buckets.get(bucket) ?? new Map<string, number[]>();
  buckets.set(bucket, hits);
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(ip, arr);
  // Opportunistic cleanup so the map can't grow unbounded.
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
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

/** Per-IP layer on top of the account-lockout in adminUser.ts (5 attempts / 15 min). */
export async function checkAdminLoginRateLimit(ip: string): Promise<{ success: boolean }> {
  if (upstashAdminLogin) return { success: (await upstashAdminLogin.limit(ip)).success };
  return { success: memoryLimit('admin-login', ip, MAX_HITS_ADMIN_LOGIN, ADMIN_LOGIN_WINDOW_MS) };
}

/** Dedicated bucket for the /api/track beacon — deliberately separate from the
 * shared default so it can never starve extract/download for a visitor behind
 * the same IP (e.g. a school/office NAT) just from browsing tool pages. */
export async function checkTrackRateLimit(ip: string): Promise<{ success: boolean }> {
  if (upstashTrack) return { success: (await upstashTrack.limit(ip)).success };
  return { success: memoryLimit('track', ip, MAX_HITS_TRACK) };
}

/** True only when the DISTRIBUTED limiter is live. The in-memory fallback is
 * per-process, so with more than one process the effective per-IP limit
 * multiplies — a health check needs to be able to tell the difference. */
export const rateLimitConfigured = (): boolean => upstash !== null;
