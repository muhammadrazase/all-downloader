import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import type { PlatformKey } from './platforms';

/** Blog content lives as MDX files in /content/blog/<category>/<slug>.mdx (no DB). */

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

/** Blog categories = any platform. getAllCategories() returns only those with posts. */
export type BlogCategory = PlatformKey;

export interface PostFrontmatter {
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  category: BlogCategory;
  keyword: string;
  updated?: string;
}

export interface PostMeta extends PostFrontmatter {
  slug: string;
  readingTime: number; // minutes
}

export interface Post extends PostMeta {
  content: string; // raw MDX body
}

export const CATEGORY_LABEL: Record<BlogCategory, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  twitter: 'Twitter / X',
  pinterest: 'Pinterest',
  reddit: 'Reddit',
  vimeo: 'Vimeo',
  twitch: 'Twitch',
  tumblr: 'Tumblr',
};

function readCategoryDir(category: string): string[] {
  const dir = path.join(BLOG_DIR, category);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.mdx'));
}

function parseFile(category: string, file: string): Post | null {
  const full = path.join(BLOG_DIR, category, file);
  const raw = fs.readFileSync(full, 'utf8');
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
    readingTime: Math.max(1, Math.round(words / 200)),
    content,
  };
}

/** Only categories that actually have posts (avoids thin/empty category pages). */
export function getAllCategories(): BlogCategory[] {
  return (Object.keys(CATEGORY_LABEL) as BlogCategory[]).filter((c) => readCategoryDir(c).length > 0);
}

export function getAllPosts(): PostMeta[] {
  const posts: Post[] = [];
  for (const category of getAllCategories()) {
    for (const file of readCategoryDir(category)) {
      const post = parseFile(category, file);
      if (post) posts.push(post);
    }
  }
  return posts
    .map(({ content: _content, ...meta }) => meta)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPostsByCategory(category: BlogCategory): PostMeta[] {
  return getAllPosts().filter((p) => p.category === category);
}

export function getPost(category: string, slug: string): Post | null {
  return parseFile(category, `${slug}.mdx`);
}

export function getAllPostParams(): { category: string; slug: string }[] {
  const out: { category: string; slug: string }[] = [];
  for (const category of getAllCategories()) {
    for (const file of readCategoryDir(category)) {
      out.push({ category, slug: file.replace(/\.mdx$/, '') });
    }
  }
  return out;
}
