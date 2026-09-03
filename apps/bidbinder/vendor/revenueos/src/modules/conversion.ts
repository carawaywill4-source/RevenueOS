import type {
  Bottleneck,
  FunnelStepStat,
  Observation,
  ShopperModel,
} from "../types";
import {
  inferPrimaryFriction,
  FRICTION_PLAYBOOK,
} from "../knowledge/shopping-psychology";

export function detectBottleneck(input: {
  purchases: number;
  fulfillmentFailed: number;
  landingViews: number;
  checkouts: number;
}): Bottleneck {
  if (input.fulfillmentFailed > 0 && input.purchases > 0) {
    return {
      level: 2,
      label: "Fulfilment failures",
      detail: `${input.fulfillmentFailed} fulfilment failure(s) while sales exist. Fix delivery before acquisition.`,
    };
  }
  if (input.landingViews >= 50 && input.checkouts === 0) {
    return {
      level: 3,
      label: "Traffic without conversion",
      detail: "Qualified sessions are arriving but none reach checkout.",
    };
  }
  if (input.landingViews < 50) {
    return {
      level: 4,
      label: "Almost no qualified traffic",
      detail:
        "Discovery is weak. Acquisition and link-earning dominate until strangers arrive.",
    };
  }
  if (input.purchases > 0) {
    return {
      level: 5,
      label: "No recurring revenue yet",
      detail: "Consumer sales exist but retention/subscription is unproven.",
    };
  }
  return {
    level: 4,
    label: "Almost no qualified traffic",
    detail: "Default: grow discovery until a stranger pays.",
  };
}

export function conversionHints(observation: Observation): string[] {
  const hints: string[] = [];
  const drop = observation.funnel.largestDrop;
  if (observation.funnel.landingViews >= 50 && drop) {
    hints.push(
      `Largest drop at ${drop.step} (${((drop.dropRate ?? 0) * 100).toFixed(0)}%).`,
    );
  }
  return hints;
}

export function isMeaningfulFunnelDrop(
  drop: FunnelStepStat | null,
  landingViews: number,
) {
  return Boolean(drop && landingViews >= 50);
}

/** Model why shoppers hesitate, from funnel evidence + portable psychology. */
export function buildShopperModel(observation: Observation): ShopperModel {
  const primaryFriction = inferPrimaryFriction(observation);
  const landing = observation.funnel.landingViews;
  const purchases = observation.money.purchases;
  const intentTemperature: ShopperModel["intentTemperature"] =
    purchases > 0 ? "hot" : landing >= 200 ? "warm" : landing >= 30 ? "cold" : "unknown";

  const frictionHypotheses = FRICTION_PLAYBOOK[primaryFriction].slice(0, 2);
  const notes: string[] = [];
  const drop = observation.funnel.largestDrop;
  if (landing >= 50 && drop) {
    notes.push(
      `Largest funnel drop at ${drop.step} (${((drop.dropRate ?? 0) * 100).toFixed(0)}%).`,
    );
  } else if (landing < 50) {
    notes.push("Too few sessions to trust funnel-shape conclusions yet.");
  }

  return { primaryFriction, intentTemperature, frictionHypotheses, notes };
}
