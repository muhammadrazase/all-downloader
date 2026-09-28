import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

/**
 * Regression gate for the auth bypass found in the security audit: Server
 * Actions dispatch by action ID against ANY route that imports them, including
 * the unauthenticated /admin/login page. The (dashboard) layout only guards
 * rendering, so each mutating action must refuse on its own.
 */

process.env.SESSION_SECRET = 'test-only-session-secret-that-is-long-enough-32';
process.env.CONFIG_ENCRYPTION_KEY = 'b'.repeat(64);

let cookieValue: string | undefined;

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (cookieValue ? { name, value: cookieValue } : undefined),
    set: () => {},
    delete: () => {},
  }),
  headers: async () => new Headers({ 'x-real-ip': '198.51.100.7' }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('next/navigation', () => ({
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
}));

const actions = await import('@/app/admin/actions');
const { upsertAdmin, getAdminUser } = await import('@/lib/auth/adminUser');
const { createSessionToken } = await import('@/lib/auth/session');

beforeAll(async () => {
  await upsertAdmin('owner@example.com', 'a-long-enough-password');
});

beforeEach(() => {
  cookieValue = undefined; // default: unauthenticated
});

/** Every mutating action, invoked exactly as a forged POST would. */
const MUTATIONS: [string, () => Promise<unknown>][] = [
  ['logoutAction', () => actions.logoutAction()],
  ['signOutEverywhereAction', () => actions.signOutEverywhereAction()],
  ['changePasswordAction', () => actions.changePasswordAction(new FormData())],
  ['toggleContentAction', () => actions.toggleContentAction('platform', 'tiktok')],
  ['toggleFeaturedAction', () => actions.toggleFeaturedAction('blog-post', 'some-post')],
  ['saveContentSeoAction', () => actions.saveContentSeoAction(new FormData())],
  ['toggleBlogEnabledAction', () => actions.toggleBlogEnabledAction()],
  ['toggleMaintenanceModeAction', () => actions.toggleMaintenanceModeAction()],
  ['toggleAiEnabledAction', () => actions.toggleAiEnabledAction()],
  ['sendTestAlertAction', () => actions.sendTestAlertAction()],
  ['saveSettingsAction', () => actions.saveSettingsAction([{ key: 'GROQ_API_KEY' }], new FormData())],
];

describe('every mutating admin action refuses an unauthenticated caller', () => {
  for (const [name, invoke] of MUTATIONS) {
    it(`${name} throws unauthorized with no session cookie`, async () => {
      await expect(invoke()).rejects.toThrow(/unauthorized/);
    });
  }

  it('a forged cookie is rejected (signature must verify)', async () => {
    cookieValue = 'not.a.valid.token';
    await expect(actions.toggleMaintenanceModeAction()).rejects.toThrow(/unauthorized/);
  });

  it('a token whose session_version no longer matches is rejected', async () => {
    const current = getAdminUser()?.session_version ?? 1;
    cookieValue = createSessionToken(current + 99);
    await expect(actions.toggleMaintenanceModeAction()).rejects.toThrow(/unauthorized/);
  });
});

describe('a valid session is still allowed through', () => {
  it('toggleMaintenanceModeAction succeeds with a correctly signed cookie', async () => {
    const current = getAdminUser()?.session_version ?? 1;
    cookieValue = createSessionToken(current);
    await expect(actions.toggleMaintenanceModeAction()).resolves.toBeUndefined();
  });
});

describe('content refs are validated, not trusted', () => {
  it('rejects a kind that is not a real registry kind', async () => {
    const current = getAdminUser()?.session_version ?? 1;
    cookieValue = createSessionToken(current);
    const form = new FormData();
    form.set('kind', 'not-a-kind');
    form.set('key', 'tiktok');
    await expect(actions.saveContentSeoAction(form)).rejects.toThrow(/invalid_content_ref/);
  });

  it('rejects a key containing path separators', async () => {
    const current = getAdminUser()?.session_version ?? 1;
    cookieValue = createSessionToken(current);
    const form = new FormData();
    form.set('kind', 'platform');
    form.set('key', '../../etc/passwd');
    await expect(actions.saveContentSeoAction(form)).rejects.toThrow(/invalid_content_ref/);
  });
});
