'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { changeSpeed, ConvertError, MAX_INPUT_MB, assertConvertible, isEngineLoaded, SPEED_PRESETS, type SpeedPreset } from '@/lib/convert';

const LABELS: Record<SpeedPreset, string> = {
  0.25: '0.25x',
  0.5: '0.5x',
  0.75: '0.75x',
  1.25: '1.25x',
  1.5: '1.5x',
  2: '2x',
  3: '3x',
  4: '4x',
};
type Status = 'idle' | 'processing' | 'done' | 'error';

export function VideoSpeedBox() {
  const [file, setFile] = useState<File | null>(null);
  const [speed, setSpeed] = useState<SpeedPreset>(2);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [out, setOut] = useState<{ url: string; name: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [engineWasReady, setEngineWasReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const outUrlRef = useRef<string | null>(null);

  useEffect(() => () => { if (outUrlRef.current) URL.revokeObjectURL(outUrlRef.current); }, []);

  const pick = useCallback((f: File | undefined) => {
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

  const run = useCallback(async () => {
    if (!file) return;
    setStatus('processing');
    setProgress(0);
    setMessage('');
    setOut(null);
    setEngineWasReady(isEngineLoaded());
    try {
      const { blob, filename } = await changeSpeed(file, speed, setProgress);
      if (outUrlRef.current) URL.revokeObjectURL(outUrlRef.current);
      const url = URL.createObjectURL(blob);
      outUrlRef.current = url;
      setOut({ url, name: filename });
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setMessage(
        err instanceof ConvertError && err.code === 'too_large'
          ? `That file is over ${MAX_INPUT_MB} MB. Try a shorter clip.`
          : 'Could not change the speed of this video. The file may be in an unsupported format.',
      );
    }
  }, [file, speed]);

  const changeAnother = useCallback(() => {
    if (outUrlRef.current) URL.revokeObjectURL(outUrlRef.current);
    outUrlRef.current = null;
    setFile(null);
    setStatus('idle');
    setOut(null);
  }, []);

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
        aria-label="Choose a video file to change speed"
        className={`card flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed p-8 text-center transition-colors ${dragging ? 'border-accent bg-accent-soft' : 'border-surface-border'}`}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-ink-faint" aria-hidden="true">
          <path d="M12 16V4m0 0L8 8m4-4 4 4M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="font-medium text-ink">{file ? file.name : 'Drag a video here, or click to choose'}</p>
        <p className="text-xs text-ink-muted">{file ? `${(file.size / 1048576).toFixed(1)} MB` : `MP4, MOV, WebM… up to ${MAX_INPUT_MB} MB`}</p>
        <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {SPEED_PRESETS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${speed === s ? 'border-accent bg-accent-soft text-accent' : 'border-surface-border text-ink-muted hover:text-ink'}`}
          >
            {LABELS[s]}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-muted">Under 1x slows the video down (slow motion); over 1x speeds it up. Audio pitch stays natural at every speed.</p>

      <div className="mt-4">
        <button type="button" onClick={run} disabled={!file || status === 'processing'} className="btn-accent w-full sm:w-auto">
          {status === 'processing' ? 'Processing…' : `Change speed to ${LABELS[speed]}`}
        </button>
      </div>

      <p className="mt-3 text-xs text-ink-muted">🔒 Your file never leaves your device — processing runs entirely in your browser.</p>

      <div aria-live="polite" className="mt-4">
        {status === 'processing' && (
          <div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-soft" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.max(4, progress)}%` }} />
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              {progress > 0 ? `Processing… ${progress}%` : engineWasReady ? 'Preparing…' : 'Preparing (first run downloads the engine once)…'} — keep this tab open.
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
              <button type="button" onClick={changeAnother} className="btn-ghost">Change another</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
