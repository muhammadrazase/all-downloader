import { analyticsStmt } from './db';

// Read side: every query here is a covering aggregate over at most a few
// thousand rows (see schema.ts for the cardinality math), so all of these are
// single-digit-millisecond even at a year of retention.

export interface DailyPoint {
  day: string;
  visitors: number;
  pageviews: number;
}

export interface ToolStat {
  tool: string;
  views: number;
}

export interface CountryStat {
  country: string;
  views: number;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export function getDailySeries(days: number): DailyPoint[] {
  try {
    const since = daysAgo(days);
    return analyticsStmt('SELECT day, visitors, pageviews FROM daily_totals WHERE day >= ? ORDER BY day ASC').all(
      since,
    ) as DailyPoint[];
  } catch {
    return [];
  }
}

export function getTotals(days: number): { visitors: number; pageviews: number } {
  try {
    const since = daysAgo(days);
    const row = analyticsStmt(
      'SELECT COALESCE(SUM(visitors), 0) AS visitors, COALESCE(SUM(pageviews), 0) AS pageviews FROM daily_totals WHERE day >= ?',
    ).get(since) as { visitors: number; pageviews: number } | undefined;
    return row ?? { visitors: 0, pageviews: 0 };
  } catch {
    return { visitors: 0, pageviews: 0 };
  }
}

export function getTopTools(days: number, limit = 32): ToolStat[] {
  try {
    const since = daysAgo(days);
    return analyticsStmt(
      'SELECT tool, SUM(hits) AS views FROM tool_hits WHERE day >= ? GROUP BY tool ORDER BY views DESC LIMIT ?',
    ).all(since, limit) as ToolStat[];
  } catch {
    return [];
  }
}

export function getTopCountries(days: number, limit = 15): CountryStat[] {
  try {
    const since = daysAgo(days);
    return analyticsStmt(
      'SELECT country, SUM(hits) AS views FROM tool_hits WHERE day >= ? GROUP BY country ORDER BY views DESC LIMIT ?',
    ).all(since, limit) as CountryStat[];
  } catch {
    return [];
  }
}
