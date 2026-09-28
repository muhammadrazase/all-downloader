import Database from 'better-sqlite3';
import { chmodSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { ANALYTICS_SCHEMA_SQL } from './schema';

// Deliberately a SEPARATE file/connection from data/admin.db. Analytics writes
// happen on every tracked page view; admin.db holds the password hash and
// session state. Keeping them apart means an analytics write can never queue
// behind (or block) an admin auth check, and vice versa.
declare global {
  // eslint-disable-next-line no-var
  var __ssdAnalyticsDb: Database.Database | undefined;
}

function resolvePath(): string {
  if (process.env.ANALYTICS_DB_PATH) return process.env.ANALYTICS_DB_PATH;
  if (process.env.VITEST) return ':memory:';
  return path.join(process.cwd(), 'data', 'analytics.db');
}

function open(): Database.Database {
  const dbPath = resolvePath();
  if (dbPath !== ':memory:') mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  if (dbPath !== ':memory:') db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 3000');
  db.pragma('foreign_keys = OFF');
  db.exec(ANALYTICS_SCHEMA_SQL);

  if (dbPath !== ':memory:') {
    for (const f of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
      try {
        chmodSync(f, 0o600);
      } catch {
        /* sibling may not exist yet */
      }
    }
  }
  return db;
}

export function getAnalyticsDb(): Database.Database {
  if (!globalThis.__ssdAnalyticsDb) globalThis.__ssdAnalyticsDb = open();
  return globalThis.__ssdAnalyticsDb;
}

const stmtCache = new Map<string, Database.Statement>();

export function analyticsStmt(sql: string): Database.Statement {
  const db = getAnalyticsDb();
  let cached = stmtCache.get(sql);
  if (!cached) {
    cached = db.prepare(sql);
    stmtCache.set(sql, cached);
  }
  return cached;
}
