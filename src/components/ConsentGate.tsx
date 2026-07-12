'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdScripts } from './ads/AdScripts';
import { Analytics } from './Analytics';

/**
 * Optional consent gate (GDPR/CCPA). Enable with NEXT_PUBLIC_CONSENT_REQUIRED=true.
 *
 *  - When NOT required → ad + analytics scripts load client-side normally.
 *  - When required → they load ONLY after the visitor accepts; a banner is shown
 *    until they choose. Declining keeps ads/analytics off.
 *
 * The scripts are rendered INSIDE this client component (not passed as children),
 * so when consent is required nothing third-party appears in the HTML until Accept.
 */
export function ConsentGate() {
  const required = process.env.NEXT_PUBLIC_CONSENT_REQUIRED === 'true';
  const [consent, setConsent] = useState<'accepted' | 'declined' | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!required) {
      setConsent('accepted');
      setReady(true);
      return;
    }
    const stored = localStorage.getItem('ssd-consent');
    setConsent(stored === 'accepted' ? 'accepted' : stored === 'declined' ? 'declined' : null);
    setReady(true);
  }, [required]);

  const choose = (value: 'accepted' | 'declined') => {
    localStorage.setItem('ssd-consent', value);
    setConsent(value);
  };

  return (
    <>
      {consent === 'accepted' && (
        <>
          <AdScripts />
          <Analytics />
        </>
      )}
      {ready && required && consent === null && (
        <div
          role="dialog"
          aria-label="Cookie consent"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-surface-border bg-surface/95 backdrop-blur"
        >
          <div className="container-page flex flex-col items-center gap-3 py-4 sm:flex-row sm:justify-between">
            <p className="text-sm text-ink-muted">
              We use cookies for ads and analytics to keep this tool free. See our{' '}
              <Link href="/privacy" className="font-medium text-accent hover:text-accent-hover">
                privacy policy
              </Link>
              .
            </p>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => choose('declined')} className="btn-ghost px-4 py-2 text-sm">
                Decline
              </button>
              <button type="button" onClick={() => choose('accepted')} className="btn-accent px-4 py-2 text-sm">
                Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
