'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ConvertError, MAX_INPUT_MB, assertConvertibleAudio, isEngineLoaded, trimAudio } from '@/lib/convert';

type Status = 'idle' | 'loading' | 'ready' | 'trimming' | 'error';

const MIN_TRIM_SECONDS = 0.2;

/** Rounds to tenths BEFORE splitting into minutes — rounding after the split renders a
 * 59.97 s clip as the nonsense "0:60.0". */
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00.0';
  const tenths = Math.round(seconds * 10);
  const minutes = Math.floor(tenths / 600);
  return `${minutes}:${((tenths - minutes * 600) / 10).toFixed(1).padStart(4, '0')}`;
}

function parseSeconds(raw: string, fallback: number): number {
  if (!raw.trim()) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

interface TrimResult {
  url: string;
  name: string;
  duration: number;
  size: number;
}

export function AudioTrimmerBox() {
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(NaN);
  const [currentTime, setCurrentTime] = useState(0);
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [trimError, setTrimError] = useState('');
  const [progress, setProgress] = useState(0);
  const [engineWasReady, setEngineWasReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<TrimResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startRef = useRef<HTMLInputElement>(null);
  const audioUrlRef = useRef<string | null>(null);
  const resultUrlRef = useRef<string | null>(null);
  const startLegendId = useId();
  const endLegendId = useId();

  useEffect(() => () => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
  }, []);

  const pick = useCallback((f: File | undefined) => {
    if (!f) return;
    try {
      assertConvertibleAudio(f);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof ConvertError && err.code === 'too_large' ? `That file is over ${MAX_INPUT_MB} MB. Try a shorter clip.` : 'Please choose an audio file.');
      return;
    }
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = null;
    const url = URL.createObjectURL(f);
    audioUrlRef.current = url;
    setFile(f);
    setAudioUrl(url);
    setDuration(NaN);
    setCurrentTime(0);
    setStartInput('');
    setEndInput('');
    setResult(null);
    setStatus('loading');
    setMessage('');
    setTrimError('');
  }, []);

  const changeAudio = useCallback(() => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    audioUrlRef.current = null;
    resultUrlRef.current = null;
    setFile(null);
    setAudioUrl(null);
    setDuration(NaN);
    setStartInput('');
    setEndInput('');
    setResult(null);
    setStatus('idle');
    setMessage('');
    setTrimError('');
  }, []);

  const failLoad = useCallback((src: string) => {
    if (src !== audioUrlRef.current) return;
    URL.revokeObjectURL(src);
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    audioUrlRef.current = null;
    resultUrlRef.current = null;
    setFile(null);
    setAudioUrl(null);
    setDuration(NaN);
    setResult(null);
    setStatus('error');
    setMessage('Your browser could not open this file, so there is nothing to trim. Try an MP3, WAV or M4A file.');
  }, []);

  const start = parseSeconds(startInput, 0);
  const end = parseSeconds(endInput, duration);

  const rangeError = (() => {
    if (!Number.isFinite(duration)) return null;
    if (start < 0) return "Start can't be negative.";
    if (start >= duration) return `Start is past the audio's ${formatTime(duration)} length.`;
    if (end > duration) return `End is past the audio's ${formatTime(duration)} length.`;
    if (end <= start) return 'End must be after start.';
    if (end - start < MIN_TRIM_SECONDS) return `That's shorter than ${MIN_TRIM_SECONDS} s.`;
    return null;
  })();

  const canTrim = status === 'ready' && Number.isFinite(duration) && !rangeError;

  const playheadSeconds = useCallback(() => {
    if (!Number.isFinite(duration)) return '0';
    const rounded = Math.round(currentTime * 10) / 10;
    return String(Math.min(Math.max(rounded, 0), duration));
  }, [currentTime, duration]);

  useEffect(() => {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = null;
      setResult(null);
    }
    setTrimError('');
  }, [startInput, endInput]);

  const runTrim = useCallback(async () => {
    if (!file || !canTrim) return;
    setStatus('trimming');
    setProgress(0);
    setTrimError('');
    setEngineWasReady(isEngineLoaded());
    try {
      const { blob, filename } = await trimAudio(file, start, end, setProgress);
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
      const url = URL.createObjectURL(blob);
      resultUrlRef.current = url;
      setResult({ url, name: filename, duration: end - start, size: blob.size });
    } catch (err) {
      setTrimError(
        err instanceof ConvertError && err.code === 'too_large'
          ? `That file is over ${MAX_INPUT_MB} MB. Try a shorter clip.`
          : 'Could not trim this file. It may be in an unsupported format.',
      );
    } finally {
      setStatus('ready');
    }
  }, [file, canTrim, start, end]);

  const trimAnother = useCallback(() => {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = null;
    setResult(null);
    startRef.current?.focus();
  }, []);

  if (!file) {
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
          aria-label="Choose an audio file to trim"
          className={`card flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed p-8 text-center transition-colors ${dragging ? 'border-accent bg-accent-soft' : 'border-surface-border hover:border-ink-faint'}`}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-ink-faint" aria-hidden="true">
            <path d="M12 16V4m0 0L8 8m4-4 4 4M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="font-medium text-ink">Drag an audio file here, or click to choose</p>
          <p className="text-xs text-ink-muted">MP3, WAV, M4A, OGG… up to {MAX_INPUT_MB} MB</p>
          <input ref={inputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </div>
        <p className="mt-3 text-xs text-ink-muted">🔒 Your file never leaves your device — trimming runs entirely in your browser.</p>
        {status === 'error' && <p className="mt-4 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{message}</p>}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{file.name}</p>
          <p className="text-xs text-ink-muted">
            {(file.size / 1048576).toFixed(1)} MB{Number.isFinite(duration) ? ` · ${formatTime(duration)}` : ' · reading the file…'}
          </p>
        </div>
        <button type="button" onClick={changeAudio} disabled={status === 'trimming'} className="btn-ghost shrink-0 px-3 py-1.5 text-xs">Change file</button>
      </div>

      <div className="relative mt-3 flex items-center justify-center rounded-xl border border-surface-border bg-surface-soft p-6">
        {status === 'loading' && <p className="text-sm text-ink-muted">Loading audio…</p>}
        {audioUrl && (
          <audio
            src={audioUrl}
            controls
            preload="metadata"
            className="w-full"
            onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration); setStatus((s) => (s === 'loading' ? 'ready' : s)); }}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onError={(e) => failLoad(e.currentTarget.src)}
          />
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <fieldset disabled={status === 'trimming'}>
          <legend id={startLegendId} className="mb-1.5 text-sm font-medium text-ink">Start</legend>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              ref={startRef}
              type="number"
              step="0.1"
              min={0}
              max={Number.isFinite(duration) ? duration : undefined}
              inputMode="decimal"
              placeholder="0"
              value={startInput}
              disabled={!Number.isFinite(duration)}
              onChange={(e) => setStartInput(e.target.value)}
              aria-label="Start time in seconds"
              className="h-11 w-full rounded-lg border border-surface-border bg-surface px-3 text-base tabular-nums text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none disabled:opacity-50 sm:min-w-0 sm:flex-1"
            />
            <button type="button" onClick={() => setStartInput(playheadSeconds())} disabled={!Number.isFinite(duration)} aria-describedby={startLegendId} className="btn-ghost h-11 shrink-0 px-3 text-sm">
              Set to current time
            </button>
          </div>
          <p className="mt-1.5 text-xs tabular-nums text-ink-faint">{formatTime(start)}</p>
        </fieldset>
        <fieldset disabled={status === 'trimming'}>
          <legend id={endLegendId} className="mb-1.5 text-sm font-medium text-ink">End</legend>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="number"
              step="0.1"
              min={0}
              max={Number.isFinite(duration) ? duration : undefined}
              inputMode="decimal"
              placeholder={Number.isFinite(duration) ? formatTime(duration) : ''}
              value={endInput}
              disabled={!Number.isFinite(duration)}
              onChange={(e) => setEndInput(e.target.value)}
              aria-label="End time in seconds"
              className="h-11 w-full rounded-lg border border-surface-border bg-surface px-3 text-base tabular-nums text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none disabled:opacity-50 sm:min-w-0 sm:flex-1"
            />
            <button type="button" onClick={() => setEndInput(playheadSeconds())} disabled={!Number.isFinite(duration)} aria-describedby={endLegendId} className="btn-ghost h-11 shrink-0 px-3 text-sm">
              Set to current time
            </button>
          </div>
          <p className="mt-1.5 text-xs tabular-nums text-ink-faint">{formatTime(end)}</p>
        </fieldset>
      </div>

      {Number.isFinite(duration) && duration > 0 && (
        <div className="mt-4">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-soft" aria-hidden="true">
            <div
              className="absolute h-full rounded-full bg-accent"
              style={{ left: `${Math.max(0, Math.min(100, (start / duration) * 100))}%`, width: `${Math.max(0, Math.min(100, ((end - start) / duration) * 100))}%` }}
            />
            <div className="absolute top-0 h-full w-0.5 bg-ink" style={{ left: `${Math.max(0, Math.min(100, (currentTime / duration) * 100))}%` }} />
          </div>
          <p className="mt-1.5 min-h-5 text-xs tabular-nums text-ink-muted">
            {rangeError ? <span className="text-danger">{rangeError}</span> : `${formatTime(start)} → ${formatTime(end)} · ${formatTime(end - start)} selected`}
          </p>
        </div>
      )}

      <div className="mt-4">
        <button type="button" onClick={runTrim} disabled={!canTrim} className="btn-accent w-full sm:w-auto">
          {status === 'trimming' ? 'Trimming…' : 'Trim audio'}
        </button>
      </div>

      <p className="mt-3 text-xs text-ink-muted">🔒 Your file never leaves your device — trimming runs entirely in your browser.</p>

      <div aria-live="polite" className="mt-4">
        {status === 'trimming' && (
          <div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-soft" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.max(4, progress)}%` }} />
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              {progress > 0 ? `Trimming… ${progress}%` : engineWasReady ? 'Preparing the trimmer…' : 'Preparing the trimmer (first run downloads the engine once)…'} — keep this tab open.
            </p>
          </div>
        )}
        {status !== 'trimming' && trimError && <p className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{trimError}</p>}
        {result && status === 'ready' && (
          <div className="card animate-fade-up p-4">
            <audio controls src={result.url} className="w-full" />
            <p className="mt-3 text-sm text-ink-muted tabular-nums">
              {formatTime(start)} → {formatTime(end)} · {formatTime(result.duration)} · {(result.size / 1048576).toFixed(1)} MB
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={result.url} download={result.name} className="btn-accent">Download {result.name}</a>
              <button type="button" onClick={trimAnother} className="btn-ghost">Trim another part</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
