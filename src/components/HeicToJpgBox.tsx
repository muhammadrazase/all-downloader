'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildConvertedFilename, DEFAULT_JPEG_QUALITY, HeicConvertError, type HeicOutputFormat } from '@/lib/heicConvert';

const MAX_MB = 30;
const MAX_FILES = 10;

type JobStatus = 'queued' | 'converting' | 'done' | 'error';

interface Job {
  id: string;
  file: File;
  status: JobStatus;
  resultUrl?: string;
  resultBlob?: Blob;
  outputFormat?: HeicOutputFormat;
  appliedSettings?: string;
  width?: number;
  height?: number;
  error?: string;
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(2)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

let jobIdCounter = 0;

export function HeicToJpgBox() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [format, setFormat] = useState<HeicOutputFormat>('jpg');
  const [quality, setQuality] = useState(DEFAULT_JPEG_QUALITY);
  const [checking, setChecking] = useState(false);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const jobsRef = useRef<Job[]>(jobs);
  jobsRef.current = jobs;
  // Identifies the batch a conversion loop belongs to. "Clear all" bumps it, which is how an
  // in-flight loop learns its results are unwanted instead of quietly leaking them as blob URLs.
  const runTokenRef = useRef(0);

  useEffect(() => () => { jobsRef.current.forEach((j) => j.resultUrl && URL.revokeObjectURL(j.resultUrl)); }, []);

  // Async, unlike a same-shaped sync accept handler: real HEIC detection needs to read each
  // file's magic bytes, not just trust its extension or (often empty, on Windows/Android) MIME type.
  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setChecking(true);
    setGlobalError('');

    const { isHeicFile } = await import('@/lib/heicConvert');
    const sizeOk = list.filter((f) => f.size <= MAX_MB * 1024 * 1024);
    const tooLargeCount = list.length - sizeOk.length;

    const checked = await Promise.all(sizeOk.map(async (file) => ({ file, isHeic: await isHeicFile(file).catch(() => false) })));
    const heicFiles = checked.filter((c) => c.isHeic).map((c) => c.file);
    const notHeicCount = checked.length - heicFiles.length;

    const room = Math.max(0, MAX_FILES - jobsRef.current.length);
    const overCapCount = Math.max(0, heicFiles.length - room);
    const accepted: Job[] = heicFiles.slice(0, room).map((file) => {
      jobIdCounter += 1;
      return { id: `job-${jobIdCounter}`, file, status: 'queued' as const };
    });

    const skipped: string[] = [];
    if (tooLargeCount > 0) skipped.push(`over ${MAX_MB} MB`);
    if (notHeicCount > 0) skipped.push('not a HEIC/HEIF file');
    if (overCapCount > 0) skipped.push(`this tool takes ${MAX_FILES} images at a time`);

    if (accepted.length) setJobs((prev) => [...prev, ...accepted]);
    setGlobalError(skipped.length > 0 ? `Some files were skipped — ${skipped.join('; ')}.` : '');
    setChecking(false);
  }, []);

  // Revoking lives outside the state updater on purpose: React may invoke an updater more than
  // once, and freeing a URL a surviving job still renders would break its preview and download.
  const removeJob = useCallback((id: string) => {
    const job = jobsRef.current.find((j) => j.id === id);
    if (job?.resultUrl) URL.revokeObjectURL(job.resultUrl);
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    runTokenRef.current += 1; // abandons any in-flight batch — see runAll
    jobsRef.current.forEach((j) => j.resultUrl && URL.revokeObjectURL(j.resultUrl));
    setJobs([]);
    setGlobalError('');
    setRunning(false);
  }, []);

  // A result is only current for the settings that produced it — changing format/quality re-arms the button.
  const settingsKey = useMemo(() => JSON.stringify({ format, quality }), [format, quality]);
  const isStale = useCallback((job: Job) => job.status !== 'done' || job.appliedSettings !== settingsKey, [settingsKey]);

  const runAll = useCallback(async () => {
    const token = (runTokenRef.current += 1);
    // A job the user removed mid-batch — or a whole batch they cleared — must stop consuming
    // CPU and must never produce a blob URL, since nothing would be left to revoke it.
    const stillWanted = (id: string) => runTokenRef.current === token && jobsRef.current.some((j) => j.id === id);

    setRunning(true);
    const { convertHeicToJpg } = await import('@/lib/heicConvert');
    for (const job of jobsRef.current) {
      if (!stillWanted(job.id)) continue;
      if (job.status === 'done' && job.appliedSettings === settingsKey) continue;
      if (job.resultUrl) URL.revokeObjectURL(job.resultUrl);
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'converting', resultUrl: undefined, resultBlob: undefined } : j)));
      try {
        const result = await convertHeicToJpg(job.file, { format, quality });
        if (!stillWanted(job.id)) continue;
        const resultUrl = URL.createObjectURL(result.blob);
        setJobs((prev) => prev.map((j) => (j.id === job.id
          ? { ...j, status: 'done', resultUrl, resultBlob: result.blob, outputFormat: format, appliedSettings: settingsKey, width: result.width, height: result.height }
          : j)));
      } catch (e) {
        if (!stillWanted(job.id)) continue;
        const message = e instanceof HeicConvertError ? e.message : 'Could not convert this file.';
        setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'error', error: message } : j)));
      }
    }
    // Only the newest batch owns the running flag — an abandoned loop must not clear it under a fresh one.
    if (runTokenRef.current === token) setRunning(false);
  }, [format, quality, settingsKey]);

  const staleCount = jobs.filter(isStale).length;
  const hasResults = jobs.some((j) => j.status === 'done');
  const actionLabel = staleCount === 0
    ? 'Converted'
    : hasResults
      ? `Re-convert${staleCount > 1 ? ` ${staleCount} images` : ''}`
      : `Convert${jobs.length > 1 ? ` ${jobs.length} images` : ' image'}`;

  const convertingJob = jobs.find((j) => j.status === 'converting');
  const doneCount = jobs.filter((j) => j.status === 'done').length;
  // Single source of truth for the drop zone's name: the accessible name has to contain the
  // visible text (WCAG 2.5.3), which a fixed aria-label over changing copy silently breaks.
  const dropZoneLabel = checking ? 'Checking files…' : jobs.length > 0 ? 'Add more photos' : 'Drag HEIC photos here, or click to choose';

  return (
    <div className="w-full">
      <p aria-live="polite" className="sr-only">
        {convertingJob ? `Converting ${convertingJob.file.name}…` : doneCount > 0 ? `${doneCount} of ${jobs.length} photos converted.` : ''}
      </p>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault(); // without this, Space scrolls the page out from under the file dialog
          inputRef.current?.click();
        }}
        role="button"
        tabIndex={0}
        aria-label={`${dropZoneLabel} — HEIC or HEIF photos, up to ${MAX_MB} MB each, up to ${MAX_FILES} at once`}
        className={`card flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed p-8 text-center transition-colors ${dragging ? 'border-accent bg-accent-soft' : 'border-surface-border hover:border-ink-faint'}`}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-ink-faint" aria-hidden="true">
          <path d="M12 16V4m0 0L8 8m4-4 4 4M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="font-medium text-ink">{dropZoneLabel}</p>
        <p className="text-xs text-ink-muted">HEIC/HEIF (iPhone photos), up to {MAX_MB} MB each — up to {MAX_FILES} at once</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/heic,image/heif,.heic,.heif"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {globalError && <p className="mt-3 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{globalError}</p>}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Format
          <select aria-label="Format" value={format} onChange={(e) => setFormat(e.target.value as HeicOutputFormat)} className="h-10 rounded-md border border-surface-border bg-surface px-2 text-ink">
            <option value="jpg">JPEG — smaller files</option>
            <option value="png">PNG — lossless</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Quality ({Math.round(quality * 100)}%)
          <input type="range" min={0.1} max={1} step={0.05} value={quality} disabled={format === 'png'} onChange={(e) => setQuality(Number(e.target.value))} className="accent-accent disabled:opacity-40" />
        </label>
      </div>

      {jobs.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={runAll} disabled={running || checking || staleCount === 0} className="btn-accent">
            {running ? 'Converting…' : actionLabel}
          </button>
          <button type="button" onClick={clearAll} className="btn-ghost">Clear all</button>
        </div>
      )}

      <p className="mt-3 text-xs text-ink-muted">🔒 Your photos never leave your device — conversion runs entirely in your browser.</p>

      {jobs.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {jobs.map((job) => (
            <li key={job.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-sm font-medium text-ink">{job.file.name}</p>
                <button
                  type="button"
                  onClick={() => removeJob(job.id)}
                  aria-label={`Remove ${job.file.name}`}
                  // Negative margin keeps the glyph optically in the card's corner while the
                  // hit area stays a full 44px — the minimum this project ships touch targets at.
                  className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-faint transition-colors hover:text-danger"
                >
                  ✕
                </button>
              </div>
              {job.status === 'queued' && <p className="mt-1 text-sm text-ink-muted">Queued — {formatBytes(job.file.size)}</p>}
              {job.status === 'converting' && <p className="mt-1 text-sm text-ink-muted">Converting…</p>}
              {job.status === 'error' && <p className="mt-1 text-sm text-danger">{job.error}</p>}
              {job.status === 'done' && job.resultUrl && job.resultBlob && (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local blob result, not a remote asset */}
                  <img src={job.resultUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg border border-surface-border object-cover" />
                  <p className="text-sm text-ink">
                    {formatBytes(job.resultBlob.size)} · {job.width}×{job.height}px
                    {isStale(job) && <span className="text-ink-muted"> · settings changed, re-convert to update</span>}
                  </p>
                  <a href={job.resultUrl} download={buildConvertedFilename(job.file.name, job.outputFormat ?? format)} className="btn-ghost px-3 py-1.5 text-xs sm:ml-auto">
                    Download
                  </a>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
