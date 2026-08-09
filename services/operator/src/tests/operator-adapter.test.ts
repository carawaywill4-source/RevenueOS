/**
 * Portable operator adapter tests.
 *
 * The adapter is intentionally thin: it wraps a manifest + a Supabase
 * store + a pluggable executor. We test that the wiring produces the
 * expected BusinessContext, that observation reads the beacon window,
 * and that execute() delegates to the injected executor.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createOperatorAdapter } from "@revenueos/core";
import type {
  ExperimentStore,
  OperatorBusinessManifest,
  PursuitEvent,
  SafeAction,
} from "@revenueos/core";

const manifest: OperatorBusinessManifest = {
  siteId: "raiseready",
  displayName: "RaiseReady",
  industry: "career",
  brandVoice: "test",
  appUrl: "https://raiseready.example",
  product: {
    id: "brief",
    name: "Brief",
    priceUsd: 49,
    audience: "engineers",
  },
  businessModel: "digital_product",
  priceBand: "mid",
};

function makeStore(events: PursuitEvent[]): ExperimentStore {
  const eventsForSite = events;
  return {
    async listExperiments() {
      return [];
    },
    async getExperiment() {
      return null;
    },
    async saveExperiment() {},
    async listLessons() {
      return [];
    },
    async saveLesson() {},
    async saveScorecard() {},
    async listScorecards() {
      return [];
    },
    async saveAttribution() {},
    async listAttributions() {
      return [];
    },
    async listPursuitEvents() {
      return eventsForSite;
    },
    async appendPursuitEvent() {},
  } as unknown as ExperimentStore;
}

test("adapter builds a BusinessContext from the manifest", async () => {
  const adapter = createOperatorAdapter({
    manifest,
    store: makeStore([]),
    safeActionSource: () => [],
  });
  const ctx = await adapter.getContext();
  assert.equal(ctx.siteId, "raiseready");
  assert.equal(ctx.products[0]!.priceUsd, 49);
  assert.equal(ctx.commercial?.audience, "engineers");
  assert.equal(ctx.commercial?.businessModel, "digital_product");
  assert.ok(ctx.constraints.includes("permissionless_organic_default"));
});

test("adapter reads beacon window into observation", async () => {
  const now = new Date();
  const events: PursuitEvent[] = [
    {
      id: "e1",
      pursuitId: "beacon",
      siteId: "raiseready",
      eventType: "beacon",
      detail: { kind: "page_view", path: "/", actionClass: "verified_exposure" },
      createdAt: new Date(now.getTime() - 60_000).toISOString(),
    },
    {
      id: "e2",
      pursuitId: "beacon",
      siteId: "raiseready",
      eventType: "beacon",
      detail: { kind: "cta_click", path: "/", actionClass: "intent" },
      createdAt: new Date(now.getTime() - 30_000).toISOString(),
    },
  ];
  const adapter = createOperatorAdapter({
    manifest,
    store: makeStore(events),
    purchaseSource: async () => ({ purchases: 0, revenueUsd: 0 }),
  });
  const obs = await adapter.observe();
  assert.equal(obs.funnel.landingViews, 1);
  assert.equal(obs.funnel.checkouts, 1);
});

test("adapter delegates execute() to the injected executor", async () => {
  const seen: SafeAction[] = [];
  const adapter = createOperatorAdapter({
    manifest,
    store: makeStore([]),
    executor: async (action) => {
      seen.push(action);
      return { ok: true, detail: "delegated" };
    },
  });
  const result = await adapter.execute({
    type: "reddit_helpful_reply",
    risk: "safe",
    description: "test",
  });
  assert.equal(result.ok, true);
  assert.equal(seen.length, 1);
  assert.equal(seen[0]!.type, "reddit_helpful_reply");
});
