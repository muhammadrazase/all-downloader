import { getSetting, hasDbValue } from '@/lib/config/settings.server';
import { site } from '@/lib/site';
import { saveSettingsAction, type SettingField as SettingFieldSpec } from '@/app/admin/actions';
import { SettingField } from '@/components/admin/SettingField';

// affectsPages: baked into static HTML, so a change must regenerate pages.
const FIELDS: SettingFieldSpec[] = [
  { key: 'DISCORD_URL', affectsPages: true },
  { key: 'TELEGRAM_URL', affectsPages: true },
  { key: 'CHROME_EXTENSION_URL', affectsPages: true },
  { key: 'GISCUS_REPO', affectsPages: true },
  { key: 'GISCUS_REPO_ID', affectsPages: true },
  { key: 'GISCUS_CATEGORY_ID', affectsPages: true },
  { key: 'PLAUSIBLE_DOMAIN', affectsPages: true },
  { key: 'GA_ID', affectsPages: true },
  { key: 'GOOGLE_SITE_VERIFICATION', affectsPages: true },
  { key: 'BING_SITE_VERIFICATION', affectsPages: true },
  { key: 'YANDEX_VERIFICATION', affectsPages: true },
  { key: 'CONTACT_EMAIL', affectsPages: true },
  // Mail settings are read per-request by the mailer, never prerendered.
  { key: 'SMTP_HOST' },
  { key: 'SMTP_PORT' },
  { key: 'SMTP_SECURE' },
  { key: 'SMTP_USER' },
  { key: 'SMTP_PASS', encrypted: true },
  { key: 'SMTP_FROM' },
  { key: 'CONTACT_TO' },
];

export default function AdminSitePage() {
  const action = saveSettingsAction.bind(null, FIELDS);
  const v = (key: string, fallback: string) => getSetting(key) || fallback;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Site & community</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Overrides the matching .env value. Leave a field blank to keep the current value.
        </p>
      </div>

      <form action={action} className="card space-y-6 p-5">
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-1 text-sm font-semibold text-ink">Community</legend>
          <SettingField label="Discord invite URL" name="DISCORD_URL" defaultValue={v('DISCORD_URL', site.discordUrl)} />
          <SettingField label="Telegram URL" name="TELEGRAM_URL" defaultValue={v('TELEGRAM_URL', site.telegramUrl)} />
          <SettingField label="Chrome extension URL" name="CHROME_EXTENSION_URL" defaultValue={v('CHROME_EXTENSION_URL', site.chromeExtensionUrl)} />
          <SettingField label="Contact email" name="CONTACT_EMAIL" defaultValue={v('CONTACT_EMAIL', site.email)} />
        </fieldset>

        <fieldset className="grid gap-3 border-t border-surface-border pt-6 sm:grid-cols-2">
          <legend className="mb-1 text-sm font-semibold text-ink">Giscus (community discussion board)</legend>
          <SettingField label="Repo (owner/name)" name="GISCUS_REPO" defaultValue={v('GISCUS_REPO', site.giscus.repo)} />
          <SettingField label="Repo ID" name="GISCUS_REPO_ID" defaultValue={v('GISCUS_REPO_ID', site.giscus.repoId)} />
          <SettingField label="Category ID" name="GISCUS_CATEGORY_ID" defaultValue={v('GISCUS_CATEGORY_ID', site.giscus.categoryId)} />
        </fieldset>

        <fieldset className="grid gap-3 border-t border-surface-border pt-6 sm:grid-cols-2">
          <legend className="mb-1 text-sm font-semibold text-ink">Analytics & search console</legend>
          <SettingField label="Plausible domain" name="PLAUSIBLE_DOMAIN" defaultValue={v('PLAUSIBLE_DOMAIN', site.analytics.plausibleDomain)} />
          <SettingField label="Google Analytics ID" name="GA_ID" defaultValue={v('GA_ID', site.analytics.gaId)} />
          <SettingField label="Google site verification" name="GOOGLE_SITE_VERIFICATION" defaultValue={v('GOOGLE_SITE_VERIFICATION', site.verification.google)} />
          <SettingField label="Bing site verification" name="BING_SITE_VERIFICATION" defaultValue={v('BING_SITE_VERIFICATION', site.verification.bing)} />
          <SettingField label="Yandex verification" name="YANDEX_VERIFICATION" defaultValue={v('YANDEX_VERIFICATION', site.verification.yandex)} />
        </fieldset>

        <fieldset className="grid gap-3 border-t border-surface-border pt-6 sm:grid-cols-2">
          <legend className="mb-1 text-sm font-semibold text-ink">Email (contact form + quota alerts)</legend>
          <SettingField label="SMTP host" name="SMTP_HOST" defaultValue={getSetting('SMTP_HOST') ?? ''} />
          <SettingField label="SMTP port" name="SMTP_PORT" defaultValue={getSetting('SMTP_PORT') ?? ''} hint="587 for STARTTLS, 465 for TLS." />
          <SettingField label="SMTP user" name="SMTP_USER" defaultValue={getSetting('SMTP_USER') ?? ''} />
          <SettingField label="SMTP password" name="SMTP_PASS" secret configured={hasDbValue('SMTP_PASS')} hint="Gmail requires an app password." />
          <SettingField label="Secure (true/false)" name="SMTP_SECURE" defaultValue={getSetting('SMTP_SECURE') ?? ''} hint="true only for port 465." />
          <SettingField label="From address" name="SMTP_FROM" defaultValue={getSetting('SMTP_FROM') ?? ''} />
          <SettingField label="Contact form inbox" name="CONTACT_TO" defaultValue={getSetting('CONTACT_TO') ?? ''} />
        </fieldset>

        <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:opacity-90">
          Save
        </button>
      </form>
    </div>
  );
}
