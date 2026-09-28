'use client';

import { useCallback, useState } from 'react';
import { detectPlatform, getPlatformByKey } from '@/lib/platforms';
import { runPool } from '@/lib/pool';
import { buildDownloadHref, triggerLocalDownload } from '@/lib/download';
import { PlatformIcon } from './PlatformIcon';
import type { ExtractResult, QualityOption } from '@/lib/types';

const MAX_BATCH = 20;
const CONCURRENCY = 3;

type ItemStatus = 'queued' | 'fetching' | 'ready' | 'error' | 'unsupported';
interface BatchItem {
  url: string;
  status: ItemStatus;
  result?: ExtractResult;
  error?: string;
  downloadError?: string;
}

export function BatchDownloaderBox() {
  const [text, setText] = useState('');
  const [items, setItems] = useState<BatchItem[] | null>(null);

  const lineCount = text.split('\n').map((l) => l.trim()).filter(Boolean).length;
  const over = lineCount > MAX_BATCH;

  const setItem = useCallback((i: number, patch: Partial<BatchItem>) => {
    setItems((prev) => (prev ? prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) : prev));
  }, []);

  const start = useCallback(async () => {
    const links = [...new Set(text.split('\n').map((l) => l.trim()).filter(Boolean))].slice(0, MAX_BATCH);
    if (!links.length) return;
    const initial: BatchItem[] = links.map((url) => ({ url, status: 'queued' }));
    setItems(initial);

    await runPool(links, CONCURRENCY, async (url, i) => {
      const p = detectPlatform(url);
      if (!p) return setItem(i, { status: 'unsupported' });
      setItem(i, { status: 'fetching' });
      try {
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url, platform: p.key }),
        });
        const data = (await res.json()) as ExtractResult | { error: string };
        if (!res.ok || 'error' in data) {
          setItem(i, { status: 'error', error: ('error' in data && data.error) || 'Could not fetch' });
        } else {
          setItem(i, { status: 'ready', result: data });
        }
      } catch {
        setItem(i, { status: 'error', error: 'Network error' });
      }
    });
  }, [text, setItem]);

  const reset = () => {
    setItems(null);
    setText('');
  };

  const readyCount = items?.filter((i) => i.status === 'ready').length ?? 0;
  const doneCount = items?.filter((i) => i.status !== 'queued' && i.status !== 'fetching').length ?? 0;

  // Trigger sequential downloads of each ready item's top quality (staggered).
  // Direct CDN URLs (option.url set) are a plain click; local-mode hrefs go through
  // triggerLocalDownload so a failed one reports an error instead of silently
  // saving the JSON error body as a mystery file.
  const downloadAll = () => {
    const ready = (items ?? [])
      .map((it, i) => ({ it, i }))
      .filter(({ it }) => it.status === 'ready' && it.result?.options.length);
    ready.forEach(({ it, i }, idx) => {
      const opt = it.result!.options[0]!;
      const href = buildDownloadHref(it.result!.sourceUrl, it.result!.platform, opt);
      setTimeout(() => {
        if (opt.url) {
          const a = document.createElement('a');
          a.href = href;
          a.rel = 'nofollow noopener';
          a.target = '_blank';
          a.click();
          return;
        }
        void triggerLocalDownload(href).then((outcome) => {
          if (!outcome.ok) setItem(i, { downloadError: outcome.error });
        });
      }, idx * 1200);
    });
  };

  if (!items) {
    return (
      <div className="w-full">
        <div className="card p-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={`Paste links, one per line…\nhttps://x.com/…\nhttps://youtube.com/watch?v=…\nhttps://tiktok.com/@…`}
            aria-label="Video links, one per line"
            className="w-full resize-y bg-transparent text-base text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between border-t border-surface-border pt-3">
            <span className={`text-sm ${over ? 'font-medium text-danger' : 'text-ink-faint'}`}>
              {lineCount} / {MAX_BATCH} links{over ? ' — only the first 20 will run' : ''}
            </span>
            <button type="button" onClick={start} disabled={!lineCount} className="btn-accent">
              Fetch all
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink" aria-live="polite">
          {doneCount} / {items.length} processed · {readyCount} ready
        </p>
        <div className="flex gap-2">
          {readyCount > 0 && (
            <button type="button" onClick={downloadAll} className="btn-accent">
              Download all (best quality)
            </button>
          )}
          <button type="button" onClick={reset} className="btn-ghost">
            Clear
          </button>
        </div>
      </div>
      <ul className="space-y-3" aria-live="polite">
        {items.map((it, i) => (
          <li key={i}>
            <BatchRow item={it} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function BatchRow({ item }: { item: BatchItem }) {
  const p = item.result ? getPlatformByKey(item.result.platform) : undefined;
  return (
    <div className="card p-4 sm:flex sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs text-ink-faint">
          {p && <PlatformIcon platform={p.key} color={p.brandColor} className="h-3.5 w-3.5" />}
          <span className="truncate">{item.url}</span>
        </div>
        {item.status === 'ready' && item.result && (
          <p className="mt-1 line-clamp-1 text-sm font-medium text-ink">{item.result.title}</p>
        )}
        {item.status === 'error' && <p className="mt-1 text-sm text-danger">{item.error}</p>}
        {item.downloadError && <p className="mt-1 text-sm text-danger">{item.downloadError}</p>}
        {item.status === 'unsupported' && <p className="mt-1 text-sm text-ink-muted">Unsupported or invalid link</p>}
      </div>
      <div className="mt-3 sm:mt-0">
        {item.status === 'queued' && <span className="text-sm text-ink-faint">Waiting…</span>}
        {item.status === 'fetching' && <span className="text-sm text-ink-muted">Fetching…</span>}
        {item.status === 'ready' && item.result && <RowOptions result={item.result} />}
      </div>
    </div>
  );
}

function RowOptions({ result }: { result: ExtractResult }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {result.options.slice(0, 4).map((o: QualityOption) => (
        <BatchOptionButton key={o.quality} result={result} option={o} />
      ))}
    </div>
  );
}

function BatchOptionButton({ result, option }: { result: ExtractResult; option: QualityOption }) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');
  const cls = 'inline-flex items-center rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent';

  // Direct CDN URL (API mode) → cross-origin, can't be fetched here — plain navigation.
  if (option.url) {
    return (
      <a href={option.url} download target="_blank" rel="nofollow noopener" className={cls}>
        {option.label}
      </a>
    );
  }

  const href = buildDownloadHref(result.sourceUrl, result.platform, option);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <a
        href={href}
        download
        rel="nofollow noopener"
        aria-busy={state === 'loading'}
        className={`${cls} ${state === 'loading' ? 'cursor-wait opacity-70' : ''}`}
        onClick={async (e) => {
          e.preventDefault();
          if (state === 'loading') return;
          setState('loading');
          setError('');
          const outcome = await triggerLocalDownload(href);
          setState(outcome.ok ? 'idle' : 'error');
          if (!outcome.ok) setError(outcome.error);
        }}
      >
        {state === 'loading' ? 'Preparing…' : option.label}
      </a>
      {state === 'error' && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
