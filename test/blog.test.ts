import { describe, it, expect } from 'vitest';
import { getPost, getAllPosts, postFileExists } from '@/lib/blog';

/**
 * Regression test: dynamicParams was flipped to true on /blog/[category]/[slug]
 * (so a freshly published post goes live without a rebuild), which means an
 * unknown-but-syntactically-valid slug now reaches getPost() directly instead
 * of 404ing before render. A missing file must resolve to null, not throw —
 * an uncaught ENOENT here is an unauthenticated 500 on every mistyped/stale
 * blog URL.
 */
describe('getPost', () => {
  it('returns null instead of throwing for a nonexistent slug in a real category', () => {
    expect(() => getPost('tiktok', 'this-slug-definitely-does-not-exist-12345')).not.toThrow();
    expect(getPost('tiktok', 'this-slug-definitely-does-not-exist-12345')).toBeNull();
  });

  it('returns null instead of throwing for a nonexistent category', () => {
    expect(() => getPost('youtube', 'also-does-not-exist-67890')).not.toThrow();
    expect(getPost('youtube', 'also-does-not-exist-67890')).toBeNull();
  });

  it('rejects a path-traversal attempt without ever touching the filesystem', () => {
    expect(getPost('../../etc', 'passwd')).toBeNull();
    expect(getPost('tiktok', '../../../etc/passwd')).toBeNull();
  });
});

describe('postFileExists', () => {
  it('is false for a nonexistent post and does not throw', () => {
    expect(postFileExists('tiktok', 'this-slug-definitely-does-not-exist-12345')).toBe(false);
  });
});

describe('getAllPosts', () => {
  it('never includes a draft post in the public listing', () => {
    expect(getAllPosts().every((p) => !p.draft)).toBe(true);
  });
});
