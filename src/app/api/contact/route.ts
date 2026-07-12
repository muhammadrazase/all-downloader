import { NextResponse } from 'next/server';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { checkRateLimit } from '@/lib/rateLimit';
import { clientIp } from '@/lib/clientIp';
import { site } from '@/lib/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  message: z.string().trim().min(5).max(5000),
});

const smtpConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);


export async function POST(req: Request): Promise<NextResponse> {
  const { success } = await checkRateLimit(clientIp(req));
  if (!success) return NextResponse.json({ error: 'Too many messages. Please wait a moment.' }, { status: 429 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  // Honeypot: bots fill hidden fields. Silently accept so they don't retry.
  if (typeof body.company === 'string' && body.company.length > 0) {
    return NextResponse.json({ ok: true });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please fill in your name, a valid email, and a message.' }, { status: 400 });
  }

  // If SMTP isn't set up, tell the client to fall back to the mailto link.
  if (!smtpConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const { name, email, message } = parsed.data;
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587/STARTTLS
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `SnapVidly <${process.env.SMTP_USER}>`,
      to: process.env.CONTACT_TO || site.email,
      replyTo: `${name} <${email}>`,
      subject: `SnapVidly contact — ${name}`,
      text: `${message}\n\n— ${name} <${email}>`,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('contact_send_failed', { reason: (err as Error)?.name });
    return NextResponse.json({ error: 'Could not send your message. Please email us directly.' }, { status: 502 });
  }
}
