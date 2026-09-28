import nodemailer from 'nodemailer';
import { getSetting } from './config/settings.server';
import { site } from './site';

// Single outbound mail path (contact form + admin alerts). Config resolves
// DB > env, so SMTP can be changed from /admin/settings without a redeploy.

export interface MailInput {
  to?: string;
  subject: string;
  text: string;
  /** Structured on purpose — a concatenated "Name <addr>" string lets a
   * hostile display name (e.g. "Foo <evil@x>, victim@y") inject a second,
   * attacker-controlled address into the Reply-To header. */
  replyTo?: { name: string; address: string };
}

function smtpConfig() {
  return {
    host: getSetting('SMTP_HOST'),
    port: Number(getSetting('SMTP_PORT') ?? 587),
    secure: getSetting('SMTP_SECURE') === 'true',
    user: getSetting('SMTP_USER'),
    pass: getSetting('SMTP_PASS'),
    from: getSetting('SMTP_FROM'),
  };
}

export function mailerConfigured(): boolean {
  const c = smtpConfig();
  return Boolean(c.host && c.user && c.pass);
}

/** Where operational alerts go (falls back to the contact inbox, then the brand address). */
export function alertRecipient(): string {
  return getSetting('ALERT_EMAIL') || getSetting('CONTACT_TO') || site.email;
}

export async function sendMail({ to, subject, text, replyTo }: MailInput): Promise<void> {
  const c = smtpConfig();
  if (!c.host || !c.user || !c.pass) throw new Error('smtp_not_configured');

  const transporter = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure, // true for 465, false for 587/STARTTLS
    auth: { user: c.user, pass: c.pass },
  });

  await transporter.sendMail({
    from: c.from || `${site.name} <${c.user}>`,
    to: to || alertRecipient(),
    ...(replyTo ? { replyTo } : {}),
    subject,
    text,
  });
}
