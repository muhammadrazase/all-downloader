/**
 * Base URL — set via NEXT_PUBLIC_SITE_URL (inlined at build). Everything (canonical
 * tags, sitemap, manifest, on-site QR) derives from this, so `npm run build:pwa
 * <url>` re-points the whole app in one shot. Falls back to the production domain.
 */
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://snapvidly.com').replace(/\/+$/, '');

/** Global site configuration — single source of truth for brand + URLs. */
export const site = {
  name: 'SnapVidly',
  shortName: 'SnapVidly',
  domain: new URL(SITE_URL).host,
  url: SITE_URL,
  tagline: 'Download any social video — free, fast, no watermark.',
  description:
    'SnapVidly is a free all-in-one video downloader for TikTok, Instagram, YouTube, Facebook, X (Twitter), Reddit, Pinterest, Vimeo, Twitch and more. Save videos in HD — no signup, no watermark. Works on mobile and PC.',
  locale: 'en_US',
  twitter: '@snapvidly',
  email: 'support@snapvidly.com',
  // Community
  // Community links — set in .env (empty = hidden until you add them).
  discordUrl: process.env.NEXT_PUBLIC_DISCORD_URL ?? '',
  telegramUrl: process.env.NEXT_PUBLIC_TELEGRAM_URL ?? '',
  // Chrome Web Store URL for the extension (empty = "coming soon").
  chromeExtensionUrl: process.env.NEXT_PUBLIC_CHROME_EXTENSION_URL ?? '',
  // Giscus (community/comments) — fill from https://giscus.app
  giscus: {
    repo: process.env.NEXT_PUBLIC_GISCUS_REPO ?? '',
    repoId: process.env.NEXT_PUBLIC_GISCUS_REPO_ID ?? '',
    category: 'Community',
    categoryId: process.env.NEXT_PUBLIC_GISCUS_CATEGORY_ID ?? '',
  },
  // Search Console verification (paste the token, not the whole tag).
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? '',
    bing: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION ?? '',
    yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION ?? '',
  },
  // Cookieless analytics (best for CWV). Set one.
  analytics: {
    plausibleDomain: process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ?? '',
    gaId: process.env.NEXT_PUBLIC_GA_ID ?? '',
  },
} as const;

export const nav = {
  tools: [
    { label: 'TikTok', href: '/tiktok-downloader' },
    { label: 'Instagram', href: '/instagram-video-downloader' },
    { label: 'YouTube', href: '/youtube-video-downloader' },
    { label: 'Facebook', href: '/facebook-video-downloader' },
    { label: 'LinkedIn', href: '/linkedin-video-downloader' },
  ],
  primary: [
    { label: 'Blog', href: '/blog' },
    { label: 'Community', href: '/community' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ],
  legal: [
    { label: 'Terms', href: '/terms' },
    { label: 'Privacy', href: '/privacy' },
    { label: 'DMCA', href: '/dmca' },
    { label: 'Disclaimer', href: '/disclaimer' },
  ],
} as const;
