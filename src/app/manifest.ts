import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';
import { PLATFORM_LIST } from '@/lib/platforms';

/** Web app manifest — makes SnapVidly installable as a standalone app on mobile & desktop. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: site.shortName,
    description: site.description,
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#2563EB',
    categories: ['utilities', 'productivity'],
    icons: [
      // PNGs first — required for reliable Android install, home-screen icon and splash.
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      // SVG as progressive enhancement for browsers that prefer it (crisp at any size).
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
    // "Share to SnapVidly" from any app (Android) → opens with the link pre-filled.
    share_target: {
      action: '/',
      method: 'GET',
      params: { url: 'grab', text: 'grab', title: 'grab' },
    },
    // App-like quick actions from the installed icon (long-press on mobile).
    // Browsers show ~4 max, so surface the highest-traffic platforms only.
    shortcuts: PLATFORM_LIST.slice(0, 4).map((p) => ({
      name: `${p.name} Downloader`,
      short_name: p.name,
      url: `/${p.slug}`,
    })),
  };
}
