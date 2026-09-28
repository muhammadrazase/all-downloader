import type { PlatformKey } from './platforms';

/**
 * Split out of blog.ts so client components (the admin post editor) can use
 * it without pulling in blog.ts's node:fs/node:path imports into the bundle.
 */
export type BlogCategory = PlatformKey;

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
