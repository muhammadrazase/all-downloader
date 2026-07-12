import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';
import { PLATFORM_LIST } from '@/lib/platforms';
import { IMAGE_TOOL_LIST } from '@/lib/imageTools';
import { CONVERTER_LIST } from '@/lib/converterTools';
import { AI_TOOL_LIST } from '@/lib/aiTools';
import { getAllPosts, getAllCategories } from '@/lib/blog';

/** Every indexable URL, generated at build. Keeps Google in sync automatically. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date('2026-01-01');
  const base = site.url;

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/video-downloader`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/tools`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/batch-video-downloader`, lastModified: now, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${base}/browser-extension`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/blog`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/community`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/dmca`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/disclaimer`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];

  const toolPages: MetadataRoute.Sitemap = PLATFORM_LIST.flatMap((p) => [
    { url: `${base}/${p.slug}`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/how-to/${p.key}`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
  ]);

  const imageToolPages: MetadataRoute.Sitemap = IMAGE_TOOL_LIST.map((t) => ({
    url: `${base}/${t.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.85,
  }));

  const converterPages: MetadataRoute.Sitemap = CONVERTER_LIST.map((t) => ({
    url: `${base}/${t.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.85,
  }));

  const aiToolPages: MetadataRoute.Sitemap = AI_TOOL_LIST.map((t) => ({
    url: `${base}/${t.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.85,
  }));

  const categoryPages: MetadataRoute.Sitemap = getAllCategories().map((c) => ({
    url: `${base}/blog/${c}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  const postPages: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `${base}/blog/${post.category}/${post.slug}`,
    lastModified: new Date(post.updated ?? post.date),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [...staticPages, ...toolPages, ...imageToolPages, ...converterPages, ...aiToolPages, ...categoryPages, ...postPages];
}
