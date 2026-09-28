'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PdfEngineError, type NamedPdf } from '@/lib/pdfEngine';

const MAX_MB = 50; // matches PLAN-PDF-TOOLS.md §3.4's mobile-safe guardrail

type Status = 'idle' | 'checking' | 'working' | 'done' | 'error';

interface OutputFile {
  url: string;
  name: string;
}

function isPdf(f: File): boolean {
  return f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
}

function baseName(name: string): string {
  return name.replace(/\.pdf$/i, '');
}

function pdfBlobUrl(bytes: Uint8Array): string {
  return URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
}

/** Revokes object URLs explicitly on replacement/unmount, not via effect cleanup — that breaks under StrictMode's remount. */
function useOutputFiles(): [OutputFile[], (next: OutputFile[]) => void] {
  const [outputs, setOutputs] = useState<OutputFile[]>([]);
  const ref = useRef<OutputFile[]>([]);

  const publish = useCallback((next: OutputFile[]) => {
    for (const o of ref.current) URL.revokeObjectURL(o.url);
    ref.current = next;
    setOutputs(next);
  }, []);

  useEffect(() => () => {
    for (const o of ref.current) URL.revokeObjectURL(o.url);
  }, []);

  return [outputs, publish];
}

interface MergeItem {
  id: string;
  file: File;
  pageCount: number;
}

let mergeItemCounter = 0;

export function PdfMergeBox() {
  const [items, setItems] = useState<MergeItem[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [outputs, publishOutputs] = useOutputFiles();
  const [dragging, setDragging] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Each file is opened as it's added, not at merge time, so a bad file is named and skipped instead of failing (or blocking) the whole merge.
  const addFiles = useCallback(async (list: FileList | File[] | null) => {
    const picked = list ? Array.from(list) : [];
    if (!picked.length) return;

    setStatus('checking');
    setMessage('');
    publishOutputs([]);

    const { getPageCount } = await import('@/lib/pdfEngine');
    const accepted: MergeItem[] = [];
    const rejected: string[] = [];

    for (const file of picked) {
      if (!isPdf(file)) {
        rejected.push(`“${file.name}” is not a PDF file.`);
        continue;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        rejected.push(`“${file.name}” is over ${MAX_MB} MB.`);
        continue;
      }
      try {
        const pageCount = await getPageCount(new Uint8Array(await file.arrayBuffer()));
        mergeItemCounter += 1;
        accepted.push({ id: `pdf-${mergeItemCounter}`, file, pageCount });
      } catch (e) {
        rejected.push(`“${file.name}” — ${e instanceof PdfEngineError ? e.message : 'could not be read as a PDF.'}`);
      }
    }

    if (accepted.length) setItems((prev) => [...prev, ...accepted]);
    setStatus(rejected.length ? 'error' : 'idle');
    setMessage(rejected.join(' '));
  }, [publishOutputs]);

  const move = useCallback((from: number, to: number) => {
    setItems((prev) => {
      if (to < 0 || to >= prev.length || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return next;
    });
  }, []);

  const remove = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const totalPages = items.reduce((sum, item) => sum + item.pageCount, 0);

  const run = useCallback(async () => {
    if (items.length < 2) return;
    setStatus('working');
    setMessage('');
    publishOutputs([]);
    try {
      const { mergePdfs } = await import('@/lib/pdfEngine');
      const named: NamedPdf[] = await Promise.all(
        items.map(async (item) => ({ name: item.file.name, bytes: new Uint8Array(await item.file.arrayBuffer()) })),
      );
      publishOutputs([{ url: pdfBlobUrl(await mergePdfs(named)), name: 'merged.pdf' }]);
      setStatus('done');
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof PdfEngineError ? e.message : 'Could not merge these files. One of them may be corrupted.');
    }
  }, [items, publishOutputs]);

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Choose PDF files to merge"
        className={`card flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed p-8 text-center transition-colors ${dragging ? 'border-accent bg-accent-soft' : 'border-surface-border'}`}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-ink-faint" aria-hidden="true">
          <path d="M12 16V4m0 0L8 8m4-4 4 4M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="font-medium text-ink">
          {items.length
            ? `${items.length} file${items.length === 1 ? '' : 's'} added · ${totalPages} page${totalPages === 1 ? '' : 's'} total`
            : 'Drag two or more PDFs here, or click to choose'}
        </p>
        <p className="text-xs text-ink-muted">PDF files, up to {MAX_MB} MB each</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {items.length > 0 && (
        <ol className="mt-4 space-y-2">
          {items.map((item, i) => (
            <li
              key={item.id}
              draggable
              onDragStart={(e) => { setDraggingIndex(i); e.dataTransfer.effectAllowed = 'move'; }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
              onDrop={(e) => { e.preventDefault(); if (draggingIndex !== null) move(draggingIndex, i); setDraggingIndex(null); }}
              onDragEnd={() => setDraggingIndex(null)}
              className={`flex items-center justify-between gap-2 rounded-lg border border-surface-border px-3 py-2 text-sm transition-opacity ${draggingIndex === i ? 'opacity-50' : ''}`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0 cursor-grab text-ink-faint" aria-hidden="true">
                  <path d="M9 6h1M9 12h1M9 18h1M14 6h1M14 12h1M14 18h1" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                <span className="truncate text-ink">{item.file.name}</span>
                <span className="shrink-0 text-xs text-ink-muted">{item.pageCount} page{item.pageCount === 1 ? '' : 's'}</span>
              </span>
              <span className="flex shrink-0 gap-1">
                <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${item.file.name} up`} className="btn-ghost h-8 w-8 p-0 disabled:opacity-30">↑</button>
                <button type="button" onClick={() => move(i, i + 1)} disabled={i === items.length - 1} aria-label={`Move ${item.file.name} down`} className="btn-ghost h-8 w-8 p-0 disabled:opacity-30">↓</button>
                <button type="button" onClick={() => remove(i)} aria-label={`Remove ${item.file.name}`} className="btn-ghost h-8 w-8 p-0 text-danger">✕</button>
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-4">
        <button type="button" onClick={run} disabled={items.length < 2 || status === 'working' || status === 'checking'} className="btn-accent w-full sm:w-auto">
          {status === 'working' ? 'Merging…' : status === 'checking' ? 'Checking…' : 'Merge PDFs'}
        </button>
      </div>

      <p className="mt-3 text-xs text-ink-muted">🔒 Your files never leave your device — merging runs entirely in your browser.</p>

      <div aria-live="polite" className="mt-4">
        {status === 'error' && message && <p className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{message}</p>}
        {status === 'done' && outputs[0] && (
          <div className="card animate-fade-up p-4">
            <div className="flex flex-wrap gap-2">
              <a href={outputs[0].url} download={outputs[0].name} className="btn-accent">Download {outputs[0].name}</a>
              <button type="button" onClick={() => { setItems([]); setStatus('idle'); setMessage(''); publishOutputs([]); }} className="btn-ghost">Start over</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type PdfEngineModule = typeof import('@/lib/pdfEngine');

/** How the selected pages are grouped into output files — the three things split tools are actually used for. */
type SplitMode = 'ranges' | 'pages' | 'single';

const SPLIT_MODES: { value: SplitMode; label: string }[] = [
  { value: 'ranges', label: 'One file per range' },
  { value: 'pages', label: 'One file per page' },
  { value: 'single', label: 'All selected pages in one file' },
];

// Each output is a separate blob and a separate download button. Past this many,
// the result is an unusable wall of buttons, so say so instead of rendering it.
const MAX_OUTPUT_FILES = 50;

export function PdfSplitBox() {
  const [file, setFile] = useState<File | null>(null);
  const [rangeSpec, setRangeSpec] = useState('');
  const [mode, setMode] = useState<SplitMode>('ranges');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [outputs, publishOutputs] = useOutputFiles();
  const [dragging, setDragging] = useState(false);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const engineRef = useRef<PdfEngineModule | null>(null);
  const bytesRef = useRef<Uint8Array | null>(null);

  const pick = useCallback((f: File | undefined) => {
    if (!f) return;
    if (!isPdf(f)) {
      setStatus('error');
      setMessage('Please choose a PDF file.');
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setStatus('error');
      setMessage(`That file is over ${MAX_MB} MB.`);
      return;
    }
    setFile(f);
    setStatus('checking');
    setMessage('');
    publishOutputs([]);
    setPageCount(null);

    (async () => {
      const engine = engineRef.current ?? (await import('@/lib/pdfEngine'));
      engineRef.current = engine;
      const bytes = new Uint8Array(await f.arrayBuffer());
      bytesRef.current = bytes;
      try {
        setPageCount(await engine.getPageCount(bytes));
        setStatus('idle');
      } catch (e) {
        setStatus('error');
        setMessage(e instanceof PdfEngineError ? e.message : 'Could not read this PDF. It may be corrupted.');
      }
    })();
  }, [publishOutputs]);

  // Empty means the whole document — "one file per page" then needs no typing at all.
  const effectiveSpec = rangeSpec.trim() || (pageCount !== null ? `1-${pageCount}` : '');

  // Live validation as the user types — parsePageRanges is pure (no pdf-lib work), so
  // this is cheap to run on every keystroke once the module is already cached above.
  const rangePreview = useMemo(() => {
    const engine = engineRef.current;
    if (!engine || pageCount === null || !effectiveSpec) return null;
    try {
      const ranges = engine.parsePageRanges(effectiveSpec, pageCount);
      const pages = ranges.flat();
      const fileCount = mode === 'single' ? 1 : mode === 'pages' ? pages.length : ranges.length;
      if (fileCount > MAX_OUTPUT_FILES) {
        return { ok: false as const, message: `That would produce ${fileCount} files. Narrow the pages, or choose a mode with fewer outputs (up to ${MAX_OUTPUT_FILES}).` };
      }
      return { ok: true as const, fileCount, totalPages: pages.length };
    } catch (e) {
      return { ok: false as const, message: e instanceof PdfEngineError ? e.message : 'Invalid page range.' };
    }
  }, [effectiveSpec, pageCount, mode]);

  // An output set belongs to the range and mode that produced it. Leaving the old
  // download buttons up while the user edits either one offers files that no longer
  // match what the page says they contain.
  useEffect(() => {
    publishOutputs([]);
    setStatus((prev) => (prev === 'done' ? 'idle' : prev));
  }, [rangeSpec, mode, publishOutputs]);

  const run = useCallback(async () => {
    if (!file || !bytesRef.current || pageCount === null || !effectiveSpec) return;
    setStatus('working');
    setMessage('');
    publishOutputs([]);
    try {
      const engine = engineRef.current ?? (await import('@/lib/pdfEngine'));
      const parsed = engine.parsePageRanges(effectiveSpec, pageCount);
      const groups = mode === 'single' ? [parsed.flat()] : mode === 'pages' ? parsed.flat().map((p) => [p]) : parsed;
      if (groups.length > MAX_OUTPUT_FILES) {
        throw new PdfEngineError(`That would produce ${groups.length} files — narrow the pages to ${MAX_OUTPUT_FILES} outputs or fewer.`, 'invalid_range');
      }
      const results = await engine.splitPdf(bytesRef.current, groups);
      const name = baseName(file.name);
      publishOutputs(
        results.map((bytes, i) => ({
          url: pdfBlobUrl(bytes),
          // Page-per-file outputs are named by their real page number, which is what
          // the user is looking for; "part-7" would mean nothing on a "5,9,12" split.
          name:
            mode === 'single' ? `${name}-selected.pdf`
              : mode === 'pages' ? `${name}-page-${groups[i]![0]! + 1}.pdf`
                : `${name}-part-${i + 1}.pdf`,
        })),
      );
      setStatus('done');
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof PdfEngineError ? e.message : 'Could not split this file. It may be corrupted.');
    }
  }, [file, effectiveSpec, pageCount, mode, publishOutputs]);

  const canRun = pageCount !== null && !!effectiveSpec && rangePreview?.ok === true && status !== 'working' && status !== 'checking';

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
        aria-label="Choose a PDF file to split"
        className={`card flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed p-8 text-center transition-colors ${dragging ? 'border-accent bg-accent-soft' : 'border-surface-border'}`}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-ink-faint" aria-hidden="true">
          <path d="M12 16V4m0 0L8 8m4-4 4 4M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="font-medium text-ink">{file ? file.name : 'Drag a PDF here, or click to choose'}</p>
        <p className="text-xs text-ink-muted">
          {file ? `${(file.size / 1048576).toFixed(1)} MB${pageCount !== null ? ` · ${pageCount} page${pageCount === 1 ? '' : 's'}` : ''}` : `PDF, up to ${MAX_MB} MB`}
        </p>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      </div>

      <div className="mt-4">
        <label htmlFor="pdf-page-ranges" className="field-label mb-1 block text-sm font-medium text-ink">
          Pages or ranges
        </label>
        <input
          id="pdf-page-ranges"
          type="text"
          value={rangeSpec}
          onChange={(e) => setRangeSpec(e.target.value)}
          placeholder={pageCount !== null ? `e.g. 1-3, 5, 8-10 — leave empty for all ${pageCount} pages` : 'e.g. 1-3, 5, 8-10'}
          className="h-11 w-full rounded-lg border border-surface-border bg-surface px-3 text-base text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
        <div aria-live="polite" className="mt-1.5 min-h-[1.25rem] text-xs">
          {rangePreview?.ok && (
            <p className="text-ink-muted">Will produce {rangePreview.fileCount} file{rangePreview.fileCount === 1 ? '' : 's'}, {rangePreview.totalPages} page{rangePreview.totalPages === 1 ? '' : 's'} total.</p>
          )}
          {rangePreview && !rangePreview.ok && <p className="text-danger">{rangePreview.message}</p>}
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className="mb-1.5 text-sm font-medium text-ink">Split into</legend>
        <div className="flex flex-wrap gap-2">
          {SPLIT_MODES.map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-lg border px-3 py-2 text-sm transition-colors ${mode === option.value ? 'border-accent bg-accent-soft text-accent' : 'border-surface-border text-ink-muted'}`}
            >
              <input
                type="radio"
                name="pdf-split-mode"
                value={option.value}
                checked={mode === option.value}
                onChange={() => setMode(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4">
        <button type="button" onClick={run} disabled={!canRun} className="btn-accent w-full sm:w-auto">
          {status === 'working' ? 'Splitting…' : status === 'checking' ? 'Reading PDF…' : 'Split PDF'}
        </button>
      </div>

      <p className="mt-3 text-xs text-ink-muted">🔒 Your file never leaves your device — splitting runs entirely in your browser.</p>

      <div aria-live="polite" className="mt-4">
        {status === 'error' && <p className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{message}</p>}
        {status === 'done' && outputs.length > 0 && (
          <div className="card animate-fade-up p-4">
            <div className="flex flex-wrap gap-2">
              {outputs.map((o) => (
                <a key={o.name} href={o.url} download={o.name} className="btn-accent">Download {o.name}</a>
              ))}
            </div>
            <button type="button" onClick={() => { setFile(null); setRangeSpec(''); setStatus('idle'); setPageCount(null); publishOutputs([]); }} className="btn-ghost mt-3">
              Start over
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
