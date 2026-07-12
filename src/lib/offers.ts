import type { PlatformKey } from './platforms';

/**
 * Contextual affiliate offers — the highest-yield revenue lane for a downloader
 * audience (ad-block-proof and high-intent: people who save video also edit,
 * store, stream, and record it).
 *
 * Every offer's destination URL comes from a `NEXT_PUBLIC_AFFILIATE_*` env var, so:
 *   - no partner IDs are committed to the repo,
 *   - an offer renders ONLY when its URL is configured (nothing shows otherwise —
 *     no empty boxes, no placeholders),
 *   - links are swappable per-deploy without a code change (rebuild inlines them).
 *
 * These are rendered NATIVELY (not as third-party banners) with rel="sponsored",
 * which is why they survive ad blockers and stay inside Google's paid-link policy.
 */

const env = (key: string): string => process.env[key] ?? '';

export type OfferCategory = 'vpn' | 'editor' | 'storage' | 'ai' | 'recorder';

/** Where an offer may appear. Pages request offers by their context. */
export type OfferContext =
  | 'downloader' // platform downloader pages + homepage
  | 'converter' // video → mp3 / gif / convert
  | 'ai' // transcript / summary
  | 'thumbnail' // image grabbers
  | 'blog'; // articles

export interface Offer {
  id: string;
  name: string;
  /** One honest, intent-driven benefit line — not a slogan. Deceptive copy tanks trust and conversion. */
  tagline: string;
  cta: string;
  category: OfferCategory;
  /** Env var holding the affiliate destination URL (must be NEXT_PUBLIC_* to reach the client). */
  envKey: string;
  /** Contexts this offer is relevant to. Relevance is what converts — don't show a VPN on an MP3 page. */
  contexts: OfferContext[];
  /** Optional per-platform relevance boost (surfaces this offer first on matching platform pages). */
  platforms?: PlatformKey[];
}

export interface ResolvedOffer extends Offer {
  url: string;
}

/**
 * Master offer catalog. Add rows freely — an offer stays invisible until its
 * `envKey` is set, so the catalog can ship ahead of the partnerships.
 * Order here is the default priority within a context.
 */
const CATALOG: readonly Offer[] = [
  {
    id: 'vpn',
    name: 'Download privately with a VPN',
    tagline: 'Hide your IP and unblock region-locked videos before you download them.',
    cta: 'Get the VPN deal',
    category: 'vpn',
    envKey: 'NEXT_PUBLIC_AFFILIATE_VPN_URL',
    contexts: ['downloader', 'blog'],
  },
  {
    id: 'editor',
    name: 'Edit your clips',
    tagline: 'Trim, caption and repurpose the videos you save with a fast pro editor.',
    cta: 'Try the editor',
    category: 'editor',
    envKey: 'NEXT_PUBLIC_AFFILIATE_EDITOR_URL',
    contexts: ['downloader', 'converter', 'blog'],
    platforms: ['tiktok', 'instagram', 'youtube'],
  },
  {
    id: 'storage',
    name: 'Store every download',
    tagline: 'Keep your saved videos safe in encrypted cloud storage — reach them anywhere.',
    cta: 'See storage plans',
    category: 'storage',
    envKey: 'NEXT_PUBLIC_AFFILIATE_STORAGE_URL',
    contexts: ['downloader', 'converter'],
  },
  {
    id: 'ai-writer',
    name: 'Turn transcripts into content',
    tagline: 'Repurpose a transcript into blog posts, summaries and captions with AI.',
    cta: 'Try the AI writer',
    category: 'ai',
    envKey: 'NEXT_PUBLIC_AFFILIATE_AI_URL',
    contexts: ['ai', 'blog'],
  },
  {
    id: 'recorder',
    name: 'Record your screen',
    tagline: "Capture anything that won't download with a one-click screen recorder.",
    cta: 'Get the recorder',
    category: 'recorder',
    envKey: 'NEXT_PUBLIC_AFFILIATE_RECORDER_URL',
    contexts: ['downloader', 'thumbnail'],
  },
] as const;

/**
 * Configured offers for a context (those whose env URL is set), most-relevant
 * first, capped at `limit`. When `platform` is given, offers tagged for that
 * platform are surfaced ahead of the rest — cheap contextual targeting.
 */
export function getOffers(context: OfferContext, opts: { limit?: number; platform?: PlatformKey } = {}): ResolvedOffer[] {
  const { limit = 3, platform } = opts;
  const configured = CATALOG.filter((o) => o.contexts.includes(context) && env(o.envKey));

  const ranked = platform
    ? [...configured].sort((a, b) => Number(b.platforms?.includes(platform) ?? false) - Number(a.platforms?.includes(platform) ?? false))
    : configured;

  return ranked.slice(0, limit).map((o) => ({ ...o, url: env(o.envKey) }));
}

/** The single highest-priority configured offer for a context — used by the house-ad fallback. */
export function getFeaturedOffer(context: OfferContext, platform?: PlatformKey): ResolvedOffer | null {
  return getOffers(context, { limit: 1, platform })[0] ?? null;
}

/** True when at least one offer anywhere is configured (lets callers skip the whole block). */
export const affiliateConfigured = (): boolean => CATALOG.some((o) => env(o.envKey));
