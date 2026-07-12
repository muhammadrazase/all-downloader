'use client';

import { useEffect, useState } from 'react';
import { site } from '@/lib/site';

/**
 * Chrome-focused install CTA. Uses NEXT_PUBLIC_CHROME_EXTENSION_URL when set,
 * otherwise shows "coming soon". Detects the visitor's browser to tailor the
 * message (Chromium → add directly; others → nudge to the bookmarklet below).
 */
export function InstallExtensionCTA() {
  const url = site.chromeExtensionUrl;
  const [isChromium, setIsChromium] = useState<boolean | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    // Chrome/Brave/Edge/Opera (Chromium) desktop — where the extension installs.
    setIsChromium(/Chrome|Chromium|CriOS/.test(ua) && !/Mobile|Android/.test(ua));
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="btn-accent px-6 py-3 text-base">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 4v10m0 0-4-4m4 4 4-4M5 19h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Add to Chrome — Free
        </a>
      ) : (
        <span className="btn-ghost cursor-default px-6 py-3 text-base opacity-80" aria-disabled="true">
          Coming soon to the Chrome Web Store
        </span>
      )}

      <p className="text-xs text-ink-muted">
        {isChromium === false
          ? 'Built for Chrome (and Chromium browsers). On other browsers, use the bookmarklet below — it works everywhere.'
          : 'Works in Chrome, Brave, Edge and other Chromium browsers · free · no signup'}
      </p>
    </div>
  );
}
