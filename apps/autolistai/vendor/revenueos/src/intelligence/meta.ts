import type {
  CalibrationModel,
  HourPulse,
  MetaPolicy,
  RegimeReport,
  ShortfallReport,
} from "../types";
import { isZeroHour } from "./hour";

/**
 * Meta-learner: the policy over policies. Because a $10k day is improbable for
 * most early businesses, the brain must keep learning — exploration stays high
 * while the shortfall is large, calibration is poor, or the regime says the
 * current playbook is stuck. Pure exploitation is only earned near the north star.
 */

export function buildMetaPolicy(input: {
  shortfall: ShortfallReport;
  calibration: CalibrationModel;
  regime: RegimeReport;
  baseLambda?: number;
  hourPulse?: HourPulse;
}): MetaPolicy {
  const base = input.baseLambda ?? 0.5;
  const gapRatio = input.shortfall.pctOfNorthStar; // 0 = nowhere, 1 = hit
  const distance = 1 - gapRatio; // how far from north star

  // Far from $10k → learn hard. Near → allow more exploit.
  let explorationLambda = base + distance * 1.2;
  let exploitBias = 0.25 + gapRatio * 0.55;

  const brier = input.calibration.overall.samples
    ? input.calibration.overall.brier
    : 0.25;
  // Miscalibrated predictions → trust EV less, explore more.
  if (brier > 0.2) {
    explorationLambda += 0.35;
    exploitBias -= 0.1;
  }

  if (input.regime.regime === "stagnation" || input.regime.regime === "pre_revenue") {
    explorationLambda += 0.4;
    exploitBias -= 0.15;
  } else if (input.regime.regime === "decline") {
    // Decline: explore recovery levers but don't abandon proven protect moves.
    explorationLambda += 0.2;
    exploitBias += 0.05;
  } else if (input.regime.regime === "compounding" || input.regime.regime === "breakout") {
    exploitBias += 0.15;
  }

  if (input.shortfall.dayVerdict === "lost_day") {
    explorationLambda += 0.15;
  }

  const zeroHour = isZeroHour(input.hourPulse);
  if (zeroHour) {
    explorationLambda += 0.55;
    exploitBias -= 0.12;
  }

  explorationLambda = Number(clamp(explorationLambda, 0.4, 2.5).toFixed(3));
  exploitBias = Number(clamp(exploitBias, 0.1, 0.95).toFixed(3));

  const reason = zeroHour
    ? `ZERO HOUR overdrive. Last 60 minutes printed $0. Regime=${input.regime.regime}. λ=${explorationLambda}, exploitBias=${exploitBias}. Empty hours must not repeat.`
    : input.shortfall.dayVerdict === "lost_day"
      ? `Lost day ($${input.shortfall.shortfallUsd.toFixed(0)} short of $${input.shortfall.northStarDailyProfitUsd.toLocaleString()}). Regime=${input.regime.regime}. Keep learning: λ=${explorationLambda}, exploitBias=${exploitBias}.`
      : `North-star day hit. Regime=${input.regime.regime}. Shift toward scaling winners while still probing upside: λ=${explorationLambda}.`;

  return {
    explorationLambda,
    exploitBias,
    alwaysLearning: true,
    reason,
  };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
