import Link from 'next/link';

const SECTIONS = [
  { href: '/admin/ai-keys', label: 'AI & Engine keys', hint: 'Groq, Gemini, RapidAPI, remote engine' },
  { href: '/admin/billing', label: 'Billing (Stripe)', hint: 'Publishable/secret/webhook keys' },
  { href: '/admin/site', label: 'Site & Community', hint: 'Discord, Telegram, Giscus, analytics, verification' },
  { href: '/admin/security', label: 'Security', hint: 'Password, sessions, config export' },
];

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">Settings</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="card block p-5 transition-colors hover:border-accent/40">
            <p className="font-semibold text-ink">{s.label}</p>
            <p className="mt-1 text-sm text-ink-muted">{s.hint}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
