import type { Observation, Opportunity, WorldModel } from "../types";

/**
 * Retention levers only make sense once real sales exist. Before that, the brain
 * should not waste ranking budget imagining loyalty programs for zero buyers.
 */
export function proposeRetention(input: {
  world: WorldModel;
  observation: Observation;
}): Array<Omit<Opportunity, "score">> {
  const { world, observation } = input;
  if (observation.money.purchases <= 0) return [];

  const items: Array<Omit<Opportunity, "score">> = [];

  if (world.business.monetizationStage !== "recurring") {
    items.push({
      id: "post-purchase-followup",
      title: "Earn a second purchase from existing buyers",
      metric: "repeat purchase rate",
      category: "retention",
      precursorMetric: "repeat_rate",
      expectedImpact: 6,
      confidence: 0.5,
      effort: 2,
      action:
        "Add a genuine, useful post-purchase touch (delivery confirmation + optional next-need offer). No spam, honor opt-out.",
      patternKey: "post-purchase-repeat",
    });
  }

  return items;
}
