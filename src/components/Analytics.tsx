'use client';

import Script from 'next/script';
import { site } from '@/lib/site';

/**
 * Analytics loader — renders Plausible (preferred, cookieless) or Google
 * Analytics when configured. Both load lazily so they don't hurt Core Web Vitals.
 * Nothing configured → nothing loads.
 */
export function Analytics() {
  const { plausibleDomain, gaId } = site.analytics;
  return (
    <>
      {plausibleDomain && (
        <Script
          src="https://plausible.io/js/script.js"
          data-domain={plausibleDomain}
          strategy="afterInteractive"
        />
      )}
      {gaId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`}
          </Script>
        </>
      )}
    </>
  );
}
