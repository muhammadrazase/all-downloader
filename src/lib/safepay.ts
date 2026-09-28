import { randomUUID } from 'node:crypto';
import { Safepay } from '@sfpy/node-sdk';
// The package's main entry only exports the `Safepay` class, not its `Environment`
// enum — this is the one path deep enough to reach it without re-declaring it here.
import { Environment } from '@sfpy/node-sdk/dist/utils/constants';
import { getSetting } from './config/settings.server';
import { site } from './site';

// USD only, by design (see the checkout route's Zod schema) — the widget
// never offers a currency picker, so this stays a single-value type on purpose.
export type SafepayCurrency = 'USD';

/**
 * KNOWN ISSUE, unresolved as of this writing: a real sandbox test (valid
 * API key + v1 secret, confirmed with Safepay support to be current) still
 * gets HTTP 404 "Client with this identifier not found" from
 * `client.payments.create()`. Traced to the actual request: `@sfpy/node-sdk`
 * v3.0.2 (the latest published version — no newer one exists to upgrade to)
 * calls `POST https://sandbox.api.getsafepay.com/order/v1/init`, which
 * matches an endpoint Safepay's own (unofficial) community examples flag as
 * superseded/legacy. Swapping which credential goes in `apiKey` vs
 * `v1Secret` does not change the error — both orderings fail identically —
 * so this is not a field-mapping mistake in this file. Until Safepay
 * confirms a fix or a new SDK version ships, the site falls back to manual
 * bank transfer details (see BankTransferDetails in SupportWidget.tsx)
 * instead of blocking the whole support feature on this.
 */

/** Whether all three Safepay credentials are set. Read fresh, like every other
 * integration in this app — an admin save must take effect with no restart. */
export function safepayConfigured(): boolean {
  return Boolean(getSetting('SAFEPAY_API_KEY') && getSetting('SAFEPAY_V1_SECRET') && getSetting('SAFEPAY_WEBHOOK_SECRET'));
}

function getClient(): Safepay {
  const apiKey = getSetting('SAFEPAY_API_KEY');
  const v1Secret = getSetting('SAFEPAY_V1_SECRET');
  const webhookSecret = getSetting('SAFEPAY_WEBHOOK_SECRET');
  if (!apiKey || !v1Secret || !webhookSecret) throw new Error('safepay_not_configured');
  const environment = getSetting('SAFEPAY_ENVIRONMENT') === 'production' ? Environment.Production : Environment.Sandbox;
  return new Safepay({ environment, apiKey, v1Secret, webhookSecret });
}

/**
 * Creates a Safepay tracker for `amount` (whole currency units from the UI,
 * e.g. 5 = $5.00) and returns the hosted checkout URL to redirect to.
 *
 * Safepay's API takes amounts in MINOR units (paisa/cents) — confirmed
 * against their current docs (safepay-docs.netlify.app/concepts/money) and a
 * live example response (`{"currency":"PKR","amount":290000}` = Rs 2,900.00).
 * Math.round guards against float artifacts (19.99 * 100 !== 1999 exactly).
 * See the KNOWN ISSUE note above `SafepayCurrency` — as of this writing this
 * call 404s regardless, unrelated to the unit conversion here.
 */
export async function createSupportCheckout(amount: number, currency: SafepayCurrency): Promise<string> {
  const client = getClient();
  const minorUnits = Math.round(amount * 100);
  const { token } = await client.payments.create({ amount: minorUnits, currency });
  return client.checkout.create({
    token,
    orderId: `support-${randomUUID()}`,
    redirectUrl: `${site.url}/support/thank-you`,
    cancelUrl: site.url,
  });
}

/** Verifies an inbound webhook. `body` must be the already-parsed JSON payload;
 * the SDK re-serializes `body.data` internally to check the signature. */
export function verifySupportWebhook(body: unknown, signatureHeader: string | null): boolean {
  const client = getClient();
  return client.verify.webhook({
    body: body as Record<string, unknown>,
    headers: { 'x-sfpy-signature': signatureHeader ?? '' },
  });
}
