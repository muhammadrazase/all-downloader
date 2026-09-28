import { hasDbValue, getSetting } from '@/lib/config/settings.server';
import { saveSettingsAction, type SettingField as SettingFieldSpec } from '@/app/admin/actions';
import { SettingField } from '@/components/admin/SettingField';
import { AiAlertTestButton } from '@/components/admin/AiAlertTestButton';
import { getQuotaStatus, utcDay } from '@/lib/aiQuota';
import { evaluateLevel } from '@/lib/aiAlerts';
import { alertRecipient } from '@/lib/mailer';

const FIELDS: SettingFieldSpec[] = [
  { key: 'GROQ_API_KEY', encrypted: true },
  { key: 'GROQ_MODEL' },
  { key: 'GROQ_WHISPER_MODEL' },
  { key: 'GROQ_DAILY_BUDGET' },
  { key: 'GEMINI_API_KEY', encrypted: true },
  { key: 'GEMINI_MODEL' },
  { key: 'GEMINI_DAILY_BUDGET' },
  { key: 'RAPIDAPI_KEY', encrypted: true },
  { key: 'RAPIDAPI_HOST' },
  { key: 'RAPIDAPI_ENDPOINT' },
  { key: 'ENGINE_URL' },
  { key: 'ENGINE_KEY', encrypted: true },
  { key: 'ALERT_EMAIL' },
  { key: 'AI_ALERT_WARN_PERCENT' },
];

export default function AdminAiKeysPage() {
  const action = saveSettingsAction.bind(null, FIELDS);
  const providers = getQuotaStatus();
  const { level, reason } = evaluateLevel(providers);
  const levelStyle =
    level === 'critical'
      ? 'bg-red-50 text-red-700'
      : level === 'warning'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-green-50 text-green-700';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">AI & engine keys</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Fully dynamic — everything here lives in the database, takes effect immediately, and needs no restart or
          .env edit. Update a model or key any time; leaving a secret field blank just keeps the one already saved.
        </p>
      </div>

      <section className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Free quota today ({utcDay()} UTC)</h2>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${levelStyle}`}>{level}</span>
        </div>
        <p className="text-sm text-ink-muted">{reason}</p>

        <ul className="divide-y divide-surface-border">
          {providers.map((p) => (
            <li key={p.provider} className="py-3">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-medium text-ink">{p.provider}</span>
                <span className={p.exhausted ? 'font-semibold text-red-700' : 'text-ink-muted'}>
                  {p.requests} / {p.budget} calls ({p.percentUsed}%){p.exhausted ? ' — exhausted' : ''}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-soft">
                <div
                  className={`h-full rounded-full ${p.exhausted ? 'bg-red-500' : p.percentUsed >= 80 ? 'bg-amber-500' : 'bg-accent'}`}
                  style={{ width: `${Math.min(100, p.percentUsed)}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-ink-faint">
                rate-limited: {p.rateLimited} · failures: {p.failures} · last success:{' '}
                {p.lastOkAt ? new Date(p.lastOkAt).toLocaleString() : 'never'}
              </p>
            </li>
          ))}
        </ul>

        <div className="border-t border-surface-border pt-4">
          <p className="text-xs text-ink-muted">
            Alerts go to <span className="font-medium text-ink">{alertRecipient()}</span> and repeat once a day while
            quota is low or exhausted (driven by the daily cron installed by up.sh).
          </p>
          <div className="mt-3">
            <AiAlertTestButton />
          </div>
        </div>
      </section>

      <form action={action} className="card space-y-6 p-5">
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-ink">Groq (transcription + chat)</legend>
          <SettingField label="Groq API key" name="GROQ_API_KEY" secret configured={hasDbValue('GROQ_API_KEY')} />
          <div className="grid gap-3 sm:grid-cols-2">
            <SettingField label="Chat model" name="GROQ_MODEL" defaultValue={getSetting('GROQ_MODEL') || 'llama-3.3-70b-versatile'} />
            <SettingField label="Whisper model" name="GROQ_WHISPER_MODEL" defaultValue={getSetting('GROQ_WHISPER_MODEL') || 'whisper-large-v3'} />
          </div>
          <SettingField
            label="Daily call budget"
            name="GROQ_DAILY_BUDGET"
            defaultValue={getSetting('GROQ_DAILY_BUDGET') ?? ''}
            hint="Stop calling Groq past this many calls per UTC day (default 800). Keeps one busy day from burning the free tier."
          />
        </fieldset>

        <fieldset className="space-y-3 border-t border-surface-border pt-6">
          <legend className="text-sm font-semibold text-ink">Gemini (fallback provider)</legend>
          <SettingField label="Gemini API key" name="GEMINI_API_KEY" secret configured={hasDbValue('GEMINI_API_KEY')} />
          <SettingField label="Model" name="GEMINI_MODEL" defaultValue={getSetting('GEMINI_MODEL') || 'gemini-2.5-flash'} />
          <SettingField
            label="Daily call budget"
            name="GEMINI_DAILY_BUDGET"
            defaultValue={getSetting('GEMINI_DAILY_BUDGET') ?? ''}
            hint="Default 1200 calls per UTC day."
          />
        </fieldset>

        <fieldset className="space-y-3 border-t border-surface-border pt-6">
          <legend className="text-sm font-semibold text-ink">Quota alerts</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <SettingField
              label="Alert email"
              name="ALERT_EMAIL"
              defaultValue={getSetting('ALERT_EMAIL') ?? ''}
              hint="Falls back to the contact inbox."
            />
            <SettingField
              label="Warn at % of budget"
              name="AI_ALERT_WARN_PERCENT"
              defaultValue={getSetting('AI_ALERT_WARN_PERCENT') ?? ''}
              hint="Default 80."
            />
          </div>
        </fieldset>

        <fieldset className="space-y-3 border-t border-surface-border pt-6">
          <legend className="text-sm font-semibold text-ink">Extraction engine (optional — local yt-dlp is the default)</legend>
          <SettingField label="RapidAPI key" name="RAPIDAPI_KEY" secret configured={hasDbValue('RAPIDAPI_KEY')} hint="Free/Vercel path — returns direct CDN links." />
          <div className="grid gap-3 sm:grid-cols-2">
            <SettingField label="RapidAPI host" name="RAPIDAPI_HOST" defaultValue={getSetting('RAPIDAPI_HOST') ?? ''} />
            <SettingField label="RapidAPI endpoint" name="RAPIDAPI_ENDPOINT" defaultValue={getSetting('RAPIDAPI_ENDPOINT') ?? ''} />
          </div>
          <SettingField label="Remote engine URL" name="ENGINE_URL" defaultValue={getSetting('ENGINE_URL') ?? ''} hint="Forwards extract/download to a separate engine service." />
          <SettingField label="Remote engine key" name="ENGINE_KEY" secret configured={hasDbValue('ENGINE_KEY')} />
        </fieldset>

        <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:opacity-90">
          Save
        </button>
      </form>
    </div>
  );
}
