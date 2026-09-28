import { getDb } from '@/lib/db';
import { ChangePasswordForm } from '@/components/admin/ChangePasswordForm';
import { signOutEverywhereAction } from '@/app/admin/actions';

interface ContentRow {
  kind: string;
  key: string;
  enabled: number;
  featured: number;
}
interface SettingRow {
  key: string;
  encrypted: number;
}

function buildConfigSnapshot(): string {
  try {
    const db = getDb();
    const content = db.prepare('SELECT kind, key, enabled, featured FROM content_config').all() as ContentRow[];
    const settings = db.prepare('SELECT key, encrypted FROM settings').all() as SettingRow[];
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        content,
        // Secret values are never exported — only which keys are configured.
        settings: settings.map((s) => ({ key: s.key, configured: true, secret: Boolean(s.encrypted) })),
      },
      null,
      2,
    );
  } catch {
    return '{}';
  }
}

export default function AdminSecurityPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-ink">Security</h1>

      <section className="card p-5">
        <h2 className="text-lg font-semibold text-ink">Change password</h2>
        <p className="mt-1 text-sm text-ink-muted">Changing your password signs out every other open session.</p>
        <div className="mt-4">
          <ChangePasswordForm />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-semibold text-ink">Sessions</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Force every signed-in session (including this one, after the next request) to sign in again.
        </p>
        <form action={signOutEverywhereAction} className="mt-3">
          <button type="submit" className="rounded-lg bg-surface-soft px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-border">
            Sign out everywhere
          </button>
        </form>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-semibold text-ink">Config snapshot</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Tool visibility, SEO overrides, and which settings are configured — secret values are never included. Copy
          this for a backup before making a bulk change.
        </p>
        <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-surface-soft p-3 text-xs text-ink-muted">{buildConfigSnapshot()}</pre>
      </section>
    </div>
  );
}
