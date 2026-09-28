'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  attemptLogin,
  bumpSessionVersion,
  changePassword as changePasswordDb,
  sessionVersionMatches,
} from '@/lib/auth/adminUser';
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SEC, verifySessionToken } from '@/lib/auth/session';
import { checkAdminLoginRateLimit } from '@/lib/rateLimit';
import { clientIp } from '@/lib/clientIp';
import { setSetting, deleteSetting, setBoolSetting, getBoolSetting, writeAuditLog } from '@/lib/config/settings.server';
import {
  upsertContentConfig,
  getContentConfigRow,
  isValidContentRef,
  type ContentKind,
} from '@/lib/config/contentConfig';
import { getAllPosts, postFileExists, writePost, deletePost, CATEGORY_LABEL, type BlogCategory, type PostFrontmatter } from '@/lib/blog';
import { evaluateAndAlert } from '@/lib/aiAlerts';
import { alertRecipient } from '@/lib/mailer';

async function requestIp(): Promise<string> {
  return clientIp(await headers());
}

/**
 * MUST be the first line of every mutating action. Server Actions dispatch by
 * action ID against any route that imports them — including the unauthenticated
 * /admin/login page — so the (dashboard) layout's check only guards RENDERING.
 * Without this, an attacker can invoke every action below with no cookie.
 */
async function requireAdmin(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const payload = verifySessionToken(token);
  let valid = false;
  try {
    valid = Boolean(payload && sessionVersionMatches(payload.v));
  } catch {
    valid = false;
  }
  if (!valid) throw new Error('unauthorized');
}

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = v ? String(v).trim() : '';
  return s ? s : null;
}

// ── Auth ─────────────────────────────────────────────────────────────
export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const ip = await requestIp();

  const { success } = await checkAdminLoginRateLimit(ip);
  if (!success) return { error: 'Too many attempts from this network. Try again in a few minutes.' };

  const result = await attemptLogin(email, password);
  if (!result.ok) {
    writeAuditLog('login_failed', email || null, ip);
    if (result.reason === 'locked') {
      const mins = Math.max(1, Math.ceil((result.retryAfterMs ?? 0) / 60_000));
      return { error: `Account locked after too many failed attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.` };
    }
    return { error: 'Invalid email or password.' };
  }

  const token = createSessionToken(result.sessionVersion);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/admin',
    maxAge: SESSION_MAX_AGE_SEC,
  });
  writeAuditLog('login_success', email, ip);
  redirect('/admin');
}

export async function logoutAction(): Promise<void> {
  await requireAdmin();
  (await cookies()).delete({ name: SESSION_COOKIE, path: '/admin' });
  redirect('/admin/login');
}

export async function signOutEverywhereAction(): Promise<void> {
  await requireAdmin();
  bumpSessionVersion();
  writeAuditLog('sign_out_everywhere', null, await requestIp());
  (await cookies()).delete({ name: SESSION_COOKIE, path: '/admin' });
  redirect('/admin/login');
}

export async function changePasswordAction(formData: FormData): Promise<{ error?: string }> {
  await requireAdmin();
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (password.length < 12) return { error: 'Password must be at least 12 characters.' };
  if (password !== confirm) return { error: 'Passwords did not match.' };

  const sessionVersion = await changePasswordDb(password);
  writeAuditLog('change_password', null, await requestIp());
  const token = createSessionToken(sessionVersion);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/admin',
    maxAge: SESSION_MAX_AGE_SEC,
  });
  return {};
}

// ── Tool / blog-post visibility + SEO overrides ─────────────────────
// Also keeps the public read API (/api/tools, /api/blog/posts) in sync.
function revalidateApiFor(kind: ContentKind): void {
  if (kind === 'blog-post') revalidatePath('/api/blog/posts');
  else revalidatePath('/api/tools');
}

export async function toggleContentAction(kind: ContentKind, key: string): Promise<void> {
  await requireAdmin();
  const current = getContentConfigRow(kind, key);
  upsertContentConfig(kind, key, { ...current, enabled: !current.enabled });
  writeAuditLog('toggle_content', `${kind}:${key}`, await requestIp());
  revalidatePath('/', 'layout');
  revalidatePath('/sitemap.xml');
  revalidateApiFor(kind);
}

export async function toggleFeaturedAction(kind: ContentKind, key: string): Promise<void> {
  await requireAdmin();
  const current = getContentConfigRow(kind, key);
  upsertContentConfig(kind, key, { ...current, featured: !current.featured });
  writeAuditLog('toggle_featured', `${kind}:${key}`, await requestIp());
  revalidatePath('/', 'layout');
  revalidateApiFor(kind);
}

export async function saveContentSeoAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const kind = String(formData.get('kind'));
  const key = String(formData.get('key'));
  if (!isValidContentRef(kind, key)) throw new Error('invalid_content_ref');
  const current = getContentConfigRow(kind, key);
  upsertContentConfig(kind, key, {
    ...current,
    seoTitle: strOrNull(formData.get('seoTitle')),
    seoDescription: strOrNull(formData.get('seoDescription')),
    seoKeywords: strOrNull(formData.get('seoKeywords')),
    seoCanonical: strOrNull(formData.get('seoCanonical')),
    seoNoindex: formData.get('seoNoindex') === 'on',
    ogImage: strOrNull(formData.get('ogImage')),
  });
  writeAuditLog('update_seo', `${kind}:${key}`, await requestIp());
  revalidatePath('/', 'layout');
  revalidateApiFor(kind);
  if (kind === 'blog-post') {
    const post = getAllPosts().find((p) => p.slug === key);
    if (post) revalidatePath(`/api/blog/posts/${post.category}/${post.slug}`);
  }
}

export async function toggleBlogEnabledAction(): Promise<void> {
  await requireAdmin();
  setBoolSetting('blogEnabled', !getBoolSetting('blogEnabled', true));
  writeAuditLog('toggle_blog_enabled', null, await requestIp());
  revalidatePath('/', 'layout');
  revalidatePath('/sitemap.xml');
  revalidatePath('/api/blog/posts');
}

// ── Blog post CRUD (writes MDX files — see src/lib/blog.ts) ─────────
// Content stays file-based on purpose (no application database, CLAUDE.md
// Golden Rule 6); this just lets the admin panel write those files instead
// of requiring a manual commit + redeploy for every post.
export interface PostFormState {
  error?: string;
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isBlogCategory(v: string): v is BlogCategory {
  return v in CATEGORY_LABEL;
}

function revalidateBlogPost(category: string, slug: string): void {
  revalidatePath('/', 'layout');
  revalidatePath('/sitemap.xml');
  revalidatePath('/api/blog/posts');
  revalidatePath(`/api/blog/posts/${category}/${slug}`);
}

export async function savePostAction(_prev: PostFormState, formData: FormData): Promise<PostFormState> {
  await requireAdmin();

  const originalCategory = strOrNull(formData.get('originalCategory'));
  const originalSlug = strOrNull(formData.get('originalSlug'));

  const category = String(formData.get('category') ?? '');
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const keyword = String(formData.get('keyword') ?? '').trim();
  const date = String(formData.get('date') ?? '').trim();
  const content = String(formData.get('content') ?? '');
  const draft = String(formData.get('draft') ?? '') === 'on';

  if (!isBlogCategory(category)) return { error: 'Choose a valid category.' };
  if (originalCategory && !isBlogCategory(originalCategory)) return { error: 'Invalid post reference.' };
  if (!SLUG_RE.test(slug) || slug.length < 3 || slug.length > 80) {
    return { error: 'Slug must be lowercase letters, numbers and hyphens, 3-80 characters.' };
  }
  if (!title || title.length > 200) return { error: 'Title is required (max 200 characters).' };
  if (!description || description.length > 300) return { error: 'Description is required (max 300 characters).' };
  if (!keyword) return { error: 'Primary keyword is required.' };
  if (!DATE_RE.test(date)) return { error: 'Date must be in YYYY-MM-DD format.' };
  if (!content.trim()) return { error: 'Post content cannot be empty.' };

  const isRename = Boolean(originalCategory && originalSlug && (originalCategory !== category || originalSlug !== slug));
  const isNew = !originalCategory || !originalSlug;

  if ((isNew || isRename) && postFileExists(category, slug)) {
    return { error: 'A post with this slug already exists in that category.' };
  }

  const frontmatter: PostFrontmatter = { title, description, date, category, keyword, draft };
  if (!isNew) frontmatter.updated = new Date().toISOString().slice(0, 10);
  writePost(category, slug, frontmatter, content);
  if (isRename && originalCategory && originalSlug) {
    deletePost(originalCategory, originalSlug);
    revalidatePath(`/blog/${originalCategory}/${originalSlug}`);
    revalidatePath(`/api/blog/posts/${originalCategory}/${originalSlug}`);
  }

  writeAuditLog(isNew ? 'create_blog_post' : 'update_blog_post', `${category}:${slug}`, await requestIp());
  revalidateBlogPost(category, slug);
  redirect('/admin/blog');
}

export async function deletePostAction(category: string, slug: string): Promise<void> {
  await requireAdmin();
  if (!isBlogCategory(category) || !SLUG_RE.test(slug)) throw new Error('invalid_post_ref');
  deletePost(category, slug);
  writeAuditLog('delete_blog_post', `${category}:${slug}`, await requestIp());
  revalidateBlogPost(category, slug);
  redirect('/admin/blog');
}

export async function toggleMaintenanceModeAction(): Promise<void> {
  await requireAdmin();
  setBoolSetting('maintenanceMode', !getBoolSetting('maintenanceMode', false));
  writeAuditLog('toggle_maintenance_mode', null, await requestIp());
  revalidatePath('/', 'layout');
}

export async function toggleAiEnabledAction(): Promise<void> {
  await requireAdmin();
  setBoolSetting('aiEnabled', !getBoolSetting('aiEnabled', true));
  writeAuditLog('toggle_ai_enabled', null, await requestIp());
}

export async function sendTestAlertAction(): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  try {
    const result = await evaluateAndAlert({ force: true });
    writeAuditLog('ai_alert_test', result.level, await requestIp());
    return result.sent
      ? { ok: true, message: `Test alert sent to ${alertRecipient()} (current status: ${result.level}).` }
      : { ok: false, message: result.reason };
  } catch (err) {
    const reason = err instanceof Error && err.message === 'smtp_not_configured' ? 'SMTP is not configured yet.' : 'Could not send — check the SMTP settings.';
    return { ok: false, message: reason };
  }
}

// ── Generic settings save — used by ai-keys / billing / site pages ──
// Blank value = leave unchanged; `clear_<KEY>=on` deletes it explicitly.
// `affectsPages` marks the settings that are baked into static HTML (footer
// links, analytics, verification tags); only those trigger a revalidate, since
// invalidating the root layout regenerates all ~143 routes.
export interface SettingField {
  key: string;
  encrypted?: boolean;
  bool?: boolean;
  affectsPages?: boolean;
}

export async function saveSettingsAction(fields: SettingField[], formData: FormData): Promise<void> {
  await requireAdmin();
  let touchedPages = false;

  for (const f of fields) {
    let written = false;
    if (formData.get(`clear_${f.key}`) === 'on') {
      deleteSetting(f.key);
      written = true;
    } else if (f.bool) {
      setBoolSetting(f.key, formData.get(f.key) === 'on');
      written = true;
    } else {
      const raw = formData.get(f.key);
      const value = raw ? String(raw).trim() : '';
      if (value) {
        setSetting(f.key, value, { encrypted: f.encrypted });
        written = true;
      }
    }
    if (written && f.affectsPages) touchedPages = true;
  }

  writeAuditLog('update_settings', fields.map((f) => f.key).join(','), await requestIp());
  if (touchedPages) revalidatePath('/', 'layout');
}
