import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { PLATFORM_LIST, type PlatformKey } from '@/lib/platforms';

/**
 * Verifies the LOCAL yt-dlp backend without spawning it: `node:child_process` is
 * intercepted so every argv the engine would hand the binary is asserted directly.
 */

const spawnMock = vi.fn();
vi.mock('node:child_process', () => ({ spawn: (...args: unknown[]) => spawnMock(...args) }));

interface FakeChild extends EventEmitter {
  stdout: PassThrough;
  stderr: PassThrough;
  kill: (signal?: string) => void;
}

function makeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  // The real SIGKILL makes the process close; the engine's timeout path depends on it.
  child.kill = () => setImmediate(() => child.emit('close', null));
  return child;
}

/** Resolve the next spawn with yt-dlp-style JSON on stdout and exit code 0. */
function respondJson(payload: Record<string, unknown>): void {
  spawnMock.mockImplementation(() => {
    const child = makeChild();
    setImmediate(() => {
      child.stdout.emit('data', Buffer.from(JSON.stringify(payload)));
      child.emit('close', 0);
    });
    return child;
  });
}

function respondFailure(stderr: string, code = 1): void {
  spawnMock.mockImplementation(() => {
    const child = makeChild();
    setImmediate(() => {
      child.stderr.emit('data', Buffer.from(stderr));
      child.emit('close', code);
    });
    return child;
  });
}

const H264_720 = { height: 720, vcodec: 'avc1.4d401f', acodec: 'mp4a.40.2' };

const CANONICAL: Record<PlatformKey, string> = {
  tiktok: 'https://www.tiktok.com/@nasa/video/7123456789012345678',
  instagram: 'https://www.instagram.com/reel/AbCdEfGhIjK/',
  youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  facebook: 'https://www.facebook.com/watch/?v=1234567890',
  linkedin: 'https://www.linkedin.com/posts/nasa_activity-1234567890-AbCd/',
  twitter: 'https://x.com/NASA/status/1234567890123456789',
  pinterest: 'https://www.pinterest.com/pin/1234567890/',
  reddit: 'https://www.reddit.com/r/videos/comments/abc123/some_title/',
  vimeo: 'https://vimeo.com/123456789',
  twitch: 'https://clips.twitch.tv/AbcClipNameHere',
  tumblr: 'https://someblog.tumblr.com/post/1234567890',
};

const lastArgv = (): string[] => spawnMock.mock.calls.at(-1)![1] as string[];
const lastOptions = (): Record<string, unknown> => spawnMock.mock.calls.at(-1)![2] as Record<string, unknown>;

beforeEach(() => {
  spawnMock.mockReset();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('yt-dlp invocation hardening (CLAUDE.md golden rule 5)', () => {
  it('spawns with an ARGS ARRAY and never enables a shell', async () => {
    respondJson({ title: 'x', formats: [H264_720] });
    const { extract } = await import('@/lib/engine');
    await extract(CANONICAL.youtube, 'youtube');

    expect(Array.isArray(lastArgv())).toBe(true);
    expect(lastOptions()).not.toHaveProperty('shell');
    expect(spawnMock.mock.calls[0]![0]).toBe('yt-dlp');
  });

  it.each(PLATFORM_LIST.map((p) => [p.key, CANONICAL[p.key]] as const))(
    'restricts %s to its own extractor family, closing the generic-extractor SSRF path',
    async (key, url) => {
      respondJson({ title: 'x', formats: [H264_720] });
      const { extract } = await import('@/lib/engine');
      await extract(url, key);

      const argv = lastArgv();
      const idx = argv.indexOf('--use-extractors');
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(argv[idx + 1]).toBe(`${key}.*`);
    },
  );

  it('always passes --no-playlist so one link cannot become a bulk extraction', async () => {
    respondJson({ title: 'x', formats: [H264_720] });
    const { extract } = await import('@/lib/engine');
    await extract(CANONICAL.youtube, 'youtube');
    expect(lastArgv()).toContain('--no-playlist');
  });

  it('passes the URL as the final argv element so it can never be read as a flag', async () => {
    respondJson({ title: 'x', formats: [H264_720] });
    const { extract } = await import('@/lib/engine');
    await extract(CANONICAL.youtube, 'youtube');
    expect(lastArgv().at(-1)).toBe(CANONICAL.youtube);
  });

  it('passes a URL containing shell metacharacters as ONE opaque argv element', async () => {
    // Whitelisted host, hostile query string — proves nothing is interpolated.
    const hostile = 'https://www.youtube.com/watch?v=x&a=$(id)&b=`whoami`&c=;rm -rf /&d=|nc evil 1';
    respondJson({ title: 'x', formats: [H264_720] });
    const { extract } = await import('@/lib/engine');
    await extract(hostile, 'youtube');

    const argv = lastArgv();
    expect(argv.at(-1)).toBe(hostile);
    expect(argv.filter((a) => a.includes('rm -rf'))).toHaveLength(1);
  });

  it('does not leak cookie or proxy flags when those env vars are unset', async () => {
    respondJson({ title: 'x', formats: [H264_720] });
    const { extract } = await import('@/lib/engine');
    await extract(CANONICAL.youtube, 'youtube');
    expect(lastArgv()).not.toContain('--cookies');
    expect(lastArgv()).not.toContain('--proxy');
  });

  it('never writes the yt-dlp binary path into argv (it is the exec target, not an argument)', async () => {
    respondJson({ title: 'x', formats: [H264_720] });
    const { extract } = await import('@/lib/engine');
    await extract(CANONICAL.youtube, 'youtube');
    expect(lastArgv()).not.toContain('yt-dlp');
  });
});

describe('extract() — quality menu construction', () => {
  it('offers every tier at or below the source resolution, highest first, plus audio', async () => {
    respondJson({
      title: 'Big Buck Bunny',
      thumbnail: 'https://cdn.example.com/t.jpg',
      duration: 635,
      formats: [{ height: 1080, vcodec: 'avc1' }, { height: 720, vcodec: 'avc1' }, { acodec: 'mp4a' }],
    });
    const { extract } = await import('@/lib/engine');
    const result = await extract(CANONICAL.youtube, 'youtube');

    expect(result.options.map((o) => o.quality)).toEqual(['1080', '720', '480', '360', 'audio']);
    expect(result.options[0]).toMatchObject({ label: 'HD 1080p · MP4', kind: 'video' });
    expect(result.options.at(-1)).toMatchObject({ label: 'Audio · MP3', kind: 'audio' });
  });

  it('never offers a tier above the source resolution', async () => {
    respondJson({ title: 'x', formats: [{ height: 480, vcodec: 'avc1' }] });
    const { extract } = await import('@/lib/engine');
    const result = await extract(CANONICAL.youtube, 'youtube');
    expect(result.options.map((o) => o.quality)).toEqual(['480', '360', 'audio']);
  });

  it('offers 4K when the source has it', async () => {
    respondJson({ title: 'x', formats: [{ height: 2160, vcodec: 'avc1' }] });
    const { extract } = await import('@/lib/engine');
    const result = await extract(CANONICAL.youtube, 'youtube');
    expect(result.options[0]).toMatchObject({ quality: '2160', label: '4K · MP4' });
  });

  it('keeps a below-360p source usable by offering its exact height', async () => {
    respondJson({ title: 'x', formats: [{ height: 144, vcodec: 'avc1' }] });
    const { extract } = await import('@/lib/engine');
    const result = await extract(CANONICAL.youtube, 'youtube');
    expect(result.options.map((o) => o.quality)).toEqual(['144', 'audio']);
  });

  it('falls back to 720p when an extractor reports video with no height (the LinkedIn/HLS case)', async () => {
    respondJson({ title: 'x', formats: [{ video_ext: 'mp4', audio_ext: 'none' }] });
    const { extract } = await import('@/lib/engine');
    const result = await extract(CANONICAL.linkedin, 'linkedin');
    expect(result.options.map((o) => o.quality)).toEqual(['720', 'audio']);
  });

  it('returns an audio-only menu for a source with no video stream', async () => {
    respondJson({ title: 'x', formats: [{ acodec: 'mp4a', vcodec: 'none' }] });
    const { extract } = await import('@/lib/engine');
    const result = await extract(CANONICAL.youtube, 'youtube');
    expect(result.options.map((o) => o.quality)).toEqual(['audio']);
  });

  it('echoes the source URL back and defaults a missing title rather than emitting undefined', async () => {
    respondJson({ formats: [H264_720] });
    const { extract } = await import('@/lib/engine');
    const result = await extract(CANONICAL.tiktok, 'tiktok');
    expect(result).toMatchObject({ platform: 'tiktok', sourceUrl: CANONICAL.tiktok, title: 'video' });
    expect(result.thumbnail).toBeUndefined();
  });

  it('ignores a non-string thumbnail and non-numeric duration instead of forwarding junk to the UI', async () => {
    respondJson({ title: 'x', thumbnail: { url: 'x' }, duration: 'ten', formats: [H264_720] });
    const { extract } = await import('@/lib/engine');
    const result = await extract(CANONICAL.youtube, 'youtube');
    expect(result.thumbnail).toBeUndefined();
    expect(result.duration).toBeUndefined();
  });

  it('local-backend options carry NO direct url, so the client routes through /api/download', async () => {
    respondJson({ title: 'x', formats: [H264_720] });
    const { extract } = await import('@/lib/engine');
    const result = await extract(CANONICAL.youtube, 'youtube');
    expect(result.options.every((o) => o.url === undefined)).toBe(true);
  });
});

describe('extract() — typed failures, never a crash', () => {
  it('maps an empty format list to a 404 with a user-readable message', async () => {
    respondJson({ title: 'x', formats: [] });
    const { extract, EngineError } = await import('@/lib/engine');
    const promise = extract(CANONICAL.youtube, 'youtube');
    await expect(promise).rejects.toThrow(EngineError);
    await expect(promise).rejects.toMatchObject({
      status: 404,
      message: 'No downloadable video was found at that link.',
    });
  });

  it('maps a missing formats key (not just an empty array) to the same 404', async () => {
    respondJson({ title: 'x' });
    const { extract } = await import('@/lib/engine');
    await expect(extract(CANONICAL.youtube, 'youtube')).rejects.toMatchObject({ status: 404 });
  });

  it.each([
    'ERROR: [youtube] xyz: Private video. Sign in if you have been granted access.',
    'ERROR: [instagram] Requested content is not available, rather than removed',
    'ERROR: [youtube] Sign in to confirm your age',
    'ERROR: [tiktok] Video not available in your region',
  ])('classifies a private/removed/age-gated failure as 404 with the friendly message', async (stderr) => {
    respondFailure(stderr);
    const { extract } = await import('@/lib/engine');
    await expect(extract(CANONICAL.youtube, 'youtube')).rejects.toMatchObject({
      status: 404,
      message: 'This video is private, removed, age-restricted, or region-locked.',
    });
  });

  it('classifies an unrecognized extractor failure as 502 without echoing stderr', async () => {
    respondFailure('ERROR: Unsupported URL: https://pinterest.evil.com/x\nTraceback (most recent call last): /home/deploy/secret.py');
    const { extract } = await import('@/lib/engine');
    const promise = extract(CANONICAL.pinterest, 'pinterest');
    await expect(promise).rejects.toMatchObject({ status: 502, message: 'Could not fetch this video.' });
    await expect(promise).rejects.not.toMatchObject({ message: expect.stringContaining('Traceback') });
  });

  it('never leaks a filesystem path or stderr body in the error message', async () => {
    respondFailure('ERROR: /home/deploy/.config/yt-dlp/cookies.txt could not be read; token=SECRET123');
    const { extract } = await import('@/lib/engine');
    await expect(extract(CANONICAL.youtube, 'youtube')).rejects.toSatisfy(
      (e: Error) => !/home|cookies\.txt|SECRET123/.test(e.message),
    );
  });

  it('maps unparseable stdout to a 502 instead of throwing a raw SyntaxError', async () => {
    spawnMock.mockImplementation(() => {
      const child = makeChild();
      setImmediate(() => {
        child.stdout.emit('data', Buffer.from('<html>captcha</html>'));
        child.emit('close', 0);
      });
      return child;
    });
    const { extract, EngineError } = await import('@/lib/engine');
    const promise = extract(CANONICAL.youtube, 'youtube');
    await expect(promise).rejects.toThrow(EngineError);
    await expect(promise).rejects.toMatchObject({
      status: 502,
      message: 'The engine returned an unexpected response.',
    });
  });

  it('maps a missing yt-dlp binary to a 503 with actionable operator guidance', async () => {
    spawnMock.mockImplementation(() => {
      const child = makeChild();
      setImmediate(() => {
        const err: NodeJS.ErrnoException = new Error('spawn yt-dlp ENOENT');
        err.code = 'ENOENT';
        child.emit('error', err);
      });
      return child;
    });
    const { extract } = await import('@/lib/engine');
    await expect(extract(CANONICAL.youtube, 'youtube')).rejects.toMatchObject({
      status: 503,
      message: 'The extraction engine is not installed. Set YTDLP_PATH or install yt-dlp.',
    });
  });

  it('maps any other spawn failure to a 503 rather than a 500 crash', async () => {
    spawnMock.mockImplementation(() => {
      const child = makeChild();
      setImmediate(() => {
        const err: NodeJS.ErrnoException = new Error('spawn EACCES');
        err.code = 'EACCES';
        child.emit('error', err);
      });
      return child;
    });
    const { extract } = await import('@/lib/engine');
    await expect(extract(CANONICAL.youtube, 'youtube')).rejects.toMatchObject({ status: 503 });
  });

  it('kills a hung extraction at the 20s timeout and returns 504', async () => {
    vi.useFakeTimers();
    const killed = vi.fn();
    spawnMock.mockImplementation(() => {
      const child = makeChild();
      child.kill = (signal?: string) => {
        killed(signal);
        setImmediate(() => child.emit('close', null));
      };
      return child; // never closes on its own
    });
    const { extract } = await import('@/lib/engine');
    const promise = extract(CANONICAL.youtube, 'youtube');
    const assertion = expect(promise).rejects.toMatchObject({
      status: 504,
      message: 'This link took too long to process.',
    });
    await vi.advanceTimersByTimeAsync(20_001);
    await assertion;
    expect(killed).toHaveBeenCalledWith('SIGKILL');
  });
});

describe('backend selection precedence (RapidAPI → ENGINE_URL → local yt-dlp)', () => {
  it('RapidAPI wins when both RapidAPI and ENGINE_URL are configured', async () => {
    vi.stubEnv('RAPIDAPI_KEY', 'test-key');
    vi.stubEnv('RAPIDAPI_HOST', 'downloader.example.com');
    vi.stubEnv('ENGINE_URL', 'https://engine.example.com');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ title: 'Remote', medias: [{ url: 'https://cdn.example.com/v.mp4', quality: '1080p' }] }),
    );
    const { extract } = await import('@/lib/engine');
    const result = await extract(CANONICAL.youtube, 'youtube');

    expect(spawnMock).not.toHaveBeenCalled();
    expect(String(fetchSpy.mock.calls[0]![0])).toContain('downloader.example.com');
    expect(result.options[0]).toMatchObject({ quality: '1080', url: 'https://cdn.example.com/v.mp4' });
    fetchSpy.mockRestore();
  });

  it('ENGINE_URL wins over the local binary when RapidAPI is absent', async () => {
    vi.stubEnv('ENGINE_URL', 'https://engine.example.com');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ title: 'Remote', options: [{ quality: '720', label: 'HD 720p · MP4', kind: 'video' }] }),
    );
    const { extract } = await import('@/lib/engine');
    const result = await extract(CANONICAL.youtube, 'youtube');

    expect(spawnMock).not.toHaveBeenCalled();
    expect(String(fetchSpy.mock.calls[0]![0])).toBe('https://engine.example.com/extract');
    expect(result.sourceUrl).toBe(CANONICAL.youtube);
    fetchSpy.mockRestore();
  });

  it('a RapidAPI response with direct CDN links honours the bandwidth rule (every option carries a url)', async () => {
    vi.stubEnv('RAPIDAPI_KEY', 'test-key');
    vi.stubEnv('RAPIDAPI_HOST', 'downloader.example.com');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        title: 'Clip',
        medias: [
          { url: 'https://cdn.example.com/1080.mp4', quality: '1080p', extension: 'mp4' },
          { url: 'https://cdn.example.com/720.mp4', quality: '720p', extension: 'mp4' },
          { url: 'https://cdn.example.com/a.mp3', quality: 'audio', extension: 'mp3' },
        ],
      }),
    );
    const { extract } = await import('@/lib/engine');
    const result = await extract(CANONICAL.tiktok, 'tiktok');

    expect(result.options.every((o) => typeof o.url === 'string' && o.url.startsWith('https://'))).toBe(true);
    expect(result.options.map((o) => o.quality)).toEqual(['1080', '720', 'audio']);
    fetchSpy.mockRestore();
  });

  it('a RapidAPI rate-limit response surfaces as a 429, not a generic failure', async () => {
    vi.stubEnv('RAPIDAPI_KEY', 'test-key');
    vi.stubEnv('RAPIDAPI_HOST', 'downloader.example.com');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 429 }));
    const { extract } = await import('@/lib/engine');
    await expect(extract(CANONICAL.tiktok, 'tiktok')).rejects.toMatchObject({ status: 429 });
    fetchSpy.mockRestore();
  });

  it('an unreachable RapidAPI host degrades to a typed 503, never an unhandled rejection', async () => {
    vi.stubEnv('RAPIDAPI_KEY', 'test-key');
    vi.stubEnv('RAPIDAPI_HOST', 'downloader.example.com');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    const { extract } = await import('@/lib/engine');
    await expect(extract(CANONICAL.tiktok, 'tiktok')).rejects.toMatchObject({
      status: 503,
      message: 'The download service is unreachable right now.',
    });
    fetchSpy.mockRestore();
  });

  it('never forwards the RapidAPI key in the response or the error message', async () => {
    vi.stubEnv('RAPIDAPI_KEY', 'super-secret-key');
    vi.stubEnv('RAPIDAPI_HOST', 'downloader.example.com');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));
    const { extract } = await import('@/lib/engine');
    await expect(extract(CANONICAL.tiktok, 'tiktok')).rejects.toSatisfy(
      (e: Error) => !e.message.includes('super-secret-key'),
    );
    fetchSpy.mockRestore();
  });

  it('a remote engine returning an empty menu becomes a 404, not an empty success', async () => {
    vi.stubEnv('ENGINE_URL', 'https://engine.example.com');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ title: 'x', options: [] }));
    const { extract } = await import('@/lib/engine');
    await expect(extract(CANONICAL.youtube, 'youtube')).rejects.toMatchObject({ status: 404 });
    fetchSpy.mockRestore();
  });

  it('a remote engine HTTP error becomes a 502 with no upstream detail', async () => {
    vi.stubEnv('ENGINE_URL', 'https://engine.example.com');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('internal stack trace at /srv/engine/app.py:42', { status: 500 }),
    );
    const { extract } = await import('@/lib/engine');
    await expect(extract(CANONICAL.youtube, 'youtube')).rejects.toMatchObject({
      status: 502,
      message: 'The download service could not process this link.',
    });
    fetchSpy.mockRestore();
  });
});
