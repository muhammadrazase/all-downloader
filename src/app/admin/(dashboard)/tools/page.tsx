import { CONTENT_KINDS, getContentConfigRow, type ContentKind } from '@/lib/config/contentConfig';
import { toggleContentAction, saveContentSeoAction } from '@/app/admin/actions';
import { ListFilter } from '@/components/admin/ListFilter';
import { platformKeywords, toolKeywords } from '@/lib/seoDefaults';
import { PLATFORM_LIST } from '@/lib/platforms';
import { AI_TOOL_LIST } from '@/lib/aiTools';
import { CONVERTER_LIST } from '@/lib/converterTools';
import { IMAGE_TOOL_LIST } from '@/lib/imageTools';
import { PDF_TOOL_LIST } from '@/lib/pdfTools';
import { FILE_TOOL_LIST } from '@/lib/fileTools';

interface RegistryItem {
  key: string;
  name: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  defaultKeywords: string[];
}

function toItem(t: { key: string; name: string; slug: string; metaTitle: string; metaDescription: string }, keywords: string[]): RegistryItem {
  return { key: t.key, name: t.name, slug: t.slug, metaTitle: t.metaTitle, metaDescription: t.metaDescription, defaultKeywords: keywords };
}

const REGISTRIES: Record<ContentKind, RegistryItem[]> = {
  platform: PLATFORM_LIST.map((p) => toItem(p, platformKeywords(p))),
  'ai-tool': AI_TOOL_LIST.map((t) => toItem(t, t.keywords)),
  converter: CONVERTER_LIST.map((t) => toItem(t, toolKeywords(t.key, t.keyword))),
  'image-tool': IMAGE_TOOL_LIST.map((t) => toItem(t, toolKeywords(t.key, t.keyword))),
  'pdf-tool': PDF_TOOL_LIST.map((t) => toItem(t, toolKeywords(t.key, t.keyword))),
  'file-tool': FILE_TOOL_LIST.map((t) => toItem(t, toolKeywords(t.key, t.keyword))),
  'blog-post': [],
};

export default function AdminToolsPage() {
  const categories = CONTENT_KINDS.map(({ kind, label }) => ({ value: kind, label }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Tools</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Hide a tool to remove it from the navbar, footer, /tools hub and sitemap, and block its page (visitors are
          redirected home). Open a row to edit its live SEO copy directly — fields are pre-filled with what&apos;s
          actually published; saving replaces it immediately.
        </p>
      </div>

      <ListFilter searchPlaceholder="Search tools by name or slug…" categories={categories}>
        <div className="space-y-8">
          {CONTENT_KINDS.map(({ kind, label }) => (
            <section key={kind} data-group className="card p-5">
              <h2 className="text-lg font-semibold text-ink">{label}</h2>
              <ul className="mt-3 divide-y divide-surface-border">
                {REGISTRIES[kind].map((item) => (
                  <ToolRow key={item.key} kind={kind} item={item} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </ListFilter>
    </div>
  );
}

function ToolRow({ kind, item }: { kind: ContentKind; item: RegistryItem }) {
  const config = getContentConfigRow(kind, item.key);
  const liveTitle = config.seoTitle ?? item.metaTitle;
  const liveDescription = config.seoDescription ?? item.metaDescription;
  const liveKeywords = config.seoKeywords ?? item.defaultKeywords.join(', ');

  return (
    <li className="py-3" data-search={`${item.name} ${item.slug}`.toLowerCase()} data-category={kind}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink">{item.name}</p>
          <p className="text-xs text-ink-faint">/{item.slug}</p>
        </div>
        <form action={toggleContentAction.bind(null, kind, item.key)}>
          <button
            type="submit"
            aria-pressed={config.enabled}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              config.enabled ? 'bg-accent text-accent-fg' : 'bg-surface-soft text-ink-muted'
            }`}
          >
            {config.enabled ? 'Visible' : 'Hidden'}
          </button>
        </form>
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-medium text-accent">SEO</summary>
        <form action={saveContentSeoAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="key" value={item.key} />
          <Field label="Title" name="seoTitle" defaultValue={liveTitle} />
          <Field label="Canonical path" name="seoCanonical" defaultValue={config.seoCanonical ?? `/${item.slug}`} />
          <Field label="Description" name="seoDescription" defaultValue={liveDescription} textarea />
          <Field label="Keywords (comma-separated)" name="seoKeywords" defaultValue={liveKeywords} textarea />
          <Field label="OG image URL" name="ogImage" defaultValue={config.ogImage ?? ''} />
          <label className="flex items-center gap-2 text-sm text-ink-muted">
            <input type="checkbox" name="seoNoindex" defaultChecked={config.seoNoindex} className="h-4 w-4 rounded border-surface-border" />
            noindex this page
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
}

function Field({
  label,
  name,
  defaultValue,
  textarea,
}: {
  label: string;
  name: string;
  defaultValue: string;
  textarea?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-ink-muted">{label}</span>
      {textarea ? (
        <textarea
          name={name}
          defaultValue={defaultValue}
          rows={2}
          className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      ) : (
        <input
          name={name}
          defaultValue={defaultValue}
          className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      )}
    </label>
  );
}
