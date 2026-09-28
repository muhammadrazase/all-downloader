import { hasDbValue, getBoolSetting, getSetting } from '@/lib/config/settings.server';
import { saveSettingsAction, type SettingField as SettingFieldSpec } from '@/app/admin/actions';
import { SettingField } from '@/components/admin/SettingField';
import { listRecentSupportPayments } from '@/lib/supportPayments';
import { BANK_TRANSFER_SETTING_KEYS } from '@/lib/bankTransfer';

const STRIPE_FIELDS: SettingFieldSpec[] = [
  { key: 'billingEnabled', bool: true },
  { key: 'STRIPE_PUBLISHABLE_KEY', encrypted: true },
  { key: 'STRIPE_SECRET_KEY', encrypted: true },
  { key: 'STRIPE_WEBHOOK_SECRET', encrypted: true },
];

// affectsPages: whether Safepay is "configured" is baked into the static layout
// (it decides the support widget's button behavior), so a save must regenerate pages.
const SAFEPAY_FIELDS: SettingFieldSpec[] = [
  { key: 'SAFEPAY_ENVIRONMENT', affectsPages: true },
  { key: 'SAFEPAY_API_KEY', encrypted: true, affectsPages: true },
  { key: 'SAFEPAY_V1_SECRET', encrypted: true, affectsPages: true },
  { key: 'SAFEPAY_WEBHOOK_SECRET', encrypted: true, affectsPages: true },
];

// Not secret — an account number/IBAN is meant to be handed out to whoever
// wants to pay into it, unlike an API key, so these save unencrypted.
const BANK_FIELDS: SettingFieldSpec[] = Object.values(BANK_TRANSFER_SETTING_KEYS).map((key) => ({
  key,
  affectsPages: true,
}));

export default function AdminBillingPage() {
  const billingEnabled = getBoolSetting('billingEnabled', false);
  const stripeAction = saveSettingsAction.bind(null, STRIPE_FIELDS);
  const safepayAction = saveSettingsAction.bind(null, SAFEPAY_FIELDS);
  const bankAction = saveSettingsAction.bind(null, BANK_FIELDS);
  const payments = listRecentSupportPayments(50);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Billing & payments</h1>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-ink">Bank transfer (support widget)</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Shown in the &quot;Buy us a coffee&quot; widget as a manual way to send support while card payments are
          being finalized. Fill in at least the account number and IBAN to turn this on — leave both blank to hide
          it. This information is stored in plain text (not encrypted), since it&apos;s meant to be shared with
          anyone who wants to send a payment.
        </p>

        <form action={bankAction} className="card mt-4 grid gap-4 p-5 sm:grid-cols-2">
          <SettingField label="Account title" name={BANK_TRANSFER_SETTING_KEYS.accountTitle} defaultValue={getSetting(BANK_TRANSFER_SETTING_KEYS.accountTitle)} />
          <SettingField label="Account number" name={BANK_TRANSFER_SETTING_KEYS.accountNumber} defaultValue={getSetting(BANK_TRANSFER_SETTING_KEYS.accountNumber)} />
          <SettingField label="IBAN" name={BANK_TRANSFER_SETTING_KEYS.iban} defaultValue={getSetting(BANK_TRANSFER_SETTING_KEYS.iban)} />
          <SettingField label="Swift code" name={BANK_TRANSFER_SETTING_KEYS.swiftCode} defaultValue={getSetting(BANK_TRANSFER_SETTING_KEYS.swiftCode)} />
          <SettingField label="Bank name" name={BANK_TRANSFER_SETTING_KEYS.bankName} defaultValue={getSetting(BANK_TRANSFER_SETTING_KEYS.bankName)} />
          <SettingField label="Branch name" name={BANK_TRANSFER_SETTING_KEYS.branchName} defaultValue={getSetting(BANK_TRANSFER_SETTING_KEYS.branchName)} />
          <SettingField label="Branch code" name={BANK_TRANSFER_SETTING_KEYS.branchCode} defaultValue={getSetting(BANK_TRANSFER_SETTING_KEYS.branchCode)} />

          <div className="sm:col-span-2">
            <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:opacity-90">
              Save
            </button>
          </div>
        </form>
      </div>

      <div className="border-t border-surface-border pt-8">
        <h2 className="text-lg font-semibold text-ink">Safepay (support widget)</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Powers the card-payment option in the same widget. <strong>Known issue as of this writing:</strong>{' '}
          <code className="rounded bg-surface-soft px-1 py-0.5 text-xs">client.payments.create()</code> returns a 404
          (&quot;Client with this identifier not found&quot;) from Safepay&apos;s own sandbox API even with valid
          credentials — see the comment above <code className="rounded bg-surface-soft px-1 py-0.5 text-xs">SafepayCurrency</code>{' '}
          in <code className="rounded bg-surface-soft px-1 py-0.5 text-xs">src/lib/safepay.ts</code> for the full
          trace. The bank transfer option above works regardless of this. Sandbox keys are available immediately
          after signup at{' '}
          <a href="https://getsafepay.com" target="_blank" rel="noopener noreferrer" className="text-accent underline">
            getsafepay.com
          </a>
          , under <strong>Developers → API</strong> (shown there as &quot;API Key&quot; and &quot;Secret Key&quot; —
          paste those into &quot;API key&quot; and &quot;v1 secret&quot; below). The third field, the webhook secret,
          only appears after you register a webhook URL under <strong>Developers → Endpoints</strong> — point it at{' '}
          <code className="rounded bg-surface-soft px-1 py-0.5 text-xs">{'{your domain}'}/api/support/webhook</code>.
          Full production/live approval needs Safepay&apos;s Merchant Onboarding Form (CNIC, bank account
          certificate, NTN) reviewed on their side — sandbox works fully before that finishes. Leave any field blank
          and the widget falls back to bank transfer (or a contact link) instead of a broken checkout.
        </p>

        <form action={safepayAction} className="card mt-4 space-y-4 p-5">
          <label className="block text-sm">
            <span className="text-ink-muted">Environment</span>
            <select
              name="SAFEPAY_ENVIRONMENT"
              defaultValue={getSetting('SAFEPAY_ENVIRONMENT') || 'sandbox'}
              className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <option value="sandbox">Sandbox (test mode, no real charges)</option>
              <option value="production">Production (real charges)</option>
            </select>
          </label>

          <SettingField label="API key (secret)" name="SAFEPAY_API_KEY" secret configured={hasDbValue('SAFEPAY_API_KEY')} />
          <SettingField label="v1 secret" name="SAFEPAY_V1_SECRET" secret configured={hasDbValue('SAFEPAY_V1_SECRET')} />
          <SettingField label="Webhook secret" name="SAFEPAY_WEBHOOK_SECRET" secret configured={hasDbValue('SAFEPAY_WEBHOOK_SECRET')} />

          <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:opacity-90">
            Save
          </button>
        </form>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-ink">Recent support payments</h3>
          <p className="mt-1 text-xs text-ink-muted">
            A local record of verified webhook deliveries, for quick reference only — your Safepay dashboard&apos;s{' '}
            <strong>Payments</strong> page is the source of truth for reconciliation, disputes, and exact figures. The
            amount/currency shown here are parsed from the webhook payload on a best-effort basis; if a value looks
            wrong, check the raw payload below it rather than trust the column.
          </p>
          {payments.length === 0 ? (
            <p className="mt-3 rounded-lg bg-surface-soft px-4 py-6 text-center text-sm text-ink-faint">
              No payments received yet.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-surface-border rounded-lg border border-surface-border">
              {payments.map((p) => (
                <li key={p.id} className="p-3">
                  <details>
                    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-medium text-ink">
                        {p.amount && p.currency ? `${p.currency} ${p.amount}` : 'Amount unavailable'}
                        {p.orderId && <span className="ml-2 font-mono text-xs text-ink-faint">{p.orderId}</span>}
                      </span>
                      <span className="text-xs text-ink-faint">{new Date(p.receivedAt).toLocaleString()}</span>
                    </summary>
                    <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-surface-soft p-3 text-xs text-ink-muted">
                      {p.rawPayload}
                    </pre>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="border-t border-surface-border pt-8">
        <h2 className="text-lg font-semibold text-ink">Stripe</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Configuration storage only — there is no pricing model or checkout flow yet. This gets Stripe ready to wire
          up whenever one ships; the keys are encrypted at rest and never shown again after saving.
        </p>

        <form action={stripeAction} className="card mt-4 space-y-4 p-5">
          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            <input type="checkbox" name="billingEnabled" defaultChecked={billingEnabled} className="h-4 w-4 rounded border-surface-border" />
            Billing enabled (gates any future billing UI — leave off until pricing ships)
          </label>

          <SettingField label="Publishable key" name="STRIPE_PUBLISHABLE_KEY" secret configured={hasDbValue('STRIPE_PUBLISHABLE_KEY')} />
          <SettingField label="Secret key" name="STRIPE_SECRET_KEY" secret configured={hasDbValue('STRIPE_SECRET_KEY')} />
          <SettingField label="Webhook signing secret" name="STRIPE_WEBHOOK_SECRET" secret configured={hasDbValue('STRIPE_WEBHOOK_SECRET')} />

          <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:opacity-90">
            Save
          </button>
        </form>
      </div>
    </div>
  );
}
