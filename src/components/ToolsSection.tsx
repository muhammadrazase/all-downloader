import type { ReactNode } from 'react';
import { PLATFORM_LIST, type Platform } from '@/lib/platforms';
import { AI_TOOL_LIST } from '@/lib/aiTools';
import { CONVERTER_LIST } from '@/lib/converterTools';
import { IMAGE_TOOL_LIST } from '@/lib/imageTools';
import { PDF_TOOL_LIST } from '@/lib/pdfTools';
import { FILE_TOOL_LIST } from '@/lib/fileTools';
import { filterVisible } from '@/lib/config/contentConfig';
import { PlatformIcon } from './PlatformIcon';
import { toolGlyph, GROUP_ICON } from './toolIcons';
import { JsonLd } from './JsonLd';
import { itemListSchema } from '@/lib/schema';
import { ToolDirectoryGrid } from './ToolDirectoryGrid';

/** The full tool catalog — registry-driven. "Downloaders" is one category among
 * several here, not a separately-treated tier. One accent color only. */

export interface ToolItem {
  name: string;
  href: string;
  blurb: string;
  icon: ReactNode; // distinct line icon per tool, pre-wrapped in <ToolGlyph>
}
export interface ToolGroup {
  label: string;
  description: string; // one-line category caption, shown when that category is filtered to
  icon: ReactNode; // category marker, drawn inside <ToolGlyph>
  badge?: string;
  items: ToolItem[];
}

// One-line benefit per tool (by slug) — controlled copy, not the long page intro.
const BLURB: Record<string, string> = {
  'video-downloader': 'Paste a link from any supported platform',
  'batch-video-downloader': 'Download multiple videos at once',
  'video-to-text': 'Get subtitles + SRT from any video',
  'video-summary': 'Summarize video · get key points',
  'video-to-mp3': 'Extract audio · video to MP3',
  'video-to-gif': 'Video to GIF from any clip',
  'video-converter': 'Free video converter · no upload',
  'youtube-thumbnail-downloader': 'Download YouTube thumbnails in HD',
  'tiktok-thumbnail-downloader': 'Save TikTok thumbnail + cover image',
  'merge-pdf': 'Combine multiple PDFs into one',
  'split-pdf': 'Extract pages from a PDF by range',
  'pdf-summary': 'AI summary + key points from any PDF',
  'pdf-editor': 'Add text, images and tables to a PDF',
  'image-to-text': 'Extract text from any image (OCR)',
  'text-to-image': 'Turn text into a downloadable image',
  'image-compressor': 'Shrink photo file size, no upload',
  'qr-code-generator': 'Free QR codes for links, Wi-Fi & more',
  'word-counter': 'Words, characters, reading time & readability',
  'video-trimmer': 'Cut a clip to the exact length you need',
  'video-compressor': 'Shrink video file size without losing quality',
  'audio-trimmer': 'Cut an audio clip to the exact length you need',
  'video-watermark': 'Add your logo or text overlay to a video',
  'video-speed-changer': 'Speed up or slow down any video',
  'video-merger': 'Combine multiple video clips into one',
  'protect-pdf': 'Add a password to keep your PDF private',
  'unlock-pdf': 'Remove a password from a protected PDF',
  'pdf-to-jpg': 'Export PDF pages as JPG images',
  'heic-to-jpg': 'Convert iPhone photos to a JPG anyone can open',
  'image-merger': 'Combine multiple photos into one image',
  'social-media-resizer': 'Resize any image to fit any platform',
  'qr-code-scanner': 'Scan any QR code with your camera',
  'video-frame-grabber': 'Save any frame from a video as an image',
};

const toItems = (list: { name: string; slug: string }[]): ToolItem[] =>
  list.map((t) => ({
    name: t.name,
    href: `/${t.slug}`,
    blurb: BLURB[t.slug] ?? '',
    icon: toolGlyph(t.slug),
  }));

const toPlatformItems = (list: Platform[]): ToolItem[] =>
  list.map((p) => ({
    name: p.name,
    href: `/${p.slug}`,
    blurb: `Download ${p.name} videos in HD`,
    // No brandColor here on purpose — one accent color only, matching every other card.
    icon: <PlatformIcon platform={p.key} className="h-5 w-5" />,
  }));

/** Built at render time so admin visibility toggles apply on the next regen.
 * "Downloaders" is listed first (highest traffic) but uses the same card system as the rest. */
function buildGroups(): ToolGroup[] {
  return [
    {
      label: 'Downloaders',
      description: 'Save videos from any platform. Free, fast and no watermark.',
      icon: GROUP_ICON['Downloaders'],
      items: [
        ...toPlatformItems(filterVisible('platform', PLATFORM_LIST, (p) => p.key)),
        { name: 'All-in-One Downloader', href: '/video-downloader', blurb: BLURB['video-downloader'] ?? '', icon: toolGlyph('video-downloader') },
        { name: 'Bulk Downloader', href: '/batch-video-downloader', blurb: BLURB['batch-video-downloader'] ?? '', icon: toolGlyph('batch-video-downloader') },
      ],
    },
    {
      label: 'AI video tools',
      description: 'Turn any video into text or a summary with AI.',
      badge: 'New',
      icon: GROUP_ICON['AI video tools'],
      items: toItems(filterVisible('ai-tool', AI_TOOL_LIST, (t) => t.key)),
    },
    {
      label: 'Video converters',
      description: 'Convert to MP3, GIF or another format, right in your browser.',
      icon: GROUP_ICON['Video converters'],
      items: toItems(filterVisible('converter', CONVERTER_LIST, (t) => t.key)),
    },
    {
      label: 'Thumbnail grabbers',
      description: 'Save cover images in full resolution, free.',
      icon: GROUP_ICON['Thumbnail grabbers'],
      items: toItems(filterVisible('image-tool', IMAGE_TOOL_LIST, (t) => t.key)),
    },
    {
      label: 'PDF tools',
      description: 'Merge, split, summarize and edit PDFs, right in your browser.',
      icon: GROUP_ICON['PDF tools'],
      items: toItems(filterVisible('pdf-tool', PDF_TOOL_LIST, (t) => t.key)),
    },
    {
      label: 'File & image tools',
      description: 'Handy utilities that run entirely on your device.',
      icon: GROUP_ICON['File & image tools'],
      items: toItems(filterVisible('file-tool', FILE_TOOL_LIST, (t) => t.key)),
    },
    {
      label: 'Extras',
      description: 'A couple of extra ways to use SnapVidly.',
      icon: GROUP_ICON['Extras'],
      items: [
        { name: 'Browser Extension', href: '/browser-extension', blurb: 'One-click video download, any site', icon: toolGlyph('browser-extension') },
      ],
    },
  ];
}

/** Every tool up front in the server-rendered HTML (fully crawlable, all 44 links
 * present regardless of client state), with a client-side category filter on top
 * so browsing doesn't mean scrolling past every section to find one category. */
export function ToolDirectory() {
  const groups = buildGroups();
  return (
    <div className="mx-auto max-w-5xl">
      {groups.map((group) => (
        <JsonLd
          key={group.label}
          data={itemListSchema(
            `SnapVidly — ${group.label}`,
            group.items.map((i) => ({ name: i.name, path: i.href, description: i.blurb })),
          )}
        />
      ))}
      <ToolDirectoryGrid groups={groups} />
    </div>
  );
}
