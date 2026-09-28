import { describe, it, expect } from 'vitest';
import { EXTRA_KEYWORDS, expandKeywords, toolKeywords, platformKeywords } from '@/lib/seoDefaults';
import { CONVERTER_LIST } from '@/lib/converterTools';
import { IMAGE_TOOL_LIST } from '@/lib/imageTools';
import { PDF_TOOL_LIST } from '@/lib/pdfTools';
import { FILE_TOOL_LIST } from '@/lib/fileTools';
import { PLATFORM_LIST } from '@/lib/platforms';

// Guards the "no compile-time exhaustiveness check" drift risk: EXTRA_KEYWORDS
// is a hand-maintained dict keyed by tool `key`, with nothing else enforcing
// that every registry tool has an entry.
describe('seoDefaults EXTRA_KEYWORDS coverage', () => {
  const registries = [
    ['converterTools', CONVERTER_LIST],
    ['imageTools', IMAGE_TOOL_LIST],
    ['pdfTools', PDF_TOOL_LIST],
    ['fileTools', FILE_TOOL_LIST],
  ] as const;

  for (const [name, list] of registries) {
    it(`every ${name} key has an EXTRA_KEYWORDS entry`, () => {
      for (const tool of list) {
        const kws = EXTRA_KEYWORDS[tool.key];
        expect(kws, `missing EXTRA_KEYWORDS['${tool.key}']`).toBeDefined();
        expect(kws?.length ?? 0).toBeGreaterThan(0);
      }
    });
  }
});

describe('expandKeywords', () => {
  it('crosses a base phrase with each modifier', () => {
    expect(expandKeywords('merge pdf', ['free', 'online'])).toEqual(['merge pdf free', 'merge pdf online']);
  });

  it('defaults to the universal free/online/no-signup modifiers', () => {
    expect(expandKeywords('merge pdf')).toEqual(['merge pdf free', 'merge pdf online', 'merge pdf no signup']);
  });
});

describe('toolKeywords / platformKeywords', () => {
  it('includes the primary keyword, its expansions, and the curated extras', () => {
    const keys = toolKeywords('merge-pdf', 'merge pdf');
    expect(keys[0]).toBe('merge pdf');
    expect(keys).toEqual(expect.arrayContaining(expandKeywords('merge pdf')));
    expect(keys).toEqual(expect.arrayContaining(EXTRA_KEYWORDS['merge-pdf'] ?? []));
  });

  it('platform keywords include the expanded primary keyword', () => {
    const p = PLATFORM_LIST[0];
    if (!p) throw new Error('PLATFORM_LIST is empty');
    expect(platformKeywords(p)).toEqual(expect.arrayContaining(expandKeywords(p.keyword)));
  });
});
