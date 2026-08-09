/**
 * runOperatorLoop tests. The loop is a wrapper around runPursuitTick,
 * so this test injects a fake adapter and verifies loop behavior only
 * (once=true, abort propagation, tick counting).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { runOperatorLoop } from "@revenueos/core";
import type { SiteAdapter } from "@revenueos/core";

function fakeAdapter(siteId: string): SiteAdapter {
  return {
    id: siteId,
    async getContext() {
      return {
        siteId,
        displayName: siteId,
        industry: "test",
        products: [
          {
            id: `${siteId}-p`,
            name: "product",
            priceUsd: 10,
            marginEstimate: 0.9,
          },
        ],
        funnelSteps: ["landing_view", "checkout_started", "purchase_completed"],
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
        },
        funnel: {
          steps: [
            { step: "landing_view", count: 0, dropFromPrevious: null, dropRate: null },
            { step: "checkout_started", count: 0, dropFromPrevious: 0, dropRate: null },
            { step: "purchase_completed", count: 0, dropFromPrevious: 0, dropRate: null },
          ],
          largestDrop: null,
          landingViews: 0,
          checkouts: 0,
          fulfillmentFailed: 0,
        },
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
      // Minimal in-memory store — the pursuit engine will use these methods.
      const empty: unknown[] = [];
      const arr = () => empty as never[];
      return {
        async listExperiments() {
          return arr();
        },
        async getExperiment() {
          return null;
        },
        async saveExperiment() {},
        async listLessons() {
          return arr();
        },
        async saveLesson() {},
        async saveScorecard() {},
        async listScorecards() {
          return arr();
        },
        async saveAttribution() {},
        async listAttributions() {
          return arr();
        },
        async listPursuits() {
          return arr();
        },
        async savePursuit() {},
        async claimPursuits() {
          return arr();
        },
        async appendPursuitEvent() {},
        async listPursuitEvents() {
          return arr();
        },
      } as unknown as ReturnType<SiteAdapter["getExperimentStore"]>;
    },
  };
}

test("runOperatorLoop with once=true executes exactly one tick", async () => {
  let ticks = 0;
  const results = await runOperatorLoop({
    businessId: "raiseready",
    once: true,
    createAdapter: () => fakeAdapter("raiseready"),
    logger: () => {},
    onTick: () => {
      ticks += 1;
    },
    tickBudgetMs: 1_000,
    maxJobsPerTick: 2,
  });
  assert.equal(ticks, 1);
  assert.equal(results.length, 1);
  assert.equal(results[0]!.businessId, "raiseready");
});

test("runOperatorLoop honors AbortSignal", async () => {
  const controller = new AbortController();
  const done = runOperatorLoop({
    businessId: "raiseready",
    createAdapter: () => fakeAdapter("raiseready"),
    logger: () => {},
    tickBudgetMs: 100,
    busySleepMs: 50,
    idleSleepMs: 50,
    maxJobsPerTick: 1,
    signal: controller.signal,
  });
  setTimeout(() => controller.abort(), 60);
  const results = await done;
  assert.ok(results.length >= 1);
});
