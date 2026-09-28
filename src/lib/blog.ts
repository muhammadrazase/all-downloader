import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { CATEGORY_LABEL, type BlogCategory } from './blogCategories';

/** Blog content lives as MDX files in /content/blog/<category>/<slug>.mdx (no DB). */

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

export type { BlogCategory };
export { CATEGORY_LABEL };

export interface PostFrontmatter {
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  category: BlogCategory;
  keyword: string;
  updated?: string;
  /** Written but not public yet — excluded from getAllPosts/sitemap/generateStaticParams. */
  draft?: boolean;
}

export interface PostMeta extends PostFrontmatter {
  slug: string;
  readingTime: number; // minutes
}

export interface Post extends PostMeta {
  content: string; // raw MDX body
}

function readCategoryDir(category: string): string[] {
  const dir = path.join(BLOG_DIR, category);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.mdx'));
}

function parseFile(category: string, file: string): Post | null {
  const full = path.join(BLOG_DIR, category, file);
  // dynamicParams = true on the [slug] route means any syntactically-valid but
  // nonexistent path now reaches this function directly (previously it 404'd
  // before render) — a missing/unreadable file must resolve to null, not throw.
  let raw: string;
  try {
    raw = fs.readFileSync(full, 'utf8');
  } catch {
    return null;
  }
  const { data, content } = matter(raw);
  const fm = data as Partial<PostFrontmatter>;
  if (!fm.title || !fm.description || !fm.date || !fm.category || !fm.keyword) return null;

  const words = content.trim().split(/\s+/).length;
  return {
    slug: file.replace(/\.mdx$/, ''),
    title: fm.title,
    description: fm.description,
    date: fm.date,
    category: fm.category,
    keyword: fm.keyword,
    updated: fm.updated,
    draft: fm.draft === true,
    readingTime: Math.max(1, Math.round(words / 200)),
    content,
  };
}

function listAllPosts(): Post[] {
  const posts: Post[] = [];
  for (const category of Object.keys(CATEGORY_LABEL) as BlogCategory[]) {
    for (const file of readCategoryDir(category)) {
      const post = parseFile(category, file);
      if (post) posts.push(post);
    }
  }
  return posts;
}

/** Only categories with at least one published post (avoids thin/empty category pages). */
export function getAllCategories(): BlogCategory[] {
  const present = new Set(listAllPosts().filter((p) => !p.draft).map((p) => p.category));
  return (Object.keys(CATEGORY_LABEL) as BlogCategory[]).filter((c) => present.has(c));
}

export function getAllPosts(): PostMeta[] {
  return listAllPosts()
    .filter((p) => !p.draft)
    .map(({ content: _content, ...meta }) => meta)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Admin-only: includes drafts, so they can be found and edited/published. */
export function getAllPostsForAdmin(): PostMeta[] {
  return listAllPosts()
    .map(({ content: _content, ...meta }) => meta)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPostsByCategory(category: BlogCategory): PostMeta[] {
  return getAllPosts().filter((p) => p.category === category);
}

// Both segments become path components, so anything outside this charset (a
// dot, a slash) could escape BLOG_DIR. Reject rather than sanitize.
const SAFE_SEGMENT = /^[a-z0-9][a-z0-9-]*$/;

export function getPost(category: string, slug: string): Post | null {
  if (!SAFE_SEGMENT.test(category) || !SAFE_SEGMENT.test(slug)) return null;
  return parseFile(category, `${slug}.mdx`);
}

export function getAllPostParams(): { category: string; slug: string }[] {
  return getAllPosts().map((p) => ({ category: p.category, slug: p.slug }));
}

export function postFileExists(category: string, slug: string): boolean {
  if (!SAFE_SEGMENT.test(category) || !SAFE_SEGMENT.test(slug)) return false;
  return fs.existsSync(path.join(BLOG_DIR, category, `${slug}.mdx`));
}

/** Writes (creates or overwrites) one post's MDX file. Caller validates field content. */
export function writePost(category: BlogCategory, slug: string, frontmatter: PostFrontmatter, content: string): void {
  if (!SAFE_SEGMENT.test(category) || !SAFE_SEGMENT.test(slug)) throw new Error('invalid_path');
  const dir = path.join(BLOG_DIR, category);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${slug}.mdx`);
  // js-yaml (used by matter.stringify) throws on an `undefined` value rather
  // than omitting the key, so an optional field left unset must be dropped here.
  const cleanFrontmatter = Object.fromEntries(Object.entries(frontmatter).filter(([, v]) => v !== undefined));
  fs.writeFileSync(file, matter.stringify(content, cleanFrontmatter), 'utf8');
}

export function deletePost(category: string, slug: string): void {
  if (!SAFE_SEGMENT.test(category) || !SAFE_SEGMENT.test(slug)) throw new Error('invalid_path');
  const file = path.join(BLOG_DIR, category, `${slug}.mdx`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
