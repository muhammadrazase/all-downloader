import Link from 'next/link';
import { getDailySeries, getTotals, getTopTools, getTopCountries } from '@/lib/analytics/queries';
import { PLATFORM_LIST } from '@/lib/platforms';
import { AI_TOOL_LIST } from '@/lib/aiTools';
import { CONVERTER_LIST } from '@/lib/converterTools';
import { IMAGE_TOOL_LIST } from '@/lib/imageTools';
import { PDF_TOOL_LIST } from '@/lib/pdfTools';
import { FILE_TOOL_LIST } from '@/lib/fileTools';
import { getSetting } from '@/lib/config/settings.server';

const RANGES = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
];

const TOOL_NAMES = new Map(
  [...PLATFORM_LIST, ...AI_TOOL_LIST, ...CONVERTER_LIST, ...IMAGE_TOOL_LIST, ...PDF_TOOL_LIST, ...FILE_TOOL_LIST].map(
    (t) => [t.slug, t.name],
  ),
);

const countryName = (code: string): string => {
  if (code === 'ZZ') return 'Unknown';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
};

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range } = await searchParams;
  const days = RANGES.some((r) => r.value === range) ? Number(range) : 7;

  const series = getDailySeries(days);
  const totals = getTotals(days);
  const topTools = getTopTools(days);
  const topCountries = getTopCountries(days);
  const plausibleDomain = getSetting('PLAUSIBLE_DOMAIN');
  const maxVisitors = Math.max(1, ...series.map((d) => d.visitors));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Analytics</h1>
          <p className="mt-1 text-sm text-ink-muted">
            First-party, privacy-respecting counts — no cookies, no per-visitor records. IP addresses are used only to
            look up a country and are never stored.
          </p>
        </div>
        <div className="flex gap-1.5">
          {RANGES.map((r) => (
            <Link
              key={r.value}
              href={`/admin/analytics?range=${r.value}`}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                days === Number(r.value) ? 'bg-accent text-accent-fg' : 'bg-surface-soft text-ink-muted hover:bg-surface-border'
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label={`Visitors (last ${days}d)`} value={totals.visitors.toLocaleString()} />
        <StatCard label={`Page views (last ${days}d)`} value={totals.pageviews.toLocaleString()} />
      </div>

      <section className="card p-5">
        <h2 className="text-lg font-semibold text-ink">Daily visitors</h2>
        {series.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">No data yet — it appears once the first tool page is visited.</p>
        ) : (
          <div className="mt-4 flex h-32 items-end gap-1">
            {series.map((d) => (
              <div key={d.day} className="group relative flex-1">
                <div
                  className="rounded-t bg-accent transition-colors group-hover:bg-accent-hover"
                  style={{ height: `${Math.max(2, (d.visitors / maxVisitors) * 100)}%` }}
                />
                <div className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-2 py-1 text-xs text-surface group-hover:block">
                  {d.day}: {d.visitors} visitors
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="text-lg font-semibold text-ink">Top tools</h2>
          {topTools.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">No views recorded yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-surface-border">
              {topTools.map((t) => (
                <li key={t.tool} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-ink">{TOOL_NAMES.get(t.tool) ?? t.tool}</span>
                  <span className="text-ink-muted">{t.views.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="text-lg font-semibold text-ink">Top countries</h2>
          {topCountries.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">No views recorded yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-surface-border">
              {topCountries.map((c) => (
                <li key={c.country} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-ink">{countryName(c.country)}</span>
                  <span className="text-ink-muted">{c.views.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {plausibleDomain && (
        <section className="card p-5">
          <h2 className="text-lg font-semibold text-ink">Plausible</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Full visitor analytics (referrers, devices, trends) for <strong>{plausibleDomain}</strong> are on
            Plausible&apos;s own dashboard — the numbers above are a self-hosted, adblocker-resistant cross-check, not
            a replacement.
          </p>
          <a
            href={`https://plausible.io/${plausibleDomain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm font-medium text-accent hover:text-accent-hover"
          >
            Open Plausible dashboard →
          </a>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}
