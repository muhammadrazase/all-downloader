import type { QualityOption } from './types';

/**
 * Build the href for a download option — shared by the single and batch downloaders.
 * Direct CDN URL (API mode) → browser downloads from source (zero server bandwidth);
 * otherwise route through /api/download (local merge mode).
 */
export function buildDownloadHref(sourceUrl: string, platform: string, option: QualityOption): string {
  return option.url ?? `/api/download?u=${encodeURIComponent(sourceUrl)}&p=${platform}&q=${option.quality}`;
}

// Above this, buffering the whole file via res.blob() risks tabbing out the
// browser tab's memory (MAX_DOWNLOAD_MB defaults to 1500). The old plain
// `<a download>` streamed straight to disk with no such limit, so a large
// merge falls back to that behavior instead of losing it.
const MAX_BUFFERED_BYTES = 150 * 1024 * 1024;

// A literal '%' in a title (e.g. "100% Free") is not a URI escape and makes
// decodeURIComponent throw — fall back to the raw value rather than losing
// the whole download over a cosmetic filename.
function decodeOrRaw(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function filenameFromDisposition(disposition: string, fallback: string): string {
  // Prefer the RFC 5987 param — it's always percent-encoded, so decoding it
  // is safe. The plain `filename=` param is a raw title and may contain an
  // unescaped '%', which is exactly the case the UTF-8 param exists to avoid.
  const utf8 = /filename\*=UTF-8''([^";]+)/i.exec(disposition)?.[1];
  if (utf8) return decodeOrRaw(utf8);
  const plain = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
  return plain ? decodeOrRaw(plain) : fallback;
}

/**
 * Fetches a same-origin /api/download link and only triggers a real file save on
 * success. Without this, a failed extraction (age-restricted, region-locked, a
 * title yt-dlp can't read right now) returns a JSON error body, and a plain
 * `<a download>` link saves that JSON as a mystery "download.json" file instead
 * of showing the user what went wrong. Direct CDN URLs (option.url already set)
 * must NOT go through this — they're cross-origin, so fetch() would hit CORS;
 * those keep using plain navigation.
 */
export async function triggerLocalDownload(href: string, fallbackName = 'video.mp4'): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(href);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: data?.error || 'Could not prepare this download. Please try again.' };
    }

    const contentLength = Number(res.headers.get('content-length') ?? 0);
    if (contentLength > MAX_BUFFERED_BYTES) {
      // Already know it's a real success response — let the browser stream
      // it to disk natively instead of buffering it all in tab memory.
      await res.body?.cancel();
      window.location.href = href;
      return { ok: true };
    }

    const blob = await res.blob();
    const filename = filenameFromDisposition(res.headers.get('content-disposition') ?? '', fallbackName);
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Deferred — revoking synchronously right after click() cancels the save
    // in some Firefox/Safari versions that read the blob asynchronously.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error. Please try again.' };
  }
}
