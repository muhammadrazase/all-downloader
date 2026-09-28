import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Readable } from 'node:stream';
import { EngineError } from '@/lib/engine-error';
import type { PreparedDownload } from '@/lib/engine';

/** Integration tests for GET /api/download — the only route that can stream bytes. */

const prepareMock = vi.fn<(url: string, quality: string, platform: string) => Promise<PreparedDownload>>();

vi.mock('@/lib/engine', async () => {
  const { EngineError: RealEngineError } = await import('@/lib/engine-error');
  return {
    EngineError: RealEngineError,
    extract: vi.fn(),
    prepareDownload: (url: string, quality: string, platform: string) => prepareMock(url, quality, platform),
  };
});

const { GET } = await import('@/app/api/download/route');

const YT = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

let ipCounter = 0;
const freshIp = () => `203.0.113.${++ipCounter}`;

function download(
  params: Record<string, string>,
  ip = freshIp(),
): Promise<Response> {
  const qs = new URLSearchParams(params).toString();
  return GET(new Request(`http://localhost/api/download?${qs}`, { headers: { 'x-real-ip': ip } }));
}

function preparedFile(filename: string, body = 'fake-mp4-bytes'): PreparedDownload {
  return {
    stream: Readable.from([Buffer.from(body)]),
    filename,
    contentType: 'video/mp4',
    size: body.length,
    cleanup: () => {},
  };
}

beforeEach(() => {
  prepareMock.mockReset();
  // A fresh stream per call — one Readable cannot be consumed by several responses.
  prepareMock.mockImplementation(async () => preparedFile('Never Gonna Give You Up.mp4'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('happy path', () => {
  it('streams the prepared file with the right headers and body', async () => {
    const res = await download({ u: YT, p: 'youtube', q: '1080' });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('video/mp4');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Content-Length')).toBe('14');
    expect(await res.text()).toBe('fake-mp4-bytes');
  });

  it('forwards exactly the validated url, quality and platform to the engine', async () => {
    await download({ u: YT, p: 'youtube', q: '720' });
    expect(prepareMock).toHaveBeenCalledExactlyOnceWith(YT, '720', 'youtube');
  });

  it.each(['audio', '360', '480', '720', '1080', '1440', '2160'])('accepts the supported quality %s', async (q) => {
    const res = await download({ u: YT, p: 'youtube', q });
    expect(res.status).toBe(200);
  });

  it('omits Content-Length when the engine does not know the size', async () => {
    prepareMock.mockResolvedValue({ ...preparedFile('x.mp4'), size: undefined });
    const res = await download({ u: YT, p: 'youtube', q: '720' });
    expect(res.headers.get('Content-Length')).toBeNull();
  });
});

describe('parameter validation (400s) — the engine must never be reached', () => {
  it.each([
    ['unknown platform', { u: YT, p: 'snapchat', q: '720' }, 'Unsupported platform.'],
    ['missing platform', { u: YT, q: '720' }, 'Unsupported platform.'],
    ['prototype key as platform', { u: YT, p: '__proto__', q: '720' }, 'Unsupported platform.'],
    ['constructor as platform', { u: YT, p: 'constructor', q: '720' }, 'Unsupported platform.'],
    ['toString as platform', { u: YT, p: 'toString', q: '720' }, 'Unsupported platform.'],
  ])('refuses %s', async (_label, params, error) => {
    const res = await download(params);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
    expect(prepareMock).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', ''],
    ['unsupported tier', '4320'],
    ['near-miss tier', '1081'],
    ['path traversal', '../../etc/passwd'],
    ['command injection', '720; rm -rf /'],
    ['flag injection', '--exec=id'],
    ['newline-padded', '720\n'],
    ['whitespace-padded', ' 720'],
    ['leading zero', '0720'],
    ['audio casing', 'AUDIO'],
    ['regex wildcard', '.*'],
  ])('refuses the %s quality value', async (_label, q) => {
    const res = await download({ u: YT, p: 'youtube', q });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid quality.' });
    expect(prepareMock).not.toHaveBeenCalled();
  });

  it('rejects an overlong URL with 413 — this route never runs the Zod 2048 cap', async () => {
    const res = await download({ u: `${YT}&pad=${'a'.repeat(2500)}`, p: 'youtube', q: '720' });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'That link is too long.' });
    expect(prepareMock).not.toHaveBeenCalled();
  });

  it('accepts a URL at exactly the 2048-char ceiling', async () => {
    const url = YT + '&pad=' + 'a'.repeat(2048 - YT.length - 5);
    expect(url).toHaveLength(2048);
    const res = await download({ u: url, p: 'youtube', q: '720' });
    expect(res.status).toBe(200);
  });

  it('rejects a URL one character over the ceiling', async () => {
    const url = YT + '&pad=' + 'a'.repeat(2049 - YT.length - 5);
    expect(url).toHaveLength(2049);
    expect((await download({ u: url, p: 'youtube', q: '720' })).status).toBe(413);
  });

  it('validates platform and quality BEFORE the URL, so a bad platform never reveals URL detail', async () => {
    const res = await download({ u: 'http://169.254.169.254/', p: 'snapchat', q: '720' });
    expect(await res.json()).toEqual({ error: 'Unsupported platform.' });
  });
});

describe('SSRF / host whitelist (400s)', () => {
  it.each([
    ['internal metadata IP', 'http://169.254.169.254/latest/meta-data/', 'Internal addresses are not allowed.'],
    ['loopback with port', 'http://127.0.0.1:6379/', 'Internal addresses are not allowed.'],
    ['private LAN', 'http://10.0.0.1/', 'Internal addresses are not allowed.'],
    ['lookalike host', 'https://www.youtube.com.evil.com/watch?v=1', 'That does not look like a valid YouTube link.'],
    ['foreign platform', 'https://vimeo.com/123', 'That does not look like a valid YouTube link.'],
    ['file scheme', 'file:///etc/passwd', 'Only http(s) links are supported.'],
    ['empty url', '', 'Malformed URL.'],
  ])('refuses %s', async (_label, url, error) => {
    const res = await download({ u: url, p: 'youtube', q: '720' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
    expect(prepareMock).not.toHaveBeenCalled();
  });

  it('refuses the historical Pinterest SSRF bypass on the download route too', async () => {
    const res = await download({ u: 'https://pinterest.169.254.169.254.nip.io/pin/1/', p: 'pinterest', q: '720' });
    expect(res.status).toBe(400);
    expect(prepareMock).not.toHaveBeenCalled();
  });
});

describe('Content-Disposition safety', () => {
  const dispositionFor = async (filename: string): Promise<string> => {
    prepareMock.mockResolvedValue(preparedFile(filename));
    const res = await download({ u: YT, p: 'youtube', q: '720' });
    return res.headers.get('Content-Disposition') ?? '';
  };

  it('neutralizes quotes and backslashes that would break out of the filename', async () => {
    const cd = await dispositionFor('evil".mp4');
    expect(cd).toContain('filename="evil_.mp4"');
  });

  it('contains no CR or LF, so a crafted title cannot inject a response header', async () => {
    // The literal text "Set-Cookie" survives as filename characters — harmless.
    // What matters is that the CRLFs that would terminate the header are gone.
    const cd = await dispositionFor('title\r\nSet-Cookie: admin=1\r\n\r\n.mp4');
    expect(cd).not.toMatch(/[\r\n]/);
    expect(cd).toContain('filename="title__Set-Cookie: admin=1____.mp4"');
  });

  it('a crafted title does not become a real extra response header', async () => {
    prepareMock.mockResolvedValue(preparedFile('x\r\nSet-Cookie: admin=1\r\n\r\n.mp4'));
    const res = await download({ u: YT, p: 'youtube', q: '720' });
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('replaces non-ASCII characters in the fallback but preserves them in the RFC 5987 form', async () => {
    const cd = await dispositionFor('Björk — 日本語.mp4');
    const ascii = /filename="([^"]*)"/.exec(cd)?.[1] ?? '';
    // eslint-disable-next-line no-control-regex
    expect(ascii).toMatch(/^[\x20-\x7E]*$/);
    expect(cd).toContain(`filename*=UTF-8''${encodeURIComponent('Björk — 日本語.mp4')}`);
  });

  it('survives a very long title without producing an invalid header', async () => {
    const cd = await dispositionFor(`${'a'.repeat(500)}.mp4`);
    expect(cd).not.toMatch(/[\r\n]/);
    expect(cd.startsWith('attachment;')).toBe(true);
  });

  it('handles an emoji-only filename without emitting an empty or broken header', async () => {
    const cd = await dispositionFor('🎬🔥.mp4');
    expect(cd).toContain('attachment; filename="');
    expect(cd).toContain("filename*=UTF-8''");
  });
});

describe('engine failures', () => {
  it.each([
    [404, 'This video is private, removed, age-restricted, or region-locked.'],
    [502, 'Could not fetch this video.'],
    [503, 'The server is busy preparing other downloads. Please try again in a moment.'],
    [504, 'This download took too long.'],
  ])('maps an EngineError to %i with its own message', async (status, message) => {
    prepareMock.mockRejectedValue(new EngineError(message, status));
    const res = await download({ u: YT, p: 'youtube', q: '720' });
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: message });
  });

  it('converts an unexpected error into a generic 500 that leaks no internals', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    prepareMock.mockRejectedValue(new Error('ENOENT /Users/deploy/.config/yt-dlp/cookies.txt'));

    const res = await download({ u: YT, p: 'youtube', q: '720' });
    const body = await res.text();

    expect(res.status).toBe(500);
    expect(JSON.parse(body)).toEqual({ error: 'Something went wrong preparing your download.' });
    expect(body).not.toContain('cookies.txt');
    expect(JSON.stringify(consoleSpy.mock.calls)).not.toContain('cookies.txt');
  });
});

describe('rate limiting', () => {
  it('returns 429 after the 20-request budget is spent', async () => {
    const ip = freshIp();
    for (let i = 0; i < 20; i++) {
      expect((await download({ u: YT, p: 'youtube', q: '720' }, ip)).status).toBe(200);
    }
    const blocked = await download({ u: YT, p: 'youtube', q: '720' }, ip);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: 'Too many requests. Please wait a moment.' });
  });

  it('runs BEFORE parameter validation — a rate-limited client gets 429, not 400', async () => {
    const ip = freshIp();
    for (let i = 0; i < 21; i++) await download({ u: YT, p: 'youtube', q: '720' }, ip);
    const res = await download({ u: 'http://127.0.0.1/', p: 'nope', q: 'bad' }, ip);
    expect(res.status).toBe(429);
  });
});
