import Link from 'next/link';
import type { Metadata } from 'next';
import { BlogCard } from '@/components/BlogCard';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { getAllPosts, getAllCategories, CATEGORY_LABEL } from '@/lib/blog';
import { PLATFORMS } from '@/lib/platforms';
import { PlatformIcon } from '@/components/PlatformIcon';
import { AdSlot } from '@/components/ads/AdSlot';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-static';

export const metadata: Metadata = buildMetadata({
  title: 'Blog — Tips, Trends & Guides for TikTok, Instagram, YouTube & More',
  description:
    'Guides, download how-tos, platform history and 2026 trends for TikTok, Instagram, YouTube, Facebook, LinkedIn, X (Twitter), Reddit, Pinterest, Vimeo, Twitch and Tumblr. Learn to save and create better social video.',
  path: '/blog',
});

export default function BlogIndex() {
  const posts = getAllPosts();
  const categories = getAllCategories();

  return (
    <>
      <section className="container-page pt-8">
        <Breadcrumbs items={[{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blog' }]} />
      </section>

      <section className="container-page py-10 text-center">
        <h1 className="text-4xl font-bold text-ink">The SnapVidly Blog</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-muted">
          Download guides, platform history, and the trends shaping social video in 2026 — across every platform we support.
        </p>
      </section>

      {/* Category filter — internal links */}
      <section className="container-page">
        <div className="flex flex-wrap justify-center gap-2">
          {categories.map((c) => (
            <Link
              key={c}
              href={`/blog/${c}`}
              className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"
            >
              <PlatformIcon platform={c} color={PLATFORMS[c].brandColor} className="h-4 w-4" />
              {CATEGORY_LABEL[c]}
            </Link>
          ))}
        </div>
      </section>

      <div className="container-page">
        <AdSlot placement="rectangle" ezoicId={103} />
      </div>

      <section className="container-page py-12">
        {posts.length === 0 ? (
          <p className="text-center text-ink-muted">New articles are on the way. Check back soon.</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <BlogCard key={`${p.category}/${p.slug}`} post={p} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
