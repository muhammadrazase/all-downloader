'use client';

import { useCallback, useRef, useState } from 'react';
import { PdfTextError } from '@/lib/pdfText';
import { MIN_SUMMARY_CHARS, budgetDocumentText, parseSummary, summaryToPlainText, type ParsedSummary } from '@/lib/pdfSummary';

const MAX_MB = 50;

type Status = 'idle' | 'extracting' | 'summarizing' | 'done' | 'error';

interface SummaryResponse {
  summary: string;
  provider: string;
}

function isPdf(f: File): boolean {
  return f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
}

export function PdfSummaryBox() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<ParsedSummary | null>(null);
  const [partial, setPartial] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    setStatus('idle');
    setMessage('');
    setResult(null);
    setPartial(false);
  }, []);

  const run = useCallback(async () => {
    if (!file) return;
    setResult(null);
    setMessage('');
    setCopied(false);

    let budgeted: ReturnType<typeof budgetDocumentText>;
    try {
      setStatus('extracting');
      const { extractPdfText } = await import('@/lib/pdfText');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const extracted = await extractPdfText(bytes);
      if (extracted.text.length < MIN_SUMMARY_CHARS) {
        setStatus('error');
        setMessage('There is not enough text in this PDF to summarize — it needs at least a few paragraphs.');
        return;
      }
      budgeted = budgetDocumentText(extracted.text);
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof PdfTextError ? e.message : 'Could not read text from this PDF.');
      return;
    }

    try {
      setStatus('summarizing');
      const res = await fetch('/api/ai/pdf-summary', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: budgeted.text }),
      });
      const data = (await res.json()) as SummaryResponse | { error: string };
      if (!res.ok || 'error' in data) {
        setStatus('error');
        setMessage(('error' in data && data.error) || 'Could not summarize this document. Please try again.');
        return;
      }
      setResult(parseSummary(data.summary));
      setPartial(budgeted.truncated);
      setStatus('done');
    } catch {
      setStatus('error');
      setMessage('Network error. Check your connection and try again.');
    }
  }, [file]);

  const copyAll = useCallback(async () => {
    if (!result) return;
    const text = summaryToPlainText(result);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
      setMessage('Could not copy to the clipboard — select the text and copy it manually.');
    }
  }, [result]);

  const busy = status === 'extracting' || status === 'summarizing';

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
        aria-label="Choose a PDF file to summarize"
        className={`card flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed p-8 text-center transition-colors ${dragging ? 'border-accent bg-accent-soft' : 'border-surface-border'}`}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-ink-faint" aria-hidden="true">
          <path d="M12 16V4m0 0L8 8m4-4 4 4M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="font-medium text-ink">{file ? file.name : 'Drag a PDF here, or click to choose'}</p>
        <p className="text-xs text-ink-muted">{file ? `${(file.size / 1048576).toFixed(1)} MB` : `PDF, up to ${MAX_MB} MB`}</p>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      </div>

      <div className="mt-4">
        <button type="button" onClick={run} disabled={!file || busy} className="btn-accent w-full sm:w-auto">
          {status === 'extracting' ? 'Reading PDF…' : status === 'summarizing' ? 'Summarizing…' : 'Summarize'}
        </button>
      </div>

      <p className="mt-3 text-xs text-ink-muted">
        🔒 Your file never leaves your device — only the extracted text is sent to an AI provider to generate the summary.
      </p>

      <div aria-live="polite" className="mt-4">
        {status === 'error' && <p className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{message}</p>}
        {busy && (
          <p className="text-sm text-ink-muted">{status === 'extracting' ? 'Reading text from your PDF…' : 'Generating summary…'}</p>
        )}
        {status === 'done' && result && (
          <div className="card animate-fade-up p-4">
            {partial && (
              <p className="mb-3 rounded-lg border border-surface-border bg-surface-soft px-3 py-2 text-xs text-ink-muted">
                This document was too long to send whole. The summary is based on its opening and closing sections.
              </p>
            )}
            {/* Rendered as plain text, never markdown/HTML — the AI response is
                untrusted output and must not be interpreted as markup. */}
            {result.overview && <p className="whitespace-pre-wrap text-sm text-ink">{result.overview}</p>}
            {result.keyPoints.length > 0 && (
              <>
                <h3 className="mb-2 mt-4 text-sm font-semibold text-ink">Key points</h3>
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink">
                  {result.keyPoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={copyAll} className="btn-ghost">{copied ? 'Copied' : 'Copy summary'}</button>
              <button type="button" onClick={() => { setFile(null); setStatus('idle'); setResult(null); setPartial(false); setCopied(false); }} className="btn-ghost">
                Summarize another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
