import { getDb } from '../db';
import { hashPassword, verifyPassword } from './password';

// The single superadmin row (id always 1 — no signup, no multi-admin).
// Brute-force defense is account lockout with exponential backoff; the
// per-IP limiter in rateLimit.ts runs as a second layer in the login action.

const LOCK_THRESHOLD = 5;
// Capped low on purpose: there is only ONE account, so a long lock is a remote
// DoS on the owner. Brute-force cost is carried by scrypt + the IP limiter;
// `npm run admin:reset` is the always-available recovery path.
const MAX_LOCK_MINUTES = 15;

interface AdminUserRow {
  id: number;
  email: string;
  password_hash: string;
  session_version: number;
  failed_attempts: number;
  locked_until: number | null;
  updated_at: number;
}

export function getAdminUser(): AdminUserRow | undefined {
  return getDb().prepare('SELECT * FROM admin_user WHERE id = 1').get() as AdminUserRow | undefined;
}

export function adminExists(): boolean {
  return Boolean(getAdminUser());
}

/** Used by scripts/create-admin.mjs — also serves as the password-reset path. */
export async function upsertAdmin(email: string, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);
  const existing = getAdminUser();
  getDb()
    .prepare(
      `INSERT INTO admin_user (id, email, password_hash, session_version, failed_attempts, locked_until, updated_at)
       VALUES (1, @email, @passwordHash, @sessionVersion, 0, NULL, @updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         email = excluded.email, password_hash = excluded.password_hash,
         session_version = excluded.session_version, failed_attempts = 0, locked_until = NULL, updated_at = excluded.updated_at`,
    )
    .run({
      email,
      passwordHash,
      // Bump (not just set) so any previously issued cookie is invalidated by
      // a reset — this is also the account-recovery path for a lost password.
      sessionVersion: (existing?.session_version ?? 0) + 1,
      updatedAt: Date.now(),
    });
}

function lockDurationMs(failedAttempts: number): number {
  const over = failedAttempts - LOCK_THRESHOLD + 1; // 1, 2, 3, ...
  const minutes = Math.min(MAX_LOCK_MINUTES, 2 ** (over - 1));
  return minutes * 60_000;
}

export type LoginResult =
  | { ok: true; sessionVersion: number }
  | { ok: false; reason: 'no_admin' | 'locked' | 'invalid'; retryAfterMs?: number };

export async function attemptLogin(email: string, password: string): Promise<LoginResult> {
  const user = getAdminUser();
  if (!user) return { ok: false, reason: 'no_admin' };

  if (user.locked_until && user.locked_until > Date.now()) {
    return { ok: false, reason: 'locked', retryAfterMs: user.locked_until - Date.now() };
  }

  // Constant-shape check: always run the scrypt verify even on an email
  // mismatch, so a wrong email doesn't respond faster than a wrong password.
  const validPassword = await verifyPassword(password, user.password_hash);
  const validEmail = email.trim().toLowerCase() === user.email.trim().toLowerCase();

  if (validPassword && validEmail) {
    getDb()
      .prepare('UPDATE admin_user SET failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = 1')
      .run(Date.now());
    return { ok: true, sessionVersion: user.session_version };
  }

  const failedAttempts = user.failed_attempts + 1;
  const lockedUntil = failedAttempts >= LOCK_THRESHOLD ? Date.now() + lockDurationMs(failedAttempts) : null;
  getDb()
    .prepare('UPDATE admin_user SET failed_attempts = ?, locked_until = ?, updated_at = ? WHERE id = 1')
    .run(failedAttempts, lockedUntil, Date.now());
  return lockedUntil
    ? { ok: false, reason: 'locked', retryAfterMs: lockedUntil - Date.now() }
    : { ok: false, reason: 'invalid' };
}

/** Bumps session_version, invalidating every previously issued cookie. Used by
 * the security page's "sign out everywhere" and automatically on password change. */
export function bumpSessionVersion(): number {
  const user = getAdminUser();
  const next = (user?.session_version ?? 0) + 1;
  getDb().prepare('UPDATE admin_user SET session_version = ?, updated_at = ? WHERE id = 1').run(next, Date.now());
  return next;
}

export async function changePassword(newPassword: string): Promise<number> {
  const passwordHash = await hashPassword(newPassword);
  const next = bumpSessionVersion();
  getDb().prepare('UPDATE admin_user SET password_hash = ?, updated_at = ? WHERE id = 1').run(passwordHash, Date.now());
  return next;
}

/** Authoritative check for the /admin layout — verifies the token's session_version
 * still matches the DB (middleware's own check is signature+expiry only). */
export function sessionVersionMatches(v: number): boolean {
  const user = getAdminUser();
  return Boolean(user && user.session_version === v);
}
