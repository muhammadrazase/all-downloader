// 4 small tables, no ORM. Bootstrapped via CREATE TABLE IF NOT EXISTS on
// every process start (see ./index.ts) — nothing to run manually.
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS admin_user (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  session_version INTEGER NOT NULL DEFAULT 1,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER,
  updated_at INTEGER NOT NULL
);

-- Every tool (registry key) AND every blog post (slug) shares one table: absent
-- row = enabled, no override — matches current site behavior with zero rows.
CREATE TABLE IF NOT EXISTS content_config (
  kind TEXT NOT NULL,
  key TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  featured INTEGER NOT NULL DEFAULT 0,
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT,
  seo_canonical TEXT,
  seo_noindex INTEGER NOT NULL DEFAULT 0,
  og_image TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (kind, key)
);

-- Generic key/value store: AI + engine keys, Stripe keys, community/site/SEO
-- fields, and feature flags (blogEnabled / maintenanceMode / aiEnabled).
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  encrypted INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  target TEXT,
  ip TEXT,
  at INTEGER NOT NULL
);

-- Successful Safepay webhook deliveries, recorded for the owner's own
-- visibility inside the admin panel. Safepay's dashboard remains the source
-- of truth for reconciliation and disputes — this is a convenience log, not
-- an accounting ledger, since the SDK doesn't document the webhook payload's
-- exact field names (see supportPayments.ts). order_id is UNIQUE so a
-- retried webhook delivery (standard for most payment gateways) doesn't
-- double-count — note SQLite never treats two NULLs as a UNIQUE conflict, so
-- that only de-duplicates when an order_id was actually extracted.
CREATE TABLE IF NOT EXISTS support_payment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT UNIQUE,
  amount TEXT,
  currency TEXT,
  raw_payload TEXT NOT NULL,
  received_at INTEGER NOT NULL
);

-- Per-provider, per-UTC-day AI call counters. Drives the free-tier budget
-- guard, provider preference, and the quota-exhaustion alerts.
CREATE TABLE IF NOT EXISTS ai_usage (
  provider TEXT NOT NULL,
  day TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  failures INTEGER NOT NULL DEFAULT 0,
  rate_limited INTEGER NOT NULL DEFAULT 0,
  remaining_requests INTEGER,
  exhausted_until INTEGER,
  last_ok_at INTEGER,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (provider, day)
);
`;
