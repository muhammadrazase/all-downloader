'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { QrScanError, isOpenableUrl } from '@/lib/qrScan';

type Mode = 'upload' | 'camera';
type Status = 'idle' | 'scanning' | 'done' | 'error';

const SCAN_INTERVAL_MS = 120; // ~8/sec — plenty for a static code, and keeps the main thread mostly idle

export function QrScannerBox() {
  const [mode, setMode] = useState<Mode>('upload');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  // Bumped by stopCamera — cancels a stale in-flight getUserMedia/play()/decode that a plain
  // cancelAnimationFrame can't reach mid-await.
  const sessionRef = useRef(0);

  useEffect(() => {
    setCameraSupported(typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia);
  }, []);

  const stopCamera = useCallback(() => {
    sessionRef.current += 1;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const decodeFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setStatus('scanning');
    setMessage('');
    setResult(null);
    setCopied(false);
    try {
      const { scanImageFile } = await import('@/lib/qrScan');
      const { data } = await scanImageFile(file);
      setResult(data);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof QrScanError ? err.message : 'Could not scan this image.');
    }
  }, []);

  const loop = useCallback(async (session: number, lastScanAt: number) => {
    if (session !== sessionRef.current || !videoRef.current || !streamRef.current) return;
    const now = performance.now();
    if (now - lastScanAt < SCAN_INTERVAL_MS) {
      rafRef.current = requestAnimationFrame(() => void loop(session, lastScanAt));
      return;
    }
    const { scanVideoFrame } = await import('@/lib/qrScan');
    const found = await scanVideoFrame(videoRef.current);
    if (session !== sessionRef.current) return; // this camera session ended while decoding
    if (found) {
      setResult(found.data);
      setStatus('done');
      setCopied(false);
      stopCamera();
      return;
    }
    rafRef.current = requestAnimationFrame(() => void loop(session, now));
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    const session = ++sessionRef.current;
    setStatus('scanning');
    setMessage('');
    setResult(null);
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      // The user may have switched mode, retried, or left while the permission prompt was open.
      if (session !== sessionRef.current) throw new Error('superseded');
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (session !== sessionRef.current) throw new Error('superseded');
      rafRef.current = requestAnimationFrame(() => void loop(session, 0));
    } catch {
      // Never leave a live track unreachable — this stream may not be the one stopCamera() knows
      // about yet (it can resolve after a newer session already started).
      stream?.getTracks().forEach((t) => t.stop());
      if (streamRef.current === stream) streamRef.current = null;
      if (session === sessionRef.current) {
        setStatus('error');
        setMessage('Could not access your camera. Check that you allowed camera permission, or upload an image instead.');
      }
    }
  }, [loop]);

  const switchMode = useCallback(
    (next: Mode) => {
      stopCamera();
      setMode(next);
      setStatus('idle');
      setMessage('');
      setResult(null);
      setCopied(false);
      if (next === 'camera') void startCamera();
    },
    [stopCamera, startCamera],
  );

  const scanAnother = useCallback(() => {
    setResult(null);
    setStatus('idle');
    setMessage('');
    setCopied(false);
    if (mode === 'camera') void startCamera();
  }, [mode, startCamera]);

  const copy = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
    } catch {
      /* clipboard permission denied — the text is still shown on screen to copy manually */
    }
  }, [result]);

  return (
    <div className="w-full">
      <div className="flex gap-2">
        <button type="button" onClick={() => switchMode('upload')} className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${mode === 'upload' ? 'border-accent bg-accent-soft text-accent' : 'border-surface-border text-ink-muted hover:text-ink'}`}>
          Upload image
        </button>
        {cameraSupported && (
          <button type="button" onClick={() => switchMode('camera')} className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${mode === 'camera' ? 'border-accent bg-accent-soft text-accent' : 'border-surface-border text-ink-muted hover:text-ink'}`}>
            Use camera
          </button>
        )}
      </div>

      {mode === 'upload' && status !== 'done' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); void decodeFile(e.dataTransfer.files[0]); }}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Choose an image containing a QR code"
          className={`card mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed p-8 text-center transition-colors ${dragging ? 'border-accent bg-accent-soft' : 'border-surface-border'}`}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-ink-faint" aria-hidden="true">
            <path d="M12 16V4m0 0L8 8m4-4 4 4M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="font-medium text-ink">Drag a QR code image here, or click to choose</p>
          <p className="text-xs text-ink-muted">PNG, JPEG, WebP, BMP or GIF</p>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/bmp,image/gif" className="hidden" onChange={(e) => void decodeFile(e.target.files?.[0])} />
        </div>
      )}

      {mode === 'camera' && status !== 'done' && (
        <div className="relative mt-4 flex h-72 items-center justify-center overflow-hidden rounded-xl border border-surface-border bg-ink sm:h-96">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- a live camera feed has no caption track */}
          <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
          <p className="absolute bottom-3 rounded-full bg-ink/70 px-3 py-1 text-xs text-surface">Point your camera at a QR code</p>
        </div>
      )}

      <p className="mt-3 text-xs text-ink-muted">
        🔒 {mode === 'camera' ? 'Your camera feed never leaves your device — decoding runs entirely in your browser.' : 'Your image never leaves your device — decoding runs entirely in your browser.'}
      </p>

      <div aria-live="polite" className="mt-4">
        {status === 'error' && <p className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{message}</p>}
        {status === 'done' && result && (
          <div className="card animate-fade-up p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Decoded content</p>
            <p className="mt-1 break-all rounded-lg bg-surface-soft p-3 text-sm text-ink">{result}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {isOpenableUrl(result) && (
                <a href={result} target="_blank" rel="noopener noreferrer" className="btn-accent">Open link</a>
              )}
              <button type="button" onClick={copy} className="btn-ghost">{copied ? 'Copied!' : 'Copy text'}</button>
              <button type="button" onClick={scanAnother} className="btn-ghost">Scan another</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
