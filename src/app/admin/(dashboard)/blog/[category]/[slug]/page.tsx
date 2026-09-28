import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BlogPostForm } from '@/components/admin/BlogPostForm';
import { getPost } from '@/lib/blog';

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category, slug } = await params;
  const post = getPost(category, slug);
  if (!post) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/blog" className="text-sm font-medium text-accent hover:underline">
          &larr; Back to posts
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-ink">Edit post</h1>
        <p className="mt-1 text-sm text-ink-muted">/blog/{post.category}/{post.slug}</p>
      </div>
      <BlogPostForm mode="edit" post={post} />
    </div>
  );
}
