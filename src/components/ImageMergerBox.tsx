'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isImageFormat, isSupportedInputImage, type ImageFormat } from '@/lib/imageCompress';
import { ImageMergeError, MAX_IMAGES, MAX_MB_PER_IMAGE, MIN_IMAGES, mergeImages, type MergeLayout } from '@/lib/imageMerge';

interface Item {
  id: string;
  file: File;
  previewUrl: string;
}

type Status = 'idle' | 'merging' | 'done' | 'error';

const FORMAT_EXT: Record<ImageFormat, string> = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' };
const isMergeLayout = (v: string): v is MergeLayout => v === 'horizontal' || v === 'vertical' || v === 'grid';

let idCounter = 0;

export function ImageMergerBox() {
  const [items, setItems] = useState<Item[]>([]);
  const [layout, setLayout] = useState<MergeLayout>('horizontal');
  const [gap, setGap] = useState(12);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [format, setFormat] = useState<ImageFormat>('image/jpeg');
  const [quality, setQuality] = useState(0.9);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState(''); // the merge run's own error, shown only while status === 'error'
  const [notice, setNotice] = useState(''); // "some files were skipped" — always visible, independent of merge status
  const [result, setResult] = useState<{ url: string; width: number; height: number; size: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Item[]>(items);
  itemsRef.current = items;
  const resultUrlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      itemsRef.current.forEach((i) => URL.revokeObjectURL(i.previewUrl));
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    },
    [],
  );

  /** Drops any result and error state that describes a selection which no longer exists — but
   * never the "skipped files" notice, which describes the add/remove action that just happened. */
  const clearResult = useCallback(() => {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = null;
    setResult(null);
    setStatus('idle');
    setMessage('');
  }, []);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const accepted: Item[] = [];
      const skipped: string[] = [];
      for (const f of Array.from(files)) {
        if (!isSupportedInputImage(f)) {
          skipped.push('only PNG, JPEG, WebP and BMP are supported');
          continue;
        }
        if (f.size > MAX_MB_PER_IMAGE * 1024 * 1024) {
          skipped.push(`over ${MAX_MB_PER_IMAGE} MB`);
          continue;
        }
        accepted.push({ id: `img-${++idCounter}`, file: f, previewUrl: URL.createObjectURL(f) });
      }
      const room = Math.max(0, MAX_IMAGES - itemsRef.current.length);
      if (accepted.length > room) skipped.push(`this tool merges up to ${MAX_IMAGES} images`);
      setItems((prev) => [...prev, ...accepted.slice(0, room)]);
      setNotice(skipped.length > 0 ? `Some files were skipped — ${[...new Set(skipped)].join('; ')}.` : '');
      clearResult();
    },
    [clearResult],
  );

  const removeItem = useCallback(
    (id: string) => {
      setItems((prev) => {
        const item = prev.find((i) => i.id === id);
        if (item) URL.revokeObjectURL(item.previewUrl);
        return prev.filter((i) => i.id !== id);
      });
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
    setMessage('');
    try {
      const merged = await mergeImages(
        itemsRef.current.map((i) => i.file),
        { layout, gap, backgroundColor, format, quality },
      );
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
      const url = URL.createObjectURL(merged.blob);
      resultUrlRef.current = url;
      setResult({ url, width: merged.width, height: merged.height, size: merged.blob.size });
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof ImageMergeError ? err.message : 'Could not merge these images.');
    }
  }, [layout, gap, backgroundColor, format, quality]);

  const canMerge = items.length >= MIN_IMAGES && status !== 'merging';

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
        aria-label="Choose images to merge"
        className={`card flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed p-8 text-center transition-colors ${dragging ? 'border-accent bg-accent-soft' : 'border-surface-border'}`}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-ink-faint" aria-hidden="true">
          <path d="M12 16V4m0 0L8 8m4-4 4 4M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="font-medium text-ink">{items.length > 0 ? 'Add more images' : `Drag ${MIN_IMAGES}+ images here, or click to choose`}</p>
        <p className="text-xs text-ink-muted">PNG, JPEG, WebP or BMP, up to {MAX_MB_PER_IMAGE} MB each — {MIN_IMAGES} to {MAX_IMAGES} images</p>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/bmp" multiple className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
      </div>

      {notice && <p className="mt-3 text-xs text-ink-muted">{notice}</p>}

      {items.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-3">
          {items.map((item, i) => (
            <li key={item.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a remote asset */}
              <img src={item.previewUrl} alt="" className="h-20 w-20 rounded-lg border border-surface-border object-cover" />
              <div className="mt-1 flex items-center justify-center gap-1">
                <button type="button" onClick={() => move(item.id, -1)} disabled={i === 0} aria-label="Move earlier" className="text-xs text-ink-faint hover:text-ink disabled:opacity-30">◀</button>
                <button type="button" onClick={() => removeItem(item.id)} aria-label="Remove image" className="text-xs text-ink-faint hover:text-danger">✕</button>
                <button type="button" onClick={() => move(item.id, 1)} disabled={i === items.length - 1} aria-label="Move later" className="text-xs text-ink-faint hover:text-ink disabled:opacity-30">▶</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Layout
          <select aria-label="Layout" value={layout} onChange={(e) => { if (isMergeLayout(e.target.value)) { setLayout(e.target.value); clearResult(); } }} className="h-10 rounded-md border border-surface-border bg-surface px-2 text-ink">
            <option value="horizontal">Side by side</option>
            <option value="vertical">Stacked</option>
            <option value="grid">Grid</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Gap ({gap}px)
          <input type="range" min={0} max={60} step={4} value={gap} onChange={(e) => { setGap(Number(e.target.value)); clearResult(); }} className="accent-accent" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Background
          <input type="color" value={backgroundColor} onChange={(e) => { setBackgroundColor(e.target.value); clearResult(); }} aria-label="Background colour" className="h-10 w-full cursor-pointer rounded-md border border-surface-border" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Format
          <select aria-label="Format" value={format} onChange={(e) => { if (isImageFormat(e.target.value)) { setFormat(e.target.value); clearResult(); } }} className="h-10 rounded-md border border-surface-border bg-surface px-2 text-ink">
            <option value="image/jpeg">JPEG</option>
            <option value="image/webp">WebP</option>
            <option value="image/png">PNG (lossless)</option>
          </select>
        </label>
      </div>

      {items.length > 0 && (
        <div className="mt-4">
          <button type="button" onClick={run} disabled={!canMerge} className="btn-accent w-full sm:w-auto">
            {status === 'merging' ? 'Merging…' : `Merge ${items.length} image${items.length === 1 ? '' : 's'}`}
          </button>
          {items.length < MIN_IMAGES && <p className="mt-2 text-xs text-ink-muted">Add at least {MIN_IMAGES} images to merge.</p>}
        </div>
      )}

      <p className="mt-3 text-xs text-ink-muted">🔒 Your images never leave your device — merging runs entirely in your browser.</p>

      <div aria-live="polite" className="mt-4">
        {status === 'error' && <p className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{message}</p>}
        {status === 'done' && result && (
          <div className="card animate-fade-up p-4">
            {/* width/height reserve the box before decode — without them the browser has nothing to
                lay out against until the image loads, and the page jumps once it does. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob result, not a remote asset */}
            <img src={result.url} alt="Merged result" width={result.width} height={result.height} className="mx-auto h-auto w-auto max-h-80 rounded-lg" />
            <p className="mt-3 text-sm text-ink-muted">
              {result.width}×{result.height}px · {(result.size / 1048576).toFixed(2)} MB
            </p>
            <a href={result.url} download={`merged.${FORMAT_EXT[format]}`} className="btn-accent mt-3 inline-block">
              Download merged.{FORMAT_EXT[format]}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
