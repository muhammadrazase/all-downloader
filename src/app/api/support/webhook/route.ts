import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { clientIp } from '@/lib/clientIp';
import { verifySupportWebhook, safepayConfigured } from '@/lib/safepay';
import { recordSupportPayment } from '@/lib/supportPayments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Same guard order as every other input route (rate-limit → size-check →
// parse): this one previously started at parse, so an unauthenticated caller
// could force an unbounded read plus AES-GCM/HMAC work per request with
// nothing to cap it — this endpoint has no per-route nginx limit_req either.
const MAX_BODY_BYTES = 64_000;

/** Safepay's async payment confirmation. Signature-verified before anything in
 * the payload is trusted; a verified event is recorded to support_payment
 * (see supportPayments.ts) purely for the owner's own visibility in
 * /admin/billing — Safepay's own dashboard stays the source of truth. */
export async function POST(req: Request): Promise<NextResponse> {
  const { success } = await checkRateLimit(clientIp(req.headers));
  if (!success) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  if (!safepayConfigured()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  let body: unknown;
  try {
    const raw = await req.text();
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request too large.' }, { status: 413 });
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const signature = req.headers.get('x-sfpy-signature');
  let valid = false;
  try {
    // verifySupportWebhook only authenticates body.data — everything else in
    // the payload (event type, top-level fields) is unsigned and should never
    // be trusted on its own if a handler is added here later.
    valid = verifySupportWebhook(body, signature);
  } catch (err) {
    console.error('safepay_webhook_verify_failed', { reason: (err as Error)?.name });
    return NextResponse.json({ error: 'Verification failed.' }, { status: 400 });
  }

  if (!valid) return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });

  if (body && typeof body === 'object') recordSupportPayment(body as Record<string, unknown>);

  return NextResponse.json({ ok: true });
}
