import { getDb } from './db';

export interface SupportPayment {
  id: number;
  orderId: string | null;
  amount: string | null;
  currency: string | null;
  rawPayload: string;
  receivedAt: number;
}

const MAX_STORED_PAYLOAD = 8_000;

/**
 * Safepay's webhook payload shape isn't documented in the @sfpy/node-sdk
 * package (verify.webhook() takes an opaque object and returns only a
 * boolean — no typed event data). Rather than assume field names that might
 * be wrong, this tries a short list of plausible paths and always keeps the
 * raw payload too, so nothing is lost if a guess doesn't match.
 */
function extractField(source: unknown, paths: string[][]): string | null {
  for (const path of paths) {
    let v: unknown = source;
    for (const key of path) {
      if (v && typeof v === 'object' && key in (v as Record<string, unknown>)) {
        v = (v as Record<string, unknown>)[key];
      } else {
        v = undefined;
        break;
      }
    }
    if (typeof v === 'string' || typeof v === 'number') return String(v);
  }
  return null;
}

/**
 * Records one already-signature-verified webhook delivery for the owner's
 * own visibility in the admin panel. Best-effort and silent on failure — this
 * must never be the reason a webhook response fails, since Safepay retries
 * on a non-2xx response and a retry storm over a logging bug would be worse
 * than losing one log row.
 */
export function recordSupportPayment(body: Record<string, unknown>): void {
  try {
    const data = body.data && typeof body.data === 'object' ? (body.data as Record<string, unknown>) : body;
    const orderId = extractField(data, [['order_id'], ['orderId'], ['reference'], ['tracker', 'order_id']]);
    const amount = extractField(data, [['amount'], ['tracker', 'amount']]);
    const currency = extractField(data, [['currency'], ['tracker', 'currency']]);
    const rawPayload = JSON.stringify(body).slice(0, MAX_STORED_PAYLOAD);

    getDb()
      .prepare(
        'INSERT OR IGNORE INTO support_payment (order_id, amount, currency, raw_payload, received_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(orderId, amount, currency, rawPayload, Date.now());
  } catch {
    /* best-effort log only — never block the webhook response on this */
  }
}

export function listRecentSupportPayments(limit = 50): SupportPayment[] {
  try {
    return getDb()
      .prepare(
        'SELECT id, order_id as orderId, amount, currency, raw_payload as rawPayload, received_at as receivedAt FROM support_payment ORDER BY received_at DESC LIMIT ?',
      )
      .all(limit) as SupportPayment[];
  } catch {
    return [];
  }
}
