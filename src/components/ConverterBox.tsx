'use client';

import { useCallback, useRef, useState } from 'react';
import { convert, type ConvertKind } from '@/lib/convert';

const MAX_MB = 200;
const LABELS: Record<ConvertKind, string> = {
  mp3: 'MP3 audio',
  gif: 'Animated GIF',
  '720': '720p video',
  '480': '480p video',
};

type Status = 'idle' | 'converting' | 'done' | 'error';

export function ConverterBox({ kinds }: { kinds: ConvertKind[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<ConvertKind>(kinds[0]!);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [out, setOut] = useState<{ url: string; name: string; type: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = useCallback((f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('video/') && !/\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(f.name)) {
      setStatus('error');
      setMessage('Please choose a video file.');
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setStatus('error');
      setMessage(`That file is over ${MAX_MB} MB. Try a shorter clip.`);
      return;
    }
    setFile(f);
    setStatus('idle');
    setMessage('');
    setOut(null);
  }, []);

  const run = useCallback(async () => {
    if (!file) return;
    setStatus('converting');
    setProgress(0);
    setMessage('');
    setOut(null);
    try {
      const { blob, filename } = await convert(file, kind, setProgress);
      setOut({ url: URL.createObjectURL(blob), name: filename, type: blob.type });
      setStatus('done');
    } catch {
      setStatus('error');
      setMessage('Conversion failed. The file may be too large or in an unsupported format.');
    }
  }, [file, kind]);

  return (
    <div className="w-full">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files[0]);
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Choose a video file to convert"
        className={`card flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed p-8 text-center transition-colors ${dragging ? 'border-accent bg-accent-soft' : 'border-surface-border'}`}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-ink-faint" aria-hidden="true">
          <path d="M12 16V4m0 0L8 8m4-4 4 4M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="font-medium text-ink">{file ? file.name : 'Drag a video here, or click to choose'}</p>
        <p className="text-xs text-ink-muted">{file ? `${(file.size / 1048576).toFixed(1)} MB` : `MP4, MOV, WebM… up to ${MAX_MB} MB`}</p>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>

      {/* Options */}
      {kinds.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${kind === k ? 'border-accent bg-accent-soft text-accent' : 'border-surface-border text-ink-muted hover:text-ink'}`}
            >
              {LABELS[k]}
            </button>
          ))}
        </div>
      )}

      {/* Convert */}
      <div className="mt-4">
        <button type="button" onClick={run} disabled={!file || status === 'converting'} className="btn-accent w-full sm:w-auto">
          {status === 'converting' ? 'Converting…' : `Convert to ${LABELS[kind]}`}
        </button>
      </div>

      <p className="mt-3 text-xs text-ink-muted">
        🔒 Your file never leaves your device — conversion runs entirely in your browser.
      </p>

      {/* States */}
      <div aria-live="polite" className="mt-4">
        {status === 'converting' && (
          <div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-soft" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.max(4, progress)}%` }} />
            </div>
            <p className="mt-2 text-sm text-ink-muted">{progress > 0 ? `Converting… ${progress}%` : 'Preparing converter (first run downloads the engine once)…'} — keep this tab open.</p>
          </div>
        )}
        {status === 'error' && <p className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{message}</p>}
        {status === 'done' && out && (
          <div className="card animate-fade-up p-4">
            {out.type.startsWith('audio') && <audio controls src={out.url} className="w-full" />}
            {out.type === 'image/gif' && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={out.url} alt="Converted GIF" className="mx-auto max-h-64 rounded-lg" />
            )}
            {out.type.startsWith('video') && <video controls src={out.url} className="mx-auto max-h-64 rounded-lg" />}
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={out.url} download={out.name} className="btn-accent">
                Download {out.name}
              </a>
              <button type="button" onClick={() => { setFile(null); setStatus('idle'); setOut(null); }} className="btn-ghost">
                Convert another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
