import type { ReactNode } from 'react';
import Link from 'next/link';
import { AI_TOOL_LIST } from '@/lib/aiTools';
import { CONVERTER_LIST } from '@/lib/converterTools';
import { IMAGE_TOOL_LIST } from '@/lib/imageTools';
import { JsonLd } from './JsonLd';
import { itemListSchema } from '@/lib/schema';

/**
 * Homepage "toolkit" section — surfaces the whole tool ecosystem (AI, converters,
 * thumbnails, utilities) that was otherwise buried in the nav dropdown.
 * Server-rendered, registry-driven (auto-grows), pure internal-link mesh for SEO,
 * zero client JS. One accent color only — categories and tools differ by label and
 * icon, never by colour (no rainbow).
 */

interface ToolItem {
  name: string;
  href: string;
  blurb: string;
  icon: ReactNode; // distinct line icon per tool, drawn inside <ToolGlyph>
}
interface ToolGroup {
  label: string;
  description: string; // short rail copy, sits under the label
  icon: ReactNode; // category marker, drawn inside <ToolGlyph>
  badge?: string;
  items: ToolItem[];
}

/**
 * One consistent SVG shell for every glyph: 24×24 canvas, 1.8 stroke, round joins.
 * Stroke inherits to children, so each icon below is just its geometry.
 */
function ToolGlyph({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// Distinct, tasteful line icon per tool (keyed by slug) — no two cards repeat a glyph.
const TOOL_ICON: Record<string, ReactNode> = {
  // Video to Text — document with caption lines.
  'video-to-text': (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </>
  ),
  // Video Summary — condensed lines + a spark (AI key points).
  'video-summary': (
    <>
      <path d="M4 7h9M4 12h9M4 17h6" />
      <path d="M18 4l1 2.4 2.4 1-2.4 1L18 11l-1-2.6-2.4-1 2.4-1L18 4z" />
    </>
  ),
  // Video to MP3 — music note.
  'video-to-mp3': (
    <>
      <path d="M9 17V5l10-2v12" />
      <circle cx="6.5" cy="17" r="2.5" />
      <circle cx="16.5" cy="15" r="2.5" />
    </>
  ),
  // Video to GIF — film strip.
  'video-to-gif': (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M8 6v12M16 6v12M3 10h5M3 14h5M16 10h5M16 14h5" />
    </>
  ),
  // Video Converter — two-way swap between formats.
  'video-converter': (
    <>
      <path d="M4 8h13M14 5l3 3-3 3" />
      <path d="M20 16H7M10 13l-3 3 3 3" />
    </>
  ),
  // YouTube Thumbnail — image / photo frame.
  'youtube-thumbnail-downloader': (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="M21 15l-4-4-7 7" />
    </>
  ),
  // TikTok Thumbnail — image frame with a play mark (video cover).
  'tiktok-thumbnail-downloader': (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M10 9.5l4 2.5-4 2.5v-5z" />
    </>
  ),
  // Bulk Downloader — stacked layers.
  'batch-video-downloader': (
    <>
      <path d="M12 3l9 4.5-9 4.5-9-4.5L12 3z" />
      <path d="M3 12l9 4.5 9-4.5" />
      <path d="M3 16.5l9 4.5 9-4.5" />
    </>
  ),
  // Chrome Extension — puzzle piece.
  'browser-extension': (
    <path d="M19.44 7.85c-.05.32.06.65.29.88l1.57 1.57c.47.47.7 1.08.7 1.7s-.23 1.23-.7 1.7l-1.61 1.61a.98.98 0 0 1-.84.28c-.47-.07-.8-.48-.97-.93a2.5 2.5 0 1 0-3.21 3.22c.44.16.85.5.92.97a.98.98 0 0 1-.28.84l-1.61 1.61c-.47.47-1.09.7-1.7.7s-1.24-.24-1.71-.71l-1.57-1.57a1.03 1.03 0 0 0-.88-.29c-.49.07-.84.5-1.02.97a2.5 2.5 0 1 1-3.24-3.24c.46-.18.9-.53.97-1.02a1.03 1.03 0 0 0-.29-.88l-1.57-1.57A2.4 2.4 0 0 1 2 12c0-.62.24-1.23.71-1.7L4.23 8.77c.24-.24.58-.35.92-.3.51.08.88.53 1.07 1.01a2.5 2.5 0 1 0 3.26-3.26c-.48-.2-.93-.56-1.01-1.07-.05-.34.06-.68.3-.92l1.53-1.52A2.4 2.4 0 0 1 12 2c.62 0 1.23.24 1.7.71l1.57 1.57c.23.23.56.34.88.29.49-.07.84-.5 1.02-.97a2.5 2.5 0 1 1 3.24 3.24c-.47.18-.9.53-.97 1.01z" />
  ),
};

// Category marker per group — deliberately distinct from the tool glyphs above.
const AI_GROUP_ICON: ReactNode = (
  <path d="M12 3l1.9 4.6L18 9.5l-4.1 1.9L12 16l-1.9-4.6L6 9.5l4.1-1.9L12 3z" />
);
const CONVERTER_GROUP_ICON: ReactNode = (
  <>
    <path d="M20 8a8 8 0 0 0-14-2M4 6v4h4" />
    <path d="M4 16a8 8 0 0 0 14 2M20 18v-4h-4" />
  </>
);
const IMAGE_GROUP_ICON: ReactNode = (
  <>
    <rect x="8" y="4" width="12" height="9" rx="2" />
    <path d="M4 8v10a2 2 0 0 0 2 2h10" />
    <circle cx="12" cy="8" r="1.3" />
    <path d="M20 11l-3-2.5-4 3" />
  </>
);
const UTILITY_GROUP_ICON: ReactNode = (
  <>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </>
);

// One-line benefit per tool (by slug) — controlled copy, not the long page intro.
const BLURB: Record<string, string> = {
  'video-to-text': 'Get subtitles + SRT from any video',
  'video-summary': 'Summarize video · get key points',
  'video-to-mp3': 'Extract audio · video to MP3',
  'video-to-gif': 'Video to GIF from any clip',
  'video-converter': 'Free video converter · no upload',
  'youtube-thumbnail-downloader': 'Download YouTube thumbnails in HD',
  'tiktok-thumbnail-downloader': 'Save TikTok thumbnail + cover image',
};

// Fallback keeps the type honest without a non-null assertion; every registry
// slug above has an explicit icon, so this is only a safety net.
const FALLBACK_ICON: ReactNode = <circle cx="12" cy="12" r="8" />;

const toItems = (list: { name: string; slug: string }[]): ToolItem[] =>
  list.map((t) => ({
    name: t.name,
    href: `/${t.slug}`,
    blurb: BLURB[t.slug] ?? '',
    icon: TOOL_ICON[t.slug] ?? FALLBACK_ICON,
  }));

const GROUPS: ToolGroup[] = [
  {
    label: 'AI video tools',
    description: 'Turn any video into text or a summary with AI.',
    badge: 'New',
    icon: AI_GROUP_ICON,
    items: toItems(AI_TOOL_LIST),
  },
  {
    label: 'Video converters',
    description: 'Convert to MP3, GIF or another format — in your browser.',
    icon: CONVERTER_GROUP_ICON,
    items: toItems(CONVERTER_LIST),
  },
  {
    label: 'Thumbnail grabbers',
    description: 'Save cover images in full resolution, free.',
    icon: IMAGE_GROUP_ICON,
    items: toItems(IMAGE_TOOL_LIST),
  },
  {
    label: 'Utilities',
    description: 'Power tools to download faster and everywhere.',
    icon: UTILITY_GROUP_ICON,
    items: [
      {
        name: 'Bulk Downloader',
        href: '/batch-video-downloader',
        blurb: 'Download multiple videos at once',
        icon: TOOL_ICON['batch-video-downloader'] ?? FALLBACK_ICON,
      },
      {
        name: 'Chrome Extension',
        href: '/browser-extension',
        blurb: 'One-click video download, any site',
        icon: TOOL_ICON['browser-extension'] ?? FALLBACK_ICON,
      },
    ],
  },
];

// Flatten to one ordered list (AI first) — the homepage shows a single clean grid,
// not four category sections. `isNew` flags the AI differentiators.
const FLAT_TOOLS = GROUPS.flatMap((g) => g.items.map((it) => ({ ...it, isNew: g.badge === 'New' })));

const ALL_ITEMS = FLAT_TOOLS.map((i) => ({ name: i.name, path: i.href, description: i.blurb }));

/** Shared tool card — used by both the homepage highlights and the /tools hub. */
function ToolCard({ item }: { item: ToolItem & { isNew?: boolean } }) {
  return (
    <Link
      href={item.href}
      className="card group flex items-start gap-3 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md sm:min-w-[13rem] sm:flex-1"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent transition-colors duration-200 group-hover:bg-accent group-hover:text-white">
        <ToolGlyph size={20}>{item.icon}</ToolGlyph>
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="font-semibold text-ink transition-colors duration-200 group-hover:text-accent">{item.name}</span>
          {item.isNew && (
            <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent">New</span>
          )}
        </span>
        {item.blurb && <span className="mt-0.5 block text-sm text-ink-muted">{item.blurb}</span>}
      </span>
    </Link>
  );
}

// Homepage shows only the flagship tools — the differentiators — not the full list.
const HIGHLIGHT_HREFS = new Set(['/video-to-text', '/video-summary', '/video-to-mp3', '/youtube-thumbnail-downloader']);
const HIGHLIGHTS = FLAT_TOOLS.filter((t) => HIGHLIGHT_HREFS.has(t.href));

/** Compact, curated homepage teaser → links through to the full /tools hub. */
export function ToolsSection() {
  return (
    <section className="container-page py-16" aria-labelledby="toolkit-heading">
      <div className="mx-auto max-w-2xl text-center">
        <h2 id="toolkit-heading" className="text-3xl">More than a downloader</h2>
        <p className="mt-3 text-ink-muted">
          Free AI tools to get more out of any video — turn it into text, a summary, an MP3 or a thumbnail.
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-3xl gap-3 sm:grid-cols-2">
        {HIGHLIGHTS.map((item) => (
          <ToolCard key={item.href} item={item} />
        ))}
      </div>

      <div className="mt-8 text-center">
        <Link href="/tools" className="inline-flex items-center gap-1.5 font-medium text-accent hover:text-accent-hover">
          See all tools
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </section>
  );
}

/** Full categorized toolkit — for the dedicated /tools hub page. */
export function ToolsHub() {
  return (
    <div className="mx-auto max-w-5xl">
      <JsonLd data={itemListSchema('SnapVidly tools', ALL_ITEMS)} />
      <div className="divide-y divide-surface-border">
        {GROUPS.map((group) => (
          <div key={group.label} className="grid gap-6 py-8 first:pt-0 last:pb-0 md:grid-cols-[15rem_1fr] md:gap-10">
            <div>
              <h2 className="flex items-center gap-2.5">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <ToolGlyph size={17}>{group.icon}</ToolGlyph>
                </span>
                <span className="text-base font-semibold text-ink">{group.label}</span>
                {group.badge && (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">{group.badge}</span>
                )}
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">{group.description}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {group.items.map((item) => (
                <ToolCard key={item.href} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
