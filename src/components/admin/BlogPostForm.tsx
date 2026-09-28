'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { savePostAction, type PostFormState } from '@/app/admin/actions';
import { slugifyLabel } from '@/lib/slug';
import { CATEGORY_LABEL, type BlogCategory } from '@/lib/blogCategories';
import type { Post } from '@/lib/blog';

const initialState: PostFormState = {};

const inputClass =
  'mt-1.5 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent';

interface Props {
  mode: 'new' | 'edit';
  post?: Post;
}

export function BlogPostForm({ mode, post }: Props) {
  const [state, formAction] = useActionState(savePostAction, initialState);
  const [title, setTitle] = useState(post?.title ?? '');
  const [slug, setSlug] = useState(post?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(mode === 'edit');

  return (
    <form action={formAction} className="card space-y-5 p-6">
      {mode === 'edit' && post && (
        <>
          <input type="hidden" name="originalCategory" value={post.category} />
          <input type="hidden" name="originalSlug" value={post.slug} />
        </>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium text-ink">
          Title
          <input
            name="title"
            required
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched) setSlug(slugifyLabel(e.target.value));
            }}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-ink">
          Slug
          <input
            name="slug"
            required
            pattern="[a-z0-9][a-z0-9-]*"
            title="Lowercase letters, numbers and hyphens only"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-ink-faint">/blog/&lt;category&gt;/{slug || 'your-slug'}</span>
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium text-ink">
          Category
          <select name="category" required defaultValue={post?.category ?? ''} className={inputClass}>
            <option value="" disabled>
              Choose a platform
            </option>
            {(Object.keys(CATEGORY_LABEL) as BlogCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-ink">
          Date
          <input
            type="date"
            name="date"
            required
            defaultValue={post?.date ?? new Date().toISOString().slice(0, 10)}
            className={inputClass}
          />
        </label>
      </div>

      <label className="block text-sm font-medium text-ink">
        Primary keyword
        <input name="keyword" required defaultValue={post?.keyword ?? ''} className={inputClass} />
        <span className="mt-1 block text-xs text-ink-faint">The main search phrase this post targets — used as its default SEO keyword.</span>
      </label>

      <label className="block text-sm font-medium text-ink">
        Meta description
        <textarea name="description" required rows={2} maxLength={300} defaultValue={post?.description ?? ''} className={inputClass} />
      </label>

      <label className="block text-sm font-medium text-ink">
        Content (MDX)
        <textarea
          name="content"
          required
          rows={18}
          defaultValue={post?.content ?? ''}
          spellCheck={false}
          className={`${inputClass} font-mono text-xs leading-relaxed`}
        />
        <span className="mt-1 block text-xs text-ink-faint">Markdown/MDX — the same format as every existing post file.</span>
      </label>

      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-surface-border pt-5">
        <PublishButton draft={false}>Publish</PublishButton>
        <PublishButton draft>Save as draft</PublishButton>
        <span className="text-xs text-ink-faint">
          {post?.draft ? 'Currently a draft — not visible on the site.' : mode === 'edit' ? 'Currently published.' : 'Not saved yet.'}
        </span>
      </div>
    </form>
  );
}

function PublishButton({ draft, children }: { draft: boolean; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="draft"
      value={draft ? 'on' : ''}
      disabled={pending}
      className={
        draft
          ? 'rounded-lg border border-surface-border bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-surface-soft disabled:opacity-60'
          : 'rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-60'
      }
    >
      {pending ? 'Saving…' : children}
    </button>
  );
}
