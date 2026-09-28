import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';
import { sessionVersionMatches } from '@/lib/auth/adminUser';
import { logoutAction } from '@/app/admin/actions';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/tools', label: 'Tools' },
  { href: '/admin/blog', label: 'Blog' },
  { href: '/admin/settings', label: 'Settings' },
];

// Re-checks auth as defense in depth alongside middleware.ts.
async function requireAdmin(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const payload = verifySessionToken(token);
  let valid = false;
  try {
    valid = Boolean(payload && sessionVersionMatches(payload.v));
  } catch {
    valid = false;
  }
  if (!valid) redirect('/admin/login');
}

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl gap-8 px-4 py-8 sm:px-6">
      <aside className="hidden w-56 shrink-0 sm:block">
        <p className="px-2 text-lg font-bold text-ink">SnapVidly Admin</p>
        <nav className="mt-6 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-2.5 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <form action={logoutAction} className="mt-6 px-2">
          <button type="submit" className="text-sm font-medium text-ink-muted hover:text-ink">
            Sign out
          </button>
        </form>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
