import { test } from "node:test";
import assert from "node:assert/strict";
import { PlatformRateLimiter } from "../lib/rate-limiter.js";

test("rate limiter enforces min interval within a burst", () => {
  const limiter = new PlatformRateLimiter(
    { reddit: 100 },
    { reddit: 60_000 },
  );
  const now = new Date("2026-08-09T12:00:00Z");
  assert.equal(limiter.attempt("reddit", now).allowed, true);
  const soon = new Date(now.getTime() + 30_000);
  const result = limiter.attempt("reddit", soon);
  assert.equal(result.allowed, false);
  if (!result.allowed) {
    assert.equal(result.reason, "min_interval");
    assert.ok((result.retryAfterMs ?? 0) > 0);
  }
});

test("rate limiter enforces daily cap", () => {
  const limiter = new PlatformRateLimiter(
    { hackernews: 2 },
    { hackernews: 0 },
  );
  const now = new Date();
  assert.equal(limiter.attempt("hackernews", now).allowed, true);
  assert.equal(limiter.attempt("hackernews", now).allowed, true);
  const third = limiter.attempt("hackernews", now);
  assert.equal(third.allowed, false);
});

test("rate limiter resets counters at day boundary", () => {
  const limiter = new PlatformRateLimiter(
    { quora: 1 },
    { quora: 0 },
  );
  const day1 = new Date("2026-08-09T12:00:00Z");
  assert.equal(limiter.attempt("quora", day1).allowed, true);
  assert.equal(limiter.attempt("quora", day1).allowed, false);
  const day2 = new Date("2026-08-10T09:00:00Z");
  assert.equal(limiter.attempt("quora", day2).allowed, true);
});
