import { getDb } from './db';
import { getSetting } from './config/settings.server';

// Free-tier budget guard + provider preference for the AI tools. Every call
// through ai.ts reports its outcome here, which gives us three things: a daily
// cap so one burst can't burn a whole day's free quota, a way to prefer the
// provider that still has headroom, and the signal the alert cron emails on.

export type AiProvider = 'groq' | 'gemini';
export type AiOutcome = 'ok' | 'rate_limited' | 'error';

export const AI_PROVIDERS: AiProvider[] = ['groq', 'gemini'];

// Conservative defaults well under the documented free tiers; admin-editable.
const DEFAULT_BUDGET: Record<AiProvider, number> = { groq: 800, gemini: 1200 };
const EXHAUSTED_COOLDOWN_MS = 60 * 60 * 1000; // skip a rate-limited provider for an hour

export interface ProviderStatus {
  provider: AiProvider;
  requests: number;
  failures: number;
  rateLimited: number;
  budget: number;
  percentUsed: number;
  remainingRequests: number | null;
  exhausted: boolean;
  exhaustedUntil: number | null;
  lastOkAt: number | null;
}

interface UsageRow {
  provider: string;
  day: string;
  requests: number;
  failures: number;
  rate_limited: number;
  remaining_requests: number | null;
  exhausted_until: number | null;
  last_ok_at: number | null;
}

export function utcDay(at = new Date()): string {
  return at.toISOString().slice(0, 10);
}

export function dailyBudget(provider: AiProvider): number {
  const raw = getSetting(provider === 'groq' ? 'GROQ_DAILY_BUDGET' : 'GEMINI_DAILY_BUDGET');
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_BUDGET[provider];
}

function readRow(provider: AiProvider, day = utcDay()): UsageRow | undefined {
  try {
    return getDb().prepare('SELECT * FROM ai_usage WHERE provider = ? AND day = ?').get(provider, day) as
      | UsageRow
      | undefined;
  } catch {
    return undefined; // fail open — never block AI over a counter read
  }
}

export interface CallMeta {
  remainingRequests?: number | null;
  retryAfterSec?: number | null;
}

export function recordAiCall(provider: AiProvider, outcome: AiOutcome, meta: CallMeta = {}): void {
  const now = Date.now();
  const cooldown = meta.retryAfterSec && meta.retryAfterSec > 0 ? meta.retryAfterSec * 1000 : EXHAUSTED_COOLDOWN_MS;
  try {
    getDb()
      .prepare(
        `INSERT INTO ai_usage (provider, day, requests, failures, rate_limited, remaining_requests, exhausted_until, last_ok_at, updated_at)
         VALUES (@provider, @day, 1, @failure, @rateLimited, @remaining, @exhaustedUntil, @lastOk, @now)
         ON CONFLICT(provider, day) DO UPDATE SET
           requests = requests + 1,
           failures = failures + @failure,
           rate_limited = rate_limited + @rateLimited,
           remaining_requests = COALESCE(@remaining, remaining_requests),
           exhausted_until = COALESCE(@exhaustedUntil, exhausted_until),
           last_ok_at = COALESCE(@lastOk, last_ok_at),
           updated_at = @now`,
      )
      .run({
        provider,
        day: utcDay(),
        failure: outcome === 'error' ? 1 : 0,
        rateLimited: outcome === 'rate_limited' ? 1 : 0,
        remaining: meta.remainingRequests ?? null,
        exhaustedUntil: outcome === 'rate_limited' ? now + cooldown : null,
        lastOk: outcome === 'ok' ? now : null,
        now,
      });
  } catch {
    /* counters are best-effort; never fail a user's request over them */
  }
}

export function getProviderStatus(provider: AiProvider): ProviderStatus {
  const row = readRow(provider);
  const budget = dailyBudget(provider);
  const requests = row?.requests ?? 0;
  const exhaustedUntil = row?.exhausted_until ?? null;
  const cooledDown = Boolean(exhaustedUntil && exhaustedUntil > Date.now());
  return {
    provider,
    requests,
    failures: row?.failures ?? 0,
    rateLimited: row?.rate_limited ?? 0,
    budget,
    percentUsed: budget > 0 ? Math.min(100, Math.round((requests / budget) * 100)) : 0,
    remainingRequests: row?.remaining_requests ?? null,
    exhausted: cooledDown || requests >= budget,
    exhaustedUntil,
    lastOkAt: row?.last_ok_at ?? null,
  };
}

export function getQuotaStatus(): ProviderStatus[] {
  return AI_PROVIDERS.map(getProviderStatus);
}

/** Over budget or inside a rate-limit cooldown → skip this provider for now. */
export function isProviderUsable(provider: AiProvider): boolean {
  try {
    return !getProviderStatus(provider).exhausted;
  } catch {
    return true;
  }
}

/**
 * Providers still inside their free budget, in the caller's own priority order
 * (callers pick order for functional reasons — e.g. PDF summaries need Gemini's
 * big context window). Empty means at capacity: say so rather than burn quota.
 */
export function usableProviders(order: AiProvider[] = AI_PROVIDERS): AiProvider[] {
  return order.filter(isProviderUsable);
}

/** Test/ops helper — wipes today's counters and any rate-limit cooldown. */
export function resetAiQuota(): void {
  try {
    getDb().prepare('DELETE FROM ai_usage').run();
  } catch {
    /* nothing to reset */
  }
}

/** Reads rate-limit headers both providers send so budgets track reality, not guesses. */
export function metaFromResponse(res: Response): CallMeta {
  const remaining = res.headers.get('x-ratelimit-remaining-requests');
  const retryAfter = res.headers.get('retry-after');
  return {
    remainingRequests: remaining !== null && remaining !== '' ? Number(remaining) : null,
    retryAfterSec: retryAfter !== null && retryAfter !== '' ? Number(retryAfter) : null,
  };
}
