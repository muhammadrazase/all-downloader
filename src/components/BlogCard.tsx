import Link from 'next/link';
import type { PostMeta } from '@/lib/blog';
import { CATEGORY_LABEL } from '@/lib/blogCategories';
import { PLATFORMS } from '@/lib/platforms';
import { PlatformIcon } from './PlatformIcon';

export function BlogCard({ post, variant = 'grid' }: { post: PostMeta; variant?: 'grid' | 'list' }) {
  const brand = PLATFORMS[post.category].brandColor;

  if (variant === 'list') {
    return (
      <article className="card group relative flex items-center gap-4 p-4 transition-[transform,border-color,box-shadow] duration-150 ease-enter hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md active:translate-y-0 active:scale-[0.995] active:duration-100 sm:p-5">
        <span
          className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 ease-enter group-hover:scale-110 sm:flex"
          style={{ backgroundColor: `${brand}14` }}
        >
          <PlatformIcon platform={post.category} color={brand} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-medium text-ink-muted">
            <PlatformIcon platform={post.category} color={brand} className="h-3.5 w-3.5 sm:hidden" />
            {CATEGORY_LABEL[post.category]}
            <span className="text-ink-faint">· {post.readingTime} min read</span>
          </div>
          <h3 className="mt-1 truncate text-base font-semibold leading-snug text-ink transition-colors duration-200 group-hover:text-accent">
            <Link href={`/blog/${post.category}/${post.slug}`} className="after:absolute after:inset-0">
              {post.title}
            </Link>
          </h3>
        </div>
        <time dateTime={post.date} className="hidden shrink-0 text-xs text-ink-faint sm:block">
          {formatDate(post.date)}
        </time>
        <ChevronGlyph />
      </article>
    );
  }

  return (
    <article className="card group relative flex flex-col p-5 transition-[transform,border-color,box-shadow] duration-150 ease-enter hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md active:translate-y-0 active:scale-[0.99] active:duration-100">
      <div className="flex items-center gap-2 text-xs font-medium text-ink-muted">
        <PlatformIcon platform={post.category} color={brand} className="h-4 w-4" />
        {CATEGORY_LABEL[post.category]}
        <span className="text-ink-faint">· {post.readingTime} min read</span>
      </div>
      <h3 className="mt-3 text-lg font-semibold leading-snug text-ink transition-colors duration-200 group-hover:text-accent">
        <Link href={`/blog/${post.category}/${post.slug}`} className="after:absolute after:inset-0">
          {post.title}
        </Link>
      </h3>
      <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{post.description}</p>
      <time dateTime={post.date} className="mt-4 text-xs text-ink-faint">
        {formatDate(post.date)}
      </time>
    </article>
  );
}

function ChevronGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="hidden shrink-0 text-ink-faint transition-transform duration-200 ease-enter group-hover:translate-x-0.5 group-hover:text-accent sm:block"
    >
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (!y || !m || !d) return iso;
  return `${months[m - 1]} ${d}, ${y}`;
}
