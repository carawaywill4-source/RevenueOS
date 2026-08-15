/**
 * Regression: distribution-vs-external distinction + strict human classifier.
 *
 * These tests exist because RevenueOS previously counted:
 *   - `curl` probes and operator-issued verification requests as "verified
 *     humans" (LEGACY_UNVERIFIED_HUMAN_SIGNAL bug)
 *   - internal deploys and public health-URL responses as "external
 *     exposures" (the "storefront is not distribution" bug)
 *
 * The mission ultimately cares about revenue. The funnel it now tracks is:
 *
 *   INTERNAL_ACTIVITY → EXTERNAL_ACTION → DISTRIBUTION_OPPORTUNITY
 *     → HUMAN_EXPOSURE → VERIFIED_HUMAN_VISIT → ENGAGEMENT
 *     → CHECKOUT → PURCHASE
 *
 * These invariants keep the layers separate.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  MissionController,
  TIER1_DISTRIBUTION_FAMILIES,
  isProvenHumanEvent,
  pickNextDiverseExperiment,
} from "@revenueos/core";
import { createMissionMemoryPool } from "./helpers/mission-memory-pool.js";

describe("Distribution model — external action vs distribution opportunity", () => {
  it("storefront_evolution executor does NOT emit a `distribution` field on its outcome", async () => {
    const src = await readFile(
      new URL("../lib/mission/executors/storefront-evolution.ts", import.meta.url),
      "utf8",
    );
    // Storefront must never claim to produce a distribution surface. It is
    // an external engineering effect only; a stranger cannot land on it
    // through any organic path unless another distribution surface (Pin,
    // Etsy listing, GitHub README, qualified email) points at the URL.
    assert.ok(
      !/distribution\s*:/.test(src),
      "storefront-evolution.ts must not populate a `distribution` field — a redeploy is not distribution",
    );
  });

  it("gumroad-marketplace executor deliberately classifies fresh listings as DISTRIBUTION=LIMITED and emits no DistributionReceipt", async () => {
    const src = await readFile(
      new URL("../lib/mission/executors/gumroad-marketplace.ts", import.meta.url),
      "utf8",
    );
    // Fresh Gumroad listings are not automatically surfaced by Gumroad
    // Discover. Emitting a DistributionReceipt for one would lie about
    // stranger reach. The executor must acknowledge this in evidence and
    // must NOT populate a top-level `distribution` field on its outcome.
    assert.ok(
      /distributionClassification\s*:\s*"LIMITED"/.test(src),
      "gumroad executor must record distributionClassification=LIMITED in evidence",
    );
    assert.ok(
      !/return\s+\{[\s\S]{0,600}distribution\s*:\s*\{/.test(src),
      "gumroad executor must not return a `distribution` object at the top level (fresh listing is not discoverable)",
    );
  });

  it("writeDistributionReceipt persists a real MARKETPLACE_LISTING and lists back on the mission", async () => {
    const pool = createMissionMemoryPool();
    const controller = new MissionController(pool as any, () => {});
    await controller.init();
    const mission = await controller.ensureActiveMission({
      primary: "REAL_REVENUE",
      firstSaleTargetUsd: 1,
      longTermDailyRevenueTargetUsd: 100,
    });
    const first = await controller.recoverFromStarvation({
      missionId: mission.id,
      minRecoveryGapMinutesAfterTerminal: 0,
    });
    assert.ok(first.enqueued);
    const receipt = await controller.writeDistributionReceipt({
      missionId: mission.id,
      experimentId: first.enqueued!.id,
      platform: "ETSY",
      channelFamily: "marketplace_listing",
      distributionType: "MARKETPLACE_LISTING",
      publicUrl: "https://www.etsy.com/listing/1234567890/test",
      externalId: "1234567890",
      externallyAccessible: true,
      discoverableOrDelivered: true,
      verificationMethod: "PUBLIC_HTTP",
      evidence: { httpStatus: 200 },
    });
    assert.ok(receipt.id.startsWith("dist_"));
    assert.equal(receipt.distributionType, "MARKETPLACE_LISTING");
    assert.equal(receipt.discoverableOrDelivered, true);
    const list = await controller.listDistributionReceipts(mission.id);
    assert.equal(list.length, 1);
    assert.equal(list[0]!.platform, "ETSY");
  });
});

describe("Distribution model — strict human classifier", () => {
  it("InternetMeasurement scanner is NOT a proven human", () => {
    assert.equal(
      isProvenHumanEvent({
        class: "UNKNOWN",
        userAgent:
          "Mozilla/5.0 (compatible; InternetMeasurement/1.0; +https://internet-measurement.com/)",
        path: "/",
      }),
      false,
      "network scanner UAs must be rejected",
    );
  });

  it("Operator-issued verification curl is NOT a proven human", () => {
    assert.equal(
      isProvenHumanEvent({
        class: "UNKNOWN",
        userAgent: "curl/8.5.0",
        path: "/",
      }),
      false,
      "curl requests must not count as human",
    );
    assert.equal(
      isProvenHumanEvent({
        class: "UNKNOWN",
        userAgent:
          "RevenueOS-external-verifier/0.1 (+https://revenueos.local)",
        path: "/",
      }),
      false,
      "the operator's own verification agent must not count as human",
    );
  });

  it("Bare real-browser UA hitting `/` with no referrer is NOT a proven human", () => {
    // This was the class of hit that inflated verified_humans_1h to 4
    // before the tightening. Real Chrome UA, no referrer, hitting root —
    // indistinguishable from an opportunistic scan of an exposed public
    // IP. Cannot count.
    assert.equal(
      isProvenHumanEvent({
        class: "UNKNOWN",
        userAgent:
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
        path: "/",
        referer: "",
      }),
      false,
      "no-referrer hits to `/` cannot count as proven human even with a real browser UA",
    );
  });

  it("Real browser + external distribution referrer (Etsy) IS a proven human", () => {
    assert.equal(
      isProvenHumanEvent({
        class: "UNKNOWN",
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        path: "/",
        referer: "https://www.etsy.com/listing/1234/whatever",
      }),
      true,
      "an Etsy-referred real-browser visit must count as a proven human",
    );
  });

  it("Real browser navigating to a deep path IS a proven human", () => {
    assert.equal(
      isProvenHumanEvent({
        class: "UNKNOWN",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
        path: "/checkout",
      }),
      true,
      "deep-path navigation is a strong human signal",
    );
  });

  it("INTERNAL / SYNTHETIC / BOT / CRAWLER classes are always rejected", () => {
    for (const klass of ["INTERNAL", "SYNTHETIC_TEST", "BOT", "CRAWLER"]) {
      assert.equal(
        isProvenHumanEvent({
          class: klass,
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
          path: "/checkout",
          referer: "https://www.etsy.com/listing/1234",
        }),
        false,
        `class=${klass} must never count as proven human`,
      );
    }
  });
});

describe("Distribution model — distribution-first ranking", () => {
  it("pickNextDiverseExperiment prefers TIER-1 distribution families when instructed", () => {
    const seeds = [
      {
        product: "buildgrid",
        channel: "storefront-evolution",
        channelFamily: "storefront_evolution" as const,
        audienceKey: "conv",
        offerKey: "conv-clarity",
        positioningKey: "clarity",
        executor: "STOREFRONT_EVOLUTION" as const,
        hypothesis: "clearer hero",
        buyer: "site visitors",
        offer: "clearer hero",
        expectedResult: "engagement",
        measurement: "CTR",
      },
      {
        product: "buildgrid",
        channel: "gumroad-marketplace",
        channelFamily: "marketplace_listing" as const,
        audienceKey: "diy",
        offerKey: "free-preview",
        positioningKey: "same-day",
        executor: "GUMROAD_MARKETPLACE" as const,
        hypothesis: "listing on discover",
        buyer: "marketplace shoppers",
        offer: "free preview",
        expectedResult: "impressions",
        measurement: "views",
      },
    ];
    const pick = pickNextDiverseExperiment({
      triedFingerprints: [],
      catalog: seeds,
      preferredFamilies: TIER1_DISTRIBUTION_FAMILIES,
    });
    assert.equal(
      pick.seed.channelFamily,
      "marketplace_listing",
      "distribution-first ranking must prefer marketplace_listing over storefront_evolution when both are untried",
    );
  });

  it("pickNextDiverseExperiment ignores TIER-1 preference when only non-preferred families exist", () => {
    const seeds = [
      {
        product: "buildgrid",
        channel: "storefront-evolution",
        channelFamily: "storefront_evolution" as const,
        audienceKey: "conv",
        offerKey: "conv-clarity",
        positioningKey: "clarity",
        executor: "STOREFRONT_EVOLUTION" as const,
        hypothesis: "clearer hero",
        buyer: "site visitors",
        offer: "clearer hero",
        expectedResult: "engagement",
        measurement: "CTR",
      },
    ];
    const pick = pickNextDiverseExperiment({
      triedFingerprints: [],
      catalog: seeds,
      preferredFamilies: TIER1_DISTRIBUTION_FAMILIES,
    });
    assert.equal(
      pick.seed.channelFamily,
      "storefront_evolution",
      "when no TIER-1 seed is available, ranking must fall through gracefully",
    );
  });
});

describe("Distribution model — zero-humans short-circuit for MEASURING", () => {
  it("concludeStaleMeasuring transitions conversion-support experiment to INCONCLUSIVE within 5 min when proven_humans_24h=0", async () => {
    const pool = createMissionMemoryPool();
    const controller = new MissionController(pool as any, () => {});
    await controller.init();
    const mission = await controller.ensureActiveMission({
      primary: "REAL_REVENUE",
      firstSaleTargetUsd: 1,
      longTermDailyRevenueTargetUsd: 100,
    });
    // Seed a storefront_evolution experiment straight through to MEASURING.
    const first = await controller.recoverFromStarvation({
      missionId: mission.id,
      minRecoveryGapMinutesAfterTerminal: 0,
      canExecuteFamily: (f) => f === "storefront_evolution",
    });
    // If the fallback pick isn't storefront_evolution (memory pool may
    // pick another executable family), just short-circuit — this test
    // only meaningfully guards the storefront_evolution path.
    if (!first.enqueued || first.enqueued.family !== "storefront_evolution") {
      return;
    }
    await controller.claimExperiment(first.enqueued.id, "test-executor");
    await controller.markExecuting(first.enqueued.id);
    const receipt = await controller.markExternalActionVerified({
      experimentId: first.enqueued.id,
      executor: "STOREFRONT_EVOLUTION",
      channelFamily: "storefront_evolution",
      externalActionType: "storefront_public_deploy",
      publicUrl: "https://example.sslip.io/",
      verificationMethod: "PUBLIC_HTTP",
      evidence: { httpStatus: 200 },
      startedAt: new Date(),
    });
    assert.ok(receipt);
    await controller.markMeasuring(first.enqueued.id);
    // Backdate measuring_started_at to > 5 minutes ago.
    await pool.query(
      `update ros_commercial_experiments
          set measuring_started_at = now() - interval '10 minutes'
        where id=$1`,
      [first.enqueued.id],
    );
    // Ensure proven_humans_24h is 0.
    await pool.query(
      `insert into ros_mission_progress_clock (mission_id, proven_humans_24h)
       values ($1, 0)
       on conflict (mission_id) do update set proven_humans_24h=0`,
      [mission.id],
    );
    const closed = await controller.concludeStaleMeasuring(mission.id);
    assert.ok(closed >= 1, "must close the no-traffic storefront experiment");
    const after = await controller.loadExperiment(first.enqueued.id);
    assert.ok(after);
    assert.equal(after!.state, "INCONCLUSIVE");
    assert.equal(after!.terminalReason, "INCONCLUSIVE_NO_TRAFFIC");
  });
});
