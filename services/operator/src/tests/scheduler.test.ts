/**
 * Scheduler unit tests. Focus on the invariants that are cheap to
 * violate: per-business min interval, semaphore-bounded concurrency,
 * abort propagation. Every dependency is mocked; no Supabase, no
 * network, no @revenueos/core internals.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { PortfolioScheduler } from "../lib/scheduler.js";
import type { OperatorBusinessManifest, SiteAdapter } from "@revenueos/core";

const noopLogger = () => {};

function makeManifest(siteId: string): OperatorBusinessManifest {
  return {
    siteId,
    displayName: siteId,
    industry: "test",
    brandVoice: "test",
    appUrl: `https://${siteId}.example`,
    product: {
      id: `${siteId}-product`,
      name: `${siteId} product`,
      priceUsd: 10,
    },
  };
}

function makeAdapter(siteId: string): SiteAdapter {
  return {
    id: siteId,
    async getContext() {
      return {
        siteId,
        displayName: siteId,
        industry: "test",
        products: [],
        funnelSteps: [],
        brandVoice: "test",
        allowedChannels: [],
        autonomousDailyCapUsd: 0,
        timezone: "UTC",
        constraints: [],
      };
    },
    async observe() {
      return {
        observedAt: new Date().toISOString(),
        money: {
          revenueUsd: 0,
          purchases: 0,
          awaitingPayment: 0,
          refunded: 0,
          estimatedVariableCostUsd: 0,
          estimatedProfitUsd: 0,
          mrr: 0,
          arr: 0,
        } as unknown as Awaited<ReturnType<SiteAdapter["observe"]>>["money"],
        funnel: {
          steps: [],
          largestDrop: null,
          landingViews: 0,
          checkouts: 0,
          fulfillmentFailed: 0,
        } as unknown as Awaited<ReturnType<SiteAdapter["observe"]>>["funnel"],
        bottleneck: { level: 1, label: "test", detail: "test" },
        openExperimentIds: [],
        errors: [],
      } as unknown as Awaited<ReturnType<SiteAdapter["observe"]>>;
    },
    listSafeActions() {
      return [];
    },
    async execute() {
      return { ok: true, detail: "noop" };
    },
    getExperimentStore() {
      throw new Error("scheduler test never touches the store");
    },
  };
}

test("scheduler respects semaphore concurrency", async () => {
  const businesses = ["a", "b", "c", "d"].map(makeManifest);
  let inFlight = 0;
  let maxInFlight = 0;
  const controller = new AbortController();

  const scheduler = new PortfolioScheduler({
    businesses,
    createAdapter: async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 25));
      inFlight -= 1;
      return makeAdapter("noop");
    },
    createClaim: async () => new Date(Date.now() + 60_000).toISOString(),
    releaseClaim: async () => {},
    maxConcurrency: 2,
    perBusinessMinIntervalMs: 5,
    tickBudgetMs: 10,
    maxJobsPerTick: 1,
    logger: noopLogger,
    signal: controller.signal,
  });

  await scheduler.start();
  await new Promise((r) => setTimeout(r, 200));
  controller.abort();
  await scheduler.stop();

  assert.ok(maxInFlight <= 2, `concurrency exceeded semaphore: ${maxInFlight}`);
});

test("scheduler surfaces claim denial without crashing", async () => {
  const businesses = [makeManifest("solo")];
  const controller = new AbortController();
  let claimAttempts = 0;

  const scheduler = new PortfolioScheduler({
    businesses,
    createAdapter: async () => makeAdapter("solo"),
    createClaim: async () => {
      claimAttempts += 1;
      return null;
    },
    releaseClaim: async () => {},
    maxConcurrency: 1,
    perBusinessMinIntervalMs: 10,
    tickBudgetMs: 5,
    maxJobsPerTick: 1,
    logger: noopLogger,
    signal: controller.signal,
  });

  await scheduler.start();
  await new Promise((r) => setTimeout(r, 80));
  controller.abort();
  await scheduler.stop();

  assert.ok(claimAttempts > 0, "expected claim attempts");
  const status = scheduler.getStatuses()[0]!;
  assert.equal(status.lastError, "claim_denied");
});

test("scheduler stops promptly on abort", async () => {
  const businesses = [makeManifest("solo")];
  const controller = new AbortController();
  const scheduler = new PortfolioScheduler({
    businesses,
    createAdapter: async () => makeAdapter("solo"),
    createClaim: async () => new Date(Date.now() + 60_000).toISOString(),
    releaseClaim: async () => {},
    maxConcurrency: 1,
    perBusinessMinIntervalMs: 1_000,
    tickBudgetMs: 5,
    maxJobsPerTick: 1,
    logger: noopLogger,
    signal: controller.signal,
  });

  await scheduler.start();
  const start = Date.now();
  await new Promise((r) => setTimeout(r, 40));
  controller.abort();
  await scheduler.stop();
  assert.ok(Date.now() - start < 1_500, "abort did not stop within grace");
});
