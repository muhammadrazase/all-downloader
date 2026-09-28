'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { OcrError, OCR_LANGUAGES, isRtlLanguage, type OcrLanguage } from '@/lib/ocr';

const MAX_MB = 20;
const MAX_FILES = 10;
const ACCEPTED = 'image/png,image/jpeg,image/webp,image/bmp';

type JobStatus = 'queued' | 'recognizing' | 'done' | 'error';
type Rotation = 0 | 90 | 180 | 270;

interface Job {
  id: string;
  file: File;
  previewUrl: string;
  rotation: Rotation;
  status: JobStatus;
  text?: string;
  confidence?: number;
  appliedLang?: OcrLanguage;
  appliedRotation?: Rotation;
  error?: string;
}

function isAcceptedType(f: File): boolean {
  return ['image/png', 'image/jpeg', 'image/webp', 'image/bmp'].includes(f.type);
}

function downloadText(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function baseName(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}

let jobIdCounter = 0;

export function ImageToTextBox() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [lang, setLang] = useState<OcrLanguage>('eng');
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const jobsRef = useRef<Job[]>(jobs);
  jobsRef.current = jobs;

  useEffect(() => () => { jobsRef.current.forEach((j) => URL.revokeObjectURL(j.previewUrl)); }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const accepted: Job[] = [];
    const skipped: string[] = [];
    for (const f of Array.from(files)) {
      if (!isAcceptedType(f)) {
        skipped.push('only PNG, JPEG, WebP and BMP are supported');
        continue;
      }
      if (f.size > MAX_MB * 1024 * 1024) {
        skipped.push(`over ${MAX_MB} MB`);
        continue;
      }
      accepted.push({
        id: `job-${++jobIdCounter}`,
        file: f,
        previewUrl: URL.createObjectURL(f),
        rotation: 0,
        status: 'queued',
      });
    }
    const room = Math.max(0, MAX_FILES - jobsRef.current.length);
    if (accepted.length > room) {
      skipped.push(`this tool reads ${MAX_FILES} images at a time`);
      accepted.slice(room).forEach((j) => URL.revokeObjectURL(j.previewUrl));
    }
    setJobs((prev) => [...prev, ...accepted.slice(0, room)]);
    setGlobalError(skipped.length > 0 ? `Some files were skipped — ${[...new Set(skipped)].join('; ')}.` : '');
  }, []);

  const rotate = useCallback((id: string) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, rotation: (((j.rotation + 90) % 360) as Rotation) } : j)));
  }, []);

  const removeJob = useCallback((id: string) => {
    setJobs((prev) => {
      const job = prev.find((j) => j.id === id);
      if (job) URL.revokeObjectURL(job.previewUrl);
      return prev.filter((j) => j.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    jobs.forEach((j) => URL.revokeObjectURL(j.previewUrl));
    setJobs([]);
    setGlobalError('');
  }, [jobs]);

  // A result belongs to the language and rotation it was produced with — change either and it needs re-running.
  const isStale = useCallback(
    (job: Job) => job.status !== 'done' || job.appliedLang !== lang || job.appliedRotation !== job.rotation,
    [lang],
  );

  const runAll = useCallback(async () => {
    setRunning(true);
    setGlobalError('');
    const { recognizeImage, rotateImage } = await import('@/lib/ocr');
    for (const job of jobsRef.current) {
      if (job.status === 'done' && job.appliedLang === lang && job.appliedRotation === job.rotation) continue;
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'recognizing' } : j)));
      try {
        const source: File | Blob = job.rotation === 0 ? job.file : await rotateImage(job.file, job.rotation);
        const { text, confidence } = await recognizeImage(source, lang);
        setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'done', text, confidence, appliedLang: lang, appliedRotation: job.rotation } : j)));
      } catch (e) {
        const message = e instanceof OcrError ? e.message : 'Could not read text from this image.';
        setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'error', error: message } : j)));
      }
    }
    setRunning(false);
  }, [lang]);

  const onCopy = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1800);
    } catch {
      /* clipboard blocked — silent, nothing to copy into */
    }
  }, []);

  const downloadPdf = useCallback(async (text: string, filename: string) => {
    const pdfEngine = await import('@/lib/pdfEngine').catch(() => null);
    if (!pdfEngine) {
      setGlobalError('Could not export this text as a PDF.');
      return;
    }
    try {
      const bytes = await pdfEngine.createTextPdf(text);
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      // Surfaces the typed reason (e.g. non-Latin characters) instead of a generic failure.
      setGlobalError(e instanceof pdfEngine.PdfEngineError ? e.message : 'Could not export this text as a PDF.');
    }
  }, []);

  const doneJobs = jobs.filter((j) => j.status === 'done' && j.text);
  const combinedText = doneJobs.map((j) => `--- ${j.file.name} ---\n${j.text}`).join('\n\n');

  const downloadAll = useCallback(() => {
    downloadText(combinedText, 'extracted-text.txt');
  }, [combinedText]);

  const staleCount = jobs.filter(isStale).length;
  const recognizingJob = jobs.find((j) => j.status === 'recognizing');
  const actionLabel = doneJobs.length > 0 && staleCount > 0
    ? `Re-extract${staleCount > 1 ? ` (${staleCount})` : ''}`
    : `Extract text${jobs.length > 1 ? ` (${jobs.length})` : ''}`;

  return (
    <div className="w-full">
      <p aria-live="polite" className="sr-only">
        {recognizingJob ? `Reading text from ${recognizingJob.file.name}…` : doneJobs.length > 0 ? `${doneJobs.length} of ${jobs.length} images done.` : ''}
      </p>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Choose one or more images to extract text from"
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
          accept={ACCEPTED}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = ''; // allow re-selecting the same file(s) after removing them
          }}
        />
      </div>

      {globalError && <p className="mt-3 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{globalError}</p>}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label htmlFor="ocr-lang" className="flex flex-col gap-1 text-sm text-ink-muted">
          Language
          <select id="ocr-lang" value={lang} onChange={(e) => setLang(e.target.value as OcrLanguage)} className="h-10 rounded-md border border-surface-border bg-surface px-2 text-ink">
            {OCR_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </label>
        {jobs.length > 0 && (
          <>
            <button type="button" onClick={runAll} disabled={running || staleCount === 0} className="btn-accent">
              {running ? 'Reading images…' : actionLabel}
            </button>
            {doneJobs.length > 1 && (
              <>
                <button type="button" onClick={downloadAll} className="btn-ghost">Download all (.txt)</button>
                <button type="button" onClick={() => downloadPdf(combinedText, 'extracted-text.pdf')} className="btn-ghost">Download all (.pdf)</button>
                <button type="button" onClick={() => onCopy('all', combinedText)} className="btn-ghost">
                  {copiedId === 'all' ? 'Copied' : 'Copy all'}
                </button>
              </>
            )}
            <button type="button" onClick={clearAll} className="btn-ghost">Clear all</button>
          </>
        )}
      </div>

      {jobs.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {jobs.map((job) => (
            <li key={job.id} className="card p-4">
              <div className="flex gap-4">
                <div className="flex shrink-0 flex-col items-center gap-2">
                  <div className="h-20 w-20 overflow-hidden rounded-lg border border-surface-border bg-surface-soft">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a remote asset */}
                    <img
                      src={job.previewUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      style={{ transform: `rotate(${job.rotation}deg)` }}
                    />
                  </div>
                  <button type="button" onClick={() => rotate(job.id)} aria-label={`Rotate ${job.file.name}`} className="btn-ghost px-2 py-1 text-xs">
                    Rotate ⟳
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-ink">{job.file.name}</p>
                    <button type="button" onClick={() => removeJob(job.id)} aria-label={`Remove ${job.file.name}`} className="shrink-0 text-ink-faint hover:text-danger">✕</button>
                  </div>

                  {job.status === 'queued' && <p className="mt-1 text-sm text-ink-muted">Queued</p>}
                  {job.status === 'recognizing' && <p className="mt-1 text-sm text-ink-muted">Reading…</p>}
                  {job.status === 'error' && <p className="mt-1 text-sm text-danger">{job.error}</p>}
                  {job.status === 'done' && (
                    <div className="mt-2">
                      <p className="text-xs text-ink-muted">
                        Confidence: {Math.round(job.confidence ?? 0)}% · {countWords(job.text ?? '')} words · {(job.text ?? '').length} characters
                        {isStale(job) && <span> · settings changed, re-extract to update</span>}
                      </p>
                      <pre
                        dir={job.appliedLang && isRtlLanguage(job.appliedLang) ? 'rtl' : 'ltr'}
                        className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-surface-soft p-2 font-sans text-sm text-ink"
                      >
                        {job.text}
                      </pre>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" onClick={() => onCopy(job.id, job.text ?? '')} className="btn-ghost px-3 py-1.5 text-xs" aria-label={copiedId === job.id ? 'Copied to clipboard' : 'Copy text'}>
                          {copiedId === job.id ? 'Copied' : 'Copy'}
                        </button>
                        <button type="button" onClick={() => downloadText(job.text ?? '', `${baseName(job.file.name)}.txt`)} className="btn-ghost px-3 py-1.5 text-xs">
                          Download .txt
                        </button>
                        <button type="button" onClick={() => downloadPdf(job.text ?? '', `${baseName(job.file.name)}.pdf`)} className="btn-ghost px-3 py-1.5 text-xs">
                          Download .pdf
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-ink-muted">🔒 Your images never leave your device — text recognition runs entirely in your browser.</p>
    </div>
  );
}
