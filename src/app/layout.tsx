import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { JsonLd } from '@/components/JsonLd';
import { ConsentGate } from '@/components/ConsentGate';
import { PwaRegister } from '@/components/PwaRegister';
import { organizationSchema, websiteSchema } from '@/lib/schema';
import { site } from '@/lib/site';

// Font strategy: a native system-font stack (see globals.css `--font-inter`).
// This ships ZERO web-font bytes and makes ZERO runtime request — the fastest
// possible option and ideal for the CWV budget. To brand with Inter later,
// drop an Inter woff2 into /public/fonts and load it via `next/font/local`.

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — Free HD Video Downloader for TikTok, Instagram, YouTube & More`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  keywords: [
    // Brand terms — these win branded search.
    'SnapVidly',
    'snapvidly',
    'SnapVidly downloader',
    'SnapVidly video downloader',
    'snap vidly',
    // Category terms
    'video downloader',
    'tiktok downloader',
    'instagram video downloader',
    'youtube downloader',
    'facebook video downloader',
    'linkedin video downloader',
    'download videos without watermark',
  ],
  authors: [{ name: site.name }],
  creator: site.name,
  robots: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  alternates: { canonical: '/', types: { 'application/rss+xml': `${site.url}/rss.xml` } },
  appleWebApp: {
    capable: true,
    title: site.shortName,
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/icon',
    shortcut: '/icon',
    apple: '/apple-icon',
  },
  verification: {
    ...(site.verification.google ? { google: site.verification.google } : {}),
    ...(site.verification.yandex ? { yandex: site.verification.yandex } : {}),
    ...(site.verification.bing ? { other: { 'msvalidate.01': site.verification.bing } } : {}),
  },
};

export const viewport: Viewport = {
  themeColor: '#2563EB',
  width: 'device-width',
  initialScale: 1,
  // App-like on notched phones; still allows zoom for accessibility.
  viewportFit: 'cover',
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <JsonLd data={organizationSchema()} />
        <JsonLd data={websiteSchema()} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-fg"
        >
          Skip to content
        </a>
        <Navbar />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
        <ConsentGate />
        <PwaRegister />
      </body>
    </html>
  );
}
