'use client';

import Script from 'next/script';
import { ads, ADS_ENABLED } from '@/lib/ads';

/**
 * Injects the base/global ad scripts once (rendered in the root layout).
 * Every script is conditional on its env var and loaded with a non-blocking
 * strategy so it never hurts LCP/INP. Nothing configured → nothing injected.
 */
export function AdScripts() {
  if (!ADS_ENABLED) return null;
  return (
    <>
      {/* Ezoic base — required before any Ezoic placeholder can show. */}
      {ads.ezoic.enabled && (
        <>
          <Script id="ezoic-init" strategy="afterInteractive">
            {`window.ezstandalone=window.ezstandalone||{};ezstandalone.cmd=ezstandalone.cmd||[];`}
          </Script>
          <Script src="//www.ezojs.com/ezoic/sa.min.js" strategy="afterInteractive" />
        </>
      )}

      {/* Media.net base — required before any Media.net slot can load. */}
      {ads.medianet.cid && (
        <>
          <Script id="mnet-init" strategy="afterInteractive">
            {`window._mNHandle=window._mNHandle||{};_mNHandle.queue=_mNHandle.queue||[];medianet_versionId="3121199";`}
          </Script>
          <Script
            src={`//contextual.media.net/dmedianet.js?cid=${ads.medianet.cid}`}
            strategy="afterInteractive"
          />
        </>
      )}

      {/* Global formats — popunder / social-bar / push. Lazy so they never block. */}
      {ads.adsterra.popunderSrc && <Script src={ads.adsterra.popunderSrc} strategy="lazyOnload" />}
      {ads.adsterra.socialBarSrc && <Script src={ads.adsterra.socialBarSrc} strategy="lazyOnload" />}
      {ads.hilltopads.popunderSrc && <Script src={ads.hilltopads.popunderSrc} strategy="lazyOnload" />}
      {ads.galaksion.src && <Script src={ads.galaksion.src} strategy="lazyOnload" />}

      {ads.monetag.src && (
        <Script
          src={ads.monetag.src}
          strategy="lazyOnload"
          data-cfasync="false"
          {...(ads.monetag.zone ? { 'data-zone': ads.monetag.zone } : {})}
        />
      )}
      {ads.propellerads.src && (
        <Script
          src={ads.propellerads.src}
          strategy="lazyOnload"
          data-cfasync="false"
          {...(ads.propellerads.zone ? { 'data-zone': ads.propellerads.zone } : {})}
        />
      )}
    </>
  );
}
