# Safepay setup — sandbox and live

Powers the "Buy us a coffee" support widget (`src/components/SupportWidget.tsx`). The widget only shows the real $5/$10/$25/custom picker once all three credentials below are saved in `/admin/billing` — until then it shows a "Say thanks" link instead of a broken checkout.

## The three credentials

| Admin field | Safepay dashboard location | What it's for |
|---|---|---|
| API key | Dashboard → **Developers → API** → "API Key" | Identifies your merchant account |
| v1 secret | Same page → "Secret Key" | Signs requests to Safepay |
| Webhook secret | Dashboard → **Developers → Endpoints**, shown after you add a webhook URL | Verifies incoming webhook deliveries are really from Safepay |

All three are stored encrypted (AES-256-GCM) in the admin database, never in `.env` or code. Save them at **`/admin/billing`**.

Note: `safepayConfigured()` (`src/lib/safepay.ts`) only checks that all three fields are non-empty — it doesn't validate the webhook secret against Safepay. That means checkout creation works correctly even with a placeholder webhook secret; only signature verification on an *incoming* webhook would fail until it's the real value.

## Testing on localhost right now (sandbox)

You already have a sandbox **API key** and **Secret key**. To test the full checkout flow today:

1. Go to `/admin/billing`.
2. Set **Environment** to `Sandbox`.
3. Paste your Public/API key → **"API key"** field.
4. Paste your Secret key → **"v1 secret"** field.
5. **Webhook secret**: type any placeholder value for now (e.g. `pending-webhook-setup`) — this only unlocks the widget's real UI; it doesn't need to be genuine yet.
6. Save.
7. Reload the homepage. The floating "Support us" widget should now show $5 / $10 / $25 / "Any amount" as real clickable buttons.
8. Click an amount → you should be redirected to Safepay's hosted sandbox checkout page. Complete a test payment there (sandbox card numbers are in Safepay's docs) — no real money moves in sandbox.
9. On success, Safepay redirects you back to `/support/thank-you` on your own site.

What **won't** work yet with a placeholder webhook secret: Safepay can't actually deliver a webhook to `localhost` anyway (it's not publicly reachable), so the "Recent support payments" log in `/admin/billing` will stay empty during local testing regardless. That's expected — it only fills in once webhooks can really reach you (see below).

**Before trusting any amount shown on Safepay's checkout page**: the code sends amounts in minor units (cents/paisa) per Safepay's current docs — confirm the amount displayed on their checkout page matches what you clicked before doing a real transaction.

## Getting the real webhook secret

1. In the Safepay dashboard: **Developers → Endpoints**.
2. Add a webhook URL. Two options:
   - **If you're ready to deploy**: use your real production URL, e.g. `https://yourdomain.com/api/support/webhook`. Most gateways issue the secret immediately without verifying the URL responds yet, so you don't have to wait for deployment to finish.
   - **If you want to test webhook delivery locally right now**: run a tunnel (e.g. `ngrok http 3000`) and register the tunnel's `https://` URL instead. Remember this URL changes every time you restart ngrok on the free tier, so you'd need to re-register it each session — fine for a one-off test, not for ongoing local dev.
3. Copy the webhook secret Safepay shows you.
4. Replace the placeholder in `/admin/billing`'s "Webhook secret" field with the real value.

## Going live (production)

1. Complete Safepay's **Merchant Onboarding Form** (CNIC, bank account certificate, NTN — see the email draft I gave you for the individual/freelancer question). Expect roughly 1–2 weeks to gather documents plus a few business days for their review.
2. Once approved, Safepay gives you separate **production** API key + secret key (switching your dashboard from Sandbox to Production shows a different key pair — sandbox and production credentials are never interchangeable).
3. Register a **production** webhook endpoint the same way as above (Developers → Endpoints, using your real live domain), and get the production webhook secret — this is also separate from the sandbox one.
4. In `/admin/billing`: set **Environment** to `Production`, and replace all three fields with the production values.
5. Do **one real, small transaction** (say $1) before announcing the feature — confirm the amount charged matches, the redirect back to `/support/thank-you` works, and a row appears in the "Recent support payments" log.

## Fees & settlement (for reference)

Standard/pay-as-you-go plan: **2.9% + Rs 30** per domestic transaction, **3.2% + Rs 30** international, no monthly fee. Settlement is batched daily to your linked Pakistani bank account: card/bank-transfer payments settle T+1 (next working day), mobile wallet payments T+2. No minimum payout threshold.

## Checking logs / transaction history

- **Safepay's own dashboard** → **Payments** page: the authoritative source. Shows a full event feed per transaction with Request IDs (useful when contacting their support), and CSV export for up to 30 days.
- **This site's admin panel** (`/admin/billing`, "Recent support payments"): a lightweight convenience log of verified webhook deliveries, populated by `src/app/api/support/webhook/route.ts`. Amount/currency shown there are parsed from the webhook payload on a best-effort basis (Safepay's SDK doesn't document the exact payload shape) — if a figure looks off, expand the row to see the raw payload, and treat Safepay's own dashboard as correct.

## Troubleshooting

- **Widget still shows "Say thanks" after saving all three fields**: hard-refresh the page (the homepage is statically generated; saving with `affectsPages: true` triggers a rebuild, but a browser or service-worker cache can occasionally still serve the old version for one load).
- **Checkout button does nothing / shows an error**: check the browser console and your terminal's dev server output — `POST /api/support/checkout` will log `safepay_checkout_failed` server-side with the error name if the Safepay API call itself failed (e.g. a real credential typo).
- **A saved field doesn't seem to persist**: make sure you're clicking the **Save** button inside the Safepay/Billing card itself, not any other button on the page.
