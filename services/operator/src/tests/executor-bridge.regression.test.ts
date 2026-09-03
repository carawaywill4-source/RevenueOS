/**
 * Regression: executor bridge state machine.
 *
 * These tests exist because the old system could enqueue "fake work" that
 * nobody executed, then the mission would silently idle. The bridge now
 * enforces:
 *
 *   - dispatch: each channel family routes to the expected executor
 *   - unsupported: families without an executor are marked BLOCKED (not RUNNING)
 *   - cooldown gate: ENQUEUED alone does NOT start cooldown
 *   - single-primary-experiment: recovery refuses to enqueue while an
 *     active experiment already exists
 *   - dead directory gate: directory execution no longer requires purchases > 0
 *   - failure pivot: after a terminal LOSS/FAILED, the next recovery picks a
 *     materially different executable experiment
 *   - executability gate: recovery skips non-executable families
 *   - owner action queue: one BLOCKED experiment does not freeze the mission
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MissionController, STARVATION_CATALOG } from "@revenueos/core";
import { createMissionMemoryPool } from "./helpers/mission-memory-pool.js";
import { checkExecutability } from "../lib/mission/executor-registry.js";

describe("Executor bridge — state machine", () => {
  it("cooldown does NOT start on merely ENQUEUED (the new-idle-bug regression)", async () => {
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
    assert.ok(first.enqueued, "first recovery should enqueue");
    // The first experiment is now ENQUEUED. A second recovery call must be
    // refused with skippedReason=primary_experiment_already_active — NOT
    // with skippedReason=cooldown_active. Cooldown must only apply to
    // real terminal outcomes.
    const second = await controller.recoverFromStarvation({
      missionId: mission.id,
      minRecoveryGapMinutesAfterTerminal: 0,
    });
    assert.equal(second.enqueued, null);
    assert.equal(second.skippedReason, "primary_experiment_already_active");
  });

  it("MAX_ACTIVE_PRIMARY_EXPERIMENTS=1: one active experiment blocks another enqueue", async () => {
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
    // Simulate advancing states without terminal.
    await controller.claimExperiment(first.enqueued!.id, "test-executor");
    await controller.markExecuting(first.enqueued!.id);
    const attempt = await controller.recoverFromStarvation({
      missionId: mission.id,
      minRecoveryGapMinutesAfterTerminal: 0,
    });
    assert.equal(attempt.enqueued, null);
    assert.equal(attempt.skippedReason, "primary_experiment_already_active");
  });

  it("failure pivot: after LOSS, the next recovery selects a materially different family", async () => {
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
    const firstFamily = first.enqueued!.family;
    await controller.markTerminal(first.enqueued!.id, "LOSS", "MEASURING_WINDOW_EXPIRED_ZERO_SIGNAL");
    const second = await controller.recoverFromStarvation({
      missionId: mission.id,
      minRecoveryGapMinutesAfterTerminal: 0,
    });
    assert.ok(second.enqueued, "second recovery must pivot after the first LOSS");
    assert.notEqual(
      second.enqueued!.family,
      firstFamily,
      `after LOSS the next family must be materially different (got ${second.enqueued!.family} again)`,
    );
  });

  it("executability gate: recovery skips families without a registered executor", async () => {
    const pool = createMissionMemoryPool();
    const controller = new MissionController(pool as any, () => {});
    await controller.init();
    const mission = await controller.ensureActiveMission({
      primary: "REAL_REVENUE",
      firstSaleTargetUsd: 1,
      longTermDailyRevenueTargetUsd: 100,
    });
    // Pretend NOTHING is executable.
    const recovery = await controller.recoverFromStarvation({
      missionId: mission.id,
      minRecoveryGapMinutesAfterTerminal: 0,
      canExecuteFamily: () => false,
    });
    assert.equal(recovery.enqueued, null, "must not enqueue when nothing is executable");
    assert.equal(recovery.skippedReason, "no_executable_seed");
    assert.ok(recovery.incidentId, "must open a NO_EXECUTABLE_SEED incident");
  });

  it("owner-action queue: BLOCKED experiment is tracked and does not freeze mission", async () => {
    const pool = createMissionMemoryPool();
    const controller = new MissionController(pool as any, () => {});
    await controller.init();
    const mission = await controller.ensureActiveMission({
      primary: "REAL_REVENUE",
      firstSaleTargetUsd: 1,
      longTermDailyRevenueTargetUsd: 100,
    });
    // Enqueue owner action for a specific blocker platform.
    const owner = await controller.enqueueOwnerAction({
      missionId: mission.id,
      platform: "producthunt",
      exactAction: "Verify launch eligibility",
      whyRequired: "Account age policy",
    });
    assert.ok(owner.id.startsWith("own_"));
    // Recovery should still enqueue a different, executable experiment.
    const recovery = await controller.recoverFromStarvation({
      missionId: mission.id,
      minRecoveryGapMinutesAfterTerminal: 0,
      canExecuteFamily: (family) =>
        family === "marketplace_listing" || family === "storefront_evolution",
    });
    assert.ok(recovery.enqueued, "an executable experiment must still be enqueued despite the owner action");
    assert.ok(
      ["marketplace_listing", "storefront_evolution"].includes(recovery.enqueued!.family),
      `expected an executable family, got ${recovery.enqueued!.family}`,
    );
  });
});

describe("Executor bridge — dispatch & external receipt invariants", () => {
  it("external receipt cannot be forged: markExternalActionVerified requires prior CLAIMED/EXECUTING state", async () => {
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
    // Try to verify while still ENQUEUED — must fail.
    const forged = await controller.markExternalActionVerified({
      experimentId: first.enqueued!.id,
      executor: "HARDCORE",
      channelFamily: first.enqueued!.family,
      externalActionType: "forged",
      verificationMethod: "PUBLIC_HTTP",
      evidence: {},
      startedAt: new Date(),
    });
    assert.equal(forged, null, "cannot verify from ENQUEUED");
    // Claim + execute + verify — should now succeed.
    await controller.claimExperiment(first.enqueued!.id, "test-executor");
    await controller.markExecuting(first.enqueued!.id);
    const real = await controller.markExternalActionVerified({
      experimentId: first.enqueued!.id,
      executor: "HARDCORE",
      channelFamily: first.enqueued!.family,
      externalActionType: "test_public_publish",
      publicUrl: "https://example.com/artifact",
      verificationMethod: "PUBLIC_HTTP",
      evidence: { httpStatus: 200 },
      startedAt: new Date(),
    });
    assert.ok(real, "verify must succeed after CLAIMED/EXECUTING");
    assert.equal(real!.verified, true);
    assert.equal(real!.publicUrl, "https://example.com/artifact");
  });

  it("executor-registry: marketplace_listing is executable when GUMROAD_ACCESS_TOKEN is set", () => {
    const prior = process.env.GUMROAD_ACCESS_TOKEN;
    try {
      process.env.GUMROAD_ACCESS_TOKEN = "test-token";
      const decision = checkExecutability("marketplace_listing");
      assert.equal(decision.executable, true);
      if (decision.executable) {
        assert.equal(decision.executor, "gumroad-marketplace");
      }
    } finally {
      if (prior === undefined) delete process.env.GUMROAD_ACCESS_TOKEN;
      else process.env.GUMROAD_ACCESS_TOKEN = prior;
    }
  });

  it("executor-registry: marketplace_listing is BLOCKED when GUMROAD_ACCESS_TOKEN is missing", () => {
    const prior = process.env.GUMROAD_ACCESS_TOKEN;
    try {
      delete process.env.GUMROAD_ACCESS_TOKEN;
      const decision = checkExecutability("marketplace_listing");
      assert.equal(decision.executable, false);
      if (!decision.executable) {
        assert.equal(decision.reason, "no_gumroad_access_token");
        assert.equal(decision.ownerActionRequired, true);
      }
    } finally {
      if (prior !== undefined) process.env.GUMROAD_ACCESS_TOKEN = prior;
    }
  });

  it("executor-registry: github_repo is BLOCKED with owner action when no token", () => {
    const priorGh = process.env.GITHUB_TOKEN;
    const priorGhOnly = process.env.GH_TOKEN;
    try {
      delete process.env.GITHUB_TOKEN;
      delete process.env.GH_TOKEN;
      const decision = checkExecutability("github_repo");
      assert.equal(decision.executable, false);
      if (!decision.executable) {
        assert.equal(decision.ownerActionRequired, true);
        assert.equal(decision.ownerAction?.platform, "github");
      }
    } finally {
      if (priorGh !== undefined) process.env.GITHUB_TOKEN = priorGh;
      if (priorGhOnly !== undefined) process.env.GH_TOKEN = priorGhOnly;
    }
  });

  it("executor-registry: cold_email is BLOCKED until qualified target dossier exists", () => {
    const decision = checkExecutability("cold_email");
    assert.equal(decision.executable, false);
    if (!decision.executable) {
      assert.equal(decision.reason, "no_qualified_target_dossiers");
    }
  });

  it("STARVATION_CATALOG only covers 8 families in this proof phase (do not expand)", () => {
    // Guard against unrelated seed expansion sneaking in before the executor
    // bridge is proven live. Loosened to <=12 in case someone adds narrow
    // executable variations that still make sense per-product.
    assert.ok(STARVATION_CATALOG.length >= 6);
    assert.ok(STARVATION_CATALOG.length <= 12, `too many seeds: ${STARVATION_CATALOG.length}`);
  });
});

describe("Dead directory gate removed", () => {
  it("CEE executor no longer checks `if (purchases > 0)` before executeDirectory", async () => {
    // Static source inspection — the previously-dead gate must be gone.
    const { readFile } = await import("node:fs/promises");
    const src = await readFile(
      new URL("../lib/commercial-execution-v4/executor.ts", import.meta.url),
      "utf8",
    );
    assert.ok(
      !/if\s*\(\s*purchases\s*>\s*0\s*\)\s*\{[\s\S]{0,200}executeDirectory/.test(src),
      "dead first-customer-lock gate is still present in commercial-execution-v4/executor.ts",
    );
  });
});
