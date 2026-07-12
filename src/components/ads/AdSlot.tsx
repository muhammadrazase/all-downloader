'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ads, resolveBannerNetwork, AD_SIZE, type BannerPlacement } from '@/lib/ads';
import { HouseAd } from './HouseAd';
import type { OfferContext } from '@/lib/offers';

/**
 * A single in-content display banner.
 *  - CLS-safe: reserves the ad's height up front (filling it causes no shift).
 *  - Lazy: the ad script only loads when the slot is ~400px from the viewport,
 *    which protects Core Web Vitals AND improves viewability (networks pay on
 *    viewable impressions, so eager below-fold ads waste money).
 *  - No paid fill → a first-party/affiliate HOUSE AD fills the slot instead of
 *    leaving it blank (unsold inventory is most of a new site's impressions).
 *
 * Network priority: Ezoic → Media.net → Adsterra (first configured wins).
 */
export function AdSlot({
  placement,
  ezoicId,
  context = 'downloader',
  className = '',
}: {
  placement: BannerPlacement;
  /** Ezoic placeholder id you created in the Ezoic dashboard (required for Ezoic). */
  ezoicId?: number;
  /** Which affiliate context the house-ad fallback should draw from. */
  context?: OfferContext;
  className?: string;
}) {
  const network = resolveBannerNetwork(placement);
  const { ref, inView } = useInView<HTMLDivElement>();

  // No paid network (or an Ezoic slot with no id) → fill the unsold slot with a house ad.
  if (!network || (network === 'ezoic' && !ezoicId)) {
    return <HouseAd placement={placement} context={context} className={className} />;
  }

  const { w, h } = AD_SIZE[placement];

  return (
    <div className={`my-8 flex flex-col items-center ${className}`}>
      <span
        className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ink-faint"
        style={{ visibility: inView ? 'visible' : 'hidden' }}
      >
        Advertisement
      </span>
      <div ref={ref} className="mx-auto w-full max-w-full overflow-hidden" style={{ minHeight: h, maxWidth: w }}>
        {inView && network === 'ezoic' && <EzoicSlot id={ezoicId!} />}
        {inView && network === 'medianet' && <MediaNetSlot placement={placement} width={w} height={h} />}
        {inView && network === 'adsterra' && <AdsterraSlot placement={placement} width={w} height={h} />}
      </div>
    </div>
  );
}

/** Loads the ad only when the slot approaches the viewport. */
function useInView<T extends Element>(rootMargin = '400px') {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [inView, rootMargin]);
  return { ref, inView };
}

/** Ezoic placeholder — showAds is called once the base script is ready. */
function EzoicSlot({ id }: { id: number }) {
  useEffect(() => {
    const w = window as unknown as { ezstandalone?: { cmd: Array<() => void>; showAds: (id: number) => void } };
    w.ezstandalone?.cmd.push(() => w.ezstandalone!.showAds(id));
  }, [id]);
  return <div id={`ezoic-pub-ad-placeholder-${id}`} />;
}

/** Media.net slot — loadTag is queued until the base script is ready. */
function MediaNetSlot({ placement, width, height }: { placement: BannerPlacement; width: number; height: number }) {
  const slotId = placement === 'leaderboard' ? ads.medianet.slotLeaderboard : ads.medianet.slotRectangle;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!slotId) return;
    const w = window as unknown as {
      _mNHandle?: { queue: Array<() => void> };
      _mNDetails?: { loadTag: (id: string, size: string, crid: string) => void };
    };
    w._mNHandle?.queue.push(() => {
      w._mNDetails?.loadTag(slotId, `${width}x${height}`, slotId);
    });
  }, [slotId, width, height]);
  return <div id={slotId} ref={ref} />;
}

/**
 * Adsterra banner rendered inside an isolated iframe. This sandboxes the
 * third-party script (security) and avoids the global `atOptions` collision that
 * breaks multiple Adsterra banners on one page (correctness).
 */
function AdsterraSlot({ placement, width, height }: { placement: BannerPlacement; width: number; height: number }) {
  const uid = useId().replace(/:/g, '');
  const key = placement === 'leaderboard' ? ads.adsterra.bannerKeyLeaderboard : ads.adsterra.bannerKeyRectangle;
  if (!key) return null;

  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden}</style></head><body>
<script type="text/javascript">
  atOptions = { 'key':'${key}', 'format':'iframe', 'height':${height}, 'width':${width}, 'params':{} };
<\/script>
<script type="text/javascript" src="//www.highperformanceformat.com/${key}/invoke.js"><\/script>
</body></html>`;

  return (
    <iframe
      title={`ad-${uid}`}
      width={width}
      height={height}
      style={{ border: 0, display: 'block', margin: '0 auto', maxWidth: '100%' }}
      scrolling="no"
      sandbox="allow-scripts allow-same-origin allow-popups"
      srcDoc={srcDoc}
      loading="lazy"
    />
  );
}
