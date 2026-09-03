import type {
  Experiment,
  Observation,
  Scorecard,
  WorldModel,
} from "../types";

/**
 * Self-evaluation. When the brain is not making financial progress it must
 * diagnose *why* and change approach — never quietly stop or celebrate activity.
 */
export function diagnose(input: {
  observation: Observation;
  world: WorldModel;
  priorScorecards: Scorecard[];
  experiments: Experiment[];
}): { stuck: boolean; diagnosis?: string } {
  const { observation, world, priorScorecards, experiments } = input;
  const revenue = observation.money.revenueUsd;
  const purchases = observation.money.purchases;

  const recent = priorScorecards.slice(0, 3);
  const revenueFlat =
    recent.length >= 2 && recent.every((s) => s.revenueUsd === revenue);
  const noWins = experiments.every((e) => e.status !== "won");
  const lost = experiments.filter((e) => e.status === "lost").length;

  if (!world.business.fulfillmentReliable) {
    return {
      stuck: true,
      diagnosis:
        "Fulfillment is failing on paid orders. All growth is on hold until delivery is reliable.",
    };
  }

  if (purchases === 0 && revenueFlat) {
    const reason =
      world.market.discoveryCoverage === "none" ||
      world.market.discoveryCoverage === "thin"
        ? "discovery is too thin for strangers to arrive"
        : world.shopper.primaryFriction !== "discovery" &&
            world.shopper.primaryFriction !== "none"
          ? `qualified visitors stall on ${world.shopper.primaryFriction} friction`
          : "acquisition attempts have not yet produced qualified traffic";
    const topPlay = world.audience.channelPlan[0];
    const channelNudge = topPlay
      ? ` Work the plan — next channel: ${topPlay.rationale.split(".")[0]}.`
      : "";
    return {
      stuck: true,
      diagnosis:
        `Lost day vs $10k north star and still pre-revenue/flat: ${reason}. Traffic is a solvable problem, not an excuse — escalate the highest-EV unblock (including owner-gated channels) and try a different lever than last cycle. Giving up is not a diagnosis.${channelNudge}`,
    };
  }

  if (lost >= 2 && noWins) {
    return {
      stuck: true,
      diagnosis:
        "Multiple lost experiments and no wins. Do not quit and do not repeat recent losers — pursue a structurally different hypothesis. Giving up is forbidden.",
    };
  }

  return { stuck: false };
}
