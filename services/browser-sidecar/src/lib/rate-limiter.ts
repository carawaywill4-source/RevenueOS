/**
 * Per-platform rate limiter.
 *
 * We keep an in-memory counter per platform. If the process restarts
 * counters reset — the daily caps here are a floor, not a hard TOS
 * enforcement mechanism. Publishers still respect their own quotas.
 */

export type RateLimitState = {
  lastActionAt: number;
  actionsToday: number;
  dayKey: string;
};

const DAILY_CAP_DEFAULTS: Record<string, number> = {
  reddit: 8,
  hackernews: 4,
  indiehackers: 6,
  substack: 4,
  quora: 6,
};

const MIN_INTERVAL_MS_DEFAULTS: Record<string, number> = {
  reddit: 90_000,
  hackernews: 120_000,
  indiehackers: 60_000,
  substack: 60_000,
  quora: 60_000,
};

export class PlatformRateLimiter {
  private readonly state = new Map<string, RateLimitState>();
  constructor(
    private readonly caps = DAILY_CAP_DEFAULTS,
    private readonly minIntervals = MIN_INTERVAL_MS_DEFAULTS,
  ) {}

  private todayKey(now: Date): string {
    return now.toISOString().slice(0, 10);
  }

  /**
   * @returns { allowed: true } if the caller can proceed. Otherwise the
   * reason string tells the client whether to retry after the min interval
   * or wait until tomorrow.
   */
  attempt(
    platform: string,
    now: Date = new Date(),
  ):
    | { allowed: true }
    | { allowed: false; reason: string; retryAfterMs?: number } {
    const cap = this.caps[platform] ?? Number.MAX_SAFE_INTEGER;
    const minInterval = this.minIntervals[platform] ?? 30_000;
    const dayKey = this.todayKey(now);
    const state = this.state.get(platform);

    if (!state || state.dayKey !== dayKey) {
      this.state.set(platform, {
        lastActionAt: now.getTime(),
        actionsToday: 1,
        dayKey,
      });
      return { allowed: true };
    }
    if (state.actionsToday >= cap) {
      return { allowed: false, reason: "daily_cap_reached" };
    }
    const since = now.getTime() - state.lastActionAt;
    if (since < minInterval) {
      return {
        allowed: false,
        reason: "min_interval",
        retryAfterMs: minInterval - since,
      };
    }
    state.lastActionAt = now.getTime();
    state.actionsToday += 1;
    return { allowed: true };
  }

  snapshot(): Record<string, RateLimitState> {
    return Object.fromEntries(this.state.entries());
  }
}
