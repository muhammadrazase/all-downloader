'use client';

import { useCallback, useRef, useState } from 'react';
import { IMAGE_TOOLS, type ImageToolKey } from '@/lib/imageTools';
import { youtubeThumbnails } from '@/lib/thumbnails';
import type { ImageAsset, ImageResult } from '@/lib/types';

type Status = 'idle' | 'invalid' | 'fetching' | 'ready' | 'error';

export function ImageDownloaderBox({ toolKey, autoFocus }: { toolKey: ImageToolKey; autoFocus?: boolean }) {
  const tool = IMAGE_TOOLS[toolKey];
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [images, setImages] = useState<ImageAsset[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text);
    } catch {
      /* permission denied — user pastes manually */
    }
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = url.trim();
      if (!trimmed || !tool.hostPattern.test(trimmed)) {
        setStatus('invalid');
        setMessage(`Please paste a valid ${tool.name.replace(' Thumbnail', '')} link.`);
        return;
      }

      // Client mode (YouTube): build URLs in the browser — no server call.
      if (tool.mode === 'client') {
        const assets = youtubeThumbnails(trimmed);
        if (!assets.length) {
          setStatus('invalid');
          setMessage('Could not read the video id from that link.');
          return;
        }
        setImages(assets);
        setStatus('ready');
        return;
      }

      // Server mode (TikTok): fetch via /api/grab.
      setStatus('fetching');
      setMessage('');
      try {
        const res = await fetch('/api/grab', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: trimmed, tool: toolKey }),
        });
        const data = (await res.json()) as ImageResult | { error: string };
        if (!res.ok || 'error' in data) {
          setStatus('error');
          setMessage(('error' in data && data.error) || 'Could not fetch this thumbnail.');
          return;
        }
        setImages(data.images);
        setStatus('ready');
      } catch {
        setStatus('error');
        setMessage('Network error. Please try again.');
      }
    },
    [url, tool, toolKey],
  );

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="card p-2 shadow-lg sm:flex sm:items-center sm:gap-2">
        <div className="flex flex-1 items-center gap-2 px-2">
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tool.brandColor }} aria-hidden="true" />
          <input
            ref={inputRef}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            /* eslint-disable-next-line jsx-a11y/no-autofocus */
            autoFocus={autoFocus}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (status !== 'idle') setStatus('idle');
            }}
            placeholder={`Paste a ${tool.name.replace(' Thumbnail', '')} link…`}
            aria-label={`${tool.name} URL`}
            className="h-12 w-full bg-transparent text-base text-ink placeholder:text-ink-faint focus:outline-none"
          />
        </div>
        <div className="mt-2 flex gap-2 sm:mt-0">
          <button type="button" onClick={pasteFromClipboard} className="btn-ghost h-12 flex-1 sm:flex-none">
            Paste
          </button>
          <button type="submit" disabled={status === 'fetching'} className="btn-accent h-12 flex-1 sm:flex-none">
            {status === 'fetching' ? 'Fetching…' : 'Get thumbnail'}
          </button>
        </div>
      </form>

      <div aria-live="polite" className="mt-4">
        {(status === 'invalid' || status === 'error') && (
          <p className="animate-fade-up rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{message}</p>
        )}
        {status === 'ready' && images.length > 0 && (
          <div className="grid animate-fade-up gap-4 sm:grid-cols-2">
            {images.map((img) => (
              <ThumbCard key={img.label} img={img} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ThumbCard({ img }: { img: ImageAsset }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  const filename = `thumbnail-${img.width ?? ''}${img.width ? 'x' : ''}${img.height ?? 'cover'}.${img.ext}`;
  return (
    <div className="card overflow-hidden">
      <div className="relative aspect-video bg-surface-soft">
        {/* External CDN image with graceful fallback if a size doesn't exist. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.url} alt={img.label} onError={() => setBroken(true)} className="h-full w-full object-cover" loading="lazy" />
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        <span className="text-sm font-medium text-ink">{img.label}</span>
        <a
          href={img.url}
          download={filename}
          target="_blank"
          rel="nofollow noopener"
          className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 4v10m0 0-4-4m4 4 4-4M5 19h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Download
        </a>
      </div>
    </div>
  );
}
