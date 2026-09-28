import { getDb, stmt } from '../db';
import { encryptSecret, decryptSecret } from './crypto';

// Generic settings KV (AI/engine/Stripe keys, site fields, feature flags).
// Precedence: DB > env var of the same name > undefined. Uncached — reads are
// sub-millisecond, and this lets a saved key take effect without a restart.

interface SettingRow {
  value: string | null;
  encrypted: number;
}

function readRow(key: string): SettingRow | undefined {
  try {
    return stmt('SELECT value, encrypted FROM settings WHERE key = ?').get(key) as SettingRow | undefined;
  } catch {
    // DB unavailable/corrupt: fail open to the env-var fallback below rather
    // than taking a feature down over a config-store hiccup.
    return undefined;
  }
}

function safeDecrypt(stored: string): string | undefined {
  try {
    return decryptSecret(stored);
  } catch {
    return undefined;
  }
}

export function getSetting(key: string): string | undefined {
  const row = readRow(key);
  const dbValue: string | undefined = row?.value ? (row.encrypted ? safeDecrypt(row.value) : row.value) : undefined;
  return dbValue || process.env[key] || undefined;
}

export function getBoolSetting(key: string, fallback = false): boolean {
  const v = getSetting(key);
  if (v === undefined) return fallback;
  return v === '1' || v === 'true';
}

export function setSetting(key: string, value: string, opts: { encrypted?: boolean } = {}): void {
  const stored = opts.encrypted ? encryptSecret(value) : value;
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, encrypted, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, encrypted = excluded.encrypted, updated_at = excluded.updated_at`,
    )
    .run(key, stored, opts.encrypted ? 1 : 0, Date.now());
}

export function setBoolSetting(key: string, value: boolean): void {
  setSetting(key, value ? '1' : '0');
}

export function deleteSetting(key: string): void {
  getDb().prepare('DELETE FROM settings WHERE key = ?').run(key);
}

/** Whether a DB-stored (non-env) value exists for this key — used by the admin
 * UI to show "configured" without ever displaying the value itself. */
export function hasDbValue(key: string): boolean {
  const row = readRow(key);
  return Boolean(row?.value);
}

export function writeAuditLog(action: string, target: string | null, ip: string | null): void {
  try {
    getDb()
      .prepare('INSERT INTO audit_log (action, target, ip, at) VALUES (?, ?, ?, ?)')
      .run(action, target, ip, Date.now());
  } catch {
    /* audit log is best-effort — never block a mutation on it */
  }
}
