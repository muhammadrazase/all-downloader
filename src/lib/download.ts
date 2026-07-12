import type { QualityOption } from './types';

/**
 * Build the href for a download option — shared by the single and batch downloaders.
 * Direct CDN URL (API mode) → browser downloads from source (zero server bandwidth);
 * otherwise route through /api/download (local merge mode).
 */
export function buildDownloadHref(sourceUrl: string, platform: string, option: QualityOption): string {
  return option.url ?? `/api/download?u=${encodeURIComponent(sourceUrl)}&p=${platform}&q=${option.quality}`;
}
