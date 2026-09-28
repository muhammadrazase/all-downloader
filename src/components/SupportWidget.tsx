'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { BankTransferDetails } from '@/lib/bankTransfer';

const PRESETS = [5, 10, 25];

interface Props {
  safepayEnabled: boolean;
  bankTransfer: BankTransferDetails | null;
}

/** Persistent floating widget (bottom-right, every page) — a small trigger that
 * expands into a card, never a full page section. Shows bank transfer details
 * when configured (the reliable option while card payments are being sorted
 * out), the real Safepay checkout when configured, or falls back to /contact
 * when neither is set up. All amounts are USD only, by design. */
export function SupportWidget({ safepayEnabled, bankTransfer }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number | null>(PRESETS[0] ?? null);
  const [customAmount, setCustomAmount] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selectPreset = (value: number) => {
    setIsCustom(false);
    setAmount(value);
    setStatus('idle');
  };

  const selectCustom = () => {
    setIsCustom(true);
    setStatus('idle');
  };

  const finalAmount = isCustom ? Number(customAmount) : amount;
  const canSubmit = Boolean(finalAmount && finalAmount >= 1 && finalAmount <= 2000);

  const startCheckout = async () => {
    if (!canSubmit || !finalAmount) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/support/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amount: finalAmount, currency: 'USD' }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setStatus('error');
    } catch {
      setStatus('error');
    }
  };

  const hasAnyPaymentOption = Boolean(bankTransfer) || safepayEnabled;

  return (
    <div ref={ref} className="fixed bottom-5 right-5 z-40">
      <div
        role="dialog"
        aria-label="Support SnapVidly"
        aria-hidden={!open}
        inert={!open}
        className={`absolute bottom-14 right-0 w-80 origin-bottom-right rounded-2xl border border-surface-border bg-surface p-5 shadow-lg transition-all duration-200 ease-enter ${
          open ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
        }`}
      >
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <CoffeeGlyph size={20} />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">Buy us a coffee</h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              SnapVidly is built with love and kept free for everyone. If it saved you time today, a small token
              of appreciation would mean the world, and it goes straight toward keeping this project alive.
            </p>
          </div>
        </div>

        {bankTransfer && <BankTransferSection details={bankTransfer} />}

        {safepayEnabled && (
          <>
            {bankTransfer && (
              <p className="mb-3 mt-5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                <span className="h-px flex-1 bg-surface-border" />
                Or pay by card
                <span className="h-px flex-1 bg-surface-border" />
              </p>
            )}
            <div className={bankTransfer ? '' : 'mt-4'}>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={!isCustom && amount === p}
                    onClick={() => selectPreset(p)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
                      !isCustom && amount === p
                        ? 'border-accent bg-accent text-white'
                        : 'border-surface-border bg-surface-soft text-ink-muted hover:border-accent/30'
                    }`}
                  >
                    ${p}
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={isCustom}
                  onClick={selectCustom}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
                    isCustom ? 'border-accent bg-accent text-white' : 'border-surface-border bg-surface-soft text-ink-muted hover:border-accent/30'
                  }`}
                >
                  Any amount
                </button>
              </div>

              {isCustom && (
                <label className="mt-2.5 block">
                  <span className="sr-only">Custom amount in dollars</span>
                  <div className="flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 focus-within:border-accent">
                    <span className="text-sm text-ink-faint">$</span>
                    <input
                      type="number"
                      min={1}
                      max={2000}
                      step={1}
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="w-full bg-transparent text-sm text-ink outline-none"
                    />
                  </div>
                </label>
              )}

              {status === 'error' && (
                <p className="mt-2.5 text-xs text-danger">Could not start checkout. Please try again in a moment.</p>
              )}

              <div className="mt-3">
                <button type="button" onClick={startCheckout} disabled={!canSubmit || status === 'loading'} className="btn-accent w-full text-sm">
                  {status === 'loading' ? 'Redirecting…' : 'Send a token of appreciation'}
                </button>
              </div>
            </div>
          </>
        )}

        {!hasAnyPaymentOption && (
          <>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {[...PRESETS.map((p) => `$${p}`), 'Any amount'].map((label) => (
                <span key={label} className="rounded-full border border-surface-border bg-surface-soft px-2.5 py-1 text-xs font-medium text-ink-muted">
                  {label}
                </span>
              ))}
            </div>
            <div className="mt-4">
              <Link href="/contact" className="btn-accent w-full text-sm">
                Say thanks
              </Link>
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Close support widget' : 'Support SnapVidly'}
        className="flex items-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-accent-fg shadow-lg transition-[background-color,transform] duration-150 ease-enter hover:bg-accent-hover hover:-translate-y-0.5 active:translate-y-0 active:scale-95 active:duration-100"
      >
        <CoffeeGlyph size={18} />
        Support us
      </button>
    </div>
  );
}

function BankTransferSection({ details }: { details: BankTransferDetails }) {
  const rows: { label: string; value: string }[] = [
    { label: 'Account title', value: details.accountTitle },
    { label: 'Account number', value: details.accountNumber },
    { label: 'IBAN', value: details.iban },
    { label: 'Swift code', value: details.swiftCode },
    { label: 'Bank name', value: details.bankName },
    { label: 'Branch name', value: details.branchName },
    { label: 'Branch code', value: details.branchCode },
  ].filter((r) => r.value);

  const copyAll = () => {
    const text = rows.map((r) => `${r.label}: ${r.value}`).join('\n');
    void navigator.clipboard?.writeText(text).catch(() => {});
  };

  return (
    <div className="mt-4">
      <p className="text-xs font-medium text-ink">Send any amount (USD) directly by bank transfer:</p>
      <dl className="mt-2 space-y-1.5 rounded-lg bg-surface-soft p-3">
        {rows.map((r) => (
          <CopyRow key={r.label} label={r.label} value={r.value} />
        ))}
      </dl>
      <button
        type="button"
        onClick={copyAll}
        className="mt-2 text-xs font-medium text-accent transition-colors duration-200 hover:text-accent-hover"
      >
        Copy all details
      </button>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permission denied — the value is still selectable/visible as text.
    }
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <dt className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</dt>
        <dd className="truncate font-mono text-xs text-ink">{value}</dd>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="shrink-0 rounded-md p-1.5 text-ink-faint transition-colors duration-150 hover:bg-surface hover:text-accent active:scale-90"
      >
        {copied ? <CheckGlyph /> : <CopyGlyph />}
      </button>
    </div>
  );
}

function CoffeeGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8z" />
      <path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17" />
      <path d="M8 3c0 .8-1 .8-1 1.6s1 .8 1 1.6M12 3c0 .8-1 .8-1 1.6s1 .8 1 1.6" />
    </svg>
  );
}

function CopyGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
