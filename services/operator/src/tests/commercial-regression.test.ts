/**
 * Commercial regression suite — permanent guardrails from real failures.
 * Run: npx tsx --test src/tests/commercial-regression.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  runCommercialRegressionSuite,
  regressionSuitePassed,
} from "../lib/autonomous-engineering/regression-suite.js";
import {
  composeCommercialEmail,
  exampleOldStyleWeakEmail,
  scoreCommercialMessage,
} from "../lib/capability-reality/commercial-comms.js";

test("FEATURE THEATER: discovered ≫ third-party auto is recognized", () => {
  const r = runCommercialRegressionSuite({
    discoveredSurfaces: 1712,
    thirdPartyAutoExecutable: 2,
  });
  const row = r.find((x) => x.id === "feature_theater_channels");
  assert.ok(row?.ok, row?.detail);
});

test("FORM FLOOD: high failure ratio recognized", () => {
  const r = runCommercialRegressionSuite({
    formFailures: 955,
    formAttempts: 956,
  });
  assert.ok(r.find((x) => x.id === "form_flood_suppress")?.ok);
});

test("ZERO-ACTION FREEZE: stall diagnosis required", () => {
  const r = runCommercialRegressionSuite({
    meaningfulAttemptsPerHour: 0.17,
    stallDiagnosed: true,
  });
  assert.ok(r.find((x) => x.id === "zero_action_freeze")?.ok);
});

test("EMAIL QUALITY: ONE LICENSE weak email fails gate", () => {
  const weak = exampleOldStyleWeakEmail();
  const scores = scoreCommercialMessage(
    {
      who: "x",
      whyThem: "y",
      objective: "backlink_resource_placement",
      value: "z",
      offer: "use or ignore",
      cta: "feel free",
      whyNow: "research",
      businessId: "deckready",
      destinationUrl: "https://example.com",
    },
    "Resource for founders",
    weak,
  );
  assert.ok(
    scores.rejectReasons.length > 0 || scores.total < 0.68,
    `expected reject, got score=${scores.total}`,
  );
});

test("EMAIL QUALITY: structured commercial brief can pass", () => {
  const msg = composeCommercialEmail({
    who: "editor of Pitch deck templates",
    whyThem: "You curate resources for founders preparing investor meetings",
    objective: "backlink_resource_placement",
    value: "Free no-signup outline utility in under 2 minutes",
    offer: "Add our free deckready utility to your resource list if it meets your bar",
    cta: "If relevant, add this link: https://deckready.example/tools/x",
    whyNow: "Your page already serves people with this problem",
    businessId: "deckready",
    destinationUrl: "https://deckready.example/tools/x",
    contextUrl: "https://pitch.com/templates",
  });
  assert.equal(msg.approved, true, msg.scores.rejectReasons.join(","));
});

test("OWNED ≠ DISTRIBUTION + STAGE-0 polish", () => {
  const r = runCommercialRegressionSuite({
    ownedCountsAsNewAudience: false,
    stage0AllowPolish: false,
  });
  assert.ok(regressionSuitePassed(r).ok, regressionSuitePassed(r).detail);
});
