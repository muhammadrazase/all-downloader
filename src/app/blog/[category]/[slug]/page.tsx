import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { MDXRemote } from 'next-mdx-remote-client/rsc';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { BlogCard, formatDate } from '@/components/BlogCard';
import { PlatformIcon } from '@/components/PlatformIcon';
import { getPost, getAllPostParams, getPostsByCategory, CATEGORY_LABEL, type BlogCategory } from '@/lib/blog';
import { PLATFORMS } from '@/lib/platforms';
import { buildMetadata } from '@/lib/seo';
import { articleSchema, breadcrumbSchema } from '@/lib/schema';
import { getSeoOverride, isContentEnabled } from '@/lib/config/contentConfig';
import { getBoolSetting } from '@/lib/config/settings.server';

export const dynamic = 'force-static';
// true so a post published from the admin panel after the last build renders
// on its first request instead of needing a full redeploy (see savePostAction).
export const dynamicParams = true;

export function generateStaticParams() {
  return getAllPostParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}): Promise<Metadata> {
  const { category, slug } = await params;
  const post = getPost(category, slug);
  if (!post) return {};
  const override = getSeoOverride('blog-post', slug);
  return buildMetadata({
    title: override?.title || post.title,
    description: override?.description || post.description,
    path: override?.canonical || `/blog/${category}/${slug}`,
    noindex: override?.noindex,
    image: override?.ogImage,
    keywords: override?.keywords || [post.keyword],
    type: 'article',
    publishedTime: post.date,
  });
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category, slug } = await params;
  const post = getPost(category, slug);
  if (!post || post.draft) notFound();
  if (!getBoolSetting('blogEnabled', true) || !isContentEnabled('blog-post', slug)) redirect('/');

  const cat = category as BlogCategory;
  const platform = PLATFORMS[cat];
  const related = getPostsByCategory(cat)
    .filter((p) => p.slug !== slug && isContentEnabled('blog-post', p.slug))
    .slice(0, 3);
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Blog', path: '/blog' },
    { name: CATEGORY_LABEL[cat], path: `/blog/${cat}` },
    { name: post.title, path: `/blog/${cat}/${slug}` },
  ];

  return (
    <>
      <JsonLd
        data={articleSchema({
          title: post.title,
          description: post.description,
          path: `/blog/${cat}/${slug}`,
          datePublished: post.date,
          dateModified: post.updated,
        })}
      />
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <div className="container-page pt-8">
        <Breadcrumbs items={crumbs} />
      </div>

      <article className="container-page py-10">
        <header className="mx-auto max-w-prose text-center">
          <div className="flex items-center justify-center gap-2 text-sm font-medium text-ink-muted">
            <PlatformIcon platform={cat} color={platform.brandColor} className="h-4 w-4" />
            {CATEGORY_LABEL[cat]}
            <span className="text-ink-faint">· {post.readingTime} min read</span>
          </div>
          <h1 className="mt-4 text-3xl font-bold text-ink sm:text-4xl">{post.title}</h1>
          <time dateTime={post.date} className="mt-4 block text-sm text-ink-faint">
            {formatDate(post.date)}
          </time>
        </header>

        <div className="prose-ssd mx-auto mt-10">
          <Suspense fallback={null}>
            <MDXRemote source={post.content} />
          </Suspense>
        </div>

        {/* Conversion CTA back to the tool */}
        <aside className="mx-auto mt-14 max-w-prose">
          <div className="card flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-ink">Ready to download {CATEGORY_LABEL[cat]} videos?</p>
              <p className="mt-1 text-sm text-ink-muted">Free, fast, no watermark — right in your browser.</p>
            </div>
            <Link href={`/${platform.slug}`} className="btn-accent shrink-0">
              Open the {CATEGORY_LABEL[cat]} downloader
            </Link>
          </div>
        </aside>

        {related.length > 0 && (
          <section className="mt-16" aria-labelledby="related-heading">
            <h2 id="related-heading" className="text-center text-2xl">
              Related {CATEGORY_LABEL[cat]} articles
            </h2>
            <div className="mx-auto mt-8 grid max-w-content gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r) => (
                <BlogCard key={r.slug} post={r} />
              ))}
            </div>
          </section>
        )}
      </article>
    </>
  );
}
