import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Content-addressed cache behind both AI tools. A wrong key here either serves
 * one video's transcript for another (correctness) or re-bills every provider
 * call (cost), so key composition and eviction are pinned exactly.
 */

const URL_A = 'https://www.youtube.com/watch?v=aaaaaaaaaaa';
const URL_B = 'https://www.youtube.com/watch?v=bbbbbbbbbbb';

// Upstash is stubbed off so these exercise the in-memory fallback a bare VPS uses.
function loadCache() {
  vi.resetModules();
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
  return import('@/lib/aiCache');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('cacheKey composition', () => {
  it('is deterministic for identical (task, url, variant) inputs', async () => {
    const { cacheKey } = await loadCache();
    expect(cacheKey('transcript', URL_A, 'transcribe')).toBe(cacheKey('transcript', URL_A, 'transcribe'));
  });

  it('namespaces by task and hashes the rest to a fixed-width hex digest', async () => {
    const { cacheKey } = await loadCache();
    expect(cacheKey('summary', URL_A)).toMatch(/^ssd:ai:summary:[0-9a-f]{32}$/);
  });

  it('changes when the content changes', async () => {
    const { cacheKey } = await loadCache();
    expect(cacheKey('transcript', URL_A)).not.toBe(cacheKey('transcript', URL_B));
  });

  it('changes when the variant changes, so translate never serves a transcribe result', async () => {
    const { cacheKey } = await loadCache();
    expect(cacheKey('transcript', URL_A, 'transcribe')).not.toBe(cacheKey('transcript', URL_A, 'translate'));
  });

  it('changes when a prompt version is bumped, so a prompt change cannot serve stale output', async () => {
    const { cacheKey } = await loadCache();
    expect(cacheKey('pdf-summary', 'some text', 'v1')).not.toBe(cacheKey('pdf-summary', 'some text', 'v2'));
  });

  it('keeps the same URL separate across tasks', async () => {
    const { cacheKey } = await loadCache();
    expect(cacheKey('transcript', URL_A)).not.toBe(cacheKey('summary', URL_A));
  });

  it('cannot be collided by smuggling the delimiter into a part', async () => {
    // The parts are JSON-encoded before hashing; a naive join(':') would make
    // these two identical and serve one request's result to another.
    const { cacheKey } = await loadCache();
    expect(cacheKey('transcript', `${URL_A}:extra`, '')).not.toBe(cacheKey('transcript', URL_A, 'extra'));
    expect(cacheKey('transcript', '"a","b"', '')).not.toBe(cacheKey('transcript', 'a', 'b'));
  });

  it('treats an omitted variant as the empty variant', async () => {
    const { cacheKey } = await loadCache();
    expect(cacheKey('summary', URL_A)).toBe(cacheKey('summary', URL_A, ''));
  });
});

describe('get/set round-trip', () => {
  it('returns null for a key that was never written', async () => {
    const { cacheKey, getCached } = await loadCache();
    await expect(getCached(cacheKey('transcript', 'https://never.seen/x'))).resolves.toBeNull();
  });

  it('returns the stored value with its structure intact', async () => {
    const { cacheKey, getCached, setCached } = await loadCache();
    const key = cacheKey('transcript', URL_A);
    const value = { text: 'hello', srt: '1\n', vtt: 'WEBVTT\n', language: 'en', provider: 'groq' };
    await setCached(key, value);
    await expect(getCached(key)).resolves.toEqual(value);
  });

  it('overwrites an existing key rather than appending', async () => {
    const { cacheKey, getCached, setCached } = await loadCache();
    const key = cacheKey('summary', URL_A);
    await setCached(key, { summary: 'first' });
    await setCached(key, { summary: 'second' });
    await expect(getCached(key)).resolves.toEqual({ summary: 'second' });
  });

  it('never confuses two keys that differ only by variant', async () => {
    const { cacheKey, getCached, setCached } = await loadCache();
    await setCached(cacheKey('transcript', URL_A, 'transcribe'), { text: 'original' });
    await setCached(cacheKey('transcript', URL_A, 'translate'), { text: 'english' });
    await expect(getCached(cacheKey('transcript', URL_A, 'transcribe'))).resolves.toEqual({ text: 'original' });
    await expect(getCached(cacheKey('transcript', URL_A, 'translate'))).resolves.toEqual({ text: 'english' });
  });
});

describe('expiry and eviction', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  it('serves an entry inside its TTL and drops it afterwards', async () => {
    const { cacheKey, getCached, setCached } = await loadCache();
    const key = cacheKey('summary', URL_B);
    await setCached(key, { summary: 'cached' });

    vi.setSystemTime(new Date('2026-01-29T00:00:00Z')); // 28 days — inside the 30-day TTL
    await expect(getCached(key)).resolves.toEqual({ summary: 'cached' });

    vi.setSystemTime(new Date('2026-02-05T00:00:00Z')); // 35 days — expired
    await expect(getCached(key)).resolves.toBeNull();
  });

  it('evicts the oldest entry once the in-memory cap is reached, bounding memory', async () => {
    const { cacheKey, getCached, setCached } = await loadCache();
    const key = (i: number) => cacheKey('transcript', `https://vimeo.com/${i}`);
    for (let i = 0; i < 500; i++) await setCached(key(i), { i });

    await setCached(key(500), { i: 500 });
    await expect(getCached(key(0))).resolves.toBeNull();
    await expect(getCached(key(1))).resolves.toEqual({ i: 1 });
    await expect(getCached(key(500))).resolves.toEqual({ i: 500 });
  });

  it('a cache hit refreshes recency, so a hot entry survives an eviction', async () => {
    const { cacheKey, getCached, setCached } = await loadCache();
    const key = (i: number) => cacheKey('transcript', `https://vimeo.com/lru-${i}`);
    for (let i = 0; i < 500; i++) await setCached(key(i), { i });

    await getCached(key(0)); // touch the oldest entry
    await setCached(key(500), { i: 500 });

    await expect(getCached(key(0))).resolves.toEqual({ i: 0 });
    await expect(getCached(key(1))).resolves.toBeNull();
  });
});
