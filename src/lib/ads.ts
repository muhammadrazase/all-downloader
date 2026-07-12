/**
 * Ad-network configuration — 100% driven by NEXT_PUBLIC_* env vars.
 * Add the keys/scripts you have, rebuild, and those ads turn on. Leave a value
 * blank and that network stays completely off (no script, no layout shift).
 *
 * NEXT_PUBLIC_* values are public by design (ad keys are exposed in the browser
 * anyway) and are inlined at build time — so set them, then rebuild/redeploy.
 *
 * Two kinds of monetization:
 *  1. DISPLAY banners (in-content, CLS-safe): Ezoic → Media.net → Adsterra.
 *     Priority order — the first one you configure wins each slot.
 *  2. GLOBAL formats (popunder / social-bar / push): paste the exact <script>
 *     src your dashboard gives you. Loaded lazily so they never block the page.
 */

const env = (k: string): string => process.env[k] ?? '';

/**
 * Master switch. Ads are ON by default (each network still only shows once its
 * own key is set). Set NEXT_PUBLIC_ADS_ENABLED=false to kill EVERY ad site-wide
 * in one move — useful during a network review, a policy incident, or testing.
 */
export const ADS_ENABLED = env('NEXT_PUBLIC_ADS_ENABLED') !== 'false';

export const ads = {
  // ── Display-banner networks (in-content) ──────────────────────────
  ezoic: {
    enabled: env('NEXT_PUBLIC_EZOIC_ENABLED') === 'true',
  },
  medianet: {
    cid: env('NEXT_PUBLIC_MEDIANET_CID'),
    slotLeaderboard: env('NEXT_PUBLIC_MEDIANET_SLOT_LEADERBOARD'),
    slotRectangle: env('NEXT_PUBLIC_MEDIANET_SLOT_RECTANGLE'),
  },
  adsterra: {
    // Global formats (full script src from the Adsterra dashboard):
    popunderSrc: env('NEXT_PUBLIC_ADSTERRA_POPUNDER_SRC'),
    socialBarSrc: env('NEXT_PUBLIC_ADSTERRA_SOCIALBAR_SRC'),
    // Display banners (the "key" from a 728x90 / 300x250 banner unit):
    bannerKeyLeaderboard: env('NEXT_PUBLIC_ADSTERRA_BANNER_KEY_LEADERBOARD'),
    bannerKeyRectangle: env('NEXT_PUBLIC_ADSTERRA_BANNER_KEY_RECTANGLE'),
  },

  // ── Global-format networks (popunder / push / in-page) ────────────
  // ⚠️ AD-POLICY WARNING: premium display networks (Ezoic, Media.net, AdSense)
  // PROHIBIT running their ads on the same site as pop-unders / social-bars /
  // auto-redirects and will ban you for it. Choose ONE strategy:
  //   • Premium display (Ezoic/Media.net) → leave ALL of the below blank.
  //   • Aggressive globals (Adsterra/Monetag/etc.) → don't enable Ezoic/Media.net.
  // Never mix the two on the same deployment.
  monetag: {
    src: env('NEXT_PUBLIC_MONETAG_SRC'),
    zone: env('NEXT_PUBLIC_MONETAG_ZONE'),
  },
  propellerads: {
    src: env('NEXT_PUBLIC_PROPELLERADS_SRC'),
    zone: env('NEXT_PUBLIC_PROPELLERADS_ZONE'),
  },
  hilltopads: {
    popunderSrc: env('NEXT_PUBLIC_HILLTOPADS_POPUNDER_SRC'),
  },
  galaksion: {
    src: env('NEXT_PUBLIC_GALAKSION_SRC'),
  },
} as const;

export type BannerPlacement = 'leaderboard' | 'rectangle';

/** Which display network (if any) should render this placement. First configured wins. */
export function resolveBannerNetwork(
  placement: BannerPlacement,
): 'ezoic' | 'medianet' | 'adsterra' | null {
  if (!ADS_ENABLED) return null;
  if (ads.ezoic.enabled) return 'ezoic';
  if (ads.medianet.cid && (placement === 'leaderboard' ? ads.medianet.slotLeaderboard : ads.medianet.slotRectangle)) {
    return 'medianet';
  }
  const key = placement === 'leaderboard' ? ads.adsterra.bannerKeyLeaderboard : ads.adsterra.bannerKeyRectangle;
  if (key) return 'adsterra';
  return null;
}

/** True if any global (popunder/social-bar/push) script is configured. */
export const hasGlobalAdScripts = (): boolean =>
  ADS_ENABLED &&
  Boolean(
    ads.adsterra.popunderSrc ||
      ads.adsterra.socialBarSrc ||
      ads.monetag.src ||
      ads.propellerads.src ||
      ads.hilltopads.popunderSrc ||
      ads.galaksion.src,
  );

/** Standard ad dimensions per placement. */
export const AD_SIZE: Record<BannerPlacement, { w: number; h: number }> = {
  leaderboard: { w: 728, h: 90 },
  rectangle: { w: 300, h: 250 },
};
