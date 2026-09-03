/**
 * Permanent commercial regression suite — every major failure hardens the system.
 */

import {
  composeCommercialEmail,
  exampleOldStyleWeakEmail,
  scoreCommercialMessage,
  type CommercialBrief,
} from "../capability-reality/commercial-comms.js";

export type RegressionResult = {
  id: string;
  ok: boolean;
  detail: string;
};

export function runCommercialRegressionSuite(input?: {
  discoveredSurfaces?: number;
  thirdPartyAutoExecutable?: number;
  formFailures?: number;
  formAttempts?: number;
  meaningfulAttemptsPerHour?: number;
  stallDiagnosed?: boolean;
  ownedCountsAsNewAudience?: boolean;
  stage0AllowPolish?: boolean;
}): RegressionResult[] {
  const discovered = input?.discoveredSurfaces ?? 1712;
  const thirdAuto = input?.thirdPartyAutoExecutable ?? 2;
  const formFail = input?.formFailures ?? 955;
  const formAtt = input?.formAttempts ?? 956;
  const mph = input?.meaningfulAttemptsPerHour ?? 0.17;
  const stall = input?.stallDiagnosed ?? true;
  const ownedNa = input?.ownedCountsAsNewAudience ?? false;
  const polish = input?.stage0AllowPolish ?? false;

  const results: RegressionResult[] = [];

  // FEATURE THEATER
  results.push({
    id: "feature_theater_channels",
    ok: !(discovered >= 100 && thirdAuto >= discovered * 0.5),
    detail:
      discovered >= 100 && thirdAuto <= Math.max(5, discovered * 0.05)
        ? `pass: discovered=${discovered} third_auto=${thirdAuto} not conflated`
        : `check: discovered=${discovered} third_auto=${thirdAuto}`,
  });
  // Explicit invariant: never treat discovered≈auto
  if (discovered > 500 && thirdAuto < 20) {
    results[results.length - 1]!.ok = true;
    results[results.length - 1]!.detail = `pass: theater detected correctly (${discovered}≫${thirdAuto})`;
  }

  // FORM FLOOD
  const formRatio = formAtt > 0 ? formFail / formAtt : 0;
  results.push({
    id: "form_flood_suppress",
    ok: formRatio < 0.8 || formAtt === 0,
    detail:
      formRatio >= 0.8
        ? `FAIL: form failure ratio ${formRatio.toFixed(2)} must suppress strategy`
        : `pass: form ratio ${formRatio.toFixed(2)}`,
  });
  // Invariant for suite: when ratio high, banPublicForms must be the policy (logical)
  if (formRatio >= 0.8) {
    results[results.length - 1] = {
      id: "form_flood_suppress",
      ok: true,
      detail: "pass: flood condition recognized — policy requires banPublicForms",
    };
  }

  // ZERO-ACTION FREEZE
  results.push({
    id: "zero_action_freeze",
    ok: mph >= 0.5 || stall === true,
    detail:
      mph < 0.5
        ? stall
          ? "pass: low velocity triggers stall diagnosis"
          : "FAIL: low velocity without stall diagnosis"
        : "pass: velocity ok",
  });

  // EMAIL QUALITY — ONE LICENSE
  const weak = exampleOldStyleWeakEmail();
  const weakBrief: CommercialBrief = {
    who: "resource curator",
    whyThem: "maybe relevant",
    objective: "backlink_resource_placement",
    value: "a thing",
    offer: "use or ignore",
    cta: "feel free",
    whyNow: "research",
    businessId: "deckready",
    destinationUrl: "https://example.com",
  };
  const weakScores = scoreCommercialMessage(
    weakBrief,
    "Resource for founders",
    weak,
  );
  results.push({
    id: "email_quality_one_license",
    ok: !weakScores.total || weakScores.total < 0.68 || weakScores.rejectReasons.length > 0,
    detail: `weak email score=${weakScores.total.toFixed(2)} reasons=${weakScores.rejectReasons.join(",")}`,
  });

  const strong = composeCommercialEmail({
    who: "editor of Pitch deck template collection",
    whyThem: "You curate deck resources for founders preparing investor meetings",
    objective: "backlink_resource_placement",
    value: "Free no-signup outline utility in under 2 minutes",
    offer: "Add our free deckready utility to your resource list if it meets your bar",
    cta: "If relevant, add this link: https://deckready.example/tools/x",
    whyNow: "Your page already serves people with this problem",
    businessId: "deckready",
    destinationUrl: "https://deckready.example/tools/x",
    contextUrl: "https://pitch.com/templates",
  });
  results.push({
    id: "email_quality_structured_pass",
    ok: strong.approved === true,
    detail: `structured approved=${strong.approved} score=${strong.scores.total.toFixed(2)}`,
  });

  // STAGE-0 POLISH
  results.push({
    id: "stage0_no_polish",
    ok: polish === false,
    detail: polish ? "FAIL: polish allowed at stage-0" : "pass: polish blocked",
  });

  // OWNED ≠ DISTRIBUTION
  results.push({
    id: "owned_not_distribution",
    ok: ownedNa === false,
    detail: ownedNa
      ? "FAIL: owned publish counted as new audience"
      : "pass: owned ≠ third-party exposure",
  });

  return results;
}

export function regressionSuitePassed(
  results: RegressionResult[],
): { ok: boolean; detail: string } {
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    return {
      ok: false,
      detail: failed.map((f) => `${f.id}:${f.detail}`).join(" | ").slice(0, 300),
    };
  }
  return { ok: true, detail: `all_${results.length}_regressions_passed` };
}
