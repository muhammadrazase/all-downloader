'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { captureFrame, VideoFrameError, isVideoFile, assertGrabbable, MAX_INPUT_MB, type FrameFormat } from '@/lib/videoFrame';

type Status = 'idle' | 'loading' | 'ready' | 'capturing' | 'error';

interface Frame {
  id: string;
  url: string;
  width: number;
  height: number;
  atSeconds: number;
  format: FrameFormat;
}

const FORMAT_EXT: Record<FrameFormat, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

/** Rounds to tenths BEFORE splitting into minutes — rounding after the split renders a
 * 59.97 s video as the nonsense "0:60.0". */
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00.0';
  const tenths = Math.round(seconds * 10);
  const minutes = Math.floor(tenths / 600);
  return `${minutes}:${((tenths - minutes * 600) / 10).toFixed(1).padStart(4, '0')}`;
}

let frameIdCounter = 0;

export function VideoFrameGrabberBox() {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(NaN);
  const [currentTime, setCurrentTime] = useState(0);
  const [format, setFormat] = useState<FrameFormat>('image/png');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [frames, setFrames] = useState<Frame[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoUrlRef = useRef<string | null>(null);
  const framesRef = useRef<Frame[]>([]);
  framesRef.current = frames;

  useEffect(() => () => {
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    framesRef.current.forEach((f) => URL.revokeObjectURL(f.url));
  }, []);

  const pick = useCallback((f: File | undefined) => {
    if (!f) return;
    try {
      assertGrabbable(f);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof VideoFrameError && err.code === 'too_large' ? `That file is over ${MAX_INPUT_MB} MB.` : 'Please choose a video file.');
      return;
    }
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    framesRef.current.forEach((fr) => URL.revokeObjectURL(fr.url));
    const url = URL.createObjectURL(f);
    videoUrlRef.current = url;
    setFile(f);
    setVideoUrl(url);
    setDuration(NaN);
    setCurrentTime(0);
    setFrames([]);
    setStatus('loading');
    setMessage('');
  }, []);

  const changeVideo = useCallback(() => {
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    framesRef.current.forEach((f) => URL.revokeObjectURL(f.url));
    videoUrlRef.current = null;
    setFile(null);
    setVideoUrl(null);
    setDuration(NaN);
    setFrames([]);
    setStatus('idle');
    setMessage('');
  }, []);

  /** A file can pass the extension/MIME check yet be undecodable — without this the player sits blank forever with no explanation. */
  const failLoad = useCallback((src: string) => {
    if (src !== videoUrlRef.current) return;
    URL.revokeObjectURL(src);
    videoUrlRef.current = null;
    setFile(null);
    setVideoUrl(null);
    setDuration(NaN);
    setStatus('error');
    setMessage('Your browser could not open this video. Try an MP4, MOV or WebM file.');
  }, []);

  const grab = useCallback(async () => {
    if (!videoRef.current) return;
    setStatus('capturing');
    setMessage('');
    try {
      const captured = await captureFrame(videoRef.current, format);
      const url = URL.createObjectURL(captured.blob);
      setFrames((prev) => [{ id: `frame-${++frameIdCounter}`, url, width: captured.width, height: captured.height, atSeconds: currentTime, format }, ...prev]);
      setStatus('ready');
    } catch (err) {
      setStatus('ready');
      setMessage(err instanceof VideoFrameError ? err.message : 'Could not capture this frame.');
    }
  }, [format, currentTime]);

  const removeFrame = useCallback((id: string) => {
    setFrames((prev) => {
      const frame = prev.find((f) => f.id === id);
      if (frame) URL.revokeObjectURL(frame.url);
      return prev.filter((f) => f.id !== id);
    });
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
          aria-label="Choose a video file to grab a frame from"
          className={`card flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed p-8 text-center transition-colors ${dragging ? 'border-accent bg-accent-soft' : 'border-surface-border hover:border-ink-faint'}`}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-ink-faint" aria-hidden="true">
            <path d="M12 16V4m0 0L8 8m4-4 4 4M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="font-medium text-ink">Drag a video here, or click to choose</p>
          <p className="text-xs text-ink-muted">MP4, MOV, WebM… up to {MAX_INPUT_MB} MB</p>
          <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </div>
        <p className="mt-3 text-xs text-ink-muted">🔒 Your video never leaves your device — capturing runs entirely in your browser.</p>
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
            {(file.size / 1048576).toFixed(1)} MB{Number.isFinite(duration) ? ` · ${formatTime(duration)}` : ' · reading the video…'}
          </p>
        </div>
        <button type="button" onClick={changeVideo} className="btn-ghost shrink-0 px-3 py-1.5 text-xs">Change video</button>
      </div>

      <div className="relative mt-3 flex h-64 items-center justify-center overflow-hidden rounded-xl border border-surface-border bg-ink sm:h-80">
        {status === 'loading' && <p className="absolute text-sm text-surface">Loading video…</p>}
        {videoUrl && (
          // eslint-disable-next-line jsx-a11y/media-has-caption -- a locally-loaded user file has no caption track to offer
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            playsInline
            preload="metadata"
            className="relative max-h-full max-w-full"
            onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration); setStatus((s) => (s === 'loading' ? 'ready' : s)); }}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onError={(e) => failLoad(e.currentTarget.src)}
          />
        )}
      </div>

      <p className="mt-2 text-xs tabular-nums text-ink-muted">Playhead: {formatTime(currentTime)} — play, pause or scrub to the moment you want, then capture it.</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          Format
          <select aria-label="Format" value={format} onChange={(e) => (e.target.value === 'image/png' || e.target.value === 'image/jpeg' || e.target.value === 'image/webp') && setFormat(e.target.value)} className="h-10 rounded-md border border-surface-border bg-surface px-2 text-ink">
            <option value="image/png">PNG (lossless)</option>
            <option value="image/jpeg">JPEG</option>
            <option value="image/webp">WebP</option>
          </select>
        </label>
        <button type="button" onClick={grab} disabled={status === 'capturing' || !isVideoFile(file)} className="btn-accent">
          {status === 'capturing' ? 'Capturing…' : 'Capture this frame'}
        </button>
      </div>

      <p className="mt-3 text-xs text-ink-muted">🔒 Your video never leaves your device — capturing runs entirely in your browser.</p>

      <div aria-live="polite" className="mt-4">
        {message && <p className="mb-3 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{message}</p>}
        {frames.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {frames.map((frame) => (
              <li key={frame.id} className="card animate-fade-up p-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob result, not a remote asset */}
                <img src={frame.url} alt={`Frame at ${formatTime(frame.atSeconds)}`} width={frame.width} height={frame.height} className="mx-auto h-auto w-full max-h-40 rounded-lg object-contain" />
                <p className="mt-2 text-xs tabular-nums text-ink-muted">{formatTime(frame.atSeconds)} · {frame.width}×{frame.height}px</p>
                <div className="mt-2 flex gap-2">
                  <a href={frame.url} download={`frame-${formatTime(frame.atSeconds).replace(/[:.]/g, '-')}.${FORMAT_EXT[frame.format]}`} className="btn-ghost flex-1 px-2 py-1 text-center text-xs">Download</a>
                  <button type="button" onClick={() => removeFrame(frame.id)} aria-label="Remove this frame" className="text-ink-faint hover:text-danger">✕</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
