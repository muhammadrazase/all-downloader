import type { Platform } from './platforms';

// Single source of truth for each tool's default (pre-admin-override) keyword
// list. Every tool page's generateMetadata() and the admin SEO panel's
// pre-fill both read from here, so there's one place to update, not two.

// Always true of every SnapVidly tool, so safe to cross with any keyword
// mechanically — a real per-tool copy pass (content-writer) adds the rest.
const UNIVERSAL_MODIFIERS = ['free', 'online', 'no signup'];

export function expandKeywords(base: string, modifiers: string[] = UNIVERSAL_MODIFIERS): string[] {
  return modifiers.map((m) => `${base} ${m}`);
}

export function platformKeywords(p: Platform): string[] {
  return [
    p.keyword,
    `${p.name} downloader`,
    `${p.name} video downloader`,
    `download ${p.name} videos`,
    `${p.name} downloader online`,
    `save ${p.name} video`,
    'no watermark',
    'HD',
    'MP4',
    'MP3',
    ...expandKeywords(p.keyword),
  ];
}

export const EXTRA_KEYWORDS: Record<string, string[]> = {
  'video-to-mp3': ['extract audio from video', 'youtube to mp3', 'video to mp3 online free', 'convert video to mp3 free', 'no upload'],
  'video-to-gif': ['convert video online', 'free video converter', 'online converter', 'no upload'],
  'video-converter': ['convert video online', 'free video converter', 'online converter', 'no upload'],
  'video-trimmer': ['cut video online', 'video cutter free', 'trim video no upload', 'clip video online'],
  'youtube-thumbnail': ['youtube thumbnail grabber', 'download youtube thumbnail', 'youtube thumbnail hd', 'get youtube thumbnail image', 'youtube maxresdefault', 'youtube cover image'],
  'tiktok-thumbnail': ['tiktok cover download', 'tiktok cover image', 'download tiktok thumbnail', 'tiktok thumbnail grabber'],
  'merge-pdf': ['combine pdf files', 'merge pdf offline in browser', 'merge pdf without uploading', 'join pdf files free'],
  'split-pdf': ['extract pdf pages', 'split pdf offline in browser', 'split pdf without uploading', 'separate pdf pages free'],
  'pdf-summary': ['summarize pdf ai', 'pdf summary generator', 'summarize pdf ai free no signup', 'ai document summary'],
  'pdf-editor': ['add text to pdf', 'add image to pdf', 'edit pdf without uploading to server', 'pdf editor free no signup'],
  'protect-pdf': ['add password to pdf', 'encrypt pdf online', 'password protect pdf free', 'pdf permissions'],
  'unlock-pdf': ['remove password from pdf', 'decrypt pdf online', 'pdf password remover free'],
  'pdf-to-jpg': ['pdf to image', 'pdf to png', 'convert pdf pages to jpg', 'export pdf as images free'],
  'image-to-text': ['ocr online free', 'extract text from image', 'photo to text converter', 'jpg to text'],
  'text-to-image': ['text to image converter', 'quote image maker', 'text to png', 'code screenshot generator'],
  'image-compressor': ['reduce image size', 'compress jpeg online', 'compress png online', 'photo compressor free'],
  'qr-code-generator': ['free qr code maker', 'qr code creator online', 'generate qr code from link'],
  'word-counter': ['character counter', 'word count tool', 'reading time calculator', 'readability score checker'],
  'heic-to-jpg': ['convert heic to jpg', 'iphone photo converter', 'heic to png', 'open heic file free'],
  'video-compressor': ['compress video online', 'reduce video file size', 'shrink video free', 'video size reducer', 'compress mp4 online free'],
  'audio-trimmer': ['cut mp3 online free', 'audio cutter', 'trim mp3 online', 'crop audio file free'],
  'video-watermark': ['add logo to video', 'video logo overlay', 'watermark maker free', 'brand video online'],
  'image-merger': ['combine photos online', 'photo collage maker', 'join images together', 'picture combiner free'],
  'social-media-resizer': ['instagram post size', 'resize image for instagram', 'youtube thumbnail size', 'social media image sizes 2026'],
  'qr-code-scanner': ['scan qr code online', 'read qr code from image', 'qr code decoder free', 'qr scanner no app'],
  'video-speed-changer': ['slow motion video maker', 'speed up video online free', 'fast forward video', 'change video speed online'],
  'video-frame-grabber': ['video screenshot tool', 'get thumbnail from video file', 'video to jpg', 'capture frame from video'],
  'video-merger': ['combine videos online', 'join video clips free', 'video joiner no upload', 'concatenate videos online'],
};

/** For every non-platform, non-AI tool (AI tools already carry their own `keywords[]`). */
export function toolKeywords(key: string, primaryKeyword: string): string[] {
  return [primaryKeyword, ...expandKeywords(primaryKeyword), ...(EXTRA_KEYWORDS[key] ?? [])];
}
