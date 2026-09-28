import { describe, it, expect, beforeAll } from 'vitest';
import { createHmac } from 'node:crypto';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createSessionToken, verifySessionToken } from '@/lib/auth/session';
import { encryptSecret, decryptSecret, maskSecret } from '@/lib/config/crypto';

describe('password hashing (scrypt)', () => {
  it('verifies the correct password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('wrong password', hash)).toBe(false);
  });

  it('produces a different hash (different salt) for the same password each time', async () => {
    const a = await hashPassword('same password');
    const b = await hashPassword('same password');
    expect(a).not.toBe(b);
    expect(await verifyPassword('same password', a)).toBe(true);
    expect(await verifyPassword('same password', b)).toBe(true);
  });

  it('rejects a malformed stored hash instead of throwing', async () => {
    expect(await verifyPassword('anything', 'not-a-valid-hash')).toBe(false);
  });
});

describe('session token (HMAC-signed cookie)', () => {
  beforeAll(() => {
    process.env.SESSION_SECRET = 'test-only-session-secret-that-is-long-enough-32';
  });

  it('round-trips a valid token', () => {
    const token = createSessionToken(3);
    const payload = verifySessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe('admin');
    expect(payload?.v).toBe(3);
  });

  it('rejects a tampered payload', () => {
    const token = createSessionToken(1);
    const [payloadB64, sig] = token.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ sub: 'admin', v: 999, iat: 0, exp: 9_999_999_999 })).toString(
      'base64url',
    );
    expect(verifySessionToken(`${tamperedPayload}.${sig}`)).toBeNull();
    expect(verifySessionToken(`${payloadB64}.${sig}x`)).toBeNull();
  });

  it('rejects an expired token', () => {
    const expiredPayload = Buffer.from(JSON.stringify({ sub: 'admin', v: 1, iat: 0, exp: 1 })).toString('base64url');
    // Sign it the same way createSessionToken would, using the real secret.
    const sig = createHmac('sha256', process.env.SESSION_SECRET!).update(expiredPayload).digest('base64url');
    expect(verifySessionToken(`${expiredPayload}.${sig}`)).toBeNull();
  });

  it('rejects garbage input without throwing', () => {
    expect(verifySessionToken(undefined)).toBeNull();
    expect(verifySessionToken('')).toBeNull();
    expect(verifySessionToken('not-a-token')).toBeNull();
    expect(verifySessionToken('a.b')).toBeNull();
  });
});

describe('secrets-at-rest (AES-256-GCM)', () => {
  beforeAll(() => {
    process.env.CONFIG_ENCRYPTION_KEY = 'a'.repeat(64); // 32 bytes hex
  });

  it('round-trips a secret', () => {
    const ciphertext = encryptSecret('sk-super-secret-key');
    expect(ciphertext.startsWith('v1:')).toBe(true);
    expect(decryptSecret(ciphertext)).toBe('sk-super-secret-key');
  });

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const a = encryptSecret('same value');
    const b = encryptSecret('same value');
    expect(a).not.toBe(b);
  });

  it('fails to decrypt with a wrong-shaped payload', () => {
    expect(() => decryptSecret('not-a-valid-payload')).toThrow();
  });

  it('masks a secret to only its last 4 characters', () => {
    expect(maskSecret('sk-1234567890')).toBe('••••7890');
    expect(maskSecret('ab')).toBe('••••');
    expect(maskSecret('')).toBe('');
  });
});
