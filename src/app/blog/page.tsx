import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { BlogExplorer } from '@/components/BlogExplorer';
import { getAllPosts, getAllCategories } from '@/lib/blog';
import { buildMetadata } from '@/lib/seo';
import { isContentEnabled } from '@/lib/config/contentConfig';
import { getBoolSetting } from '@/lib/config/settings.server';

export const dynamic = 'force-static';

export const metadata: Metadata = buildMetadata({
  title: 'Blog — Tips, Trends & Guides for TikTok, Instagram, YouTube & More',
  description:
    'Guides, download how-tos, platform history and 2026 trends for TikTok, Instagram, YouTube, Facebook, LinkedIn, X (Twitter), Reddit, Pinterest, Vimeo, Twitch and Tumblr. Learn to save and create better social video.',
  path: '/blog',
});

export default function BlogIndex() {
  if (!getBoolSetting('blogEnabled', true)) redirect('/');
  const posts = getAllPosts().filter((p) => isContentEnabled('blog-post', p.slug));
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

      <section className="container-page pb-16">
        {posts.length === 0 ? (
          <p className="text-center text-ink-muted">New articles are on the way. Check back soon.</p>
        ) : (
          <BlogExplorer posts={posts} categories={categories} />
        )}
      </section>
    </>
  );
}
