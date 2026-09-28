// Aggregates only — no per-event/per-visitor rows, ever. See db.ts for why
// this is a separate file from the admin config DB.
export const ANALYTICS_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tool_hits (
  day TEXT NOT NULL,
  hour INTEGER NOT NULL,
  tool TEXT NOT NULL,
  country TEXT NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, hour, tool, country)
);

CREATE TABLE IF NOT EXISTS daily_totals (
  day TEXT PRIMARY KEY,
  visitors INTEGER NOT NULL DEFAULT 0,
  pageviews INTEGER NOT NULL DEFAULT 0
);
`;
