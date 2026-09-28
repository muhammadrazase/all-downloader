import { createHmac, timingSafeEqual } from 'node:crypto';

// Signed admin session cookie: base64url(payload) + "." + HMAC-SHA256 of it.
// No jose/next-auth needed for one signed claim. Checked in middleware.ts and
// the /admin layout, which also verifies session_version against the DB.

export const SESSION_COOKIE = 'ssd_admin_session';
const SESSION_TTL_SEC = 12 * 60 * 60; // 12h, sliding renewal on each authenticated request

export interface SessionPayload {
  sub: 'admin';
  v: number; // session_version at issue time
  iat: number;
  exp: number;
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === 'production') {
    // Fail closed: an admin panel must never run with a guessable/missing signing key.
    throw new Error('SESSION_SECRET is not set (must be >=32 chars). Set it in .env before starting in production.');
  }
  return 'dev-only-insecure-session-secret-do-not-use-in-prod!!';
}

function b64url(input: Buffer): string {
  return input.toString('base64url');
}

function sign(payloadB64: string): string {
  return b64url(createHmac('sha256', secret()).update(payloadB64).digest());
}

export function createSessionToken(sessionVersion: number): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { sub: 'admin', v: sessionVersion, iat: now, exp: now + SESSION_TTL_SEC };
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload)));
  return `${payloadB64}.${sign(payloadB64)}`;
}

/** Signature + expiry only — callers check session_version separately. */
export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expectedSig = sign(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as SessionPayload;
    if (payload.sub !== 'admin' || typeof payload.v !== 'number' || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE_SEC = SESSION_TTL_SEC;
