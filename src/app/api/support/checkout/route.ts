import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rateLimit';
import { clientIp } from '@/lib/clientIp';
import { createSupportCheckout, safepayConfigured } from '@/lib/safepay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// $1 to $2,000 — generous for a one-off tip, small enough to keep a typo or
// abuse attempt from generating an absurd checkout amount against a live key.
// USD only, by design — the widget never offers a currency choice.
const schema = z.object({
  amount: z.number().finite().min(1).max(2000),
  currency: z.literal('USD').default('USD'),
});

export async function POST(req: Request): Promise<NextResponse> {
  const { success } = await checkRateLimit(clientIp(req.headers));
  if (!success) return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });

  if (!safepayConfigured()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Please choose a valid amount.' }, { status: 400 });

  try {
    const url = await createSupportCheckout(parsed.data.amount, parsed.data.currency);
    return NextResponse.json({ url });
  } catch (err) {
    console.error('safepay_checkout_failed', { reason: (err as Error)?.name });
    return NextResponse.json({ error: 'Could not start checkout. Please try again shortly.' }, { status: 502 });
  }
}
