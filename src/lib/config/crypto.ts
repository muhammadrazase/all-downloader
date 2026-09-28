import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// AES-256-GCM for secrets-at-rest, keyed separately from SESSION_SECRET.
// Format: "v1:<iv>:<tag>:<ciphertext>" (base64) — "v1" leaves room to rotate later.

function key(): Buffer {
  const hex = process.env.CONFIG_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('CONFIG_ENCRYPTION_KEY is not set (must be 64 hex chars / 32 bytes).');
  }
  return Buffer.from(hex, 'hex');
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptSecret(stored: string): string {
  const parts = stored.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('Unrecognized secret format.');
  const [, ivB64, tagB64, ctB64] = parts;
  if (ivB64 === undefined || tagB64 === undefined || ctB64 === undefined) {
    throw new Error('Unrecognized secret format.');
  }
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
}

/** Masks a secret for display: shows only the last 4 characters. */
export function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 4) return '••••';
  return `••••${value.slice(-4)}`;
}
