import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';
import { PLATFORM_LIST } from '@/lib/platforms';
import { IMAGE_TOOL_LIST } from '@/lib/imageTools';
import { CONVERTER_LIST } from '@/lib/converterTools';
import { AI_TOOL_LIST } from '@/lib/aiTools';
import { PDF_TOOL_LIST } from '@/lib/pdfTools';
import { FILE_TOOL_LIST } from '@/lib/fileTools';
import { getAllPosts, getAllCategories } from '@/lib/blog';
import { isSitemapEligible } from '@/lib/config/contentConfig';
import { getBoolSetting } from '@/lib/config/settings.server';

/** Every indexable URL; drops anything hidden or noindexed from the admin panel. */
export default function sitemap(): MetadataRoute.Sitemap {
  // Evaluated at build time — the site is fully static, so this is the real build/deploy date.
  const now = new Date();
  const base = site.url;
  const blogEnabled = getBoolSetting('blogEnabled', true);

  const PLATFORM_VISIBLE = PLATFORM_LIST.filter((p) => isSitemapEligible('platform', p.key));
  const IMAGE_TOOL_VISIBLE = IMAGE_TOOL_LIST.filter((t) => isSitemapEligible('image-tool', t.key));
  const CONVERTER_VISIBLE = CONVERTER_LIST.filter((t) => isSitemapEligible('converter', t.key));
  const AI_TOOL_VISIBLE = AI_TOOL_LIST.filter((t) => isSitemapEligible('ai-tool', t.key));
  const PDF_TOOL_VISIBLE = PDF_TOOL_LIST.filter((t) => isSitemapEligible('pdf-tool', t.key));
  const FILE_TOOL_VISIBLE = FILE_TOOL_LIST.filter((t) => isSitemapEligible('file-tool', t.key));

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/video-downloader`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
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

  const toolPages: MetadataRoute.Sitemap = PLATFORM_VISIBLE.flatMap((p) => [
    { url: `${base}/${p.slug}`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/how-to/${p.key}`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
  ]);

  const imageToolPages: MetadataRoute.Sitemap = IMAGE_TOOL_VISIBLE.map((t) => ({
    url: `${base}/${t.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.85,
  }));

  const converterPages: MetadataRoute.Sitemap = CONVERTER_VISIBLE.map((t) => ({
    url: `${base}/${t.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.85,
  }));

  const aiToolPages: MetadataRoute.Sitemap = AI_TOOL_VISIBLE.map((t) => ({
    url: `${base}/${t.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.85,
  }));

  const pdfToolPages: MetadataRoute.Sitemap = PDF_TOOL_VISIBLE.map((t) => ({
    url: `${base}/${t.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.85,
  }));

  const fileToolPages: MetadataRoute.Sitemap = FILE_TOOL_VISIBLE.map((t) => ({
    url: `${base}/${t.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.85,
  }));

  const categoryPages: MetadataRoute.Sitemap = blogEnabled
    ? getAllCategories().map((c) => ({
        url: `${base}/blog/${c}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }))
    : [];

  const postPages: MetadataRoute.Sitemap = blogEnabled
    ? getAllPosts()
        .filter((post) => isSitemapEligible('blog-post', post.slug))
        .map((post) => ({
          url: `${base}/blog/${post.category}/${post.slug}`,
          lastModified: new Date(post.updated ?? post.date),
          changeFrequency: 'monthly' as const,
          priority: 0.7,
        }))
    : [];

  const blogIndex = blogEnabled ? staticPages : staticPages.filter((p) => p.url !== `${base}/blog`);

  return [...blogIndex, ...toolPages, ...imageToolPages, ...converterPages, ...aiToolPages, ...pdfToolPages, ...fileToolPages, ...categoryPages, ...postPages];
}
