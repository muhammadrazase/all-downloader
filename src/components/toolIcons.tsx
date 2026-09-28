import type { ReactNode } from 'react';

// Pure presentational icon data — no registry/db imports. Shared by ToolsSection
// (a Server Component) and Sidebar (a Client Component); keeping it dependency-free
// stops Sidebar from accidentally pulling server-only code into the client bundle.

/** One consistent SVG shell (24×24, 1.8 stroke) used by every per-tool icon. */
export function ToolGlyph({ size, children }: { size: number; children: ReactNode }) {
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
export const TOOL_ICON: Record<string, ReactNode> = {
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
  // All-in-One Downloader — a link/chain mark (paste any link).
  'video-downloader': (
    <>
      <path d="M9 15l6-6" />
      <path d="M11 6l1-1a3.5 3.5 0 0 1 5 5l-1 1" />
      <path d="M13 18l-1 1a3.5 3.5 0 0 1-5-5l1-1" />
    </>
  ),
  // Chrome Extension — puzzle piece.
  'browser-extension': (
    <path d="M19.44 7.85c-.05.32.06.65.29.88l1.57 1.57c.47.47.7 1.08.7 1.7s-.23 1.23-.7 1.7l-1.61 1.61a.98.98 0 0 1-.84.28c-.47-.07-.8-.48-.97-.93a2.5 2.5 0 1 0-3.21 3.22c.44.16.85.5.92.97a.98.98 0 0 1-.28.84l-1.61 1.61c-.47.47-1.09.7-1.7.7s-1.24-.24-1.71-.71l-1.57-1.57a1.03 1.03 0 0 0-.88-.29c-.49.07-.84.5-1.02.97a2.5 2.5 0 1 1-3.24-3.24c.46-.18.9-.53.97-1.02a1.03 1.03 0 0 0-.29-.88l-1.57-1.57A2.4 2.4 0 0 1 2 12c0-.62.24-1.23.71-1.7L4.23 8.77c.24-.24.58-.35.92-.3.51.08.88.53 1.07 1.01a2.5 2.5 0 1 0 3.26-3.26c-.48-.2-.93-.56-1.01-1.07-.05-.34.06-.68.3-.92l1.53-1.52A2.4 2.4 0 0 1 12 2c.62 0 1.23.24 1.7.71l1.57 1.57c.23.23.56.34.88.29.49-.07.84-.5 1.02-.97a2.5 2.5 0 1 1 3.24 3.24c-.47.18-.9.53-.97 1.01z" />
  ),
  // Merge PDF — two sheets combining into one.
  'merge-pdf': (
    <>
      <path d="M8 3h5l4 4v7a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M13 3v4h4" />
      <path d="M8 14l3 3 3-3" />
      <path d="M11 17v-6" />
    </>
  ),
  // Split PDF — one sheet dividing into two.
  'split-pdf': (
    <>
      <path d="M8 3h5l4 4v7a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M13 3v4h4" />
      <path d="M9 12h6" strokeDasharray="2 2" />
      <path d="M8 16l-2 2 2 2M16 16l2 2-2 2" />
    </>
  ),
  // PDF Summary — document with a spark (AI condensed view).
  'pdf-summary': (
    <>
      <path d="M8 3h5l4 4v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M13 3v4h4" />
      <path d="M8 13h5M8 16h3" />
    </>
  ),
  // PDF Editor — document with a pencil.
  'pdf-editor': (
    <>
      <path d="M8 3h5l4 4v4" />
      <path d="M13 3v4h4" />
      <path d="M8 21a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2" />
      <path d="M15.5 14.5l4 4L17 21l-4-4z" />
      <path d="M8 13h4" />
    </>
  ),
  // Image to Text — image frame with text lines emerging.
  'image-to-text': (
    <>
      <rect x="3" y="4" width="10" height="10" rx="1.5" />
      <circle cx="6.5" cy="7.5" r="1.1" />
      <path d="M13 11l-2.5-2.5L3 14" />
      <path d="M16 6h5M16 9h5M16 12h3" />
    </>
  ),
  // Text to Image — text lines becoming an image frame.
  'text-to-image': (
    <>
      <path d="M3 5h8M3 9h8M3 13h5" />
      <rect x="13" y="4" width="8" height="8" rx="1.5" />
      <circle cx="16" cy="7" r="0.9" />
      <path d="M21 10l-2-2-3 3" />
    </>
  ),
  // Image Compressor — frame with inward-pointing arrows (shrink).
  'image-compressor': (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 9L5 5M5 9v-4h4" />
      <path d="M15 15l4 4M19 15v4h-4" />
    </>
  ),
  // QR Code Generator — QR-style corner squares.
  'qr-code-generator': (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 15h3v3M20 15v3h-3M14 20h2M18 20h2" />
    </>
  ),
  // Word Counter — text lines with a numeric tally mark.
  'word-counter': (
    <>
      <path d="M4 5h11M4 9h8M4 13h11M4 17h6" />
      <path d="M19 12v7M16.5 15.5l2.5-2.5 2.5 2.5" />
    </>
  ),
  // Video Trimmer — a timeline track with two trim handles.
  'video-trimmer': (
    <>
      <rect x="3" y="10" width="18" height="4" rx="1" />
      <path d="M7 7v10M17 7v10" />
    </>
  ),
  // Video Compressor — a play mark with corner arrows pulling inward.
  'video-compressor': (
    <>
      <path d="M9 8l6 4-6 4V8z" />
      <path d="M4 7V4h3M4 4l4 4" />
      <path d="M20 17v3h-3M20 20l-4-4" />
    </>
  ),
  // Audio Trimmer — a waveform bracketed by two trim markers.
  'audio-trimmer': (
    <>
      <path d="M4 10v4M8 7v10M12 5v14M16 8v8M20 10v4" />
      <path d="M6 4v16M18 4v16" strokeDasharray="2 2" />
    </>
  ),
  // Video Watermark — a video frame with a small overlaid logo badge.
  'video-watermark': (
    <>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 8.5l4 2.5-4 2.5v-5z" />
      <rect x="15" y="13" width="6" height="6" rx="1.5" />
      <path d="M17 16h2" />
    </>
  ),
  // Video Speed Changer — a speed dial with a needle.
  'video-speed-changer': (
    <>
      <path d="M12 3a9 9 0 1 0 9 9" />
      <path d="M12 12l4-4" />
      <circle cx="12" cy="12" r="1.3" />
    </>
  ),
  // Video Merger — two clips converging into one.
  'video-merger': (
    <>
      <rect x="2" y="5" width="8" height="5" rx="1.2" />
      <rect x="2" y="14" width="8" height="5" rx="1.2" />
      <path d="M11 7.5h3l3 4-3 4h-3" />
      <rect x="17" y="8" width="5" height="8" rx="1.2" />
    </>
  ),
  // Protect PDF — a document with a closed padlock.
  'protect-pdf': (
    <>
      <path d="M7 3h6l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M13 3v5h5" />
      <rect x="8.5" y="14" width="7" height="5" rx="1" />
      <path d="M10 14v-1.5a2 2 0 0 1 4 0V14" />
    </>
  ),
  // Unlock PDF — a document with an open padlock.
  'unlock-pdf': (
    <>
      <path d="M7 3h6l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M13 3v5h5" />
      <rect x="8.5" y="14" width="7" height="5" rx="1" />
      <path d="M10 14v-1.5a2 2 0 0 1 3.6-1.2" />
    </>
  ),
  // PDF to JPG — a document with an arrow into an image frame.
  'pdf-to-jpg': (
    <>
      <path d="M3 3h5l3 3v7a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 13V4.5A1.5 1.5 0 0 1 3 3z" />
      <path d="M8 3v3h3" />
      <rect x="15" y="12" width="8" height="8" rx="1.3" />
      <circle cx="17.3" cy="14.3" r="0.9" />
      <path d="M23 18l-2.5-2.5-3.5 3.5" />
    </>
  ),
  // HEIC to JPG — a photo frame with a conversion badge.
  'heic-to-jpg': (
    <>
      <rect x="3" y="5" width="14" height="14" rx="2" />
      <circle cx="8" cy="10" r="1.3" />
      <path d="M6 16l4-4 3 3 4-5" />
      <path d="M18 6a3 3 0 1 1-2.8 4" />
      <path d="M18 6l1.4-1M18 6l1.4 1.2" />
    </>
  ),
  // Image Merger — two overlapping photo frames.
  'image-merger': (
    <>
      <rect x="2" y="4" width="11" height="9" rx="1.5" />
      <circle cx="5.5" cy="7.5" r="1" />
      <path d="M13 9l-2-2-3 3" />
      <rect x="9" y="12" width="13" height="9" rx="1.5" />
      <circle cx="12.5" cy="15.5" r="1" />
      <path d="M22 17l-2-2-3 3" />
    </>
  ),
  // Social Media Resizer — three differently proportioned frames.
  'social-media-resizer': (
    <>
      <rect x="3" y="3" width="9" height="9" rx="1.5" />
      <rect x="13" y="3" width="8" height="14" rx="1.5" />
      <rect x="3" y="14" width="9" height="7" rx="1.5" />
    </>
  ),
  // QR Code Scanner — camera scan-viewfinder brackets around a code.
  'qr-code-scanner': (
    <>
      <path d="M4 8V5a1 1 0 0 1 1-1h3M20 8V5a1 1 0 0 0-1-1h-3M4 16v3a1 1 0 0 0 1 1h3M20 16v3a1 1 0 0 1-1 1h-3" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </>
  ),
  // Video Frame Grabber — a filmstrip beside a capture-shutter mark.
  'video-frame-grabber': (
    <>
      <rect x="2" y="7" width="13" height="10" rx="1.5" />
      <path d="M2 10h4M2 14h4M11 10h4M11 14h4" />
      <circle cx="19" cy="12" r="4" />
      <path d="M19 9.5v2l1.7 1" />
    </>
  ),
};

// Fallback keeps the type honest without a non-null assertion; every registry
// slug above has an explicit icon, so this is only a safety net.
export const FALLBACK_ICON: ReactNode = <circle cx="12" cy="12" r="8" />;

// One icon per category — shared by the homepage's tabs and the sidebar's rows,
// so the same category never looks different depending on where it's shown.
export const GROUP_ICON: Record<string, ReactNode> = {
  Downloaders: (
    <>
      <path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </>
  ),
  'AI video tools': <path d="M12 3l1.9 4.6L18 9.5l-4.1 1.9L12 16l-1.9-4.6L6 9.5l4.1-1.9L12 3z" />,
  'Video converters': (
    <>
      <path d="M20 8a8 8 0 0 0-14-2M4 6v4h4" />
      <path d="M4 16a8 8 0 0 0 14 2M20 18v-4h-4" />
    </>
  ),
  'Thumbnail grabbers': (
    <>
      <rect x="8" y="4" width="12" height="9" rx="2" />
      <path d="M4 8v10a2 2 0 0 0 2 2h10" />
      <circle cx="12" cy="8" r="1.3" />
      <path d="M20 11l-3-2.5-4 3" />
    </>
  ),
  'PDF tools': (
    <>
      <path d="M7 3h6l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M13 3v5h5" />
    </>
  ),
  'File & image tools': (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="M21 15l-4-4-7 7" />
    </>
  ),
  Extras: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
};

/** "All" tab/row marker — deliberately distinct from every category icon above. */
export const ALL_ICON: ReactNode = (
  <>
    <rect x="4" y="4" width="6" height="6" rx="1.3" />
    <rect x="14" y="4" width="6" height="6" rx="1.3" />
    <rect x="4" y="14" width="6" height="6" rx="1.3" />
    <rect x="14" y="14" width="6" height="6" rx="1.3" />
  </>
);

/** A ready-to-render, correctly sized tool icon — looked up by registry slug. */
export const toolGlyph = (slug: string, size = 20): ReactNode => (
  <ToolGlyph size={size}>{TOOL_ICON[slug] ?? FALLBACK_ICON}</ToolGlyph>
);
