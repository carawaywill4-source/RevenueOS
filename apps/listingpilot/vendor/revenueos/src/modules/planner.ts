import { projectHorizonProfit } from "../intelligence/simulator";
import type {
  Opportunity,
  Strategy,
  StrategyStep,
  WorldModel,
} from "../types";

/**
 * Turn a ranked opportunity list into a COHERENT, sequenced plan rather than a
 * single greedy pick. Respects funnel dependencies: protect fulfillment first,
 * fix conversion before pouring in traffic, then scale acquisition, then
 * compound with retention. Projects horizon profit with diminishing returns so
 * the plan reflects realistic parallel capacity, not fantasy stacking.
 */

const CATEGORY_PRIORITY: Record<string, number> = {
  operations: 0,
  conversion: 1,
  acquisition: 2,
  pricing: 3,
  retention: 4,
};

export function buildStrategy(
  opportunities: Opportunity[],
  world: WorldModel,
  maxSteps = 4,
): Strategy {
  if (opportunities.length === 0) {
    return { steps: [], projectedProfitUsd: 0, horizonNote: "No levers available." };
  }

  const funnelLeaks =
    world.shopper.primaryFriction !== "discovery" &&
    world.shopper.primaryFriction !== "none";

  // Sort by dependency phase first, then by score within phase.
  const ordered = [...opportunities].sort((a, b) => {
    const pa = CATEGORY_PRIORITY[a.category ?? "acquisition"] ?? 2;
    const pb = CATEGORY_PRIORITY[b.category ?? "acquisition"] ?? 2;
    if (pa !== pb) return pa - pb;
    return b.score - a.score;
  });

  const steps: StrategyStep[] = [];
  let previousCategory: string | undefined;
  for (const opp of ordered) {
    if (steps.length >= maxSteps) break;
    const ev = opp.predicted?.expectedProfitUsd ?? 0;
    // Profit-first: a lever only earns a place if it makes money. The one
    // exception is a live protective fire (fulfillment failing) — never a $0
    // maintenance chore when there is nothing to protect yet.
    const protectiveFire =
      opp.category === "operations" && !world.business.fulfillmentReliable;
    if (ev <= 0 && !protectiveFire) continue;
    const category = opp.category ?? "acquisition";
    // Encode the key dependency: acquisition is gated on a healthy funnel.
    let blockedBy: string | undefined;
    if (
      category === "acquisition" &&
      funnelLeaks &&
      steps.some((s) => s.category === "conversion")
    ) {
      blockedBy = steps.find((s) => s.category === "conversion")?.opportunityId;
    }
    if (!world.business.fulfillmentReliable && category !== "operations") {
      blockedBy =
        steps.find((s) => s.category === "operations")?.opportunityId ?? blockedBy;
    }

    steps.push({
      order: steps.length + 1,
      opportunityId: opp.id,
      title: opp.title,
      category: opp.category,
      precursorMetric: opp.precursorMetric,
      expectedProfitUsd: opp.predicted?.expectedProfitUsd ?? 0,
      horizonProfitUsd: projectHorizonProfit(opp),
      rationale:
        category === previousCategory
          ? "Second lever in the same phase; run in parallel if capacity allows."
          : phaseRationale(category),
      blockedBy,
    });
    previousCategory = category;
  }

  // Diminishing returns: full value for step 1, then decay.
  const projectedProfitUsd = Number(
    steps
      .reduce((sum, step, i) => sum + step.horizonProfitUsd * (1 / (i + 1)), 0)
      .toFixed(2),
  );

  return {
    steps,
    projectedProfitUsd,
    horizonNote: steps.length
      ? `${steps.length}-step plan; lead lever: ${steps[0].title}.`
      : "No profitable levers in policy right now.",
  };
}

function phaseRationale(category: string): string {
  switch (category) {
    case "operations":
      return "Protect existing margin/delivery before anything else.";
    case "conversion":
      return "Convert the traffic you already have before scaling it.";
    case "acquisition":
      return "Bring qualified strangers to a funnel that already converts.";
    case "retention":
      return "Compound revenue from buyers you already earned.";
    case "pricing":
      return "Lift contribution margin once volume is proven.";
    default:
      return "Move a measurable revenue precursor.";
  }
}
