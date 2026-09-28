#!/usr/bin/env node
/**
 * create-admin.mjs — create or reset the single SnapVidly admin panel user.
 *
 * Interactive:
 *   npm run admin:create
 * Non-interactive (VPS provisioning, CI):
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' npm run admin:create
 *
 * Safe to re-run at any time — it's also the password-reset path (a lost
 * password never permanently locks the panel; re-run this to regain access).
 * Standalone plain-JS (no ts-node/tsx dependency) so it runs with a bare `node`.
 */
import Database from 'better-sqlite3';
import { randomBytes, scrypt as scryptCb } from 'node:crypto';
import { chmodSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import readline from 'node:readline';

const scrypt = promisify(scryptCb);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Minimal .env loader — only fills vars not already set in the environment.
const envFile = path.join(root, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS admin_user (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  session_version INTEGER NOT NULL DEFAULT 1,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS content_config (
  kind TEXT NOT NULL, key TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1,
  featured INTEGER NOT NULL DEFAULT 0, seo_title TEXT, seo_description TEXT,
  seo_keywords TEXT, seo_canonical TEXT, seo_noindex INTEGER NOT NULL DEFAULT 0,
  og_image TEXT, updated_at INTEGER NOT NULL, PRIMARY KEY (kind, key)
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value TEXT, encrypted INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, target TEXT, ip TEXT, at INTEGER NOT NULL
);
`;

async function hashPassword(password) {
  const N = 16384, R = 8, P = 1, KEY_LEN = 64;
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LEN, { N, r: R, p: P });
  return `${N}:${R}:${P}:${salt.toString('hex')}:${derived.toString('hex')}`;
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); }));
}

/** Reads a line without echoing it to the terminal (no external dependency). */
function askHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    let value = '';
    stdin.resume();
    stdin.setRawMode?.(true);
    stdin.setEncoding('utf8');

    const onData = (char) => {
      if (char === '\n' || char === '\r' || char === '') {
        stdin.setRawMode?.(wasRaw ?? false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(value);
        return;
      }
      if (char === '') process.exit(130); // Ctrl+C
      if (char === '' || char === '\b') {
        value = value.slice(0, -1);
        return;
      }
      value += char;
    };
    stdin.on('data', onData);
  });
}

async function main() {
  console.log('\nSnapVidly admin panel — create/reset the superadmin account\n');

  let email = process.env.ADMIN_EMAIL;
  let password = process.env.ADMIN_PASSWORD;
  const nonInteractive = Boolean(email && password);

  if (!email) email = await ask('Admin email: ');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('✖ That does not look like a valid email address.');
    process.exit(1);
  }

  if (!password) {
    password = await askHidden('New password (min 12 chars): ');
    const confirm = await askHidden('Confirm password: ');
    if (password !== confirm) {
      console.error('✖ Passwords did not match.');
      process.exit(1);
    }
  }
  if (password.length < 12) {
    console.error('✖ Password must be at least 12 characters.');
    process.exit(1);
  }

  const dbPath = process.env.ADMIN_DB_PATH || path.join(root, 'data', 'admin.db');
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA_SQL);
  // Contains the password hash — never leave it world-readable.
  for (const f of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    try {
      chmodSync(f, 0o600);
    } catch {
      /* sibling may not exist */
    }
  }

  const existing = db.prepare('SELECT session_version FROM admin_user WHERE id = 1').get();
  const passwordHash = await hashPassword(password);
  db.prepare(
    `INSERT INTO admin_user (id, email, password_hash, session_version, failed_attempts, locked_until, updated_at)
     VALUES (1, @email, @passwordHash, @sessionVersion, 0, NULL, @updatedAt)
     ON CONFLICT(id) DO UPDATE SET email=excluded.email, password_hash=excluded.password_hash,
       session_version=excluded.session_version, failed_attempts=0, locked_until=NULL, updated_at=excluded.updated_at`,
  ).run({ email, passwordHash, sessionVersion: (existing?.session_version ?? 0) + 1, updatedAt: Date.now() });
  db.close();

  console.log(`\n✅ Admin account ${existing ? 'reset' : 'created'} for ${email}.`);
  console.log(`   DB: ${dbPath}`);
  if (!nonInteractive) console.log('   Log in at /admin/login. Any previously open session was signed out.\n');
}

main().catch((err) => {
  console.error('\n✖ Failed:', err.message);
  process.exit(1);
});
