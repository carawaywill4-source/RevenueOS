/**
 * Database health states for Supervisor / Activity.
 * Temporary unavailability must not crash RevenueOS Core.
 */

export type DbHealthState =
  | "DB_HEALTHY"
  | "DB_DEGRADED"
  | "DB_UNAVAILABLE"
  | "DB_RECOVERING";

export type DbHealthReport = {
  state: DbHealthState;
  provider: "supabase" | "postgres" | "none";
  checkedAt: string;
  latencyMs: number | null;
  detail?: string;
  consecutiveFailures: number;
};

export type RetryPolicy = {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  factor: number;
};

export const DEFAULT_RETRY: RetryPolicy = {
  maxAttempts: 5,
  initialDelayMs: 200,
  maxDelayMs: 8_000,
  factor: 2,
};

export function nextBackoffMs(attempt: number, policy: RetryPolicy = DEFAULT_RETRY): number {
  const raw = policy.initialDelayMs * policy.factor ** Math.max(0, attempt - 1);
  const capped = Math.min(policy.maxDelayMs, raw);
  // light jitter (±20%)
  const jitter = capped * (0.8 + Math.random() * 0.4);
  return Math.round(jitter);
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  policy: RetryPolicy = DEFAULT_RETRY,
): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (attempt >= policy.maxAttempts) break;
      await sleep(nextBackoffMs(attempt, policy));
    }
  }
  const message = last instanceof Error ? last.message : String(last);
  throw new Error(`${label}_failed_after_${policy.maxAttempts}: ${message}`);
}
