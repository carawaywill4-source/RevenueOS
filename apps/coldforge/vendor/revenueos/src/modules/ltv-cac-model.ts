/**
 * LTV / CAC model per mechanism.
 *
 * Ranks mechanisms by (estimated LTV) − (estimated CAC), so downstream planners
 * can prefer moves whose unit economics actually clear the bar. Both sides of
 * the ratio are approximated conservatively:
 *
 *   LTV  ≈ priceUsd * marginEstimate * repeatFactor(mechanism)
 *   CAC  ≈ Σ(effortUsdPerUnit) over attributed pursuits for the mechanism
 *
 * Where portfolio signal exists (attributed commercial outcomes per pattern),
 * the model dampens CAC by the observed conversion rate — a mechanism that
 * actually converts is cheaper than the effort-only estimate suggests.
 *
 * The model deliberately does NOT try to be exact; the goal is to rank
 * mechanisms so direct_outreach beats owned_content when direct_outreach has
 * commercial signal — that's the ordering the strategist needs to see.
 */

import type { BusinessContext } from "../types";
import type { PatternPosterior, PatternPosteriorMap } from "./pattern-posterior";
import type { MechanismClass } from "./action-class";

export type MechanismProfitability = {
  mechanism: MechanismClass;
  patterns: number;
  attempts: number;
  ltvUsd: number;
  cacUsd: number;
  contributionPerCustomerUsd: number;
  expectedProfitUsd: number;
  /** Sum of attributed commercial outcomes for the mechanism. */
  commercialOutcomes: number;
  reason: string;
};

/** How many additional purchases a customer makes over life, per mechanism. */
const REPEAT_FACTOR: Record<MechanismClass, number> = {
  direct_outreach: 2.6, // relationship-based → higher repeat
  owned_content: 1.8,
  owned_distribution: 1.5,
  external_placement: 2.0,
  community_participation: 2.2,
  product_iteration: 3.0,
  conversion_optimization: 2.5,
  unknown: 1.5,
};

/** Effort→USD conversion. Effort 1..5 * OWNER_TIME_USD/hr * hours_estimate. */
const EFFORT_USD_PER_UNIT: Record<MechanismClass, number> = {
  direct_outreach: 18, // ~10 min of a $100/hr operator to send a real message
  owned_content: 60,
  owned_distribution: 4,
  external_placement: 25,
  community_participation: 20,
  product_iteration: 200,
  conversion_optimization: 45,
  unknown: 30,
};

/**
 * Local commercial-signal hint (renamed from PortfolioSignal to avoid a name
 * clash with revenue-priority.PortfolioSignal, which is the primary one
 * consumed by the planner).
 */
export type LtvCacCommercialSignal = {
  /** Optional attributed commercial outcomes by patternKey. */
  commercialOutcomesByPattern?: Record<string, number>;
};

function averagePrice(context: BusinessContext | undefined): {
  price: number;
  margin: number;
} {
  const products = context?.products ?? [];
  if (products.length === 0) {
    // Sensible default when portfolio hasn't published prices: $49 @ 60% margin.
    return { price: 49, margin: 0.6 };
  }
  const price = products.reduce((s, p) => s + p.priceUsd, 0) / products.length;
  const margin =
    products.reduce((s, p) => s + p.marginEstimate, 0) / products.length;
  return { price, margin };
}

function bucketByMechanism(posteriors: PatternPosteriorMap): Map<
  MechanismClass,
  PatternPosterior[]
> {
  const map = new Map<MechanismClass, PatternPosterior[]>();
  for (const p of Object.values(posteriors)) {
    const arr = map.get(p.mechanism) ?? [];
    arr.push(p);
    map.set(p.mechanism, arr);
  }
  return map;
}

/**
 * Rank mechanisms by expected profit per customer given priors from
 * pattern-posterior and the business's average unit economics.
 */
export function mechanismProfitabilityRanking(input: {
  posteriors: PatternPosteriorMap;
  portfolioSignal?: LtvCacCommercialSignal;
  context?: BusinessContext;
}): MechanismProfitability[] {
  const { price, margin } = averagePrice(input.context);
  const contributionPerCustomer = Math.max(0, price * margin);
  const buckets = bucketByMechanism(input.posteriors);

  const rows: MechanismProfitability[] = [];
  for (const [mechanism, patterns] of buckets) {
    const attempts = patterns.reduce((s, p) => s + p.attempts, 0);
    const attributedCommercial = patterns.reduce(
      (s, p) =>
        s +
        (input.portfolioSignal?.commercialOutcomesByPattern?.[p.patternKey] ??
          p.commercialOutcomes),
      0,
    );
    const attributedIntents = patterns.reduce((s, p) => s + p.intents, 0);
    const repeatFactor = REPEAT_FACTOR[mechanism];
    const ltvUsd = Number((contributionPerCustomer * repeatFactor).toFixed(2));

    // CAC: attempts * effortCost, discounted by realized conversion rate.
    const rawCac = attempts * EFFORT_USD_PER_UNIT[mechanism];
    const conversionRate =
      attempts > 0 ? attributedCommercial / Math.max(1, attempts) : 0;
    const intentRate =
      attempts > 0 ? attributedIntents / Math.max(1, attempts) : 0;
    // Blended: commercial signal fully offsets CAC; intent partially offsets.
    const efficiency = Math.min(1, conversionRate * 2 + intentRate * 0.5);
    const cacUsd = Number((rawCac * (1 - efficiency)).toFixed(2));

    const expectedProfitPerCustomer = ltvUsd - cacUsd;
    // Convert to expected total profit projected over attributed outcomes,
    // floored at LTV so unproven-but-plausible mechanisms don't score zero.
    const commercialProjection = Math.max(1, attributedCommercial);
    const expectedProfitUsd = Number(
      (expectedProfitPerCustomer * commercialProjection).toFixed(2),
    );

    rows.push({
      mechanism,
      patterns: patterns.length,
      attempts,
      ltvUsd,
      cacUsd,
      contributionPerCustomerUsd: Number(contributionPerCustomer.toFixed(2)),
      expectedProfitUsd,
      commercialOutcomes: Number(attributedCommercial.toFixed(2)),
      reason:
        attributedCommercial > 0
          ? `Commercial signal ${attributedCommercial.toFixed(1)} across ${attempts} attempts; LTV $${ltvUsd} > CAC $${cacUsd}.`
          : attempts > 0
            ? `${attempts} attempts, no attributed commercial signal yet — CAC penalized.`
            : `No history — using conservative LTV $${ltvUsd} vs $0 CAC.`,
    });
  }

  return rows.sort((a, b) => b.expectedProfitUsd - a.expectedProfitUsd);
}
