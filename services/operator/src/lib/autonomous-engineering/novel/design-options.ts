/**
 * Generate & score architecture options from investigation evidence.
 * No predetermined winner — scores are evidence-driven (outcome first).
 */

import type { Investigation } from "./investigate.js";
import type { DesignOption } from "./types.js";

function scoreTotal(s: DesignOption["scores"]): number {
  // Outcome-weighted: leverage × execution × autonomy × time-to-signal
  // Penalize complexity, owner dep, security, cost, rollback difficulty
  const upside =
    s.commercialLeverage * 1.4 +
    s.executionProbability * 1.3 +
    s.autonomy * 1.1 +
    s.timeToSignal * 1.0 +
    s.generality * 0.6 +
    s.testability * 0.5;
  const downside =
    s.complexity * 0.9 +
    s.ownerDependency * 1.2 +
    s.securityRisk * 0.8 +
    s.operationalCost * 0.4 +
    s.rollbackDifficulty * 0.5;
  return upside - downside;
}

export function generateDistributionDesigns(
  inv: Investigation,
): DesignOption[] {
  const emailReady = inv.credentials.resendKey && inv.credentials.resendFrom;
  const phReady = inv.credentials.productHunt;
  const formsDead = inv.commercial.formFailures24h > 50;
  const zeroPub = inv.commercial.newAudiencePublished24h === 0;
  const emailIdle = emailReady && inv.commercial.emailSent24h === 0;

  const options: DesignOption[] = [];

  // A — Verified email outreach pipeline (send → accept verify → referral monitor)
  options.push({
    id: "A_verified_email_exposure_pipeline",
    title: "Verified quality-gated email exposure pipeline",
    summary:
      "Treat EMAIL_OUTREACH as a full exposure pipeline: quality gate → send → Resend delivery/accept signals → follow-up verification → referral monitor; force frontier velocity when sender ready but idle.",
    scores: {
      commercialLeverage: emailReady ? 0.85 : 0.25,
      executionProbability: emailReady ? 0.8 : 0.15,
      autonomy: 0.85,
      generality: 0.75,
      complexity: 0.35,
      operationalCost: 0.25,
      securityRisk: 0.25,
      ownerDependency: emailReady ? 0.1 : 0.9,
      testability: 0.8,
      timeToSignal: emailReady ? 0.85 : 0.2,
      rollbackDifficulty: 0.25,
    },
    totalScore: 0,
    whyViable: [
      emailReady
        ? "Resend from-domain verified in production"
        : "Blocked until from-domain exists",
      "Avoids form FAIL_NO_ACCEPTANCE class",
      "Reusable across frontier businesses",
    ],
    whyNot: [
      "Inbox exposure ≠ public artifact; weaker than published listing",
      "Inbound receiving still limited for reply learning",
    ],
    componentsTouched: [
      "new-audience.ts",
      "exposure-verify.ts",
      "capability-reality",
      "zero-traffic-war-room",
      "distribution registry",
    ],
  });

  // B — Authenticated community adapter spine (PH + verification)
  options.push({
    id: "B_authenticated_community_adapter_spine",
    title: "Authenticated community adapter + publication verification",
    summary:
      "Generalize authenticated third-party community posting: improve discoverability, verify public comment URL, register as EXECUTABLE_AUTHENTICATED capability, wire into frontier bursts.",
    scores: {
      commercialLeverage: phReady ? 0.8 : 0.3,
      executionProbability: phReady ? 0.65 : 0.2,
      autonomy: phReady ? 0.75 : 0.3,
      generality: 0.85,
      complexity: 0.55,
      operationalCost: 0.35,
      securityRisk: 0.35,
      ownerDependency: phReady ? 0.15 : 0.7,
      testability: 0.7,
      timeToSignal: phReady ? 0.7 : 0.25,
      rollbackDifficulty: 0.4,
    },
    totalScore: 0,
    whyViable: [
      phReady
        ? "PRODUCTHUNT_DEVELOPER_TOKEN live"
        : "No community token — lower priority",
      "Creates public third-party artifact when post succeeds",
      "Adapter spine reusable for future platforms",
    ],
    whyNot: [
      "Keyword mismatch currently yields no_match",
      "Platform rules/rate limits constrain volume",
    ],
    componentsTouched: [
      "producthunt-adapter.ts",
      "acquisitionos/executors",
      "ros_distribution_capabilities",
      "exposure-verify",
    ],
  });

  // C — Account autonomy prerequisite
  options.push({
    id: "C_account_autonomy_prerequisite",
    title: "Account autonomy as distribution prerequisite",
    summary:
      "If executable third-party coverage is blocked by missing accounts, engineer reusable identity/account lifecycle before more discovery.",
    scores: {
      commercialLeverage: inv.credentials.launchfree ? 0.4 : 0.7,
      executionProbability: 0.35,
      autonomy: 0.5,
      generality: 0.9,
      complexity: 0.85,
      operationalCost: 0.55,
      securityRisk: 0.75,
      ownerDependency: inv.credentials.launchfree ? 0.3 : 0.55,
      testability: 0.45,
      timeToSignal: 0.3,
      rollbackDifficulty: 0.7,
    },
    totalScore: 0,
    whyViable: [
      "Unlocks classes of HUMAN_ACTION_REQUIRED surfaces",
      "Honest representation of auth blockers",
    ],
    whyNot: [
      "HIGH complexity/security risk",
      "Slower time-to-signal vs using already-authenticated paths",
      "Platform rules may require owner identity",
    ],
    componentsTouched: [
      "credential-vault",
      "account engine",
      "platform-rules",
    ],
  });

  // D — Directory publication verifier framework (no forms)
  options.push({
    id: "D_directory_publication_verifier",
    title: "Directory/resource publication verifier framework",
    summary:
      "For non-form directories: prepare legitimate listing payloads, verify public artifact URLs, track referrals — stop counting DESTINATION_REACHABLE as exposure.",
    scores: {
      commercialLeverage: 0.7,
      executionProbability: formsDead ? 0.45 : 0.55,
      autonomy: 0.55,
      generality: 0.8,
      complexity: 0.6,
      operationalCost: 0.4,
      securityRisk: 0.3,
      ownerDependency: 0.45,
      testability: 0.65,
      timeToSignal: 0.5,
      rollbackDifficulty: 0.4,
    },
    totalScore: 0,
    whyViable: [
      "Addresses verification honesty gap",
      "Directories remain in channel graph",
    ],
    whyNot: [
      "Many directories still need accounts",
      "Slower than using live email/PH credentials",
    ],
    componentsTouched: [
      "exposure-verify.ts",
      "acquisitionos",
      "capability registry",
    ],
  });

  // Evidence adjustments (outcome first — boost idle ready paths)
  for (const o of options) {
    if (o.id === "A_verified_email_exposure_pipeline" && emailIdle && zeroPub) {
      o.scores.commercialLeverage = Math.min(1, o.scores.commercialLeverage + 0.1);
      o.scores.timeToSignal = Math.min(1, o.scores.timeToSignal + 0.1);
      o.whyViable.push(
        "EVIDENCE BOOST: sender ready but email_pitch SENT=0 while publications=0",
      );
    }
    if (
      o.id === "B_authenticated_community_adapter_spine" &&
      phReady &&
      inv.commercial.phComments24h === 0
    ) {
      o.scores.executionProbability = Math.min(
        1,
        o.scores.executionProbability + 0.08,
      );
      o.whyViable.push(
        "EVIDENCE BOOST: PH auth unused — discoverability/wiring likely fixable",
      );
    }
    if (o.id === "C_account_autonomy_prerequisite" && emailReady && phReady) {
      // Prefer using existing auth over building account system first
      o.scores.commercialLeverage *= 0.7;
      o.whyNot.push(
        "OUTCOME PENALTY: authenticated paths already exist — account framework is not the fastest exposure path",
      );
    }
    if (formsDead && o.id.startsWith("D_")) {
      o.scores.executionProbability *= 0.9;
    }
    // Penalize "easy owned publish" — not in list by design
    o.totalScore = scoreTotal(o.scores);
  }

  options.sort((a, b) => b.totalScore - a.totalScore);
  return options;
}

export function selectDesign(options: DesignOption[]): {
  selected: DesignOption;
  whyWon: string;
  whyOthersLost: string[];
} {
  const selected = options[0]!;
  const whyWon = `Highest outcome-weighted score ${selected.totalScore.toFixed(2)} — leverage=${selected.scores.commercialLeverage.toFixed(2)} exec=${selected.scores.executionProbability.toFixed(2)} autonomy=${selected.scores.autonomy.toFixed(2)} (not chosen for code ease; complexity=${selected.scores.complexity.toFixed(2)})`;
  const whyOthersLost = options.slice(1).map((o) => {
    const gaps: string[] = [];
    if (o.scores.ownerDependency > selected.scores.ownerDependency + 0.2) {
      gaps.push("higher owner dependency");
    }
    if (o.scores.executionProbability + 0.15 < selected.scores.executionProbability) {
      gaps.push("lower execution probability given current credentials");
    }
    if (o.scores.timeToSignal + 0.15 < selected.scores.timeToSignal) {
      gaps.push("slower time-to-signal");
    }
    if (o.scores.complexity > selected.scores.complexity + 0.25) {
      gaps.push("higher complexity without matching leverage");
    }
    return `${o.id} lost (${o.totalScore.toFixed(2)}): ${gaps.join("; ") || "lower composite score"}`;
  });
  return { selected, whyWon, whyOthersLost };
}
