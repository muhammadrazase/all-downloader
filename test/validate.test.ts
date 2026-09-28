import { describe, it, expect } from 'vitest';
import { extractRequestSchema, validateExtractTarget } from '@/lib/validate';
import { PLATFORM_LIST, type PlatformKey } from '@/lib/platforms';

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

describe('validateExtractTarget — accepts genuine targets', () => {
  it.each(PLATFORM_LIST.map((p) => [p.key, CANONICAL[p.key]] as const))(
    'accepts a real %s URL',
    (key, url) => {
      expect(validateExtractTarget(url, key)).toEqual({ ok: true });
    },
  );
});

describe('validateExtractTarget — scheme guard', () => {
  it.each([
    ['file:///etc/passwd', 'file'],
    ['javascript:alert(1)', 'javascript'],
    ['data:text/html,<script>alert(1)</script>', 'data'],
    ['ftp://ftp.example.com/x', 'ftp'],
    ['gopher://127.0.0.1:6379/_INFO', 'gopher'],
  ])('rejects the %s scheme with the scheme-specific reason', (url) => {
    expect(validateExtractTarget(url, 'youtube')).toEqual({
      ok: false,
      reason: 'Only http(s) links are supported.',
    });
  });

  it('accepts plain http, not only https', () => {
    expect(validateExtractTarget('http://www.youtube.com/watch?v=1', 'youtube').ok).toBe(true);
  });

  it('normalizes an uppercase scheme rather than rejecting it', () => {
    expect(validateExtractTarget('HTTPS://WWW.YOUTUBE.COM/watch?v=1', 'youtube').ok).toBe(true);
  });
});

describe('validateExtractTarget — internal-address guard (defense in depth)', () => {
  // These reach the private-host check BEFORE the host whitelist, so asserting the
  // exact reason proves the SSRF layer fires and isn't masked by hostPattern.
  it.each([
    'http://localhost/x',
    'http://localhost:3000/api/health',
    'http://127.0.0.1/x',
    'http://127.0.0.53/x',
    'http://0.0.0.0/x',
    'http://10.0.0.5/internal',
    'http://192.168.1.1/router',
    'http://172.16.0.1/x',
    'http://172.31.255.254/x',
    'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
    'http://metadata.google.internal/computeMetadata/v1/instance/',
    'http://[::1]/x',
    'http://0.1.2.3/x',
  ])('blocks %s as an internal address', (url) => {
    expect(validateExtractTarget(url, 'youtube')).toEqual({
      ok: false,
      reason: 'Internal addresses are not allowed.',
    });
  });

  it('blocks internal addresses for every platform, not just one', () => {
    const leaked = PLATFORM_LIST.filter(
      (p) => validateExtractTarget('http://169.254.169.254/latest/meta-data/', p.key).ok,
    ).map((p) => p.key);
    expect(leaked).toEqual([]);
  });

  it('172.15 and 172.32 are public and are NOT caught by the private check (they fail on the whitelist instead)', () => {
    // Pins the RFC1918 boundary: only 172.16–172.31 is private.
    expect(validateExtractTarget('http://172.15.0.1/x', 'youtube').reason).toBe(
      'That does not look like a valid YouTube link.',
    );
    expect(validateExtractTarget('http://172.32.0.1/x', 'youtube').reason).toBe(
      'That does not look like a valid YouTube link.',
    );
  });

  it.each([
    'http://2130706433/x',
    'http://0x7f000001/x',
    'http://017700000001/x',
    'http://127.1/x',
    'http://0/x',
  ])('catches the obfuscated loopback form %s, because the URL parser normalizes it to dotted-quad first', (url) => {
    // Verified empirically: `new URL()` rewrites decimal/hex/octal/short IPv4 to
    // 127.0.0.1, so the string-based private-host regex does match it.
    expect(validateExtractTarget(url, 'youtube').reason).toBe('Internal addresses are not allowed.');
  });

  it.each([
    'http://localhost/x',
    'http://evil.localhost/x',
    'http://pinterest.localhost/pin/1/',
    'http://a.b.c.localhost/x',
    'http://LOCALHOST/x',
    'http://Evil.LocalHost/x',
    'http://api.localhost:8080/internal',
  ])('blocks the RFC 6761 loopback TLD host %s', (url) => {
    // `*.localhost` resolves to 127.0.0.1 on most resolvers, and the ^-anchored
    // PRIVATE_HOST regex does not match a hostname that merely ENDS in .localhost.
    expect(validateExtractTarget(url, 'youtube')).toEqual({
      ok: false,
      reason: 'Internal addresses are not allowed.',
    });
  });

  it('no platform accepts a .localhost host, on either the pattern or the full pipeline', () => {
    const leaked: string[] = [];
    for (const p of PLATFORM_LIST) {
      for (const url of [
        `https://${p.key}.localhost/x`,
        `https://${p.key}.com.localhost/x`,
        `https://www.${p.key}.localhost/x`,
        `https://${p.key}.local/x`,
        `https://${p.key}.internal/x`,
      ]) {
        if (p.hostPattern.test(url)) leaked.push(`pattern ${p.key}: ${url}`);
        if (validateExtractTarget(url, p.key).ok) leaked.push(`validate ${p.key}: ${url}`);
      }
    }
    expect(leaked).toEqual([]);
  });

  it('the loopback-TLD rule matches only the TLD position, so it cannot over-block by itself', () => {
    const LOOPBACK_TLD = /(^|\.)localhost$/i;
    expect(LOOPBACK_TLD.test('evil.localhost')).toBe(true);
    expect(LOOPBACK_TLD.test('localhost')).toBe(true);
    expect(LOOPBACK_TLD.test('localhost.example.com')).toBe(false);
    expect(LOOPBACK_TLD.test('mylocalhost')).toBe(false);
    expect(LOOPBACK_TLD.test('localhostess.com')).toBe(false);
  });

  it('known residual gap — IPv6-mapped loopback evades the private check and is stopped only by the whitelist', () => {
    // `[::ffff:127.0.0.1]` normalizes to `[::ffff:7f00:1]`, which no private-host
    // regex matches. Harmless today because no hostPattern accepts a bracketed host.
    expect(new URL('http://[::ffff:127.0.0.1]/x').hostname).toBe('[::ffff:7f00:1]');
    expect(validateExtractTarget('http://[::ffff:127.0.0.1]/x', 'youtube')).toEqual({
      ok: false,
      reason: 'That does not look like a valid YouTube link.',
    });
  });
});

describe('validateExtractTarget — malformed input', () => {
  it.each(['', '   ', '\n\t', 'not a url', 'https://', 'http://', '///', 'https://[', '%%%'])(
    'rejects %j as malformed',
    (url) => {
      expect(validateExtractTarget(url, 'youtube')).toEqual({ ok: false, reason: 'Malformed URL.' });
    },
  );

  it('rejects a protocol-relative URL (no scheme to validate)', () => {
    expect(validateExtractTarget('//www.youtube.com/watch?v=1', 'youtube').reason).toBe('Malformed URL.');
  });
});

describe('validateExtractTarget — platform/host mismatch', () => {
  it('names the platform in the user-facing reason without echoing the URL back', () => {
    const result = validateExtractTarget(CANONICAL.youtube, 'tiktok');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('That does not look like a valid TikTok link.');
    expect(result.reason).not.toContain('youtube');
  });

  it('rejects every cross-platform pairing', () => {
    const mismatches: string[] = [];
    for (const p of PLATFORM_LIST) {
      for (const other of PLATFORM_LIST) {
        if (p.key === other.key) continue;
        if (validateExtractTarget(CANONICAL[other.key], p.key).ok) mismatches.push(`${other.key}->${p.key}`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe('validateExtractTarget — authority-confusion payloads', () => {
  it('rejects a whitelisted host used as the userinfo of an attacker host', () => {
    for (const p of PLATFORM_LIST) {
      const host = new URL(CANONICAL[p.key]).host;
      expect(validateExtractTarget(`https://${host}@evil.com/x`, p.key).ok).toBe(false);
    }
  });

  it('rejects a backslash-smuggled authority even though the URL parser resolves it to the real host', () => {
    // `new URL()` normalizes the backslash to "/", so the parsed hostname IS
    // youtube.com — but hostPattern tests the RAW string and fails closed.
    expect(new URL('https://www.youtube.com\\@evil.com/x').hostname).toBe('www.youtube.com');
    expect(validateExtractTarget('https://www.youtube.com\\@evil.com/x', 'youtube').ok).toBe(false);
  });

  it('rejects a percent-encoded host separator', () => {
    expect(validateExtractTarget('https://www%2Eyoutube.com/watch?v=1', 'youtube').ok).toBe(false);
  });

  it('rejects an explicit non-standard port on a whitelisted host', () => {
    // Pinned deliberately: a port would let a whitelisted DNS name reach an
    // internal service. The trailing "/" requirement refuses it.
    expect(validateExtractTarget('https://www.youtube.com:8080/watch?v=1', 'youtube').ok).toBe(false);
  });

  it('also rejects the DEFAULT port written explicitly — the pattern sees the raw string, not the parsed URL', () => {
    // Fails closed: `new URL()` would strip ":443", but hostPattern never sees the
    // normalized form. A benign false negative, pinned so it is not "fixed" unsafely.
    expect(new URL('https://www.youtube.com:443/watch?v=1').host).toBe('www.youtube.com');
    expect(validateExtractTarget('https://www.youtube.com:443/watch?v=1', 'youtube').ok).toBe(false);
  });

  it('does not follow an open-redirect target embedded in the query of a whitelisted host', () => {
    // Accepting this is correct: the HOST is youtube. Following the redirect is the
    // engine's problem, handled by yt-dlp's --use-extractors filter (see engine.test.ts).
    expect(validateExtractTarget('https://www.youtube.com/redirect?q=http://169.254.169.254/', 'youtube').ok).toBe(true);
  });
});

describe('validateExtractTarget — size', () => {
  const longUrl = `https://www.youtube.com/watch?v=${'a'.repeat(10_000)}`;

  it('has NO length cap of its own — the 2048 cap lives only in the Zod schema', () => {
    // /api/download validates with validateExtractTarget and does NOT run the
    // schema, so it has no URL-length ceiling. Documented, not assumed.
    expect(validateExtractTarget(longUrl, 'youtube').ok).toBe(true);
    expect(extractRequestSchema.safeParse({ url: longUrl, platform: 'youtube' }).success).toBe(false);
  });
});

describe('extractRequestSchema', () => {
  it('accepts a well-formed body', () => {
    const parsed = extractRequestSchema.safeParse({ url: CANONICAL.youtube, platform: 'youtube' });
    expect(parsed.success).toBe(true);
  });

  it('trims surrounding whitespace before validating the URL', () => {
    const parsed = extractRequestSchema.safeParse({ url: `  ${CANONICAL.youtube}\n`, platform: 'youtube' });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.url).toBe(CANONICAL.youtube);
  });

  it('accepts all 11 platform keys and nothing else', () => {
    for (const p of PLATFORM_LIST) {
      expect(extractRequestSchema.safeParse({ url: CANONICAL[p.key], platform: p.key }).success).toBe(true);
    }
    for (const bad of ['Youtube', 'YOUTUBE', 'snapchat', 'onlyfans', '', '__proto__', 'constructor']) {
      expect(extractRequestSchema.safeParse({ url: CANONICAL.youtube, platform: bad }).success).toBe(false);
    }
  });

  it.each([
    ['missing url', { platform: 'youtube' }],
    ['missing platform', { url: CANONICAL.youtube }],
    ['null body', null],
    ['array body', []],
    ['string body', 'youtube'],
    ['numeric url', { url: 12345, platform: 'youtube' }],
    ['array url', { url: [CANONICAL.youtube], platform: 'youtube' }],
    ['object url', { url: { href: CANONICAL.youtube }, platform: 'youtube' }],
    ['empty url', { url: '', platform: 'youtube' }],
    ['whitespace url', { url: '     ', platform: 'youtube' }],
    ['non-url string', { url: 'not a url', platform: 'youtube' }],
  ])('rejects %s', (_label, body) => {
    expect(extractRequestSchema.safeParse(body).success).toBe(false);
  });

  it('does NOT block dangerous schemes — z.string().url() accepts any parseable scheme', () => {
    // Verified empirically against zod 3.24: `.url()` is `new URL()`, so
    // `javascript:`/`file:` pass the schema. Only validateExtractTarget's
    // protocol check stops them — the schema is not a scheme guard.
    for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,x']) {
      expect(extractRequestSchema.safeParse({ url, platform: 'youtube' }).success).toBe(true);
      expect(validateExtractTarget(url, 'youtube')).toEqual({
        ok: false,
        reason: 'Only http(s) links are supported.',
      });
    }
  });

  it('rejects a URL one byte over the 2048 cap and accepts one at the cap', () => {
    const pad = (total: number) => {
      const base = 'https://www.youtube.com/watch?v=';
      return base + 'a'.repeat(total - base.length);
    };
    expect(extractRequestSchema.safeParse({ url: pad(2048), platform: 'youtube' }).success).toBe(true);
    expect(extractRequestSchema.safeParse({ url: pad(2049), platform: 'youtube' }).success).toBe(false);
  });

  it('strips unknown keys instead of passing them through to the engine', () => {
    const parsed = extractRequestSchema.safeParse({
      url: CANONICAL.youtube,
      platform: 'youtube',
      cookies: '/etc/passwd',
      proxy: 'http://attacker/',
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && Object.keys(parsed.data).sort()).toEqual(['platform', 'url']);
  });

  it('a schema-valid body can still be a rejected target — both gates are required', () => {
    // `javascript:` is caught by Zod; `pinterest.evil.com` is a valid URL that only
    // the host whitelist stops. Neither gate alone is sufficient.
    const body = { url: 'https://pinterest.evil.com/pin/1/', platform: 'pinterest' as const };
    expect(extractRequestSchema.safeParse(body).success).toBe(true);
    expect(validateExtractTarget(body.url, body.platform).ok).toBe(false);
  });
});
