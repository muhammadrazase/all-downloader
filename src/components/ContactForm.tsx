'use client';

import { useState } from 'react';
import { site } from '@/lib/site';

/**
 * Contact form → posts to /api/contact (SMTP email, server-side).
 * Falls back to a mailto link if SMTP isn't configured or the send fails.
 * Includes a honeypot field for spam protection.
 */
type Status = 'idle' | 'sending' | 'sent' | 'error';

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [company, setCompany] = useState(''); // honeypot (hidden)
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  const mailto = () => {
    const subject = encodeURIComponent(`SnapVidly contact from ${name || 'a visitor'}`);
    const body = encodeURIComponent(`${message}\n\n— ${name}${email ? ` (${email})` : ''}`);
    window.location.href = `mailto:${site.email}?subject=${subject}&body=${body}`;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setError('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, message, company }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setStatus('sent');
        setName('');
        setEmail('');
        setMessage('');
        return;
      }
      // SMTP not set up → open the user's mail app instead.
      if (data.error === 'not_configured') {
        mailto();
        setStatus('idle');
        return;
      }
      setStatus('error');
      setError(data.error || 'Something went wrong.');
    } catch {
      setStatus('error');
      setError('Network error. Please try again.');
    }
  };

  if (status === 'sent') {
    return (
      <div className="card p-8 text-center">
        <p className="text-lg font-semibold text-success">✓ Message sent</p>
        <p className="mt-2 text-sm text-ink-muted">Thanks for reaching out — we usually reply within one business day.</p>
        <button type="button" onClick={() => setStatus('idle')} className="btn-ghost mt-5">
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-ink">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1.5 h-11 w-full rounded-lg border border-surface-border bg-surface px-3 text-ink focus:border-accent focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1.5 h-11 w-full rounded-lg border border-surface-border bg-surface px-3 text-ink focus:border-accent focus:outline-none"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-sm font-medium text-ink">Message</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={5}
          className="mt-1.5 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-ink focus:border-accent focus:outline-none"
        />
      </label>

      {/* Honeypot — hidden from users, catches bots. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
        aria-hidden="true"
      />

      {status === 'error' && (
        <p className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error} You can also email{' '}
          <a href={`mailto:${site.email}`} className="underline">{site.email}</a>.
        </p>
      )}

      <button type="submit" disabled={status === 'sending'} className="btn-accent w-full sm:w-auto">
        {status === 'sending' ? 'Sending…' : 'Send message'}
      </button>
      <p className="text-xs text-ink-muted">
        Prefer email? Write to <a href={`mailto:${site.email}`} className="text-accent">{site.email}</a>.
      </p>
    </form>
  );
}
