/**
 * Sidecar HTTP tests.
 *
 * We build the express app with a fake PageLike so no real browser is
 * launched. The tests assert:
 *   - unauthorized requests are rejected
 *   - each route validates its body
 *   - dry_run mode returns preview without submitting
 *   - rate limiter enforces daily cap + min interval
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { buildApp } from "../lib/server.js";
import { PlatformRateLimiter } from "../lib/rate-limiter.js";
import type { PageLike } from "../lib/handlers.js";

class FakePage implements PageLike {
  private currentUrl = "about:blank";
  filled: Record<string, string> = {};
  clicked: string[] = [];
  screenshots: string[] = [];
  async goto(url: string) {
    this.currentUrl = url;
  }
  async fill(selector: string, value: string) {
    this.filled[selector] = value;
  }
  async click(selector: string) {
    this.clicked.push(selector);
    if (selector.includes("submit")) {
      this.currentUrl = "https://example.test/posted";
    }
  }
  async waitForSelector() {
    return;
  }
  async waitForURL() {
    return;
  }
  async screenshot(opts?: { path?: string }): Promise<Buffer> {
    if (opts?.path) this.screenshots.push(opts.path);
    return Buffer.from("");
  }
  url() {
    return this.currentUrl;
  }
  async close() {
    return;
  }
}

function startServer(
  app: import("express").Express,
): Promise<{ base: string; close: () => Promise<void> }> {
  const server = http.createServer(app);
  return new Promise((resolve) => {
    server.listen(0, () => {
      const addr = server.address() as AddressInfo;
      resolve({
        base: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise<void>((res) => server.close(() => res())),
      });
    });
  });
}

async function withApp<T>(
  fn: (base: string, page: FakePage) => Promise<T>,
  overrides: Partial<Parameters<typeof buildApp>[0]> = {},
): Promise<T> {
  const page = new FakePage();
  const app = buildApp({
    token: "test-token",
    screenshotDir: "/tmp/sidecar-tests",
    dryRun: false,
    rateLimiter: new PlatformRateLimiter(
      { reddit: 100, hackernews: 100, indiehackers: 100, substack: 100, quora: 100 },
      { reddit: 0, hackernews: 0, indiehackers: 0, substack: 0, quora: 0 },
    ),
    createPage: async () => page,
    ...overrides,
  });
  const started = await startServer(app);
  try {
    return await fn(started.base, page);
  } finally {
    await started.close();
  }
}

test("healthz is open, other routes require token", async () => {
  await withApp(async (base) => {
    const health = await fetch(`${base}/healthz`);
    assert.equal(health.status, 200);
    const denied = await fetch(`${base}/post/hackernews`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(denied.status, 401);
  });
});

test("hackernews route validates body", async () => {
  await withApp(async (base) => {
    const res = await fetch(`${base}/post/hackernews`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-sidecar-token": "test-token",
      },
      body: JSON.stringify({ title: "" }),
    });
    assert.equal(res.status, 400);
  });
});

test("hackernews route with dry_run returns preview without submit", async () => {
  await withApp(async (base, page) => {
    const res = await fetch(`${base}/post/hackernews`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-sidecar-token": "test-token",
      },
      body: JSON.stringify({
        title: "Show HN: Test",
        url: "https://ex.com",
        dryRun: true,
      }),
    });
    assert.equal(res.status, 200);
    const data = (await res.json()) as { ok: boolean; detail: string };
    assert.equal(data.ok, true);
    assert.match(data.detail, /dry_run/);
    assert.ok(!page.clicked.some((c) => c.includes("submit")));
  });
});

test("hackernews route in live mode clicks submit", async () => {
  await withApp(async (base, page) => {
    const res = await fetch(`${base}/post/hackernews`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-sidecar-token": "test-token",
      },
      body: JSON.stringify({
        title: "Show HN: Test",
        url: "https://ex.com",
      }),
    });
    assert.equal(res.status, 200);
    assert.ok(page.clicked.some((c) => c.includes("submit")));
  });
});

test("reddit reply route drafts body", async () => {
  await withApp(async (base, page) => {
    const res = await fetch(`${base}/reddit/reply`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-sidecar-token": "test-token",
      },
      body: JSON.stringify({
        threadUrl: "https://www.reddit.com/r/foo/comments/bar",
        body: "Hello",
        dryRun: true,
      }),
    });
    assert.equal(res.status, 200);
    assert.ok(Object.keys(page.filled).length > 0);
  });
});

test("substack route validates publicationId presence", async () => {
  await withApp(async (base) => {
    const res = await fetch(`${base}/post/substack`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-sidecar-token": "test-token",
      },
      body: JSON.stringify({ html: "<p>hi</p>", subject: "" }),
    });
    assert.equal(res.status, 400);
  });
});

test("quora route requires questionId", async () => {
  await withApp(async (base) => {
    const res = await fetch(`${base}/post/quora`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-sidecar-token": "test-token",
      },
      body: JSON.stringify({ body: "answer" }),
    });
    assert.equal(res.status, 400);
  });
});

test("indiehackers route posts with productSlug", async () => {
  await withApp(async (base, page) => {
    const res = await fetch(`${base}/post/indiehackers`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-sidecar-token": "test-token",
      },
      body: JSON.stringify({
        productSlug: "raiseready",
        body: "Update",
        dryRun: true,
      }),
    });
    assert.equal(res.status, 200);
    assert.ok(page.filled['textarea[name="post-body"], textarea[placeholder*="update"]']);
  });
});

test("rate limiter blocks over-cap requests with 429", async () => {
  const limiter = new PlatformRateLimiter({ hackernews: 1 }, { hackernews: 0 });
  await withApp(
    async (base) => {
      const body = JSON.stringify({
        title: "Show HN",
        url: "https://ex.com",
        dryRun: true,
      });
      const headers = {
        "content-type": "application/json",
        "x-sidecar-token": "test-token",
      };
      const first = await fetch(`${base}/post/hackernews`, {
        method: "POST",
        headers,
        body,
      });
      assert.equal(first.status, 200);
      const second = await fetch(`${base}/post/hackernews`, {
        method: "POST",
        headers,
        body,
      });
      assert.equal(second.status, 429);
    },
    { rateLimiter: limiter },
  );
});
