import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { checkRateLimit, checkAiRateLimit, checkAdminLoginRateLimit } from '@/lib/rateLimit';
import { clientIp } from '@/lib/clientIp';

/**
 * Exercises the IN-MEMORY fallback only — the path a bare VPS actually runs.
 * Upstash needs live credentials and is not covered here (see the final report).
 */

const DEFAULT_LIMIT = 20;
const AI_LIMIT = 6;
const WINDOW_MS = 60_000;

let ipCounter = 0;
/** Buckets are module-global and persist across tests, so every test needs a fresh IP. */
const freshIp = () => `198.51.100.${++ipCounter}`;

beforeAll(() => {
  if (process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Upstash env vars are set — these tests must exercise the in-memory fallback.');
  }
});

afterEach(() => {
  vi.useRealTimers();
});

async function hit(n: number, ip: string, which: 'default' | 'ai' = 'default'): Promise<boolean[]> {
  const check = which === 'ai' ? checkAiRateLimit : checkRateLimit;
  const results: boolean[] = [];
  for (let i = 0; i < n; i++) results.push((await check(ip)).success);
  return results;
}

describe('default bucket — 20 requests / 60s', () => {
  it('allows exactly the first 20 requests and blocks the 21st', async () => {
    const ip = freshIp();
    const results = await hit(DEFAULT_LIMIT + 1, ip);
    expect(results.slice(0, DEFAULT_LIMIT).every(Boolean)).toBe(true);
    expect(results[DEFAULT_LIMIT]).toBe(false);
  });

  it('stays blocked for every subsequent request inside the same window', async () => {
    const ip = freshIp();
    await hit(DEFAULT_LIMIT, ip);
    expect(await hit(5, ip)).toEqual([false, false, false, false, false]);
  });
});

describe('AI bucket — 6 requests / 60s (the expensive transcribe/summary routes)', () => {
  it('allows exactly the first 6 requests and blocks the 7th', async () => {
    const ip = freshIp();
    const results = await hit(AI_LIMIT + 1, ip, 'ai');
    expect(results.slice(0, AI_LIMIT).every(Boolean)).toBe(true);
    expect(results[AI_LIMIT]).toBe(false);
  });

  it('is genuinely stricter than the default bucket, not a duplicate of it', async () => {
    const ip = freshIp();
    const aiResults = await hit(DEFAULT_LIMIT, ip, 'ai');
    expect(aiResults.filter(Boolean)).toHaveLength(AI_LIMIT);
  });
});

describe('bucket isolation', () => {
  it('two different IPs get independent budgets', async () => {
    const attacker = freshIp();
    const bystander = freshIp();
    await hit(DEFAULT_LIMIT + 1, attacker);
    expect((await checkRateLimit(attacker)).success).toBe(false);
    expect((await checkRateLimit(bystander)).success).toBe(true);
  });

  it('exhausting the AI bucket does not exhaust the default bucket for the same IP', async () => {
    const ip = freshIp();
    await hit(AI_LIMIT + 1, ip, 'ai');
    expect((await checkAiRateLimit(ip)).success).toBe(false);
    expect((await checkRateLimit(ip)).success).toBe(true);
  });

  it('exhausting the default bucket does not exhaust the AI bucket for the same IP', async () => {
    const ip = freshIp();
    await hit(DEFAULT_LIMIT + 1, ip);
    expect((await checkRateLimit(ip)).success).toBe(false);
    expect((await checkAiRateLimit(ip)).success).toBe(true);
  });
});

describe('sliding window actually slides', () => {
  it('lets the IP through again once the 60s window has fully elapsed', async () => {
    vi.useFakeTimers();
    const ip = freshIp();
    await hit(DEFAULT_LIMIT + 1, ip);
    expect((await checkRateLimit(ip)).success).toBe(false);

    vi.advanceTimersByTime(WINDOW_MS + 1);
    expect((await checkRateLimit(ip)).success).toBe(true);
  });

  it('does NOT reset early — still blocked one millisecond before the window expires', async () => {
    vi.useFakeTimers();
    const ip = freshIp();
    await hit(DEFAULT_LIMIT, ip);
    vi.advanceTimersByTime(WINDOW_MS - 1);
    expect((await checkRateLimit(ip)).success).toBe(false);
  });

  it('expires hits individually, not as a whole block (true sliding, not fixed, window)', async () => {
    vi.useFakeTimers();
    const ip = freshIp();
    await hit(DEFAULT_LIMIT - 1, ip); // 19 hits at t=0
    vi.advanceTimersByTime(30_000);
    expect((await checkRateLimit(ip)).success).toBe(true); // 20th at t=30s
    expect((await checkRateLimit(ip)).success).toBe(false); // 21st blocked

    // At t=60.001s the original 19 have aged out but the t=30s hits have not.
    vi.advanceTimersByTime(30_001);
    const afterPartialExpiry = await hit(DEFAULT_LIMIT, ip);
    expect(afterPartialExpiry.filter(Boolean).length).toBeLessThan(DEFAULT_LIMIT);
    expect(afterPartialExpiry.filter(Boolean).length).toBeGreaterThan(0);
  });

  it('a blocked request still consumes window space, so hammering extends the block', async () => {
    // Intentional in this design: an abusive client cannot free its own budget by
    // retrying. Pinned so the behaviour is not "fixed" by accident.
    vi.useFakeTimers();
    const ip = freshIp();
    await hit(DEFAULT_LIMIT, ip); // t=0: budget exhausted
    vi.advanceTimersByTime(59_000);
    const retries = await hit(DEFAULT_LIMIT + 5, ip); // t=59s: all refused, all recorded
    expect(retries.every((allowed) => allowed === false)).toBe(true);

    vi.advanceTimersByTime(1_500); // the original 20 have now aged out
    expect((await checkRateLimit(ip)).success).toBe(false); // but the 25 retries have not
  });
});

describe('admin-login bucket — 5 requests / 15min (the account-lockout is the primary defense, this is a second layer)', () => {
  it('allows exactly the first 5 attempts and blocks the 6th', async () => {
    const ip = freshIp();
    const results: boolean[] = [];
    for (let i = 0; i < 6; i++) results.push((await checkAdminLoginRateLimit(ip)).success);
    expect(results.slice(0, 5).every(Boolean)).toBe(true);
    expect(results[5]).toBe(false);
  });

  it('is isolated from the default and AI buckets for the same IP', async () => {
    const ip = freshIp();
    for (let i = 0; i < 6; i++) await checkAdminLoginRateLimit(ip);
    expect((await checkAdminLoginRateLimit(ip)).success).toBe(false);
    expect((await checkRateLimit(ip)).success).toBe(true);
    expect((await checkAiRateLimit(ip)).success).toBe(true);
  });
});

describe('clientIp — the key the limiter is bucketed by', () => {
  const make = (headers: Record<string, string>) => new Request('http://localhost/api/extract', { headers }).headers;

  it('prefers X-Real-IP, which nginx overwrites with the true peer', () => {
    expect(clientIp(make({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '1.2.3.4' }))).toBe('203.0.113.7');
  });

  it('uses the RIGHTMOST X-Forwarded-For entry, ignoring client-spoofable left entries', () => {
    expect(clientIp(make({ 'x-forwarded-for': '9.9.9.9, 8.8.8.8, 203.0.113.7' }))).toBe('203.0.113.7');
  });

  it('a spoofed left-hand XFF chain cannot rotate the rate-limit key', async () => {
    const realIp = freshIp();
    const spoof = (fake: string) => clientIp(make({ 'x-forwarded-for': `${fake}, ${realIp}` }));
    const keys = new Set(['1.1.1.1', '2.2.2.2', '3.3.3.3'].map(spoof));
    expect(keys).toEqual(new Set([realIp]));
  });

  it('falls back to a constant key when no proxy headers are present', () => {
    expect(clientIp(make({}))).toBe('anon');
  });

  it('trims whitespace so " 1.2.3.4 " and "1.2.3.4" share one bucket', () => {
    expect(clientIp(make({ 'x-real-ip': '  203.0.113.7  ' }))).toBe('203.0.113.7');
  });

  it('ignores an empty X-Forwarded-For rather than keying on an empty string', () => {
    expect(clientIp(make({ 'x-forwarded-for': ' , , ' }))).toBe('anon');
  });
});
