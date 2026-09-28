import Link from 'next/link';
import { getAllPostsForAdmin, CATEGORY_LABEL, type BlogCategory } from '@/lib/blog';
import { getBoolSetting } from '@/lib/config/settings.server';
import { getContentConfigRow } from '@/lib/config/contentConfig';
import {
  toggleBlogEnabledAction,
  toggleContentAction,
  toggleFeaturedAction,
  saveContentSeoAction,
  deletePostAction,
} from '@/app/admin/actions';
import { ListFilter } from '@/components/admin/ListFilter';
import { DeleteBlogPostButton } from '@/components/admin/DeleteBlogPostButton';

export default function AdminBlogPage() {
  const blogEnabled = getBoolSetting('blogEnabled', true);
  const posts = getAllPostsForAdmin();
  const categoriesPresent = [...new Set(posts.map((p) => p.category))] as BlogCategory[];
  const categories = categoriesPresent.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }));

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Blog</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Create, edit, publish, save as drafts, or delete posts. Content stays in MDX files — publishing here
            writes the file directly and goes live immediately, no redeploy needed.
          </p>
        </div>
        <Link href="/admin/blog/new" className="shrink-0 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg hover:opacity-90">
          + New post
        </Link>
      </div>

      <div className="card flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-medium text-ink">Blog enabled</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            When off, &quot;Blog&quot; disappears from navigation and every /blog page redirects home.
          </p>
        </div>
        <form action={toggleBlogEnabledAction}>
          <button
            type="submit"
            aria-pressed={blogEnabled}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              blogEnabled ? 'bg-accent text-accent-fg' : 'bg-surface-soft text-ink-muted'
            }`}
          >
            {blogEnabled ? 'On' : 'Off'}
          </button>
        </form>
      </div>

      <section className="card p-5">
        <h2 className="text-lg font-semibold text-ink">Posts ({posts.length})</h2>
        <div className="mt-3">
          <ListFilter searchPlaceholder="Search posts by title or slug…" categories={categories}>
            <ul className="divide-y divide-surface-border">
              {posts.map((post) => {
                const config = getContentConfigRow('blog-post', post.slug);
                const liveTitle = config.seoTitle ?? post.title;
                const liveDescription = config.seoDescription ?? post.description;
                return (
                  <li
                    key={post.slug}
                    className="py-3"
                    data-search={`${post.title} ${post.slug}`.toLowerCase()}
                    data-category={post.category}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-ink">{post.title}</p>
                          {post.draft && (
                            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                              Draft
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-ink-faint">
                          /blog/{post.category}/{post.slug}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/blog/${post.category}/${post.slug}`}
                          className="rounded-full bg-surface-soft px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-border"
                        >
                          Edit
                        </Link>
                        {!post.draft && (
                          <>
                            <form action={toggleFeaturedAction.bind(null, 'blog-post', post.slug)}>
                              <button
                                type="submit"
                                aria-pressed={config.featured}
                                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                                  config.featured ? 'bg-accent-soft text-accent' : 'bg-surface-soft text-ink-muted'
                                }`}
                              >
                                {config.featured ? 'Featured' : 'Feature'}
                              </button>
                            </form>
                            <form action={toggleContentAction.bind(null, 'blog-post', post.slug)}>
                              <button
                                type="submit"
                                aria-pressed={config.enabled}
                                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                                  config.enabled ? 'bg-accent text-accent-fg' : 'bg-surface-soft text-ink-muted'
                                }`}
                              >
                                {config.enabled ? 'Published' : 'Hidden'}
                              </button>
                            </form>
                          </>
                        )}
                        <DeleteBlogPostButton action={deletePostAction.bind(null, post.category, post.slug)} title={post.title} />
                      </div>
                    </div>

                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium text-accent">SEO</summary>
                      <form action={saveContentSeoAction} className="mt-3 grid gap-3 sm:grid-cols-2">
                        <input type="hidden" name="kind" value="blog-post" />
                        <input type="hidden" name="key" value={post.slug} />
                        <label className="block text-sm">
                          <span className="text-ink-muted">Title</span>
                          <input
                            name="seoTitle"
                            defaultValue={liveTitle}
                            className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="text-ink-muted">Canonical path</span>
                          <input
                            name="seoCanonical"
                            defaultValue={config.seoCanonical ?? `/blog/${post.category}/${post.slug}`}
                            className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          />
                        </label>
                        <label className="block text-sm sm:col-span-2">
                          <span className="text-ink-muted">Description</span>
                          <textarea
                            name="seoDescription"
                            defaultValue={liveDescription}
                            rows={2}
                            className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          />
                        </label>
                        <label className="block text-sm sm:col-span-2">
                          <span className="text-ink-muted">Keywords (comma-separated)</span>
                          <textarea
                            name="seoKeywords"
                            defaultValue={config.seoKeywords ?? post.keyword}
                            rows={2}
                            className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          />
                        </label>
                        <div className="sm:col-span-2">
                          <button type="submit" className="rounded-lg bg-surface-soft px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-border">
                            Save SEO
                          </button>
                        </div>
                      </form>
                    </details>
                  </li>
                );
              })}
            </ul>
          </ListFilter>
        </div>
      </section>
    </div>
  );
}
