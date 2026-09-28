import { describe, it, expect } from 'vitest';
import { PLATFORMS, PLATFORM_LIST, detectPlatform, getPlatformByKey, getPlatformBySlug, type PlatformKey } from '@/lib/platforms';

/**
 * `hostPattern` is CLAUDE.md's named "SSRF whitelist source of truth" — it is the
 * only thing standing between a pasted string and yt-dlp/a third-party fetcher.
 */

interface HostCases {
  /** Real, currently-valid URLs the tool must accept (incl. www/mobile/shortlink variants). */
  accept: string[];
  /** Platform-specific lookalikes that must NEVER be accepted. */
  reject: string[];
}

const CASES: Record<PlatformKey, HostCases> = {
  tiktok: {
    accept: [
      'https://www.tiktok.com/@nasa/video/7123456789012345678',
      'https://tiktok.com/@nasa/video/7123456789012345678',
      'https://m.tiktok.com/v/7123456789012345678.html',
      'https://vm.tiktok.com/ZMabcdefg/',
      'https://vt.tiktok.com/ZSabcdefg/',
      'http://www.tiktok.com/@nasa/video/7123456789012345678',
      'HTTPS://WWW.TIKTOK.COM/@nasa/video/7123456789012345678',
    ],
    reject: [
      'https://tiktok.com.evil.com/@u/video/1',
      'https://www.tiktok.com.evil.com/@u/video/1',
      'https://evil-tiktok.com/@u/video/1',
      'https://tiktokcom.evil.net/x',
      'https://nottiktok.com/@u/video/1',
      'https://tiktok.com@evil.com/x',
      'https://vm.tiktok.com.evil.com/x',
    ],
  },
  instagram: {
    accept: [
      'https://www.instagram.com/reel/AbCdEfGhIjK/',
      'https://instagram.com/p/AbCdEfGhIjK/',
      'https://www.instagram.com/tv/AbCdEfGhIjK/',
      'https://www.instagram.com/stories/nasa/3212345678901234567/',
    ],
    reject: [
      'https://instagram.com.evil.com/reel/1/',
      'https://www.instagram.com.evil.com/reel/1/',
      'https://ddinstagram.com/reel/1/',
      'https://evil-instagram.com/reel/1/',
      'https://instagram.com@evil.com/x',
      'https://instagram.co/reel/1/',
    ],
  },
  youtube: {
    accept: [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com/shorts/abcdefghijk',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://music.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/live/abcdefghijk',
    ],
    reject: [
      'https://youtube.com.evil.com/watch?v=1',
      'https://www.youtube.com.evil.com/watch?v=1',
      'https://youtu.be.evil.com/x',
      'https://evil-youtube.com/watch?v=1',
      'https://youtube.co/watch?v=1',
      'https://youtube.com@evil.com/x',
      // Trailing-dot FQDN: a classic whitelist bypass. Rejected here because the
      // pattern requires "/" straight after the TLD — verified, not assumed.
      'https://www.youtube.com./watch?v=1',
    ],
  },
  facebook: {
    accept: [
      'https://www.facebook.com/watch/?v=1234567890',
      'https://web.facebook.com/reel/1234567890',
      'https://m.facebook.com/story.php?story_fbid=1&id=2',
      'https://fb.watch/abc123XyZ/',
      'https://fb.com/1234567890',
      'https://facebook.com/nasa/videos/1234567890/',
    ],
    reject: [
      'https://facebook.com.evil.com/watch/?v=1',
      'https://www.facebook.com.evil.com/x',
      'https://fb.watch.evil.com/x',
      'https://evil-facebook.com/x',
      'https://facebook.com@evil.com/x',
      'https://fbcom.evil.net/x',
    ],
  },
  linkedin: {
    accept: [
      'https://www.linkedin.com/posts/nasa_activity-1234567890-AbCd/',
      'https://linkedin.com/feed/update/urn:li:activity:1234567890/',
      'https://de.linkedin.com/posts/nasa_activity-1234567890-AbCd/',
    ],
    reject: [
      'https://linkedin.com.evil.com/posts/x',
      'https://www.linkedin.com.evil.com/posts/x',
      'https://evil-linkedin.com/posts/x',
      'https://linkedin.com@evil.com/x',
      'https://linkedln.com/posts/x',
    ],
  },
  twitter: {
    accept: [
      'https://x.com/NASA/status/1234567890123456789',
      'https://twitter.com/NASA/status/1234567890123456789',
      'https://www.twitter.com/NASA/status/1234567890123456789',
      'https://mobile.twitter.com/NASA/status/1234567890123456789',
      'https://t.co/abcdef1234',
    ],
    reject: [
      'https://twitter.com.evil.com/NASA/status/1',
      'https://x.com.evil.com/x',
      'https://t.co.evil.com/x',
      'https://evil-x.com/x',
      'https://twitter.com@evil.com/x',
      'https://xcom.evil.net/x',
    ],
  },
  pinterest: {
    accept: [
      'https://www.pinterest.com/pin/1234567890/',
      'https://pinterest.com/pin/1234567890/',
      'https://ru.pinterest.com/pin/1234567890/',
      'https://www.pinterest.co.uk/pin/1234567890/',
      'https://pinterest.com.au/pin/1234567890/',
      'https://www.pinterest.co.kr/pin/1234567890/',
      'https://pin.it/abc123XyZ',
    ],
    reject: [
      // Regression guards for a REAL bypass that shipped: the pattern used to be
      // `pinterest\.[\w.]+`, which whitelisted any `pinterest.<attacker-host>`.
      'https://pinterest.evil.com/pin/1/',
      'https://www.pinterest.evil.com/pin/1/',
      'https://pinterest.com.evil.com/pin/1/',
      'https://pinterest.co.uk.evil.com/pin/1/',
      'https://pinterest.169.254.169.254.nip.io/latest/meta-data/',
      'https://pinterest.10.0.0.1.nip.io/admin',
      'https://pin.it.evil.com/x',
      'https://evil-pinterest.com/pin/1/',
    ],
  },
  reddit: {
    accept: [
      'https://www.reddit.com/r/videos/comments/abc123/some_title/',
      'https://old.reddit.com/r/videos/comments/abc123/some_title/',
      'https://reddit.com/r/videos/comments/abc123/some_title/',
      'https://v.redd.it/abc123xyz',
      'https://redd.it/abc123',
    ],
    reject: [
      'https://reddit.com.evil.com/r/videos/x/',
      'https://v.redd.it.evil.com/x',
      'https://redd.it.evil.com/x',
      'https://evil-reddit.com/r/videos/x/',
      'https://reddit.com@evil.com/x',
      'https://redditcom.evil.net/x',
    ],
  },
  vimeo: {
    accept: [
      'https://vimeo.com/123456789',
      'https://www.vimeo.com/123456789',
      'https://player.vimeo.com/video/123456789',
      'https://vimeo.com/channels/staffpicks/123456789',
    ],
    reject: [
      'https://vimeo.com.evil.com/123456789',
      'https://www.vimeo.com.evil.com/1',
      'https://evil-vimeo.com/123456789',
      'https://vimeo.com@evil.com/x',
      'https://vimeo.co/123456789',
    ],
  },
  twitch: {
    accept: [
      'https://www.twitch.tv/videos/1234567890',
      'https://twitch.tv/videos/1234567890',
      'https://clips.twitch.tv/AbcClipNameHere',
      'https://m.twitch.tv/videos/1234567890',
      'https://www.twitch.tv/nasa/clip/AbcClipNameHere',
    ],
    reject: [
      'https://twitch.tv.evil.com/videos/1',
      'https://clips.twitch.tv.evil.com/x',
      'https://evil-twitch.com/videos/1',
      'https://twitch.tv@evil.com/x',
      'https://twitchtv.evil.net/x',
    ],
  },
  tumblr: {
    accept: [
      'https://www.tumblr.com/blog/view/someblog/1234567890',
      'https://tumblr.com/someblog/1234567890',
      'https://someblog.tumblr.com/post/1234567890',
    ],
    reject: [
      'https://tumblr.com.evil.com/post/1',
      'https://www.tumblr.com.evil.com/post/1',
      'https://evil-tumblr.com/post/1',
      'https://tumblr.com@evil.com/x',
      'https://tumblrcom.evil.net/x',
    ],
  },
};

/** Rejected for EVERY platform: internal targets, non-http schemes, junk. */
const UNIVERSAL_REJECT: string[] = [
  'http://localhost/x',
  'http://localhost:3000/api/health',
  'http://127.0.0.1/x',
  'http://127.0.0.1:8080/admin',
  'http://0.0.0.0/x',
  'http://10.0.0.5/internal',
  'http://192.168.1.1/router',
  'http://172.16.0.1/x',
  'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
  'http://metadata.google.internal/computeMetadata/v1/instance/',
  'http://[::1]/x',
  'http://2130706433/x',
  'http://0x7f000001/x',
  'file:///etc/passwd',
  'javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'ftp://evil.com/x',
  'gopher://127.0.0.1:6379/_INFO',
  '//www.tiktok.com/@u/video/1',
  'https://',
  'not a url at all',
  '',
  '   ',
  '\n',
];

const canonical = (key: PlatformKey): string => CASES[key].accept[0]!;

describe.each(PLATFORM_LIST)('$name hostPattern (SSRF whitelist)', (platform) => {
  const cases = CASES[platform.key];

  it.each(cases.accept)('accepts the real URL %s', (url) => {
    expect(platform.hostPattern.test(url)).toBe(true);
  });

  it.each(cases.reject)('rejects the lookalike %s', (url) => {
    expect(platform.hostPattern.test(url)).toBe(false);
  });

  it.each(UNIVERSAL_REJECT)('rejects the non-platform target %j', (url) => {
    expect(platform.hostPattern.test(url)).toBe(false);
  });

  it('rejects every other platform’s canonical URL', () => {
    const foreign = PLATFORM_LIST.filter((p) => p.key !== platform.key).map((p) => canonical(p.key));
    const wronglyAccepted = foreign.filter((u) => platform.hostPattern.test(u));
    expect(wronglyAccepted).toEqual([]);
  });

  it('rejects a whitelisted host smuggled into the path, query or fragment of a foreign host', () => {
    const target = canonical(platform.key);
    for (const smuggled of [
      `https://evil.com/${target}`,
      `https://evil.com/?next=${target}`,
      `https://evil.com/#${target}`,
      `https://evil.com/redirect?to=${encodeURIComponent(target)}`,
    ]) {
      expect(platform.hostPattern.test(smuggled)).toBe(false);
    }
  });

  it('rejects credential-embedded authority in both directions', () => {
    const host = new URL(canonical(platform.key)).host;
    // Attacker direction: real host used as a username so the true host is evil.com.
    expect(platform.hostPattern.test(`https://${host}@evil.com/x`)).toBe(false);
    // Fails closed in the benign direction too — a user:pass URL to the real host
    // is rejected rather than parsed. Safe, and documented so it isn't "fixed" later.
    expect(platform.hostPattern.test(`https://user:pass@${host}/x`)).toBe(false);
  });

  it('is anchored: a whitelisted host appearing mid-string never matches', () => {
    expect(platform.hostPattern.test(`prefix${canonical(platform.key)}`)).toBe(false);
  });

  it('does not carry the /g flag (a stateful lastIndex would make .test() alternate)', () => {
    expect(platform.hostPattern.global).toBe(false);
    const url = canonical(platform.key);
    expect([platform.hostPattern.test(url), platform.hostPattern.test(url)]).toEqual([true, true]);
  });

  it('requires a path separator after the host, so bare-host targets are refused', () => {
    const host = new URL(canonical(platform.key)).host;
    expect(platform.hostPattern.test(`https://${host}`)).toBe(false);
  });
});

describe('registry invariants', () => {
  it('exposes exactly the 11 documented platforms', () => {
    expect(PLATFORM_LIST).toHaveLength(11);
    expect(Object.keys(PLATFORMS).sort()).toEqual(
      ['facebook', 'instagram', 'linkedin', 'pinterest', 'reddit', 'tiktok', 'tumblr', 'twitch', 'twitter', 'vimeo', 'youtube'],
    );
  });

  it('every platform key matches its record key and every slug is unique', () => {
    for (const [key, p] of Object.entries(PLATFORMS)) expect(p.key).toBe(key);
    const slugs = PLATFORM_LIST.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('every documented urlExample actually passes its own hostPattern', () => {
    const broken = PLATFORM_LIST.filter((p) => !p.hostPattern.test(p.urlExample)).map((p) => p.key);
    expect(broken).toEqual([]);
  });

  it('lookups return undefined for inherited Object keys rather than a bogus Platform', () => {
    // Regression: `PLATFORMS['__proto__']` is Object.prototype — truthy, but with no
    // hostPattern, which crashed /api/download with an unhandled TypeError.
    for (const key of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf']) {
      expect(getPlatformByKey(key)).toBeUndefined();
      expect(getPlatformBySlug(key)).toBeUndefined();
    }
  });

  it('resolves every real key and slug', () => {
    for (const p of PLATFORM_LIST) {
      expect(getPlatformByKey(p.key)).toBe(p);
      expect(getPlatformBySlug(p.slug)).toBe(p);
    }
  });

  it('no two platforms claim the same URL (detectPlatform would be ambiguous)', () => {
    for (const p of PLATFORM_LIST) {
      const claimants = PLATFORM_LIST.filter((o) => o.hostPattern.test(canonical(p.key))).map((o) => o.key);
      expect(claimants).toEqual([p.key]);
    }
  });
});

describe('regression: the Pinterest hostPattern SSRF bypass', () => {
  // The shipped pattern was `pinterest\.[\w.]+`, whose `[\w.]+` swallows any
  // dot-separated suffix — so `pinterest.<anything>` was whitelisted.
  const VULNERABLE = /^https?:\/\/([\w-]+\.)?(pinterest\.[\w.]+|pin\.it)\//i;

  const EXPLOITS = [
    'https://pinterest.169.254.169.254.nip.io/latest/meta-data/iam/security-credentials/',
    'https://pinterest.127.0.0.1.nip.io/admin',
    'https://pinterest.evil.com/pin/1/',
  ];

  it.each(EXPLOITS)('the old pattern really did accept %s (this is why the fix exists)', (url) => {
    expect(VULNERABLE.test(url)).toBe(true);
  });

  it.each(EXPLOITS)('the current pattern rejects %s', (url) => {
    expect(PLATFORMS.pinterest.hostPattern.test(url)).toBe(false);
  });

  it('nip.io-style hosts defeat validate.ts’s literal-hostname private-IP check, so the pattern is the only guard', () => {
    // `pinterest.169.254.169.254.nip.io` resolves to the cloud metadata IP but the
    // hostname string starts with "pinterest", so no private-host regex matches it.
    const PRIVATE_HOST = /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|::1|\[::1\]|metadata\.google\.internal)/i;
    expect(PRIVATE_HOST.test('pinterest.169.254.169.254.nip.io')).toBe(false);
  });
});

describe('detectPlatform (drives the universal home box and the /?grab= deep link)', () => {
  it.each(PLATFORM_LIST.map((p) => [p.key, canonical(p.key)] as const))(
    'routes a %s URL to the %s tool',
    (key, url) => {
      expect(detectPlatform(url)?.key).toBe(key);
    },
  );

  it('tolerates surrounding whitespace from a clipboard paste', () => {
    expect(detectPlatform('  https://www.youtube.com/watch?v=dQw4w9WgXcQ\n')?.key).toBe('youtube');
  });

  it.each(UNIVERSAL_REJECT)('returns undefined for the unsupported target %j', (url) => {
    expect(detectPlatform(url)).toBeUndefined();
  });

  it('returns undefined for a lookalike host rather than silently picking a platform', () => {
    expect(detectPlatform('https://pinterest.169.254.169.254.nip.io/latest/meta-data/')).toBeUndefined();
    expect(detectPlatform('https://www.youtube.com.evil.com/watch?v=1')).toBeUndefined();
  });
});
