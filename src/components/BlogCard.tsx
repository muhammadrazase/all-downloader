import Link from 'next/link';
import type { PostMeta } from '@/lib/blog';
import { CATEGORY_LABEL } from '@/lib/blog';
import { PLATFORMS } from '@/lib/platforms';
import { PlatformIcon } from './PlatformIcon';

export function BlogCard({ post }: { post: PostMeta }) {
  const brand = PLATFORMS[post.category].brandColor;
  return (
    <article className="card group relative flex flex-col p-5 transition-all hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md">
      <div className="flex items-center gap-2 text-xs font-medium text-ink-muted">
        <PlatformIcon platform={post.category} color={brand} className="h-4 w-4" />
        {CATEGORY_LABEL[post.category]}
        <span className="text-ink-faint">· {post.readingTime} min read</span>
      </div>
      <h3 className="mt-3 text-lg font-semibold leading-snug text-ink group-hover:text-accent">
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

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (!y || !m || !d) return iso;
  return `${months[m - 1]} ${d}, ${y}`;
}
