import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rateLimit';
import { clientIp } from '@/lib/clientIp';
import { getSetting } from '@/lib/config/settings.server';
import { mailerConfigured, sendMail } from '@/lib/mailer';
import { site } from '@/lib/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  message: z.string().trim().min(5).max(5000),
  type: z.enum(['contact', 'suggestion']).default('contact'),
});


export async function POST(req: Request): Promise<NextResponse> {
  const { success } = await checkRateLimit(clientIp(req.headers));
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
  if (!mailerConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const { name, email, message, type } = parsed.data;
  try {
    await sendMail({
      to: getSetting('CONTACT_TO') || site.email,
      replyTo: { name, address: email },
      subject: `SnapVidly ${type === 'suggestion' ? 'suggestion' : 'contact'} from ${name}`,
      text: `${message}\n\n— ${name} <${email}>`,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('contact_send_failed', { reason: (err as Error)?.name });
    return NextResponse.json({ error: 'Could not send your message. Please email us directly.' }, { status: 502 });
  }
}
