'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { detectPlatform, type Platform } from '@/lib/platforms';
import { PlatformIcon } from './PlatformIcon';

/**
 * Shared paste-box for the AI tools. `tool` switches the endpoint + result view:
 *   - 'transcript' → /api/ai/transcribe → transcript + SRT/VTT/TXT downloads
 *   - 'summary'    → /api/ai/summary    → overview + key points
 * Same state machine, tokens and a11y as the download box, so the two feel identical.
 */

type Tool = 'transcript' | 'summary';
type Status = 'idle' | 'invalid' | 'working' | 'ready' | 'error' | 'coming_soon';

interface TranscriptData {
  text: string;
  srt: string;
  vtt: string;
  language?: string;
}
interface SummaryData {
  summary: string;
  points: string[];
}

/** Shared secondary-button treatment — matches DownloaderBox's quality chips. */
const SECONDARY_BTN =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent';

/** Turn a Whisper language field ("en" or "english") into a display name. */
function formatLanguage(code?: string): string | null {
  const trimmed = code?.trim();
  if (!trimmed) return null;
  let resolved: string | undefined;
  try {
    resolved = new Intl.DisplayNames(['en'], { type: 'language' }).of(trimmed) ?? undefined;
  } catch {
    resolved = undefined;
  }
  const label = resolved && resolved.toLowerCase() !== trimmed.toLowerCase() ? resolved : trimmed;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function downloadText(content: string, filename: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AiToolBox({ tool }: { tool: Tool }) {
  const [url, setUrl] = useState('');
  const [translate, setTranslate] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [detected, setDetected] = useState<Platform | undefined>();
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [imported, setImported] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        setDetected(detectPlatform(text));
      }
    } catch {
      /* permission denied — user pastes manually */
    }
    inputRef.current?.focus();
  }, []);

  const run = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) {
        setStatus('invalid');
        setMessage('Paste a video link to get started.');
        return;
      }
      if (!detectPlatform(trimmed)) {
        setStatus('invalid');
        setMessage('That link is not from a supported platform.');
        return;
      }
      setStatus('working');
      setMessage('');
      setTranscript(null);
      setSummary(null);
      try {
        const endpoint = tool === 'transcript' ? '/api/ai/transcribe' : '/api/ai/summary';
        const payload =
          tool === 'transcript' ? { url: trimmed, mode: translate ? 'translate' : 'transcribe' } : { url: trimmed };
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as (TranscriptData & SummaryData) | { error: string; code?: string };
        if (!res.ok || 'error' in data) {
          const err = 'error' in data ? data : { error: 'Something went wrong.', code: undefined };
          if (err.code === 'not_configured') {
            setStatus('coming_soon');
            setMessage(err.error);
            return;
          }
          setStatus('error');
          setMessage(err.error || 'Could not process this video. Please try again.');
          return;
        }
        if (tool === 'transcript') setTranscript(data);
        else setSummary(data);
        setStatus('ready');
      } catch {
        setStatus('error');
        setMessage('Network error. Check your connection and try again.');
      }
    },
    [tool, translate],
  );

  // Deep-link (?grab=<url>) from the extension / share target — auto-run.
  useEffect(() => {
    const g = new URLSearchParams(window.location.search).get('grab');
    if (g && detectPlatform(g)) {
      setUrl(g);
      setDetected(detectPlatform(g));
      setImported(true);
      void run(g);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clear = useCallback(() => {
    setUrl('');
    setDetected(undefined);
    setImported(false);
    setStatus('idle');
    setMessage('');
    inputRef.current?.focus();
  }, []);

  const working = status === 'working';

  const liveMessage = useMemo(() => {
    switch (status) {
      case 'working':
        return tool === 'transcript'
          ? 'Transcribing your video. This can take up to a minute.'
          : 'Summarizing your video. This can take up to a minute.';
      case 'ready':
        return tool === 'transcript' ? 'Your transcript is ready.' : 'Your summary is ready.';
      case 'coming_soon':
      case 'error':
      case 'invalid':
        return message;
      default:
        return '';
    }
  }, [status, tool, message]);

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(url);
        }}
        className="card p-2 shadow-lg sm:flex sm:items-center sm:gap-2"
      >
        <div className="flex flex-1 items-center gap-2 px-2">
          {detected ? (
            <PlatformIcon platform={detected.key} color={detected.brandColor} className="h-5 w-5 shrink-0" />
          ) : (
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-ink-faint" aria-hidden="true" />
          )}
          <input
            ref={inputRef}
            type="url"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setDetected(detectPlatform(e.target.value));
              if (status !== 'idle' && status !== 'working') setStatus('idle');
            }}
            placeholder="Paste a video link — YouTube, TikTok, Instagram, X & more…"
            aria-label="Video URL"
            className="h-12 w-full bg-transparent text-base text-ink placeholder:text-ink-faint focus:outline-none"
          />
          {url && !working && (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear link"
              className="rounded-md p-1 text-ink-faint transition-colors hover:text-ink"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        <div className="mt-2 flex gap-2 sm:mt-0">
          <button type="button" onClick={pasteFromClipboard} className="btn-ghost h-12 flex-1 sm:flex-none">
            Paste
          </button>
          <button type="submit" disabled={working} className="btn-accent h-12 flex-1 sm:flex-none">
            {working ? <Spinner /> : tool === 'transcript' ? 'Get transcript' : 'Summarize'}
          </button>
        </div>
      </form>

      {imported && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
          <CheckIcon size={13} /> Imported from share
        </p>
      )}

      {tool === 'transcript' && (
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={translate}
            disabled={working}
            onChange={(e) => setTranslate(e.target.checked)}
            className="h-4 w-4 rounded border-surface-border text-accent focus:ring-accent disabled:opacity-60"
          />
          Translate to English
        </label>
      )}

      <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-muted">
        <LockIcon /> We only read the audio to generate text — nothing is stored. Powered by open Whisper.
      </p>

      {/* Concise, polite announcement — keeps screen readers out of the busy % churn. */}
      <p className="sr-only" role="status" aria-live="polite">
        {liveMessage}
      </p>

      {/* Status region */}
      <div className="mt-4">
        {status === 'invalid' && (
          <p className="animate-fade-up rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
            {message}
          </p>
        )}

        {status === 'error' && (
          <div className="animate-fade-up rounded-xl border border-danger/20 bg-danger/5 p-4">
            <div className="flex gap-3">
              <AlertIcon className="mt-0.5 shrink-0 text-danger" />
              <div className="flex-1">
                <p className="text-sm text-danger">{message}</p>
                <button
                  type="button"
                  onClick={() => void run(url)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-danger underline decoration-danger/40 underline-offset-4 transition-colors hover:decoration-danger"
                >
                  <RetryIcon /> Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {status === 'coming_soon' && (
          <div className="animate-fade-up rounded-xl border border-accent/20 bg-accent-soft p-5">
            <div className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <SparkIcon />
              </span>
              <div>
                <p className="font-semibold text-ink">Launching soon</p>
                <p className="mt-1 text-sm text-ink-muted">{message}</p>
              </div>
            </div>
          </div>
        )}

        {working && <WorkingPanel tool={tool} />}

        {status === 'ready' && tool === 'transcript' && transcript && <TranscriptResult data={transcript} />}
        {status === 'ready' && tool === 'summary' && summary && <SummaryResult data={summary} />}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Working */

/**
 * Whisper runs 20–60s with no real progress signal, so we show an eased,
 * asymptotic estimate (caps below 100 until the real result unmounts this)
 * plus a stage stepper. Reduced-motion is respected globally — the width
 * transition and pulse both collapse to a static state.
 */
function WorkingPanel({ tool }: { tool: Tool }) {
  const steps =
    tool === 'transcript'
      ? ['Fetching audio', 'Transcribing speech', 'Formatting subtitles']
      : ['Fetching audio', 'Transcribing speech', 'Writing summary'];
  const heading = tool === 'transcript' ? 'Transcribing your video' : 'Summarizing your video';
  const [progress, setProgress] = useState(6);

  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => {
      const elapsed = Date.now() - start;
      // Ease-out toward a ~94% asymptote (τ ≈ 17s → ~93% by 45s).
      const pct = Math.round((1 - Math.exp(-elapsed / 17000)) * 100);
      setProgress(Math.min(94, Math.max(6, pct)));
    }, 350);
    return () => window.clearInterval(id);
  }, []);

  const active = progress < 14 ? 0 : progress < 78 ? 1 : 2;

  return (
    <div className="card animate-fade-up p-5">
      <div className="flex items-center gap-3">
        <Spinner className="text-accent" />
        <p className="font-medium text-ink">{heading}…</p>
        <span className="ml-auto text-sm tabular-nums text-ink-faint" aria-hidden="true">
          {progress}%
        </span>
      </div>

      <div
        className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-soft"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Processing progress"
      >
        <div className="h-full rounded-full bg-accent transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
      </div>

      <ol className="mt-4 space-y-2.5">
        {steps.map((label, i) => {
          const state = i < active ? 'done' : i === active ? 'current' : 'todo';
          return (
            <li key={label} className="flex items-center gap-2.5 text-sm">
              <StepMarker state={state} />
              <span
                className={
                  state === 'current'
                    ? 'font-medium text-ink'
                    : state === 'done'
                      ? 'text-ink-muted'
                      : 'text-ink-faint'
                }
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-4 text-xs text-ink-muted">
        This usually takes 20–60 seconds. Keep this tab open — you don&rsquo;t need to refresh.
      </p>
    </div>
  );
}

function StepMarker({ state }: { state: 'done' | 'current' | 'todo' }) {
  if (state === 'done') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
        <CheckIcon size={13} />
      </span>
    );
  }
  if (state === 'current') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-accent">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
      </span>
    );
  }
  return <span className="h-5 w-5 shrink-0 rounded-full border-2 border-surface-border" aria-hidden="true" />;
}

/* -------------------------------------------------------------- Transcript */

function TranscriptResult({ data }: { data: TranscriptData }) {
  const stats = useMemo(() => {
    const trimmed = data.text.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const segments = (data.srt.match(/-->/g) ?? []).length;
    return { words, segments };
  }, [data]);
  const language = useMemo(() => formatLanguage(data.language), [data.language]);

  return (
    <div className="card animate-fade-up p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        {language && (
          <Chip>
            <GlobeIcon /> {language}
          </Chip>
        )}
        {stats.words > 0 && <Chip>{stats.words.toLocaleString()} words</Chip>}
        {stats.segments > 0 && <Chip>{stats.segments.toLocaleString()} segments</Chip>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <CopyButton text={data.text} label="Copy text" variant="primary" />
        <span className="mx-1 hidden h-6 w-px bg-surface-border sm:block" aria-hidden="true" />
        <span className="text-xs font-medium text-ink-faint">Download</span>
        <button type="button" onClick={() => downloadText(data.srt, 'subtitles.srt')} className={SECONDARY_BTN}>
          <DownloadIcon /> .SRT
        </button>
        <button type="button" onClick={() => downloadText(data.vtt, 'subtitles.vtt')} className={SECONDARY_BTN}>
          <DownloadIcon /> .VTT
        </button>
        <button type="button" onClick={() => downloadText(data.text, 'transcript.txt')} className={SECONDARY_BTN}>
          <DownloadIcon /> .TXT
        </button>
      </div>

      <div
        tabIndex={0}
        role="region"
        aria-label="Transcript text"
        className="mt-4 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg border border-surface-border bg-surface-soft p-4 text-sm leading-7 text-ink [scrollbar-width:thin]"
      >
        {data.text}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Summary */

function SummaryResult({ data }: { data: SummaryData }) {
  const copyText = useMemo(
    () => `${data.summary}\n\n${data.points.map((p) => `• ${p}`).join('\n')}`,
    [data],
  );

  return (
    <div className="card animate-fade-up p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-ink">Summary</h3>
        <CopyButton text={copyText} label="Copy" variant="secondary" />
      </div>

      <p className="mt-3 leading-relaxed text-ink">{data.summary}</p>

      {data.points.length > 0 && (
        <>
          <div className="mt-5 flex items-center gap-2">
            <h4 className="text-sm font-semibold text-ink">Key points</h4>
            <Chip>{data.points.length}</Chip>
          </div>
          <ul className="mt-3 space-y-2.5">
            {data.points.map((point, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-ink-muted">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <CheckIcon size={13} />
                </span>
                <span className="leading-6">{point}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- Copy button */

function CopyButton({
  text,
  label,
  variant,
}: {
  text: string;
  label: string;
  variant: 'primary' | 'secondary';
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — silent, nothing to copy into */
    }
  }, [text]);

  if (variant === 'primary') {
    return (
      <button type="button" onClick={onCopy} className="btn-accent" aria-label={copied ? 'Copied to clipboard' : label}>
        {copied ? <CheckIcon size={18} /> : <CopyIcon size={18} />}
        {copied ? 'Copied' : label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={copied ? 'Copied to clipboard' : label}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
        copied
          ? 'border-success/30 text-success'
          : 'border-surface-border text-ink hover:border-accent hover:text-accent'
      }`}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? 'Copied' : label}
    </button>
  );
}

/* -------------------------------------------------------------------- Bits */

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-surface-soft px-3 py-1 text-xs font-medium text-ink-muted">
      {children}
    </span>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className ?? ''}`} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CopyIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4v10m0 0-4-4m4 4 4-4M5 19h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10.3 4.3 2.6 18a1.8 1.8 0 0 0 1.6 2.7h15.6a1.8 1.8 0 0 0 1.6-2.7L13.7 4.3a1.8 1.8 0 0 0-3.4 0Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 9v4m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12a8 8 0 1 1 2.3 5.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20v-5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3l1.9 4.8L18.6 9.7 13.9 11.6 12 16.4l-1.9-4.8L5.4 9.7l4.7-1.9L12 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M19 15l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7L19 15Z" fill="currentColor" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 12h18M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
