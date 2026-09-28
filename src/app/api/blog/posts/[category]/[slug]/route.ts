import { NextResponse } from 'next/server';
import { cachedJson } from '@/lib/apiCache';
import { getPost, getAllPostParams } from '@/lib/blog';
import { getBoolSetting } from '@/lib/config/settings.server';
import { getContentConfigRow, isContentEnabled } from '@/lib/config/contentConfig';
import { site } from '@/lib/site';

export const revalidate = 3600;
// Only prebuilt (category, slug) pairs are served. Without this the route runs
// for arbitrary params, which reach fs.readFileSync via getPost() — a traversal
// and file-existence oracle.
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPostParams();
}

export async function GET(_req: Request, { params }: { params: Promise<{ category: string; slug: string }> }) {
  const { category, slug } = await params;

  if (!getBoolSetting('blogEnabled', true) || !isContentEnabled('blog-post', slug)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const post = getPost(category, slug);
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const config = getContentConfigRow('blog-post', slug);
  return cachedJson({
    slug: post.slug,
    category: post.category,
    title: config.seoTitle || post.title,
    description: config.seoDescription || post.description,
    date: post.date,
    updated: post.updated ?? null,
    readingTime: post.readingTime,
    featured: config.featured,
    content: post.content,
    url: `${site.url}/blog/${post.category}/${post.slug}`,
  });
}
