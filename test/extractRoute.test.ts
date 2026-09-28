import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EngineError } from '@/lib/engine-error';
import { clearExtractCache } from '@/lib/extractCache';
import type { ExtractResult } from '@/lib/types';

/**
 * Integration tests for POST /api/extract. The Next route handler is imported and
 * invoked with a real Request — no dev server needed. Only the engine is mocked,
 * so the real rate limiter, Zod schema and SSRF guard all execute in real order.
 */

const extractMock = vi.fn<(url: string, platform: string) => Promise<ExtractResult>>();

vi.mock('@/lib/engine', async () => {
  const { EngineError: RealEngineError } = await import('@/lib/engine-error');
  return {
    EngineError: RealEngineError,
    extract: (url: string, platform: string) => extractMock(url, platform),
    prepareDownload: vi.fn(),
  };
});

const { POST, GET } = await import('@/app/api/extract/route');

const YT = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

let ipCounter = 0;
/** The rate limiter is real and stateful, so each test needs its own client IP. */
const freshIp = () => `198.51.100.${++ipCounter}`;

function post(body: unknown, ip = freshIp(), raw?: string): Promise<Response> {
  return POST(
    new Request('http://localhost/api/extract', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-real-ip': ip },
      body: raw ?? JSON.stringify(body),
    }),
  );
}

const okResult: ExtractResult = {
  platform: 'youtube',
  sourceUrl: YT,
  title: 'Never Gonna Give You Up',
  thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  duration: 213,
  options: [
    { quality: '1080', label: 'HD 1080p · MP4', kind: 'video' },
    { quality: '720', label: 'HD 720p · MP4', kind: 'video' },
    { quality: 'audio', label: 'Audio · MP3', kind: 'audio' },
  ],
};

beforeEach(() => {
  extractMock.mockReset();
  extractMock.mockResolvedValue(okResult);
  // The route dedupes identical links, so results would leak between tests.
  clearExtractCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('happy path', () => {
  it('returns the typed extract result with a no-store cache header', async () => {
    const res = await post({ url: YT, platform: 'youtube' });
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual(okResult);
  });

  it('hands the engine exactly the validated url and platform, nothing more', async () => {
    await post({ url: YT, platform: 'youtube', ffmpegArgs: ['-i', '/etc/passwd'] });
    expect(extractMock).toHaveBeenCalledExactlyOnceWith(YT, 'youtube');
  });

  it('trims a pasted URL before it reaches the engine', async () => {
    await post({ url: `  ${YT}\n`, platform: 'youtube' });
    expect(extractMock).toHaveBeenCalledExactlyOnceWith(YT, 'youtube');
  });
});

describe('body parsing and schema (400s)', () => {
  it('rejects a non-JSON body', async () => {
    const res = await post(null, freshIp(), 'this is not json');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid request.' });
  });

  it('rejects an empty body', async () => {
    const res = await post(null, freshIp(), '');
    expect(res.status).toBe(400);
  });

  it.each([
    ['missing url', { platform: 'youtube' }],
    ['missing platform', { url: YT }],
    ['unknown platform', { url: YT, platform: 'snapchat' }],
    ['platform casing mismatch', { url: YT, platform: 'YouTube' }],
    ['prototype-pollution key as platform', { url: YT, platform: '__proto__' }],
    ['non-string url', { url: 12345, platform: 'youtube' }],
    ['array url', { url: [YT], platform: 'youtube' }],
    ['empty url', { url: '', platform: 'youtube' }],
    ['null body', null],
    ['array body', []],
  ])('rejects %s with a generic 400', async (_label, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Please provide a valid link and platform.' });
  });

  it('rejects an over-2048 URL as a 400 schema failure, distinct from the 413 body cap', async () => {
    // Under the 8KB body cap, so it reaches Zod — the two limits are independent.
    const res = await post({ url: `${YT}&pad=${'a'.repeat(2500)}`, platform: 'youtube' });
    expect(res.status).toBe(400);
    expect(extractMock).not.toHaveBeenCalled();
  });

  it('rejects an oversized body with 413 before JSON.parse ever sees it', async () => {
    const huge = JSON.stringify({ url: YT, platform: 'youtube', pad: 'a'.repeat(20_000) });
    const res = await post(null, freshIp(), huge);
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'Request too large.' });
    expect(extractMock).not.toHaveBeenCalled();
  });

  it('rejects an oversized body even when Content-Length lies (chunked-transfer bypass)', async () => {
    // A streamed body carries no Content-Length, so the header check cannot fire —
    // the post-read byte count is the guard that actually holds.
    const huge = 'a'.repeat(20_000);
    const res = await POST(
      new Request('http://localhost/api/extract', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-real-ip': freshIp() },
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(huge));
            controller.close();
          },
        }),
        // @ts-expect-error duplex is required by Node for a streamed request body
        duplex: 'half',
      }),
    );
    expect(res.status).toBe(413);
    expect(extractMock).not.toHaveBeenCalled();
  });

  it('accepts a body just under the cap, so the limit is not over-tight', async () => {
    const padded = JSON.stringify({ url: YT, platform: 'youtube', pad: 'a'.repeat(7_000) });
    const res = await post(null, freshIp(), padded);
    expect(res.status).toBe(200);
  });

  it('size-checks BEFORE schema parsing, so an oversized junk body is 413 not 400', async () => {
    const res = await post(null, freshIp(), 'x'.repeat(20_000));
    expect(res.status).toBe(413);
  });

  it('does not reflect the rejected input back in the error body', async () => {
    const res = await post({ url: 'https://evil.com/<script>alert(1)</script>', platform: 'youtube' });
    const text = await res.text();
    expect(text).not.toContain('<script>');
    expect(text).not.toContain('evil.com');
  });
});

describe('SSRF / host whitelist (400s) — the engine must never be reached', () => {
  it.each([
    ['internal metadata IP', 'http://169.254.169.254/latest/meta-data/', 'Internal addresses are not allowed.'],
    ['loopback', 'http://127.0.0.1:3000/admin', 'Internal addresses are not allowed.'],
    ['private LAN', 'http://192.168.1.1/', 'Internal addresses are not allowed.'],
    ['decimal-encoded loopback', 'http://2130706433/', 'Internal addresses are not allowed.'],
    ['lookalike host', 'https://www.youtube.com.evil.com/watch?v=1', 'That does not look like a valid YouTube link.'],
    ['credential smuggling', 'https://www.youtube.com@evil.com/', 'That does not look like a valid YouTube link.'],
    ['foreign platform', 'https://www.tiktok.com/@u/video/1', 'That does not look like a valid YouTube link.'],
  ])('refuses %s', async (_label, url, reason) => {
    const res = await post({ url, platform: 'youtube' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: reason });
    expect(extractMock).not.toHaveBeenCalled();
  });

  it('refuses the historical Pinterest SSRF bypass end to end', async () => {
    const res = await post({ url: 'https://pinterest.169.254.169.254.nip.io/pin/1/', platform: 'pinterest' });
    expect(res.status).toBe(400);
    expect(extractMock).not.toHaveBeenCalled();
  });

  it('refuses a non-http scheme that passes Zod but not the protocol guard', async () => {
    const res = await post({ url: 'javascript:alert(1)', platform: 'youtube' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Only http(s) links are supported.' });
    expect(extractMock).not.toHaveBeenCalled();
  });
});

describe('engine failures map to correct status codes', () => {
  it.each([
    [404, 'This video is private, removed, age-restricted, or region-locked.'],
    [502, 'Could not fetch this video.'],
    [503, 'The extraction engine is not installed. Set YTDLP_PATH or install yt-dlp.'],
    [504, 'This link took too long to process.'],
    [429, 'The download service is busy. Please try again shortly.'],
  ])('passes through an EngineError as %i with its own message', async (status, message) => {
    extractMock.mockRejectedValue(new EngineError(message, status));
    const res = await post({ url: YT, platform: 'youtube' });
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: message });
  });

  it('converts an unexpected error into a generic 500 and leaks nothing', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const secret = 'GROQ_API_KEY=gsk_live_abcdef at /Users/deploy/app/src/lib/engine.ts:214';
    extractMock.mockRejectedValue(new Error(secret));

    const res = await post({ url: YT, platform: 'youtube' });
    const body = await res.text();

    expect(res.status).toBe(500);
    expect(JSON.parse(body)).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(body).not.toContain('gsk_live');
    expect(body).not.toContain('/Users/deploy');

    // The log line must not carry the secret either.
    expect(JSON.stringify(consoleSpy.mock.calls)).not.toContain('gsk_live');
    expect(consoleSpy).toHaveBeenCalledWith('extract_failed', { platform: 'youtube', reason: 'Error' });
  });

  it('a thrown non-Error value still produces a clean 500, not an unhandled rejection', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    extractMock.mockRejectedValue('bare string failure');
    const res = await post({ url: YT, platform: 'youtube' });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Something went wrong. Please try again.' });
  });
});

describe('rate limiting', () => {
  it('returns 429 after the 20-request budget is spent', async () => {
    const ip = freshIp();
    for (let i = 0; i < 20; i++) {
      expect((await post({ url: YT, platform: 'youtube' }, ip)).status).toBe(200);
    }
    const blocked = await post({ url: YT, platform: 'youtube' }, ip);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: 'Too many requests. Please wait a moment and try again.' });
  });

  it('runs BEFORE body parsing — a rate-limited client gets 429, not 400, for a junk body', async () => {
    const ip = freshIp();
    for (let i = 0; i < 21; i++) await post({ url: YT, platform: 'youtube' }, ip);
    const res = await post(null, ip, 'not json at all');
    expect(res.status).toBe(429);
  });

  it('limits per client IP, so one abuser does not block everyone else', async () => {
    const abuser = freshIp();
    for (let i = 0; i < 21; i++) await post({ url: YT, platform: 'youtube' }, abuser);
    expect((await post({ url: YT, platform: 'youtube' }, abuser)).status).toBe(429);
    expect((await post({ url: YT, platform: 'youtube' }, freshIp())).status).toBe(200);
  });

  it('cannot be evaded by spoofing extra X-Forwarded-For hops', async () => {
    const realIp = `198.51.100.${++ipCounter}`;
    const send = (spoofed: string) =>
      POST(
        new Request('http://localhost/api/extract', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-forwarded-for': `${spoofed}, ${realIp}` },
          body: JSON.stringify({ url: YT, platform: 'youtube' }),
        }),
      );
    for (let i = 0; i < 20; i++) await send(`10.0.0.${i}`);
    expect((await send('10.0.0.99')).status).toBe(429);
  });
});

describe('method handling', () => {
  it('answers GET with 405 rather than leaking a framework error page', async () => {
    const res = GET();
    expect(res.status).toBe(405);
    expect(await res.json()).toEqual({ error: 'Method not allowed.' });
  });
});
