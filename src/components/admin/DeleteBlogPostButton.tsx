'use client';

interface Props {
  action: () => Promise<void>;
  title: string;
}

export function DeleteBlogPostButton({ action, title }: Props) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Delete "${title}"? This permanently removes the post file and cannot be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="rounded-full bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger/20"
      >
        Delete
      </button>
    </form>
  );
}
