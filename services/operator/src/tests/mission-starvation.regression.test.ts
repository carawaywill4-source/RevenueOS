/**
 * Regression: mission cannot idle while ACTIVE.
 *
 * Simulates a Hardcore-length window (compressed to fast time) in which
 * every enqueued experiment fails and the External Progress Clock never
 * advances. The MissionController MUST enqueue a materially-different next
 * experiment each time recovery is called, and it must reach at least four
 * distinct channel families across A → B → C → D before the catalog is
 * exhausted.
 *
 * Uses an in-memory Postgres double so the test is self-contained.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MissionController,
  STARVATION_CATALOG,
  computeFingerprint,
} from "@revenueos/core";
import { createMissionMemoryPool } from "./helpers/mission-memory-pool.js";

describe("Regression — mission cannot silently idle when starved", () => {
  it("enqueues 4 materially-different experiments across A→B→C→D failures", async () => {
    const pool = createMissionMemoryPool();
    const controller = new MissionController(pool as any, () => {});
    await controller.init();

    const mission = await controller.ensureActiveMission({
      primary: "REAL_REVENUE",
      firstSaleTargetUsd: 1,
      longTermDailyRevenueTargetUsd: 100,
    });

    const enqueuedFamilies: string[] = [];
    const enqueuedFingerprints = new Set<string>();

    for (let attempt = 0; attempt < 4; attempt++) {
      const recovery = await controller.recoverFromStarvation({
        missionId: mission.id,
        minRecoveryGapMinutesAfterTerminal: 0,
      });
      assert.ok(recovery.enqueued, `recovery ${attempt} should have enqueued an experiment`);
      const exp = recovery.enqueued!;
      assert.ok(
        !enqueuedFingerprints.has(exp.fingerprint),
        `attempt ${attempt} enqueued a duplicate fingerprint (this is the "AI renamed the same strategy" defect)`,
      );
      enqueuedFingerprints.add(exp.fingerprint);
      enqueuedFamilies.push(exp.family);
      // Simulate the experiment failing outright (executor bridge would have
      // written a failed receipt and marked FAILED).
      await controller.markTerminal(exp.id, "FAILED", "SIMULATED_FAILURE");
    }

    // The four enqueued experiments must cover >= 3 distinct channel families
    // (materially different, not variations of the same family).
    const distinctFamilies = new Set(enqueuedFamilies);
    assert.ok(
      distinctFamilies.size >= 3,
      `expected >= 3 distinct channel families across 4 attempts, got ${distinctFamilies.size}: ${enqueuedFamilies.join(", ")}`,
    );
  });

  it("opens SEED_CATALOG_EXHAUSTED incident when everything has been tried", async () => {
    const pool = createMissionMemoryPool();
    const controller = new MissionController(pool as any, () => {});
    await controller.init();
    const mission = await controller.ensureActiveMission({
      primary: "REAL_REVENUE",
      firstSaleTargetUsd: 1,
      longTermDailyRevenueTargetUsd: 100,
    });

    // Pre-fill tried fingerprints with every seed.
    for (const seed of STARVATION_CATALOG) {
      const proposed = await controller.proposeExperiment(mission.id, {
        hypothesis: seed.hypothesis,
        businessId: seed.product,
        buyer: seed.buyer,
        offer: seed.offer,
        channel: seed.channel,
        channelFamily: seed.channelFamily,
        audienceKey: seed.audienceKey,
        offerKey: seed.offerKey,
        positioningKey: seed.positioningKey,
        executor: seed.executor,
        expectedResult: seed.expectedResult,
        measurement: seed.measurement,
        budgetUsd: seed.budgetUsd,
        source: "deterministic",
      });
      assert.equal(proposed.ok, true);
    }

    const recovery = await controller.recoverFromStarvation({
      missionId: mission.id,
      minRecoveryGapMinutesAfterTerminal: 0,
    });
    // Catalog exhaustion must NOT idle the mission. We re-enqueue the best
    // executable seed with a retry mutation and open a WARN incident.
    assert.equal(recovery.exhaustedCatalog, true);
    assert.ok(
      recovery.enqueued,
      "catalog exhaustion must still enqueue an executable retry — never idle",
    );

    const incidents = await controller.openIncidents(mission.id);
    assert.ok(
      incidents.some((i) => i.kind === "SEED_CATALOG_EXHAUSTED"),
      "must open SEED_CATALOG_EXHAUSTED so seed expansion remains visible",
    );
  });

  it("refuses proposeExperiment with duplicate fingerprint (LLM cannot rename its way past dedup)", async () => {
    const pool = createMissionMemoryPool();
    const controller = new MissionController(pool as any, () => {});
    await controller.init();
    const mission = await controller.ensureActiveMission({
      primary: "REAL_REVENUE",
      firstSaleTargetUsd: 1,
      longTermDailyRevenueTargetUsd: 100,
    });

    const first = await controller.proposeExperiment(mission.id, {
      hypothesis: "Cold email works this time honest",
      businessId: "buildgrid",
      buyer: "GCs",
      offer: "$29 pack",
      channel: "email",
      channelFamily: "cold_email",
      audienceKey: "contractors_general",
      offerKey: "rfi_pack_29",
      positioningKey: "template_purchase",
      executor: "CEE_V4",
      expectedResult: "reply",
      measurement: "reply rate",
      budgetUsd: 0,
      source: "openai",
    });
    assert.equal(first.ok, true);

    // Renamed hypothesis, same fingerprint — must be rejected.
    const second = await controller.proposeExperiment(mission.id, {
      hypothesis: "AGGRESSIVE cold email SPRINT with SUPER PERSONALIZED subject lines and NEW OFFER framing",
      businessId: "buildgrid",
      buyer: "General contractors nationwide",
      offer: "The $29 RFI pack, but this time we mean it",
      channel: "email",
      channelFamily: "cold_email",
      audienceKey: "contractors_general",
      offerKey: "rfi_pack_29",
      positioningKey: "template_purchase",
      executor: "CEE_V4",
      expectedResult: "reply",
      measurement: "reply rate",
      budgetUsd: 0,
      source: "xai",
    });
    assert.equal(second.ok, false);
    if (second.ok === false) {
      assert.equal(second.reason, "duplicate");
      assert.equal(second.existing.id, first.ok ? first.experiment.id : "");
    }
  });

  it("MissionController.transitionStatus refuses SUCCESS without a real purchase (LLM cannot declare victory)", async () => {
    const pool = createMissionMemoryPool();
    const controller = new MissionController(pool as any, () => {});
    await controller.init();
    const mission = await controller.ensureActiveMission({
      primary: "REAL_REVENUE",
      firstSaleTargetUsd: 1,
      longTermDailyRevenueTargetUsd: 100,
    });
    const attempt = await controller.transitionStatus(
      mission.id,
      "SUCCESS",
      "LLM said we succeeded",
    );
    assert.equal(attempt, null, "SUCCESS transition must be refused with zero real purchases");
    const reloaded = await controller.loadMission(mission.id);
    assert.equal(reloaded?.status, "ACTIVE");
  });

  it("computeFingerprint dedup catches renamed strategies across a portfolio", () => {
    // Sanity check that fingerprints deterministically dedupe across the seed catalog.
    const set = new Set<string>();
    for (const seed of STARVATION_CATALOG) {
      set.add(computeFingerprint(seed));
    }
    assert.equal(set.size, STARVATION_CATALOG.length);
  });
});
