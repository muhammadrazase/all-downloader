import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BlogCard } from '@/components/BlogCard';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { getPostsByCategory, getAllCategories, CATEGORY_LABEL, type BlogCategory } from '@/lib/blog';
import { PLATFORMS } from '@/lib/platforms';
import { buildMetadata } from '@/lib/seo';
import { breadcrumbSchema } from '@/lib/schema';
import { isContentEnabled } from '@/lib/config/contentConfig';
import { getBoolSetting } from '@/lib/config/settings.server';

export const dynamic = 'force-static';
// true so a category's first post (published after the last build) makes the
// category page itself renderable on first request, without a full redeploy.
export const dynamicParams = true;

export function generateStaticParams() {
  return getAllCategories().map((category) => ({ category }));
}

const isCategory = (c: string): c is BlogCategory => (getAllCategories() as string[]).includes(c);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  if (!isCategory(category)) return {};
  const label = CATEGORY_LABEL[category];
  return buildMetadata({
    title: `${label} Guides, Tips & Trends`,
    description: `${label} download guides, history, creator tips and 2026 trends from SnapVidly.`,
    path: `/blog/${category}`,
  });
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  if (!isCategory(category)) notFound();
  if (!getBoolSetting('blogEnabled', true)) redirect('/');

  const label = CATEGORY_LABEL[category];
  const posts = getPostsByCategory(category).filter((p) => isContentEnabled('blog-post', p.slug));
  const platform = PLATFORMS[category];
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Blog', path: '/blog' },
    { name: label, path: `/blog/${category}` },
  ];

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <section className="container-page pt-8">
        <Breadcrumbs items={crumbs} />
      </section>

      <section className="container-page py-10 text-center">
        <h1 className="text-4xl font-bold text-ink">{label} guides & trends</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-muted">
          Everything {label} — how to download, what’s changing in 2026, and how to create content that performs.
        </p>
        <Link href={`/${platform.slug}`} className="btn-accent mt-6">
          Open the {label} downloader
        </Link>
      </section>

      <section className="container-page py-10">
        {posts.length === 0 ? (
          <p className="text-center text-ink-muted">Articles coming soon.</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <BlogCard key={p.slug} post={p} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
