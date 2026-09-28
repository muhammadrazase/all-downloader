'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PdfEngineError, type ProtectOptions } from '@/lib/pdfEngine';

const MAX_MB = 50;

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

/** Revokes the previous blob URL on replacement/unmount, not via effect cleanup — that breaks under StrictMode's remount. */
function useOutputFile(): [OutputFile | null, (next: OutputFile | null) => void] {
  const [output, setOutput] = useState<OutputFile | null>(null);
  const ref = useRef<OutputFile | null>(null);

  const publish = useCallback((next: OutputFile | null) => {
    if (ref.current) URL.revokeObjectURL(ref.current.url);
    ref.current = next;
    setOutput(next);
  }, []);

  useEffect(() => () => {
    if (ref.current) URL.revokeObjectURL(ref.current.url);
  }, []);

  return [output, publish];
}

function UploadIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-ink-faint" aria-hidden="true">
      <path d="M12 16V4m0 0L8 8m4-4 4 4M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 3l18 18M10.7 5.1A11 11 0 0 1 12 5c7 0 10.5 7 10.5 7a18.3 18.3 0 0 1-3.1 4.2M6.3 6.6C3.6 8.4 1.5 12 1.5 12s3.5 7 10.5 7a10.6 10.6 0 0 0 4.3-.9M9.9 14.1a3 3 0 0 1 4.2-4.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 text-success" aria-hidden="true">
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7.5 11V7.5a4.5 4.5 0 0 1 9 0V11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function dropZoneClass(dragging: boolean): string {
  return `card flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed p-8 text-center transition-colors ${dragging ? 'border-accent bg-accent-soft' : 'border-surface-border hover:border-ink-faint'}`;
}

type Permissions = { printing: boolean; copying: boolean; modifying: boolean };

const DEFAULT_PERMISSIONS: Permissions = { printing: true, copying: true, modifying: true };

/** "Printing and editing are blocked; copying text is allowed." — always names what's blocked before what's allowed. */
function permissionSummary(p: Permissions): string {
  const labels: Record<keyof Permissions, string> = { printing: 'Printing', modifying: 'Editing', copying: 'Copying text' };
  const keys = (['printing', 'modifying', 'copying'] as const);
  const blocked = keys.filter((k) => !p[k]).map((k) => labels[k]);
  const allowed = keys.filter((k) => p[k]).map((k) => labels[k]);
  if (blocked.length === 0) return 'Anyone with the password can print, copy and edit.';
  if (allowed.length === 0) return 'The password only allows opening the file — printing, editing and copying are all blocked.';
  const verb = (n: number) => (n > 1 ? 'are' : 'is');
  return `${blocked.join(' and ')} ${verb(blocked.length)} blocked; ${allowed.join(' and ')} ${verb(allowed.length)} allowed.`;
}

/** Each checkbox spans several PDF permission bits — "Edit" must also clear documentAssembly/
 * annotating/fillingForms, or "Editing is blocked" would be a lie. contentAccessibility stays on always: it's screen-reader access, not a copy-protection lever. */
function toPdfPermissions(p: Permissions): NonNullable<ProtectOptions['permissions']> {
  return {
    printing: p.printing ? 'highResolution' : false,
    copying: p.copying,
    modifying: p.modifying,
    documentAssembly: p.modifying,
    annotating: p.modifying,
    fillingForms: p.modifying,
    contentAccessibility: true,
  };
}

type ProtectStatus = 'idle' | 'checking' | 'working' | 'done' | 'error';

export function PdfProtectBox() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showEchoedPassword, setShowEchoedPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [permissions, setPermissions] = useState<Permissions>(DEFAULT_PERMISSIONS);
  const [status, setStatus] = useState<ProtectStatus>('idle');
  const [message, setMessage] = useState('');
  const [alreadyEncrypted, setAlreadyEncrypted] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [output, publishOutput] = useOutputFile();
  const inputRef = useRef<HTMLInputElement>(null);
  const bytesRef = useRef<Uint8Array | null>(null);

  const pick = useCallback((f: File | undefined) => {
    if (!f) return;
    if (!isPdf(f)) {
      setStatus('error');
      setMessage('Please choose a PDF file.');
      setAlreadyEncrypted(false);
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setStatus('error');
      setMessage(`That file is over ${MAX_MB} MB.`);
      setAlreadyEncrypted(false);
      return;
    }
    setFile(f);
    setPageCount(null);
    setAlreadyEncrypted(false);
    setMessage('');
    publishOutput(null);
    setStatus('checking');

    (async () => {
      const bytes = new Uint8Array(await f.arrayBuffer());
      bytesRef.current = bytes;
      try {
        const { getPageCount } = await import('@/lib/pdfEngine');
        setPageCount(await getPageCount(bytes));
        setStatus('idle');
      } catch (e) {
        setStatus('error');
        if (e instanceof PdfEngineError && e.code === 'encrypted') {
          setAlreadyEncrypted(true);
        } else {
          setMessage(e instanceof PdfEngineError ? e.message : 'Could not read this PDF. It may be corrupted.');
        }
      }
    })();
  }, [publishOutput]);

  // A protected file whose password or permissions have changed no longer matches what's on screen.
  useEffect(() => {
    publishOutput(null);
    setStatus((s) => (s === 'done' ? 'idle' : s));
  }, [password, permissions, publishOutput]);

  const run = useCallback(async () => {
    if (!file || !bytesRef.current || !password || alreadyEncrypted || status === 'working' || status === 'checking') return;
    setStatus('working');
    setMessage('');
    setCopied(false);
    try {
      const { protectPdf } = await import('@/lib/pdfEngine');
      const out = await protectPdf(bytesRef.current, { password, permissions: toPdfPermissions(permissions) });
      publishOutput({ url: pdfBlobUrl(out), name: `${baseName(file.name)}-protected.pdf` });
      setStatus('done');
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof PdfEngineError ? e.message : 'Could not protect this file.');
    }
  }, [file, password, permissions, alreadyEncrypted, status, publishOutput]);

  const copyPassword = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied — the password is still visible and selectable, so this is a soft failure.
    }
  }, [password]);

  const reset = useCallback(() => {
    setFile(null);
    setPageCount(null);
    setPassword('');
    setPermissions(DEFAULT_PERMISSIONS);
    setStatus('idle');
    setMessage('');
    setAlreadyEncrypted(false);
    // Both reveals go back to masked: the next password is a different secret, and leaving
    // the field in plain text would show it on screen with no deliberate act by the user.
    setShowPassword(false);
    setShowEchoedPassword(false);
    setCopied(false);
    publishOutput(null);
  }, [publishOutput]);

  const allAllowed = permissions.printing && permissions.copying && permissions.modifying;
  const canRun = !!file && !!password && !alreadyEncrypted && status !== 'working' && status !== 'checking';

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
        aria-label="Choose a PDF file to protect"
        className={dropZoneClass(dragging)}
      >
        <UploadIcon />
        <p className="max-w-full break-words font-medium text-ink">{file ? file.name : 'Drag a PDF here, or click to choose'}</p>
        <p className="text-xs text-ink-muted">
          {file ? `${(file.size / 1048576).toFixed(1)} MB${pageCount !== null ? ` · ${pageCount} page${pageCount === 1 ? '' : 's'}` : ''}` : `PDF, up to ${MAX_MB} MB`}
        </p>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      </div>

      {file && !alreadyEncrypted && (
        <>
          <div className="mt-4">
            <label htmlFor="protect-password" className="mb-1 block text-sm font-medium text-ink">Password</label>
            <div className="relative">
              <input
                id="protect-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                spellCheck={false}
                autoCapitalize="off"
                className="h-11 w-full rounded-lg border border-surface-border bg-surface px-3 pr-12 text-base text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-controls="protect-password"
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-ink-faint transition-colors hover:text-ink"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            <p className="mt-1.5 min-h-5 text-xs text-ink-muted">
              {password.length === 0 ? 'Anyone opening the file will be asked for this.' : password.length < 6 ? 'Short passwords are easy to guess.' : ''}
            </p>
          </div>

          <fieldset className="mt-4">
            <legend className="mb-1.5 text-sm font-medium text-ink">Recipients can</legend>
            {/* min-h-11 on the label, not the 16px box: the whole label is the hit area, and a
                checkbox you have to hit precisely is the one control people miss on a phone. */}
            <div className="flex flex-wrap gap-x-6">
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink-muted">
                <input type="checkbox" checked={permissions.printing} onChange={(e) => setPermissions((p) => ({ ...p, printing: e.target.checked }))} className="h-4 w-4 accent-accent" />
                Print
              </label>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink-muted">
                <input type="checkbox" checked={permissions.copying} onChange={(e) => setPermissions((p) => ({ ...p, copying: e.target.checked }))} className="h-4 w-4 accent-accent" />
                Copy text
              </label>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink-muted">
                <input type="checkbox" checked={permissions.modifying} onChange={(e) => setPermissions((p) => ({ ...p, modifying: e.target.checked }))} className="h-4 w-4 accent-accent" />
                Edit
              </label>
            </div>
            <p className={`mt-2 text-xs ${allAllowed ? 'text-ink-muted' : 'text-ink'}`}>{permissionSummary(permissions)}</p>
            <p className="mt-1 text-xs text-ink-faint">These limits are respected by standard PDF readers — they aren&apos;t unbreakable.</p>
          </fieldset>
        </>
      )}

      <div className="mt-4">
        <button type="button" onClick={run} disabled={!canRun} className="btn-accent w-full sm:w-auto">
          {status === 'working' ? 'Protecting…' : status === 'checking' ? 'Reading PDF…' : 'Protect PDF'}
        </button>
      </div>

      <p className="mt-3 text-xs text-ink-muted">🔒 Your file never leaves your device — encryption runs entirely in your browser.</p>

      <div aria-live="polite" className="mt-4">
        {status === 'error' && alreadyEncrypted && (
          <p className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
            This PDF is already password-protected —{' '}
            <Link href="/unlock-pdf" className="font-medium underline hover:no-underline">unlock it first</Link>.
          </p>
        )}
        {status === 'error' && !alreadyEncrypted && message && (
          <p className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{message}</p>
        )}
        {status === 'done' && output && (
          <div className="card animate-fade-up p-4">
            {/* items-start, not items-center: a long file name wraps to several lines, and the
                tick belongs beside the first of them rather than floating in their middle. */}
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex"><CheckIcon /></span>
              <span className="min-w-0 break-words font-medium text-ink">Protected — {output.name}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={output.url} download={output.name} className="btn-accent min-w-0 max-w-full">
                <span className="min-w-0 truncate">Download {output.name}</span>
              </a>
              <button type="button" onClick={reset} className="btn-ghost">Protect another</button>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-surface-border bg-surface-soft px-3 py-2 text-sm">
              <span className="shrink-0 text-ink-muted">Password</span>
              <code className="flex-1 truncate text-ink">{showEchoedPassword ? password : '•'.repeat(password.length)}</code>
              <button type="button" onClick={() => setShowEchoedPassword((v) => !v)} aria-label={showEchoedPassword ? 'Hide password' : 'Show password'} className="shrink-0 text-ink-faint hover:text-ink">
                {showEchoedPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
              <button type="button" onClick={copyPassword} className="btn-ghost shrink-0 px-2 py-1 text-xs">{copied ? 'Copied' : 'Copy'}</button>
            </div>
            <p className="mt-2 text-xs text-ink-faint">Save it somewhere safe — this password can&apos;t be recovered.</p>
          </div>
        )}
      </div>
    </div>
  );
}

type UnlockStatus = 'idle' | 'checking' | 'locked' | 'unprotected' | 'unlocking' | 'done' | 'error';

export function PdfUnlockBox() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UnlockStatus>('idle');
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [attemptCount, setAttemptCount] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [output, publishOutput] = useOutputFile();
  const inputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const bytesRef = useRef<Uint8Array | null>(null);

  // Fires on every transition INTO 'locked' — both the first time a protected file is
  // detected, and again after a wrong password, matching the "refocus on retry" requirement.
  useEffect(() => {
    if (status === 'locked') passwordInputRef.current?.focus();
  }, [status]);

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
    setPassword('');
    setFieldError('');
    setAttemptCount(0);
    setMessage('');
    publishOutput(null);
    setStatus('checking');

    (async () => {
      const bytes = new Uint8Array(await f.arrayBuffer());
      bytesRef.current = bytes;
      try {
        const { isPdfEncrypted } = await import('@/lib/pdfEngine');
        setStatus((await isPdfEncrypted(bytes)) ? 'locked' : 'unprotected');
      } catch (e) {
        setStatus('error');
        setMessage(e instanceof PdfEngineError ? e.message : 'Could not read this PDF. It may be corrupted.');
      }
    })();
  }, [publishOutput]);

  const reset = useCallback(() => {
    setFile(null);
    setPassword('');
    setFieldError('');
    setAttemptCount(0);
    setStatus('idle');
    setMessage('');
    publishOutput(null);
  }, [publishOutput]);

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bytesRef.current || !file || status === 'unlocking') return;
    setStatus('unlocking');
    setFieldError('');
    try {
      const { unlockPdf } = await import('@/lib/pdfEngine');
      const out = await unlockPdf(bytesRef.current, password);
      publishOutput({ url: pdfBlobUrl(out), name: `${baseName(file.name)}-unlocked.pdf` });
      setStatus('done');
    } catch (e2) {
      setAttemptCount((n) => n + 1);
      setPassword('');
      setFieldError(e2 instanceof PdfEngineError ? e2.message : 'Could not unlock this file.');
      setStatus('locked');
    }
  }, [file, password, status, publishOutput]);

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
        aria-label="Choose a password-protected PDF file"
        className={dropZoneClass(dragging)}
      >
        <UploadIcon />
        <p className="max-w-full break-words font-medium text-ink">{file ? file.name : 'Drag a PDF here, or click to choose'}</p>
        <p className="flex items-center justify-center gap-1.5 text-xs text-ink-muted">
          {file ? (
            <>
              {(file.size / 1048576).toFixed(1)} MB
              {status === 'locked' || status === 'unlocking' || status === 'done' ? (
                <>
                  {' · '}<LockIcon />Password-protected
                </>
              ) : null}
            </>
          ) : (
            `PDF, up to ${MAX_MB} MB`
          )}
        </p>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      </div>

      {(status === 'locked' || status === 'unlocking') && (
        <form onSubmit={submit}>
          <div className="mt-4">
            <label htmlFor="unlock-password" className="mb-1 block text-sm font-medium text-ink">Password</label>
            <div className="relative">
              <input
                ref={passwordInputRef}
                id="unlock-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setFieldError(''); }}
                autoComplete="current-password"
                spellCheck={false}
                autoCapitalize="off"
                aria-invalid={fieldError ? 'true' : undefined}
                aria-describedby={fieldError ? 'unlock-password-error' : undefined}
                className={`h-11 w-full rounded-lg border bg-surface px-3 pr-12 text-base text-ink placeholder:text-ink-faint focus:outline-none ${fieldError ? 'border-danger' : 'border-surface-border focus:border-accent'}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-controls="unlock-password"
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-ink-faint transition-colors hover:text-ink"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            <div id="unlock-password-error" aria-live="polite" className="mt-1.5 min-h-5 text-xs">
              {fieldError && (
                <p className="text-danger">
                  {fieldError}
                  {attemptCount >= 2 && (
                    <span className="mt-1 block text-ink-muted">A PDF can carry two passwords — you need the one that opens the document, not the one that changes its permissions.</span>
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="mt-4">
            <button type="submit" disabled={status === 'unlocking'} className="btn-accent w-full sm:w-auto">
              {status === 'unlocking' ? 'Unlocking…' : 'Unlock PDF'}
            </button>
          </div>
        </form>
      )}

      {status === 'unprotected' && (
        <div className="mt-4 rounded-lg border border-surface-border bg-surface-soft px-4 py-3 text-sm text-ink-muted">
          This PDF isn&apos;t password-protected — there&apos;s nothing to unlock.
          <div className="mt-2">
            <button type="button" onClick={reset} className="btn-ghost">Choose a different PDF</button>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-ink-muted">🔒 Your file and password never leave your device — unlocking runs entirely in your browser.</p>

      <div aria-live="polite" className="mt-4">
        {status === 'error' && message && <p className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{message}</p>}
        {status === 'done' && output && (
          <div className="card animate-fade-up p-4">
            <div className="flex items-center gap-2">
              <CheckIcon />
              <span className="font-medium text-ink">Password removed</span>
            </div>
            <p className="mt-1 text-xs text-ink-muted">This copy opens without a password.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={output.url} download={output.name} className="btn-accent min-w-0 max-w-full">
                <span className="min-w-0 truncate">Download {output.name}</span>
              </a>
              <button type="button" onClick={reset} className="btn-ghost">Unlock another</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
