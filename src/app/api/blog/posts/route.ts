import { cachedJson } from '@/lib/apiCache';
import { getAllPosts } from '@/lib/blog';
import { getBoolSetting } from '@/lib/config/settings.server';
import { getContentConfigRow, isContentEnabled } from '@/lib/config/contentConfig';
import { site } from '@/lib/site';

export const revalidate = 3600;

export async function GET() {
  if (!getBoolSetting('blogEnabled', true)) {
    return cachedJson({ updatedAt: new Date().toISOString(), count: 0, posts: [] });
  }

  const posts = getAllPosts()
    .filter((p) => isContentEnabled('blog-post', p.slug))
    .map((p) => {
      const config = getContentConfigRow('blog-post', p.slug);
      return {
        slug: p.slug,
        category: p.category,
        title: config.seoTitle || p.title,
        description: config.seoDescription || p.description,
        date: p.date,
        updated: p.updated ?? null,
        readingTime: p.readingTime,
        featured: config.featured,
        url: `${site.url}/blog/${p.category}/${p.slug}`,
      };
    });

  return cachedJson({ updatedAt: new Date().toISOString(), count: posts.length, posts });
}
