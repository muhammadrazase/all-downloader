import Database from 'better-sqlite3';
import { chmodSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { SCHEMA_SQL } from './schema';

// Cached on globalThis so dev-server HMR doesn't reopen the file.
declare global {
  // eslint-disable-next-line no-var
  var __ssdAdminDb: Database.Database | undefined;
}

function resolveDbPath(): string {
  if (process.env.ADMIN_DB_PATH) return process.env.ADMIN_DB_PATH;
  if (process.env.VITEST) return ':memory:'; // keep unit tests hermetic
  return path.join(process.cwd(), 'data', 'admin.db');
}

function openDb(): Database.Database {
  const dbPath = resolveDbPath();
  if (dbPath !== ':memory:') mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  if (dbPath !== ':memory:') db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 3000');
  db.pragma('foreign_keys = OFF');
  db.exec(SCHEMA_SQL);
  // Holds the admin password hash and audit trail — default umask leaves it
  // 0644, readable by any local user. WAL/SHM are created by the pragma above.
  if (dbPath !== ':memory:') restrictPerms(dbPath);
  return db;
}

function restrictPerms(dbPath: string): void {
  for (const f of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    try {
      chmodSync(f, 0o600);
    } catch {
      /* sibling may not exist yet, or the FS may not support it */
    }
  }
}

export function getDb(): Database.Database {
  if (!globalThis.__ssdAdminDb) {
    globalThis.__ssdAdminDb = openDb();
    stmtCache.clear();
  }
  return globalThis.__ssdAdminDb;
}

const stmtCache = new Map<string, Database.Statement>();

/**
 * Prepared-statement cache. `db.prepare()` recompiles the SQL every call, which
 * is the real per-read cost on hot paths like getSetting(). Statements bind to
 * the connection, not to data, so caching them carries no staleness risk.
 */
export function stmt(sql: string): Database.Statement {
  const db = getDb();
  let cached = stmtCache.get(sql);
  if (!cached) {
    cached = db.prepare(sql);
    stmtCache.set(sql, cached);
  }
  return cached;
}
