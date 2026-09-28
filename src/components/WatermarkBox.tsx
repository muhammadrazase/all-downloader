'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isSupportedInputImage } from '@/lib/imageCompress';
import { addWatermark, ConvertError, MAX_INPUT_MB, MAX_WATERMARK_MB, assertConvertible, type WatermarkPosition, type WatermarkSize } from '@/lib/convert';

type Status = 'idle' | 'watermarking' | 'done' | 'error';

const POSITIONS: { id: WatermarkPosition; label: string }[] = [
  { id: 'top-left', label: 'Top left' },
  { id: 'top-right', label: 'Top right' },
  { id: 'center', label: 'Center' },
  { id: 'bottom-left', label: 'Bottom left' },
  { id: 'bottom-right', label: 'Bottom right' },
];
const SIZES: { id: WatermarkSize; label: string }[] = [
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large', label: 'Large' },
];

// `<select>`'s onChange only ever gives back a string — these narrow it to the real union
// instead of an unchecked `as` cast, which TypeScript erases at runtime.
const isPosition = (v: string): v is WatermarkPosition => POSITIONS.some((p) => p.id === v);
const isSize = (v: string): v is WatermarkSize => SIZES.some((s) => s.id === v);

export function WatermarkBox() {
  const [file, setFile] = useState<File | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [position, setPosition] = useState<WatermarkPosition>('bottom-right');
  const [size, setSize] = useState<WatermarkSize>('medium');
  const [opacity, setOpacity] = useState(80);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [out, setOut] = useState<{ url: string; name: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoPreviewRef = useRef<string | null>(null);
  const outUrlRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current);
    if (outUrlRef.current) URL.revokeObjectURL(outUrlRef.current);
  }, []);

  const pickVideo = useCallback((f: File | undefined) => {
    if (!f) return;
    try {
      assertConvertible(f);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof ConvertError && err.code === 'too_large' ? `That file is over ${MAX_INPUT_MB} MB. Try a shorter clip.` : 'Please choose a video file.');
      return;
    }
    if (outUrlRef.current) URL.revokeObjectURL(outUrlRef.current);
    outUrlRef.current = null;
    setFile(f);
    setStatus('idle');
    setMessage('');
    setOut(null);
  }, []);

  const pickLogo = useCallback((f: File | undefined) => {
    if (!f) return;
    if (!isSupportedInputImage(f)) {
      setStatus('error');
      setMessage('Watermark image must be PNG, JPEG, WebP or BMP. A PNG with transparency works best.');
      return;
    }
    if (f.size > MAX_WATERMARK_MB * 1024 * 1024) {
      setStatus('error');
      setMessage(`Watermark image must be under ${MAX_WATERMARK_MB} MB — a logo doesn't need to be any larger.`);
      return;
    }
    if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current);
    const url = URL.createObjectURL(f);
    logoPreviewRef.current = url;
    setLogo(f);
    setLogoPreview(url);
    setStatus('idle');
    setMessage('');
    setOut(null);
  }, []);

  const run = useCallback(async () => {
    if (!file || !logo) return;
    setStatus('watermarking');
    setProgress(0);
    setMessage('');
    setOut(null);
    try {
      const { blob, filename } = await addWatermark(file, logo, { size, opacityPercent: opacity, position }, setProgress);
      if (outUrlRef.current) URL.revokeObjectURL(outUrlRef.current);
      const url = URL.createObjectURL(blob);
      outUrlRef.current = url;
      setOut({ url, name: filename });
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setMessage(
        err instanceof ConvertError && err.code === 'too_large'
          ? `One of your files is too large — the video must be under ${MAX_INPUT_MB} MB and the logo under ${MAX_WATERMARK_MB} MB.`
          : 'Could not add the watermark. The video or image file may be in an unsupported format.',
      );
    }
  }, [file, logo, size, opacity, position]);

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); pickVideo(e.dataTransfer.files[0]); }}
        onClick={() => videoInputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && videoInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Choose a video file to watermark"
        className={`card flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed p-8 text-center transition-colors ${dragging ? 'border-accent bg-accent-soft' : 'border-surface-border'}`}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-ink-faint" aria-hidden="true">
          <path d="M12 16V4m0 0L8 8m4-4 4 4M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="font-medium text-ink">{file ? file.name : '1. Drag a video here, or click to choose'}</p>
        <p className="text-xs text-ink-muted">{file ? `${(file.size / 1048576).toFixed(1)} MB` : `MP4, MOV, WebM… up to ${MAX_INPUT_MB} MB`}</p>
        <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => pickVideo(e.target.files?.[0])} />
      </div>

      <div
        onClick={() => logoInputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && logoInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Choose a logo image to use as the watermark"
        className="card mt-3 flex cursor-pointer items-center gap-3 border-2 border-dashed border-surface-border p-4"
      >
        {logoPreview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a remote asset
          <img src={logoPreview} alt="" className="h-12 w-12 rounded-lg border border-surface-border object-contain" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-soft text-ink-faint" aria-hidden="true">🖼️</div>
        )}
        <div>
          <p className="text-sm font-medium text-ink">{logo ? logo.name : '2. Choose a logo image (PNG works best)'}</p>
          <p className="text-xs text-ink-muted">PNG, JPEG, WebP or BMP, up to {MAX_WATERMARK_MB} MB</p>
        </div>
        <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/bmp" className="hidden" onChange={(e) => pickLogo(e.target.files?.[0])} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Position
          <select aria-label="Position" value={position} onChange={(e) => { if (isPosition(e.target.value)) setPosition(e.target.value); }} className="h-10 rounded-md border border-surface-border bg-surface px-2 text-ink">
            {POSITIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Size
          <select aria-label="Size" value={size} onChange={(e) => { if (isSize(e.target.value)) setSize(e.target.value); }} className="h-10 rounded-md border border-surface-border bg-surface px-2 text-ink">
            {SIZES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Opacity ({opacity}%)
          <input type="range" min={10} max={100} step={5} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="accent-accent" />
        </label>
      </div>

      <div className="mt-4">
        <button type="button" onClick={run} disabled={!file || !logo || status === 'watermarking'} className="btn-accent w-full sm:w-auto">
          {status === 'watermarking' ? 'Adding watermark…' : 'Add watermark'}
        </button>
      </div>

      <p className="mt-3 text-xs text-ink-muted">🔒 Your video and logo never leave your device — everything runs entirely in your browser.</p>

      <div aria-live="polite" className="mt-4">
        {status === 'watermarking' && (
          <div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-soft" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.max(4, progress)}%` }} />
            </div>
            <p className="mt-2 text-sm text-ink-muted">{progress > 0 ? `Processing… ${progress}%` : 'Preparing converter (first run downloads the engine once)…'} — keep this tab open.</p>
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
              <button type="button" onClick={() => { if (outUrlRef.current) URL.revokeObjectURL(outUrlRef.current); outUrlRef.current = null; setFile(null); setStatus('idle'); setOut(null); }} className="btn-ghost">Watermark another</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
