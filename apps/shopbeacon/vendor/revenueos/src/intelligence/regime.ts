import type { RegimeReport, Scorecard } from "../types";

/**
 * Detect the growth regime from scorecard history so the brain adapts its
 * playbook: pre-revenue discovery, stagnation breakout, compounding scale, or
 * decline defense — not one static strategy forever.
 */

export function detectRegime(
  scorecards: Scorecard[],
  currentProfitUsd: number,
  currentPurchases: number,
): RegimeReport {
  const chrono = [...scorecards].reverse();
  const profits = [
    ...chrono.map((s) => s.contributionProfitUsd ?? 0),
    currentProfitUsd,
  ];
  const traffics = chrono.map((s) => s.landingViews ?? 0);

  if (currentPurchases <= 0 && currentProfitUsd <= 0) {
    return {
      regime: "pre_revenue",
      confidence: 0.9,
      note: "Pre-revenue regime: every cycle must produce a measurable acquisition or conversion learning toward the first sale, then compound to the north star.",
    };
  }

  if (profits.length >= 3) {
    const recent = profits.slice(-3);
    const declining =
      recent[2] < recent[1] && recent[1] < recent[0] && recent[0] > 0;
    if (declining) {
      return {
        regime: "decline",
        confidence: 0.75,
        note: "Decline regime: protect margin and fulfillment, diagnose the regression, then re-accelerate — do not spray new acquisition while the funnel is rotting.",
      };
    }
  }

  if (profits.length >= 4) {
    const early = avg(profits.slice(0, Math.floor(profits.length / 2)));
    const late = avg(profits.slice(Math.floor(profits.length / 2)));
    if (late > early * 1.25 && late > 0) {
      return {
        regime: "compounding",
        confidence: 0.7,
        note: "Compounding regime: double down on proven arms while still exploring under-tested high-upside channels — scale what works toward the $10k day.",
      };
    }
  }

  const flat =
    profits.length >= 3 &&
    Math.max(...profits.slice(-3)) - Math.min(...profits.slice(-3)) <
      Math.max(1, avg(profits.slice(-3)) * 0.05);
  const trafficFlat =
    traffics.length >= 3 &&
    Math.max(...traffics.slice(-3)) - Math.min(...traffics.slice(-3)) < 5;

  if (flat || trafficFlat) {
    return {
      regime: "stagnation",
      confidence: 0.65,
      note: "Stagnation regime: current playbook is not closing the north-star gap. Force a structurally different hypothesis and raise exploration.",
    };
  }

  if (currentProfitUsd > 0 && profits.length >= 2) {
    const prev = profits[profits.length - 2] ?? 0;
    if (currentProfitUsd > prev * 1.5 && currentProfitUsd > prev + 10) {
      return {
        regime: "breakout",
        confidence: 0.6,
        note: "Breakout regime: something is working — attribute it fast, replicate the pattern, and keep learning so the breakout becomes a $10k habit.",
      };
    }
  }

  return {
    regime: "stagnation",
    confidence: 0.4,
    note: "Insufficient signal to classify cleanly — default to learn-hard mode toward the north star.",
  };
}

function avg(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}
