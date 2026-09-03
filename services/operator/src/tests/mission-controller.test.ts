/**
 * MissionController unit tests.
 *
 * These are pure-logic tests over the fingerprint + starvation-recovery
 * algorithm. They do NOT require a live Postgres, so they run in CI without
 * infra. A separate regression test (mission-starvation.regression.test.ts)
 * covers the full A→B→C→D loop with an in-memory experiment ledger.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  STARVATION_CATALOG,
  computeFingerprint,
  pickNextDiverseExperiment,
  seedToProposal,
  type SeedExperiment,
} from "@revenueos/core";

describe("MissionController — experiment fingerprinting", () => {
  it("computes deterministic fingerprints", () => {
    const fp = computeFingerprint({
      channelFamily: "cold_email",
      audienceKey: "contractors_general",
      offerKey: "rfi_pack_29",
      positioningKey: "template_purchase",
      product: "buildgrid",
    });
    const fp2 = computeFingerprint({
      channelFamily: "cold_email",
      audienceKey: "contractors_general",
      offerKey: "rfi_pack_29",
      positioningKey: "template_purchase",
      product: "buildgrid",
    });
    assert.equal(fp, fp2);
    assert.ok(/^[0-9a-f]{16}$/.test(fp), "fingerprint must be 16 hex chars");
  });

  it("varies fingerprint when ANY dimension changes", () => {
    const base = {
      channelFamily: "cold_email" as const,
      audienceKey: "a",
      offerKey: "b",
      positioningKey: "c",
      product: "d",
    };
    const fp = computeFingerprint(base);
    assert.notEqual(fp, computeFingerprint({ ...base, channelFamily: "github_repo" }));
    assert.notEqual(fp, computeFingerprint({ ...base, audienceKey: "different" }));
    assert.notEqual(fp, computeFingerprint({ ...base, offerKey: "different" }));
    assert.notEqual(fp, computeFingerprint({ ...base, positioningKey: "different" }));
    assert.notEqual(fp, computeFingerprint({ ...base, product: "different" }));
  });

  it("does NOT vary fingerprint on cosmetic proposal fields (dedup traps renamed strategies)", () => {
    const seed = STARVATION_CATALOG[0]!;
    const fp1 = computeFingerprint({
      channelFamily: seed.channelFamily,
      audienceKey: seed.audienceKey,
      offerKey: seed.offerKey,
      positioningKey: seed.positioningKey,
      product: seed.product,
    });
    // Same fingerprint even if hypothesis or copy differ.
    const proposalA = seedToProposal(seed);
    const proposalB = { ...proposalA, hypothesis: "totally new-sounding words", offer: "the same offer wearing a hat" };
    const fpA = computeFingerprint({
      channelFamily: proposalA.channelFamily,
      audienceKey: proposalA.audienceKey,
      offerKey: proposalA.offerKey,
      positioningKey: proposalA.positioningKey,
      product: proposalA.businessId,
    });
    const fpB = computeFingerprint({
      channelFamily: proposalB.channelFamily,
      audienceKey: proposalB.audienceKey,
      offerKey: proposalB.offerKey,
      positioningKey: proposalB.positioningKey,
      product: proposalB.businessId,
    });
    assert.equal(fp1, fpA);
    assert.equal(fpA, fpB);
  });
});

describe("MissionController — starvation seed catalog", () => {
  it("has ≥ 4 distinct channel families", () => {
    const families = new Set(STARVATION_CATALOG.map((s) => s.channelFamily));
    assert.ok(
      families.size >= 4,
      `expected at least 4 channel families, got ${families.size}: ${[...families].join(", ")}`,
    );
  });

  it("has ≥ 2 distinct products (so mission can pivot business)", () => {
    const products = new Set(STARVATION_CATALOG.map((s) => s.product));
    assert.ok(
      products.size >= 2,
      `expected at least 2 products, got ${products.size}: ${[...products].join(", ")}`,
    );
  });

  it("all seeds have unique fingerprints", () => {
    const seen = new Set<string>();
    for (const seed of STARVATION_CATALOG) {
      const fp = computeFingerprint(seed);
      assert.ok(!seen.has(fp), `duplicate fingerprint in catalog: ${fp} (${seed.channelFamily}/${seed.product})`);
      seen.add(fp);
    }
  });

  it("no seed involves paid advertising (owner constraint)", () => {
    for (const seed of STARVATION_CATALOG) {
      assert.equal(seed.budgetUsd, 0, `seed ${seed.channelFamily}/${seed.product} has non-zero budget`);
    }
  });
});

describe("MissionController — pickNextDiverseExperiment", () => {
  it("prefers untried over tried, varying at least channel family from most recent", () => {
    const [first] = STARVATION_CATALOG;
    const firstFp = computeFingerprint(first!);
    const { fingerprint, exhaustedCatalog, seed } = pickNextDiverseExperiment({
      triedFingerprints: [firstFp],
      mostRecent: {
        fingerprint: firstFp,
        input: {
          channelFamily: first!.channelFamily,
          audienceKey: first!.audienceKey,
          offerKey: first!.offerKey,
          positioningKey: first!.positioningKey,
          product: first!.product,
        },
      },
    });
    assert.notEqual(fingerprint, firstFp);
    assert.equal(exhaustedCatalog, false);
    // Highest-weight dimension change is channelFamily — the picker MUST
    // change it (materially different, not a variation of the same family).
    assert.notEqual(seed.channelFamily, first!.channelFamily);
  });

  it("prefers highest-distance experiment when multiple untried", () => {
    const seeds = STARVATION_CATALOG;
    const cold = seeds.find((s) => s.channelFamily === "cold_email")!;
    const cold_fp = computeFingerprint(cold);
    // With most-recent = cold_email, the picker should prefer github_repo
    // or seo_answer (channel family change carries most weight).
    const { seed } = pickNextDiverseExperiment({
      triedFingerprints: [cold_fp],
      mostRecent: {
        fingerprint: cold_fp,
        input: {
          channelFamily: cold.channelFamily,
          audienceKey: cold.audienceKey,
          offerKey: cold.offerKey,
          positioningKey: cold.positioningKey,
          product: cold.product,
        },
      },
    });
    assert.notEqual(seed.channelFamily, "cold_email");
  });

  it("marks exhaustedCatalog when everything has been tried", () => {
    const allFps = STARVATION_CATALOG.map((s) => computeFingerprint(s));
    const { exhaustedCatalog } = pickNextDiverseExperiment({
      triedFingerprints: allFps,
    });
    assert.equal(exhaustedCatalog, true);
  });

  it("honors preferredExecutors filter without breaking on empty", () => {
    const { seed } = pickNextDiverseExperiment({
      triedFingerprints: [],
      preferredExecutors: ["HARDCORE"],
    });
    assert.equal(seed.executor, "HARDCORE");
  });

  it("falls back to full catalog when preferredExecutors filter is too tight", () => {
    const { seed } = pickNextDiverseExperiment({
      triedFingerprints: [],
      preferredExecutors: ["TITAN_EXECUTIVE"], // no seeds tagged for TITAN_EXECUTIVE
    });
    // Must still return something — never let the mission idle for an executor mismatch.
    assert.ok(seed);
  });
});
