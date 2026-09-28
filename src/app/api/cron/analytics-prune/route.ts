import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getAnalyticsDb } from '@/lib/analytics/db';
import { getSetting } from '@/lib/config/settings.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RETENTION_DAYS = 400;

// Same secret-gate pattern as /api/cron/ai-quota. Returns 404 (not 401) so an
// unauthenticated prober learns nothing. Header-only — a query string would
// leak the secret into nginx access logs.
function authorized(req: Request): boolean {
  const expected = getSetting('CRON_SECRET');
  if (!expected) return false;
  const provided = req.headers.get('x-cron-secret') ?? '';
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request): Promise<NextResponse> {
  if (!authorized(req)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const cutoff = daysAgo(RETENTION_DAYS);
    const db = getAnalyticsDb();
    const hits = db.prepare('DELETE FROM tool_hits WHERE day < ?').run(cutoff);
    const totals = db.prepare('DELETE FROM daily_totals WHERE day < ?').run(cutoff);
    db.pragma('wal_checkpoint(TRUNCATE)');
    return NextResponse.json({ deletedHitRows: hits.changes, deletedTotalRows: totals.changes, cutoff });
  } catch (err) {
    console.error('analytics_prune_failed', { reason: (err as Error)?.name });
    return NextResponse.json({ error: 'Prune failed.' }, { status: 502 });
  }
}
