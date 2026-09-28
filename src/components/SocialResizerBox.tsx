'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { assertResizable, ImageResizeError, resizeImage, SIZE_PRESETS, type FitMode } from '@/lib/imageResize';
import { isImageFormat, type ImageFormat } from '@/lib/imageCompress';

type Status = 'idle' | 'resizing' | 'error';
interface ResultItem { key: string; label: string; url: string; width: number; height: number; size: number }

const FORMAT_EXT: Record<ImageFormat, string> = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' };
const DEFAULT_SELECTION = new Set(['ig-post', 'ig-story', 'yt-thumbnail']);
const isFitMode = (v: string): v is FitMode => v === 'cover' || v === 'contain';

export function SocialResizerBox() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(DEFAULT_SELECTION);
  const [fit, setFit] = useState<FitMode>('cover');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [format, setFormat] = useState<ImageFormat>('image/jpeg');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const resultsRef = useRef<ResultItem[]>([]);
  resultsRef.current = results;

  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      resultsRef.current.forEach((r) => URL.revokeObjectURL(r.url));
    },
    [],
  );

  const clearResults = useCallback(() => {
    resultsRef.current.forEach((r) => URL.revokeObjectURL(r.url));
    setResults([]);
  }, []);

  const pick = useCallback(
    (f: File | undefined) => {
      if (!f) return;
      try {
        assertResizable(f);
      } catch (err) {
        setStatus('error');
        setMessage(err instanceof ImageResizeError ? err.message : 'Please choose an image file.');
        return;
      }
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const url = URL.createObjectURL(f);
      previewUrlRef.current = url;
      setFile(f);
      setPreviewUrl(url);
      setStatus('idle');
      setMessage('');
      clearResults();
    },
    [clearResults],
  );

  const toggle = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const run = useCallback(async () => {
    if (!file || selected.size === 0) return;
    setStatus('resizing');
    setMessage('');
    clearResults();
    const chosen = SIZE_PRESETS.filter((p) => selected.has(p.key));
    const produced: ResultItem[] = [];
    try {
      for (const preset of chosen) {
        const out = await resizeImage(file, { preset, fit, backgroundColor, format, quality: 0.9 });
        produced.push({ key: preset.key, label: preset.label, url: URL.createObjectURL(out.blob), width: out.width, height: out.height, size: out.blob.size });
      }
      setResults(produced);
      setStatus('idle');
    } catch (err) {
      produced.forEach((r) => URL.revokeObjectURL(r.url));
      setStatus('error');
      setMessage(err instanceof ImageResizeError ? err.message : 'Could not resize this image.');
    }
  }, [file, selected, fit, backgroundColor, format, clearResults]);

  if (!file) {
    return (
      <div className="w-full">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files[0]); }}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Choose an image to resize"
          className={`card flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed p-8 text-center transition-colors ${dragging ? 'border-accent bg-accent-soft' : 'border-surface-border'}`}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-ink-faint" aria-hidden="true">
            <path d="M12 16V4m0 0L8 8m4-4 4 4M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="font-medium text-ink">Drag an image here, or click to choose</p>
          <p className="text-xs text-ink-muted">PNG, JPEG, WebP or BMP</p>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/bmp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </div>
        {status === 'error' && <p className="mt-4 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{message}</p>}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-3">
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a remote asset
          <img src={previewUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg border border-surface-border object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{file.name}</p>
          <p className="text-xs text-ink-muted">{(file.size / 1048576).toFixed(1)} MB</p>
        </div>
        <button type="button" onClick={() => { setFile(null); setPreviewUrl(null); clearResults(); }} className="btn-ghost shrink-0 px-3 py-1.5 text-xs">Change image</button>
      </div>

      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-medium text-ink">Sizes to export</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SIZE_PRESETS.map((p) => (
            <label key={p.key} className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="checkbox" checked={selected.has(p.key)} onChange={() => toggle(p.key)} className="h-4 w-4 rounded border-surface-border" />
              {p.label} <span className="text-xs text-ink-faint">({p.width}×{p.height})</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Fit
          <select aria-label="Fit" value={fit} onChange={(e) => { if (isFitMode(e.target.value)) setFit(e.target.value); }} className="h-10 rounded-md border border-surface-border bg-surface px-2 text-ink">
            <option value="cover">Fill &amp; crop (no borders)</option>
            <option value="contain">Fit whole image (may add borders)</option>
          </select>
        </label>
        {fit === 'contain' && (
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            Border colour
            <input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} aria-label="Border colour" className="h-10 w-full cursor-pointer rounded-md border border-surface-border" />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Format
          <select aria-label="Format" value={format} onChange={(e) => { if (isImageFormat(e.target.value)) setFormat(e.target.value); }} className="h-10 rounded-md border border-surface-border bg-surface px-2 text-ink">
            <option value="image/jpeg">JPEG</option>
            <option value="image/webp">WebP</option>
            <option value="image/png">PNG (lossless)</option>
          </select>
        </label>
      </div>

      <div className="mt-4">
        <button type="button" onClick={run} disabled={selected.size === 0 || status === 'resizing'} className="btn-accent w-full sm:w-auto">
          {status === 'resizing' ? 'Resizing…' : `Resize to ${selected.size || ''} size${selected.size === 1 ? '' : 's'}`}
        </button>
        {selected.size === 0 && <p className="mt-2 text-xs text-ink-muted">Pick at least one size above.</p>}
      </div>

      <p className="mt-3 text-xs text-ink-muted">🔒 Your image never leaves your device — resizing runs entirely in your browser.</p>

      <div aria-live="polite" className="mt-4">
        {status === 'error' && <p className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{message}</p>}
        {results.length > 0 && (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {results.map((r) => (
              <li key={r.key} className="card animate-fade-up p-4">
                {/* width/height reserve each card's box before decode — several results land at
                    once here, so without them the whole grid reflows repeatedly as each loads. */}
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob result, not a remote asset */}
                <img src={r.url} alt={r.label} width={r.width} height={r.height} className="mx-auto h-auto w-auto max-h-48 rounded-lg" />
                <p className="mt-2 text-sm font-medium text-ink">{r.label}</p>
                <p className="text-xs text-ink-muted">{r.width}×{r.height}px · {(r.size / 1048576).toFixed(2)} MB</p>
                <a href={r.url} download={`${r.key}.${FORMAT_EXT[format]}`} className="btn-ghost mt-2 inline-block px-3 py-1.5 text-xs">Download</a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
