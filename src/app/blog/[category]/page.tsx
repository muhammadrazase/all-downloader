import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BlogCard } from '@/components/BlogCard';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { AdSlot } from '@/components/ads/AdSlot';
import { getPostsByCategory, getAllCategories, CATEGORY_LABEL, type BlogCategory } from '@/lib/blog';
import { PLATFORMS } from '@/lib/platforms';
import { buildMetadata } from '@/lib/seo';
import { breadcrumbSchema } from '@/lib/schema';

export const dynamic = 'force-static';
export const dynamicParams = false;

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

  const label = CATEGORY_LABEL[category];
  const posts = getPostsByCategory(category);
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

      <div className="container-page">
        <AdSlot placement="rectangle" ezoicId={104} />
      </div>

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
