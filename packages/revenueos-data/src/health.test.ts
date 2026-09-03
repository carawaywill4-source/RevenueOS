import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_RETRY, nextBackoffMs, withRetry } from "./health.js";

describe("revenueos-data health retry", () => {
  it("bounds exponential backoff", () => {
    const a1 = nextBackoffMs(1, { ...DEFAULT_RETRY, initialDelayMs: 100, maxDelayMs: 1000, factor: 2 });
    const a5 = nextBackoffMs(5, { ...DEFAULT_RETRY, initialDelayMs: 100, maxDelayMs: 1000, factor: 2 });
    assert.ok(a1 >= 80 && a1 <= 120);
    assert.ok(a5 <= 1000 * 1.2);
  });

  it("withRetry succeeds after transient failures", async () => {
    let n = 0;
    const value = await withRetry(
      "test",
      async () => {
        n += 1;
        if (n < 3) throw new Error("transient");
        return "ok";
      },
      { maxAttempts: 5, initialDelayMs: 1, maxDelayMs: 5, factor: 2 },
    );
    assert.equal(value, "ok");
    assert.equal(n, 3);
  });

  it("withRetry does not loop forever", async () => {
    let n = 0;
    await assert.rejects(
      () =>
        withRetry(
          "test",
          async () => {
            n += 1;
            throw new Error("always");
          },
          { maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 2, factor: 2 },
        ),
      /test_failed_after_3/,
    );
    assert.equal(n, 3);
  });
});
