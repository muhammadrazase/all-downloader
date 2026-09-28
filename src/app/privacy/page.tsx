import type { Metadata } from 'next';
import { PageHeader } from '@/components/PageHeader';
import { buildMetadata } from '@/lib/seo';
import { site } from '@/lib/site';

export const dynamic = 'force-static';

export const metadata: Metadata = buildMetadata({
  title: 'Privacy Policy',
  description:
    'How SnapVidly handles your data, cookies and advertising — including third-party ad partners, your choices, and how to opt out of personalized ads.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <>
      <PageHeader title="Privacy Policy" subtitle="Short version: we collect almost nothing." />
      <article className="prose-ssd mx-auto px-5 pb-16">
        <p><strong>Last updated: September 2026.</strong></p>
        <h2>What we collect</h2>
        <p>
          We do not require an account and we do not ask for your social media logins. We do not store the videos you
          download or the links you paste beyond what is needed to process your request in real time.
        </p>
        <h2>Analytics</h2>
        <p>
          We use privacy-friendly, cookieless analytics to understand aggregate traffic (for example, which pages are
          popular). This does not track you across websites and does not identify you personally. We also keep a
          first-party count of which tools are used and, at a country level only (never city or precise location),
          roughly where visitors come from. Your IP address is used for a moment to look up your country and to keep a
          same-day, non-reversible count of unique visitors — it is never written to disk, never linked to your
          activity, and the daily count becomes unlinkable to any individual again the next day.
        </p>
        <h2>Rate limiting</h2>
        <p>
          To prevent abuse, we may temporarily process your IP address to enforce request limits. This is used only for
          security and is not sold or shared.
        </p>
        <h2>Cookies</h2>
        <p>
          Our own features work without tracking cookies. However, when we display ads, our third-party advertising
          partners and their vendors may set and read cookies, device identifiers and similar technologies on your
          device to serve and measure ads. You can control or clear cookies in your browser settings; blocking them
          will not stop you from using {site.shortName}.
        </p>
        <h2>Advertising</h2>
        <p>
          {site.shortName} is free because it is supported by advertising. We work with third-party ad networks and
          their vendors, who may use cookies and similar technologies to collect information such as your IP address,
          device and browser type, and pages viewed, in order to show ads — including ads based on your prior visits to
          this or other websites (personalized advertising). We do not sell your personal information for money. Each
          ad partner’s use of data is governed by its own privacy policy, which we do not control.
        </p>
        <p>You can opt out of personalized advertising at any time:</p>
        <ul>
          <li>Google Ads settings: <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer nofollow">adssettings.google.com</a></li>
          <li>Digital Advertising Alliance (US): <a href="https://optout.aboutads.info" target="_blank" rel="noopener noreferrer nofollow">optout.aboutads.info</a></li>
          <li>Your Online Choices (EU/UK): <a href="https://www.youronlinechoices.eu" target="_blank" rel="noopener noreferrer nofollow">youronlinechoices.eu</a></li>
        </ul>
        <h2>Your regional rights (GDPR / UK GDPR / CCPA)</h2>
        <p>
          If you are in the EEA or UK, we rely on your consent to set advertising cookies; where a consent banner is
          shown you may accept or decline, and you can withdraw consent at any time by clearing cookies. If you are a
          California resident, you have the right to opt out of the “sale” or “sharing” of personal information as
          defined by the CCPA — using the ad opt-out links above achieves this, or you can email us. To exercise any
          data right, contact <a href={`mailto:${site.email}`}>{site.email}</a>.
        </p>
        <h2>Children</h2>
        <p>
          {site.shortName} is not directed to children under 13 (or the minimum age in your country), and we do not
          knowingly collect their personal information.
        </p>
        <h2>Third-party links</h2>
        <p>
          Downloads are served from the source platforms’ own servers, and our blog may link to external sites. Their
          privacy practices are governed by their own policies.
        </p>
        <h2>Your choices</h2>
        <p>
          Because we don’t hold personal accounts or profiles, there is very little data to access or delete. For any
          privacy question, email <a href={`mailto:${site.email}`}>{site.email}</a>.
        </p>
      </article>
    </>
  );
}
