'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { detectPlatform, getPlatformByKey, type Platform, type PlatformKey } from '@/lib/platforms';
import type { ExtractResult, QualityOption } from '@/lib/types';
import { PlatformIcon } from './PlatformIcon';

type Status = 'idle' | 'invalid' | 'fetching' | 'ready' | 'error';

interface Props {
  /**
   * When set, the box is locked to one platform (tool pages). Only the string key
   * crosses the server→client boundary — the full Platform (which holds a RegExp)
   * is resolved from the bundled registry on the client.
   */
  platformKey?: PlatformKey;
  autoFocus?: boolean;
}

export function DownloaderBox({ platformKey, autoFocus }: Props) {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<ExtractResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const locked = useMemo<Platform | undefined>(
    () => (platformKey ? getPlatformByKey(platformKey) : undefined),
    [platformKey],
  );

  // Auto-detect from the pasted URL unless the page locks a platform.
  const detected = useMemo<Platform | undefined>(
    () => locked ?? detectPlatform(url),
    [locked, url],
  );

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        inputRef.current?.focus();
      }
    } catch {
      // Clipboard permission denied — user can paste manually. Not an error.
      inputRef.current?.focus();
    }
  }, []);

  const runExtraction = useCallback(
    async (trimmed: string) => {
      if (!trimmed) {
        setStatus('invalid');
        setMessage('Paste a video link to get started.');
        return;
      }
      const target = locked ?? detectPlatform(trimmed);
      if (!target) {
        setStatus('invalid');
        setMessage('That link is not from a supported platform.');
        return;
      }
      setStatus('fetching');
      setMessage('');
      setResult(null);
      try {
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: trimmed, platform: target.key as PlatformKey }),
        });
        const data = (await res.json()) as ExtractResult | { error: string };
        if (!res.ok || 'error' in data) {
          setStatus('error');
          setMessage(('error' in data && data.error) || 'Could not fetch this video. Please try again.');
          return;
        }
        setResult(data);
        setStatus('ready');
      } catch {
        setStatus('error');
        setMessage('Network error. Check your connection and try again.');
      }
    },
    [locked],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      void runExtraction(url.trim());
    },
    [url, runExtraction],
  );

  // Deep-link support: /?grab=<url> from the browser extension, PWA share target
  // or a bookmarklet — auto-fill and auto-run. Only on the universal (unlocked) box.
  const [imported, setImported] = useState(false);
  useEffect(() => {
    if (locked) return;
    const g = new URLSearchParams(window.location.search).get('grab');
    if (g && detectPlatform(g)) {
      setUrl(g);
      setImported(true);
      void runExtraction(g.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => {
    setUrl('');
    setResult(null);
    setStatus('idle');
    setMessage('');
    inputRef.current?.focus();
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="card p-2 shadow-lg sm:flex sm:items-center sm:gap-2">
        <div className="flex flex-1 items-center gap-2 px-2">
          <PlatformDot platform={detected} />
          <input
            ref={inputRef}
            type="url"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            /* eslint-disable-next-line jsx-a11y/no-autofocus */
            autoFocus={autoFocus}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (status !== 'idle') setStatus('idle');
            }}
            placeholder={
              locked ? `Paste a ${locked.name} link…` : 'Paste any video link — TikTok, Instagram, YouTube, X, Reddit & more…'
            }
            aria-label={locked ? `${locked.name} video URL` : 'Video URL'}
            className="h-12 w-full bg-transparent text-base text-ink placeholder:text-ink-faint focus:outline-none"
          />
          {url && (
            <button type="button" onClick={reset} aria-label="Clear" className="text-ink-faint hover:text-ink">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        <div className="mt-2 flex gap-2 sm:mt-0">
          <button type="button" onClick={pasteFromClipboard} className="btn-ghost h-12 flex-1 sm:flex-none">
            Paste
          </button>
          <button type="submit" disabled={status === 'fetching'} className="btn-accent h-12 flex-1 sm:flex-none">
            {status === 'fetching' ? <Spinner /> : 'Download'}
          </button>
        </div>
      </form>

      {imported && (
        <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
          ✓ Imported from share
        </p>
      )}

      {/* Status region — announced to screen readers, never a blank screen. */}
      <div aria-live="polite" className="mt-4">
        {(status === 'invalid' || status === 'error') && (
          <p className="animate-fade-up rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
            {message}
          </p>
        )}
        {status === 'fetching' && (
          <p className="animate-fade-up text-sm text-ink-muted">Fetching your video…</p>
        )}
        {status === 'ready' && result && <ResultCard result={result} />}
      </div>
    </div>
  );
}

function ResultCard({ result }: { result: ExtractResult }) {
  const p = getPlatformByKey(result.platform);
  return (
    <div className="card animate-fade-up overflow-hidden p-4 sm:flex sm:gap-4">
      {result.thumbnail && (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-surface-soft sm:w-52">
          {/* Unoptimized: thumbnails are one-off external images — this avoids
              routing them through our optimizer (no open-proxy surface). */}
          <Image src={result.thumbnail} alt={result.title} fill sizes="(max-width: 640px) 100vw, 208px" className="object-cover" unoptimized />
        </div>
      )}
      <div className="mt-3 flex-1 sm:mt-0">
        <div className="flex items-center gap-2 text-xs font-medium text-ink-faint">
          {p && <PlatformIcon platform={p.key} color={p.brandColor} className="h-4 w-4" />}
          {p?.name}
          {result.duration ? <span>· {formatDuration(result.duration)}</span> : null}
        </div>
        <p className="mt-1 line-clamp-2 font-medium text-ink">{result.title}</p>

        {result.options.length > 0 && (
          <>
            {/* Highest quality is the default primary action. */}
            <div className="mt-3">
              <OptionButton
                option={result.options[0]!}
                sourceUrl={result.sourceUrl}
                platform={result.platform}
                primary
              />
            </div>
            {result.options.length > 1 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-ink-faint">Or choose another quality:</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {result.options.slice(1).map((o) => (
                    <OptionButton key={o.quality} option={o} sourceUrl={result.sourceUrl} platform={result.platform} />
                  ))}
                </div>
              </div>
            )}
            <p className="mt-3 text-xs text-ink-faint">
              HD videos are prepared on demand and may take a few seconds.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function OptionButton({
  option,
  sourceUrl,
  platform,
  primary = false,
}: {
  option: QualityOption;
  sourceUrl: string;
  platform: string;
  primary?: boolean;
}) {
  // Direct CDN URL (API mode) → download straight from source, zero server
  // bandwidth. Otherwise route through /api/download (local merge mode).
  const href = option.url ?? `/api/download?u=${encodeURIComponent(sourceUrl)}&p=${platform}&q=${option.quality}`;
  const cls = primary
    ? 'btn-accent'
    : 'inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent';
  return (
    <a href={href} download rel="nofollow noopener" target={option.url ? '_blank' : undefined} className={cls}>
      <svg width={primary ? 18 : 16} height={primary ? 18 : 16} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 4v10m0 0-4-4m4 4 4-4M5 19h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {primary ? `Download ${option.label}` : option.label}
    </a>
  );
}

function PlatformDot({ platform }: { platform?: Platform }) {
  // Show the detected platform's real logo; a neutral dot before detection.
  if (platform) {
    return <PlatformIcon platform={platform.key} color={platform.brandColor} className="h-5 w-5 shrink-0" />;
  }
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-ink-faint" aria-hidden="true" />;
}

function Spinner() {
  return (
    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
