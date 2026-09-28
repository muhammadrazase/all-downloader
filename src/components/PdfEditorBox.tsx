'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PdfEngineError,
  imageFormatFromMimeType,
  isWinAnsiCompatible,
  type Overlay,
  type TextOverlay,
  type ImageOverlay,
  type TableOverlay,
} from '@/lib/pdfEngine';

const MAX_MB = 50;
const TARGET_WIDTH_PX = 700; // page display width the render scale is computed to fit
const IMAGE_BOX_PX = 150; // longest side of a newly placed image, in screen pixels
const HANDLE_HEIGHT = 18; // drag strip, drawn outside the object's own box
const CASCADE_OFFSET_PX = 24; // each new object steps down-right off the last
const CASCADE_STEPS = 8;
const MIN_FONT_SIZE = 6;
const MAX_FONT_SIZE = 96;

/** A NaN from an emptied number input must never reach the export as a font size. */
function clampFontSize(value: number): number {
  return Number.isFinite(value) ? Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, Math.round(value))) : MIN_FONT_SIZE;
}

function isPdf(f: File): boolean {
  return f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
}

/** Sizes a newly placed image to its own aspect ratio; a squashed square is never what the user wanted. */
async function fitImageBox(bytes: Uint8Array, format: 'png' | 'jpg', longestSide: number): Promise<{ width: number; height: number }> {
  try {
    const blob = new Blob([new Uint8Array(bytes)], { type: format === 'png' ? 'image/png' : 'image/jpeg' });
    const bitmap = await createImageBitmap(blob);
    const ratio = bitmap.width / bitmap.height;
    bitmap.close();
    return ratio >= 1
      ? { width: longestSide, height: Math.round(longestSide / ratio) }
      : { width: Math.round(longestSide * ratio), height: longestSide };
  } catch {
    return { width: longestSide, height: longestSide };
  }
}

const to255 = (c: number) => Math.round(c * 255).toString(16).padStart(2, '0');
function rgbToHex(color: { r: number; g: number; b: number }): string {
  return `#${to255(color.r)}${to255(color.g)}${to255(color.b)}`;
}
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

let overlayIdCounter = 0;
function nextOverlayId(): string {
  overlayIdCounter += 1;
  return `ov-${overlayIdCounter}`;
}

interface PlacedOverlay {
  id: string;
  overlay: Overlay;
}

type Status = 'idle' | 'loading' | 'ready' | 'exporting' | 'error';

export function PdfEditorBox() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [pageCount, setPageCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [scale, setScale] = useState(0); // 0 until the current page has actually rendered
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 }); // CSS pixels at `scale`
  const [overlays, setOverlays] = useState<PlacedOverlay[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<import('pdfjs-dist').PDFDocumentProxy | null>(null);
  const bytesRef = useRef<Uint8Array | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const exportUrlRef = useRef<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Blob URLs are revoked through a ref rather than an effect cleanup keyed on the
  // URL: under React's StrictMode remount that cleanup would revoke a URL the very
  // next mount still points at, leaving a dead download link.
  const publishExport = useCallback((url: string | null) => {
    if (exportUrlRef.current) URL.revokeObjectURL(exportUrlRef.current);
    exportUrlRef.current = url;
    setExportUrl(url);
  }, []);

  useEffect(() => () => {
    if (exportUrlRef.current) URL.revokeObjectURL(exportUrlRef.current);
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
    setOverlays([]);
    setSelectedId(null);
    setExportError('');
    publishExport(null);
    // Reset the page count too: if this file fails to open, the UI must fall back
    // to the drop zone, not strand the user in a disabled editor showing the
    // previous document's canvas with no way to pick another file.
    setPageCount(0);
    setStatus('loading');
    setMessage('');
  }, [publishExport]);

  // Load the PDF: validate via pdfEngine (encrypted/corrupted/page-count
  // guards), then hand the raw bytes to pdf.js for rendering.
  useEffect(() => {
    if (!file || status !== 'loading') return;
    let cancelled = false;

    (async () => {
      try {
        const buf = new Uint8Array(await file.arrayBuffer());
        const { loadDocument } = await import('@/lib/pdfEngine');
        const validated = await loadDocument(buf); // throws on encrypted/corrupted/too-many-pages
        const count = validated.getPageCount();

        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf/pdf.worker.min.mjs';
        const doc = await pdfjsLib.getDocument({ data: buf.slice(), enableXfa: false, useSystemFonts: false }).promise;

        if (cancelled) return;
        bytesRef.current = buf;
        pdfDocRef.current = doc;
        setPageCount(count);
        setPageIndex(0);
        setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setMessage(e instanceof PdfEngineError ? e.message : 'Could not open this PDF.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file, status]);

  // Cancels an in-flight render on rapid page changes so two renders never race onto the same canvas (§3.5).
  useEffect(() => {
    const doc = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || status !== 'ready') return;

    let cancelled = false;
    setScale(0); // the new page's scale is unknown until it renders; block adds until then
    (async () => {
      const page = await doc.getPage(pageIndex + 1);
      const baseViewport = page.getViewport({ scale: 1 });
      // Fit the page to the width actually available, not a fixed 700px: on a phone
      // that fixed width pushed the canvas past the viewport and scrolled the whole
      // document sideways, leaving most of the page unreachable.
      const available = stageRef.current?.clientWidth || TARGET_WIDTH_PX;
      const fitScale = Math.min(Math.min(TARGET_WIDTH_PX, available) / baseViewport.width, 2);
      const dprCapped = Math.min(window.devicePixelRatio || 1, 2);
      const renderScale = fitScale * dprCapped;
      const viewport = page.getViewport({ scale: renderScale });

      if (cancelled) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / dprCapped}px`;
      canvas.style.height = `${viewport.height / dprCapped}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      renderTaskRef.current?.cancel();
      const task = page.render({ canvasContext: ctx, viewport, canvas });
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch {
        return; // cancelled — a newer render superseded this one
      }
      if (cancelled) return;
      // Overlay rects are captured in the SAME CSS-pixel space the canvas is
      // displayed at (viewport / dprCapped), not the raw canvas pixel buffer.
      setScale(renderScale / dprCapped);
      setPageSize({ width: viewport.width / dprCapped, height: viewport.height / dprCapped });
    })();

    return () => {
      cancelled = true;
    };
  }, [pageIndex, status]);

  // A selection from another page must not linger — otherwise "Delete selected" (and
  // its Delete-key equivalent) can silently remove an overlay the user can no longer see.
  useEffect(() => {
    setSelectedId(null);
  }, [pageIndex]);

  const currentPageOverlays = overlays.filter((o) => o.overlay.page === pageIndex);
  const selectedOverlay = currentPageOverlays.find((o) => o.id === selectedId)?.overlay ?? null;

  const updateOverlay = useCallback((id: string, patch: Partial<Overlay['rect']>) => {
    setOverlays((prev) =>
      prev.map((o) => (o.id === id ? { ...o, overlay: { ...o.overlay, rect: { ...o.overlay.rect, ...patch } } } : o)),
    );
  }, []);

  // Content can only be added to a page that has finished rendering: the overlay
  // stores the scale its coordinates are in, and before the render there isn't one.
  const canAdd = status === 'ready' && scale > 0;

  /** Cascades each new object off the last one on this page, so they don't pile up invisibly on the same spot. */
  const place = useCallback((overlay: Overlay) => {
    const id = nextOverlayId();
    setOverlays((prev) => {
      const step = prev.filter((o) => o.overlay.page === overlay.page).length % CASCADE_STEPS;
      const offset = step * CASCADE_OFFSET_PX;
      return [...prev, { id, overlay: { ...overlay, rect: { ...overlay.rect, x: overlay.rect.x + offset, y: overlay.rect.y + offset } } }];
    });
    setSelectedId(id);
  }, []);

  const addText = useCallback(() => {
    if (!canAdd) return;
    place({
      type: 'text',
      page: pageIndex,
      scale,
      rect: { x: 40, y: 40, width: 200, height: 32 },
      text: 'New text',
      fontSize: 16,
      color: { r: 0, g: 0, b: 0 },
    });
  }, [canAdd, pageIndex, scale, place]);

  const addTable = useCallback(() => {
    if (!canAdd) return;
    const rows = 2;
    const cols = 2;
    place({
      type: 'table',
      page: pageIndex,
      scale,
      rect: { x: 40, y: 100, width: 240, height: 100 },
      rows,
      cols,
      cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => '')),
      fontSize: 12,
    });
  }, [canAdd, pageIndex, scale, place]);

  const addImage = useCallback(
    async (f: File | undefined) => {
      if (!f || !canAdd) return;
      const format = imageFormatFromMimeType(f.type);
      if (!format) {
        setExportError('Please choose a PNG or JPG image.');
        return;
      }
      setExportError('');
      const bytes = new Uint8Array(await f.arrayBuffer());
      // Match the image's own aspect ratio so the placed box isn't a squashed square.
      const { width, height } = await fitImageBox(bytes, format, IMAGE_BOX_PX);
      place({ type: 'image', page: pageIndex, scale, rect: { x: 60, y: 60, width, height }, bytes, format });
    },
    [canAdd, pageIndex, scale, place],
  );

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    setOverlays((prev) => prev.filter((o) => o.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  const patchSelectedText = useCallback(
    (patch: Partial<Pick<TextOverlay, 'fontSize' | 'color' | 'align'>>) => {
      if (!selectedId) return;
      setOverlays((prev) =>
        prev.map((o) => (o.id === selectedId && o.overlay.type === 'text' ? { ...o, overlay: { ...o.overlay, ...patch } } : o)),
      );
    },
    [selectedId],
  );

  const patchTableShape = useCallback(
    (rows: number, cols: number) => {
      if (!selectedId) return;
      setOverlays((prev) =>
        prev.map((o) => {
          if (o.id !== selectedId || o.overlay.type !== 'table') return o;
          const existing = o.overlay;
          const cells = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => existing.cells[r]?.[c] ?? ''));
          return { ...o, overlay: { ...existing, rows, cols, cells } };
        }),
      );
    },
    [selectedId],
  );

  const patchTableFontSize = useCallback(
    (fontSize: number) => {
      if (!selectedId) return;
      setOverlays((prev) =>
        prev.map((o) => (o.id === selectedId && o.overlay.type === 'table' ? { ...o, overlay: { ...o.overlay, fontSize } } : o)),
      );
    },
    [selectedId],
  );

  // Delete/Backspace removes the selected overlay; arrow keys nudge it (Shift = 10px).
  // Ignored while focus is inside a text input, where those keys must edit text instead.
  useEffect(() => {
    if (!selectedId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeSelected();
        return;
      }
      const step = e.shiftKey ? 10 : 1;
      const deltas: Record<string, [number, number]> = {
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
      };
      const delta = deltas[e.key];
      if (!delta) return;
      e.preventDefault();
      setOverlays((prev) =>
        prev.map((o) => (o.id === selectedId ? { ...o, overlay: { ...o.overlay, rect: { ...o.overlay.rect, x: o.overlay.rect.x + delta[0], y: o.overlay.rect.y + delta[1] } } } : o)),
      );
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId, removeSelected]);

  const runExport = useCallback(async () => {
    if (!bytesRef.current) return;
    setStatus('exporting');
    setExportError('');
    try {
      const { applyOverlays } = await import('@/lib/pdfEngine');
      const outBytes = await applyOverlays(bytesRef.current, overlays.map((o) => o.overlay));
      const blob = new Blob([new Uint8Array(outBytes)], { type: 'application/pdf' });
      publishExport(URL.createObjectURL(blob));
    } catch (e) {
      // Stays 'ready', not 'error' — the editing session must survive a failed export so the user can retry.
      setExportError(e instanceof PdfEngineError ? e.message : 'Could not export this PDF.');
    } finally {
      setStatus('ready');
    }
  }, [overlays, publishExport]);

  // An export is a snapshot of the overlays at one moment. Leaving its download link
  // up after the next edit hands the user a file that silently lacks that edit — so
  // the link is withdrawn as soon as anything changes, and they re-export.
  useEffect(() => {
    publishExport(null);
  }, [overlays, publishExport]);

  // Only fall back to the empty drop-zone before a file loads — once pageCount > 0, keep the editor visible on error.
  if (!file || (status === 'error' && pageCount === 0)) {
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
          aria-label="Choose a PDF file to edit"
          className={`card flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed p-8 text-center transition-colors ${dragging ? 'border-accent bg-accent-soft' : 'border-surface-border'}`}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-ink-faint" aria-hidden="true">
            <path d="M12 16V4m0 0L8 8m4-4 4 4M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="font-medium text-ink">Drag a PDF here, or click to choose</p>
          <p className="text-xs text-ink-muted">PDF, up to {MAX_MB} MB</p>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </div>
        {status === 'error' && <p className="mt-4 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{message}</p>}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={addText} disabled={!canAdd} className="btn-ghost">+ Text</button>
        <button type="button" onClick={() => imageInputRef.current?.click()} disabled={!canAdd} className="btn-ghost">+ Image</button>
        <button type="button" onClick={addTable} disabled={!canAdd} className="btn-ghost">+ Table</button>
        <button type="button" onClick={removeSelected} disabled={!selectedId} className="btn-ghost text-danger">Delete selected</button>
        <input ref={imageInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { void addImage(e.target.files?.[0]); e.target.value = ''; }} />

        <span className="ml-auto flex items-center gap-2 text-sm text-ink-muted">
          <button type="button" onClick={() => setPageIndex((p) => Math.max(0, p - 1))} disabled={pageIndex === 0} className="btn-ghost h-8 px-2">← </button>
          Page {pageIndex + 1} / {pageCount}
          <button type="button" onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))} disabled={pageIndex >= pageCount - 1} className="btn-ghost h-8 px-2">→</button>
        </span>
      </div>

      {selectedOverlay?.type === 'text' && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-surface-border bg-surface-soft px-3 py-2 text-sm">
          <label className="flex items-center gap-1.5 text-ink-muted">
            Size
            <input
              type="number"
              min={MIN_FONT_SIZE}
              max={MAX_FONT_SIZE}
              value={selectedOverlay.fontSize}
              onChange={(e) => patchSelectedText({ fontSize: clampFontSize(Number(e.target.value)) })}
              className="h-8 w-16 rounded-md border border-surface-border bg-surface px-2 text-ink"
            />
          </label>
          <label className="flex items-center gap-1.5 text-ink-muted">
            Color
            <input
              type="color"
              value={rgbToHex(selectedOverlay.color)}
              onChange={(e) => patchSelectedText({ color: hexToRgb(e.target.value) })}
              className="h-8 w-10 cursor-pointer rounded-md border border-surface-border"
            />
          </label>
          <div className="flex items-center gap-1" role="group" aria-label="Text alignment">
            {(['left', 'center', 'right'] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => patchSelectedText({ align: a })}
                aria-pressed={(selectedOverlay.align ?? 'left') === a}
                aria-label={`Align ${a}`}
                className={`rounded-md border px-2 py-1 text-xs capitalize ${(selectedOverlay.align ?? 'left') === a ? 'border-accent bg-accent-soft text-accent' : 'border-surface-border text-ink-muted'}`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedOverlay?.type === 'table' && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-surface-border bg-surface-soft px-3 py-2 text-sm text-ink-muted">
          <span>Rows: {selectedOverlay.rows}</span>
          <button type="button" onClick={() => patchTableShape(selectedOverlay.rows + 1, selectedOverlay.cols)} className="btn-ghost h-8 px-2 text-xs">+ Row</button>
          <button type="button" onClick={() => patchTableShape(Math.max(1, selectedOverlay.rows - 1), selectedOverlay.cols)} disabled={selectedOverlay.rows <= 1} className="btn-ghost h-8 px-2 text-xs">− Row</button>
          <span>Columns: {selectedOverlay.cols}</span>
          <button type="button" onClick={() => patchTableShape(selectedOverlay.rows, selectedOverlay.cols + 1)} className="btn-ghost h-8 px-2 text-xs">+ Column</button>
          <button type="button" onClick={() => patchTableShape(selectedOverlay.rows, Math.max(1, selectedOverlay.cols - 1))} disabled={selectedOverlay.cols <= 1} className="btn-ghost h-8 px-2 text-xs">− Column</button>
          <label className="flex items-center gap-1.5">
            Size
            <input
              type="number"
              min={MIN_FONT_SIZE}
              max={MAX_FONT_SIZE}
              value={selectedOverlay.fontSize}
              onChange={(e) => patchTableFontSize(clampFontSize(Number(e.target.value)))}
              className="h-8 w-16 rounded-md border border-surface-border bg-surface px-2 text-ink"
            />
          </label>
        </div>
      )}

      <div ref={stageRef} className="w-full">
        <div
          className="relative mx-auto overflow-hidden rounded-lg border border-surface-border bg-white"
          style={{ width: pageSize.width || undefined }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
        >
          <canvas ref={canvasRef} className="block" />
          {status === 'ready' &&
            currentPageOverlays.map(({ id, overlay }) => (
              <OverlayObject
                key={id}
                id={id}
                overlay={overlay}
                selected={selectedId === id}
                onSelect={() => setSelectedId(id)}
                onChange={(patch) => updateOverlay(id, patch)}
                onEditText={(text) => {
                  if (!isWinAnsiCompatible(text)) return; // silently ignore — the export-time check is the source of truth
                  setOverlays((prev) => prev.map((o) => (o.id === id && o.overlay.type !== 'image' ? { ...o, overlay: { ...o.overlay, text } as Overlay } : o)));
                }}
                onEditCell={(r, c, text) => {
                  setOverlays((prev) =>
                    prev.map((o) => {
                      if (o.id !== id || o.overlay.type !== 'table') return o;
                      const cells = o.overlay.cells.map((row) => [...row]);
                      cells[r]![c] = text;
                      return { ...o, overlay: { ...o.overlay, cells } };
                    }),
                  );
                }}
              />
            ))}
          {status === 'loading' && <div className="flex h-64 items-center justify-center text-sm text-ink-muted">Loading PDF…</div>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={runExport} disabled={status !== 'ready'} className="btn-accent">
          {status === 'exporting' ? 'Exporting…' : 'Export PDF'}
        </button>
        {exportUrl && (
          <a href={exportUrl} download="edited.pdf" className="btn-ghost">Download edited.pdf</a>
        )}
      </div>

      <p className="mt-3 text-xs text-ink-muted">🔒 Your file never leaves your device — editing runs entirely in your browser.</p>
      {exportError && <p className="mt-3 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{exportError}</p>}
    </div>
  );
}

/** Drag/resize mutate the DOM directly in pointermove, committing to state only on pointerup — avoids an INP-blowing setState per pointer move. */
function OverlayObject({
  overlay,
  selected,
  onSelect,
  onChange,
  onEditText,
  onEditCell,
}: {
  id: string;
  overlay: Overlay;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<Overlay['rect']>) => void;
  onEditText: (text: string) => void;
  onEditCell: (row: number, col: number, text: string) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const resizeState = useRef<{ startX: number; startY: number; originW: number; originH: number } | null>(null);

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      onSelect();
      dragState.current = { startX: e.clientX, startY: e.clientY, originX: overlay.rect.x, originY: overlay.rect.y };
      const el = elRef.current;
      if (!el) return;
      el.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        if (!dragState.current || !el) return;
        const dx = ev.clientX - dragState.current.startX;
        const dy = ev.clientY - dragState.current.startY;
        el.style.transform = `translate(${dx}px, ${dy}px)`;
      };
      const onUp = (ev: PointerEvent) => {
        if (!dragState.current) return;
        const dx = ev.clientX - dragState.current.startX;
        const dy = ev.clientY - dragState.current.startY;
        el.style.transform = '';
        onChange({ x: dragState.current.originX + dx, y: dragState.current.originY + dy });
        dragState.current = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [onChange, onSelect, overlay.rect.x, overlay.rect.y],
  );

  const startResize = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      resizeState.current = { startX: e.clientX, startY: e.clientY, originW: overlay.rect.width, originH: overlay.rect.height };
      const el = elRef.current;

      const onMove = (ev: PointerEvent) => {
        if (!resizeState.current || !el) return;
        const dw = ev.clientX - resizeState.current.startX;
        const dh = ev.clientY - resizeState.current.startY;
        el.style.width = `${Math.max(20, resizeState.current.originW + dw)}px`;
        el.style.height = `${Math.max(20, resizeState.current.originH + dh)}px`;
      };
      const onUp = (ev: PointerEvent) => {
        if (!resizeState.current) return;
        const dw = ev.clientX - resizeState.current.startX;
        const dh = ev.clientY - resizeState.current.startY;
        onChange({ width: Math.max(20, resizeState.current.originW + dw), height: Math.max(20, resizeState.current.originH + dh) });
        resizeState.current = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [onChange, overlay.rect.width, overlay.rect.height],
  );

  // The textarea/table inputs need their own pointerdown for text editing (and
  // stop it from bubbling up), so dragging can't hang off the content area — a
  // dedicated handle strip is the only drag affordance. It sits OUTSIDE the box:
  // any chrome inside it would shrink the content area below the rect the export
  // draws into, so what the user aligns would not be what the file contains.
  // Selecting, though, works from a pointerdown anywhere on the object.
  const handleAbove = overlay.rect.y >= HANDLE_HEIGHT;

  // Points at export time, CSS pixels here: a preview drawn at the raw point size
  // shows text at a fraction of its exported size on any zoomed page.
  const previewFontSize = overlay.type === 'image' ? 0 : overlay.fontSize * overlay.scale;

  return (
    <div
      ref={elRef}
      onPointerDownCapture={onSelect}
      role="group"
      aria-label={overlay.type === 'text' ? `Text: ${overlay.text}` : overlay.type === 'image' ? 'Image' : 'Table'}
      className={`absolute select-none ${selected ? 'outline outline-2 outline-accent' : 'outline outline-1 outline-surface-border/60'}`}
      style={{ left: overlay.rect.x, top: overlay.rect.y, width: overlay.rect.width, height: overlay.rect.height }}
    >
      <div
        onPointerDown={startDrag}
        role="button"
        tabIndex={0}
        aria-label="Drag to move"
        className="absolute inset-x-0 flex cursor-move items-center justify-center gap-0.5 bg-accent/80"
        style={{ height: HANDLE_HEIGHT, top: handleAbove ? -HANDLE_HEIGHT : overlay.rect.height }}
      >
        <span className="h-0.5 w-0.5 rounded-full bg-white" />
        <span className="h-0.5 w-0.5 rounded-full bg-white" />
        <span className="h-0.5 w-0.5 rounded-full bg-white" />
      </div>
      <div className="h-full w-full">
        {overlay.type === 'text' && (
          <textarea
            value={overlay.text}
            onChange={(e) => onEditText(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            className="h-full w-full resize-none overflow-hidden border-none bg-white/70 p-0 outline-none"
            style={{
              // Helvetica is what gets embedded on export, and 1.2 is the line
              // height applyOverlays uses — matching both keeps wrapping, width
              // and alignment in the preview honest about the exported result.
              fontFamily: 'Helvetica, Arial, sans-serif',
              fontSize: previewFontSize,
              lineHeight: `${previewFontSize * 1.2}px`,
              color: rgbToHex(overlay.color),
              textAlign: overlay.align ?? 'left',
            }}
          />
        )}
        {overlay.type === 'image' && <ImagePreview overlay={overlay} />}
        {overlay.type === 'table' && (
          <table className="h-full w-full table-fixed border-collapse bg-white/70">
            <tbody>
              {overlay.cells.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className="overflow-hidden border border-ink-faint p-0">
                      <input
                        value={cell}
                        onChange={(e) => onEditCell(r, c, e.target.value)}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="w-full border-none bg-transparent px-1 text-black outline-none"
                        style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: previewFontSize }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {selected && (
        <div
          onPointerDown={startResize}
          role="presentation"
          className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-white bg-accent"
        />
      )}
    </div>
  );
}

/** Creates and revokes the object URL in the SAME effect — a `useMemo`+cleanup split breaks under StrictMode's remount. */
function ImagePreview({ overlay }: { overlay: ImageOverlay }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(
      new Blob([new Uint8Array(overlay.bytes)], { type: overlay.format === 'png' ? 'image/png' : 'image/jpeg' }),
    );
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [overlay.bytes, overlay.format]);

  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-full w-full" draggable={false} />;
}
