import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { AI_TOOLS, AI_TOOL_LIST, type AiTool } from '@/lib/aiTools';
import { faqSchema, howToSchema, webApplicationSchema } from '@/lib/schema';
import sitemap from '@/app/sitemap';

/**
 * The registry is the single source of truth for both AI tool pages — copy, SEO
 * metadata and JSON-LD all derive from it, so a regression here ships sitewide.
 */

const repoRoot = path.join(__dirname, '..');

describe('AI_TOOLS registry', () => {
  it('exposes exactly the two AI tools, keyed by their own slug', () => {
    expect(AI_TOOL_LIST.map((t) => t.key)).toEqual(['video-to-text', 'video-summary']);
    for (const tool of AI_TOOL_LIST) expect(tool.slug).toBe(tool.key);
  });

  it('maps each tool to the box variant that calls the right endpoint', () => {
    expect(AI_TOOLS['video-to-text'].toolType).toBe('transcript');
    expect(AI_TOOLS['video-summary'].toolType).toBe('summary');
  });

  it.each(AI_TOOL_LIST)('$key has SERP-safe metadata containing its target keyword', (tool: AiTool) => {
    expect(tool.metaTitle.length).toBeLessThanOrEqual(65);
    expect(tool.metaDescription.length).toBeGreaterThanOrEqual(100);
    expect(tool.metaDescription.length).toBeLessThanOrEqual(165);
    expect(tool.metaTitle.toLowerCase()).toContain(tool.keyword.toLowerCase());
    expect(tool.keywords[0]).toBe(tool.keyword);
  });

  it('writes unique copy per tool — templated duplicates are a ranking killer', () => {
    const fields = (['metaTitle', 'metaDescription', 'h1', 'intro'] as const).map((field) =>
      AI_TOOL_LIST.map((t) => t[field]),
    );
    for (const values of fields) expect(new Set(values).size).toBe(values.length);
  });

  it.each(AI_TOOL_LIST)('$key carries enough FAQ and step content for rich results', (tool: AiTool) => {
    expect(tool.faqs.length).toBeGreaterThanOrEqual(4);
    expect(tool.steps.length).toBeGreaterThanOrEqual(3);
    for (const faq of tool.faqs) {
      expect(faq.q.endsWith('?')).toBe(true);
      expect(faq.a.trim().length).toBeGreaterThan(20);
    }
    expect(new Set(tool.faqs.map((f) => f.q)).size).toBe(tool.faqs.length);
  });

  it.each(AI_TOOL_LIST)('$key links to a blog post that actually exists', (tool: AiTool) => {
    // Two-way internal links are only worth anything if they do not 404.
    const match = /^\/blog\/([\w-]+)\/([\w-]+)$/.exec(tool.relatedPost.href);
    expect(match, `${tool.relatedPost.href} is not a /blog/<category>/<slug> path`).not.toBeNull();
    const [, category, slug] = match ?? [];
    expect(existsSync(path.join(repoRoot, 'content', 'blog', String(category), `${String(slug)}.mdx`))).toBe(true);
  });
});

describe('AI tool JSON-LD', () => {
  it.each(AI_TOOL_LIST)('$key produces serialisable WebApplication, FAQPage and HowTo blocks', (tool: AiTool) => {
    const blocks = [
      webApplicationSchema(tool.metaTitle, `/${tool.slug}`, tool.metaDescription),
      faqSchema(tool.faqs),
      howToSchema(`How to use ${tool.name.toLowerCase()}`, tool.steps),
    ];
    for (const block of blocks) {
      const parsed = JSON.parse(JSON.stringify(block)) as Record<string, unknown>;
      expect(parsed['@context']).toBe('https://schema.org');
      expect(typeof parsed['@type']).toBe('string');
    }
  });

  it('emits one Question per FAQ and one HowToStep per step, in order', () => {
    const tool = AI_TOOLS['video-to-text'];
    const faq = faqSchema(tool.faqs);
    const howTo = howToSchema('How to use video to text', tool.steps);
    expect(faq.mainEntity).toHaveLength(tool.faqs.length);
    expect(faq.mainEntity[0]?.name).toBe(tool.faqs[0]?.q);
    expect(howTo.step.map((s) => s.position)).toEqual(tool.steps.map((_, i) => i + 1));
  });

  it('never claims a rating it cannot substantiate', () => {
    const block = webApplicationSchema('x', '/video-summary', 'y');
    expect(block).not.toHaveProperty('aggregateRating');
    expect(block.offers.price).toBe('0');
  });
});

describe('sitemap coverage', () => {
  it('lists each AI tool route exactly once, as an absolute URL', () => {
    const urls = sitemap().map((entry) => entry.url);
    for (const tool of AI_TOOL_LIST) {
      const matches = urls.filter((url) => url.endsWith(`/${tool.slug}`));
      expect(matches, `expected one sitemap entry for /${tool.slug}`).toHaveLength(1);
      expect(matches[0]).toMatch(/^https?:\/\//);
    }
  });
});
