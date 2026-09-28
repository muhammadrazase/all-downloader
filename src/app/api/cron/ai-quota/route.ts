import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { evaluateAndAlert } from '@/lib/aiAlerts';
import { getSetting } from '@/lib/config/settings.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Called by the daily cron installed by up.sh. Secret-gated because it can send
// mail; returns 404 (not 401) so an unauthenticated prober learns nothing.
// Header-only — a query string would leak the secret into nginx access logs.
function authorized(req: Request): boolean {
  const expected = getSetting('CRON_SECRET');
  if (!expected) return false;
  const provided = req.headers.get('x-cron-secret') ?? '';
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request): Promise<NextResponse> {
  if (!authorized(req)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const result = await evaluateAndAlert();
    return NextResponse.json({
      level: result.level,
      emailed: result.sent,
      reason: result.reason,
      providers: result.providers.map((p) => ({
        provider: p.provider,
        requests: p.requests,
        budget: p.budget,
        percentUsed: p.percentUsed,
        exhausted: p.exhausted,
      })),
    });
  } catch (err) {
    console.error('ai_quota_cron_failed', { reason: (err as Error)?.name });
    return NextResponse.json({ error: 'Check failed.' }, { status: 502 });
  }
}
