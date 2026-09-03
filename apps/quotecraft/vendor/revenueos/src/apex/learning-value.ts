/**
 * LearningValueEstimator + counterfactual thinking.
 * Prefer E[information] × E[commercial] / cost.
 */

import type { EvidenceLevel, LearningClock } from "./types";
import { trafficInsufficient } from "./evidence-sufficiency";
import type { RankedAction } from "./priority";
import { classifyActionClock } from "./learning-clocks";

export type LearningValue = {
  action: string;
  expected_information_gain: number;
  expected_commercial_value: number;
  cost: number;
  score: number;
  counterfactual_note: string;
  clock: LearningClock;
};

export function estimateLearningValue(input: {
  action: RankedAction;
  evidenceLevel: EvidenceLevel;
  firstCustomerMode: boolean;
}): LearningValue {
  const clock = classifyActionClock(input.action.action);
  let info = input.action.information_value;
  let commercial = input.action.expected_value;
  const cost = Math.max(0.01, input.action.cost);

  // Under insufficient traffic, acquisition experiments teach more than product mutations.
  if (trafficInsufficient(input.evidenceLevel)) {
    if (clock === "FAST_ACQUISITION") {
      info += 0.25;
      commercial += 0.15;
    } else {
      info *= 0.35;
      commercial *= 0.25;
    }
  }

  if (input.firstCustomerMode && clock === "FAST_ACQUISITION") {
    info += 0.15;
    commercial += 0.1;
  }

  const score = (info * commercial) / cost;
  const counterfactual_note =
    clock === "SLOW_PRODUCT_CONVERSION"
      ? "Counterfactual: leave product unchanged and expose to more high-intent prospects — would yield clearer demand evidence."
      : "Counterfactual: if the offer is fundamentally broken, more traffic alone wastes attention — watch for checkout-start without purchase at scale before mutating.";

  return {
    action: input.action.action,
    expected_information_gain: Number(info.toFixed(3)),
    expected_commercial_value: Number(commercial.toFixed(3)),
    cost,
    score: Number(score.toFixed(3)),
    counterfactual_note,
    clock,
  };
}

export function rankByLearningValue(input: {
  actions: RankedAction[];
  evidenceLevel: EvidenceLevel;
  firstCustomerMode: boolean;
}): LearningValue[] {
  return input.actions
    .map((a) =>
      estimateLearningValue({
        action: a,
        evidenceLevel: input.evidenceLevel,
        firstCustomerMode: input.firstCustomerMode,
      }),
    )
    .sort((x, y) => y.score - x.score);
}

/** Disconfirming tests for a WTP / market belief. */
export function disconfirmingTestsForBelief(statement: string): string[] {
  const s = statement.toLowerCase();
  if (s.includes("scope creep") || s.includes("willingness to pay")) {
    return [
      "Freelancers already use free templates and will not pay $45",
      "Problem is recognized but not valued enough to purchase",
      "Buyers want software/automation rather than documents",
      "Different segments (agency vs solo) behave differently — solo may not convert",
      "Scope creep pain is real but buyers prefer attorney-reviewed contracts",
      "Actual buyer is an agency ops manager, not the individual freelancer hypothesized",
    ];
  }
  return [
    "Target persona does not have willingness to pay",
    "Problem is mis-specified relative to real demand",
    "Channel reaches browsers, not buyers",
  ];
}
