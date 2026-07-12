import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';

/**
 * Content cache for AI results — the biggest lever that keeps the free tiers free.
 *
 * A transcript/summary for a given (url, task) NEVER changes, so we compute once
 * and reuse forever. Upstash Redis if configured (survives restarts / multi-server);
 * otherwise an in-memory LRU so a single VPS still benefits with zero setup.
 */

const TTL_SECONDS = Number(process.env.AI_CACHE_TTL_SEC ?? 60 * 60 * 24 * 30); // 30 days
const MEM_MAX = 500;

let redis: Redis | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = Redis.fromEnv();
}

const mem = new Map<string, { value: unknown; expires: number }>();

export function cacheKey(task: string, url: string, variant = ''): string {
  // JSON-encode the parts so no value can inject the delimiter and collide keys.
  const hash = createHash('sha256').update(JSON.stringify([task, url, variant])).digest('hex').slice(0, 32);
  return `ssd:ai:${task}:${hash}`;
}

export async function getCached<T>(key: string): Promise<T | null> {
  if (redis) {
    try {
      const hit = await redis.get<T>(key);
      if (hit) return hit;
    } catch {
      /* fall through to memory */
    }
  }
  const entry = mem.get(key);
  if (entry && entry.expires > Date.now()) {
    // Refresh LRU recency.
    mem.delete(key);
    mem.set(key, entry);
    return entry.value as T;
  }
  if (entry) mem.delete(key);
  return null;
}

export async function setCached<T>(key: string, value: T): Promise<void> {
  if (redis) {
    try {
      await redis.set(key, value, { ex: TTL_SECONDS });
    } catch {
      /* cache is best-effort */
    }
  }
  if (mem.size >= MEM_MAX) {
    const oldest = mem.keys().next().value;
    if (oldest) mem.delete(oldest);
  }
  mem.set(key, { value, expires: Date.now() + TTL_SECONDS * 1000 });
}
