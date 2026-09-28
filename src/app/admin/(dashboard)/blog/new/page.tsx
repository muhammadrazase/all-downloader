import Link from 'next/link';
import { BlogPostForm } from '@/components/admin/BlogPostForm';

export default function NewBlogPostPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/blog" className="text-sm font-medium text-accent hover:underline">
          &larr; Back to posts
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-ink">New post</h1>
        <p className="mt-1 text-sm text-ink-muted">Write the post below, then publish it or save it as a draft.</p>
      </div>
      <BlogPostForm mode="new" />
    </div>
  );
}
