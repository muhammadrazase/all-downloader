import type { Faq } from './platforms';

/**
 * Image tools (thumbnail grabbers). Free, no keys.
 *  - mode 'client' → resolved in the browser (YouTube: pure URL, zero server).
 *  - mode 'server' → hits /api/grab (TikTok: light yt-dlp thumbnail lookup).
 */
export type ImageToolKey = 'youtube-thumbnail' | 'tiktok-thumbnail';

export interface ImageTool {
  key: ImageToolKey;
  mode: 'client' | 'server';
  name: string;
  slug: string;
  keyword: string;
  brandColor: string;
  hostPattern: RegExp;
  urlExample: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  features: { title: string; body: string }[];
  steps: string[];
  faqs: Faq[];
}

export const IMAGE_TOOLS: Record<ImageToolKey, ImageTool> = {
  'youtube-thumbnail': {
    key: 'youtube-thumbnail',
    mode: 'client',
    name: 'YouTube Thumbnail',
    slug: 'youtube-thumbnail-downloader',
    keyword: 'YouTube thumbnail downloader',
    brandColor: '#FF0000',
    hostPattern: /^https?:\/\/([\w-]+\.)?(youtube\.com|youtu\.be|m\.youtube\.com)\//i,
    urlExample: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    metaTitle: 'YouTube Thumbnail Downloader — Grab HD Thumbnails Free',
    metaDescription:
      'Download any YouTube video thumbnail in full HD (1280×720) for free. Paste a YouTube link and grab the cover image in all sizes — instant, no signup.',
    h1: 'YouTube Thumbnail Downloader — HD',
    intro:
      'Grab the thumbnail (cover image) from any YouTube video in full HD. Paste a video link and instantly download the thumbnail in every available size — Max HD, HQ, SD and more. Perfect for research, reaction videos, and design references. Free, instant, no signup.',
    features: [
      { title: 'Full HD (1280×720)', body: 'Download the maximum-resolution thumbnail YouTube stores.' },
      { title: 'All sizes', body: 'Get HD, HQ, SD and medium sizes — pick what you need.' },
      { title: 'Instant', body: 'Resolves in your browser — no waiting, no server processing.' },
      { title: 'Free & unlimited', body: 'No signup, no limits, no watermark.' },
    ],
    steps: [
      'Copy the link of any YouTube video (Share → Copy link).',
      'Paste it into the box above.',
      'Press Get thumbnails.',
      'Click any size to download the image.',
    ],
    faqs: [
      { q: 'How do I download a YouTube thumbnail in HD?', a: 'Paste the video link and click Get thumbnails — the Max HD (1280×720) version is the first option. Click it to save.' },
      { q: 'Can I get thumbnails from Shorts?', a: 'Yes. Paste a YouTube Shorts link and you’ll get its thumbnail the same way.' },
      { q: 'Is it free?', a: 'Completely free, unlimited, and no signup — the thumbnails resolve instantly in your browser.' },
      { q: 'What sizes are available?', a: 'Max HD (1280×720), HQ (480×360), SD (640×480) and Medium (320×180). Not every video has the Max HD version.' },
    ],
  },
  'tiktok-thumbnail': {
    key: 'tiktok-thumbnail',
    mode: 'server',
    name: 'TikTok Thumbnail',
    slug: 'tiktok-thumbnail-downloader',
    keyword: 'TikTok thumbnail downloader',
    brandColor: '#000000',
    hostPattern: /^https?:\/\/([\w-]+\.)?(tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)\//i,
    urlExample: 'https://www.tiktok.com/@username/video/1234567890',
    metaTitle: 'TikTok Thumbnail Downloader — Save TikTok Cover Image Free',
    metaDescription:
      'Download the thumbnail / cover image of any TikTok video in HD for free. Paste a TikTok link and save the cover photo — no app, no signup, no watermark.',
    h1: 'TikTok Thumbnail Downloader — Cover Image',
    intro:
      'Save the thumbnail (cover image) of any public TikTok video. Paste a TikTok link and download the cover photo in high quality — great for previews, thumbnails and design. Free, no app, no signup.',
    features: [
      { title: 'HD cover', body: 'Download the TikTok cover image in the best quality available.' },
      { title: 'No watermark', body: 'Get the clean cover with no TikTok overlay.' },
      { title: 'No app', body: 'Runs in any browser on phone or computer.' },
      { title: 'Free', body: 'No signup, no limits.' },
    ],
    steps: [
      'Open TikTok, tap Share on the video, then Copy link.',
      'Paste the link into the box above.',
      'Press Get thumbnail.',
      'Click Download to save the cover image.',
    ],
    faqs: [
      { q: 'How do I download a TikTok thumbnail?', a: 'Copy the video link, paste it here, and press Get thumbnail — then click Download to save the cover image.' },
      { q: 'Is the thumbnail in HD?', a: 'Yes, we fetch the highest-quality cover image TikTok provides for the video.' },
      { q: 'Do I need the TikTok app?', a: 'No — it works in any mobile or desktop browser.' },
      { q: 'Is it free?', a: 'Yes, free with no signup or watermark.' },
    ],
  },
};

export const IMAGE_TOOL_LIST: ImageTool[] = Object.values(IMAGE_TOOLS);
export const getImageToolBySlug = (slug: string): ImageTool | undefined =>
  IMAGE_TOOL_LIST.find((t) => t.slug === slug);
