import { getDb, stmt } from '../db';

// Visibility + SEO overrides for the 32 tools and every blog post, keyed by
// (kind, key). No row = enabled, no override. Reads fail open (DB error ->
// enabled) and are uncached — see settings.server.ts for why.
export type ContentKind = 'platform' | 'ai-tool' | 'converter' | 'image-tool' | 'pdf-tool' | 'file-tool' | 'blog-post';

export const CONTENT_KINDS: { kind: ContentKind; label: string }[] = [
  { kind: 'platform', label: 'Platform downloaders' },
  { kind: 'ai-tool', label: 'AI tools' },
  { kind: 'converter', label: 'Converters' },
  { kind: 'image-tool', label: 'Thumbnail grabbers' },
  { kind: 'pdf-tool', label: 'PDF tools' },
  { kind: 'file-tool', label: 'File & image tools' },
];

interface ContentConfigRow {
  kind: string;
  key: string;
  enabled: number;
  featured: number;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  seo_canonical: string | null;
  seo_noindex: number;
  og_image: string | null;
  updated_at: number;
}

export interface SeoOverride {
  title?: string;
  description?: string;
  keywords?: string[];
  canonical?: string;
  noindex: boolean;
  ogImage?: string;
}

export interface ContentConfigInput {
  enabled: boolean;
  featured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  seoCanonical: string | null;
  seoNoindex: boolean;
  ogImage: string | null;
}

function fetchRow(kind: ContentKind, key: string): ContentConfigRow | undefined {
  try {
    return stmt('SELECT * FROM content_config WHERE kind = ? AND key = ?').get(kind, key) as
      | ContentConfigRow
      | undefined;
  } catch {
    return undefined; // fail open: DB unavailable -> treat as "no override, enabled"
  }
}

export function isContentEnabled(kind: ContentKind, key: string): boolean {
  const row = fetchRow(kind, key);
  return row ? Boolean(row.enabled) : true;
}

export function getSeoOverride(kind: ContentKind, key: string): SeoOverride | null {
  const row = fetchRow(kind, key);
  if (!row) return null;
  const hasAny =
    row.seo_title || row.seo_description || row.seo_keywords || row.seo_canonical || row.seo_noindex || row.og_image;
  if (!hasAny) return null;
  return {
    title: row.seo_title ?? undefined,
    description: row.seo_description ?? undefined,
    keywords: row.seo_keywords
      ? row.seo_keywords.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined,
    canonical: row.seo_canonical ?? undefined,
    noindex: Boolean(row.seo_noindex),
    ogImage: row.og_image ?? undefined,
  };
}

/** Filters a registry list down to enabled items. Fail-open on DB error (see above). */
export function filterVisible<T>(kind: ContentKind, list: readonly T[], keyOf: (item: T) => string): T[] {
  return list.filter((item) => isContentEnabled(kind, keyOf(item)));
}

/** Enabled AND not noindexed — for sitemap.ts only; nav/footer legitimately mean "browsable," not "indexable". */
export function isSitemapEligible(kind: ContentKind, key: string): boolean {
  return isContentEnabled(kind, key) && !getSeoOverride(kind, key)?.noindex;
}

export function getContentConfigRow(kind: ContentKind, key: string): ContentConfigInput {
  const row = fetchRow(kind, key);
  return {
    enabled: row ? Boolean(row.enabled) : true,
    featured: row ? Boolean(row.featured) : false,
    seoTitle: row?.seo_title ?? null,
    seoDescription: row?.seo_description ?? null,
    seoKeywords: row?.seo_keywords ?? null,
    seoCanonical: row?.seo_canonical ?? null,
    seoNoindex: row ? Boolean(row.seo_noindex) : false,
    ogImage: row?.og_image ?? null,
  };
}

const VALID_KINDS = new Set<string>([...CONTENT_KINDS.map((k) => k.kind), 'blog-post']);
const SAFE_KEY = /^[a-z0-9][a-z0-9-]*$/;

/** Rejects anything that isn't a real registry kind/key, so a forged form post
 * can't write junk rows that later shadow a real tool. */
export function isValidContentRef(kind: string, key: string): kind is ContentKind {
  return VALID_KINDS.has(kind) && SAFE_KEY.test(key) && key.length <= 128;
}

export function upsertContentConfig(kind: ContentKind, key: string, input: ContentConfigInput): void {
  if (!isValidContentRef(kind, key)) throw new Error('invalid_content_ref');
  getDb()
    .prepare(
      `INSERT INTO content_config
         (kind, key, enabled, featured, seo_title, seo_description, seo_keywords, seo_canonical, seo_noindex, og_image, updated_at)
       VALUES (@kind, @key, @enabled, @featured, @seoTitle, @seoDescription, @seoKeywords, @seoCanonical, @seoNoindex, @ogImage, @updatedAt)
       ON CONFLICT(kind, key) DO UPDATE SET
         enabled = excluded.enabled, featured = excluded.featured,
         seo_title = excluded.seo_title, seo_description = excluded.seo_description,
         seo_keywords = excluded.seo_keywords, seo_canonical = excluded.seo_canonical,
         seo_noindex = excluded.seo_noindex, og_image = excluded.og_image, updated_at = excluded.updated_at`,
    )
    .run({
      kind,
      key,
      enabled: input.enabled ? 1 : 0,
      featured: input.featured ? 1 : 0,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      seoKeywords: input.seoKeywords,
      seoCanonical: input.seoCanonical,
      seoNoindex: input.seoNoindex ? 1 : 0,
      ogImage: input.ogImage,
      updatedAt: Date.now(),
    });
}
