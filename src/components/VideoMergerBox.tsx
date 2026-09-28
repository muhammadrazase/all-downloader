'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  mergeVideos,
  ConvertError,
  isVideoFile,
  isEngineLoaded,
  MAX_MERGE_MB_PER_VIDEO,
  MAX_MERGE_TOTAL_MB,
  MAX_MERGE_VIDEOS,
  MIN_MERGE_VIDEOS,
} from '@/lib/convert';

interface Item {
  id: string;
  file: File;
}

type Status = 'idle' | 'merging' | 'done' | 'error';

let idCounter = 0;

function formatMb(bytes: number): string {
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function VideoMergerBox() {
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [out, setOut] = useState<{ url: string; name: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [engineWasReady, setEngineWasReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Item[]>(items);
  itemsRef.current = items;
  const outUrlRef = useRef<string | null>(null);

  useEffect(() => () => { if (outUrlRef.current) URL.revokeObjectURL(outUrlRef.current); }, []);

  const clearResult = useCallback(() => {
    if (outUrlRef.current) URL.revokeObjectURL(outUrlRef.current);
    outUrlRef.current = null;
    setOut(null);
    setStatus('idle');
    setMessage('');
  }, []);

  const totalBytes = items.reduce((sum, i) => sum + i.file.size, 0);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const accepted: Item[] = [];
      const skipped: string[] = [];
      let runningTotal = itemsRef.current.reduce((sum, i) => sum + i.file.size, 0);
      for (const f of Array.from(files)) {
        if (!isVideoFile(f)) {
          skipped.push('only video files are supported');
          continue;
        }
        if (f.size > MAX_MERGE_MB_PER_VIDEO * 1024 * 1024) {
          skipped.push(`over ${MAX_MERGE_MB_PER_VIDEO} MB each`);
          continue;
        }
        if (runningTotal + f.size > MAX_MERGE_TOTAL_MB * 1024 * 1024) {
          skipped.push(`combined size would exceed ${MAX_MERGE_TOTAL_MB} MB`);
          continue;
        }
        runningTotal += f.size;
        accepted.push({ id: `vid-${++idCounter}`, file: f });
      }
      const room = Math.max(0, MAX_MERGE_VIDEOS - itemsRef.current.length);
      if (accepted.length > room) skipped.push(`this tool merges up to ${MAX_MERGE_VIDEOS} videos`);
      setItems((prev) => [...prev, ...accepted.slice(0, room)]);
      setNotice(skipped.length > 0 ? `Some files were skipped — ${[...new Set(skipped)].join('; ')}.` : '');
      clearResult();
    },
    [clearResult],
  );

  const removeItem = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((i) => i.id !== id));
      clearResult();
    },
    [clearResult],
  );

  const move = useCallback(
    (id: string, direction: -1 | 1) => {
      setItems((prev) => {
        const index = prev.findIndex((i) => i.id === id);
        const target = index + direction;
        if (index === -1 || target < 0 || target >= prev.length) return prev;
        const next = [...prev];
        [next[index], next[target]] = [next[target]!, next[index]!];
        return next;
      });
      clearResult();
    },
    [clearResult],
  );

  const run = useCallback(async () => {
    setStatus('merging');
    setProgress(0);
    setMessage('');
    setEngineWasReady(isEngineLoaded());
    try {
      const { blob, filename } = await mergeVideos(itemsRef.current.map((i) => i.file), setProgress);
      if (outUrlRef.current) URL.revokeObjectURL(outUrlRef.current);
      const url = URL.createObjectURL(blob);
      outUrlRef.current = url;
      setOut({ url, name: filename });
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setMessage(
        err instanceof ConvertError && err.code === 'too_large'
          ? `That's over the combined size limit — try fewer or smaller videos.`
          : 'Could not merge these videos. One of the files may be in an unsupported format.',
      );
    }
  }, []);

  const canMerge = items.length >= MIN_MERGE_VIDEOS && status !== 'merging';
  const remainingMb = MAX_MERGE_TOTAL_MB - totalBytes / 1048576;

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Choose videos to merge"
        className={`card flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed p-8 text-center transition-colors ${dragging ? 'border-accent bg-accent-soft' : 'border-surface-border'}`}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-ink-faint" aria-hidden="true">
          <path d="M12 16V4m0 0L8 8m4-4 4 4M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="font-medium text-ink">{items.length > 0 ? 'Add more videos' : `Drag ${MIN_MERGE_VIDEOS}+ videos here, or click to choose`}</p>
        <p className="text-xs text-ink-muted">
          Up to {MAX_MERGE_MB_PER_VIDEO} MB each, {MAX_MERGE_TOTAL_MB} MB combined — {MIN_MERGE_VIDEOS} to {MAX_MERGE_VIDEOS} videos
        </p>
        <input ref={inputRef} type="file" accept="video/*" multiple className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
      </div>

      {notice && <p className="mt-3 text-xs text-ink-muted">{notice}</p>}

      {items.length > 0 && (
        <>
          <ul className="mt-4 flex flex-col gap-2">
            {items.map((item, i) => (
              <li key={item.id} className="card flex items-center justify-between gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{i + 1}. {item.file.name}</p>
                  <p className="text-xs text-ink-muted">{formatMb(item.file.size)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => move(item.id, -1)} disabled={i === 0} aria-label="Move earlier" className="text-ink-faint hover:text-ink disabled:opacity-30">◀</button>
                  <button type="button" onClick={() => removeItem(item.id)} aria-label="Remove video" className="text-ink-faint hover:text-danger">✕</button>
                  <button type="button" onClick={() => move(item.id, 1)} disabled={i === items.length - 1} aria-label="Move later" className="text-ink-faint hover:text-ink disabled:opacity-30">▶</button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs tabular-nums text-ink-muted">
            {formatMb(totalBytes)} of {MAX_MERGE_TOTAL_MB} MB used — {remainingMb > 0 ? `${remainingMb.toFixed(0)} MB left` : 'limit reached'}
          </p>
        </>
      )}

      {items.length > 0 && (
        <div className="mt-4">
          <button type="button" onClick={run} disabled={!canMerge} className="btn-accent w-full sm:w-auto">
            {status === 'merging' ? 'Merging…' : `Merge ${items.length} video${items.length === 1 ? '' : 's'}`}
          </button>
          {items.length < MIN_MERGE_VIDEOS && <p className="mt-2 text-xs text-ink-muted">Add at least {MIN_MERGE_VIDEOS} videos to merge.</p>}
        </div>
      )}

      <p className="mt-3 text-xs text-ink-muted">🔒 Your videos never leave your device — merging runs entirely in your browser.</p>

      <div aria-live="polite" className="mt-4">
        {status === 'merging' && (
          <div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-soft" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.max(4, progress)}%` }} />
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              {progress > 0 ? `Merging… ${progress}%` : engineWasReady ? 'Reading your videos…' : 'Preparing (first run downloads the engine once)…'} — keep this tab open. Larger or more videos take longer.
            </p>
          </div>
        )}
        {status === 'error' && <p className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{message}</p>}
        {status === 'done' && out && (
          <div className="card animate-fade-up p-4">
            <div className="flex h-64 items-center justify-center overflow-hidden rounded-xl bg-ink sm:h-80">
              <video controls src={out.url} className="max-h-full max-w-full rounded-lg" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={out.url} download={out.name} className="btn-accent">Download {out.name}</a>
              <button type="button" onClick={() => { clearResult(); setItems([]); }} className="btn-ghost">Merge another</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
