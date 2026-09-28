import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';

// scrypt cost params — deliberately high; this gate is checked at most a few
// times a minute (rate-limited + account-locked), never on a hot path.
const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;

// A thin hand-written wrapper (not util.promisify) because TypeScript resolves
// promisify against the WRONG overload of Node's scrypt (the one without an
// `options` object), which then rejects the 4-argument call below.
function scryptAsync(password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/** Hash a password for storage. Format: "N:r:p:saltHex:hashHex". */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const derived = await scryptAsync(password, salt, KEY_LEN, { N, r: R, p: P });
  return `${N}:${R}:${P}:${salt.toString('hex')}:${derived.toString('hex')}`;
}

/** Constant-time verify against a stored hash produced by hashPassword(). */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 5) return false;
  const [nStr, rStr, pStr, saltHex, hashHex] = parts;
  if (nStr === undefined || rStr === undefined || pStr === undefined || saltHex === undefined || hashHex === undefined) {
    return false;
  }
  const n = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const derived = await scryptAsync(password, salt, expected.length, { N: n, r, p });
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
