import type { Metadata } from 'next';
import { site } from './site';

interface SeoInput {
  title: string;
  description: string;
  path: string; // absolute path beginning with '/'
  type?: 'website' | 'article';
  image?: string;
  publishedTime?: string;
  noindex?: boolean;
  keywords?: string[];
}

/**
 * Single helper every page uses for metadata — guarantees canonical, OG and
 * Twitter tags are always present and consistent. Never hand-roll <head>.
 */
export function buildMetadata({
  title,
  description,
  path,
  type = 'website',
  image,
  publishedTime,
  noindex,
  keywords,
}: SeoInput): Metadata {
  const url = `${site.url}${path}`;
  const ogImage = image ?? `${site.url}/api/og?title=${encodeURIComponent(title)}`;
  return {
    title,
    description,
    ...(keywords?.length ? { keywords } : {}),
    alternates: { canonical: url },
    robots: noindex
      ? { index: false, follow: true }
      : { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
    openGraph: {
      type,
      url,
      title,
      description,
      siteName: site.name,
      locale: site.locale,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      ...(publishedTime ? { publishedTime } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
      creator: site.twitter,
    },
  };
}
