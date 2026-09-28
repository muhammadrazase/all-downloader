import { getQuotaStatus, utcDay, type ProviderStatus } from './aiQuota';
import { getSetting, setSetting, writeAuditLog } from './config/settings.server';
import { alertRecipient, mailerConfigured, sendMail } from './mailer';
import { site } from './site';

// Emails the owner when free AI quota is running low or gone. Re-sends once per
// UTC day while the condition persists (driven by the daily cron), and again
// immediately if the situation escalates warning -> critical.

export type AlertLevel = 'ok' | 'warning' | 'critical';

const WARN_AT_PERCENT = 80;
const LAST_DAY_KEY = 'AI_ALERT_LAST_DAY';
const LAST_LEVEL_KEY = 'AI_ALERT_LAST_LEVEL';

export interface AlertResult {
  level: AlertLevel;
  sent: boolean;
  reason: string;
  providers: ProviderStatus[];
}

function warnThreshold(): number {
  const n = Number(getSetting('AI_ALERT_WARN_PERCENT'));
  return Number.isFinite(n) && n > 0 && n <= 100 ? n : WARN_AT_PERCENT;
}

/** Only providers the operator actually configured count toward the verdict. */
function configured(providers: ProviderStatus[]): ProviderStatus[] {
  return providers.filter((p) =>
    Boolean(getSetting(p.provider === 'groq' ? 'GROQ_API_KEY' : 'GEMINI_API_KEY')),
  );
}

export function evaluateLevel(providers: ProviderStatus[]): { level: AlertLevel; reason: string } {
  const active = configured(providers);
  if (!active.length) return { level: 'ok', reason: 'No AI provider keys are configured.' };

  if (active.every((p) => p.exhausted)) {
    return { level: 'critical', reason: 'Every configured AI provider is out of free quota or rate-limited.' };
  }
  const low = active.filter((p) => p.percentUsed >= warnThreshold() || p.exhausted);
  if (low.length) {
    return {
      level: 'warning',
      reason: `Running low: ${low.map((p) => `${p.provider} at ${p.percentUsed}% of its daily budget`).join(', ')}.`,
    };
  }
  return { level: 'ok', reason: 'All configured providers have free quota remaining.' };
}

function body(level: AlertLevel, reason: string, providers: ProviderStatus[]): string {
  const lines = providers.map((p) => {
    const last = p.lastOkAt ? new Date(p.lastOkAt).toISOString() : 'never';
    const remaining = p.remainingRequests === null ? 'unknown' : String(p.remainingRequests);
    return `  ${p.provider}: ${p.requests}/${p.budget} calls today (${p.percentUsed}%)${p.exhausted ? ' — EXHAUSTED' : ''}
    rate-limited responses today: ${p.rateLimited}, failures: ${p.failures}
    provider-reported remaining: ${remaining}, last success: ${last}`;
  });

  return [
    `${level === 'critical' ? 'AI tools are OFFLINE' : 'AI free quota is running low'} on ${site.name}.`,
    '',
    reason,
    '',
    `Usage for ${utcDay()} (UTC):`,
    ...lines,
    '',
    level === 'critical'
      ? 'Visitors currently get an "AI tools are at capacity" message. Cached results still work.'
      : 'Nothing is broken yet — this is a heads-up before the daily budget runs out.',
    '',
    'To fix: add or rotate a key at Groq (console.groq.com) or Google AI Studio (aistudio.google.com),',
    `then paste it into ${site.url}/admin/ai-keys. Daily budgets are editable on the same page.`,
    '',
    'This alert repeats once a day until the situation clears.',
  ].join('\n');
}

/**
 * Checks quota and emails if warranted. `force` sends regardless of state/dedup
 * (the admin panel's "send test alert" button).
 */
export async function evaluateAndAlert(opts: { force?: boolean } = {}): Promise<AlertResult> {
  const providers = getQuotaStatus();
  const { level, reason } = evaluateLevel(providers);

  const today = utcDay();
  const lastDay = getSetting(LAST_DAY_KEY);
  const lastLevel = getSetting(LAST_LEVEL_KEY) as AlertLevel | undefined;
  const escalated = level === 'critical' && lastLevel !== 'critical';
  const alreadySentToday = lastDay === today && !escalated;

  const shouldSend = opts.force || (level !== 'ok' && !alreadySentToday);
  if (!shouldSend) return { level, sent: false, reason, providers };

  if (!mailerConfigured()) {
    writeAuditLog('ai_alert_skipped_no_smtp', level, null);
    return { level, sent: false, reason: `${reason} (SMTP is not configured, so no email was sent.)`, providers };
  }

  await sendMail({
    to: alertRecipient(),
    subject: `[${site.name}] ${level === 'critical' ? 'AI tools offline — free quota exhausted' : 'AI free quota running low'}`,
    text: body(level, reason, providers),
  });

  if (!opts.force) {
    setSetting(LAST_DAY_KEY, today);
    setSetting(LAST_LEVEL_KEY, level);
  }
  writeAuditLog('ai_alert_sent', level, null);
  return { level, sent: true, reason, providers };
}
