'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PdfEngineError } from '@/lib/pdfEngine';
import { exceedsCanvasLimits } from '@/lib/imageCompress';
import { computeExportScale, buildPageImageFilename, sanitizeBaseName, type ExportResolution } from '@/lib/pdfToImage';

const MAX_MB = 50;
const MAX_OUTPUT_IMAGES = 50; // matches PdfSplitBox's MAX_OUTPUT_FILES voice — past this, it's a wall of tiles, not a result

type Status = 'idle' | 'checking' | 'working' | 'done' | 'error';
type Format = 'jpg' | 'png';

interface PageResult {
  pageNumber: number; // 1-indexed
  status: 'pending' | 'done' | 'error';
  url?: string;
  blob?: Blob;
  width?: number;
  height?: number;
  error?: string;
}

function isPdf(f: File): boolean {
  return f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
}

function baseName(name: string): string {
  return name.replace(/\.pdf$/i, '');
}

type PdfEngineModule = typeof import('@/lib/pdfEngine');

/** Shared by every tile footer so a tile's height never depends on which state it is in. */
const TILE_FOOTER_CLASS = 'flex items-center justify-center gap-1.5 border-t border-surface-border px-3 py-3 text-center text-sm font-medium';

export function PdfToImageBox() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [rangeSpec, setRangeSpec] = useState('');
  const [format, setFormat] = useState<Format>('jpg');
  const [resolution, setResolution] = useState<ExportResolution>('standard');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [dragging, setDragging] = useState(false);
  const [results, setResults] = useState<PageResult[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [aspectRatio, setAspectRatio] = useState(1 / 1.4142); // A4 portrait, replaced by a real measurement before any tile renders
  const [zipUrl, setZipUrl] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const bytesRef = useRef<Uint8Array | null>(null);
  const engineRef = useRef<PdfEngineModule | null>(null);
  const resultsRef = useRef<PageResult[]>([]);
  const zipUrlRef = useRef<string | null>(null);
  // Bumped on every clear so an in-flight export can detect it's been abandoned and stop,
  // instead of continuing to produce tiles and leak blob URLs for withdrawn settings.
  const runIdRef = useRef(0);
  resultsRef.current = results;

  const clearResults = useCallback(() => {
    runIdRef.current += 1;
    resultsRef.current.forEach((r) => r.url && URL.revokeObjectURL(r.url));
    if (zipUrlRef.current) URL.revokeObjectURL(zipUrlRef.current);
    zipUrlRef.current = null;
    setZipUrl(null);
    setResults([]);
    setProgress(null);
  }, []);

  useEffect(() => () => {
    resultsRef.current.forEach((r) => r.url && URL.revokeObjectURL(r.url));
    if (zipUrlRef.current) URL.revokeObjectURL(zipUrlRef.current);
  }, []);

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
    setPageCount(null);
    clearResults();

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
  }, [clearResults]);

  const effectiveSpec = rangeSpec.trim() || (pageCount !== null ? `1-${pageCount}` : '');

  const rangePreview = useMemo(() => {
    const engine = engineRef.current;
    if (!engine || pageCount === null || !effectiveSpec) return null;
    try {
      const count = new Set(engine.parsePageRanges(effectiveSpec, pageCount).flat()).size;
      if (count > MAX_OUTPUT_IMAGES) {
        return { ok: false as const, message: `That would produce ${count} images. Narrow the pages to ${MAX_OUTPUT_IMAGES} or fewer.` };
      }
      return { ok: true as const, count };
    } catch (e) {
      return { ok: false as const, message: e instanceof PdfEngineError ? e.message : 'Invalid page range.' };
    }
  }, [effectiveSpec, pageCount]);

  // A result set belongs to the range/format/resolution that produced it — any of them changing
  // means the thumbnails on screen no longer match the settings shown above them.
  useEffect(() => {
    clearResults();
    setStatus((s) => (s === 'done' ? 'idle' : s));
  }, [rangeSpec, format, resolution, clearResults]);

  const run = useCallback(async () => {
    if (!file || !bytesRef.current || pageCount === null || !effectiveSpec || rangePreview?.ok !== true) return;
    setStatus('working');
    setMessage('');
    clearResults();
    const runId = runIdRef.current;
    const abandoned = () => runIdRef.current !== runId;
    let doc: import('pdfjs-dist').PDFDocumentProxy | null = null;

    try {
      const engine = engineRef.current ?? (await import('@/lib/pdfEngine'));
      const pageIndices = [...new Set(engine.parsePageRanges(effectiveSpec, pageCount).flat())].sort((a, b) => a - b);
      const totalPages = pageIndices.length;
      // Set before the engine loads so the progress line always has a real denominator —
      // deriving it from the rendered tiles made it read "page 1 of 0" until the first one landed.
      setProgress({ done: 0, total: totalPages });

      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf/pdf.worker.min.mjs';
      doc = await pdfjsLib.getDocument({ data: bytesRef.current.slice(), enableXfa: false, useSystemFonts: false }).promise;
      if (abandoned()) return;

      const scale = computeExportScale(resolution);
      const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';

      // Measured before any placeholder is published — publishing first and correcting after
      // reflows the whole grid the moment page 1 lands, which placeholders exist to prevent.
      const firstViewport = (await doc.getPage(pageIndices[0]! + 1)).getViewport({ scale });
      if (abandoned()) return;
      setAspectRatio(firstViewport.width / firstViewport.height);
      setResults(pageIndices.map((idx) => ({ pageNumber: idx + 1, status: 'pending' })));

      // One reused canvas, not one per page — explicitly zeroed between pages below, since iOS
      // Safari does not reliably free canvas backing store from React unmounting alone.
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');

      const finished: { pageNumber: number; blob: Blob }[] = [];
      const fail = (pageNumber: number, error: string) =>
        setResults((prev) => prev.map((r) => (r.pageNumber === pageNumber ? { ...r, status: 'error', error } : r)));

      for (let i = 0; i < pageIndices.length; i++) {
        if (abandoned()) return;
        const pageNumber = pageIndices[i]! + 1;
        // Per-page, not around the loop: one broken page must cost that tile, not the rest
        // of an otherwise-fine export.
        try {
          const page = await doc.getPage(pageNumber);
          const viewport = page.getViewport({ scale });

          if (exceedsCanvasLimits(viewport.width, viewport.height)) {
            fail(pageNumber, 'Too large to render at this resolution.');
          } else {
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: ctx, viewport, canvas }).promise;
            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, format === 'jpg' ? 0.92 : undefined));
            canvas.width = 0;
            canvas.height = 0;
            page.cleanup();

            if (abandoned()) return; // checked again after the awaits, before any blob URL exists to leak
            if (!blob) {
              fail(pageNumber, 'Could not render this page.');
            } else {
              const url = URL.createObjectURL(blob);
              finished.push({ pageNumber, blob });
              setResults((prev) => prev.map((r) => (r.pageNumber === pageNumber ? { ...r, status: 'done', url, blob, width: viewport.width, height: viewport.height } : r)));
            }
          }
        } catch {
          canvas.width = 0;
          canvas.height = 0;
          fail(pageNumber, 'Could not render this page.');
        }
        setProgress({ done: i + 1, total: totalPages });
      }

      if (abandoned()) return;
      if (finished.length >= 2) {
        const { zipSync } = await import('fflate');
        const entries: Record<string, Uint8Array> = {};
        for (const f2 of finished) {
          entries[buildPageImageFilename(baseName(file.name), f2.pageNumber, totalPages, format)] = new Uint8Array(await f2.blob.arrayBuffer());
        }
        // Entries are already-compressed JPEG/PNG bytes — deflating them again buys nothing.
        const zipped = zipSync(entries, { level: 0 });
        const url = URL.createObjectURL(new Blob([new Uint8Array(zipped)], { type: 'application/zip' }));
        if (abandoned()) {
          URL.revokeObjectURL(url);
          return;
        }
        zipUrlRef.current = url;
        setZipUrl(url);
      }

      setStatus('done');
    } catch (e) {
      if (abandoned()) return;
      setStatus('error');
      setMessage(e instanceof PdfEngineError ? e.message : 'Could not export this PDF.');
    } finally {
      // Without this every export leaks a pdf.js worker for the tab's lifetime — destroy()
      // lives on the loading task, not the document proxy.
      await doc?.loadingTask.destroy();
      if (abandoned()) setStatus((s) => (s === 'working' ? 'idle' : s));
    }
  }, [file, pageCount, effectiveSpec, rangePreview, format, resolution, clearResults]);

  const doneCount = results.filter((r) => r.status === 'done').length;
  const totalSize = results.reduce((sum, r) => sum + (r.blob?.size ?? 0), 0);
  const canRun = pageCount !== null && !!effectiveSpec && rangePreview?.ok === true && status !== 'working' && status !== 'checking';
  const progressPct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const zipName = `${file ? sanitizeBaseName(baseName(file.name)) : 'pages'}.zip`;
  // Past the output cap, "leave empty for all N pages" is an instruction to an error — a
  // document that big has no all-pages shortcut, so the hint stops offering one.
  const rangeHint =
    pageCount === null
      ? 'e.g. 1-3, 5, 8-10'
      : pageCount > MAX_OUTPUT_IMAGES
        ? `e.g. 1-3, 5, 8-10 — up to ${MAX_OUTPUT_IMAGES} pages at a time`
        : `e.g. 1-3, 5, 8-10 — leave empty for all ${pageCount} pages`;

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
        aria-label="Choose a PDF file to export as images"
        className={`card flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed p-8 text-center transition-colors ${dragging ? 'border-accent bg-accent-soft' : 'border-surface-border hover:border-ink-faint'}`}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-ink-faint" aria-hidden="true">
          <path d="M12 16V4m0 0L8 8m4-4 4 4M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="max-w-full break-words font-medium text-ink">{file ? file.name : 'Drag a PDF here, or click to choose'}</p>
        <p className="text-xs text-ink-muted">
          {file ? `${(file.size / 1048576).toFixed(1)} MB${pageCount !== null ? ` · ${pageCount} page${pageCount === 1 ? '' : 's'}` : ''}` : `PDF, up to ${MAX_MB} MB`}
        </p>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      </div>

      <div className="mt-4">
        <label htmlFor="pdf-to-image-ranges" className="mb-1 block text-sm font-medium text-ink">Pages or ranges</label>
        <input
          id="pdf-to-image-ranges"
          type="text"
          value={rangeSpec}
          onChange={(e) => setRangeSpec(e.target.value)}
          placeholder={rangeHint}
          className="h-11 w-full rounded-lg border border-surface-border bg-surface px-3 text-base text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
        <div aria-live="polite" className="mt-1.5 min-h-5 text-xs">
          {rangePreview?.ok && <p className="text-ink-muted">Will produce {rangePreview.count} image{rangePreview.count === 1 ? '' : 's'}.</p>}
          {rangePreview && !rangePreview.ok && <p className="text-danger">{rangePreview.message}</p>}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Format
          <select aria-label="Format" value={format} onChange={(e) => setFormat(e.target.value as Format)} className="h-10 rounded-md border border-surface-border bg-surface px-2 text-ink">
            <option value="jpg">JPEG — smaller files</option>
            <option value="png">PNG — lossless, sharp text</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Resolution
          <select aria-label="Resolution" value={resolution} onChange={(e) => setResolution(e.target.value as ExportResolution)} className="h-10 rounded-md border border-surface-border bg-surface px-2 text-ink">
            <option value="standard">Standard — 144 DPI, good for screens</option>
            <option value="high">High — 288 DPI, print quality</option>
          </select>
        </label>
      </div>

      <div className="mt-4">
        <button type="button" onClick={run} disabled={!canRun} className="btn-accent w-full sm:w-auto">
          {status === 'working' ? 'Converting…' : status === 'checking' ? 'Reading PDF…' : `Convert to ${format.toUpperCase()}`}
        </button>
      </div>

      <p className="mt-3 text-xs text-ink-muted">🔒 Your file never leaves your device — every page is rendered in your browser.</p>

      {status === 'working' && progress && (
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-soft" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.max(4, progressPct)}%` }} />
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            Rendering page {Math.min(progress.done + 1, progress.total)} of {progress.total}… {progressPct}% — keep this tab open.
          </p>
        </div>
      )}

      <div aria-live="polite" className="mt-4">
        {status === 'error' && message && <p className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{message}</p>}

        {results.length > 0 && (
          <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ink-muted">
                {doneCount} of {results.length} image{results.length === 1 ? '' : 's'}
                {totalSize > 0 && ` · ${(totalSize / 1048576).toFixed(1)} MB`}
              </p>
              <div className="flex gap-2">
                {zipUrl && (
                  <a href={zipUrl} download={zipName} className="btn-accent w-full sm:w-auto">
                    Download all (.zip)
                  </a>
                )}
                <button type="button" onClick={clearResults} className="btn-ghost">Clear</button>
              </div>
            </div>

            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {results.map((r) => (
                <li key={r.pageNumber} className="card overflow-hidden">
                  {r.status === 'done' && r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer" aria-label={`Open page ${r.pageNumber} full size`} className="relative block bg-surface-soft" style={{ aspectRatio }}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- local blob result, not a remote asset */}
                      <img src={r.url} alt="" loading="lazy" className="h-full w-full object-contain" />
                      <span className="absolute bottom-1.5 left-1.5 rounded-md bg-ink/75 px-1.5 py-0.5 text-xs font-medium text-white">{r.pageNumber}</span>
                    </a>
                  ) : r.status === 'error' ? (
                    <div className="flex items-center justify-center bg-surface-soft p-3 text-center text-xs text-danger" style={{ aspectRatio }}>
                      Page {r.pageNumber}: {r.error}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center bg-surface-soft text-xs text-ink-faint" style={{ aspectRatio }}>
                      {r.pageNumber}
                    </div>
                  )}
                  {/* Footer stays in the same box regardless of state — adding it only once done caused the reflow placeholders exist to prevent. */}
                  {r.status === 'done' && r.url ? (
                    <a
                      href={r.url}
                      download={file ? buildPageImageFilename(baseName(file.name), r.pageNumber, results.length, format) : undefined}
                      className={TILE_FOOTER_CLASS + ' text-ink transition-colors hover:bg-surface-soft hover:text-accent'}
                    >
                      Download {format.toUpperCase()}
                    </a>
                  ) : (
                    <p className={TILE_FOOTER_CLASS + ' text-ink-faint'}>{r.status === 'error' ? 'Failed' : 'Rendering…'}</p>
                  )}
                </li>
              ))}
            </ul>

            {zipUrl && results.length > 8 && (
              <div className="mt-4 flex justify-center">
                <a href={zipUrl} download={zipName} className="btn-ghost">Download all (.zip)</a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
