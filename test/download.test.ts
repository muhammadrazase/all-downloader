import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildDownloadHref, triggerLocalDownload } from '@/lib/download';

/**
 * Regression test for the "download.json" bug: a failed /api/download call
 * (age-restricted, region-locked, an extraction error) returns a JSON error
 * body, and a plain `<a download>` link used to save that JSON as a mystery
 * file instead of surfacing the error. triggerLocalDownload must catch that
 * before any file gets saved.
 */

function fakeResponse(opts: { ok: boolean; json: unknown; headers?: Record<string, string> }): Response {
  return {
    ok: opts.ok,
    json: async () => opts.json,
    blob: async () => new Blob(['fake video bytes']),
    body: { cancel: vi.fn() },
    headers: { get: (name: string) => opts.headers?.[name.toLowerCase()] ?? null },
  } as unknown as Response;
}

describe('buildDownloadHref', () => {
  it('uses the direct CDN url when the option already has one (API mode)', () => {
    const href = buildDownloadHref('https://example.com/v', 'youtube', { quality: '720', label: '720p', kind: 'video', url: 'https://cdn.example.com/v.mp4' });
    expect(href).toBe('https://cdn.example.com/v.mp4');
  });

  it('routes through /api/download when no direct url exists (local mode)', () => {
    const href = buildDownloadHref('https://youtube.com/watch?v=abc', 'youtube', { quality: '720', label: '720p', kind: 'video' });
    expect(href).toBe(`/api/download?u=${encodeURIComponent('https://youtube.com/watch?v=abc')}&p=youtube&q=720`);
  });
});

describe('triggerLocalDownload', () => {
  const createElementSpy = vi.fn();

  beforeEach(() => {
    createElementSpy.mockReset();
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        const el = { tagName: tag, click: vi.fn(), remove: vi.fn() };
        createElementSpy(el);
        return el;
      },
      body: { appendChild: vi.fn() },
    });
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() });
    vi.stubGlobal('window', { location: { href: '' } });
  });

  it('returns ok and never touches the DOM when the response is a JSON error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse({ ok: false, json: { error: 'This video is age-restricted.' } })));
    const outcome = await triggerLocalDownload('/api/download?u=x&p=youtube&q=2160');
    expect(outcome).toEqual({ ok: false, error: 'This video is age-restricted.' });
    expect(createElementSpy).not.toHaveBeenCalled();
  });

  it('falls back to a generic message when the error body is not valid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        json: async () => {
          throw new Error('not json');
        },
      }) as unknown as Response),
    );
    const outcome = await triggerLocalDownload('/api/download?u=x&p=youtube&q=2160');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toMatch(/could not prepare/i);
  });

  it('triggers a real file save and returns ok on a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        fakeResponse({
          ok: true,
          json: {},
          headers: { 'content-disposition': `attachment; filename="My Video.mp4"` },
        }),
      ),
    );
    const outcome = await triggerLocalDownload('/api/download?u=x&p=youtube&q=720');
    expect(outcome).toEqual({ ok: true });
    expect(createElementSpy).toHaveBeenCalledTimes(1);
    const el = createElementSpy.mock.calls[0]![0];
    expect(el.download).toBe('My Video.mp4');
  });

  it('uses the default fallback filename when there is no content-disposition header', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse({ ok: true, json: {} })));
    await triggerLocalDownload('/api/download?u=x&p=youtube&q=720');
    const el = createElementSpy.mock.calls[0]![0];
    expect(el.download).toBe('video.mp4');
  });

  it('honors an explicit fallback filename override', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse({ ok: true, json: {} })));
    await triggerLocalDownload('/api/download?u=x&p=youtube&q=720', 'fallback.mp4');
    const el = createElementSpy.mock.calls[0]![0];
    expect(el.download).toBe('fallback.mp4');
  });

  // Regression: a title containing an unescaped '%' (e.g. "100% Free Tutorial")
  // used to make decodeURIComponent throw on the plain filename= param,
  // turning a fully successful download into a false "network error".
  it('does not fail when the plain filename= param contains a literal percent sign', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        fakeResponse({
          ok: true,
          json: {},
          headers: { 'content-disposition': `attachment; filename="100% Free Tutorial.mp4"` },
        }),
      ),
    );
    const outcome = await triggerLocalDownload('/api/download?u=x&p=youtube&q=720');
    expect(outcome).toEqual({ ok: true });
    const el = createElementSpy.mock.calls[0]![0];
    expect(el.download).toBe('100% Free Tutorial.mp4');
  });

  it('prefers the percent-encoded UTF-8 filename* param over the plain one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        fakeResponse({
          ok: true,
          json: {},
          headers: { 'content-disposition': `attachment; filename="fallback.mp4"; filename*=UTF-8''%E2%9C%93%20Video.mp4` },
        }),
      ),
    );
    await triggerLocalDownload('/api/download?u=x&p=youtube&q=720');
    const el = createElementSpy.mock.calls[0]![0];
    expect(el.download).toBe('✓ Video.mp4');
  });

  // Regression: buffering every download via res.blob() risks the tab's memory
  // for a large merge (MAX_DOWNLOAD_MB defaults to 1500) — above the buffering
  // threshold this must hand off to a real browser-streamed navigation instead.
  it('streams large files via navigation instead of buffering them into memory', async () => {
    const cancel = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({}),
        blob: vi.fn(async () => new Blob(['should not be called'])),
        body: { cancel },
        headers: { get: (name: string) => (name.toLowerCase() === 'content-length' ? String(200 * 1024 * 1024) : null) },
      }) as unknown as Response),
    );
    const outcome = await triggerLocalDownload('/api/download?u=x&p=youtube&q=2160');
    expect(outcome).toEqual({ ok: true });
    expect(cancel).toHaveBeenCalled();
    expect(createElementSpy).not.toHaveBeenCalled();
    expect((window as unknown as { location: { href: string } }).location.href).toBe('/api/download?u=x&p=youtube&q=2160');
  });

  it('returns a network-error outcome when fetch itself throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    const outcome = await triggerLocalDownload('/api/download?u=x&p=youtube&q=720');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toMatch(/network error/i);
  });
});
