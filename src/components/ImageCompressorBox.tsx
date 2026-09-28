'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImageCompressError, isSupportedInputImage, type ImageFormat, type ResizeMode } from '@/lib/imageCompress';

const MAX_MB = 30;
const MAX_FILES = 10;

type JobStatus = 'queued' | 'compressing' | 'done' | 'error';
type CompressMode = 'quality' | 'targetSize';

interface Job {
  id: string;
  file: File;
  status: JobStatus;
  resultUrl?: string;
  resultBlob?: Blob;
  outputFormat?: ImageFormat; // the format this result was actually encoded as
  usedQuality?: number;
  appliedSettings?: string;
  width?: number;
  height?: number;
  error?: string;
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(2)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

const FORMAT_EXT: Record<ImageFormat, string> = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' };

let jobIdCounter = 0;

export function ImageCompressorBox() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [mode, setMode] = useState<CompressMode>('quality');
  const [quality, setQuality] = useState(0.75);
  const [targetKb, setTargetKb] = useState(200);
  const [resizeMode, setResizeMode] = useState<'none' | 'maxWidth' | 'exact'>('maxWidth');
  const [maxWidth, setMaxWidth] = useState(1920);
  const [exactWidth, setExactWidth] = useState(1080);
  const [exactHeight, setExactHeight] = useState(1080);
  const [format, setFormat] = useState<ImageFormat>('image/jpeg');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const jobsRef = useRef<Job[]>(jobs);
  jobsRef.current = jobs;

  useEffect(() => () => { jobsRef.current.forEach((j) => j.resultUrl && URL.revokeObjectURL(j.resultUrl)); }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const accepted: Job[] = [];
    const skipped: string[] = [];
    for (const f of Array.from(files)) {
      if (!isSupportedInputImage(f)) {
        skipped.push('only PNG, JPEG, WebP and BMP are supported');
        continue;
      }
      if (f.size > MAX_MB * 1024 * 1024) {
        skipped.push(`over ${MAX_MB} MB`);
        continue;
      }
      accepted.push({ id: `job-${++jobIdCounter}`, file: f, status: 'queued' });
    }
    const room = Math.max(0, MAX_FILES - jobsRef.current.length);
    if (accepted.length > room) skipped.push(`this tool takes ${MAX_FILES} images at a time`);
    setJobs((prev) => [...prev, ...accepted.slice(0, room)]);
    setGlobalError(skipped.length > 0 ? `Some files were skipped — ${[...new Set(skipped)].join('; ')}.` : '');
  }, []);

  const removeJob = useCallback((id: string) => {
    setJobs((prev) => {
      const job = prev.find((j) => j.id === id);
      if (job?.resultUrl) URL.revokeObjectURL(job.resultUrl);
      return prev.filter((j) => j.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    jobs.forEach((j) => j.resultUrl && URL.revokeObjectURL(j.resultUrl));
    setJobs([]);
    setGlobalError('');
  }, [jobs]);

  const resize: ResizeMode = useMemo(
    () => (resizeMode === 'none' ? { mode: 'none' } : resizeMode === 'exact' ? { mode: 'exact', width: exactWidth, height: exactHeight } : { mode: 'maxWidth', maxWidth }),
    [resizeMode, exactWidth, exactHeight, maxWidth],
  );

  // A result is only current for the settings that produced it — changing any of them re-arms the button.
  const settingsKey = useMemo(
    () => JSON.stringify({ mode, quality, targetKb, format, backgroundColor, resize }),
    [mode, quality, targetKb, format, backgroundColor, resize],
  );

  const isStale = useCallback((job: Job) => job.status !== 'done' || job.appliedSettings !== settingsKey, [settingsKey]);

  const runAll = useCallback(async () => {
    setRunning(true);
    const { compressImage, compressToTargetBytes } = await import('@/lib/imageCompress');
    const opts = { quality, format, resize, backgroundColor };
    for (const job of jobsRef.current) {
      if (job.status === 'done' && job.appliedSettings === settingsKey) continue;
      if (job.resultUrl) URL.revokeObjectURL(job.resultUrl);
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'compressing', resultUrl: undefined, resultBlob: undefined } : j)));
      try {
        const compressed = mode === 'targetSize'
          ? await compressToTargetBytes(job.file, opts, targetKb * 1024)
          : await compressImage(job.file, opts);
        const resultUrl = URL.createObjectURL(compressed.blob);
        setJobs((prev) => prev.map((j) => (j.id === job.id
          ? { ...j, status: 'done', resultUrl, resultBlob: compressed.blob, outputFormat: format, usedQuality: compressed.quality, appliedSettings: settingsKey, width: compressed.width, height: compressed.height }
          : j)));
      } catch (e) {
        const message = e instanceof ImageCompressError ? e.message : 'Could not compress this image.';
        setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'error', error: message } : j)));
      }
    }
    setRunning(false);
  }, [quality, format, resize, backgroundColor, mode, targetKb, settingsKey]);

  const staleCount = jobs.filter(isStale).length;
  const hasResults = jobs.some((j) => j.status === 'done');
  const actionLabel = staleCount === 0
    ? 'Compressed'
    : hasResults
      ? `Re-compress${staleCount > 1 ? ` ${staleCount} images` : ''}`
      : `Compress${jobs.length > 1 ? ` ${jobs.length} images` : ' image'}`;

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
        aria-label="Choose one or more images to compress"
        className={`card flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed p-8 text-center transition-colors ${dragging ? 'border-accent bg-accent-soft' : 'border-surface-border'}`}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-ink-faint" aria-hidden="true">
          <path d="M12 16V4m0 0L8 8m4-4 4 4M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="font-medium text-ink">{jobs.length > 0 ? 'Add more images' : 'Drag images here, or click to choose'}</p>
        <p className="text-xs text-ink-muted">PNG, JPEG, WebP or BMP, up to {MAX_MB} MB each — up to {MAX_FILES} at once</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/bmp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = ''; // allow re-selecting the same file(s) after removing them
          }}
        />
      </div>

      {globalError && <p className="mt-3 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{globalError}</p>}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Compress by
          <select aria-label="Compress by" value={mode} onChange={(e) => setMode(e.target.value as CompressMode)} className="h-10 rounded-md border border-surface-border bg-surface px-2 text-ink">
            <option value="quality">Quality</option>
            <option value="targetSize">Target file size</option>
          </select>
        </label>
        {mode === 'quality' ? (
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            Quality ({Math.round(quality * 100)}%)
            <input type="range" min={0.1} max={1} step={0.05} value={quality} disabled={format === 'image/png'} onChange={(e) => setQuality(Number(e.target.value))} className="accent-accent disabled:opacity-40" />
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            Target size (KB)
            <input type="number" min={10} step={10} value={targetKb} disabled={format === 'image/png'} onChange={(e) => setTargetKb(Math.max(10, Number(e.target.value)))} className="h-10 rounded-md border border-surface-border bg-surface px-2 text-ink disabled:opacity-40" />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Format
          <select aria-label="Format" value={format} onChange={(e) => setFormat(e.target.value as ImageFormat)} className="h-10 rounded-md border border-surface-border bg-surface px-2 text-ink">
            <option value="image/jpeg">JPEG</option>
            <option value="image/webp">WebP</option>
            <option value="image/png">PNG (lossless)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Resize
          <select aria-label="Resize" value={resizeMode} onChange={(e) => setResizeMode(e.target.value as typeof resizeMode)} className="h-10 rounded-md border border-surface-border bg-surface px-2 text-ink">
            <option value="none">Keep original size</option>
            <option value="maxWidth">Max width</option>
            <option value="exact">Exact dimensions</option>
          </select>
        </label>
        {resizeMode === 'maxWidth' && (
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            Max width
            <select aria-label="Max width" value={maxWidth} onChange={(e) => setMaxWidth(Number(e.target.value))} className="h-10 rounded-md border border-surface-border bg-surface px-2 text-ink">
              {[800, 1280, 1920, 2560].map((w) => <option key={w} value={w}>{w}px</option>)}
            </select>
          </label>
        )}
        {resizeMode === 'exact' && (
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-sm text-ink-muted">
              Width
              <input type="number" min={1} value={exactWidth} onChange={(e) => setExactWidth(Math.max(1, Number(e.target.value)))} className="h-10 rounded-md border border-surface-border bg-surface px-2 text-ink" />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm text-ink-muted">
              Height
              <input type="number" min={1} value={exactHeight} onChange={(e) => setExactHeight(Math.max(1, Number(e.target.value)))} className="h-10 rounded-md border border-surface-border bg-surface px-2 text-ink" />
            </label>
          </div>
        )}
        {format === 'image/jpeg' && (
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            Transparency becomes
            <input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} aria-label="Background colour for transparent areas" className="h-10 w-full cursor-pointer rounded-md border border-surface-border" />
          </label>
        )}
      </div>

      {jobs.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={runAll} disabled={running || staleCount === 0} className="btn-accent">
            {running ? 'Compressing…' : actionLabel}
          </button>
          <button type="button" onClick={clearAll} className="btn-ghost">Clear all</button>
        </div>
      )}

      <p className="mt-3 text-xs text-ink-muted">🔒 Your images never leave your device — compression runs entirely in your browser.</p>

      {jobs.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {jobs.map((job) => {
            const savings = job.resultBlob ? Math.round((1 - job.resultBlob.size / job.file.size) * 100) : null;
            const ext = FORMAT_EXT[job.outputFormat ?? format];
            const missedTarget = job.resultBlob && job.appliedSettings && mode === 'targetSize' && job.resultBlob.size > targetKb * 1024;
            // Target-size mode picks the quality itself, so show what it settled on.
            const showChosenQuality = mode === 'targetSize' && job.outputFormat !== 'image/png' && job.usedQuality !== undefined;
            return (
              <li key={job.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-medium text-ink">{job.file.name}</p>
                  <button type="button" onClick={() => removeJob(job.id)} aria-label={`Remove ${job.file.name}`} className="shrink-0 text-ink-faint hover:text-danger">✕</button>
                </div>
                {job.status === 'queued' && <p className="mt-1 text-sm text-ink-muted">Queued — {formatBytes(job.file.size)}</p>}
                {job.status === 'compressing' && <p className="mt-1 text-sm text-ink-muted">Compressing…</p>}
                {job.status === 'error' && <p className="mt-1 text-sm text-danger">{job.error}</p>}
                {job.status === 'done' && job.resultUrl && job.resultBlob && (
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local blob result, not a remote asset */}
                    <img src={job.resultUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg border border-surface-border object-cover" />
                    <p className="text-sm text-ink">
                      {formatBytes(job.file.size)} → <strong>{formatBytes(job.resultBlob.size)}</strong>
                      {savings !== null && savings > 0
                        ? <span className="text-success"> ({savings}% smaller)</span>
                        : <span className="text-ink-muted"> (no reduction — your original is already well optimized)</span>}
                      {' · '}{job.width}×{job.height}px
                      {showChosenQuality && <span className="text-ink-muted"> · quality {Math.round((job.usedQuality ?? 0) * 100)}%</span>}
                      {isStale(job) && <span className="text-ink-muted"> · settings changed, re-compress to update</span>}
                      {missedTarget && <span className="text-ink-muted"> · could not reach {targetKb} KB even at the lowest quality</span>}
                    </p>
                    <a href={job.resultUrl} download={`${job.file.name.replace(/\.[^.]+$/, '')}-compressed.${ext}`} className="btn-ghost px-3 py-1.5 text-xs sm:ml-auto">
                      Download
                    </a>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
