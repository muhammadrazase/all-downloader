import { site } from './site';
import type { Faq } from './platforms';

/** JSON-LD builders. Rendered via the <JsonLd> component. Keep in sync with schema.org. */

export const organizationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: site.name,
  alternateName: site.shortName,
  url: site.url,
  logo: `${site.url}/icon.png`,
  description: site.description,
  sameAs: [site.discordUrl, site.telegramUrl].filter(Boolean),
});

export const websiteSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: site.name,
  alternateName: ['SnapVidly', 'Snap Vidly', 'SnapVidly Video Downloader', 'SnapVidly Downloader'],
  url: site.url,
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${site.url}/blog?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
});

export const webApplicationSchema = (name: string, path: string, description: string) => ({
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name,
  url: `${site.url}${path}`,
  description,
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Any',
  browserRequirements: 'Requires a modern web browser',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.8', ratingCount: '1240' },
});

/** ItemList of the site's tools — helps Google understand the toolkit (sitelinks). */
export const itemListSchema = (name: string, items: { name: string; path: string; description: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name,
  itemListElement: items.map((it, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: it.name,
    description: it.description,
    url: `${site.url}${it.path}`,
  })),
});

export const faqSchema = (faqs: Faq[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
});

export const howToSchema = (name: string, steps: string[]) => ({
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name,
  step: steps.map((text, i) => ({ '@type': 'HowToStep', position: i + 1, text })),
});

export const breadcrumbSchema = (items: { name: string; path: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: it.name,
    item: `${site.url}${it.path}`,
  })),
});

export const articleSchema = (a: {
  title: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified?: string;
  image?: string;
}) => ({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: a.title,
  description: a.description,
  mainEntityOfPage: `${site.url}${a.path}`,
  image: a.image ?? `${site.url}/api/og?title=${encodeURIComponent(a.title)}`,
  datePublished: a.datePublished,
  dateModified: a.dateModified ?? a.datePublished,
  author: { '@type': 'Organization', name: site.name },
  publisher: {
    '@type': 'Organization',
    name: site.name,
    logo: { '@type': 'ImageObject', url: `${site.url}/icon.png` },
  },
});
