import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SiteChrome } from '@/components/SiteChrome';
import { Footer } from '@/components/Footer';
import { JsonLd } from '@/components/JsonLd';
import { ConsentGate } from '@/components/ConsentGate';
import { PwaRegister } from '@/components/PwaRegister';
import { organizationSchema, websiteSchema } from '@/lib/schema';
import { site } from '@/lib/site';
import { getSetting, getBoolSetting } from '@/lib/config/settings.server';
import { safepayConfigured } from '@/lib/safepay';
import { getBankTransferDetails } from '@/lib/bankTransfer';
import { filterVisible } from '@/lib/config/contentConfig';
import { PLATFORM_LIST } from '@/lib/platforms';
import { AI_TOOL_LIST } from '@/lib/aiTools';
import { CONVERTER_LIST } from '@/lib/converterTools';
import { IMAGE_TOOL_LIST } from '@/lib/imageTools';
import { PDF_TOOL_LIST } from '@/lib/pdfTools';
import { FILE_TOOL_LIST } from '@/lib/fileTools';

// Font strategy: a native system-font stack (see globals.css `--font-inter`).
// This ships ZERO web-font bytes and makes ZERO runtime request — the fastest
// possible option and ideal for the CWV budget. To brand with Inter later,
// drop an Inter woff2 into /public/fonts and load it via `next/font/local`.

export async function generateMetadata(): Promise<Metadata> {
  // Admin-editable (Site settings) — DB > env.
  const google = getSetting('GOOGLE_SITE_VERIFICATION') || site.verification.google;
  const yandex = getSetting('YANDEX_VERIFICATION') || site.verification.yandex;
  const bing = getSetting('BING_SITE_VERIFICATION') || site.verification.bing;

  return {
    metadataBase: new URL(site.url),
    title: {
      default: `${site.name} | Free Video Downloader, AI, PDF & File Tools`,
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
      // Category terms — downloader (highest volume) plus the wider tool hub.
      'video downloader',
      'tiktok downloader',
      'instagram video downloader',
      'youtube downloader',
      'facebook video downloader',
      'linkedin video downloader',
      'download videos without watermark',
      'free online tools',
      'ai video tools',
      'pdf tools online',
      'video converter online',
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
      ...(google ? { google } : {}),
      ...(yandex ? { yandex } : {}),
      ...(bing ? { other: { 'msvalidate.01': bing } } : {}),
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#2563EB',
  width: 'device-width',
  initialScale: 1,
  // App-like on notched phones; still allows zoom for accessibility.
  viewportFit: 'cover',
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Filtered here and passed to Navbar as plain minimal props — not the full
  // registry objects, which carry a `hostPattern: RegExp` that can't cross
  // the Server->Client boundary. See src/components/Navbar.tsx.
  const platforms = filterVisible('platform', PLATFORM_LIST, (p) => p.key).map((p) => ({
    key: p.key,
    slug: p.slug,
    name: p.name,
    brandColor: p.brandColor,
  }));
  const toNamedLink = (t: { slug: string; name: string }) => ({ slug: t.slug, name: t.name });
  const aiTools = filterVisible('ai-tool', AI_TOOL_LIST, (t) => t.key).map(toNamedLink);
  const converters = filterVisible('converter', CONVERTER_LIST, (t) => t.key).map(toNamedLink);
  const imageTools = filterVisible('image-tool', IMAGE_TOOL_LIST, (t) => t.key).map(toNamedLink);
  const pdfTools = filterVisible('pdf-tool', PDF_TOOL_LIST, (t) => t.key).map(toNamedLink);
  const fileTools = filterVisible('file-tool', FILE_TOOL_LIST, (t) => t.key).map(toNamedLink);
  const maintenanceMode = getBoolSetting('maintenanceMode', false);
  const plausibleDomain = getSetting('PLAUSIBLE_DOMAIN') || site.analytics.plausibleDomain;
  const gaId = getSetting('GA_ID') || site.analytics.gaId;
  const safepayEnabled = safepayConfigured();
  const bankTransfer = getBankTransferDetails();

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
        <SiteChrome
          platforms={platforms}
          aiTools={aiTools}
          converters={converters}
          imageTools={imageTools}
          pdfTools={pdfTools}
          fileTools={fileTools}
          safepayEnabled={safepayEnabled}
          bankTransfer={bankTransfer}
          footer={<Footer />}
          maintenanceMode={maintenanceMode}
        >
          {children}
        </SiteChrome>
        <ConsentGate plausibleDomain={plausibleDomain} gaId={gaId} />
        <PwaRegister />
      </body>
    </html>
  );
}
