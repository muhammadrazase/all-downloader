import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';

/**
 * Contract tests for the two AI routes. The pipeline is mocked at the boundary,
 * so these assert the guard order the routes are responsible for:
 * rate-limit → size → Zod → SSRF/host whitelist → feature gate → typed errors.
 */

vi.mock('@/lib/aiPipeline', () => ({ transcribeUrl: vi.fn(), summarizeUrl: vi.fn() }));

type Tool = 'transcript' | 'summary';
type PipelineMock = MockInstance<(...args: unknown[]) => Promise<unknown>>;

interface LoadedRoute {
  post: (req: Request) => Promise<Response>;
  get: () => Response;
  pipeline: PipelineMock;
  AiError: typeof import('@/lib/ai').AiError;
}

const VALID_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const GROQ_KEY = 'gsk_test_groq_key_DO_NOT_LEAK';

let ipCounter = 0;
const freshIp = () => `198.51.100.${ipCounter++ % 250}-${ipCounter}`;

/**
 * Keys are read at module load, and resetModules also gives each case a fresh
 * in-memory rate-limit bucket — so AiError must come from this same reload to
 * stay `instanceof` the class the route checks against.
 */
async function loadRoute(tool: Tool, keys: { groq?: string; gemini?: string } = {}): Promise<LoadedRoute> {
  vi.resetModules();
  vi.stubEnv('GROQ_API_KEY', keys.groq ?? '');
  vi.stubEnv('GEMINI_API_KEY', keys.gemini ?? '');
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');

  const pipeline = await import('@/lib/aiPipeline');
  const ai = await import('@/lib/ai');
  const mod =
    tool === 'transcript'
      ? await import('@/app/api/ai/transcribe/route')
      : await import('@/app/api/ai/summary/route');
  const fn = tool === 'transcript' ? pipeline.transcribeUrl : pipeline.summarizeUrl;

  return { post: mod.POST, get: mod.GET, pipeline: vi.mocked(fn) as unknown as PipelineMock, AiError: ai.AiError };
}

interface PostOptions {
  ip?: string;
  headers?: Record<string, string>;
  rawBody?: string;
}

function post(tool: Tool, body: unknown, opts: PostOptions = {}): Request {
  const path = tool === 'transcript' ? 'transcribe' : 'summary';
  return new Request(`https://snapvidly.com/api/ai/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': opts.ip ?? freshIp(), ...opts.headers },
    body: opts.rawBody ?? JSON.stringify(body),
  });
}

async function bodyOf(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

// vi.resetModules() hands back the SAME mock functions, so call history has to
// be cleared explicitly or it leaks between cases.
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const TOOLS: { tool: Tool; label: string }[] = [
  { tool: 'transcript', label: '/api/ai/transcribe' },
  { tool: 'summary', label: '/api/ai/summary' },
];

describe.each(TOOLS)('$label', ({ tool }) => {
  describe('method + body validation', () => {
    it('rejects GET with 405', async () => {
      const { get } = await loadRoute(tool);
      expect(get().status).toBe(405);
    });

    it('rejects a malformed JSON body with 400 and a generic message', async () => {
      const { post: handler, pipeline } = await loadRoute(tool, { groq: GROQ_KEY });
      const res = await handler(post(tool, null, { rawBody: '{not json' }));
      expect(res.status).toBe(400);
      expect(await bodyOf(res)).toEqual({ error: 'Invalid request.' });
      expect(pipeline).not.toHaveBeenCalled();
    });

    it('rejects an empty body with 400', async () => {
      const { post: handler } = await loadRoute(tool, { groq: GROQ_KEY });
      expect((await handler(post(tool, null, { rawBody: '' }))).status).toBe(400);
    });

    it('rejects a missing url with 400', async () => {
      const { post: handler, pipeline } = await loadRoute(tool, { groq: GROQ_KEY });
      const res = await handler(post(tool, {}));
      expect(res.status).toBe(400);
      expect(pipeline).not.toHaveBeenCalled();
    });

    it.each([
      ['empty string', ''],
      ['whitespace only', '   '],
      ['not a URL', 'just some text'],
      ['non-http scheme', 'javascript:alert(1)'],
      ['file scheme', 'file:///etc/passwd'],
    ])('rejects %s with 400', async (_label, url) => {
      const { post: handler, pipeline } = await loadRoute(tool, { groq: GROQ_KEY });
      const res = await handler(post(tool, { url }));
      expect(res.status).toBe(400);
      expect(pipeline).not.toHaveBeenCalled();
    });

    it('rejects a url longer than the 2048-character cap with 400', async () => {
      const { post: handler } = await loadRoute(tool, { groq: GROQ_KEY });
      const long = `https://www.youtube.com/watch?v=${'a'.repeat(2100)}`;
      expect((await handler(post(tool, { url: long }))).status).toBe(400);
    });

    it('rejects a non-string url with 400 rather than coercing it', async () => {
      const { post: handler } = await loadRoute(tool, { groq: GROQ_KEY });
      expect((await handler(post(tool, { url: { href: VALID_URL } }))).status).toBe(400);
    });

    it('trims surrounding whitespace on an otherwise valid link', async () => {
      const { post: handler, pipeline } = await loadRoute(tool, { groq: GROQ_KEY });
      pipeline.mockResolvedValue({ ok: true });
      await handler(post(tool, { url: `  ${VALID_URL}  ` }));
      expect(pipeline).toHaveBeenCalledWith(VALID_URL, 'youtube', ...(tool === 'transcript' ? ['transcribe'] : []));
    });

    it('rejects an oversized body that declares its size', async () => {
      const { post: handler } = await loadRoute(tool, { groq: GROQ_KEY });
      const res = await handler(post(tool, { url: VALID_URL }, { headers: { 'content-length': '900000' } }));
      expect(res.status).toBe(413);
    });

    it('rejects an oversized body that hides its size (no Content-Length)', async () => {
      // Content-Length is absent on a chunked request, so the header check alone
      // would let an unbounded body through to JSON.parse.
      const { post: handler, pipeline } = await loadRoute(tool, { groq: GROQ_KEY });
      const padded = JSON.stringify({ url: VALID_URL, padding: 'A'.repeat(200_000) });
      const req = post(tool, null, { rawBody: padded });
      expect(req.headers.get('content-length')).toBeNull();
      const res = await handler(req);
      expect(res.status).toBe(413);
      expect(pipeline).not.toHaveBeenCalled();
    });

    it('accepts a body just under the cap', async () => {
      const { post: handler, pipeline } = await loadRoute(tool, { groq: GROQ_KEY });
      pipeline.mockResolvedValue({ ok: true });
      const padded = JSON.stringify({ url: VALID_URL, note: 'A'.repeat(8_000 - VALID_URL.length - 60) });
      const res = await handler(post(tool, null, { rawBody: padded }));
      expect(res.status).toBe(200);
    });
  });

  describe('host whitelist / SSRF', () => {
    it.each([
      ['an unsupported public host', 'https://example.com/video/123'],
      ['loopback by IP', 'http://127.0.0.1:3000/watch?v=x'],
      ['localhost by name', 'http://localhost:8080/watch?v=x'],
      ['a private LAN address', 'http://192.168.1.10/video.mp4'],
      ['the cloud metadata endpoint', 'http://169.254.169.254/latest/meta-data/'],
      ['a lookalike subdomain', 'https://www.youtube.com.evil.example/watch?v=x'],
      ['a credentials-prefixed host', 'https://www.youtube.com@127.0.0.1/watch?v=x'],
      ['an open-redirect style query', 'https://evil.example/?next=https://www.youtube.com/watch?v=x'],
    ])('rejects %s with 400 and never reaches the pipeline', async (_label, url) => {
      const { post: handler, pipeline } = await loadRoute(tool, { groq: GROQ_KEY });
      const res = await handler(post(tool, { url }));
      expect(res.status).toBe(400);
      expect(pipeline).not.toHaveBeenCalled();
    });

    it('answers a hostile link with 400, not the 503 feature gate, even when AI is unconfigured', async () => {
      // Bad input must be diagnosed as bad input regardless of server config.
      const { post: handler } = await loadRoute(tool);
      expect((await handler(post(tool, { url: 'http://127.0.0.1/watch?v=x' }))).status).toBe(400);
    });

    it('accepts a supported host and forwards the detected platform', async () => {
      const { post: handler, pipeline } = await loadRoute(tool, { groq: GROQ_KEY });
      pipeline.mockResolvedValue({ ok: true });
      await handler(post(tool, { url: 'https://www.tiktok.com/@user/video/123456' }));
      expect(pipeline).toHaveBeenCalledWith('https://www.tiktok.com/@user/video/123456', 'tiktok', ...(tool === 'transcript' ? ['transcribe'] : []));
    });
  });

  describe('feature gate', () => {
    it('returns 503 with code not_configured when no provider key is set', async () => {
      const { post: handler, pipeline } = await loadRoute(tool);
      const res = await handler(post(tool, { url: VALID_URL }));
      expect(res.status).toBe(503);
      expect(await bodyOf(res)).toMatchObject({ code: 'not_configured' });
      expect(pipeline).not.toHaveBeenCalled();
    });

    it('proceeds when only a Gemini key is set (either provider enables the feature)', async () => {
      const { post: handler, pipeline } = await loadRoute(tool, { gemini: 'AIza_test' });
      pipeline.mockResolvedValue({ ok: true });
      expect((await handler(post(tool, { url: VALID_URL }))).status).toBe(200);
    });
  });

  describe('success path', () => {
    it('returns the pipeline result with no-store caching', async () => {
      const { post: handler, pipeline } = await loadRoute(tool, { groq: GROQ_KEY });
      const payload =
        tool === 'transcript'
          ? { text: 'hello', srt: '1\n', vtt: 'WEBVTT\n', language: 'en', provider: 'groq' }
          : { summary: 'An overview.', points: ['a', 'b'], provider: 'groq' };
      pipeline.mockResolvedValue(payload);

      const res = await handler(post(tool, { url: VALID_URL }));
      expect(res.status).toBe(200);
      expect(await bodyOf(res)).toEqual(payload);
      expect(res.headers.get('cache-control')).toBe('no-store');
    });
  });

  describe('typed error mapping', () => {
    it.each([
      ['provider_failed', 502],
      ['too_long', 413],
      ['empty', 422],
      ['not_configured', 503],
    ] as const)('maps AiError %s to HTTP %i with its code intact', async (code, status) => {
      const { post: handler, pipeline, AiError } = await loadRoute(tool, { groq: GROQ_KEY });
      pipeline.mockRejectedValue(new AiError(code, 'A friendly, user-facing message.', status));

      const res = await handler(post(tool, { url: VALID_URL }));
      expect(res.status).toBe(status);
      expect(await bodyOf(res)).toEqual({ error: 'A friendly, user-facing message.', code });
    });

    it('turns an untyped crash into a generic 500 that leaks nothing', async () => {
      const { post: handler, pipeline } = await loadRoute(tool, { groq: GROQ_KEY });
      const secret = `boom at /srv/app/src/lib/engine.ts with key ${GROQ_KEY}`;
      pipeline.mockRejectedValue(new Error(secret));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = await handler(post(tool, { url: VALID_URL }));
      const raw = JSON.stringify(await bodyOf(res));
      expect(res.status).toBe(500);
      expect(raw).toBe('{"error":"Something went wrong. Please try again."}');
      expect(raw).not.toContain(GROQ_KEY);
      expect(raw).not.toContain('/srv/app');

      const logged = JSON.stringify(errorSpy.mock.calls);
      expect(logged).not.toContain(GROQ_KEY);
      expect(logged).not.toContain('/srv/app');
      errorSpy.mockRestore();
    });

    it('always answers a failure with a non-empty error string the UI can render', async () => {
      // AiToolBox branches on `error` (and `code === "not_configured"`); a body
      // without `error` would surface a blank panel.
      const { post: handler, pipeline, AiError } = await loadRoute(tool, { groq: GROQ_KEY });
      pipeline.mockRejectedValue(new AiError('provider_failed', 'The AI service is busy. Please try again shortly.', 502));
      const res = await handler(post(tool, { url: VALID_URL }));
      const body = await bodyOf(res);
      expect(typeof body.error).toBe('string');
      expect(String(body.error).length).toBeGreaterThan(0);
    });
  });
});

describe('/api/ai/transcribe mode handling', () => {
  it('defaults to transcribe when no mode is given', async () => {
    const { post: handler, pipeline } = await loadRoute('transcript', { groq: GROQ_KEY });
    pipeline.mockResolvedValue({ ok: true });
    await handler(post('transcript', { url: VALID_URL }));
    expect(pipeline).toHaveBeenCalledWith(VALID_URL, 'youtube', 'transcribe');
  });

  it('forwards translate mode', async () => {
    const { post: handler, pipeline } = await loadRoute('transcript', { groq: GROQ_KEY });
    pipeline.mockResolvedValue({ ok: true });
    await handler(post('transcript', { url: VALID_URL, mode: 'translate' }));
    expect(pipeline).toHaveBeenCalledWith(VALID_URL, 'youtube', 'translate');
  });

  it('rejects an unknown mode with 400 instead of silently defaulting', async () => {
    const { post: handler, pipeline } = await loadRoute('transcript', { groq: GROQ_KEY });
    const res = await handler(post('transcript', { url: VALID_URL, mode: 'summarise-everything' }));
    expect(res.status).toBe(400);
    expect(pipeline).not.toHaveBeenCalled();
  });
});

describe('AI rate limiting', () => {
  it('uses the strict AI bucket (6/min), not the default 20/min bucket', async () => {
    const { post: handler, pipeline } = await loadRoute('transcript', { groq: GROQ_KEY });
    pipeline.mockResolvedValue({ ok: true });
    const ip = freshIp();

    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) {
      statuses.push((await handler(post('transcript', { url: VALID_URL }, { ip }))).status);
    }
    expect(statuses.slice(0, 6)).toEqual([200, 200, 200, 200, 200, 200]);
    expect(statuses.slice(6)).toEqual([429, 429]);
  });

  it('calls checkAiRateLimit and never the default limiter', async () => {
    vi.resetModules();
    const checkAiRateLimit = vi.fn(async () => ({ success: true }));
    const checkRateLimit = vi.fn(async () => ({ success: true }));
    vi.doMock('@/lib/rateLimit', () => ({ checkAiRateLimit, checkRateLimit, rateLimitConfigured: () => true }));

    const summary = await import('@/app/api/ai/summary/route');
    const transcribe = await import('@/app/api/ai/transcribe/route');
    await summary.POST(post('summary', { url: VALID_URL }));
    await transcribe.POST(post('transcript', { url: VALID_URL }));

    expect(checkAiRateLimit).toHaveBeenCalledTimes(2);
    expect(checkRateLimit).not.toHaveBeenCalled();
    vi.doUnmock('@/lib/rateLimit');
  });

  it('limits per client IP — one abuser does not lock out everyone else', async () => {
    const { post: handler, pipeline } = await loadRoute('summary', { groq: GROQ_KEY });
    pipeline.mockResolvedValue({ ok: true });
    const abuser = freshIp();
    for (let i = 0; i < 7; i++) await handler(post('summary', { url: VALID_URL }, { ip: abuser }));

    expect((await handler(post('summary', { url: VALID_URL }, { ip: abuser }))).status).toBe(429);
    expect((await handler(post('summary', { url: VALID_URL }, { ip: freshIp() }))).status).toBe(200);
  });

  it('cannot be bypassed by spoofing extra X-Forwarded-For entries', async () => {
    // nginx appends the real IP on the right; only the rightmost entry is trusted.
    const { post: handler, pipeline } = await loadRoute('transcript', { groq: GROQ_KEY });
    pipeline.mockResolvedValue({ ok: true });
    const real = '203.0.113.77';

    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) {
      const req = new Request('https://snapvidly.com/api/ai/transcribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${i}, ${real}` },
        body: JSON.stringify({ url: VALID_URL }),
      });
      statuses.push((await handler(req)).status);
    }
    expect(statuses.filter((s) => s === 429)).toHaveLength(2);
  });

  it('rate-limits before doing any work — a valid request is refused once the bucket is empty', async () => {
    const { post: handler, pipeline } = await loadRoute('transcript', { groq: GROQ_KEY });
    pipeline.mockResolvedValue({ ok: true });
    const ip = freshIp();
    for (let i = 0; i < 6; i++) await handler(post('transcript', { url: VALID_URL }, { ip }));
    pipeline.mockClear();

    const res = await handler(post('transcript', { url: VALID_URL }, { ip }));
    expect(res.status).toBe(429);
    expect(await bodyOf(res)).toEqual({ error: 'Too many requests. Please wait a moment and try again.' });
    expect(pipeline).not.toHaveBeenCalled();
  });
});
