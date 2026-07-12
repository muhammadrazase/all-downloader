import type { PlatformKey } from './platforms';

/** A quality the visitor can choose to download. */
export interface QualityOption {
  quality: string; // '2160' | '1440' | '1080' | '720' | '480' | '360' | 'audio'
  label: string; // human label, e.g. "HD 1080p · MP4", "Audio · MP3"
  kind: 'video' | 'audio';
  /**
   * Direct CDN download URL. Present in API/direct mode → the browser downloads
   * straight from the source (zero server bandwidth). Absent in local/merge mode
   * → the client downloads via /api/download instead.
   */
  url?: string;
  size?: number; // bytes, when known
}

/** Response contract shared by the engine, /api/extract and the UI. */
export interface ExtractResult {
  platform: PlatformKey;
  sourceUrl: string; // echoed back so the client can build download links
  title: string;
  thumbnail?: string;
  duration?: number; // seconds
  options: QualityOption[];
}

export interface ExtractError {
  error: string;
}

/** Image tools (thumbnail grabbers) — a downloadable image asset. */
export interface ImageAsset {
  label: string; // e.g. "Max HD (1280×720)"
  url: string; // direct CDN URL (never proxied)
  width?: number;
  height?: number;
  ext: string; // 'jpg' | 'png' | ...
}

export interface ImageResult {
  source: string;
  title?: string;
  images: ImageAsset[];
}
