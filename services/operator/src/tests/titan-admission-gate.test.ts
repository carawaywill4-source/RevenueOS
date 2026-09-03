import { test } from "node:test";
import assert from "node:assert/strict";
import type { BusinessOpportunity } from "@revenueos/core";
import {
  architectTowardPerfect,
  evaluateTitanAdmissionQuality,
  selectReplacementOpportunity,
  TITAN_ADMIT_MIN_SCORE,
  TITAN_PERFECT_SCORE,
} from "../lib/titan-admission-gate.js";

function opp(
  overrides: Partial<BusinessOpportunity> &
    Pick<BusinessOpportunity, "siteId" | "displayName">,
): BusinessOpportunity {
  return {
    id: `opp_${overrides.siteId}`,
    title: overrides.displayName,
    industry: "test_unique_industry",
    buyer: "operators who lose deals to late vague quotes",
    problem: "They lose money guessing at late, vague quotes under deadline pressure.",
    productName: "Quote Pack",
    productDescription: "A digital quote pack.",
    bullets: ["One template"],
    priceUsd: 39,
    fulfillment: "digital_download",
    brandVoice: "direct",
    primaryColor: "#111111",
    accentColor: "#222222",
    fontDisplay: "Inter",
    fontBody: "Inter",
    intentKeywords: ["construction quote template"],
    acquisitionHypothesis: "Organic search for quote templates.",
    expectedEconomics: {
      marginEstimate: 0.94,
      timeToFirstSaleDays: 30,
      supportBurden: "low",
      organicPotential: "high",
    },
    evidence: [],
    score: 0,
    rejectReasons: [],
    requiresOwnerSpend: false,
    lifecycle: "launch_candidate",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

test("an 84-style self-grade is rejected, not admitted", () => {
  const incomplete = opp({
    siteId: "halfbaked",
    displayName: "HalfBaked",
  });
  const j = evaluateTitanAdmissionQuality({
    siteId: incomplete.siteId,
    opportunity: incomplete,
    activeSiteIds: [],
    activeIndustries: [],
    titanManagedCount: 10,
  });
  assert.equal(j.decision, "REJECT_AND_REPLACE");
  assert.ok(j.businessQualityScore < TITAN_ADMIT_MIN_SCORE);
  assert.match(j.recommendedAction, /self-grade|Delete|architect/i);
});

test("Titan architects toward 100 instead of keeping the B+", () => {
  const incomplete = opp({
    siteId: "halfbaked2",
    displayName: "HalfBaked2",
  });
  const before = evaluateTitanAdmissionQuality({
    siteId: incomplete.siteId,
    opportunity: incomplete,
    activeSiteIds: [],
    activeIndustries: [],
    titanManagedCount: 10,
  });
  const perfected = architectTowardPerfect(incomplete);
  const after = evaluateTitanAdmissionQuality({
    siteId: perfected.siteId,
    opportunity: perfected,
    activeSiteIds: [],
    activeIndustries: [],
    titanManagedCount: 10,
    isReplacement: true,
  });
  assert.ok(before.businessQualityScore < TITAN_ADMIT_MIN_SCORE);
  assert.ok(after.businessQualityScore >= TITAN_ADMIT_MIN_SCORE);
  assert.ok(after.businessQualityScore <= TITAN_PERFECT_SCORE);
  assert.notEqual(after.decision, "REJECT_AND_REPLACE");
});

test("a perfected high-organic unused-industry thesis can hit 100", () => {
  const perfected = architectTowardPerfect(
    opp({
      siteId: "perfectkit",
      displayName: "PerfectKit",
      industry: "unique_perfect_nook",
      productName: "Ops Retainer System",
      productDescription:
        "Digital pack plus monthly retainer. Expansion ladder: pack → team license → monthly retainer.",
      bullets: [
        "Quote scripts buyers already search for",
        "Change-order language that protects margin",
        "Kickoff checklist clients finish",
        "Monthly retainer updates so it does not go stale",
      ],
      priceUsd: 79,
      expectedEconomics: {
        marginEstimate: 0.95,
        timeToFirstSaleDays: 7,
        supportBurden: "low",
        organicPotential: "high",
      },
    }),
  );
  const j = evaluateTitanAdmissionQuality({
    siteId: perfected.siteId,
    opportunity: perfected,
    activeSiteIds: [],
    activeIndustries: [],
    titanManagedCount: 3,
    isReplacement: true,
  });
  assert.equal(j.businessQualityScore, TITAN_PERFECT_SCORE);
  assert.ok(j.decision === "FAST_ACCEPT" || j.decision === "PROBATION");
});

test("replacement picker never returns a below-bar 84", () => {
  const replacement = selectReplacementOpportunity({
    rejectedSiteId: "halfbaked",
    activeSiteIds: [],
    activeIndustries: [],
    rejectedSiteIds: ["halfbaked"],
  });
  if (replacement) {
    assert.ok(replacement.score >= TITAN_ADMIT_MIN_SCORE);
  }
});
