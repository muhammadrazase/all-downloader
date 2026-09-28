'use client';

import Script from 'next/script';

/**
 * Analytics loader — renders Plausible (preferred, cookieless) or Google
 * Analytics when configured. Both load lazily so they don't hurt Core Web Vitals.
 * Nothing configured → nothing loads. Values come from the root layout (DB >
 * env), not read here directly — this is a Client Component and can't reach
 * the admin DB itself.
 */
export function Analytics({ plausibleDomain, gaId }: { plausibleDomain: string; gaId: string }) {
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
